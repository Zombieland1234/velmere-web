"use client";

import { Activity, CheckCircle2, ShieldCheck, Wallet } from "lucide-react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/navigation";

function footerCopy(locale: string) {
  if (locale === "pl") {
    return {
      tagline: "Deterministyczna weryfikacja kontraktów, integralność rynkowa i niezmienna linia dowodowa.",
      micro: "Terminal Shield, audyty kryptograficzne, laboratorium analiz oraz redakcyjne atelier.",
      explore: "Eksploruj",
      legal: "Dokumenty",
      trust: "Notatki zaufania",
      rights: "Wszelkie prawa zastrzeżone.",
      launch: "Metodologia, regulacje, prywatność i warunki pozostają dostępne bez szukania.",
      statusTitle: "Warstwa zaufania",
      statusItems: [
        "Infrastruktura analityczna i portfel są od siebie odseparowane.",
        "Weryfikacja dowodów i źródeł rynkowych jest deterministyczna.",
        "Bezpieczeństwo jest wzmacniane warstwowo, nie marketingowo.",
      ],
      exploreLinks: [
        { href: "/shield", label: "Terminal Shield" },
        { href: "/browser", label: "Przeglądarka aktywów" },
        { href: "/intelligence", label: "Intelligence" },
        { href: "/atelier", label: "Atelier" },
        { href: "/research-lab", label: "Laboratorium analiz" },
        { href: "/security", label: "Centrum bezpieczeństwa" },
        { href: "/faq", label: "FAQ i pomoc" },
      ],
      legalLinks: [
        { href: "/impressum", label: "Impressum / dane sprzedawcy" },
        { href: "/privacy", label: "Polityka prywatności" },
        { href: "/terms", label: "Regulamin" },
        { href: "/returns", label: "Zwroty / prawo odstąpienia" },
        { href: "/shipping", label: "Dostawa" },
        { href: "/contact", label: "Kontakt" },
      ],
      microcopy: [
        "Velmère udostępnia deterministyczny wgląd w ryzyko rynkowe, kontrakty i linię dowodową.",
        "Nigdy nie wpisuj frazy odzyskiwania portfela (seed phrase).",
        "Wszystkie źródła rynkowe i wskaźniki pewności są jawne i weryfikowalne.",
        "Zamówienia fizyczne i prawa konsumenta podlegają pełnej ochronie prawnej.",
        "Bezpieczeństwo Velmère to warstwy ochrony i ciągłe wzmacnianie, nie obietnica braku ryzyka.",
      ],
    };
  }

  if (locale === "de") {
    return {
      tagline: "Deterministische Vertragsprüfung, Multi-Venue Marktintegrität und unveränderliche Audit-Linie.",
      micro: "Shield Risikoanalyse, kryptografische Nachweise, Research Lab und redaktionelles Atelier.",
      explore: "Entdecken",
      legal: "Rechtliches",
      trust: "Trust Notes",
      rights: "Alle Rechte vorbehalten.",
      launch: "Methodik, Governance, Datenschutz und Bedingungen bleiben leicht erreichbar.",
      statusTitle: "Trust Layer",
      statusItems: [
        "Analyseinfrastruktur und Wallet bleiben getrennt.",
        "Beweismethodik und Multi-Venue-Quellen sind verifizierbar.",
        "Security wird schichtweise gehärtet, nicht vermarktet.",
      ],
      exploreLinks: [
        { href: "/shield", label: "Shield Terminal" },
        { href: "/browser", label: "Asset Browser" },
        { href: "/intelligence", label: "Intelligence" },
        { href: "/atelier", label: "Atelier" },
        { href: "/research-lab", label: "Research Lab" },
        { href: "/security", label: "Security Hub" },
        { href: "/faq", label: "FAQ & Hilfe" },
      ],
      legalLinks: [
        { href: "/impressum", label: "Impressum / Anbieterkennzeichnung" },
        { href: "/privacy", label: "Datenschutzerklärung" },
        { href: "/terms", label: "AGB" },
        { href: "/returns", label: "Rückgabe / Widerrufsrecht" },
        { href: "/shipping", label: "Versand" },
        { href: "/contact", label: "Kontakt" },
      ],
      microcopy: [
        "Velmère bietet deterministischen Einblick in Marktrisiken, Verträge und Nachweise.",
        "Gib niemals deine Seed Phrase ein.",
        "Alle Datenquellen und Konfidenzmetriken sind transparent und verifizierbar.",
        "Das redaktionelle Atelier und physische Bestellungen wahren alle Verbraucherrechte.",
        "Velmère Security bedeutet Schutzschichten und kontinuierliche Härtung, kein risikofreies Versprechen.",
      ],
    };
  }

  return {
    tagline: "Deterministic contract verification, multi-venue market integrity, and immutable audit lineage.",
    micro: "Shield risk analysis, cryptographic lineage, research laboratory, and editorial atelier.",
    explore: "Explore",
    legal: "Legal",
    trust: "Trust notes",
    rights: "All rights reserved.",
    launch: "Methodology, governance, privacy, and terms stay easy to reach.",
    statusTitle: "Trust Layer",
    statusItems: [
      "Analytics infrastructure and wallet flows stay separated.",
      "Evidence methodology and multi-venue sources are verifiable.",
      "Security is hardened in layers, not marketed as magic.",
    ],
    exploreLinks: [
      { href: "/shield", label: "Shield Terminal" },
      { href: "/browser", label: "Asset Browser" },
      { href: "/intelligence", label: "Intelligence" },
      { href: "/atelier", label: "Atelier" },
      { href: "/research-lab", label: "Research Lab" },
      { href: "/security", label: "Security Hub" },
      { href: "/faq", label: "FAQ & Assistance" },
    ],
    legalLinks: [
      { href: "/impressum", label: "Impressum / Legal Notice" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms" },
      { href: "/returns", label: "Returns / Right of Withdrawal" },
      { href: "/shipping", label: "Shipping" },
      { href: "/contact", label: "Contact" },
    ],
    microcopy: [
      "Velmère provides deterministic insight into market risks, contracts, and proof lineage.",
      "Never enter your wallet recovery seed phrase.",
      "All data sources and confidence indicators remain explicit and verifiable.",
      "Editorial atelier and physical orders maintain full consumer protection standards.",
      "Velmère Security means layered protection and continuous hardening, not a risk-free promise.",
    ],
  };
}

export default function Footer() {
  const pathname = usePathname();
  const copy = footerCopy(useLocale());

  if (pathname === "/login" || pathname?.includes("/assets/")) return null;

  return (
    <footer className="velmere-footer relative border-t border-white/[0.10] bg-[#0B0B0D] text-velmere-ivory">
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.65fr_0.8fr_1fr]">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center font-sans text-2xl font-semibold uppercase tracking-[0.22em] text-velmere-ivory md:text-3xl">
              VELMÈRE
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-velmere-grey-soft">
              {copy.tagline}
            </p>
            <p className="mt-4 max-w-md text-sm leading-7 text-velmere-muted">
              {copy.micro}
            </p>
            <div className="pass2006-footer-status velmere-surface-sheen velmere-readout-card mt-6 rounded-[1.5rem]" data-tone="cyan">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">
                {copy.statusTitle}
              </p>
              <div className="mt-4 grid gap-3">
                {copy.statusItems.map((item, index) => {
                  const Icon =
                    index === 0 ? Wallet : index === 1 ? Activity : ShieldCheck;
                  return (
                    <div key={item} className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold" />
                      <p className="text-sm leading-6 text-velmere-grey-soft">{item}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <p className="velmere-label text-velmere-gold">{copy.explore}</p>
            <ul className="mt-5 space-y-3">
              {copy.exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="velmere-command-pill velmere-interaction-pulse w-full justify-start px-4 py-3 text-sm normal-case tracking-[0.08em] text-velmere-muted hover:text-velmere-ivory">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="velmere-label text-velmere-gold">{copy.legal}</p>
            <ul className="mt-5 space-y-3">
              {copy.legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="velmere-command-pill velmere-interaction-pulse w-full justify-start px-4 py-3 text-sm normal-case tracking-[0.08em] text-velmere-muted hover:text-velmere-ivory">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="velmere-label text-velmere-gold">{copy.trust}</p>
            <div className="mt-5 grid gap-3">
              {copy.microcopy.map((item) => (
                <div key={item} className="pass2006-footer-trust-card velmere-readout-card flex gap-3 text-xs leading-6 text-velmere-grey-soft">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold" />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pass2006-footer-bottom mt-12 flex flex-col gap-4 border-t border-white/[0.10] pt-6 text-xs leading-6 text-velmere-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Velmère. {copy.rights}</p>
          <p>{copy.launch}</p>
        </div>
      </div>
    </footer>
  );
}
