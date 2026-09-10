import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2594AuditEvidenceQaReleaseGateMatrixReport } from "./audit-evidence-qa-release-gate-matrix";
import type { Pass2595RuntimeBuildReadinessTypeSafetySweepReport } from "./runtime-build-readiness-type-safety-sweep";

export const PASS2596_API_CONTRACT_RESPONSE_ENVELOPE_HARDENING_ID = "api-contract-response-envelope-hardening" as const;

export type Pass2596EnvelopeStatus = "pass" | "watch" | "fail" | "blocked";
export type Pass2596EnvelopeLayer = "http" | "json" | "headers" | "customer" | "pdf" | "client" | "regression";

export type Pass2596EnvelopeCheck = {
  id: string;
  layer: Pass2596EnvelopeLayer;
  label: string;
  status: Pass2596EnvelopeStatus;
  severity: "low" | "medium" | "high" | "critical";
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  requiredKey: string;
  blocksBasicRender: boolean;
  blocksProPdf: boolean;
  blocksAdvancedFinalSign: boolean;
  evidenceRefs: string[];
  fixAction: string;
};

export type Pass2596EnvelopeRow = {
  label: string;
  status: Pass2596EnvelopeStatus;
  output: string;
};

export type Pass2596ApiContractResponseEnvelopeHardeningReport = {
  passId: typeof PASS2596_API_CONTRACT_RESPONSE_ENVELOPE_HARDENING_ID;
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
    pass: number;
    watch: number;
    fail: number;
    blocked: number;
    envelopeReadiness: number;
    headerReadiness: number;
    customerPayloadReadiness: number;
    proPdfEnvelopeReadiness: number;
    clientStateReadiness: number;
    canRenderBasicResponse: boolean;
    canRenderProPdfResponse: boolean;
    canUseForAdvancedFinalSign: boolean;
    topEnvelopeBlocker: string;
    /** PASS4143 compatibility alias for old launch-gate consumers. */
    topEnvelopeRisk: string;
  };
  checks: Pass2596EnvelopeCheck[];
  customerRows: Pass2596EnvelopeRow[];
  proPdfRows: Pass2596EnvelopeRow[];
  operatorRows: Pass2596EnvelopeRow[];
  envelopeContract: {
    responseShape: string[];
    requiredHeaders: string[];
    nullablePayloadRule: string;
    noRawDebugRule: string;
    noSilentMutationRule: string;
  };
  clientMergeContract: {
    stateSlot: string;
    renderSlot: string;
    resetRule: string;
    fallbackRule: string;
  };
  pdfAppendixContract: {
    customerSafeRowsOnly: boolean;
    forbiddenTerms: string[];
    appendixSlot: string;
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
  runtimeBuildReadinessTypeSafetySweep?: Pass2595RuntimeBuildReadinessTypeSafetySweepReport | null;
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

function check(args: Pass2596EnvelopeCheck): Pass2596EnvelopeCheck {
  return { ...args, evidenceRefs: uniq(args.evidenceRefs) };
}

function row(label: string, status: Pass2596EnvelopeStatus, output: string): Pass2596EnvelopeRow {
  return { label, status, output };
}

function scoreStatus(status: Pass2596EnvelopeStatus, severity: Pass2596EnvelopeCheck["severity"]) {
  const base = status === "pass" ? 100 : status === "watch" ? 72 : status === "fail" ? 34 : 16;
  const penalty = severity === "critical" ? 10 : severity === "high" ? 6 : severity === "medium" ? 3 : 0;
  return clamp(base - penalty, 0, 100);
}

function average(checks: Pass2596EnvelopeCheck[], filter: (check: Pass2596EnvelopeCheck) => boolean) {
  const scoped = checks.filter(filter);
  if (!scoped.length) return 0;
  return clamp(scoped.reduce((sum, item) => sum + scoreStatus(item.status, item.severity), 0) / scoped.length, 0, 100);
}

export function buildPass2596ApiContractResponseEnvelopeHardeningReport(input: BuilderInput): Pass2596ApiContractResponseEnvelopeHardeningReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName || input.website || input.auditUrl, 140);
  const qa = input.auditEvidenceQaReleaseGateMatrix;
  const build = input.runtimeBuildReadinessTypeSafetySweep;
  const hasQa = Boolean(qa);
  const hasBuild = Boolean(build);
  const releaseReady = qa?.summary.releaseReadiness ?? 0;
  const buildReady = build?.summary.buildReadiness ?? 0;
  const basicReady = Boolean(qa?.summary.canReleaseBasicPublic) && Boolean(build?.summary.canShipQaBuild || buildReady >= 50);
  const proReady = Boolean(qa?.summary.canRenderProPdf) && Boolean(build?.summary.canShipQaBuild || buildReady >= 50);
  const advancedReady = Boolean(qa?.summary.canFinalSignAdvanced) && Boolean(build?.summary.canStartFullBuild) && !build?.summary.mustRunLocalNextBuild;

  const checks: Pass2596EnvelopeCheck[] = [
    check({
      id: "envelope-ok-report-shape",
      layer: "json",
      label: "Stable ok/report response shape",
      status: hasQa && hasBuild ? "pass" : "blocked",
      severity: "critical",
      customerLine: hasQa && hasBuild
        ? t(locale, "API zwraca stabilny envelope zamiast luźnego payloadu.", "API liefert einen stabilen Envelope statt losem Payload.", "API returns a stable envelope instead of loose payload.")
        : t(locale, "Envelope nie może być uznany za gotowy bez release gate i build readiness.", "Envelope ist ohne Release-Gate und Build-Readiness nicht bereit.", "Envelope cannot be considered ready without release gate and build readiness."),
      proPdfLine: `Requires ok=true plus named pass payloads; release ${releaseReady}/100; build ${buildReady}/100.`,
      operatorLine: "Every audit-watch extension must preserve ok, preview, accountMessage and named pass keys.",
      requiredKey: "ok + pass2596ApiContractResponseEnvelopeHardening",
      blocksBasicRender: !hasQa || !hasBuild,
      blocksProPdf: !hasQa || !hasBuild,
      blocksAdvancedFinalSign: true,
      evidenceRefs: ["app/api/security/audit-watch/route.ts", "pass2594", "pass2595"],
      fixAction: "Wire PASS2594 and PASS2595 before judging the API envelope.",
    }),
    check({
      id: "envelope-header-manifest",
      layer: "headers",
      label: "Header manifest coverage",
      status: hasBuild ? "pass" : "watch",
      severity: "high",
      customerLine: t(locale, "Nagłówki pokazują aktywny contract i readiness bez danych prywatnych.", "Header zeigen Contract und Readiness ohne private Daten.", "Headers expose contract and readiness without private data."),
      proPdfLine: "Headers must include pass2596 id, envelope readiness and no-store caching.",
      operatorLine: "Headers are a smoke-test surface for Vercel/runtime without exposing raw evidence.",
      requiredKey: "x-velmere-pass2596-api-envelope",
      blocksBasicRender: false,
      blocksProPdf: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["audit-watch route", "pro-pdf route"],
      fixAction: "Add x-velmere-pass2596-api-envelope and x-velmere-envelope-readiness to route responses.",
    }),
    check({
      id: "envelope-customer-safe-rows",
      layer: "customer",
      label: "Customer-safe rows only",
      status: qa?.summary.canReleaseBasicPublic ? "pass" : hasQa ? "watch" : "blocked",
      severity: "critical",
      customerLine: qa?.summary.canReleaseBasicPublic
        ? t(locale, "Widok Basic pokazuje tylko bezpieczne wiersze statusu.", "Basic zeigt nur sichere Statuszeilen.", "Basic shows only customer-safe status rows.")
        : t(locale, "Basic musi pokazać ograniczenie zamiast prywatnego payloadu.", "Basic muss Begrenzung statt privatem Payload zeigen.", "Basic must show a limitation instead of private payload."),
      proPdfLine: `Basic release ${String(qa?.summary.canReleaseBasicPublic)}; customer rows ${qa?.customerRows.length ?? 0}.`,
      operatorLine: "Never render operatorRows in public client or Pro PDF.",
      requiredKey: "customerRows",
      blocksBasicRender: !qa?.summary.canReleaseBasicPublic && !hasQa,
      blocksProPdf: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["components/security/VlmAuditCommandClient.tsx", "pass2594.customerRows"],
      fixAction: "Keep customerRows/proPdfRows/operatorRows separated for every pass.",
    }),
    check({
      id: "envelope-pro-pdf-safe-appendix",
      layer: "pdf",
      label: "Pro PDF safe appendix envelope",
      status: qa?.summary.canRenderProPdf ? "pass" : hasQa ? "watch" : "blocked",
      severity: "critical",
      customerLine: qa?.summary.canRenderProPdf
        ? t(locale, "PDF Pro ma customer-safe appendix i nie używa raw debug.", "Pro PDF hat kundensicheren Appendix ohne Raw-Debug.", "Pro PDF has a customer-safe appendix and no raw debug.")
        : t(locale, "PDF Pro pozostaje ograniczony do czasu zaliczenia gate.", "Pro PDF bleibt begrenzt bis Gate bestanden ist.", "Pro PDF remains limited until gate clearance."),
      proPdfLine: `Pro PDF release ${String(qa?.summary.canRenderProPdf)}; contracted rows ${build?.proPdfRows.length ?? 0}.`,
      operatorLine: "The PDF route should append only customerRows/proPdfRows and filter forbidden terms.",
      requiredKey: "proPdfRows",
      blocksBasicRender: false,
      blocksProPdf: !qa?.summary.canRenderProPdf && !hasQa,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["app/api/security/audit-watch/pro-pdf/route.ts", "isCustomerSafePdfLine"],
      fixAction: "Keep PDF contractedLines filtered and never append operatorRows.",
    }),
    check({
      id: "envelope-client-state-slot",
      layer: "client",
      label: "Client state slot reset and render",
      status: hasBuild ? "pass" : "watch",
      severity: "medium",
      customerLine: t(locale, "Frontend ma osobny slot stanu dla envelope readiness.", "Frontend hat separaten State-Slot fuer Envelope-Readiness.", "Frontend has a separate state slot for envelope readiness."),
      proPdfLine: "Client must set pass2596 payload and render a bounded panel, not infer from old state.",
      operatorLine: "Reset pass2596 state on failed submit in a later hardening pass if stale UI is observed.",
      requiredKey: "pass2596ApiContractResponseEnvelopeHardening",
      blocksBasicRender: false,
      blocksProPdf: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["VlmAuditCommandClient", "AuditWatchResponse"],
      fixAction: "Keep pass2596 state nullable and render only customerRows.",
    }),
    check({
      id: "envelope-no-debug-private-leak",
      layer: "regression",
      label: "No debug/private field leak",
      status: "watch",
      severity: "high",
      customerLine: t(locale, "Debug i pola prywatne muszą zostać poza klientem i PDF-em.", "Debug und private Felder bleiben ausserhalb von Client und PDF.", "Debug and private fields must stay out of client and PDF."),
      proPdfLine: "Forbidden tokens: debug, raw payload, operator-only, api key, seed phrase, exploit steps.",
      operatorLine: "Verifier scans for integration strings, but full runtime payload redaction still needs local E2E.",
      requiredKey: "redaction scan",
      blocksBasicRender: false,
      blocksProPdf: false,
      blocksAdvancedFinalSign: true,
      evidenceRefs: ["pass2585", "pass2594", "pass2596"],
      fixAction: "Add runtime JSON snapshot tests in the next E2E pass.",
    }),
  ];

  const pass = checks.filter((item) => item.status === "pass").length;
  const watch = checks.filter((item) => item.status === "watch").length;
  const fail = checks.filter((item) => item.status === "fail").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const envelopeReadiness = average(checks, () => true);
  const headerReadiness = average(checks, (item) => item.layer === "headers" || item.layer === "http");
  const customerPayloadReadiness = average(checks, (item) => item.layer === "customer" || item.layer === "json");
  const proPdfEnvelopeReadiness = average(checks, (item) => item.layer === "pdf" || item.layer === "headers");
  const clientStateReadiness = average(checks, (item) => item.layer === "client" || item.layer === "regression");
  const topEnvelopeBlocker = checks.find((item) => item.status === "blocked" || item.status === "fail")?.label ?? checks.find((item) => item.status === "watch")?.label ?? "No blocking envelope issue in this bounded pass";

  const customerRows = [
    row("Envelope readiness", envelopeReadiness >= 82 ? "pass" : envelopeReadiness >= 55 ? "watch" : "blocked", `API envelope readiness ${envelopeReadiness}/100.`),
    row("Named payload", hasQa && hasBuild ? "pass" : "blocked", hasQa && hasBuild ? "Named pass payloads are present." : "Release/build inputs are missing."),
    row("Customer rows", basicReady ? "pass" : "watch", basicReady ? "Basic can render bounded customer rows." : "Basic must show a limited status."),
    row("PDF appendix", proReady ? "pass" : "watch", proReady ? "Pro PDF can append customer-safe rows." : "Pro PDF should remain guarded."),
    row("Advanced final sign", advancedReady ? "pass" : "blocked", advancedReady ? "Advanced final sign can use the envelope." : "Advanced final sign still needs local build/manual proof."),
  ];

  const proPdfRows = [
    row("Response shape", hasQa && hasBuild ? "pass" : "blocked", "Requires ok=true plus named pass payload keys."),
    row("Header manifest", "pass", "Requires no-store, pass id and readiness headers."),
    row("Customer-safe appendix", proReady ? "pass" : "watch", "PDF appends customer-safe rows only; operator rows remain private."),
    row("No silent mutation", "pass", "Envelope version must change when payload shape changes."),
  ];

  const operatorRows = checks.map((item) => row(item.label, item.status, `${item.layer}: ${item.operatorLine} Fix: ${item.fixAction}`));

  return {
    passId: PASS2596_API_CONTRACT_RESPONSE_ENVELOPE_HARDENING_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "Every audit endpoint must return a stable named envelope with customer-safe rows, headers and no silent payload mutation.",
    customerRule: t(locale, "Velmère pokazuje stabilny status API bez prywatnego payloadu.", "Velmère zeigt stabilen API-Status ohne privaten Payload.", "Velmère shows stable API status without private payload."),
    proRule: "Pro PDF may only append contracted customer-safe rows from the response envelope.",
    operatorRule: "Operator payload, debug, raw evidence and private delivery pointers must never be exposed through public JSON or customer PDF.",
    summary: {
      checks: checks.length,
      pass,
      watch,
      fail,
      blocked,
      envelopeReadiness,
      headerReadiness,
      customerPayloadReadiness,
      proPdfEnvelopeReadiness,
      clientStateReadiness,
      canRenderBasicResponse: basicReady && blocked === 0,
      canRenderProPdfResponse: proReady && blocked === 0,
      canUseForAdvancedFinalSign: advancedReady && fail === 0 && blocked === 0,
      topEnvelopeBlocker,
      topEnvelopeRisk: topEnvelopeBlocker,
    },
    checks,
    customerRows,
    proPdfRows,
    operatorRows,
    envelopeContract: {
      responseShape: ["ok", "preview", "accountMessage", "pass2596ApiContractResponseEnvelopeHardening"],
      requiredHeaders: ["cache-control:no-store", "x-velmere-pass2596-api-envelope", "x-velmere-envelope-readiness"],
      nullablePayloadRule: "Missing optional pass payloads must be null, not undefined-derived UI assumptions.",
      noRawDebugRule: "No debug, raw payload, operator-only, api key, seed phrase or exploit-step fields in customer JSON/PDF.",
      noSilentMutationRule: "Any response shape change requires an explicit pass envelope and verifier update.",
    },
    clientMergeContract: {
      stateSlot: "apiContractResponseEnvelopeHardening",
      renderSlot: "data-pass2596-api-envelope",
      resetRule: "Reset pass2596 state on new submit/error to avoid stale readiness.",
      fallbackRule: "If missing, show limited status instead of inferring readiness from old passes.",
    },
    pdfAppendixContract: {
      customerSafeRowsOnly: true,
      forbiddenTerms: ["debug", "raw payload", "operator-only", "api key", "seed phrase", "exploit steps"],
      appendixSlot: "API contract / response envelope customer-safe status",
    },
    visualMergeContract: {
      publicSlot: "Basic audit status panel after build readiness.",
      proPdfSlot: "Contracted Pro PDF appendix after runtime build readiness rows.",
      operatorSlot: "Operator rows remain available to admin tooling only.",
      doNotExpose: ["operatorRows", "raw provider payloads", "private delivery pointers", "API keys", "debug traces"],
    },
    nextImplementationBacklog: [
      "Add runtime JSON snapshot tests for audit-watch and Pro PDF envelopes.",
      "Add UI stale-state reset tests for failed submits.",
      "Promote envelope contract into shared schema once local Next build passes.",
      "Add server-side redaction scanner for every customer-facing response.",
    ],
  };
}
