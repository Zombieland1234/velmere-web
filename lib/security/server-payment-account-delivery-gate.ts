import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import type { VlmPaidAccountEntitlementVerdict } from "@/lib/commerce/vlm-entitlement-ledger";
import type { Pass2581AuditVersionedRecheckReceiptReport } from "./audit-versioned-recheck-receipt";
import type { Pass2586AdvancedOperatorConsoleMergeReport } from "./advanced-operator-console-merge";

export const PASS2587_SERVER_PAYMENT_ACCOUNT_DELIVERY_GATE_ID = "server-payment-account-delivery-gate" as const;

export type Pass2587DeliveryGateStatus = "ready" | "review" | "blocked" | "locked" | "private";
export type Pass2587DeliveryGateFamily =
  | "server_receipt"
  | "entitlement_context"
  | "account_delivery"
  | "private_queue"
  | "download_gate"
  | "replay_protection"
  | "wallet_boundary"
  | "customer_status_copy";

export type Pass2587DeliveryGate = {
  id: string;
  family: Pass2587DeliveryGateFamily;
  label: string;
  status: Pass2587DeliveryGateStatus;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  requiredProof: string[];
  privateFields: string[];
  blocksProPdf: boolean;
  blocksAdvancedDelivery: boolean;
};

export type Pass2587DeliveryGateRow = {
  label: string;
  status: Pass2587DeliveryGateStatus;
  output: string;
};

