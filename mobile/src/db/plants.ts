import type { SQLiteDatabase } from 'expo-sqlite';

import type { Plant } from '@/api/types';
import { lastWateredAt, lastWateredFor } from '@/db/waterings';
import { deletePhoto } from '@/lib/photos';
import { computeSchedule } from '@/lib/schedule';

export const MAX_INTERVAL_DAYS = 365;

type PlantRow = {
  id: number;
  nickname: string | null;
  scientific_name: string;
  common_name: string | null;
  image_uri: string | null;
  interval_days: number | null;
  created_at: string;
};

const COLUMNS =
  'id, nickname, scientific_name, common_name, image_uri, interval_days, created_at';

/** The schedule is recomputed on every read, never stored. */
function toPlant(row: PlantRow, watered: string | null, now: Date): Plant {
  return {
    ...row,
    ...computeSchedule({
      intervalDays: row.interval_days,
      lastWateredAt: watered,
      createdAt: row.created_at,
      now,
    }),
  };
}

export type PlantInput = {
  scientific_name?: string;
  nickname?: string | null;
  common_name?: string | null;
  image_uri?: string | null;
  interval_days?: number | null;
};

function validate(scientificName: string, nickname: string | null, interval: number | null) {
  if (!scientificName && !nickname) {
    throw new Error('Give the plant a name or a nickname.');
  }
  if (interval !== null && !(interval >= 1 && interval <= MAX_INTERVAL_DAYS)) {
    throw new Error(`Watering interval must be between 1 and ${MAX_INTERVAL_DAYS} days.`);
  }
}

export async function listPlants(db: SQLiteDatabase): Promise<Plant[]> {
  const rows = await db.getAllAsync<PlantRow>(
    `SELECT ${COLUMNS} FROM plants WHERE deleted_at IS NULL ORDER BY created_at DESC`,
  );
  const watered = await lastWateredFor(db, rows.map((row) => row.id));

  // One `now` for the whole list so every plant is measured against the same day.
  const now = new Date();
  return rows.map((row) => toPlant(row, watered[row.id] ?? null, now));
}

export async function getPlant(db: SQLiteDatabase, id: number): Promise<Plant | null> {
  const row = await db.getFirstAsync<PlantRow>(
    `SELECT ${COLUMNS} FROM plants WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) return null;
  return toPlant(row, await lastWateredAt(db, id), new Date());
}

export async function createPlant(db: SQLiteDatabase, input: PlantInput): Promise<Plant> {
  const scientificName = (input.scientific_name ?? '').trim();
  const nickname = (input.nickname ?? '').trim() || null;
  const interval = input.interval_days ?? null;
  validate(scientificName, nickname, interval);

  const result = await db.runAsync(
    `INSERT INTO plants (nickname, scientific_name, common_name, image_uri, interval_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      nickname,
      scientificName,
      (input.common_name ?? '').trim() || null,
      input.image_uri ?? null,
      interval,
      new Date().toISOString(),
    ],
  );

  const plant = await getPlant(db, result.lastInsertRowId);
  if (!plant) throw new Error('That plant could not be saved.');
  return plant;
}

// No update function: the API exposed PATCH but no screen ever called it, so
// there is still no way to edit a nickname or set an interval after saving. The
// detail screen's "No watering schedule set yet" has no affordance behind it.

/**
 * Soft delete the row, hard delete the photo.
 *
 * watering_events must outlive the plant, but the photo is not the log — it is a
 * picture taken inside someone's home, so removing the plant removes it. The URI
 * is cleared so nothing points at a file that is gone.
 */
export async function softDeletePlant(db: SQLiteDatabase, id: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ image_uri: string | null }>(
    'SELECT image_uri FROM plants WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  if (!row) return false;

  await db.runAsync('UPDATE plants SET deleted_at = ?, image_uri = NULL WHERE id = ?', [
    new Date().toISOString(),
    id,
  ]);

  if (row.image_uri) deletePhoto(row.image_uri);
  return true;
}
