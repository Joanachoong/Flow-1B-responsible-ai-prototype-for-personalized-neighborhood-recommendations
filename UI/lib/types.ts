// Shared contract (PRD "API and MCP tool contracts"). Mirrored in api/_lib/models.py —
// change both together and tell the other person.

export type HousingType = "apartment" | "house" | "condo" | "any";
/** 0 = studio, 3 = 3+ */
export type Bedrooms = 0 | 1 | 2 | 3;
export type Vibe = 1 | 2 | 3 | 4 | 5;
export type Match = "yes" | "partial" | "no";

export interface Weights {
  safety: number;
  transit: number;
  schools: number;
  amenities: number;
}

export interface Preferences {
  budgetMax: number;
  housingType: HousingType;
  bedrooms: Bedrooms;
  petFriendly: boolean;
  vibe: Vibe;
  weights: Weights;
  topN: number;
  /** Optional context from the onboarding survey (not part of the PRD's core filters). */
  householdSize?: number;
  bathrooms?: number;
}

export interface ZipFeature {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  match: Match;
  contribution: number;
}

export interface ZipResult {
  zip: string;
  neighborhood: string;
  rank: number;
  score: number;
  centroid: [number, number] | null;
  features: ZipFeature[];
  reason: string;
}

export interface Meta {
  zipsScored: number;
  matched: number;
}

export interface RecommendResponse {
  results: ZipResult[];
  appliedFilters: Partial<Preferences>;
  meta: Meta;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  understoodFilters: Partial<Preferences>;
  results: ZipResult[];
  meta?: Meta;
}
