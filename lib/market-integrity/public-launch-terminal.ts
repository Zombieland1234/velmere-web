import type { UniversalAssetRow } from "./universal-asset-market-matrix";

export type Pass389Mode = "basic" | "pro" | "advanced";
type VisualPatch = { label: string; glyph: string; primary: string; secondary: string; text?: string; logoUrl?: string };
type MarketRowInput = Partial<UniversalAssetRow> & Pick<UniversalAssetRow, "id" | "rank" | "symbol" | "name" | "assetClass" | "riskPressure" | "sparkTone">;
type Pass389Field = { id: string; label: string; value: string; copy: string };

function row(input: MarketRowInput): UniversalAssetRow {
  const family = input.assetClass === "fx" ? "FX" : input.assetClass === "commodity" ? "commodity" : input.assetClass === "real_estate" ? "real-estate proxy" : input.assetClass === "etf" ? "ETF" : input.assetClass === "exchange_token" ? "exchange venue" : "equity";
  return {
    sourceRhythm: input.sourceRhythm ?? `${family} provider-ready lane · timestamp · OHLCV · session calendar · cache age · fallback flag`,
    priceLane: input.priceLane ?? `${family} uses the same Shield candle grammar: 1H / 4H / 1D / 1W; preview candles now, live OHLCV only after provider lock`,
    volumeLane: input.volumeLane ?? `${family} volume, spread, volatility and second-source drift stay separate from hype`,
    proofOrDisclosureLane: input.proofOrDisclosureLane ?? `${family} issuer/reference/methodology lane`,
    secondSourceLane: input.secondSourceLane ?? "primary provider ↔ second source before stronger public confidence",
    confidenceFloor: input.confidenceFloor ?? 76,
    adapterState: input.adapterState ?? "provider_ready_no_fake_live",
    humanCopy: input.humanCopy ?? `${input.symbol} is mapped through PASS389: clean logo, Shield-grade candles, provider lock, neural source flow, simple Security copy, Research boundary and exact PDF parity.`,
    nextAdapterStep: input.nextAdapterStep ?? "Attach provider key, timestamp, OHLCV cache, issuer/reference lane, second-source compare, locale lock and PDF mirror QA.",
    ...input,
  };
}

export const pass389PublicLaunchTerminalContract = {
  version: "PASS389.public_launch_terminal",
  publicRule: "The public surface must feel finished: one terminal, one brain, one PDF mirror, no visible pass-history wall.",
  marketRule: "Every stock, FX pair, ETF, commodity, crypto and exchange-health row uses the same user grammar: logo, candle chart, source state, Basic/Pro/Advanced, VLM Brain, PDF mirror.",
  providerRule: "A big catalogue is provider-ready; live confidence unlocks only with timestamp, OHLCV, cache age, fallback flag, session calendar and second source.",
  pdfRule: "Browser preview and downloaded PDF are exact mirrors of one resolved report object in the selected PL/EN/DE locale.",
  brainRule: "The VLM coin acts as a neural intake: data streams flow into the core, collection time is visible, then the brain resolves into 10/14/20 useful fields.",
  securityRule: "Security copy stays simple: private key stays private, signature proves control, entropy quality matters, report output is redacted.",
  researchRule: "Research Lab explains banks, cryptography, ECC/BTC, entropy and primes as education plus numerical audit, not overclaimed proof.",
} as const;

export const pass389BrainStages = [
  { id: "identity", label: "Identity seal", seconds: 0.45, copy: "Symbol, class, locale, logo/glyph and route context are locked before the audit starts." },
  { id: "provider", label: "Provider lock", seconds: 0.75, copy: "Timestamp, OHLCV, cache age, fallback, exchange session and second-source status define confidence." },
  { id: "candles", label: "Candle forge", seconds: 1.0, copy: "Real Markets receives the same candle grammar as Shield: 1H, 4H, 1D and 1W." },
  { id: "source", label: "Source flow", seconds: 1.15, copy: "Issuer/reference, depth, liquidity, filings, macro and venue lanes stream toward the core." },
  { id: "neural", label: "Neural audit", seconds: 1.3, copy: "The VLM core turns raw lanes into one human readout instead of visible debug cards." },
  { id: "security", label: "Security bridge", seconds: 0.9, copy: "Private-key boundary, signature proof, entropy quality and redaction are translated into simple copy." },
  { id: "research", label: "Prime Lab", seconds: 0.95, copy: "Prime/Riemann research stays as numerical reconstruction, falsification and replication." },
  { id: "mirror", label: "Exact PDF mirror", seconds: 0.7, copy: "The same resolved report object renders preview, modal and downloaded PDF." },
] as const;

