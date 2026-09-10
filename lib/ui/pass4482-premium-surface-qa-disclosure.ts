export type Pass4482Locale = "pl" | "en" | "de";
export type Pass4482Surface = "shield" | "real-markets" | "shield-pro" | "audit";

export type Pass4482DisclosureCopy = {
  title: string;
  summary: string;
  badge: string;
  items: string[];
};

const copy: Record<Pass4482Locale, Record<Pass4482Surface, Pass4482DisclosureCopy>> = {
  pl: {
    shield: {
      title: "Screen QA",
      summary: "Kontrakt ze screenów jest schowany w jednym spokojnym railu, żeby drawer pozostał czysty jak terminal premium.",
      badge: "PASS4482 · Shield",
      items: ["Real Markets 1:1 density", "prawy drawer", "wykres bez ucięcia", "click-away + Escape"],
    },
    "real-markets": {
      title: "Screen QA",
      summary: "Kontrakt wizualny zostaje dostępny dla QA, ale nie zasłania wykresu, danych ani VLM Analysis.",
      badge: "PASS4482 · Real Markets",
      items: ["asset drawer", "source boundary", "miniwykres endcap", "mobile safe-area"],
    },
    "shield-pro": {
      title: "Operator QA",
      summary: "Risk, liquidity, manipulation i evidence zostają na pierwszym planie; techniczne receipty są zebrane w collapsible rail.",
      badge: "PASS4482 · Shield Pro",
      items: ["no legacy shell", "risk architecture", "local scroll", "source-bound"],
    },
    audit: {
      title: "Audit QA",
      summary: "Premium mockup zostaje czysty, a kontrakty visual/state/receipt są ukryte pod jednym panelem dla operatora.",
      badge: "PASS4482 · Audit",
      items: ["premium hero", "tier delta", "case vault", "receipt boundary"],
    },
  },
  en: {
    shield: {
      title: "Screen QA",
      summary: "The screenshot contract is collapsed into one calm rail so the drawer keeps a premium terminal surface.",
      badge: "PASS4482 · Shield",
      items: ["Real Markets 1:1 density", "right drawer", "chart endcap", "click-away + Escape"],
    },
    "real-markets": {
      title: "Screen QA",
      summary: "The visual contract remains available for QA without covering the chart, data or VLM Analysis.",
      badge: "PASS4482 · Real Markets",
      items: ["asset drawer", "source boundary", "microchart endcap", "mobile safe-area"],
    },
    "shield-pro": {
      title: "Operator QA",
      summary: "Risk, liquidity, manipulation and evidence stay first; technical receipts are grouped in a collapsible rail.",
      badge: "PASS4482 · Shield Pro",
      items: ["no legacy shell", "risk architecture", "local scroll", "source-bound"],
    },
    audit: {
      title: "Audit QA",
      summary: "The premium mockup stays clean while visual/state/receipt contracts sit under one operator panel.",
      badge: "PASS4482 · Audit",
      items: ["premium hero", "tier delta", "case vault", "receipt boundary"],
    },
  },
  de: {
    shield: {
      title: "Screen QA",
      summary: "Der Screenshot-Vertrag liegt in einer ruhigen Rail, damit der Drawer wie ein Premium-Terminal sauber bleibt.",
      badge: "PASS4482 · Shield",
      items: ["Real Markets 1:1 Density", "rechter Drawer", "Chart-Endcap", "Click-away + Escape"],
    },
    "real-markets": {
      title: "Screen QA",
      summary: "Der visuelle Vertrag bleibt für QA verfügbar, ohne Chart, Daten oder VLM Analysis zu verdecken.",
      badge: "PASS4482 · Real Markets",
      items: ["Asset Drawer", "Source Boundary", "Microchart Endcap", "Mobile Safe-Area"],
    },
    "shield-pro": {
      title: "Operator QA",
      summary: "Risk, Liquidity, Manipulation und Evidence bleiben vorne; technische Belege sind in einer collapsible Rail gesammelt.",
      badge: "PASS4482 · Shield Pro",
      items: ["keine Legacy Shell", "Risk Architecture", "lokaler Scroll", "source-bound"],
    },
    audit: {
      title: "Audit QA",
      summary: "Das Premium-Mockup bleibt sauber, während Visual/State/Receipt-Verträge in einem Operator-Panel liegen.",
      badge: "PASS4482 · Audit",
      items: ["Premium Hero", "Tier Delta", "Case Vault", "Receipt Boundary"],
    },
  },
};

export function pass4482Locale(locale: string): Pass4482Locale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

export function buildPass4482DisclosureCopy(locale: string, surface: Pass4482Surface): Pass4482DisclosureCopy {
  return copy[pass4482Locale(locale)][surface];
}
