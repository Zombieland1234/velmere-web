import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  buildCanonicalAuditReport,
  type AuditTier,
} from "@/lib/security/audit-canonical-report";
import CanonicalAuditReportView from "@/components/security/CanonicalAuditReportView";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";

import { headers } from "next/headers";
import { resolveRequestAccount, hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";
import { verifyVlmPaidAccountEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import { fetchOnChainBytecode, SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/security/evm-rpc-fetcher";
import { BENCHMARK_20_CONTRACTS } from "@/lib/security/contract-audit-profiles";

export default async function CanonicalAuditReportPageRoute(props: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    tier?: string;
    address?: string;
    name?: string;
    network?: string;
    chainId?: string;
    tokenSymbol?: string;
    website?: string;
    docs?: string;
    github?: string;
    bytecode?: string;
  }>;
}) {
  const { locale, id } = await props.params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const sp = await props.searchParams;

  const rawTarget = (sp?.address || id || "").trim();
  const isBtcQuery = rawTarget.toLowerCase() === "btc" || rawTarget.toLowerCase().includes("bitcoin") || sp?.name?.toLowerCase().includes("bitcoin");
  const address = isBtcQuery
    ? "btc"
    : (sp?.address || (/^0x[a-fA-F0-9]{40}$/.test(id) ? id : "0x1234567890123456789012345678901234567890"));

  const isBenchmark = Boolean(BENCHMARK_20_CONTRACTS[address.toLowerCase()]);
  let clientTier: AuditTier = "basic";

  if (isBenchmark) {
    if (sp?.tier === "advanced") clientTier = "advanced";
    else if (sp?.tier === "pro") clientTier = "pro";
    else clientTier = "basic";
  } else {
    // Non-benchmark target: Hostile Audit Security Invariant - Strictly verify server-side entitlement
    const reqHeaders = await headers();
    const mockReq = new Request("https://velmere.internal/audit", {
      headers: reqHeaders,
    });
    const account = await resolveRequestAccount(mockReq);
    if (account?.accountId) {
      const caseRef = id.startsWith("AUD-") ? id : undefined;
      if (caseRef) {
        const caseRecord = await getAuditCaseForOwningAccount({ caseRef, accountId: account.accountId });
        if (caseRecord.ok && caseRecord.record?.entitlementVerified && caseRecord.record?.tier) {
          if (caseRecord.record.tier === "advanced") clientTier = "advanced";
          else if (caseRecord.record.tier === "pro") clientTier = "pro";
        }
      }
      if (clientTier === "basic") {
        const accountIdHash = hashVelmereAccountBinding(account.accountId);
        const advCheck = await verifyVlmPaidAccountEntitlement({
          productId: "vlm_advanced_audit_human_review",
          context: { accountIdHash, auditCaseRef: caseRef },
        });
        if (advCheck.ok && advCheck.entitlement) {
          clientTier = "advanced";
        } else {
          const proCheck = await verifyVlmPaidAccountEntitlement({
            productId: "vlm_pro_audit_review",
            context: { accountIdHash, auditCaseRef: caseRef },
          });
          if (proCheck.ok && proCheck.entitlement) {
            clientTier = "pro";
          }
        }
      }
    }
    // If client has higher entitlement but requested a lower tier view (e.g. basic preview):
    if (sp?.tier === "basic") {
      clientTier = "basic";
    } else if (sp?.tier === "pro" && clientTier === "advanced") {
      clientTier = "pro";
    }
  }

  const name = isBtcQuery ? "Bitcoin Core" : (sp?.name || "Audited Contract");
  const tokenSymbol = isBtcQuery ? "BTC" : sp?.tokenSymbol;
  const websiteUrl = isBtcQuery ? (sp?.website || "https://bitcoin.org") : sp?.website;
  const docsUrl = isBtcQuery ? (sp?.docs || "https://bitcoin.org/bitcoin.pdf") : sp?.docs;
  const githubRepo = isBtcQuery ? (sp?.github || "https://github.com/bitcoin/bitcoin") : sp?.github;
  const chainId = sp?.chainId || (isBtcQuery ? "0" : "56");
  const network = sp?.network || (isBtcQuery ? "Bitcoin Mainnet" : SUPPORTED_CHAINS[chainId as SupportedChainId]?.chainName || "BNB Smart Chain (BSC)");

  let effectiveBytecode = sp?.bytecode;
  if (!effectiveBytecode && !isBtcQuery && /^0x[a-fA-F0-9]{40}$/.test(address) && !BENCHMARK_20_CONTRACTS[address.toLowerCase()]) {
    const rpcResult = await fetchOnChainBytecode(address, chainId);
    if (rpcResult.ok && rpcResult.bytecode) {
      effectiveBytecode = rpcResult.bytecode;
    }
  }

  const report = buildCanonicalAuditReport(
    {
      reportId: id,
      caseRef: id.startsWith("AUD-") ? id : undefined,
      locale: (locale === "pl" || locale === "de" ? locale : "en"),
      contractName: name,
      contractAddress: address,
      network,
      chainId,
      tokenSymbol,
      websiteUrl,
      docsUrl,
      githubRepo,
      rawBytecode: effectiveBytecode,
    },
    clientTier,
  );

  const pdfDownloadUrl = `/api/audit/report-pdf?address=${encodeURIComponent(
    report.target.contractAddress,
  )}&name=${encodeURIComponent(report.target.contractName)}&caseRef=${encodeURIComponent(
    report.reportId,
  )}&tier=${encodeURIComponent(clientTier)}&locale=${encodeURIComponent(locale)}`;

  return (
    <main className="velmere-public-page min-h-screen bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36">
      <div className="mx-auto max-w-6xl mb-8">
        <Link
          href={`/${locale}/security/audits`}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/[0.66] transition hover:border-white/[0.22] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{locale === "pl" ? "Wróć do Centrum Audytu" : locale === "de" ? "Zurück zum Audit-Hub" : "Back to Audit Hub"}</span>
        </Link>
      </div>

      <CanonicalAuditReportView
        report={report}
        pdfDownloadUrl={pdfDownloadUrl}
      />
    </main>
  );
}
