import { C0_OR_BRACE_ANGLE_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2578AuditReportAssemblerReport } from "./audit-report-assembler";
import type { Pass2579AdvancedManualReviewQueueReport } from "./advanced-manual-review-queue";

export const PASS2580_CUSTOMER_SAFE_DELIVERY_DECISION_ID = "customer-safe-delivery-decision" as const;

export type Pass2580DeliveryGateStatus = "ready" | "review" | "blocked" | "redact";
export type Pass2580DeliveryGatePriority = "low" | "normal" | "high" | "critical";
export type Pass2580DeliveryStatus = "customer_safe_preview" | "needs_payment" | "needs_scope" | "needs_evidence" | "needs_redaction" | "ready_for_customer" | "not_deliverable";

export type Pass2580DeliveryGate = {
  id: string;
  label: string;
  status: Pass2580DeliveryGateStatus;
  priority: Pass2580DeliveryGatePriority;
  customerLine: string;
  operatorLine: string;
  evidenceNeeded: string[];
  canShowCustomer: boolean;
};

export type Pass2580CustomerSafeRow = {
  label: string;
  status: Pass2580DeliveryGateStatus;
  output: string;
};

export type Pass2580CustomerSafeDeliveryDecisionReport = {
  passId: typeof PASS2580_CUSTOMER_SAFE_DELIVERY_DECISION_ID;
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
  summary: {
    deliveryStatus: Pass2580DeliveryStatus;
    deliveryReadiness: number;
    blockedGates: number;
    reviewGates: number;
    redactionGates: number;
    readyGates: number;
    customerVisibleRows: number;
    proPdfReady: boolean;
    advancedReady: boolean;
  };
  gates: Pass2580DeliveryGate[];
  customerSafeRows: Pass2580CustomerSafeRow[];
  proPdfRows: Pass2580CustomerSafeRow[];
  redactionChecklist: string[];
  nextActions: string[];
  visualMergeContract: {
    publicSlot: string;
    adminSlot: string;
    pdfSlot: string;
    rule: string;
    keepWired: string[];
  };
};

type DeliveryInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  reportAssembler?: Pass2578AuditReportAssemblerReport | null;
  /** Legacy compatibility payload only. Current delivery logic must not derive a mandatory-human gate from it. */
  advancedManualReviewQueue?: Pass2579AdvancedManualReviewQueueReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_BRACE_ANGLE_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function gate(args: Pass2580DeliveryGate): Pass2580DeliveryGate {
  return {
    ...args,
    evidenceNeeded: Array.from(new Set(args.evidenceNeeded.map((item) => item.trim()).filter(Boolean))).slice(0, 7),
  };
}

function statusToDelivery(locale: string, status: Pass2580DeliveryStatus) {
  if (status === "ready_for_customer") return t(locale, "gotowe do dostawy", "bereit fuer Delivery", "ready for delivery");
  if (status === "needs_payment") return t(locale, "czeka na płatność", "wartet auf Zahlung", "waiting for payment");
  if (status === "needs_scope") return t(locale, "czeka na zakres/zgodę", "wartet auf Scope/Zustimmung", "waiting for scope/consent");
  if (status === "needs_evidence") return t(locale, "czeka na dowody", "wartet auf Belege", "waiting for evidence");
  if (status === "needs_redaction") return t(locale, "czeka na redakcję", "wartet auf Redaction", "waiting for redaction");
  if (status === "not_deliverable") return t(locale, "nie do dostawy", "nicht lieferbar", "not deliverable");
  return t(locale, "publiczny podgląd", "oeffentliche Vorschau", "public preview");
}

function deliveryStatus(args: {
  productUnavailable: number;
  paymentBlocked: number;
  scopeBlocked: number;
  evidenceBlocked: number;
  blockedGates: number;
  redactionGates: number;
  readiness: number;
}): Pass2580DeliveryStatus {
  if (args.productUnavailable > 0) return "not_deliverable";
  if (args.paymentBlocked > 0) return "needs_payment";
  if (args.scopeBlocked > 0) return "needs_scope";
  if (args.evidenceBlocked > 0) return "needs_evidence";
  if (args.blockedGates > 0) return "not_deliverable";
  if (args.redactionGates > 0) return "needs_redaction";
  if (args.readiness >= 78) return "ready_for_customer";
  return "customer_safe_preview";
}

