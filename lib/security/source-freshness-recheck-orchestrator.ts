import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { Pass2575AuditSourceFreshnessReport, Pass2575FreshnessState } from "./audit-source-freshness";
import type { Pass2581AuditVersionedRecheckReceiptReport, Pass2581RecheckPriority } from "./audit-versioned-recheck-receipt";
import type { Pass2588AuditCaseVaultPrivateDeliveryLedgerReport } from "./audit-case-vault-private-delivery-ledger";

export const PASS2589_SOURCE_FRESHNESS_RECHECK_ORCHESTRATOR_ID = "source-freshness-recheck-orchestrator" as const;

export type Pass2589RecheckStatus = "scheduled" | "ready" | "watch" | "blocked" | "frozen" | "private";
export type Pass2589RecheckFamily =
  | "ttl_expiry"
  | "material_change"
  | "provider_replay"
  | "receipt_versioning"
  | "customer_visibility"
  | "operator_queue"
  | "vault_binding"
  | "confidence_decay"
  | "no_mutation_guard";

export type Pass2589RecheckLane = {
  id: string;
  family: Pass2589RecheckFamily;
  label: string;
  status: Pass2589RecheckStatus;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  trigger: string;
  nextRunAt?: string;
  ttlMinutes: number;
  blocksFinalSign: boolean;
  createsNewVersion: boolean;
  privateFields: string[];
};

export type Pass2589RecheckRow = {
  label: string;
  status: Pass2589RecheckStatus;
  output: string;
};

