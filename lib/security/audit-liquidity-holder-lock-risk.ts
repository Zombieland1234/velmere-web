import { C0_OR_ANGLE_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2572AuditProviderRuntimeReport } from "./audit-provider-runtime-client";
import type { Pass2574AuditClaimLedgerReport } from "./audit-claim-ledger";
import type { Pass2575AuditSourceFreshnessReport } from "./audit-source-freshness";
import type { Pass2576AuditPermissionParserReport } from "./audit-permission-parser";

export const PASS2577_AUDIT_LIQUIDITY_HOLDER_LOCK_RISK_ID = "audit-liquidity-holder-lock-risk" as const;

export type Pass2577LiquidityArea =
  | "liquidity_visibility"
  | "pool_depth"
  | "pool_age"
  | "lock_evidence"
  | "holder_concentration"
  | "deployer_holder_link"
  | "supply_distribution"
  | "exit_liquidity";

export type Pass2577LiquidityState = "confirmed" | "partial" | "missing" | "blocked" | "not_run";
export type Pass2577LiquiditySeverity = "info" | "watch" | "elevated" | "critical";

export type Pass2577LiquiditySignal = {
  id: string;
  area: Pass2577LiquidityArea;
  label: string;
  state: Pass2577LiquidityState;
  severity: Pass2577LiquiditySeverity;
  riskDelta: number;
  confidenceDelta: number;
  evidence: string[];
  missing: string[];
  basicLine: string;
  proPdfLine: string;
  advancedAction: string;
  sourceFamilies: string[];
  canShowInBasic: boolean;
  requiresPro: boolean;
};

export type Pass2577AuditLiquidityHolderLockRiskReport = {
  passId: typeof PASS2577_AUDIT_LIQUIDITY_HOLDER_LOCK_RISK_ID;
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
  engineMode: string;
  summary: {
    totalSignals: number;
    confirmed: number;
    partial: number;
    missing: number;
    blocked: number;
    elevatedOrCritical: number;
    riskDelta: number;
    confidenceDelta: number;
    basicVisible: number;
    proRequired: number;
    liquidityCoverageLabel: string;
  };
  basicRows: Array<{ label: string; status: Pass2577LiquidityState; severity: Pass2577LiquiditySeverity; output: string }>;
  proPdfRows: Array<{ label: string; status: Pass2577LiquidityState; severity: Pass2577LiquiditySeverity; output: string }>;
  advancedQueue: string[];
  signals: Pass2577LiquiditySignal[];
};

type LiquidityInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
  sourceFreshness?: Pass2575AuditSourceFreshnessReport | null;
  permissionParser?: Pass2576AuditPermissionParserReport | null;
};

