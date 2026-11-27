"use client";

import { useEffect, useState } from "react";
import { saveSurveyProgress, VIBE_LABELS, type SurveyPet } from "@/lib/prefs";
import type { Bedrooms, HousingType, Preferences, Vibe } from "@/lib/types";
import Illustration, { type IllustrationName } from "./Illustrations";

interface Props {
  initial: Preferences;
  /** Where to resume after a page refresh (defaults: first step, pet from `initial`). */
  initialStep?: number;
  initialPet?: SurveyPet;
  onComplete: (p: Preferences) => void;
  onSkip: () => void;
  onContinueInChat: (p: Preferences) => void;
}

const BUDGET_STEPS = [
  { label: "Under $1,500", value: 1500 },
  { label: "$1,500 – 2,000", value: 2000 },
  { label: "$2,000 – 2,500", value: 2500 },
  { label: "$2,500 – 3,500", value: 3500 },
  { label: "$3,500 – 5,000", value: 5000 },
  { label: "$5,000+", value: 6000 },
];

type Choice<T> = { value: T; label: string; art: IllustrationName };

function Cards<T>({ choices, isActive, onPick }: { choices: Choice<T>[]; isActive: (v: T) => boolean; onPick: (v: T) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {choices.map((c) => {
        const active = isActive(c.value);
        return (
          <button
            key={c.label}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(c.value)}
            className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition ${
              active ? "border-ink bg-paper shadow-md" : "border-sand bg-paper/60 hover:border-faint hover:bg-paper"
            }`}
          >
            <Illustration name={c.art} className="h-16 w-20 sm:h-20 sm:w-24" />
            <span className="text-sm font-medium text-ink">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepSlider({ labels, index, onChange, ariaLabel }: { labels: string[]; index: number; onChange: (i: number) => void; ariaLabel: string }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6 text-center font-display text-3xl text-ink">{labels[index]}</div>
      <input
        type="range"
        aria-label={ariaLabel}
        aria-valuetext={labels[index]}
        min={0}
        max={labels.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

// Flow 1 onboarding: full-screen, quick, skippable; answers prefill the Map filters.
export default function OnboardingSurvey({ initial, initialStep = 0, initialPet, onComplete, onSkip, onContinueInChat }: Props) {
  const [p, setP] = useState<Preferences>({ ...initial, householdSize: initial.householdSize ?? 1, bathrooms: initial.bathrooms ?? 1 });
  const [step, setStep] = useState(initialStep);
  const [pet, setPet] = useState<SurveyPet>(initialPet ?? (initial.petFriendly ? "dog" : "none"));
  const update = (patch: Partial<Preferences>) => setP((prev) => ({ ...prev, ...patch }));
  const pickAndNext = (patch: Partial<Preferences>) => {
    update(patch);
    setTimeout(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 220);
  };
  const budgetIndex = Math.max(0, BUDGET_STEPS.findIndex((b) => b.value >= p.budgetMax));

  const steps: { title: string; subtitle: string; body: React.ReactNode }[] = [
    {
      title: "How many people will live here?",
      subtitle: "Including you.",
      body: (
        <Cards<number>
          choices={[
            { value: 1, label: "Just me", art: "one" },
            { value: 2, label: "Two", art: "two" },
            { value: 3, label: "Three", art: "three" },
            { value: 4, label: "Four or more", art: "four" },
          ]}
          isActive={(v) => p.householdSize === v}
          onPick={(v) => pickAndNext({ householdSize: v })}
        />
      ),
    },
    {
      title: "Any pets coming along?",
      subtitle: "We'll favour pet-friendly areas.",
      body: (
        <Cards<"none" | "cat" | "dog">
          choices={[
            { value: "none", label: "No pets", art: "noPet" },
            { value: "cat", label: "Cat", art: "cat" },
            { value: "dog", label: "Dog", art: "dog" },
          ]}
          isActive={(v) => v === pet}
          onPick={(v) => {
            setPet(v);
            pickAndNext({ petFriendly: v !== "none" });
          }}
        />
      ),
    },
    {
      title: "What vibe are you looking for?",
      subtitle: "Slide between peaceful and buzzing.",
      body: (
        <StepSlider
          ariaLabel="Vibe"
          labels={[1, 2, 3, 4, 5].map((v) => VIBE_LABELS[v as Vibe])}
          index={p.vibe - 1}
          onChange={(i) => update({ vibe: (i + 1) as Vibe })}
        />
      ),
    },
    {
      title: "What's your monthly budget?",
      subtitle: "Rent for the whole place, per month.",
      body: (
        <StepSlider
          ariaLabel="Monthly budget range"
          labels={BUDGET_STEPS.map((b) => b.label)}
          index={budgetIndex}
          onChange={(i) => update({ budgetMax: BUDGET_STEPS[i].value })}
        />
      ),
    },
    {
      title: "What kind of home?",
      subtitle: "Pick the one you'd most like.",
      body: (
        <Cards<HousingType>
          choices={[
            { value: "apartment", label: "Apartment", art: "apartment" },
            { value: "house", label: "House", art: "house" },
            { value: "condo", label: "Condo", art: "condo" },
            { value: "any", label: "No preference", art: "any" },
          ]}
          isActive={(v) => p.housingType === v}
          onPick={(v) => pickAndNext({ housingType: v })}
        />
      ),
    },
    {
      title: "Bedrooms and bathrooms?",
      subtitle: "We'll check rents for that size.",
      body: (
        <div className="space-y-6">
          <Cards<Bedrooms>
            choices={[
              { value: 0, label: "Studio", art: "studio" },
              { value: 1, label: "1 bedroom", art: "bed1" },
              { value: 2, label: "2 bedrooms", art: "bed2" },
              { value: 3, label: "3+ bedrooms", art: "bed3" },
            ]}
            isActive={(v) => p.bedrooms === v}
            onPick={(v) => update({ bedrooms: v })}
          />
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted">Bathrooms</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={p.bathrooms === n}
                onClick={() => update({ bathrooms: n })}
                className={`h-10 w-14 rounded-full border-2 text-sm transition ${p.bathrooms === n ? "border-ink bg-paper" : "border-sand hover:border-faint"}`}
              >
                {n === 3 ? "3+" : n}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  // Remember the step and answers so a refresh brings the user back here (cleared by the parent
  // when the quiz is finished, skipped, or continued in chat).
  useEffect(() => saveSurveyProgress({ step, prefs: p, pet }), [step, p, pet]);

  if (step > steps.length - 1) setStep(steps.length - 1); // stale saved step
  const last = step >= steps.length - 1;
  const current = steps[Math.min(step, steps.length - 1)];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="survey-title" className="fixed inset-0 z-[2000] flex flex-col overflow-y-auto bg-cream">
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex flex-1 gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-ink" : "bg-sand"}`} />
          ))}
        </div>
        <button type="button" onClick={onSkip} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Skip for now
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-8">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-faint">
          {step + 1} / {steps.length}
        </p>
        <h1 id="survey-title" className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          {current.title}
        </h1>
        <p className="mb-8 mt-2 text-muted">{current.subtitle}</p>
        {current.body}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-sand bg-cream/95 px-4 py-4 backdrop-blur sm:px-8">
        <button
          type="button"
          onClick={() => onContinueInChat(p)}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Rather describe it? Continue in chat →
        </button>
        <div className="ml-auto flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-full border border-sand px-5 py-2.5 text-sm text-ink hover:border-ink">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? onComplete(p) : setStep(step + 1))}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-paper hover:bg-ink-2"
          >
            {last ? "Show my zips" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
