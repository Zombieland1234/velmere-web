"use client";

import { readBrowserJsonObject } from "@/lib/security/browser-json-response-boundary";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type Locale = "pl" | "en" | "de";
type Depth = "basic" | "pro" | "advanced";
type Surface = "shield" | "real_markets" | "shield_map" | "lens" | "angel";
type LoadingPhase = "idle" | "boot" | "orb" | "brain";

type BrainEnvelope = {
  mode: "gemini" | "rules";
  serverLiveVerified?: boolean;
  model: string | null;
  traceId: string;
  output: {
    verdict: "calm" | "observe" | "review" | "high_risk" | "insufficient_data";
    headline: string;
    summary: string;
    confidence: number;
    keyFindings: Array<{
      id: string;
      title: string;
      explanation: string;
      severity: "info" | "watch" | "warning" | "critical";
      sourceIds: string[];
    }>;
    missingData: string[];
    nextChecks: string[];
  };
  diagnostics: {
    providerError?: string;
    sourceCount: number;
    signalCount: number;
    confidenceCap: number;
  };
  clientGovernor?: {
    confidencePenaltyApplied: boolean;
    originalConfidence: number;
    displayedConfidence: number;
    reason: string | null;
  };
};

type ApiPayload =
  | { mode: "live"; ai: BrainEnvelope }
  | { mode: "error"; error: string };

const PHASE_MINIMUM_MS = 800;
const DEPTH_MINIMUM_MS: Record<Depth, number> = {
  basic: 2600,
  pro: 4600,
  advanced: 7200,
};

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function applyClientConfidencePenalty(ai: BrainEnvelope): BrainEnvelope {
  const originalConfidence = clampConfidence(ai.output.confidence);
  const hasMissingData = Array.isArray(ai.output.missingData) && ai.output.missingData.length > 0;
  const lowSourceCount = Number(ai.diagnostics.sourceCount) < 2;
  const providerFallback = ai.mode === "rules" || Boolean(ai.diagnostics.providerError);
  const penaltyApplied = lowSourceCount || hasMissingData || providerFallback;
  const penalizedConfidence = clampConfidence(originalConfidence * 0.75);
  const displayedConfidence = penaltyApplied
    ? Math.min(39, penalizedConfidence)
    : originalConfidence;

  return {
    ...ai,
    output: {
      ...ai.output,
      confidence: displayedConfidence,
    },
    clientGovernor: {
      confidencePenaltyApplied: penaltyApplied,
      originalConfidence,
      displayedConfidence,
      reason: penaltyApplied
        ? providerFallback
          ? "fallback_provider_or_error"
          : lowSourceCount
            ? "source_count_below_two"
            : "missing_data_present"
        : null,
    },
  };
}

function labels(locale: Locale) {
  if (locale === "de") {
    return {
      title: "VLM Brain",
      verified: "Server-verified result",
      unverified: "Provider response · not LIVE",
      rules: "Fallback-Daten",
      loading: "Analyse wird aufgebaut",
      unavailable: "Analyse vorübergehend nicht verfügbar",
      evidence: "Bestätigte Signale",
      next: "Nächste Prüfung",
      missing: "Fehlende Daten",
      confidence: "Konfidenz",
      retry: "Erneut laden",
      sources: "Quellen",
      signals: "Signale",
      boot: "Sichere Sitzung wird vorbereitet",
      orb: "Quellen werden geprüft",
      brain: "VLM gewichtet die Evidenz",
      fallback: "Fallback Data · Konfidenz auf unter 40% begrenzt",
    };
  }
  if (locale === "en") {
    return {
      title: "VLM Brain",
      verified: "Server-verified result",
      unverified: "Provider response · not LIVE",
      rules: "Fallback data",
      loading: "Building the analysis",
      unavailable: "Analysis is temporarily unavailable",
      evidence: "Confirmed signals",
      next: "Next verification",
      missing: "Missing data",
      confidence: "Confidence",
      retry: "Reload",
      sources: "sources",
      signals: "signals",
      boot: "Preparing a verified session",
      orb: "Checking source coverage",
      brain: "VLM is weighing the evidence",
      fallback: "Fallback Data · confidence capped below 40%",
    };
  }
  return {
    title: "VLM Brain",
    verified: "Wynik potwierdzony przez serwer",
    unverified: "Odpowiedź providera · NIE LIVE",
    rules: "dane fallback",
    loading: "Budowanie analizy",
    unavailable: "Analiza jest chwilowo niedostępna",
    evidence: "Potwierdzone sygnały",
    next: "Następna weryfikacja",
    missing: "Brakujące dane",
    confidence: "Pewność",
    retry: "Wczytaj ponownie",
    sources: "źródła",
    signals: "sygnały",
    boot: "Przygotowanie sesji weryfikacji",
    orb: "Sprawdzanie pokrycia źródeł",
    brain: "VLM waży dowody",
    fallback: "Fallback Data · pewność ograniczona poniżej 40%",
  };
}

