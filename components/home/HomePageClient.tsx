"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Eye,
  FileCheck2,
  Globe2,
  History,
  Lock,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import IntelligenceFlowHero from "@/components/home/IntelligenceFlowHero";
import Reveal from "@/components/ui/Reveal";

type Locale = "pl" | "en" | "de";

interface ContentSchema {
  hero: {
    badge: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
    pills: [string, string, string];
  };
  metrics: Array<{
    value: string;
    label: string;
    desc: string;
  }>;
  ledger: {
    kicker: string;
    title: string;
    subtitle: string;
    viewAllCta: string;
    columns: {
      contract: string;
      network: string;
      vector: string;
      cvss: string;
      hash: string;
      status: string;
    };
    rows: Array<{
      name: string;
      symbol: string;
      address: string;
      network: string;
      vector: string;
      cvss: string;
      severity: string;
      hash: string;
      status: string;
    }>;
  };
  workflow: {
    kicker: string;
    title: string;
    subtitle: string;
    steps: Array<{
      step: string;
      title: string;
      desc: string;
      points: string[];
    }>;
  };
  surfaces: {
    kicker: string;
    title: string;
    subtitle: string;
    items: Array<{
      id: string;
      badge: string;
      title: string;
      desc: string;
      href: string;
      cta: string;
      features: string[];
    }>;
  };
  axioms: {
    kicker: string;
    title: string;
    desc: string;
    rules: Array<{
      title: string;
      body: string;
    }>;
  };
}