function lineIncludes(lines: string[], re: RegExp) {
  return lines.some((line) => re.test(line.toLowerCase()));
}

export function buildPass2580CustomerSafeDeliveryDecisionReport(input: DeliveryInput): Pass2580CustomerSafeDeliveryDecisionReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.reportAssembler?.target.chain ?? input.advancedManualReviewQueue?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.reportAssembler?.target.contractAddress ?? input.advancedManualReviewQueue?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.reportAssembler?.target.projectName ?? input.advancedManualReviewQueue?.target.projectName;

  const assembler = input.reportAssembler;
  const legacyQueue = input.advancedManualReviewQueue;
  const advancedLines = [
    ...(assembler?.advancedQueue ?? []),
    ...(legacyQueue?.items.map((item) => `${item.title} ${item.operatorAction}`) ?? []),
  ];
  const isAdvanced = input.reviewLevel === "advanced_review";
  const productUnavailable = isAdvanced ? 1 : 0;
  const paymentBlocked = isAdvanced ? 0 : legacyQueue?.summary.blockedByPayment ?? 1;
  // Current Velmère Audit is passive/automated. Scope consent is required only for active testing, which this product does not perform.
  const scopeBlocked = 0;
  const evidenceBlocked = (assembler?.summary.missing ?? 0) + (assembler?.summary.blocked ?? 0);
  const readiness = assembler?.finalVerdict.readinessScore ?? 38;
  const confidence = assembler?.finalVerdict.sourceConfidence ?? 42;
  const risk = assembler?.finalVerdict.riskScore ?? null;
  const reviewPriority = assembler?.finalVerdict.reviewPriorityScore ?? 62;
  const redactionNeeded = readiness < 88 || confidence < 82;

  const gates = [
    gate({
      id: "product-availability",
      label: "Current product availability",
      status: productUnavailable > 0 ? "blocked" : "ready",
      priority: productUnavailable > 0 ? "critical" : "normal",
      customerLine: productUnavailable > 0
        ? t(locale, "Advanced jest obecnie NOT_FOR_SALE; żaden payment, entitlement ani human QA nie może go odblokować.", "Advanced ist derzeit NOT_FOR_SALE; weder Payment, Entitlement noch Human-QA können es freischalten.", "Advanced is currently NOT_FOR_SALE; no payment, entitlement or human QA can unlock it.")
        : t(locale, "Produkt jest dostępny w bieżącym kontrakcie katalogowym.", "Das Produkt ist im aktuellen Katalogvertrag verfügbar.", "The product is available under the current catalog contract."),
      operatorLine: "Keep Advanced customer delivery blocked until a later owner-bound sale decision plus final truth/rights/value/security/operations gates; optional QA cannot override this.",
      evidenceNeeded: ["current SKU truth", "owner-bound release decision", "final gate receipts"],
      canShowCustomer: true,
    }),
    gate({
      id: "payment-entitlement",
      label: "Payment / entitlement proof",
      status: paymentBlocked > 0 ? "blocked" : "ready",
      priority: paymentBlocked > 0 ? "critical" : "normal",
      customerLine: isAdvanced
        ? t(locale, "Advanced nie jest do kupienia; payment nie jest ścieżką odblokowania.", "Advanced ist nicht kaufbar; Payment ist kein Freischaltpfad.", "Advanced is not purchasable; payment is not an unlock path.")
        : paymentBlocked > 0
          ? t(locale, "Płatny customer output czeka na server-side receipt.", "Paid Customer Output wartet auf server-side Receipt.", "Paid customer output waits for a server-side receipt.")
          : t(locale, "Płatność i entitlement są potwierdzone.", "Zahlung und Entitlement sind bestaetigt.", "Payment and entitlement are verified."),
      operatorLine: "Verify server-side entitlement id, product id and audit queue id before any private delivery.",
      evidenceNeeded: ["server-side receipt", "entitlement id", "audit queue id"],
      canShowCustomer: true,
    }),
    gate({
      id: "scope-consent",
      label: "Scope / consent boundary",
      status: scopeBlocked > 0 ? "blocked" : "ready",
      priority: scopeBlocked > 0 ? "high" : "normal",
      customerLine: t(locale, "Bieżący Audit jest pasywną analizą automatyczną; aktywne testy pozostają zabronione bez osobnej autoryzacji.", "Der aktuelle Audit ist eine passive automatisierte Analyse; aktive Tests bleiben ohne separate Autorisierung verboten.", "Current Audit is passive automated analysis; active testing remains prohibited without separate authorization."),
      operatorLine: "Do not turn passive analysis into active testing. Any future active/custom test requires separate explicit authorization and is outside the current product contract.",
      evidenceNeeded: ["audit scope", "project-owner consent", "no active testing without authorization"],
      canShowCustomer: true,
    }),
    gate({
      id: "source-evidence",
      label: "Evidence completeness",
      status: evidenceBlocked > 0 ? "blocked" : readiness >= 72 ? "ready" : "review",
      priority: evidenceBlocked > 2 ? "critical" : evidenceBlocked > 0 ? "high" : "normal",
      customerLine: evidenceBlocked > 0
        ? t(locale, "Brakuje źródeł do finalnego podpisu raportu.", "Quellen fehlen fuer die finale Report-Freigabe.", "Sources are missing for final report sign-off.")
        : t(locale, "Dowody źródłowe są wystarczające do kolejnego kroku.", "Quellenbelege reichen fuer den naechsten Schritt.", "Source evidence is sufficient for the next step."),
      operatorLine: "Resolve missing/blocked claims and require second-source for material risk statements.",
      evidenceNeeded: ["claim ledger", "source freshness", "second independent source", "missing evidence register"],
      canShowCustomer: true,
    }),
    gate({
      id: "permission-liquidity-review",
      label: "Permission + liquidity review",
      status: lineIncludes(advancedLines, /owner|proxy|mint|freeze|blacklist|tax|liquidity|holder|lock|lp/) ? "review" : "ready",
      priority: risk !== null && risk >= 72 ? "critical" : risk !== null && risk >= 58 ? "high" : reviewPriority >= 72 ? "high" : "normal",
      customerLine: t(locale, "Owner, proxy, mint/freeze/blacklist oraz liquidity/holders wymagają kontroli przed finalem.", "Owner, Proxy, Mint/Freeze/Blacklist und Liquidity/Holders brauchen Kontrolle vor dem Final.", "Owner, proxy, mint/freeze/blacklist and liquidity/holders need review before final delivery."),
      operatorLine: "Cross-check permission parser with explorer/source and liquidity/holder lanes before final rating.",
      evidenceNeeded: ["permission parser", "explorer/source", "DEX/liquidity", "holders/supply"],
      canShowCustomer: true,
    }),
    gate({
      id: "redaction-firewall",
      label: "Customer-safe redaction",
      status: redactionNeeded ? "redact" : "ready",
      priority: "high",
      customerLine: t(locale, "Prywatne dane, opcjonalne notatki QA i surowe evidence muszą przejść redaction firewall.", "Private Daten, optionale QA-Notizen und Raw Evidence müssen durch die Redaction Firewall.", "Private data, optional QA notes and raw evidence must pass the redaction firewall."),
      operatorLine: "Remove raw evidence, private contact/payment data, optional internal-QA notes and any active-test detail before customer delivery.",
      evidenceNeeded: ["redaction checklist", "customer-safe summary", "private-field scan"],
      canShowCustomer: true,
    }),
    gate({
      id: "pdf-delivery",
      label: "PDF / report delivery",
      status: readiness >= 75 && confidence >= 55 ? "review" : "blocked",
      priority: readiness >= 75 ? "normal" : "high",
      customerLine: readiness >= 75
        ? t(locale, "Raport może przejść do finalnego szablonu i redakcji.", "Report kann in Template und Redaction gehen.", "Report can move into final template and redaction.")
        : t(locale, "Raport nie powinien być finalnie podpisany przy niskiej gotowości.", "Report sollte bei niedriger Readiness nicht final signiert werden.", "Report should not be final-signed with low readiness."),
      operatorLine: "Attach report version, freshness timestamp, evidence digest and redaction status to delivery packet.",
      evidenceNeeded: ["report version", "PDF digest", "freshness timestamp", "delivery receipt"],
      canShowCustomer: true,
    }),
  ];

  const blockedGates = gates.filter((item) => item.status === "blocked").length;
  const reviewGates = gates.filter((item) => item.status === "review").length;
  const redactionGates = gates.filter((item) => item.status === "redact").length;
  const readyGates = gates.filter((item) => item.status === "ready").length;
  const deliveryReadiness = clamp(readiness + readyGates * 5 - blockedGates * 14 - reviewGates * 5 - redactionGates * 4 + Math.min(confidence, 80) / 10, 0, 100);
  const finalStatus = deliveryStatus({ productUnavailable, paymentBlocked, scopeBlocked, evidenceBlocked, blockedGates, redactionGates, readiness: deliveryReadiness });

  const customerSafeRows = gates
    .filter((item) => item.canShowCustomer)
    .slice(0, 8)
    .map((item) => ({
      label: item.label,
      status: item.status,
      output: item.customerLine,
    }));

  const proPdfRows = [
    { label: "Delivery decision", status: finalStatus === "ready_for_customer" ? "ready" as const : finalStatus === "needs_redaction" ? "redact" as const : blockedGates ? "blocked" as const : "review" as const, output: `${statusToDelivery(locale, finalStatus)} · readiness ${deliveryReadiness}/100` },
    ...customerSafeRows,
  ];

  const redactionChecklist = [
    "Remove raw operator-only notes from public payload.",
    "Remove payment receipt internals; expose only verified/not verified state.",
    "Remove customer contact details unless account delivery explicitly needs them.",
    "Keep missing evidence visible; do not turn gaps into positive claims.",
    "Keep no seed phrase / no private key / no custody boundary in every delivery.",
    "Attach timestamp, report version and freshness state to final PDF.",
    "Do not include exploit instructions or active-test steps in customer copy.",
  ];

  const nextActions = gates
    .filter((item) => item.status !== "ready")
    .map((item) => `${item.label}: ${item.operatorLine}`)
    .slice(0, 8);

  return {
    passId: PASS2580_CUSTOMER_SAFE_DELIVERY_DECISION_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: {
      ...(contractAddress ? { contractAddress } : {}),
      ...(projectName ? { projectName } : {}),
      chain,
    },
    rule: "Current Advanced is NOT_FOR_SALE and cannot become customer-ready through payment or human review. Any future customer delivery requires explicit product availability plus automated evidence, currentness, rights, redaction, version and entitlement gates.",
    customerRule: t(
      locale,
      "Customer-safe delivery pokazuje tylko bezpieczny status i jasne braki — bez raw evidence i opcjonalnych prywatnych notatek QA.",
      "Customer-safe Delivery zeigt nur sicheren Status und klare Lücken — ohne Raw Evidence und optionale private QA-Notizen.",
      "Customer-safe delivery shows only safe status and clear gaps — without raw evidence or optional private QA notes.",
    ),
    operatorRule: "Automated gates determine product readiness. Optional internal QA may challenge outputs but cannot mark a stop-sold product customer-ready or override evidence/rights/security gates.",
    summary: {
      deliveryStatus: finalStatus,
      deliveryReadiness,
      blockedGates,
      reviewGates,
      redactionGates,
      readyGates,
      customerVisibleRows: customerSafeRows.length,
      proPdfReady: finalStatus === "ready_for_customer" || finalStatus === "needs_redaction",
      advancedReady: productUnavailable === 0 && finalStatus === "ready_for_customer",
    },
    gates,
    customerSafeRows,
    proPdfRows,
    redactionChecklist,
    nextActions,
    visualMergeContract: {
      publicSlot: "customer_safe_delivery_status",
      adminSlot: "operator_delivery_decision_panel",
      pdfSlot: "pro_pdf_delivery_gate",
      rule: "Your visual audit screen can redesign these cards, but must keep deliveryStatus, readiness, gate statuses and redaction boundary wired.",
      keepWired: [
        "pass2580CustomerSafeDeliveryDecision.summary.deliveryStatus",
        "pass2580CustomerSafeDeliveryDecision.summary.deliveryReadiness",
        "pass2580CustomerSafeDeliveryDecision.customerSafeRows",
        "pass2580CustomerSafeDeliveryDecision.redactionChecklist",
        "pass2580CustomerSafeDeliveryDecision.nextActions",
      ],
    },
  };
}
