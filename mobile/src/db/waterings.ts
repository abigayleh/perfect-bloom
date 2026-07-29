import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Append-only. Never updates or deletes a row — this log is what makes V2
 * diagnosis possible ("watered three times this week" beats any photo), so it
 * only ever grows, and it survives the plant being removed.
 *
 * The API accepted a backdated watered_at; the app never offered a date picker,
 * so this only ever logs now. That removes the future-date and max-backdate
 * validation along with any way to trip it.
 */
export async function logWatering(db: SQLiteDatabase, plantId: number): Promise<void> {
  await db.runAsync('INSERT INTO watering_events (plant_id, watered_at) VALUES (?, ?)', [
    plantId,
    new Date().toISOString(),
  ]);
}

export async function lastWateredAt(
  db: SQLiteDatabase,
  plantId: number,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ watered_at: string | null }>(
    'SELECT MAX(watered_at) AS watered_at FROM watering_events WHERE plant_id = ?',
    [plantId],
  );
  return row?.watered_at ?? null;
}

/** One query for the whole collection rather than one per plant. */
export async function lastWateredFor(
  db: SQLiteDatabase,
  plantIds: number[],
): Promise<Record<number, string>> {
  if (plantIds.length === 0) return {};

  const placeholders = plantIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ plant_id: number; watered_at: string }>(
    `SELECT plant_id, MAX(watered_at) AS watered_at FROM watering_events
     WHERE plant_id IN (${placeholders}) GROUP BY plant_id`,
    plantIds,
  );

  return Object.fromEntries(rows.map((row) => [row.plant_id, row.watered_at]));
}

// No read-the-whole-history function: nothing displays it yet. The log is still
// written and never pruned, so V2 diagnosis can add the read when it needs it.
