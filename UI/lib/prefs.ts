import type { Bedrooms, HousingType, Preferences, Vibe } from "./types";

export const DEFAULT_PREFS: Preferences = {
  budgetMax: 2500,
  housingType: "any",
  bedrooms: 1,
  petFriendly: false,
  vibe: 3,
  weights: { safety: 3, transit: 3, schools: 1, amenities: 3 },
  topN: 5,
};

export const BUDGET = { min: 1000, max: 6000, step: 100 };

export const VIBE_LABELS: Record<Vibe, string> = {
  1: "Very quiet",
  2: "Quiet",
  3: "Balanced",
  4: "Lively",
  5: "Very lively",
};

export const HOUSING_LABELS: Record<HousingType, string> = {
  apartment: "Apartment",
  house: "House",
  condo: "Condo",
  any: "Any",
};

export const BEDROOM_LABELS: Record<Bedrooms, string> = { 0: "Studio", 1: "1", 2: "2", 3: "3+" };

export const WEIGHT_LABELS: Record<keyof Preferences["weights"], string> = {
  safety: "Safety",
  transit: "Transit",
  schools: "Schools",
  amenities: "Walkability / amenities",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Fill any missing fields with defaults (used for chat filters, URL params, storage). */
export function completePrefs(partial: Partial<Preferences> | null | undefined): Preferences {
  const p = partial ?? {};
  return {
    ...DEFAULT_PREFS,
    ...p,
    weights: { ...DEFAULT_PREFS.weights, ...(p.weights ?? {}) },
  };
}

// ---- URL <-> Preferences (used by "View on map": /?budgetMax=…&zip=…) ----

export function prefsToSearchParams(p: Preferences, zip?: string): URLSearchParams {
  const q = new URLSearchParams({
    budgetMax: String(p.budgetMax),
    housingType: p.housingType,
    bedrooms: String(p.bedrooms),
    petFriendly: p.petFriendly ? "1" : "0",
    vibe: String(p.vibe),
    safety: String(p.weights.safety),
    transit: String(p.weights.transit),
    schools: String(p.weights.schools),
    amenities: String(p.weights.amenities),
  });
  if (p.householdSize) q.set("householdSize", String(p.householdSize));
  if (zip) q.set("zip", zip);
  return q;
}

/** Returns null when the URL carries no filters (normal landing). */
export function prefsFromSearchParams(q: URLSearchParams): Preferences | null {
  if (!q.has("budgetMax")) return null;
  const n = (key: string, fallback: number) => {
    const v = Number(q.get(key));
    return Number.isFinite(v) && q.get(key) !== null && q.get(key) !== "" ? v : fallback;
  };
  const housing = q.get("housingType");
  const d = DEFAULT_PREFS;
  return {
    budgetMax: clamp(n("budgetMax", d.budgetMax), 100, 20000),
    housingType: (["apartment", "house", "condo", "any"].includes(housing ?? "") ? housing : d.housingType) as HousingType,
    bedrooms: clamp(Math.round(n("bedrooms", d.bedrooms)), 0, 3) as Bedrooms,
    petFriendly: q.get("petFriendly") === "1" || q.get("petFriendly") === "true",
    vibe: clamp(Math.round(n("vibe", d.vibe)), 1, 5) as Vibe,
    weights: {
      safety: clamp(n("safety", d.weights.safety), 0, 5),
      transit: clamp(n("transit", d.weights.transit), 0, 5),
      schools: clamp(n("schools", d.weights.schools), 0, 5),
      amenities: clamp(n("amenities", d.weights.amenities), 0, 5),
    },
    topN: 5,
    ...(q.has("householdSize") ? { householdSize: clamp(n("householdSize", 1), 1, 10) } : {}),
  };
}

// ---- onboarding survey persistence (per browser, convenience only) ----

const SURVEY_KEY = "mzr.survey.v1";
const SURVEY_DONE_KEY = "mzr.surveyDone.v1";

export function saveSurvey(p: Preferences) {
  try {
    localStorage.setItem(SURVEY_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: survey just isn't remembered */
  }
}

export function loadSurvey(): Preferences | null {
  try {
    const raw = localStorage.getItem(SURVEY_KEY);
    return raw ? completePrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function markSurveyDone() {
  try {
    localStorage.setItem(SURVEY_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isSurveyDone(): boolean {
  try {
    return localStorage.getItem(SURVEY_DONE_KEY) === "1";
  } catch {
    return true; // can't remember -> don't nag every visit
  }
}

// ---- in-progress quiz (survives a page refresh until the quiz is finished or skipped) ----

const PROGRESS_KEY = "mzr.surveyProgress.v1";
export const RETAKE_QUIZ_EVENT = "mzr:retake-quiz";

export type SurveyPet = "none" | "cat" | "dog";

export interface SurveyProgress {
  step: number;
  prefs: Preferences;
  pet: SurveyPet;
}

export function saveSurveyProgress(progress: SurveyProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable: a refresh restarts the quiz */
  }
}

export function loadSurveyProgress(): SurveyProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SurveyProgress>;
    const step = Number.isInteger(data.step) && (data.step as number) >= 0 ? (data.step as number) : 0;
    const pet: SurveyPet = data.pet === "cat" || data.pet === "dog" ? data.pet : "none";
    return { step, pet, prefs: completePrefs(data.prefs) };
  } catch {
    return null;
  }
}

export function clearSurveyProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}

/** Open the quiz from step 1, starting from the given answers (used by "Retake quiz"). */
export function startSurvey(prefs: Preferences) {
  saveSurveyProgress({ step: 0, prefs, pet: prefs.petFriendly ? "dog" : "none" });
}

/** Short human-readable chips, e.g. "Budget ≤ $2,000 · Pet-friendly · Quiet". */
export function describePrefs(p: Partial<Preferences>): string[] {
  const chips: string[] = [];
  if (p.budgetMax) chips.push(`Budget ≤ $${p.budgetMax.toLocaleString("en-US")}`);
  if (p.housingType && p.housingType !== "any") chips.push(HOUSING_LABELS[p.housingType]);
  if (p.bedrooms !== undefined) chips.push(p.bedrooms === 0 ? "Studio" : `${BEDROOM_LABELS[p.bedrooms]} bed`);
  if (p.petFriendly) chips.push("Pet-friendly");
  if (p.vibe) chips.push(VIBE_LABELS[p.vibe]);
  if (p.householdSize) chips.push(`${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}`);
  const w = p.weights;
  if (w) {
    (Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[])
      .filter((k) => w[k] >= 4)
      .forEach((k) => chips.push(`${WEIGHT_LABELS[k]} matters`));
  }
  return chips;
}

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function medianRent(features: { key: string; value: unknown }[]): number | null {
  const f = features.find((x) => x.key.startsWith("median_rent"));
  return typeof f?.value === "number" ? f.value : null;
}
