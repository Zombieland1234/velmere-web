import type { UniversalAssetRow } from "./universal-asset-market-matrix";

export type Pass388Mode = "basic" | "pro" | "advanced";
type VisualPatch = { label: string; glyph: string; primary: string; secondary: string; text?: string; logoUrl?: string };
type MarketRowInput = Partial<UniversalAssetRow> & Pick<UniversalAssetRow, "id" | "rank" | "symbol" | "name" | "assetClass" | "riskPressure" | "sparkTone">;

type Pass388Field = { id: string; label: string; value: string; copy: string };

function row(input: MarketRowInput): UniversalAssetRow {
  const family = input.assetClass === "fx" ? "FX" : input.assetClass === "commodity" ? "commodity" : input.assetClass === "real_estate" ? "real-estate proxy" : input.assetClass === "etf" ? "ETF" : input.assetClass === "exchange_token" ? "exchange venue" : "equity";
  return {
    sourceRhythm: input.sourceRhythm ?? `${family} provider spine · timestamp · OHLCV · session calendar · cache age · fallback flag`,
    priceLane: input.priceLane ?? `${family} uses the same Shield candle grammar: 1H / 4H / 1D / 1W; preview candles now, live OHLCV only after provider key`,
    volumeLane: input.volumeLane ?? `${family} volume, spread, volatility and second-source drift stay separate from hype`,
    proofOrDisclosureLane: input.proofOrDisclosureLane ?? `${family} issuer/reference/methodology lane`,
    secondSourceLane: input.secondSourceLane ?? "primary provider ↔ second source before stronger public confidence",
    confidenceFloor: input.confidenceFloor ?? 74,
    adapterState: input.adapterState ?? "provider_ready_no_fake_live",
    humanCopy: input.humanCopy ?? `${input.symbol} is mapped through PASS388: clean icon, Shield candles, provider truth, VLM Brain, Security bridge, Research boundary and exact PDF mirror.`,
    nextAdapterStep: input.nextAdapterStep ?? "Attach live provider key, timestamp, OHLCV cache, issuer/reference lane, second source compare, locale lock and PDF mirror test.",
    ...input,
  };
}

export const pass388WorldMarketClarityContract = {
  version: "PASS388.world_market_clarity_terminal",
  publicRule: "The public page should feel like one premium terminal, not a history of development passes.",
  marketRule: "Every crypto, stock, FX, ETF, commodity and exchange row uses the same grammar: icon, candles, source state, Basic/Pro/Advanced, VLM Brain and PDF mirror.",
  providerRule: "Large market coverage can be provider-ready, but live confidence unlocks only with timestamp, OHLCV, cache age, fallback state and second-source/reference proof.",
  pdfRule: "Browser preview, modal preview and downloaded PDF must render the same resolved report object, in the selected PL/EN/DE locale.",
  brainRule: "The VLM coin becomes a neural intake: data lanes flow into the core, collection time is visible, and the final output is a short 10/14/20 field audit.",
  securityRule: "Public security copy is simple: private key stays private, signature proves control, entropy has quality, redacted reports show sources and missing proof.",
  researchRule: "Research Lab explains banks, cryptography, ECC/BTC, entropy and primes as education plus numerical audit, not an overclaimed proof.",
} as const;

export const pass388BrainStages = [
  { id: "identity", label: "Identity lock", seconds: 0.5, copy: "Symbol, locale, class and visual identity lock before the audit starts." },
  { id: "provider", label: "Provider truth", seconds: 0.8, copy: "Timestamp, OHLCV, cache age, fallback and session calendar decide how strong the wording may be." },
  { id: "candles", label: "Candle forge", seconds: 1.0, copy: "Stocks, FX, ETF, commodities and crypto use one Shield-grade candle language." },
  { id: "neural", label: "Neural flow", seconds: 1.3, copy: "Sources, liquidity, issuer/reference, macro and second-source lanes flow into the VLM core." },
  { id: "security", label: "Security bridge", seconds: 0.9, copy: "Private-key boundary, signature proof, entropy quality and redaction are translated into human language." },
  { id: "research", label: "Prime Lab", seconds: 1.0, copy: "Prime/Riemann work stays framed as numerical audit, falsification and replication." },
  { id: "readout", label: "Human readout", seconds: 1.1, copy: "The brain resolves into a useful field deck instead of repeating debug cards." },
  { id: "mirror", label: "PDF mirror", seconds: 0.7, copy: "Preview and download use the same report object and selected language." },
] as const;

