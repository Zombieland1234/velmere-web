import type { NextRequest } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { resolveCurrentAuditAccess } from "./current-audit-access";
import { SUPPORTED_CHAINS } from "./evm-rpc-fetcher";
import { BENCHMARK_20_CONTRACTS } from "./contract-audit-profiles";
import { MASTER_50_ASSETS } from "./corpus/master-50-assets";
import { validateOptionalStringFields } from "./exact-request-boundary";
import { reserveCustomerRuntimeRequest } from "./customer-runtime-resource-guard";
import { buildCustomerAuditReport } from "./customer-audit-pipeline";
import type { AuditTier, FullAuditReportInput } from "./audit-canonical-report";

export const CUSTOMER_REPORT_FIELDS = ["address", "assetId", "name", "caseRef", "network", "chainId", "tokenSymbol", "website", "docs", "github", "bytecode", "tier", "locale", "analysisMode"] as const;
export class CustomerReportRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly response?: Response) { super(code); }
}
const rank = { basic: 0, pro: 1, advanced: 2 } as const;

/** Only exact identifiers. Name/symbol/substring matching is not target identity. */
export function normalizeCustomerReportInput(input: Record<string, unknown>): {
  target: Omit<FullAuditReportInput, "reportId">; requestedTier?: AuditTier; analysisMode: "reference" | "runtime";
} {
  const types = validateOptionalStringFields(input, CUSTOMER_REPORT_FIELDS);
  if (!types.ok) throw new CustomerReportRequestError(400, "invalid_body_field_type");
  const value = (key: typeof CUSTOMER_REPORT_FIELDS[number]) => (input[key] as string | undefined)?.trim();
  if (CUSTOMER_REPORT_FIELDS.some(key => (value(key)?.length ?? 0) > (key === "bytecode" ? 262146 : 2048))) throw new CustomerReportRequestError(413, "report_parameter_too_large");
  const code = value("bytecode");
  if (code && !/^0x(?:[a-f0-9]{2})*$/i.test(code)) throw new CustomerReportRequestError(400, "invalid_runtime_bytecode");
  if (code) throw new CustomerReportRequestError(409, "untrusted_runtime_bytecode_not_exportable");
  const locale = value("locale") || "en";
  if (!["pl", "en", "de"].includes(locale)) throw new CustomerReportRequestError(400, "invalid_report_locale");
  const requested = value("tier")?.toLowerCase();
  if (requested && !Object.prototype.hasOwnProperty.call(rank, requested)) throw new CustomerReportRequestError(400, "invalid_audit_tier");
  const requestedMode = value("analysisMode");
  if (requestedMode && !["reference", "runtime"].includes(requestedMode)) throw new CustomerReportRequestError(400, "invalid_analysis_mode");
  const identifier = (value("assetId") || "").toLowerCase();
  const match = identifier ? MASTER_50_ASSETS.filter(a => a.assetId.toLowerCase() === identifier || a.address.toLowerCase() === identifier || a.symbol.toLowerCase() === identifier) : [];
  if (identifier && match.length !== 1) throw new CustomerReportRequestError(400, match.length ? "ambiguous_asset_identifier" : "unknown_asset_identifier");
  const asset = match[0];
  const explicitAddress = value("address")?.toLowerCase();
  if (asset && explicitAddress && asset.address.toLowerCase() !== explicitAddress) throw new CustomerReportRequestError(409, "asset_address_mismatch");
  const address = explicitAddress || asset?.address.toLowerCase() || "";
  if (!address) throw new CustomerReportRequestError(400, "invalid_contract_address");
  const evm = /^0x[a-f0-9]{40}$/.test(address);
  const exactCatalog = asset ?? MASTER_50_ASSETS.find(a => a.address.toLowerCase() === address);
  if (!evm && (!exactCatalog || address.startsWith("0x"))) throw new CustomerReportRequestError(400, "invalid_contract_address");
  const reference = evm ? BENCHMARK_20_CONTRACTS[address] : undefined;
  const chainId = value("chainId") || asset?.chainId || reference?.chainId || exactCatalog?.chainId || "56";
  if (evm && !Object.prototype.hasOwnProperty.call(SUPPORTED_CHAINS, chainId)) throw new CustomerReportRequestError(400, "unsupported_chain_id");
  if (asset && asset.chainId !== chainId) throw new CustomerReportRequestError(409, "asset_chain_mismatch");
  // The same address may hold unrelated bytecode on another supported chain.
  // Runtime mode must analyze the explicitly requested chain, not force a profile.
  if (reference && reference.chainId !== chainId && requestedMode !== "runtime") throw new CustomerReportRequestError(409, "reference_profile_chain_mismatch");
  if (!evm && exactCatalog?.chainId !== chainId) throw new CustomerReportRequestError(409, "asset_chain_mismatch");
  const mode = (requestedMode || ((reference || exactCatalog) ? "reference" : "runtime")) as "reference" | "runtime";
  if (mode === "reference" && !reference && !exactCatalog) throw new CustomerReportRequestError(400, "unknown_reference_target");
  if (mode === "runtime" && !evm) throw new CustomerReportRequestError(400, "unsupported_non_evm_runtime_analysis");
  const name = value("name") || asset?.name || "Audited Contract";
  return { requestedTier: requested as AuditTier | undefined, analysisMode: mode, target: {
    contractAddress: address, contractName: name,
    chainId, network: evm ? SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS].chainName : exactCatalog!.network,
    locale: locale as "pl" | "en" | "de", tokenSymbol: value("tokenSymbol") || asset?.symbol,
    caseRef: value("caseRef") || undefined,
  } };
}

