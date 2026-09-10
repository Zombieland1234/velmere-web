import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import type { Pass2581AuditVersionedRecheckReceiptReport } from "./audit-versioned-recheck-receipt";
import type { Pass2585PremiumProPdfTemplateContractReport } from "./premium-pro-pdf-template-contract";
import type { Pass2586AdvancedOperatorConsoleMergeReport } from "./advanced-operator-console-merge";
import type { Pass2587ServerPaymentAccountDeliveryGateReport } from "./server-payment-account-delivery-gate";

export const PASS2588_AUDIT_CASE_VAULT_PRIVATE_DELIVERY_LEDGER_ID = "audit-case-vault-private-delivery-ledger" as const;

export type Pass2588VaultState = "ready" | "review" | "blocked" | "locked" | "private" | "retained";
export type Pass2588VaultFamily =
  | "case_identity"
  | "receipt_binding"
  | "append_only_timeline"
  | "version_history"
  | "private_delivery_pointer"
  | "retention_policy"
  | "access_envelope"
  | "operator_handoff"
  | "replay_snapshot";

export type Pass2588VaultLane = {
  id: string;
  family: Pass2588VaultFamily;
  label: string;
  state: Pass2588VaultState;
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  requiredProof: string[];
  privateFields: string[];
  blocksVaultPersist: boolean;
  blocksPrivateDelivery: boolean;
};

export type Pass2588VaultRow = {
  label: string;
  state: Pass2588VaultState;
  output: string;
};

