import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import LuxurySection from "@/components/layout/LuxurySection";
import SquareVlmLaunchControl from "@/components/launch/SquareVlmLaunchControl";
import { Link } from "@/navigation";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/community",
    title: "Community — Velmère",
    description: "Velmère community hub for public reading, gated publishing, moderation and Square research signals.",
  });
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isPl = locale === "pl";
  const isDe = locale === "de";
  const title = isPl ? "Społeczność bez chaosu." : isDe ? "Community ohne Chaos." : "Community without noise.";
  const body = isPl
    ? "Square, research notes i publiczne obserwacje mają działać jak spokojny premium signal room: czytanie publiczne, publikacja gated, moderacja przed ekspozycją i jasna separacja opinii od dowodów."
    : isDe
      ? "Square, Research Notes und öffentliche Beobachtungen funktionieren als ruhiger Premium Signal Room: öffentlich lesbar, Publishing gated, Moderation vor Sichtbarkeit und klare Trennung von Meinung und Evidenz."
      : "Square, research notes and public observations should feel like a calm premium signal room: public reading, gated publishing, moderation before exposure and clear separation between opinion and evidence.";
  const kicker = "COMMUNITY / VELMÈRE";
  const cards = [
    {
      href: "/square",
      title: "Velmère Square",
      body: isPl
        ? "Publiczny feed postów, risk observations i requestów źródeł. Publikacja wymaga konta oraz review."
        : isDe
          ? "Öffentlicher Feed für Posts, Risk Observations und Source Requests. Publishing braucht Account und Review."
          : "Public feed for posts, risk observations and source requests. Publishing requires account access and review.",
    },
    {
      href: "/research-lab",
      title: "Research Lab",
      body: isPl
        ? "Miejsce na dłuższe notatki, methodology i source-bound research bez FOMO."
        : isDe
          ? "Ort für längere Notes, Methodology und source-bound Research ohne FOMO."
          : "Place for longer notes, methodology and source-bound research without FOMO.",
    },
    {
      href: "/market-integrity",
      title: isPl ? "Shield terminal" : isDe ? "Shield Terminal" : "Shield Terminal",
      body: isPl
        ? "Metodologia ryzyka nie jest już osobną ścianą tekstu — source, confidence i luki dowodowe są prowadzone w terminalu Shield."
        : isDe
          ? "Risk Methodology ist keine separate Textwand mehr — Source, Confidence und Evidenzlücken laufen im Shield Terminal."
          : "Risk methodology is no longer a separate text wall — source, confidence and evidence gaps live inside the Shield terminal.",
    },
  ];
  const rails = [
    isPl ? "Public read: gość może czytać wybrane posty bez portfela i bez presji." : isDe ? "Public Read: Gäste können ausgewählte Posts ohne Wallet-Druck lesen." : "Public read: guests can read selected posts without wallet pressure.",
    isPl ? "Gated publish: post wymaga konta, limitu i stanu moderation queue." : isDe ? "Gated Publish: Posts brauchen Account, Rate Limit und Moderation Queue." : "Gated publish: posts require account access, rate limits and moderation queue.",
    isPl ? "Link safety: domeny scamowe, seed phrase bait i prywatne DM-funnele mają być blokowane." : isDe ? "Link Safety: Scam-Domains, Seed-Phrase-Bait und private DM-Funnels werden blockiert." : "Link safety: scam domains, seed-phrase bait and private DM funnels must be blocked.",
    isPl ? "Claim labels: opinion, source request, project update, verified source albo research note." : isDe ? "Claim Labels: Opinion, Source Request, Project Update, Verified Source oder Research Note." : "Claim labels: opinion, source request, project update, verified source or research note.",
  ];

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <LuxurySection className="py-28 md:py-36">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/[0.68]">{kicker}</p>
            <h1 className="mt-6 max-w-4xl font-serif text-[clamp(3.25rem,8vw,7.4rem)] leading-[0.88] tracking-[-0.065em]">{title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.62]">{body}</p>
          </div>
          <div className="rounded-[2rem] border border-white/[0.12] bg-white/[0.025] p-5 md:p-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-white/[0.68]">{isPl ? "Zasady publikacji" : isDe ? "Publishing Regeln" : "Publishing rules"}</p>
            <div className="mt-5 grid gap-3">
              {rails.map((rail, index) => (
                <div key={rail} className="rounded-[1.15rem] border border-white/[0.085] bg-black p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.68]">0{index + 1}</p>
                  <p className="mt-2 text-sm leading-7 text-white/[0.66]">{rail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 overflow-hidden rounded-[2rem] border border-white/[0.12] bg-white/[0.025]">
          {cards.map((item) => (
            <Link key={item.href} href={item.href} className="group grid gap-3 border-b border-white/[0.08] px-5 py-7 transition-colors last:border-b-0 hover:bg-white/[0.035] md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_auto] md:items-center md:gap-8 md:px-7">
              <h2 className="font-serif text-2xl text-white md:text-3xl">{item.title}</h2>
              <p className="max-w-xl text-sm leading-7 text-white/[0.58]">{item.body}</p>
              <ArrowUpRight className="h-5 w-5 text-white/[0.46] transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white" />
            </Link>
          ))}
        </div>
        <SquareVlmLaunchControl locale={locale} surface="community" />
      </LuxurySection>
    </main>
  );
}

/* PASS2805 community reset: public read, gated publish, moderation rails, link safety and claim labels surfaced. */
