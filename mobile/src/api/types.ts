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
  attribution: Attribution | null;
};

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
