export type HumanCopyTone = "calm" | "review" | "warning" | "blocked";

export type HumanCopyExample = {
  id: string;
  lane: "liquidity" | "source" | "exchange" | "reserve" | "withdrawals" | "volatility" | "cross_asset";
  rawSignal: string;
  humanCopy: string;
  operatorMeaning: string;
  tone: HumanCopyTone;
  forbiddenCopy: string;
};

export type HumanCopyEngineOutput = {
  version: "PASS333.ai_human_copy_engine";
  headline: string;
  boundary: string;
  examples: HumanCopyExample[];
  botRules: string[];
  dictionary: Record<string, string>;
};

const dictionary: Record<string, string> = {
  "calm prescreen":
    "Wstępny skan nie widzi mocnego alarmu, ale dane nadal wymagają potwierdzenia.",
  "verify sources":
    "Przed mocniejszym opisem trzeba sprawdzić świeżość źródeł.",
  "pressure 25/100":
    "Napięcie jest niskie, ale nie jest to gwarancja bezpieczeństwa.",
  "liquidity proof lane":
    "Płynność wygląda częściowo stabilnie, ale brakuje pełnego potwierdzenia głębokości rynku.",
  "vesting proof needed":
    "Harmonogram odblokowań wymaga potwierdzenia w wiarygodnym źródle.",
  "no book":
    "Brakuje widocznej książki zleceń dla tej pary albo źródło jest chwilowo niedostępne.",
  "source freshness":
    "Najważniejsze jest, czy dane są świeże i z jakiego źródła pochodzą.",
  "second-source divergence":
    "Jedno źródło pokazuje inną sytuację niż drugie, więc bot zatrzymuje mocniejszy wniosek.",
  "reserve/liability gap":
    "Rezerwy bez pełnego kontekstu zobowiązań nie wystarczą do oceny kondycji giełdy.",
  "withdrawal stress":
    "Wypłaty albo status usług wymagają dodatkowego sprawdzenia, zanim pojawi się mocniejszy komunikat.",
};

const examples: HumanCopyExample[] = [
  {
    id: "liquidity-proof-lane",
    lane: "liquidity",
    rawSignal: "liquidity proof lane unavailable",
    humanCopy:
      "Płynność wygląda częściowo stabilnie, ale bot nie ma jeszcze pełnego potwierdzenia głębokości rynku.",
    operatorMeaning:
      "Orderbook/depth adapter is missing, stale or not second-sourced. Do not reduce risk only because price looks calm.",
    tone: "review",
    forbiddenCopy: "Liquidity is safe / guaranteed exits / buy now.",
  },
  {
    id: "calm-prescreen",
    lane: "source",
    rawSignal: "calm prescreen, verify sources · pressure 25/100",
    humanCopy:
      "Wstępny skan nie pokazuje mocnego alarmu. Przed mocniejszym opisem trzeba jeszcze potwierdzić świeżość źródeł.",
    operatorMeaning:
      "Low visible pressure, but source freshness, holder/depth/contract gaps still matter.",
    tone: "calm",
    forbiddenCopy: "Safe token / no risk / confirmed clean.",
  },
  {
    id: "exchange-health",
    lane: "exchange",
    rawSignal: "venue anomaly pressure + second-source divergence",
    humanCopy:
      "Jedna giełda pokazuje odchylenie względem innych źródeł. Bot oznacza to jako obserwację, nie jako oskarżenie.",
    operatorMeaning:
      "Compare Binance/MEXC/Coinbase/Kraken before public wording. Venue-specific anomaly is not collapse evidence.",
    tone: "warning",
    forbiddenCopy: "This exchange is collapsing / next FTX.",
  },
  {
    id: "reserve-gap",
    lane: "reserve",
    rawSignal: "reserve/liability gap",
    humanCopy:
      "Sama informacja o rezerwach nie wystarcza. Do spokojnej oceny potrzebny jest też kontekst zobowiązań i czasu publikacji.",
    operatorMeaning:
      "PoR-style snapshot must be separated from liabilities, off-chain obligations and timestamp expiry.",
    tone: "review",
    forbiddenCopy: "Fully solvent / guaranteed reserves / proof of safety.",
  },
  {
    id: "withdrawal-stress",
    lane: "withdrawals",
    rawSignal: "withdrawal incident lane",
    humanCopy:
      "Status wypłat wymaga dodatkowego sprawdzenia. Bot nie wyciąga wniosków bez potwierdzenia z kilku źródeł.",
    operatorMeaning:
      "Incident/status data needs source ledger and cooldown before public copy changes.",
    tone: "warning",
    forbiddenCopy: "Withdraw immediately / panic / exchange is failing.",
  },
  {
    id: "real-estate-macro",
    lane: "cross_asset",
    rawSignal: "real estate macro stress lane",
    humanCopy:
      "Rynek nieruchomości działa wolniej niż crypto, dlatego bot traktuje go jako tło makro, a nie szybki sygnał wejścia.",
    operatorMeaning:
      "FRED/FHFA/REIT data has lower cadence; use as macro stress context only.",
    tone: "calm",
    forbiddenCopy: "Trade this now / guaranteed crash / guaranteed rebound.",
  },
];

export function humanizeShieldCopy(raw: string) {
  const clean = raw.trim();
  if (!clean) return "Bot czeka na dane źródłowe, zanim przygotuje opis dla użytkownika.";
  const lower = clean.toLowerCase();
  const matched = Object.entries(dictionary).find(([key]) => lower.includes(key));
  if (matched) return matched[1];
  if (/collapse|bankrupt|next ftx|upada/i.test(clean)) {
    return "Bot widzi sygnał stresu, ale potrzebuje potwierdzenia z kilku źródeł. Publiczny opis nie może być oskarżeniem.";
  }
  if (/depth|orderbook|liquidity/i.test(clean)) {
    return dictionary["liquidity proof lane"];
  }
  if (/reserve|liabilit|por/i.test(clean)) {
    return dictionary["reserve/liability gap"];
  }
  if (/withdraw/i.test(clean)) {
    return dictionary["withdrawal stress"];
  }
  return clean;
}

export function buildAiHumanCopyEngine(): HumanCopyEngineOutput {
  return {
    version: "PASS333.ai_human_copy_engine",
    headline:
      "AI Copy Engine tłumaczy techniczne sygnały Shield na spokojny język dla ludzi.",
    boundary:
      "Publiczny tekst może mówić o obserwacji, świeżości źródeł i brakach danych. Nie może robić paniki, gwarancji, porad inwestycyjnych ani oskarżeń typu next FTX.",
    examples,
    dictionary,
    botRules: [
      "Najpierw wyjaśnij człowiekowi co bot widzi, dopiero potem pokaż techniczny szczegół operatorowi.",
      "Brak danych zwiększa niepewność; nie zamienia się w pozytywny werdykt.",
      "Jedna giełda lub jeden adapter nie wystarcza do mocnego publicznego wniosku.",
      "FOMO odwracamy w cierpliwość: proof, freshness i source quorum zamiast presji.",
      "Każdy opis ma kończyć się następnym spokojnym krokiem: sprawdź źródło, porównaj venue, otwórz pełny Shield.",
    ],
  };
}