function verdictTone(verdict?: BrainEnvelope["output"]["verdict"]) {
  if (verdict === "high_risk") return "danger";
  if (verdict === "review" || verdict === "insufficient_data") return "watch";
  if (verdict === "observe") return "observe";
  return "calm";
}

function buildLocalFallbackBrain({
  query,
  locale,
  depth,
  surface,
  reason,
}: {
  query: string;
  locale: Locale;
  depth: Depth;
  surface: Surface;
  reason: string;
}): BrainEnvelope {
  const asset = query.trim().toUpperCase() || "ASSET";
  const isPolish = locale === "pl";
  const isGerman = locale === "de";
  const headline = isPolish
    ? `${asset}: analiza fallback`
    : isGerman
      ? `${asset}: Fallback-Analyse`
      : `${asset}: fallback analysis`;
  const summary = isPolish
    ? "Provider VLM nie zwrócił kompletnego wyniku, więc Shield pokazuje konserwatywny zestaw reguł z niską pewnością zamiast pustego błędu."
    : isGerman
      ? "Der VLM-Provider hat kein vollständiges Ergebnis geliefert, daher zeigt Shield eine konservative Regelanalyse mit niedriger Konfidenz statt eines leeren Fehlers."
      : "The VLM provider did not return a complete result, so Shield shows a conservative rules analysis with low confidence instead of an empty error.";
  const sourceLabel = surface === "shield_map" ? "Shield Map" : "Velmère";
  const missingData = isPolish
    ? [
        "Niezależne źródła OSINT dla ostatnich zmian.",
        "Pełne potwierdzenie unlocków, insiderów i płynności.",
        "Świeże dane społecznościowe i kontraktowe.",
      ]
    : isGerman
      ? [
          "Unabhängige OSINT-Quellen für die letzten Änderungen.",
          "Vollständige Bestätigung von Unlocks, Insidern und Liquidität.",
          "Aktuelle Social- und Contract-Daten.",
        ]
      : [
          "Independent OSINT sources for the latest changes.",
          "Full unlock, insider and liquidity confirmation.",
          "Fresh social and contract data.",
        ];
  const nextChecks = isPolish
    ? [
        `Sprawdź ${asset} w kolejce źródeł przed decyzją.`,
        "Porównaj unlocki i ruchy dużych portfeli.",
        "Uruchom ponownie analizę, gdy live provider wróci.",
      ]
    : isGerman
      ? [
          `${asset} in der Quellen-Warteschlange prüfen.`,
          "Unlocks und große Wallet-Bewegungen vergleichen.",
          "Analyse erneut starten, wenn der Live-Provider zurück ist.",
        ]
      : [
          `Verify ${asset} in the source queue before acting.`,
          "Compare unlocks and large wallet movement.",
          "Run the analysis again when the live provider recovers.",
        ];

  return {
    mode: "rules",
    model: null,
    traceId: `client-fallback:${surface}:${depth}:${asset}`,
    output: {
      verdict: "insufficient_data",
      headline,
      summary,
      confidence: 35,
      keyFindings: [
        {
          id: "fallback-source-coverage",
          title: isPolish
            ? "Pokrycie źródeł ograniczone"
            : isGerman
              ? "Quellenabdeckung begrenzt"
              : "Source coverage limited",
          explanation: isPolish
            ? `${sourceLabel} nie ma teraz kompletnego wyniku live, więc nie podnosi pewności ponad próg bezpieczeństwa.`
            : isGerman
              ? `${sourceLabel} hat aktuell kein vollständiges Live-Ergebnis, deshalb bleibt die Konfidenz unter der Sicherheitsgrenze.`
              : `${sourceLabel} does not have a complete live result right now, so confidence stays below the safety cap.`,
          severity: "watch",
          sourceIds: ["client-fallback"],
        },
        {
          id: "fallback-next-action",
          title: isPolish
            ? "Najpierw weryfikacja braków"
            : isGerman
              ? "Fehlende Daten zuerst prüfen"
              : "Verify missing data first",
          explanation: missingData[0] ?? "Missing data requires review.",
          severity: "info",
          sourceIds: ["client-fallback"],
        },
      ],
      missingData,
      nextChecks,
    },
    diagnostics: {
      providerError: reason || "client_side_fallback",
      sourceCount: 1,
      signalCount: 2,
      confidenceCap: 39,
    },
  };
}

