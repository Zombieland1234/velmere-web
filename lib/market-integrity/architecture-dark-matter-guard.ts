export type Pass449EvidenceKind =
  | "raw_provider_payload"
  | "raw_chain_data"
  | "issuer_filing"
  | "venue_status"
  | "order_event"
  | "payment_webhook"
  | "ai_derived_note"
  | "memory_snapshot"
  | "pdf_rendered_text";

export type Pass449EvidenceInput = {
  kind: Pass449EvidenceKind;
  sourceId: string;
  observedAt?: string;
  payloadHash?: string;
  derivedFrom?: string[];
};

export type Pass449EvidenceClassification = {
  sourceId: string;
  kind: Pass449EvidenceKind;
  canSupportCustomerClaim: boolean;
  canEnterRiskEngineAsFact: boolean;
  reason: string;
  requiredNextGuard: string;
};

const sourceTruthMap: Record<Pass449EvidenceKind, Omit<Pass449EvidenceClassification, "sourceId" | "kind">> = {
  raw_provider_payload: {
    canSupportCustomerClaim: true,
    canEnterRiskEngineAsFact: true,
    reason: "Raw provider payload can support price, market cap, volume and source-ledger claims when timestamp and payload hash exist.",
    requiredNextGuard: "second-source arbitration before high-confidence wording",
  },
  raw_chain_data: {
    canSupportCustomerClaim: true,
    canEnterRiskEngineAsFact: true,
    reason: "Raw chain data can support wallet/token/access claims when chain id, block context and RPC lane are visible.",
    requiredNextGuard: "rpc fallback and account-change reset",
  },
  issuer_filing: {
    canSupportCustomerClaim: true,
    canEnterRiskEngineAsFact: true,
    reason: "Issuer filing is allowed as primary evidence for regulated company disclosure claims.",
    requiredNextGuard: "filing timestamp and issuer identity check",
  },
  venue_status: {
    canSupportCustomerClaim: true,
    canEnterRiskEngineAsFact: true,
    reason: "Venue status can support exchange-health wording, not price/market-cap wording.",
    requiredNextGuard: "do not merge venue health with asset valuation lanes",
  },
  order_event: {
    canSupportCustomerClaim: false,
    canEnterRiskEngineAsFact: false,
    reason: "Order events must be processed through idempotency and queue receipts before becoming customer-facing state.",
    requiredNextGuard: "idempotency key + durable order state",
  },
  payment_webhook: {
    canSupportCustomerClaim: false,
    canEnterRiskEngineAsFact: false,
    reason: "Payment webhooks acknowledge payment but must not directly execute fulfilment without async retry guard.",
    requiredNextGuard: "queue handoff + dedupe key + retry receipt",
  },
  ai_derived_note: {
    canSupportCustomerClaim: false,
    canEnterRiskEngineAsFact: false,
    reason: "AI-derived notes are explanations, not evidence; they cannot feed the evidence loop as facts.",
    requiredNextGuard: "must point back to raw provider, raw chain, filing or venue source",
  },
  memory_snapshot: {
    canSupportCustomerClaim: false,
    canEnterRiskEngineAsFact: false,
    reason: "Memory can preserve workflow context but cannot override live source freshness.",
    requiredNextGuard: "fresh provider attempt required before live wording",
  },
  pdf_rendered_text: {
    canSupportCustomerClaim: false,
    canEnterRiskEngineAsFact: false,
    reason: "Rendered PDF text is an output artifact, not a new evidence source.",
    requiredNextGuard: "truth replay must resolve back to source ledger",
  },
};

