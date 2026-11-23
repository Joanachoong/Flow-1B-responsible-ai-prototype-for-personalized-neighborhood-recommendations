import type { Match } from "@/lib/types";

const META: Record<Match, { label: string; color: string }> = {
  yes: { label: "Matches", color: "var(--color-sage)" },
  partial: { label: "Partly matches", color: "var(--color-ochre)" },
  no: { label: "Doesn't match", color: "var(--color-clay)" },
};

// DET-3: check / half / cross.
export default function MatchIcon({ match }: { match: Match }) {
  const { label, color } = META[match] ?? META.partial;
  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0">
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="none" stroke={color} strokeWidth="1.6" />
        {match === "yes" && <path d="M6 10.4l2.6 2.6L14 7.6" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
        {match === "partial" && <path d="M10 1a9 9 0 0 1 0 18Z" fill={color} />}
        {match === "no" && <path d="M7 7l6 6M13 7l-6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />}
      </svg>
    </span>
  );
}
