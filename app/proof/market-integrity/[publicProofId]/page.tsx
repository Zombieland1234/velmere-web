import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicVerifyRecord from "@/components/verify/PublicVerifyRecord";
import {
  PUBLIC_PROOF_PAGE_METADATA,
  resolvePublicProofRecordPageBoundary,
} from "@/lib/market-integrity/public-proof-page-boundary";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PublicProofPageProps = {
  params: Promise<{ publicProofId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return PUBLIC_PROOF_PAGE_METADATA.summary;
}

export default async function PublicMarketIntegrityProofPage({
  params,
}: PublicProofPageProps) {
  const { publicProofId } = await params;
  const publishedProof = await resolvePublicProofRecordPageBoundary(publicProofId);
  if (!publishedProof) notFound();
  return <PublicVerifyRecord proof={publishedProof} mode="summary" />;
}
