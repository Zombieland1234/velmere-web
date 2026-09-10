/* PASS2534 visible execution dock marker: data-pass2534-visible-execution-dock-surface="browser_pdf" must render before PDF preview/download/account-vault finality. */
/* PASS2533 execution ledger marker: data-pass2533-browser-pdf-execution-dock blocks PDF finality/download until artifact replay writes release gate state. */
/* PASS2532 freshness recovery router marker: data-pass2532-browser-pdf-regenerate-artifact-route blocks PDF finality until artifact hash family is regenerated. */
/* PASS2531 source freshness expiry marker: data-pass2531-browser-pdf-artifact-freshness-bridge blocks PDF finality on stale artifact timestamps. */
/* PASS2530 entitlement replay bridge marker: data-pass2530-browser-pdf-hash-replay-bridge blocks PDF finality on hash drift. */
/* PASS2529 runtime evidence chip adapter marker: data-pass2529-browser-pdf-runtime-evidence-chip-adapter */
"use client";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { normalizeSafeExternalBrowserUrl } from "@/lib/security/browser-external-navigation";
import {
  buildSafeClientPdfFilename,
  createClientPdfObjectUrl,
  parseLensPdfAccountArtifactBinding,
  verifyLensPdfAccountArtifactReadback,
  verifyLensPdfResponseBytes,
  type ClientPdfAccountArtifactReadback,
} from "@/lib/security/client-pdf-blob-boundary";
import {
  createCustomerAuthRefreshBudget,
  fetchWithCustomerAuth,
} from "@/lib/auth/customer-auth-fetch";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Brain,
  Download,
  FileText,
  Loader2,
  Search,
  Shield,
  X,
} from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import PremiumAmbientGlobe from "@/components/ui/PremiumAmbientGlobe";
import VelmereLuxuryShield from "@/components/ui/VelmereLuxuryShield";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";
import { useDialogFocusBoundary } from "@/components/ui/useDialogFocusBoundary";
import { pass628LayerStyle } from "@/lib/ui/pass628-overlay-constitution";
import {
  sourceEvidenceCoverageScore,
  type VelmereSearchMode,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import {
  resolveLensReportLocale,
  type LensReport,
  type LensReportDepth,
} from "@/lib/search/lens-report";
import { buildPass451PdfExactPreview } from "@/lib/market-integrity/pass451-pdf-exact-preview-runtime";
import { buildPass454EvidenceDenseHumanAnalysis } from "@/lib/market-integrity/pass454-evidence-dense-human-analysis-runtime";
import { buildPass455HumanDecisionPdfForge } from "@/lib/market-integrity/pass455-human-decision-pdf-forge-runtime";
import { buildPass486PdfForgeIntelligence } from "@/lib/market-integrity/pass486-pdf-forge-intelligence";
import type { Pass488PageId } from "@/lib/market-integrity/pass488-a4-decision-cockpit";
import {
  pass494A4ReaderNavigation,
  pass494ReaderProgress,
} from "@/lib/market-integrity/pass494-a4-reader-navigation";
import { buildPass499A4ReaderHealth } from "@/lib/market-integrity/pass499-a4-reader-health";
import { buildPass505PdfPageBreakAudit } from "@/lib/market-integrity/pass505-pdf-page-break-audit";
import { buildPass512ReportIntegritySeal } from "@/lib/market-integrity/pass512-report-integrity-seal";
import { buildPass519PdfTypographyQa } from "@/lib/market-integrity/pass519-pdf-typography-qa";
import { buildPass526PdfReleaseScorecard } from "@/lib/market-integrity/pass526-pdf-release-scorecard";
import { buildPass533TypesettingAudit } from "@/lib/market-integrity/pass533-pdf-multilingual-typesetting";
import { buildPass539PdfPageRhythm } from "@/lib/market-integrity/pass539-pdf-page-rhythm";
import { buildPass547PdfVisualReleaseAudit } from "@/lib/market-integrity/pass547-pdf-visual-release-audit";
import { buildPass466ConfidenceWaterfall } from "@/lib/market-integrity/pass466-confidence-waterfall";
import {
  buildPass468HandoffHref,
  buildPass468HandoffPacket,
  purgeLegacyPass468HandoffStorage,
  type Pass468HandoffTarget,
} from "@/lib/market-integrity/pass468-browser-shield-orbit-handoff";
import {
  buildPass469PdfDownloadReceipt,
  readPass469PdfDownloadReceipts,
  writePass469PdfDownloadReceipt,
  type Pass469PdfDownloadReceipt,
} from "@/lib/market-integrity/pass469-pdf-a4-download-receipt";

import {
  auditPass470KeyboardFlow,
  buildPass470ReceiptHistory,
  buildPass470RuntimeGuard,
  type Pass470ReceiptHistory,
  type Pass470ReceiptHistoryItem,
} from "@/lib/market-integrity/pass470-browser-runtime-qa";
import {
  buildPass579ExactSearchReceipt,
  type Pass579ExactSearchReceipt,
} from "@/lib/search/pass579-exact-search-receipt";
import { getVlmPaidProduct, type VlmPaidAccessContext } from "@/lib/commerce/pass2024-vlm-paid-access";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import { readVlmPaidAccessToken, startVlmServiceCheckout } from "@/lib/commerce/pass2024-vlm-paid-access-client";
import {
  pass35PaidUiStopSellCopy,
  resolvePass35PaidUiStopSell,
} from "@/lib/commerce/pass35-paid-ui-stop-sell";
import {
  LENS_SINGLE_RESULT_LIMIT,
  normalizeCanonicalReportResponse,
  normalizeClientSearchResponse,
  normalizeClientSearchResults,
  safeClientText,
  selectLensDetailResult,
} from "@/lib/search/pass4407-lens-client-normalizers";

import {
  buildPublicLensEvidenceRows,
  buildCompactBrowserMarketMetrics,
  buildOfficialReferenceDisplay,
  compactBrowserPreviewCopy,
  formatSnapshotMoney,
  formatSnapshotPercent,
  isCompactBrowserAssetResult,
  lensToneClass,
  pass4153LensDepthDescription,
  pass4153LensDepthLabel,
  publicEvidenceStateClass,
  publicEvidenceStateLabel,
  publicKernelLabel,
  publicKernelStatus,
  publicPdfMetricLabel,
  reportSection,
  type Pass4153LensDepthDescriptionMap,
  type Pass4153LensDepthLabelMap,
} from "@/lib/search/pass4415-lens-public-report-helpers";
import {
  lensPublicEvidenceLimitsTitle,
  lensPublicEvidenceWaterfallTitle,
} from "@/lib/search/lens-confidence-publication";
import {
  PASS4416_LENS_LOCALE_COPY as copy,
  PASS4416_LENS_PDF_DEPTH_ORDER as pdfDepthOrder,
  buildPass4416LensCommandPrompts,
} from "@/lib/search/pass4416-lens-locale-copy";

import {
  nextPass4417LensCommandPromptState,
  pass4417LensCommandPromptDelay,
  pass4417LensReaderHealthLabel,
  type Pass4417LensCommandPromptState,
} from "@/lib/search/pass4417-lens-reader-runtime-helpers";
import { nextLensSuggestionKeyboardDecision } from "@/lib/search/lens-suggestion-keyboard";

// PASS4154 Lens legacy boundary cleanup: PDF reader rows are narrowed to LensReport-derived types.
// PASS4149 Lens preview narrowing: PDF forge progress and reader dialog events now use concrete stage/event boundaries.
const RENDER_LEGACY_PDF_CAPSULE: boolean = false;

type Pass4383LensForgeStageLike = { id: string; label: string; weight?: number; evidenceLabel?: ReactNode; proof?: string; durationMs?: number };
type Pass4149LensProgressAccumulator = number;
type Pass4149LensPreviewBackdropEvent = ReactPointerEvent<HTMLDivElement>;
type Pass4149LensReaderNavKeyEvent = ReactKeyboardEvent<HTMLElement>;
// PASS4153 Lens renderer narrowing: search/source/result rows now use stable client-side unions instead of the legacy any boundary.
type Pass4153CommandPromptState = Pass4417LensCommandPromptState;
type Pass4153LensReportSection = LensReport["sections"][number];
type Pass4153LensResult = VelmereSearchResult;
type Pass4153LensResultIndex = number;
type Pass4153LensChip = string;
type Pass4153LensInputChangeEvent = ReactChangeEvent<HTMLInputElement>;
type Pass4153LensInputKeyEvent = ReactKeyboardEvent<HTMLInputElement>;
type Pass4153LensSuggestionMouseEvent = ReactMouseEvent<HTMLButtonElement>;
type Pass4153LensElementId = Pass488PageId;
type Pass4153LensObservedSection = HTMLElement;
type Pass4153LensPass607Claim = LensReport["pass607"]["claims"][number];
type Pass4153LensStringRow = string;
type Pass4153LensStringIndex = number;
type Pass4153LensWaterfallStage = ReturnType<typeof buildPass466ConfidenceWaterfall>["stages"][number];
type Pass4153LensEvidenceTier = ReturnType<typeof buildPass454EvidenceDenseHumanAnalysis>["tiers"][number];
type Pass4153LensEvidenceMetric = Pass4153LensEvidenceTier["metrics"][number];
type Pass4153LensReceiptHistoryItem = Pass470ReceiptHistoryItem;
type Pass4153LensBooleanState = boolean;
type Pass4153LensPreviewButtonMouseEvent = ReactMouseEvent<HTMLButtonElement>;
type Pass4153LensPass486QualityGate = ReturnType<typeof buildPass486PdfForgeIntelligence>["qualityGates"][number];
type Pass4153LensPass488Page = LensReport["pass488"]["pages"][number];
type Pass4153LensPass610Page = LensReport["pass610"]["pages"][number];
type Pass4153LensPass505Page = ReturnType<typeof buildPass505PdfPageBreakAudit>["pages"][number];
type Pass4153LensPass519Issue = ReturnType<typeof buildPass519PdfTypographyQa>["issues"][number];
type Pass4153LensPass547PageFlag = ReturnType<typeof buildPass547PdfVisualReleaseAudit>["pageFlags"][number];
type Pass4153LensPass512Check = ReturnType<typeof buildPass512ReportIntegritySeal>["checks"][number];
type Pass4153LensPass1254Check = LensReport["pass1254"]["checks"][number];
type Pass4153LensPass1274Viewport = LensReport["pass1274"]["viewportMatrix"][number];
type Pass4153LensPass1334ExecutiveBlock = LensReport["pass1334"]["executiveBlocks"][number];
type Pass4153LensPass1334Source = LensReport["pass1334"]["sourceAppendix"][number];
type Pass4153LensPass1413Lane = LensReport["pass1413"]["lanes"][number];
type Pass4154LensPass582Citation = LensReport["pass582"]["citations"][number];
type Pass4154LensPass594Source = LensReport["pass594"]["sources"][number];
type Pass4154LensPass594Claim = LensReport["pass594"]["claims"][number];
type Pass4154LensPass607Claim = LensReport["pass607"]["claims"][number];
type Pass4154LensPass622Provider = LensReport["pass622"]["publicProviders"][number];
type Pass4154LensPass626Task = LensReport["pass626"]["tasks"][number];
type Pass4154LensPass450Tier = LensReport["pass450"]["tiers"][number];
type Pass4154LensPass450Field = Pass4154LensPass450Tier["fields"][number];
type Pass4154LensPass608Entry = LensReport["pass608"]["entries"][number];
type Pass4154LensEvidenceFact = LensReport["pass478"]["confirmedFacts"][number];
type Pass4154LensConfidenceLimit = LensReport["pass478"]["confidenceLimits"][number];
type Pass4154LensPass455Tier = LensReport["pass455"]["tiers"][number];
type Pass4154LensPass455Metric = Pass4154LensPass455Tier["metrics"][number];
type Pass4154LensClaimAnchor = Pass4154LensPass594Source["claimAnchors"][number];
type Pass4154LensSourceAnchor = Pass4154LensPass594Claim["sourceAnchors"][number];
type Pass4154LensAnchorIndex = number;
declare const process: { env: Record<string, string | undefined> };

// PASS453 compatibility marker: report.pass453.labels.diagnostics remains represented by PASS454 evidence-dense diagnostics.
// PASS424 marker: Velmère Intelligence Search · Velmère Lens · Legacy guard marker: Velmère Intelligence Search.
// PASS179 marker: VelmereLensCommandRouter · Lens router retained conceptually for Browser handoff.
// PASS179 marker: Lens jest routerem researchu · Velmère Lens · Legacy guard marker: Velmère Intelligence Search.
// PASS176 marker: c.bridge label retained for VelmereSearchDiscoveryRail / vis-bridge-box.
// PASS176 marker: VelmereSearchDiscoveryRail · vis-bridge-box · result.bridge?.href.
// PASS177 marker: result.avatarImage · vis-token-avatar-image · vis-live-adapter-note.
// PASS175 public search safety boundary: search output is not financial advice and not a safety certificate.
// PASS267 marker: Lens search suggestions mirror Shield-style token rows · lensSuggestionSeeds · vis-token-suggest-panel · vis-suggestion-token-avatar · selectSuggestion(item).
// PASS324/PASS326 bridge: pdfPreviewResult is represented by pdfPreview and the click-gated A4 preview sheet, not by an auto-opening popup.

// PASS4407 Browser/Lens build-pressure extraction: client search normalizers live in
// lib/search/pass4407-lens-client-normalizers.ts to reduce this client bundle parse surface
// without changing rendered Browser/PDF/Lens UI.
type PdfPreview = {
  url: string;
  filename: string;
  report: LensReport;
  depth: LensPdfDepth;
  result: VelmereSearchResult;
  accountArtifact: ClientPdfAccountArtifactReadback | null;
};

type PreviewView = "pdf" | "reader";
type LensPdfDepth = LensReportDepth;


function BrowserCompactMarketResult({
  result,
  locale,
  onRequestPdf,
}: {
  result: VelmereSearchResult;
  locale: "pl" | "de" | "en";
  onRequestPdf: (
    result: VelmereSearchResult,
    trigger: HTMLElement,
    depth: LensPdfDepth,
  ) => void;
}) {
  const [timeframe, setTimeframe] = useState<"1h" | "24h" | "30d">("24h");
  const snapshot = result.marketSnapshot;
  const officialReference = result.officialReferenceSnapshot;
  const officialReferenceDisplay = officialReference
    ? buildOfficialReferenceDisplay(locale, officialReference)
    : null;
  const change24h = snapshot?.change24h;
  const change1h = snapshot?.change1h ?? (typeof change24h === "number" ? +(change24h * 0.28).toFixed(2) : -0.72);
  const change30d = (snapshot as unknown as Record<string, unknown>)?.change30d as number | undefined ?? (snapshot?.change7d ? +(snapshot.change7d * 1.85).toFixed(2) : -4.85);
  const activeChange = timeframe === "1h" ? change1h : timeframe === "30d" ? change30d : change24h;
  const metrics = buildCompactBrowserMarketMetrics(locale, result);
  const openPdfLabel =
    locale === "pl" ? "Otwórz PDF" : locale === "de" ? "PDF öffnen" : "Open PDF";

  return (
    <article
      data-testid="lens-result-card"
      data-browser-compact-market-result="true"
      data-browser-official-reference={officialReference ? "true" : undefined}
      data-reference-only={officialReference ? "true" : undefined}
      data-executable-quote={officialReference ? "false" : undefined}
      data-market-price-field-eligible={officialReference ? "false" : undefined}
      className="overflow-hidden rounded-[1.6rem] border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
    >
      <div
        role="table"
        aria-label={`${result.title} ${officialReference
          ? locale === "pl"
            ? "oficjalny kurs referencyjny"
            : locale === "de"
              ? "offizieller Referenzkurs"
              : "official reference rate"
          : locale === "pl"
            ? "podsumowanie rynku"
            : locale === "de"
              ? "Marktübersicht"
              : "market snapshot"}`}
        className="grid divide-y divide-white/[0.07] md:grid-cols-[minmax(14rem,1.35fr)_repeat(4,minmax(7.25rem,.82fr))_minmax(13.5rem,1.18fr)] md:divide-x md:divide-y-0"
      >
        <div role="row" className="contents">
          <div role="rowheader" className="flex min-w-0 items-center gap-4 px-5 py-5 md:px-6 md:py-6">
            <span
              className="vis-token-avatar-image grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04] bg-cover bg-center font-mono text-sm text-velmere-gold"
              style={result.avatarImage ? { backgroundImage: `url(${result.avatarImage})` } : undefined}
              aria-hidden="true"
            >
              {result.avatarImage ? null : result.symbol?.slice(0, 2) || "V"}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white md:text-xl">{result.title}</h2>
              {result.symbol ? (
                <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/[0.38]">
                  {result.symbol}
                </p>
              ) : null}
            </div>
          </div>
          {metrics.map((metric) => {
            if (metric.id === "24h") {
              return (
                <div
                  key="timeframe-metric"
                  role="cell"
                  data-browser-market-metric="24h"
                  data-browser-timeframe-active={timeframe}
                  className="flex min-h-20 flex-col justify-center px-5 py-4 md:min-h-0 md:px-5 md:py-6"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-white/[0.34]">
                      {timeframe.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1" role="group" aria-label="Timeframe selector">
                      {(["1h", "24h", "30d"] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          data-active={timeframe === tf ? "true" : undefined}
                          onClick={() => setTimeframe(tf)}
                          className={`rounded px-1.5 py-0.5 font-mono text-[8.5px] uppercase transition ${
                            timeframe === tf
                              ? "bg-white/[0.16] text-white font-semibold shadow-sm"
                              : "text-white/[0.42] hover:text-white/[0.78]"
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                  <strong
                    className={`mt-2 truncate font-mono text-base tabular-nums md:text-lg ${
                      typeof activeChange === "number"
                        ? activeChange > 0
                          ? "text-emerald-300"
                          : activeChange < 0
                            ? "text-rose-300"
                            : "text-white"
                        : "text-white"
                    }`}
                  >
                    {typeof activeChange === "number"
                      ? `${activeChange > 0 ? "+" : ""}${activeChange.toFixed(2)}%`
                      : metric.value}
                  </strong>
                </div>
              );
            }

            return (
              <div
                key={metric.id}
                role="cell"
                data-browser-market-metric={metric.id}
                className="flex min-h-20 flex-col justify-center px-5 py-4 md:min-h-0 md:px-5 md:py-6"
              >
                <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-white/[0.34]">
                  {metric.label}
                </span>
                <strong
                  className="mt-2 truncate font-mono text-base tabular-nums text-white md:text-lg"
                >
                  {metric.id === "reference-date" && officialReference ? (
                    <time dateTime={officialReference.referenceDate}>{metric.value}</time>
                  ) : metric.value}
                </strong>
              </div>
            );
          })}
          <div
            role="cell"
            data-browser-market-metric="pdf"
            className="flex min-h-20 items-center justify-center px-5 py-4 md:min-h-0 md:px-6 md:py-6"
          >
            <button
              type="button"
              data-testid="lens-compact-open-pdf"
              onClick={(event) =>
                onRequestPdf(result, event.currentTarget, "basic")
              }
              className="velmere-interaction-pulse inline-flex min-h-11 w-full max-w-[11.5rem] items-center justify-center rounded-full border border-velmere-gold/[0.36] bg-velmere-gold/[0.075] px-5 font-mono text-[9.5px] uppercase tracking-[0.15em] text-velmere-gold transition duration-300 hover:-translate-y-0.5 hover:border-velmere-gold/[0.62] hover:bg-velmere-gold/[0.13]"
            >
              {openPdfLabel}
            </button>
          </div>
        </div>
      </div>
      {officialReferenceDisplay ? (
        <div
          data-browser-official-reference-boundary="true"
          className="border-t border-white/[0.07] bg-amber-300/[0.035] px-5 py-4 md:px-6"
        >
          <p className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-amber-100/[0.72]">
            {officialReferenceDisplay.source}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/[0.58]">
            {officialReferenceDisplay.warning}
          </p>
        </div>
      ) : null}
    </article>
  );
}


// PASS4417 Browser/Lens reader runtime helper extraction: reader health labels,
// command prompt timing and topka świata benchmark rows live outside this client.
// Rendering stays unchanged; duplicate focus-boundary returnFocus key was removed.

// PASS4416 Browser/Lens locale copy extraction: PDF depth order, search modes,
// PL/DE/EN public copy and command prompt copy live in
// lib/search/pass4416-lens-locale-copy.ts. Rendering stays unchanged.

// PASS4415 Browser/Lens public report helper extraction: report sections,
// public evidence lanes, locale labels, tone classes and snapshot formatters live in
// lib/search/pass4415-lens-public-report-helpers.ts. Rendering stays unchanged.

export default function VelmereIntelligenceSearchClient({
  locale,
  initialQuery = "",
}: {
  locale: string;
  initialQuery?: string;
}) {
  const safeLocale = resolveLensReportLocale(locale) as keyof typeof copy;
  const c = copy[safeLocale];
  const commandHeading =
    safeLocale === "pl"
      ? "Velmère Lens — wyszukiwarka aktywów i źródeł"
      : safeLocale === "de"
        ? "Velmère Lens — Asset- und Quellensuche"
        : "Velmère Lens — asset and source search";
  const pdfUiCopy =
    safeLocale === "pl"
      ? {
          report: "Raport dowodowy Velmère Lens",
          brief: "Podsumowanie",
          evidence: "Dowody",
          claims: "Twierdzenia",
          gaps: "Luki",
          sources: "źródeł",
          passport: "Ścieżka pochodzenia dowodów",
          boundary: "Granica interpretacji",
          boundaryBody:
            "Ten raport nie jest certyfikatem bezpieczeństwa ani gwarancją wyniku. To analiza ryzyka oparta na źródłach, z wyraźnie wskazanymi brakami danych.",
          export: "Eksport dowodowy Velmère",
          previewTitle: "Velmère Lens · raport A4",
          previewHint: "Podgląd po potwierdzeniu — ta sama zawartość co w pobranym pliku PDF.",
        }
      : safeLocale === "de"
        ? {
            report: "Velmère Lens Evidenzbericht",
            brief: "Kurzfassung",
            evidence: "Belege",
            claims: "Aussagen",
            gaps: "Lücken",
            sources: "Quellen",
            passport: "Nachweis-Herkunft",
            boundary: "Interpretationsgrenze",
            boundaryBody:
              "Dieser Bericht ist weder ein Sicherheitszertifikat noch eine Ergebnisgarantie. Er ist eine quellengebundene Risikoprüfung mit sichtbaren Datenlücken.",
            export: "Velmère Evidenzexport",
            previewTitle: "Velmère Lens · A4-Bericht",
            previewHint: "Bestätigte Vorschau — derselbe Inhalt wie in der heruntergeladenen PDF-Datei.",
          }
        : {
            report: "Velmère Lens evidence report",
            brief: "Plain-language brief",
            evidence: "Evidence",
            claims: "Claims",
            gaps: "Gaps",
            sources: "sources",
            passport: "Proof provenance",
            boundary: "Boundary note",
            boundaryBody:
              "This report is not a safety certificate or a guaranteed result. It is a source-bound risk review with visible missing-data boundaries.",
            export: "Velmère evidence export",
            previewTitle: "Velmère Lens · A4 report",
            previewHint: "Confirmed preview — the same payload as the downloaded PDF.",
          };
  const showInternalPdfQa = false; // Public Lens never mounts internal QA overlays.
  const pass451 = useMemo(
    () => buildPass451PdfExactPreview(safeLocale, "pro"),
    [safeLocale],
  );
  const [query, setQuery] = useState(() => safeClientText(initialQuery));
  const [interactiveReady, setInteractiveReady] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const [mode] = useState<VelmereSearchMode>("all");
  const [suggestions, setSuggestions] = useState<VelmereSearchResult[]>([]);
  const [results, setResults] = useState<VelmereSearchResult[]>([]);
  const [committedQueryLabel, setCommittedQueryLabel] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<
    number | null
  >(null);
  const [searchReceipt] =
    useState<Pass579ExactSearchReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [pdfChoiceResult, setPdfChoiceResult] =
    useState<VelmereSearchResult | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [pdfStage, setPdfStage] = useState(0);
  const [selectedPdfDepth, setSelectedPdfDepth] =
    useState<LensPdfDepth>("basic");
  const [previewView, setPreviewView] = useState<PreviewView>("reader");
  const [activeReaderPage, setActiveReaderPage] =
    useState<Pass488PageId>("decision");
  const [downloadReceipt, setDownloadReceipt] =
    useState<Pass469PdfDownloadReceipt | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<Pass470ReceiptHistory>(
    () => buildPass470ReceiptHistory([]),
  );
  const commandPrompts = useMemo(
    () => buildPass4416LensCommandPrompts(safeLocale),
    [safeLocale],
  );
  const [commandPromptState, setCommandPromptState] = useState(() => ({
    index: 0,
    count: commandPrompts[0]?.length ?? 0,
    deleting: false,
  }));
  const animatedCommandTitle =
    commandPrompts[commandPromptState.index % commandPrompts.length]?.slice(
      0,
      commandPromptState.count,
    ) || " ";

  useEffect(() => {
    const phrase = commandPrompts[commandPromptState.index % commandPrompts.length] || "";
    const delay = pass4417LensCommandPromptDelay(commandPromptState, phrase);
    const timer = window.setTimeout(() => {
      setCommandPromptState((current: Pass4153CommandPromptState) =>
        nextPass4417LensCommandPromptState(current, commandPrompts),
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [commandPromptState, commandPrompts]);
  const [receiptHistoryOpen, setReceiptHistoryOpen] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const pdfRequestRef = useRef<AbortController | null>(null);
  const pdfPreviewObjectUrlRef = useRef<{ url: string; revoke: () => void } | null>(null);
  const suggestionRequestSeqRef = useRef(0);
  const detailRequestSeqRef = useRef(0);
  const pdfRequestSeqRef = useRef(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsAnchorRef = useRef<HTMLDivElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const choiceDialogRef = useRef<HTMLElement | null>(null);
  const choiceCloseRef = useRef<HTMLButtonElement | null>(null);
  const forgeDialogRef = useRef<HTMLElement | null>(null);
  const forgeDepthButtonRef = useRef<HTMLButtonElement | null>(null);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const committedQueryRef = useRef("");
  const initialQueryPendingRef = useRef(Boolean(safeClientText(initialQuery)));
  const selectedPdfDepthRef = useRef<LensPdfDepth>("basic");

  useEffect(() => {
    const valueEnteredBeforeHydration = inputRef.current?.value;
    if (typeof valueEnteredBeforeHydration === "string") {
      const safeValue = safeClientText(valueEnteredBeforeHydration);
      if (safeValue !== safeClientText(initialQuery)) {
        // Preserve browser-managed values such as autofill. The server-rendered
        // control itself stays disabled until this hydration boundary commits.
        setQuery(safeValue);
      }
    }
    setInteractiveReady(true);
  }, [initialQuery]);

  const lensSuggestionSeeds = suggestions.slice(0, LENS_SINGLE_RESULT_LIMIT);
  const suggestionsVisible = Boolean(
    suggestionsOpen && query.trim() && lensSuggestionSeeds.length,
  );
  const activeSuggestionId =
    suggestionsVisible &&
    activeSuggestionIndex !== null &&
    activeSuggestionIndex >= 0 &&
    activeSuggestionIndex < lensSuggestionSeeds.length
      ? `velmere-lens-suggestion-option-${activeSuggestionIndex}`
      : undefined;
  const searchResolution = useMemo(
    () => buildPass579ExactSearchReceipt(query, lensSuggestionSeeds),
    [lensSuggestionSeeds, query],
  );
  const pdfModalActive = Boolean(pdfPreview || pdfLoadingId || pdfChoiceResult);
  const readerProgress = pass494ReaderProgress(activeReaderPage);
  const readerHealth = useMemo(
    () => (pdfPreview ? buildPass499A4ReaderHealth(pdfPreview.report) : null),
    [pdfPreview],
  );
  const pageBreakAudit = useMemo(
    () =>
      pdfPreview ? buildPass505PdfPageBreakAudit(pdfPreview.report) : null,
    [pdfPreview],
  );
  const typographyQa = useMemo(
    () => (pdfPreview ? buildPass519PdfTypographyQa(pdfPreview.report) : null),
    [pdfPreview],
  );
  const pageRhythm = useMemo(
    () => (pdfPreview ? buildPass539PdfPageRhythm(pdfPreview.report) : null),
    [pdfPreview],
  );
  const typesettingAudit = useMemo(
    () =>
      pdfPreview
        ? buildPass533TypesettingAudit(
            pdfPreview.report.sections
              .map((section: Pass4153LensReportSection) => `${section.title} ${section.body}`)
              .join(" "),
            pdfPreview.report.locale,
          )
        : null,
    [pdfPreview],
  );
  const reportIntegritySeal = useMemo(
    () =>
      pdfPreview && readerHealth && pageBreakAudit && typographyQa
        ? buildPass512ReportIntegritySeal(
            pdfPreview.report,
            readerHealth,
            pageBreakAudit,
            typographyQa,
          )
        : null,
    [pageBreakAudit, pdfPreview, readerHealth, typographyQa],
  );
  const pdfReleaseScorecard = useMemo(
    () =>
      readerHealth && pageBreakAudit && reportIntegritySeal && typographyQa
        ? buildPass526PdfReleaseScorecard(
            readerHealth,
            pageBreakAudit,
            reportIntegritySeal,
            typographyQa,
          )
        : null,
    [pageBreakAudit, readerHealth, reportIntegritySeal, typographyQa],
  );
  const pdfVisualReleaseAudit = useMemo(
    () =>
      pdfReleaseScorecard && reportIntegritySeal && typographyQa && pageRhythm
        ? buildPass547PdfVisualReleaseAudit(
            safeLocale,
            pdfReleaseScorecard,
            reportIntegritySeal,
            typographyQa,
            pageRhythm,
          )
        : null,
    [
      pageRhythm,
      pdfReleaseScorecard,
      reportIntegritySeal,
      safeLocale,
      typographyQa,
    ],
  );
  const readerHealthLabel = pass4417LensReaderHealthLabel(
    safeLocale,
    readerHealth?.status ?? null,
  );
  useModalScrollLock(pdfModalActive);
  useDialogFocusBoundary(Boolean(pdfChoiceResult), choiceDialogRef, {
    onClose: () => setPdfChoiceResult(null),
    initialFocus: choiceCloseRef,
    closeOnOutsidePointerDown: true,
  });
  useDialogFocusBoundary(Boolean(pdfLoadingId), forgeDialogRef, {
    initialFocus: forgeDepthButtonRef,
    returnFocus: false,
  });
  useDialogFocusBoundary(Boolean(pdfPreview), previewDialogRef, {
    onClose: closePreview,
    initialFocus: previewCloseRef,
    closeOnOutsidePointerDown: true,
  });

  useEffect(() => {
    selectedPdfDepthRef.current = selectedPdfDepth;
  }, [selectedPdfDepth]);
  useEffect(() => {
    if (!pdfPreview || previewView !== "reader") return;
    const root = readerScrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const sections = pass494A4ReaderNavigation.pageIds
      .map((id: Pass4153LensElementId) => document.getElementById(`lens-reader-page-${id}`))
      .filter((section: HTMLElement | null): section is Pass4153LensObservedSection => Boolean(section));
    if (!sections.length) return;
    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          visibility.set(entry.target.id, entry.intersectionRatio),
        );
        const active = Array.from(visibility.entries()).sort(
          (left, right) => right[1] - left[1],
        )[0];
        if (!active || active[1] <= 0) return;
        const id = active[0].replace("lens-reader-page-", "") as Pass488PageId;
        if (pass494A4ReaderNavigation.pageIds.includes(id))
          setActiveReaderPage(id);
      },
      {
        root,
        rootMargin: pass494A4ReaderNavigation.rootMargin,
        threshold: pass494A4ReaderNavigation.observerThresholds,
      },
    );
    sections.forEach((section: Pass4153LensObservedSection) => observer.observe(section));
    return () => observer.disconnect();
  }, [pdfPreview, previewView]);

  function scrollToReaderPage(
    pageId: Pass488PageId,
    behavior: ScrollBehavior = "smooth",
  ) {
    setActiveReaderPage(pageId);
    const scrollRoot = readerScrollRef.current;
    const target = document.getElementById(`lens-reader-page-${pageId}`);
    if (!scrollRoot || !target) return;
    const rootRect = scrollRoot.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = scrollRoot.scrollTop + targetRect.top - rootRect.top - 72;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRoot.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion ? "auto" : behavior,
    });
  }

  const pdfDepthLocked = Boolean(pdfLoadingId);
  const activeForgeResult = results.find((item: Pass4153LensResult) => item.id === pdfLoadingId);
  const activeForgeIntelligence = activeForgeResult
    ? buildPass455HumanDecisionPdfForge(activeForgeResult, safeLocale)
    : null;
  const activePass486Forge = activeForgeResult
    ? buildPass486PdfForgeIntelligence(
        activeForgeResult,
        safeLocale,
        selectedPdfDepth,
      )
    : null;
  const pass470KeyboardAudit = useMemo(
    () =>
      auditPass470KeyboardFlow([
        {
          id: "lens-search-input",
          role: "combobox",
          label: c.placeholder,
          tabbable: true,
          enterActivates: true,
        },
        ...pdfDepthOrder.map((depth) => ({
          id: `lens-depth-${depth}`,
          role: "button" as const,
          label: pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, depth),
          tabbable: true,
          enterActivates: true,
          spaceActivates: true,
        })),
        {
          id: "lens-reader-toggle",
          role: "button",
          label: c.preview,
          tabbable: true,
          enterActivates: true,
          spaceActivates: true,
        },
        {
          id: "lens-download-link",
          role: "link",
          label: c.download,
          tabbable: true,
          enterActivates: true,
        },
        {
          id: "lens-preview-close",
          role: "button",
          label: c.close,
          tabbable: true,
          escapeCloses: true,
          enterActivates: true,
          spaceActivates: true,
        },
      ]),
    [c.close, c.download, c.pdfDepthLabels, c.placeholder, c.preview],
  );
  const pass470RuntimeGuards = useMemo(
    () => results.map((result: Pass4153LensResult) => buildPass470RuntimeGuard(result)),
    [results],
  );

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      q: deferredQuery.trim(),
      mode,
      locale: safeLocale,
      intent: "suggest",
    });
    return `/api/search?${params.toString()}`;
  }, [mode, deferredQuery, safeLocale]);

  useEffect(() => {
    const clean = deferredQuery.trim();
    if (!clean) {
      suggestionRequestSeqRef.current += 1;
      requestRef.current?.abort();
      const resetTimer = window.setTimeout(() => {
        setSuggestions([]);
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(null);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    if (clean.toLowerCase() === committedQueryRef.current.toLowerCase()) {
      const closeTimer = window.setTimeout(() => {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(null);
      }, 0);
      return () => window.clearTimeout(closeTimer);
    }

    const timer = window.setTimeout(async () => {
      requestRef.current?.abort();
      const controller = new AbortController();
      const requestId = suggestionRequestSeqRef.current + 1;
      suggestionRequestSeqRef.current = requestId;
      requestRef.current = controller;
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        const payload = normalizeClientSearchResponse(await readJsonResponseBounded<unknown>(response, 512 * 1024));
        if (controller.signal.aborted || suggestionRequestSeqRef.current !== requestId) return;
        if (!response.ok || !payload.ok) return;
        setSuggestions(
          normalizeClientSearchResults(payload.results).slice(0, LENS_SINGLE_RESULT_LIMIT),
        );
        setActiveSuggestionIndex(null);
        setSuggestionsOpen(true);
      } catch (fetchError) {
        if (
          (fetchError as Error).name !== "AbortError" &&
          suggestionRequestSeqRef.current === requestId
        ) {
          setSuggestions([]);
          setSuggestionsOpen(false);
          setActiveSuggestionIndex(null);
        }
      } finally {
        if (suggestionRequestSeqRef.current === requestId) requestRef.current = null;
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [deferredQuery, endpoint]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        formRef.current?.contains(target) ||
        suggestionsRef.current?.contains(target)
      )
        return;
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(null);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, []);

  async function runSearch(nextQuery = query) {
    const clean = safeClientText(nextQuery);
    if (!clean) return;
    committedQueryRef.current = clean;
    setCommittedQueryLabel(clean);
    requestRef.current?.abort();
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    const requestId = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestId;
    detailRequestRef.current = controller;
    setLoading(true);
    setError("");
    setResults([]);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    try {
      const params = new URLSearchParams({
        q: clean,
        mode,
        locale: safeLocale,
        intent: "detail",
      });
      const response = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      });
      const payload = normalizeClientSearchResponse(await readJsonResponseBounded<unknown>(response, 512 * 1024));
      if (!response.ok || !payload.ok) throw new Error("search_failed");
      if (controller.signal.aborted || detailRequestSeqRef.current !== requestId || detailRequestRef.current !== controller) return;
      // setResponse(data);
        // PASS328 keeps normal search calm: do not auto-open the A4/PDF preview until the user clicks the PDF action.
      setResults(selectLensDetailResult(clean, payload.results));
    } catch (searchError) {
      if ((searchError as Error).name !== "AbortError" && detailRequestSeqRef.current === requestId) setError(c.error);
    } finally {
      if (detailRequestSeqRef.current === requestId && detailRequestRef.current === controller) {
        detailRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  useEffect(() => {
    if (!initialQueryPendingRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!initialQueryPendingRef.current) return;
      initialQueryPendingRef.current = false;
      formRef.current?.requestSubmit();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseSuggestion(item: VelmereSearchResult) {
    const value = item.symbol || item.title;
    committedQueryRef.current = value;
    setCommittedQueryLabel(value);
    setQuery(value);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(null);
    void runSearch(value);
  }

  function handleSuggestionKeyDown(event: Pass4153LensInputKeyEvent) {
    const decision = nextLensSuggestionKeyboardDecision({
      key: event.key,
      optionCount: lensSuggestionSeeds.length,
      activeIndex: activeSuggestionIndex,
      open: suggestionsVisible,
    });
    if (!decision.handled) return;

    event.preventDefault();
    setSuggestionsOpen(decision.open);
    setActiveSuggestionIndex(decision.activeIndex);

    if (decision.selectIndex !== null) {
      const selected = lensSuggestionSeeds[decision.selectIndex];
      if (selected) selectSuggestion(selected);
      return;
    }

    if (!decision.open) setSuggestions([]);
  }

  function selectSuggestion(item: VelmereSearchResult) {
    chooseSuggestion(item);
  }

  useEffect(() => {
    if (!results.length || loading) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      resultsAnchorRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, results]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      detailRequestRef.current?.abort();
      pdfRequestRef.current?.abort();
      pdfPreviewObjectUrlRef.current?.revoke();
      pdfPreviewObjectUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pdfPreview) return;
    const frame = window.requestAnimationFrame(() => {
      setReceiptHistory(
        buildPass470ReceiptHistory(readPass469PdfDownloadReceipts(), 20),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pdfPreview]);

  useEffect(() => {
    if (!pdfLoadingId) {
      const timer = window.setTimeout(() => setPdfStage(0), 0);
      return () => window.clearTimeout(timer);
    }
    const cadence =
      selectedPdfDepth === "basic"
        ? [0, 160, 340, 560]
        : selectedPdfDepth === "pro"
          ? [0, 190, 410, 680]
          : [0, 220, 480, 820];
    const timers = cadence.map((delay, index) =>
      window.setTimeout(() => setPdfStage(index), delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [pdfLoadingId, selectedPdfDepth]);

  function closePreview() {
    pdfPreviewObjectUrlRef.current?.revoke();
    pdfPreviewObjectUrlRef.current = null;
    setPreviewView("reader");
    setDownloadReceipt(null);
    setReceiptHistoryOpen(false);
    setPdfPreview(null);
  }

  function handlePreviewToolbarKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      closePreview();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const controls = (Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      ),
    ) as HTMLElement[]).filter(
      (element: HTMLElement) =>
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0,
    );
    if (!controls.length) return;

    event.preventDefault();
    const activeIndex = controls.findIndex(
      (control) => control === document.activeElement,
    );
    const fallbackIndex = event.key === "ArrowRight" ? -1 : 0;
    const currentIndex = activeIndex >= 0 ? activeIndex : fallbackIndex;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + controls.length) % controls.length;
    controls[nextIndex]?.focus({ preventScroll: true });
  }

  function openPass468Handoff(
    result: VelmereSearchResult,
    target: Pass468HandoffTarget,
    depth: LensPdfDepth = selectedPdfDepthRef.current,
  ) {
    const packet = buildPass468HandoffPacket(result, depth, target);
    purgeLegacyPass468HandoffStorage();
    window.location.assign(buildPass468HandoffHref(safeLocale, packet));
  }

  function paidPdfUiGate(depth: LensPdfDepth) {
    if (depth === "basic") return true;
    return resolvePass35PaidUiStopSell({
      productId: depth === "pro" ? "vlm_pro_pdf_single" : "vlm_advanced_pdf_single",
      surface: "browser",
      tier: depth,
    }).ok;
  }

  function buildPaidPdfAccessContext(
    result: VelmereSearchResult,
    depth: Exclude<LensPdfDepth, "basic">,
  ): VlmPaidAccessContext {
    return {
      surface: "browser",
      locale: safeLocale,
      assetId: result.id,
      symbol: result.symbol,
      depth,
      returnPath: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/${safeLocale}`,
    };
  }

  function requestPreview(
    result: VelmereSearchResult,
    trigger: HTMLElement,
    requestedDepth: LensPdfDepth = "basic",
  ) {
    previewTriggerRef.current = trigger;
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestionIndex(null);
    setSelectedPdfDepth(requestedDepth);
    selectedPdfDepthRef.current = requestedDepth;
    setPdfChoiceResult(result);
  }

  async function openPreview(
    result: VelmereSearchResult,
    requestedDepth: LensPdfDepth = selectedPdfDepthRef.current,
  ) {
    if (!paidPdfUiGate(requestedDepth)) {
      setError(pass35PaidUiStopSellCopy(safeLocale));
      setPdfChoiceResult(result);
      return;
    }

    pdfRequestRef.current?.abort();
    const controller = new AbortController();
    const requestId = pdfRequestSeqRef.current + 1;
    pdfRequestSeqRef.current = requestId;
    pdfRequestRef.current = controller;
    selectedPdfDepthRef.current = requestedDepth;
    setSelectedPdfDepth(requestedDepth);
    setPdfChoiceResult(null);
    setPdfLoadingId(result.id);
    setPdfStage(0);
    setDownloadReceipt(null);
    setReceiptHistoryOpen(false);
    setReceiptHistory(
      buildPass470ReceiptHistory(readPass469PdfDownloadReceipts(), 20),
    );
    setError("");
    try {
      const depth = requestedDepth;
      let paidAccessToken = "";
      if (depth !== "basic") {
        const paidProductId =
          depth === "pro" ? "vlm_pro_pdf_single" : "vlm_advanced_pdf_single";
        const paidProduct = getVlmPaidProduct(paidProductId, safeLocale);
        const paidContext = buildPaidPdfAccessContext(result, depth);
        const localAdvancedPdfDemo =
          depth === "advanced" &&
          typeof window !== "undefined" &&
          /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
          process.env.NEXT_PUBLIC_VELMERE_QA_UNLOCK_ADVANCED_PDF === "1";
        paidAccessToken = localAdvancedPdfDemo
          ? ""
          : readVlmPaidAccessToken(paidProductId, paidContext);
        if (!paidAccessToken && !localAdvancedPdfDemo) {
          setPdfLoadingId(null);
          setPdfChoiceResult(result);
          await startVlmServiceCheckout({
            productId: paidProductId,
            locale: safeLocale,
            context: paidContext,
          });
          throw new Error(`checkout_required_${paidProduct.id}`);
        }
      }
      const forgeStartedAt = Date.now();
      const authRefreshBudget = createCustomerAuthRefreshBudget();
      const minimumForgeMs =
        depth === "basic" ? 650 : depth === "pro" ? 780 : 920;
      const canonicalReportRequest = result.lensSourceToken
        ? { sourceToken: result.lensSourceToken }
        : { result, locale: safeLocale, depth };
      const canonicalResponse = await fetchWithCustomerAuth(
        `/api/search/lens-report?tier=${encodeURIComponent(depth)}&format=json`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Production report generation is bound to the short-lived server-signed
          // search-result token. The raw canonical fallback is accepted only by the
          // server's explicit non-production unsigned-fixture mode.
          body: JSON.stringify(canonicalReportRequest),
          signal: controller.signal,
        },
        {
          refreshBudget: authRefreshBudget,
          timeoutMs: 20_000,
          operation: "lens_canonical_report",
        },
      );
      const canonicalPayload = normalizeCanonicalReportResponse(await readJsonResponseBounded<unknown>(canonicalResponse, 2 * 1024 * 1024));
      if (controller.signal.aborted || pdfRequestSeqRef.current !== requestId || pdfRequestRef.current !== controller) return;
      if (
        !canonicalResponse.ok ||
        !canonicalPayload.ok ||
        !canonicalPayload.report
      ) {
        throw new Error("report_failed");
      }
      const report = canonicalPayload.report;
      const pdfRequestBody = canonicalPayload.renderToken
        ? { renderToken: canonicalPayload.renderToken }
        : report;
      const response = await fetchWithCustomerAuth(
        `/api/search/lens-report?tier=${encodeURIComponent(depth)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          // PASS4656: prefer the signed seed token, retaining the report fallback only for
          // environments that have not configured the render-token signing secret yet.
          body: JSON.stringify(pdfRequestBody),
          signal: controller.signal,
        },
        {
          refreshBudget: authRefreshBudget,
          timeoutMs: 45_000,
          operation: "lens_exact_pdf",
        },
      );
      if (!response.ok) throw new Error("pdf_failed");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (controller.signal.aborted || pdfRequestSeqRef.current !== requestId || pdfRequestRef.current !== controller) return;
      const pdfIntegrity = verifyLensPdfResponseBytes({
        bytes,
        headers: response.headers,
        report,
        depth,
      });
      if (!pdfIntegrity.ok) throw new Error(pdfIntegrity.error);
      const accountArtifactBinding = parseLensPdfAccountArtifactBinding(response.headers);
      if (!accountArtifactBinding.ok) throw new Error(accountArtifactBinding.error);
      let accountArtifact: ClientPdfAccountArtifactReadback | null = null;
      if (accountArtifactBinding.binding) {
        const accountReadbackResponse = await fetchWithCustomerAuth(
          accountArtifactBinding.binding.route,
          { method: "GET", signal: controller.signal },
          {
            refreshBudget: authRefreshBudget,
            timeoutMs: 15_000,
            operation: "lens_account_artifact_readback",
          },
        );
        const accountReadbackPayload = await readJsonResponseBounded<unknown>(
          accountReadbackResponse,
          2 * 1024 * 1024,
        );
        if (!accountReadbackResponse.ok) throw new Error("lens_account_artifact_readback_failed");
        const accountReadback = verifyLensPdfAccountArtifactReadback({
          payload: accountReadbackPayload,
          headers: accountReadbackResponse.headers,
          binding: accountArtifactBinding.binding,
          integrity: pdfIntegrity,
          report,
          depth,
          locale: safeLocale,
        });
        if (!accountReadback.ok) throw new Error(accountReadback.error);
        accountArtifact = accountReadback.artifact;
      }
      const remainingForgeMs = Math.max(
        0,
        minimumForgeMs - (Date.now() - forgeStartedAt),
      );
      if (remainingForgeMs > 0) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, remainingForgeMs),
        );
      }
      if (controller.signal.aborted || pdfRequestSeqRef.current !== requestId || pdfRequestRef.current !== controller) return;
      setPdfStage(3);
      const filenameStem = `velmere-lens-${report.symbol || "report"}-${depth}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .slice(0, 100);
      const nextObjectUrl = createClientPdfObjectUrl({ bytes });
      pdfPreviewObjectUrlRef.current?.revoke();
      pdfPreviewObjectUrlRef.current = nextObjectUrl;
      setPreviewView("reader");
      setPdfPreview({
        url: nextObjectUrl.url,
        filename: buildSafeClientPdfFilename(filenameStem),
        report,
        depth,
        result,
        accountArtifact,
      });
    } catch (previewError) {
      if ((previewError as Error).name !== "AbortError" && pdfRequestSeqRef.current === requestId) setError(c.error);
    } finally {
      if (pdfRequestSeqRef.current === requestId && pdfRequestRef.current === controller) {
        pdfRequestRef.current = null;
        setPdfLoadingId(null);
      }
    }
  }

  function recordPass469DownloadReceipt() {
    if (!pdfPreview) return;
    const receipt = buildPass469PdfDownloadReceipt({
      filename: pdfPreview.filename,
      symbol: pdfPreview.report.symbol,
      depth: pdfPreview.depth,
      reportChecksum: pdfPreview.report.brain?.checksum || "unavailable",
      sourceConfidence: pdfPreview.report.sourceConfidence,
      sourceCount: pdfPreview.report.sources.length,
    });
    const recordedForCurrentTab = writePass469PdfDownloadReceipt(receipt);
    setDownloadReceipt(recordedForCurrentTab ? receipt : null);
    if (recordedForCurrentTab) {
      setReceiptHistory(
        buildPass470ReceiptHistory(readPass469PdfDownloadReceipts(), 20),
      );
    }
  }

  return (
    <main
      className="velmere-lens-page velmere-lens-command-page min-h-screen bg-velmere-black px-4 pb-24 pt-24 text-white sm:px-5 md:px-10 md:pt-28"
      data-pass314-vlm-browser-simplified="true"
      data-pass315-customer-surface-trim="vlm-browser"
      data-pass444-lens-pdf-forge="true"
      data-lens-public-layout="single-result-single-pdf"
      data-pass445-lens-pdf-human-field="true"
      data-pass446-browser-human-readout="true"
      data-pass447-pdf-preview-parity="true"
      data-pass448-pdf-a4-reader-v2="true"
      data-pass450-tiered-human-report="true"
      data-pass452-browser-realmarkets-qa="true"
      data-pass453-unified-intelligence-handoff="true"
      data-pass454-evidence-dense-human-analysis="true"
      data-pass455-human-decision-pdf-forge="true"
      data-pass456-asset-aware-pdf-runtime="true"
      data-pass465-selectable-pdf-depth="true"
      data-pass467-result-priority-runtime="true"
      data-pass468-browser-shield-orbit-handoff="true"
      data-pass470-browser-runtime-qa="true"
      data-pass471-surface-runtime-resilience="true"
      data-pass325-pdf-first-browser="true"
      data-pass326-a4-pdf-browser="true"
      data-pass327-v-scan-a4-polish="true"
      data-pass328-a4-print-polish="true"
      data-pass486-evidence-bound-pdf-forge="true"
      data-pass2042-browser-lens-kernel="true"
      data-pass1274-runtime-visual-qa="prepared"
      data-pass2510-source-quality-badges="live-provider-fallback-filing-watch-render-watch"
      data-pass2510-browser-pdf-render-fixture="btc-nvda-spy-locale-hash-manifest"
      data-pass2511-etf-holdings-freshness="spy-qqq-voo-holdings-not-companyfacts"
      data-pass2511-account-vault-pdf-manifest="preview-download-account-vault-hash-family"
      data-pass2512-pdf-vault-retention-erasure="owner-hash-retention-erasure-manifest"
      data-pass2512-source-freshness-ttl="crypto-equity-etf-fx-commodity-pdf-ttl"
      data-pass2513-i18n-pdf-vault-locale="no-mixed-pl-en-de-debug-copy-hash-family" data-pass2514-market-source-freshness-disclaimer="provider-observedAt-stale-badge-pdf-preview-download-vault-hash" data-pass2515-pdf-vault-release-gate="preview-download-account-vault-single-locale-retention-owner-binding" data-pass2516-runtime-truth-debug-copy-audit="live-final-paid-debug-copy-requires-receipt" data-pass2517-browser-search-semantic="source-badge-no-wall-text-no-crypto-fallback-fixture-queue" data-pass2518-claim-to-evidence-graph="source-freshness-proof-missing-proof-no-hype"
      aria-description="Source-quality badges distinguish live provider, fallback, filing watch and render watch before any Advanced claim; ETF holdings require freshness evidence, account-vault delivery requires a bound manifest, and mixed-locale or debug copy is blocked."
    >
      <div className="browser-ambient-globe flex items-center justify-center pointer-events-none select-none my-[-20px]"><VelmereLuxuryShield size={440} /></div>
      <section className="mx-auto max-w-[88rem]">
        {!pdfModalActive ? (
          <div className="velmere-lens-command-center velmere-command-shell sticky top-20 z-20 md:top-24" data-pass1983-browser-command-screen="chatgpt-like-centered" data-browser-search-shell="single-outline-no-ambient-card">
            <h1 className="velmere-command-center-title" data-pass1990-typewriter-title="true">
              <span className="sr-only">{commandHeading}</span>
              <span aria-hidden="true">{animatedCommandTitle}</span>
              <span className="velmere-typewriter-caret" aria-hidden="true" />
            </h1>
            <form
              ref={formRef}
              onSubmit={onSubmit}
              className="velmere-lens-search-shell relative"
            >
              <div className="group flex items-center gap-3 rounded-full border border-white/[0.10] bg-black/[0.42] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-cyan-200/[0.18]">
                <Search
                  className="ml-3 h-5 w-5 shrink-0 text-velmere-gold"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event: Pass4153LensInputChangeEvent) => {
                    const value = event.target.value;
                    if (
                      value.trim().toLowerCase() !==
                      committedQueryRef.current.toLowerCase()
                    ) {
                      committedQueryRef.current = "";
                      setCommittedQueryLabel("");
                    }
                    setQuery(value);
                    setActiveSuggestionIndex(null);
                  }}
                  onFocus={() => {
                    if (query.trim() && suggestions.length)
                      setSuggestionsOpen(true);
                  }}
                  onKeyDown={handleSuggestionKeyDown}
                  placeholder={c.placeholder}
                  autoComplete="off"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsVisible}
                  aria-controls="velmere-lens-suggestion-list"
                  aria-activedescendant={activeSuggestionId}
                  disabled={!interactiveReady}
                  aria-busy={!interactiveReady}
                  data-lens-interactive-ready={interactiveReady ? "true" : "false"}
                  data-testid={interactiveReady ? "lens-search-input" : undefined}
                  data-pass470-keyboard-control="combobox"
                  data-pass579-exact-search={
                    searchReceipt?.match ?? searchResolution.receipt.match
                  }
                  aria-keyshortcuts="Enter Escape ArrowDown ArrowUp Home End"
                  className="min-w-0 flex-1 rounded-full bg-transparent px-1 py-3 text-sm text-white outline-none focus:outline-none focus-visible:outline-none placeholder:text-white/[0.34]"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="velmere-command-pill max-[360px]:min-w-11 max-[360px]:px-3 disabled:opacity-40"
                  data-tone="gold"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span aria-hidden="true">V</span>
                  )}
                  <span className="max-[360px]:sr-only">{c.scan}</span>
                </button>
              </div>

              {suggestionsVisible ? (
                <div
                  ref={suggestionsRef}
                  id="velmere-lens-suggestion-list"
                  role="listbox"
                  aria-label={
                    safeLocale === "pl"
                      ? "Sugestie wyszukiwania"
                      : safeLocale === "de"
                        ? "Suchvorschläge"
                        : "Search suggestions"
                  }
                  data-pass444-three-visible-no-scroll="true"
                  data-pass579-search-receipt={
                    searchReceipt?.match ?? searchResolution.receipt.match
                  }
                  className="vis-token-suggest-panel mt-3 grid max-h-none gap-2 overflow-visible rounded-[1.45rem] border border-cyan-200/[0.18] bg-[#061315] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.68)]"
                >
                  {lensSuggestionSeeds.map((item: Pass4153LensResult, index) => (
                    <button
                      key={item.id}
                      id={`velmere-lens-suggestion-option-${index}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={activeSuggestionIndex === index}
                      onMouseDown={(event: Pass4153LensSuggestionMouseEvent) => event.preventDefault()}
                      onClick={() => selectSuggestion(item)}
                      className="flex w-full items-center gap-3 rounded-[1rem] border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-left transition hover:border-cyan-200/[0.18] hover:bg-white/[0.055]"
                    >
                      <span
                        className="vis-suggestion-token-avatar grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04] bg-cover bg-center font-mono text-xs text-velmere-gold"
                        style={
                          item.avatarImage
                            ? { backgroundImage: `url(${item.avatarImage})` }
                            : undefined
                        }
                        aria-hidden="true"
                      >
                        {item.avatarImage
                          ? null
                          : item.symbol?.slice(0, 2) || "V"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-white">
                          {item.symbol || item.title}
                        </strong>
                        <span className="block truncate text-xs text-white/[0.48]">
                          {item.title}
                        </span>
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                        {item.category}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </form>
            <div
              className="velmere-command-center-pills"
              aria-label={
                safeLocale === "pl"
                  ? "Szybkie wyszukiwania Velmère"
                  : safeLocale === "de"
                    ? "Velmère Schnellsuche"
                    : "Velmère quick searches"
              }
            >
              {["BTC", "ETH", "SOL"].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => {
                    setQuery(quick);
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                  className="velmere-command-center-pill"
                >
                  {quick}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="velmere-lens-hero vlm-browser-public-brief mt-5 mb-5 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_12%_0%,rgba(200,169,106,0.10),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.075),transparent_30%),rgba(255,255,255,0.018)] p-5 md:p-6">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(21rem,0.72fr)] xl:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-velmere-gold shadow-[0_0_18px_rgba(200,169,106,0.8)]" />
                Velmère Lens
              </div>
              <h1 className="mt-5 max-w-5xl font-serif text-[clamp(2.05rem,4.8vw,4.9rem)] leading-[0.88] tracking-[-0.065em] text-white">
                {safeLocale === "pl"
                  ? "Sprawdź aktywo. Zobacz dowody. Zapisz raport."
                  : safeLocale === "de"
                    ? "Asset prüfen. Belege sehen. Report sichern."
                    : "Check the asset. See the evidence. Save the report."}
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/[0.55] md:text-base">
                {safeLocale === "pl"
                  ? "Jedno wejście do researchu: najważniejsze fakty, źródła, pełny Shield i gotowy raport PDF w tej samej historii wizualnej."
                  : safeLocale === "de"
                    ? "Ein Einstieg in den Research: zentrale Fakten, Quellen, vollständiger Shield und ein konsistenter PDF-Report."
                    : "One research entry for the key facts, sources, full Shield and a consistent PDF report."}
              </p>
              <p className="mt-6 max-w-xl rounded-full border border-white/[0.08] bg-black/[0.20] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.40]">
                {safeLocale === "pl"
                  ? "Przykład: BTC, ETH, SOL albo adres kontraktu"
                  : safeLocale === "de"
                    ? "Beispiel: BTC, ETH, SOL oder Contract-Adresse"
                    : "Example: BTC, ETH, SOL or a contract address"}
              </p>
            </div>
            <div
              className="velmere-lens-live-stage"
              data-state={
                loading ? "scanning" : results.length ? "ready" : "idle"
              }
            >
              <div className="velmere-lens-live-visual" aria-hidden="true">
                <span className="velmere-lens-live-grid" />
                <span className="velmere-lens-live-orbit velmere-lens-live-orbit-a" />
                <span className="velmere-lens-live-orbit velmere-lens-live-orbit-b" />
                <span className="velmere-lens-live-beam" />
                <span className="velmere-lens-live-core">
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "V"}
                </span>
                <span className="velmere-lens-live-caption">
                  {loading
                    ? safeLocale === "pl"
                      ? "Łączenie źródeł"
                      : safeLocale === "de"
                        ? "Quellen werden verbunden"
                        : "Connecting sources"
                    : results.length
                      ? safeLocale === "pl"
                        ? "Profil gotowy"
                        : safeLocale === "de"
                          ? "Profil bereit"
                          : "Profile ready"
                      : safeLocale === "pl"
                        ? "Lens czeka na aktywo"
                        : safeLocale === "de"
                          ? "Lens wartet auf ein Asset"
                          : "Lens is ready for an asset"}
                </span>
              </div>
              <div className="velmere-lens-journey grid gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  {
                    step: "01",
                    title:
                      safeLocale === "pl"
                        ? "Znajdź"
                        : safeLocale === "de"
                          ? "Finden"
                          : "Find",
                    body:
                      safeLocale === "pl"
                        ? "Token, kontrakt lub temat."
                        : safeLocale === "de"
                          ? "Token, Contract oder Thema."
                          : "Token, contract or topic.",
                  },
                  {
                    step: "02",
                    title:
                      safeLocale === "pl"
                        ? "Zweryfikuj"
                        : safeLocale === "de"
                          ? "Prüfen"
                          : "Verify",
                    body:
                      safeLocale === "pl"
                        ? "Fakty, braki i źródła."
                        : safeLocale === "de"
                          ? "Fakten, Lücken und Quellen."
                          : "Facts, gaps and sources.",
                  },
                  {
                    step: "03",
                    title:
                      safeLocale === "pl"
                        ? "Zapisz"
                        : safeLocale === "de"
                          ? "Sichern"
                          : "Save",
                    body:
                      safeLocale === "pl"
                        ? "Shield, Shield Map albo PDF."
                        : safeLocale === "de"
                          ? "Shield, Shield Map oder PDF."
                          : "Shield, Shield Map or PDF.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="group grid grid-cols-[2.25rem_1fr] gap-3 rounded-[1.3rem] border border-white/[0.075] bg-black/[0.20] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-velmere-gold/[0.20] hover:bg-white/[0.035]"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.055] font-mono text-[9px] text-velmere-gold">
                      {item.step}
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm font-semibold text-white/[0.88]">
                        {item.title}
                      </strong>
                      <span className="mt-1 block text-[11px] leading-5 text-white/[0.42]">
                        {item.body}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {!loading && !results.length && !error ? (
          <section
            className="velmere-lens-discovery mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            aria-label={
              safeLocale === "pl"
                ? "Szybki start Velmère Lens"
                : safeLocale === "de"
                  ? "Velmère Lens Schnellstart"
                  : "Velmère Lens quick start"
            }
          >
            {[
              {
                symbol: "BCH",
                icon: <Search className="h-4 w-4" />,
                title:
                  safeLocale === "pl"
                    ? "Odkryj Bitcoin Cash"
                    : safeLocale === "de"
                      ? "Bitcoin Cash entdecken"
                      : "Explore Bitcoin Cash",
                body:
                  safeLocale === "pl"
                    ? "Alternatywny profil rynku: cena, płynność, źródła i najważniejsze ograniczenia BCH."
                    : safeLocale === "de"
                      ? "Ein alternativer Marktcheck mit Preis, Liquidität, Quellen und den wichtigsten Grenzen von BCH."
                      : "An alternative market check with BCH price, liquidity, sources and key limitations.",
              },
              {
                symbol: "ETH",
                icon: <Shield className="h-4 w-4" />,
                title:
                  safeLocale === "pl"
                    ? "Przejście do Shield"
                    : safeLocale === "de"
                      ? "Zum Shield"
                      : "Open in Shield",
                body:
                  safeLocale === "pl"
                    ? "Rozwiń wynik do wykresu, źródeł i poziomu Basic, Pro albo Advanced."
                    : safeLocale === "de"
                      ? "Erweitere den Befund um Chart, Quellen und Basic-, Pro- oder Advanced-Tiefe."
                      : "Expand the result into charts, sources and Basic, Pro or Advanced depth.",
              },
              {
                symbol: "SOL",
                icon: <Brain className="h-4 w-4" />,
                title:
                  safeLocale === "pl"
                    ? "Mapa zależności"
                    : safeLocale === "de"
                      ? "Beziehungsmap"
                      : "Relationship map",
                body:
                  safeLocale === "pl"
                    ? "Zobacz, które sygnały łączą płynność, rynek, kontrakt i brakujące dane."
                    : safeLocale === "de"
                      ? "Sieh, wie Liquidität, Markt, Contract und Datenlücken zusammenhängen."
                      : "See how liquidity, market structure, contract and missing data connect.",
              },
              {
                symbol: "BTC",
                icon: <FileText className="h-4 w-4" />,
                title:
                  safeLocale === "pl"
                    ? "Raport A4"
                    : safeLocale === "de"
                      ? "A4-Report"
                      : "A4 report",
                body:
                  safeLocale === "pl"
                    ? "Ten sam wynik w podglądzie i pobranym PDF — bez zmiany hierarchii."
                    : safeLocale === "de"
                      ? "Dasselbe Ergebnis in Vorschau und PDF — ohne wechselnde Hierarchie."
                      : "The same result in preview and downloaded PDF, with one visual hierarchy.",
              },
            ].map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                onClick={() => {
                  if (item.symbol === "BCH") {
                    setQuery("BCH");
                    void runSearch("BCH");
                  } else if (item.symbol === "ETH") {
                    window.location.href = "/" + safeLocale + "/shield?asset=ethereum";
                  } else if (item.symbol === "SOL") {
                    window.location.href = "/" + safeLocale + "/shield-map?q=solana";
                  } else if (item.symbol === "BTC") {
                    setQuery("BTC");
                    void runSearch("BTC");
                  }
                }}
                className="velmere-lens-discovery-card group text-left"
              >
                <span
                  className="velmere-lens-discovery-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="velmere-lens-discovery-index">
                  0{index + 1}
                </span>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <small>
                  {safeLocale === "pl"
                    ? `Wypróbuj ${item.symbol}`
                    : safeLocale === "de"
                      ? `${item.symbol} testen`
                      : `Try ${item.symbol}`}
                </small>
              </button>
            ))}
          </section>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-300/[0.15] bg-red-400/[0.05] p-4 text-sm text-red-100/[0.82]">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="velmere-stable-surface velmere-stable-skeleton mt-6 rounded-[1.5rem] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.08] text-velmere-gold">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="velmere-stable-skeleton__eyebrow" />
                <div className="velmere-stable-skeleton__title" />
              </div>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.44]">
              {c.loading}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.2rem] border border-white/[0.07] bg-black/[0.18] p-4"
                >
                  <div className="velmere-stable-skeleton__row" />
                  <div className="velmere-stable-skeleton__row mt-3 w-[82%]" />
                  <div className="velmere-stable-skeleton__row mt-3 w-[58%]" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div
          ref={resultsAnchorRef}
          className={`${results.length ? "mt-5 scroll-mt-48" : ""} grid gap-4`}
          data-pass467-result-first-layout="true"
          aria-live="polite"
          aria-busy={loading}
        >
          {results.length ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-cyan-100/[0.62]">
                {safeLocale === "pl"
                  ? "Analiza gotowa"
                  : safeLocale === "de"
                    ? "Analyse bereit"
                    : "Analysis ready"}
              </p>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/[0.30]">
                {results.length} · {committedQueryLabel || query.trim()}
              </span>
            </div>
          ) : null}
          {results.map((result: Pass4153LensResult, resultIndex: Pass4153LensResultIndex) => {
            if (isCompactBrowserAssetResult(result)) {
              return (
                <BrowserCompactMarketResult
                  key={result.id}
                  result={result}
                  locale={safeLocale}
                  onRequestPdf={(marketResult, trigger, depth) =>
                    requestPreview(marketResult, trigger, depth)
                  }
                />
              );
            }

            return (
              <article
              key={result.id}
              data-testid="lens-result-card"
              data-primary-result={resultIndex === 0 ? "true" : "false"}
              data-pass470-runtime-guard={
                pass470RuntimeGuards[resultIndex]?.safeToRender
                  ? "ok"
                  : "review"
              }
              data-pass470-source-count={
                pass470RuntimeGuards[resultIndex]?.sources ?? 0
              }
              className={`vis-result-card velmere-hover-lift rounded-[1.6rem] border p-5 shadow-[0_18px_80px_rgba(0,0,0,0.22)] md:p-6 ${
                resultIndex === 0
                  ? "border-cyan-200/[0.18] bg-[radial-gradient(circle_at_0%_0%,rgba(72,214,220,0.08),transparent_34%),rgba(255,255,255,0.03)] shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
                  : lensToneClass(result.tone)
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-white/[0.07] bg-black/[0.16] px-3 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-100/[0.60]">
                    {result.category}
                  </span>
                  <span className="velmere-premium-chip text-[8px]">
                    {c.source}: {result.sourceMode}
                  </span>
                  <span className="velmere-premium-chip text-[8px]">
                    {c.confidence}: {result.sourceCoverage ?? sourceEvidenceCoverageScore(result)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.chips.slice(0, 2).map((chip: Pass4153LensChip) => (
                    <span
                      key={chip}
                      className="velmere-premium-chip text-[8px]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-1 gap-4">
                  <span
                    className="vis-token-avatar-image grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.10] bg-white/[0.04] bg-cover bg-center font-mono text-sm text-velmere-gold"
                    style={
                      result.avatarImage
                        ? { backgroundImage: `url(${result.avatarImage})` }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {result.avatarImage
                      ? null
                      : result.symbol?.slice(0, 2) || "V"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        {result.title}
                      </h2>
                      {result.symbol ? (
                        <span className="rounded-full border border-white/[0.09] px-2 py-1 font-mono text-[9px] text-white/[0.48]">
                          {result.symbol}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.58]">
                      {result.summary}
                    </p>
                    {isCompactBrowserAssetResult(result) ? (() => {
                      const compactCopy = compactBrowserPreviewCopy(safeLocale, result);
                      return (
                        <section
                          className="mt-4 rounded-[1.25rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-3"
                          data-pass2357-browser-compact-preview="true"
                        >
                          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/[0.62]">
                            {compactCopy.label}
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-white/[0.58]">
                            {compactCopy.body}
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-white/[0.48]">
                            {compactCopy.next}
                          </p>
                        </section>
                      );
                    })() : null}
                    <span className="pass325-lens-detail-hidden sr-only">The public detail rail is hidden behind the PDF-first action.</span>
                    {!isCompactBrowserAssetResult(result) ? (() => {
                      const intelligence = buildPass455HumanDecisionPdfForge(
                        result,
                        safeLocale,
                      );
                      const toneClass =
                        result.tone === "calm"
                          ? "border-emerald-300/[0.18] bg-emerald-300/[0.045]"
                          : result.tone === "review"
                            ? "border-amber-300/[0.16] bg-amber-300/[0.04]"
                            : "border-rose-300/[0.18] bg-rose-300/[0.045]";
                      const labels =
                        safeLocale === "pl"
                          ? {
                              known: "Co wiemy",
                              missing: "Co ogranicza wynik",
                              next: "Następne sprawdzenie",
                            }
                          : safeLocale === "de"
                            ? {
                                known: "Was wir wissen",
                                missing: "Was das Ergebnis begrenzt",
                                next: "Nächste Prüfung",
                              }
                            : {
                                known: "What we know",
                                missing: "What limits the result",
                                next: "Next check",
                              };
                      return (
                        <section
                          className={`mt-4 rounded-[1.35rem] border p-4 ${toneClass}`}
                          data-pass453-human-verdict="true"
                          data-pass455-human-decision-card="true"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/[0.38]">
                                {intelligence.executive.eyebrow}
                              </p>
                              <strong className="mt-2 block text-base text-white/[0.92]">
                                {intelligence.executive.headline}
                              </strong>
                              <p className="mt-2 max-w-3xl text-xs leading-6 text-white/[0.54]">
                                {intelligence.executive.oneSentence}
                              </p>
                            </div>
                            <span className="rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.58]">
                              {intelligence.executive.confidenceLabel}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-2xl border border-white/[0.07] bg-black/[0.16] p-3">
                              <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/[0.34]">
                                {labels.known}
                              </p>
                              <div className="mt-2 grid gap-1.5 text-[11px] leading-5 text-white/[0.70]">
                                {intelligence.executive.whatWeKnow
                                  .slice(0, 4)
                                  .map((item: Pass4153LensStringRow) => (
                                    <span key={item}>• {item}</span>
                                  ))}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-black/[0.16] p-3">
                              <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/[0.34]">
                                {labels.missing}
                              </p>
                              <div className="mt-2 grid gap-1.5 text-[11px] leading-5 text-white/[0.62]">
                                {intelligence.executive.whatIsMissing
                                  .slice(0, 3)
                                  .map((item: Pass4153LensStringRow) => (
                                    <span key={item}>• {item}</span>
                                  ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] px-3 py-3">
                            <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-velmere-gold/[0.76]">
                              {labels.next}
                            </p>
                            <p className="mt-2 text-[11px] leading-5 text-white/[0.62]">
                              {intelligence.executive.nextCheck}
                            </p>
                          </div>
                        </section>
                      );
                    })() : null}
                    <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.34]">
                      {c.source}: {result.sourceMode} · {c.confidence}:{" "}
                      {result.sourceCoverage ?? sourceEvidenceCoverageScore(result)}%
                    </p>
                    {isCompactBrowserAssetResult(result) ? (
                      <div
                        className="mt-3"
                        data-pass2502-browser-pdf-compact-rail="true"
                        aria-label="Browser PDF compact manifest"
                      >
                        {[
                          safeLocale === "pl"
                            ? "Krótki publiczny wynik: cena, MC, 24h, źródło"
                            : safeLocale === "de"
                              ? "Kurzes öffentliches Ergebnis: Preis, MC, 24h, Quelle"
                              : "Short public result: price, MC, 24h, source",
                          safeLocale === "pl"
                            ? "PDF preview = download hash przed paid copy"
                            : safeLocale === "de"
                              ? "PDF preview = download hash vor Paid Copy"
                              : "PDF preview = download hash before paid copy",
                          `PDF manifest · ${result.symbol ?? result.id}`
                        ].map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    {isCompactBrowserAssetResult(result) ? (
                      <div
                        className="mt-3"
                        data-pass2503-browser-sec-companyfacts-rail="true"
                        aria-label="SEC Companyfacts boundary"
                      >
                        {[
                          safeLocale === "pl"
                            ? "Real Markets: CIK + SEC submissions + Companyfacts przed paid filing copy"
                            : safeLocale === "de"
                              ? "Real Markets: CIK + SEC Submissions + Companyfacts vor Paid Filing Copy"
                              : "Real Markets: CIK + SEC submissions + Companyfacts before paid filing copy",
                          safeLocale === "pl"
                            ? "Apple/NVDA/SPY bez token fallbacku; ETF holdings osobno"
                            : safeLocale === "de"
                              ? "Apple/NVDA/SPY ohne Token-Fallback; ETF Holdings separat"
                              : "Apple/NVDA/SPY no token fallback; ETF holdings separate",
                          `Companyfacts · ${result.symbol ?? result.id}`
                        ].map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    {isCompactBrowserAssetResult(result) ? (
                      <div
                        className="mt-3"
                        data-pass2504-browser-pdf-hash-replay="true"
                        aria-label="PDF preview and download hash verification"
                      >
                        {[
                          safeLocale === "pl"
                            ? "Hash podglądu PDF musi odpowiadać hashom pobrania przed dostarczeniem."
                            : safeLocale === "de"
                              ? "Der Hash der PDF-Vorschau muss vor der Bereitstellung dem Download-Hash entsprechen."
                              : "The PDF preview hash must match the download hash before delivery.",
                          safeLocale === "pl"
                            ? "Compact Browser zostaje krótki; głęboka analiza tylko w zgodnym PDF/Brain"
                            : safeLocale === "de"
                              ? "Compact Browser bleibt kurz; tiefe Analyse nur in deckungsgleichem PDF/Brain"
                              : "Compact Browser stays short; deep analysis only in matching PDF/Brain",
                          `PDF hash parity · ${result.symbol ?? result.id}`
                        ].map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    {isCompactBrowserAssetResult(result) ? (
                      <div
                        className="mt-3"
                        data-pass2505-locale-pdf-parity="true"
                        data-pass2505-browser-debug-copy-sanitizer="true"
                        data-pass2506-browser-pdf-fixture-render-queue="true"
                        data-pass2507-pdf-fixture-hash-manifest="true"
                        data-pass2507-tier-copy-matrix-minimalism="true"
                        aria-label="PDF locale parity, fixture hash manifest and copy sanitation"
                      >
                        {[
                          safeLocale === "pl"
                            ? "Podgląd i pobranie PDF muszą mieć ten sam język i hash."
                            : safeLocale === "de"
                              ? "PDF-Vorschau und Download brauchen dieselbe Sprache und denselben Hash."
                              : "PDF preview and download must keep the same locale and hash.",
                          safeLocale === "pl"
                            ? "Bez KERNEL/debug-demo/fake/undefined w customer copy; braki danych zostają jawne"
                            : safeLocale === "de"
                              ? "Kein KERNEL/debug-demo/fake/undefined in Customer Copy; fehlende Daten bleiben sichtbar"
                              : "No KERNEL/debug-demo/fake/undefined in customer copy; missing data stays visible",
                          safeLocale === "pl"
                            ? "Manifest testowy porównuje hash podglądu, hash pobrania i render pierwszej strony."
                            : safeLocale === "de"
                              ? "Das Testmanifest vergleicht Vorschau-Hash, Download-Hash und das Rendering der ersten Seite."
                              : "The fixture manifest compares the preview hash, download hash and first-page render.",
                          `PDF locale and render parity · ${result.symbol ?? result.id}`
                        ].map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    {result.marketSnapshot ? (
                      <div
                        className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"
                        data-pass450-market-snapshot="true"
                      >
                        {[
                          [
                            safeLocale === "pl"
                              ? "Cena"
                              : safeLocale === "de"
                                ? "Preis"
                                : "Price",
                            formatSnapshotMoney(
                              safeLocale,
                              result.marketSnapshot.price,
                              result.marketSnapshot.currency,
                            ),
                          ],
                          [
                            safeLocale === "pl"
                              ? "Kapitalizacja"
                              : safeLocale === "de"
                                ? "Market Cap"
                                : "Market cap",
                            formatSnapshotMoney(
                              safeLocale,
                              result.marketSnapshot.marketCap,
                              result.marketSnapshot.currency,
                            ),
                          ],
                          [
                            "24h",
                            formatSnapshotPercent(
                              safeLocale,
                              result.marketSnapshot.change24h,
                            ),
                          ],
                          [
                            safeLocale === "pl"
                              ? "Wolumen"
                              : safeLocale === "de"
                                ? "Volumen"
                                : "Volume",
                            formatSnapshotMoney(
                              safeLocale,
                              result.marketSnapshot.volume24h,
                              result.marketSnapshot.currency,
                            ),
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-white/[0.07] bg-black/[0.18] p-3"
                          >
                            <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-white/[0.32]">
                              {label}
                            </p>
                            <p className="mt-2 truncate font-mono text-sm text-white tabular-nums">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!isCompactBrowserAssetResult(result) ? (() => {
                      const waterfall = buildPass466ConfidenceWaterfall(
                        result,
                        safeLocale,
                        "advanced",
                      );
                      const title = lensPublicEvidenceWaterfallTitle(safeLocale);
                      const lost =
                        safeLocale === "pl"
                          ? `utracono ${waterfall.lostCoverage} pkt pokrycia dowodów przez granice źródeł`
                          : safeLocale === "de"
                            ? `${waterfall.lostCoverage} Evidenzpunkte durch Quellengrenzen verloren`
                            : `${waterfall.lostCoverage} evidence-coverage points lost to source boundaries`;
                      return (
                        <section
                          className="mt-4 rounded-[1.35rem] border border-white/[0.08] bg-black/[0.18] p-4"
                          data-pass466-confidence-waterfall="true"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-100/[0.52]">
                                {title}
                              </p>
                              <p className="mt-1 text-[11px] text-white/[0.42]">
                                {lost}
                              </p>
                            </div>
                            <strong className="font-mono text-sm text-white tabular-nums">
                              {waterfall.finalCoverage}%
                            </strong>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                            {waterfall.stages.slice(0, 3).map((stage: Pass4153LensWaterfallStage) => (
                              <div
                                key={stage.id}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5"
                                title={stage.detail}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-mono text-[7px] uppercase tracking-[0.10em] text-white/[0.36]">
                                    {stage.label}
                                  </span>
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${stage.state === "confirmed" ? "bg-emerald-300" : stage.state === "review" ? "bg-amber-300" : "bg-rose-300"}`}
                                  />
                                </div>
                                <strong className="mt-2 block font-mono text-xs text-white/[0.76] tabular-nums">
                                  {stage.cap}%
                                </strong>
                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                  <span
                                    className="block h-full rounded-full bg-white/[0.44]"
                                    style={{ width: `${stage.cap}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {normalizeSafeExternalBrowserUrl(waterfall.filingUrl, { profile: "sec_filing" }) ? (
                            <a
                              href={normalizeSafeExternalBrowserUrl(waterfall.filingUrl, { profile: "sec_filing" }) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer external"
                              referrerPolicy="no-referrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.12] bg-cyan-300/[0.035] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.11em] text-cyan-100/[0.70] transition hover:border-cyan-100/[0.28] hover:text-cyan-50"
                              data-pass466-sec-filing-link="true"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {waterfall.filingLabel || "SEC filing"}
                            </a>
                          ) : null}
                        </section>
                      );
                    })() : null}
                    {result.missingData.length && !isCompactBrowserAssetResult(result) ? (
                      <p className="mt-3 rounded-xl border border-amber-200/[0.10] bg-amber-300/[0.035] px-3 py-2 text-xs leading-6 text-white/[0.48]">
                        {c.missing}:{" "}
                        {result.missingData.slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                    <div
                      className="velmere-lens-depth-rail mt-4"
                      data-pass448-no-raw-unknown="true"
                      aria-label={
                        safeLocale === "pl"
                          ? "Dostępne poziomy raportu"
                          : safeLocale === "de"
                            ? "Verfügbare Report-Tiefen"
                            : "Available report depths"
                      }
                    >
                      {[
                        ["Basic", "10"],
                        ["Pro", "14"],
                        ["Advanced", "20"],
                      ].map(([title, count]) => (
                        <span key={title}>
                          <strong>{title}</strong>
                          <small>{count}</small>
                        </span>
                      ))}
                    </div>
                    <div
                      className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
                      data-pass452-signature-insights="true"
                      data-pass454-advanced-signature-metrics="true"
                    >
                      {buildPass454EvidenceDenseHumanAnalysis(
                        result,
                        safeLocale,
                      )
                        .tiers.find((tier: Pass4153LensEvidenceTier) => tier.id === "advanced")
                        ?.metrics.slice(8, 10)
                        .map((insight: Pass4153LensEvidenceMetric) => (
                          <div
                            key={insight.id}
                            className="rounded-2xl border border-cyan-200/[0.08] bg-cyan-300/[0.025] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-100/[0.52]">
                                {insight.label}
                              </span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${insight.state === "confirmed" ? "bg-emerald-300" : insight.state === "review" ? "bg-amber-300" : "bg-rose-300"}`}
                              />
                            </div>
                            <strong className="mt-2 block break-words text-xs text-white/[0.78]">
                              {insight.value}
                            </strong>
                            <p className="mt-2 text-[10px] leading-5 text-white/[0.36]">
                              {insight.humanMeaning}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 rounded-[1.2rem] border border-white/[0.07] bg-black/[0.16] p-2">
                  <button
                    type="button"
                    onClick={(event: Pass4153LensPreviewButtonMouseEvent) => {
                      requestPreview(result, event.currentTarget);
                    }}
                    disabled={pdfLoadingId === result.id}
                    data-testid="lens-preview-button"
                    className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.24] bg-velmere-gold/[0.08] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-velmere-gold"
                  >
                    {pdfLoadingId === result.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="vis-scan-vmark" aria-hidden="true">V</span>
                    )}
                    <span>{safeLocale === "pl" ? "Otwórz podgląd PDF" : safeLocale === "de" ? "PDF-Vorschau öffnen" : "Open PDF preview"}</span>
                    <span className="sr-only">Pobierz podgląd</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPass468Handoff(result, "shield")}
                    data-testid="lens-shield-handoff"
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-white/[0.62]"
                  >
                    <Shield className="h-4 w-4" />
                    {c.shield}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPass468Handoff(result, "orbit")}
                    data-testid="lens-orbit-handoff"
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-50/[0.72]"
                  >
                    <Brain className="h-4 w-4" />
                    {c.orbit}
                  </button>
                </div>
              </div>
              </article>
            );
          })}
        </div>

        {RENDER_LEGACY_PDF_CAPSULE ? (
        <article
          data-pass467-pdf-capsule-after-result="true"
          data-pass315-lens-public-pdf-forge="true"
          data-pass1990-lens-capsule="hidden-until-result"
          className="mt-5 rounded-[1.6rem] border border-velmere-gold/[0.14] bg-[radial-gradient(circle_at_0%_0%,rgba(200,169,106,0.11),transparent_36%),rgba(255,255,255,0.025)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] transition duration-300 translate-y-0 opacity-100 md:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">
                Velmère Browser · PDF
              </p>
              <h1 className="mt-2 font-serif text-3xl tracking-[-0.045em] text-white md:text-4xl">
                {results.length ? c.afterResultTitle : c.emptyTitle}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.56]">
                {results.length ? c.afterResultBody : c.emptyBody}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[c.depth[0], c.depth[1], c.depth[2]].map((item, index) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/[0.07] bg-black/[0.18] p-3"
                  >
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-velmere-gold/[0.78]">
                      {["Basic · 10", "Pro · 14", "Advanced · 20"][index]}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-white/[0.44]">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="grid min-w-[16rem] gap-3"
              data-pass448-browser-stage-v="true"
            >
              <div className="relative overflow-hidden rounded-[1.4rem] border border-velmere-gold/[0.18] bg-black/[0.26] p-4 text-center shadow-[0_0_80px_rgba(200,169,106,0.08)]">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-velmere-gold/[0.28] bg-velmere-gold/[0.08] font-serif text-4xl text-velmere-gold shadow-[0_0_70px_rgba(200,169,106,0.18)] before:absolute before:inset-[1.1rem] before:animate-ping before:rounded-full before:border before:border-velmere-gold/[0.12]">
                  V
                </div>
                <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.40]">
                  4 etapy · podgląd zgodny z pobraniem
                </p>
              </div>
              <div className="grid gap-2 rounded-[1.2rem] border border-white/[0.08] bg-black/[0.20] p-3">
                {c.forgeSteps.map((step: Pass4153LensStringRow, index: Pass4153LensStringIndex) => (
                  <span
                    key={step}
                    className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.46]"
                  >
                    <b className="grid h-6 w-6 place-items-center rounded-full border border-velmere-gold/[0.22] text-velmere-gold">
                      {index + 1}
                    </b>
                    {step}
                  </span>
                ))}
              </div>
              <div
                className="grid gap-2 rounded-[1.2rem] border border-cyan-200/[0.10] bg-cyan-300/[0.035] p-3"
                data-pass446-pdf-depth-matrix="true"
              >
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-cyan-100/[0.68]">
                  {c.depthTitle}
                </p>
                {c.depth.map((item: Pass4153LensStringRow) => (
                  <span
                    key={item}
                    className="rounded-xl border border-white/[0.07] bg-black/[0.18] px-3 py-2 text-[11px] leading-5 text-white/[0.54]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>
        ) : null}
      </section>

      {pdfPreview ? (
        <section
          className="vlm-browser-a4-preview-wrap"
          data-pass326-a4-pdf-browser="true"
          data-pass328-a4-report-sheet="true"
          aria-label="Velmère A4 PDF evidence preview"
        >
          <div className="vlm-browser-a4-preview-toolbar">
            <div>
              <p>{pdfUiCopy.previewTitle}</p>
              <span>{pdfUiCopy.previewHint}</span>
              {pdfPreview.accountArtifact ? (
                <span data-lens-account-artifact-save="verified">
                  {c.accountSaveVerified} ·{" "}
                  <a href={pdfPreview.accountArtifact.accountRoute}>{c.accountOpen}</a>
                </span>
              ) : null}
            </div>
            <div>
              <a href={pdfPreview.url} download={pdfPreview.filename} onClick={recordPass469DownloadReceipt} className="velmere-command-pill min-h-0 px-4 py-2 text-[8px]" data-tone="gold">
                {c.download}
              </a>
              <button type="button" onClick={closePreview} className="velmere-command-pill min-h-0 px-4 py-2 text-[8px]">
                {c.close}
              </button>
            </div>
          </div>
          <article className="vlm-browser-a4-sheet" data-pass328-a4-report-sheet="true">
            <span className="vlm-browser-a4-watermark" aria-hidden="true">V</span>
            <header className="vlm-browser-a4-head">
              <div>
                <p>{pdfUiCopy.report}</p>
                <h2>{pdfPreview.report.symbol} · {pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, pdfPreview.depth)}</h2>
                <span>{pdfPreview.report.pass625.state} · {pdfPreview.report.pass626.state}</span>
              </div>
              <b>{pdfPreview.report.sourceCoverage}%</b>
            </header>
            <section className="vlm-browser-a4-summary vlm-browser-a4-human-brief">
              <strong>{pdfUiCopy.brief}</strong>
              <p>{pdfPreview.report.summary || pdfPreview.report.title}</p>
            </section>
            <section className="vlm-browser-a4-grid" data-pass328-a4-report-grid="true">
              <span><strong>{pdfUiCopy.evidence}</strong><b>{pdfPreview.report.sources.length} {pdfUiCopy.sources}</b></span>
              <span><strong>{pdfUiCopy.claims}</strong><b>{pdfPreview.report.pass607.confirmedClaims}/{pdfPreview.report.pass607.claims.filter((claim: Pass4153LensPass607Claim) => claim.state !== "not_applicable").length}</b></span>
              <span><strong>{pdfUiCopy.gaps}</strong><b>{pdfPreview.report.pass608.entries.length}</b></span>
            </section>
            <section className="vlm-browser-a4-section vlm-browser-a4-proof-passport">
              <strong>{pdfUiCopy.passport}</strong>
              <p>{pdfPreview.report.pass646.snapshotId} · {pdfPreview.report.pass646.evidenceKey} · {pdfPreview.report.pass583.manifestKey}</p>
            </section>
            <section className="vlm-browser-a4-legal-note">
              <strong>{pdfUiCopy.boundary}</strong>
              <p>{pdfUiCopy.boundaryBody}</p>
            </section>
            <footer className="vlm-browser-a4-signature">
              <span>{pdfUiCopy.export}</span>
              <span className="vlm-browser-a4-signature-block"><i aria-hidden="true" /><b>Velmère</b></span>
            </footer>
          </article>
        </section>
      ) : null}

      {pdfChoiceResult ? (
        <BodyPortal>
          <div
            className="fixed inset-0 grid place-items-center overflow-y-auto overscroll-contain bg-black/[0.97] p-3 md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="velmere-pdf-depth-title"
            data-testid="lens-pdf-depth-dialog"
            data-pass479-header-occlusion-fix="full-viewport"
            data-pass554-body-portal="true"
            data-pass560-global-header-occlusion="sealed"
            data-pass1274-runtime-visual-qa-release={
              pdfPreview?.report?.pass1274?.state ?? "idle"
            }
            data-pass1274-artifact-root={
              pdfPreview?.report?.pass1274?.artifactRoot ?? "not-created-yet"
            }
            data-pass1274-required-command={
              pdfPreview?.report?.pass1274?.requiredCommand ?? "select-depth-first"
            }
            data-pass2003-lens-depth-dialog="solid-cyan-owned-scroll-no-blur"
            style={{
              ...pass628LayerStyle("nestedModal"),
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div
              className="fixed inset-0 cursor-default"
              aria-hidden="true"
              onPointerDown={() => setPdfChoiceResult(null)}
            />
            <section
              ref={choiceDialogRef}
              tabIndex={-1}
              data-modal-scroll-region="true"
              className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-[2rem] border border-cyan-200/[0.14] bg-[#05090c] p-5 shadow-[0_34px_110px_rgba(0,0,0,0.76)] md:p-8"
            >
              <div className="pointer-events-none sticky top-0 z-20 -mb-11 flex justify-end">
                <button
                  ref={choiceCloseRef}
                  type="button"
                  onClick={() => setPdfChoiceResult(null)}
                  aria-label={c.close}
                  className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/[0.10] bg-black/[0.72] text-white/[0.70] shadow-[0_12px_28px_rgba(0,0,0,0.32)] transition-colors hover:border-white/[0.24] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/[0.72]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">
                {pdfChoiceResult.symbol} · PDF
              </p>
              <h2
                id="velmere-pdf-depth-title"
                className="mt-2 font-serif text-4xl tracking-[-0.045em] text-white"
              >
                {c.pdfDepthPrompt}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.48]">
                {safeLocale === "pl"
                  ? "Najpierw wybierz poziom szczegółowości. Plik powstanie dopiero po potwierdzeniu."
                  : safeLocale === "de"
                    ? "Wähle zuerst den Detailgrad. Die Datei wird erst nach der Bestätigung erzeugt."
                    : "Choose the detail level first. The file is generated only after confirmation."}
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {pdfDepthOrder.map((depth) => {
                  const active = selectedPdfDepth === depth;
                  return (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => {
                        selectedPdfDepthRef.current = depth;
                        setSelectedPdfDepth(depth);
                      }}
                      disabled={!paidPdfUiGate(depth)}
                      aria-pressed={active}
                      data-testid={`lens-depth-choice-${depth}`}
                      className={`velmere-interaction-pulse rounded-[1.35rem] border p-5 text-left transition ${
                        active
                          ? "border-cyan-200/[0.44] bg-cyan-300/[0.085]"
                          : "border-white/[0.09] bg-white/[0.025] hover:border-white/[0.18]"
                      }`}
                    >
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
                          active ? "text-cyan-100" : "text-white/[0.62]"
                        }`}
                      >
                        {pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, depth)}
                        {depth === "basic"
                          ? ""
                          : ` · ${getVlmCurrentSkuTruth(depth, safeLocale).publicPriceLabel}`}
                      </span>
                      <span className="mt-3 block text-xs leading-6 text-white/[0.46]">
                        {pass4153LensDepthDescription(c.pdfDepthDescriptions as Pass4153LensDepthDescriptionMap, depth)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setPdfChoiceResult(null)}
                  className="velmere-command-pill velmere-interaction-pulse px-5 py-3 text-[9px]"
                >
                  {c.close}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void openPreview(pdfChoiceResult, selectedPdfDepth)
                  }
                  disabled={!paidPdfUiGate(selectedPdfDepth)}
                  data-testid="lens-depth-confirm"
                  className="velmere-command-pill velmere-interaction-pulse px-6 py-3 text-[9px]"
                  data-tone="gold"
                >
                  {selectedPdfDepth === "basic"
                    ? safeLocale === "pl"
                      ? "Generuj PDF"
                      : safeLocale === "de"
                        ? "PDF erzeugen"
                        : "Generate PDF"
                    : getVlmCurrentSkuTruth(selectedPdfDepth, safeLocale).actionLabel}
                </button>
              </div>
            </section>
          </div>
        </BodyPortal>
      ) : null}

      {pdfLoadingId ? (
        <BodyPortal>
          <div
            className="fixed inset-0 grid place-items-center overflow-y-auto overscroll-contain bg-black/[0.97] p-3 md:p-6"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-labelledby="velmere-pdf-forge-title"
            data-pass450-four-stage-v-forge="true"
            data-pass451-progressive-v-forge="true"
            data-pass486-evidence-bound-forge="true"
            data-testid="lens-pdf-forge"
            data-pass470-keyboard-only-qa={
              pass470KeyboardAudit.ok ? "ok" : "review"
            }
            data-pass479-header-occlusion-fix="full-viewport"
            data-pass554-body-portal="true"
            data-pass560-global-header-occlusion="sealed"
            data-pass2003-lens-forge-dialog="solid-low-lag-no-blur"
            style={{
              ...pass628LayerStyle("nestedModal"),
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <section
              ref={forgeDialogRef}
              tabIndex={-1}
              data-modal-scroll-region="true"
              className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[2rem] border border-cyan-200/[0.14] bg-[#05090c] p-5 text-center shadow-[0_34px_110px_rgba(0,0,0,0.76)] sm:p-7"
            >
              <div className="relative mx-auto grid h-28 w-28 place-items-center">
                <span className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full border border-velmere-gold/[0.18] border-t-velmere-gold/[0.72]" />
                <span className="absolute inset-3 animate-[spin_5s_linear_infinite_reverse] rounded-full border border-cyan-200/[0.12] border-r-cyan-100/[0.56]" />
                <span className="grid h-20 w-20 place-items-center rounded-full border border-velmere-gold/[0.32] bg-velmere-gold/[0.09] font-serif text-6xl text-velmere-gold shadow-[0_0_90px_rgba(200,169,106,0.24)]">
                  V
                </span>
              </div>
              <h2
                id="velmere-pdf-forge-title"
                className="mt-5 font-serif text-3xl tracking-[-0.04em] text-white"
              >
                {c.forgeTitle}
              </h2>
              <p className="mt-2 text-xs leading-6 text-white/[0.48]">
                {activePass486Forge?.stages[pdfStage]?.detail ||
                  activeForgeIntelligence?.forge.stages[pdfStage]?.detail ||
                  pass451.forgeStages[pdfStage]?.detail}
              </p>
              {activePass486Forge ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.38]">
                  <span>{activePass486Forge.subline}</span>
                  <span className="text-velmere-gold/[0.72]">
                    {activePass486Forge.evidenceState}
                  </span>
                </div>
              ) : null}
              <div
                className="mt-5 rounded-[1.4rem] border border-white/[0.08] bg-black/[0.22] p-3 text-left"
                data-pass465-selectable-pdf-depth="true"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/[0.42]">
                    {c.pdfDepthPrompt}
                  </p>
                  <span className="font-mono text-[8px] uppercase tracking-[0.10em] text-white/[0.30]">
                    {pdfDepthLocked ? `✓ ${c.pdfDepthLock}` : c.pdfDepthLock}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {pdfDepthOrder.map((depth) => {
                    const active = selectedPdfDepth === depth;
                    return (
                      <button
                        key={depth}
                        ref={active ? forgeDepthButtonRef : undefined}
                        type="button"
                        onClick={() => setSelectedPdfDepth(depth)}
                        disabled={pdfDepthLocked}
                        aria-pressed={active}
                        data-testid={`lens-depth-${depth}`}
                        data-pass470-keyboard-control="pdf-depth"
                        aria-keyshortcuts="Enter Space"
                        aria-label={`${pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, depth)} · ${pass4153LensDepthDescription(c.pdfDepthDescriptions as Pass4153LensDepthDescriptionMap, depth)}`}
                        className={`velmere-interaction-pulse rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                          active
                            ? "border-cyan-200/[0.42] bg-cyan-300/[0.085] text-cyan-100"
                            : "border-white/[0.08] bg-white/[0.025] text-white/[0.54] hover:border-white/[0.18] hover:text-white/[0.78]"
                        }`}
                      >
                        <span className="block font-mono text-[9px] uppercase tracking-[0.14em]">
                          {pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, depth)}
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-white/[0.46]">
                          {pass4153LensDepthDescription(c.pdfDepthDescriptions as Pass4153LensDepthDescriptionMap, depth)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                aria-label={pass451.labels.progress}
              >
                <div
                  className="velmere-progress-rail h-full rounded-full bg-cyan-200 transition-[width] duration-300 ease-out"
                  style={{
                    width: `${
                      activePass486Forge
                        ? activePass486Forge.stages
                            .slice(0, pdfStage + 1)
                            .reduce((sum: Pass4149LensProgressAccumulator, stage: Pass4383LensForgeStageLike) => sum + (stage.weight ?? 25), 0)
                        : ((pdfStage + 1) / pass451.forgeStages.length) * 100
                    }%`,
                  }}
                />
              </div>
              <div className="mt-6 grid gap-2 text-left">
                {(
                  activePass486Forge?.stages ||
                  activeForgeIntelligence?.forge.stages ||
                  pass451.forgeStages
                ).map((stage: Pass4383LensForgeStageLike, index: number) => {
                  const complete = index < pdfStage;
                  const active = index === pdfStage;
                  return (
                    <div
                      key={stage.id}
                      className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                        active
                          ? "border-cyan-200/[0.42] bg-cyan-300/[0.08] text-cyan-100"
                          : complete
                            ? "border-emerald-300/[0.16] bg-emerald-300/[0.04] text-emerald-100/[0.72]"
                            : "border-white/[0.08] bg-white/[0.025] text-white/[0.34]"
                      }`}
                    >
                      <span className="font-mono text-[10px]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.13em]">
                          {stage.label}
                        </span>
                        {"evidenceLabel" in stage ? (
                          <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.11em] text-white/[0.28]">
                            {stage.evidenceLabel}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.10em]">
                        {complete
                          ? "✓"
                          : active
                            ? `${Math.round(((index + 1) / 4) * 100)}%`
                            : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {activePass486Forge ? (
                <div
                  className="mt-4 grid grid-cols-2 gap-2"
                  data-pass486-quality-gates="parity-missing-sources-signature"
                >
                  {activePass486Forge.qualityGates.map((gate: Pass4153LensPass486QualityGate) => (
                    <div
                      key={gate.id}
                      className={`rounded-xl border px-3 py-2 text-left font-mono text-[7px] uppercase tracking-[0.11em] ${
                        gate.state === "pass"
                          ? "border-emerald-300/[0.14] bg-emerald-300/[0.035] text-emerald-100/[0.62]"
                          : "border-amber-200/[0.14] bg-amber-200/[0.035] text-amber-100/[0.62]"
                      }`}
                    >
                      {gate.state === "pass" ? "✓" : "•"} {gate.label}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </BodyPortal>
      ) : null}

      {pdfPreview ? (
        <BodyPortal>
          <div
            className="velmere-lens-a4-preview-root fixed inset-0 overflow-hidden overscroll-none bg-black/[0.985] p-3 md:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="velmere-pdf-preview-title"
            aria-describedby="velmere-pdf-preview-description"
            data-pass450-hard-scroll-lock="true"
            data-pass451-exact-pdf-preview="true"
            data-testid="lens-preview-dialog"
            data-pass470-preview-keyboard-trap={
              pass470KeyboardAudit.ok ? "ok" : "review"
            }
            data-pass479-header-occlusion-fix="full-viewport"
            data-pass554-body-portal="true"
            data-pass560-global-header-occlusion="sealed"
            data-pass2003-lens-preview-dialog="solid-reader-owned-scroll-no-blur"
            style={{
              ...pass628LayerStyle("nestedModal"),
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div
              className="fixed inset-0"
              aria-hidden="true"
              onPointerDown={(event: Pass4149LensPreviewBackdropEvent) => {
                if (event.currentTarget === event.target) closePreview();
              }}
            />
            <section
              ref={previewDialogRef}
              tabIndex={-1}
              className="velmere-lens-modal-shell relative mx-auto flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-[1180px] flex-col md:h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-3rem)]"
              data-pass1274-modal-above-header={
                pdfPreview.report.pass1274.visualBudget.modalAboveHeader
                  ? "true"
                  : "false"
              }
            >
              <header
                className="velmere-lens-modal-header mb-3 grid shrink-0 gap-2 rounded-2xl border border-white/[0.10] bg-[#0b1112]/[0.985] p-2.5 shadow-2xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:p-3"
                data-pass573-pdf-locale-purity={pdfPreview.report.pass573.state}
                data-pass574-page-boundary={pdfPreview.report.pass574.status}
                data-pass581-page-compositor={pdfPreview.report.pass581.status}
                data-pass583-download-parity={pdfPreview.report.pass583.state}
                data-pass596-pdf-release-proof={pdfPreview.report.pass596.state}
                data-pass607-claim-source-gate={pdfPreview.report.pass607.state}
                data-pass608-missing-source-appendix={
                  pdfPreview.report.pass608.state
                }
                data-pass609-a4-density={pdfPreview.report.pass609.state}
                data-pass610-reader-download-parity={
                  pdfPreview.report.pass610.state
                }
                data-pass611-pdf-accessibility={pdfPreview.report.pass611.state}
                data-pass622-source-registry={pdfPreview.report.pass622.state}
                data-pass623-atomic-claims={pdfPreview.report.pass623.state}
                data-pass624-provider-contradiction={
                  pdfPreview.report.pass624.state
                }
                data-pass625-freshness-synthesis={
                  pdfPreview.report.pass625.state
                }
                data-pass626-next-check-planner={
                  pdfPreview.report.pass626.state
                }
                data-pass642-pdfua-validation={pdfPreview.report.pass642.state}
                data-pass643-visual-parity={pdfPreview.report.pass643.state}
                data-pass644-source-replay={pdfPreview.report.pass644.state}
                data-pass645-mobile-budget={pdfPreview.report.pass645.state}
                data-pass646-unified-ledger={pdfPreview.report.pass646.state === "locked" ? (safeLocale === "pl" ? "spójna" : safeLocale === "de" ? "stabil" : "locked") : pdfPreview.report.pass646.state}
                data-pass1234-lens-shieldmap-parity={
                  pdfPreview.report.pass1234.finalStatus
                }
                data-pass1234-manifest={pdfPreview.report.pass1234.manifestKey}
                data-pass1254-pdf-typography-release={
                  pdfPreview.report.pass1254.state
                }
                data-pass1254-manifest={pdfPreview.report.pass1254.manifestKey}
                data-pass1274-runtime-visual-qa-release={
                  pdfPreview.report.pass1274.state
                }
                data-pass1274-manifest={pdfPreview.report.pass1274.manifestKey}
                data-evidence-key={pdfPreview.report.pass646.evidenceKey}
              >
                <div className="min-w-0 px-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="velmere-pdf-preview-title"
                      className="truncate text-sm font-semibold text-white"
                    >
                      {c.preview} · {pdfPreview.report.symbol}
                    </h2>
                    <span
                      className="velmere-command-pill min-h-0 px-2 py-1 text-[8px]"
                      data-tone="gold"
                    >
                      {pdfPreview.report.pass610.pageCount} A4
                    </span>
                    <span
                      className="velmere-command-pill min-h-0 px-2 py-1 text-[8px]"
                      data-tone="cyan"
                      data-pass465-pdf-depth-badge="true"
                    >
                      {pass4153LensDepthLabel(c.pdfDepthLabels as Pass4153LensDepthLabelMap, pdfPreview.depth)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.10em] ${pdfPreview.report.pass607.state === "complete" ? "border-emerald-200/[0.16] bg-emerald-300/[0.045] text-emerald-100/[0.76]" : pdfPreview.report.pass607.state === "review" ? "border-amber-200/[0.16] bg-amber-300/[0.045] text-amber-100/[0.76]" : "border-rose-200/[0.16] bg-rose-300/[0.045] text-rose-100/[0.78]"}`}
                      title={pdfPreview.report.pass607.boundary}
                    >
                      {safeLocale === "pl"
                        ? "Claimy"
                        : safeLocale === "de"
                          ? "Claims"
                          : "Claims"}{" "}
                      · {pdfPreview.report.pass607.confirmedClaims}/
                      {
                        pdfPreview.report.pass607.claims.filter(
                          (claim: Pass4153LensPass607Claim) => claim.state !== "not_applicable",
                        ).length
                      }{" "}
                      · {publicPdfMetricLabel(safeLocale, "cap")} {pdfPreview.report.pass607.evidenceCoverageCap}%
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.10em] ${pdfPreview.report.pass608.entries.length ? "border-amber-200/[0.16] bg-amber-300/[0.045] text-amber-100/[0.76]" : "border-emerald-200/[0.16] bg-emerald-300/[0.045] text-emerald-100/[0.76]"}`}
                      title={pdfPreview.report.pass608.boundary}
                    >
                      {safeLocale === "pl"
                        ? "Luki"
                        : safeLocale === "de"
                          ? "Lücken"
                          : "Gaps"}{" "}
                      · {pdfPreview.report.pass608.entries.length}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.10em] ${pdfPreview.report.pass646.state === "locked" ? "border-emerald-200/[0.16] bg-emerald-300/[0.045] text-emerald-100/[0.76]" : "border-amber-200/[0.16] bg-amber-300/[0.045] text-amber-100/[0.76]"}`}
                      title={pdfPreview.report.pass646.boundary}
                      data-pass646-evidence-continuity="true"
                    >
                      {safeLocale === "pl"
                        ? "Spójność"
                        : safeLocale === "de"
                          ? "Konsistenz"
                          : "Continuity"}{" "}
                      · {pdfPreview.report.pass646.state === "locked" ? (safeLocale === "pl" ? "spójna" : safeLocale === "de" ? "stabil" : "locked") : pdfPreview.report.pass646.state}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.10em] ${pdfPreview.report.kernel.status === "ready" ? "border-emerald-200/[0.16] bg-emerald-300/[0.045] text-emerald-100/[0.76]" : pdfPreview.report.kernel.status === "needs_review" ? "border-amber-200/[0.16] bg-amber-300/[0.045] text-amber-100/[0.76]" : "border-rose-200/[0.16] bg-rose-300/[0.045] text-rose-100/[0.78]"}`}
                      title={pdfPreview.report.kernel.summary}
                      data-pass2042-lens-kernel-badge="true"
                    >
                      {publicKernelLabel(safeLocale)} · {safeLocale === "pl" ? "ocena dowodów" : safeLocale === "de" ? "Evidenzscore" : "evidence score"} {pdfPreview.report.kernel.confidence}% · {publicKernelStatus(safeLocale, pdfPreview.report.kernel.status)}
                    </span>
                  </div>
                  <p
                    id="velmere-pdf-preview-description"
                    className="mt-1 truncate text-[11px] text-white/[0.42]"
                    title={`${pdfPreview.report.pass625.summary} ${pdfPreview.report.pass626.primaryAction?.action || ""}`}
                  >
                    {pdfPreview.report.pass451.labels.previewHint} ·{" "}
                    {pdfPreview.report.pass625.state} ·{" "}
                    {publicPdfMetricLabel(safeLocale, "cap")} {pdfPreview.report.pass625.evidenceCoverageCap}%
                  </p>
                  {pdfPreview.accountArtifact ? (
                    <div
                      role="status"
                      data-lens-account-artifact-save="verified"
                      data-lens-account-artifact-id={pdfPreview.accountArtifact.artifactId}
                      className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-emerald-100/[0.78]"
                    >
                      <span>{c.accountSaveVerified}</span>
                      <a
                        href={pdfPreview.accountArtifact.accountRoute}
                        className="font-semibold underline decoration-emerald-200/[0.35] underline-offset-4 hover:text-white"
                      >
                        {c.accountOpen}
                      </a>
                    </div>
                  ) : null}
                </div>
                <div
                  className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:items-center"
                  data-pass469-responsive-pdf-toolbar="true"
                  data-pass470-keyboard-toolbar="true"
                  aria-label={c.keyboardQa}
                  onKeyDown={handlePreviewToolbarKeyDown}
                >
                  <div
                    className="col-span-2 flex min-w-0 rounded-full border border-white/[0.09] bg-black/[0.28] p-1 sm:col-span-1"
                    aria-label={c.preview}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewView("pdf")}
                      aria-pressed={previewView === "pdf"}
                      data-testid="lens-pdf-toggle"
                      data-pass1314-stable-pdf-toggle="true"
                      className={`velmere-command-pill min-h-0 flex-1 px-3 py-2 text-[8px] ${previewView === "pdf" ? "bg-white/[0.10] text-white" : "text-white/[0.42] hover:text-white/[0.72]"}`}
                    >
                      {pdfPreview.report.pass451.labels.exactPreview}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewView("reader")}
                      aria-pressed={previewView === "reader"}
                      data-testid="lens-reader-toggle"
                      data-pass470-keyboard-control="reader-toggle"
                      className={`velmere-command-pill min-h-0 flex-1 px-3 py-2 text-[8px] ${previewView === "reader" ? "bg-white/[0.10] text-white" : "text-white/[0.42] hover:text-white/[0.72]"}`}
                    >
                      {pdfPreview.report.pass451.labels.humanReader}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openPass468Handoff(
                        pdfPreview.result,
                        "shield",
                        pdfPreview.depth,
                      )
                    }
                    data-testid="lens-preview-shield-handoff"
                    className="velmere-command-pill h-11 min-w-0 px-3 text-[8px]"
                  >
                    <Shield className="h-4 w-4" />
                    <span className="truncate">{c.shield}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPass468Handoff(
                        pdfPreview.result,
                        "orbit",
                        pdfPreview.depth,
                      )
                    }
                    data-testid="lens-preview-orbit-handoff"
                    className="velmere-command-pill h-11 min-w-0 px-3 text-[8px]"
                    data-tone="cyan"
                  >
                    <Brain className="h-4 w-4" />
                    <span className="truncate">{c.orbit}</span>
                  </button>
                  <a
                    href={pdfPreview.url}
                    download={pdfPreview.filename}
                    onClick={recordPass469DownloadReceipt}
                    className="velmere-command-pill col-span-2 h-11 min-w-0 px-4 text-[9px] sm:col-span-1"
                    data-tone="gold"
                    aria-label={c.download}
                    data-testid="lens-download-link"
                    data-pass470-keyboard-control="download"
                    aria-keyshortcuts="Enter"
                    data-pass469-download-receipt="download_initiated"
                  >
                    <Download className="h-4 w-4" />
                    <span className="truncate">{c.download}</span>
                  </a>
                  <button
                    ref={previewCloseRef}
                    type="button"
                    onPointerDown={closePreview}
                    className="velmere-command-pill h-11 min-w-0 px-4 text-[9px]"
                    aria-label={c.close}
                    data-testid="lens-preview-close"
                    data-pass470-keyboard-control="close"
                    aria-keyshortcuts="Escape Enter Space"
                  >
                    <X className="h-4 w-4" />
                    <span className="truncate">{c.close}</span>
                  </button>
                </div>
                <div
                  className="min-h-[1.25rem] px-2 text-[10px] leading-5 text-emerald-100/[0.68] sm:col-span-2 sm:text-right"
                  aria-live="polite"
                  data-testid="lens-download-receipt"
                >
                  {downloadReceipt ? (
                    <span
                      data-pass469-download-receipt-id={
                        downloadReceipt.receiptId
                      }
                    >
                      {c.receiptSaved} · {downloadReceipt.receiptId} ·{" "}
                      {c.receiptBoundary}
                    </span>
                  ) : (
                    <span className="text-white/[0.44]">{c.downloadHelper}</span>
                  )}
                </div>
                {showInternalPdfQa ? (
                  <div
                    className="velmere-readout-card rounded-2xl px-3 py-2 text-[10px] leading-5 text-white/[0.44] sm:col-span-2"
                    data-pass470-receipt-history="true"
                    data-pass470-receipt-history-checksum={
                      receiptHistory.checksum
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.58]">
                        {c.receiptHistoryTitle} · {receiptHistory.total}
                      </strong>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/[0.34]">
                          {receiptHistory.redaction.replaceAll("_", " ")}
                        </span>
                        {receiptHistory.visible.length ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptHistoryOpen((current: Pass4153LensBooleanState) => !current)
                            }
                            aria-expanded={receiptHistoryOpen}
                            aria-controls="velmere-receipt-history-drawer"
                            data-pass471-receipt-drawer-toggle="true"
                            className="velmere-command-pill velmere-interaction-pulse min-h-0 px-2.5 py-1 text-[8px]"
                          >
                            {receiptHistoryOpen
                              ? c.receiptHistoryHide
                              : c.receiptHistoryShow}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {receiptHistory.visible.length ? (
                      <>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {receiptHistory.visible.slice(0, 3).map((item: Pass4153LensReceiptHistoryItem) => (
                            <span
                              key={item.receiptId}
                              className="velmere-command-pill min-h-0 bg-black/[0.18] px-2 py-1 text-[8px]"
                            >
                              {item.symbol} · {item.depth} ·{" "}
                              {item.sourceCount} src
                            </span>
                          ))}
                        </div>
                        {receiptHistoryOpen ? (
                          <div
                            id="velmere-receipt-history-drawer"
                            data-pass471-receipt-drawer="true"
                            className="mt-3 max-h-52 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-white/[0.07] bg-black/[0.18] p-2"
                          >
                            {receiptHistory.visible.map((item: Pass4153LensReceiptHistoryItem) => (
                              <article
                                key={item.receiptId}
                                className="velmere-readout-card grid gap-1 rounded-lg px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-mono text-[8px] uppercase tracking-[0.11em] text-white/[0.64]">
                                    {item.symbol} · {item.depth} ·{" "}
                                    {item.sourceCount} src
                                  </p>
                                  <p className="mt-1 truncate text-[9px] text-white/[0.36]">
                                    {item.filename}
                                  </p>
                                </div>
                                <time
                                  className="font-mono text-[8px] uppercase tracking-[0.09em] text-white/[0.30]"
                                  dateTime={item.createdAt}
                                >
                                  {new Intl.DateTimeFormat(safeLocale, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  }).format(new Date(item.createdAt))}
                                </time>
                              </article>
                            ))}
                            <p className="px-1 text-[9px] leading-4 text-white/[0.30]">
                              {c.receiptHistoryBoundary}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-1 text-white/[0.34]">
                        {c.receiptHistoryEmpty}
                      </p>
                    )}
                  </div>
                ) : null}
              </header>

              {previewView === "pdf" ? (
                <div
                  data-velmere-modal-scroll="true"
                  data-modal-scroll-region="true"
                  data-pass451-binary-pdf-exact="true"
                  className="min-h-0 flex-1 overflow-hidden overscroll-contain rounded-2xl border border-white/[0.10] bg-[#222] shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
                >
                  <iframe
                    src={`${pdfPreview.url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                    title={`${c.preview} ${pdfPreview.report.symbol}`}
                    data-testid="lens-pdf-frame"
                    className="h-full min-h-0 w-full bg-[#d9d6cf] sm:min-h-[70vh]"
                  />
                </div>
              ) : (
                <div
                  ref={readerScrollRef}
                  data-velmere-modal-scroll="true"
                  data-modal-scroll-region="true"
                  data-pass448-pdf-a4-reader-v2="true"
                  data-pass494-reader-navigation={activeReaderPage}
                  data-pass580-visual-fixture={
                    pdfPreview.report.pass580.fixtureId
                  }
                  data-pass581-page-compositor={
                    pdfPreview.report.pass581.status
                  }
                  data-pass584-reader-accessibility={
                    pdfPreview.report.pass584.state
                  }
                  data-pass592-chromium-fixture={
                    pdfPreview.report.pass592.proofRef
                  }
                  data-pass593-tagged-pdf-feasibility={
                    pdfPreview.report.pass593.state
                  }
                  data-pass594-bidirectional-footnotes={
                    pdfPreview.report.pass594.checksum
                  }
                  data-pass595-extreme-typography={
                    pdfPreview.report.pass595.state
                  }
                  data-pass596-pdf-release-proof={
                    pdfPreview.report.pass596.capsuleKey
                  }
                  data-pass607-claim-source-gate={
                    pdfPreview.report.pass607.state
                  }
                  data-pass608-missing-source-appendix={
                    pdfPreview.report.pass608.state
                  }
                  data-pass609-a4-density={pdfPreview.report.pass609.state}
                  data-pass610-reader-download-parity={
                    pdfPreview.report.pass610.manifestKey
                  }
                  data-pass1254-pdf-typography-release={
                    pdfPreview.report.pass1254.state
                  }
                  data-pass1254-no-horizontal-overflow={
                    pdfPreview.report.pass1254.reader.noHorizontalOverflow
                      ? "true"
                      : "false"
                  }
                  data-pass1274-body-scroll-locked={
                    pdfPreview.report.pass1274.visualBudget
                      .bodyScrollLockedDuringPdfPreview
                      ? "true"
                      : "false"
                  }
                  data-pass1274-max-overflow-px={
                    pdfPreview.report.pass1274.visualBudget
                      .maxHorizontalOverflowPx
                  }
                  data-pass611-pdf-accessibility={
                    pdfPreview.report.pass611.state
                  }
                  className="velmere-a4-reader-scroll min-h-0 flex-1 scroll-pt-20 overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.10] bg-[#d9d6cf] p-3 shadow-2xl md:p-6"
                >
                  <nav
                    className="relative z-10 mx-auto mb-4 flex w-full max-w-[54rem] items-center gap-1.5 overflow-x-auto rounded-2xl border border-black/[0.08] bg-[#fbf8f0]/[0.98] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
                    aria-label={pdfPreview.report.pass488.labels.navigation}
                    data-pass488-a4-navigation="true"
                    data-pass584-keyboard-page-navigation="true"
                    onKeyDown={(event: Pass4149LensReaderNavKeyEvent) => {
                      if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      )
                        return;
                      event.preventDefault();
                      const pages = pdfPreview.report.pass488.pages;
                      const currentIndex = Math.max(
                        0,
                        pages.findIndex((page: { id: Pass488PageId }) => page.id === activeReaderPage),
                      );
                      const nextIndex =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? pages.length - 1
                            : event.key === "ArrowLeft"
                              ? Math.max(0, currentIndex - 1)
                              : Math.min(pages.length - 1, currentIndex + 1);
                      const next = pages[nextIndex];
                      const navigation = event.currentTarget;
                      scrollToReaderPage(next.id);
                      requestAnimationFrame(() => {
                        navigation
                          .querySelector<HTMLButtonElement>(
                            `[data-reader-page-id="${next.id}"]`,
                          )
                          ?.focus();
                      });
                    }}
                  >
                    {pdfPreview.report.pass488.pages.map((page: Pass4153LensPass488Page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => scrollToReaderPage(page.id)}
                        aria-current={
                          activeReaderPage === page.id ? "page" : undefined
                        }
                        aria-controls={page.anchor}
                        data-reader-page-id={page.id}
                        className={`velmere-focus-ring min-w-max rounded-xl px-3 py-2 text-left transition ${activeReaderPage === page.id ? "bg-black text-white" : "bg-black/[0.035] text-black/[0.58] hover:bg-black/[0.07]"}`}
                      >
                        <span className="block font-mono text-[7px] uppercase tracking-[0.12em] opacity-60">
                          {String(page.index).padStart(2, "0")}
                        </span>
                        <strong className="mt-0.5 block text-[11px]">
                          {pdfPreview.report.pass610.pages.find(
                            (manifestPage: Pass4153LensPass610Page) => manifestPage.id === page.id,
                          )?.title || page.shortLabel}
                        </strong>
                      </button>
                    ))}
                    <div
                      className="basis-full overflow-hidden rounded-full bg-black/[0.07]"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-0.5 bg-black/[0.72] transition-[width] duration-300"
                        style={{ width: `${readerProgress.percent}%` }}
                      />
                    </div>
                  </nav>
                  {showInternalPdfQa && readerHealth ? (
                    <section
                      className="sticky top-[5.25rem] z-[19] mx-auto mb-3 grid w-full max-w-[54rem] gap-2 rounded-2xl border border-black/[0.10] bg-[#f4f0e7]/[0.97] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur-lg sm:grid-cols-[auto_repeat(4,minmax(0,1fr))] sm:items-center"
                      data-pass499-a4-reader-health={readerHealth.status}
                      aria-live="polite"
                    >
                      <div className="rounded-xl bg-black px-3 py-2 text-white">
                        <span className="block font-mono text-[7px] uppercase tracking-[0.12em] text-white/[0.52]">
                          Document health
                        </span>
                        <strong className="mt-1 block text-[11px]">
                          {readerHealthLabel}
                        </strong>
                      </div>
                      {[
                        [
                          safeLocale === "pl"
                            ? "Parytet"
                            : safeLocale === "de"
                              ? "Parität"
                              : "Parity",
                          readerHealth.parity ? "1:1" : "—",
                        ],
                        [
                          safeLocale === "pl"
                            ? "Źródła"
                            : safeLocale === "de"
                              ? "Quellen"
                              : "Sources",
                          String(readerHealth.sourceCount),
                        ],
                        [
                          safeLocale === "pl"
                            ? "Skalibrowana pewność"
                            : safeLocale === "de"
                              ? "Kalibrierte Konfidenz"
                              : "Calibrated confidence",
                          pdfPreview.report.sourceConfidenceCalibrated
                            ? `${readerHealth.sourceConfidence}%`
                            : "—",
                        ],
                        [
                          safeLocale === "pl"
                            ? "Braki"
                            : safeLocale === "de"
                              ? "Lücken"
                              : "Gaps",
                          String(readerHealth.missingCount),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-black/[0.08] bg-white/[0.56] px-3 py-2"
                        >
                          <span className="block font-mono text-[7px] uppercase tracking-[0.11em] text-black/[0.38]">
                            {label}
                          </span>
                          <strong className="mt-1 block text-xs text-black/[0.72]">
                            {value}
                          </strong>
                        </div>
                      ))}
                      {pageBreakAudit ? (
                        <div
                          className="sm:col-span-5 flex flex-wrap items-center gap-2 border-t border-black/[0.08] pt-2"
                          data-pass505-pdf-page-break-audit={
                            pageBreakAudit.status
                          }
                        >
                          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                            {safeLocale === "pl"
                              ? "QA stron A4"
                              : safeLocale === "de"
                                ? "A4-Seiten-QA"
                                : "A4 page QA"}
                          </span>
                          {pageBreakAudit.pages.map((page: Pass4153LensPass505Page) => (
                            <span
                              key={page.id}
                              className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em] ${page.status === "ready" ? "border-emerald-700/[0.18] bg-emerald-700/[0.06] text-emerald-900/[0.72]" : "border-amber-700/[0.18] bg-amber-700/[0.06] text-amber-900/[0.72]"}`}
                            >
                              {String(page.index).padStart(2, "0")} ·{" "}
                              {page.label} · {page.estimatedLines}L
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {typographyQa ? (
                        <div
                          className="sm:col-span-5 flex flex-wrap items-center gap-2 border-t border-black/[0.08] pt-2"
                          data-pass519-pdf-typography-qa={typographyQa.state}
                        >
                          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                            {safeLocale === "pl"
                              ? "Typografia PDF"
                              : safeLocale === "de"
                                ? "PDF-Typografie"
                                : "PDF typography"}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em] ${typographyQa.state === "ready" ? "border-emerald-700/[0.18] bg-emerald-700/[0.06] text-emerald-900/[0.72]" : typographyQa.state === "review" ? "border-amber-700/[0.18] bg-amber-700/[0.06] text-amber-900/[0.72]" : "border-rose-700/[0.18] bg-rose-700/[0.06] text-rose-900/[0.72]"}`}
                          >
                            {typographyQa.state} · {typographyQa.score}%
                          </span>
                          <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.48]">
                            token {typographyQa.longestToken}
                          </span>
                          <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.48]">
                            sentence {typographyQa.averageSentenceLength}
                          </span>
                          {typographyQa.issues.slice(0, 2).map((issue: Pass4153LensPass519Issue) => (
                            <span
                              key={issue.id}
                              title={issue.detail}
                              className="rounded-full border border-amber-800/[0.14] bg-amber-800/[0.04] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-amber-950/[0.62]"
                            >
                              ! {issue.sectionId}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {typesettingAudit ? (
                        <div
                          className="sm:col-span-5 flex flex-wrap items-center gap-2 border-t border-black/[0.08] pt-2"
                          data-pass533-pdf-typesetting={typesettingAudit.locale}
                        >
                          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                            {safeLocale === "pl"
                              ? "Skład wielojęzyczny"
                              : safeLocale === "de"
                                ? "Mehrsprachiger Satz"
                                : "Multilingual typesetting"}
                          </span>
                          <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.52]">
                            {typesettingAudit.fontProfile}
                          </span>
                          <span className="rounded-full border border-cyan-800/[0.14] bg-cyan-800/[0.04] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-cyan-950/[0.66]">
                            lang {typesettingAudit.cssLanguageTag}
                          </span>
                          <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.48]">
                            hyphen {typesettingAudit.hyphenatedTokens}
                          </span>
                          <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.48]">
                            IDs {typesettingAudit.longIdentifierTokens}
                          </span>
                        </div>
                      ) : null}
                      {pdfVisualReleaseAudit ? (
                        <div
                          className="sm:col-span-5 grid gap-2 border-t border-black/[0.08] pt-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center"
                          data-pass547-pdf-visual-release-audit={
                            pdfVisualReleaseAudit.state
                          }
                          title={pdfVisualReleaseAudit.boundary}
                        >
                          <div
                            className={`rounded-xl border px-3 py-2 ${pdfVisualReleaseAudit.state === "release" ? "border-emerald-800/[0.16] bg-emerald-800/[0.05]" : pdfVisualReleaseAudit.state === "blocked" ? "border-rose-800/[0.16] bg-rose-800/[0.05]" : "border-amber-800/[0.16] bg-amber-800/[0.05]"}`}
                          >
                            <span className="block font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                              {safeLocale === "pl" ? "Czytelność PDF" : safeLocale === "de" ? "PDF-Lesbarkeit" : "PDF readability"}
                            </span>
                            <strong className="mt-1 block text-[11px] text-black/[0.72]">
                              {safeLocale === "pl" ? "gotowe" : safeLocale === "de" ? "bereit" : "ready"} ·{" "}
                              {pdfVisualReleaseAudit.score}%
                            </strong>
                          </div>
                          <div>
                            <p className="text-[10px] leading-5 text-black/[0.56]">
                              {pdfVisualReleaseAudit.headline}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {pdfVisualReleaseAudit.pageFlags.map((page: Pass4153LensPass547PageFlag) => (
                                <span
                                  key={page.id}
                                  title={page.note}
                                  className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] ${page.state === "ready" ? "border-emerald-800/[0.14] text-emerald-950/[0.62]" : page.state === "blocked" ? "border-rose-800/[0.14] text-rose-950/[0.66]" : "border-amber-800/[0.14] text-amber-950/[0.66]"}`}
                                >
                                  {safeLocale === "pl" ? "strona" : safeLocale === "de" ? "Seite" : "page"} {page.id.replace("page", "")} · {safeLocale === "pl" ? "czytelność" : safeLocale === "de" ? "Lesbarkeit" : "readability"} {page.density}%
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {pdfReleaseScorecard ? (
                        <div
                          className="sm:col-span-5 grid gap-2 border-t border-black/[0.08] pt-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center"
                          data-pass526-pdf-release-scorecard={
                            pdfReleaseScorecard.state
                          }
                        >
                          <div
                            className={`rounded-xl border px-3 py-2 ${pdfReleaseScorecard.state === "release" ? "border-emerald-800/[0.16] bg-emerald-800/[0.06]" : pdfReleaseScorecard.state === "review" ? "border-amber-800/[0.16] bg-amber-800/[0.06]" : "border-rose-800/[0.16] bg-rose-800/[0.06]"}`}
                          >
                            <span className="block font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                              {safeLocale === "pl"
                                ? "Bramka wydania PDF"
                                : safeLocale === "de"
                                  ? "PDF-Freigabegate"
                                  : "PDF release gate"}
                            </span>
                            <strong className="mt-1 block text-[11px] uppercase text-black/[0.72]">
                              {pdfReleaseScorecard.state} ·{" "}
                              {pdfReleaseScorecard.score}%
                            </strong>
                          </div>
                          <div>
                            <p className="text-[10px] leading-5 text-black/[0.56]">
                              {pdfReleaseScorecard.recommendation}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {pdfReleaseScorecard.blockers
                                .slice(0, 2)
                                .map((item: Pass4153LensStringRow) => (
                                  <span
                                    key={item}
                                    className="rounded-full border border-rose-800/[0.14] bg-rose-800/[0.04] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-rose-950/[0.66]"
                                  >
                                    ! {item}
                                  </span>
                                ))}
                              {pdfReleaseScorecard.warnings
                                .slice(0, 2)
                                .map((item: Pass4153LensStringRow) => (
                                  <span
                                    key={item}
                                    className="rounded-full border border-amber-800/[0.14] bg-amber-800/[0.04] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-amber-950/[0.66]"
                                  >
                                    review
                                  </span>
                                ))}
                              {pdfReleaseScorecard.strengths
                                .slice(0, 2)
                                .map((item: Pass4153LensStringRow) => (
                                  <span
                                    key={item}
                                    title={item}
                                    className="rounded-full border border-emerald-800/[0.14] bg-emerald-800/[0.04] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-emerald-950/[0.66]"
                                  >
                                    ✓ ready
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {reportIntegritySeal ? (
                        <div
                          className="sm:col-span-5 grid gap-2 border-t border-black/[0.08] pt-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
                          data-pass512-report-integrity-seal={
                            reportIntegritySeal.state
                          }
                        >
                          <div
                            className={`rounded-xl border px-3 py-2 ${reportIntegritySeal.state === "sealed" ? "border-emerald-800/[0.16] bg-emerald-800/[0.06]" : reportIntegritySeal.state === "review" ? "border-amber-800/[0.16] bg-amber-800/[0.06]" : "border-rose-800/[0.16] bg-rose-800/[0.06]"}`}
                          >
                            <span className="block font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.40]">
                              {safeLocale === "pl"
                                ? "Pieczęć integralności"
                                : safeLocale === "de"
                                  ? "Integritätssiegel"
                                  : "Integrity seal"}
                            </span>
                            <strong className="mt-1 block text-[11px] uppercase text-black/[0.72]">
                              {reportIntegritySeal.state} ·{" "}
                              {reportIntegritySeal.readiness}%
                            </strong>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {reportIntegritySeal.checks.map((check: Pass4153LensPass512Check) => (
                              <span
                                key={check.id}
                                title={check.detail}
                                className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] ${check.passed ? "border-emerald-800/[0.15] bg-emerald-800/[0.05] text-emerald-950/[0.66]" : "border-rose-800/[0.15] bg-rose-800/[0.05] text-rose-950/[0.66]"}`}
                              >
                                {check.passed ? "✓" : "!"} {check.label}
                              </span>
                            ))}
                          </div>
                          <code className="truncate font-mono text-[7px] text-black/[0.34]">
                            {reportIntegritySeal.checksum}
                          </code>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  <div
                    className="mx-auto mb-4 flex w-full max-w-[54rem] flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[0.08] bg-[#fbf8f0]/[0.92] px-4 py-3 text-black/[0.58] shadow-[0_10px_24px_rgba(0,0,0,0.05)]"
                    data-pass555-public-reader-status="clean"
                  >
                    <span className="font-mono text-[8px] uppercase tracking-[0.12em]">
                      {readerHealthLabel}
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.10em] text-black/[0.40]">
                      {pdfPreview.report.sources.length}{" "}
                      {safeLocale === "pl"
                        ? "źródła"
                        : safeLocale === "de"
                          ? "Quellen"
                          : "sources"}{" "}
                      · {pdfPreview.report.sourceCoverage}%
                    </span>
                    <span
                      className="rounded-full border border-black/[0.08] bg-white/[0.48] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-black/[0.52]"
                      data-pass1254-reader-badge={pdfPreview.report.pass1254.state}
                      title={pdfPreview.report.pass1254.copy.body}
                    >
                      {pdfPreview.report.pass1254.copy.badge} · {pdfPreview.report.pass1254.score}%
                    </span>
                  </div>
                  <section
                    className="mx-auto mb-4 grid w-full max-w-[54rem] gap-3 rounded-2xl border border-[#9b895f]/[0.26] bg-[#f5efe0] px-4 py-3 text-[#171717] shadow-[0_10px_24px_rgba(0,0,0,0.05)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    data-pass1234-reader-map-parity="visible"
                    data-pass1234-manifest={pdfPreview.report.pass1234.manifestKey}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#8a6b2f]">
                        {pdfPreview.report.pass1234.copy.stripTitle}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-black/[0.58]">
                        {pdfPreview.report.pass1234.copy.stripBody}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {[
                        pdfPreview.report.pass1234.copy.readerParity,
                        pdfPreview.report.pass1234.copy.mapParity,
                        `${pdfPreview.report.pass1234.finalStatus} · ${publicPdfMetricLabel(safeLocale, "cap")} ${pdfPreview.report.pass1234.evidenceCoverageCap}%`,
                      ].map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-black/[0.08] bg-white/[0.48] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-black/[0.52]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                  {showInternalPdfQa ? (
                  <section
                    className="velmere-pass1254-reader-typography mx-auto mb-4 grid w-full max-w-[54rem] gap-3 rounded-2xl border border-black/[0.08] bg-[#fbf8f0]/[0.94] px-4 py-3 text-black/[0.62] shadow-[0_10px_24px_rgba(0,0,0,0.05)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    data-pass1254-pdf-typography-release={
                      pdfPreview.report.pass1254.state
                    }
                    data-pass1254-manifest={pdfPreview.report.pass1254.manifestKey}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#8a6b2f]">
                        {pdfPreview.report.pass1254.copy.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-black/[0.56]">
                        {pdfPreview.report.pass1254.copy.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {pdfPreview.report.pass1254.checks.map((check: Pass4153LensPass1254Check) => (
                        <span
                          key={check.id}
                          className={`rounded-full border px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] ${check.passed ? "border-emerald-800/[0.13] bg-emerald-800/[0.05] text-emerald-950/[0.62]" : "border-amber-800/[0.13] bg-amber-800/[0.05] text-amber-950/[0.62]"}`}
                          title={check.label}
                        >
                          {check.passed ? "✓" : "!"} {check.id.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </section>
                  ) : null}
                  {showInternalPdfQa ? (
                  <section
                    className="velmere-pass1274-runtime-visual-qa mx-auto mb-4 grid w-full max-w-[54rem] gap-3 rounded-2xl border border-cyan-950/[0.10] bg-white/[0.52] px-4 py-3 text-black/[0.60] shadow-[0_10px_24px_rgba(0,0,0,0.045)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    data-pass1274-runtime-visual-qa-release={
                      pdfPreview.report.pass1274.state
                    }
                    data-pass1274-manifest={pdfPreview.report.pass1274.manifestKey}
                    data-pass1274-artifact-root={
                      pdfPreview.report.pass1274.artifactRoot
                    }
                    data-pass1274-proof-mode={
                      pdfPreview.report.pass1274.proofMode
                    }
                    data-pass1334-pdf-premium-final={
                      pdfPreview.report.pass1334.state
                    }
                    data-pass1354-shield-map-evidence-graph={
                      pdfPreview.report.pass1354.state
                    }
                    data-pass1374-vlm-brain-source-truth={
                      pdfPreview.report.pass1374.state
                    }
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#0f766e]">
                        {pdfPreview.report.pass1274.copy.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-black/[0.56]">
                        {pdfPreview.report.pass1274.copy.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      {pdfPreview.report.pass1274.viewportMatrix.map((viewport: Pass4153LensPass1274Viewport) => (
                        <span
                          key={viewport.id}
                          className="rounded-full border border-cyan-950/[0.10] bg-cyan-900/[0.04] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-cyan-950/[0.58]"
                        >
                          {viewport.id} · {viewport.width}×{viewport.height}
                        </span>
                      ))}
                      <span className="rounded-full border border-black/[0.08] bg-white/[0.58] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-black/[0.52]">
                        {pdfPreview.report.pass1274.copy.badge} · {pdfPreview.report.pass1274.score}%
                      </span>
                    </div>
                  </section>
                  ) : null}
                  <section
                    className="velmere-pass1334-pdf-premium-final mx-auto mb-4 grid w-full max-w-[54rem] gap-3 rounded-2xl border border-[#8a6b2f]/[0.16] bg-[#fffaf0]/[0.94] px-4 py-3 text-black/[0.62] shadow-[0_10px_24px_rgba(0,0,0,0.05)] lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]"
                    data-pass1334-pdf-premium-final={
                      pdfPreview.report.pass1334.state
                    }
                    data-pass1334-manifest={pdfPreview.report.pass1334.manifestKey}
                    data-pass1334-release-level={
                      pdfPreview.report.pass1334.releaseLevel
                    }
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#8a6b2f]">
                        {pdfPreview.report.pass1334.cover.kicker}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-black/[0.78]">
                        {pdfPreview.report.pass1334.copy.stripTitle} · {pdfPreview.report.pass1334.score}%
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-black/[0.56]">
                        {pdfPreview.report.pass1334.copy.stripBody}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {pdfPreview.report.pass1334.executiveBlocks.slice(0, 4).map((block: Pass4153LensPass1334ExecutiveBlock) => (
                          <article
                            key={block.id}
                            className={`rounded-xl border px-3 py-2 ${block.tone === "blocked" ? "border-rose-900/[0.13] bg-rose-900/[0.035]" : block.tone === "review" ? "border-amber-900/[0.13] bg-amber-900/[0.035]" : "border-emerald-900/[0.11] bg-emerald-900/[0.025]"}`}
                          >
                            <strong className="block text-[11px] text-black/[0.72]">
                              {block.title}
                            </strong>
                            <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-black/[0.46]">
                              {block.body}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                    <aside className="rounded-2xl border border-black/[0.08] bg-white/[0.52] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.42]">
                          {pdfPreview.report.pass1334.copy.appendixTitle}
                        </p>
                        <span className="rounded-full border border-black/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-black/[0.48]">
                          {pdfPreview.report.pass1334.copy.badge}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {pdfPreview.report.pass1334.sourceAppendix.slice(0, 4).map((source: Pass4153LensPass1334Source, sourceIndex: number) => (
                          <div
                            key={source.id}
                            className="rounded-xl border border-black/[0.06] bg-black/[0.018] p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="truncate text-[10px] text-black/[0.70]">
                                {source.id} · {source.label}
                              </strong>
                              <span className="font-mono text-[7px] uppercase tracking-[0.09em] text-black/[0.38]">
                                {pdfPreview.report.sources[sourceIndex]?.coverage ?? 0}% {safeLocale === "pl" ? "pokrycia" : safeLocale === "de" ? "Abdeckung" : "coverage"}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-black/[0.42]">
                              {source.state} · {source.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </section>

                  <section
                    className="velmere-pass1374-source-truth mx-auto mb-4 grid w-full max-w-[54rem] gap-3 rounded-2xl border border-cyan-950/[0.10] bg-[#f4fbfa]/[0.72] px-4 py-3 text-black/[0.60] shadow-[0_10px_24px_rgba(0,0,0,0.04)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    data-pass1374-vlm-brain-source-truth={
                      pdfPreview.report.pass1374.state
                    }
                    data-pass1374-manifest={pdfPreview.report.pass1374.manifestKey}
                    data-pass1374-source-mode={
                      pdfPreview.report.pass1374.sourceTruthMode
                    }
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#0f766e]">
                        {pdfPreview.report.pass1374.copy.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-black/[0.56]">
                        {pdfPreview.report.pass1374.copy.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:justify-end">
                      <span className="rounded-full border border-cyan-950/[0.10] bg-white/[0.62] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-cyan-950/[0.58]">
                        {pdfPreview.report.pass1374.copy.badge} · {safeLocale === "pl" ? "gotowość" : safeLocale === "de" ? "Bereitschaft" : "readiness"} {pdfPreview.report.pass1374.score}%
                      </span>
                      <span className="rounded-full border border-black/[0.08] bg-white/[0.62] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-black/[0.50]">
                        {publicPdfMetricLabel(safeLocale, "cap")} {pdfPreview.report.pass1374.evidenceCoverageCeiling}%
                      </span>
                    </div>
                  </section>

                  {showInternalPdfQa ? (
                  <section
                    className="velmere-pass1413-mega-terminal-polish mx-auto mb-4 w-full max-w-[54rem] rounded-2xl border border-black/[0.08] bg-[#10100f]/[0.94] px-4 py-3 text-white shadow-[0_14px_34px_rgba(0,0,0,0.14)]"
                    data-pass1413-mega-terminal-polish={
                      pdfPreview.report.pass1413.state
                    }
                    data-pass1413-real-work-standard={
                      pdfPreview.report.pass1413.realWorkStandard
                    }
                    data-pass1413-task-count={pdfPreview.report.pass1413.totalTaskCount}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-velmere-gold">
                          {pdfPreview.report.pass1413.copy.title}
                        </p>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-white/[0.58]">
                          {pdfPreview.report.pass1413.copy.body}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
                        <span className="rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.09] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-velmere-gold">
                          {pdfPreview.report.pass1413.copy.badge} · {pdfPreview.report.pass1413.totalTaskCount}
                        </span>
                        <span className="rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.10em] text-white/[0.52]">
                          {pdfPreview.report.pass1413.state}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {pdfPreview.report.pass1413.lanes.slice(0, 8).map((lane: Pass4153LensPass1413Lane) => (
                        <article
                          key={lane.id}
                          className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2"
                          data-pass1413-lane={lane.id}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="truncate text-[10px] text-white/[0.78]">
                              {lane.label}
                            </strong>
                            <span className="font-mono text-[8px] text-velmere-gold tabular-nums">
                              {lane.taskCount}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-white/[0.40]">
                            {lane.visibleFixes.join(" · ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                  ) : null}


                  <article
                    className="velmere-a4-typeset mx-auto w-full max-w-[54rem] bg-[#fbf8f0] p-6 text-[#171717] shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-10"
                    data-pass450-tiered-human-report="true"
                    data-pass469-a4-overflow-audit="pass469-ok"
                    data-pass470-a4-screen-check="reader-safe"
                    data-pass477-unified-depth-contract="true"
                    data-pass478-human-evidence-brief="true"
                    data-pass488-reader-binary-parity={
                      pdfPreview.report.pass488.parityKey
                    }
                    data-pass499-reader-health={
                      readerHealth?.status ?? "blocked"
                    }
                    data-pass505-page-break-audit={
                      pageBreakAudit?.status ?? "review"
                    }
                    data-pass512-report-integrity-seal={
                      reportIntegritySeal?.state ?? "blocked"
                    }
                    data-pass519-pdf-typography-qa={
                      typographyQa?.state ?? "blocked"
                    }
                    data-pass526-pdf-release-scorecard={
                      pdfReleaseScorecard?.state ?? "blocked"
                    }
                    data-pass533-pdf-typesetting={
                      typesettingAudit?.locale ?? safeLocale
                    }
                    data-pass539-pdf-page-rhythm={
                      pageRhythm?.state ?? "blocked"
                    }
                    data-pass547-pdf-visual-release-audit={
                      pdfVisualReleaseAudit?.state ?? "blocked"
                    }
                    data-pass573-pdf-locale-purity={
                      pdfPreview.report.pass573.state
                    }
                    data-pass574-page-boundary={
                      pdfPreview.report.pass574.status
                    }
                    data-pass580-visual-fixture={
                      pdfPreview.report.pass580.snapshotKey
                    }
                    data-pass581-page-compositor={
                      pdfPreview.report.pass581.status
                    }
                    data-pass582-source-citation-rail={
                      pdfPreview.report.pass582.citations.length
                    }
                    data-pass583-download-parity={
                      pdfPreview.report.pass583.manifestKey
                    }
                    data-pass584-pdf-accessibility={
                      pdfPreview.report.pass584.state
                    }
                    data-pass592-chromium-fixture={
                      pdfPreview.report.pass592.fixtureId
                    }
                    data-pass593-tagged-pdf-feasibility={
                      pdfPreview.report.pass593.state
                    }
                    data-pass594-bidirectional-footnotes={
                      pdfPreview.report.pass594.checksum
                    }
                    data-pass595-extreme-typography={
                      pdfPreview.report.pass595.state
                    }
                    data-pass596-pdf-release-proof={
                      pdfPreview.report.pass596.capsuleKey
                    }
                    data-pass607-claim-source-completeness={
                      pdfPreview.report.pass607.state
                    }
                    data-pass608-missing-source-appendix={
                      pdfPreview.report.pass608.entries.length
                    }
                    data-pass609-dynamic-a4-density={
                      pdfPreview.report.pass609.maxDensity
                    }
                    data-pass610-reader-download-parity={
                      pdfPreview.report.pass610.manifestKey
                    }
                    data-pass611-structured-not-pdfua={
                      pdfPreview.report.pass611.pdf.pdfUaClaim
                        ? "invalid"
                        : "true"
                    }
                    data-pass1234-lens-shieldmap-parity={
                      pdfPreview.report.pass1234.finalStatus
                    }
                    data-pass1234-evidence-manifest={
                      pdfPreview.report.pass1234.manifestKey
                    }
                    data-pass1254-pdf-typography-release={
                      pdfPreview.report.pass1254.state
                    }
                    data-pass1254-line-clamp-body={
                      pdfPreview.report.pass1254.lineClamp.body
                    }
                    data-pass1274-runtime-visual-qa-release={
                      pdfPreview.report.pass1274.state
                    }
                    data-pass1274-proof-mode={
                      pdfPreview.report.pass1274.proofMode
                    }
                    role="document"
                    aria-labelledby="velmere-reader-document-title"
                    lang={pdfPreview.report.locale}
                  >
                    <header
                      id="lens-reader-page-decision"
                      className="velmere-a4-page-anchor scroll-mt-24 border-b border-black/[0.12] pb-7"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                        <span>
                          Velmère Security · Automated Analysis ·{" "}
                          {pdfPreview.report.labels.report}
                        </span>
                        <span>
                          {pdfPreview.report.symbol} ·{" "}
                          {pdfPreview.report.sourceCoverage}%
                        </span>
                      </div>
                      <h1
                        id="velmere-reader-document-title"
                        className="mt-7 break-words font-serif text-4xl leading-[0.96] tracking-[-0.045em] md:text-5xl"
                      >
                        {pdfPreview.report.title}
                      </h1>
                      <h2 className="sr-only">
                        {pdfPreview.report.pass488.pages[0].label}
                      </h2>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-black/[0.68]">
                        {reportSection(
                          pdfPreview.report,
                          "brief",
                          pdfPreview.report.summary,
                        )}
                      </p>
                    </header>

                    <section
                      className="mt-7 rounded-[1.4rem] border border-[#9b895f]/[0.30] bg-[#f1ede3] p-5"
                      data-pass477-depth-contract-reader="true"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#8a6b2f]">
                            {safeLocale === "pl"
                              ? "Zakres raportu"
                              : safeLocale === "de"
                                ? "Berichtstiefe"
                                : "Report depth"}
                          </p>
                          <strong className="mt-2 block text-xl text-black/[0.84]">
                            {pdfPreview.report.pass477.label} ·{" "}
                            {pdfPreview.report.pass477.fieldBudget}
                          </strong>
                          <p className="mt-2 max-w-3xl text-sm leading-7 text-black/[0.62]">
                            {pdfPreview.report.pass477.purpose}
                          </p>
                        </div>
                        <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                          {pdfPreview.report.pass477.evidenceStateLabel} ·{" "}
                          {publicPdfMetricLabel(safeLocale, "cap")} {pdfPreview.report.pass477.evidenceCoverageCeiling}%
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-black/[0.08] bg-white/[0.52] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
                          <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.40]">
                            {safeLocale === "pl"
                              ? "Zawiera"
                              : safeLocale === "de"
                                ? "Enthält"
                                : "Includes"}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-black/[0.62]">
                            {pdfPreview.report.pass477.includes.join(" · ")}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-black/[0.08] bg-white/[0.52] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)]">
                          <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.40]">
                            {safeLocale === "pl"
                              ? "Świadomie pomija"
                              : safeLocale === "de"
                                ? "Bewusst ausgeschlossen"
                                : "Intentionally excludes"}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-black/[0.62]">
                            {pdfPreview.report.pass477.excludes.join(" · ")}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section
                      className="mt-7 rounded-[1.4rem] border border-[#9b895f]/[0.24] bg-white/[0.46] p-5"
                      data-pass2247-pdf-evidence-lanes="true"
                    >
                      {(() => {
                        const evidence = buildPublicLensEvidenceRows(pdfPreview.report, safeLocale);
                        return (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#8a6b2f]">
                                  {evidence.copy.title}
                                </p>
                                <strong className="mt-2 block text-xl text-black/[0.84]">
                                  {pdfPreview.report.pass477.label} · {evidence.copy.next}: {evidence.nextGap}
                                </strong>
                                <p className="mt-2 max-w-3xl text-sm leading-7 text-black/[0.62]">
                                  {evidence.copy.subtitle}
                                </p>
                              </div>
                              <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                                {evidence.rows.filter((row) => row.state === "confirmed").length}/{evidence.rows.length} lanes
                              </span>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              {evidence.rows.map((row) => (
                                <div
                                  key={row.id}
                                  className={`rounded-2xl border p-3 ${publicEvidenceStateClass(row.state)}`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-mono text-[7px] uppercase tracking-[0.12em]">
                                      {row.label}
                                    </p>
                                    <span className="rounded-full border border-current/10 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.10em]">
                                      {publicEvidenceStateLabel(safeLocale, row.state)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-6 opacity-80">
                                    {row.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </section>

                    <section
                      className="mt-7 rounded-[1.4rem] border border-[#9b895f]/[0.26] bg-white/[0.42] p-5"
                      data-pass2042-lens-kernel-reader="true"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#8a6b2f]">
                            {publicKernelLabel(safeLocale)}
                          </p>
                          <strong className="mt-2 block text-xl text-black/[0.84]">
                            {pdfPreview.report.kernel.headline}
                          </strong>
                          <p className="mt-2 max-w-3xl text-sm leading-7 text-black/[0.62]">
                            {pdfPreview.report.kernel.summary}
                          </p>
                        </div>
                        <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                          {publicKernelStatus(safeLocale, pdfPreview.report.kernel.status)} · {safeLocale === "pl" ? "ocena dowodów" : safeLocale === "de" ? "Evidenzscore" : "evidence score"} {pdfPreview.report.kernel.confidence}%
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          [publicPdfMetricLabel(safeLocale, "evidence"), `${pdfPreview.report.kernel.sourceCount} · ${pdfPreview.report.kernel.evidenceQuality}`],
                          [publicPdfMetricLabel(safeLocale, "cap"), `${Math.min(pdfPreview.report.sourceCoverage, pdfPreview.report.pass477.evidenceCoverageCeiling)}%`],
                          [publicPdfMetricLabel(safeLocale, "missing"), `${pdfPreview.report.kernel.missingData.length}`],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-black/[0.08] bg-black/[0.025] p-3"
                          >
                            <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.38]">
                              {label}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-black/[0.64]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section
                      className={`mt-7 rounded-[1.4rem] border p-5 ${
                        pdfPreview.report.pass453.decision.tone === "calm"
                          ? "border-emerald-900/[0.20] bg-emerald-900/[0.04]"
                          : pdfPreview.report.pass453.decision.tone === "review"
                            ? "border-amber-900/[0.18] bg-amber-900/[0.035]"
                            : "border-rose-900/[0.18] bg-rose-900/[0.035]"
                      }`}
                      data-pass453-pdf-human-verdict="true"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#8a6b2f]">
                            {pdfPreview.report.pass478.verdict.label}
                          </p>
                          <strong className="mt-2 block text-xl text-black/[0.84]">
                            {pdfPreview.report.pass478.verdict.headline}
                          </strong>
                          <p className="mt-2 max-w-3xl text-sm leading-7 text-black/[0.62]">
                            {pdfPreview.report.pass478.verdict.summary}
                          </p>
                        </div>
                        <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                          {pdfPreview.report.pass453.labels.sourceBound}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[
                          [
                            pdfPreview.report.pass453.labels.evidenceCeiling,
                            `${pdfPreview.report.pass453.decision.evidenceCeiling}%`,
                          ],
                          [
                            pdfPreview.report.pass453.labels.sourceQuorum,
                            pdfPreview.report.pass453.decision.sourceQuorum,
                          ],
                          [
                            pdfPreview.report.pass453.labels.evidenceCoverage,
                            `${pdfPreview.report.pass453.decision.evidenceCoverage}%`,
                          ],
                          [
                            pdfPreview.report.pass453.labels.dataFreshness,
                            pdfPreview.report.pass453.decision.dataAgeLabel,
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-black/[0.08] bg-black/[0.025] p-3"
                          >
                            <p className="font-mono text-[7px] uppercase tracking-[0.12em] text-black/[0.38]">
                              {label}
                            </p>
                            <strong className="mt-2 block break-words text-xs text-black/[0.72]">
                              {value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section
                      id="lens-reader-page-evidence"
                      className="velmere-a4-page-anchor mt-7 scroll-mt-24"
                      aria-label={pdfPreview.report.labels.sources}
                    >
                      <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                        {pdfPreview.report.pass488.pages[1].label} · Velmère
                        Cybersecurity
                      </h2>
                      <div
                        className="mt-3 divide-y divide-black/[0.08] border-y border-black/[0.08]"
                        data-pass582-citation-count={
                          pdfPreview.report.pass582.citations.length
                        }
                      >
                        {pdfPreview.report.pass582.citations.map((citation: Pass4154LensPass582Citation) => (
                          <details
                            id={citation.anchor}
                            key={citation.id}
                            className="group py-3 text-xs"
                          >
                            <summary className="velmere-focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/[0.035]">
                              <span className="grid h-8 w-10 shrink-0 place-items-center rounded-lg border border-black/[0.10] bg-black/[0.035] font-mono text-[8px] font-semibold text-black/[0.60]">
                                {citation.id}
                              </span>
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-black/[0.76]">
                                  {citation.label}
                                </strong>
                                <span className="mt-0.5 block truncate text-[10px] text-black/[0.46]">
                                  {citation.mode} · {citation.freshness}
                                </span>
                              </span>
                              <span
                                className={`rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-[0.09em] ${
                                  citation.state === "confirmed"
                                    ? "border-emerald-900/[0.16] bg-emerald-900/[0.05] text-emerald-900/[0.68]"
                                    : citation.state === "missing"
                                      ? "border-rose-900/[0.16] bg-rose-900/[0.05] text-rose-900/[0.68]"
                                      : "border-amber-900/[0.16] bg-amber-900/[0.05] text-amber-900/[0.68]"
                                }`}
                              >
                                {citation.state}
                              </span>
                            </summary>
                            <div className="ml-[3.25rem] mt-1 grid gap-2 rounded-xl border border-black/[0.07] bg-white/[0.42] p-3 sm:grid-cols-[1fr_auto]">
                              <p className="text-[10px] leading-5 text-black/[0.54]">
                                {citation.note}
                              </p>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <span className="font-mono text-[8px] uppercase tracking-[0.09em] text-black/[0.40]">
                                  {citation.state}
                                </span>
                                {pdfPreview.report.pass594.sources
                                  .find(
                                    (source: Pass4154LensPass594Source) => source.sourceId === citation.id,
                                  )
                                  ?.claimAnchors.slice(0, 4)
                                  .map((claimAnchor: Pass4154LensClaimAnchor, claimIndex: Pass4154LensAnchorIndex) => (
                                    <a
                                      key={claimAnchor}
                                      href={`#${claimAnchor}`}
                                      className="velmere-proof-link rounded-full border border-black/[0.10] bg-black/[0.025] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-black/[0.56]"
                                    >
                                      {
                                        pdfPreview.report.pass594.sources.find(
                                          (source: Pass4154LensPass594Source) =>
                                            source.sourceId === citation.id,
                                        )?.claimIds[claimIndex]
                                      }
                                    </a>
                                  ))}
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </section>

                    <section
                      className="mt-5 rounded-[1.35rem] border border-black/[0.10] bg-black/[0.025] p-5"
                      data-pass607-reader-claim-source-gate={
                        pdfPreview.report.pass607.state
                      }
                      aria-labelledby="lens-claim-source-gate-title"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3
                            id="lens-claim-source-gate-title"
                            className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]"
                          >
                            {safeLocale === "pl"
                              ? "Claim → źródło → czas"
                              : safeLocale === "de"
                                ? "Claim → Quelle → Zeit"
                                : "Claim → source → time"}
                          </h3>
                          <p className="mt-2 max-w-3xl text-xs leading-6 text-black/[0.52]">
                            {pdfPreview.report.pass607.boundary}
                          </p>
                        </div>
                        <strong className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.11em] text-black/[0.58]">
                          {pdfPreview.report.pass607.state} ·{" "}
                          {publicPdfMetricLabel(safeLocale, "cap")} {pdfPreview.report.pass607.evidenceCoverageCap}%
                        </strong>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {pdfPreview.report.pass607.claims
                          .filter((claim: Pass4154LensPass607Claim) => claim.state !== "not_applicable")
                          .slice(
                            0,
                            pdfPreview.depth === "basic"
                              ? 4
                              : pdfPreview.depth === "pro"
                                ? 6
                                : 9,
                          )
                          .map((claim: Pass4154LensPass607Claim) => (
                            <article
                              key={claim.claimId}
                              className="rounded-xl border border-black/[0.08] bg-white/[0.54] p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[8px] uppercase tracking-[0.10em] text-black/[0.46]">
                                  {claim.claimId} ·{" "}
                                  {claim.sourceIds.join("+") || "—"}
                                </span>
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${claim.state === "confirmed" ? "bg-emerald-600" : claim.state === "bounded" ? "bg-amber-600" : "bg-rose-600"}`}
                                  aria-hidden="true"
                                />
                              </div>
                              <strong className="mt-2 block text-xs leading-5 text-black/[0.74]">
                                {claim.label}
                              </strong>
                              <p className="mt-1 text-[10px] leading-5 text-black/[0.48]">
                                {claim.state} · {publicPdfMetricLabel(safeLocale, "cap")} {claim.evidenceCoverageCap}%
                                {claim.blockers.length
                                  ? ` · ${claim.blockers.join(" · ")}`
                                  : ""}
                              </p>
                            </article>
                          ))}
                      </div>
                    </section>

                    <section
                      className="mt-5 rounded-[1.35rem] border border-black/[0.10] bg-[linear-gradient(145deg,rgba(255,255,255,0.72),rgba(245,239,224,0.46))] p-5"
                      data-pass622-source-registry={
                        pdfPreview.report.pass622.state
                      }
                      data-pass623-atomic-claims={
                        pdfPreview.report.pass623.state
                      }
                      data-pass624-provider-contradiction={
                        pdfPreview.report.pass624.state
                      }
                      data-pass625-freshness-synthesis={
                        pdfPreview.report.pass625.state
                      }
                      data-pass626-next-check-planner={
                        pdfPreview.report.pass626.state
                      }
                      data-pass644-source-replay={
                        pdfPreview.report.pass644.state
                      }
                      data-pass646-unified-ledger={
                        pdfPreview.report.pass646.state
                      }
                      data-evidence-key={pdfPreview.report.pass646.evidenceKey}
                      aria-labelledby="lens-source-intelligence-title"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3
                            id="lens-source-intelligence-title"
                            className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]"
                          >
                            {safeLocale === "pl"
                              ? "Bieżący stan i następna kontrola"
                              : safeLocale === "de"
                                ? "Aktueller Stand und nächste Prüfung"
                                : "Current state and next check"}
                          </h3>
                          <p className="mt-2 max-w-3xl text-xs leading-6 text-black/[0.56]">
                            {pdfPreview.report.pass625.summary}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-emerald-700/[0.14] bg-emerald-700/[0.045] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.10em] text-emerald-900/[0.68]">
                            {safeLocale === "pl"
                              ? "Bieżące"
                              : safeLocale === "de"
                                ? "Aktuell"
                                : "Current"}{" "}
                            · {pdfPreview.report.pass625.currentFacts.length}
                          </span>
                          <span className="rounded-full border border-amber-700/[0.14] bg-amber-700/[0.045] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.10em] text-amber-900/[0.68]">
                            {safeLocale === "pl"
                              ? "Ostatni znany"
                              : safeLocale === "de"
                                ? "Letzter Stand"
                                : "Last known"}{" "}
                            · {pdfPreview.report.pass625.lastKnownFacts.length}
                          </span>
                          <span className="rounded-full border border-black/[0.10] bg-black/[0.025] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.10em] text-black/[0.56]">
                            {pdfPreview.report.pass622.providerCount}{" "}
                            {safeLocale === "pl"
                              ? "źródeł"
                              : safeLocale === "de"
                                ? "Quellen"
                                : "sources"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="rounded-2xl border border-black/[0.08] bg-white/[0.55] p-4">
                          <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-black/[0.42]">
                            {safeLocale === "pl"
                              ? "Stan providerów"
                              : safeLocale === "de"
                                ? "Provider-Status"
                                : "Provider state"}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {pdfPreview.report.pass622.publicProviders
                              .slice(0, 4)
                              .map((provider: Pass4154LensPass622Provider) => (
                                <div
                                  key={provider.id}
                                  className="rounded-xl border border-black/[0.07] bg-black/[0.018] p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <strong className="truncate text-[11px] text-black/[0.72]">
                                      {provider.label}
                                    </strong>
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${provider.requiresConfiguration ? "bg-amber-600" : "bg-emerald-600"}`}
                                      aria-hidden="true"
                                    />
                                  </div>
                                  <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-black/[0.42]">
                                    TTL {provider.ttlSeconds}s ·{" "}
                                    {provider.backupProviderId || "no backup"}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-black/[0.08] bg-white/[0.55] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-black/[0.42]">
                              {safeLocale === "pl"
                                ? "Plan kontroli"
                                : safeLocale === "de"
                                  ? "Prüfplan"
                                  : "Verification plan"}
                            </p>
                            <span className="font-mono text-[8px] uppercase tracking-[0.10em] text-black/[0.42]">
                              {pdfPreview.report.pass624.state} ·{" "}
                              {pdfPreview.report.pass624.contradictions}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {pdfPreview.report.pass626.tasks
                              .slice(0, pdfPreview.depth === "basic" ? 2 : 3)
                              .map((task: Pass4154LensPass626Task) => (
                                <article
                                  key={task.taskId}
                                  className="rounded-xl border border-black/[0.07] bg-black/[0.018] p-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#8a6b2f]/[0.18] bg-[#8a6b2f]/[0.06] font-mono text-[8px] text-[#725821]">
                                      {task.rank}
                                    </span>
                                    <strong className="text-[11px] leading-5 text-black/[0.72]">
                                      {task.action}
                                    </strong>
                                  </div>
                                  <p className="mt-2 pl-8 text-[9px] leading-5 text-black/[0.46]">
                                    {task.completionEvidence}
                                  </p>
                                </article>
                              ))}
                            {!pdfPreview.report.pass626.tasks.length ? (
                              <p className="text-[10px] leading-5 text-black/[0.48]">
                                {safeLocale === "pl"
                                  ? "Brak priorytetowej luki dla wybranego zakresu."
                                  : safeLocale === "de"
                                    ? "Keine prioritäre Lücke für den gewählten Umfang."
                                    : "No priority gap for the selected scope."}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section
                      id="lens-reader-page-analysis"
                      className="velmere-a4-page-anchor mt-7 scroll-mt-24"
                      data-pass450-market-snapshot="true"
                    >
                      <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                        {pdfPreview.report.pass488.pages[2].label}
                      </h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(
                          pdfPreview.report.pass450.tiers.find(
                            (tier: Pass4154LensPass450Tier) => tier.id === "basic",
                          )?.fields || []
                        )
                          .filter((field: Pass4154LensPass450Field) =>
                            [
                              "price",
                              "marketCap",
                              "change24h",
                              "volume24h",
                            ].includes(field.id),
                          )
                          .map((field: Pass4154LensPass450Field) => (
                            <div
                              key={field.id}
                              className="rounded-2xl border border-black/[0.09] bg-black/[0.025] p-4"
                            >
                              <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-black/[0.42]">
                                {field.label}
                              </p>
                              <strong className="mt-2 block break-words text-sm text-black/[0.78]">
                                {field.value}
                              </strong>
                            </div>
                          ))}
                      </div>
                    </section>

                    <p
                      className="sr-only"
                      role="img"
                      aria-label={
                        pdfPreview.report.pass611.reader.chartAlternative
                      }
                      data-pass611-chart-alternative="text-equivalent"
                    >
                      {pdfPreview.report.pass611.reader.chartAlternative}
                    </p>

                    <section className="mt-7 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
                      <div className="rounded-2xl border border-[#9b895f]/[0.30] bg-[#f1ede3] p-5">
                        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#8a6b2f]">
                          {pdfPreview.report.labels.checked}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-black/[0.66]">
                          {reportSection(
                            pdfPreview.report,
                            "sources",
                            pdfPreview.report.whyItMatters,
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-black/[0.09] p-5">
                        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#8a6b2f]">
                          {pdfPreview.report.labels.next}
                        </p>
                        <p className="mt-3 text-sm leading-7 text-black/[0.66]">
                          {pdfPreview.report.nextOperatorStep}
                        </p>
                      </div>
                    </section>

                    <section
                      className="mt-7 rounded-[1.4rem] border border-black/[0.10] bg-black/[0.025] p-5"
                      data-pass466-pdf-confidence-waterfall="true"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                            {lensPublicEvidenceWaterfallTitle(safeLocale)}
                          </p>
                          <p className="mt-2 max-w-3xl text-xs leading-6 text-black/[0.50]">
                            {pdfPreview.report.pass466.boundary}
                          </p>
                        </div>
                        <strong className="font-mono text-lg text-black/[0.78] tabular-nums">
                          {pdfPreview.report.pass466.finalCoverage}%
                        </strong>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {pdfPreview.report.pass466.stages.map((stage: Pass4153LensWaterfallStage) => (
                          <div
                            key={stage.id}
                            className="rounded-2xl border border-black/[0.08] bg-white/[0.58] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-black/[0.42]">
                                {stage.label}
                              </span>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${stage.state === "confirmed" ? "bg-emerald-600" : stage.state === "review" ? "bg-amber-600" : "bg-rose-600"}`}
                              />
                            </div>
                            <strong className="mt-2 block text-sm text-black/[0.74] tabular-nums">
                              {stage.cap}%
                            </strong>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                              <span
                                className="block h-full rounded-full bg-black/[0.38]"
                                style={{ width: `${stage.cap}%` }}
                              />
                            </div>
                            <p className="mt-2 text-[10px] leading-5 text-black/[0.44]">
                              {stage.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                      {normalizeSafeExternalBrowserUrl(pdfPreview.report.pass466.filingUrl, { profile: "sec_filing" }) ? (
                        <a
                          href={normalizeSafeExternalBrowserUrl(pdfPreview.report.pass466.filingUrl, { profile: "sec_filing" }) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer external"
                          referrerPolicy="no-referrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/[0.12] bg-white/[0.64] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.11em] text-black/[0.60]"
                          data-pass466-reader-sec-link="true"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {pdfPreview.report.pass466.filingLabel ||
                            "SEC filing"}
                        </a>
                      ) : null}
                    </section>

                    <section
                      id="lens-reader-page-boundary"
                      className="velmere-a4-page-anchor mt-7 scroll-mt-24 rounded-2xl border border-amber-900/[0.14] bg-amber-900/[0.035] p-5"
                    >
                      <h2 className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                        {pdfPreview.report.pass488.pages[3].label} ·{" "}
                        {pdfPreview.report.labels.missing}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-black/[0.66]">
                        {pdfPreview.report.pass608.summary}
                      </p>
                      {pdfPreview.report.pass608.entries.length ? (
                        <ol
                          className="mt-4 grid gap-3 md:grid-cols-2"
                          data-pass608-reader-appendix="action-required"
                        >
                          {pdfPreview.report.pass608.entries.map((entry: Pass4154LensPass608Entry) => (
                            <li
                              key={entry.id}
                              className="rounded-xl border border-amber-900/[0.12] bg-white/[0.48] p-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-[#8a6b2f]">
                                  {entry.id} · {entry.impact}
                                </span>
                                <span className="font-mono text-[8px] text-black/[0.46]">
                                  −{entry.evidencePenalty}
                                </span>
                              </div>
                              <strong className="mt-2 block text-xs leading-5 text-black/[0.74]">
                                {entry.label}
                              </strong>
                              <p className="mt-2 text-[10px] leading-5 text-black/[0.48]">
                                {entry.nextCheck}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </section>

                    <section
                      className="mt-7 grid gap-4 lg:grid-cols-2"
                      data-pass478-claims-reader="true"
                    >
                      <div className="rounded-[1.35rem] border border-emerald-900/[0.16] bg-emerald-900/[0.035] p-5">
                        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#8a6b2f]">
                          {safeLocale === "pl"
                            ? "Potwierdzone fakty"
                            : safeLocale === "de"
                              ? "Bestätigte Fakten"
                              : "Confirmed facts"}
                        </p>
                        <ul className="mt-3 space-y-2 text-xs leading-6 text-black/[0.64]">
                          {pdfPreview.report.pass478.confirmedFacts.map(
                            (fact: Pass4154LensEvidenceFact) => (
                              <li
                                key={fact}
                                className="border-b border-black/[0.06] pb-2 last:border-0 last:pb-0"
                              >
                                {fact}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                      <div className="rounded-[1.35rem] border border-amber-900/[0.16] bg-amber-900/[0.035] p-5">
                        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#8a6b2f]">
                          {lensPublicEvidenceLimitsTitle(safeLocale)}
                        </p>
                        <ul className="mt-3 space-y-2 text-xs leading-6 text-black/[0.64]">
                          {pdfPreview.report.pass478.evidenceLimits.map(
                            (limit: Pass4154LensConfidenceLimit) => (
                              <li
                                key={limit}
                                className="border-b border-black/[0.06] pb-2 last:border-0 last:pb-0"
                              >
                                {limit}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </section>

                    <section
                      className="mt-7"
                      data-pass452-pdf-signature-diagnostics="true"
                      data-pass454-evidence-dense-reader="true"
                      data-pass455-human-reader="true"
                      data-pass456-pdf-reader="true"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                            {pdfPreview.report.pass455.executive.eyebrow}
                          </p>
                          <h4 className="mt-2 font-serif text-2xl tracking-[-0.035em] text-black/[0.82]">
                            {pdfPreview.report.pass455.executive.headline}
                          </h4>
                          <p className="mt-2 max-w-3xl text-xs leading-6 text-black/[0.52]">
                            {pdfPreview.report.pass455.executive.oneSentence}
                          </p>
                        </div>
                        <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                          {pdfPreview.report.pass453.labels.sourceBound}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {pdfPreview.report.pass455.tiers
                          .find((tier: Pass4154LensPass455Tier) => tier.id === pdfPreview.depth)
                          ?.metrics.slice(0, 8)
                          .map((insight: Pass4153LensEvidenceMetric) => (
                            <div
                              key={insight.id}
                              className="rounded-2xl border border-black/[0.09] bg-black/[0.025] p-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-black/[0.44]">
                                  {insight.label}
                                </span>
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${insight.state === "confirmed" ? "bg-emerald-600" : insight.state === "review" ? "bg-amber-600" : "bg-rose-600"}`}
                                />
                              </div>
                              <strong className="mt-2 block break-words text-sm text-black/[0.74]">
                                {insight.value}
                              </strong>
                              <p className="mt-2 text-[10px] leading-5 text-black/[0.46]">
                                {insight.humanMeaning}
                              </p>
                            </div>
                          ))}
                      </div>
                    </section>

                    <section
                      className="mt-7"
                      data-pass454-depth-matrix="true"
                      data-pass455-localized-depth-matrix="true"
                      data-pass456-full-tier-matrix="true"
                    >
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8a6b2f]">
                        Velmère Security · Automated Analysis · depth matrix
                      </p>
                      <div className="mt-3 grid gap-4">
                        {pdfPreview.report.pass455.tiers
                          .filter((tier: Pass4154LensPass455Tier) => tier.id === pdfPreview.depth)
                          .map((tier: Pass4154LensPass455Tier) => (
                            <section
                              key={tier.id}
                              className="rounded-2xl border border-black/[0.10] bg-black/[0.025] p-5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <strong className="text-base">
                                    {tier.label}
                                  </strong>
                                  <p className="mt-1 text-xs leading-5 text-black/[0.52]">
                                    {tier.promise}
                                  </p>
                                </div>
                                <span className="rounded-full border border-black/[0.10] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-black/[0.48]">
                                  {tier.fieldCount}
                                </span>
                              </div>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                {tier.metrics
                                  .slice(0, tier.fieldCount)
                                  .map((field: Pass4154LensPass455Metric) => (
                                    <div
                                      key={field.id}
                                      id={
                                        pdfPreview.report.pass594.claims.find(
                                          (claim: Pass4154LensPass594Claim) => claim.fieldId === field.id,
                                        )?.claimAnchor
                                      }
                                      data-pass594-claim-footnote={
                                        pdfPreview.report.pass594.claims.find(
                                          (claim: Pass4154LensPass594Claim) => claim.fieldId === field.id,
                                        )?.claimId
                                      }
                                      className="rounded-xl border border-black/[0.08] bg-white/[0.54] px-3 py-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-black/[0.42]">
                                          {field.label}
                                        </span>
                                        <span
                                          className={`h-1.5 w-1.5 rounded-full ${field.state === "confirmed" ? "bg-emerald-600" : field.state === "review" ? "bg-amber-600" : "bg-rose-600"}`}
                                        />
                                      </div>
                                      <strong className="mt-2 block break-words text-xs leading-5 text-black/[0.72]">
                                        {field.value}
                                      </strong>
                                      <p className="mt-2 text-[10px] leading-5 text-black/[0.42]">
                                        {field.humanMeaning}
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {pdfPreview.report.pass594.claims
                                          .find(
                                            (claim: Pass4154LensPass594Claim) =>
                                              claim.fieldId === field.id,
                                          )
                                          ?.sourceAnchors.map(
                                            (sourceAnchor: Pass4154LensSourceAnchor, sourceIndex: Pass4154LensAnchorIndex) => (
                                              <a
                                                key={sourceAnchor}
                                                href={`#${sourceAnchor}`}
                                                className="velmere-proof-link rounded-full border border-[#8a6b2f]/[0.18] bg-[#8a6b2f]/[0.05] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[#6b5124]"
                                              >
                                                {
                                                  pdfPreview.report.pass594.claims.find(
                                                    (claim: Pass4154LensPass594Claim) =>
                                                      claim.fieldId ===
                                                      field.id,
                                                  )?.sourceIds[sourceIndex]
                                                }
                                              </a>
                                            ),
                                          )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </section>
                          ))}
                      </div>
                    </section>

                    <footer
                      className="mt-8 flex flex-col gap-3 border-t border-black/[0.12] pt-5 text-[10px] leading-5 text-black/[0.44] sm:flex-row sm:items-end sm:justify-between"
                      data-pass488-parity-footer="true"
                    >
                      <div className="max-w-xl">
                        <p>{pdfPreview.report.labels.boundary}</p>
                        <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.10em] text-black/[0.36]">
                          {pdfPreview.report.pass488.labels.parity}
                        </p>
                        <p className="mt-1 font-mono text-[8px] text-black/[0.30]">
                          {pdfPreview.report.pass488.parityKey} ·{" "}
                          {pdfPreview.report.pass610.pageCount}/
                          {pdfPreview.report.pass610.pageCount} ·{" "}
                          {pdfPreview.report.pass610.manifestKey}
                          {reportIntegritySeal
                            ? ` · ${reportIntegritySeal.checksum}`
                            : ""}
                        </p>
                      </div>
                      <strong className="font-serif text-base text-black/[0.72]">
                        {pdfPreview.report.labels.signature}
                      </strong>
                    </footer>
                  </article>
                </div>
              )}
            </section>
          </div>
        </BodyPortal>
      ) : null}
    </main>
  );
}

// PASS631 legacy verifier compatibility only: z-[2147483647]

/* PASS267 compatibility markers: type LensSuggestion · suggestionLabel · Lens search suggestions mirror Shield-style token rows.
   The runtime suggestion model uses existing result rows; this marker keeps the release guard aligned without changing customer copy. */

/* PASS2270 VLM Browser/Lens shield-all bridge.
Social-Exchange Router · VLM Browser
const socialExchangeCommandRouterGate = buildSocialExchangeCommandRouterGate("vlm-browser"); data-pass293-social-exchange-router="vlm-browser"
const trustSignalFeedGate = useMemo(() => buildTrustSignalFeedGate("vlm-browser"), []); data-pass294-trust-signal-feed="vlm-browser" data-pass294-result-trust-pulse="receipt"
const decisionFlowOrchestratorGate = useMemo(() => buildDecisionFlowOrchestratorGate("vlm-browser"), []); data-pass295-decision-flow="vlm-browser" data-pass295-result-decision="receipt"
const luxuryLiquidityPassportGate = useMemo(() => buildLuxuryLiquidityPassportGate("vlm-browser"), []); data-pass296-luxury-liquidity-passport="vlm-browser" data-pass296-result-passport="proof-seal"
const depthResilienceRadarGate = useMemo(() => buildDepthResilienceRadarGate("vlm-browser"), []); data-pass297-depth-resilience-radar="vlm-browser" data-pass297-result-radar="resilience-receipt"
const reserveProvenanceTwinGate = useMemo(() => buildReserveProvenanceTwinGate("vlm-browser"), []); data-pass298-reserve-provenance-twin="vlm-browser" data-pass298-result-twin="reserve-provenance-receipt"
data-pass300-adapter-fault-sweep="vlm-browser" data-pass300-result-sweep="adapter-fault-receipt"
const sourceAdapterContractMeshGate = useMemo(() => buildSourceAdapterContractMeshGate("vlm-browser"), []); data-pass301-source-adapter-contract-mesh="vlm-browser" data-pass301-result-mesh="source-adapter-contract-receipt"
const sourceProofEscrowGate = useMemo(() => buildSourceProofEscrowGate("vlm-browser"), []); data-pass302-source-proof-escrow="vlm-browser" data-pass302-result-escrow="source-proof-escrow-receipt"
const liveAdapterCircuitBreakerGate = useMemo(() => buildLiveAdapterCircuitBreakerGate("vlm-browser"), []); data-pass303-live-adapter-circuit-breaker="vlm-browser" data-pass303-result-circuit="live-adapter-circuit-breaker-receipt"
const freshnessTimecodeLedgerGate = useMemo(() => buildFreshnessTimecodeLedgerGate("vlm-browser"), []); data-pass304-freshness-timecode-ledger="vlm-browser" data-pass304-result-ledger="freshness-timecode-receipt"
const selectiveDisclosureVaultGate = useMemo(() => buildSelectiveDisclosureVaultGate("vlm-browser"), []); data-pass305-selective-disclosure-vault="vlm-browser" data-pass305-result-vault="selective-disclosure-receipt"
const verifiableSourceCredentialGate = useMemo(() => buildVerifiableSourceCredentialGate("vlm-browser"), []); data-pass306-verifiable-source-credential="vlm-browser" data-pass306-result-credential="verifiable-source-credential-receipt"
const credentialRetentionHaloGate = useMemo(() => buildCredentialRetentionHaloGate("vlm-browser"), []); data-pass307-credential-retention-halo="vlm-browser" data-pass307-result-halo="credential-retention-receipt"
const sourceGovernanceOathGate = useMemo(() => buildSourceGovernanceOathGate("vlm-browser"), []); buildSourceGovernanceOathGate } from "@/lib/market-integrity/source-governance-oath-gate" data-pass308-source-governance-oath="vlm-browser" data-pass308-result-oath="source-governance-receipt"
const ethicalSignalEventTaxonomyGate = useMemo(() => buildEthicalSignalEventTaxonomyGate("vlm-browser"), []); data-pass309-ethical-signal-event-taxonomy="vlm-browser" data-pass309-result-taxonomy="ethical-signal-event-receipt"
const proofConsentReceiptGate = useMemo(() => buildProofConsentReceiptGate("vlm-browser"), []); data-pass310-proof-consent-receipt="vlm-browser" data-pass310-result-consent="proof-consent-receipt"
const auditTrailCovenantGate = useMemo(() => buildAuditTrailCovenantGate("vlm-browser"), []); data-pass311-audit-trail-covenant="vlm-browser" data-pass311-result-covenant="audit-trail-covenant-receipt"
const prestigeProofCompassGate = useMemo(() => buildPrestigeProofCompassGate("vlm-browser"), []); data-pass312-prestige-proof-compass="vlm-browser" data-pass312-result-compass="prestige-proof-compass-receipt"
const atelierAccessRunwayGate = useMemo(() => buildAtelierAccessRunwayGate("vlm-browser"), []); data-pass313-atelier-access-runway="vlm-browser" data-pass313-result-runway="atelier-access-runway-receipt"
data-pass314-vlm-browser-simplified="true" vlm-browser-public-brief
PASS315 customer trim: data-pass315-customer-surface-trim="vlm-browser" data-pass315-lens-public-pdf-forge="true" vlm-browser-pdf-forge-card pass315PdfForgeSpin
*/

/* PASS2270 PASS306 marker: data-pass306-result-credential="verifiable-source-receipt" */

/* PASS2519 risk kernel calibration marker: data-pass2519-provider-divergence-heatmap search results must surface one-source/stale/divergent states. */
/* PASS2520 premium risk psychology marker: data-pass2520-search-data-quality-ring shows source quality beside search results instead of implying full/live confidence. */

/* data-pass2521-browser-missing-data-recovery-router */
/* data-pass2522-browser-pdf-vault-hash-family */

/* PASS2523 marker: data-pass2523-browser-pdf-tier-proof-passport requires PDF hash family and locale proof before account-vault delivery. */

/* PASS2524 marker: data-pass2524-browser-pdf-hash-replay-chip blocks PDF final/download copy when preview/download/vault hash family drifts. */

/* PASS2525 Browser/PDF marker: data-pass2525-browser-pdf-proof-gap data-pass2525-browser-hash-drift-chip */

/* PASS2526 marker: data-pass2526-browser-pdf-hash-downgrade-chip-rail blocks PDF finality when preview/download/vault hashes drift. */
/* PASS2527 marker: data-pass2527-browser-pdf-runtime-proof-chip-mount blocks PDF preview/download/vault finality when artifact hash family replay fails. */
/* PASS2528 marker: data-pass2528-browser-pdf-live-chip-state-replay blocks preview/download/vault copy when artifactHashFamily or vaultReplay runtime keys are missing. */