type SignalSpec = {
  id: string;
  area: Pass2577LiquidityArea;
  label: string;
  severity: Pass2577LiquiditySeverity;
  familyPatterns: RegExp[];
  positivePatterns: RegExp[];
  missingPatterns: RegExp[];
  fallbackRisk: number;
  requiresPro?: boolean;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safe(value: unknown, max = 420) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_ANGLE_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function corpus(input: LiquidityInput) {
  const runtime = input.providerRuntime?.lanes.flatMap((lane) => [
    lane.id,
    lane.label,
    lane.provider,
    lane.state,
    String(lane.latencyMs ?? ""),
    lane.claim,
    lane.sourceUrl,
    ...lane.evidence,
    ...lane.missing,
  ]) ?? [];
  const claims = input.claimLedger?.claims.flatMap((claim) => [
    claim.category,
    claim.label,
    claim.grade,
    claim.sourceFamily,
    claim.claim,
    claim.customerLine,
    claim.proPdfLine,
    ...claim.missing,
  ]) ?? [];
  const freshness = input.sourceFreshness?.lanes.flatMap((lane) => [
    lane.label,
    lane.provider,
    lane.sourceState,
    lane.freshnessState,
    String(lane.latencyMs ?? ""),
    lane.claim,
    lane.customerLine,
    lane.proPdfLine,
  ]) ?? [];
  const permissions = input.permissionParser?.signals.flatMap((signal) => [
    signal.category,
    signal.label,
    signal.state,
    signal.severity,
    signal.proPdfLine,
    ...signal.evidence,
    ...signal.missing,
  ]) ?? [];
  return [
    input.contractAddress,
    input.projectName,
    input.chain,
    input.auditUrl,
    input.docsUrl,
    input.githubUrl,
    input.website,
    ...runtime,
    ...claims,
    ...freshness,
    ...permissions,
  ].map((item) => safe(item, 600)).filter(Boolean).join("\n").slice(0, 140_000);
}

const SPECS: SignalSpec[] = [
  {
    id: "liquidity-visibility",
    area: "liquidity_visibility",
    label: "Liquidity visibility",
    severity: "watch",
    fallbackRisk: 9,
    familyPatterns: [/dex/i, /liquidity/i, /pair/i, /pool/i],
    positivePatterns: [/liquidity|pairs|pool|dex screener|usable public evidence|confirmed/i],
    missingPatterns: [/liquidity.*missing|pair.*missing|pool.*missing|no dex|unavailable/i],
  },
  {
    id: "pool-depth",
    area: "pool_depth",
    label: "Pool depth / exit capacity",
    severity: "elevated",
    fallbackRisk: 14,
    familyPatterns: [/liquidity/i, /pool/i, /dex/i],
    positivePatterns: [/liquidityUsd|liquidity\.usd|reserve|depth|usd|pool/i],
    missingPatterns: [/depth.*missing|liquidity.*incomplete|limited liquidity|not confirmed/i],
    requiresPro: true,
  },
  {
    id: "pool-age",
    area: "pool_age",
    label: "Pool age / pair creation",
    severity: "watch",
    fallbackRisk: 7,
    familyPatterns: [/pair/i, /dex/i, /liquidity/i],
    positivePatterns: [/pairCreatedAt|createdAt|age|creation/i],
    missingPatterns: [/pair age.*missing|creation.*missing|not confirmed/i],
    requiresPro: true,
  },
  {
    id: "lock-evidence",
    area: "lock_evidence",
    label: "Liquidity lock evidence",
    severity: "critical",
    fallbackRisk: 18,
    familyPatterns: [/lock/i, /liquidity/i, /vesting/i],
    positivePatterns: [/lock|locked|vesting|unlock|timelock/i],
    missingPatterns: [/lock.*missing|not locked|lock.*not confirmed|unlock.*unknown|missing/i],
    requiresPro: true,
  },
  {
    id: "holder-concentration",
    area: "holder_concentration",
    label: "Holder concentration",
    severity: "elevated",
    fallbackRisk: 16,
    familyPatterns: [/holder/i, /supply/i, /concentration/i],
    positivePatterns: [/holder|top holder|concentration|supply|balance/i],
    missingPatterns: [/holder.*missing|concentration.*missing|distribution.*missing|not confirmed/i],
    requiresPro: true,
  },
  {
    id: "deployer-holder-link",
    area: "deployer_holder_link",
    label: "Deployer / holder relation",
    severity: "elevated",
    fallbackRisk: 13,
    familyPatterns: [/deployer/i, /creator/i, /holder/i, /owner/i],
    positivePatterns: [/deployer|creator|owner|holder relation|contract creator/i],
    missingPatterns: [/deployer.*missing|creator.*missing|relation.*unknown|not confirmed/i],
    requiresPro: true,
  },
  {
    id: "supply-distribution",
    area: "supply_distribution",
    label: "Supply distribution",
    severity: "watch",
    fallbackRisk: 11,
    familyPatterns: [/supply/i, /holder/i, /market/i],
    positivePatterns: [/totalSupply|circulating|supply|distribution/i],
    missingPatterns: [/supply.*missing|distribution.*missing|not confirmed/i],
    requiresPro: true,
  },
  {
    id: "exit-liquidity",
    area: "exit_liquidity",
    label: "Exit liquidity / sell pressure boundary",
    severity: "critical",
    fallbackRisk: 20,
    familyPatterns: [/liquidity/i, /holder/i, /market/i, /tax/i, /sell/i],
    positivePatterns: [/sell|exit|liquidity|tax|holder|volume/i],
    missingPatterns: [/exit.*missing|sell.*unknown|volume.*missing|liquidity.*limited|tax.*unknown/i],
    requiresPro: true,
  },
];

function matchingLines(text: string, patterns: RegExp[]) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const matches: string[] = [];
  for (const pattern of patterns) {
    const found = lines.find((line) => pattern.test(line));
    if (found) matches.push(found.slice(0, 240));
  }
  return Array.from(new Set(matches)).slice(0, 5);
}

