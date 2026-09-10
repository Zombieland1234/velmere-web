import ResolvedAssetLogo from "@/components/market-integrity/AssetLogo";
import type { VlmAssetDetailModalData } from "./contract";

export type AnalysisInsightItem = {
  key: string;
  title: string;
  reading: string;
  detail: string;
  badge: string;
  tone: "positive" | "neutral" | "watch" | "risk";
  sparkline: number[];
};

export function parseNumericLabel(label?: string | null) {
  if (!label) return null;
  const slashMatch = label.match(/[-+]?\d+(?:[.,]\d+)?\s*\//);
  if (slashMatch) {
    const value = Number(slashMatch[0].replace("/", "").replace(",", ".").trim());
    return Number.isFinite(value) ? value : null;
  }
  const percentOrNumber = label.match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!percentOrNumber) return null;
  const value = Number(percentOrNumber[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function splitPriceLabel(label?: string | null) {
  const raw = label?.trim() || "—";
  if (!raw || raw === "—") return { amount: "—", currency: "" };
  const compact = raw.replace(/\s+/g, " ");
  const match = compact.match(/^(.+?)\s+([A-Z]{2,6})$/);
  if (!match) return { amount: compact, currency: "" };
  return { amount: match[1], currency: match[2] };
}

export function PriceMetricValue({ label }: { label?: string | null }) {
  const price = splitPriceLabel(label);
  return <strong className="vlm-analysis-price-value"><span>{price.amount}</span>{price.currency ? <em>{price.currency}</em> : null}</strong>;
}

export function tokenVisualLabel(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  if (upper === "WETH") return "ETH";
  if (upper === "WBTC") return "BTC";
  return upper.slice(0, 4);
}

const ANALYSIS_LOCAL_LOGOS: Record<string, string> = {
  AAPL: "/market-logos/aapl.svg", MSFT: "/market-logos/msft.svg", NVDA: "/market-logos/nvda.svg", GOOGL: "/market-logos/googl.svg", GOOG: "/market-logos/googl.svg", AMZN: "/market-logos/amzn.svg", META: "/market-logos/meta.svg", TSLA: "/market-logos/tsla.svg", AMD: "/market-logos/amd.svg", ASML: "/market-logos/asml.svg", TSM: "/market-logos/tsm.svg", AVGO: "/market-logos/avgo.svg", JPM: "/market-logos/jpm.svg", BAC: "/market-logos/bac.svg", V: "/market-logos/visa.svg", MA: "/market-logos/mastercard.svg", NVO: "/market-logos/nvo.svg", BMW: "/market-logos/bmw.svg", MBG: "/market-logos/mercedes.svg", VOW3: "/market-logos/vw.svg", ADS: "/market-logos/adidas.svg", AIR: "/market-logos/air.svg", MC: "/market-logos/lvmh.svg", OR: "/market-logos/or.svg", P911: "/market-logos/porsche.svg", BTC: "/market-logos/btc.svg", ETH: "/market-logos/eth.svg", BNB: "/market-logos/bnb.svg", SOL: "/market-logos/sol.svg", USDT: "/market-logos/usdt.svg", USDC: "/market-logos/usdc.svg", DOGE: "/market-logos/doge.svg", XRP: "/market-logos/xrp.svg",
  BRK: "/market-logos/brk.svg", "BRK.B": "/market-logos/brk.svg", WMT: "/market-logos/wmt.svg", LLY: "/market-logos/lly.svg", SPY: "/market-logos/spy.svg", QQQ: "/market-logos/qqq.svg", GLD: "/market-logos/gld.svg", USO: "/market-logos/uso.svg", TLT: "/market-logos/tlt.svg", EURUSD: "/market-logos/eurusd.svg", "EUR/USD": "/market-logos/eurusd.svg", DXY: "/market-logos/dxy.svg",
};

function localAnalysisLogo(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  const base = upper.replace(/[./-].*$/, "");
  return ANALYSIS_LOCAL_LOGOS[upper] ?? ANALYSIS_LOCAL_LOGOS[base];
}

function analysisAssetClassForLogo(symbol: string, name: string): "crypto" | "stock" | "fx" | "commodity" | "index" | "etf" | "real_estate" | "exchange" | "market" {
  const upper = symbol.trim().toUpperCase();
  const haystack = `${upper} ${name}`.toLowerCase();
  if (/^(BTC|ETH|WETH|WBTC|BNB|SOL|USDT|USDC|DOGE|XRP|ADA|AVAX|LINK|DOT)$/.test(upper)) return "crypto";
  if (/^[A-Z]{3}USD$/.test(upper) || upper.includes("/")) return "fx";
  if (/(gold|silver|oil|copper|commodity|surowce)/.test(haystack)) return "commodity";
  if (/(index|dax|ftse|nasdaq|s&p|dow)/.test(haystack)) return "index";
  if (/(etf|fund)/.test(haystack)) return "etf";
  if (/(reit|real estate|nieruchomo)/.test(haystack)) return "real_estate";
  if (/(binance|coinbase|kraken|bybit|mexc|exchange|venue)/.test(haystack)) return "exchange";
  if (/^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/.test(upper)) return "stock";
  return "market";
}

export function VlmAssetMark({ data }: { data: VlmAssetDetailModalData }) {
  const forcedLogo = localAnalysisLogo(data.symbol);
  return <ResolvedAssetLogo key={`${data.symbol}:${forcedLogo ?? data.imageUrl ?? "badge"}`} symbol={data.symbol} providerSymbol={data.providerSymbol} name={data.name} imageUrl={forcedLogo ?? data.imageUrl} assetClass={data.assetClass ?? analysisAssetClassForLogo(data.symbol, data.name)} venue={data.venue ?? data.exchangeLabel ?? undefined} compact eager className="vlm-analysis-token-mark-resolved" />;
}

export function assetDrawerSurface(data: VlmAssetDetailModalData): "shield" | "real-markets" {
  const label = `${data.assetClassLabel ?? ""} ${data.exchangeLabel ?? ""}`.toLowerCase();
  if (label.includes("real markets") || label.includes("stock") || label.includes("equity") || label.includes("fx") || label.includes("commodity") || label.includes("etf")) return "real-markets";
  return "shield";
}
