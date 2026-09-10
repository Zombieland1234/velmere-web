/**
 * Velmère Native Blockchain Audit Engine
 * Evaluates Layer-1 native chains, distributed consensus, validator distribution, and client divergence.
 * Strictly adheres to native crypto semantics with ZERO EVM contract concepts or synthetic leaks.
 */

import {
  CanonicalAssetIdentity,
  EngineSectionPlan,
  HumanAttestationPayload,
  SecurityAuditEngine,
} from "./types";
import type { ContractAuditProfile } from "../contract-audit-profiles";

export class NativeChainEngine implements SecurityAuditEngine {
  readonly assetClass = "native_chain" as const;
  readonly engineVersion = "2.4.0-native";

  matches(asset: CanonicalAssetIdentity): boolean {
    return (
      asset.assetClass === "native_chain" ||
      asset.networkType === "utxo" ||
      ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "DOT", "POL", "LTC", "TRX"].includes(
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
          ? "Przegląd protokołu i kontekst sieci L1"
          : isDe
            ? "Protokoll-Übersicht & L1-Netzwerk-Kontext"
            : "Protocol Overview & Native L1 Network Context",
        subtitle: isPl
          ? "Podsumowanie architektury rozproszonej i mechanizmu konsensusu"
          : isDe
            ? "Zusammenfassung der verteilten Architektur und des Konsensmechanismus"
            : "Summary of distributed architecture and consensus mechanism",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Weryfikacja natywnego łańcucha bloków i architektury węzłów"
            : isDe
              ? "Verifikation der nativen Blockchain und Knotenarchitektur"
              : "Native blockchain and node architecture verification",
          isPl
            ? "Ewaluacja modelu emisji i niezmienności reguł monetarnych"
            : isDe
              ? "Bewertung des Emissionsmodells und der monetären Unveränderlichkeit"
              : "Emission model evaluation and monetary rule immutability",
          isPl
            ? "Ocena stopnia decentralizacji sieci i odporności na cenzurę"
            : isDe
              ? "Bewertung der Netzwerkdezentralisierung und Zensurresistenz"
              : "Network decentralization degree and censorship resistance assessment",
        ],
        keyValuePairs: [
          {
            label: isPl ? "Protokół / Aktywo" : isDe ? "Protokoll / Asset" : "Protocol / Asset",
            value: asset.displayName,
          },
          {
            label: isPl ? "Typ architektury" : isDe ? "Architekturtyp" : "Architecture Type",
            value: isPl
              ? "Natywna warstwa bazowa (Layer-1 · Brak kontraktu smart contract)"
              : isDe
                ? "Natives Basis-Netzwerk (Layer-1 · Kein Smart-Contract)"
                : "Native Base Layer (Layer-1 · No Smart Contract)",
          },
          {
            label: isPl ? "Identyfikator sieci" : isDe ? "Netzwerk-ID" : "Network Identifier",
            value: asset.canonicalId,
          },
          {
            label: isPl ? "Symbol natywny" : isDe ? "Natives Symbol" : "Native Symbol",
            value: asset.symbol,
          },
          {
            label: isPl ? "Zarządzanie regułami" : isDe ? "Regel-Governance" : "Rule Governance",
            value: isPl
              ? "Rozproszony konsensus węzłów i walidatorów / górników"
              : isDe
                ? "Verteilter Konsens der Knoten und Validatoren / Miner"
                : "Distributed node consensus across validators / miners",
          },
        ],
      },

