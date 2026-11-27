"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { USE_MOCK } from "@/lib/api";
import { DEFAULT_PREFS, loadSurvey, RETAKE_QUIZ_EVENT, startSurvey } from "@/lib/prefs";

const TABS = [
  { href: "/", label: "Map" },
  { href: "/chat", label: "Chatbot" },
];

// NAV-1: project name + two tabs, active tab highlighted, plus "Retake quiz".
export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  // The quiz lives on the Map page: open it there; from other pages, queue it and go to the map.
  const retakeQuiz = () => {
    if (pathname === "/") {
      window.dispatchEvent(new Event(RETAKE_QUIZ_EVENT));
    } else {
      startSurvey(loadSurvey() ?? DEFAULT_PREFS);
      router.push("/");
    }
  };
  return (
    <header className="sticky top-0 z-[1000] border-b border-sand bg-cream/95 backdrop-blur">
      <nav className="mx-auto flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="12" cy="9.5" r="2.5" fill="var(--color-sage)" />
          </svg>
          <span className="font-display text-lg tracking-tight">Miami Zip Finder</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-sand bg-paper p-1">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  active ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={retakeQuiz}
          title="Answer the quick quiz again to update your recommendations"
          className="flex items-center gap-1.5 rounded-full border border-sand bg-paper px-3 py-1.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.8h-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Retake quiz</span>
          <span className="sm:hidden">Quiz</span>
        </button>
        {USE_MOCK && (
          <span
            title="NEXT_PUBLIC_USE_MOCK=true — showing sample data, not the live engine"
            className="hidden rounded-full border border-ochre/40 bg-ochre/10 px-2.5 py-1 text-xs text-ochre sm:inline"
          >
            Sample data
          </span>
        )}
      </nav>
    </header>
  );
}