export const pass389ProviderChecklist = [
  { id: "crypto", label: "Crypto / exchanges", state: "depth + heartbeat", copy: "Depth, klines, API heartbeat, reserve context, withdrawal state and second venue stay separated." },
  { id: "equities", label: "Equities", state: "quote + issuer", copy: "Quote provider, exchange calendar, filing/company-facts lane and peer basket are required before stronger copy." },
  { id: "fx", label: "FX", state: "reference + intraday", copy: "FX rows need reference cadence, intraday feed, holiday calendar and volatility band." },
  { id: "commodities", label: "Commodities", state: "spot/futures", copy: "Gold, silver, energy and agriculture require source type, contract context and timestamp." },
  { id: "real_estate", label: "Real estate proxy", state: "slow macro", copy: "REIT/ETF/housing proxies are context lanes, not instant property valuation." },
  { id: "pdf", label: "PDF parity", state: "exact mirror", copy: "Preview, modal and download use one resolved report object in PL/EN/DE." },
] as const;

export const pass389SecurityCopy = [
  "Velmère nie prosi o seed phrase, raw private key ani prywatny sekret.",
  "Podpis potwierdza kontrolę bez ujawniania sekretu; użytkownik widzi wynik, nie prywatny payload.",
  "Real Markets mówi mocniej dopiero po timestamp, OHLCV, cache age, fallback flag i drugim źródle.",
  "Entropia/RNG jest tłumaczona jako jakość i walidacja źródła losowości, bez operacyjnych instrukcji tworzenia portfela.",
  "Raport pokazuje źródła, braki i wynik; operatorowe progi, payloady i reguły nadużyć zostają prywatne.",
] as const;

export const pass389ResearchBridge = [
  { id: "banks", label: "Banki", copy: "Bank-grade trust to sesja, podpis, limit, log, audyt i reakcja na nadużycie — pokazane bez ściany technicznej." },
  { id: "crypto", label: "Kryptografia", copy: "Kryptografia potwierdza kontrolę, integralność albo autentyczność bez ujawniania prywatnego sekretu." },
  { id: "ecc", label: "ECC / BTC", copy: "Krzywa eliptyczna i podpis są tłumaczone koncepcyjnie: sekret zostaje prywatny, publiczny dowód potwierdza kontrolę." },
  { id: "entropy", label: "Real RNG", copy: "Losowość ma jakość: entropia, health checks i walidacja źródła. To edukacja bezpieczeństwa, nie instrukcja generowania walletów." },
  { id: "primes", label: "Liczby pierwsze", copy: "Prime Lab pokazuje zeta, residual π(x)-R(x), rekonstrukcję numeryczną i falsyfikację jako ścieżkę audytu." },
  { id: "bajak", label: "Bajak Protocol", copy: "Publiczna rama: finite numerical reconstruction, benchmark, fake-zero controls, neighbor-shift, negative controls i replikacja." },
] as const;