export const pass388ProviderRails = [
  { id: "crypto", label: "Crypto / venues", state: "depth + heartbeat", copy: "Exchange rows require depth, API freshness, reserve context, withdrawal status, social stress and second venue." },
  { id: "equities", label: "Equities", state: "quote + issuer", copy: "Stock rows require quote provider, market calendar, filing/company-facts lane and peer basket." },
  { id: "fx", label: "FX", state: "reference + intraday", copy: "FX rows need reference cadence, intraday provider, holiday calendar and volatility band." },
  { id: "commodities", label: "Commodities", state: "spot/futures", copy: "Gold, silver, energy, metals and agriculture need source type, contract context and timestamp." },
  { id: "realestate", label: "Real estate", state: "proxy only", copy: "REIT/ETF/housing proxies are slower macro context, not second-by-second property valuation." },
  { id: "pdf", label: "PDF parity", state: "exact mirror", copy: "The same resolved object renders Browser preview, modal preview and downloadable PDF." },
] as const;

export const pass388SecurityPlainCopy = [
  "Velmère nie prosi o seed phrase, raw private key ani prywatny sekret. Publiczny ekran pokazuje tylko zasadę kontroli i dowodu.",
  "Podpis może potwierdzić kontrolę adresu lub akcji bez ujawniania sekretu — użytkownik widzi wynik, nie prywatny payload.",
  "Real Markets brzmi mocniej dopiero po timestamp, OHLCV, cache age, fallback flag i drugim źródle; bez tego UI mówi provider-ready, nie live.",
  "Entropia/RNG jest opisana jako jakość źródła losowości i walidacja. To edukacja bezpieczeństwa, nie instrukcja tworzenia portfela.",
  "Raport pokazuje źródła, braki i wynik. Progi operatorowe, abuse rules i czułe payloady zostają prywatne.",
] as const;

export const pass388ResearchBridge = [
  { id: "banks", label: "Banki", copy: "Banki działają przez sesję, podpis, limit, log, audyt i reakcję na nadużycie. Velmère tłumaczy tę logikę jako trust flow." },
  { id: "crypto", label: "Kryptografia", copy: "Kryptografia pozwala potwierdzić kontrolę, integralność albo autentyczność bez ujawniania prywatnego sekretu." },
  { id: "ecc", label: "ECC / BTC", copy: "Krzywa eliptyczna i podpis są pokazane koncepcyjnie: sekret zostaje prywatny, publiczny dowód potwierdza kontrolę." },
  { id: "entropy", label: "Real RNG", copy: "Losowość ma jakość: entropia, health checks i walidacja źródła. Nie pokazujemy operacyjnej instrukcji generowania walletów." },
  { id: "primes", label: "Liczby pierwsze", copy: "Prime Lab tłumaczy rozkład liczb pierwszych, funkcje zeta i residual π(x)-R(x) jako audyt matematyczny." },
  { id: "bajak", label: "Bajak Protocol", copy: "Publiczna rama: finite numerical reconstruction, benchmark, fake-zero controls, neighbor-shift, negative controls i replikacja." },
] as const;