export type Pass2589SourceFreshnessRecheckOrchestratorReport = {
  passId: typeof PASS2589_SOURCE_FRESHNESS_RECHECK_ORCHESTRATOR_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  rule: string;
  customerRule: string;
  operatorRule: string;
  schedulerRule: string;
  /** PASS4143 top-level compatibility alias for narrative consumers. */
  noSilentMutationRule: string;
  summary: {
    totalLanes: number;
    scheduled: number;
    ready: number;
    watch: number;
    blocked: number;
    frozen: number;
    private: number;
    orchestratorReadiness: number;
    freshnessReplayReadiness: number;
    versionSafetyReadiness: number;
    nextRecheckAt: string;
    canRunSafeRecheck: boolean;
    mustCreateNewVersion: boolean;
    canFinalSignAfterRecheck: boolean;
    /** PASS4143 compatibility alias for old narrative/launch consumers. */
    topFreshnessRisk: string;
    /** PASS4143 compatibility alias for old narrative/launch consumers. */
    noSilentMutationRule: string;
    nextBlockingLane: string;
  };
  lanes: Pass2589RecheckLane[];
  customerRows: Pass2589RecheckRow[];
  proPdfRows: Pass2589RecheckRow[];
  operatorRows: Pass2589RecheckRow[];
  scheduledRecheckContract: {
    scheduleId: string;
    boundReceiptId?: string;
    boundReportVersion?: string;
    boundContentHash?: string;
    boundVaultId?: string;
    nextCheckAt: string;
    priority: Pass2581RecheckPriority;
    triggerPolicy: string[];
    noSilentMutationRule: string;
    versionBumpRule: string;
  };
  sourceExpiryPolicy: Array<{ family: string; ttl: string; action: string }>;
  replayDiffPolicy: {
    compareAgainst: string[];
    materialChangeThresholds: string[];
    customerSafeDiff: string[];
    operatorOnlyDiff: string[];
  };
  visualMergeContract: {
    publicSlot: string;
    proPdfSlot: string;
    operatorSlot: string;
    rule: string;
    keepWired: string[];
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = {
  locale?: string;
  chain?: string;
  contractAddress?: string;
  projectName?: string;
  reviewLevel?: string;
  sourceFreshness?: Pass2575AuditSourceFreshnessReport | null;
  versionedRecheckReceipt?: Pass2581AuditVersionedRecheckReceiptReport | null;
  auditCaseVaultPrivateDeliveryLedger?: Pass2588AuditCaseVaultPrivateDeliveryLedgerReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function stableSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "recheck";
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(values: string[], max = 10) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function ttlMinutesFor(state: Pass2575FreshnessState | undefined, index: number) {
  if (state === "fresh") return 30;
  if (state === "acceptable") return 20;
  if (state === "stale") return 8;
  if (state === "expired") return 1;
  if (state === "static") return 24 * 60;
  if (state === "blocked") return 120;
  return index % 2 === 0 ? 15 : 60;
}

function statusFromFreshness(state: Pass2575FreshnessState | undefined): Pass2589RecheckStatus {
  if (state === "fresh" || state === "acceptable") return "scheduled";
  if (state === "stale" || state === "expired") return "ready";
  if (state === "static") return "frozen";
  if (state === "blocked") return "blocked";
  return "watch";
}

function stateWord(locale: string, status: Pass2589RecheckStatus) {
  if (status === "scheduled") return t(locale, "zaplanowane", "geplant", "scheduled");
  if (status === "ready") return t(locale, "gotowe do re-checku", "bereit fuer Re-Check", "ready for re-check");
  if (status === "watch") return t(locale, "obserwacja", "Watch", "watch");
  if (status === "frozen") return t(locale, "zamrożone", "eingefroren", "frozen");
  if (status === "private") return t(locale, "prywatne", "privat", "private");
  return t(locale, "zablokowane", "blockiert", "blocked");
}

function lane(args: Pass2589RecheckLane): Pass2589RecheckLane {
  return { ...args, privateFields: uniq(args.privateFields, 8) };
}

function row(label: string, status: Pass2589RecheckStatus, output: string): Pass2589RecheckRow {
  return { label, status, output };
}

function readiness(items: Pass2589RecheckLane[], predicate?: (item: Pass2589RecheckLane) => boolean) {
  const scoped = predicate ? items.filter(predicate) : items;
  const good = scoped.filter((item) => item.status === "scheduled" || item.status === "frozen" || item.status === "private").length;
  const ready = scoped.filter((item) => item.status === "ready").length;
  const watch = scoped.filter((item) => item.status === "watch").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((good / Math.max(1, scoped.length)) * 96 + ready * 4 - watch * 7 - blocked * 24, 0, 100);
}

export function buildPass2589SourceFreshnessRecheckOrchestratorReport(input: BuilderInput): Pass2589SourceFreshnessRecheckOrchestratorReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const now = new Date();
  const freshness = input.sourceFreshness;
  const receipt = input.versionedRecheckReceipt;
  const vault = input.auditCaseVaultPrivateDeliveryLedger;
  const chain = clean(input.chain, 40) ?? receipt?.target.chain ?? vault?.target.chain ?? freshness?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? receipt?.target.contractAddress ?? vault?.target.contractAddress ?? freshness?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? receipt?.target.projectName ?? vault?.target.projectName ?? freshness?.target.projectName;
  const targetKey = contractAddress ?? projectName ?? "audit-target";
  const priority = receipt?.recheckPlan.priority ?? (freshness?.summary.expired ? "high" : "normal");
  const baseNextCheck = receipt?.recheckPlan.nextCheckAt ?? addMinutes(now, priority === "critical" ? 10 : priority === "high" ? 30 : 90);
  const boundReceipt = receipt?.receipt.receiptId;
  const boundVersion = receipt?.receipt.reportVersion;
  const boundHash = receipt?.receipt.contentHash;
  const boundVault = vault?.vaultId;
  const scheduleId = `vlm-recheck-${stableSlug(chain)}-${shortHash(`${targetKey}:${boundReceipt ?? "no-receipt"}:${baseNextCheck}`)}`;
  const freshnessRows = freshness?.lanes ?? [];

  const providerLanes = freshnessRows.slice(0, 7).map((item, index) => {
    const status = statusFromFreshness(item.freshnessState);
    const ttlMinutes = Math.max(1, Math.round((item.maxAgeMs ?? ttlMinutesFor(item.freshnessState, index) * 60_000) / 60_000));
    const nextRunAt = item.expiresAt ?? addMinutes(now, ttlMinutesFor(item.freshnessState, index));
    const trigger = item.freshnessState === "expired" || item.freshnessState === "stale"
      ? "source TTL reached or close to expiry"
      : item.freshnessState === "static"
        ? "manual scope/date check before strong claim"
        : "scheduled TTL replay";
    const label = `${item.label} freshness replay`;
    return lane({
      id: `freshness-${item.id}`.slice(0, 90),
      family: "provider_replay",
      label,
      status,
      customerLine: t(
        locale,
        `${item.provider}: re-check ${stateWord(locale, status)}; stare wyniki zostają jako wersja ${boundVersion ?? "draft"}.`,
        `${item.provider}: Re-Check ${stateWord(locale, status)}; alte Ergebnisse bleiben Version ${boundVersion ?? "draft"}.`,
        `${item.provider}: re-check is ${stateWord(locale, status)}; old results stay as version ${boundVersion ?? "draft"}.`,
      ),
      proPdfLine: `${item.provider}: freshness=${item.freshnessState}; ttl=${ttlMinutes}m; nextRunAt=${nextRunAt}; noSilentMutation=true`,
      operatorLine: `${item.provider}: compare new payload against receipt/hash before replacing any customer-visible claim.`,
      trigger,
      nextRunAt,
      ttlMinutes,
      blocksFinalSign: status === "ready" || status === "blocked",
      createsNewVersion: status === "ready",
      privateFields: ["raw provider payload", "operator replay diff", "API key error details"],
    });
  });

  const lanes: Pass2589RecheckLane[] = [
    ...providerLanes,
    lane({
      id: "receipt-versioning",
      family: "receipt_versioning",
      label: "Receipt/version binding",
      status: boundReceipt && boundVersion && boundHash ? "scheduled" : "blocked",
      customerLine: boundReceipt
        ? t(locale, "Re-check jest związany z istniejącym receipt i nie nadpisze starego raportu.", "Re-Check ist an das bestehende Receipt gebunden und ueberschreibt den alten Report nicht.", "Re-check is bound to the existing receipt and will not overwrite the old report.")
        : t(locale, "Brakuje receipt, więc re-check nie może być finalnie podpisany.", "Receipt fehlt; Re-Check kann nicht final signiert werden.", "Receipt is missing, so the re-check cannot be final-signed."),
      proPdfLine: `receipt=${boundReceipt ?? "missing"}; version=${boundVersion ?? "missing"}; contentHash=${boundHash ?? "missing"}; new material change => new version`,
      operatorLine: "If any material claim changes, create a new report version and keep the old hash immutable.",
      trigger: "receipt/hash mismatch or material source change",
      nextRunAt: baseNextCheck,
      ttlMinutes: 60,
      blocksFinalSign: !(boundReceipt && boundVersion && boundHash),
      createsNewVersion: false,
      privateFields: ["operator diff notes"],
    }),
    lane({
      id: "case-vault-binding",
      family: "vault_binding",
      label: "Case vault binding",
      status: boundVault && vault?.summary.canPersistCase ? "private" : "watch",
      customerLine: boundVault
        ? t(locale, "Re-check ma prywatny case vault pointer; klient widzi status, nie surowy payload.", "Re-Check hat einen privaten Case-Vault-Pointer; Kunde sieht Status, nicht Raw Payload.", "Re-check has a private case-vault pointer; the customer sees status, not raw payload.")
        : t(locale, "Case vault pointer jest jeszcze w trybie preview.", "Case-Vault-Pointer ist noch im Preview-Modus.", "Case vault pointer is still in preview mode."),
      proPdfLine: `vault=${boundVault ?? "preview"}; privateDelivery=${vault?.summary.canDeliverPrivateReport ?? false}; pointerOnly=true`,
      operatorLine: "Store re-check diff in the private vault; public Basic only receives status rows.",
      trigger: "paid delivery or operator handoff needs replay context",
      nextRunAt: baseNextCheck,
      ttlMinutes: 240,
      blocksFinalSign: false,
      createsNewVersion: false,
      privateFields: ["vaultId", "accountId", "privateDeliveryPointer", "operator timeline"],
    }),
    lane({
      id: "no-silent-mutation-guard",
      family: "no_mutation_guard",
      label: "No silent mutation guard",
      status: "frozen",
      customerLine: t(locale, "Stary raport zostaje zamrożony; zmiana źródeł tworzy nową wersję.", "Alter Report bleibt eingefroren; Quellenwechsel erzeugt neue Version.", "Old report stays frozen; source changes create a new version."),
      proPdfLine: "immutable previous PDF + new version on material diff + customer-safe changelog",
      operatorLine: "Never mutate a signed customer report in place. Append new receipt/version only.",
      trigger: "any material diff in risk, owner/proxy, liquidity, holders, blacklist/tax, source confidence",
      nextRunAt: baseNextCheck,
      ttlMinutes: 0,
      blocksFinalSign: false,
      createsNewVersion: true,
      privateFields: ["raw diff", "operator rationale"],
    }),
    lane({
      id: "customer-visibility-envelope",
      family: "customer_visibility",
      label: "Customer visibility envelope",
      status: "scheduled",
      customerLine: t(locale, "Klient widzi wersję, następny re-check i braki; nie widzi kluczy/API ani prywatnych notatek.", "Kunde sieht Version, naechsten Re-Check und Luecken; keine Keys/API oder private Notes.", "Customer sees version, next re-check and gaps; never keys/API/private notes."),
      proPdfLine: "customer-safe: version, nextCheckAt, changed evidence summary, missing evidence, confidence delta",
      operatorLine: "Keep raw provider response, API failures and manual notes operator-only.",
      trigger: "customer opens Basic/Pro/Advanced delivery status",
      nextRunAt: baseNextCheck,
      ttlMinutes: 1440,
      blocksFinalSign: false,
      createsNewVersion: false,
      privateFields: ["raw API response", "API keys", "manual reviewer notes"],
    }),
  ];

  const scheduled = lanes.filter((item) => item.status === "scheduled").length;
  const ready = lanes.filter((item) => item.status === "ready").length;
  const watch = lanes.filter((item) => item.status === "watch").length;
  const blocked = lanes.filter((item) => item.status === "blocked").length;
  const frozen = lanes.filter((item) => item.status === "frozen").length;
  const privateCount = lanes.filter((item) => item.status === "private").length;
  const nextBlockingLane = lanes.find((item) => item.blocksFinalSign)?.label ?? "none";
  const mustCreateNewVersion = lanes.some((item) => item.createsNewVersion && item.status === "ready");
  const orchestratorReadiness = readiness(lanes);
  const freshnessReplayReadiness = readiness(lanes, (item) => item.family === "provider_replay" || item.family === "ttl_expiry" || item.family === "confidence_decay");
  const versionSafetyReadiness = readiness(lanes, (item) => item.family === "receipt_versioning" || item.family === "no_mutation_guard" || item.family === "vault_binding");
  const nextRecheckAt = lanes
    .map((item) => item.nextRunAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? baseNextCheck;

  return {
    passId: PASS2589_SOURCE_FRESHNESS_RECHECK_ORCHESTRATOR_ID,
    generatedAt: now.toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2589 turns source freshness into a scheduled re-check orchestrator: every material replay creates a new version instead of mutating the old report.",
    customerRule: t(
      locale,
      "Raport ma harmonogram re-checku: stare wersje zostają zamrożone, a istotne zmiany tworzą nowy receipt/version.",
      "Der Report hat einen Re-Check-Zeitplan: alte Versionen bleiben eingefroren, materielle Aenderungen erzeugen neues Receipt/Version.",
      "The report has a re-check schedule: old versions stay frozen and material changes create a new receipt/version.",
    ),
    operatorRule: "Operator must compare replayed sources against the bound receipt/hash and deliver a customer-safe diff, not raw provider payloads.",
    schedulerRule: "Run source replay by TTL, material-change triggers, payment/private-delivery queue, or operator request; never overwrite a signed report.",
    noSilentMutationRule: "Never silently mutate a signed audit report; create a new receipt/version for material source changes.",
    summary: {
      totalLanes: lanes.length,
      scheduled,
      ready,
      watch,
      blocked,
      frozen,
      private: privateCount,
      orchestratorReadiness,
      freshnessReplayReadiness,
      versionSafetyReadiness,
      nextRecheckAt,
      canRunSafeRecheck: blocked === 0 && Boolean(boundReceipt || boundVault),
      mustCreateNewVersion,
      canFinalSignAfterRecheck: blocked === 0 && lanes.every((item) => !item.blocksFinalSign),
      topFreshnessRisk: nextBlockingLane,
      noSilentMutationRule: "Never silently mutate a signed audit report; create a new receipt/version for material source changes.",
      nextBlockingLane,
    },
    lanes,
    customerRows: lanes.slice(0, 9).map((item) => row(item.label, item.status, item.customerLine)),
    proPdfRows: lanes.slice(0, 12).map((item) => row(item.label, item.status, item.proPdfLine)),
    operatorRows: lanes.map((item) => row(item.label, item.status, item.operatorLine)),
    scheduledRecheckContract: {
      scheduleId,
      boundReceiptId: boundReceipt,
      boundReportVersion: boundVersion,
      boundContentHash: boundHash,
      boundVaultId: boundVault,
      nextCheckAt: nextRecheckAt,
      priority,
      triggerPolicy: uniq([
        ...(receipt?.recheckPlan.triggers ?? []),
        "source TTL expires",
        "risk score changes by 8+ points",
        "owner/admin/proxy/liquidity/holder lane changes",
        "source confidence drops below final-sign threshold",
      ], 9),
      noSilentMutationRule: "Existing report receipts are immutable; replay output is appended as a new version/diff.",
      versionBumpRule: "New version required for material risk, permission, liquidity, holder, source-confidence or final-verdict changes.",
    },
    sourceExpiryPolicy: [
      { family: "market/liquidity", ttl: "2-5m", action: "refresh before strong price/liquidity claim" },
      { family: "security flags", ttl: "30m", action: "refresh before Pro/Advanced final sign" },
      { family: "explorer source/ABI", ttl: "6h", action: "refresh before permission map finalization" },
      { family: "docs/audit PDF", ttl: "7d", action: "scope-match and date-check before customer PDF" },
    ],
    replayDiffPolicy: {
      compareAgainst: ["receipt.contentHash", "receipt.reportVersion", "source lane status", "final verdict", "source confidence"],
      materialChangeThresholds: ["risk score delta >= 8", "source confidence delta >= 10", "owner/proxy/admin lane changed", "liquidity/holder risk changed", "new missing-evidence blocker"],
      customerSafeDiff: ["what changed", "why it matters", "new version id", "new nextCheckAt", "remaining missing evidence"],
      operatorOnlyDiff: ["raw provider payload", "API error details", "manual notes", "private delivery pointer", "account/vault identifiers"],
    },
    visualMergeContract: {
      publicSlot: "Basic audit -> re-check schedule/status card",
      proPdfSlot: "Pro PDF -> version changelog + next re-check row",
      operatorSlot: "Advanced console -> replay diff queue",
      rule: "User visual design may replace layout, but scheduleId, nextCheckAt, triggerPolicy, noSilentMutationRule and customer-safe diff must stay wired.",
      keepWired: ["scheduledRecheckContract.scheduleId", "scheduledRecheckContract.nextCheckAt", "summary.mustCreateNewVersion", "summary.canFinalSignAfterRecheck", "replayDiffPolicy.customerSafeDiff"],
      doNotExpose: ["raw provider payload", "API key state", "operator private notes", "account/vault private IDs in public Basic"],
    },
    nextImplementationBacklog: [
      "Persist scheduled re-check records in durable storage with idempotent scheduleId.",
      "Add background worker/webhook runner after deployment environment is chosen.",
      "Add customer-safe changelog component to account delivery screen.",
      "Add operator replay diff viewer with redaction approval.",
      "Bind re-check completion to new PASS2581 receipt/version creation.",
    ],
  };
}
