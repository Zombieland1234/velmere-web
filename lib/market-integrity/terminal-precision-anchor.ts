import type { UniversalAssetRow } from "./universal-asset-market-matrix";
import { buildPass4825MarketCoverageUniverse } from "./market-coverage-universe";

export const PASS416_RUNTIME_CLOSE_EVENT = "velmere:pass416:terminal-precision-anchor-close";

type VisualPatch = { label: string; glyph: string; primary: string; secondary: string; text?: string; logoUrl?: string };
type RealMarketMode = "basic" | "pro" | "advanced";
export type Pass416StableField = { id: string; label: string; value: string; copy: string };
type PseudoPatch = string | number | { price?: string | number; change?: string | number; value?: string | number; label?: string | number; amount?: string | number };

export const pass416TerminalPrecisionAnchor = {
  version: "PASS416.terminal_precision_anchor",
  searchRule: "Every Velmère terminal uses exactly three suggestions, local scoring first, no floating portal in Browser, and close events before modal/download/scroll.",
  modalRule: "Real Markets remains chart-first; Basic/Pro/Advanced render deterministic fields while Orbit 360 is parked until isolated as a lazy crash boundary.",
  metricRule: "Every React-visible metric is reduced to text, including nested price/change objects, arrays and missing values.",
  chartRule: "Drag begins only after a dead-zone, pointer default is prevented, and chart position should not jump on first contact.",
  pdfRule: "Browser HTML preview and downloaded PDF use one stable locale payload, one field order and one checksum lane.",
  aiRule: "Velmère AI writes only from source state, freshness, lineage, provider drift, security boundary and next verification step.",
  securityRule: "Public security surface stays simple: layered controls, redacted internals, rate limits, signer boundary, audit log and provider freshness.",
  researchRule: "Research Lab uses experiment, replication and falsification wording until external review exists.",
} as const;

export function pass416SafeText(value: unknown, fallback = "—"): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const text = value.map((entry) => pass416SafeText(entry, "")).filter(Boolean).join(" · ");
    return text || fallback;
  }
  if (value && typeof value === "object") {
    const record = value as { price?: unknown; change?: unknown; value?: unknown; label?: unknown; amount?: unknown; state?: unknown; source?: unknown };
    const parts = [
      pass416SafeText(record.price ?? record.value ?? record.label ?? record.amount ?? record.state, ""),
      pass416SafeText(record.change, ""),
      pass416SafeText(record.source, ""),
    ].filter(Boolean);
    return parts.join(" · ") || fallback;
  }
  return fallback;
}

export function pass416NormalizeQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function pass416ClampSuggestions<T>(items: T[], keyOf: (item: T) => string, limit = 3): T[] {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    const key = keyOf(item).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
    if (next.length >= Math.max(1, limit)) break;
  }
  return next;
}

export const pass416AssetVisualPatch: Record<string, VisualPatch> = {
  "SPY": { label: "S&P 500 ETF", glyph: "SP", primary: "#0f172a", secondary: "#38bdf8" },
  "QQQ": { label: "Nasdaq 100 ETF", glyph: "Q", primary: "#111827", secondary: "#a78bfa" },
  "IWM": { label: "Russell 2000 ETF", glyph: "IW", primary: "#1d4ed8", secondary: "#f8fafc" },
  "TLT": { label: "20Y Treasury ETF", glyph: "TL", primary: "#334155", secondary: "#f8fafc" },
  "HYG": { label: "High Yield ETF", glyph: "HY", primary: "#7c2d12", secondary: "#facc15" },
  "EURNZD": { label: "Euro / New Zealand Dollar", glyph: "NZ", primary: "#0f766e", secondary: "#f8fafc" },
  "USDZAR": { label: "Dollar / South African Rand", glyph: "ZA", primary: "#16a34a", secondary: "#facc15" },
  "USDMXN": { label: "Dollar / Mexican Peso", glyph: "MX", primary: "#15803d", secondary: "#dc2626" },
  "USDBRL": { label: "Dollar / Brazilian Real", glyph: "BR", primary: "#16a34a", secondary: "#facc15" },
  "EURCZK": { label: "Euro / Czech Koruna", glyph: "CZ", primary: "#1d4ed8", secondary: "#dc2626" },
  "WHEAT": { label: "Wheat reference", glyph: "WH", primary: "#ca8a04", secondary: "#111827" },
  "SUGAR": { label: "Sugar reference", glyph: "SG", primary: "#f8fafc", secondary: "#111827", text: "#111" },
  "COPPER": { label: "Copper reference", glyph: "CU", primary: "#b45309", secondary: "#111827" },
  "LITHIUM": { label: "Lithium basket", glyph: "LI", primary: "#64748b", secondary: "#a7f3d0" },
  "URNM": { label: "Uranium miners ETF", glyph: "UR", primary: "#166534", secondary: "#bef264" },
  "VNQI": { label: "Global ex-US Real Estate", glyph: "VQ", primary: "#0f766e", secondary: "#f8fafc" },
  "RWO": { label: "Global Real Estate ETF", glyph: "RW", primary: "#134e4a", secondary: "#f8fafc" },
  "IYR": { label: "US Real Estate ETF", glyph: "YR", primary: "#0f766e", secondary: "#f8fafc" },
  "GILD": { label: "Gilead", glyph: "GI", primary: "#1d4ed8", secondary: "#f8fafc" },
  "ADBE": { label: "Adobe", glyph: "AD", primary: "#dc2626", secondary: "#111827" },
  "CRM": { label: "Salesforce", glyph: "SF", primary: "#0ea5e9", secondary: "#f8fafc" },
  "NOW": { label: "ServiceNow", glyph: "NW", primary: "#16a34a", secondary: "#111827" },
  "SHOP": { label: "Shopify", glyph: "SH", primary: "#16a34a", secondary: "#f8fafc" },
  "MELI": { label: "MercadoLibre", glyph: "ML", primary: "#facc15", secondary: "#1d4ed8", text: "#111" },
};

