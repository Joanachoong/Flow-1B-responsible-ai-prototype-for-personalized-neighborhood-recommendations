import Link from "next/link";
import { formatFeatureValue } from "@/lib/format";
import { formatUsd, medianRent } from "@/lib/prefs";
import type { ZipResult } from "@/lib/types";
import MatchIcon from "./MatchIcon";

interface Props {
  result: ZipResult;
  /** compact = ranked list row on the Map (MAP-5); full = chat card with data + reason (CHAT-3) */
  variant?: "compact" | "full";
  selected?: boolean;
  onSelect?: (zip: string) => void;
  /** CHAT-5: link to the Map with filters applied and this zip selected */
  mapHref?: string;
  /** map shading colour for this zip, shown as a small dot that ties the card to the map */
  swatch?: string;
}

export function RankBadge({ rank, swatch }: { rank: number; swatch?: string }) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-paper">
      {rank > 0 ? rank : "–"}
      {swatch && (
        <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-paper" style={{ background: swatch }} />
      )}
    </span>
  );
}

// Shared by the Map ranked list and the Chatbot cards (PRD: "ZipCard component shared").
export default function ZipCard({ result, variant = "compact", selected, onSelect, mapHref, swatch }: Props) {
  const rent = medianRent(result.features);
  const header = (
    <div className="flex items-center gap-3">
      <RankBadge rank={result.rank} swatch={swatch} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-ink">{result.zip}</span>
          <span className="truncate text-sm text-muted">{result.neighborhood}</span>
        </div>
        {rent !== null && <div className="text-xs text-faint">Median rent {formatUsd(rent)}/mo</div>}
      </div>
      <div className="text-right">
        <div className="font-display text-xl leading-none text-ink">{Math.round(result.score)}</div>
        <div className="text-[10px] uppercase tracking-wide text-faint">/ 100</div>
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(result.zip)}
        aria-pressed={selected}
        className={`w-full rounded-xl border p-3 text-left transition ${
          selected ? "border-ink bg-paper shadow-sm" : "border-sand bg-paper/70 hover:border-faint hover:bg-paper"
        }`}
      >
        {header}
      </button>
    );
  }

  return (
    <article className="rounded-2xl border border-sand bg-paper p-4 shadow-[0_1px_0_rgba(61,61,61,0.04)]">
      {header}
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {result.features.slice(0, 4).map((f) => (
          <li key={f.key} className="flex items-center gap-2 text-xs">
            <MatchIcon match={f.match} />
            <span className="text-muted">{f.label}</span>
            <span className="ml-auto font-medium text-ink">{formatFeatureValue(f)}</span>
          </li>
        ))}
      </ul>
      {result.reason && <p className="mt-3 text-sm leading-relaxed text-ink/90">{result.reason}</p>}
      {mapHref && (
        <Link
          href={mapHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper"
        >
          View on map →
        </Link>
      )}
    </article>
  );
}