const CONTENT: Record<Locale, ContentSchema> = {
  en: {
    hero: {
      badge: "AUTONOMOUS ON-CHAIN INTELLIGENCE & CAPITAL DEFENSE",
      title: "Verifiable Evidence.",
      titleHighlight: "Pure Market Truth.",
      subtitle:
        "Autonomous smart contract risk scanning, deep bytecode decompilation, and real-time on-chain liquidity radar. Zero guesswork — absolute cryptographic provenance.",
      pills: [
        "Real-Time EVM Verification",
        "Deterministic CVSS Risk Scoring",
        "Zero Fabricated Data",
      ],
    },
    metrics: [
      {
        value: "100%",
        label: "Deterministic Analysis",
        desc: "Zero fabricated vulnerabilities (0 LLM Hallucinations)",
      },
      {
        value: "12+",
        label: "Multi-Chain EVM Coverage",
        desc: "Continuous RPC, mempool, and transaction queue telemetry",
      },
      {
        value: "30/30",
        label: "Formal CVSS Rules",
        desc: "Invariant fuzzing, reentrancy traps, and proxy audits",
      },
      {
        value: "SHA-256",
        label: "Cryptographic Provenance",
        desc: "Immutable state snapshots tied to block execution",
      },
    ],
    ledger: {
      kicker: "ON-CHAIN EVIDENCE TELEMETRY",
      title: "Recently Verified Contracts & Evidence Ledger",
      subtitle:
        "Continuous on-chain telemetry — each contract holds an auditable cryptographic signature bound to bytecode.",
      viewAllCta: "View Full Audit Lineage & Validity Ledger",
      columns: {
        contract: "CONTRACT / PROTOCOL",
        network: "ENVIRONMENT",
        vector: "AUDIT VECTOR",
        cvss: "CVSS SCORE",
        hash: "SHA-256 HASH",
        status: "STATUS",
      },
      rows: [
        {
          name: "USD Coin (Circle)",
          symbol: "USDC",
          address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          network: "Ethereum Mainnet",
          vector: "Proxy Lineage & Blacklist Audit",
          cvss: "0.0",
          severity: "Secure",
          hash: "8f9b4c21...a34e",
          status: "CURRENT",
        },
        {
          name: "Uniswap V3 Factory",
          symbol: "UNI-V3",
          address: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
          network: "Ethereum Mainnet",
          vector: "AMM Pool Math & Mutex Invariant",
          cvss: "0.0",
          severity: "Secure",
          hash: "3c1a9e88...99d1",
          status: "CURRENT",
        },
        {
          name: "Aave V3 Lending Pool",
          symbol: "AAVE-V3",
          address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          network: "Ethereum Mainnet",
          vector: "Oracle Feed & Flashloan Resilience",
          cvss: "0.2",
          severity: "Low",
          hash: "e57b019a...120f",
          status: "CURRENT",
        },
        {
          name: "Wrapped Ether",
          symbol: "WETH",
          address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          network: "Ethereum Mainnet",
          vector: "Canonical Bytecode Integrity Match",
          cvss: "0.0",
          severity: "Secure",
          hash: "b44fa712...882c",
          status: "CURRENT",
        },
      ],
    },
    workflow: {
      kicker: "CORE PRODUCT METHODOLOGY",
      title: "From Raw Bytecode to Defensive Execution",
      subtitle:
        "The Velmère intelligence loop transforms noisy multi-chain telemetry into deterministic, court-grade security decisions.",
      steps: [
        {
          step: "01",
          title: "Discover",
          desc: "Autonomous ingestion across 50+ canonical digital assets, mempool transaction queues, cross-venue order books, and newly deployed bytecode.",
          points: [
            "Multi-RPC continuous polling",
            "Mempool depth & spoofing radar",
            "Cross-chain contract registry",
          ],
        },
        {
          step: "02",
          title: "Analyze",
          desc: "Deep decompilation, proxy lineage resolution, privileged access analysis (mint, pause, blacklist, drain), and automated economic attack simulations.",
          points: [
            "Formal EVM invariant fuzzing",
            "Upgradeability & timelock audits",
            "TWAP manipulation resilience",
          ],
        },
        {
          step: "03",
          title: "Verify",
          desc: "Every finding is anchored in cryptographic evidence. State snapshots, SHA-256 digests, and physical audit logs replace subjective ratings.",
          points: [
            "SHA-256 state snapshots",
            "CVSS v3.1 quantitative severity",
            "Zero unverifiable claims",
          ],
        },
        {
          step: "04",
          title: "Monitor",
          desc: "Continuous validity tracking. When bytecode mutates, proxy implementations upgrade, or market liquidity evaporates, assessments automatically invalidate.",
          points: [
            "Autonomous CURRENT / OUTDATED states",
            "Differential score drift tracking",
            "Institutional alert webhooks",
          ],
        },
      ],
    },
    surfaces: {
      kicker: "INTELLIGENCE PLATFORM SURFACES",
      title: "Three Specialised Command Environments",
      subtitle:
        "Engineered for asset managers, security auditors, quants, and capital allocators requiring unfalsifiable market truth.",
      items: [
        {
          id: "shield",
          badge: "CRYPTO & CONTRACTS",
          title: "Velmère Shield",
          desc: "The primary digital asset security terminal. Real-time risk vectors, liquidity topology, whale concentration, and candle analysis.",
          href: "/shield",
          cta: "Launch Shield",
          features: [
            "50+ Canonical assets",
            "Deterministic 0–100 scale",
            "Real-time OHLC candles",
          ],
        },
        {
          id: "real-markets",
          badge: "MACRO & CROSS-ASSET",
          title: "Real Markets",
          desc: "Unified cross-asset radar covering equities, FX, commodities, ETFs, and macro indicators alongside crypto.",
          href: "/real-markets",
          cta: "Launch Real Markets",
          features: [
            "Synchronous source rhythm",
            "Cross-exchange consensus",
            "Zero synthetic interpolation",
          ],
        },
        {
          id: "atelier",
          badge: "RESEARCH & ATELIER",
          title: "Velmère Atelier",
          desc: "Exclusive luxury craftsmanship and advanced security research space, proprietary silhouettes, and worldwide nodes.",
          href: "/atelier",
          cta: "Enter Atelier",
          features: [
            "Interactive network map",
            "Architectural silhouettes",
            "Worldwide production nodes",
          ],
        },
      ],
    },
    axioms: {
      kicker: "GOVERNING PRINCIPLES",
      title: "The Velmère Assurance Standard",
      desc: "Our systems are built on uncompromising epistemological rules. We deliver verified truth, never statistical conjecture.",
      rules: [
        {
          title: "No Evidence -> No Fact",
          body: "If a security assertion cannot be cryptographically proven or grounded in direct on-chain observation, it is excluded from positive claims.",
        },
        {
          title: "No Fake Completion",
          body: "Unknown values are explicitly preserved as UNKNOWN or NOT_APPLICABLE. We never manufacture placeholders to falsely inflate coverage indicators.",
        },
        {
          title: "Truth Over Coverage",
          body: "100% obtainable verified data will always supersede 100% fabricated completeness. Denominators reflect only methodologically applicable fields.",
        },
        {
          title: "Deterministic Invalidation",
          body: "An assessment is only CURRENT while all underlying code and market assumptions remain true. Proxy upgrades trigger instant re-evaluation.",
        },
      ],
    },
  },
  pl: {
    hero: {
      badge: "AUTONOMICZNA ANALITYKA & OCHRONA KAPITAŁU ON-CHAIN",
      title: "Weryfikowalne Dowody.",
      titleHighlight: "Czysta Prawda o Rynku.",
      subtitle:
        "Zaawansowany skaner smart kontraktów, audyt podatności w bajtkodzie i przejrzystość płynności w czasie rzeczywistym. Zero domysłów — tylko czyste fakty on-chain.",
      pills: [
        "Weryfikacja EVM w Czasie Rzeczywistym",
        "Deterministyczna Ocena Ryzyka CVSS",
        "Zero Zmyślonych Danych",
      ],
    },
    metrics: [
      {
        value: "100%",
        label: "Deterministyczna Analiza",
        desc: "Zero zmyślonych podatności (0 LLM Hallucinations)",
      },
      {
        value: "12+",
        label: "Wielosieciowy Zasięg EVM",
        desc: "Ciągły monitoring RPC, mempoolu i kolejki transakcji",
      },
      {
        value: "30/30",
        label: "Formalnych Reguł CVSS",
        desc: "Fuzzing niezmienników, testy reentrancy i proxy traps",
      },
      {
        value: "SHA-256",
        label: "Kryptograficzny Ślad Dowodowy",
        desc: "Niezmienny rejestr snapshotów powiązany z blokiem",
      },
    ],
    ledger: {
      kicker: "TELEMETRIA DOWODOWA ON-CHAIN",
      title: "Ostatnio Zweryfikowane Kontrakty & Rejestr Dowodów",
      subtitle:
        "Ciągła telemetria on-chain — każdy kontrakt posiada audytowalną sygnaturę kryptograficzną powiązaną z bajtkodem.",
      viewAllCta: "Zobacz Pełną Historię Audytów i Linii Dowodowej",
      columns: {
        contract: "KONTRAKT / PROTOKÓŁ",
        network: "ŚRODOWISKO",
        vector: "WEKTOR AUDYTU",
        cvss: "WYNIK CVSS",
        hash: "SKRÓT SHA-256",
        status: "STATUS",
      },
      rows: [
        {
          name: "USD Coin (Circle)",
          symbol: "USDC",
          address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          network: "Ethereum Mainnet",
          vector: "Proxy Lineage & Blacklist Audit",
          cvss: "0.0",
          severity: "Bezpieczny",
          hash: "8f9b4c21...a34e",
          status: "CURRENT",
        },
        {
          name: "Uniswap V3 Factory",
          symbol: "UNI-V3",
          address: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
          network: "Ethereum Mainnet",
          vector: "AMM Pool Math & Mutex Invariant",
          cvss: "0.0",
          severity: "Bezpieczny",
          hash: "3c1a9e88...99d1",
          status: "CURRENT",
        },
        {
          name: "Aave V3 Lending Pool",
          symbol: "AAVE-V3",
          address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          network: "Ethereum Mainnet",
          vector: "Oracle Feed & Flashloan Resilience",
          cvss: "0.2",
          severity: "Niski",
          hash: "e57b019a...120f",
          status: "CURRENT",
        },
        {
          name: "Wrapped Ether",
          symbol: "WETH",
          address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          network: "Ethereum Mainnet",
          vector: "Canonical Bytecode Integrity Match",
          cvss: "0.0",
          severity: "Bezpieczny",
          hash: "b44fa712...882c",
          status: "CURRENT",
        },
      ],
    },
    workflow: {
      kicker: "METODOLOGIA PRODUKTOWA",
      title: "Od Surowego Bajtkodu do Decyzji Obronnej",
      subtitle:
        "Pętla analityczna Velmère przekształca wielosieciową telemetrię w deterministyczne, audytowalne decyzje bezpieczeństwa.",
      steps: [
        {
          step: "01",
          title: "Odkrywaj",
          desc: "Ciągły monitoring ponad 50 kanonicznych aktywów cyfrowych, kolejki transakcji mempool, arkuszy zleceń i nowo wdrożonego bajtkodu.",
          points: [
            "Wielosieciowe odpytywanie RPC",
            "Radar głębokości mempoolu i spoofingu",
            "Katalog kontraktów wielołańcuchowych",
          ],
        },
        {
          step: "02",
          title: "Analizuj",
          desc: "Głęboka dekompilacja, badanie linii proxy, uprawnień uprzywilejowanych (mint, pause, blacklist, drain) i symulacje manipulacji pulami płynności.",
          points: [
            "Testowanie niezmienników EVM",
            "Audyt timelocków i upgradeability",
            "Odporność na ataki TWAP",
          ],
        },
        {
          step: "03",
          title: "Weryfikuj",
          desc: "Każdy wniosek jest zakotwiczony w dowodach kryptograficznych. Migawki stanu, skróty SHA-256 i fizyczne logi zastępują subiektywne opinie.",
          points: [
            "Kryptograficzne migawki SHA-256",
            "Ilościowa ocena wag CVSS v3.1",
            "Brak niezweryfikowanych deklaracji",
          ],
        },
        {
          step: "04",
          title: "Monitoruj",
          desc: "Ciągłe śledzenie ważności. Gdy kod kontraktu ulega zmianie lub wyparowuje płynność, ocena natychmiast przechodzi w stan OUTDATED.",
          points: [
            "Automatyczne stany CURRENT / OUTDATED",
            "Śledzenie dryfu ocen ryzyka",
            "Błyskawiczne webhooki alertowe",
          ],
        },
      ],
    },
    surfaces: {
      kicker: "POWIERZCHNIE PLATFORMY",
      title: "Trzy Środowiska Operacyjne",
      subtitle:
        "Zaprojektowane dla inwestorów, audytorów bezpieczeństwa, kwantów i zespołów Web3 wymagających niepodważalnej prawdy rynkowej.",
      items: [
        {
          id: "shield",
          badge: "KRYPTO & KONTRAKTY",
          title: "Velmère Shield",
          desc: "Główny terminal bezpieczeństwa aktywów cyfrowych. Wektory ryzyka w czasie rzeczywistym, topologia płynności, wieloryby i wykresy świecowe.",
          href: "/shield",
          cta: "Uruchom Shield",
          features: [
            "50+ Kanonicznych aktywów",
            "Deterministyczna skala 0–100",
            "Wykresy świecowe OHLC",
          ],
        },
        {
          id: "real-markets",
          badge: "MAKRO & CROSS-ASSET",
          title: "Real Markets",
          desc: "Zunifikowany radar cross-asset obejmujący akcje, waluty FX, surowce, fundusze ETF i wskaźniki makroekonomiczne.",
          href: "/real-markets",
          cta: "Uruchom Real Markets",
          features: [
            "Synchroniczny rytm źródeł",
            "Konsensus cenowy giełd",
            "Zero sztucznej interpolacji",
          ],
        },
        {
          id: "atelier",
          badge: "RZEMIOSŁO & PRODUKT",
          title: "Velmère Atelier",
          desc: "Ekskluzywna przestrzeń rzemiosła luksusowego, autorskie sylwetki, globalna sieć regionalnej produkcji oraz edycje limitowane.",
          href: "/atelier",
          cta: "Wejdź do Atelier",
          features: [
            "Interaktywna mapa sieci rzemiosła",
            "Architektoniczne kroje i materiały",
            "Globalne węzły wykonawcze",
          ],
        },
      ],
    },
    axioms: {
      kicker: "FUNDAMENTY METODOLOGICZNE",
      title: "Standard Zaufania Velmère",
      desc: "Nasze systemy opierają się na bezkompromisowych zasadach epistemologicznych. Dostarczamy wyłącznie dowiedzioną prawdę.",
      rules: [
        {
          title: "Brak Dowodu -> Brak Faktu",
          body: "Jeżeli twierdzenie nie posiada kryptograficznego potwierdzenia w łańcuchu lub zweryfikowanym źródle, nie jest publikowane jako fakt.",
        },
        {
          title: "Brak Fałszywej Kompletności",
          body: "Brakujące pola pozostają jawnie oznaczone jako BRAK DANYCH lub NIE DOTYCZY. Nigdy nie sztukujemy danych dla pozornego 100%.",
        },
        {
          title: "Prawda Ponad Pokryciem",
          body: "100% sprawdzonych danych zawsze przewyższa 100% wymyślonej kompletności. Mianownik uwzględnia tylko pola metodologicznie wymagane.",
        },
        {
          title: "Deterministyczne Unieważnianie",
          body: "Ocena pozostaje AKTUALNA tylko wtedy, gdy kod i warunki rynkowe nie uległy zmianie. Każda mutacja proxy wymusza natychmiastowy re-audyt.",
        },
      ],
    },
  },
  de: {
    hero: {
      badge: "AUTONOME ON-CHAIN INTELLIGENZ & KAPITALVERTEIDIGUNG",
      title: "Verifizierbare Evidenz.",
      titleHighlight: "Reine Marktwahrheit.",
      subtitle:
        "Autonome Smart-Contract-Risikoanalyse, Bytecode-Verifikation und On-Chain-Liquiditätsradar in Echtzeit. Keine Mutmaßungen — nur verifizierte On-Chain-Beweise.",
      pills: [
        "Echtzeit-EVM-Verifikation",
        "Deterministisches CVSS-Scoring",
        "Null synthetische Daten",
      ],
    },
    metrics: [
      {
        value: "100%",
        label: "Deterministische Analyse",
        desc: "Keine erfundenen Schwachstellen (0 LLM-Halluzinationen)",
      },
      {
        value: "12+",
        label: "Multi-Chain-EVM-Abdeckung",
        desc: "Kontinuierliche RPC-, Mempool- und Transaktions-Telemetrie",
      },
      {
        value: "30/30",
        label: "Formale CVSS-Regeln",
        desc: "Invarianten-Fuzzing, Reentrancy-Fallen und Proxy-Prüfungen",
      },
      {
        value: "SHA-256",
        label: "Kryptografische Evidenz",
        desc: "Unveränderliche Zustands-Snapshots gebunden an Blockausführung",
      },
    ],
    ledger: {
      kicker: "ON-CHAIN-EVIDENZ-TELEMETRIE",
      title: "Kürzlich verifizierte Verträge & Evidenz-Hauptbuch",
      subtitle:
        "Kontinuierliche On-Chain-Telemetrie — jeder Vertrag verfügt über eine prüfbare kryptografische Signatur.",
      viewAllCta: "Vollständiges Audit-Hauptbuch anzeigen",
      columns: {
        contract: "VERTRAG / PROTOKOLL",
        network: "UMGEBUNG",
        vector: "AUDIT-VEKTOR",
        cvss: "CVSS-WERT",
        hash: "SHA-256-HASH",
        status: "STATUS",
      },
      rows: [
        {
          name: "USD Coin (Circle)",
          symbol: "USDC",
          address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          network: "Ethereum Mainnet",
          vector: "Proxy-Linie & Blacklist-Audit",
          cvss: "0.0",
          severity: "Sicher",
          hash: "8f9b4c21...a34e",
          status: "CURRENT",
        },
        {
          name: "Uniswap V3 Factory",
          symbol: "UNI-V3",
          address: "0x1f98431c8ad98523631ae4a59f267346ea31f984",
          network: "Ethereum Mainnet",
          vector: "AMM-Pool-Mathematik & Mutex-Invariant",
          cvss: "0.0",
          severity: "Sicher",
          hash: "3c1a9e88...99d1",
          status: "CURRENT",
        },
        {
          name: "Aave V3 Lending Pool",
          symbol: "AAVE-V3",
          address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          network: "Ethereum Mainnet",
          vector: "Oracle-Feed & Flashloan-Resilienz",
          cvss: "0.2",
          severity: "Niedrig",
          hash: "e57b019a...120f",
          status: "CURRENT",
        },
        {
          name: "Wrapped Ether",
          symbol: "WETH",
          address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          network: "Ethereum Mainnet",
          vector: "Kanonischer Bytecode-Integritätsabgleich",
          cvss: "0.0",
          severity: "Sicher",
          hash: "b44fa712...882c",
          status: "CURRENT",
        },
      ],
    },
    workflow: {
      kicker: "PRODUKTMETHODIK",
      title: "Vom Bytecode zur defensiven Entscheidung",
      subtitle:
        "Die Velmère-Intelligenzschleife transformiert rohe Telemetrie in deterministische Sicherheitsentscheidungen.",
      steps: [
        {
          step: "01",
          title: "Entdecken",
          desc: "Kontinuierliche Erfassung von über 50 kanonischen digitalen Assets, Mempool-Transaktionen und Orderbüchern.",
          points: [
            "Multi-RPC-Polling",
            "Mempool-Tiefe & Radar",
            "Multi-Chain-Vertragsregister",
          ],
        },
        {
          step: "02",
          title: "Analysieren",
          desc: "Tiefendekompilierung, Proxy-Linie, Berechtigungsanalyse und automatisierte wirtschaftliche Angriffssimulationen.",
          points: [
            "Formale EVM-Invariantentests",
            "Upgradeability-Audits",
            "TWAP-Manipulationsschutz",
          ],
        },
        {
          step: "03",
          title: "Verifizieren",
          desc: "Jeder Befund wird kryptografisch verankert. Zustands-Snapshots und SHA-256-Prüfsummen ersetzen subjektive Ratings.",
          points: [
            "SHA-256-Zustands-Snapshots",
            "CVSS v3.1-Schweregrade",
            "Null unverifizierte Behauptungen",
          ],
        },
        {
          step: "04",
          title: "Überwachen",
          desc: "Kontinuierliche Gültigkeitsprüfung. Bei Code-Änderungen oder Liquiditätsschwund wird die Bewertung sofort ungültig.",
          points: [
            "CURRENT / OUTDATED-Zustände",
            "Tracking von Score-Verschiebungen",
            "Institutionelle Alert-Webhooks",
          ],
        },
      ],
    },
    surfaces: {
      kicker: "PLATTFORMOOBERFLÄCHEN",
      title: "Drei spezialisierte Befehlsumgebungen",
      subtitle:
        "Entwickelt für Asset Manager, Sicherheitsprüfer, Quants und Web3-Teams mit höchsten Ansprüchen an verifizierte Marktwahrheit.",
      items: [
        {
          id: "shield",
          badge: "KRYPTO & VERTRÄGE",
          title: "Velmère Shield",
          desc: "Das primäre Sicherheitsterminal für digitale Assets. Risikovektoren in Echtzeit, Liquiditätstopologie und Kerzen-Charts.",
          href: "/shield",
          cta: "Shield starten",
          features: [
            "50+ Kanonische Assets",
            "Deterministische 0–100-Skala",
            "Echtzeit-OHLC-Kerzen",
          ],
        },
        {
          id: "real-markets",
          badge: "MAKRO & CROSS-ASSET",
          title: "Real Markets",
          desc: "Einheitliches Cross-Asset-Radar für Aktien, FX, Rohstoffe, ETFs und Makroindikatoren parallel zu Krypto.",
          href: "/real-markets",
          cta: "Real Markets starten",
          features: [
            "Synchroner Quellentakt",
            "Börsenübergreifender Konsens",
            "Null synthetische Daten",
          ],
        },
        {
          id: "atelier",
          badge: "HANDWERK & FORSCHUNG",
          title: "Velmère Atelier",
          desc: "Exklusiver Raum für Luxushandwerk und Sicherheitsforschung, eigene Silhouetten und weltweite Produktionsknoten.",
          href: "/atelier",
          cta: "Atelier betreten",
          features: [
            "Interaktive Netzwerkkarte",
            "Architektonische Schnitte",
            "Weltweite Fertigungsknoten",
          ],
        },
      ],
    },
    axioms: {
      kicker: "METHODISCHE GRUNDSÄTZE",
      title: "Der Velmère-Assurance-Standard",
      desc: "Unsere Systeme basieren auf kompromisslosen epistemologischen Regeln. Wir liefern geprüfte Wahrheit, keine Vermutungen.",
      rules: [
        {
          title: "Kein Beweis -> Kein Fakt",
          body: "Wenn eine Sicherheitsbehauptung nicht kryptografisch oder durch direkte On-Chain-Beobachtung gestützt ist, wird sie nicht als Fakt gewertet.",
        },
        {
          title: "Keine falsche Vollständigkeit",
          body: "Fehlende Werte werden explizit als UNKNOWN gekennzeichnet. Wir erfinden niemals Daten, um Quoten zu schönen.",
        },
        {
          title: "Wahrheit vor Abdeckung",
          body: "100% verifizierte Daten übertreffen 100% erfundene Vollständigkeit. Der Nenner umfasst nur anwendbare Felder.",
        },
        {
          title: "Deterministische Entwertung",
          body: "Eine Bewertung ist nur solange CURRENT, wie Code und Marktumfeld unverändert bleiben. Proxy-Updates führen zur Neuanalyse.",
        },
      ],
    },
  },
};