export const pass388AssetVisualPatch: Record<string, VisualPatch> = {
  CRWD: { label: "CrowdStrike", glyph: "CS", primary: "#e11d48", secondary: "#21050c" },
  PANW: { label: "Palo Alto", glyph: "PA", primary: "#ff4f00", secondary: "#2b0b02" },
  ZS: { label: "Zscaler", glyph: "ZS", primary: "#1d4ed8", secondary: "#071a3d" },
  NET: { label: "Cloudflare", glyph: "CF", primary: "#f59e0b", secondary: "#2d1604", text: "#111" },
  DDOG: { label: "Datadog", glyph: "DD", primary: "#632ca6", secondary: "#160826" },
  SNOW: { label: "Snowflake", glyph: "SN", primary: "#29b5e8", secondary: "#062638" },
  MDB: { label: "MongoDB", glyph: "MG", primary: "#13aa52", secondary: "#052614" },
  TEAM: { label: "Atlassian", glyph: "AT", primary: "#0052cc", secondary: "#061638" },
  SQ: { label: "Block", glyph: "SQ", primary: "#111827", secondary: "#5b6472" },
  PYPL: { label: "PayPal", glyph: "PP", primary: "#003087", secondary: "#009cde" },
  "ADYEN.AS": { label: "Adyen", glyph: "AY", primary: "#0abf53", secondary: "#052414" },
  HOOD: { label: "Robinhood", glyph: "RH", primary: "#00c805", secondary: "#05220a", text: "#111" },
  IBKR: { label: "Interactive Brokers", glyph: "IB", primary: "#d71920", secondary: "#250407" },
  NDAQ: { label: "Nasdaq", glyph: "NQ", primary: "#0097a9", secondary: "#06242b" },
  CBOE: { label: "Cboe", glyph: "CB", primary: "#004b8d", secondary: "#06192d" },
  CME: { label: "CME", glyph: "CM", primary: "#0072ce", secondary: "#061a32" },
  ICE: { label: "ICE", glyph: "IC", primary: "#0f172a", secondary: "#64748b" },
  "WISE.L": { label: "Wise", glyph: "WI", primary: "#9fe870", secondary: "#17310b", text: "#111" },
  REVOLUT: { label: "Revolut proxy", glyph: "RV", primary: "#111827", secondary: "#38bdf8" },
  "EUR/CHF": { label: "Euro / Swiss Franc", glyph: "CH", primary: "#dc2626", secondary: "#330708" },
  "USD/CHF": { label: "Dollar / Swiss Franc", glyph: "CH", primary: "#b91c1c", secondary: "#2a0607" },
  "GBP/CHF": { label: "Pound / Swiss Franc", glyph: "£F", primary: "#7c3aed", secondary: "#17082e" },
  "EUR/NOK": { label: "Euro / Norwegian Krone", glyph: "NO", primary: "#1d4ed8", secondary: "#071a3d" },
  "USD/NOK": { label: "Dollar / Norwegian Krone", glyph: "NO", primary: "#2563eb", secondary: "#06183c" },
  NATGAS: { label: "Natural Gas", glyph: "NG", primary: "#38bdf8", secondary: "#082f49", text: "#111" },
  URANIUM: { label: "Uranium", glyph: "U", primary: "#a3e635", secondary: "#203006", text: "#111" },
  SUGAR: { label: "Sugar", glyph: "Su", primary: "#f8fafc", secondary: "#94a3b8", text: "#111" },
  COFFEE: { label: "Coffee", glyph: "Cf", primary: "#7c2d12", secondary: "#1f0904" },
  COCOA: { label: "Cocoa", glyph: "Cc", primary: "#92400e", secondary: "#210c03" },
  VNQI: { label: "Global ex-US REIT", glyph: "VQ", primary: "#134e4a", secondary: "#05211f" },
};