export default function VlmBrainWorkspace({
  query,
  locale = "pl",
  depth = "basic",
  surface = "shield",
  compact = false,
}: {
  query: string;
  locale?: Locale;
  depth?: Depth;
  surface?: Surface;
  compact?: boolean;
}) {
  const copy = useMemo(() => labels(locale), [locale]);
  const [payload, setPayload] = useState<BrainEnvelope | null>(null);
  const [phase, setPhase] = useState<LoadingPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const safeQuery = query.trim();
    if (!safeQuery) return;
    const controller = new AbortController();
    let cancelled = false;

    async function runTieredAnalysis() {
      const startedAt = performance.now();
      setPayload(null);
      setError(null);
      setPhase("boot");

      try {
        await wait(PHASE_MINIMUM_MS, controller.signal);
        if (cancelled) return;
        setPhase("orb");

        const fetchPromise = fetch(
          `/api/market-integrity/vlm?query=${encodeURIComponent(safeQuery)}&locale=${locale}&depth=${depth}&surface=${surface}`,
          { signal: controller.signal },
        ).then(async (response) => {
          const result = await readBrowserJsonObject<ApiPayload>(response, {
            maxBytes: 1024 * 1024,
            maxDepth: 64,
            maxNodes: 120_000,
          });
          if (!result.ok || !response.ok || result.value.mode === "error" || !result.value.ai) {
            reportBrowserBoundaryFailure({
              event: "vlm_brain_response_rejected",
              error: new Error(result.ok ? "vlm_brain_response_unavailable" : result.code),
            });
            throw new Error("vlm_brain_response_unavailable");
          }
          return result.value.ai;
        });

        const [ai] = await Promise.all([
          fetchPromise,
          wait(PHASE_MINIMUM_MS, controller.signal),
        ]);
        if (cancelled) return;

        setPhase("brain");
        await wait(PHASE_MINIMUM_MS, controller.signal);
        const elapsed = performance.now() - startedAt;
        const remaining = Math.max(0, DEPTH_MINIMUM_MS[depth] - elapsed);
        if (remaining > 0) await wait(remaining, controller.signal);
        if (cancelled) return;

        setPayload(applyClientConfidencePenalty(ai));
        setPhase("idle");
      } catch (reason: unknown) {
        if (controller.signal.aborted || cancelled) return;
        reportBrowserBoundaryFailure({ event: "vlm_brain_request_failed", error: reason });
        setPayload(
          applyClientConfidencePenalty(
            buildLocalFallbackBrain({
              query: safeQuery,
              locale,
              depth,
              surface,
              reason: "vlm_brain_response_unavailable",
            }),
          ),
        );
        setError(null);
        setPhase("idle");
      }
    }

    void runTieredAnalysis();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [copy.unavailable, depth, locale, query, retryTick, surface]);

  const findingsLimit = depth === "basic" ? 3 : depth === "pro" ? 5 : 8;
  const tone = verdictTone(payload?.output.verdict);
  const loading = phase !== "idle";
  const phaseLabel = phase === "boot" ? copy.boot : phase === "orb" ? copy.orb : phase === "brain" ? copy.brain : copy.loading;
  const fallbackMode = Boolean(payload?.clientGovernor?.confidencePenaltyApplied || payload?.mode === "rules");
  const serverLiveVerified = payload?.serverLiveVerified === true;

  return (
    <section
      className={`vlm-brain-workspace ${compact ? "vlm-brain-workspace--compact" : ""}`}
      data-tone={tone}
      data-provider-mode={payload?.mode ?? (loading ? phase : "loading")}
      data-confidence-penalty={payload?.clientGovernor?.confidencePenaltyApplied ? "true" : "false"}
      aria-live="polite"
    >
      <header className="vlm-brain-workspace__header">
        <div className="vlm-brain-workspace__identity">
          <span className="vlm-brain-workspace__mark" aria-hidden="true">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <p className="vlm-brain-workspace__kicker">{copy.title} · {depth}</p>
            <h3>{payload?.output.headline ?? phaseLabel}</h3>
          </div>
        </div>
        <span className="vlm-brain-workspace__mode">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="vlm-brain-workspace__status-dot" />}
          {fallbackMode ? copy.fallback : payload?.mode === "gemini" ? (serverLiveVerified ? copy.verified : copy.unverified) : copy.rules}
        </span>
      </header>

      {error ? (
        <div className="vlm-brain-workspace__error" role="status">
          <ShieldAlert className="h-4 w-4" />
          <span>{copy.unavailable}</span>
          <button type="button" onClick={() => setRetryTick((value) => value + 1)}>
            {copy.retry}
          </button>
        </div>
      ) : (
        <>
          <p className="vlm-brain-workspace__summary">
            {payload?.output.summary ?? phaseLabel}
          </p>

          <div className="vlm-brain-workspace__meta">
            <span>
              {copy.confidence} <strong>{payload?.output.confidence ?? 0}/100</strong>
              {payload?.clientGovernor?.confidencePenaltyApplied ? (
                <em className="ml-1 not-italic text-amber-100/[0.72]">
                  ({payload.clientGovernor.originalConfidence}→{payload.clientGovernor.displayedConfidence})
                </em>
              ) : null}
            </span>
            <span>{payload?.diagnostics.sourceCount ?? 0} {copy.sources}</span>
            <span>{payload?.diagnostics.signalCount ?? 0} {copy.signals}</span>
          </div>

          {payload?.output.keyFindings?.length ? (
            <div className="vlm-brain-workspace__findings">
              <p className="vlm-brain-workspace__section-label">{copy.evidence}</p>
              <div className="vlm-brain-workspace__finding-grid">
                {payload.output.keyFindings.slice(0, findingsLimit).map((finding) => (
                  <article key={finding.id} data-severity={finding.severity}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <div>
                      <h4>{finding.title}</h4>
                      <p>{finding.explanation}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {!compact && payload?.output.nextChecks?.length ? (
            <div className="vlm-brain-workspace__next">
              <p className="vlm-brain-workspace__section-label">{copy.next}</p>
              <ol>
                {payload.output.nextChecks.slice(0, depth === "advanced" ? 5 : 3).map((check, index) => (
                  <li key={`${check}-${index}`}>{check}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {!compact && payload?.output.missingData?.length ? (
            <div className="vlm-brain-workspace__missing">
              <p className="vlm-brain-workspace__section-label">{copy.missing}</p>
              <p>{payload.output.missingData.slice(0, depth === "advanced" ? 6 : 3).join(" · ")}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
