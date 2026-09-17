import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { buildCanonicalAuditReport, type AuditTier } from "@/lib/security/audit-canonical-report";
import { resolveCurrentAuditAccess } from "@/lib/security/current-audit-access";
import { fetchOnChainBytecode, SUPPORTED_CHAINS } from "@/lib/security/evm-rpc-fetcher";
import { BENCHMARK_20_CONTRACTS } from "@/lib/security/contract-audit-profiles";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { validateExactObjectKeys, validateOptionalStringFields, validateExactSearchParams } from "@/lib/security/exact-request-boundary";
import { assertSameOriginRequest } from "@/lib/security/api-guard";
import { publicApiError } from "@/lib/security/api-error-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const FIELDS = ["address", "name", "caseRef", "network", "chainId", "tokenSymbol", "website", "docs", "github", "bytecode", "tier", "locale"] as const;
const MAX_BODY_BYTES = 16 * 1024;
const rank = { basic: 0, pro: 1, advanced: 2 } as const;
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: {
    "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff",
  } });
}

/** A regenerated JSON report follows the same current-grant policy as a PDF.
 * Historical case verification never authorizes regeneration or another account.
 * This is NOT a policy change to separately stored historical artifacts.
 */
async function generate(request: NextRequest, input: Record<string, unknown>) {
  const types = validateOptionalStringFields(input, FIELDS);
  if (!types.ok) return types.response;
  const value = (key: typeof FIELDS[number]) => (input[key] as string | undefined)?.trim();
  if (FIELDS.some(key => value(key) && value(key)!.length > (key === "bytecode" ? 262146 : 2048))) {
    return json(413, { ok: false, error: "report_parameter_too_large" });
  }
  const address = value("address") || "";
  const name = value("name") || "Audited Contract";
  const chainId = value("chainId") || "56";
  const caseRef = value("caseRef") || undefined;
  const locale = value("locale") || "en";
  const bytecode = value("bytecode");
  const tierParam = value("tier")?.toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return json(400, { ok: false, error: "invalid_contract_address" });
  if (!["pl", "en", "de"].includes(locale)) return json(400, { ok: false, error: "invalid_report_locale" });
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CHAINS, chainId)) return json(400, { ok: false, error: "unsupported_chain_id" });
  if (tierParam && !Object.prototype.hasOwnProperty.call(rank, tierParam)) return json(400, { ok: false, error: "invalid_audit_tier" });
  if (bytecode && !/^0x(?:[0-9a-fA-F]{2})*$/.test(bytecode)) return json(400, { ok: false, error: "invalid_runtime_bytecode" });
  if (bytecode) return json(409, { ok: false, error: "untrusted_runtime_bytecode_not_exportable" });
  const reference = BENCHMARK_20_CONTRACTS[address.toLowerCase()];
  if (reference && reference.chainId !== chainId) return json(409, { ok: false, error: "reference_profile_chain_mismatch" });

  const account = await resolveRequestAccount(request);
  const access = await resolveCurrentAuditAccess(request, account?.accountId ?? null, caseRef);
  const effectiveTier = (tierParam || access.clientTier) as AuditTier;
  if (rank[effectiveTier] > rank[access.clientTier]) return json(account ? 403 : 401, { ok: false, error: "current_audit_entitlement_required" });

  let effectiveBytecode: string | undefined;
  if (!reference) {
    const rpc = await fetchOnChainBytecode(address, chainId);
    if (rpc.ok && rpc.bytecode) effectiveBytecode = rpc.bytecode;
  }
  const report = buildCanonicalAuditReport({
    reportId: caseRef || `rep_${address.slice(2, 10)}_${Date.now()}`, caseRef,
    locale: locale as "pl" | "en" | "de", contractName: name, contractAddress: address,
    network: SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS].chainName,
    chainId, tokenSymbol: value("tokenSymbol"), websiteUrl: value("website"),
    docsUrl: value("docs"), githubRepo: value("github"), rawBytecode: effectiveBytecode,
  }, effectiveTier);

  // Serialize BEFORE final authorization: the bytes authorized must be the same
  // bytes returned, and expensive serialization cannot move after that check.
  const response = json(200, { ok: true, clientTier: effectiveTier, authorizedMaxTier: access.clientTier, entitlementId: access.entitlementId, report });
  if (effectiveTier !== "basic") {
    const finalAccount = await resolveRequestAccount(request);
    if (!finalAccount || finalAccount.accountId !== account?.accountId) return json(401, { ok: false, error: "current_audit_session_required" });
    const finalAccess = await resolveCurrentAuditAccess(request, finalAccount.accountId, caseRef);
    if (rank[effectiveTier] > rank[finalAccess.clientTier] || finalAccess.entitlementId !== access.entitlementId) return json(403, { ok: false, error: "current_audit_entitlement_required" });
  }
  return response;
}

export async function GET(request: NextRequest) {
  try {
    if (Buffer.byteLength(request.url, "utf8") > MAX_BODY_BYTES) return json(413, { ok: false, error: "report_parameter_too_large" });
    const exact = validateExactSearchParams(request.nextUrl, [...FIELDS, "entitlementId"]);
    if (!exact.ok) return exact.response;
    const input = Object.fromEntries(Object.entries(exact.values).filter(([key, value]) => key !== "entitlementId" && value !== null));
    return await generate(request, input);
  } catch (error) { return publicApiError(error, { route: "/api/audit/report", code: "report_unavailable" }); }
}

export async function POST(request: NextRequest) {
  try {
    const origin = assertSameOriginRequest(request, { allowMissingOrigin: true });
    if (origin) return origin;
    const exactQuery = validateExactSearchParams(request.nextUrl, ["entitlementId"]);
    if (!exactQuery.ok) return exactQuery.response;
    const body = await readBoundedJsonBody<Record<string, unknown>>(request, MAX_BODY_BYTES, { maxDepth: 2 });
    if (!body.ok) return body.response;
    const exact = validateExactObjectKeys(body.value, FIELDS);
    if (!exact.ok) return exact.response;
    return await generate(request, body.value);
  } catch (error) { return publicApiError(error, { route: "/api/audit/report", code: "report_unavailable" }); }
}