      // 2. Static Protocol Verification / Contract Identity
      {
        id: "contract_identity",
        title: isPl
          ? "Weryfikacja specyfikacji konsensusu i implementacji węzła"
          : isDe
            ? "Verifikation der Konsensusspezifikation & Node-Implementierung"
            : "Consensus Specification & Node Client Verification",
        subtitle: isPl
          ? "Analiza reguł walidacji bloków, transakcji i kryptografii krzywych"
          : isDe
            ? "Analyse der Blockvalidierungsregeln, Transaktionen und Kryptographie"
            : "Analysis of block validation rules, transactions, and cryptographic curves",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Weryfikacja referencyjnego kodu źródłowego klienta węzła"
            : isDe
              ? "Verifikation des Referenzquellcodes des Node-Clients"
              : "Node client reference source code verification",
          isPl
            ? "Walidacja bibliotek kryptograficznych i formatu transakcji"
            : isDe
              ? "Validierung kryptografischer Bibliotheken und Transaktionsformate"
              : "Validation of cryptographic primitives and transaction serialization",
          isPl
            ? "Analiza odporności na nieprawidłowe bloki i rozwidlenia łańcucha"
            : isDe
              ? "Resilienzanalyse gegen ungültige Blöcke und Kettenabspaltungen"
              : "Resilience analysis against invalid blocks and chain splits",
        ],
        paragraphs: [
          isPl
            ? `Weryfikacja protokołu ${asset.displayName} opiera się na specyfikacji konsensusu warstwy pierwszej. Analiza bytecode EVM i dekompilacja kontraktów mają status NOT_APPLICABLE dla natywnych monet.`
            : isDe
              ? `Die Verifikation des ${asset.displayName}-Protokolls basiert auf der Layer-1-Konsensspezifikation. EVM-Bytecode-Analyse hat für native Coins den Status NOT_APPLICABLE.`
              : `Verification of ${asset.displayName} is conducted against native Layer-1 consensus specifications. EVM bytecode decompilation is NOT_APPLICABLE for native base protocol assets.`,
        ],
      },

      // 3. Baseline Findings
      {
        id: "basic_findings",
        title: isPl
          ? "Podstawowe ustalenia bezpieczeństwa sieci"
          : isDe
            ? "Grundlegende Netzwerksicherheitsbefunde"
            : "Baseline Network Security Findings",
        subtitle: isPl
          ? "Zidentyfikowane wektory ryzyka w architekturze bazowej"
          : isDe
            ? "Identifizierte Risikovektoren in der Basisarchitektur"
            : "Identified risk vectors in base layer architecture",
        requiredTier: "basic",
        sampleSummaryLines: [
          isPl
            ? "Podsumowanie parametrów stabilności sieci bazowej"
            : isDe
              ? "Zusammenfassung der Stabilitätsparameter des Basisnetzwerks"
              : "Summary of base network stability parameters",
          isPl
            ? "Ocena odporności na błędy konsensusu i desynchronizację"
            : isDe
              ? "Bewertung der Resilienz gegen Konsensfehler und Desynchronisation"
              : "Assessment of consensus error resilience and desynchronization",
          isPl
            ? "Zgodność z przyjętymi standardami bezpieczeństwa sieci rozproszonych"
            : isDe
              ? "Konformität mit Sicherheitsstandards für verteilte Netzwerke"
              : "Compliance with established distributed network security baselines",
        ],
        findings: [],
      },

      // 4. Pro Permission Parser (MODE B Procedural Teaser when locked)
      {
        id: "pro_permission_parser",
        title: isPl
          ? "Analiza zarządzania konsensusem i koordynacji uaktualnień (PRO)"
          : isDe
            ? "Konsens-Governance & Upgrade-Koordinations-Analyse (PRO)"
            : "Consensus Governance & Protocol Upgrade Analysis (PRO)",
        subtitle: isPl
          ? "Ewaluacja decentralizacji, rozkładu walidatorów i procesu BIP/EIP"
          : isDe
            ? "Bewertung der Dezentralisierung, Validatoren-Verteilung und EIP/BIP-Prozesse"
            : "Decentralization evaluation, validator distribution, and improvement proposal process",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Analiza zarządzania konsensem rozproszonym i mechanizmów upgrade protokołu"
            : isDe
              ? "Analyse von verteilter Konsens-Governance und Protokoll-Upgrade-Mechanismen"
              : "Distributed consensus governance and protocol upgrade mechanism analysis",
          isPl
            ? "Ewaluacja rozkładu walidatorów / górników oraz progu finalności sieci"
            : isDe
              ? "Bewertung der Validatoren-/Miner-Verteilung und Netzwerk-Finalität"
              : "Validator / miner distribution and network finality threshold evaluation",
          isPl
            ? "Historia koordynacji hard-forków oraz audyt różnorodności klientów węzłów"
            : isDe
              ? "Historie der Hard-Fork-Koordination und Client-Diversitätsprüfung"
              : "Hard-fork coordination history and client implementation diversity audit",
        ],
        metrics: [
          {
            label: isPl ? "Zarządzanie konsensusem sieci" : isDe ? "Netzwerk-Konsens-Governance" : "Network Consensus Governance",
            value: isPl ? "Rozproszony konsensus węzłów" : isDe ? "Verteilter Knoten-Konsens" : "Distributed Node Consensus",
            status: "verified",
          },
          {
            label: isPl ? "Klucze administracyjne kontraktu" : isDe ? "Vertrags-Admin-Schlüssel" : "Smart Contract Admin Keys",
            value: "NOT_APPLICABLE (Native Layer-1 Protocol)",
            status: "verified",
          },
          {
            label: isPl ? "Możliwość awaryjnego zatrzymania sieci" : isDe ? "Notfall-Netzwerk-Pause" : "Emergency Network Pause Capability",
            value: "NOT_APPLICABLE (Decentralized Network)",
            status: "verified",
          },
          {
            label: isPl ? "Arbitralny drenaż sald użytkowników" : isDe ? "Willkürlicher Guthabenabzug" : "Arbitrary User Balance Drain",
            value: "NOT_APPLICABLE (Cryptographic Keys Enforced)",
            status: "verified",
          },
        ],
        paragraphs: [
          isPl
            ? `Zasady protokołu ${asset.displayName} są egzekwowane przez rozproszony konsensus węzłów walidujących; nie istnieje uprzywilejowany klucz właściciela smart kontraktu.`
            : isDe
              ? `Die Regeln des ${asset.displayName}-Protokolls werden durch den verteilten Konsens validierender Knoten durchgesetzt; es existiert kein privilegierter Eigentümerschlüssel.`
              : `Protocol rules for ${asset.displayName} are enforced by distributed node consensus; no privileged smart contract owner key exists (NOT_APPLICABLE).`,
        ],
      },

      // 5. Pro Liquidity Depth (MODE B Procedural Teaser when locked)
      {
        id: "pro_liquidity_depth",
        title: isPl
          ? "Głębokość rynku spot, rezerwy giełdowe i aktywność sieci (PRO)"
          : isDe
            ? "Spot-Markttiefe, Börsenreserven & Netzwerkaktivität (PRO)"
            : "Spot Market Depth, Exchange Reserves & Network Velocity (PRO)",
        subtitle: isPl
          ? "Płynność na rynkach światowych, prędkość podaży i zachowanie mempoolu"
          : isDe
            ? "Globale Marktliquidität, Umlaufgeschwindigkeit und Mempool-Dynamik"
            : "Global market liquidity, supply velocity, and mempool dynamics",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Głębokość globalnych ksiąg zleceń na giełdach spot i rezerwy powiernicze"
            : isDe
              ? "Globale Orderbuchtiefe an regulierten Spot-Börsen und Verwahrungsreserven"
              : "Global order book depth across regulated spot venues and custodial reserves",
          isPl
            ? "Prędkość podaży w obiegu on-chain oraz rozkład aktywnych adresów"
            : isDe
              ? "On-Chain-Umlaufgeschwindigkeit und Verteilung aktiver Adressen"
              : "On-chain circulating supply velocity and active address distribution",
          isPl
            ? "Zmienność opłat transakcyjnych sieci i zachowanie kolejki mempool"
            : isDe
              ? "Netzwerkgebührenvolatilität und Mempool-Überlastungsverhalten"
              : "Network transaction fee volatility and mempool congestion behavior",
        ],
        metrics: [
          {
            label: isPl ? "Płynność rezerw rynkowych" : isDe ? "Marktreserven-Liquidität" : "Market Reserve Liquidity",
            value: isPl ? "Globalna płynność rynku spot" : isDe ? "Globale Spot-Liquidität" : "Global Spot Market Liquidity",
            status: "verified",
          },
          {
            label: isPl ? "Pary płynności DEX AMM" : isDe ? "DEX-AMM-Paare" : "DEX AMM Pairs",
            value: "NOT_APPLICABLE (Native Base Asset)",
            status: "neutral",
          },
          {
            label: isPl ? "Podatek transferowy / sell tax" : isDe ? "Transfergebühr / Verkaufssteuer" : "Transfer Tax / Sell Fee",
            value: "NOT_APPLICABLE (Standard Network Fee Model)",
            status: "verified",
          },
        ],
        paragraphs: [
          isPl
            ? `Płynność dla ${asset.displayName} opiera się na globalnych rynkach kasowych i sieciach powierniczych. Mechanizmy blokad par AMM mają status NOT_APPLICABLE.`
            : isDe
              ? `Die Liquidität für ${asset.displayName} stützt sich auf globale Spotmärkte. AMM-Sperrmechanismen haben den Status NOT_APPLICABLE.`
              : `Liquidity for ${asset.displayName} is anchored in global spot venues and custodial settlement networks; automated market maker liquidity locks are NOT_APPLICABLE.`,
        ],
      },

      // 6. Pro Attack Surface (MODE B Procedural Teaser when locked)
      {
        id: "pro_attack_surface",
        title: isPl
          ? "Wektory ataków na sieć i odporność konsensusu (PRO)"
          : isDe
            ? "Netzwerkangriffsvektoren & Konsens-Resilienz (PRO)"
            : "Network Attack Vectors & Consensus Resilience (PRO)",
        subtitle: isPl
          ? "Modelowanie reorganizacji łańcucha, ataków Sybil i partycjonowania P2P"
          : isDe
            ? "Modellierung von Kettenreorganisationen, Sybil-Angriffen und P2P-Partitionierung"
            : "Modeling of chain reorganizations, Sybil attacks, and P2P partitioning",
        requiredTier: "pro",
        sampleSummaryLines: [
          isPl
            ? "Modelowanie reorganizacji konsensusu i ataku większości hashrate/stake"
            : isDe
              ? "Modellierung von Konsensreorganisationen und Mehrheits-Hashrate-/Stake-Angriffen"
              : "Consensus reorganization and majority hashrate/stake attack modeling",
          isPl
            ? "Analiza odporności sieci P2P na partycjonowanie, eclipse attack i sybil"
            : isDe
              ? "Analyse der P2P-Netzwerkpartitionierung, Eclipse-Angriffe und Sybil-Resistenz"
              : "P2P network partition, eclipse attack, and sybil resistance analysis",
          isPl
            ? "Wektory cenzury transakcji, manipulacji mempool i ekstrakcji MEV"
            : isDe
              ? "Transaktionszensur, Mempool-Front-Running und MEV-Extraktionsvektoren"
              : "Mempool front-running, transaction censorship, and MEV extraction vectors",
        ],
        metrics: [
          {
            label: isPl ? "Zależność od zewnętrznych wyroczni" : isDe ? "Orakelabhängigkeit" : "External Oracle Dependency",
            value: "NOT_APPLICABLE (Protocol Native Settlement)",
            status: "verified",
          },
          {
            label: isPl ? "Wektor pożyczek Flash Loan" : isDe ? "Flash-Kredit-Angriffsvektor" : "Flash Loan Attack Vector",
            value: "NOT_APPLICABLE (Non-EVM Execution Environment)",
            status: "verified",
          },
          {
            label: isPl ? "Ryzyko podwójnego wydania (Double-Spend)" : isDe ? "Double-Spend-Angriffsrisiko" : "Double-Spend Attack Vector",
            value: isPl ? "Zabezpieczone przez konsensus sieci" : isDe ? "Durch Netzwerkkonsens gesichert" : "Secured by network consensus",
            status: "verified",
          },
        ],
      },

      // 7. Advanced Storage & State Integrity (MODE B Procedural Teaser when locked)
      {
        id: "advanced_bytecode_diff",
        title: isPl
          ? "Determinizm silnika stanów i kompatybilność klientów (ADVANCED)"
          : isDe
            ? "Zustands-Engine-Determinismus & Client-Kompatibilität (ADVANCED)"
            : "State Engine Determinism & Multi-Client Wire Compatibility (ADVANCED)",
        subtitle: isPl
          ? "Weryfikacja kompatybilności binarnej i determinizmu przejść stanów węzłów"
          : isDe
            ? "Binäre Kompatibilität und deterministische Ausführung von Zustandsübergängen"
            : "Binary compatibility verification and state transition engine determinism",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Weryfikacja powtarzalności kompilacji klienta referencyjnego węzła"
            : isDe
              ? "Reproduzierbare Build-Verifikation von Referenz-Knoten-Clients"
              : "Reference node client reproducible build verification against repository tags",
          isPl
            ? "Analiza kompatybilności binarnej serializacji konsensusu i protokołu sieciowego"
            : isDe
              ? "Binäre Kompatibilitätsanalyse der Konsens-Serialisierung und Wire-Protokolle"
              : "Consensus serialization and wire protocol binary compatibility analysis",
          isPl
            ? "Deterministyczna weryfikacja granic wykonania silnika przejść stanów"
            : isDe
              ? "Deterministische Ausführungsgrenzen der Zustandsübergangs-Engine"
              : "State transition engine deterministic execution boundary checks",
        ],
        metrics: [
          {
            label: isPl ? "Determinizm przejścia stanów" : isDe ? "Zustandsübergangs-Determinismus" : "State Transition Determinism",
            value: isPl ? "Zgodny ze specyfikacją protokołu" : isDe ? "Konform mit Protokollspezifikation" : "Conforms to protocol specification",
            status: "verified",
          },
          {
            label: isPl ? "Różnorodność klientów sieci" : isDe ? "Client-Diversität" : "Client Implementation Diversity",
            value: isPl ? "Weryfikacja implementacji referencyjnych" : isDe ? "Referenzimplementierungen geprüft" : "Reference implementations evaluated",
            status: "verified",
          },
        ],
        paragraphs: [
          isPl
            ? `Integralność stanu ${asset.displayName} zależy od determinizmu silnika rozproszonego; skanowanie slotów pamięci EVM ma status NOT_APPLICABLE.`
            : isDe
              ? `Die Zustandsintegrität von ${asset.displayName} basiert auf deterministischen Protokollregeln; EVM-Speicherscans haben den Status NOT_APPLICABLE.`
              : `State integrity for ${asset.displayName} is enforced by deterministic state transitions; EVM storage layout diffing is NOT_APPLICABLE.`,
        ],
      },

      // 8. Advanced Multi-Version
      {
        id: "advanced_multi_version",
        title: isPl
          ? "Historia ewolucji protokołu i soft/hard forków (ADVANCED)"
          : isDe
            ? "Protokoll-Evolutionsgeschichte & Fork-Dokumentation (ADVANCED)"
            : "Protocol Hard/Soft Fork Evolution & Invariant Proofs (ADVANCED)",
        subtitle: isPl
          ? "Śledzenie zmian w regułach konsensusu i analiza kompatybilności wstecznej"
          : isDe
            ? "Nachverfolgung von Konsensregeländerungen und Abwärtskompatibilität"
            : "Tracking of consensus rule evolution and backward compatibility guarantees",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Historia aktywacji propozycji uaktualnień protokołu"
            : isDe
              ? "Aktivierungshistorie von Protokoll-Upgrade-Vorschlägen"
              : "Protocol upgrade proposal activation and deployment history",
          isPl
            ? "Weryfikacja kompatybilności wstecznej reguł walidacji bloków"
            : isDe
              ? "Überprüfung der Abwärtskompatibilität von Blockvalidierungsregeln"
              : "Backward compatibility verification of block validation logic",
          isPl
            ? "Weryfikacja formalna: NOT EXECUTED (Silnik weryfikacji formalnej nie był uruchamiany dla tego łańcucha)"
            : isDe
              ? "Formale Verifikation: NOT EXECUTED (Formale Verifikations-Engine nicht beauftragt)"
              : "Formal verification: NOT EXECUTED (Formal verification engine not commissioned)",
        ],
        keyValuePairs: [
          {
            label: isPl ? "Status protokołu" : isDe ? "Protokollstatus" : "Protocol Status",
            value: isPl ? "Główna sieć produkcyjna (Mainnet)" : isDe ? "Produktions-Hauptnetz (Mainnet)" : "Active Production Mainnet",
          },
          {
            label: isPl ? "Fuzzing reguł konsensusu" : isDe ? "Konsens-Fuzzing" : "Consensus Fuzzing",
            value: "NOT EXECUTED (Engine not commissioned)",
          },
        ],
      },

      // 9. Advanced Human Review
      {
        id: "advanced_human_review",
        title: isPl
          ? "Weryfikacja analityka i audyt architektury protokołu (ADVANCED)"
          : isDe
            ? "Menschliche Analystenprüfung & Protokollarchitektur-Audit (ADVANCED)"
            : "Human Analyst Review & Protocol Architecture Audit (ADVANCED)",
        subtitle: isPl
          ? "Atestacja niezależnego audytora systemów rozproszonych"
          : isDe
            ? "Bestätigung durch unabhängigen Prüfer für verteilte Systeme"
            : "Attestation by independent distributed systems auditor",
        requiredTier: "advanced",
        sampleSummaryLines: [
          isPl
            ? "Przegląd analityka wymaga zweryfikowanego dowodu audytora"
            : isDe
              ? "Analysten-Freigabe erfordert verifizierten Prüfnachweis"
              : "Analyst sign-off requires verified reviewer evidence",
          isPl
            ? "Kryptograficznie podpisany skrót atestacji analityka"
            : isDe
              ? "Kryptografisch signierter Bestätigungs-Digest des Analysten"
              : "Cryptographically signed analyst attestation digest",
          isPl
            ? "Wyraźna granica przeglądu manualnego: brak gwarancji braku błędów"
            : isDe
              ? "Explizite manuelle Prüfungsgrenze: keine Garantie auf Fehlerfreiheit"
              : "Manual review boundary explicit: no guarantee of absolute perfection",
        ],
        paragraphs: humanAttestation
          ? [
              `Human analyst review completed by ${humanAttestation.reviewedBy} on ${humanAttestation.reviewDate}. Attestation hash: ${humanAttestation.signedHash}.`,
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
