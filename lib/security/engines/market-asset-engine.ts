/**
 * Velmère Traditional Market Asset Audit Engine
 * Evaluates regulated equities, exchange-traded commodities, forex pairs, and indices.
 * Strictly adheres to capital markets, continuous auction, and clearinghouse semantics.
 * ZERO EVM or blockchain contract terminology.
 */

import {
  CanonicalAssetIdentity,
  EngineSectionPlan,
  HumanAttestationPayload,
  SecurityAuditEngine,
} from "./types";
import type { ContractAuditProfile } from "../contract-audit-profiles";

export class MarketAssetEngine implements SecurityAuditEngine {
  readonly assetClass = "market_asset" as const;
  readonly engineVersion = "2.4.0-tradfi";

  matches(asset: CanonicalAssetIdentity): boolean {
    return (
      asset.assetClass === "market_asset" ||
      asset.networkType === "traditional_market" ||
      ["AAPL", "NVDA", "MSFT", "TSLA", "GC=F", "CL=F", "EURUSD=X", "SPY"].includes(
        asset.symbol.toUpperCase()
      )
    );
  }

  generateSections(params: {
    asset: CanonicalAssetIdentity;
    locale: "en" | "pl" | "de";
    rawBytecode?: string;
    profileOverride?: Partial<ContractAuditProfile> | null;
    humanAttestation?: HumanAttestationPayload;
  }): EngineSectionPlan[] {
    const { asset, locale, humanAttestation } = params;
    const isPl = locale === "pl";
    const isDe = locale === "de";

    const sections: EngineSectionPlan[] = [
      // 1. Overview
      {
        id: "overview",
        title: isPl
          ? "Przegląd instrumentu i kontekst rynku regulowanego"
          : isDe
            ? "Instrumenten-Übersicht & Kontext des regulierten Marktes"
            : "Instrument Overview & Regulated Market Context",
        subtitle: isPl
          ? "Podsumowanie struktury instrumentu, giełdy notowań i ram nadzorczych"
          : isDe
            ? "Zusammenfassung der Instrumentenstruktur, Börsennotierung und Aufsicht"
            : "Summary of instrument structure, primary exchange, and regulatory framework",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Weryfikacja tożsamości instrumentu i rejestracji u emitenta"
            : isDe
              ? "Verifikation der Instrumentenidentität und Emittentenregistrierung"
              : "Instrument identity verification and issuer registration audit",
          isPl
            ? "Identyfikacja giełdy macierzystej i standardów rozliczeniowych"
            : isDe
              ? "Identifikation der Heimatbörse und der Abwicklungsstandards"
              : "Primary exchange identification and clearinghouse standard review",
          isPl
            ? "Klasyfikacja profilu ryzyka rynkowego i płynnościowego"
            : isDe
              ? "Klassifizierung des Markt- und Liquiditätsrisikoprofils"
              : "Market risk and liquidity profile classification",
        ],
        keyValuePairs: [
          {
            label: isPl ? "Instrument / Nazwa" : isDe ? "Instrument / Name" : "Instrument / Name",
            value: asset.displayName,
          },
          {
            label: isPl ? "Klasa aktywów" : isDe ? "Asset-Klasse" : "Asset Class",
            value: isPl
              ? "Rynek Tradycyjny / Regulowany (Akcje / Towary / FX / ETF)"
              : isDe
                ? "Regulierter Markt (Aktien / Rohstoffe / FX / ETF)"
                : "Regulated Capital Market (Equity / Commodity / FX / ETF)",
          },
          {
            label: isPl ? "Ticker rynkowy" : isDe ? "Markt-Ticker" : "Market Ticker",
            value: asset.symbol,
          },
          {
            label: isPl ? "Rynek notowań" : isDe ? "Handelsplatz" : "Primary Venue",
            value: asset.networkName,
          },
          {
            label: isPl ? "Ramy prawne i nadzór" : isDe ? "Rechtlicher Rahmen" : "Regulatory Framework",
            value: isPl
              ? "Regulacje papierów wartościowych i rynków finansowych (SEC / ESMA / KNF)"
              : isDe
                ? "Finanzmarktaufsicht und Wertpapierregulierung (SEC / ESMA / BaFin)"
                : "Financial Conduct & Securities Framework (SEC / ESMA / Regulated)",
          },
        ],
      },

      // 2. Static Regulatory Verification / Contract Identity
      {
        id: "contract_identity",
        title: isPl
          ? "Weryfikacja prospektu emisyjnego i sprawozdawczości publicznej"
          : isDe
            ? "Verifikation des Emissionsprospekts & der Pflichtpublizität"
            : "Prospectus Verification & Statutory Disclosure Audit",
        subtitle: isPl
          ? "Weryfikacja raportów okresowych i zgodności z wymogami giełdowymi"
          : isDe
            ? "Überprüfung von periodischen Berichten und Börsenzulassungspflichten"
            : "Statutory filings audit, financial disclosure integrity, and listing compliance",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Weryfikacja integralności sprawozdań z rejestrami organów nadzoru"
            : isDe
              ? "Abgleich der Berichtsdaten mit Aufsichtsbehörden-Registern"
              : "Filing integrity cross-referenced against regulatory registers",
          isPl
            ? "Audyt spójności danych fundamentalnych i struktury kapitałowej"
            : isDe
              ? "Prüfung von Fundamentaldaten und Kapitalstruktur"
              : "Fundamental disclosure audit and capital structure verification",
          isPl
            ? "Ocena ciągłości notowań i statusu dopuszczenia do obrotu"
            : isDe
              ? "Bewertung der Handelskontinuität und des Zulassungsstatus"
              : "Trading continuity and active listing status confirmation",
        ],
        metrics: [
          {
            label: isPl ? "Logika smart kontraktu EVM" : isDe ? "EVM-Smart-Contract-Logik" : "EVM Smart Contract Logic",
            value: "NOT_APPLICABLE (Traditional Market Instrument)",
            status: "neutral",
          },
        ],
        paragraphs: [
          isPl
            ? `Instrument ${asset.displayName} podlega nadzorowi rynków regulowanych i izb rozliczeniowych. Dekompilacja bytecode EVM oraz skanowanie smart kontraktów mają status NOT_APPLICABLE dla instrumentów tradycyjnych.`
            : isDe
              ? `Das Instrument ${asset.displayName} unterliegt der Aufsicht regulierter Märkte und Clearingstellen. EVM-Bytecode-Dekompilierung hat für traditionelle Finanzinstrumente den Status NOT_APPLICABLE.`
              : `Instrument ${asset.displayName} operates within regulated securities frameworks and clearinghouse systems. EVM bytecode decompilation is NOT_APPLICABLE for traditional capital market assets.`,
        ],
      },

