import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2597CustomerSafePdfDataLeakGuardReport } from "./customer-safe-pdf-data-leak-guard";

export const PASS2598_PRIVACY_REDACTION_PII_BOUNDARY_GATE_ID = "privacy-redaction-pii-boundary-gate" as const;

export type Pass2598RedactionStatus = "clean" | "masked" | "review" | "blocked";
export type Pass2598RedactionFamily = "identity" | "wallet" | "receipt" | "session" | "provider" | "operator" | "pdf" | "retention";

export type Pass2598RedactionCheck = {
  id: string;
  family: Pass2598RedactionFamily;
  label: string;
  status: Pass2598RedactionStatus;
  severity: "low" | "medium" | "high" | "critical";
  customerLine: string;
  proPdfLine: string;
  operatorLine: string;
  piiSurface: string;
  redactionRule: string;
  replacementExample: string;
  blocksCustomerPdf: boolean;
  blocksBasicUi: boolean;
  blocksAdvancedFinalSign: boolean;
  evidenceRefs: string[];
};

export type Pass2598CustomerRow = {
  label: string;
  status: Pass2598RedactionStatus;
  output: string;
};

export type Pass2598PrivacyRedactionPiiBoundaryGateReport = {
  passId: typeof PASS2598_PRIVACY_REDACTION_PII_BOUNDARY_GATE_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  customerRule: string;
  operatorRule: string;
  summary: {
    checks: number;
    clean: number;
    masked: number;
    review: number;
    blocked: number;
    redactionReadiness: number;
    customerPdfPrivacyReadiness: number;
    basicUiPrivacyReadiness: number;
    advancedPrivacyReadiness: number;
    canRenderCustomerPdf: boolean;
    canRenderBasicUi: boolean;
    canFinalSignAdvanced: boolean;
    topPrivacyRisk: string;
    /** PASS4143 compatibility alias for old launch-gate consumers. */
    topRedactionRisk: string;
  };
  checks: Pass2598RedactionCheck[];
  customerRows: Pass2598CustomerRow[];
  proPdfRows: Pass2598CustomerRow[];
  operatorRows: Pass2598CustomerRow[];
  redactionPolicy: {
    maskedPatterns: string[];
    allowedCustomerTokens: string[];
    forbiddenCustomerTokens: string[];
    replacementRule: string;
    noSilentDropRule: string;
  };
  piiBoundaryContract: {
    publicAllowed: string[];
    operatorOnly: string[];
    hashOnly: string[];
    retentionNote: string;
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
  customerSafePdfDataLeakGuard?: Pass2597CustomerSafePdfDataLeakGuardReport | null;
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

function row(label: string, status: Pass2598RedactionStatus, output: string): Pass2598CustomerRow {
  return { label, status, output };
}

function scoreStatus(status: Pass2598RedactionStatus, severity: Pass2598RedactionCheck["severity"]) {
  const base = status === "clean" ? 100 : status === "masked" ? 84 : status === "review" ? 55 : 18;
  const penalty = severity === "critical" ? 8 : severity === "high" ? 5 : severity === "medium" ? 2 : 0;
  return clamp(base - penalty, 0, 100);
}

function average(checks: Pass2598RedactionCheck[], filter: (check: Pass2598RedactionCheck) => boolean) {
  const scoped = checks.filter(filter);
  if (!scoped.length) return 0;
  return clamp(scoped.reduce((sum, item) => sum + scoreStatus(item.status, item.severity), 0) / scoped.length, 0, 100);
}

function check(args: Pass2598RedactionCheck): Pass2598RedactionCheck {
  return { ...args, evidenceRefs: uniq(args.evidenceRefs) };
}

export function maskCustomerFacingPii(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/0x[a-fA-F0-9]{40}/g, "[redacted-wallet]")
    .replace(/\b(?:receipt|session|token|secret|key|jwt)[_-]?[A-Za-z0-9._:-]{8,}\b/gi, "[redacted-token]")
    .replace(/\b(?:velmere141@gmail\.com|operator-only|operator note|admin-only|private ledger|raw provider payload)\b/gi, "[redacted-private]");
}

export function buildPass2598PrivacyRedactionPiiBoundaryGateReport(input: BuilderInput): Pass2598PrivacyRedactionPiiBoundaryGateReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96);
  const projectName = clean(input.projectName || input.website || input.auditUrl, 140);
  const leakGuard = input.customerSafePdfDataLeakGuard;
  const leakReady = leakGuard?.summary.leakGuardReadiness ?? 0;
  const leakPdfSafe = Boolean(leakGuard?.summary.canRenderCustomerPdf);
  const leakBasicSafe = Boolean(leakGuard?.summary.canRenderBasicUi);
  const leakAdvancedSafe = Boolean(leakGuard?.summary.canFinalSignAdvanced);

  const checks: Pass2598RedactionCheck[] = [
    check({
      id: "pii-email-redaction-boundary",
      family: "identity",
      label: "Email and account identity boundary",
      status: leakPdfSafe ? "masked" : leakGuard ? "review" : "blocked",
      severity: "critical",
      customerLine: t(locale, "Dane kontaktowe są maskowane przed PDF/UI klienta.", "Kontaktdaten werden vor PDF/UI maskiert.", "Contact identifiers are masked before customer PDF/UI."),
      proPdfLine: "Customer PDF may show delivery status, not raw email/account identifiers.",
      operatorLine: "Operator can resolve private delivery through account vault; public artifacts get [redacted-email].",
      piiSurface: "email address, account name, support inbox, customer contact",
      redactionRule: "Replace emails with [redacted-email] before customer-facing render.",
      replacementExample: "user@example.com -> [redacted-email]",
      blocksCustomerPdf: !leakPdfSafe,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["pass2597", "pro-pdf route", "account delivery gate"],
    }),
    check({
      id: "pii-wallet-session-boundary",
      family: "wallet",
      label: "Wallet and session identifier boundary",
      status: leakBasicSafe ? "masked" : leakGuard ? "review" : "blocked",
      severity: "critical",
      customerLine: t(locale, "Adresy portfeli i sesje są skracane albo maskowane poza kontekstem właściciela.", "Wallets und Sitzungen werden maskiert.", "Wallet and session identifiers are masked outside the owner context."),
      proPdfLine: "Wallet ownership is context only; it must not reduce technical risk or leak a full address.",
      operatorLine: "Use hashed account pointer in delivery ledger and full value only in authenticated private vault.",
      piiSurface: "wallet address, session id, account id, entitlement token",
      redactionRule: "Replace full 0x addresses and session tokens with bounded placeholders.",
      replacementExample: "0x1234...abcd -> [redacted-wallet]",
      blocksCustomerPdf: !leakBasicSafe,
      blocksBasicUi: !leakBasicSafe,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["pass2587", "pass2588", "pass2597"],
    }),
    check({
      id: "pii-receipt-token-hash-only",
      family: "receipt",
      label: "Receipt token hash-only rule",
      status: leakReady >= 60 ? "clean" : leakGuard ? "review" : "blocked",
      severity: "high",
      customerLine: t(locale, "Receipt może być pokazany jako status albo hash, nie jako prywatny token.", "Receipt nur als Status oder Hash anzeigen.", "Receipt can be shown as status or hash, not as a private token."),
      proPdfLine: "Receipt proof may appear as a short hash/reference; replay token stays server-side.",
      operatorLine: "Never place receipt replay token in PDF lines, client rows, query params, or public headers.",
      piiSurface: "receipt id, replay token, payment reference, private delivery pointer",
      redactionRule: "Allow short hash/reference only; redact raw token-shaped values.",
      replacementExample: "receipt_live_xxx -> [redacted-token]",
      blocksCustomerPdf: leakReady < 45,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["pass2587", "pass2588", "pass2589"],
    }),
    check({
      id: "pii-operator-note-firewall",
      family: "operator",
      label: "Operator note firewall",
      status: leakAdvancedSafe ? "clean" : leakGuard ? "review" : "blocked",
      severity: "critical",
      customerLine: t(locale, "Notatki operatora nie są częścią publicznego raportu.", "Operatornotizen sind nicht Teil des öffentlichen Berichts.", "Operator notes are not part of the public report."),
      proPdfLine: "Pro PDF receives summary rows only; operatorRows stay in admin/private review.",
      operatorLine: "Advanced sign-off can cite operator checklist but must not copy internal notes into customer text.",
      piiSurface: "operator rows, internal notes, admin comments, private manual checklist",
      redactionRule: "Block operatorRows from customerRows/proPdfRows and scan final PDF lines.",
      replacementExample: "operator-only note -> [redacted-private]",
      blocksCustomerPdf: false,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: !leakAdvancedSafe,
      evidenceRefs: ["pass2586", "pass2594", "pass2597"],
    }),
    check({
      id: "pii-raw-provider-dump-boundary",
      family: "provider",
      label: "Raw provider dump boundary",
      status: "masked",
      severity: "high",
      customerLine: t(locale, "Surowe payloady providerów są streszczane, nie wklejane.", "Rohdaten werden zusammengefasst, nicht eingefügt.", "Raw provider payloads are summarized, not pasted."),
      proPdfLine: "PDF shows provider verdict and freshness, not raw JSON or API metadata.",
      operatorLine: "Store raw provider body only in private diagnostics with retention controls.",
      piiSurface: "raw JSON, API metadata, provider traces, request ids",
      redactionRule: "Convert raw provider body into bounded evidence rows and redact request metadata.",
      replacementExample: "{providerRaw:{...}} -> bounded evidence row",
      blocksCustomerPdf: false,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: false,
      evidenceRefs: ["pass2582", "pass2592", "pass2596"],
    }),
    check({
      id: "pii-retention-delete-boundary",
      family: "retention",
      label: "Retention and deletion boundary",
      status: "review",
      severity: "medium",
      customerLine: t(locale, "Retencja prywatnych danych wymaga osobnej polityki i usuwania.", "Private Daten brauchen Retention und Löschung.", "Private data needs retention and deletion policy."),
      proPdfLine: "Retention is disclosed as a policy boundary, not as raw storage internals.",
      operatorLine: "Add persistent redaction log and retention TTL before production launch.",
      piiSurface: "case vault, private ledger, account delivery, operator history",
      redactionRule: "Keep private ledger references hash-only in customer artifacts; define retention TTL server-side.",
      replacementExample: "case-vault/private-pointer -> [hash-ref]",
      blocksCustomerPdf: false,
      blocksBasicUi: false,
      blocksAdvancedFinalSign: true,
      evidenceRefs: ["pass2588", "pass284-retention-policy", "pass2597"],
    }),
  ];

  const cleanCount = checks.filter((item) => item.status === "clean").length;
  const masked = checks.filter((item) => item.status === "masked").length;
  const review = checks.filter((item) => item.status === "review").length;
  const blocked = checks.filter((item) => item.status === "blocked").length;
  const customerPdfPrivacyReadiness = average(checks, (item) => item.family === "identity" || item.family === "receipt" || item.family === "operator" || item.family === "provider");
  const basicUiPrivacyReadiness = average(checks, (item) => item.family === "wallet" || item.family === "identity" || item.family === "provider");
  const advancedPrivacyReadiness = average(checks, (item) => item.family === "operator" || item.family === "receipt" || item.family === "retention");
  const redactionReadiness = clamp((customerPdfPrivacyReadiness + basicUiPrivacyReadiness + advancedPrivacyReadiness + leakReady) / 4, 0, 100);
  const canRenderCustomerPdf = !checks.some((item) => item.blocksCustomerPdf && item.status === "blocked") && customerPdfPrivacyReadiness >= 55;
  const canRenderBasicUi = !checks.some((item) => item.blocksBasicUi && item.status === "blocked") && basicUiPrivacyReadiness >= 55;
  const canFinalSignAdvanced = !checks.some((item) => item.blocksAdvancedFinalSign && (item.status === "blocked" || item.status === "review")) && advancedPrivacyReadiness >= 70;
  const topPrivacyRisk = checks.find((item) => item.status === "blocked")?.label ?? checks.find((item) => item.status === "review")?.label ?? "no active privacy blocker";

  const customerRows = [
    row("Redaction readiness", redactionReadiness >= 70 ? "clean" : redactionReadiness >= 55 ? "masked" : "review", `${redactionReadiness}/100 privacy boundary readiness.`),
    row("Customer PDF privacy", canRenderCustomerPdf ? "clean" : "review", canRenderCustomerPdf ? "PDF can render after masked rows are applied." : "PDF needs privacy review before final export."),
    row("Basic UI privacy", canRenderBasicUi ? "clean" : "review", canRenderBasicUi ? "Basic UI uses bounded privacy rows." : "Basic UI must avoid raw identity/session data."),
    row("Advanced sign-off privacy", canFinalSignAdvanced ? "clean" : "review", canFinalSignAdvanced ? "Advanced sign-off privacy boundary is ready." : "Advanced final sign-off needs operator privacy review."),
    row("Top privacy risk", topPrivacyRisk === "no active privacy blocker" ? "clean" : "review", topPrivacyRisk),
  ];

  const proPdfRows = [
    row("PII redaction", "masked", "Emails, wallets, receipt tokens and private pointers are masked in customer-facing text."),
    row("Operator boundary", leakAdvancedSafe ? "clean" : "review", "Operator rows stay out of customer PDF; only bounded status rows are allowed."),
    row("Hash-only receipt", leakReady >= 60 ? "clean" : "review", "Receipt proof may appear only as a short reference/hash, not as a replay token."),
    ...checks.slice(0, 4).map((item) => row(item.label, item.status, item.proPdfLine)),
  ];

  const operatorRows = checks.map((item) => row(item.label, item.status, `${item.operatorLine} Control: ${item.redactionRule}`));

  return {
    passId: PASS2598_PRIVACY_REDACTION_PII_BOUNDARY_GATE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    customerRule: t(locale, "Klient widzi status prywatności, nie dane prywatne.", "Kunden sehen Datenschutzstatus, nicht private Daten.", "Customers see privacy status, not private data."),
    operatorRule: "Operator payload may contain private routing only inside authenticated/admin surfaces; public artifacts get masked/hash-only values.",
    summary: {
      checks: checks.length,
      clean: cleanCount,
      masked,
      review,
      blocked,
      redactionReadiness,
      customerPdfPrivacyReadiness,
      basicUiPrivacyReadiness,
      advancedPrivacyReadiness,
      canRenderCustomerPdf,
      canRenderBasicUi,
      canFinalSignAdvanced,
      topPrivacyRisk,
      topRedactionRisk: topPrivacyRisk,
    },
    checks,
    customerRows,
    proPdfRows,
    operatorRows,
    redactionPolicy: {
      maskedPatterns: ["email", "0x wallet", "receipt/session token", "operator note", "raw provider payload"],
      allowedCustomerTokens: ["risk status", "bounded confidence", "short hash/reference", "public source label"],
      forbiddenCustomerTokens: ["email", "full wallet", "session id", "raw receipt token", "operatorRows", "raw provider payload", "private delivery pointer"],
      replacementRule: "Replace private identifiers with [redacted-*] placeholders before customer PDF/UI render.",
      noSilentDropRule: "If a claim needs redaction, state that private details were redacted instead of silently changing the conclusion.",
    },
    piiBoundaryContract: {
      publicAllowed: ["customerRows", "proPdfRows", "summary readiness", "short hash reference"],
      operatorOnly: ["operatorRows", "raw provider body", "private delivery pointer", "manual notes", "receipt replay token"],
      hashOnly: ["receipt reference", "case vault pointer", "account delivery link", "request id"],
      retentionNote: "Private identifiers need server-side retention TTL and deletion audit before production launch.",
    },
    visualMergeContract: {
      publicSlot: "Show privacy readiness and top privacy risk in Basic audit panel.",
      proPdfSlot: "Append masked privacy statement near leak guard appendix.",
      operatorSlot: "Show full redaction checklist only inside admin/operator review.",
      doNotExpose: ["raw provider payload", "receipt replay token", "full wallet/session id", "operator note", "private delivery pointer"],
    },
    nextImplementationBacklog: [
      "Add runtime response scanner that applies maskCustomerFacingPii to final PDF lines.",
      "Persist redaction decisions in case vault with retention TTL.",
      "Add UI snapshots proving no operatorRows render in public panels.",
      "Wire privacy gate into Advanced final sign-off button state.",
    ],
  };
}
