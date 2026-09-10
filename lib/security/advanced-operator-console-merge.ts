import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2579AdvancedManualReviewQueueReport } from "./advanced-manual-review-queue";
import type { Pass2580CustomerSafeDeliveryDecisionReport } from "./customer-safe-delivery-decision";
import type { Pass2581AuditVersionedRecheckReceiptReport } from "./audit-versioned-recheck-receipt";
import type { Pass2585PremiumProPdfTemplateContractReport } from "./premium-pro-pdf-template-contract";

export const PASS2586_ADVANCED_OPERATOR_CONSOLE_MERGE_ID = "advanced-operator-console-merge" as const;

export type Pass2586OperatorControlStatus = "ready" | "review" | "redact" | "blocked" | "locked";
export type Pass2586OperatorControlPriority = "low" | "normal" | "high" | "critical";
export type Pass2586OperatorControlFamily =
  | "payment_receipt"
  | "scope_consent"
  | "evidence_sufficiency"
  | "manual_notes"
  | "redaction_state"
  | "receipt_lock"
  | "recheck_queue"
  | "final_signoff";

export type Pass2586OperatorControl = {
  id: string;
  family: Pass2586OperatorControlFamily;
  label: string;
  status: Pass2586OperatorControlStatus;
  priority: Pass2586OperatorControlPriority;
  customerLine: string;
  proPdfLine: string;
  operatorAction: string;
  requiredEvidence: string[];
  privateFields: string[];
  blocksFinalSign: boolean;
  blocksCustomerDelivery: boolean;
};

export type Pass2586OperatorConsoleRow = {
  label: string;
  status: Pass2586OperatorControlStatus;
  priority: Pass2586OperatorControlPriority;
  output: string;
};

export type Pass2586AdvancedOperatorConsoleMergeReport = {
  passId: typeof PASS2586_ADVANCED_OPERATOR_CONSOLE_MERGE_ID;
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
  mergeRule: string;
  summary: {
    totalControls: number;
    ready: number;
    review: number;
    redact: number;
    blocked: number;
    locked: number;
    critical: number;
    customerVisibleRows: number;
    operatorConsoleReadiness: number;
    finalSignReadiness: number;
    canOpenAdvancedCase: boolean;
    canCustomerDeliverAdvanced: boolean;
    canFinalSignAdvanced: boolean;
    nextCriticalStep: string;
  };
  controls: Pass2586OperatorControl[];
  customerRows: Pass2586OperatorConsoleRow[];
  proPdfRows: Pass2586OperatorConsoleRow[];
  operatorRows: Pass2586OperatorConsoleRow[];
  manualNotesContract: {
    noteSlots: string[];
    privateOnlyFields: string[];
    requiredBeforeFinal: string[];
    customerSafeSummaryRule: string;
  };
  redactionState: {
    required: boolean;
    blockers: string[];
    safeExportRule: string;
  };
  finalSignoffState: {
    state: Pass2586OperatorControlStatus;
    blockers: string[];
    requiredReceipts: string[];
    signoffRule: string;
  };
  visualMergeContract: {
    publicSlot: string;
    pdfSlot: string;
    operatorSlot: string;
    rule: string;
    keepWired: string[];
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  paymentVerified?: boolean;
  operatorId?: string;
  advancedManualReviewQueue?: Pass2579AdvancedManualReviewQueueReport | null;
  customerSafeDeliveryDecision?: Pass2580CustomerSafeDeliveryDecisionReport | null;
  versionedRecheckReceipt?: Pass2581AuditVersionedRecheckReceiptReport | null;
  premiumProPdfTemplateContract?: Pass2585PremiumProPdfTemplateContractReport | null;
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

function unique(values: string[], max = 10) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, max);
}

function row(label: string, status: Pass2586OperatorControlStatus, priority: Pass2586OperatorControlPriority, output: string): Pass2586OperatorConsoleRow {
  return { label, status, priority, output };
}

function control(args: Pass2586OperatorControl): Pass2586OperatorControl {
  return {
    ...args,
    requiredEvidence: unique(args.requiredEvidence, 9),
    privateFields: unique(args.privateFields, 9),
  };
}