export const pass416PseudoPricePatch: Record<string, PseudoPatch> = {
  SPY: { price: "$520", change: "provider" },
  QQQ: { price: "$450", change: "provider" },
  IWM: { price: "$205", change: "provider" },
  TLT: { price: "$92", change: "rates" },
  HYG: { price: "$77", change: "spread" },
  EURNZD: { price: "1.78", change: "flat" },
  USDZAR: { price: "18.20", change: "watch" },
  USDMXN: { price: "17.05", change: "flat" },
  USDBRL: { price: "5.20", change: "watch" },
  EURCZK: { price: "24.70", change: "flat" },
  WHEAT: { price: "$6.20", change: "watch" },
  SUGAR: { price: "$0.19", change: "flat" },
  COPPER: { price: "$4.45", change: "watch" },
  LITHIUM: { price: "basket", change: "provider" },
  URNM: { price: "$49", change: "watch" },
  VNQI: { price: "$41", change: "flat" },
  RWO: { price: "$42", change: "flat" },
  IYR: { price: "$88", change: "flat" },
  GILD: { price: "$72", change: "provider" },
  ADBE: { price: "$480", change: "provider" },
  CRM: { price: "$260", change: "provider" },
  NOW: { price: "$730", change: "provider" },
  SHOP: { price: "$65", change: "provider" },
  MELI: { price: "$1,650", change: "provider" },
};

const PASS416_MARKET_COVERAGE_DATA = `
pass416-spy	1500	SPY	S&P 500 ETF	etf	30	flat
pass416-qqq	1501	QQQ	Nasdaq 100 ETF	etf	36	watch
pass416-iwm	1502	IWM	Russell 2000 ETF	etf	39	watch
pass416-tlt	1503	TLT	20Y Treasury ETF	etf	42	watch
pass416-hyg	1504	HYG	High Yield Credit ETF	etf	45	watch
pass416-eurnzd	1505	EURNZD	Euro / New Zealand Dollar	fx	34	flat
pass416-usdzar	1506	USDZAR	Dollar / South African Rand	fx	49	watch
pass416-usdmxn	1507	USDMXN	Dollar / Mexican Peso	fx	38	flat
pass416-usdbrl	1508	USDBRL	Dollar / Brazilian Real	fx	46	watch
pass416-eurczk	1509	EURCZK	Euro / Czech Koruna	fx	32	flat
pass416-wheat	1510	WHEAT	Wheat reference	commodity	43	watch
pass416-sugar	1511	SUGAR	Sugar reference	commodity	37	flat
pass416-copper	1512	COPPER	Copper reference	commodity	41	watch
pass416-lithium	1513	LITHIUM	Lithium basket	commodity	50	watch
pass416-urnm	1514	URNM	Uranium miners ETF	etf	52	watch
pass416-vnqi	1515	VNQI	Global ex-US Real Estate ETF	real_estate	40	flat
pass416-rwo	1516	RWO	Global Real Estate ETF	real_estate	39	flat
pass416-iyr	1517	IYR	US Real Estate ETF	real_estate	41	flat
pass416-gild	1518	GILD	Gilead Sciences	stock	29	flat
pass416-adbe	1519	ADBE	Adobe	stock	35	flat
pass416-crm	1520	CRM	Salesforce	stock	36	flat
pass416-now	1521	NOW	ServiceNow	stock	37	flat
pass416-shop	1522	SHOP	Shopify	stock	46	watch
pass416-meli	1523	MELI	MercadoLibre	stock	45	watch
`;

