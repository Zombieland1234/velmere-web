import type { UniversalAssetRow } from "./universal-asset-market-matrix";
import {
  buildPass418MarketCoverageUniverse,
  buildPass418StableAnalysisFields,
  pass418AssetVisualPatch,
  pass418ClampSuggestions,
  pass418PseudoPricePatch,
  pass418SafeText,
  pass418SecurityPlainCopy,
  pass418TerminalCleanroomRuntime,
  type Pass418StableField,
} from "./terminal-cleanroom-runtime";

export const PASS419_RUNTIME_CLOSE_EVENT = "velmere:pass419:terminal-payload-stabilizer-close";

type VisualPatch = { label: string; glyph: string; primary: string; secondary: string; text?: string; logoUrl?: string };
type PseudoPatch = string | number | { price?: string | number; change?: string | number; value?: string | number; label?: string | number; amount?: string | number; source?: string | number; session?: string | number };
type MarketRowInput = Partial<UniversalAssetRow> & Pick<UniversalAssetRow, "id" | "rank" | "symbol" | "name" | "assetClass" | "riskPressure" | "sparkTone">;
export type Pass419StableField = Pass418StableField;

function laneFor(assetClass: UniversalAssetRow["assetClass"]) {
  if (assetClass === "fx") return "FX";
  if (assetClass === "commodity") return "commodity";
  if (assetClass === "real_estate") return "real-estate";
  if (assetClass === "etf") return "ETF";
  if (assetClass === "crypto") return "crypto";
  if (assetClass === "exchange_token") return "exchange-token";
  return "equity";
}

function row(input: MarketRowInput): UniversalAssetRow {
  const lane = laneFor(input.assetClass);
  return {
    sourceRhythm: input.sourceRhythm ?? `${lane} provider cadence · PASS419 stabilizer · official logo authority · no fake-live wording`,
    priceLane: input.priceLane ?? `${lane} OHLCV/kline lane · chart-first modal · dead-zone drag · provider timestamp required`,
    volumeLane: input.volumeLane ?? `${lane} volume/session lane separates market hours, spread, stale state and second-source drift`,
    proofOrDisclosureLane: input.proofOrDisclosureLane ?? `${lane} source lineage + checksum + locale payload + official visual authority`,
    secondSourceLane: input.secondSourceLane ?? "primary provider ↔ second source ↔ checksum ↔ Browser preview ↔ PDF download",
    confidenceFloor: input.confidenceFloor ?? 98,
    adapterState: input.adapterState ?? "provider_required",
    humanCopy: input.humanCopy ?? `${input.symbol} routes through PASS419: max-three search, chart-first modal, source-bound AI and exact Browser/PDF payload parity.`,
    nextAdapterStep: input.nextAdapterStep ?? "Attach official provider adapter, exchange/session calendar, kline/OHLCV cadence, logo authority, source age and checksum.",
    ...input,
  };
}

export const pass419TerminalPayloadStabilizer = {
  ...pass418TerminalCleanroomRuntime,
  version: "PASS419.terminal_payload_stabilizer",
  searchRule: "All search surfaces keep a hard three-result cap, deferred local ranking, stable de-dupe keys and close before modal/download/scroll/route handoff.",
  chartRule: "Real Markets stays chart-first: Basic/Pro/Advanced changes field count only; Orbit is parked until it is a lazy isolated component with its own crash boundary.",
  marketRule: "Real Markets adds broader provider-ready coverage but never labels a row as live until provider timestamp, session calendar and second source are attached.",
  pdfRule: "Browser HTML preview and downloaded PDF mirror one stable payload object, one locale, one field order and one checksum lane.",
  aiRule: "Velmère AI output is source-bound and concise: identity, source state, freshness, second-source drift, security boundary, research boundary and next verification step.",
  latencyRule: "Suggestion ranking uses deferred input and stable normalized keys so typing does not re-rank the full universe every frame.",
} as const;

export const pass419TerminalChartAnchorStabilizer = pass419TerminalPayloadStabilizer;

