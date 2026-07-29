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
