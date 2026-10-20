// Shared with the calendar UI: keep this module independent of server settings.
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
