/**
 * "YYYY-MM-DD" for a date's *local* calendar day.
 *
 * Not toISOString().slice(0, 10) — that is the UTC day, which is a different
 * date either side of midnight for anyone not on UTC. Due dates are local
 * calendar dates throughout this app, so every one of them comes through here.
 */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