export function pass419SafeText(value: unknown, fallback = "—"): string {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : fallback;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return fallback;
  if (Array.isArray(value)) {
    const text = value.map((entry) => pass419SafeText(entry, "")).filter(Boolean).join(" · ");
    return text || fallback;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("price" in record || "change" in record) {
      const price = pass419SafeText(record.price, "");
      const change = pass419SafeText(record.change, "");
      const joined = [price, change].filter(Boolean).join(" · ");
      return joined || fallback;
    }
    const preferred = [record.value, record.label, record.amount, record.state, record.source, record.session]
      .map((entry) => pass419SafeText(entry, ""))
      .filter(Boolean);
    return preferred.join(" · ") || pass418SafeText(value, fallback);
  }
  return pass418SafeText(value, fallback);
}

export function pass419NormalizeSuggestionKey(value: string): string {
  return value.replace(/[^a-z0-9./:_-]+/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function pass419ClampSuggestions<T>(items: T[], keyOf: (item: T) => string, limit = 3): T[] {
  const seen = new Set<string>();
  const normalized: T[] = [];
  for (const item of items) {
    const key = pass419NormalizeSuggestionKey(keyOf(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
    if (normalized.length >= Math.min(3, Math.max(1, limit))) break;
  }
  return pass418ClampSuggestions(normalized, keyOf, Math.min(3, Math.max(1, limit)));
}

export const pass419AssetVisualPatch: Record<string, VisualPatch> = {
  ...pass418AssetVisualPatch,
  VTI: { label: "Vanguard Total Stock Market", glyph: "VT", primary: "#111827", secondary: "#93c5fd" },
  VOO: { label: "Vanguard S&P 500", glyph: "VO", primary: "#0f172a", secondary: "#60a5fa" },
  EFA: { label: "Developed Markets ETF", glyph: "EF", primary: "#1e3a8a", secondary: "#facc15" },
  EEM: { label: "Emerging Markets ETF", glyph: "EM", primary: "#064e3b", secondary: "#86efac" },
  HYG: { label: "High Yield Bond ETF", glyph: "HY", primary: "#713f12", secondary: "#fde68a" },
  TLT: { label: "20Y Treasury ETF", glyph: "TL", primary: "#0f172a", secondary: "#d1d5db" },
  BUND: { label: "German Bund proxy", glyph: "BD", primary: "#111827", secondary: "#facc15" },
  "EUR/CHF": { label: "Euro / Swiss Franc", glyph: "€F", primary: "#dc2626", secondary: "#f8fafc", text: "#111" },
  "EUR/GBP": { label: "Euro / Pound", glyph: "€£", primary: "#1e3a8a", secondary: "#dc2626" },
  "AUD/USD": { label: "Australian Dollar / Dollar", glyph: "AU", primary: "#0f766e", secondary: "#facc15" },
  "NZD/USD": { label: "New Zealand Dollar / Dollar", glyph: "NZ", primary: "#0f172a", secondary: "#38bdf8" },
  "USD/SGD": { label: "Dollar / Singapore Dollar", glyph: "$S", primary: "#dc2626", secondary: "#f8fafc", text: "#111" },
  ALUMINUM: { label: "Aluminum reference", glyph: "AL", primary: "#e5e7eb", secondary: "#111827", text: "#111" },
  COFFEE: { label: "Coffee reference", glyph: "CF", primary: "#7c2d12", secondary: "#fed7aa" },
  SUGAR: { label: "Sugar reference", glyph: "SG", primary: "#f8fafc", secondary: "#14b8a6", text: "#111" },
  CORN: { label: "Corn reference", glyph: "CN", primary: "#ca8a04", secondary: "#fef3c7", text: "#111" },
  VNQ: { label: "Vanguard Real Estate ETF", glyph: "VQ", primary: "#0f766e", secondary: "#f8fafc" },
  IYR: { label: "US Real Estate ETF", glyph: "IY", primary: "#1e293b", secondary: "#38bdf8" },
  O: { label: "Realty Income", glyph: "O", primary: "#1e3a8a", secondary: "#f8fafc" },
  PSA: { label: "Public Storage", glyph: "PS", primary: "#f97316", secondary: "#111827" },
  FTNT: { label: "Fortinet", glyph: "FT", primary: "#b91c1c", secondary: "#111827" },
  NET: { label: "Cloudflare", glyph: "CF", primary: "#f97316", secondary: "#111827" },
  NOW: { label: "ServiceNow", glyph: "NW", primary: "#16a34a", secondary: "#052e16" },
  ARM: { label: "Arm Holdings", glyph: "AR", primary: "#0891b2", secondary: "#0f172a" },
};

export const pass419PseudoPricePatch: Record<string, PseudoPatch> = {
  ...pass418PseudoPricePatch,
  VTI: { price: "$300", change: "total market" },
  VOO: { price: "$560", change: "S&P proxy" },
  EFA: { price: "$82", change: "developed ETF" },
  EEM: { price: "$45", change: "EM ETF" },
  HYG: { price: "$79", change: "credit risk" },
  TLT: { price: "$89", change: "duration" },
  BUND: { price: "provider", change: "rates proxy" },
  "EUR/CHF": { price: "provider", change: "safe-haven FX" },
  "EUR/GBP": { price: "provider", change: "Europe FX" },
  "AUD/USD": { price: "provider", change: "commodity FX" },
  "NZD/USD": { price: "provider", change: "Pacific FX" },
  "USD/SGD": { price: "provider", change: "Asia FX" },
  ALUMINUM: { price: "provider", change: "industrial metal" },
  COFFEE: { price: "provider", change: "soft commodity" },
  SUGAR: { price: "provider", change: "soft commodity" },
  CORN: { price: "provider", change: "grain" },
  VNQ: { price: "$88", change: "US RE ETF" },
  IYR: { price: "$96", change: "real estate ETF" },
  O: { price: "$55", change: "net lease REIT" },
  PSA: { price: "$280", change: "storage REIT" },
  FTNT: { price: "$75", change: "network security" },
  NET: { price: "$88", change: "edge network" },
  NOW: { price: "$760", change: "workflow SaaS" },
  ARM: { price: "$120", change: "semis" },
};

export function buildPass419MarketCoverageUniverse(): UniversalAssetRow[] {
  return [
    ...buildPass418MarketCoverageUniverse(),
    row({ id: "pass419-vti", rank: 1648, symbol: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "etf", riskPressure: 30, sparkTone: "flat" }),
    row({ id: "pass419-voo", rank: 1649, symbol: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "etf", riskPressure: 31, sparkTone: "flat" }),
    row({ id: "pass419-efa", rank: 1650, symbol: "EFA", name: "Developed Markets ETF", assetClass: "etf", riskPressure: 34, sparkTone: "flat" }),
    row({ id: "pass419-eem", rank: 1651, symbol: "EEM", name: "Emerging Markets ETF", assetClass: "etf", riskPressure: 48, sparkTone: "watch" }),
    row({ id: "pass419-hyg", rank: 1652, symbol: "HYG", name: "High Yield Bond ETF", assetClass: "etf", riskPressure: 46, sparkTone: "watch" }),
    row({ id: "pass419-tlt", rank: 1653, symbol: "TLT", name: "20Y Treasury ETF", assetClass: "etf", riskPressure: 41, sparkTone: "watch" }),
    row({ id: "pass419-bund", rank: 1654, symbol: "BUND", name: "German Bund proxy", assetClass: "etf", riskPressure: 35, sparkTone: "flat" }),
    row({ id: "pass419-eurchf", rank: 1655, symbol: "EUR/CHF", name: "Euro / Swiss Franc", assetClass: "fx", riskPressure: 28, sparkTone: "flat" }),
    row({ id: "pass419-eurgbp", rank: 1656, symbol: "EUR/GBP", name: "Euro / Pound Sterling", assetClass: "fx", riskPressure: 32, sparkTone: "flat" }),
    row({ id: "pass419-audusd", rank: 1657, symbol: "AUD/USD", name: "Australian Dollar / Dollar", assetClass: "fx", riskPressure: 38, sparkTone: "watch" }),
    row({ id: "pass419-nzdusd", rank: 1658, symbol: "NZD/USD", name: "New Zealand Dollar / Dollar", assetClass: "fx", riskPressure: 39, sparkTone: "watch" }),
    row({ id: "pass419-usdsgd", rank: 1659, symbol: "USD/SGD", name: "Dollar / Singapore Dollar", assetClass: "fx", riskPressure: 29, sparkTone: "flat" }),
    row({ id: "pass419-aluminum", rank: 1660, symbol: "ALUMINUM", name: "Aluminum reference", assetClass: "commodity", riskPressure: 42, sparkTone: "watch" }),
    row({ id: "pass419-coffee", rank: 1661, symbol: "COFFEE", name: "Coffee reference", assetClass: "commodity", riskPressure: 52, sparkTone: "watch" }),
    row({ id: "pass419-sugar", rank: 1662, symbol: "SUGAR", name: "Sugar reference", assetClass: "commodity", riskPressure: 45, sparkTone: "watch" }),
    row({ id: "pass419-corn", rank: 1663, symbol: "CORN", name: "Corn reference", assetClass: "commodity", riskPressure: 43, sparkTone: "watch" }),
    row({ id: "pass419-vnq", rank: 1664, symbol: "VNQ", name: "Vanguard Real Estate ETF", assetClass: "real_estate", riskPressure: 38, sparkTone: "flat" }),
    row({ id: "pass419-iyr", rank: 1665, symbol: "IYR", name: "US Real Estate ETF", assetClass: "real_estate", riskPressure: 39, sparkTone: "flat" }),
    row({ id: "pass419-o", rank: 1666, symbol: "O", name: "Realty Income", assetClass: "real_estate", riskPressure: 40, sparkTone: "watch" }),
    row({ id: "pass419-psa", rank: 1667, symbol: "PSA", name: "Public Storage", assetClass: "real_estate", riskPressure: 34, sparkTone: "flat" }),
    row({ id: "pass419-ftnt", rank: 1668, symbol: "FTNT", name: "Fortinet", assetClass: "stock", riskPressure: 41, sparkTone: "watch" }),
    row({ id: "pass419-net", rank: 1669, symbol: "NET", name: "Cloudflare", assetClass: "stock", riskPressure: 46, sparkTone: "watch" }),
    row({ id: "pass419-now", rank: 1670, symbol: "NOW", name: "ServiceNow", assetClass: "stock", riskPressure: 38, sparkTone: "flat" }),
    row({ id: "pass419-arm", rank: 1671, symbol: "ARM", name: "Arm Holdings", assetClass: "stock", riskPressure: 47, sparkTone: "watch" }),
  ];
}

export function buildPass419StableAnalysisFields(input: Parameters<typeof buildPass418StableAnalysisFields>[0]): Pass419StableField[] {
  const base = buildPass418StableAnalysisFields({
    ...input,
    price: pass419SafeText(input.price, "provider pending"),
    change: pass419SafeText(input.change, "session pending"),
    source: pass419SafeText(input.source, "provider required"),
    proof: pass419SafeText(input.proof, "checksum pending"),
    second: pass419SafeText(input.second, "second source required"),
  });
  const replacements: Record<string, Pass419StableField> = {
    price: { id: "price", label: "Price lane", value: pass419SafeText(input.price, "provider pending"), copy: "Object-safe rendering: price/change records are flattened before JSX." },
    change: { id: "change", label: "Session change", value: pass419SafeText(input.change, "session pending"), copy: "Session change remains a separate field so React never receives a metric object." },
    search: { id: "search", label: "Search", value: "3 stable results", copy: "Deferred query + normalized de-dupe keys keep suggestions pinned and light." },
    modal: { id: "modal", label: "Modal", value: "chart-first", copy: "Basic/Pro/Advanced adjusts only the field count until Orbit has a lazy crash boundary." },
    ai: { id: "ai", label: "Velmère AI", value: "payload-bound", copy: "AI copy is composed from the resolved payload, not random filler." },
  };
  return base.map((field) => replacements[field.id] ?? field);
}

export const pass419SecurityPlainCopy = [
  ...pass418SecurityPlainCopy,
  "PASS419 keeps Security and Research public pages simple: layered protections, redacted internals, audit/replay evidence and conservative research wording.",
] as const;
