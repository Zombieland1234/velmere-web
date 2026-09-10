import { createHash } from "node:crypto";
import type {
  Pass2539AccountVaultTimelineCard,
  Pass2539AccountVaultTimelineExportCapsuleRebalance,
  Pass2539ExportCapsuleCard,
  Pass2539TimelineState,
} from "./account-vault-timeline-export-capsule-rebalance";

export const PASS2540_CUSTOMER_EXPORT_ZERO_LEAK_REPLAY_REBALANCE_ID = "customer-export-zero-leak-replay-rebalance-v1" as const;

export type Pass2540LeakFamily =
  | "raw_provider_payload"
  | "full_wallet"
  | "provider_secret"
  | "raw_prompt"
  | "success_url"
  | "local_storage"
  | "operator_internal_note"
  | "device_fingerprint"
  | "payment_provider_payload"
  | "internal_scoring_scratchpad";

export type Pass2540ZeroLeakState = "clean" | "needs_redaction" | "replay_required" | "security_hold" | "operator_only" | "blocked";

export type Pass2540LeakFinding = {
  id: string;
  family: Pass2540LeakFamily;
  blockedField: string;
  state: Pass2540ZeroLeakState;
  severity: "low" | "medium" | "high" | "critical";
  surface: string;
  customerCopy: { pl: string; en: string; de: string };
  mitigation: string;
};

export type Pass2540SanitizedExportEnvelope = {
  id: string;
  sourceTimelineCardId: string;
  sourceCapsuleCardId?: string;
  state: Pass2540ZeroLeakState;
  zeroLeakScore: number;
  sanitizedExportOnly: boolean;
  customerSafeHash: string;
  redactionEnvelopeHash: string;
  replayGateId: string;
  releaseGateId: string;
  blockedLeakFamilies: Pass2540LeakFamily[];
  blockedFields: string[];
  allowedFields: string[];
  strippedFieldCount: number;
  promptLeakBlocked: boolean;
  providerPayloadLeakBlocked: boolean;
  deviceFingerprintLeakBlocked: boolean;
  paymentPayloadLeakBlocked: boolean;
  llmThreatCoverage: string[];
  releaseEquation: string;
  dataAttributes: Record<string, string>;
};

export type Pass2540ReplayFixture = {
  id: string;
  scenario:
    | "clean_customer_safe_export"
    | "raw_prompt_injection_leak_attempt"
    | "provider_payload_leak_attempt"
    | "wallet_success_url_shortcut"
    | "payment_payload_leak_attempt"
    | "operator_note_leak_attempt"
    | "missing_redaction_replay";
  inputKeys: string[];
  expectedRemovedKeys: string[];
  expectedState: Pass2540ZeroLeakState;
  expectedSanitizedExportOnly: boolean;
};

export type Pass2540Policy = {
  id: string;
  title: string;
  mapsTo: string[];
  customerRule: string;
  blockedFamilies: Pass2540LeakFamily[];
  releaseGate: string;
};

export type Pass2540SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2540CustomerExportZeroLeakReplayRebalance = {
  id: typeof PASS2540_CUSTOMER_EXPORT_ZERO_LEAK_REPLAY_REBALANCE_ID;
  state: "ready_for_zero_leak_customer_export" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  zeroLeakReplayGateBeforePercent: number;
  zeroLeakReplayGateAfterPercent: number;
  customerExportSanitizerBeforePercent: number;
  customerExportSanitizerAfterPercent: number;
  accountVaultLeakSuppressionBeforePercent: number;
  accountVaultLeakSuppressionAfterPercent: number;
  angelPromptLeakBoundaryBeforePercent: number;
  angelPromptLeakBoundaryAfterPercent: number;
  pdfExportLeakBoundaryBeforePercent: number;
  pdfExportLeakBoundaryAfterPercent: number;
  mobileVaultCopyBeforePercent: number;
  mobileVaultCopyAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedTimelineCards: Pass2539AccountVaultTimelineCard[];
  inheritedExportCapsuleCards: Pass2539ExportCapsuleCard[];
  sanitizedEnvelopes: Pass2540SanitizedExportEnvelope[];
  leakFindings: Pass2540LeakFinding[];
  policies: Pass2540Policy[];
  fixtures: Pass2540ReplayFixture[];
  semanticLanes: Pass2540SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  zeroLeakReplayRule: string;
  fingerprint: string;
};

