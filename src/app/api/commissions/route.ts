import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.commission.findMany({
      include: {
        placement: {
          include: { prospect: true, property: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const monthly = items
      .filter((item) => item.createdAt >= monthStart)
      .reduce(
        (acc, item) => {
          acc.planned += item.plannedAmount;
          acc.invoiced += item.invoicedAmount ?? 0;
          acc.received += item.receivedAmount ?? 0;
          return acc;
        },
        { planned: 0, invoiced: 0, received: 0 },
      );

    const yearly = items
      .filter((item) => item.createdAt >= yearStart)
      .reduce(
        (acc, item) => {
          acc.planned += item.plannedAmount;
          acc.invoiced += item.invoicedAmount ?? 0;
          acc.received += item.receivedAmount ?? 0;
          return acc;
        },
        { planned: 0, invoiced: 0, received: 0 },
      );

    return NextResponse.json({ items, totals: { monthly, yearly } });
  } catch {
    return safeServerError();
  }
}
