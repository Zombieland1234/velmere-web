import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2578AuditReportAssemblerReport } from "./audit-report-assembler";
import type { Pass2580CustomerSafeDeliveryDecisionReport } from "./customer-safe-delivery-decision";
import type { Pass2581AuditVersionedRecheckReceiptReport } from "./audit-versioned-recheck-receipt";
import type { Pass2582RealProviderAdapterHardeningReport } from "./real-provider-adapter-hardening";
import type { Pass2583ContractSourceAbiExtractionReport } from "./contract-source-abi-extraction";
import type { Pass2584HolderLiquidityDepthEvidenceReport } from "./holder-liquidity-depth-evidence";

export const PASS2585_PREMIUM_PRO_PDF_TEMPLATE_CONTRACT_ID = "premium-pro-pdf-template-contract" as const;

export type Pass2585TemplateSlotStatus = "ready" | "review" | "redact" | "blocked" | "empty";
export type Pass2585TemplateSlotTone = "ok" | "watch" | "redact" | "blocked" | "premium";
export type Pass2585TemplateSlotFamily =
  | "cover_summary"
  | "verdict_confidence"
  | "evidence_matrix"
  | "source_freshness"
  | "permission_controls"
  | "liquidity_holders"
  | "receipt_recheck"
  | "redaction_firewall"
  | "appendix_boundary";

export type Pass2585PdfTemplateRow = {
  label: string;
  status: Pass2585TemplateSlotStatus;
  tone: Pass2585TemplateSlotTone;
  output: string;
};

export type Pass2585PdfTemplateSlot = {
  id: string;
  family: Pass2585TemplateSlotFamily;
  label: string;
  status: Pass2585TemplateSlotStatus;
  tone: Pass2585TemplateSlotTone;
  visualSlot: string;
  sourcePassIds: string[];
  requiredFields: string[];
  hiddenFields: string[];
  customerLine: string;
  proPdfLine: string;
  operatorRule: string;
  blocksCustomerPdf: boolean;
  blocksFinalSign: boolean;
};