export const pass389AssetVisualPatch: Record<string, VisualPatch> = {
  SPGI: { label: "S&P Global", glyph: "SP", primary: "#dc2626", secondary: "#2a0606" },
  MCO: { label: "Moody's", glyph: "Mo", primary: "#1d4ed8", secondary: "#06183b" },
  MSCI: { label: "MSCI", glyph: "MS", primary: "#0f172a", secondary: "#64748b" },
  FDS: { label: "FactSet", glyph: "FS", primary: "#0b5cab", secondary: "#051729" },
  "EXPN.L": { label: "Experian", glyph: "EX", primary: "#7c3aed", secondary: "#160828" },
  FI: { label: "Fiserv", glyph: "FI", primary: "#2563eb", secondary: "#06183c" },
  GPN: { label: "Global Payments", glyph: "GP", primary: "#1e3a8a", secondary: "#06183c" },
  FLT: { label: "FLEETCOR", glyph: "FT", primary: "#0f172a", secondary: "#374151" },
  TOST: { label: "Toast", glyph: "TO", primary: "#f97316", secondary: "#2d0d04" },
  AFRM: { label: "Affirm", glyph: "AF", primary: "#38bdf8", secondary: "#06283a" },
  SOFI: { label: "SoFi", glyph: "SF", primary: "#00a7b5", secondary: "#062529" },
  UPST: { label: "Upstart", glyph: "UP", primary: "#7c3aed", secondary: "#160828" },
  NET: { label: "Cloudflare", glyph: "CF", primary: "#f59e0b", secondary: "#2d1604", text: "#111" },
  OKTA: { label: "Okta", glyph: "OK", primary: "#111827", secondary: "#64748b" },
  S: { label: "SentinelOne", glyph: "S1", primary: "#7c3aed", secondary: "#17082e" },
  TENB: { label: "Tenable", glyph: "TB", primary: "#00a3e0", secondary: "#062536" },
  CYBR: { label: "CyberArk", glyph: "CY", primary: "#0f172a", secondary: "#38bdf8" },
  CHKP: { label: "Check Point", glyph: "CP", primary: "#dc2626", secondary: "#300708" },
  FTNT: { label: "Fortinet", glyph: "FN", primary: "#b91c1c", secondary: "#2a0606" },
  TTD: { label: "Trade Desk", glyph: "TD", primary: "#0f172a", secondary: "#22c55e" },
  "EUR/SEK": { label: "Euro / Swedish Krona", glyph: "SE", primary: "#2563eb", secondary: "#facc15", text: "#111" },
  "USD/SEK": { label: "Dollar / Swedish Krona", glyph: "SE", primary: "#1d4ed8", secondary: "#f59e0b", text: "#111" },
  "EUR/DKK": { label: "Euro / Danish Krone", glyph: "DK", primary: "#dc2626", secondary: "#f8fafc", text: "#111" },
  "USD/DKK": { label: "Dollar / Danish Krone", glyph: "DK", primary: "#b91c1c", secondary: "#f8fafc", text: "#111" },
  "USD/HKD": { label: "Dollar / Hong Kong Dollar", glyph: "HK", primary: "#dc2626", secondary: "#fbbf24", text: "#111" },
  COPPER: { label: "Copper", glyph: "Cu", primary: "#b45309", secondary: "#2b1204" },
  PLATINUM: { label: "Platinum", glyph: "Pt", primary: "#d1d5db", secondary: "#4b5563", text: "#111" },
  CORN: { label: "Corn", glyph: "Co", primary: "#facc15", secondary: "#2a1d05", text: "#111" },
  WHEAT: { label: "Wheat", glyph: "Wh", primary: "#d6b767", secondary: "#2a1d05", text: "#111" },
  IYR: { label: "US Real Estate ETF", glyph: "IY", primary: "#16a34a", secondary: "#052e16" },
};

export const pass389PseudoPricePatch: Record<string, { price: string; change: string }> = {
  SPGI: { price: "$489.10", change: "+0.7%" },
  MCO: { price: "$458.40", change: "+0.5%" },
  MSCI: { price: "$581.20", change: "+0.4%" },
  FDS: { price: "$421.70", change: "-0.2%" },
  "EXPN.L": { price: "£36.40", change: "+0.3%" },
  FI: { price: "$153.20", change: "+0.6%" },
  GPN: { price: "$79.50", change: "-0.4%" },
  FLT: { price: "$312.80", change: "+0.2%" },
  TOST: { price: "$29.10", change: "+1.2%" },
  AFRM: { price: "$58.30", change: "-1.1%" },
  SOFI: { price: "$9.80", change: "+0.8%" },
  UPST: { price: "$49.40", change: "-0.9%" },
  OKTA: { price: "$92.20", change: "+0.5%" },
  S: { price: "$18.70", change: "+0.9%" },
  TENB: { price: "$43.80", change: "+0.3%" },
  CYBR: { price: "$276.40", change: "+0.4%" },
  CHKP: { price: "$171.90", change: "-0.2%" },
  FTNT: { price: "$61.70", change: "+0.2%" },
  TTD: { price: "$93.60", change: "+1.1%" },
  "EUR/SEK": { price: "11.42", change: "-0.1%" },
  "USD/SEK": { price: "10.54", change: "+0.1%" },
  "EUR/DKK": { price: "7.46", change: "0.0%" },
  "USD/DKK": { price: "6.87", change: "+0.1%" },
  "USD/HKD": { price: "7.82", change: "0.0%" },
  COPPER: { price: "$4.62/lb", change: "+0.5%" },
  PLATINUM: { price: "$1,039", change: "+0.7%" },
  CORN: { price: "$4.48", change: "-0.3%" },
  WHEAT: { price: "$5.92", change: "+0.2%" },
  IYR: { price: "$93.50", change: "+0.4%" },
};