function families(input: LiquidityInput, spec: SignalSpec) {
  const runtime = input.providerRuntime?.lanes.filter((lane) => {
    const text = `${lane.id} ${lane.label} ${lane.provider} ${lane.claim}`;
    return spec.familyPatterns.some((pattern) => pattern.test(text));
  }).map((lane) => lane.provider) ?? [];
  const claims = input.claimLedger?.claims.filter((claim) => {
    const text = `${claim.category} ${claim.label} ${claim.sourceFamily} ${claim.claim}`;
    return spec.familyPatterns.some((pattern) => pattern.test(text));
  }).map((claim) => claim.sourceFamily) ?? [];
  return Array.from(new Set([...runtime, ...claims])).slice(0, 5);
}

function stateFor(input: LiquidityInput, text: string, spec: SignalSpec): Pass2577LiquidityState {
  const relatedRuntime = input.providerRuntime?.lanes.filter((lane) => {
    const combined = `${lane.id} ${lane.label} ${lane.provider} ${lane.claim}`;
    return spec.familyPatterns.some((pattern) => pattern.test(combined));
  }) ?? [];
  const hasConfirmed = relatedRuntime.some((lane) => lane.state === "confirmed");
  const hasPartial = relatedRuntime.some((lane) => lane.state === "partial");
  const hasBlocked = relatedRuntime.some((lane) => lane.state === "blocked" || lane.state === "timeout" || lane.state === "error");
  const hasPositive = spec.positivePatterns.some((pattern) => pattern.test(text));
  const hasMissing = spec.missingPatterns.some((pattern) => pattern.test(text));

  if (hasConfirmed && hasPositive && !hasMissing) return "confirmed";
  if (hasConfirmed || hasPartial || hasPositive) return "partial";
  if (hasBlocked) return "blocked";
  if (hasMissing) return "missing";
  if (input.contractAddress || input.projectName) return "missing";
  return "not_run";
}

function basicLine(locale: string, spec: SignalSpec, state: Pass2577LiquidityState) {
  if (state === "confirmed") {
    return t(
      locale,
      `${spec.label}: mamy publiczny sygnał, ale Basic pokazuje tylko krótki werdykt bez pełnej mapy przepływu środków.`,
      `${spec.label}: oeffentliches Signal vorhanden, Basic zeigt aber nur Kurzurteil ohne volle Funds-Map.`,
      `${spec.label}: public signal exists, but Basic only shows a short verdict without the full funds map.`,
    );
  }
  if (state === "partial") {
    return t(
      locale,
      `${spec.label}: częściowo widoczne. Pro powinien potwierdzić drugim źródłem przed mocnym claimem.`,
      `${spec.label}: teilweise sichtbar. Pro sollte mit zweiter Quelle bestaetigen.`,
      `${spec.label}: partially visible. Pro should confirm with a second source before a strong claim.`,
    );
  }
  if (state === "blocked") {
    return t(
      locale,
      `${spec.label}: provider/źródło jest gotowe, ale wynik jest zablokowany przez timeout, brak klucza albo limit.`,
      `${spec.label}: Provider/Quelle bereit, aber durch Timeout, fehlenden Key oder Limit blockiert.`,
      `${spec.label}: provider/source is ready, but blocked by timeout, missing key or limit.`,
    );
  }
  if (state === "missing") {
    return t(
      locale,
      `${spec.label}: nie potwierdzono publicznie w Basic. Nie traktujemy tego jako faktu.`,
      `${spec.label}: in Basic nicht oeffentlich bestaetigt. Wir behandeln es nicht als Fakt.`,
      `${spec.label}: not publicly confirmed in Basic. We do not treat it as a fact.`,
    );
  }
  return t(locale, `${spec.label}: nie uruchomiono.`, `${spec.label}: nicht ausgefuehrt.`, `${spec.label}: not run.`);
}

