import type { ZipFeature } from "@/lib/types";

// DET-4: how many of the score's points each feature contributed.
export default function ContributionBars({ features }: { features: ZipFeature[] }) {
  const max = Math.max(1, ...features.map((f) => f.contribution));
  return (
    <ul className="space-y-2">
      {features.map((f) => (
        <li key={f.key} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-xs">
          <span className="truncate text-muted">{f.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-cream">
            <span
              className="block h-full rounded-full bg-sage"
              style={{ width: `${Math.max(2, (f.contribution / max) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-ink">+{f.contribution.toFixed(1)}</span>
        </li>
      ))}
    </ul>
  );
}