export const pass388PseudoPricePatch: Record<string, { price: string; change: string }> = {
  CRWD: { price: "$345", change: "+0.6%" }, PANW: { price: "$305", change: "+0.4%" }, ZS: { price: "$187", change: "+0.5%" }, NET: { price: "$92", change: "+0.7%" }, DDOG: { price: "$126", change: "+0.4%" }, SNOW: { price: "$138", change: "+0.3%" }, MDB: { price: "$370", change: "+0.5%" }, TEAM: { price: "$178", change: "+0.2%" }, SQ: { price: "$68", change: "+0.4%" }, PYPL: { price: "$64", change: "+0.3%" }, "ADYEN.AS": { price: "€1.2k", change: "+0.2%" }, HOOD: { price: "$21", change: "+0.9%" }, IBKR: { price: "$122", change: "+0.2%" }, NDAQ: { price: "$62", change: "+0.1%" }, CBOE: { price: "$184", change: "+0.1%" }, CME: { price: "$205", change: "+0.2%" }, ICE: { price: "$136", change: "+0.2%" }, "WISE.L": { price: "£8.4", change: "+0.3%" }, REVOLUT: { price: "private", change: "provider" }, "EUR/CHF": { price: "0.97", change: "flat" }, "USD/CHF": { price: "0.89", change: "+0.1%" }, "GBP/CHF": { price: "1.14", change: "+0.1%" }, "EUR/NOK": { price: "11.4", change: "+0.2%" }, "USD/NOK": { price: "10.6", change: "+0.2%" }, NATGAS: { price: "$2.8", change: "+0.8%" }, URANIUM: { price: "$90", change: "+0.4%" }, SUGAR: { price: "$0.19", change: "+0.2%" }, COFFEE: { price: "$2.2", change: "+0.5%" }, COCOA: { price: "$8.1k", change: "+0.6%" }, VNQI: { price: "$40", change: "+0.2%" },
};

