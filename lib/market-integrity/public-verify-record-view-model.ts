import type { PublishedPublicProof } from "@/lib/market-integrity/public-proof-publication-resolver";

export function publicVerifyLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function buildPublicVerifyRecordViewModel(
  proof: PublishedPublicProof,
  mode: "summary" | "technical",
) {
  const green = proof.monitoringCurrent
    && (proof.currentStatus === "VERIFIED" || proof.currentStatus === "VERIFIED_AGAIN");
  const historicalReport = !proof.reportCurrent;
  const currentReportDigest = proof.reportCurrent ? proof.reportDigest : null;

  return {
    schemaVersion: "velmere.public-verify-record-view-model.v1" as const,
    green,
    statusLabel: publicVerifyLabel(proof.currentStatus),
    riskLabel: publicVerifyLabel(proof.riskStatus),
    projectLabel: proof.projectName ?? "Canonical contract",
    badge: {
      src: `/api/verify/badge/${proof.publicProofId}`,
      alt: `Velmère Verify: ${publicVerifyLabel(proof.currentStatus)}`,
    },
    report: {
      historical: historicalReport,
      contextHeading: historicalReport ? "Historical report context · withheld as current" : null,
      contextBody: historicalReport
        ? "This report belongs to the version history. Its digest is withheld from the current projection until the displayed deployment is revalidated."
        : null,
      currentDigest: currentReportDigest,
      privateMessage: !historicalReport && !currentReportDigest
        ? "The report is private. This page contains only the durable redacted summary."
        : null,
    },
    technical: mode === "technical",
    links: {
      technical: `${proof.canonicalPath}/verify`,
      history: `${proof.canonicalPath}/audit-trail`,
      search: "/verify",
    },
  } as const;
}
