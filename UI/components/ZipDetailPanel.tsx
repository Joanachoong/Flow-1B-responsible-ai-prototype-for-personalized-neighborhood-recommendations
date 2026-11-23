"use client";

import { formatFeatureValue } from "@/lib/format";
import type { ZipResult } from "@/lib/types";
import ContributionBars from "./ContributionBars";
import MatchIcon from "./MatchIcon";
import { Spinner } from "./states";

interface Props {
  zip: string;
  name: string;
  result: ZipResult | null;
  swatch?: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

// DET-1..DET-5
export default function ZipDetailPanel({ zip, name, result, swatch, loading, error, onClose, onRetry }: Props) {
  const inTop = !!result && result.rank > 0;
  return (
    <aside
      aria-label={`Details for ${zip}`}
      className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-sand bg-paper shadow-[0_10px_40px_rgba(61,61,61,0.15)]"
    >
      <header className="flex items-start gap-3 border-b border-sand p-4">
        {result && (
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-semibold text-paper"
            style={{ background: inTop ? "var(--color-ink)" : "var(--color-faint)" }}
          >
            {inTop ? `#${result.rank}` : "–"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-tight text-ink">{result?.neighborhood || name}</h2>
          <p className="text-sm text-muted">
            {zip}
            {result && !inTop && " · not in your top 5"}
          </p>
        </div>
        {result && (
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              {swatch && <span className="h-2.5 w-2.5 rounded-full" style={{ background: swatch }} />}
              <span className="font-display text-2xl leading-none">{Math.round(result.score)}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-faint">score / 100</div>
          </div>
        )}
        <button type="button" onClick={onClose} aria-label="Close details" className="-mr-1 -mt-1 rounded-full p-1.5 text-muted hover:bg-cream hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading zip data…
          </div>
        )}
        {error && !loading && (
          <div className="text-sm">
            <p className="text-clay">{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-ink px-3 py-1 text-xs text-paper">
              Retry
            </button>
          </div>
        )}
        {result && !loading && (
          <>
            {result.reason && (
              <section>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Why it fits you</h3>
                <p className="text-sm leading-relaxed text-ink">{result.reason}</p>
              </section>
            )}

            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">The data</h3>
              <table className="w-full text-sm">
                <tbody>
                  {result.features.map((f) => (
                    <tr key={f.key} className="border-b border-cream last:border-0">
                      <td className="py-2 pr-2">
                        <MatchIcon match={f.match} />
                      </td>
                      <td className="py-2 text-muted">{f.label}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-ink">{formatFeatureValue(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-faint">
                <span className="inline-flex items-center gap-1"><MatchIcon match="yes" /> matches</span>
                <span className="inline-flex items-center gap-1"><MatchIcon match="partial" /> partly</span>
                <span className="inline-flex items-center gap-1"><MatchIcon match="no" /> doesn&apos;t match</span>
              </p>
            </section>

            {result.features.some((f) => f.contribution > 0) && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Score breakdown</h3>
                <ContributionBars features={result.features} />
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