export type Pass2587ServerPaymentAccountDeliveryGateReport = {
  passId: typeof PASS2587_SERVER_PAYMENT_ACCOUNT_DELIVERY_GATE_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  operatorRule: string;
  paymentBoundary: string;
  summary: {
    totalGates: number;
    ready: number;
    review: number;
    blocked: number;
    locked: number;
    private: number;
    deliveryReadiness: number;
    /** PASS4143 compatibility alias for older launch gates. */
    paymentDeliveryReadiness: number;
    proDownloadReadiness: number;
    accountDeliveryReadiness: number;
    canOpenProDownload: boolean;
    canEnterAdvancedQueue: boolean;
    canDeliverAdvancedPrivately: boolean;
    /** PASS4143 compatibility alias for older receipt-binding consumers. */
    canReleasePrivateDelivery: boolean;
    /** PASS4143 compatibility alias for older report-binding consumers. */
    canDeliverAdvanced: boolean;
    /** PASS4143 server-receipt readiness alias used by receipt binding gates. */
    receiptReadiness: number;
    /** PASS4143 old name for next blocking payment/delivery gate. */
    nextCriticalGate: string;
    nextBlockingGate: string;
  };
  gates: Pass2587DeliveryGate[];
  customerRows: Pass2587DeliveryGateRow[];
  proPdfRows: Pass2587DeliveryGateRow[];
  operatorRows: Pass2587DeliveryGateRow[];
  accountDeliveryContract: {
    accountId: string;
    accountMessageId?: string;
    auditQueueId?: string;
    deliveryStatus: string;
    safeCustomerFields: string[];
    privateFields: string[];
    rule: string;
  };
  receiptReplayContract: {
    ledgerMode: string;
    entitlementId?: string;
    auditQueueId?: string;
    status: string;
    replayRule: string;
  };
  visualMergeContract: {
    publicSlot: string;
    accountSlot: string;
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
  paidAccessReceipt?: VlmPaidAccountEntitlementVerdict | null;
  accountMessage?: AuditAccountMessageRecord | null;
  versionedRecheckReceipt?: Pass2581AuditVersionedRecheckReceiptReport | null;
  advancedOperatorConsoleMerge?: Pass2586AdvancedOperatorConsoleMergeReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(values: string[], max = 10) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function gate(args: Pass2587DeliveryGate): Pass2587DeliveryGate {
  return {
    ...args,
    requiredProof: uniq(args.requiredProof, 9),
    privateFields: uniq(args.privateFields, 9),
  };
}

function row(label: string, status: Pass2587DeliveryGateStatus, output: string): Pass2587DeliveryGateRow {
  return { label, status, output };
}

function publicStatus(locale: string, status: Pass2587DeliveryGateStatus) {
  if (status === "ready") return t(locale, "gotowe", "bereit", "ready");
  if (status === "locked") return t(locale, "zablokowane hashem", "hash-locked", "hash-locked");
  if (status === "private") return t(locale, "prywatne", "privat", "private");
  if (status === "review") return t(locale, "do przeglądu", "zu pruefen", "review");
  return t(locale, "zablokowane", "blockiert", "blocked");
}

function readiness(gates: Pass2587DeliveryGate[], predicate?: (gate: Pass2587DeliveryGate) => boolean) {
  const scoped = predicate ? gates.filter(predicate) : gates;
  const ready = scoped.filter((item) => item.status === "ready" || item.status === "locked" || item.status === "private").length;
  const review = scoped.filter((item) => item.status === "review").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((ready / Math.max(1, scoped.length)) * 92 - review * 7 - blocked * 18, 0, 100);
}

function customerLine(locale: string, status: Pass2587DeliveryGateStatus, detail: string) {
  const prefix = status === "ready" || status === "locked"
    ? t(locale, "Warstwa dostawy jest potwierdzona.", "Die Delivery-Schicht ist bestaetigt.", "Delivery layer is confirmed.")
    : status === "private"
      ? t(locale, "Ten element zostaje prywatny w koncie/operatorze.", "Dieses Element bleibt privat im Konto/Operatorbereich.", "This element stays private inside account/operator delivery.")
      : status === "review"
        ? t(locale, "Warstwa dostawy czeka na dodatkowy przegląd.", "Delivery wartet auf weitere Pruefung.", "Delivery layer waits for extra review.")
        : t(locale, "Warstwa dostawy jest zablokowana do czasu dowodu.", "Delivery ist bis zum Nachweis blockiert.", "Delivery layer is blocked until proof is present.");
  return `${prefix} ${detail}`.slice(0, 340);
}

export function buildPass2587ServerPaymentAccountDeliveryGateReport(input: BuilderInput): Pass2587ServerPaymentAccountDeliveryGateReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const paid = input.paidAccessReceipt;
  const paidOk = Boolean(paid?.ok);
  const paidLedgerMode = paid?.ok ? paid.ledgerMode : paid?.ledgerMode ?? "missing";
  const entitlement = paid?.ok ? paid.entitlement : null;
  const account = input.accountMessage;
  const receipt = input.versionedRecheckReceipt;
  const operator = input.advancedOperatorConsoleMerge;

  const chain = clean(input.chain, 40) ?? operator?.target.chain ?? receipt?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? operator?.target.contractAddress ?? receipt?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? operator?.target.projectName ?? receipt?.target.projectName;
  const reviewLevel = input.reviewLevel === "advanced_review" || input.reviewLevel === "pro_review" ? input.reviewLevel : "basic_review";
  const advancedRequested = reviewLevel === "advanced_review";
  const proRequested = reviewLevel === "pro_review" || reviewLevel === "advanced_review";

  const receiptState: Pass2587DeliveryGateStatus = paidOk ? "locked" : advancedRequested || proRequested ? "blocked" : "review";
  const entitlementState: Pass2587DeliveryGateStatus = paidOk && entitlement?.id ? "locked" : paidOk ? "review" : advancedRequested ? "blocked" : "review";
  const accountState: Pass2587DeliveryGateStatus = account?.accountId && account?.id ? "ready" : "review";
  const privateQueueState: Pass2587DeliveryGateStatus = advancedRequested
    ? paidOk && (entitlement?.auditQueueId || account?.auditQueueId) ? "private" : "blocked"
    : "review";
  const downloadState: Pass2587DeliveryGateStatus = proRequested
    ? paidOk && account?.deliveryStatus !== "waiting_payment" ? "ready" : "blocked"
    : "review";
  const replayState: Pass2587DeliveryGateStatus = paidOk && (paidLedgerMode === "durable" || paidLedgerMode === "memory") ? "locked" : paidOk ? "review" : "blocked";
  const walletState: Pass2587DeliveryGateStatus = "locked";
  const customerStatusState: Pass2587DeliveryGateStatus = account?.deliveryStatus === "analysis_queue" || account?.deliveryStatus === "human_review_queue" || account?.deliveryStatus === "ready_for_download" || account?.deliveryStatus === "delivered_to_account" ? "ready" : "review";

  const gates = [
    gate({
      id: "server-payment-receipt",
      family: "server_receipt",
      label: "Server payment receipt",
      status: receiptState,
      customerLine: customerLine(locale, receiptState, t(locale, "Pro/Advanced otwiera się tylko po potwierdzeniu server-side receipt.", "Pro/Advanced oeffnet nur nach server-side Receipt.", "Pro/Advanced opens only after a server-side receipt.")),
      proPdfLine: `Server receipt: ${publicStatus(locale, receiptState)}; ledger mode ${paidLedgerMode}.`,
      operatorLine: `Verify entitlement record before queue assignment. Ledger mode: ${paidLedgerMode}.`,
      requiredProof: ["server verified paid access token", "entitlement ledger record", "context hash match"],
      privateFields: ["stripeSessionId", "stripeCustomerId", "customerEmail", "entitlement.context"],
      blocksProPdf: proRequested && !paidOk,
      blocksAdvancedDelivery: advancedRequested && !paidOk,
    }),
    gate({
      id: "entitlement-context-match",
      family: "entitlement_context",
      label: "Entitlement context match",
      status: entitlementState,
      customerLine: customerLine(locale, entitlementState, t(locale, "Receipt musi pasować do audytu, produktu i zakresu.", "Receipt muss zu Audit, Produkt und Scope passen.", "Receipt must match the audit, product and scope.")),
      proPdfLine: `Entitlement context: ${publicStatus(locale, entitlementState)}; raw customer/payment fields are excluded from PDF.`,
      operatorLine: "Compare productId, surface, assetId, depth and contextHash before any private delivery.",
      requiredProof: ["product id", "surface audit", "asset/context hash", "not expired/refunded"],
      privateFields: ["contextHash", "context.assetId", "customerEmail", "customerName"],
      blocksProPdf: proRequested && entitlementState === "blocked",
      blocksAdvancedDelivery: advancedRequested && entitlementState !== "locked",
    }),
    gate({
      id: "account-delivery-thread",
      family: "account_delivery",
      label: "Account delivery thread",
      status: accountState,
      customerLine: customerLine(locale, accountState, t(locale, "Raport trafia do konta/wiadomości, nie do publicznego surowego payloadu.", "Report geht ins Konto/Nachricht, nicht in einen raw public payload.", "Report goes to account/message delivery, not a public raw payload.")),
      proPdfLine: `Account delivery: ${publicStatus(locale, accountState)}; account id is internal and not printed raw.`,
      operatorLine: "Keep account message ID and queue ID linked to the report receipt/version.",
      requiredProof: ["accountMessage.id", "accountId", "deliveryStatus", "report version link"],
      privateFields: ["accountId", "contactEmail", "actionLog", "operatorNote"],
      blocksProPdf: false,
      blocksAdvancedDelivery: advancedRequested && accountState !== "ready",
    }),
    gate({
      id: "advanced-private-queue",
      family: "private_queue",
      label: "Advanced private queue",
      status: privateQueueState,
      customerLine: customerLine(locale, privateQueueState, t(locale, "Advanced po płatności przechodzi do prywatnej kolejki dostawy chronionej bramkami serwera.", "Advanced geht nach Zahlung in eine private, serverseitig abgesicherte Delivery-Queue.", "Advanced enters a private delivery queue protected by server-side gates after payment.")),
      proPdfLine: `Advanced queue: ${publicStatus(locale, privateQueueState)}; queue details stay private.`,
      operatorLine: "Queue assignment is internal and deterministic; optional operator QA stays observational and cannot unlock delivery.",
      requiredProof: ["auditQueueId", "server delivery gate state", "redaction gate state"],
      privateFields: ["auditQueueId", "operatorId", "manual notes", "SLA internals"],
      blocksProPdf: false,
      blocksAdvancedDelivery: advancedRequested && privateQueueState === "blocked",
    }),
    gate({
      id: "pro-download-gate",
      family: "download_gate",
      label: "Pro PDF download gate",
      status: downloadState,
      customerLine: customerLine(locale, downloadState, t(locale, "PDF Pro może być pobrany dopiero z customer-safe warstwy.", "Pro PDF darf nur aus customer-safe Layer geladen werden.", "Pro PDF can be downloaded only from the customer-safe layer.")),
      proPdfLine: `Download gate: ${publicStatus(locale, downloadState)}; test PDFs must not imply paid proof.`,
      operatorLine: "Do not attach private operator appendix to downloadable PDF.",
      requiredProof: ["paid access receipt for paid tiers", "customer-safe PDF contract", "redaction firewall"],
      privateFields: ["operatorRows", "raw provider payloads", "private appendix"],
      blocksProPdf: proRequested && downloadState === "blocked",
      blocksAdvancedDelivery: false,
    }),
    gate({
      id: "receipt-replay-protection",
      family: "replay_protection",
      label: "Receipt replay protection",
      status: replayState,
      customerLine: customerLine(locale, replayState, t(locale, "Ten sam receipt nie może po cichu tworzyć sprzecznych dostaw.", "Dasselbe Receipt darf keine widerspruechlichen Deliveries erzeugen.", "The same receipt cannot silently create conflicting deliveries.")),
      proPdfLine: `Replay protection: ${publicStatus(locale, replayState)}; content hash and entitlement context must stay bound.`,
      operatorLine: "Bind reportVersion, runId, entitlement and account message before final delivery.",
      requiredProof: ["receipt.runId", "receipt.contentHash", "entitlement id", "account message id"],
      privateFields: ["full entitlement context", "ledger raw record"],
      blocksProPdf: proRequested && replayState === "blocked",
      blocksAdvancedDelivery: advancedRequested && replayState === "blocked",
    }),
    gate({
      id: "wallet-is-not-payment-proof",
      family: "wallet_boundary",
      label: "Wallet boundary",
      status: walletState,
      customerLine: customerLine(locale, walletState, t(locale, "Wallet connect jest tylko identity/context, nie dowodem płatności.", "Wallet Connect ist nur Identity/Context, kein Zahlungsnachweis.", "Wallet connect is identity/context only, not payment proof.")),
      proPdfLine: "Wallet boundary: locked; wallet connection never unlocks Advanced without server receipt.",
      operatorLine: "Treat wallet as identity/context only unless backed by paid entitlement ledger.",
      requiredProof: ["server receipt", "entitlement ledger", "scope match"],
      privateFields: ["wallet address if supplied", "identity link"],
      blocksProPdf: false,
      blocksAdvancedDelivery: false,
    }),
    gate({
      id: "customer-status-copy",
      family: "customer_status_copy",
      label: "Customer status copy",
      status: customerStatusState,
      customerLine: customerLine(locale, customerStatusState, t(locale, "Klient widzi status i następny krok, nie surowe notatki operatora.", "Kunde sieht Status und naechsten Schritt, nicht raw Operator-Notizen.", "Customer sees status and next step, not raw operator notes.")),
      proPdfLine: `Customer status copy: ${publicStatus(locale, customerStatusState)}; no debug/pass language in export.`,
      operatorLine: "Keep private fields out of status copy, PDF and public Basic result.",
      requiredProof: ["deliveryStatus", "customer-safe summary", "redaction checklist"],
      privateFields: ["operatorNote", "actionLog", "privateFields", "raw payload"],
      blocksProPdf: false,
      blocksAdvancedDelivery: false,
    }),
  ];

  const ready = gates.filter((item) => item.status === "ready").length;
  const review = gates.filter((item) => item.status === "review").length;
  const blocked = gates.filter((item) => item.status === "blocked").length;
  const locked = gates.filter((item) => item.status === "locked").length;
  const privateCount = gates.filter((item) => item.status === "private").length;
  const canOpenProDownload = !gates.some((item) => item.blocksProPdf);
  const canEnterAdvancedQueue = advancedRequested ? paidOk && privateQueueState !== "blocked" : false;
  const canDeliverAdvancedPrivately = advancedRequested
    ? canEnterAdvancedQueue && !gates.some((item) => item.blocksAdvancedDelivery)
    : false;
  const nextBlockingGate = gates.find((item) => item.status === "blocked")?.label ?? gates.find((item) => item.status === "review")?.label ?? "none";

  return {
    passId: PASS2587_SERVER_PAYMENT_ACCOUNT_DELIVERY_GATE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2587 binds paid audit delivery to server-side entitlement, account delivery, private queue and replay-safe receipt state.",
    customerRule: t(locale, "Płatne raporty otwierają się przez receipt + konto, nie przez sam wallet ani surowy payload.", "Paid Reports oeffnen ueber Receipt + Konto, nicht nur Wallet oder raw Payload.", "Paid reports unlock through receipt + account delivery, not wallet-only or raw payload."),
    operatorRule: "Advanced private delivery is authorized only after payment receipt, scope, redaction, receipt replay and private queue gates pass; optional human QA is non-gating.",
    paymentBoundary: "Wallet connect is identity/context only. Pro/Advanced requires server-verified paid entitlement before private delivery or paid download.",
    summary: {
      totalGates: gates.length,
      ready,
      review,
      blocked,
      locked,
      private: privateCount,
      deliveryReadiness: readiness(gates),
      paymentDeliveryReadiness: readiness(gates),
      proDownloadReadiness: readiness(gates, (item) => item.blocksProPdf || item.family === "download_gate" || item.family === "customer_status_copy" || item.family === "wallet_boundary"),
      accountDeliveryReadiness: readiness(gates, (item) => item.family === "account_delivery" || item.family === "private_queue" || item.family === "customer_status_copy" || item.family === "server_receipt"),
      canOpenProDownload,
      canEnterAdvancedQueue,
      canDeliverAdvancedPrivately,
      canReleasePrivateDelivery: canDeliverAdvancedPrivately,
      canDeliverAdvanced: canDeliverAdvancedPrivately,
      receiptReadiness: readiness(gates, (item) => item.family === "server_receipt" || item.family === "entitlement_context" || item.family === "replay_protection"),
      nextCriticalGate: nextBlockingGate,
      nextBlockingGate,
    },
    gates,
    customerRows: gates.map((item) => row(item.label, item.status, item.customerLine)).slice(0, 8),
    proPdfRows: gates.map((item) => row(item.label, item.status, item.proPdfLine)).slice(0, 10),
    operatorRows: gates.map((item) => row(item.label, item.status, item.operatorLine)).slice(0, 12),
    accountDeliveryContract: {
      accountId: account?.accountId ?? "preview:local-member-preview",
      accountMessageId: account?.id,
      auditQueueId: entitlement?.auditQueueId ?? account?.auditQueueId ?? undefined,
      deliveryStatus: account?.deliveryStatus ?? "preview_only",
      safeCustomerFields: ["deliveryStatus", "requestId", "packageLabel", "customerSafeReport.status", "pdfRoute", "publicReportRoute"],
      privateFields: ["accountId", "contactEmail", "actionLog", "operatorNote", "paymentEvidenceRefs"],
      rule: "Customer-facing account status may show delivery state and routes, but not raw entitlement/account/operator payloads.",
    },
    receiptReplayContract: {
      ledgerMode: paidLedgerMode,
      entitlementId: entitlement?.id,
      auditQueueId: entitlement?.auditQueueId ?? account?.auditQueueId ?? undefined,
      status: paidOk ? "receipt_verified" : "receipt_missing_or_unverified",
      replayRule: "The entitlement, account message, reportVersion, runId and contentHash must remain bound before paid delivery.",
    },
    visualMergeContract: {
      publicSlot: "Basic audit result > Server Payment / Account Delivery Gate",
      accountSlot: "Member account > Audit messages > paid/private delivery status",
      operatorSlot: "Operator console > payment/account delivery gates",
      rule: "Visual redesign can replace layout, but must keep payment receipt, account message, queue id, redaction and replay state wired.",
      keepWired: ["summary.canOpenProDownload", "summary.canEnterAdvancedQueue", "summary.canDeliverAdvancedPrivately", "accountDeliveryContract.deliveryStatus", "receiptReplayContract.status", "gates[].status"],
      doNotExpose: ["stripeSessionId", "stripeCustomerId", "customerEmail", "contextHash", "operatorNote", "actionLog", "raw provider payload"],
    },
    nextImplementationBacklog: [
      "Persist account delivery contract in durable store with reportVersion binding.",
      "Add customer download route that checks paid entitlement before returning Pro/Advanced PDF.",
      "Attach Advanced private delivery only after deterministic redaction, receipt replay and private-queue gates pass.",
      "Add replay test where same receipt cannot unlock mismatched target/context.",
      "Merge later visual audit page without weakening server-side delivery gates.",
    ],
  };
}
