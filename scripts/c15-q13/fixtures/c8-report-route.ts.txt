import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import {
  buildCanonicalAuditReport,
  type AuditTier,
} from "@/lib/security/audit-canonical-report";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { verifyVlmPaidSurfaceEntitlementById } from "@/lib/commerce/vlm-paid-surface-guard";
import { verifyVlmPaidAccountEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { fetchOnChainBytecode } from "@/lib/security/evm-rpc-fetcher";
import { BENCHMARK_20_CONTRACTS } from "@/lib/security/contract-audit-profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Server-side entitlement resolution:
 * Determines what tier the requesting client is authorized to receive.
 * Defaults to "basic" if no paid entitlement is verified.
 */
async function resolveClientAuditTier(
  request: NextRequest,
  accountId: string | null,
  caseRef?: string,
): Promise<{ clientTier: AuditTier; entitlementId?: string }> {
  // If no account, client can only receive basic
  if (!accountId) {
    return { clientTier: "basic" };
  }

  const entitlementHeader = request.headers.get("x-velmere-entitlement-id")?.trim();
  const searchParams = request.nextUrl.searchParams;
  const entitlementId = entitlementHeader || searchParams.get("entitlementId")?.trim();

  if (!entitlementId) {
    // Check if case is registered and verified on server
    if (caseRef) {
      const caseRecord = await getAuditCaseForOwningAccount({ caseRef, accountId });
      if (caseRecord.ok && caseRecord.record) {
        if (caseRecord.record.entitlementVerified && caseRecord.record.tier) {
          if (caseRecord.record.tier === "advanced") return { clientTier: "advanced" };
          if (caseRecord.record.tier === "pro") return { clientTier: "pro" };
        }
      }
    }
    // Check if account has an active server entitlement in ledger
    const accountIdHash = hashVelmereAccountBinding(accountId);
    const advCheck = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_advanced_audit_human_review",
      context: { accountIdHash, auditCaseRef: caseRef },
    });
    if (advCheck.ok && advCheck.entitlement) {
      return { clientTier: "advanced", entitlementId: advCheck.entitlement.id };
    }
    const proCheck = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_pro_audit_review",
      context: { accountIdHash, auditCaseRef: caseRef },
    });
    if (proCheck.ok && proCheck.entitlement) {
      return { clientTier: "pro", entitlementId: proCheck.entitlement.id };
    }
    return { clientTier: "basic" };
  }

  // Verify paid entitlement via system policy guard
  const entitlementCheck = await verifyVlmPaidSurfaceEntitlementById({
    policyId: "audit_pdf_download",
    entitlementId,
    allowedProductIds: ["vlm_pro_audit_review", "vlm_advanced_audit_human_review"],
    accountIdHash: hashVelmereAccountBinding(accountId),
    auditCaseRef: caseRef,
  });

  if (entitlementCheck.ok && entitlementCheck.entitlement) {
    const isAdvanced = entitlementCheck.entitlement.productId === "vlm_advanced_audit_human_review";
    return {
      clientTier: isAdvanced ? "advanced" : "pro",
      entitlementId,
    };
  }

  return { clientTier: "basic" };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const address = url.searchParams.get("address")?.trim() || "";
  const name = url.searchParams.get("name")?.trim() || "Audited Contract";
  const caseRef = url.searchParams.get("caseRef")?.trim() || undefined;
  const network = url.searchParams.get("network")?.trim() || "BNB Smart Chain (BSC)";
  const chainId = url.searchParams.get("chainId")?.trim() || "56";
  const tokenSymbol = url.searchParams.get("tokenSymbol")?.trim() || undefined;
  const website = url.searchParams.get("website")?.trim() || undefined;
  const docs = url.searchParams.get("docs")?.trim() || undefined;
  const github = url.searchParams.get("github")?.trim() || undefined;
  const bytecode = url.searchParams.get("bytecode")?.trim() || undefined;
  const requestedTierParam = url.searchParams.get("tier")?.trim()?.toLowerCase();
  const locale = (url.searchParams.get("locale")?.trim() || "en") as "pl" | "en" | "de";

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return json(400, { ok: false, error: "invalid_contract_address" });
  }

  const account = await resolveRequestAccount(request);
  const { clientTier, entitlementId } = await resolveClientAuditTier(
    request,
    account?.accountId ?? null,
    caseRef,
  );

  // If the client requested previewing a lower tier than their entitlement (e.g. basic view), respect it:
  const effectiveTier: AuditTier = (requestedTierParam === "basic")
    ? "basic"
    : (requestedTierParam === "pro" && clientTier === "advanced")
      ? "pro"
      : clientTier;

  let effectiveBytecode = bytecode;
  if (!effectiveBytecode && !BENCHMARK_20_CONTRACTS[address.toLowerCase()]) {
    const rpcResult = await fetchOnChainBytecode(address, chainId);
    if (rpcResult.ok && rpcResult.bytecode) {
      effectiveBytecode = rpcResult.bytecode;
    }
  }

  const reportId = caseRef || `rep_${address.slice(2, 10)}_${Date.now()}`;

  const report = buildCanonicalAuditReport(
    {
      reportId,
      caseRef,
      locale,
      contractName: name,
      contractAddress: address,
      network,
      chainId,
      tokenSymbol,
      websiteUrl: website,
      docsUrl: docs,
      githubRepo: github,
      rawBytecode: effectiveBytecode,
    },
    effectiveTier,
  );

  return json(200, {
    ok: true,
    clientTier: effectiveTier,
    authorizedMaxTier: clientTier,
    entitlementId,
    report,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "Audited Contract";
    const caseRef = typeof body.caseRef === "string" ? body.caseRef.trim() : undefined;
    const network = typeof body.network === "string" ? body.network.trim() : "BNB Smart Chain (BSC)";
    const chainId = typeof body.chainId === "string" ? body.chainId.trim() : "56";
    const tokenSymbol = typeof body.tokenSymbol === "string" ? body.tokenSymbol.trim() : undefined;
    const website = typeof body.website === "string" ? body.website.trim() : undefined;
    const docs = typeof body.docs === "string" ? body.docs.trim() : undefined;
    const github = typeof body.github === "string" ? body.github.trim() : undefined;
    const bytecode = typeof body.bytecode === "string" ? body.bytecode.trim() : undefined;
    const requestedTierParam = typeof body.tier === "string" ? body.tier.trim().toLowerCase() : undefined;
    const locale = (body.locale === "pl" || body.locale === "de" ? body.locale : "en") as "pl" | "en" | "de";

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return json(400, { ok: false, error: "invalid_contract_address" });
    }

    const account = await resolveRequestAccount(request);
    const { clientTier, entitlementId } = await resolveClientAuditTier(
      request,
      account?.accountId ?? null,
      caseRef,
    );

    const effectiveTier: AuditTier = (requestedTierParam === "basic")
      ? "basic"
      : (requestedTierParam === "pro" && clientTier === "advanced")
        ? "pro"
        : clientTier;

    let effectiveBytecode = bytecode;
    if (!effectiveBytecode && !BENCHMARK_20_CONTRACTS[address.toLowerCase()]) {
      const rpcResult = await fetchOnChainBytecode(address, chainId);
      if (rpcResult.ok && rpcResult.bytecode) {
        effectiveBytecode = rpcResult.bytecode;
      }
    }

    const reportId = caseRef || `rep_${address.slice(2, 10)}_${Date.now()}`;

    const report = buildCanonicalAuditReport(
      {
        reportId,
        caseRef,
        locale,
        contractName: name,
        contractAddress: address,
        network,
        chainId,
        tokenSymbol,
        websiteUrl: website,
        docsUrl: docs,
        githubRepo: github,
        rawBytecode: effectiveBytecode,
      },
      effectiveTier,
    );

    return json(200, {
      ok: true,
      clientTier: effectiveTier,
      authorizedMaxTier: clientTier,
      entitlementId,
      report,
    });
  } catch (err) {
    return json(400, { ok: false, error: "malformed_request_body" });
  }
}

