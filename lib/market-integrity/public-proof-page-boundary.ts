import {
  resolvePublishedPublicProof,
  resolvePublishedPublicProofHistory,
  type PublishedPublicProof,
  type PublishedPublicProofHistoryEntry,
} from "@/lib/market-integrity/public-proof-publication-resolver";

export const PUBLIC_PROOF_PAGE_METADATA = {
  summary: {
    title: "Velmère Public Proof",
    description: "Current Velmère Verify status for an exact canonical chain and contract identity.",
    robots: { index: false, follow: false, noarchive: true },
  },
  technical: {
    title: "Velmère Proof Verification",
    description: "Technical Velmère Verify projection bound to exact deployment and event-chain digests.",
    robots: { index: false, follow: false, noarchive: true },
  },
  history: {
    title: "Velmère Proof Audit Trail",
    description: "Append-only public Velmère Verify status and revalidation history.",
    robots: { index: false, follow: false, noarchive: true },
  },
} as const;

export type PublicProofPageBoundaryDependencies = {
  resolveProof?: (publicProofId: string) => Promise<PublishedPublicProof | null>;
  resolveHistory?: (
    publicProofId: string,
    limit: number,
  ) => Promise<PublishedPublicProofHistoryEntry[]>;
};

export async function resolvePublicProofRecordPageBoundary(
  publicProofId: string,
  dependencies: PublicProofPageBoundaryDependencies = {},
) {
  const resolveProof = dependencies.resolveProof ?? resolvePublishedPublicProof;
  return resolveProof(publicProofId);
}

export async function resolvePublicProofAuditTrailPageBoundary(
  publicProofId: string,
  limit = 50,
  dependencies: PublicProofPageBoundaryDependencies = {},
) {
  const resolveProof = dependencies.resolveProof ?? resolvePublishedPublicProof;
  const resolveHistory = dependencies.resolveHistory ?? resolvePublishedPublicProofHistory;
  const proof = await resolveProof(publicProofId);
  if (!proof) return null;
  const history = await resolveHistory(publicProofId, limit);
  if (!history.length || history[0]?.eventDigest !== proof.headEventDigest) return null;
  return { proof, history } as const;
}