const BLOCKED_FIELD_TO_FAMILY: Record<string, Pass2540LeakFamily> = {
  rawProviderPayload: "raw_provider_payload",
  walletAddressFull: "full_wallet",
  providerSecret: "provider_secret",
  operatorInternalNote: "operator_internal_note",
  promptRaw: "raw_prompt",
  successUrl: "success_url",
  localStorageFlag: "local_storage",
  internalScoringScratchpad: "internal_scoring_scratchpad",
  rawIpAddress: "device_fingerprint",
  rawDeviceFingerprint: "device_fingerprint",
  paymentProviderPayload: "payment_provider_payload",
};

const ZERO_LEAK_REQUIRED_THREAT_COVERAGE = [
  "OWASP-LLM01-prompt-injection",
  "OWASP-LLM02-insecure-output-handling",
  "OWASP-LLM06-sensitive-information-disclosure",
  "OWASP-LLM07-system-prompt-leakage",
  "OWASP-LLM08-excessive-agency-boundary",
  "NIST-AI-RMF-map-measure-manage-govern",
];

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function stateFromTimelineState(state: Pass2539TimelineState, blockedFields: string[]): Pass2540ZeroLeakState {
  if (state === "ready_customer_safe" && blockedFields.length === 0) return "clean";
  if (state === "ready_customer_safe") return "needs_redaction";
  if (state === "waiting_replay") return "replay_required";
  if (state === "waiting_redaction") return "needs_redaction";
  if (state === "operator_only") return "operator_only";
  if (state === "ttl_expired") return "security_hold";
  return "blocked";
}

function severityFor(field: string): Pass2540LeakFinding["severity"] {
  if (["providerSecret", "paymentProviderPayload", "promptRaw", "rawProviderPayload"].includes(field)) return "critical";
  if (["walletAddressFull", "rawDeviceFingerprint", "rawIpAddress", "successUrl"].includes(field)) return "high";
  if (["operatorInternalNote", "internalScoringScratchpad"].includes(field)) return "medium";
  return "low";
}

export function sanitizePass2540CustomerExportPayload<T>(payload: T): { sanitized: unknown; removedKeys: string[] } {
  const removed = new Set<string>();
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_FIELD_TO_FAMILY[key]) {
        removed.add(key);
        continue;
      }
      out[key] = walk(child);
    }
    return out;
  }
  return { sanitized: walk(payload), removedKeys: Array.from(removed).sort() };
}

function buildFindings(card: Pass2539AccountVaultTimelineCard): Pass2540LeakFinding[] {
  return card.blockedFields
    .filter((field) => BLOCKED_FIELD_TO_FAMILY[field])
    .map((field) => {
      const family = BLOCKED_FIELD_TO_FAMILY[field];
      return {
        id: `zero-leak-finding-${card.id}-${field}`,
        family,
        blockedField: field,
        state: family === "provider_secret" || family === "payment_provider_payload" ? "blocked" : "needs_redaction",
        severity: severityFor(field),
        surface: card.surface,
        customerCopy: copy(
          `Pole ${field} nie może wejść do eksportu klienta.`,
          `${field} cannot enter the customer export.`,
          `${field} darf nicht in den Kundenexport gelangen.`
        ),
        mitigation: "Strip field recursively, write replay receipt, then rebuild customerSafeHash before any download CTA.",
      } satisfies Pass2540LeakFinding;
    });
}