export function classifyPass449Evidence(input: Pass449EvidenceInput): Pass449EvidenceClassification {
  const rule = sourceTruthMap[input.kind];
  const hasRawProof = Boolean(input.observedAt && input.payloadHash);
  if ((input.kind === "raw_provider_payload" || input.kind === "raw_chain_data") && !hasRawProof) {
    return {
      sourceId: input.sourceId,
      kind: input.kind,
      canSupportCustomerClaim: false,
      canEnterRiskEngineAsFact: false,
      reason: "Raw lane is present, but missing observedAt or payloadHash; keep it in guarded/facts-only mode.",
      requiredNextGuard: "attach timestamp + payload hash before claim release",
    };
  }
  return { sourceId: input.sourceId, kind: input.kind, ...rule };
}

const sensitiveKeyPattern = /(email|phone|address|street|city|postcode|zip|name|surname|token|secret|password|authorization|cookie|session|stack|client_secret|payment_method|walletconnect|private|seed)/i;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const longSecretPattern = /(?:sk_live|sk_test|pk_live|pk_test|whsec|Bearer)_[A-Za-z0-9_-]{12,}|0x[a-fA-F0-9]{40}/g;

export function pass449RedactForLedger(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[redacted:depth-limit]";
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (typeof value === "string") {
    return value.replace(emailPattern, "[redacted:email]").replace(longSecretPattern, "[redacted:secret]");
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => pass449RedactForLedger(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted:schema-key]" : pass449RedactForLedger(item, depth + 1),
    ]),
  );
}

export function buildPass449IdempotencyKey(parts: { lane: string; provider: string; externalId: string; version?: string }) {
  const safe = [parts.lane, parts.provider, parts.externalId, parts.version ?? "v1"]
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|._:-]+/g, "-");
  return `idem:${safe}`;
}

export const pass449ArchitectureDarkMatterGuard = {
  version: "architecture-dark-matter-guard",
  catalogRepair: {
    importedPasses: [413, 414, 415, 416, 417, 418, 419],
    fixed: ["catalog rows now include pass413-pass419 builders", "contract object includes pass413-pass419 runtime contracts", "contract formatted multiline to prevent hidden append mistakes"],
  },
  stateConsistency: {
    walletRace: "EVM accountsChanged listener forces snapshot clear + disconnect on address switch, preventing stale wallet state from authorizing the wrong session.",
    sourceTruthSpine: "AI notes, memory and PDF text cannot become evidence facts; risk engine evidence must resolve to raw provider, raw chain, issuer filing or venue status.",
    redactionEnvelope: "Security ledger uses schema-key + recursive redaction before events can be stored or surfaced in admin views.",
    idempotencyEnvelope: "Webhook/order/evidence writes must carry idem:<lane>|<provider>|<externalId>|<version> keys before retry or replay.",
  },
  asyncCommerceQueue: {
    target: "Stripe webhook should acknowledge fast, enqueue paid order, then retry Printful fulfilment outside the request path.",
    recommendedLanes: ["paid_waiting_for_fulfilment", "printful_retry_scheduled", "operator_review_after_max_retries"],
    timeoutPolicy: "never let a synchronous Printful timeout decide final order state",
  },
  rpcFallback: {
    targetMs: 800,
    lanes: ["primary_rpc", "secondary_rpc", "public_readonly_rpc", "operator_review"],
    rule: "if the active RPC misses latency or errors, retry read-only wallet/token checks on the next lane before denying access",
  },
  llmOps: {
    traceFields: ["requestId", "model", "provider", "latencyMs", "inputTokens", "outputTokens", "costEstimate", "sourceLedgerId", "evalMode"],
    releaseRule: "PDF/chat is not released when trace has missing source ledger or eval mode is sealed/operator review.",
  },
  e2e: {
    criticalJourneys: ["locale switch + search", "Lens PDF preview + download", "real markets row click", "wallet account switch", "checkout webhook mocked fulfilment"],
    runner: "Playwright smoke suite should run on preview deployment before public release.",
  },
  uiMarkers: ["data-pass449-catalog-413-419", "data-pass449-source-truth-spine", "data-pass449-wallet-state-reset", "data-pass449-redaction-envelope"],
} as const;
