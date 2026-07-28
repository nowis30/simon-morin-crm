import { DateTime, Interval } from "luxon";
import { appTimeZone } from "@/lib/env";

export type WeekDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DaySchedule = {
  enabled: boolean;
  start: string;
  end: string;
};

export type WeekSchedule = Record<WeekDayKey, DaySchedule>;

export type AvailabilitySettings = {
  timeZone: string;
  visitDurationMinutes: number;
  bufferMinutes: number;
  minLeadHours: number;
  maxVisitsPerEvening: number;
  weekSchedule: WeekSchedule;
};

export type DateRange = {
  startsAt: string;
  endsAt: string;
};

export type SlotResult = {
  startsAt: string;
  endsAt: string;
  timeZone: string;
};

const dayByWeekday: Record<number, WeekDayKey> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

export function getDefaultWeekSchedule(): WeekSchedule {
  return {
    monday: { enabled: true, start: "18:00", end: "21:00" },
    tuesday: { enabled: true, start: "18:00", end: "21:00" },
    wednesday: { enabled: true, start: "18:00", end: "21:00" },
    thursday: { enabled: true, start: "18:00", end: "21:00" },
    friday: { enabled: true, start: "18:00", end: "21:00" },
    saturday: { enabled: true, start: "09:00", end: "17:00" },
    sunday: { enabled: true, start: "09:00", end: "17:00" },
  };
}

export function getDefaultAvailabilitySettings(): AvailabilitySettings {
  return {
    timeZone: appTimeZone,
    visitDurationMinutes: 30,
    bufferMinutes: 30,
    minLeadHours: 2,
    maxVisitsPerEvening: 4,
    weekSchedule: getDefaultWeekSchedule(),
  };
}

function parseTime(time: string) {
  const [h, m] = time.split(":").map((value) => Number(value));
  return { hour: h, minute: m };
}

function intervalsOverlap(a: Interval, b: Interval) {
  if (!a.start || !a.end || !b.start || !b.end) {
    return false;
  }
  return a.start < b.end && a.end > b.start;
}

function toInterval(item: DateRange, zone: string, withBufferMinutes = 0) {
  const start = DateTime.fromISO(item.startsAt, { zone });
  const end = DateTime.fromISO(item.endsAt, { zone }).plus({ minutes: withBufferMinutes });
  return Interval.fromDateTimes(start, end);
}

function countEveningVisits(startsAt: DateTime, existingVisits: DateRange[], zone: string) {
  const dayStart = startsAt.startOf("day");
  const dayEnd = startsAt.endOf("day");
  return existingVisits.filter((visit) => {
    const visitStart = DateTime.fromISO(visit.startsAt, { zone });
    return visitStart >= dayStart && visitStart <= dayEnd && visitStart.hour >= 18;
  }).length;
}

export function generateAvailableSlots(input: {
  rangeStartIso: string;
  rangeEndIso: string;
  settings: AvailabilitySettings;
  nowIso?: string;
  occupiedRanges: DateRange[];
  existingVisits: DateRange[];
  blockedRanges: DateRange[];
}): SlotResult[] {
  const zone = input.settings.timeZone || appTimeZone;
  const now = input.nowIso ? DateTime.fromISO(input.nowIso, { zone }) : DateTime.now().setZone(zone);
  const minStartAllowed = now.plus({ hours: input.settings.minLeadHours });

  const searchStart = DateTime.fromISO(input.rangeStartIso, { zone }).startOf("day");
  const searchEnd = DateTime.fromISO(input.rangeEndIso, { zone }).endOf("day");

  const occupiedIntervals = input.occupiedRanges.map((item) => toInterval(item, zone, input.settings.bufferMinutes));
  const existingIntervals = input.existingVisits.map((item) => toInterval(item, zone, input.settings.bufferMinutes));
  const blockedIntervals = input.blockedRanges.map((item) => toInterval(item, zone));

  const results: SlotResult[] = [];

  for (let day = searchStart; day <= searchEnd; day = day.plus({ days: 1 })) {
    const key = dayByWeekday[day.weekday];
    const dayRule = input.settings.weekSchedule[key];
    if (!dayRule?.enabled) {
      continue;
    }

    const startTime = parseTime(dayRule.start);
    const endTime = parseTime(dayRule.end);

    let cursor = day.set({ hour: startTime.hour, minute: startTime.minute, second: 0, millisecond: 0 });
    const dayEnd = day.set({ hour: endTime.hour, minute: endTime.minute, second: 0, millisecond: 0 });

    while (cursor.plus({ minutes: input.settings.visitDurationMinutes }) <= dayEnd) {
      const slotStart = cursor;
      const slotEnd = cursor.plus({ minutes: input.settings.visitDurationMinutes });

      if (slotStart < minStartAllowed || slotStart < now) {
        cursor = cursor.plus({ minutes: input.settings.visitDurationMinutes });
        continue;
      }

      if (slotStart.hour >= 18) {
        const eveningCount = countEveningVisits(slotStart, input.existingVisits, zone);
        if (eveningCount >= input.settings.maxVisitsPerEvening) {
          cursor = cursor.plus({ minutes: input.settings.visitDurationMinutes });
          continue;
        }
      }

      const slotInterval = Interval.fromDateTimes(slotStart, slotEnd);

      const hasConflict =
        occupiedIntervals.some((interval) => intervalsOverlap(slotInterval, interval)) ||
        existingIntervals.some((interval) => intervalsOverlap(slotInterval, interval)) ||
        blockedIntervals.some((interval) => intervalsOverlap(slotInterval, interval));

      if (!hasConflict) {
        results.push({
          startsAt: slotStart.toISO()!,
          endsAt: slotEnd.toISO()!,
          timeZone: zone,
        });
      }

      cursor = cursor.plus({ minutes: input.settings.visitDurationMinutes });
    }
  }

  return results;
}

export function toDateRange(startsAt: Date, endsAt: Date): DateRange {
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
