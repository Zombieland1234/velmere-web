import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2594AuditEvidenceQaReleaseGateMatrixReport } from "./audit-evidence-qa-release-gate-matrix";

export const PASS2595_RUNTIME_BUILD_READINESS_TYPE_SAFETY_SWEEP_ID = "runtime-build-readiness-type-safety-sweep" as const;

export type Pass2595BuildReadinessStatus = "pass" | "watch" | "fail" | "blocked";
export type Pass2595BuildReadinessLayer = "runtime" | "type_safety" | "api" | "ui" | "pdf" | "verifier" | "release";

export type Pass2595BuildReadinessCheck = {
  id: string;
  layer: Pass2595BuildReadinessLayer;
  label: string;
  status: Pass2595BuildReadinessStatus;
  severity: "low" | "medium" | "high" | "critical";
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  commandHint: string;
  blocksQaBuild: boolean;
  blocksFullBuild: boolean;
  evidenceRefs: string[];
  fixAction: string;
};

export type Pass2595BuildReadinessRow = {
  label: string;
  status: Pass2595BuildReadinessStatus;
  output: string;
};

export type Pass2595RuntimeBuildReadinessTypeSafetySweepReport = {
  passId: typeof PASS2595_RUNTIME_BUILD_READINESS_TYPE_SAFETY_SWEEP_ID;
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
    buildReadiness: number;
    typeSafetyReadiness: number;
    apiContractReadiness: number;
    uiPayloadReadiness: number;
    verifierReadiness: number;
    canShipQaBuild: boolean;
    canStartFullBuild: boolean;
    mustRunLocalNextBuild: boolean;
    topBuildBlocker: string;
    /** PASS4143 compatibility alias for old launch-gate consumers. */
    topBuildRisk: string;
  };
  checks: Pass2595BuildReadinessCheck[];
  customerRows: Pass2595BuildReadinessRow[];
  proPdfRows: Pass2595BuildReadinessRow[];
  operatorRows: Pass2595BuildReadinessRow[];
  buildCommandContract: {
    packageManager: string;
    requiredBeforeDeploy: string[];
    sandboxLimit: string;
    localGateRule: string;
  };
  verifierRegistry: {
    requiredScripts: string[];
    invariant: string;
    noPassCanSkip: string[];
  };
  visualMergeContract: {
    publicSlot: string;
    proPdfSlot: string;
    operatorSlot: string;
    rule: string;
    keepWired: string[];
    doNotExpose: string[];
  };
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  auditEvidenceQaReleaseGateMatrix?: Pass2594AuditEvidenceQaReleaseGateMatrixReport | null;
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

function check(args: Pass2595BuildReadinessCheck): Pass2595BuildReadinessCheck {
  return {
    ...args,
    evidenceRefs: uniq(args.evidenceRefs),
  };
}

function row(label: string, status: Pass2595BuildReadinessStatus, output: string): Pass2595BuildReadinessRow {
  return { label, status, output };
}

function scoreStatus(status: Pass2595BuildReadinessStatus, severity: Pass2595BuildReadinessCheck["severity"]) {
  const base = status === "pass" ? 100 : status === "watch" ? 72 : status === "fail" ? 36 : 18;
  const penalty = severity === "critical" ? 10 : severity === "high" ? 6 : severity === "medium" ? 3 : 0;
  return clamp(base - penalty, 0, 100);
}

function average(checks: Pass2595BuildReadinessCheck[], filter: (check: Pass2595BuildReadinessCheck) => boolean) {
  const scoped = checks.filter(filter);
  if (!scoped.length) return 0;
  return clamp(scoped.reduce((sum, item) => sum + scoreStatus(item.status, item.severity), 0) / scoped.length, 0, 100);
}

function statusLabel(status: Pass2595BuildReadinessStatus, locale: string) {
  if (status === "pass") return t(locale, "zaliczone", "bestanden", "passed");
  if (status === "watch") return t(locale, "obserwuj", "beobachten", "watch");
  if (status === "fail") return t(locale, "niezaliczone", "fehlgeschlagen", "failed");
  return t(locale, "zablokowane", "blockiert", "blocked");
}

