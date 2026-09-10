import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2572AuditProviderRuntimeReport, Pass2572RuntimeLane, Pass2572RuntimeState } from "./audit-provider-runtime-client";
import type { Pass2574AuditClaimLedgerReport, Pass2574EvidenceGrade } from "./audit-claim-ledger";

export const PASS2575_AUDIT_SOURCE_FRESHNESS_ID = "audit-source-freshness" as const;

export type Pass2575FreshnessState =
  | "fresh"
  | "acceptable"
  | "stale"
  | "expired"
  | "static"
  | "blocked"
  | "unknown";

export type Pass2575FreshnessLane = {
  id: string;
  label: string;
  provider: string;
  sourceState: Pass2572RuntimeState | Pass2574EvidenceGrade;
  freshnessState: Pass2575FreshnessState;
  observedAt: string;
  timestampProvenance: "provider" | "transport_received" | "submitted" | "missing";
  expiresAt?: string;
  maxAgeMs?: number;
  ageMs: number;
  latencyMs?: number;
  noStore: boolean;
  sourceUrl?: string;
  claim: string;
  customerLine: string;
  proPdfLine: string;
  advancedAction: string;
  canUseInBasic: boolean;
  canUseInPro: boolean;
};

export type Pass2575AuditSourceFreshnessReport = {
  passId: typeof PASS2575_AUDIT_SOURCE_FRESHNESS_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  advancedRule: string;
  ttlPolicy: Array<{ family: string; ttl: string; reason: string }>;
  summary: {
    totalLanes: number;
    fresh: number;
    acceptable: number;
    stale: number;
    expired: number;
    static: number;
    blocked: number;
    unknown: number;
    basicUsable: number;
    proUsable: number;
    nextRefreshHint: string;
  };
  customerRows: Array<{ label: string; status: Pass2575FreshnessState; output: string }>;
  proPdfRows: Array<{ label: string; status: Pass2575FreshnessState; output: string }>;
  advancedQueue: string[];
  lanes: Pass2575FreshnessLane[];
};

type FreshnessInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function safeDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function ttlForLane(lane: Pass2572RuntimeLane) {
  const text = `${lane.id} ${lane.label} ${lane.provider}`.toLowerCase();
  if (/dex|liquidity|pair|pool/.test(text)) return 2 * 60 * 1000;
  if (/market|coingecko|price/.test(text)) return 5 * 60 * 1000;
  if (/goplus|honeypot|security|tax|flag/.test(text)) return 30 * 60 * 1000;
  if (/explorer|source|abi/.test(text)) return 6 * 60 * 60 * 1000;
  if (/docs|repo|audit/.test(text)) return 7 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

function stateFromAge(args: {
  sourceState: Pass2572RuntimeState | Pass2574EvidenceGrade;
  ageMs: number;
  ttlMs: number;
  hasUrl: boolean;
  provider: string;
  providerTimestampVerified: boolean;
}) : Pass2575FreshnessState {
  if (args.sourceState === "blocked") return "blocked";
  if (args.sourceState === "not_run" || args.sourceState === "missing" || args.sourceState === "error" || args.sourceState === "timeout") return "unknown";
  if (!args.providerTimestampVerified) return "unknown";
  if (!args.hasUrl || /submitted|operator|velm[eè]re/i.test(args.provider)) return "static";
  if (args.ageMs > args.ttlMs) return "expired";
  if (args.ageMs > args.ttlMs * 0.72) return "stale";
  if (args.ageMs > args.ttlMs * 0.35) return "acceptable";
  return "fresh";
}

function seconds(ms: number) {
  return Math.max(0, Math.round(ms / 1000));
}

function ttlLabel(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function stateWord(locale: string, state: Pass2575FreshnessState) {
  if (state === "fresh") return t(locale, "świeże", "frisch", "fresh");
  if (state === "acceptable") return t(locale, "akceptowalne", "akzeptabel", "acceptable");
  if (state === "stale") return t(locale, "starzeje się", "altert", "stale");
  if (state === "expired") return t(locale, "wygasło", "abgelaufen", "expired");
  if (state === "static") return t(locale, "statyczne", "statisch", "static");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "niepewne", "unklar", "unknown");
}

function customerLine(locale: string, lane: Pass2572RuntimeLane, state: Pass2575FreshnessState, ageMs: number, ttlMs: number, providerTimestampVerified: boolean) {
  const status = stateWord(locale, state);
  if (!lane.receipt) {
    return t(
      locale,
      `${lane.provider}: brak timestampowanej odpowiedzi i źródłowego timestampu providera; świeżość danych jest niepotwierdzona.`,
      `${lane.provider}: keine zeitgestempelte Antwort und kein Provider-Quellzeitstempel; Datenfrische ist unbestätigt.`,
      `${lane.provider}: no timestamped response and no provider-source timestamp are available; data freshness is unverified.`,
    );
  }
  if (!providerTimestampVerified) {
    return t(
      locale,
      `${lane.provider}: odpowiedź odebrano ${seconds(ageMs)}s temu, ale provider nie podał źródłowego timestampu; świeżość danych jest niepotwierdzona.`,
      `${lane.provider}: Antwort vor ${seconds(ageMs)}s empfangen, aber ohne Provider-Quellzeitstempel; Datenfrische ist unbestätigt.`,
      `${lane.provider}: response received ${seconds(ageMs)}s ago, but no provider-source timestamp was supplied; data freshness is unverified.`,
    );
  }
  if (state === "fresh" || state === "acceptable") {
    return t(
      locale,
      `${lane.provider}: dane ${status}; sprawdzone ${seconds(ageMs)}s temu; TTL ${ttlLabel(ttlMs)}.`,
      `${lane.provider}: Daten ${status}; vor ${seconds(ageMs)}s geprueft; TTL ${ttlLabel(ttlMs)}.`,
      `${lane.provider}: data is ${status}; checked ${seconds(ageMs)}s ago; TTL ${ttlLabel(ttlMs)}.`,
    );
  }
  if (state === "stale" || state === "expired") {
    return t(
      locale,
      `${lane.provider}: dane ${status}; Basic oznacza ostrożnie i Pro powinien odświeżyć źródło.`,
      `${lane.provider}: Daten ${status}; Basic markiert vorsichtig und Pro sollte aktualisieren.`,
      `${lane.provider}: data is ${status}; Basic marks it carefully and Pro should refresh the source.`,
    );
  }
  if (state === "static") {
    return t(
      locale,
      `${lane.provider}: źródło statyczne / podane przez użytkownika; wymaga dopasowania scope w Pro.`,
      `${lane.provider}: statische / vom Nutzer gelieferte Quelle; Scope-Matching in Pro noetig.`,
      `${lane.provider}: static or user-submitted source; Pro must scope-match it.`,
    );
  }
  if (state === "blocked") {
    return t(
      locale,
      `${lane.provider}: lane gotowy, ale wymaga konfiguracji lub receipt.`,
      `${lane.provider}: Lane bereit, aber braucht Konfiguration oder Receipt.`,
      `${lane.provider}: lane is ready but needs configuration or receipt.`,
    );
  }
  return t(
    locale,
    `${lane.provider}: świeżość niepotwierdzona, więc claim nie jest sprzedawany jako pełny fakt.`,
    `${lane.provider}: Freshness unbestaetigt, Claim wird nicht als voller Fakt verkauft.`,
    `${lane.provider}: freshness is unconfirmed, so the claim is not sold as a full fact.`,
  );
}

function advancedAction(locale: string, state: Pass2575FreshnessState, lane: Pass2572RuntimeLane) {
  if (state === "fresh" || state === "acceptable") {
    return t(locale, "Można użyć w Basic/Pro z timestampem.", "Mit Timestamp in Basic/Pro nutzbar.", "Use in Basic/Pro with timestamp.");
  }
  if (state === "static") {
    return t(locale, "Zweryfikować datę, adres kontraktu i zakres dokumentu przed mocnym claimem.", "Datum, Adresse und Scope vor starkem Claim pruefen.", "Verify date, contract address and scope before a strong claim.");
  }
  if (state === "blocked") {
    return `${lane.label}: ${t(locale, "uzupełnić konfigurację / receipt.", "Konfiguration / Receipt ergaenzen.", "add configuration / receipt.")}`;
  }
  return t(locale, "Odświeżyć provider i obniżyć confidence do czasu nowego odczytu.", "Provider aktualisieren und Confidence bis dahin senken.", "Refresh provider and lower confidence until a new read exists.");
}

function claimFallbackRows(input: FreshnessInput, locale: string, _generatedAt: Date): Pass2575FreshnessLane[] {
  const claims = input.claimLedger?.claims ?? [];
  return claims.slice(0, 8).map((claim) => {
    const state: Pass2575FreshnessState = claim.grade === "blocked" ? "blocked" : claim.grade === "confirmed" ? "static" : "unknown";
    return {
      id: `claim-${claim.id}`,
      label: claim.label,
      provider: claim.sourceFamily,
      sourceState: claim.grade,
      freshnessState: state,
      observedAt: "",
      timestampProvenance: "missing",
      ageMs: 0,
      noStore: true,
      claim: claim.claim,
      customerLine: state === "static"
        ? t(locale, `${claim.sourceFamily}: claim potwierdzony w ledgerze, ale wymaga timestampu źródła w Pro.`, `${claim.sourceFamily}: Claim im Ledger bestaetigt, braucht aber Source-Timestamp in Pro.`, `${claim.sourceFamily}: claim is confirmed in ledger, but needs source timestamp in Pro.`)
        : t(locale, `${claim.sourceFamily}: freshness claimu niepotwierdzona.`, `${claim.sourceFamily}: Claim-Freshness unbestaetigt.`, `${claim.sourceFamily}: claim freshness is unconfirmed.`),
      proPdfLine: `${claim.sourceFamily}: ${claim.claim}; claimGrade=${claim.grade}; source timestamp pending`,
      advancedAction: claim.advancedAction,
      canUseInBasic: false,
      canUseInPro: false,
    };
  });
}

export function buildPass2575AuditSourceFreshnessReport(input: FreshnessInput): Pass2575AuditSourceFreshnessReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const now = new Date();
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? input.claimLedger?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress ?? input.claimLedger?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName ?? input.claimLedger?.target.projectName;
  const providerGeneratedAt = safeDate(input.providerRuntime?.generatedAt, now);

  const runtimeRows: Pass2575FreshnessLane[] = (input.providerRuntime?.lanes ?? []).map((lane) => {
    const responseObservedAt = safeDate(lane.receipt?.observedAt, providerGeneratedAt);
    const providerTimestampVerified = false;
    const observedAt = responseObservedAt;
    const ttlMs = ttlForLane(lane);
    const ageMs = Math.max(0, now.getTime() - observedAt.getTime());
    const freshnessState = stateFromAge({
      sourceState: lane.state,
      ageMs,
      ttlMs,
      hasUrl: Boolean(lane.sourceUrl),
      provider: lane.provider,
      providerTimestampVerified,
    });
    const expiresAt = providerTimestampVerified
      ? new Date(observedAt.getTime() + ttlMs).toISOString()
      : undefined;
    const canUseInBasic = providerTimestampVerified && (freshnessState === "fresh" || freshnessState === "acceptable");
    const canUseInPro = canUseInBasic;
    return {
      id: `runtime-${lane.id}`,
      label: lane.label,
      provider: lane.provider,
      sourceState: lane.state,
      freshnessState,
      observedAt: observedAt.toISOString(),
      timestampProvenance: lane.receipt ? "transport_received" : "missing",
      expiresAt,
      maxAgeMs: ttlMs,
      ageMs,
      latencyMs: lane.latencyMs,
      noStore: lane.noStore,
      sourceUrl: lane.sourceUrl,
      claim: lane.claim,
      customerLine: customerLine(locale, lane, freshnessState, ageMs, ttlMs, providerTimestampVerified),
      proPdfLine: `${lane.provider}: state=${lane.state}; freshness=${freshnessState}; responseReceivedAt=${lane.receipt ? observedAt.toISOString() : "missing"}; timestampProvenance=${lane.receipt ? "transport_received" : "missing"}; providerObservedAt=missing; ttl=${ttlLabel(ttlMs)}; latency=${lane.latencyMs ?? 0}ms; noStore=${lane.noStore}`,
      advancedAction: advancedAction(locale, freshnessState, lane),
      canUseInBasic,
      canUseInPro,
    };
  });

  const lanes = runtimeRows.length ? runtimeRows : claimFallbackRows(input, locale, now);
  const counts = (state: Pass2575FreshnessState) => lanes.filter((lane) => lane.freshnessState === state).length;
  const basicUsable = lanes.filter((lane) => lane.canUseInBasic).length;
  const proUsable = lanes.filter((lane) => lane.canUseInPro).length;
  const liveExpiry = lanes
    .filter((lane) => lane.freshnessState === "fresh" || lane.freshnessState === "acceptable")
    .map((lane) => lane.expiresAt ? new Date(lane.expiresAt).getTime() : Number.POSITIVE_INFINITY)
    .filter((time) => Number.isFinite(time) && time > now.getTime())
    .sort((a, b) => a - b)[0];
  const nextRefreshHint = liveExpiry
    ? new Date(liveExpiry).toISOString()
    : t(locale, "brak aktywnego TTL — wymagany re-run providerów", "kein aktiver TTL — Provider Re-run noetig", "no active TTL — provider re-run required");

  const customerRows = lanes.slice(0, 8).map((lane) => ({
    label: lane.label,
    status: lane.freshnessState,
    output: lane.customerLine,
  }));
  const proPdfRows = lanes.slice(0, 16).map((lane) => ({
    label: lane.label,
    status: lane.freshnessState,
    output: lane.proPdfLine,
  }));
  const advancedQueue = lanes
    .filter((lane) => lane.freshnessState === "stale" || lane.freshnessState === "expired" || lane.freshnessState === "unknown" || lane.freshnessState === "blocked" || lane.freshnessState === "static")
    .slice(0, 12)
    .map((lane) => `${lane.label}: ${lane.advancedAction}`);

  return {
    passId: PASS2575_AUDIT_SOURCE_FRESHNESS_ID,
    generatedAt: now.toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2575 dodaje timecode/freshness ledger: żaden claim nie powinien wyglądać jak aktualny, jeśli źródło wygasło albo nie ma timestampu.",
      "PASS2575 fuegt Timecode/Freshness Ledger hinzu: kein Claim soll aktuell wirken, wenn Quelle abgelaufen ist oder Timestamp fehlt.",
      "PASS2575 adds a timecode/freshness ledger: no claim should look current if its source expired or has no timestamp.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje świeżość źródeł prostym językiem: świeże, starzeje się, wygasło albo wymaga Pro.",
      "Basic zeigt Source-Freshness einfach: frisch, altert, abgelaufen oder braucht Pro.",
      "Basic shows source freshness in plain language: fresh, aging, expired or needs Pro.",
    ),
    proRule: t(
      locale,
      "Pro PDF zapisuje observedAt, expiresAt, TTL, latency i no-store dla każdego providera.",
      "Pro PDF speichert observedAt, expiresAt, TTL, Latenz und no-store pro Provider.",
      "Pro PDF records observedAt, expiresAt, TTL, latency and no-store for each provider.",
    ),
    advancedRule: t(
      locale,
      "Advanced dostaje kolejkę refresh/re-check dla stale, expired, static i blocked lanes.",
      "Advanced bekommt Refresh/Re-check Queue fuer stale, expired, static und blocked Lanes.",
      "Advanced receives a refresh/re-check queue for stale, expired, static and blocked lanes.",
    ),
    ttlPolicy: [
      { family: "DEX liquidity", ttl: "2m", reason: "liquidity and pair data can move fast" },
      { family: "Market metadata", ttl: "5m", reason: "search/market metadata should not look live forever" },
      { family: "Security flags", ttl: "30m", reason: "security flag APIs are advisory and should refresh before Pro claim" },
      { family: "Explorer source / ABI", ttl: "6h", reason: "verified source changes rarely but proxy/implementation can matter" },
      { family: "Docs / audit / repo", ttl: "7d", reason: "submitted documents need scope/date/address matching" },
    ],
    summary: {
      totalLanes: lanes.length,
      fresh: counts("fresh"),
      acceptable: counts("acceptable"),
      stale: counts("stale"),
      expired: counts("expired"),
      static: counts("static"),
      blocked: counts("blocked"),
      unknown: counts("unknown"),
      basicUsable,
      proUsable,
      nextRefreshHint,
    },
    customerRows,
    proPdfRows,
    advancedQueue,
    lanes,
  };
}
