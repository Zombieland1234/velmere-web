import { C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import { createHash } from "crypto";
import { hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";

export const PASS2624_SUPABASE_RLS_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ID = "supabase-rls-account-delivery-production-lock" as const;

export type Pass2624AccountDeliveryLockStatus =
  | "locked"
  | "ready"
  | "owner_scoped"
  | "durable"
  | "configured"
  | "missing_storage"
  | "owner_mismatch"
  | "memory_fallback_blocked"
  | "pending_migration"
  | "blocked";

export type Pass2624AccountDeliveryLockFamily =
  | "durable_storage"
  | "rls_owner_scope"
  | "production_no_memory_fallback"
  | "account_owner_query_scope"
  | "delivery_receipt_rows"
  | "download_token_consumption_ledger"
  | "customer_safe_error_envelope"
  | "operator_service_role_boundary";

export type Pass2624AccountDeliveryLockRow = {
  label: string;
  family: Pass2624AccountDeliveryLockFamily;
  status: Pass2624AccountDeliveryLockStatus;
  output: string;
  requiredProof: string;
  blocksCustomerDelivery: boolean;
  blocksProPdf: boolean;
  privateOnlyFields: string[];
};

export type Pass2624SupabaseRlsAccountDeliveryProductionLockReport = {
  passId: typeof PASS2624_SUPABASE_RLS_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "account_delivery_production_lock";
  httpStatus: 200 | 403 | 409 | 423 | 503;
  summary: {
    productionMode: boolean;
    hasSupabaseServiceRoleConfig: boolean;
    durableStorageRequired: boolean;
    memoryFallbackAllowed: boolean;
    memoryFallbackBlockedInProduction: boolean;
    rlsOwnerScopeRequired: boolean;
    serviceRoleOnlyWriteRequired: boolean;
    accountOwnerMatches: boolean;
    canUseAccountDelivery: boolean;
    canMintDownloadToken: boolean;
    canShowAccountVault: boolean;
    storageReadiness: number;
    ownerScopeReadiness: number;
    deliveryReceiptReadiness: number;
    productionLockReadiness: number;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2624AccountDeliveryLockRow[];
  proPdfRows: Pass2624AccountDeliveryLockRow[];
  operatorRows: Pass2624AccountDeliveryLockRow[];
  productionLockContract: {
    invariant: string;
    requiredTables: string[];
    rlsPolicy: string;
    noMemoryFallbackPolicy: string;
    tokenConsumptionPolicy: string;
    ownerScopePolicy: string;
    doNotExpose: string[];
  };
  customerResponse: {
    ok: false;
    surface: "account_delivery_production_lock";
    status: "storage_required" | "owner_mismatch" | "locked";
    message: string;
    nextSafeAction: string;
  } | null;
};

type BuilderInput = {
  locale?: string;
  productionMode?: boolean;
  hasSupabaseServiceRoleConfig?: boolean;
  accountId?: string | null;
  requestAccountId?: string | null;
  recordAccountId?: string | null;
  reportId?: string | null;
  entitlementId?: string | null;
  reportVersionHash?: string | null;
  downloadTokenState?: string | null;
  deliveryReceiptState?: string | null;
  storageSource?: string | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 160) {
  if (typeof value !== "string") return "";
  return value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function hashPrefix(value: string) {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : "none";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function row(
  label: string,
  family: Pass2624AccountDeliveryLockFamily,
  status: Pass2624AccountDeliveryLockStatus,
  output: string,
  requiredProof: string,
  blocksCustomerDelivery: boolean,
  blocksProPdf: boolean,
): Pass2624AccountDeliveryLockRow {
  return {
    label,
    family,
    status,
    output,
    requiredProof,
    blocksCustomerDelivery,
    blocksProPdf,
    privateOnlyFields: [
      "service role key",
      "raw Supabase row",
      "raw download token",
      "token hash",
      "owner email",
      "full wallet address",
      "checkout session id",
      "operator note",
    ],
  };
}

function readiness(rows: Pass2624AccountDeliveryLockRow[], predicate?: (row: Pass2624AccountDeliveryLockRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  const ready = scoped.filter((item) => ["locked", "ready", "owner_scoped", "durable", "configured"].includes(item.status)).length;
  const blocked = scoped.filter((item) => ["missing_storage", "owner_mismatch", "memory_fallback_blocked", "pending_migration", "blocked"].includes(item.status)).length;
  return clamp((ready / Math.max(1, scoped.length)) * 96 - blocked * 13);
}

function publicStatus(locale: string, status: Pass2624AccountDeliveryLockStatus) {
  if (["locked", "ready", "owner_scoped", "durable", "configured"].includes(status)) return t(locale, "potwierdzone", "bestaetigt", "confirmed");
  if (status === "owner_mismatch") return t(locale, "wymaga zgodnosci konta", "Konto-Abgleich noetig", "account match required");
  if (status === "missing_storage") return t(locale, "wymaga Supabase", "Supabase noetig", "Supabase required");
  return t(locale, "zablokowane", "gesperrt", "locked");
}

export function buildPass2624SupabaseRlsAccountDeliveryProductionLockReport(input: BuilderInput = {}): Pass2624SupabaseRlsAccountDeliveryProductionLockReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const productionMode = typeof input.productionMode === "boolean" ? input.productionMode : process.env.NODE_ENV === "production";
  const supabaseConfigured = typeof input.hasSupabaseServiceRoleConfig === "boolean" ? input.hasSupabaseServiceRoleConfig : hasSupabaseServiceRoleConfig();
  const storageSource = clean(input.storageSource, 40) || (supabaseConfigured ? "supabase" : "memory");
  const accountId = clean(input.accountId, 140);
  const requestAccountId = clean(input.requestAccountId, 140) || accountId;
  const recordAccountId = clean(input.recordAccountId, 140) || accountId;
  const reportId = clean(input.reportId, 140);
  const entitlementId = clean(input.entitlementId, 140);
  const reportVersionHash = clean(input.reportVersionHash, 180);
  const tokenState = clean(input.downloadTokenState, 60) || "missing";
  const deliveryReceiptState = clean(input.deliveryReceiptState, 60) || "pending";

  const ownerMatches = Boolean(accountId && requestAccountId && recordAccountId && accountId === requestAccountId && accountId === recordAccountId);
  const durableStorageReady = Boolean(supabaseConfigured && storageSource === "supabase");
  const memoryFallbackAllowed = !productionMode;
  const memoryFallbackBlockedInProduction = productionMode && !durableStorageReady;
  const hasReceiptClaims = Boolean(reportId && accountId && entitlementId && reportVersionHash);
  const tokenFresh = tokenState === "fresh" || tokenState === "unused" || tokenState === "issued";
  const tokenConsumed = tokenState === "consumed" || tokenState === "used" || tokenState === "replayed";
  const receiptDurable = deliveryReceiptState === "written" || deliveryReceiptState === "delivered" || deliveryReceiptState === "ready";

  const rows: Pass2624AccountDeliveryLockRow[] = [
    row(
      "Supabase durable store required",
      "durable_storage",
      durableStorageReady ? "durable" : "missing_storage",
      durableStorageReady
        ? "Account audit messages, delivery receipts and download tokens resolve through Supabase instead of local memory."
        : "Production account delivery is blocked until Supabase URL and service role/anon key are configured.",
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      !durableStorageReady && productionMode,
      !durableStorageReady && productionMode,
    ),
    row(
      "No memory fallback in production",
      "production_no_memory_fallback",
      memoryFallbackBlockedInProduction ? "memory_fallback_blocked" : "locked",
      memoryFallbackBlockedInProduction
        ? "Memory fallback is denied in production; delivery fails closed instead of creating a fake local account vault."
        : "Memory fallback is allowed only for local/QA mode and is not a production delivery source.",
      "NODE_ENV production must use durable Supabase storage",
      memoryFallbackBlockedInProduction,
      memoryFallbackBlockedInProduction,
    ),
    row(
      "RLS owner-scope policy",
      "rls_owner_scope",
      durableStorageReady ? "owner_scoped" : "pending_migration",
      "RLS migration binds customer reads to auth.uid()/velmere_account_id and keeps service-role writes server-only.",
      "RLS enabled + owner select policy + service-role management policy",
      !durableStorageReady && productionMode,
      !durableStorageReady && productionMode,
    ),
    row(
      "Account owner query match",
      "account_owner_query_scope",
      ownerMatches ? "owner_scoped" : "owner_mismatch",
      ownerMatches
        ? `Account delivery request matches owner scope ${hashPrefix(accountId)} without exposing the raw account id.`
        : "Account vault access is blocked until request account, record account and delivery account match server-side.",
      "request account id + record account id + delivery account id",
      !ownerMatches,
      !ownerMatches,
    ),
    row(
      "Delivery receipt row",
      "delivery_receipt_rows",
      receiptDurable && hasReceiptClaims ? "ready" : hasReceiptClaims ? "pending_migration" : "blocked",
      hasReceiptClaims
        ? "Delivery receipt can be written with report/account/entitlement/version claims and redacted customer-safe links."
        : "Delivery receipt is blocked until reportId, accountId, entitlementId and reportVersionHash exist.",
      "velmere_audit_delivery_receipts row + checksum + report claims",
      !hasReceiptClaims,
      !hasReceiptClaims,
    ),
    row(
      "Download token consumption ledger",
      "download_token_consumption_ledger",
      tokenFresh ? "ready" : tokenConsumed ? "locked" : "blocked",
      tokenFresh
        ? "A one-time token can be consumed after successful PDF stream; replay will be denied by consumed_at/state."
        : tokenConsumed
          ? "Consumed tokens remain locked and cannot be replayed into a second PDF stream."
          : "Token minting remains blocked until the durable token ledger has an unused token nonce.",
      "velmere_audit_report_access_tokens token_hash + state + consumed_at",
      !tokenFresh && !tokenConsumed,
      !tokenFresh,
    ),
    row(
      "Customer-safe locked envelope",
      "customer_safe_error_envelope",
      "locked",
      "Blocked account/PDF delivery returns safe status only; it never exposes raw Supabase rows, token hashes, receipt ids or operator notes.",
      "customer-safe JSON envelope with no private fields",
      false,
      false,
    ),
    row(
      "Operator service-role boundary",
      "operator_service_role_boundary",
      durableStorageReady ? "configured" : "pending_migration",
      "Server/operator writes use service role from server runtime only; browser clients never receive write keys or raw private rows.",
      "service role env on server + no client exposure + RLS policies",
      !durableStorageReady && productionMode,
      !durableStorageReady && productionMode,
    ),
  ];

  const storageReadiness = readiness(rows, (item) => item.family === "durable_storage" || item.family === "production_no_memory_fallback" || item.family === "operator_service_role_boundary");
  const ownerScopeReadiness = readiness(rows, (item) => item.family === "rls_owner_scope" || item.family === "account_owner_query_scope");
  const deliveryReceiptReadiness = readiness(rows, (item) => item.family === "delivery_receipt_rows" || item.family === "download_token_consumption_ledger");
  const productionLockReadiness = readiness(rows);
  const canUseAccountDelivery = !memoryFallbackBlockedInProduction && durableStorageReady && ownerMatches;
  const canMintDownloadToken = canUseAccountDelivery && hasReceiptClaims && tokenFresh;
  const canShowAccountVault = canUseAccountDelivery && !rows.some((item) => item.blocksCustomerDelivery);
  const topBlocker = rows.find((item) => item.blocksCustomerDelivery || item.blocksProPdf)?.label ?? "none";
  const httpStatus: 200 | 403 | 409 | 423 | 503 = memoryFallbackBlockedInProduction ? 503 : !ownerMatches ? 403 : !hasReceiptClaims ? 409 : !tokenFresh ? 423 : 200;

  const customerRows = rows.map((item) => ({
    ...item,
    output: `${item.output} Status: ${publicStatus(locale, item.status)}.`,
    privateOnlyFields: [],
  }));
  const proPdfRows = rows
    .filter((item) => item.family !== "operator_service_role_boundary")
    .map((item) => ({ ...item, privateOnlyFields: [] }));
  const operatorRows = rows.map((item) => ({
    ...item,
    output: `${item.output} Operator check: prod=${productionMode}; storage=${storageSource}; accountHash=${hashPrefix(accountId)}; reportHash=${hashPrefix(reportId)}.`,
  }));

  const customerResponse = canUseAccountDelivery ? null : {
    ok: false as const,
    surface: "account_delivery_production_lock" as const,
    status: memoryFallbackBlockedInProduction ? "storage_required" as const : !ownerMatches ? "owner_mismatch" as const : "locked" as const,
    message: memoryFallbackBlockedInProduction
      ? t(locale, "Dostawa raportu wymaga produkcyjnego storage. Nie tworzymy lokalnej atrapy konta.", "Report-Lieferung benoetigt Produktions-Storage. Kein lokales Konto-Placeholder.", "Report delivery requires production storage. No local account placeholder is created.")
      : !ownerMatches
        ? t(locale, "Ten raport musi byc otwarty z konta, do ktorego zostal przypisany.", "Dieser Report muss aus dem zugeordneten Konto geoeffnet werden.", "This report must be opened from the account it is assigned to.")
        : t(locale, "Dostawa raportu jest zablokowana do czasu potwierdzenia receipt i tokenu.", "Report-Lieferung bleibt bis Receipt und Token bestaetigt sind gesperrt.", "Report delivery is locked until receipt and token are confirmed."),
    nextSafeAction: t(locale, "Otworz raport z centrum konta albo wygeneruj nowy bezpieczny link po platnosci.", "Oeffne den Report im Account Center oder erstelle nach Zahlung einen neuen sicheren Link.", "Open the report from the account center or mint a fresh secure link after payment."),
  };

  return {
    passId: PASS2624_SUPABASE_RLS_ACCOUNT_DELIVERY_PRODUCTION_LOCK_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "account_delivery_production_lock",
    httpStatus,
    summary: {
      productionMode,
      hasSupabaseServiceRoleConfig: supabaseConfigured,
      durableStorageRequired: true,
      memoryFallbackAllowed,
      memoryFallbackBlockedInProduction,
      rlsOwnerScopeRequired: true,
      serviceRoleOnlyWriteRequired: true,
      accountOwnerMatches: ownerMatches,
      canUseAccountDelivery,
      canMintDownloadToken,
      canShowAccountVault,
      storageReadiness,
      ownerScopeReadiness,
      deliveryReceiptReadiness,
      productionLockReadiness,
      topBlocker,
      nextAction: topBlocker === "none" ? "Run Supabase RLS replay fixtures and PDF token consumption tests." : `Resolve ${topBlocker} before customer delivery.`,
    },
    customerRows,
    proPdfRows,
    operatorRows,
    productionLockContract: {
      invariant: "Production account delivery must use durable Supabase storage, owner-scoped RLS, server-only writes, redacted delivery receipts and one-time download-token consumption; memory fallback is fail-closed in production.",
      requiredTables: [
        "velmere_audit_account_messages",
        "velmere_audit_delivery_receipts",
        "velmere_audit_report_access_tokens",
        "velmere_payment_runtime_evidence",
      ],
      rlsPolicy: "Customer select is scoped to auth.uid()/velmere_account_id; service role manages server/operator writes; anonymous public reads are denied.",
      noMemoryFallbackPolicy: "Local memory can support QA only. In NODE_ENV=production, missing Supabase throws VELMERE_AUDIT_DELIVERY_PRODUCTION_SUPABASE_REQUIRED and never creates fake delivery records.",
      tokenConsumptionPolicy: "Download tokens are stored by hash, bound to account/report/entitlement/version and transition issued -> consumed/revoked/expired exactly once.",
      ownerScopePolicy: "Report delivery requires request account, record account, entitlement account and token account to match server-side before PDF/account vault access.",
      doNotExpose: ["service role key", "raw token", "token hash", "raw Supabase row", "owner email", "full wallet", "operator note", "checkout session id"],
    },
    customerResponse,
  };
}

export function validatePass2624AccountDeliveryProductionLockRequest(request: Request, url: URL, input: Pick<BuilderInput, "locale"> = {}) {
  return buildPass2624SupabaseRlsAccountDeliveryProductionLockReport({
    locale: input.locale,
    accountId: url.searchParams.get("accountId") ?? request.headers.get("x-velmere-account-id"),
    requestAccountId: request.headers.get("x-velmere-request-account-id") ?? url.searchParams.get("requestAccountId") ?? url.searchParams.get("accountId"),
    recordAccountId: request.headers.get("x-velmere-record-account-id") ?? url.searchParams.get("recordAccountId") ?? url.searchParams.get("accountId"),
    reportId: url.searchParams.get("reportId") ?? request.headers.get("x-velmere-report-id"),
    entitlementId: url.searchParams.get("entitlementId") ?? request.headers.get("x-velmere-entitlement-id"),
    reportVersionHash: url.searchParams.get("reportVersionHash") ?? request.headers.get("x-velmere-report-version-hash"),
    downloadTokenState: url.searchParams.get("tokenState") ?? request.headers.get("x-velmere-token-state"),
    deliveryReceiptState: url.searchParams.get("deliveryReceiptState") ?? request.headers.get("x-velmere-delivery-receipt-state"),
    storageSource: url.searchParams.get("storageSource") ?? request.headers.get("x-velmere-storage-source"),
  });
}
