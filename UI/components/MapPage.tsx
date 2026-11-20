"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, recommend, zipDetails } from "@/lib/api";
import type { Preset } from "@/lib/presets";
import {
  DEFAULT_PREFS,
  describePrefs,
  isSurveyDone,
  loadSurvey,
  markSurveyDone,
  prefsFromSearchParams,
  prefsToSearchParams,
  saveSurvey,
} from "@/lib/prefs";
import { makeScoreScale } from "@/lib/score";
import type { Preferences, RecommendResponse, ZipResult } from "@/lib/types";
import FilterPanel from "./FilterPanel";
import Legend from "./Legend";
import type { ZipGeo } from "./MapView";
import OnboardingSurvey from "./OnboardingSurvey";
import PresetButtons from "./PresetButtons";
import ZipCard from "./ZipCard";
import ZipDetailPanel from "./ZipDetailPanel";
import { EmptyResult, ErrorRetry, Spinner } from "./states";

// Leaflet needs `window`: never render it on the server (PRD risk mitigation).
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-cream-2 text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <Spinner /> Loading map…
      </span>
    </div>
  ),
});

type Status = "idle" | "loading" | "ok" | "error";
interface Detail {
  result: ZipResult | null;
  loading: boolean;
  error: string | null;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Unexpected error.";
}