function priorityFrom(status: Pass2586OperatorControlStatus, fallback: Pass2586OperatorControlPriority = "normal"): Pass2586OperatorControlPriority {
  if (status === "blocked") return "critical";
  if (status === "redact") return "high";
  if (status === "review") return fallback === "low" ? "normal" : fallback;
  return fallback;
}

function statusText(locale: string, status: Pass2586OperatorControlStatus) {
  if (status === "ready") return t(locale, "gotowe", "bereit", "ready");
  if (status === "review") return t(locale, "do przeglądu", "zu pruefen", "review");
  if (status === "redact") return t(locale, "redakcja", "Redaction", "redaction");
  if (status === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "zablokowane/locked", "locked", "locked");
}

function readinessFrom(controls: Pass2586OperatorControl[]) {
  const ready = controls.filter((item) => item.status === "ready").length;
  const locked = controls.filter((item) => item.status === "locked").length;
  const review = controls.filter((item) => item.status === "review").length;
  const redact = controls.filter((item) => item.status === "redact").length;
  const blocked = controls.filter((item) => item.status === "blocked").length;
  return clamp(((ready + locked) / Math.max(1, controls.length)) * 86 - review * 4 - redact * 7 - blocked * 14, 0, 100);
}

function customerLine(locale: string, status: Pass2586OperatorControlStatus, safeLabel: string) {
  const prefix = status === "ready" || status === "locked"
    ? t(locale, "Kontrola Advanced jest gotowa.", "Advanced-Kontrolle ist bereit.", "Advanced control is ready.")
    : status === "redact"
      ? t(locale, "Kontrola Advanced czeka na redakcję.", "Advanced-Kontrolle wartet auf Redaction.", "Advanced control waits for redaction.")
      : status === "blocked"
        ? t(locale, "Kontrola Advanced jest zablokowana do czasu spełnienia warunku.", "Advanced-Kontrolle ist bis zur Bedingung blockiert.", "Advanced control is blocked until the condition is met.")
        : t(locale, "Kontrola Advanced czeka na operatora.", "Advanced-Kontrolle wartet auf Operator.", "Advanced control waits for operator review.");
  return `${prefix} ${safeLabel}`.slice(0, 320);
}

