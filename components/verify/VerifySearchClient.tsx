"use client";

import { FormEvent, useState } from "react";
import type { PublishedPublicProof } from "@/lib/market-integrity/public-proof-publication-resolver";

type VerifySearchClientProps = {
  locale: "pl" | "en" | "de";
  copy: {
    identityLegend: string;
    chainLabel: string;
    addressLabel: string;
    projectLegend: string;
    projectLabel: string;
    search: string;
    noResults: string;
    invalid: string;
    current: string;
    reportPrivate: string;
    reportNotCurrent: string;
  };
};

type SearchResponse = {
  schemaVersion?: unknown;
  ok?: unknown;
  results?: unknown;
};

const PUBLIC_PROOF_ID = /^pubidx-[a-f0-9]{48}$/u;

function isPublicProofArray(value: unknown): value is PublishedPublicProof[] {
  return Array.isArray(value) && value.length <= 10 && value.every((item) =>
    Boolean(item)
    && typeof item === "object"
    && !Array.isArray(item)
    && (item as { schemaVersion?: unknown }).schemaVersion === "velmere.verify-public-projection.v1"
    && typeof (item as { publicProofId?: unknown }).publicProofId === "string"
    && PUBLIC_PROOF_ID.test((item as { publicProofId: string }).publicProofId)
    && (item as { canonicalPath?: unknown }).canonicalPath
      === `/proof/market-integrity/${(item as { publicProofId: string }).publicProofId}`);
}

export default function VerifySearchClient({ locale, copy }: VerifySearchClientProps) {
  const [results, setResults] = useState<PublishedPublicProof[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function execute(parameters: URLSearchParams) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/verify/search?${parameters.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
      });
      const payload = await response.json() as SearchResponse;
      if (!response.ok || payload.schemaVersion !== "velmere.verify-public-search.v1"
        || payload.ok !== true || !isPublicProofArray(payload.results)) {
        throw new Error("verify_search_failed");
      }
      setResults(payload.results);
    } catch {
      setResults(null);
      setError(copy.invalid);
    } finally {
      setLoading(false);
    }
  }

  function searchIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const chainId = String(data.get("chainId") ?? "");
    const contractAddress = String(data.get("contractAddress") ?? "");
    void execute(new URLSearchParams({ chainId, contractAddress, limit: "5" }));
  }

  function searchProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const projectName = String(data.get("projectName") ?? "");
    void execute(new URLSearchParams({ projectName, limit: "5" }));
  }

  return (
    <section className="mt-10 grid gap-6" aria-label="Velmère Verify search">
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={searchIdentity} className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-6">
          <fieldset disabled={loading} className="grid gap-4">
            <legend className="text-lg font-semibold">{copy.identityLegend}</legend>
            <label className="grid gap-2 text-sm text-white/70">
              {copy.chainLabel}
              <input name="chainId" required pattern="[1-9][0-9]{0,19}" inputMode="numeric" autoComplete="off" className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-velmere-gold" />
            </label>
            <label className="grid gap-2 text-sm text-white/70">
              {copy.addressLabel}
              <input name="contractAddress" required pattern="0x[a-fA-F0-9]{40}" autoCapitalize="none" autoComplete="off" spellCheck={false} className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 font-mono text-xs text-white outline-none focus:border-velmere-gold" />
            </label>
            <button type="submit" className="rounded-xl bg-velmere-gold px-4 py-3 font-semibold text-black disabled:opacity-50">
              {loading ? "…" : copy.search}
            </button>
          </fieldset>
        </form>

        <form onSubmit={searchProject} className="rounded-[1.6rem] border border-white/[0.10] bg-white/[0.025] p-6">
          <fieldset disabled={loading} className="grid gap-4">
            <legend className="text-lg font-semibold">{copy.projectLegend}</legend>
            <label className="grid gap-2 text-sm text-white/70">
              {copy.projectLabel}
              <input name="projectName" required minLength={2} maxLength={120} autoComplete="off" className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-velmere-gold" />
            </label>
            <button type="submit" className="rounded-xl border border-velmere-gold/40 px-4 py-3 font-semibold text-velmere-gold disabled:opacity-50">
              {loading ? "…" : copy.search}
            </button>
          </fieldset>
        </form>
      </div>

      <div aria-live="polite" aria-busy={loading} className="grid gap-4">
        {error ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-100">{error}</p> : null}
        {results?.length === 0 ? <p className="text-sm text-white/60">{copy.noResults}</p> : null}
        {results?.map((proof) => (
          <article key={proof.publicProofId} className="rounded-[1.6rem] border border-white/[0.10] bg-black/25 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-velmere-gold">{proof.projectName ?? "Canonical contract"}</p>
                <h2 className="mt-2 text-2xl font-semibold">{proof.currentStatus.replaceAll("_", " ")}</h2>
              </div>
              <a href={proof.canonicalPath} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/80 hover:border-velmere-gold/50">
                {copy.current}
              </a>
            </div>
            <p className="mt-4 break-all font-mono text-xs text-white/55">chain {proof.chainId} · {proof.contractAddress}</p>
            <p className="mt-4 text-sm leading-7 text-white/70">{proof.publicSummary}</p>
            <p className="mt-3 text-xs text-white/45">
              {!proof.reportCurrent
                ? copy.reportNotCurrent
                : proof.reportDigest
                  ? `SHA-256 ${proof.reportDigest}`
                  : copy.reportPrivate}
            </p>
          </article>
        ))}
      </div>
      <span hidden data-verify-search-locale={locale} />
    </section>
  );
}
