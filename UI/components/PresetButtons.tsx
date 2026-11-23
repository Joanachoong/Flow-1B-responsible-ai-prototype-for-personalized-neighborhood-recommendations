import { PRESETS, type Preset } from "@/lib/presets";

// DEMO-1: one click fills the filters and applies.
export default function PresetButtons({ onPick, disabled }: { onPick: (p: Preset) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">Try a scenario</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(preset)}
            title={preset.description}
            className="rounded-full border border-sand bg-paper px-3 py-1.5 text-xs text-ink transition hover:border-ink disabled:opacity-60"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
