import type { ScoreScale } from "@/lib/score";

// MAP-8
export default function Legend({ scale }: { scale: ScoreScale }) {
  if (!scale.legend.length) return null;
  return (
    <div className="rounded-xl border border-sand bg-paper/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">Match score (low → high)</div>
      <div className="flex gap-1">
        {scale.legend.map((step) => (
          <div key={step.label} className="flex flex-col items-center gap-0.5">
            <span className="h-3 w-9 rounded-sm border border-black/5" style={{ background: step.color }} />
            <span className="text-[10px] tabular-nums text-muted">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
