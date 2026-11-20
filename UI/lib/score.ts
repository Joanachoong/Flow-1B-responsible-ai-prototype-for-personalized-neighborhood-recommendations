// 5-step colour scale for map shading + legend (MAP-4, MAP-8).
// Steps span the score range of the current results, so the top 5 are always distinguishable
// (fixed bands would often paint all five the same green, e.g. 72–79).
export const SCORE_COLORS = ["#e4e8d4", "#c5d2a9", "#9db57f", "#71925a", "#4a6a3c"] as const;

export interface ScoreScale {
  color: (score: number) => string;
  legend: { label: string; color: string }[];
}

export function makeScoreScale(scores: number[]): ScoreScale {
  if (!scores.length) return { color: () => SCORE_COLORS[4], legend: [] };
  const lo = Math.floor(Math.min(...scores));
  const hi = Math.ceil(Math.max(...scores));
  const span = hi - lo;
  if (span < 1) {
    return { color: () => SCORE_COLORS[4], legend: [{ label: `${lo}`, color: SCORE_COLORS[4] }] };
  }
  const step = (score: number) => Math.min(4, Math.max(0, Math.floor(((score - lo) / span) * 5)));
  const legend = SCORE_COLORS.map((color, i) => {
    const from = lo + (span * i) / 5;
    const to = lo + (span * (i + 1)) / 5;
    return { label: `${Math.round(from)}–${Math.round(to)}`, color };
  });
  return { color: (score) => SCORE_COLORS[step(score)], legend };
}
