import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'perfect-bloom.db';

const DATABASE_VERSION = 1;

/**
 * Schema versioning via PRAGMA user_version, the pattern expo-sqlite documents.
 *
 * Mirrors the tables this app used to keep server-side, minus user_id — there is
 * one collection per device now. Both domain rules survive the move: plants are
 * soft-deleted, and watering_events is append-only with no cascade, because the
 * log is what makes V2 diagnosis possible and must outlive the plant.
 *
 * Timestamps are ISO 8601 with an explicit Z. That matters: JavaScript parses a
 * bare "2026-07-01T12:00" as local time, so every write goes through
 * toISOString() and never a hand-built string.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE plants (
        id INTEGER PRIMARY KEY NOT NULL,
        nickname TEXT,
        scientific_name TEXT NOT NULL DEFAULT '',
        common_name TEXT,
        image_uri TEXT,
        interval_days INTEGER,
        created_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE watering_events (
        id INTEGER PRIMARY KEY NOT NULL,
        plant_id INTEGER NOT NULL,
        watered_at TEXT NOT NULL
      );

      CREATE INDEX watering_events_plant_id ON watering_events (plant_id);
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
