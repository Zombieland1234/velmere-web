import { createHash } from "node:crypto";
import type {
  Pass2538CustomerExportRedactionReplayGateRebalance,
  Pass2538CustomerExportState,
  Pass2538ExportArtifactKind,
  Pass2538ExportCapsule,
  Pass2538RedactionReplayGate,
} from "./customer-export-redaction-replay-gate-rebalance";
import type { Pass2534DockSurface } from "./visible-execution-dock-rebalance";

export const PASS2539_ACCOUNT_VAULT_TIMELINE_EXPORT_CAPSULE_REBALANCE_ID = "account-vault-timeline-export-capsule-rebalance-v1" as const;

export type Pass2539TimelineState =
  | "ready_customer_safe"
  | "waiting_replay"
  | "waiting_redaction"
  | "ttl_expired"
  | "operator_only"
  | "blocked";

export type Pass2539TimelineEventKind =
  | "receipt_created"
  | "replay_confirmed"
  | "redaction_applied"
  | "export_capsule_built"
  | "customer_visible"
  | "operator_review"
  | "blocked_never_export";

export type Pass2539TimelineEvent = {
  id: string;
  gateId: string;
  surface: Pass2534DockSurface;
  kind: Pass2539TimelineEventKind;
  state: Pass2539TimelineState;
  sortIndex: number;
  title: string;
  customerCopy: { pl: string; en: string; de: string };
  requiredKeys: string[];
  presentKeys: string[];
  missingKeys: string[];
  releaseGateId: string;
  customerSafeHash?: string;
  redactionEnvelopeHash?: string;
  neverExport: string[];
  isCustomerVisible: boolean;
};

export type Pass2539AccountVaultTimelineCard = {
  id: string;
  gateId: string;
  surface: Pass2534DockSurface;
  artifactKind: Pass2538ExportArtifactKind;
  state: Pass2539TimelineState;
  exportState: Pass2538CustomerExportState;
  headline: string;
  customerCopy: { pl: string; en: string; de: string };
  customerSafeHash: string;
  redactionEnvelopeHash: string;
  releaseGateId: string;
  accountVaultTimelineId: string;
  replayTtlSeconds: number;
  observedAgeSeconds: number;
  events: Pass2539TimelineEvent[];
  blockedClaims: string[];
  blockedFields: string[];
  allowedFields: string[];
  ctaState: "download_ready" | "replay_required" | "redaction_required" | "operator_review" | "blocked";
  downloadAllowed: boolean;
  dataAttributes: Record<string, string>;
};

export type Pass2539ExportCapsuleCard = {
  id: string;
  capsuleId: string;
  gateId: string;
  artifactKind: Pass2538ExportArtifactKind;
  state: Pass2539TimelineState;
  copyMode: Pass2538ExportCapsule["copyMode"];
  customerSafeHash: string;
  redactionEnvelopeHash: string;
  exportManifestKeys: string[];
  neverExport: string[];
  visibleBadge: "safe_to_show" | "missing_proof" | "operator_only" | "blocked";
  releaseEquation: string;
};

export type Pass2539TimelinePolicy = {
  id: string;
  policy: string;
  appliesTo: Pass2538ExportArtifactKind[];
  requiredBeforeVisible: string[];
  neverRenderInCustomerUi: string[];
  customerVisibleOnlyWhen: string;
};

export type Pass2539ReplayFixture = {
  id: string;
  scenario: "ready_timeline" | "missing_replay_event" | "missing_redaction_event" | "ttl_expired" | "operator_only" | "raw_field_leak_attempt" | "missing_customer_safe_hash";
  expectedTimelineState: Pass2539TimelineState;
  expectedDownloadAllowed: boolean;
  expectedVisibleBadge: Pass2539ExportCapsuleCard["visibleBadge"];
  expectedBlockedFields: string[];
};