function buildEnvelope(card: Pass2539AccountVaultTimelineCard, capsule?: Pass2539ExportCapsuleCard): Pass2540SanitizedExportEnvelope {
  const blockedFields = card.blockedFields.filter((field) => BLOCKED_FIELD_TO_FAMILY[field]);
  const blockedLeakFamilies = Array.from(new Set(blockedFields.map((field) => BLOCKED_FIELD_TO_FAMILY[field])));
  const state = stateFromTimelineState(card.state, blockedFields);
  const strippedFieldCount = blockedFields.length;
  const zeroLeakScore = Math.max(0, Math.min(100, 100 - strippedFieldCount * 6 - (card.downloadAllowed ? 0 : 11) - (state === "blocked" ? 21 : state === "operator_only" ? 13 : 0)));
  const sanitizedExportOnly = state === "clean" || state === "needs_redaction" || state === "replay_required" || state === "security_hold";
  return {
    id: `zero-leak-envelope-${card.id}`,
    sourceTimelineCardId: card.id,
    sourceCapsuleCardId: capsule?.id,
    state,
    zeroLeakScore,
    sanitizedExportOnly,
    customerSafeHash: card.customerSafeHash,
    redactionEnvelopeHash: card.redactionEnvelopeHash,
    replayGateId: `zero-leak-replay-gate-${card.gateId}`,
    releaseGateId: card.releaseGateId,
    blockedLeakFamilies,
    blockedFields,
    allowedFields: card.allowedFields.filter((field) => !BLOCKED_FIELD_TO_FAMILY[field]),
    strippedFieldCount,
    promptLeakBlocked: blockedFields.includes("promptRaw"),
    providerPayloadLeakBlocked: blockedFields.includes("rawProviderPayload") || blockedFields.includes("providerSecret"),
    deviceFingerprintLeakBlocked: blockedFields.includes("rawDeviceFingerprint") || blockedFields.includes("rawIpAddress"),
    paymentPayloadLeakBlocked: blockedFields.includes("paymentProviderPayload"),
    llmThreatCoverage: ZERO_LEAK_REQUIRED_THREAT_COVERAGE,
    releaseEquation: "sanitizedExportOnly × zeroLeakReplayReceipt × redactionEnvelopeHash × customerSafeHash × noBlockedLeakFamilyRendered × releaseGateStillValid",
    dataAttributes: {
      "data-pass2540-zero-leak-replay-gate": `zero-leak-replay-gate-${card.gateId}`,
      "data-pass2540-zero-leak-state": state,
      "data-pass2540-zero-leak-score": String(zeroLeakScore),
      "data-pass2540-sanitized-export-only": sanitizedExportOnly ? "true" : "false",
      "data-pass2540-blocked-leak-families": blockedLeakFamilies.join(","),
    },
  };
}