export default function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [geo, setGeo] = useState<ZipGeo | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>({ result: null, loading: false, error: null });
  const [showSurvey, setShowSurvey] = useState(false);

  const requestId = useRef(0);
  const detailRequestId = useRef(0);
  const lastRequest = useRef<{ prefs: Preferences; presetId?: string; zip?: string } | null>(null);
  const results = useMemo(() => response?.results ?? [], [response]);
  const scale = useMemo(() => makeScoreScale(results.map((r) => r.score)), [results]);

  // MAP-1: zip boundaries are a static asset, drawn before any API call.
  useEffect(() => {
    fetch("/geo/miami-zctas.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGeo)
      .catch(() => setGeoError(true));
  }, []);

  const zipName = useCallback(
    (zip: string) => geo?.features.find((f) => f.properties.zip === zip)?.properties.name ?? zip,
    [geo],
  );

  const syncUrl = (p: Preferences | null, zip?: string | null) => {
    const qs = p ? `?${prefsToSearchParams(p, zip ?? undefined)}` : "";
    window.history.replaceState(null, "", `/${qs}`);
  };

  const apply = useCallback(async (p: Preferences, opts: { presetId?: string; zip?: string } = {}) => {
    const id = ++requestId.current;
    lastRequest.current = { prefs: p, ...opts };
    setStatus("loading");
    setError("");
    setSelectedZip(null);
    setDetail({ result: null, loading: false, error: null });
    try {
      const res = await recommend(p, { presetId: opts.presetId });
      if (id !== requestId.current) return; // a newer Apply superseded this one
      setResponse(res);
      setStatus("ok");
      syncUrl(p, opts.zip);
      if (opts.zip) {
        const hit = res.results.find((r) => r.zip === opts.zip);
        setSelectedZip(opts.zip);
        if (hit) setDetail({ result: hit, loading: false, error: null });
        else loadDetail(opts.zip, p);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setResponse(null);
      setStatus("error");
      setError(errorMessage(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (zip: string, p: Preferences) => {
    const id = ++detailRequestId.current;
    setDetail({ result: null, loading: true, error: null });
    try {
      const result = await zipDetails(zip, p);
      if (id === detailRequestId.current) setDetail({ result, loading: false, error: null });
    } catch (err) {
      if (id === detailRequestId.current) setDetail({ result: null, loading: false, error: errorMessage(err) });
    }
  }, []);

  // First load: URL filters (from "View on map") win; otherwise maybe show the survey.
  useEffect(() => {
    const fromUrl = prefsFromSearchParams(new URLSearchParams(searchParams.toString()));
    if (fromUrl) {
      setPrefs(fromUrl);
      apply(fromUrl, { zip: searchParams.get("zip") ?? undefined });
      return;
    }
    const saved = loadSurvey();
    if (saved) setPrefs(saved);
    if (!isSurveyDone()) setShowSurvey(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (zip: string) => {
    setSelectedZip(zip);
    const hit = results.find((r) => r.zip === zip);
    if (hit) {
      detailRequestId.current++; // drop any in-flight detail fetch
      setDetail({ result: hit, loading: false, error: null });
    } else {
      loadDetail(zip, (response?.appliedFilters as Preferences | undefined) ?? prefs);
    }
  };

  const pickPreset = (preset: Preset) => {
    setPrefs(preset.prefs);
    apply(preset.prefs, { presetId: preset.id });
  };

  const reset = () => {
    requestId.current++;
    setPrefs(DEFAULT_PREFS);
    setResponse(null);
    setStatus("idle");
    setError("");
    setSelectedZip(null);
    syncUrl(null);
  };

  const finishSurvey = (p: Preferences) => {
    saveSurvey(p);
    markSurveyDone();
    setShowSurvey(false);
    setPrefs(p);
    apply(p);
  };

  return (
    // Desktop: exactly the viewport under the nav, so the panel scrolls and the map never grows.
    <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100dvh-3.5rem)] md:flex-none md:flex-row">
      {showSurvey && (
        <OnboardingSurvey
          initial={prefs}
          onComplete={finishSurvey}
          onSkip={() => {
            markSurveyDone();
            setShowSurvey(false);
          }}
          onContinueInChat={(p) => {
            saveSurvey(p);
            markSurveyDone();
            router.push("/chat");
          }}
        />
      )}

      {/* Filter panel: left on desktop, stacked above the map on phones */}
      <aside className="space-y-6 border-sand bg-cream p-4 md:w-[380px] md:shrink-0 md:overflow-y-auto md:border-r md:p-5">
        <div>
          <h1 className="font-display text-2xl leading-tight text-ink">Where in Miami fits you?</h1>
          <p className="mt-1 text-sm text-muted">
            Set what matters, press Apply, and we&apos;ll map your five best zip codes — with the reasons.{" "}
            <button type="button" onClick={() => setShowSurvey(true)} className="underline underline-offset-2 hover:text-ink">
              Retake the quick quiz
            </button>
          </p>
        </div>

        <PresetButtons onPick={pickPreset} disabled={status === "loading"} />

        <FilterPanel prefs={prefs} onChange={setPrefs} onApply={() => apply(prefs)} onReset={reset} loading={status === "loading"} />

        <section aria-live="polite" className="space-y-2">
          {status === "loading" && (
            <div className="space-y-2" aria-label="Loading results">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-sand/50" />
              ))}
            </div>
          )}
          {status === "error" && (
            <ErrorRetry
              message={error}
              onRetry={() => lastRequest.current && apply(lastRequest.current.prefs, lastRequest.current)}
            />
          )}
          {status === "ok" && results.length === 0 && <EmptyResult />}
          {status === "ok" && results.length > 0 && (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Your top {results.length}</h2>
                {response?.meta && (
                  <span className="text-xs text-faint">
                    {response.meta.matched} of {response.meta.zipsScored} zips matched
                  </span>
                )}
              </div>
              <p className="text-xs text-faint">{describePrefs(response?.appliedFilters ?? prefs).join(" · ")}</p>
              <ol className="space-y-2">
                {results.map((r) => (
                  <li key={r.zip}>
                    <ZipCard result={r} selected={r.zip === selectedZip} onSelect={select} swatch={scale.color(r.score)} />
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </aside>

      <section className="relative min-h-[420px] flex-1 max-md:h-[70vh]">
        {geo ? (
          <MapView geo={geo} results={results} selectedZip={selectedZip} onSelect={select} scale={scale} />
        ) : (
          <div className="grid h-full place-items-center bg-cream-2 text-sm text-muted">
            {geoError ? "Couldn't load zip boundaries. Refresh to try again." : "Loading map…"}
          </div>
        )}

        {results.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-3 z-[500]">
            <div className="pointer-events-auto">
              <Legend scale={scale} />
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-sand bg-paper px-4 py-1.5 text-xs text-muted shadow-sm">
            <span className="inline-flex items-center gap-2">
              <Spinner /> Scoring Miami zips…
            </span>
          </div>
        )}

        {selectedZip && (
          <div className="absolute inset-x-3 bottom-3 z-[600] max-h-[75%] md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[380px]">
            <ZipDetailPanel
              zip={selectedZip}
              name={zipName(selectedZip)}
              result={detail.result}
              swatch={detail.result && detail.result.rank > 0 ? scale.color(detail.result.score) : undefined}
              loading={detail.loading}
              error={detail.error}
              onClose={() => setSelectedZip(null)}
              onRetry={() => loadDetail(selectedZip, prefs)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
