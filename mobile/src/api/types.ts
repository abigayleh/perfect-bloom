export type User = {
  id: number;
  email: string;
  timezone: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

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

export type IdentifyResponse = {
  candidates: Candidate[];
  image_url: string;
  image_key: string;
  attribution: Attribution | null;
};

export type Plant = {
  id: number;
  nickname: string | null;
  scientific_name: string;
  common_name: string | null;
  image_url: string | null;
  interval_days: number | null;
  created_at: string;
};

/** Nickname wins, then the common name, then the binomial. */
export function plantName(plant: Plant): string {
  return plant.nickname || plant.common_name || plant.scientific_name || 'Unnamed plant';
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
