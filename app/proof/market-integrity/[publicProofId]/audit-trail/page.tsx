import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PUBLIC_PROOF_PAGE_METADATA,
  resolvePublicProofAuditTrailPageBoundary,
} from "@/lib/market-integrity/public-proof-page-boundary";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PublicProofAuditTrailPageProps = {
  params: Promise<{ publicProofId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return PUBLIC_PROOF_PAGE_METADATA.history;
}

export default async function PublicMarketIntegrityProofAuditTrailPage({
  params,
}: PublicProofAuditTrailPageProps) {
  const { publicProofId } = await params;
  const pageBoundary = await resolvePublicProofAuditTrailPageBoundary(publicProofId, 50);
  if (!pageBoundary) notFound();
  const { proof: publishedProof, history } = pageBoundary;

  return (
    <main className="min-h-screen bg-velmere-black px-5 py-16 text-white md:px-10">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">Velmère Verify · append-only history</p>
        <h1 className="mt-4 font-serif text-5xl tracking-[-0.05em]">Version history</h1>
        <p className="mt-5 break-all font-mono text-xs text-white/55">chain {publishedProof.chainId} · {publishedProof.contractAddress}</p>
        <ol className="mt-8 grid gap-4">
          {history.map((entry) => (
            <li key={entry.eventDigest} className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{entry.status.replaceAll("_", " ")}</h2>
                <span className="font-mono text-[10px] text-white/45">publication {entry.publicationVersion} · audit {entry.auditVersion}</span>
              </div>
              <dl className="mt-4 grid gap-2 text-xs text-white/60 md:grid-cols-2">
                <div><dt className="text-white/35">Event</dt><dd className="mt-1">{entry.eventKind.replaceAll("_", " ")}</dd></div>
                <div><dt className="text-white/35">Observed</dt><dd className="mt-1"><time dateTime={entry.checkedAt}>{entry.checkedAt}</time></dd></div>
                <div><dt className="text-white/35">Block</dt><dd className="mt-1 break-all font-mono">{entry.checkedBlockNumber} · {entry.checkedBlockHash}</dd></div>
                <div><dt className="text-white/35">Event SHA-256</dt><dd className="mt-1 break-all font-mono">{entry.eventDigest}</dd></div>
                {entry.reportDigest ? <div><dt className="text-white/35">Historical report SHA-256</dt><dd className="mt-1 break-all font-mono">{entry.reportDigest}</dd></div> : null}
              </dl>
            </li>
          ))}
        </ol>
        <a href={publishedProof.canonicalPath} className="mt-8 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm hover:border-velmere-gold/50">Current record</a>
      </section>
    </main>
  );
}
