export type Attribution = {
  text: string;
  url: string;
  logo_path: string | null;
};

export type Candidate = {
  scientific_name: string;
  common_names: string[];
  score: number;
  confidence_percent: number;
  genus: string | null;
  family: string | null;
};

/**
 * The server also returns image_url/image_key, deliberately unused: the photo we
 * display is the local file the picker already gave us, and nothing is stored
 * until the user actually saves the plant.
 */
export type IdentifyResponse = {
  candidates: Candidate[];
  attribution: Attribution | null;
};

/**
 * A plant in the collection. Lives in the device's SQLite database — the schedule
 * fields are recomputed on every read by `computeSchedule`, never stored.
 */
export type Plant = {
  id: number;
  nickname: string | null;
  scientific_name: string;
  common_name: string | null;
  /** Local file URI under the document directory, not a server path. */
  image_uri: string | null;
  interval_days: number | null;
  created_at: string;
  last_watered_at: string | null;
  next_due_on: string | null;
  days_until_due: number | null;
  is_due: boolean;
  anchor: 'watering' | 'created';
};

export type Watering = {
  id: number;
  plant_id: number;
  watered_at: string;
};

/** Nickname wins, then the common name, then the binomial. */
export function plantName(plant: Plant): string {
  return plant.nickname || plant.common_name || plant.scientific_name || 'Unnamed plant';
}

export function dueLabel(plant: Plant): string {
  if (plant.interval_days === null || plant.days_until_due === null) return 'No schedule yet';
  const days = plant.days_until_due;
  if (days < -1) return `Overdue by ${-days} days`;
  if (days === -1) return 'Overdue by a day';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export type MatchKind = 'exact' | 'genus' | 'none';

export type CareInfo = {
  requested_name: string;
  normalized_name: string;
  match_kind: MatchKind;
  matched_name: string | null;
  common_name: string | null;
  watering: string | null;
  sunlight: string[];
  cycle: string | null;
  /** Tri-state. null means the source did not say — render "unknown", never "safe". */
  poisonous_to_pets: boolean | null;
  poisonous_to_humans: boolean | null;
  toxicity_known: boolean;
  from_cache: boolean;
};
