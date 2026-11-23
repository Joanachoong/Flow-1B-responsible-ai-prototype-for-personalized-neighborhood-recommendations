// Loading / empty / error states (MAP-3, MAP-9, CHAT-6).

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyResult() {
  return (
    <div role="status" className="rounded-xl border border-dashed border-sand-2 bg-paper/60 p-4 text-sm text-muted">
      No zips match — try a higher budget or fewer must-haves.
    </div>
  );
}

export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-clay/30 bg-clay/5 p-4 text-sm">
      <p className="font-medium text-clay">We couldn&apos;t get recommendations right now.</p>
      <p className="mt-1 text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink-2"
      >
        Retry
      </button>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-sand bg-paper px-4 py-3" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}