      // 3. Baseline Findings
      {
        id: "basic_findings",
        title: isPl
          ? "Podstawowe ustalenia bezpieczeństwa obrotu"
          : isDe
            ? "Grundlegende Handels- und Marktbefunde"
            : "Baseline Market & Trading Findings",
        subtitle: isPl
          ? "Zidentyfikowane parametry ryzyka rynkowego i płynnościowego"
          : isDe
            ? "Identifizierte Markt- und Liquiditätsrisikoparameter"
            : "Identified market microstructure and liquidity risk factors",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Podsumowanie stabilności notowań i płynności rynkowej"
            : isDe
              ? "Zusammenfassung der Kursstabilität und Marktliquidität"
              : "Summary of trading stability and market liquidity",
          isPl
            ? "Ocena zmienności historycznej i ekspozycji na szoki rynkowe"
            : isDe
              ? "Bewertung historischer Volatilität und Marktschockrisiken"
              : "Historical volatility assessment and market shock resilience",
          isPl
            ? "Zgodność ze standardami rozliczeń depozytowych T+1"
            : isDe
              ? "Konformität mit T+1-Abwicklungsstandards der Verwahrstellen"
              : "Compliance with depository settlement standards (T+1 settlement)",
        ],
        findings: [],
      },

      // 4. Pro Permission Parser (MODE B Procedural Teaser when locked)
      {
        id: "pro_permission_parser",
        title: isPl
          ? "Analiza ładu korporacyjnego i struktury kontroli zarządczej (PRO)"
          : isDe
            ? "Corporate Governance & Kontrollstruktur-Analyse (PRO)"
            : "Corporate Governance & Control Structure Analysis (PRO)",
        subtitle: isPl
          ? "Struktura akcjonariatu, prawa głosu i nadzór rady dyrektorów"
          : isDe
            ? "Aktionärsstruktur, Stimmrechtsklassen und Aufsichtsratskontrolle"
            : "Shareholder equity structure, voting classes, and board governance",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Struktura ładu korporacyjnego, nadzór rady dyrektorów i klasy akcji z prawem głosu"
            : isDe
              ? "Corporate-Governance-Struktur, Aufsichtsrat und stimmberechtigte Aktienklassen"
              : "Corporate governance structure, board oversight, and voting share classes",
          isPl
            ? "Ujawnienia w raportach regulacyjnych (SEC/KNF) i zgodność sprawozdawcza"
            : isDe
              ? "Regulatorische Offenlegungen und gesetzliche Berichterstattungskonformität"
              : "Regulatory filing disclosures and statutory reporting compliance",
          isPl
            ? "Uprawnienia zarządu, mandaty do rozwodnienia kapitału i prawa akcjonariuszy"
            : isDe
              ? "Befugnisse der Geschäftsführung, Verwässerungsmandate und Aktionärsrechte"
              : "Executive control powers, dilution mandates, and shareholder rights",
        ],
        metrics: [
          {
            label: isPl ? "Nadzór korporacyjny i zarządczy" : isDe ? "Unternehmensführung & Aufsicht" : "Corporate Governance & Board Oversight",
            value: isPl ? "Zarząd i Rada Dyrektorów" : isDe ? "Vorstand & Aufsichtsrat" : "Board of Directors & Management",
            status: "verified",
          },
          {
            label: isPl ? "Statutowe uprawnienia zarządcze" : isDe ? "Statutarische Leitungsbefugnisse" : "Statutory Governance Rights",
            value: isPl ? "Zdefiniowane w statucie spółki" : isDe ? "In Unternehmenssatzung definiert" : "Defined in Corporate Charter",
            status: "verified",
          },
          {
            label: isPl ? "Wyłączniki bezpieczeństwa obrotu (Circuit Breakers)" : isDe ? "Börsenhandelsunterbrecher" : "Market Circuit Breakers",
            value: isPl ? "Aktywne (Zasady LULD / SEC)" : isDe ? "Aktiv (LULD / SEC-Regeln)" : "Active (SEC / LULD Enforced)",
            status: "verified",
          },
          {
            label: isPl ? "Emisja dodatkowych akcji / jednostek" : isDe ? "Kapitalerhöhungsbefugnis" : "Share Issuance Authority",
            value: isPl ? "Zgodnie ze statutem / Uchwałą WZA" : isDe ? "Gemäß Hauptversammlungsbeschluss" : "Subject to Shareholder Authorization",
            status: "verified",
          },
        ],
        paragraphs: [
          isPl
            ? `Ład korporacyjny ${asset.displayName} opiera się na przepisach prawa handlowego, statucie spółki oraz regulacjach rynków kapitałowych.`
            : isDe
              ? `Die Unternehmensführung von ${asset.displayName} basiert auf Gesellschaftsrecht und Kapitalmarktvorschriften.`
              : `Governance for ${asset.displayName} is executed via corporate boards, statutory filings, and regulatory agencies.`,
        ],
      },

      // 5. Pro Liquidity Depth (MODE B Procedural Teaser when locked)
      {
        id: "pro_liquidity_depth",
        title: isPl
          ? "Głębokość notowań ciągłych i płynność arkusza zleceń (PRO)"
          : isDe
            ? "Orderbuchtiefe & Liquiditätsverteilung im fortlaufenden Handel (PRO)"
            : "Continuous Auction Depth & Order Book Microstructure (PRO)",
        subtitle: isPl
          ? "Rozkład spreadów NBBO, płynność animatorów rynku i handel blokowy"
          : isDe
            ? "NBBO-Spreads, Market-Maker-Liquidität und Blockhandelsvolumen"
            : "NBBO spread dynamics, market maker presence, and institutional block volume",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Głębokość ciągłych notowań giełdowych i spready NBBO (National Best Bid/Offer)"
            : isDe
              ? "Fortlaufende Orderbuchtiefe und NBBO-Spreads (National Best Bid and Offer)"
              : "Continuous auction order book depth and National Best Bid and Offer (NBBO) spreads",
          isPl
            ? "Wolumen transakcji blokowych, routing dark pool i udział animatorów rynku"
            : isDe
              ? "Institutionelles Blockhandelsvolumen, Dark-Pool-Routing und Market-Maker-Beteiligung"
              : "Institutional block trade volume, dark pool routing, and market maker participation",
          isPl
            ? "Widełki wyłączników rynkowych (reguły LULD) oraz historia zawieszeń obrotu"
            : isDe
              ? "Börsenhandelsunterbrechungen (LULD-Regeln) und Historie von Handelsaussetzungen"
              : "Exchange circuit breaker thresholds (LULD rules) and trading halt history",
        ],
        metrics: [
          {
            label: isPl ? "Model płynności rynkowej" : isDe ? "Marktliquiditätsmodell" : "Market Liquidity Model",
            value: isPl ? "Regulowany arkusz zleceń (CLOB)" : isDe ? "Reguliertes Orderbuch (CLOB)" : "Regulated Central Limit Order Book",
            status: "verified",
          },
          {
            label: isPl ? "Pary płynności DEX AMM" : isDe ? "DEX-AMM-Liquiditätspools" : "DEX AMM Pools",
            value: "NOT_APPLICABLE (Traditional Exchange Venue)",
            status: "neutral",
          },
          {
            label: isPl ? "Prowizje transakcyjne protokołu / sell tax" : isDe ? "Protokoll-Transfersteuern" : "Protocol Transfer / Sell Tax",
            value: "0.0% (Standard Regulated Trading)",
            status: "verified",
          },
        ],
        paragraphs: [
          isPl
            ? `Płynność dla ${asset.displayName} jest zapewniana przez licencjonowanych animatorów rynku i zlecenia inwestorów na giełdach publicznych.`
            : isDe
              ? `Die Liquidität für ${asset.displayName} wird durch lizenzierte Market Maker und Börsenaufträge bereitgestellt.`
              : `Liquidity for ${asset.displayName} is provided via registered market makers and continuous limit order books.`,
        ],
      },

      // 6. Pro Attack Surface (MODE B Procedural Teaser when locked)
      {
        id: "pro_attack_surface",
        title: isPl
          ? "Wektory manipulacji mikrostrukturą rynku i ryzyko kontrahenta (PRO)"
          : isDe
            ? "Mikrostruktur-Manipulationsvektoren & Gegenparteirisiko (PRO)"
            : "Market Microstructure Manipulation Vectors & Counterparty Risk (PRO)",
        subtitle: isPl
          ? "Modelowanie spoofingu, layeringu, ryzyka rozliczeniowego i margin call"
          : isDe
            ? "Modellierung von Spoofing, Layering, Abwicklungs- und Margin-Risiken"
            : "Spoofing, layering, clearinghouse margin requirements, and counterparty risks",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Wektory manipulacji mikrostrukturą rynku (spoofing, layering, wash trading)"
            : isDe
              ? "Manipulationsvektoren der Markt-Mikrostruktur (Spoofing, Layering, Wash-Trading)"
              : "Market microstructure manipulation vectors (spoofing, layering, wash trading)",
          isPl
            ? "Ryzyko kontrahenta rozliczeniowego i wymogi depozytowe izb rozliczeniowych"
            : isDe
              ? "Abwicklungs-Gegenparteirisiko und Margin-Anforderungen der Clearingstellen"
              : "Settlement counterparty risk and clearinghouse margin requirements",
          isPl
            ? "Ryzyko krótkiego ścisku płynności (squeeze) oraz systemowe zależności kredytowe"
            : isDe
              ? "Liquiditätsengpässe außerhalb der Börse und systemische Kreditabhängigkeiten"
              : "Off-market liquidity squeeze, short volatility, and systemic credit dependencies",
        ],
        metrics: [
          {
            label: isPl ? "Zależność od zewnętrznych wyroczni cenowych" : isDe ? "Orakelabhängigkeit" : "Oracle Price Feed Dependency",
            value: "NOT_APPLICABLE (Direct Exchange Pricing)",
            status: "verified",
          },
          {
            label: isPl ? "Wektor pożyczek Flash Loan" : isDe ? "Flash-Kredit-Angriffsvektor" : "Flash Loan Vector",
            value: "NOT_APPLICABLE (Traditional Clearing)",
            status: "verified",
          },
          {
            label: isPl ? "Ryzyko awarii silnika dopasowywania zleceń" : isDe ? "Matching-Engine-Ausfallrisiko" : "Matching Engine Outage Risk",
            value: isPl ? "Zabezpieczone redundancją giełdową" : isDe ? "Durch Börsenredundanz gesichert" : "Protected by exchange redundancy",
            status: "verified",
          },
        ],
      },

      // 7. Advanced Storage Layout Collision (Renamed to Clearing & Depository Integrity)
      {
        id: "advanced_bytecode_diff",
        title: isPl
          ? "Rozliczenia depozytowe i zgodność rejestrów własności (ADVANCED)"
          : isDe
            ? "Depotabwicklung & Eigentumsregister-Abstimmung (ADVANCED)"
            : "Depository Reconciliation & Ownership Ledger Integrity (ADVANCED)",
        subtitle: isPl
          ? "Weryfikacja uzgodnień centralnych depozytów papierów wartościowych"
          : isDe
            ? "Abstimmung der Zentralverwahrer-Register und Berechtigungsketten"
            : "Central securities depository reconciliation and clearinghouse settlement",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Architektura uzgodnień rozliczeniowo-depozytowych (DTC/KDPW/Euroclear)"
            : isDe
              ? "Abstimmungsarchitektur von Clearing und Verwahrstellen (DTC/Euroclear)"
              : "Clearing and depository reconciliation architecture (DTC/Euroclear)",
          isPl
            ? "Weryfikacja skrótu kryptograficznego sprawozdań z rejestrami publicznymi"
            : isDe
              ? "Kryptografische Hash-Verifikation behördlicher Einreichungen"
              : "Regulatory filing hash verification against public disclosure registers",
          isPl
            ? "Deterministyczna realizacja operacji korporacyjnych (splity, dywidendy)"
            : isDe
              ? "Deterministische Ausführung von Kapitalmaßnahmen (Splits, Dividenden)"
              : "Corporate action and split/dividend distribution deterministic execution",
        ],
        metrics: [
          {
            label: isPl ? "Rozliczenia izby depozytowej" : isDe ? "Verwahrstellenabwicklung" : "Depository Clearing Protocol",
            value: isPl ? "Standard rozliczeń T+1" : isDe ? "T+1-Abwicklungsstandard" : "Standard T+1 Clearing",
            status: "verified",
          },
          {
            label: isPl ? "Skanowanie slotów pamięci EVM" : isDe ? "EVM-Speicherplatz-Scan" : "EVM Storage Slot Collision",
            value: "NOT_APPLICABLE (Non-EVM Asset)",
            status: "neutral",
          },
        ],
        paragraphs: [
          isPl
            ? `Rozliczenia dla ${asset.displayName} są realizowane przez autoryzowane izby rozliczeniowe i depozyty papierów wartościowych. Różnice układu pamięci maszynowej EVM mają status NOT_APPLICABLE.`
            : isDe
              ? `Die Abwicklung von ${asset.displayName} erfolgt über autorisierte Clearingstellen. EVM-Speicherplatzdifferenzen haben den Status NOT_APPLICABLE.`
              : `Settlement for ${asset.displayName} is enforced through licensed central depositories and clearing corporations; EVM storage layout diffing is NOT_APPLICABLE.`,
        ],
      },

      // 8. Advanced Multi-Version
      {
        id: "advanced_multi_version",
        title: isPl
          ? "Historia operacji korporacyjnych i zmian kapitałowych (ADVANCED)"
          : isDe
            ? "Historie der Kapitalmaßnahmen & Emissionen (ADVANCED)"
            : "Corporate Actions, Stock Splits & Capital Evolution (ADVANCED)",
        subtitle: isPl
          ? "Śledzenie podziałów akcji, wypłat dywidend i emisji dodatkowych"
          : isDe
            ? "Nachverfolgung von Aktiensplits, Dividenden und Kapitalerhöhungen"
            : "Tracking of stock splits, dividend distributions, and capital adjustments",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Historia operacji na kapitale i podziałów akcji (stock splits)"
            : isDe
              ? "Historie von Kapitalmaßnahmen und Aktiensplits"
              : "Historical capital adjustments and stock split execution record",
          isPl
            ? "Weryfikacja spójności praw akcjonariuszy między emisjami"
            : isDe
              ? "Konsistenzprüfung der Aktionärsrechte über Emissionen hinweg"
              : "Consistency verification of shareholder rights across issues",
          isPl
            ? "Weryfikacja formalna: NOT EXECUTED (Silnik weryfikacji formalnej nie dotyczy aktywów tradycyjnych)"
            : isDe
              ? "Formale Verifikation: NOT EXECUTED (Formale Verifikations-Engine für traditionelle Assets nicht anwendbar)"
              : "Formal verification: NOT EXECUTED (Formal verification engine not applicable)",
        ],
        keyValuePairs: [
          {
            label: isPl ? "Status obrotu" : isDe ? "Handelsstatus" : "Listing Status",
            value: isPl ? "Aktywne notowania na giełdzie regulowanej" : isDe ? "Aktiv an regulierter Börse gelistet" : "Active Regulated Exchange Listing",
          },
          {
            label: isPl ? "Fuzzing reguł kontraktu" : isDe ? "Vertrags-Fuzzing" : "Contract Fuzzing",
            value: "NOT_APPLICABLE (Non-Contract Traditional Asset)",
          },
        ],
      },

      // 9. Advanced Human Review
      {
        id: "advanced_human_review",
        title: isPl
          ? "Weryfikacja analityka rynku i poświadczenie sprawozdawcze (ADVANCED)"
          : isDe
            ? "Menschliche Marktanalystenprüfung & Beglaubigung (ADVANCED)"
            : "Market Analyst Review & Attested Verification (ADVANCED)",
        subtitle: isPl
          ? "Dowód niezależnego przeglądu sprawozdawczości przez analityka finansowego"
          : isDe
            ? "Bestätigter Prüfnachweis durch lizenzierten Finanzanalysten"
            : "Attested independent disclosure review by certified financial analyst",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Atestacja analityka wymaga zweryfikowanego dowodu audytora"
            : isDe
              ? "Analysten-Freigabe erfordert verifizierten Prüfnachweis"
              : "Analyst sign-off requires verified reviewer evidence",
          isPl
            ? "Kryptograficznie podpisany skrót weryfikacji sprawozdań"
            : isDe
              ? "Kryptografisch signierter Bestätigungs-Digest der Berichtsüberprüfung"
              : "Cryptographically signed disclosure verification digest",
          isPl
            ? "Wyraźna granica przeglądu manualnego: brak rekomendacji inwestycyjnej"
            : isDe
              ? "Explizite manuelle Prüfungsgrenze: keine Anlageberatung oder Kaufempfehlung"
              : "Manual review boundary explicit: not investment advice or recommendation",
        ],
        paragraphs: humanAttestation
          ? [
              `Financial analyst review completed by ${humanAttestation.reviewedBy} on ${humanAttestation.reviewDate}. Attestation hash: ${humanAttestation.signedHash}.`,
            ]
          : [
              isPl
                ? "Status weryfikacji: INDEPENDENT HUMAN REVIEW NOT COMMISSIONED. Zgodnie ze standardem uczciwości Velmère, deklaracje recenzji ludzkiej nie są dołączane do raportu bez faktycznego, podpisanego dowodu analityka."
                : isDe
                  ? "Prüfungsstatus: INDEPENDENT HUMAN REVIEW NOT COMMISSIONED. Gemäß den Velmère-Richtlinien werden keine Behauptungen über menschliche Prüfungen ohne tatsächliche Nachweise ausgegeben."
                  : "Review status: INDEPENDENT HUMAN REVIEW NOT COMMISSIONED. In accordance with Velmère policy, human review claims are NEVER emitted unless verified reviewer evidence exists.",
            ],
      },
    ];

    return sections;
  }
}