export type Pass2588AuditCaseVaultPrivateDeliveryLedgerReport = {
  passId: typeof PASS2588_AUDIT_CASE_VAULT_PRIVATE_DELIVERY_LEDGER_ID;
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
  privacyBoundary: string;
  summary: {
    totalLanes: number;
    ready: number;
    review: number;
    blocked: number;
    locked: number;
    private: number;
    retained: number;
    vaultReadiness: number;
    privateDeliveryReadiness: number;
    replayReadiness: number;
    canPersistCase: boolean;
    canAttachCustomerPdf: boolean;
    canDeliverPrivateReport: boolean;
    /** PASS4143 compatibility alias for older delivery launch consumers. */
    topVaultRisk: string;
    nextBlockingLane: string;
  };
  vaultId: string;
  lanes: Pass2588VaultLane[];
  customerRows: Pass2588VaultRow[];
  proPdfRows: Pass2588VaultRow[];
  operatorRows: Pass2588VaultRow[];
  caseVaultContract: {
    vaultId: string;
    accountId: string;
    accountMessageId?: string;
    auditQueueId?: string;
    receiptId?: string;
    reportVersion?: string;
    contentHash?: string;
    sourceMode: string;
    persistenceMode: string;
    appendOnlyRule: string;
    customerSafeFields: string[];
    privateFields: string[];
  };
  privateDeliveryLedger: {
    deliveryPointer: string;
    deliveryStatus: string;
    customerPdfRoute?: string;
    publicReportRoute?: string;
    redactionRequired: boolean;
    allowedRecipients: string[];
    forbiddenPayloads: string[];
  };
  replaySnapshotContract: {
    snapshotId: string;
    boundReceipt?: string;
    boundHash?: string;
    sourceReplayRule: string;
    mismatchRule: string;
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
  accountMessage?: AuditAccountMessageRecord | null;
  versionedRecheckReceipt?: Pass2581AuditVersionedRecheckReceiptReport | null;
  premiumProPdfTemplateContract?: Pass2585PremiumProPdfTemplateContractReport | null;
  advancedOperatorConsoleMerge?: Pass2586AdvancedOperatorConsoleMergeReport | null;
  serverPaymentAccountDeliveryGate?: Pass2587ServerPaymentAccountDeliveryGateReport | null;
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
    .slice(0, 40) || "case";
}

function shortHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniq(values: string[], max = 10) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function lane(args: Pass2588VaultLane): Pass2588VaultLane {
  return {
    ...args,
    requiredProof: uniq(args.requiredProof, 9),
    privateFields: uniq(args.privateFields, 9),
  };
}

function row(label: string, state: Pass2588VaultState, output: string): Pass2588VaultRow {
  return { label, state, output };
}

function customerLine(locale: string, state: Pass2588VaultState, detail: string) {
  const prefix = state === "ready" || state === "locked" || state === "retained"
    ? t(locale, "Case vault jest gotowy do bezpiecznej dostawy.", "Case Vault ist fuer sichere Delivery bereit.", "Case vault is ready for safe delivery.")
    : state === "private"
      ? t(locale, "Ten element zostaje tylko w prywatnej warstwie konta/operatora.", "Dieses Element bleibt nur in der privaten Konto-/Operator-Schicht.", "This element stays only inside the private account/operator layer.")
      : state === "review"
        ? t(locale, "Case vault wymaga jeszcze przeglądu przed finalną dostawą.", "Case Vault benoetigt vor finaler Delivery noch Review.", "Case vault still needs review before final delivery.")
        : t(locale, "Case vault blokuje finalną dostawę do czasu dowodu.", "Case Vault blockiert finale Delivery bis zum Nachweis.", "Case vault blocks final delivery until proof is present.");
  return `${prefix} ${detail}`.slice(0, 340);
}

function readiness(items: Pass2588VaultLane[], predicate?: (lane: Pass2588VaultLane) => boolean) {
  const scoped = predicate ? items.filter(predicate) : items;
  const ready = scoped.filter((item) => item.state === "ready" || item.state === "locked" || item.state === "private" || item.state === "retained").length;
  const review = scoped.filter((item) => item.state === "review").length;
  const blocked = scoped.filter((item) => item.state === "blocked").length;
  return clamp((ready / Math.max(1, scoped.length)) * 94 - review * 6 - blocked * 20, 0, 100);
}

export function buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport(input: BuilderInput): Pass2588AuditCaseVaultPrivateDeliveryLedgerReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const account = input.accountMessage;
  const receipt = input.versionedRecheckReceipt;
  const pdf = input.premiumProPdfTemplateContract;
  const operator = input.advancedOperatorConsoleMerge;
  const delivery = input.serverPaymentAccountDeliveryGate;
  const reviewLevel = input.reviewLevel === "advanced_review" || input.reviewLevel === "pro_review" ? input.reviewLevel : "basic_review";
  const advancedRequested = reviewLevel === "advanced_review";
  const proRequested = reviewLevel === "pro_review" || advancedRequested;

  const chain = clean(input.chain, 40) ?? receipt?.target.chain ?? delivery?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? receipt?.target.contractAddress ?? delivery?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? receipt?.target.projectName ?? delivery?.target.projectName;
  const accountId = account?.accountId ?? delivery?.accountDeliveryContract.accountId ?? "preview:local-member-preview";
  const accountMessageId = account?.id ?? delivery?.accountDeliveryContract.accountMessageId;
  const auditQueueId = account?.auditQueueId ?? delivery?.accountDeliveryContract.auditQueueId ?? delivery?.receiptReplayContract.auditQueueId;
  const receiptId = receipt?.receipt.receiptId;
  const reportVersion = receipt?.receipt.reportVersion;
  const contentHash = receipt?.receipt.contentHash;
  const targetKey = contractAddress ?? projectName ?? "audit-target";
  const vaultId = `vlm-vault-${stableSlug(chain)}-${shortHash(`${targetKey}:${receiptId ?? "no-receipt"}:${accountId}`)}`;

  const accountPresent = Boolean(accountId && accountMessageId);
  const receiptBound = Boolean(receiptId && contentHash && reportVersion);
  const deliveryGateOpen = Boolean(delivery?.summary.canOpenProDownload || delivery?.summary.canDeliverAdvancedPrivately);
  const operatorReadiness = operator?.summary.operatorConsoleReadiness ?? 0; // informational/internal QA only
  const pdfReadiness = pdf?.summary.customerSafeReadiness ?? 0;
  const automatedDeliveryReady = Boolean(delivery?.summary.canDeliverAdvancedPrivately && accountPresent && receiptBound);
  const pdfReady = Boolean(pdf?.summary.canRenderCustomerPdf || pdfReadiness >= 55);
  const privateDeliveryPointer = auditQueueId ? `private-queue:${auditQueueId}` : accountMessageId ? `account-message:${accountMessageId}` : `vault:${vaultId}`;

  const lanes = [
    lane({
      id: "case-identity",
      family: "case_identity",
      label: "Case identity",
      state: accountPresent ? "locked" : accountId ? "review" : "blocked",
      customerLine: customerLine(locale, accountPresent ? "locked" : accountId ? "review" : "blocked", t(locale, "Audyt musi mieć stabilny rekord sprawy w koncie.", "Das Audit braucht einen stabilen Case Record im Konto.", "Audit needs a stable account case record.")),
      proPdfLine: `Case vault id ${vaultId}; account ${accountId}; message ${accountMessageId ?? "pending"}.`,
      operatorLine: `Bind every paid report to vault id ${vaultId} before delivery.` ,
      requiredProof: ["account id", "account message id", "audit queue id when Advanced"],
      privateFields: ["accountId", "accountMessageId", "contactEmail", "sessionSource"],
      blocksVaultPersist: !accountPresent,
      blocksPrivateDelivery: advancedRequested && !accountPresent,
    }),
    lane({
      id: "receipt-binding",
      family: "receipt_binding",
      label: "Receipt binding",
      state: receiptBound ? "locked" : proRequested ? "blocked" : "review",
      customerLine: customerLine(locale, receiptBound ? "locked" : proRequested ? "blocked" : "review", t(locale, "Raport musi być spięty z wersją, runId i content hash.", "Der Report muss mit Version, runId und Content Hash verbunden sein.", "Report must be bound to version, runId and content hash.")),
      proPdfLine: `Receipt ${receiptId ?? "pending"}; version ${reportVersion ?? "pending"}; content hash ${contentHash ?? "pending"}.`,
      operatorLine: "Reject private delivery if receipt hash is missing or mismatched.",
      requiredProof: ["receipt id", "report version", "content hash", "run id"],
      privateFields: ["raw receipt payload", "operator verification trail"],
      blocksVaultPersist: proRequested && !receiptBound,
      blocksPrivateDelivery: advancedRequested && !receiptBound,
    }),
    lane({
      id: "append-only-timeline",
      family: "append_only_timeline",
      label: "Append-only timeline",
      state: account?.actionLog?.length ? "retained" : accountPresent ? "review" : "blocked",
      customerLine: customerLine(locale, account?.actionLog?.length ? "retained" : accountPresent ? "review" : "blocked", t(locale, "Zmiany statusu powinny dopisywać zdarzenia, nie nadpisywać historię.", "Statusaenderungen sollen Events anhaengen, nicht Historie ueberschreiben.", "Status changes should append events, not overwrite history.")),
      proPdfLine: `Timeline events: ${account?.actionLog?.length ?? 0}; append-only rule active.`,
      operatorLine: "Operator action log must append mark_analysis/request_evidence/attach_pdf/mark_ready/deliver events; legacy mark_human_review input is normalized before persistence.",
      requiredProof: ["operator action log", "updatedAt", "event id", "next status"],
      privateFields: ["operatorId", "operatorNote", "internal actionLog"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: false,
    }),
    lane({
      id: "version-history",
      family: "version_history",
      label: "Version history",
      state: receiptBound ? "locked" : "review",
      customerLine: customerLine(locale, receiptBound ? "locked" : "review", t(locale, "Nowa wersja raportu musi dostać nowy hash i wpis historii.", "Eine neue Report-Version braucht neuen Hash und History-Eintrag.", "A new report version must receive a new hash and history entry.")),
      proPdfLine: `Current version ${reportVersion ?? "pending"}; old versions stay immutable in vault contract.`,
      operatorLine: "Do not mutate delivered customer PDFs; create vNext when sources materially change.",
      requiredProof: ["reportVersion", "contentHash", "previousVersion pointer", "material change reason"],
      privateFields: ["raw diff", "operator comparison notes"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: false,
    }),
    lane({
      id: "private-delivery-pointer",
      family: "private_delivery_pointer",
      label: "Private delivery pointer",
      state: advancedRequested ? delivery?.summary.canDeliverAdvancedPrivately ? "private" : "blocked" : deliveryGateOpen ? "ready" : "review",
      customerLine: customerLine(locale, advancedRequested ? delivery?.summary.canDeliverAdvancedPrivately ? "private" : "blocked" : deliveryGateOpen ? "ready" : "review", t(locale, "Prywatna dostawa wskazuje konto/queue, nie publiczny raw payload.", "Private Delivery verweist auf Konto/Queue, nicht auf raw Payload.", "Private delivery points to account/queue, not a public raw payload.")),
      proPdfLine: `Delivery pointer ${privateDeliveryPointer}; private delivery ${String(delivery?.summary.canDeliverAdvancedPrivately ?? false)}.`,
      operatorLine: "Attach final customer-safe PDF by pointer after redaction; do not expose queue internals.",
      requiredProof: ["account delivery record", "server payment gate", "redaction state", "queue pointer"],
      privateFields: ["auditQueueId", "private delivery pointer", "customer email", "account route token"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: advancedRequested && !delivery?.summary.canDeliverAdvancedPrivately,
    }),
    lane({
      id: "retention-policy",
      family: "retention_policy",
      label: "Retention policy",
      state: "retained",
      customerLine: customerLine(locale, "retained", t(locale, "Case vault trzyma tylko potrzebne pola i rozdziela customer-safe od prywatnych danych.", "Case Vault behaelt nur notwendige Felder und trennt customer-safe von privaten Daten.", "Case vault keeps only necessary fields and separates customer-safe from private data.")),
      proPdfLine: "Retention: customer-safe report fields retained; private operator payload excluded from PDF.",
      operatorLine: "Retention must be explicit before production: receipt, redaction, delivery and support windows.",
      requiredProof: ["retention class", "redaction class", "support window", "delete/export plan"],
      privateFields: ["operator payload", "payment metadata", "raw provider payload"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: false,
    }),
    lane({
      id: "access-envelope",
      family: "access_envelope",
      label: "Access envelope",
      state: deliveryGateOpen ? "locked" : proRequested ? "blocked" : "review",
      customerLine: customerLine(locale, deliveryGateOpen ? "locked" : proRequested ? "blocked" : "review", t(locale, "Dostęp do PDF/Advanced wymaga server-side gate, nie samego wallet connect.", "PDF/Advanced Zugang braucht server-side Gate, nicht nur Wallet Connect.", "PDF/Advanced access requires a server-side gate, not wallet connect alone.")),
      proPdfLine: `Access envelope: pro ${String(delivery?.summary.canOpenProDownload ?? false)}; advanced ${String(delivery?.summary.canDeliverAdvancedPrivately ?? false)}.`,
      operatorLine: "Never treat wallet connect as payment proof; use entitlement and vault envelope.",
      requiredProof: ["server receipt", "entitlement context", "account scope", "receipt replay check"],
      privateFields: ["entitlement id", "payment session", "account delivery token"],
      blocksVaultPersist: proRequested && !deliveryGateOpen,
      blocksPrivateDelivery: advancedRequested && !delivery?.summary.canDeliverAdvancedPrivately,
    }),
    lane({
      id: "operator-handoff",
      family: "operator_handoff",
      label: "Operator handoff",
      state: automatedDeliveryReady ? "ready" : advancedRequested ? "blocked" : "review",
      customerLine: customerLine(locale, automatedDeliveryReady ? "ready" : advancedRequested ? "blocked" : "review", t(locale, "Advanced wymaga deterministycznego server-side delivery gate, receipt binding i redaction state przed finalnym wydaniem.", "Advanced braucht einen deterministischen serverseitigen Delivery Gate, Receipt Binding und Redaction State vor finaler Ausgabe.", "Advanced requires a deterministic server-side delivery gate, receipt binding and redaction state before final release.")),
      proPdfLine: `Automated private-delivery gate ${String(automatedDeliveryReady)}; internal QA readiness ${operatorReadiness}/100 (non-gating).`,
      operatorLine: "Optional internal QA may inspect scope/evidence, but only deterministic receipt, redaction and server delivery gates may authorize customer delivery.",
      requiredProof: ["server delivery gate", "receipt binding", "redaction state", "immutable delivery pointer"],
      privateFields: ["optional QA notes", "operator identity", "internal blockers"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: advancedRequested && !automatedDeliveryReady,
    }),
    lane({
      id: "replay-snapshot",
      family: "replay_snapshot",
      label: "Replay snapshot",
      state: receiptBound && pdfReady ? "locked" : "review",
      customerLine: customerLine(locale, receiptBound && pdfReady ? "locked" : "review", t(locale, "PDF i vault muszą dać się odtworzyć z tej samej wersji dowodów.", "PDF und Vault muessen aus derselben Evidence-Version reproduzierbar sein.", "PDF and vault must be replayable from the same evidence version.")),
      proPdfLine: `Snapshot bound to ${receiptId ?? "pending"}; PDF readiness ${pdfReadiness}/100.`,
      operatorLine: "Before final delivery, save replay snapshot: source states, missing evidence, receipt hash, redaction status.",
      requiredProof: ["source states", "missing evidence", "receipt hash", "redaction state", "PDF contract version"],
      privateFields: ["raw source payload", "operator-only rows", "provider keys"],
      blocksVaultPersist: false,
      blocksPrivateDelivery: false,
    }),
  ];

  const ready = lanes.filter((item) => item.state === "ready").length;
  const review = lanes.filter((item) => item.state === "review").length;
  const blocked = lanes.filter((item) => item.state === "blocked").length;
  const locked = lanes.filter((item) => item.state === "locked").length;
  const privateCount = lanes.filter((item) => item.state === "private").length;
  const retained = lanes.filter((item) => item.state === "retained").length;
  const vaultReadiness = readiness(lanes, (item) => !item.blocksPrivateDelivery || item.family !== "private_delivery_pointer");
  const privateDeliveryReadiness = readiness(lanes, (item) => item.blocksPrivateDelivery || ["private_delivery_pointer", "access_envelope", "operator_handoff", "receipt_binding", "case_identity"].includes(item.family));
  const replayReadiness = readiness(lanes, (item) => item.family === "receipt_binding" || item.family === "version_history" || item.family === "replay_snapshot");
  const nextBlockingLane = lanes.find((item) => item.blocksVaultPersist || item.blocksPrivateDelivery)?.label ?? t(locale, "Brak krytycznego blokera", "Kein kritischer Blocker", "No critical blocker");

  return {
    passId: PASS2588_AUDIT_CASE_VAULT_PRIVATE_DELIVERY_LEDGER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2588 turns paid audits into durable case vault records: receipt-bound, append-only, customer-safe and replayable.",
    customerRule: t(locale, "Płatny audyt dostaje prywatny case vault: wersja, hash, status dostawy i bezpieczny rekord konta.", "Paid Audit bekommt einen privaten Case Vault: Version, Hash, Delivery Status und sicheren Konto-Record.", "Paid audit receives a private case vault: version, hash, delivery status and safe account record."),
    operatorRule: "Customer delivery is authorized only by deterministic server-side gates after receipt binding, redaction and replay snapshot checks; operator QA is optional and non-gating.",
    privacyBoundary: "Customer PDF may expose status/version/hash summary; account ids, payment ids, raw provider payloads and operator notes remain private.",
    summary: {
      totalLanes: lanes.length,
      ready,
      review,
      blocked,
      locked,
      private: privateCount,
      retained,
      vaultReadiness,
      privateDeliveryReadiness,
      replayReadiness,
      canPersistCase: !lanes.some((item) => item.blocksVaultPersist),
      canAttachCustomerPdf: pdfReady && receiptBound && !lanes.some((item) => item.blocksVaultPersist),
      canDeliverPrivateReport: advancedRequested ? !lanes.some((item) => item.blocksPrivateDelivery) : deliveryGateOpen && receiptBound,
      topVaultRisk: nextBlockingLane,
      nextBlockingLane,
    },
    vaultId,
    lanes,
    customerRows: lanes.map((item) => row(item.label, item.state, item.customerLine)),
    proPdfRows: lanes.map((item) => row(item.label, item.state, item.proPdfLine)),
    operatorRows: lanes.map((item) => row(item.label, item.state, item.operatorLine)),
    caseVaultContract: {
      vaultId,
      accountId,
      accountMessageId,
      auditQueueId,
      receiptId,
      reportVersion,
      contentHash,
      sourceMode: account?.source ?? "memory_or_preview",
      persistenceMode: account?.source === "supabase" ? "durable-supabase" : "memory-preview-needs-production-store",
      appendOnlyRule: "Every delivery/status change appends an event; delivered report versions are immutable.",
      customerSafeFields: ["vaultId", "deliveryStatus", "reportVersion", "contentHash", "nextCheckAt", "customerPdfRoute", "publicReportRoute"],
      privateFields: ["accountId", "contactEmail", "paymentEvidenceRefs", "auditQueueId", "operatorNote", "rawProviderPayload"],
    },
    privateDeliveryLedger: {
      deliveryPointer: privateDeliveryPointer,
      deliveryStatus: account?.deliveryStatus ?? delivery?.accountDeliveryContract.deliveryStatus ?? "preview_pending",
      customerPdfRoute: account?.pdfRoute,
      publicReportRoute: account?.publicReportRoute,
      redactionRequired: !delivery?.summary.canDeliverAdvancedPrivately,
      allowedRecipients: uniq([accountId, account?.contactEmail ?? ""], 4),
      forbiddenPayloads: ["raw provider payload", "operator-only notes", "payment session ids", "API keys", "exploit instructions", "seed phrase content"],
    },
    replaySnapshotContract: {
      snapshotId: `snapshot-${shortHash(`${vaultId}:${contentHash ?? "pending"}`)}`,
      boundReceipt: receiptId,
      boundHash: contentHash,
      sourceReplayRule: "Replay uses source states and missing-evidence rows captured at report generation time.",
      mismatchRule: "If receipt hash, PDF contract or source freshness changes materially, create a new report version instead of mutating the old one.",
    },
    visualMergeContract: {
      publicSlot: "Basic result shows only vault status, version/hash summary and next delivery step.",
      accountSlot: "Member account shows private delivery status and customer-safe PDF pointer.",
      operatorSlot: "Operator console shows vault id, timeline, redaction, receipt and replay snapshot.",
      rule: "User visual redesign may replace layout, but vaultId, receiptId, contentHash, deliveryStatus and redaction state must stay wired.",
      keepWired: ["vaultId", "caseVaultContract", "privateDeliveryLedger", "replaySnapshotContract", "summary.canDeliverPrivateReport"],
      doNotExpose: ["accountId", "contactEmail", "paymentEvidenceRefs", "operatorNote", "rawProviderPayload", "API keys"],
    },
    nextImplementationBacklog: [
      "Persist vault records in durable storage with account-scoped access checks.",
      "Add account page customer-safe PDF delivery list bound to vaultId.",
      "Add operator action append endpoint for redaction/final delivery events.",
      "Add replay snapshot comparison when source freshness changes.",
      "Add retention/export/delete policy UI before production launch.",
    ],
  };
}