function advancedAction(locale: string, spec: SignalSpec, state: Pass2577LiquidityState) {
  if (state === "confirmed" || state === "partial") {
    return t(
      locale,
      `${spec.label}: sprawdzić drugie źródło, timestamp, top holders, lock proof i czy liquidity wystarcza do realnego exit risk.`,
      `${spec.label}: zweite Quelle, Timestamp, Top Holder, Lock Proof und reale Exit Risk pruefen.`,
      `${spec.label}: verify second source, timestamp, top holders, lock proof and real exit-risk capacity.`,
    );
  }
  if (state === "blocked") {
    return t(
      locale,
      `${spec.label}: odblokować provider lub użyć fallbacku przed PDF finalnym.`,
      `${spec.label}: Provider entsperren oder Fallback vor finalem PDF nutzen.`,
      `${spec.label}: unblock provider or use fallback before final PDF.`,
    );
  }
  return t(
    locale,
    `${spec.label}: oznaczyć jako missing evidence i nie obniżać/nie podnosić pewności bez danych.`,
    `${spec.label}: als Missing Evidence markieren und Confidence ohne Daten nicht erhoehen.`,
    `${spec.label}: mark as missing evidence and do not raise/lower confidence without data.`,
  );
}

function severityRisk(spec: SignalSpec, state: Pass2577LiquidityState) {
  if (state === "confirmed") return Math.max(0, Math.round(spec.fallbackRisk * -0.25));
  if (state === "partial") return Math.round(spec.fallbackRisk * 0.45);
  if (state === "blocked") return Math.round(spec.fallbackRisk * 0.3);
  if (state === "missing") return spec.fallbackRisk;
  return Math.round(spec.fallbackRisk * 0.2);
}

function confidenceDelta(state: Pass2577LiquidityState) {
  if (state === "confirmed") return 9;
  if (state === "partial") return 3;
  if (state === "blocked") return -7;
  if (state === "missing") return -10;
  return -4;
}