export function buildPass388MarketCoverageUniverse(): UniversalAssetRow[] {
  return [
    row({ id: "crwd-pass388", rank: 1690, symbol: "CRWD", name: "CrowdStrike", assetClass: "stock", riskPressure: 43, sparkTone: "up", humanCopy: "Cybersecurity stock. Velmère separates quote movement, incident/news context, filing cadence and second-source provider state." }),
    row({ id: "panw-pass388", rank: 1691, symbol: "PANW", name: "Palo Alto Networks", assetClass: "stock", riskPressure: 40, sparkTone: "up", humanCopy: "Cybersecurity platform stock with issuer and sector-basket context before any stronger copy." }),
    row({ id: "zs-pass388", rank: 1692, symbol: "ZS", name: "Zscaler", assetClass: "stock", riskPressure: 44, sparkTone: "watch", humanCopy: "Cloud security stock. Provider timestamp and issuer lane must be explicit before confidence rises." }),
    row({ id: "net-pass388", rank: 1693, symbol: "NET", name: "Cloudflare", assetClass: "stock", riskPressure: 42, sparkTone: "up", humanCopy: "Infrastructure/security stock. Velmère tracks quote, volume, outage/news context and filing cadence." }),
    row({ id: "ddog-pass388", rank: 1694, symbol: "DDOG", name: "Datadog", assetClass: "stock", riskPressure: 39, sparkTone: "flat", humanCopy: "Observability stock. AI Brain keeps telemetry-business context separate from price candles." }),
    row({ id: "snow-pass388", rank: 1695, symbol: "SNOW", name: "Snowflake", assetClass: "stock", riskPressure: 41, sparkTone: "watch", humanCopy: "Data cloud stock. Provider and issuer context are required before stronger wording." }),
    row({ id: "mdb-pass388", rank: 1696, symbol: "MDB", name: "MongoDB", assetClass: "stock", riskPressure: 42, sparkTone: "watch" }),
    row({ id: "team-pass388", rank: 1697, symbol: "TEAM", name: "Atlassian", assetClass: "stock", riskPressure: 37, sparkTone: "flat" }),
    row({ id: "sq-pass388", rank: 1698, symbol: "SQ", name: "Block", assetClass: "stock", riskPressure: 46, sparkTone: "watch", humanCopy: "Fintech/crypto-exposure stock. Velmère separates issuer filings, BTC sensitivity and payment-sector context." }),
    row({ id: "pypl-pass388", rank: 1699, symbol: "PYPL", name: "PayPal", assetClass: "stock", riskPressure: 36, sparkTone: "flat" }),
    row({ id: "adyen-pass388", rank: 1700, symbol: "ADYEN.AS", name: "Adyen", assetClass: "stock", riskPressure: 35, sparkTone: "flat" }),
    row({ id: "hood-pass388", rank: 1701, symbol: "HOOD", name: "Robinhood", assetClass: "stock", riskPressure: 48, sparkTone: "watch" }),
    row({ id: "ibkr-pass388", rank: 1702, symbol: "IBKR", name: "Interactive Brokers", assetClass: "stock", riskPressure: 34, sparkTone: "flat" }),
    row({ id: "ndaq-pass388", rank: 1703, symbol: "NDAQ", name: "Nasdaq", assetClass: "stock", riskPressure: 31, sparkTone: "flat" }),
    row({ id: "cboe-pass388", rank: 1704, symbol: "CBOE", name: "Cboe Global Markets", assetClass: "stock", riskPressure: 32, sparkTone: "flat" }),
    row({ id: "cme-pass388", rank: 1705, symbol: "CME", name: "CME Group", assetClass: "stock", riskPressure: 33, sparkTone: "flat" }),
    row({ id: "ice-pass388", rank: 1706, symbol: "ICE", name: "Intercontinental Exchange", assetClass: "stock", riskPressure: 32, sparkTone: "flat" }),
    row({ id: "wise-pass388", rank: 1707, symbol: "WISE.L", name: "Wise", assetClass: "stock", riskPressure: 38, sparkTone: "flat" }),
    row({ id: "revolut-pass388", rank: 1708, symbol: "REVOLUT", name: "Revolut private-market proxy", assetClass: "stock", riskPressure: 52, sparkTone: "watch", humanCopy: "Private-company proxy. Velmère labels this as provider/reference context, not a live public equity quote." }),
    row({ id: "eurchf-pass388", rank: 1709, symbol: "EUR/CHF", name: "Euro / Swiss Franc", assetClass: "fx", riskPressure: 29, sparkTone: "flat" }),
    row({ id: "usdchf-pass388", rank: 1710, symbol: "USD/CHF", name: "Dollar / Swiss Franc", assetClass: "fx", riskPressure: 31, sparkTone: "flat" }),
    row({ id: "gbpchf-pass388", rank: 1711, symbol: "GBP/CHF", name: "Pound / Swiss Franc", assetClass: "fx", riskPressure: 33, sparkTone: "flat" }),
    row({ id: "eurnok-pass388", rank: 1712, symbol: "EUR/NOK", name: "Euro / Norwegian Krone", assetClass: "fx", riskPressure: 34, sparkTone: "watch" }),
    row({ id: "usdnok-pass388", rank: 1713, symbol: "USD/NOK", name: "Dollar / Norwegian Krone", assetClass: "fx", riskPressure: 36, sparkTone: "watch" }),
    row({ id: "natgas-pass388", rank: 1714, symbol: "NATGAS", name: "Natural Gas", assetClass: "commodity", riskPressure: 50, sparkTone: "watch" }),
    row({ id: "uranium-pass388", rank: 1715, symbol: "URANIUM", name: "Uranium", assetClass: "commodity", riskPressure: 45, sparkTone: "up" }),
    row({ id: "sugar-pass388", rank: 1716, symbol: "SUGAR", name: "Sugar", assetClass: "commodity", riskPressure: 40, sparkTone: "flat" }),
    row({ id: "coffee-pass388", rank: 1717, symbol: "COFFEE", name: "Coffee", assetClass: "commodity", riskPressure: 44, sparkTone: "watch" }),
    row({ id: "cocoa-pass388", rank: 1718, symbol: "COCOA", name: "Cocoa", assetClass: "commodity", riskPressure: 49, sparkTone: "watch" }),
    row({ id: "vnqi-pass388", rank: 1719, symbol: "VNQI", name: "Vanguard Global ex-US Real Estate ETF", assetClass: "real_estate", riskPressure: 38, sparkTone: "flat" }),
  ];
}