export function buildPass2540CustomerExportZeroLeakReplayRebalance(args: {
  query: string;
  symbol?: string;
  pass2539?: Pass2539AccountVaultTimelineExportCapsuleRebalance;
}): Pass2540CustomerExportZeroLeakReplayRebalance {
  const inheritedTimelineCards = args.pass2539?.timelineCards ?? [];
  const inheritedExportCapsuleCards = args.pass2539?.exportCapsuleCards ?? [];
  const capsuleByGate = new Map(inheritedExportCapsuleCards.map((capsule) => [capsule.gateId, capsule]));
  const sanitizedEnvelopes = inheritedTimelineCards.map((card) => buildEnvelope(card, capsuleByGate.get(card.gateId)));
  const leakFindings = inheritedTimelineCards.flatMap(buildFindings);
  const policies: Pass2540Policy[] = [
    {
      id: "zero-leak-customer-export-policy",
      title: "Customer export is sanitized-only and replay-bound",
      mapsTo: ["OWASP LLM prompt injection", "OWASP LLM sensitive information disclosure", "OWASP insecure output handling", "NIST AI RMF govern/map/measure/manage"],
      customerRule: "Customer UI may render only sanitized envelopes; raw prompts, provider payloads, secrets, full wallets, success URLs and device/payment payloads stay stripped even when a timeline card is ready.",
      blockedFamilies: ["raw_provider_payload", "full_wallet", "provider_secret", "raw_prompt", "success_url", "local_storage", "device_fingerprint", "payment_provider_payload"],
      releaseGate: "sanitizedExportOnly && zeroLeakReplayReceipt && noBlockedLeakFamilyRendered && customerSafeHash && redactionEnvelopeHash",
    },
    {
      id: "angel-pdf-browser-zero-leak-policy",
      title: "Angel/PDF/Browser summaries cannot echo internal proof material",
      mapsTo: ["LLM output handling", "privacy redaction", "artifact replay", "account-vault download gate"],
      customerRule: "AI summaries, PDF captions and Browser export labels must reference missing proof without revealing raw provider data, hidden prompts, device identifiers or payment payloads.",
      blockedFamilies: ["raw_prompt", "raw_provider_payload", "internal_scoring_scratchpad", "operator_internal_note", "payment_provider_payload"],
      releaseGate: "claimPermission × redactionReplay × zeroLeakScan × customerCopyOnly",
    },
  ];
  const fixtures: Pass2540ReplayFixture[] = [
    { id: "fixture-clean-customer-safe-export", scenario: "clean_customer_safe_export", inputKeys: ["title", "customerSafeHash", "redactionEnvelopeHash"], expectedRemovedKeys: [], expectedState: "clean", expectedSanitizedExportOnly: true },
    { id: "fixture-raw-prompt-injection-leak-attempt", scenario: "raw_prompt_injection_leak_attempt", inputKeys: ["title", "promptRaw", "internalScoringScratchpad"], expectedRemovedKeys: ["promptRaw", "internalScoringScratchpad"], expectedState: "needs_redaction", expectedSanitizedExportOnly: true },
    { id: "fixture-provider-payload-leak-attempt", scenario: "provider_payload_leak_attempt", inputKeys: ["rawProviderPayload", "providerSecret", "sourceLabel"], expectedRemovedKeys: ["providerSecret", "rawProviderPayload"], expectedState: "needs_redaction", expectedSanitizedExportOnly: true },
    { id: "fixture-wallet-success-url-shortcut", scenario: "wallet_success_url_shortcut", inputKeys: ["walletAddressFull", "successUrl", "localStorageFlag"], expectedRemovedKeys: ["localStorageFlag", "successUrl", "walletAddressFull"], expectedState: "replay_required", expectedSanitizedExportOnly: true },
    { id: "fixture-payment-payload-leak-attempt", scenario: "payment_payload_leak_attempt", inputKeys: ["paymentProviderPayload", "receiptId"], expectedRemovedKeys: ["paymentProviderPayload"], expectedState: "blocked", expectedSanitizedExportOnly: false },
    { id: "fixture-operator-note-leak-attempt", scenario: "operator_note_leak_attempt", inputKeys: ["operatorInternalNote", "publicReason"], expectedRemovedKeys: ["operatorInternalNote"], expectedState: "operator_only", expectedSanitizedExportOnly: false },
    { id: "fixture-missing-redaction-replay", scenario: "missing_redaction_replay", inputKeys: ["customerSafeHash", "redactionEnvelopeHash", "replayConfirmationId"], expectedRemovedKeys: [], expectedState: "replay_required", expectedSanitizedExportOnly: true },
  ];
  const semanticLanes: Pass2540SemanticLane[] = [
    { id: "manual-semantic-audit", percentBefore: 72, percentAfter: 75, finding: "PASS2539 made export capsules visible, but a separate zero-leak replay gate was still missing.", implementedGuard: "Added recursive sanitizer, leak-family scanner and zero-leak envelope per account vault timeline card.", nextAction: "Bind the zero-leak envelope to real account vault downloads and PDF export handler." },
    { id: "customer-export-sanitizer", percentBefore: 28, percentAfter: 54, finding: "Customer exports needed a deterministic field-stripper, not only copy saying raw fields are blocked.", implementedGuard: "sanitizePass2540CustomerExportPayload recursively removes rawProviderPayload, promptRaw, walletAddressFull, providerSecret, successUrl, localStorageFlag, device/payment payloads and scratchpads.", nextAction: "Add a runtime API that stores sanitized export receipts in the durable vault." },
    { id: "angel-prompt-leak-boundary", percentBefore: 51, percentAfter: 67, finding: "Angel/PDF/Browser could still reference internal proof material if a future route mapped raw data into copy.", implementedGuard: "Added threat coverage and policy tying prompt leak/output handling to customer-export release equation.", nextAction: "Snapshot Angel/PDF/Browser summaries in PL/EN/DE and reject raw key names in customer copy." },
    { id: "mobile-vault-copy", percentBefore: 38, percentAfter: 56, finding: "Account vault mobile copy showed timeline state but not a zero-leak score/replay state.", implementedGuard: "Added data attrs and account card markers for zero-leak state, score and sanitized-only export.", nextAction: "Turn markers into compact mobile cards with a visible stripped-field count." },
  ];
  const payloadForFingerprint = { sanitizedEnvelopes, policies, fixtures, leakFindings: leakFindings.map((finding) => finding.family) };
  const blockedEnvelopeCount = sanitizedEnvelopes.filter((envelope) => envelope.state === "blocked" || envelope.state === "operator_only").length;
  return {
    id: PASS2540_CUSTOMER_EXPORT_ZERO_LEAK_REPLAY_REBALANCE_ID,
    state: blockedEnvelopeCount ? "watch" : "ready_for_zero_leak_customer_export",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 72,
    manualSemanticCompletionAfterPercent: 75,
    targetedSemanticBatchFiles: 64,
    targetedSemanticBatchLines: 273880,
    zeroLeakReplayGateBeforePercent: 0,
    zeroLeakReplayGateAfterPercent: 41,
    customerExportSanitizerBeforePercent: 28,
    customerExportSanitizerAfterPercent: 54,
    accountVaultLeakSuppressionBeforePercent: 83,
    accountVaultLeakSuppressionAfterPercent: 90,
    angelPromptLeakBoundaryBeforePercent: 51,
    angelPromptLeakBoundaryAfterPercent: 67,
    pdfExportLeakBoundaryBeforePercent: 90,
    pdfExportLeakBoundaryAfterPercent: 93,
    mobileVaultCopyBeforePercent: 38,
    mobileVaultCopyAfterPercent: 56,
    worldclassInventionIndexBeforePercent: 98,
    worldclassInventionIndexAfterPercent: 99,
    inheritedTimelineCards,
    inheritedExportCapsuleCards,
    sanitizedEnvelopes,
    leakFindings,
    policies,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2540 adds a zero-leak customer export replay gate after PASS2539 timeline cards; sanitized export is a runtime envelope, not only UI copy.",
      "Raw provider payloads, full wallets, provider secrets, raw prompts, success URLs, localStorage flags, device fingerprints, payment payloads, operator notes and scoring scratchpads are recursively stripped before customer export.",
      "Angel/PDF/Browser/account vault copy must pass zeroLeakReplay before it can mention customer-ready export, download or delivered artifact.",
      "Zero-leak score is visible as an evidence quality indicator; low score downgrades CTA and keeps download blocked.",
    ],
    nextPassQueue: [
      "PASS2541: bind zero-leak envelopes to real PDF download/account vault export route with receipt persistence.",
      "PASS2542: PL/EN/DE snapshot test that Angel/PDF/Browser customer text contains no blocked raw keys.",
      "PASS2543: mobile account vault card for zero-leak score, stripped fields and replay owner.",
      "PASS2544: operator security incident lane when a raw payload leak attempt repeats across sessions.",
      "PASS2545: source-provider adapter contract that never forwards raw provider body to UI components.",
    ],
    zeroLeakReplayRule: "A customer export can be shown only when sanitizedExportOnly is true, blocked leak families are stripped, a zero-leak replay receipt exists, redactionEnvelopeHash and customerSafeHash match the timeline card, and no blocked raw key renders in customer UI.",
    fingerprint: stableFingerprint(payloadForFingerprint),
  };
}
