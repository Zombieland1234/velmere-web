import { NextRequest, NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import {
  buildCanonicalAuditReport,
  renderCanonicalReportToPdf,
  type AuditTier,
} from "@/lib/security/audit-canonical-report";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { verifyVlmPaidSurfaceEntitlementById } from "@/lib/commerce/vlm-paid-surface-guard";
import { verifyVlmPaidAccountEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { buildExactCustomerPdfDelivery } from "@/lib/reporting/exact-customer-pdf-delivery";
import { fetchOnChainBytecode } from "@/lib/security/evm-rpc-fetcher";
import { BENCHMARK_20_CONTRACTS } from "@/lib/security/contract-audit-profiles";
import { MASTER_50_AUDITS } from "@/lib/security/master-50-audits";
import { MASTER_50_ASSETS } from "@/lib/security/corpus/master-50-assets";

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

async function resolveClientAuditTier(
  request: NextRequest,
  accountId: string | null,
  caseRef?: string,
): Promise<{ clientTier: AuditTier; entitlementId?: string }> {
  if (!accountId) {
    return { clientTier: "basic" };
  }

  const entitlementHeader = request.headers.get("x-velmere-entitlement-id")?.trim();
  const searchParams = request.nextUrl.searchParams;
  const entitlementId = entitlementHeader || searchParams.get("entitlementId")?.trim();

  if (!entitlementId) {
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
  try {
    const url = request.nextUrl;
    const assetId = url.searchParams.get("assetId")?.trim();
    let address = url.searchParams.get("address")?.trim() || "";
    let name = url.searchParams.get("name")?.trim();
    const caseRef = url.searchParams.get("caseRef")?.trim() || undefined;
    let network = url.searchParams.get("network")?.trim();
    let chainId = url.searchParams.get("chainId")?.trim();
    let tokenSymbol = url.searchParams.get("tokenSymbol")?.trim() || undefined;
    const website = url.searchParams.get("website")?.trim() || undefined;
    const docs = url.searchParams.get("docs")?.trim() || undefined;
    const github = url.searchParams.get("github")?.trim() || undefined;
    const bytecode = url.searchParams.get("bytecode")?.trim() || undefined;
    const disposition = url.searchParams.get("disposition") === "preview" ? "inline" : "attachment";
    const requestedTierParam = url.searchParams.get("tier")?.trim()?.toLowerCase();
    const locale = (url.searchParams.get("locale")?.trim() || "en") as "pl" | "en" | "de";

    // Look up in MASTER_50_ASSETS if assetId or address provided
    const idClean = (assetId || address || "").toLowerCase().trim();
    const idAlpha = idClean.replace(/[^a-z0-9]/g, "");
    const corpusMatch = MASTER_50_ASSETS.find((a) => {
      const aId = a.assetId.toLowerCase();
      const aSym = a.symbol.toLowerCase();
      const aSymAlpha = aSym.replace(/[^a-z0-9]/g, "");
      const aAddr = a.address.toLowerCase();
      const aName = a.name.toLowerCase();

      return (
        aId === idClean ||
        aSym === idClean ||
        aSymAlpha === idAlpha ||
        aAddr === idClean ||
        aId.includes(idClean) ||
        (idAlpha.length >= 2 && aSymAlpha.includes(idAlpha)) ||
        aName.includes(idClean) ||
        (idClean.length >= 3 && aName.includes(idClean))
      );
    });

    if (corpusMatch) {
      if (!address) address = corpusMatch.address;
      if (!name) name = corpusMatch.name;
      if (!network) network = corpusMatch.network;
      if (!chainId) chainId = corpusMatch.chainId;
      if (!tokenSymbol) tokenSymbol = corpusMatch.symbol;
    }

    if (!address) {
      if (assetId || tokenSymbol || name) {
        const fallbackSlug = (tokenSymbol || name || assetId || "asset").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        address = `vlm:asset:${fallbackSlug}`;
      } else {
        return json(400, { ok: false, error: "invalid_contract_address" });
      }
    }

    name = name || "Audited Asset";
    network = network || "BNB Smart Chain (BSC)";
    chainId = chainId || "56";

    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);

    const account = await resolveRequestAccount(request);
    const { clientTier } = await resolveClientAuditTier(
      request,
      account?.accountId ?? null,
      caseRef,
    );

    const isBenchmark = Boolean(
      BENCHMARK_20_CONTRACTS[address.toLowerCase()] ||
      MASTER_50_AUDITS[address.toLowerCase()]
    );

    let effectiveTier: AuditTier = clientTier;
    if (isBenchmark && (requestedTierParam === "pro" || requestedTierParam === "advanced" || requestedTierParam === "basic")) {
      effectiveTier = requestedTierParam;
    } else if (requestedTierParam === "basic") {
      effectiveTier = "basic";
    } else if (requestedTierParam === "pro" && clientTier === "advanced") {
      effectiveTier = "pro";
    }

    let effectiveBytecode = bytecode;
    if (isEvm && !effectiveBytecode && !BENCHMARK_20_CONTRACTS[address.toLowerCase()]) {
      const rpcResult = await fetchOnChainBytecode(address, chainId);
      if (rpcResult.ok && rpcResult.bytecode) {
        effectiveBytecode = rpcResult.bytecode;
      }
    }

    const cleanStem = (tokenSymbol || name || address).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const reportId = caseRef || `rep_${cleanStem.slice(0, 16)}_${Date.now()}`;

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

    const { pdfBytes, pdfDigest, pdfByteLength } = renderCanonicalReportToPdf(report);

    const delivery = buildExactCustomerPdfDelivery({
      pdfBytes,
      expectedPdfSha256: pdfDigest,
      disposition,
      filenameStem: `${report.target.contractName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}-${effectiveTier}-audit`,
      fallbackStem: `velmere-${effectiveTier}-audit`,
    });

    return new NextResponse(delivery.bytes as BodyInit, {
      status: 200,
      headers: {
        ...delivery.headers,
        "cache-control": "private, no-store, max-age=0",
        "content-security-policy": "sandbox",
        "cross-origin-resource-policy": "same-origin",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
        "x-velmere-audit-pdf-tier": effectiveTier,
        "x-velmere-audit-pdf-digest": pdfDigest,
        "x-velmere-audit-report-digest": report.reportDigest,
        "x-velmere-preview-download-parity": "canonical_shared_model",
      },
    });
  } catch (err: any) {
    console.error("[REPORT_PDF_GET_ERROR]", err);
    return json(500, { ok: false, error: err?.message || String(err), stack: err?.stack });
  }
}