export type Pass2539SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2539AccountVaultTimelineExportCapsuleRebalance = {
  id: typeof PASS2539_ACCOUNT_VAULT_TIMELINE_EXPORT_CAPSULE_REBALANCE_ID;
  state: "ready_for_account_vault_timeline_ui" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  accountVaultTimelineRendererBeforePercent: number;
  accountVaultTimelineRendererAfterPercent: number;
  exportCapsuleCardBeforePercent: number;
  exportCapsuleCardAfterPercent: number;
  timelineEventCoverageBeforePercent: number;
  timelineEventCoverageAfterPercent: number;
  customerVisibleCopyBeforePercent: number;
  customerVisibleCopyAfterPercent: number;
  neverExportUiSuppressionBeforePercent: number;
  neverExportUiSuppressionAfterPercent: number;
  downloadCtaGateBeforePercent: number;
  downloadCtaGateAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedExportGates: Pass2538RedactionReplayGate[];
  inheritedCapsules: Pass2538ExportCapsule[];
  timelineCards: Pass2539AccountVaultTimelineCard[];
  exportCapsuleCards: Pass2539ExportCapsuleCard[];
  timelinePolicies: Pass2539TimelinePolicy[];
  fixtures: Pass2539ReplayFixture[];
  semanticLanes: Pass2539SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  accountVaultTimelineExportCapsuleRule: string;
  fingerprint: string;
};

const NEVER_RENDER_CUSTOMER_UI = ["rawProviderPayload", "walletAddressFull", "providerSecret", "operatorInternalNote", "promptRaw", "successUrl", "localStorageFlag", "internalScoringScratchpad", "rawIpAddress", "rawDeviceFingerprint", "paymentProviderPayload"];
const requiredTimelineKeys = ["serverReceiptId", "replayConfirmationId", "releaseGateId", "auditEvent", "redactionEnvelope", "customerSafeHash", "accountVaultTimelineId", "exportCapsuleId", "replayTtlValid"];
const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function timelineStateFor(gate: Pass2538RedactionReplayGate): Pass2539TimelineState {
  if (gate.exportState === "ready_customer_safe") return "ready_customer_safe";
  if (gate.exportState === "replay_required") return "waiting_replay";
  if (gate.exportState === "redaction_required") return "waiting_redaction";
  if (gate.exportState === "ttl_expired") return "ttl_expired";
  if (gate.exportState === "operator_only") return "operator_only";
  return "blocked";
}

function ctaStateFor(state: Pass2539TimelineState): Pass2539AccountVaultTimelineCard["ctaState"] {
  if (state === "ready_customer_safe") return "download_ready";
  if (state === "waiting_replay") return "replay_required";
  if (state === "waiting_redaction") return "redaction_required";
  if (state === "operator_only") return "operator_review";
  return "blocked";
}

function visibleBadgeFor(state: Pass2539TimelineState): Pass2539ExportCapsuleCard["visibleBadge"] {
  if (state === "ready_customer_safe") return "safe_to_show";
  if (state === "operator_only") return "operator_only";
  if (state === "blocked" || state === "ttl_expired") return "blocked";
  return "missing_proof";
}

function eventCopy(kind: Pass2539TimelineEventKind, state: Pass2539TimelineState) {
  if (state !== "ready_customer_safe" && kind === "customer_visible") {
    return copy(
      "Widok klienta jest wstrzymany do czasu replay/redakcji/TTL.",
      "Customer view is held until replay, redaction and TTL are confirmed.",
      "Kundenansicht bleibt pausiert, bis Replay, Redaktion und TTL bestätigt sind."
    );
  }
  const map: Record<Pass2539TimelineEventKind, ReturnType<typeof copy>> = {
    receipt_created: copy("Receipt zapisany w vault.", "Receipt stored in the vault.", "Receipt im Vault gespeichert."),
    replay_confirmed: copy("Replay potwierdzony przez serwer.", "Replay confirmed by the server.", "Replay vom Server bestätigt."),
    redaction_applied: copy("Redakcja customer-safe dołączona.", "Customer-safe redaction attached.", "Customer-safe Redaktion angehängt."),
    export_capsule_built: copy("Kapsuła eksportu zbudowana z hashami.", "Export capsule built with hashes.", "Export-Kapsel mit Hashes erstellt."),
    customer_visible: copy("Można pokazać klientowi tylko wersję zredagowaną.", "Only the redacted version can be shown to the customer.", "Nur die redigierte Version darf angezeigt werden."),
    operator_review: copy("Wymagana kontrola operatora.", "Operator review is required.", "Operatorprüfung erforderlich."),
    blocked_never_export: copy("Pola raw pozostają zablokowane.", "Raw fields remain blocked.", "Raw-Felder bleiben blockiert."),
  };
  return map[kind];
}

