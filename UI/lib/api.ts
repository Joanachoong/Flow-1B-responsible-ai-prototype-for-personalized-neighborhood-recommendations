// The frontend's only door to data. Real mode calls the Python backend (/api/py/*), which calls
// the MCP server. Mock mode (NEXT_PUBLIC_USE_MOCK=true) reads public/mock/*.json so the UI can be
// built and demoed before the MCP server exists. No ranking logic lives here.

import { medianRent } from "./prefs";
import type { ChatMessage, ChatResponse, Preferences, RecommendResponse, ZipResult } from "./types";

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const TIMEOUT_MS = 20000;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      (err as Error)?.name === "AbortError" ? "The engine took too long to answer." : "Could not reach the server.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- mock mode ----------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mockJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new ApiError("Mock data missing", res.status);
  return res.json();
}

/** Mock only: reuse the fixture pool, applying the budget so the empty state (AT-4) is reachable. */
async function mockRecommend(prefs: Preferences, presetId?: string): Promise<RecommendResponse> {
  await delay(500);
  if (presetId) return mockJson(`/mock/presets/${presetId}.json`);
  const pool = await mockJson<RecommendResponse>("/mock/recommend.json");
  const fits = pool.results.filter((r) => (medianRent(r.features) ?? Infinity) <= prefs.budgetMax);
  const results = fits.slice(0, prefs.topN).map((r, i) => ({ ...r, rank: i + 1 }));
  return { results, appliedFilters: prefs, meta: { zipsScored: pool.meta.zipsScored, matched: fits.length } };
}

// ---------------- public API ----------------

export function recommend(prefs: Preferences, opts: { presetId?: string } = {}): Promise<RecommendResponse> {
  if (USE_MOCK) return mockRecommend(prefs, opts.presetId);
  return post<RecommendResponse>("/api/py/recommend", prefs);
}

export async function zipDetails(zip: string, prefs: Preferences): Promise<ZipResult> {
  if (USE_MOCK) {
    await delay(250);
    const all = await mockJson<Record<string, ZipResult>>("/mock/zips.json");
    if (!all[zip]) throw new ApiError("No data for this zip in the mock snapshot.", 404);
    return all[zip];
  }
  return post<ZipResult>("/api/py/zip-details", { zip, preferences: prefs });
}

export async function chat(messages: ChatMessage[], context?: Partial<Preferences>): Promise<ChatResponse> {
  if (USE_MOCK) {
    await delay(900);
    return mockJson<ChatResponse>("/mock/chat.json");
  }
  return post<ChatResponse>("/api/py/chat", { messages, ...(context ? { context } : {}) });
}