export function buildPass2595RuntimeBuildReadinessTypeSafetySweepReport(input: BuilderInput): Pass2595RuntimeBuildReadinessTypeSafetySweepReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName || input.website || input.auditUrl, 140);
  const qa = input.auditEvidenceQaReleaseGateMatrix;
  const hasQa = Boolean(qa);
  const releaseReady = qa?.summary.releaseReadiness ?? 0;
  const basicReady = Boolean(qa?.summary.canReleaseBasicPublic);
  const proReady = Boolean(qa?.summary.canRenderProPdf);
  const advancedReady = Boolean(qa?.summary.canFinalSignAdvanced);
  const qaCriticalBlockers = qa?.summary.criticalBlockers ?? 1;
  const qaHasNoCriticalBlockers = hasQa && qaCriticalBlockers === 0;

  const checks: Pass2595BuildReadinessCheck[] = [
    check({
      id: "build-pass2594-release-gate-input",
      layer: "release",
      label: "Release gate payload present",
      status: hasQa ? "pass" : "blocked",
      severity: "critical",
      customerLine: hasQa
        ? t(locale, "Release gate jest podpięty do wyniku audytu.", "Release-Gate ist mit dem Audit-Ergebnis verbunden.", "Release gate is wired to the audit result.")
        : t(locale, "Release gate musi powstać przed oceną build-readiness.", "Release-Gate muss vor Build-Readiness existieren.", "Release gate must exist before build-readiness can be judged."),
      proPdfLine: `PASS2594 release readiness ${releaseReady}/100; critical blockers ${qaCriticalBlockers}.`,
      operatorLine: "Do not treat build-readiness as valid unless PASS2594 is present in the same audit payload.",
      commandHint: "npm run verify:audit-evidence-qa-release-gate-matrix",
      blocksQaBuild: !hasQa,
      blocksFullBuild: !hasQa,
      evidenceRefs: ["pass2594", "release gate matrix"],
      fixAction: "Wire PASS2594 into audit-watch before evaluating runtime build readiness.",
    }),
    check({
      id: "build-verifier-chain-2582-2595",
      layer: "verifier",
      label: "Verifier chain coverage",
      status: hasQa ? "pass" : "watch",
      severity: "high",
      customerLine: t(locale, "Łańcuch verifierów chroni przed regresją passów audytu.", "Verifier-Kette schützt vor Audit-Regressionen.", "Verifier chain protects audit passes from regression."),
      proPdfLine: "Required scripts cover PASS2582 through PASS2595 plus i18n and package JSON parse.",
      operatorLine: "Any next pass must add a verifier and keep older verifier scripts green.",
      commandHint: "npm run verify:runtime-build-readiness-type-safety-sweep",
      blocksQaBuild: false,
      blocksFullBuild: false,
      evidenceRefs: ["scripts/verify-runtime-build-readiness-type-safety-sweep.mjs", "package.json"],
      fixAction: "Add missing verifier scripts before shipping the next ZIP.",
    }),
    check({
      id: "build-customer-payload-shape",
      layer: "ui",
      label: "Customer payload shape",
      status: basicReady ? "pass" : hasQa ? "watch" : "blocked",
      severity: "high",
      customerLine: basicReady
        ? t(locale, "Basic może pokazać wynik bez ukrywania braków.", "Basic kann Ergebnis ohne verdeckte Lücken zeigen.", "Basic can show the result without hiding gaps.")
        : t(locale, "Basic pozostaje ograniczony, dopóki release gate nie przepuści payloadu.", "Basic bleibt begrenzt, bis Release-Gate Payload freigibt.", "Basic stays limited until release gate clears the payload."),
      proPdfLine: `Basic release ${String(basicReady)}; customer rows ${qa?.customerRows.length ?? 0}.`,
      operatorLine: "Client must render PASS2595 rows as customer-safe status, not operator internals.",
      commandHint: "grep -n \"data-pass2595-build-readiness\" components/security/VlmAuditCommandClient.tsx",
      blocksQaBuild: !basicReady && !hasQa,
      blocksFullBuild: !basicReady && !hasQa,
      evidenceRefs: ["components/security/VlmAuditCommandClient.tsx", "pass2594.customerRows"],
      fixAction: "Keep Basic copy passive and show limited state if release gate is not clean.",
    }),
    check({
      id: "build-pro-pdf-firewall",
      layer: "pdf",
      label: "Pro PDF customer-safe firewall",
      status: proReady ? "pass" : hasQa ? "watch" : "blocked",
      severity: "critical",
      customerLine: proReady
        ? t(locale, "Pro PDF ma customer-safe granicę przed eksportem.", "Pro PDF hat eine kundensichere Exportgrenze.", "Pro PDF has a customer-safe export boundary.")
        : t(locale, "Pro PDF nie powinien renderować pełnego raportu bez zaliczenia gate.", "Pro PDF sollte ohne Gate keinen Vollbericht rendern.", "Pro PDF should not render a full report without gate clearance."),
      proPdfLine: `Pro PDF release ${String(proReady)}; release readiness ${releaseReady}/100.`,
      operatorLine: "Do not expose debug/pass logs, raw operator payloads or private delivery pointers in customer PDF.",
      commandHint: "npm run verify:premium-pro-pdf-template-contract",
      blocksQaBuild: false,
      blocksFullBuild: !proReady && qaCriticalBlockers > 0,
      evidenceRefs: ["pass2585", "pass2594", "pro-pdf route"],
      fixAction: "Keep contractedLines filtered by customer-safe rules before PDF render.",
    }),
    check({
      id: "build-advanced-final-sign-gate",
      layer: "release",
      label: "Advanced final sign gate",
      status: advancedReady ? "pass" : hasQa ? "watch" : "blocked",
      severity: "critical",
      customerLine: advancedReady
        ? t(locale, "Advanced może przejść do final sign-off po operatorze.", "Advanced kann nach Operator-Prüfung final freigegeben werden.", "Advanced can proceed to final sign-off after operator review.")
        : t(locale, "Advanced zostaje w review, jeśli brakuje dowodów lub redakcji.", "Advanced bleibt im Review bei fehlenden Belegen oder Redaktion.", "Advanced stays in review when evidence or redaction is missing."),
      proPdfLine: `Advanced final sign ${String(advancedReady)}; top blocker ${qa?.summary.topReleaseBlocker ?? "qa missing"}.`,
      operatorLine: "Advanced is a manual workflow; build-readiness cannot bypass payment, scope, evidence sufficiency or redaction.",
      commandHint: "npm run verify:advanced-operator-console-merge",
      blocksQaBuild: false,
      blocksFullBuild: false,
      evidenceRefs: ["pass2586", "pass2594", "operator console"],
      fixAction: "Keep Advanced gated as review-only until operator controls and redaction pass.",
    }),
    check({
      id: "build-api-header-contract",
      layer: "api",
      label: "API header contract",
      status: "pass",
      severity: "medium",
      customerLine: t(locale, "API zwraca jawny status readiness zamiast cichego sukcesu.", "API gibt explizite Readiness statt stillem Erfolg zurück.", "API returns explicit readiness instead of silent success."),
      proPdfLine: "audit-watch and standalone endpoint expose x-velmere-pass2595-build-readiness headers.",
      operatorLine: "Headers must preserve PASS2595 id, build readiness and local full-build requirement.",
      commandHint: "curl -I /api/security/audit-watch",
      blocksQaBuild: false,
      blocksFullBuild: false,
      evidenceRefs: ["audit-watch route", "standalone route", "response headers"],
      fixAction: "Keep headers updated whenever the runtime build readiness contract changes.",
    }),
    check({
      id: "build-type-safety-import-sweep",
      layer: "type_safety",
      label: "Type/import/state sweep",
      status: "pass",
      severity: "high",
      customerLine: t(locale, "Payload ma osobny typ, state i panel UI.", "Payload hat eigenen Typ, State und UI-Panel.", "Payload has dedicated type, state and UI panel."),
      proPdfLine: "PASS2595 adds typed report import, response slot, state setter and renderer slot.",
      operatorLine: "Duplicate state/import drift should be caught by verifier before full build.",
      commandHint: "node scripts/verify-runtime-build-readiness-type-safety-sweep.mjs",
      blocksQaBuild: false,
      blocksFullBuild: false,
      evidenceRefs: ["VlmAuditCommandClient.tsx", "AuditWatchResponse", "buildPublicAuditView"],
      fixAction: "Run focused verifier after each pass and then full typecheck locally.",
    }),
    check({
      id: "build-local-next-build-required",
      layer: "runtime",
      label: "Local full Next build required",
      status: "watch",
      severity: "high",
      customerLine: t(locale, "Pełny build lokalny jest nadal wymagany przed deployem.", "Voller lokaler Build ist vor Deployment weiter erforderlich.", "Full local build is still required before deploy."),
      proPdfLine: "Sandbox verifies pass chain and TS smoke only; node_modules/full Next build must run locally.",
      operatorLine: "Do not mark production-ready until npm ci, npm run typecheck or npm run build passes on the real machine.",
      commandHint: "npm ci && npm run build",
      blocksQaBuild: false,
      blocksFullBuild: true,
      evidenceRefs: ["sandbox limitation", "node_modules absent", "local build gate"],
      fixAction: "Run full Next build locally and paste logs into the next progress file.",
    }),
  ];

  const pass = checks.filter((item) => item.status === "pass").length;
  const watch = checks.filter((item) => item.status === "watch").length;
  const fail = checks.filter((item) => item.status === "fail").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const buildReadiness = average(checks, () => true);
  const typeSafetyReadiness = average(checks, (item) => item.layer === "type_safety" || item.layer === "runtime");
  const apiContractReadiness = average(checks, (item) => item.layer === "api" || item.layer === "release");
  const uiPayloadReadiness = average(checks, (item) => item.layer === "ui" || item.layer === "pdf");
  const verifierReadiness = average(checks, (item) => item.layer === "verifier");
  const hardBuildBlockers = checks.filter((item) => item.blocksFullBuild && item.status !== "pass");
  const qaBuildBlockers = checks.filter((item) => item.blocksQaBuild && item.status !== "pass");
  const topBuildBlocker = hardBuildBlockers[0]?.fixAction ?? (qaBuildBlockers[0]?.fixAction ?? (qaHasNoCriticalBlockers ? "Run local full Next build before production deploy." : qa?.summary.topReleaseBlocker ?? "Run PASS2594 and full local build."));

  const customerRows = checks.slice(0, 8).map((item) => row(item.label, item.status, item.customerLine));
  const proPdfRows = checks.map((item) => row(item.label, item.status, item.proPdfLine));
  const operatorRows = checks.map((item) => row(item.label, item.status, `${item.operatorLine} Command: ${item.commandHint}`));

  return {
    passId: PASS2595_RUNTIME_BUILD_READINESS_TYPE_SAFETY_SWEEP_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "PASS2595 converts the growing audit spine into a build-readiness contract: verifier chain, typed payload, customer-safe PDF, headers and local full-build gate must all be explicit.",
    customerRule: t(
      locale,
      "Build-readiness nie znaczy produkcja: pokazuje, co jest zaliczone i co musi przejść lokalny full build.",
      "Build-Readiness heißt nicht Produktion: es zeigt bestandene Gates und was lokal gebaut werden muss.",
      "Build-readiness is not production-ready: it shows passed gates and what still needs a local full build.",
    ),
    proRule: "Pro PDF may include build-readiness status only as customer-safe operational status, never raw logs or private operator payloads.",
    operatorRule: "No deployment claim until verifier chain, package JSON parse, i18n and local Next build/typecheck are green on the real machine.",
    summary: {
      checks: checks.length,
      pass,
      watch,
      fail,
      blocked,
      buildReadiness,
      typeSafetyReadiness,
      apiContractReadiness,
      uiPayloadReadiness,
      verifierReadiness,
      canShipQaBuild: qaBuildBlockers.length === 0 && blocked === 0 && buildReadiness >= 58,
      canStartFullBuild: blocked === 0 && fail === 0 && releaseReady >= 50,
      mustRunLocalNextBuild: true,
      topBuildBlocker,
      topBuildRisk: topBuildBlocker,
    },
    checks,
    customerRows,
    proPdfRows,
    operatorRows,
    buildCommandContract: {
      packageManager: "npm",
      requiredBeforeDeploy: [
        "npm ci",
        "npm run check:i18n",
        "npm run verify:runtime-build-readiness-type-safety-sweep",
        "npm run build",
      ],
      sandboxLimit: "Sandbox pass can verify files, scripts and focused TS smoke, but cannot replace local node_modules/full Next build.",
      localGateRule: "Only local build/typecheck logs can move production readiness above QA-ready.",
    },
    verifierRegistry: {
      requiredScripts: [
        "verify:real-provider-adapter-hardening",
        "verify:contract-source-abi-extraction",
        "verify:holder-liquidity-depth-evidence",
        "verify:premium-pro-pdf-template-contract",
        "verify:advanced-operator-console-merge",
        "verify:server-payment-account-delivery-gate",
        "verify:audit-case-vault-private-delivery-ledger",
        "verify:source-freshness-recheck-orchestrator",
        "verify:risk-formula-evidence-weighting-contract",
        "verify:risk-calibration-golden-fixture-harness",
        "verify:provider-conflict-arbitration-matrix",
        "verify:evidence-narrative-claim-ledger-explainability",
        "verify:audit-evidence-qa-release-gate-matrix",
        "verify:runtime-build-readiness-type-safety-sweep",
      ],
      invariant: "Every new audit pass must have builder, endpoint, audit-watch wiring, Pro PDF wiring, Basic UI wiring and verifier script before it counts as progress.",
      noPassCanSkip: [
        "customer-safe redaction boundary",
        "no random risk score",
        "no silent provider conflict",
        "server-side paid access gate",
        "local full-build requirement",
      ],
    },
    visualMergeContract: {
      publicSlot: "Basic UI can show PASS2595 as a compact build-readiness panel below release QA.",
      proPdfSlot: "Pro PDF can include PASS2595 customer-safe operational readiness rows.",
      operatorSlot: "Operator console can show commands, blockers and full-build status.",
      rule: "Visual redesign may change layout, not the PASS2595 status fields or local full-build warning.",
      keepWired: [
        "summary.buildReadiness",
        "summary.canShipQaBuild",
        "summary.canStartFullBuild",
        "summary.mustRunLocalNextBuild",
        "summary.topBuildBlocker",
        "customerRows",
        "proPdfRows",
      ],
      doNotExpose: [
        "raw build logs with secrets",
        "environment variables",
        "private account delivery pointers",
        "operator-only remediation notes in Basic UI",
      ],
    },
    nextImplementationBacklog: [
      "PASS2596 — Local build log ingestion contract: parse npm build/typecheck output into release-gate rows without exposing secrets.",
      "PASS2597 — Endpoint contract snapshot tests for audit-watch, Pro PDF and standalone routes.",
      "PASS2598 — Client payload regression harness for Basic/Pro/Advanced sections after visual merge.",
      "PASS2599 — Production deploy checklist: env, provider keys, WAF, rate limit and payment webhook dry-run.",
    ],
  };
}

export function pass2595BuildReadinessStatusLabel(status: Pass2595BuildReadinessStatus, locale = "en") {
  return statusLabel(status, locale);
}
