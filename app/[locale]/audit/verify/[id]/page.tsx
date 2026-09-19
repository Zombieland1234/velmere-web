import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2, FileText, Database, GitCommit, Layers, Lock, Cpu, ExternalLink } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { SUPPORTED_LOCALES } from "@/lib/seo/metadata";
import { verifyLocalPublishedAudit } from "@/lib/security/evidence-vault/public-verification";

export const dynamic = "force-dynamic";

interface VerifyPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Kryptograficzna Weryfikacja Audytu: ${id} — Velmère`,
    description: `Lokalne porównanie bajtów opublikowanych plików z manifestem dla identyfikatora ${id}.`,
  };
}

export default async function AuditVerifyPage({ params }: VerifyPageProps) {
  const { locale, id } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const verification = await verifyLocalPublishedAudit(id);
  if (!verification.ok) notFound();
  const auditId = verification.auditId;
  const target = verification.target;
  const symbol = target.symbol ?? "NOT PROVIDED";
  const name = target.name ?? auditId;
  const chain = target.chain ?? "NOT PROVIDED";
  const contractAddress = target.contractAddress ?? "NOT PROVIDED";
  const blockNumber = target.blockNumber ?? "NOT PROVIDED";
  const commitHash = target.commitHash ?? "NOT PROVIDED";
  const sourceHash = target.sourceHash ?? "NOT PROVIDED";
  const evidenceRoot = verification.evidenceRoot;
  const reportSha256 = verification.reportSha256;
  const engineVersion = verification.engineVersion;
  const createdAt = verification.createdAt;

  return (
    <main className="min-h-screen bg-[#07090e] px-4 py-16 text-white sm:px-8 md:py-24">
      <div className="mx-auto max-w-5xl">
        {/* Navigation & Header */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-mono text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Powrót do strony głównej
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-mono font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            STATUS: LOCAL ARTIFACT DIGESTS MATCH
          </div>
        </div>

        {/* Verification Banner */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-amber-400">
                <ShieldCheck className="h-4 w-4" />
                Porównanie lokalnych plików z opublikowanym manifestem
              </div>
              <h1 className="mt-4 font-serif text-3xl font-light tracking-tight text-white md:text-5xl">
                {name} <span className="text-white/40 font-mono text-2xl">({symbol})</span>
              </h1>
              <p className="mt-2 font-mono text-sm text-white/60">
                Identyfikator Audytu: <span className="text-amber-200">{auditId}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-right">
              <span className="text-[11px] font-mono uppercase tracking-wider text-white/50">Pieczęć Integralności</span>
              <p className="font-mono text-xs font-semibold text-emerald-400">SHA-256 INTEGRITY SEAL</p>
              <p className="mt-1 text-[10px] font-mono text-white/40">[LOCAL DETERMINISTIC MERKLE ROOT]</p>
            </div>
          </div>

          <hr className="my-8 border-white/10" />

          {/* 9 Required Verification Items (Directive v3 Section 76) */}
          <h2 className="mb-6 font-mono text-xs uppercase tracking-widest text-white/50">
            Rejestr Kryteriów Weryfikacyjnych (9 Wskaźników Formalnych)
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 1. Report Hash */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">1. Report Hash Verification</span>
              </div>
              <p className="mt-3 break-all font-mono text-xs text-emerald-400 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {reportSha256}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-emerald-400/80">MATCH: Hash odczytanego pliku PDF zgodny z manifestem</span>
            </div>

            {/* 2. Evidence Root */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">2. Evidence Root Verification</span>
              </div>
              <p className="mt-3 break-all font-mono text-xs text-emerald-400 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {evidenceRoot}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-emerald-400/80">
                MERKLE ROOT RECALCULATION: MATCH WITH READ ARTIFACT BYTES
              </span>
            </div>

            {/* 3. Contract Address */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">3. Target Contract / Asset</span>
              </div>
              <p className="mt-3 break-all font-mono text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {contractAddress}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">Adres zadeklarowany w manifeście; nie sprawdzono on-chain</span>
            </div>

            {/* 4. Chain / Environment */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">4. Chain / Settlement Network</span>
              </div>
              <p className="mt-3 font-mono text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {chain}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">EVM Protocol / Regulated Market Tape</span>
            </div>

            {/* 5. Block Number */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">5. Settlement Block</span>
              </div>
              <p className="mt-3 font-mono text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5">
                Block #{blockNumber}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">Numer bloku zadeklarowany w manifeście</span>
            </div>

            {/* 6. Source Hash */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">6. Source Hash</span>
              </div>
              <p className="mt-3 break-all font-mono text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {sourceHash}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">Hash źródeł zadeklarowany w manifeście</span>
            </div>

            {/* 7. Commit */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <GitCommit className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">7. Repository Commit</span>
              </div>
              <p className="mt-3 font-mono text-xs text-white/90 bg-black/40 p-2.5 rounded-xl border border-white/5">
                {commitHash}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">Git Provenance Revision / Flat Workspace</span>
            </div>

            {/* 8. Engine Version */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-amber-400" />
                <span className="font-mono text-xs uppercase text-white/60">8. Engine Version</span>
              </div>
              <p className="mt-3 font-mono text-xs text-emerald-400 bg-black/40 p-2.5 rounded-xl border border-white/5">
                Velmère Furnace {engineVersion}
              </p>
              <span className="mt-2 inline-block text-[10px] font-mono text-white/40">Wersja zadeklarowana w manifeście; silnika nie uruchomiono</span>
            </div>
          </div>

          {/* 9. Status Banner */}
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">9. Status Końcowy</span>
                <h3 className="mt-1 font-serif text-xl font-medium text-white">
                  LOCAL CONTENT CONSISTENCY: MATCH
                </h3>
                <p className="mt-1 text-xs text-white/60">
                  Data z manifestu: {createdAt} | Zewnętrzna pieczęć czasowa: NOT VERIFIED
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/audit/verify/${encodeURIComponent(auditId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  Surowe API JSON
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Institutional Methodology Disclaimer */}
        <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-xs leading-relaxed text-white/40">
          <p className="font-mono uppercase tracking-wider text-white/60 mb-2">Zastrzeżenie Instytucjonalne Velmère</p>
          Odczytane pliki mają hashe zgodne z opublikowanym manifestem. Jest to lokalna kontrola spójności, a nie dowód niezmienności od daty generacji, autentyczności wystawcy ani poprawności audytu. Nie zweryfikowano podpisu TSA, stanu on-chain, commitu repozytorium ani skuteczności silnika. Zgodne hashe nie oznaczają braku podatności ani zgody na wydanie.
        </div>
      </div>
    </main>
  );
}
