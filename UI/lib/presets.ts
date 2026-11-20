import { DEFAULT_PREFS } from "./prefs";
import type { Preferences } from "./types";

export interface Preset {
  id: string;
  label: string;
  description: string;
  prefs: Preferences;
}

// DEMO-1: three scenarios that fill the filters and apply. Keep in sync with public/mock/presets/.
export const PRESETS: Preset[] = [
  {
    id: "budget-dog",
    label: "Budget renter with a dog",
    description: "≤ $2,000 · 1 bed · pet-friendly · quiet",
    prefs: { ...DEFAULT_PREFS, budgetMax: 2000, housingType: "apartment", petFriendly: true, vibe: 2 },
  },
  {
    id: "young-family",
    label: "Young family",
    description: "≤ $3,500 · 3+ bed house · safety & schools",
    prefs: {
      ...DEFAULT_PREFS,
      budgetMax: 3500,
      bedrooms: 3,
      housingType: "house",
      vibe: 2,
      weights: { safety: 5, transit: 2, schools: 5, amenities: 3 },
    },
  },
  {
    id: "lively-single",
    label: "Lively single, no car",
    description: "≤ $2,800 · studio · very lively · transit",
    prefs: {
      ...DEFAULT_PREFS,
      budgetMax: 2800,
      bedrooms: 0,
      housingType: "apartment",
      vibe: 5,
      weights: { safety: 2, transit: 5, schools: 0, amenities: 5 },
    },
  },
];