export default function HomePageClient() {
  const locale = useLocale();
  const safeLocale: Locale = locale === "pl" || locale === "de" ? locale : "en";
  const t = CONTENT[safeLocale];

  const gridRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      rafId = requestAnimationFrame(() => {
        const x = e.clientX;
        const y = e.clientY;
        const mask = `radial-gradient(340px circle at ${x}px ${y}px, black 0%, transparent 80%)`;
        const glow = `radial-gradient(480px circle at ${x}px ${y}px, rgba(200, 169, 106, 0.08) 0%, rgba(56, 189, 248, 0.02) 40%, transparent 75%)`;

        if (gridRef.current) {
          gridRef.current.style.maskImage = mask;
          gridRef.current.style.webkitMaskImage = mask;
          gridRef.current.style.opacity = "1";
        }
        if (spotlightRef.current) {
          spotlightRef.current.style.background = glow;
          spotlightRef.current.style.opacity = "1";
        }
      });
    };

    const handleMouseLeave = () => {
      if (gridRef.current) gridRef.current.style.opacity = "0";
      if (spotlightRef.current) spotlightRef.current.style.opacity = "0";
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[#040406] text-velmere-ivory selection:bg-velmere-gold/25 overflow-x-hidden">
      {/* Interactive Cursor Spotlight Radial Glow (clean: tracks cursor smoothly) */}
      <div
        ref={spotlightRef}
        className="pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-500"
        aria-hidden="true"
      />

      {/* Interactive Cursor-Tracked Cyber Grid (Clean: only reveals under mouse movement) */}
      <div
        ref={gridRef}
        className="interactive-cursor-grid pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-500"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(200, 169, 106, 0.16) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(200, 169, 106, 0.16) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
        aria-hidden="true"
      />

      {/* Hero Section */}
      <section className="relative px-5 pt-32 pb-16 md:px-10 md:pt-40 md:pb-24">
        {/* Soft Atmospheric Radial Light in Hero Center */}
        <div
          className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 h-[420px] w-[600px] sm:w-[840px] rounded-full opacity-30 blur-[120px]"
          style={{
            background:
              "radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(56, 189, 248, 0.06) 45%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Top Badge: Clean Minimalist Pill with Pulsing Live Dot */}
          <Reveal delay={0.05}>
            <Link
              href="/shield"
              className="group inline-flex items-center gap-2.5 rounded-full border border-velmere-gold/25 bg-velmere-gold/[0.04] px-4 py-1.5 text-xs font-medium text-velmere-gold backdrop-blur-md transition-all duration-300 hover:border-velmere-gold/50 hover:bg-velmere-gold/[0.08] hover:shadow-[0_0_24px_rgba(212,175,55,0.15)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="tracking-wide">{t.hero.badge}</span>
              <ArrowRight className="h-3.5 w-3.5 text-velmere-gold/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-velmere-gold" />
            </Link>
          </Reveal>

          {/* Monumental Clean Title */}
          <Reveal delay={0.1}>
            <h1 className="mt-8 text-4xl font-light tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
              {t.hero.title}{" "}
              <span className="mt-3 block font-serif italic text-velmere-gold drop-shadow-[0_4px_30px_rgba(212,175,55,0.3)]">
                {t.hero.titleHighlight}
              </span>
            </h1>
          </Reveal>

          {/* Clean Subtitle */}
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg sm:leading-relaxed font-light">
              {t.hero.subtitle}
            </p>
          </Reveal>

          {/* Invariant Trust Proof Pills */}
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-white/45">
              {t.hero.pills.map((pill) => (
                <div key={pill} className="inline-flex items-center gap-2 transition-colors hover:text-white/70">
                  <CheckCircle2 className="h-3.5 w-3.5 text-velmere-gold/80" />
                  <span>{pill}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Intelligence Flow Hero (DATA -> ANALYSIS -> EVIDENCE -> RISK -> DECISION) */}
        <div className="mt-14">
          <IntelligenceFlowHero locale={safeLocale} />
        </div>
      </section>

      {/* Enterprise Metrics Strip (Scale & Authority) */}
      <section className="border-y border-white/10 bg-[#060608]">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 md:py-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.metrics.map((m) => (
              <div
                key={m.label}
                className="group relative rounded-xl border border-white/5 bg-white/[0.015] p-5 transition-all duration-300 hover:border-velmere-gold/30 hover:bg-white/[0.03] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
              >
                <div className="font-mono text-2xl font-light text-velmere-gold transition-colors duration-200 group-hover:text-velmere-gold-light md:text-3xl">
                  {m.value}
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {m.label}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {m.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Verifiable Audit Ledger & Telemetry Feed */}
      <section className="border-b border-white/5 bg-[#040406] px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-velmere-gold uppercase">
                {t.ledger.kicker}
              </p>
              <h2 className="mt-2 text-2xl font-light text-white md:text-3xl">
                {t.ledger.title}
              </h2>
              <p className="mt-2 text-xs text-white/50 md:text-sm">
                {t.ledger.subtitle}
              </p>
            </div>
            <Link
              href="/security/audits"
              className="inline-flex items-center gap-2 text-xs font-medium text-velmere-gold transition hover:text-white"
            >
              <span>{t.ledger.viewAllCta}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#09090c]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                <tr>
                  <th className="px-5 py-3.5">{t.ledger.columns.contract}</th>
                  <th className="px-5 py-3.5">{t.ledger.columns.network}</th>
                  <th className="px-5 py-3.5">{t.ledger.columns.vector}</th>
                  <th className="px-5 py-3.5">{t.ledger.columns.cvss}</th>
                  <th className="px-5 py-3.5">{t.ledger.columns.hash}</th>
                  <th className="px-5 py-3.5 text-right">{t.ledger.columns.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {t.ledger.rows.map((row) => (
                  <tr key={row.address} className="transition duration-150 hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="font-sans text-xs font-medium text-white">{row.name}</div>
                      <div className="text-[10px] text-white/40">
                        {row.symbol} • {row.address.slice(0, 6)}...{row.address.slice(-4)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white/60">{row.network}</td>
                    <td className="px-5 py-4 font-sans text-white/70">{row.vector}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        CVSS {row.cvss} ({row.severity})
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[10px] text-velmere-gold/80">{row.hash}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Specialized Surfaces Section (4 Command Environments) */}
      <section className="bg-[#060608] px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14">
            <p className="text-[11px] font-semibold tracking-widest text-velmere-gold uppercase">
              {t.surfaces.kicker}
            </p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-4xl">
              {t.surfaces.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
              {t.surfaces.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {t.surfaces.items.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#09090c] p-8 transition-all duration-300 hover:border-velmere-gold/40 hover:bg-[#0c0c11] hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(200,169,106,0.06)]"
              >
                {/* Subtle top border accent on hover */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-velmere-gold/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div>
                  <div className="inline-block rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold tracking-widest text-velmere-gold uppercase transition-colors duration-200 group-hover:border-velmere-gold/30 group-hover:bg-velmere-gold/[0.06]">
                    {item.badge}
                  </div>
                  <h3 className="mt-5 text-2xl font-light text-white transition-colors duration-200 group-hover:text-velmere-gold">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/50">
                    {item.desc}
                  </p>

                  <div className="mt-6 border-t border-white/5 pt-5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {item.features.map((feat) => (
                        <div
                          key={feat}
                          className="rounded-lg bg-white/[0.02] p-2.5 text-center text-xs text-white/60 transition-colors duration-200 group-hover:text-white/80 group-hover:bg-white/[0.04]"
                        >
                          {feat}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-2 text-sm font-medium text-velmere-gold transition duration-200 group-hover:translate-x-1.5"
                  >
                    <span>{item.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section: DISCOVER -> ANALYZE -> VERIFY -> MONITOR */}
      <section className="border-t border-white/5 bg-[#040406] px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold tracking-widest text-velmere-gold uppercase">
              {t.workflow.kicker}
            </p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-4xl">
              {t.workflow.title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
              {t.workflow.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {t.workflow.steps.map((st) => (
              <div
                key={st.step}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.015] p-6 transition-all duration-300 hover:border-velmere-gold/30 hover:bg-white/[0.03] hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(0,0,0,0.6)]"
              >
                {/* Subtle top border accent on hover */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-velmere-gold/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div>
                  <span className="font-mono text-xs font-semibold text-velmere-gold transition-colors duration-200 group-hover:text-velmere-gold-light">
                    {st.step}
                  </span>
                  <h3 className="mt-4 text-lg font-medium text-white transition-colors duration-200 group-hover:text-velmere-gold">
                    {st.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-white/50">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4">
                  <ul className="space-y-2 text-[11px] text-white/40">
                    {st.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-velmere-gold transition-transform duration-200 group-hover:scale-125" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Governing Axioms / Epistemic Standard */}
      <section className="border-t border-white/5 bg-[#060608] px-5 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="text-[11px] font-semibold tracking-widest text-velmere-gold uppercase">
              {t.axioms.kicker}
            </p>
            <h2 className="mt-3 text-3xl font-light text-white md:text-4xl">
              {t.axioms.title}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/50 md:text-base">
              {t.axioms.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.axioms.rules.map((rule) => (
              <div
                key={rule.title}
                className="group relative rounded-2xl border border-white/5 bg-white/[0.015] p-6 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.03] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
              >
                <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-velmere-gold/10 text-velmere-gold transition-colors duration-200 group-hover:bg-velmere-gold/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-base font-medium text-white transition-colors duration-200 group-hover:text-velmere-gold">
                  {rule.title}
                </h3>
                <p className="mt-2.5 text-xs leading-relaxed text-white/50">
                  {rule.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