export function buildPass416MarketCoverageUniverse(): UniversalAssetRow[] {
  return buildPass4825MarketCoverageUniverse("pass416", PASS416_MARKET_COVERAGE_DATA);
}

function modeLimit(mode: RealMarketMode) {
  if (mode === "basic") return 10;
  if (mode === "pro") return 14;
  return 20;
}

export function buildPass416StableAnalysisFields(input: {
  symbol: string;
  name: string;
  type: string;
  price: unknown;
  change: unknown;
  risk: unknown;
  source: unknown;
  proof: unknown;
  second: unknown;
  mode: RealMarketMode;
}): Pass416StableField[] {
  const source = pass416SafeText(input.source, "provider required");
  const base: Pass416StableField[] = [
    { id: "identity", label: "Instrument", value: input.symbol, copy: `${input.name} · ${input.type}` },
    { id: "price", label: "Price lane", value: pass416SafeText(input.price, "provider pending"), copy: "React-safe metric text; never render raw objects." },
    { id: "change", label: "Change", value: pass416SafeText(input.change, "session pending"), copy: "Change is separated from price so the table and modal stay stable." },
    { id: "source", label: "Source", value: source, copy: "Provider timestamp is required before live wording." },
    { id: "second", label: "Second source", value: pass416SafeText(input.second, "required"), copy: "Second-source drift must be checked before confidence rises." },
    { id: "proof", label: "Proof", value: pass416SafeText(input.proof, "checksum pending"), copy: "Preview and PDF share the same payload checksum lane." },
    { id: "risk", label: "Risk pressure", value: pass416SafeText(input.risk, "review"), copy: "Risk is a review lane, not an action prompt." },
    { id: "chart", label: "Chart", value: "candles first", copy: "Chart remains active while Orbit 360 is disabled in this modal." },
    { id: "freshness", label: "Freshness", value: "reconnect-aware", copy: "WebSocket/live providers need reconnect and stale-state handling." },
    { id: "locale", label: "Locale", value: "PL/EN/DE", copy: "Browser report text follows the active page language." },
    { id: "ai", label: "Velmère AI", value: "source-bound", copy: "AI copy is built from payload fields instead of random filler." },
    { id: "icons", label: "Icon lane", value: "visual patch", copy: "Real assets have deterministic visual marks until official logos are wired." },
    { id: "search", label: "Search", value: "3 suggestions", copy: "Input-anchored suggestions reduce lag and avoid random portal placement." },
    { id: "modal", label: "Modal", value: "chart-first", copy: "Basic/Pro/Advanced switch fields without mounting heavy neural animations." },
    { id: "download", label: "PDF", value: "same payload", copy: "Download and preview use the same resolved data and field order." },
    { id: "security", label: "Security", value: "redacted boundary", copy: "Public copy explains layers without disclosing sensitive internals." },
    { id: "research", label: "Research", value: "replication lane", copy: "Research Lab stays testable and falsifiable before external review." },
    { id: "next", label: "Next adapter", value: "provider key", copy: "Wire official provider, session calendar and second-source drift." },
    { id: "status", label: "Status", value: input.mode, copy: "Output count changes by Basic/Pro/Advanced mode." },
    { id: "orbit", label: "Orbit 360", value: "paused", copy: "Heavy brain animation returns only as lazy crash-contained component." },
  ];
  return base.slice(0, modeLimit(input.mode));
}

export const pass416SecurityPlainCopy = [
  "Velmère Security uses layered controls, signer boundaries, audit logging and provider freshness without exposing sensitive internal methods.",
  "Research Lab remains an experimental verification surface: reproduce, falsify, document and only then promote claims.",
  "Terminal UI avoids fake-live text: source timestamp, second-source drift and checksum decide what can be displayed.",
] as const;
