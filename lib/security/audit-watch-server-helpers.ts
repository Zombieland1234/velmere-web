import { getVlmPaidProduct, normalizePaidContext } from "@/lib/commerce/vlm-paid-access";
import type { buildVlmAuditAccountMessage } from "@/lib/security/vlm-audit-product";

export const PASS4420_AUDIT_WATCH_SERVER_HELPER_BOUNDARY = {
  passId: "PASS4420",
  target: "app/api/security/audit-watch/route.ts",
  extractedHelper: "lib/security/audit-watch-server-helpers.ts",
  visualChanges: false,
  worldclassBenchmarkRequired: true,
  publicTopkaLiveAllowed: false,
  advancedAuditPaymentServerSideOnly: true,
  duplicateLocaleFix: true,
  topkaComparison: [
    "CertiK-style paid audit receipt gating",
    "OpenZeppelin-style server helper boundary extraction",
    "Trail of Bits-style no-wallet-access customer safety language",
    "ChainSecurity-style no live promotion without hosted receipts",
  ],
} as const;

export type Pass4420AuditLocale = "pl" | "de" | "en";

export function normalizePass4420AuditLocale(locale: unknown): Pass4420AuditLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

export type Pass4420AdvancedPaidContextInput = {
  locale: Pass4420AuditLocale;
  depth?: "pro" | "advanced";
  contractAddress?: string;
  auditUrl?: string;
  projectName?: string;
  requestId?: string;
  auditCaseRef?: string;
  accountIdHash?: string;
};

export function buildPass4420AdvancedPaidContext(input: Pass4420AdvancedPaidContextInput) {
  const auditCaseRef = input.auditCaseRef?.trim().toUpperCase();
  if (auditCaseRef) {
    return normalizePaidContext({
      surface: "audit",
      locale: input.locale,
      depth: input.depth ?? "advanced",
      requestId: input.requestId,
      auditCaseRef,
      accountIdHash: input.accountIdHash,
      returnPath: `/${input.locale}/account?tab=audits&caseRef=${encodeURIComponent(auditCaseRef)}`,
    }, input.locale);
  }
  return normalizePaidContext({
    surface: "audit",
    locale: input.locale,
    assetId: input.contractAddress || input.auditUrl || input.projectName || "audit-request",
    symbol: input.projectName,
    depth: input.depth ?? "advanced",
    accountIdHash: input.accountIdHash,
    returnPath: `/${input.locale}/security/audits`,
  }, input.locale);
}

export function getPass4420PaidProduct(locale: Pass4420AuditLocale, depth: "pro" | "advanced" = "advanced") {
  return getVlmPaidProduct(depth === "pro" ? "vlm_pro_audit_review" : "vlm_advanced_audit_human_review", locale);
}

type VlmAuditAccountMessage = ReturnType<typeof buildVlmAuditAccountMessage>;

export function buildPass4420PaidAuditAccountMessage(
  message: VlmAuditAccountMessage,
  args: {
    locale: Pass4420AuditLocale;
    auditQueueId?: string | null;
    ledgerMode?: string;
  },
): VlmAuditAccountMessage {
  const queueId = args.auditQueueId ?? "analysis-queue";
  const body = args.locale === "pl"
    ? `${message.packageLabel} ma potwierdzony receipt dostępu i trafia do kolejki analizy. Customer-safe raport pozostaje zablokowany do czasu kontroli redakcji; wallet connect nie jest dowodem płatności.`
    : args.locale === "de"
      ? `${message.packageLabel} hat einen bestätigten Zugangs-Receipt und geht in die Analyse-Warteschlange. Der customer-safe Report bleibt bis zur Redaktionsprüfung gesperrt; Wallet Connect ist kein Zahlungsnachweis.`
      : `${message.packageLabel} has a verified access receipt and is now in the analysis queue. The customer-safe report remains blocked until redaction checks pass; wallet connect is not payment proof.`;
  const paidStep = args.locale === "pl"
    ? `payment receipt verified (${args.ledgerMode ?? "ledger"})`
    : args.locale === "de"
      ? `Payment Receipt verifiziert (${args.ledgerMode ?? "ledger"})`
      : `payment receipt verified (${args.ledgerMode ?? "ledger"})`;

  return {
    ...message,
    body,
    status: "analysis_queue",
    eta: args.locale === "pl" ? "analysis queue po receipt" : args.locale === "de" ? "Analyse-Warteschlange nach Receipt" : "analysis queue after receipt",
    nextSteps: [
      paidStep,
      `queue: ${queueId}`,
      "automated evidence verification",
      "redaction check",
      "customer-safe report delivery",
      ...message.nextSteps.filter((step) => !/payment confirmation|płatno|zahlung/i.test(step)),
    ].slice(0, 8),
  };
}