export function buildPass2586AdvancedOperatorConsoleMergeReport(input: BuilderInput): Pass2586AdvancedOperatorConsoleMergeReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const legacyQueue = input.advancedManualReviewQueue;
  const delivery = input.customerSafeDeliveryDecision;
  const receipt = input.versionedRecheckReceipt;
  const pdf = input.premiumProPdfTemplateContract;
  const paymentVerified = Boolean(input.paymentVerified);

  const chain = clean(input.chain, 40) ?? legacyQueue?.target.chain ?? delivery?.target.chain ?? receipt?.target.chain ?? pdf?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? legacyQueue?.target.contractAddress ?? delivery?.target.contractAddress ?? receipt?.target.contractAddress ?? pdf?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? legacyQueue?.target.projectName ?? delivery?.target.projectName ?? receipt?.target.projectName ?? pdf?.target.projectName;

  // Advanced is stop-sold. Payment or optional QA cannot unlock it; this console is an internal observer only.
  const availabilityStatus: Pass2586OperatorControlStatus = "blocked";
  const paymentStatus: Pass2586OperatorControlStatus = paymentVerified ? "ready" : "review";
  const scopeStatus: Pass2586OperatorControlStatus = "ready";
  const evidenceStatus: Pass2586OperatorControlStatus = (delivery?.summary.blockedGates ?? 0) >= 2 ? "blocked" : (legacyQueue?.summary.blockedByEvidence ?? 1) === 0 && (delivery?.summary.blockedGates ?? 1) === 0 ? "ready" : "review";
  const noteStatus: Pass2586OperatorControlStatus = "ready";
  const redactionStatus: Pass2586OperatorControlStatus = (delivery?.summary.redactionGates ?? 1) > 0 || (pdf?.summary.redactionRequired ?? 1) > 0 ? "redact" : "ready";
  const receiptStatus: Pass2586OperatorControlStatus = receipt?.receipt.contentHash && receipt?.receipt.runId ? "locked" : "blocked";
  const recheckStatus: Pass2586OperatorControlStatus = (receipt?.recheckPlan.requiredBeforeFinal.length ?? 1) === 0 && receipt?.summary.canFinalSign ? "ready" : "review";
  const finalPreBlocked = ([availabilityStatus, receiptStatus] as Pass2586OperatorControlStatus[]).includes("blocked");
  const finalNeedsWork = ([evidenceStatus, noteStatus, redactionStatus, recheckStatus] as Pass2586OperatorControlStatus[]).some((status) => status === "review" || status === "redact" || status === "blocked");
  const finalStatus: Pass2586OperatorControlStatus = finalPreBlocked ? "blocked" : finalNeedsWork ? "review" : "ready";

  const controls = [
    control({
      id: "adv-current-product-availability",
      family: "final_signoff",
      label: "Current product availability",
      status: availabilityStatus,
      priority: "critical",
      customerLine: t(locale, "Advanced jest NOT_FOR_SALE; payment ani human QA nie odblokowują delivery.", "Advanced ist NOT_FOR_SALE; Payment oder Human-QA schalten Delivery nicht frei.", "Advanced is NOT_FOR_SALE; payment or human QA cannot unlock delivery."),
      proPdfLine: "Current availability gate: NOT_FOR_SALE. This internal console cannot override the owner-bound catalog/release decision.",
      operatorAction: "Keep customer delivery disabled until a later owner-bound sale decision and all final truth/rights/value/security/operations receipts exist.",
      requiredEvidence: ["current SKU truth", "owner-bound sale decision", "final release receipts"],
      privateFields: [],
      blocksFinalSign: true,
      blocksCustomerDelivery: true,
    }),
    control({
      id: "adv-operator-payment-receipt",
      family: "payment_receipt",
      label: "Server payment receipt",
      status: paymentStatus,
      priority: priorityFrom(paymentStatus),
      customerLine: customerLine(locale, paymentStatus, t(locale, "Payment receipt jest tylko przyszłym warunkiem paid delivery; nie odblokowuje obecnego Advanced.", "Payment Receipt ist nur eine künftige Bedingung für Paid Delivery; es schaltet das aktuelle Advanced nicht frei.", "Payment receipt is only a future paid-delivery condition; it does not unlock current Advanced.")),
      proPdfLine: `Payment gate: ${statusText(locale, paymentStatus)}; wallet connection is identity/context only, not payment proof.`,
      operatorAction: paymentVerified ? "Record the receipt for future paid-lifecycle testing; do not unlock current Advanced." : "Do not request payment for current Advanced; it remains stop-sold.",
      requiredEvidence: ["server-side receipt", "entitlement id", "audit queue id"],
      privateFields: ["payment session id", "customer account id", "billing email"],
      blocksFinalSign: false,
      blocksCustomerDelivery: false,
    }),
    control({
      id: "adv-operator-scope-consent",
      family: "scope_consent",
      label: "Scope / consent boundary",
      status: scopeStatus,
      priority: priorityFrom(scopeStatus),
      customerLine: customerLine(locale, scopeStatus, t(locale, "Bieżący Advanced wykonuje wyłącznie pasywną analizę automatyczną; aktywne testy wymagają osobnej autoryzacji poza produktem.", "Das aktuelle Advanced führt nur passive automatisierte Analyse aus; aktive Tests brauchen separate Autorisierung ausserhalb des Produkts.", "Current Advanced performs passive automated analysis only; active testing requires separate authorization outside the product.")),
      proPdfLine: `Scope safety: ${statusText(locale, scopeStatus)}; active testing is outside the current product contract without separate authorization.`,
      operatorAction: "Keep active/custom testing outside the current product unless separately authorized; passive automated evidence checks may continue.",
      requiredEvidence: ["scope statement", "project-owner consent", "allowed testing depth"],
      privateFields: ["operator contact thread", "internal authorization note"],
      blocksFinalSign: false,
      blocksCustomerDelivery: false,
    }),
    control({
      id: "adv-operator-evidence-sufficiency",
      family: "evidence_sufficiency",
      label: "Evidence sufficiency",
      status: evidenceStatus,
      priority: priorityFrom(evidenceStatus, "high"),
      customerLine: customerLine(locale, evidenceStatus, t(locale, "Finalny werdykt wymaga domknięcia krytycznych luk dowodowych.", "Das finale Urteil braucht geschlossene kritische Evidenzluecken.", "Final verdict requires critical evidence gaps to be resolved.")),
      proPdfLine: `Evidence gate: ${statusText(locale, evidenceStatus)}; source quorum, claim ledger, permissions and liquidity lanes must agree before final sign-off.`,
      operatorAction: "Review missing evidence, second-source conflicts, adapter errors, permission flags and liquidity/holder blockers.",
      requiredEvidence: ["source quorum", "claim ledger", "permission map", "liquidity/holder evidence", "freshness TTL"],
      privateFields: ["raw provider diffs", "operator conflict notes"],
      blocksFinalSign: evidenceStatus !== "ready",
      blocksCustomerDelivery: evidenceStatus === "blocked",
    }),
    control({
      id: "adv-operator-manual-notes",
      family: "manual_notes",
      label: "Optional internal QA notes",
      status: noteStatus,
      priority: priorityFrom(noteStatus, "normal"),
      customerLine: customerLine(locale, noteStatus, t(locale, "Opcjonalne wewnętrzne QA nie jest częścią customer deliverable i nie blokuje automatycznego wyniku.", "Optionales internes QA ist kein Customer Deliverable und blockiert das automatisierte Ergebnis nicht.", "Optional internal QA is not part of the customer deliverable and never blocks automated output.")),
      proPdfLine: `Optional QA state: ${statusText(locale, noteStatus)}; QA notes are private and carry zero customer feature credit.`,
      operatorAction: "Optional QA may record disagreements or limitations, but cannot unlock, block or certify the product.",
      requiredEvidence: ["optional QA disagreement/limitation receipt"],
      privateFields: ["raw notes", "internal Slack/Gmail/context", "unredacted investigation detail"],
      blocksFinalSign: false,
      blocksCustomerDelivery: false,
    }),
    control({
      id: "adv-operator-redaction-state",
      family: "redaction_state",
      label: "Redaction state",
      status: redactionStatus,
      priority: priorityFrom(redactionStatus, "high"),
      customerLine: customerLine(locale, redactionStatus, t(locale, "Prywatne dane, raw payload i operator-only pola nie wychodzą do klienta.", "Private Daten, Raw Payload und Operator-only Felder verlassen nicht die Konsole.", "Private data, raw payload and operator-only fields never leave the console.")),
      proPdfLine: `Redaction gate: ${statusText(locale, redactionStatus)}; customer exports must be filtered through the PDF/template contract.`,
      operatorAction: "Run redaction checklist before PDF, account delivery or public registry export.",
      requiredEvidence: ["redaction checklist", "customer-safe PDF lines", "private field denylist"],
      privateFields: ["raw payload", "private operator notes", "payment/contact identifiers"],
      blocksFinalSign: redactionStatus !== "ready",
      blocksCustomerDelivery: redactionStatus !== "ready",
    }),
    control({
      id: "adv-operator-receipt-lock",
      family: "receipt_lock",
      label: "Receipt / hash lock",
      status: receiptStatus,
      priority: priorityFrom(receiptStatus, "high"),
      customerLine: customerLine(locale, receiptStatus, t(locale, "Raport ma wersję, run ID i content hash.", "Der Report hat Version, Run ID und Content Hash.", "Report has version, run ID and content hash.")),
      proPdfLine: `Receipt gate: ${statusText(locale, receiptStatus)}; material report changes require a new version and receipt.`,
      operatorAction: "Confirm reportVersion, runId, contentHash and immutable fields before final sign-off.",
      requiredEvidence: ["report version", "run id", "content hash", "immutable field list"],
      privateFields: ["internal mutation trace", "operator draft deltas"],
      blocksFinalSign: receiptStatus === "blocked",
      blocksCustomerDelivery: receiptStatus === "blocked",
    }),
    control({
      id: "adv-operator-recheck-queue",
      family: "recheck_queue",
      label: "Re-check queue",
      status: recheckStatus,
      priority: priorityFrom(recheckStatus, "normal"),
      customerLine: customerLine(locale, recheckStatus, t(locale, "Werdykt końcowy musi znać kolejny re-check i trigger zmian.", "Finales Urteil braucht naechsten Re-check und Trigger.", "Final verdict must carry next re-check and change triggers.")),
      proPdfLine: `Re-check gate: ${statusText(locale, recheckStatus)}; stale or unresolved triggers keep the report out of final sign-off.`,
      operatorAction: "Confirm nextCheckAt, priority and requiredBeforeFinal list before delivery.",
      requiredEvidence: ["nextCheckAt", "re-check priority", "requiredBeforeFinal list"],
      privateFields: ["internal scheduler state"],
      blocksFinalSign: recheckStatus !== "ready",
      blocksCustomerDelivery: false,
    }),
    control({
      id: "adv-operator-final-signoff",
      family: "final_signoff",
      label: "Final sign-off control",
      status: finalStatus,
      priority: priorityFrom(finalStatus, "critical"),
      customerLine: customerLine(locale, finalStatus, t(locale, "Advanced pozostaje stop-sold; przyszły customer output wymaga owner-bound availability oraz automatycznych evidence/rights/security/retest gates.", "Advanced bleibt stop-sold; künftiger Customer Output braucht owner-bound Availability sowie automatisierte Evidence/Rights/Security/Retest-Gates.", "Advanced remains stop-sold; future customer output requires owner-bound availability plus automated evidence/rights/security/retest gates.")),
      proPdfLine: `Final state: ${statusText(locale, finalStatus)}; Advanced is an automated evidence/retest product and this optional internal console cannot override release gates.`,
      operatorAction: "Never manually sign a blocked product into readiness. Resolve automated evidence/retest/redaction/receipt blockers and wait for an owner-bound availability decision.",
      requiredEvidence: ["product availability gate", "evidence gate", "redaction gate", "receipt gate", "re-check gate"],
      privateFields: ["operator signature", "private case audit trail"],
      blocksFinalSign: finalStatus !== "ready",
      blocksCustomerDelivery: finalStatus !== "ready",
    }),
  ];

  const ready = controls.filter((item) => item.status === "ready").length;
  const review = controls.filter((item) => item.status === "review").length;
  const redact = controls.filter((item) => item.status === "redact").length;
  const blocked = controls.filter((item) => item.status === "blocked").length;
  const locked = controls.filter((item) => item.status === "locked").length;
  const critical = controls.filter((item) => item.priority === "critical").length;
  const operatorConsoleReadiness = readinessFrom(controls);
  const finalBlockers = controls.filter((item) => item.blocksFinalSign && item.status !== "ready" && item.status !== "locked");
  const deliveryBlockers = controls.filter((item) => item.blocksCustomerDelivery && item.status !== "ready" && item.status !== "locked");
  const canOpenAdvancedCase = true; // internal automated evaluation may run while stop-sold
  const canCustomerDeliverAdvanced = false; // current owner-bound catalog: NOT_FOR_SALE
  const canFinalSignAdvanced = false; // no manual/internal console may override stop-sell
  const finalSignReadiness = clamp(operatorConsoleReadiness + (paymentVerified ? 6 : -14) - finalBlockers.length * 5, 0, 100);
  const nextCriticalStep = finalBlockers[0]?.operatorAction ?? deliveryBlockers[0]?.operatorAction ?? t(locale, "Kontynuuj automatyczne evidence/retest; nie odblokowuj customer delivery bez owner-bound decyzji.", "Automatisierte Evidence/Retest fortsetzen; Customer Delivery nicht ohne owner-bound Entscheidung freischalten.", "Continue automated evidence/retest; do not unlock customer delivery without an owner-bound decision.");

  const customerRows = controls
    .filter((item) => item.family !== "manual_notes" || item.status !== "review")
    .slice(0, 7)
    .map((item) => row(item.label, item.status, item.priority, item.customerLine));

  const proPdfRows = controls.slice(0, 8).map((item) => row(item.label, item.status, item.priority, item.proPdfLine));
  const operatorRows = controls.flatMap((item) => [
    row(item.label, item.status, item.priority, item.operatorAction),
    row(`${item.label} evidence`, item.status, item.priority, `Required: ${item.requiredEvidence.join(", ")}; private: ${item.privateFields.join(", ")}`),
  ]).slice(0, 18);

  const redactionBlockers = controls.filter((item) => item.status === "redact" || (item.family === "redaction_state" && item.status !== "ready")).map((item) => item.label);
  const signoffBlockers = finalBlockers.map((item) => item.label);

  return {
    passId: PASS2586_ADVANCED_OPERATOR_CONSOLE_MERGE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: {
      ...(contractAddress ? { contractAddress } : {}),
      ...(projectName ? { projectName } : {}),
      chain,
    },
    rule: "This legacy-named operator console is optional internal QA/observability only. Current Advanced is an automated evidence/retest product and remains NOT_FOR_SALE; no human/operator action may unlock, block or certify it.",
    customerRule: t(
      locale,
      "Advanced jest automatycznym workflow evidence/retest; klient widzi tylko bezpieczny status, braki i ograniczenia, bez raw payloadów i prywatnych QA notes.",
      "Advanced ist ein automatisierter Evidence/Retest-Workflow; der Kunde sieht nur sicheren Status, Lücken und Grenzen, ohne Raw Payloads oder private QA-Notizen.",
      "Advanced is an automated evidence/retest workflow; the customer sees only safe status, gaps and limitations, without raw payloads or private QA notes.",
    ),
    operatorRule: "Optional internal QA may challenge evidence but cannot create readiness. Automated gates plus owner-bound availability decide delivery; unresolved evidence remains a limitation or blocker.",
    mergeRule: "Keep the user-designed visual audit page, but wire Advanced status cards to this console payload instead of exposing operator internals.",
    summary: {
      totalControls: controls.length,
      ready,
      review,
      redact,
      blocked,
      locked,
      critical,
      customerVisibleRows: customerRows.length,
      operatorConsoleReadiness,
      finalSignReadiness,
      canOpenAdvancedCase,
      canCustomerDeliverAdvanced,
      canFinalSignAdvanced,
      nextCriticalStep,
    },
    controls,
    customerRows,
    proPdfRows,
    operatorRows,
    manualNotesContract: {
      noteSlots: ["operator finding", "source conflict note", "risk override explanation", "customer-safe summary", "unresolved limitation"],
      privateOnlyFields: ["raw provider payload", "private operator notes", "payment/account identifiers", "unredacted contact trail"],
      requiredBeforeFinal: unique(signoffBlockers, 8),
      customerSafeSummaryRule: "Optional QA notes are never required for final product readiness; if present, expose only non-sensitive evidence-backed limitations through the normal automated projection.",
    },
    redactionState: {
      required: redactionBlockers.length > 0,
      blockers: redactionBlockers.length ? redactionBlockers : ["none"],
      safeExportRule: "Only customerRows/proPdfRows/customer-safe PDF lines may be exported; operatorRows stay private.",
    },
    finalSignoffState: {
      state: finalStatus,
      blockers: signoffBlockers.length ? signoffBlockers : ["none"],
      requiredReceipts: ["server-side paid receipt", "reportVersion", "runId", "contentHash", "redaction decision"],
      signoffRule: "No manual sign-off can make Advanced saleable. Customer delivery remains impossible while the owner-bound availability gate is blocked or automated evidence/redaction/receipt/re-check gates are unresolved.",
    },
    visualMergeContract: {
      publicSlot: "audit.advanced.public_status_panel",
      pdfSlot: "pro_pdf.advanced_operator_status_summary",
      operatorSlot: "admin.advanced_operator_console.case_controls",
      rule: "Visual layer may change, but the control statuses, blockers, finalSignoffState and redactionState must remain wired.",
      keepWired: [
        "summary.operatorConsoleReadiness",
        "summary.canFinalSignAdvanced",
        "summary.nextCriticalStep",
        "redactionState.required",
        "finalSignoffState.blockers",
        "controls[].blocksFinalSign",
      ],
      doNotExpose: ["operatorRows", "manualNotesContract.privateOnlyFields", "raw provider payload", "payment identifiers"],
    },
    nextImplementationBacklog: [
      "Build private admin case drawer using controls[] and finalSignoffState.",
      "Persist operator notes and redaction decisions in durable case storage.",
      "Add role-gated final sign button with receipt/version mutation guard.",
      "Attach customer-safe Advanced status to account delivery without exposing operatorRows.",
      "Add regression tests that fail if operatorRows leak into public Basic or Pro PDF customer lines.",
    ],
  };
}
