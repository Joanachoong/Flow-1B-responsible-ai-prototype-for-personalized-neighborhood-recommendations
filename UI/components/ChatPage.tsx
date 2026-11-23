"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, chat } from "@/lib/api";
import { completePrefs, describePrefs, loadSurvey, prefsToSearchParams } from "@/lib/prefs";
import type { ChatMessage, ChatResponse, Preferences } from "@/lib/types";
import ZipCard from "./ZipCard";
import { TypingIndicator } from "./states";

interface Turn {
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
  failed?: boolean;
}

// CHAT-2
const EXAMPLES = [
  "Quiet area under $2,000 that allows dogs",
  "Lively spot near the Metrorail, studio, about $2,500",
  "Safe 3-bedroom house for a family of four under $3,500",
];

function UnderstoodFilters({ filters }: { filters: Partial<Preferences> }) {
  const chips = describePrefs(filters);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-faint">I understood:</span>
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border border-sand bg-cream px-2.5 py-0.5 text-xs text-ink">
          {chip}
        </span>
      ))}
    </div>
  );
}

function AssistantTurn({ turn, onRetry }: { turn: Turn; onRetry: () => void }) {
  if (turn.failed) {
    return (
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-clay/30 bg-clay/5 px-4 py-3 text-sm">
        <p className="text-clay">{turn.content}</p>
        <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-ink px-3 py-1 text-xs text-paper">
          Try again
        </button>
      </div>
    );
  }
  const res = turn.response;
  const full = res ? completePrefs(res.understoodFilters) : null;
  return (
    <div className="w-full space-y-3">
      <div className="inline-block max-w-[90%] rounded-2xl rounded-bl-sm border border-sand bg-paper px-4 py-3 text-sm text-ink">
        {turn.content}
      </div>
      {res && <UnderstoodFilters filters={res.understoodFilters} />}
      {res && full && res.results.length > 0 && (
        <div className="grid gap-3">
          {res.results.map((r) => (
            <ZipCard key={r.zip} result={r} variant="full" mapHref={`/?${prefsToSearchParams(full, r.zip)}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [survey, setSurvey] = useState<Preferences | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Continue from the onboarding survey, if the user took it.
  useEffect(() => setSurvey(loadSurvey()), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, waiting]);

  const run = async (history: Turn[]) => {
    setTurns(history);
    setWaiting(true);
    // Stateless backend: send the whole conversation (CHAT-4) + survey answers as the starting point.
    const messages: ChatMessage[] = history
      .filter((t) => !t.failed)
      .map((t) => ({ role: t.role, content: t.content }));
    try {
      const response = await chat(messages, survey ?? undefined);
      setTurns([...history, { role: "assistant", content: response.reply, response }]);
    } catch (err) {
      const reason = err instanceof ApiError ? err.message : "";
      setTurns([
        ...history,
        { role: "assistant", content: `Sorry — I couldn't reach the recommendation engine. ${reason}`.trim(), failed: true },
      ]);
    } finally {
      setWaiting(false);
      inputRef.current?.focus();
    }
  };

  const send = (text: string) => {
    const content = text.trim();
    if (!content || waiting) return;
    setInput("");
    run([...turns, { role: "user", content }]);
  };

  const retry = () => {
    const history = turns.slice(0, -1); // drop the failed assistant turn
    run(history);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-none flex-col px-4">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-6" aria-live="polite">
        {/* Welcome (always shown) */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl text-ink">Tell me what you&apos;re looking for</h1>
          <p className="text-muted">
            Describe your budget, pets, vibe or commute in plain English. I&apos;ll score every Miami zip with the same
            engine as the Map and show you the top 5 — with reasons.
          </p>
          {survey && (
            <div className="rounded-xl border border-sand bg-paper/70 p-3 text-sm">
              <span className="text-muted">Continuing from your quiz: </span>
              <span className="text-ink">{describePrefs(survey).join(" · ")}</span>
            </div>
          )}
          {turns.length === 0 && (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => send(example)}
                  className="rounded-2xl border border-sand bg-paper px-4 py-2.5 text-left text-sm text-ink transition hover:border-ink"
                >
                  “{example}”
                </button>
              ))}
            </div>
          )}
        </div>

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-paper">{turn.content}</div>
            </div>
          ) : (
            <AssistantTurn key={i} turn={turn} onRetry={retry} />
          ),
        )}
        {waiting && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* CHAT-1: input + Send; Enter sends, Shift+Enter adds a line */}
      <form
        className="sticky bottom-0 flex items-end gap-2 border-t border-sand bg-cream py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={turns.length ? "Refine it — e.g. “make it livelier”" : "e.g. Quiet place under 2k that allows dogs"}
          aria-label="Message"
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-sand bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={waiting || !input.trim()}
          className="h-[44px] rounded-full bg-ink px-5 text-sm font-medium text-paper transition hover:bg-ink-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