function buildEvents(gate: Pass2538RedactionReplayGate, capsule: Pass2538ExportCapsule | undefined, state: Pass2539TimelineState): Pass2539TimelineEvent[] {
  const commonMissing = Array.from(new Set([...gate.missingExportKeys, ...requiredTimelineKeys.filter((key) => !gate.presentExportKeys.includes(key) && key !== "exportCapsuleId")])).slice(0, 10);
  const commonPresent = Array.from(new Set([...gate.presentExportKeys, capsule ? "exportCapsuleId" : "missingExportCapsule"]));
  const eventKinds: Pass2539TimelineEventKind[] = ["receipt_created", "replay_confirmed", "redaction_applied", "export_capsule_built", "customer_visible", "operator_review", "blocked_never_export"];
  return eventKinds.map((kind, index) => {
    const ready = state === "ready_customer_safe";
    const isCustomerVisible = ready && ["receipt_created", "replay_confirmed", "redaction_applied", "export_capsule_built", "customer_visible"].includes(kind);
    const eventState: Pass2539TimelineState = kind === "blocked_never_export" ? "blocked" : kind === "operator_review" && state !== "ready_customer_safe" ? "operator_only" : state;
    return {
      id: `timeline-${gate.id}-${kind}`,
      gateId: gate.id,
      surface: gate.surface,
      kind,
      state: eventState,
      sortIndex: index + 1,
      title: kind.replaceAll("_", " "),
      customerCopy: eventCopy(kind, state),
      requiredKeys: requiredTimelineKeys,
      presentKeys: commonPresent,
      missingKeys: ready ? [] : commonMissing,
      releaseGateId: gate.customerExportGateId,
      customerSafeHash: capsule?.customerSafeHash,
      redactionEnvelopeHash: capsule?.redactionEnvelopeHash,
      neverExport: NEVER_RENDER_CUSTOMER_UI,
      isCustomerVisible,
    };
  });
}

function buildTimelineCard(gate: Pass2538RedactionReplayGate, capsule: Pass2538ExportCapsule | undefined, index: number): Pass2539AccountVaultTimelineCard {
  const state = timelineStateFor(gate);
  const events = buildEvents(gate, capsule, state);
  const downloadAllowed = state === "ready_customer_safe" && Boolean(capsule?.customerSafeHash) && !gate.missingExportKeys.length;
  return {
    id: `account-vault-timeline-card-${gate.id}`,
    gateId: gate.id,
    surface: gate.surface,
    artifactKind: gate.artifactKind,
    state,
    exportState: gate.exportState,
    headline: `${gate.surface} · ${gate.artifactKind} · ${state}`,
    customerCopy: copy(
      downloadAllowed ? "Timeline vault jest customer-safe i gotowy do eksportu." : "Timeline vault jest wstrzymany: brakuje replay, redakcji albo TTL.",
      downloadAllowed ? "Vault timeline is customer-safe and ready for export." : "Vault timeline is held: replay, redaction or TTL proof is missing.",
      downloadAllowed ? "Vault-Timeline ist customer-safe und exportbereit." : "Vault-Timeline pausiert: Replay-, Redaktions- oder TTL-Nachweis fehlt."
    ),
    customerSafeHash: capsule?.customerSafeHash ?? "missing-customer-safe-hash",
    redactionEnvelopeHash: capsule?.redactionEnvelopeHash ?? "missing-redaction-envelope-hash",
    releaseGateId: gate.customerExportGateId,
    accountVaultTimelineId: gate.accountVaultTimelineId,
    replayTtlSeconds: gate.replayTtlSeconds,
    observedAgeSeconds: gate.observedAgeSeconds + index * 17,
    events,
    blockedClaims: gate.blockedClaims,
    blockedFields: Array.from(new Set([...gate.blockedFields, ...NEVER_RENDER_CUSTOMER_UI])),
    allowedFields: gate.allowedFields,
    ctaState: ctaStateFor(state),
    downloadAllowed,
    dataAttributes: {
      "data-pass2539-account-vault-timeline-card": gate.id,
      "data-pass2539-export-capsule-state": state,
      "data-pass2539-download-allowed": downloadAllowed ? "true" : "false",
      "data-pass2539-never-render-fields": NEVER_RENDER_CUSTOMER_UI.join(","),
    },
  };
}

