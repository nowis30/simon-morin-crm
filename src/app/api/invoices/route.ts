import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { validateCsrfToken } from "@/lib/csrf";

const invoiceCreateSchema = z.object({
  lines: z
    .array(
      z.object({
        commissionId: z.string().min(1),
        amount: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(50),
});

type InvoiceLine = {
  id: string;
  commissionId: string;
  tenantName: string;
  propertyCode: string;
  address: string;
  city: string;
  amount: number;
};

type InvoiceGroup = {
  number: string;
  billedAt: Date | null;
  total: number;
  lines: InvoiceLine[];
};

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;

    const commissions = await prisma.commission.findMany({
      include: {
        placement: {
          include: { prospect: true, property: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const available = commissions
      .filter((item) => !item.invoiceNumber && item.status !== "CANCELLED")
      .map((item) => ({
        id: item.id,
        plannedAmount: item.plannedAmount,
        status: item.status,
        tenantName: item.placement.prospect.name,
        propertyCode: item.placement.property.codeIsr,
        address: item.placement.property.address,
        city: item.placement.property.city,
        moveInDate: item.placement.moveInDate,
      }));

    const invoiceMap = new Map<string, InvoiceGroup>();
    for (const item of commissions) {
      if (!item.invoiceNumber) continue;
      const current = invoiceMap.get(item.invoiceNumber) ?? {
        number: item.invoiceNumber,
        billedAt: item.billedAt,
        total: 0,
        lines: [],
      };
      const amount = item.invoicedAmount ?? item.plannedAmount;
      current.total += amount;
      if (!current.billedAt || (item.billedAt && item.billedAt < current.billedAt)) {
        current.billedAt = item.billedAt;
      }
      current.lines.push({
        id: item.id,
        commissionId: item.id,
        tenantName: item.placement.prospect.name,
        propertyCode: item.placement.property.codeIsr,
        address: item.placement.property.address,
        city: item.placement.property.city,
        amount,
      });
      invoiceMap.set(item.invoiceNumber, current);
    }

    const invoices = Array.from(invoiceMap.values()).sort((a, b) => {
      const aTime = a.billedAt?.getTime() ?? 0;
      const bTime = b.billedAt?.getTime() ?? 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      available,
      invoices,
      sender: {
        name: "Simon Morin",
        title: "Agent de location / Commercial",
        business: "nowis.store",
        email: auth.user.email,
      },
      recipient: { name: "Gestion ISR" },
    });
  } catch {
    return safeServerError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const payload = await request.json();
    const parsed = invoiceCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données de facture invalides" }, { status: 400 });
    }

    const ids = parsed.data.lines.map((line) => line.commissionId);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Une commission ne peut apparaître qu'une fois sur la facture." }, { status: 400 });
    }

    const commissions = await prisma.commission.findMany({
      where: { id: { in: ids } },
      include: {
        placement: {
          include: { prospect: true, property: true },
        },
      },
    });

    if (commissions.length !== ids.length) {
      return NextResponse.json({ error: "Une commission sélectionnée est introuvable." }, { status: 404 });
    }

    if (commissions.some((item) => item.invoiceNumber)) {
      return NextResponse.json({ error: "Une commission sélectionnée a déjà été facturée." }, { status: 409 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const prefix = `SM-${year}-`;
    const existingInvoices = await prisma.commission.findMany({
      where: { invoiceNumber: { startsWith: prefix } },
      select: { invoiceNumber: true },
      distinct: ["invoiceNumber"],
    });
    const lastSequence = existingInvoices.reduce((max, item) => {
      const suffix = item.invoiceNumber?.slice(prefix.length) ?? "";
      const sequence = Number.parseInt(suffix, 10);
      return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    const invoiceNumber = `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
    const amountByCommission = new Map(parsed.data.lines.map((line) => [line.commissionId, line.amount]));

    await prisma.$transaction(
      commissions.map((item) =>
        prisma.commission.update({
          where: { id: item.id },
          data: {
            invoicedAmount: amountByCommission.get(item.id),
            invoiceNumber,
            status: "INVOICED",
            billedAt: now,
          },
        }),
      ),
    );

    const lines: InvoiceLine[] = commissions.map((item) => ({
      id: item.id,
      commissionId: item.id,
      tenantName: item.placement.prospect.name,
      propertyCode: item.placement.property.codeIsr,
      address: item.placement.property.address,
      city: item.placement.property.city,
      amount: amountByCommission.get(item.id) ?? item.plannedAmount,
    }));

    return NextResponse.json(
      {
        invoice: {
          number: invoiceNumber,
          billedAt: now,
          total: lines.reduce((sum, line) => sum + line.amount, 0),
          lines,
        },
      },
      { status: 201 },
    );
  } catch {
    return safeServerError();
  }
}