export function buildPass389MarketCoverageUniverse(): UniversalAssetRow[] {
  return [
    row({ id: "pass389-spgi", rank: 38901, symbol: "SPGI", name: "S&P Global", assetClass: "stock", riskPressure: 27, sparkTone: "up" }),
    row({ id: "pass389-mco", rank: 38902, symbol: "MCO", name: "Moody's", assetClass: "stock", riskPressure: 28, sparkTone: "up" }),
    row({ id: "pass389-msci", rank: 38903, symbol: "MSCI", name: "MSCI", assetClass: "stock", riskPressure: 30, sparkTone: "flat" }),
    row({ id: "pass389-fds", rank: 38904, symbol: "FDS", name: "FactSet", assetClass: "stock", riskPressure: 26, sparkTone: "flat" }),
    row({ id: "pass389-expn", rank: 38905, symbol: "EXPN.L", name: "Experian", assetClass: "stock", riskPressure: 29, sparkTone: "up" }),
    row({ id: "pass389-fi", rank: 38906, symbol: "FI", name: "Fiserv", assetClass: "stock", riskPressure: 33, sparkTone: "up" }),
    row({ id: "pass389-gpn", rank: 38907, symbol: "GPN", name: "Global Payments", assetClass: "stock", riskPressure: 39, sparkTone: "down" }),
    row({ id: "pass389-flt", rank: 38908, symbol: "FLT", name: "FLEETCOR", assetClass: "stock", riskPressure: 34, sparkTone: "flat" }),
    row({ id: "pass389-toast", rank: 38909, symbol: "TOST", name: "Toast", assetClass: "stock", riskPressure: 45, sparkTone: "up" }),
    row({ id: "pass389-afrm", rank: 38910, symbol: "AFRM", name: "Affirm", assetClass: "stock", riskPressure: 57, sparkTone: "volatile" }),
    row({ id: "pass389-sofi", rank: 38911, symbol: "SOFI", name: "SoFi", assetClass: "stock", riskPressure: 49, sparkTone: "up" }),
    row({ id: "pass389-upst", rank: 38912, symbol: "UPST", name: "Upstart", assetClass: "stock", riskPressure: 63, sparkTone: "volatile" }),
    row({ id: "pass389-okta", rank: 38913, symbol: "OKTA", name: "Okta", assetClass: "stock", riskPressure: 38, sparkTone: "flat" }),
    row({ id: "pass389-sentinel", rank: 38914, symbol: "S", name: "SentinelOne", assetClass: "stock", riskPressure: 52, sparkTone: "volatile" }),
    row({ id: "pass389-tenb", rank: 38915, symbol: "TENB", name: "Tenable", assetClass: "stock", riskPressure: 40, sparkTone: "flat" }),
    row({ id: "pass389-cybr", rank: 38916, symbol: "CYBR", name: "CyberArk", assetClass: "stock", riskPressure: 35, sparkTone: "up" }),
    row({ id: "pass389-chkp", rank: 38917, symbol: "CHKP", name: "Check Point", assetClass: "stock", riskPressure: 31, sparkTone: "flat" }),
    row({ id: "pass389-ftnt", rank: 38918, symbol: "FTNT", name: "Fortinet", assetClass: "stock", riskPressure: 36, sparkTone: "flat" }),
    row({ id: "pass389-ttd", rank: 38919, symbol: "TTD", name: "The Trade Desk", assetClass: "stock", riskPressure: 46, sparkTone: "up" }),
    row({ id: "pass389-eursek", rank: 38920, symbol: "EUR/SEK", name: "Euro / Swedish Krona", assetClass: "fx", riskPressure: 35, sparkTone: "flat" }),
    row({ id: "pass389-usdsek", rank: 38921, symbol: "USD/SEK", name: "Dollar / Swedish Krona", assetClass: "fx", riskPressure: 37, sparkTone: "flat" }),
    row({ id: "pass389-eurdkk", rank: 38922, symbol: "EUR/DKK", name: "Euro / Danish Krone", assetClass: "fx", riskPressure: 22, sparkTone: "flat" }),
    row({ id: "pass389-usddkk", rank: 38923, symbol: "USD/DKK", name: "Dollar / Danish Krone", assetClass: "fx", riskPressure: 32, sparkTone: "flat" }),
    row({ id: "pass389-usdhkd", rank: 38924, symbol: "USD/HKD", name: "Dollar / Hong Kong Dollar", assetClass: "fx", riskPressure: 28, sparkTone: "flat" }),
    row({ id: "pass389-copper", rank: 38925, symbol: "COPPER", name: "Copper", assetClass: "commodity", riskPressure: 41, sparkTone: "up" }),
    row({ id: "pass389-platinum", rank: 38926, symbol: "PLATINUM", name: "Platinum", assetClass: "commodity", riskPressure: 39, sparkTone: "up" }),
    row({ id: "pass389-corn", rank: 38927, symbol: "CORN", name: "Corn", assetClass: "commodity", riskPressure: 36, sparkTone: "down" }),
    row({ id: "pass389-wheat", rank: 38928, symbol: "WHEAT", name: "Wheat", assetClass: "commodity", riskPressure: 38, sparkTone: "flat" }),
    row({ id: "pass389-iyr", rank: 38929, symbol: "IYR", name: "iShares US Real Estate ETF", assetClass: "real_estate", riskPressure: 42, sparkTone: "flat" }),
  ];
}

