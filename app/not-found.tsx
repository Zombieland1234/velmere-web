import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-[#08090b] px-6 py-24 text-center text-white"
    >
      <section className="max-w-xl rounded-[1.5rem] border border-white/[0.10] bg-[#090b0e] p-8 shadow-2xl">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-100/[0.72]">404 · Velmère</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-white md:text-6xl">Choose your language.</h1>
        <p className="mt-4 text-sm leading-7 text-white/[0.58]">
          Wybierz język · Sprache wählen · Choose a language
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link className="rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white hover:border-cyan-200/[0.24]" href="/pl/market-integrity">
            Polski
          </Link>
          <Link className="rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white hover:border-cyan-200/[0.24]" href="/de/market-integrity">
            Deutsch
          </Link>
          <Link className="rounded-full border border-cyan-200/[0.20] bg-cyan-300/[0.06] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-50" href="/en/market-integrity">
            English
          </Link>
        </div>
      </section>
    </main>
  );
}
