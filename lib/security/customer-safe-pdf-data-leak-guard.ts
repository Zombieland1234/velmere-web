import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2594AuditEvidenceQaReleaseGateMatrixReport } from "./audit-evidence-qa-release-gate-matrix";
import type { Pass2596ApiContractResponseEnvelopeHardeningReport } from "./api-contract-response-envelope-hardening";

export const PASS2597_CUSTOMER_SAFE_PDF_DATA_LEAK_GUARD_ID = "customer-safe-pdf-data-leak-guard" as const;

export type Pass2597LeakGuardStatus = "clean" | "watch" | "redact" | "blocked";
export type Pass2597LeakGuardLayer = "pdf" | "client" | "api" | "operator" | "provider" | "payment" | "regression";

export type Pass2597LeakGuardCheck = {
  id: string;
  layer: Pass2597LeakGuardLayer;
  label: string;
  status: Pass2597LeakGuardStatus;
  severity: "low" | "medium" | "high" | "critical";
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  forbiddenSurface: string;
  requiredControl: string;
  blocksCustomerPdf: boolean;
  blocksBasicUi: boolean;
  blocksAdvancedFinalSign: boolean;
  evidenceRefs: string[];
  fixAction: string;
};

export type Pass2597LeakGuardRow = {
  label: string;
  status: Pass2597LeakGuardStatus;
  output: string;
};