export function buildPass389UnifiedReadout(input: { symbol: string; name: string; type: string; risk: number; source: string; mode: Pass389Mode }) {
  const count = input.mode === "advanced" ? 20 : input.mode === "pro" ? 14 : 10;
  const seconds = input.mode === "advanced" ? 8.9 : input.mode === "pro" ? 6.4 : 4.8;
  const band = input.risk >= 62 ? "review" : input.risk >= 42 ? "observe" : "clean";
  const fields: Pass389Field[] = [
    { id: "identity", label: "Identity", value: input.symbol, copy: `${input.name} is locked as ${input.type}; logo/glyph, locale and class stay consistent across Shield, Real Markets and PDF.` },
    { id: "language", label: "Language", value: "PL/EN/DE", copy: "The PDF follows the selected page language from the same resolved report object." },
    { id: "chart", label: "Chart", value: "Shield candles", copy: "Real stock/FX/ETF/commodity rows use the same candle grammar as crypto Shield." },
    { id: "provider", label: "Provider", value: input.source, copy: "Live strength requires provider timestamp, OHLCV, cache age, fallback flag and session context." },
    { id: "risk", label: "Risk pressure", value: `${input.risk}/100`, copy: "Risk pressure is a review score, not a buy/sell command." },
    { id: "second", label: "Second source", value: "required", copy: "Confidence rises only when another provider, venue or reference lane agrees." },
    { id: "liquidity", label: "Liquidity", value: "visible", copy: "Depth, spread, volume and volatility stay near the decision surface." },
    { id: "issuer", label: "Issuer/ref", value: input.type, copy: "Stocks need filings/company facts; FX and commodities need reference methodology." },
    { id: "security", label: "Security", value: "redacted", copy: "The public report shows sources and gaps, while operator thresholds and payloads remain private." },
    { id: "pdf", label: "PDF mirror", value: "exact", copy: "Preview, modal and download render the same resolved report object." },
    { id: "entropy", label: "Entropy", value: "quality", copy: "RNG/TRNG is explained as entropy quality and validation, not an operational wallet-generation guide." },
    { id: "ecc", label: "ECC / BTC", value: "concept", copy: "Private/public key and signature logic are explained at a safe conceptual level." },
    { id: "prime", label: "Prime Lab", value: "audit", copy: "Prime/Riemann work is framed as numerical reconstruction, falsification and replication." },
    { id: "bank", label: "Bank-grade", value: "session/log", copy: "Bank-style trust means session, signature, limit, audit trail and abuse response." },
    { id: "macro", label: "Macro", value: "separate", copy: "FX, rates, energy and sector context do not overwrite asset-specific evidence." },
    { id: "venue", label: "Venue", value: "heartbeat", copy: "Exchange health needs API freshness, withdrawals, reserves and social stress context." },
    { id: "copy", label: "AI copy", value: "human", copy: "The AI engine translates technical gaps into clear language instead of repeating debug text." },
    { id: "fidelity", label: "Fidelity", value: "single surface", copy: "Old pass-history panels stay hidden from the public launch UI." },
    { id: "operator", label: "Operator", value: "private", copy: "Internal rules and thresholds do not leak into public reports." },
    { id: "next", label: "Next step", value: "verify", copy: "The next action is provider verification or PDF export, never pressure, hype or fake scarcity." },
  ];
  return {
    version: "PASS389.unified_public_readout",
    count,
    seconds,
    band,
    headline: `${input.symbol} · public launch AI terminal`,
    body: `${input.symbol} now resolves through the clean launch contract: provider lock, Shield candles, neural audit, Security bridge, Prime Lab boundary and exact PDF mirror.`,
    fields: fields.slice(0, count),
  };
}