export type Pass2585PremiumProPdfTemplateContractReport = {
  passId: typeof PASS2585_PREMIUM_PRO_PDF_TEMPLATE_CONTRACT_ID;
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
  operatorRule: string;
  templateContract: {
    schemaVersion: string;
    layoutRule: string;
    customerSafeRule: string;
    debugCopyBanRule: string;
    visualMergeRule: string;
    forbiddenCustomerTokens: string[];
    requiredCustomerFields: string[];
  };
  slots: Pass2585PdfTemplateSlot[];
  summary: {
    totalSlots: number;
    ready: number;
    review: number;
    redact: number;
    blocked: number;
    empty: number;
    publishableSlots: number;
    redactionRequired: number;
    debugCopyBlocked: boolean;
    customerSafeReadiness: number;
    proPdfReadiness: number;
    nextCriticalStep: string;
    canRenderCustomerPdf: boolean;
    canFinalSignProPdf: boolean;
  };
  publicRows: Pass2585PdfTemplateRow[];
  proPdfRows: Pass2585PdfTemplateRow[];
  operatorRows: Pass2585PdfTemplateRow[];
  customerPdfLines: string[];
  visualMergeContract: {
    publicSlot: string;
    pdfSlot: string;
    adminSlot: string;
    rule: string;
    keepWired: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  reportAssembler?: Pass2578AuditReportAssemblerReport | null;
  customerSafeDeliveryDecision?: Pass2580CustomerSafeDeliveryDecisionReport | null;
  versionedRecheckReceipt?: Pass2581AuditVersionedRecheckReceiptReport | null;
  realProviderAdapterHardening?: Pass2582RealProviderAdapterHardeningReport | null;
  contractSourceAbiExtraction?: Pass2583ContractSourceAbiExtractionReport | null;
  holderLiquidityDepthEvidence?: Pass2584HolderLiquidityDepthEvidenceReport | null;
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

function row(label: string, status: Pass2585TemplateSlotStatus, tone: Pass2585TemplateSlotTone, output: string): Pass2585PdfTemplateRow {
  return { label, status, tone, output };
}

function slot(args: Pass2585PdfTemplateSlot): Pass2585PdfTemplateSlot {
  return {
    ...args,
    sourcePassIds: Array.from(new Set(args.sourcePassIds)).slice(0, 9),
    requiredFields: Array.from(new Set(args.requiredFields.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    hiddenFields: Array.from(new Set(args.hiddenFields.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
  };
}

function toneFrom(status: Pass2585TemplateSlotStatus): Pass2585TemplateSlotTone {
  if (status === "ready") return "ok";
  if (status === "review") return "watch";
  if (status === "redact") return "redact";
  if (status === "blocked") return "blocked";
  return "premium";
}

function statusLine(locale: string, status: Pass2585TemplateSlotStatus) {
  if (status === "ready") return t(locale, "gotowe", "bereit", "ready");
  if (status === "review") return t(locale, "do przeglądu", "zu pruefen", "review");
  if (status === "redact") return t(locale, "redakcja", "Redaction", "redaction");
  if (status === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  return t(locale, "puste", "leer", "empty");
}

function hasUnsafeCustomerCopy(value: string) {
  return /\b(pass\d{3,}|debug|operator-only|private operator|raw payload|seed phrase|exploit steps)\b/i.test(value);
}

function readinessFrom(slots: Pass2585PdfTemplateSlot[], confidence: number, deliveryReadiness: number) {
  const ready = slots.filter((item) => item.status === "ready").length;
  const review = slots.filter((item) => item.status === "review").length;
  const redact = slots.filter((item) => item.status === "redact").length;
  const blocked = slots.filter((item) => item.status === "blocked").length;
  const empty = slots.filter((item) => item.status === "empty").length;
  return clamp((ready / Math.max(1, slots.length)) * 68 + Math.min(confidence, 88) * 0.16 + Math.min(deliveryReadiness, 88) * 0.16 - review * 3 - redact * 5 - blocked * 12 - empty * 6, 0, 100);
}

export function buildPass2585PremiumProPdfTemplateContractReport(input: BuilderInput): Pass2585PremiumProPdfTemplateContractReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.reportAssembler?.target.chain ?? input.versionedRecheckReceipt?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.reportAssembler?.target.contractAddress ?? input.versionedRecheckReceipt?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.reportAssembler?.target.projectName ?? input.versionedRecheckReceipt?.target.projectName;

  const assembler = input.reportAssembler;
  const delivery = input.customerSafeDeliveryDecision;
  const receipt = input.versionedRecheckReceipt;
  const adapters = input.realProviderAdapterHardening;
  const sourceAbi = input.contractSourceAbiExtraction;
  const depth = input.holderLiquidityDepthEvidence;

  const risk = assembler?.finalVerdict.riskScore ?? null;
  const templateTierLabel = input.reviewLevel === "advanced_review" ? "Advanced" : "Pro";
  const reviewPriority = assembler?.finalVerdict.reviewPriorityScore ?? 62;
  const confidence = assembler?.finalVerdict.sourceConfidence ?? 42;
  const assemblerReadiness = assembler?.finalVerdict.readinessScore ?? 38;
  const deliveryReadiness = delivery?.summary.deliveryReadiness ?? assemblerReadiness;
  const deliveryBlocked = delivery?.summary.blockedGates ?? 1;
  const deliveryRedaction = delivery?.summary.redactionGates ?? 1;
  const missingClaims = (assembler?.summary.missing ?? 0) + (assembler?.summary.blocked ?? 0);
  const adapterReady = (adapters?.summary.usable ?? 0) >= 3 && (adapters?.summary.error ?? 0) === 0;
  const abiReady = (sourceAbi?.summary.extractionReadiness ?? 0) >= 45;
  const depthReady = (depth?.summary.depthReadiness ?? 0) >= 45 && (depth?.summary.blockers ?? 1) <= 1;
  const receiptReady = Boolean(receipt?.receipt.contentHash && receipt?.receipt.runId);

  const coverStatus: Pass2585TemplateSlotStatus = receiptReady ? "ready" : "review";
  const verdictStatus: Pass2585TemplateSlotStatus = confidence >= 55 && missingClaims <= 2 ? "ready" : missingClaims >= 4 ? "blocked" : "review";
  const evidenceStatus: Pass2585TemplateSlotStatus = adapterReady && missingClaims <= 1 ? "ready" : adapterReady ? "review" : "blocked";
  const freshnessStatus: Pass2585TemplateSlotStatus = receipt?.recheckPlan.nextCheckAt ? "ready" : "review";
  const permissionStatus: Pass2585TemplateSlotStatus = abiReady ? "ready" : contractAddress ? "review" : "empty";
  const liquidityStatus: Pass2585TemplateSlotStatus = depthReady ? "ready" : contractAddress ? "review" : "empty";
  const receiptStatus: Pass2585TemplateSlotStatus = receiptReady ? "ready" : "blocked";
  const redactionStatus: Pass2585TemplateSlotStatus = deliveryRedaction > 0 ? "redact" : deliveryBlocked > 0 ? "blocked" : "ready";
  const appendixStatus: Pass2585TemplateSlotStatus = deliveryBlocked === 0 && deliveryRedaction === 0 ? "ready" : "redact";

  const slots = [
    slot({
      id: "pdf-cover-summary",
      family: "cover_summary",
      label: "Cover / customer summary",
      status: coverStatus,
      tone: toneFrom(coverStatus),
      visualSlot: "hero_card.report_identity",
      sourcePassIds: ["pass2578", "pass2581"],
      requiredFields: ["target", "chain", "request id", "report version", "content hash"],
      hiddenFields: ["raw provider payload", "operator note", "private contact/payment data"],
      customerLine: t(locale, "Okładka pokazuje tylko target, wersję, hash i jasny status raportu.", "Cover zeigt nur Target, Version, Hash und klaren Report-Status.", "Cover shows only target, version, hash and clear report status."),
      proPdfLine: "Cover slot must bind target, chain, report version, content hash and generated timestamp.",
      operatorRule: "Never expose raw intake payload or private account fields in the cover.",
      blocksCustomerPdf: (["blocked"] as Pass2585TemplateSlotStatus[]).includes(coverStatus),
      blocksFinalSign: coverStatus !== "ready",
    }),
    slot({
      id: "pdf-verdict-confidence",
      family: "verdict_confidence",
      label: "Verdict / confidence capsule",
      status: verdictStatus,
      tone: toneFrom(verdictStatus),
      visualSlot: "risk_capsule.final_verdict",
      sourcePassIds: ["pass2573", "pass2578"],
      requiredFields: ["risk score", "risk label", "source confidence", "readiness", "missing evidence count"],
      hiddenFields: ["internal scoring weights", "raw model scratchpad"],
      customerLine: t(locale, "Werdykt musi pokazać score razem z confidence i brakami, nie samą liczbę.", "Verdict zeigt Score plus Confidence und Luecken, nicht nur eine Zahl.", "Verdict must show score with confidence and gaps, not a standalone number."),
      proPdfLine: `Verdict slot: risk ${risk === null ? "unavailable (no verified adverse finding)" : `${risk}/100`}, review priority ${reviewPriority}/100, confidence ${confidence}/100, readiness ${assemblerReadiness}/100, missing/blocked ${missingClaims}.`,
      operatorRule: "If confidence is capped, the PDF must state the cap instead of over-signing the risk label.",
      blocksCustomerPdf: verdictStatus === "blocked",
      blocksFinalSign: verdictStatus !== "ready",
    }),
    slot({
      id: "pdf-evidence-matrix",
      family: "evidence_matrix",
      label: "Evidence matrix",
      status: evidenceStatus,
      tone: toneFrom(evidenceStatus),
      visualSlot: "source_matrix.confirmed_partial_missing",
      sourcePassIds: ["pass2569", "pass2570", "pass2571", "pass2572", "pass2582"],
      requiredFields: ["provider name", "lane state", "freshness", "source confidence", "missing evidence"],
      hiddenFields: ["API keys", "full raw responses", "unredacted request headers"],
      customerLine: t(locale, "Źródła są rozdzielone na confirmed, partial i missing — bez claimów bez źródła.", "Quellen bleiben in confirmed, partial und missing getrennt — keine Claims ohne Quelle.", "Sources stay split into confirmed, partial and missing — no claim without source state."),
      proPdfLine: `Provider slot: usable ${adapters?.summary.usable ?? 0}, degraded ${adapters?.summary.degraded ?? 0}, needs key ${adapters?.summary.needsKey ?? 0}.`,
      operatorRule: "Provider failures must degrade confidence, not disappear from the report.",
      blocksCustomerPdf: evidenceStatus === "blocked",
      blocksFinalSign: evidenceStatus !== "ready",
    }),
    slot({
      id: "pdf-source-freshness",
      family: "source_freshness",
      label: "Freshness / re-check footer",
      status: freshnessStatus,
      tone: toneFrom(freshnessStatus),
      visualSlot: "footer.freshness_recheck",
      sourcePassIds: ["pass2575", "pass2581"],
      requiredFields: ["generatedAt", "nextCheckAt", "TTL rule", "re-check triggers"],
      hiddenFields: ["operator queue internals"],
      customerLine: t(locale, "PDF ma datę wygenerowania i następny re-check, więc nie udaje wiecznego raportu.", "PDF hat Generierungsdatum und naechsten Re-check, es ist kein ewiger Report.", "PDF has generated date and next re-check, so it does not pretend to be permanent."),
      proPdfLine: `Freshness slot: next re-check ${receipt?.recheckPlan.nextCheckAt ?? "missing"}; priority ${receipt?.recheckPlan.priority ?? "review"}.`,
      operatorRule: "Any material source change creates a new versioned receipt, not a silent mutation.",
      blocksCustomerPdf: false,
      blocksFinalSign: freshnessStatus !== "ready",
    }),
    slot({
      id: "pdf-permission-controls",
      family: "permission_controls",
      label: "Permission / source controls",
      status: permissionStatus,
      tone: toneFrom(permissionStatus),
      visualSlot: "technical_section.permission_map",
      sourcePassIds: ["pass2576", "pass2583"],
      requiredFields: ["verified source state", "ABI state", "owner/admin functions", "proxy hints", "transfer restrictions"],
      hiddenFields: ["exploit walkthrough", "raw opcode dump", "unsafe reproduction steps"],
      customerLine: t(locale, "Kontrole owner/admin/proxy/mint/freeze trafiają do sekcji technicznej bez instrukcji nadużycia.", "Owner/Admin/Proxy/Mint/Freeze landen in der technischen Sektion ohne Missbrauchsanleitung.", "Owner/admin/proxy/mint/freeze controls go into the technical section without abuse instructions."),
      proPdfLine: `Permission slot: source gate ${sourceAbi?.sourceGate.state ?? "queued"}; extraction readiness ${sourceAbi?.summary.extractionReadiness ?? 0}/100.`,
      operatorRule: "Explain impact and missing proof; do not include exploit recipes.",
      blocksCustomerPdf: false,
      blocksFinalSign: (["blocked", "empty"] as Pass2585TemplateSlotStatus[]).includes(permissionStatus),
    }),
    slot({
      id: "pdf-liquidity-holders",
      family: "liquidity_holders",
      label: "Liquidity / holder depth",
      status: liquidityStatus,
      tone: toneFrom(liquidityStatus),
      visualSlot: "technical_section.liquidity_holder_depth",
      sourcePassIds: ["pass2577", "pass2584"],
      requiredFields: ["DEX pair matrix", "LP lock/ownership", "top holder concentration", "deployer relation", "exit pressure"],
      hiddenFields: ["unredacted private wallet labels", "operator speculation"],
      customerLine: t(locale, "Liquidity, LP ownership i koncentracja holderów są osobną sekcją, nie ukrytą notką.", "Liquidity, LP Ownership und Holder-Konzentration sind eine eigene Sektion, keine versteckte Notiz.", "Liquidity, LP ownership and holder concentration are a dedicated section, not a hidden note."),
      proPdfLine: `Liquidity slot: depth readiness ${depth?.summary.depthReadiness ?? 0}/100; blockers ${depth?.summary.blockers ?? 0}.`,
      operatorRule: "Never final-sign if LP ownership or holder depth is critical and unresolved.",
      blocksCustomerPdf: false,
      blocksFinalSign: (["blocked", "empty"] as Pass2585TemplateSlotStatus[]).includes(liquidityStatus),
    }),
    slot({
      id: "pdf-receipt-recheck",
      family: "receipt_recheck",
      label: "Receipt / version lock",
      status: receiptStatus,
      tone: toneFrom(receiptStatus),
      visualSlot: "footer.receipt_hash_version",
      sourcePassIds: ["pass2581"],
      requiredFields: ["receipt id", "run id", "report version", "content hash", "receipt status"],
      hiddenFields: ["mutable operator fields"],
      customerLine: t(locale, "Klient widzi wersję, audit ID i hash treści — bez cichego nadpisania raportu.", "Kunde sieht Version, Audit-ID und Content-Hash — kein stilles Ueberschreiben.", "Customer sees version, audit ID and content hash — no silent overwrites."),
      proPdfLine: `Receipt slot: ${receipt?.receipt.receiptId ?? "missing"}; version ${receipt?.receipt.reportVersion ?? "missing"}; hash ${receipt?.receipt.contentHash ?? "missing"}.`,
      operatorRule: "Append new receipt for each material update.",
      blocksCustomerPdf: receiptStatus === "blocked",
      blocksFinalSign: receiptStatus !== "ready",
    }),
    slot({
      id: "pdf-redaction-firewall",
      family: "redaction_firewall",
      label: "Customer-safe redaction firewall",
      status: redactionStatus,
      tone: toneFrom(redactionStatus),
      visualSlot: "delivery.redaction_badge",
      sourcePassIds: ["pass2580", "pass2585"],
      requiredFields: ["redaction status", "payment boundary", "scope boundary", "private data scan"],
      hiddenFields: ["private contact email", "payment token", "operator private notes", "raw provider payload"],
      customerLine: t(locale, "PDF klienta pokazuje wnioski i braki, ale nie prywatne dane ani surowy operator payload.", "Kunden-PDF zeigt Ergebnisse und Luecken, aber keine privaten Daten oder raw Operator Payloads.", "Customer PDF shows findings and gaps, but not private data or raw operator payloads."),
      proPdfLine: `Redaction slot: delivery ${delivery?.summary.deliveryStatus ?? "preview"}; blocked gates ${deliveryBlocked}; redaction gates ${deliveryRedaction}.`,
      operatorRule: "Customer-facing export must be built from publicRows/proPdfRows only; operatorRows stay private.",
      blocksCustomerPdf: redactionStatus === "blocked",
      blocksFinalSign: redactionStatus !== "ready",
    }),
    slot({
      id: "pdf-appendix-boundary",
      family: "appendix_boundary",
      label: "Appendix / operator boundary",
      status: appendixStatus,
      tone: toneFrom(appendixStatus),
      visualSlot: "appendix.boundary_notice",
      sourcePassIds: ["pass2579", "pass2580", "pass2585"],
      requiredFields: ["scope notice", "no investment advice", "no guarantee", "manual review boundary"],
      hiddenFields: ["internal checklist", "private operator action queue"],
      customerLine: t(locale, "Appendix tłumaczy granice audytu: brak custody, brak seed phrase, brak gwarancji bezpieczeństwa.", "Appendix erklaert Audit-Grenzen: keine Custody, keine Seed Phrase, keine Sicherheitsgarantie.", "Appendix explains audit boundaries: no custody, no seed phrase, no safety guarantee."),
      proPdfLine: "Appendix slot: passive public review, no custody, no seed phrase, no investment advice, no guarantee of safety.",
      operatorRule: "Move internal checklists to operator console, not customer PDF.",
      blocksCustomerPdf: false,
      blocksFinalSign: appendixStatus !== "ready",
    }),
  ];

  const ready = slots.filter((item) => item.status === "ready").length;
  const review = slots.filter((item) => item.status === "review").length;
  const redact = slots.filter((item) => item.status === "redact").length;
  const blocked = slots.filter((item) => item.status === "blocked").length;
  const empty = slots.filter((item) => item.status === "empty").length;
  const publishableSlots = slots.filter((item) => !item.blocksCustomerPdf).length;
  const customerSafeReadiness = readinessFrom(slots, confidence, deliveryReadiness);
  const debugCopyBlocked = slots.some((item) => hasUnsafeCustomerCopy(item.customerLine)) || [
    ...(assembler?.proPdfLines ?? []),
    ...(delivery?.redactionChecklist ?? []),
  ].some(hasUnsafeCustomerCopy);
  const canRenderCustomerPdf = blocked === 0 && !debugCopyBlocked && customerSafeReadiness >= 52;
  const canFinalSignProPdf = canRenderCustomerPdf && review === 0 && redact === 0 && empty === 0 && confidence >= 76 && deliveryBlocked === 0;
  const nextCriticalStep = blocked > 0
    ? t(locale, "Usuń blokujące sloty PDF przed finalnym renderem.", "Blockierte PDF-Slots vor finalem Render loesen.", "Resolve blocked PDF slots before final render.")
    : redact > 0
      ? t(locale, "Dokończ redaction firewall przed dostawą klientowi.", "Redaction Firewall vor Kundenauslieferung abschliessen.", "Finish redaction firewall before customer delivery.")
      : review > 0 || empty > 0
        ? t(locale, "Uzupełnij sloty review/empty i podłącz je do visual template.", "Review/Empty Slots fuellen und an Visual Template binden.", "Fill review/empty slots and bind them to the visual template.")
        : t(locale, "Sloty PDF są gotowe do premium renderu i QA.", "PDF-Slots sind bereit fuer Premium Render und QA.", "PDF slots are ready for premium render and QA.");

  const publicRows = slots.slice(0, 7).map((item) => row(item.label, item.status, item.tone, item.customerLine));
  const proPdfRows = slots.map((item) => row(item.label, item.status, item.tone, `${item.proPdfLine} Visual slot: ${item.visualSlot}.`));
  const operatorRows = [
    row("Template source rule", "review", "watch", "Customer PDF must be assembled from approved slots, not arbitrary debug arrays."),
    row("Private payload boundary", redactionStatus, toneFrom(redactionStatus), "operatorRows, raw provider payloads, payment tokens and private notes stay outside customer PDF."),
    row("Visual merge", "ready", "ok", "When user sends audit visual, keep layout and wire these slots instead of rebuilding the evidence engine."),
    row("Final sign gate", canFinalSignProPdf ? "ready" : "review", canFinalSignProPdf ? "ok" : "watch", "Final Pro PDF needs payment/scope/evidence/redaction plus confidence threshold; Basic remains a passive preview."),
  ];

  const customerPdfLines = [
    `Velmere ${templateTierLabel} Audit - customer-safe report shell`,
    `Target: ${contractAddress || projectName || "unknown target"}`,
    `Network: ${chain}`,
    `Risk score: ${risk === null ? "unavailable - no verified adverse finding" : `${risk}/100`}; review priority: ${reviewPriority}/100; source confidence: ${confidence}/100; readiness: ${assemblerReadiness}/100`,
    `Report version: ${receipt?.receipt.reportVersion ?? "preview"}; audit ID: ${receipt?.receipt.runId ?? "pending"}; content hash: ${receipt?.receipt.contentHash ?? "pending"}`,
    `Next re-check: ${receipt?.recheckPlan.nextCheckAt ?? "pending"}`,
    `PDF readiness: ${customerSafeReadiness}/100; publishable slots: ${publishableSlots}/${slots.length}`,
    "Boundary: no custody, no seed phrase, no investment advice, no guarantee of safety.",
    ...publicRows.map((item) => `${item.label}: ${statusLine(locale, item.status)} - ${item.output}`),
  ].filter((line) => !hasUnsafeCustomerCopy(line)).slice(0, 36);

  return {
    passId: PASS2585_PREMIUM_PRO_PDF_TEMPLATE_CONTRACT_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: "Premium Pro PDF is assembled from approved, customer-safe slots with receipt/hash/freshness wiring; operator/debug/private payloads are excluded by contract.",
    customerRule: t(locale, "Pro PDF ma sloty premium: wynik, confidence, źródła, freshness, receipt i redaction — bez debug kopii.", "Pro PDF hat Premium-Slots: Verdict, Confidence, Quellen, Freshness, Receipt und Redaction — ohne Debug Copy.", "Pro PDF has premium slots: verdict, confidence, sources, freshness, receipt and redaction — no debug copy."),
    proRule: "Pro PDF can be visually redesigned, but the data contract must stay bound to evidence, freshness, receipt and redaction fields.",
    operatorRule: "Operator/private rows are for console and QA only; customer PDF gets customerPdfLines/publicRows/proPdfRows after redaction.",
    templateContract: {
      schemaVersion: "pro-pdf-template-contract.v1",
      layoutRule: "Cover -> verdict capsule -> evidence matrix -> technical sections -> receipt/freshness footer -> boundary appendix.",
      customerSafeRule: "Customer-facing PDF may show conclusions, confidence, evidence status and missing proof; it must not show raw provider payloads or private operator notes.",
      debugCopyBanRule: "No debug, pass-id narration, raw JSON, API key state, operator-only text or private payment/contact data in customer PDF.",
      visualMergeRule: "User visual audit design may replace the layout; these slot ids and required fields must remain wired.",
      forbiddenCustomerTokens: ["debug", "operator-only", "raw payload", "API key", "private payment", "seed phrase", "exploit steps"],
      requiredCustomerFields: ["target", "chain", "risk score", "source confidence", "missing evidence", "generatedAt", "report version", "content hash", "next re-check"],
    },
    slots,
    summary: {
      totalSlots: slots.length,
      ready,
      review,
      redact,
      blocked,
      empty,
      publishableSlots,
      redactionRequired: redact,
      debugCopyBlocked,
      customerSafeReadiness,
      proPdfReadiness: clamp(customerSafeReadiness + ready * 2 - review * 2 - redact * 4 - blocked * 10, 0, 100),
      nextCriticalStep,
      canRenderCustomerPdf,
      canFinalSignProPdf,
    },
    publicRows,
    proPdfRows,
    operatorRows,
    customerPdfLines,
    visualMergeContract: {
      publicSlot: "components/security/VlmAuditCommandClient.tsx#pro-pdf-template-contract",
      pdfSlot: "app/api/security/audit-watch/pro-pdf/route.ts#customerPdfLines",
      adminSlot: "operator-console.proPdfTemplateSlots",
      rule: "Keep user visual design, bind it to slot ids and customer-safe lines; do not copy operatorRows into customer PDF.",
      keepWired: [
        "summary.customerSafeReadiness",
        "summary.canRenderCustomerPdf",
        "summary.canFinalSignProPdf",
        "templateContract.forbiddenCustomerTokens",
        "customerPdfLines",
        "slots[].visualSlot",
        "slots[].requiredFields",
        "slots[].hiddenFields",
      ],
    },
    nextImplementationBacklog: [
      "Replace minimal PDF route with designed A4 renderer using these slot ids.",
      "Add PDF snapshot tests that scan for forbidden debug/operator/private tokens.",
      "Bind user visual audit page to proPdfTemplateContract instead of rebuilding evidence logic.",
      "Add operator console switch: customer-safe preview vs private QA payload.",
      "Add Pro PDF locale copy polish for PL/EN/DE with no pass/debug wording.",
    ],
  };
}
