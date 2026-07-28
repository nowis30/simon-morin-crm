import { Prisma, ProspectStatus, PropertyStatus, VisitStatus, type Visit } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/sanitize";
import { appTimeZone } from "@/lib/env";
import { fetchGoogleBusyRanges } from "@/lib/google-calendar";
import {
  generateAvailableSlots,
  getDefaultAvailabilitySettings,
  getDefaultWeekSchedule,
  toDateRange,
  type AvailabilitySettings,
  type DateRange,
  type SlotResult,
  type WeekSchedule,
} from "@/lib/visit-availability";

export type VisitAvailabilitySettingsInput = {
  timeZone?: string;
  visitDurationMinutes?: number;
  bufferMinutes?: number;
  minLeadHours?: number;
  maxVisitsPerEvening?: number;
  weekSchedule?: WeekSchedule;
};

export function buildVisitEventPayload(visit: {
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  prospect: {
    name: string;
    phone: string;
    email: string | null;
    bedroomsNeeded: number | null;
    maxBudget: number | null;
    hasPets: boolean;
    needsParking: boolean;
  };
  property: {
    codeIsr: string;
    address: string;
    city: string;
    district: string | null;
  };
}) {
  const fullAddress = `${visit.property.address}, ${visit.property.city}${visit.property.district ? `, ${visit.property.district}` : ""}`;
  const summary = `Visite logement - ${visit.property.address} - ${visit.prospect.name}`;
  const description = [
    `Code ISR: ${visit.property.codeIsr}`,
    `Adresse: ${fullAddress}`,
    `Prospect: ${visit.prospect.name}`,
    `Telephone: ${visit.prospect.phone}`,
    `Courriel: ${visit.prospect.email || "N/A"}`,
    `Chambres recherchees: ${visit.prospect.bedroomsNeeded ?? "N/A"}`,
    `Budget: ${visit.prospect.maxBudget ?? "N/A"}`,
    `Animaux: ${visit.prospect.hasPets ? "Oui" : "Non"}`,
    `Stationnement: ${visit.prospect.needsParking ? "Oui" : "Non"}`,
    `Notes: ${visit.notes || "Aucune"}`,
    `Lien prospect CRM: /prospects`,
    `Lien logement CRM: /properties`,
  ].join("\n");

  return {
    summary,
    description,
    location: fullAddress,
    startsAtIso: visit.startsAt.toISOString(),
    endsAtIso: visit.endsAt.toISOString(),
  };
}

export async function getOrCreateVisitAvailabilitySettings(userId: string) {
  const existing = await prisma.visitAvailabilitySettings.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return prisma.visitAvailabilitySettings.create({
    data: {
      userId,
      timeZone: appTimeZone,
      visitDurationMinutes: 30,
      bufferMinutes: 30,
      minLeadHours: 2,
      maxVisitsPerEvening: 4,
      weekSchedule: getDefaultWeekSchedule() as Prisma.InputJsonValue,
    },
  });
}

export async function updateVisitAvailabilitySettings(userId: string, payload: VisitAvailabilitySettingsInput) {
  const current = await getOrCreateVisitAvailabilitySettings(userId);

  return prisma.visitAvailabilitySettings.update({
    where: { id: current.id },
    data: {
      timeZone: payload.timeZone || current.timeZone,
      visitDurationMinutes: payload.visitDurationMinutes ?? current.visitDurationMinutes,
      bufferMinutes: payload.bufferMinutes ?? current.bufferMinutes,
      minLeadHours: payload.minLeadHours ?? current.minLeadHours,
      maxVisitsPerEvening: payload.maxVisitsPerEvening ?? current.maxVisitsPerEvening,
      weekSchedule: (payload.weekSchedule ?? (current.weekSchedule as WeekSchedule)) as Prisma.InputJsonValue,
    },
  });
}

export async function listBlockedVisitPeriods(userId: string) {
  return prisma.visitBlockedPeriod.findMany({
    where: { userId },
    orderBy: { startsAt: "asc" },
  });
}