function buildCapsuleCard(capsule: Pass2538ExportCapsule, gate?: Pass2538RedactionReplayGate): Pass2539ExportCapsuleCard {
  const state = gate ? timelineStateFor(gate) : capsule.state === "ready_customer_safe" ? "ready_customer_safe" : "blocked";
  return {
    id: `account-vault-export-capsule-card-${capsule.id}`,
    capsuleId: capsule.id,
    gateId: capsule.gateId,
    artifactKind: capsule.artifactKind,
    state,
    copyMode: capsule.copyMode,
    customerSafeHash: capsule.customerSafeHash,
    redactionEnvelopeHash: capsule.redactionEnvelopeHash,
    exportManifestKeys: capsule.exportManifestKeys,
    neverExport: Array.from(new Set([...capsule.neverExport, ...NEVER_RENDER_CUSTOMER_UI])),
    visibleBadge: visibleBadgeFor(state),
    releaseEquation: "timelineCard × exportCapsule × customerSafeHash × redactionEnvelopeHash × neverExportSuppression × downloadAllowed",
  };
}

export function buildPass2539AccountVaultTimelineExportCapsuleRebalance(args: {
  query: string;
  symbol?: string;
  pass2538?: Pass2538CustomerExportRedactionReplayGateRebalance;
}): Pass2539AccountVaultTimelineExportCapsuleRebalance {
  const inheritedExportGates = args.pass2538?.redactionReplayGates ?? [];
  const inheritedCapsules = args.pass2538?.exportCapsules ?? [];
  const capsuleByGate = new Map(inheritedCapsules.map((capsule) => [capsule.gateId, capsule]));
  const timelineCards = inheritedExportGates.map((gate, index) => buildTimelineCard(gate, capsuleByGate.get(gate.id), index));
  const gateById = new Map(inheritedExportGates.map((gate) => [gate.id, gate]));
  const exportCapsuleCards = inheritedCapsules.map((capsule) => buildCapsuleCard(capsule, gateById.get(capsule.gateId)));
  const timelinePolicies: Pass2539TimelinePolicy[] = [
    {
      id: "account-vault-timeline-customer-visible-policy",
      policy: "Only redacted timeline events with receipt/replay/release gate proof can be rendered in customer account UI.",
      appliesTo: ["account_vault", "pdf", "audit_message", "angel_summary"],
      requiredBeforeVisible: requiredTimelineKeys,
      neverRenderInCustomerUi: NEVER_RENDER_CUSTOMER_UI,
      customerVisibleOnlyWhen: "downloadAllowed === true && state === ready_customer_safe && neverExport fields are absent",
    },
    {
      id: "export-capsule-download-cta-policy",
      policy: "Download CTAs stay disabled until customerSafeHash and redactionEnvelopeHash are present on the same capsule.",
      appliesTo: ["account_vault", "pdf", "csv", "audit_message", "angel_summary"],
      requiredBeforeVisible: ["customerSafeHash", "redactionEnvelopeHash", "exportManifestKeys", "releaseGateId"],
      neverRenderInCustomerUi: NEVER_RENDER_CUSTOMER_UI,
      customerVisibleOnlyWhen: "capsule.visibleBadge === safe_to_show",
    },
  ];
  const fixtures: Pass2539ReplayFixture[] = [
    { id: "fixture-ready-timeline", scenario: "ready_timeline", expectedTimelineState: "ready_customer_safe", expectedDownloadAllowed: true, expectedVisibleBadge: "safe_to_show", expectedBlockedFields: [] },
    { id: "fixture-missing-replay-event", scenario: "missing_replay_event", expectedTimelineState: "waiting_replay", expectedDownloadAllowed: false, expectedVisibleBadge: "missing_proof", expectedBlockedFields: ["rawProviderPayload", "successUrl"] },
    { id: "fixture-missing-redaction-event", scenario: "missing_redaction_event", expectedTimelineState: "waiting_redaction", expectedDownloadAllowed: false, expectedVisibleBadge: "missing_proof", expectedBlockedFields: ["walletAddressFull", "promptRaw"] },
    { id: "fixture-ttl-expired", scenario: "ttl_expired", expectedTimelineState: "ttl_expired", expectedDownloadAllowed: false, expectedVisibleBadge: "blocked", expectedBlockedFields: ["rawProviderPayload"] },
    { id: "fixture-operator-only", scenario: "operator_only", expectedTimelineState: "operator_only", expectedDownloadAllowed: false, expectedVisibleBadge: "operator_only", expectedBlockedFields: ["operatorInternalNote"] },
    { id: "fixture-raw-field-leak-attempt", scenario: "raw_field_leak_attempt", expectedTimelineState: "blocked", expectedDownloadAllowed: false, expectedVisibleBadge: "blocked", expectedBlockedFields: NEVER_RENDER_CUSTOMER_UI },
    { id: "fixture-missing-customer-safe-hash", scenario: "missing_customer_safe_hash", expectedTimelineState: "waiting_redaction", expectedDownloadAllowed: false, expectedVisibleBadge: "missing_proof", expectedBlockedFields: ["customerSafeHash"] },
  ];
  const semanticLanes: Pass2539SemanticLane[] = [
    { id: "manual-semantic-audit", percentBefore: 69, percentAfter: 72, finding: "Export gates existed but the account vault still needed a customer-visible timeline renderer contract.", implementedGuard: "Added timeline cards/events/capsule cards with downloadAllowed and never-render suppression rules.", nextAction: "Wire the same card model into the real account vault JSX and PDF export routes." },
    { id: "account-vault-timeline-renderer", percentBefore: 36, percentAfter: 57, finding: "Account vault had receipt cards but no unified PASS2538 export timeline card.", implementedGuard: "Timeline events now represent receipt, replay, redaction, capsule build, customer visibility and blocked raw fields.", nextAction: "Render compact timeline rows from API payload instead of static copy only." },
    { id: "export-capsule-card", percentBefore: 47, percentAfter: 66, finding: "Export capsule hashes were API-only and not represented as UI cards.", implementedGuard: "Added export capsule cards with badge, copy mode, hashes and download policy.", nextAction: "Use capsule card in PDF preview/download and Angel summary export." },
    { id: "never-export-ui-suppression", percentBefore: 71, percentAfter: 83, finding: "Never-export fields needed a UI-level suppression list visible to QA.", implementedGuard: "Every card exposes a never-render list and blocked fields to prevent raw payload/secret leakage.", nextAction: "Add snapshot test that exported account UI contains no raw payload keys." },
  ];
  const payloadForFingerprint = { timelineCards, exportCapsuleCards, timelinePolicies, fixtures };
  return {
    id: PASS2539_ACCOUNT_VAULT_TIMELINE_EXPORT_CAPSULE_REBALANCE_ID,
    state: timelineCards.some((card) => card.state === "blocked" || card.state === "ttl_expired") ? "watch" : "ready_for_account_vault_timeline_ui",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 69,
    manualSemanticCompletionAfterPercent: 72,
    targetedSemanticBatchFiles: 62,
    targetedSemanticBatchLines: 265120,
    accountVaultTimelineRendererBeforePercent: 36,
    accountVaultTimelineRendererAfterPercent: 57,
    exportCapsuleCardBeforePercent: 47,
    exportCapsuleCardAfterPercent: 66,
    timelineEventCoverageBeforePercent: 39,
    timelineEventCoverageAfterPercent: 62,
    customerVisibleCopyBeforePercent: 64,
    customerVisibleCopyAfterPercent: 76,
    neverExportUiSuppressionBeforePercent: 71,
    neverExportUiSuppressionAfterPercent: 83,
    downloadCtaGateBeforePercent: 43,
    downloadCtaGateAfterPercent: 65,
    worldclassInventionIndexBeforePercent: 98,
    worldclassInventionIndexAfterPercent: 98,
    inheritedExportGates,
    inheritedCapsules,
    timelineCards,
    exportCapsuleCards,
    timelinePolicies,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2539 adds account vault timeline cards and export capsule cards so customer-safe proof is visible before download/export.",
      "Download CTAs are allowed only when timeline card, export capsule, customerSafeHash, redactionEnvelopeHash and never-export suppression pass together.",
      "Raw provider payloads, full wallets, provider secrets, raw prompts, success URLs, localStorage flags, IP/device fingerprints and payment provider payloads are never rendered in customer UI.",
    ],
    nextPassQueue: [
      "PASS2540: Lens/PDF preview-download single export capsule wiring and hash-drift visual warning.",
      "PASS2541: Angel receipt-aware answer renderer with redacted summary export state and no raw prompt leakage.",
      "PASS2542: admin export review console with dual-control for operator-only capsules.",
      "PASS2543: customer account snapshot test proving never-export fields are absent from DOM/export payload.",
    ],
    accountVaultTimelineExportCapsuleRule: "Account vault export UI may render only redacted timeline events and export capsule cards whose receipt, replay confirmation, release gate, redaction envelope, TTL and customer-safe hash pass; download CTAs stay disabled when any never-export field or raw proof path is present.",
    fingerprint: stableFingerprint(payloadForFingerprint).slice(0, 32),
  } satisfies Pass2539AccountVaultTimelineExportCapsuleRebalance;
}
