import { sha256Token } from "../security/cryptographic-digest";
import {
  pageCountForDepth,
  type LensTierPageCount,
} from "./lens-tier-page-count";
export type Pass488Locale = "pl" | "de" | "en";
export type Pass488Depth = "basic" | "pro" | "advanced";
export type Pass488PageId = "decision" | "evidence" | "analysis" | "boundary";

export type Pass488A4Page = {
  id: Pass488PageId;
  index: 1 | 2 | 3 | 4;
  label: string;
  shortLabel: string;
  anchor: `lens-reader-page-${Pass488PageId}`;
  purpose: string;
};

export type Pass488A4DecisionCockpit = {
  version: "a4-decision-cockpit";
  pageCount: LensTierPageCount;
  readerPageCount: LensTierPageCount;
  binaryPageCount: LensTierPageCount;
  parity: "one-payload-one-layout";
  parityKey: string;
  depth: Pass488Depth;
  pages: Pass488A4Page[];
  labels: {
    navigation: string;
    parity: string;
    page: string;
  };
};

type Input = {
  locale: Pass488Locale;
  symbol: string;
  generatedAt: string;
  depth: Pass488Depth;
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
  checksum: string;
  fieldBudget: number;
};

const copy = {
  pl: {
    navigation: "Nawigacja dokumentu",
    parity: "Podgląd i pobrany PDF korzystają z tego samego układu oraz danych.",
    page: "Strona",
    pages: [
      ["Decyzja", "Decyzja", "Najważniejszy wniosek, zakres raportu i granica pewności."],
      ["Dowody", "Dowody", "Rejestr źródeł, świeżość i jawne braki danych."],
      ["Analiza", "Analiza", "Pola Basic, Pro lub Advanced z czytelnym wyjaśnieniem."],
      ["Granice", "Granice", "Niepewność, następny test i podpis Velmère Security Automated Analysis."],
    ],
  },
  de: {
    navigation: "Dokumentnavigation",
    parity: "Vorschau und Download verwenden dasselbe Layout und dieselben Daten.",
    page: "Seite",
    pages: [
      ["Entscheidung", "Entscheid.", "Kernaussage, Berichtstiefe und Konfidenzgrenze."],
      ["Evidenz", "Evidenz", "Quellenregister, Aktualität und sichtbare Datenlücken."],
      ["Analyse", "Analyse", "Basic-, Pro- oder Advanced-Felder mit verständlicher Einordnung."],
      ["Grenzen", "Grenzen", "Unsicherheit, nächster Test und Velmère-Security-Signatur für automatisierte Analyse."],
    ],
  },
  en: {
    navigation: "Document navigation",
    parity: "Preview and downloaded PDF use the same layout and evidence payload.",
    page: "Page",
    pages: [
      ["Decision", "Decision", "Primary read, report depth and confidence boundary."],
      ["Evidence", "Evidence", "Source ledger, freshness and explicit missing data."],
      ["Analysis", "Analysis", "Basic, Pro or Advanced fields with plain-language explanation."],
      ["Boundary", "Boundary", "Uncertainty, next verification step and Velmère Security Automated Analysis signature."],
    ],
  },
} as const;

function hash(input: string) {
  return sha256Token(input, 16);
}

export function buildPass488A4DecisionCockpit(input: Input): Pass488A4DecisionCockpit {
  const c = copy[input.locale];
  const pageCount = pageCountForDepth(input.depth);
  const ids: Pass488PageId[] = ["decision", "evidence", "analysis", "boundary"];
  const pages = ids.map((id, index) => {
    const pageCopy = c.pages[index];
    return {
      id,
      index: (index + 1) as 1 | 2 | 3 | 4,
      label: pageCopy[0],
      shortLabel: pageCopy[1],
      purpose: pageCopy[2],
      anchor: `lens-reader-page-${id}` as const,
    };
  });
  const parityKey = `VLM-${hash([
    input.symbol.toUpperCase(),
    input.generatedAt,
    input.depth,
    input.sourceConfidence,
    input.sourceCount,
    input.missingDataCount,
    input.checksum,
    input.fieldBudget,
    pageCount,
  ].join("|"))}`;

  return {
    version: "a4-decision-cockpit",
    pageCount,
    readerPageCount: pageCount,
    binaryPageCount: pageCount,
    parity: "one-payload-one-layout",
    parityKey,
    depth: input.depth,
    pages,
    labels: {
      navigation: c.navigation,
      parity: c.parity,
      page: c.page,
    },
  };
}