/** The same policy applies to SSR, JSON and PDF, including known reference addresses. */
export async function prepareCustomerReport(request: NextRequest, input: Record<string, unknown>, reportId?: string) {
  const normalized = normalizeCustomerReportInput(input);
  const account = await resolveRequestAccount(request);
  const access = await resolveCurrentAuditAccess(request, account?.accountId ?? null, normalized.target.caseRef);
  const tier = normalized.requestedTier ?? access.clientTier;
  if (rank[tier] > rank[access.clientTier]) throw new CustomerReportRequestError(account ? 403 : 401, "current_audit_entitlement_required");
  const reservation = normalized.analysisMode === "runtime"
    ? await reserveCustomerRuntimeRequest(request) : { ok: true as const, release: () => undefined };
  if (!reservation.ok) throw new CustomerReportRequestError(reservation.response.status, "runtime_resource_gate_denied", reservation.response);
  const report = await (async () => { try { return await buildCustomerAuditReport({ ...normalized.target,
    reportId: reportId ?? normalized.target.caseRef ?? `rep_${normalized.target.contractAddress.slice(0, 18)}_${Date.now()}`,
    analysisMode: normalized.analysisMode,
  }, tier, request.signal); } finally { reservation.release(); } })();
  /** Call after serialization/render. Never authorize with a historical case boolean. */
  async function authorizeDelivery() {
    if (request.signal.aborted) throw new CustomerReportRequestError(400, "request_aborted");
    if (tier === "basic") return;
    const finalAccount = await resolveRequestAccount(request);
    if (!finalAccount || finalAccount.accountId !== account?.accountId) throw new CustomerReportRequestError(401, "current_audit_session_required");
    const finalAccess = await resolveCurrentAuditAccess(request, finalAccount.accountId, normalized.target.caseRef);
    if (rank[tier] > rank[finalAccess.clientTier] || finalAccess.entitlementId !== access.entitlementId) throw new CustomerReportRequestError(403, "current_audit_entitlement_required");
  }
  return { report, tier, authorizedMaxTier: access.clientTier, entitlementId: access.entitlementId, authorizeDelivery };
}
