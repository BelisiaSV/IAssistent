/** Date helpers on ISO dates (YYYY-MM-DD), independent of the server's time zone. */

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && fromUtc(toUtc(value)) === value;
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  return ((toUtc(iso).getUTCDay() + 6) % 7) + 1;
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Today in Belgium as an ISO date. */
export function todayInBelgium(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(now);
}

const weekdayFormat = new Intl.DateTimeFormat("nl-BE", { weekday: "long", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const longFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const weekdayName = (iso: string) => weekdayFormat.format(toUtc(iso));
export const shortDate = (iso: string) => shortFormat.format(toUtc(iso));
export const longDate = (iso: string) => longFormat.format(toUtc(iso));