export function buildPass388WorldMarketReadout(input: { symbol: string; name: string; type: string; risk: number; source: string; mode: Pass388Mode }): {
  version: string;
  count: number;
  seconds: number;
  band: "public_ready" | "review" | "operator";
  headline: string;
  body: string;
  fields: Pass388Field[];
} {
  const count = input.mode === "advanced" ? 20 : input.mode === "pro" ? 14 : 10;
  const seconds = input.mode === "advanced" ? 8.8 : input.mode === "pro" ? 6.4 : 4.6;
  const band = input.risk >= 58 ? "operator" : input.risk >= 38 ? "review" : "public_ready";
  const core: Pass388Field[] = [
    { id: "identity", label: "Identity", value: input.symbol, copy: `${input.name} is locked to one asset class before analysis starts.` },
    { id: "language", label: "Language", value: "PL/EN/DE", copy: "Preview and PDF use the selected locale from the same report object." },
    { id: "chart", label: "Chart", value: "1H / 4H / 1D / 1W", copy: "Every market type uses Shield-grade candle grammar." },
    { id: "provider", label: "Provider", value: input.source, copy: "Live wording requires provider timestamp, OHLCV, cache age and fallback state." },
    { id: "risk", label: "Risk", value: `${input.risk}/100`, copy: "Risk is review pressure, not a buy/sell instruction." },
    { id: "second", label: "Second source", value: "required", copy: "Confidence rises only when a second venue/reference agrees." },
    { id: "liquidity", label: "Liquidity", value: "depth-aware", copy: "Orderbook/depth, volume and spread stay visible near the decision." },
    { id: "issuer", label: "Issuer/reference", value: input.type, copy: "Stocks need filings/company facts; FX and commodities need reference methodology." },
    { id: "security", label: "Security", value: "redacted", copy: "Reports show sources and gaps while private payloads and thresholds stay hidden." },
    { id: "pdf", label: "PDF mirror", value: "exact", copy: "The downloaded PDF mirrors the preview instead of generating separate filler." },
    { id: "entropy", label: "Entropy", value: "quality", copy: "RNG/TRNG is described as entropy quality and validation, not as wallet-generation instructions." },
    { id: "ecc", label: "ECC / BTC", value: "concept", copy: "Private/public key and signature logic are explained at a safe conceptual level." },
    { id: "prime", label: "Prime Lab", value: "audit", copy: "Prime/Riemann work is framed as numerical reconstruction and falsification." },
    { id: "bank", label: "Bank-grade flow", value: "session/log", copy: "Bank-style trust means session, signature, limit, audit and abuse response." },
    { id: "macro", label: "Macro context", value: "separate", copy: "FX, rates, energy and sector context do not overwrite asset-specific evidence." },
    { id: "venue", label: "Venue health", value: "heartbeat", copy: "Exchange health needs API freshness, withdrawals, reserves and social stress context." },
    { id: "copy", label: "AI copy", value: "human", copy: "The AI engine must translate technical gaps into clear human language." },
    { id: "fidelity", label: "Fidelity", value: "single surface", copy: "Old pass-history surfaces are hidden from the public launch UI." },
    { id: "operator", label: "Operator", value: "private", copy: "Operator rules stay private while user-facing conclusions stay simple." },
    { id: "next", label: "Next step", value: "verify", copy: "The next action is source verification or PDF export, never pressure or fake scarcity." },
  ];
  return {
    version: "PASS388.world_market_readout",
    count,
    seconds,
    band,
    headline: `${input.symbol} · clean world-market AI mirror`,
    body: `${input.symbol} resolves through one premium flow: provider truth, Shield candles, neural audit, Security bridge, Prime Lab boundary and exact PDF mirror.`,
    fields: core.slice(0, count),
  };
}