export async function createBlockedVisitPeriod(userId: string, input: { startsAt: string; endsAt: string; reason?: string }) {
  return prisma.visitBlockedPeriod.create({
    data: {
      userId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: cleanText(input.reason) || null,
    },
  });
}

export async function deleteBlockedVisitPeriod(userId: string, id: string) {
  await prisma.visitBlockedPeriod.deleteMany({ where: { id, userId } });
}

export async function computeAvailableVisitSlots(params: {
  userId: string;
  propertyId: string;
  prospectId: string;
  rangeStartIso: string;
  rangeEndIso: string;
}) {
  const settingsRecord = await getOrCreateVisitAvailabilitySettings(params.userId);
  const settings: AvailabilitySettings = {
    timeZone: settingsRecord.timeZone,
    visitDurationMinutes: settingsRecord.visitDurationMinutes,
    bufferMinutes: settingsRecord.bufferMinutes,
    minLeadHours: settingsRecord.minLeadHours,
    maxVisitsPerEvening: settingsRecord.maxVisitsPerEvening,
    weekSchedule: settingsRecord.weekSchedule as WeekSchedule,
  };

  const [busyGoogle, existingVisits, blockedPeriods] = await Promise.all([
    fetchGoogleBusyRanges({
      userId: params.userId,
      timeMin: params.rangeStartIso,
      timeMax: params.rangeEndIso,
    }),
    prisma.visit.findMany({
      where: {
        status: { in: [VisitStatus.PENDING_APPROVAL, VisitStatus.CONFIRMED] },
        startsAt: { gte: new Date(params.rangeStartIso) },
        endsAt: { lte: new Date(params.rangeEndIso) },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.visitBlockedPeriod.findMany({
      where: {
        userId: params.userId,
        startsAt: { lte: new Date(params.rangeEndIso) },
        endsAt: { gte: new Date(params.rangeStartIso) },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const existingRanges: DateRange[] = existingVisits.map((item) => toDateRange(item.startsAt, item.endsAt));
  const blockedRanges: DateRange[] = blockedPeriods.map((item) => toDateRange(item.startsAt, item.endsAt));

  const slots = generateAvailableSlots({
    rangeStartIso: params.rangeStartIso,
    rangeEndIso: params.rangeEndIso,
    settings,
    occupiedRanges: busyGoogle.ranges.map((item) => ({ startsAt: item.start, endsAt: item.end })),
    existingVisits: existingRanges,
    blockedRanges,
  });

  return {
    slots,
    settings,
    googleSource: busyGoogle.source,
  };
}

export function buildPendingVisitInput(input: {
  prospectId: string;
  propertyId: string;
  startsAtIso: string;
  endsAtIso: string;
  notes?: string;
  minimumLeadHours?: number;
  idempotencyKey?: string;
}) {
  return {
    prospectId: input.prospectId,
    propertyId: input.propertyId,
    startsAt: new Date(input.startsAtIso),
    endsAt: new Date(input.endsAtIso),
    notes: cleanText(input.notes),
    status: VisitStatus.PENDING_APPROVAL,
    minimumLeadHours: input.minimumLeadHours ?? 2,
    idempotencyKey: input.idempotencyKey || randomUUID(),
  } satisfies Prisma.VisitUncheckedCreateInput;
}

export function overlaps(slot: SlotResult | { startsAt: string; endsAt: string }, visit: { startsAt: Date; endsAt: Date }, bufferMinutes = 30) {
  const slotStart = new Date(slot.startsAt).getTime();
  const slotEnd = new Date(slot.endsAt).getTime();
  const visitStart = visit.startsAt.getTime();
  const visitEndWithBuffer = visit.endsAt.getTime() + bufferMinutes * 60 * 1000;
  return slotStart < visitEndWithBuffer && slotEnd > visitStart;
}

export async function assertVisitSlotStillAvailable(params: {
  userId: string;
  startsAtIso: string;
  endsAtIso: string;
  ignoreVisitId?: string;
}) {
  const [busyGoogle, existing] = await Promise.all([
    fetchGoogleBusyRanges({
      userId: params.userId,
      timeMin: params.startsAtIso,
      timeMax: params.endsAtIso,
    }),
    prisma.visit.findMany({
      where: {
        id: params.ignoreVisitId ? { not: params.ignoreVisitId } : undefined,
        status: { in: [VisitStatus.PENDING_APPROVAL, VisitStatus.CONFIRMED] },
        startsAt: { lt: new Date(params.endsAtIso) },
        endsAt: { gt: new Date(params.startsAtIso) },
      },
      select: { id: true, startsAt: true, endsAt: true, bufferMinutes: true },
    }),
  ]);

  if (busyGoogle.ranges.length > 0) {
    return { ok: false, reason: "GOOGLE_BUSY" as const };
  }

  const requestedStart = new Date(params.startsAtIso).getTime();
  const requestedEnd = new Date(params.endsAtIso).getTime();

  for (const visit of existing) {
    const visitStart = visit.startsAt.getTime();
    const visitEnd = visit.endsAt.getTime() + (visit.bufferMinutes ?? 30) * 60 * 1000;
    if (requestedStart < visitEnd && requestedEnd > visitStart) {
      return { ok: false, reason: "INTERNAL_BUSY" as const };
    }
  }

  return { ok: true, reason: "AVAILABLE" as const };
}

export async function updateVisitStatusesAfterApproval(params: {
  visitId: string;
  prospectId: string;
  propertyId: string;
}) {
  await prisma.prospect.update({
    where: { id: params.prospectId },
    data: { status: ProspectStatus.VISIT_CONFIRMED },
  });

  await prisma.property.update({
    where: { id: params.propertyId },
    data: { status: PropertyStatus.VISIT_SCHEDULED },
  });
}

export function buildVisitMutationData(action: "RESCHEDULE" | "CANCEL" | "COMPLETE" | "NO_SHOW" | "ADD_NOTE", payload: {
  startsAt?: string;
  endsAt?: string;
  notes?: string;
}) {
  const cleanNotes = cleanText(payload.notes);

  if (action === "RESCHEDULE") {
    return {
      startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
      notes: cleanNotes,
    } satisfies Prisma.VisitUncheckedUpdateInput;
  }

  if (action === "CANCEL") {
    return {
      status: VisitStatus.CANCELLED,
      cancelledAt: new Date(),
      internalNotes: cleanNotes,
    } satisfies Prisma.VisitUncheckedUpdateInput;
  }

  if (action === "COMPLETE") {
    return {
      status: VisitStatus.COMPLETED,
      completedAt: new Date(),
      internalNotes: cleanNotes,
    } satisfies Prisma.VisitUncheckedUpdateInput;
  }

  if (action === "NO_SHOW") {
    return {
      status: VisitStatus.NO_SHOW,
      noShowAt: new Date(),
      internalNotes: cleanNotes,
    } satisfies Prisma.VisitUncheckedUpdateInput;
  }

  return {
    internalNotes: cleanNotes,
  } satisfies Prisma.VisitUncheckedUpdateInput;
}

export function getGoogleModeWarning(source: "GOOGLE" | "NO_GOOGLE") {
  if (source === "GOOGLE") {
    return null;
  }
  return "Mode sans Google actif: les plages Google n'ont pas pu etre verifiees.";
}

export function isVisitRequestDuplicate(existing: Pick<Visit, "prospectId" | "propertyId" | "startsAt">[], input: {
  prospectId: string;
  propertyId: string;
  startsAtIso: string;
}) {
  const target = new Date(input.startsAtIso).getTime();
  return existing.some((item) =>
    item.prospectId === input.prospectId &&
    item.propertyId === input.propertyId &&
    item.startsAt.getTime() === target,
  );
}

export const DEFAULT_AVAILABILITY_SETTINGS = getDefaultAvailabilitySettings();
