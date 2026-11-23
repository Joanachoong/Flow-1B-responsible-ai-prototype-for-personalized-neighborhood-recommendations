"use client";

import { BEDROOM_LABELS, BUDGET, HOUSING_LABELS, VIBE_LABELS, WEIGHT_LABELS } from "@/lib/prefs";
import type { Bedrooms, HousingType, Preferences, Vibe, Weights } from "@/lib/types";
import { Spinner } from "./states";

interface Props {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
  onApply: () => void;
  onReset: () => void;
  loading: boolean;
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-sand bg-cream p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-2 py-1.5 text-xs transition ${
            o.value === value ? "bg-ink text-paper" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {hint && <span className="text-xs text-ink">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// MAP-2: every PRD filter, each with a default. MAP-3: Apply disabled + spinner while loading.
export default function FilterPanel({ prefs, onChange, onApply, onReset, loading }: Props) {
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => onChange({ ...prefs, [key]: value });
  const setWeight = (key: keyof Weights, value: number) => onChange({ ...prefs, weights: { ...prefs.weights, [key]: value } });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading) onApply();
      }}
    >
      <Field label="Budget" hint={`up to $${prefs.budgetMax.toLocaleString("en-US")}/mo`}>
        <input
          type="range"
          aria-label="Monthly budget"
          min={BUDGET.min}
          max={BUDGET.max}
          step={BUDGET.step}
          value={Math.min(BUDGET.max, Math.max(BUDGET.min, prefs.budgetMax))}
          onChange={(e) => set("budgetMax", Number(e.target.value))}
          className="w-full"
        />
        <div className="flex items-center justify-between text-[11px] text-faint">
          <span>$1,000</span>
          <label className="flex items-center gap-1 text-muted">
            exact $
            <input
              type="number"
              min={100}
              max={20000}
              step={50}
              value={prefs.budgetMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) set("budgetMax", v);
              }}
              className="w-20 rounded-md border border-sand bg-paper px-1.5 py-0.5 text-right text-xs text-ink"
            />
          </label>
          <span>$6,000</span>
        </div>
      </Field>

      <Field label="Housing type">
        <Segmented<HousingType>
          label="Housing type"
          value={prefs.housingType}
          onChange={(v) => set("housingType", v)}
          options={(["apartment", "house", "condo", "any"] as HousingType[]).map((v) => ({ value: v, label: HOUSING_LABELS[v] }))}
        />
      </Field>

      <Field label="Bedrooms">
        <Segmented<Bedrooms>
          label="Bedrooms"
          value={prefs.bedrooms}
          onChange={(v) => set("bedrooms", v)}
          options={([0, 1, 2, 3] as Bedrooms[]).map((v) => ({ value: v, label: BEDROOM_LABELS[v] }))}
        />
      </Field>

      <label className="flex cursor-pointer items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Pet-friendly</span>
        <span className="relative inline-flex">
          <input
            type="checkbox"
            role="switch"
            checked={prefs.petFriendly}
            onChange={(e) => set("petFriendly", e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-6 w-11 rounded-full bg-sand transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-ink/40" />
          <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-paper shadow transition peer-checked:translate-x-5" />
        </span>
      </label>

      <Field label="Vibe" hint={VIBE_LABELS[prefs.vibe]}>
        <input
          type="range"
          aria-label="Vibe from very quiet to very lively"
          min={1}
          max={5}
          step={1}
          value={prefs.vibe}
          onChange={(e) => set("vibe", Number(e.target.value) as Vibe)}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] text-faint">
          <span>Very quiet</span>
          <span>Very lively</span>
        </div>
      </Field>

      <details className="group rounded-xl border border-sand bg-paper/60 p-3">
        <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted">
          How much do these matter? <span className="float-right transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-3 space-y-3">
          {(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((key) => (
            <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
              <span className="text-xs text-ink">{WEIGHT_LABELS[key]}</span>
              <span className="text-xs tabular-nums text-muted">{prefs.weights[key]}/5</span>
              <input
                type="range"
                aria-label={`${WEIGHT_LABELS[key]} importance`}
                min={0}
                max={5}
                step={1}
                value={prefs.weights[key]}
                onChange={(e) => setWeight(key, Number(e.target.value))}
                className="col-span-2 w-full"
              />
            </div>
          ))}
        </div>
      </details>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? "Finding zips…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="rounded-full border border-sand px-4 py-2.5 text-sm text-muted transition hover:border-ink hover:text-ink disabled:opacity-60"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