export function buildPass2577AuditLiquidityHolderLockRiskReport(input: LiquidityInput): Pass2577AuditLiquidityHolderLockRiskReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName;
  const text = corpus(input);

  const signals: Pass2577LiquiditySignal[] = SPECS.map((spec) => {
    const state = stateFor(input, text, spec);
    const evidence = matchingLines(text, spec.positivePatterns);
    const missing = state === "confirmed" ? [] : matchingLines(text, spec.missingPatterns).concat([
      "second-source confirmation",
      spec.area === "lock_evidence" ? "public lock/unlock proof" : "fresh public data",
      spec.area === "holder_concentration" ? "top-holder distribution" : "Pro depth review",
    ]).filter(Boolean).slice(0, 5);
    const riskDelta = severityRisk(spec, state);
    const confDelta = confidenceDelta(state);
    const sourceFamilies = families(input, spec);
    return {
      id: spec.id,
      area: spec.area,
      label: spec.label,
      state,
      severity: spec.severity,
      riskDelta,
      confidenceDelta: confDelta,
      evidence,
      missing,
      basicLine: basicLine(locale, spec, state),
      proPdfLine: `${spec.label}; state=${state}; severity=${spec.severity}; riskDelta=${riskDelta}; confidenceDelta=${confDelta}; sources=${sourceFamilies.join(", ") || "none"}; evidence=${evidence.length}; missing=${missing.length}`,
      advancedAction: advancedAction(locale, spec, state),
      sourceFamilies,
      canShowInBasic: true,
      requiresPro: spec.requiresPro === true || state !== "confirmed",
    };
  });

  const confirmed = signals.filter((signal) => signal.state === "confirmed").length;
  const partial = signals.filter((signal) => signal.state === "partial").length;
  const missing = signals.filter((signal) => signal.state === "missing").length;
  const blocked = signals.filter((signal) => signal.state === "blocked").length;
  const elevatedOrCritical = signals.filter((signal) => signal.state !== "confirmed" && (signal.severity === "elevated" || signal.severity === "critical")).length;
  const riskDelta = clamp(signals.reduce((sum, signal) => sum + signal.riskDelta, 0), 0, 100);
  const confDelta = clamp(signals.reduce((sum, signal) => sum + signal.confidenceDelta, 0), -60, 50);
  const live = confirmed + partial;
  const liquidityCoverageLabel = `${live}/${signals.length} liquidity/holder lanes visible`;

  return {
    passId: PASS2577_AUDIT_LIQUIDITY_HOLDER_LOCK_RISK_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2577 dodaje liquidity/holders/lock risk: Basic nie może mówić o płynności ani holderach bez źródła, timestampu i missing evidence.",
      "PASS2577 fuegt Liquidity/Holders/Lock Risk hinzu: Basic darf ohne Quelle, Timestamp und Missing Evidence keine starken Claims machen.",
      "PASS2577 adds liquidity/holders/lock risk: Basic cannot make strong liquidity or holder claims without source, timestamp and missing evidence.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje tylko publiczne sygnały liquidity/holders i jasno oznacza brak lock proof, holder distribution albo pool depth.",
      "Basic zeigt nur oeffentliche Liquidity/Holders Signale und markiert fehlenden Lock Proof, Holder Distribution oder Pool Depth klar.",
      "Basic shows public liquidity/holder signals only and clearly marks missing lock proof, holder distribution or pool depth.",
    ),
    proRule: t(
      locale,
      "Pro PDF musi zawierać liquidity visibility, pool depth, holder concentration, lock evidence, exit-liquidity boundary i drugie źródło.",
      "Pro PDF braucht Liquidity Visibility, Pool Depth, Holder Concentration, Lock Evidence, Exit-Liquidity Boundary und zweite Quelle.",
      "Pro PDF must include liquidity visibility, pool depth, holder concentration, lock evidence, exit-liquidity boundary and second-source review.",
    ),
    advancedRule: t(
      locale,
      "Advanced ręcznie sprawdza top holderów, owner/deployer relation, lock/unlock harmonogram, LP token custody i market impact.",
      "Advanced prueft manuell Top Holder, Owner/Deployer Relation, Lock/Unlock Plan, LP Token Custody und Market Impact.",
      "Advanced manually checks top holders, owner/deployer relation, lock/unlock schedule, LP token custody and market impact.",
    ),
    engineMode: "passive public liquidity-risk engine; no trading advice; no active testing; no safety guarantee",
    summary: {
      totalSignals: signals.length,
      confirmed,
      partial,
      missing,
      blocked,
      elevatedOrCritical,
      riskDelta,
      confidenceDelta: confDelta,
      basicVisible: signals.filter((signal) => signal.canShowInBasic).length,
      proRequired: signals.filter((signal) => signal.requiresPro).length,
      liquidityCoverageLabel,
    },
    basicRows: signals.slice(0, 8).map((signal) => ({
      label: signal.label,
      status: signal.state,
      severity: signal.severity,
      output: signal.basicLine,
    })),
    proPdfRows: signals.slice(0, 12).map((signal) => ({
      label: signal.label,
      status: signal.state,
      severity: signal.severity,
      output: signal.proPdfLine,
    })),
    advancedQueue: signals
      .filter((signal) => signal.requiresPro || signal.state === "missing" || signal.state === "blocked")
      .slice(0, 12)
      .map((signal) => `${signal.label}: ${signal.advancedAction}`),
    signals,
  };
}

export function gradeFromLiquidityState(state: Pass2577LiquidityState) {
  if (state === "confirmed") return "confirmed" as const;
  if (state === "partial") return "partial" as const;
  if (state === "blocked") return "blocked" as const;
  if (state === "missing") return "missing" as const;
  return "not_run" as const;
}
