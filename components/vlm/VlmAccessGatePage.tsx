"use client";

import { AlertTriangle, Archive, ArrowRight, BadgeCheck, HelpCircle, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import Reveal from "@/components/ui/Reveal";
import VlmAccessVisual from "@/components/vlm/VlmAccessVisual";
import VlmBuyAccessPanel from "@/components/vlm/VlmBuyAccessPanel";
import WalletBoundaryExplainer from "@/components/vlm/WalletBoundaryExplainer";
import VlmSelectedSystems from "@/components/vlm/VlmSelectedSystems";
import VlmAppLayerSection from "@/components/vlm/VlmAppLayerSection";

const utilityCards = [
  { icon: KeyRound, title: "Private access", body: "VLM is planned to help identify eligibility for selected drops, archive previews and member-only Square areas." },
  { icon: Archive, title: "Archive layer", body: "Members may receive earlier visibility into archive requests, restocks or editorial notes when the layer is active." },
  { icon: ShieldCheck, title: "Read-only boundary", body: "Wallet connection must never request a seed phrase. Velmère does not take custody of user assets." },
];

const proHeroCopy = {
  en: {
    eyebrow: "VLM / ACCESS BRAIN",
    title: "One calm VLM system, not a split mode.",
    body: "VLM is the unified access brain for wallet boundary, archive routing, Square, drops and Shield research workflows — still read-only until contract, audit and legal review are complete.",
    learn: "Learn About VLM",
    utility: "Read Utility",
    waitlist: "Join Waitlist",
    research: "Research Lab",
    status: "Contract status",
    checks: ["No custody", "No seed phrases", "No price-performance claim"],
  },
  pl: {
    eyebrow: "VLM / ACCESS BRAIN",
    title: "Jeden spokojny system VLM, bez splitu trybów.",
    body: "VLM jest wspólnym mózgiem dostępu dla granicy portfela, archiwum, Square, dropów i workflow Shield — nadal read-only do czasu kontraktu, audytu i review prawnego.",
    learn: "Poznaj VLM",
    utility: "Czytaj utility",
    waitlist: "Dołącz do listy",
    research: "Research Lab",
    status: "Status kontraktu",
    checks: ["Bez custody", "Bez seed phrase", "Bez claimu ceny"],
  },
  de: {
    eyebrow: "VLM / ACCESS BRAIN",
    title: "Ein ruhiges VLM-System ohne Mode-Split.",
    body: "VLM ist der einheitliche Access-Brain für Wallet-Grenze, Archiv-Routing, Square, Drops und Shield Research Workflows — read-only bis Contract, Audit und Legal Review abgeschlossen sind.",
    learn: "VLM verstehen",
    utility: "Utility lesen",
    waitlist: "Warteliste",
    research: "Research Lab",
    status: "Contract Status",
    checks: ["Keine Custody", "Keine Seed Phrase", "Kein Preisperformance-Claim"],
  },
} as const;

const vlmAccessTiers = {
  en: {
    kicker: "Unified VLM",
    title: "One access brain, clear boundaries.",
    body: "VLM connects membership, wallet safety, Square, archive context and Shield research without turning the page into separate mode products.",
    tiers: [
      { name: "Access", value: "member identity", body: "Eligibility, drops and archive visibility stay separated from clothing checkout and never imply market value." },
      { name: "Brain", value: "risk context", body: "VLM routes market claims toward source quality, missing evidence, uncertainty and calm Shield language." },
      { name: "Review", value: "guarded handoff", body: "Deeper review and exports require server-side entitlement, receipts and safe delivery boundaries." },
    ],
  },
  pl: {
    kicker: "Unified VLM",
    title: "Jeden mózg dostępu, jasne granice.",
    body: "VLM łączy membership, bezpieczeństwo portfela, Square, archiwum i research Shield bez robienia z tej strony osobnych trybów produktowych.",
    tiers: [
      { name: "Access", value: "tożsamość membera", body: "Eligibility, dropy i archiwum są oddzielone od checkoutu odzieżowego i nigdy nie sugerują wartości rynkowej." },
      { name: "Brain", value: "kontekst ryzyka", body: "VLM kieruje claimy rynkowe do jakości źródeł, missing evidence, uncertainty i spokojnego języka Shield." },
      { name: "Review", value: "kontrolowany handoff", body: "Głębszy review i export wymagają server-side entitlement, receiptów i bezpiecznej dostawy." },
    ],
  },
  de: {
    kicker: "Unified VLM",
    title: "Ein Access-Brain, klare Grenzen.",
    body: "VLM verbindet Membership, Wallet-Sicherheit, Square, Archiv und Shield Research, ohne diese Seite in getrennte Produktmodi zu trennen.",
    tiers: [
      { name: "Access", value: "Member Identity", body: "Eligibility, Drops und Archiv bleiben vom Clothing Checkout getrennt und implizieren keinen Marktwert." },
      { name: "Brain", value: "Risk Context", body: "VLM routet Markt-Claims zu Source Quality, Missing Evidence, Unsicherheit und ruhiger Shield-Sprache." },
      { name: "Review", value: "Guarded Handoff", body: "Tieferer Review und Exporte brauchen serverseitige Entitlement-Receipts und sichere Delivery." },
    ],
  },
} as const;

const faqs = [
  ["What does VLM unlock?", "VLM is designed as an access layer for selected drops, archive previews, member rooms and Shield research workflows. Availability depends on the active access rules."],
  ["Do I need VLM to buy clothing?", "No. Clothing commerce must remain separate. Public browsing and standard checkout should not require a token."],
  ["Will Velmère ask for my seed phrase?", "Never. Wallet connection must be read-only unless your wallet clearly shows a transaction confirmation."],
  ["Is the contract deployed?", "Use the status section on this page as the source of truth. If contract, chain or audit data is missing, it must remain pending until verified."],
];

const vlmDetailCopy = {
  en: {
    launchKicker: "VLM access status",
    launchTitle: "Clear access before activation.",
    launchBody: "One calm view shows what is available now, what remains protected and what still needs verification.",
    launchMatrix: [
      { label: "Access rules", status: "draft", body: "Define member access depth without market-performance, resale-value or future-benefit claims." },
      { label: "Wallet boundary", status: "guarded", body: "Read-only checks first. No seed phrase, no custody, no hidden transaction language." },
      { label: "Contract/audit", status: "blocked", body: "Contract address, chain, audit and deployment proof stay unpublished until current verification exists." },
      { label: "Shield routing", status: "active", body: "Any market claim is routed to anomaly, source quality, uncertainty and manual review wording." },
    ],
    whatKicker: "What is VLM?",
    whatTitle: "A private access layer, not a market promise.",
    whatBody: "VLM is planned as a member access mechanism around drops, Square, archive features and Shield review lanes. It must not be marketed as a financial product, price claim, regulated security, payout stream or future-benefit claim.",
    utilityKicker: "Utility diagram",
    utilityTitle: "From access to participation.",
    utilityFlow: ["Access", "Drops", "Square", "Rewards", "Future Governance"],
    utilityCards: [
      { title: "Private access", body: "Eligibility for selected drops, archive previews and member-only Square areas can be checked only after the access layer is verified." },
      { title: "Archive layer", body: "Members may receive earlier visibility into archive requests, restocks or editorial notes when the layer is active." },
      { title: "Read-only boundary", body: "Wallet connection must never request a seed phrase. Velmère does not take custody of user assets." },
    ],
    tokenomicsKicker: "Tokenomics",
    tokenomicsTitle: "Plain status only.",
    tokenomics: [
      ["Purpose", "Utility and access concept"],
      ["Sale status", "No public sale enabled in this build"],
      ["Checkout", "Separated from clothing commerce"],
      ["Fees", "Only if technically accurate and legally reviewed"],
      ["Custody", "Non-custodial wallet preview only"],
      ["Value", "No price-performance, liquidity, listing or future-value claim"],
    ],
    contractKicker: "Contract / Chain / Audit Status",
    contractTitle: "Must be verified.",
    contractRows: [
      ["Contract address", "Not published — deployment, verification and audit required"],
      ["Chain", "Not published — network will be shown after verification"],
      ["Audit", "Required before activation"],
      ["Legal review", "Required before any public token functionality"],
    ],
    roadmapKicker: "Roadmap",
    roadmapTitle: "Launch only when ready.",
    roadmap: [
      { step: "01", title: "Concept", body: "Define access rules, account separation and legal boundaries." },
      { step: "02", title: "Review", body: "Complete contract audit, wallet boundary copy and qualified legal review." },
      { step: "03", title: "Private beta", body: "Enable read-only eligibility checks for invited accounts." },
      { step: "04", title: "Activation", body: "Launch only if technical, legal and operational requirements are verified." },
    ],
    riskKicker: "Access principles",
    riskTitle: "VLM connects membership, drops and research.",
    riskBody: "VLM is designed to organize eligibility for selected drops, archive previews, member rooms and Shield workflows. Access rules, supported features and technical status are shown directly in the product. It makes no market-value or uninterrupted-availability claim.",
    faqKicker: "FAQ",
    faqTitle: "Clear answers. No hype.",
    faqs,
  },
  pl: {
    launchKicker: "status dostępu VLM",
    launchTitle: "Jasny dostęp przed aktywacją.",
    launchBody: "Jeden spokojny widok pokazuje, co działa teraz, co pozostaje chronione i co nadal wymaga weryfikacji.",
    launchMatrix: [
      { label: "Zasady dostępu", status: "draft", body: "Określić głębokość dostępu membera bez claimów rynkowych, odsprzedażowych lub przyszłej korzyści." },
      { label: "Granica portfela", status: "guarded", body: "Najpierw odczyt read-only. Bez seed phrase, bez custody, bez ukrytego języka transakcji." },
      { label: "Kontrakt/audyt", status: "blocked", body: "Adres kontraktu, chain, audyt i deployment proof zostają niepubliczne do aktualnej weryfikacji." },
      { label: "Routing Shield", status: "active", body: "Każdy claim rynkowy idzie przez język: anomalia, jakość źródła, niepewność i manual review." },
    ],
    whatKicker: "Czym jest VLM?",
    whatTitle: "Prywatna warstwa dostępu, nie obietnica rynkowa.",
    whatBody: "VLM jest planowany jako mechanizm dostępu memberów do dropów, Square, archiwum i ścieżek review Shield. Nie może być sprzedawany jako produkt finansowy, claim ceny, instrument regulowany, strumień wypłat ani claim przyszłej korzyści.",
    utilityKicker: "Diagram utility",
    utilityTitle: "Od dostępu do uczestnictwa.",
    utilityFlow: ["Dostęp", "Dropy", "Square", "Nagrody", "Future Governance"],
    utilityCards: [
      { title: "Prywatny dostęp", body: "Eligibility dla wybranych dropów, podglądów archiwum i pokoi Square można sprawdzać dopiero po weryfikacji warstwy access." },
      { title: "Warstwa archiwum", body: "Memberzy mogą dostać wcześniejszy podgląd requestów archiwum, restocków albo notatek editorial, gdy warstwa będzie aktywna." },
      { title: "Najpierw granica", body: "Połączenie portfela nigdy nie może prosić o seed phrase. Velmère nie trzyma aktywów użytkownika." },
    ],
    tokenomicsKicker: "Tokenomics",
    tokenomicsTitle: "Tylko prosty status.",
    tokenomics: [
      ["Cel", "Koncepcja utility i access"],
      ["Status sprzedaży", "Publiczna sprzedaż nie jest włączona w tym buildzie"],
      ["Checkout", "Oddzielony od commerce odzieżowego"],
      ["Opłaty", "Tylko jeśli technicznie prawdziwe i prawnie sprawdzone"],
      ["Custody", "Wyłącznie nie-custodial podgląd portfela"],
      ["Wartość", "Bez claimu ceny, płynności, listingu lub przyszłej wartości"],
    ],
    contractKicker: "Status kontraktu / chain / audytu",
    contractTitle: "Musi być zweryfikowane.",
    contractRows: [
      ["Adres kontraktu", "Niepubliczny — wymagany deployment, weryfikacja i audyt"],
      ["Chain", "Niepubliczny — sieć pojawi się po weryfikacji"],
      ["Audyt", "Wymagany przed aktywacją"],
      ["Review prawne", "Wymagane przed jakąkolwiek publiczną funkcją tokena"],
    ],
    roadmapKicker: "Roadmap",
    roadmapTitle: "Start tylko gdy gotowe.",
    roadmap: [
      { step: "01", title: "Koncepcja", body: "Ustalić zasady dostępu, separację konta i granice prawne." },
      { step: "02", title: "Review", body: "Dokończyć audyt kontraktu, copy wallet boundary i kwalifikowane review prawne." },
      { step: "03", title: "Prywatna beta", body: "Włączyć read-only eligibility checks dla zaproszonych kont." },
      { step: "04", title: "Aktywacja", body: "Launch tylko po weryfikacji technicznej, prawnej i operacyjnej." },
    ],
    riskKicker: "Zasady dostępu",
    riskTitle: "VLM łączy membership, dropy i research.",
    riskBody: "VLM porządkuje dostęp do wybranych dropów, podglądów archiwum, pokoi memberów i narzędzi Shield. Aktualne zasady, dostępne funkcje i status techniczny są pokazane bezpośrednio w produkcie. VLM nie gwarantuje wartości rynkowej ani nieprzerwanej dostępności.",
    faqKicker: "FAQ",
    faqTitle: "Jasne odpowiedzi. Bez hype’u.",
    faqs: [
      ["Co daje VLM?", "VLM ma odblokowywać wybrane dropy, podglądy archiwum, pokoje memberów i workflow badawcze Shield zgodnie z aktualnymi zasadami dostępu."],
      ["Czy VLM jest potrzebne do kupowania ubrań?", "Nie. Commerce odzieżowy musi zostać oddzielony. Publiczne przeglądanie i standardowy checkout nie powinny wymagać tokena."],
      ["Czy Velmère poprosi o seed phrase?", "Nigdy. Połączenie portfela musi być read-only, chyba że portfel jasno pokazuje potwierdzenie transakcji."],
      ["Czy kontrakt jest wdrożony?", "Sekcja statusu na tej stronie jest źródłem prawdy. Jeśli brakuje kontraktu, chain albo audytu, status zostaje pending."],
    ],
  },
  de: {
    launchKicker: "VLM Access Status",
    launchTitle: "Klarer Zugang vor Aktivierung.",
    launchBody: "Eine ruhige Ansicht zeigt, was jetzt verfügbar ist, was geschützt bleibt und was noch verifiziert werden muss.",
    launchMatrix: [
      { label: "Access-Regeln", status: "draft", body: "Member-Access-Tiefe definieren, ohne Gewinn, Wiederverkaufswert oder garantierten Zukunftsnutzen zu suggerieren." },
      { label: "Wallet-Grenze", status: "guarded", body: "Zuerst Read-only Checks. Keine Seed Phrase, keine Custody, keine versteckte Transaktionssprache." },
      { label: "Contract/Audit", status: "blocked", body: "Contract-Adresse, Chain, Audit und Deployment Proof bleiben unveröffentlicht bis aktuelle Verifizierung vorliegt." },
      { label: "Shield Routing", status: "active", body: "Jeder Markt-Claim wird zu Anomalie, Source Quality, Unsicherheit und Manual Review geroutet." },
    ],
    whatKicker: "Was ist VLM?",
    whatTitle: "Eine private Access-Ebene, kein Marktversprechen.",
    whatBody: "VLM ist als Member-Access-Mechanismus rund um Drops, Square, Archiv-Features und Shield Review Lanes geplant. Es darf nicht als Finanzprodukt, Preisversprechen, Security, Dividende, Payout-Stream oder sichere zukünftige Leistung vermarktet werden.",
    utilityKicker: "Utility Diagramm",
    utilityTitle: "Von Access zu Teilnahme.",
    utilityFlow: ["Access", "Drops", "Square", "Rewards", "Future Governance"],
    utilityCards: [
      { title: "Privater Access", body: "Eligibility für ausgewählte Drops, Archiv-Previews und Member-only Square-Bereiche erst nach Verifizierung der Access-Ebene." },
      { title: "Archiv-Ebene", body: "Member können früheren Einblick in Archiv-Requests, Restocks oder Editorial Notes erhalten, wenn die Ebene aktiv ist." },
      { title: "Read-only boundary", body: "Wallet-Verbindung darf nie nach Seed Phrase fragen. Velmère verwahrt keine User Assets." },
    ],
    tokenomicsKicker: "Tokenomics",
    tokenomicsTitle: "Nur klarer Status.",
    tokenomics: [
      ["Zweck", "Utility- und Access-Konzept"],
      ["Sale Status", "Kein Public Sale in diesem Build aktiv"],
      ["Checkout", "Getrennt vom Clothing Commerce"],
      ["Fees", "Nur wenn technisch korrekt und rechtlich geprüft"],
      ["Custody", "Nur non-custodial Wallet Preview"],
      ["Wert", "Kein Versprechen von Preis, Liquidität, Listing oder Zukunftswert"],
    ],
    contractKicker: "Contract / Chain / Audit Status",
    contractTitle: "Muss verifiziert werden.",
    contractRows: [
      ["Contract-Adresse", "Nicht veröffentlicht — Deployment, Verifizierung und Audit erforderlich"],
      ["Chain", "Nicht veröffentlicht — Netzwerk wird nach Verifizierung angezeigt"],
      ["Audit", "Vor Aktivierung erforderlich"],
      ["Legal Review", "Vor jeder öffentlichen Token-Funktion erforderlich"],
    ],
    roadmapKicker: "Roadmap",
    roadmapTitle: "Launch nur wenn bereit.",
    roadmap: [
      { step: "01", title: "Konzept", body: "Access-Regeln, Account-Trennung und rechtliche Grenzen definieren." },
      { step: "02", title: "Review", body: "Contract Audit, Wallet Boundary Copy und qualifiziertes Legal Review abschließen." },
      { step: "03", title: "Private Beta", body: "Read-only Eligibility Checks für eingeladene Accounts aktivieren." },
      { step: "04", title: "Aktivierung", body: "Launch nur wenn technische, rechtliche und operative Anforderungen verifiziert sind." },
    ],
    riskKicker: "Access-Prinzipien",
    riskTitle: "VLM verbindet Membership, Drops und Research.",
    riskBody: "VLM organisiert den Zugang zu ausgewählten Drops, Archiv-Previews, Member-Räumen und Shield-Workflows. Aktive Regeln, verfügbare Funktionen und technischer Status werden direkt im Produkt gezeigt. VLM garantiert keinen Marktwert oder ununterbrochene Verfügbarkeit.",
    faqKicker: "FAQ",
    faqTitle: "Klare Antworten. Kein Hype.",
    faqs: [
      ["Was schaltet VLM frei?", "VLM soll ausgewählte Drops, Archiv-Previews, Member-Räume und Shield-Research-Workflows gemäß den aktiven Access-Regeln freischalten."],
      ["Brauche ich VLM, um Kleidung zu kaufen?", "Nein. Clothing Commerce bleibt getrennt. Öffentliches Browsing und Standard-Checkout sollten keinen Token verlangen."],
      ["Fragt Velmère nach meiner Seed Phrase?", "Nie. Wallet-Verbindung muss read-only sein, außer dein Wallet zeigt klar eine Transaktionsbestätigung."],
      ["Ist der Contract deployed?", "Die Status-Sektion auf dieser Seite ist die Quelle der Wahrheit. Wenn Contract, Chain oder Audit fehlen, bleibt der Status pending."],
    ],
  },
} as const;

function UtilityDiagram({ flow }: { flow: readonly string[] }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="rounded-[2rem] border border-white/[0.10] bg-[#0B0B0D] p-4 shadow-velmere-card md:p-6">
      <div className="grid gap-3 md:grid-cols-5">
        {flow.map((item, index) => (
          <motion.div
            key={item}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-velmere-gold">0{index + 1}</p>
            <p className="mt-4 text-lg text-velmere-ivory">{item}</p>
            {index < flow.length - 1 ? (
              <ArrowRight className="absolute -right-6 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-white/[0.20] md:block" />
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function VlmAccessGatePage() {
  const locale = useLocale() as keyof typeof proHeroCopy;
  const proText = proHeroCopy[locale] ?? proHeroCopy.en;
  const tierText = vlmAccessTiers[locale] ?? vlmAccessTiers.en;
  const detailText = vlmDetailCopy[locale] ?? vlmDetailCopy.en;
  const mode = "pro" as const;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <main className="velmere-public-page bg-velmere-black text-velmere-ivory" data-pass2004-vlm-access-page="tokenomics-cards-risk-solid-cyan-polish" data-pass2805-vlm-page="unified-no-basic-pro-hero-split">
      <VlmBuyAccessPanel />
      <section className="luxury-section pt-28 md:pt-32">
          <div className="grid gap-6 pb-16 lg:grid-cols-[0.95fr_0.75fr] lg:items-stretch">
            <Reveal className="velmere-editorial-hero velmere-surface-sheen relative overflow-hidden rounded-[2rem] border border-velmere-gold/[0.18] bg-[#09090A] p-6 text-velmere-ivory shadow-velmere-card md:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(212,175,55,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_42%)]" />
              <div className="relative z-[1]">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-velmere-gold">{proText.eyebrow}</p>
                <h1 className="mt-6 max-w-5xl font-serif text-[clamp(2.75rem,6.5vw,6.4rem)] leading-[0.92] tracking-[-0.045em]">
                  {proText.title}
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-velmere-grey-soft">
                  {proText.body}
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <a href="#what-is-vlm" className="velmere-button-primary">{proText.learn}</a>
                  <a href="#utility" className="velmere-button-secondary">{proText.utility}</a>
                  <Link href="/research-lab" className="velmere-button-secondary">{proText.research}</Link>
                  <Link href="/contact" className="velmere-button-ghost">{proText.waitlist}</Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="rounded-[2rem] border border-white/[0.10] bg-[linear-gradient(150deg,#111113,#080809)] p-4 shadow-velmere-card md:p-6">
              <div className="mb-4 flex items-center justify-between gap-4 px-1">
                <span className="velmere-label text-velmere-gold">{proText.status}</span>
                <LockKeyhole className="h-5 w-5 text-velmere-gold" />
              </div>
              <VlmAccessVisual />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {proText.checks.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.025] px-4 py-3">
                    <BadgeCheck className="h-4 w-4 text-velmere-gold" />
                    <span className="text-sm text-white/[0.70]">{item}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

      <section id="vlm-access-tiers" className="luxury-section pb-20">
        <Reveal className="velmere-surface-sheen luxury-card">
          <p className="velmere-label text-velmere-gold">{tierText.kicker}</p>
          <div className="mt-5 grid gap-7 md:grid-cols-[0.7fr_1.3fr] md:items-end">
            <div>
              <h2 className="font-serif text-4xl leading-[0.94] tracking-[-0.045em] md:text-6xl">{tierText.title}</h2>
              <p className="mt-5 text-sm leading-7 text-velmere-grey-soft">{tierText.body}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {tierText.tiers.map((tier, index) => (
                <div key={tier.name} className="velmere-premium-tile rounded-[1.35rem] border border-white/[0.09] bg-white/[0.025] p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/[0.34]">0{index + 1}</p>
                  <h3 className="mt-4 text-xl text-white">{tier.name}</h3>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-velmere-gold">{tier.value}</p>
                  <p className="mt-3 text-xs leading-6 text-velmere-muted">{tier.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="luxury-section pb-20">
        <Reveal className="velmere-surface-sheen rounded-[2rem] border border-velmere-gold/[0.14] bg-[linear-gradient(145deg,rgba(212,175,55,0.07),rgba(255,255,255,0.025),rgba(34,211,238,0.04))] p-6 shadow-velmere-card md:p-8">
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <p className="velmere-label text-velmere-gold">{detailText.launchKicker}</p>
              <h2 className="mt-5 font-serif text-4xl leading-[0.94] tracking-[-0.045em] md:text-6xl">{detailText.launchTitle}</h2>
              <p className="mt-5 text-sm leading-7 text-velmere-grey-soft">{detailText.launchBody}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {detailText.launchMatrix.map((item) => (
                <article key={item.label} className="velmere-premium-tile rounded-[1.45rem] border border-white/[0.085] bg-black/[0.24] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-white">{item.label}</h3>
                    <span className="rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold">{item.status}</span>
                  </div>
                  <p className="mt-3 text-xs leading-6 text-white/[0.56]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="luxury-section pb-20" data-pass2805-vlm-wallet-boundary="kept-unified-page">
        <WalletBoundaryExplainer variant="full" />
      </section>

      <VlmSelectedSystems mode={mode} />

      <VlmAppLayerSection />

      <section id="what-is-vlm" className="luxury-section pb-20">
        <Reveal className="velmere-surface-sheen luxury-card">
          <p className="velmere-label text-velmere-gold">{detailText.whatKicker}</p>
          <div className="mt-5 grid gap-8 md:grid-cols-[0.75fr_1.25fr] md:items-end">
            <h2 className="font-serif text-4xl leading-[0.94] tracking-[-0.045em] md:text-6xl">{detailText.whatTitle}</h2>
            <p className="text-sm leading-7 text-velmere-grey-soft">{detailText.whatBody}</p>
          </div>
        </Reveal>
      </section>

      <section id="utility" className="luxury-section pb-20">
        <Reveal>
          <p className="velmere-label text-velmere-gold">{detailText.utilityKicker}</p>
          <h2 className="mt-4 font-serif text-4xl tracking-[-0.04em] md:text-6xl">{detailText.utilityTitle}</h2>
        </Reveal>
        <Reveal delay={0.06} className="mt-6">
          <UtilityDiagram flow={detailText.utilityFlow} />
        </Reveal>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {detailText.utilityCards.map(({ title, body }, index) => {
            const Icon = utilityCards[index]?.icon ?? ShieldCheck;
            return (
            <Reveal key={title} delay={index * 0.04} className="pass2004-utility-card luxury-card transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/[0.18]">
              <Icon className="h-5 w-5 text-velmere-gold" />
              <h3 className="mt-5 text-xl">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-velmere-muted">{body}</p>
            </Reveal>
            );
          })}
        </div>
      </section>

      <section className="luxury-section grid gap-4 pb-20 lg:grid-cols-2">
        <Reveal className="velmere-surface-sheen luxury-card">
          <p className="velmere-label text-velmere-gold">{detailText.tokenomicsKicker}</p>
          <h2 className="mt-5 font-serif text-[clamp(2.35rem,5vw,4.75rem)] leading-[0.98] tracking-[-0.035em]">{detailText.tokenomicsTitle}</h2>
          <div
            className="mt-7 grid gap-3"
            data-pass2004-tokenomics-grid="cards-not-row-lines"
          >
            {detailText.tokenomics.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.10] bg-black/[0.24] p-4 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/[0.38]">{label}</p>
                <p className="text-sm leading-6 text-white/[0.70]">{value}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08} className="velmere-surface-sheen luxury-card">
          <p className="velmere-label text-velmere-gold">{detailText.contractKicker}</p>
          <h2 className="mt-5 font-serif text-[clamp(2.35rem,5vw,4.75rem)] leading-[0.98] tracking-[-0.035em]">{detailText.contractTitle}</h2>
          <div className="mt-7 grid gap-3">
            {detailText.contractRows.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.10] bg-black/[0.24] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-white/[0.68]">{value}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="luxury-section pb-20">
        <Reveal>
          <p className="velmere-label text-velmere-gold">{detailText.roadmapKicker}</p>
          <h2 className="mt-4 font-serif text-4xl tracking-[-0.04em] md:text-6xl">{detailText.roadmapTitle}</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {detailText.roadmap.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.04} className="velmere-surface-sheen luxury-card">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-velmere-gold">{item.step}</p>
              <h3 className="mt-5 text-xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-velmere-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="luxury-section pb-20">
        <Reveal className="pass2004-vlm-risk-card rounded-[2rem] border border-cyan-200/[0.14] bg-[#0a0d10] p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <AlertTriangle className="h-6 w-6 shrink-0 text-cyan-100/[0.82]" />
            <div>
              <p className="velmere-label text-velmere-gold">{detailText.riskKicker}</p>
              <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em] md:text-5xl">{detailText.riskTitle}</h2>
              <p className="mt-5 max-w-4xl text-sm leading-7 text-velmere-grey-soft">{detailText.riskBody}</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="luxury-section pb-24 md:pb-32">
        <Reveal>
          <p className="velmere-label text-velmere-gold">{detailText.faqKicker}</p>
          <h2 className="mt-4 font-serif text-4xl tracking-[-0.04em] md:text-6xl">{detailText.faqTitle}</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {detailText.faqs.map(([question, answer], index) => (
            <Reveal key={question} delay={index * 0.04} className="velmere-surface-sheen luxury-card">
              <HelpCircle className="h-5 w-5 text-velmere-gold" />
              <h3 className="mt-5 text-xl">{question}</h3>
              <p className="mt-3 text-sm leading-7 text-velmere-muted">{answer}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