export type Pass2597CustomerSafePdfDataLeakGuardReport = {
  passId: typeof PASS2597_CUSTOMER_SAFE_PDF_DATA_LEAK_GUARD_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  operatorRule: string;
  summary: {
    checks: number;
    clean: number;
    watch: number;
    redact: number;
    blocked: number;
    leakGuardReadiness: number;
    customerPdfReadiness: number;
    basicUiReadiness: number;
    apiLeakBoundaryReadiness: number;
    canRenderCustomerPdf: boolean;
    canRenderBasicUi: boolean;
    canFinalSignAdvanced: boolean;
    topLeakRisk: string;
  };
  checks: Pass2597LeakGuardCheck[];
  customerRows: Pass2597LeakGuardRow[];
  proPdfRows: Pass2597LeakGuardRow[];
  operatorRows: Pass2597LeakGuardRow[];
  forbiddenTokenPolicy: {
    customerFacingForbiddenTerms: string[];
    normalizedScanRule: string;
    replacementRule: string;
  };
  pdfLeakGuardContract: {
    allowedInputs: string[];
    blockedInputs: string[];
    appendRule: string;
    fallbackRule: string;
  };
  apiLeakGuardContract: {
    responseKeysAllowedInCustomerClient: string[];
    responseKeysOperatorOnly: string[];
    noRawProviderDumpRule: string;
  };
  visualMergeContract: {
    publicSlot: string;
    proPdfSlot: string;
    operatorSlot: string;
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  auditEvidenceQaReleaseGateMatrix?: Pass2594AuditEvidenceQaReleaseGateMatrixReport | null;
  apiContractResponseEnvelopeHardening?: Pass2596ApiContractResponseEnvelopeHardeningReport | null;
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

function guard(args: Pass2597LeakGuardCheck): Pass2597LeakGuardCheck {
  return { ...args, evidenceRefs: uniq(args.evidenceRefs) };
}

function row(label: string, status: Pass2597LeakGuardStatus, output: string): Pass2597LeakGuardRow {
  return { label, status, output };
}

function scoreStatus(status: Pass2597LeakGuardStatus, severity: Pass2597LeakGuardCheck["severity"]) {
  const base = status === "clean" ? 100 : status === "watch" ? 72 : status === "redact" ? 42 : 12;
  const penalty = severity === "critical" ? 10 : severity === "high" ? 6 : severity === "medium" ? 3 : 0;
  return clamp(base - penalty, 0, 100);
}

function average(checks: Pass2597LeakGuardCheck[], filter: (check: Pass2597LeakGuardCheck) => boolean) {
  const scoped = checks.filter(filter);
  if (!scoped.length) return 0;
  return clamp(scoped.reduce((sum, item) => sum + scoreStatus(item.status, item.severity), 0) / scoped.length, 0, 100);
}

export function buildPass2597CustomerSafePdfDataLeakGuardReport(input: BuilderInput): Pass2597CustomerSafePdfDataLeakGuardReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName || input.website || input.auditUrl, 140);
  const qa = input.auditEvidenceQaReleaseGateMatrix;
  const envelope = input.apiContractResponseEnvelopeHardening;
  const hasQa = Boolean(qa);
  const hasEnvelope = Boolean(envelope);
  const qaReady = qa?.summary.releaseReadiness ?? 0;
  const envelopeReady = envelope?.summary.envelopeReadiness ?? 0;
  const proPdfSafe = Boolean(qa?.summary.canRenderProPdf) && Boolean(envelope?.summary.canRenderProPdfResponse);
  const basicSafe = Boolean(qa?.summary.canReleaseBasicPublic) && Boolean(envelope?.summary.canRenderBasicResponse);
  const advancedSafe = Boolean(qa?.summary.canFinalSignAdvanced) && Boolean(envelope?.summary.canUseForAdvancedFinalSign);

  const checks: Pass2597LeakGuardCheck[] = [
    guard({
      id: "leak-guard-pdf-input-allowlist",
      layer: "pdf",
      label: "PDF input allowlist",
      status: proPdfSafe ? "clean" : hasQa && hasEnvelope ? "watch" : "blocked",
      severity: "critical",
      customerLine: proPdfSafe
        ? t(locale, "PDF używa tylko bezpiecznych wierszy dla klienta.", "PDF nutzt nur kundensichere Zeilen.", "PDF uses only customer-safe rows.")
        : t(locale, "PDF pozostaje ograniczony do czasu zaliczenia release gate.", "PDF bleibt bis zum Release-Gate begrenzt.", "PDF remains limited until release gates pass."),
      proPdfLine: `PDF gate ${String(qa?.summary.canRenderProPdf)}; envelope ${String(envelope?.summary.canRenderProPdfResponse)}; readiness ${qaReady}/${envelopeReady}.`,
      operatorLine: "PDF route must append only customerRows/proPdfRows and filter the final line array before rendering.",
      forbiddenSurface: "operatorRows, raw provider dumps, debug traces, account private pointers",
      requiredControl: "isCustomerSafePdfLine + pass2597 customer rows",
      blocksCustomerPdf: !proPdfSafe,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["app/api/security/audit-watch/pro-pdf/route.ts", "pass2594", "pass2596"],
      fixAction: "Keep contractedLines filtered and append PASS2597 rows after PASS2596 rows.",
    }),
    guard({
      id: "leak-guard-basic-client-rows",
      layer: "client",
      label: "Basic UI customer row boundary",
      status: basicSafe ? "clean" : hasEnvelope ? "watch" : "blocked",
      severity: "high",
      customerLine: basicSafe
        ? t(locale, "Basic pokazuje tylko ograniczony status bezpieczeństwa danych.", "Basic zeigt nur begrenzten Datensicherheitsstatus.", "Basic shows only bounded data-safety status.")
        : t(locale, "Basic nie może zgadywać gotowości bez envelope.", "Basic darf Readiness ohne Envelope nicht raten.", "Basic cannot infer readiness without an envelope."),
      proPdfLine: "Client renders PASS2597 customerRows only; private payload remains out of public UI.",
      operatorLine: "The public React component receives a nullable pass2597 state slot and maps status to generic tones.",
      forbiddenSurface: "operator-only checklist, private delivery ledger, debug state",
      requiredControl: "pass2597CustomerSafePdfDataLeakGuard.customerRows",
      blocksCustomerPdf: false,
      blocksBasicUi: !basicSafe,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["components/security/VlmAuditCommandClient.tsx", "pass2596.envelopeContract"],
      fixAction: "Render customerRows and never operatorRows in public UI.",
    }),
    guard({
      id: "leak-guard-api-envelope-separation",
      layer: "api",
      label: "API customer/operator separation",
      status: hasEnvelope && envelopeReady >= 55 ? "clean" : hasEnvelope ? "watch" : "blocked",
      severity: "critical",
      customerLine: t(locale, "API rozdziela status klienta od payloadu operatora.", "API trennt Kundenstatus vom Operator-Payload.", "API separates customer status from operator payload."),
      proPdfLine: `Envelope readiness ${envelopeReady}/100; required named payload with bounded rows.`,
      operatorLine: "Public JSON may include bounded report objects, but customer surfaces must only consume customerRows/proPdfRows.",
      forbiddenSurface: "raw provider evidence, private account delivery, internal notes",
      requiredControl: "response envelope + PASS2597 verifier",
      blocksCustomerPdf: !hasEnvelope,
      blocksBasicUi: !hasEnvelope,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["app/api/security/audit-watch/route.ts", "pass2596"],
      fixAction: "Expose PASS2597 summary and customerRows; keep operator details for admin tooling only.",
    }),
    guard({
      id: "leak-guard-forbidden-token-scan",
      layer: "regression",
      label: "Forbidden token scan",
      status: "watch",
      severity: "high",
      customerLine: t(locale, "Wymagany jest skan fraz prywatnych przed finalnym buildem.", "Vor dem finalen Build ist ein Scan privater Begriffe erforderlich.", "A private-term scan is required before final build."),
      proPdfLine: "Scan normalized customer-facing rows for forbidden terms before rendering a PDF.",
      operatorLine: "This pass adds a deterministic policy and verifier; local E2E should snapshot the actual runtime response.",
      forbiddenSurface: "debug/raw/internal secrets/exploit/private ledger fields",
      requiredControl: "normalized forbidden token scanner",
      blocksCustomerPdf: false,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: true,
      evidenceRefs: ["scripts/verify-customer-safe-pdf-data-leak-guard.mjs", "pass2597"],
      fixAction: "Add runtime JSON/PDF snapshots after local npm install.",
    }),
    guard({
      id: "leak-guard-payment-boundary",
      layer: "payment",
      label: "Payment/account boundary is not evidence",
      status: "clean",
      severity: "medium",
      customerLine: t(locale, "Płatność i konto odblokowują dostawę, nie obniżają ryzyka technicznego.", "Zahlung und Konto liefern Zugriff, senken aber kein technisches Risiko.", "Payment and account unlock delivery; they do not lower technical risk."),
      proPdfLine: "Payment receipt can gate delivery but cannot improve risk score or source confidence.",
      operatorLine: "Keep payment/account fields out of technical evidence weighting and customer PDF scoring claims.",
      forbiddenSurface: "payment-as-risk-evidence claim",
      requiredControl: "payment boundary copy",
      blocksCustomerPdf: false,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["pass2587", "pass2590", "pass2591"],
      fixAction: "Reject score changes that come only from wallet/payment state.",
    }),
  ];

  const cleanCount = checks.filter((item) => item.status === "clean").length;
  const watch = checks.filter((item) => item.status === "watch").length;
  const redact = checks.filter((item) => item.status === "redact").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const leakGuardReadiness = average(checks, () => true);
  const customerPdfReadiness = average(checks, (item) => item.layer === "pdf" || item.blocksCustomerPdf);
  const basicUiReadiness = average(checks, (item) => item.layer === "client" || item.layer === "api");
  const apiLeakBoundaryReadiness = average(checks, (item) => item.layer === "api" || item.layer === "regression" || item.layer === "provider");
  const topLeakRisk = checks.find((item) => item.status === "blocked" || item.status === "redact")?.label ?? checks.find((item) => item.status === "watch")?.label ?? "No active leak risk in bounded customer rows";

  const customerRows = [
    row("Leak guard readiness", leakGuardReadiness >= 82 ? "clean" : leakGuardReadiness >= 55 ? "watch" : "blocked", `Customer data leak guard readiness ${leakGuardReadiness}/100.`),
    row("PDF boundary", proPdfSafe ? "clean" : "watch", proPdfSafe ? "PDF can render contracted customer-safe rows." : "PDF remains gated by QA/envelope readiness."),
    row("Basic UI boundary", basicSafe ? "clean" : "watch", basicSafe ? "Basic UI consumes bounded customer rows." : "Basic UI must show limited status."),
    row("Forbidden token scan", "watch", "Runtime snapshots still need local E2E after npm install."),
    row("Payment boundary", "clean", "Payment unlocks delivery only; it is not technical evidence."),
  ];

  const proPdfRows = [
    row("Customer-safe PDF guard", proPdfSafe ? "clean" : "watch", "Append PASS2597 rows only after final customer-safe filter."),
    row("API envelope boundary", hasEnvelope ? "clean" : "blocked", "Use named envelope and bounded rows; never infer from raw payload shape."),
    row("Release QA dependency", hasQa ? "clean" : "blocked", "Release gate remains the source of truth for customer-facing output."),
    row("No score boost from payment", "clean", "Payment/account state does not reduce risk or raise confidence."),
  ];

  const operatorRows = checks.map((item) => row(item.label, item.status, `${item.layer}: ${item.operatorLine} Fix: ${item.fixAction}`));

  return {
    passId: PASS2597_CUSTOMER_SAFE_PDF_DATA_LEAK_GUARD_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "Customer-facing PDF and UI may consume only bounded customer-safe rows; private operator payloads, debug traces and raw provider dumps must stay out.",
    customerRule: t(locale, "Velmère pokazuje tylko bezpieczny status klienta i nie ujawnia prywatnych danych audytu.", "Velmère zeigt nur kundensicheren Status und keine privaten Auditdaten.", "Velmère shows only customer-safe status and does not expose private audit data."),
    proRule: "Pro PDF must render from contracted customer-safe rows after final leak-guard filtering.",
    operatorRule: "Operator evidence, raw provider payloads, private delivery pointers and debug traces remain outside customer UI/PDF.",
    summary: {
      checks: checks.length,
      clean: cleanCount,
      watch,
      redact,
      blocked,
      leakGuardReadiness,
      customerPdfReadiness,
      basicUiReadiness,
      apiLeakBoundaryReadiness,
      canRenderCustomerPdf: proPdfSafe && blocked === 0,
      canRenderBasicUi: basicSafe && blocked === 0,
      canFinalSignAdvanced: advancedSafe && blocked === 0 && redact === 0,
      topLeakRisk,
    },
    checks,
    customerRows,
    proPdfRows,
    operatorRows,
    forbiddenTokenPolicy: {
      customerFacingForbiddenTerms: ["debug", "raw payload", "operator-only", "api key", "seed phrase", "private key", "exploit steps", "internal secret"],
      normalizedScanRule: "Normalize case, spacing and punctuation before scanning customer-facing lines.",
      replacementRule: "Replace private/internal terms with bounded status copy; do not silently drop critical limitations.",
    },
    pdfLeakGuardContract: {
      allowedInputs: ["customerRows", "proPdfRows", "customerPdfLines", "publicRows"],
      blockedInputs: ["operatorRows", "raw provider payloads", "debug traces", "private delivery pointers", "secrets"],
      appendRule: "Append PASS2597 customer rows before final PDF line filtering.",
      fallbackRule: "If leak guard is missing, PDF must fall back to the already filtered contractedLines set.",
    },
    apiLeakGuardContract: {
      responseKeysAllowedInCustomerClient: ["summary", "customerRows", "proPdfRows", "customerRule", "target", "passId"],
      responseKeysOperatorOnly: ["operatorRows", "checks.operatorLine", "private delivery pointers", "raw provider payloads"],
      noRawProviderDumpRule: "Provider details must be summarized into evidence rows; raw JSON stays server/operator side.",
    },
    visualMergeContract: {
      publicSlot: "Basic audit status panel after API envelope hardening.",
      proPdfSlot: "Customer-safe leak guard appendix before technical summary.",
      operatorSlot: "Detailed leak checks are operator/admin only.",
      doNotExpose: ["operatorRows", "debug traces", "raw provider dumps", "private delivery pointers", "secrets"],
    },
    nextImplementationBacklog: [
      "Add runtime JSON snapshot diff for audit-watch customer payload.",
      "Add PDF text extraction leak scanner once local dependencies are installed.",
      "Add admin-only payload viewer with explicit redaction badges.",
      "Promote forbidden token scanner into shared server middleware.",
    ],
  };
}
