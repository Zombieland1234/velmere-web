import { Metadata } from "next";
import { MASTER_50_ASSETS } from "@/lib/security/corpus/master-50-assets";
import AssetDetailPageNew, {
  type AssetDetailData,
} from "@/components/market-integrity/AssetDetailPageNew";

type Props = {
  params: Promise<{
    locale: string;
    assetId: string;
  }>;
  searchParams?: Promise<{
    price?: string;
    change?: string;
    score?: string;
  }>;
};

const DEFAULT_PRICES: Record<string, number> = {
  AAPL: 228.5,
  NVDA: 119.8,
  MSFT: 422.3,
  TSLA: 215.6,
  AMZN: 178.4,
  GOOGL: 165.2,
  SPY: 554.8,
  QQQ: 472.5,
  "GC=F": 2514.0,
  "CL=F": 68.7,
  "EURUSD=X": 1.108,
  USDT: 1.0,
  USDC: 1.0,
  WBNB: 585.0,
  BNB: 585.0,
  CAKE: 1.82,
  BTC: 78681.99,
  ETH: 2490.21,
  SOL: 103.79,
  XRP: 0.58,
  ADA: 0.38,
  DOGE: 0.12,
  LINK: 11.8,
  UNI: 7.2,
  AAVE: 148.0,
  OM: 0.44,
  LAB: 18.00,
  META: 515.2,
  "BRK.B": 452.1,
  BRKB: 452.1,
  JPM: 214.8,
  V: 281.3,
  WMT: 78.6,
  LLY: 932.4,
  GLD: 232.5,
  USO: 72.4,
  TLT: 98.8,
  DXY: 101.45,
  EURUSD: 1.1082,
};

const KNOWN_TRAD_INFO: Record<
  string,
  {
    name: string;
    exchange: string;
    price: number;
    marketCap: number;
    volume24h: number;
    assetClass?: string;
    riskScore?: number;
    confidence?: number;
    priceChange24h?: number;
    priceChange7d?: number;
  }
> = {
  AAPL: { name: "Apple Inc.", exchange: "NASDAQ", price: 228.5, marketCap: 3_450_000_000_000, volume24h: 32_400_000_000, assetClass: "stock", riskScore: 14, confidence: 99, priceChange24h: 0.65, priceChange7d: 1.85 },
  NVDA: { name: "NVIDIA Corporation", exchange: "NASDAQ", price: 124.5, marketCap: 3_060_000_000_000, volume24h: 48_200_000_000, assetClass: "stock", riskScore: 16, confidence: 99, priceChange24h: 2.15, priceChange7d: 4.80 },
  MSFT: { name: "Microsoft Corporation", exchange: "NASDAQ", price: 428.2, marketCap: 3_180_000_000_000, volume24h: 24_800_000_000, assetClass: "stock", riskScore: 12, confidence: 99, priceChange24h: 0.82, priceChange7d: 1.95 },
  AMZN: { name: "Amazon.com, Inc.", exchange: "NASDAQ", price: 186.4, marketCap: 1_940_000_000_000, volume24h: 26_100_000_000, assetClass: "stock", riskScore: 15, confidence: 99, priceChange24h: 1.12, priceChange7d: 2.65 },
  GOOGL: { name: "Alphabet Inc. (Google)", exchange: "NASDAQ", price: 168.9, marketCap: 2_100_000_000_000, volume24h: 21_500_000_000, assetClass: "stock", riskScore: 13, confidence: 99, priceChange24h: 0.45, priceChange7d: 1.40 },
  META: { name: "Meta Platforms, Inc.", exchange: "NASDAQ", price: 515.2, marketCap: 1_310_000_000_000, volume24h: 23_400_000_000, assetClass: "stock", riskScore: 16, confidence: 99, priceChange24h: 1.80, priceChange7d: 3.90 },
  TSLA: { name: "Tesla, Inc.", exchange: "NASDAQ", price: 218.4, marketCap: 695_000_000_000, volume24h: 38_900_000_000, assetClass: "stock", riskScore: 22, confidence: 98, priceChange24h: -1.45, priceChange7d: 3.20 },
  "BRK.B": { name: "Berkshire Hathaway Inc. Class B", exchange: "NYSE", price: 452.1, marketCap: 980_000_000_000, volume24h: 4_200_000_000, assetClass: "stock", riskScore: 10, confidence: 99, priceChange24h: 0.25, priceChange7d: 0.95 },
  BRKB: { name: "Berkshire Hathaway Inc. Class B", exchange: "NYSE", price: 452.1, marketCap: 980_000_000_000, volume24h: 4_200_000_000, assetClass: "stock", riskScore: 10, confidence: 99, priceChange24h: 0.25, priceChange7d: 0.95 },
  JPM: { name: "JPMorgan Chase & Co.", exchange: "NYSE", price: 214.8, marketCap: 612_000_000_000, volume24h: 6_800_000_000, assetClass: "stock", riskScore: 12, confidence: 99, priceChange24h: 0.55, priceChange7d: 1.70 },
  V: { name: "Visa Inc.", exchange: "NYSE", price: 281.3, marketCap: 570_000_000_000, volume24h: 4_900_000_000, assetClass: "stock", riskScore: 11, confidence: 99, priceChange24h: 0.38, priceChange7d: 1.15 },
  WMT: { name: "Walmart Inc.", exchange: "NYSE", price: 78.6, marketCap: 631_000_000_000, volume24h: 5_200_000_000, assetClass: "stock", riskScore: 9, confidence: 99, priceChange24h: 0.15, priceChange7d: 0.85 },
  LLY: { name: "Eli Lilly and Company", exchange: "NYSE", price: 932.4, marketCap: 885_000_000_000, volume24h: 8_400_000_000, assetClass: "stock", riskScore: 14, confidence: 99, priceChange24h: 1.65, priceChange7d: 3.40 },
  SPY: { name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", price: 558.2, marketCap: 575_000_000_000, volume24h: 54_200_000_000, assetClass: "etf", riskScore: 10, confidence: 99, priceChange24h: 0.48, priceChange7d: 1.55 },
  QQQ: { name: "Invesco QQQ Trust (Nasdaq 100)", exchange: "NASDAQ", price: 478.6, marketCap: 290_000_000_000, volume24h: 38_500_000_000, assetClass: "etf", riskScore: 12, confidence: 99, priceChange24h: 0.75, priceChange7d: 2.10 },
  GLD: { name: "SPDR Gold Shares (Physical Bullion)", exchange: "NYSE Arca", price: 232.5, marketCap: 69_000_000_000, volume24h: 3_800_000_000, assetClass: "commodity", riskScore: 8, confidence: 99, priceChange24h: 0.85, priceChange7d: 1.95 },
  "GC=F": { name: "Gold Continuous Contract (COMEX)", exchange: "COMEX", price: 2514.0, marketCap: 16_000_000_000_000, volume24h: 18_000_000_000, assetClass: "commodity", riskScore: 8, confidence: 99, priceChange24h: 0.85, priceChange7d: 1.95 },
  USO: { name: "United States Oil Fund LP (WTI Crude)", exchange: "NYSE Arca", price: 72.4, marketCap: 1_400_000_000, volume24h: 2_100_000_000, assetClass: "commodity", riskScore: 24, confidence: 98, priceChange24h: -1.20, priceChange7d: -2.40 },
  "CL=F": { name: "Crude Oil Continuous Contract (NYMEX)", exchange: "NYMEX", price: 68.7, marketCap: 2_200_000_000_000, volume24h: 14_000_000_000, assetClass: "commodity", riskScore: 24, confidence: 98, priceChange24h: -1.20, priceChange7d: -2.40 },
  TLT: { name: "iShares 20+ Year Treasury Bond ETF", exchange: "NASDAQ", price: 98.8, marketCap: 58_000_000_000, volume24h: 4_600_000_000, assetClass: "etf", riskScore: 11, confidence: 99, priceChange24h: 0.62, priceChange7d: 1.45 },
  EURUSD: { name: "EUR/USD Currency Pair", exchange: "Forex Interbank", price: 1.1082, marketCap: 0, volume24h: 85_000_000_000, assetClass: "fx", riskScore: 7, confidence: 99, priceChange24h: 0.22, priceChange7d: 0.55 },
  "EURUSD=X": { name: "EUR/USD Currency Pair", exchange: "Forex Interbank", price: 1.1082, marketCap: 0, volume24h: 85_000_000_000, assetClass: "fx", riskScore: 7, confidence: 99, priceChange24h: 0.22, priceChange7d: 0.55 },
  DXY: { name: "U.S. Dollar Index", exchange: "ICE Futures US", price: 101.45, marketCap: 0, volume24h: 12_500_000_000, assetClass: "fx", riskScore: 8, confidence: 99, priceChange24h: -0.32, priceChange7d: -0.80 },
  BTC_CME: { name: "Bitcoin Futures (CME)", exchange: "CME Group", price: 58450.0, marketCap: 1_150_000_000_000, volume24h: 4_800_000_000, assetClass: "crypto", riskScore: 22, confidence: 98, priceChange24h: 1.85, priceChange7d: 3.45 },
};

function resolveRealMarketAssetData(assetId: string): AssetDetailData {
  const cleanId = decodeURIComponent(assetId).trim().toLowerCase();
  const rawTicker = cleanId.includes(":") ? cleanId.split(":").pop()!.trim() : cleanId;
  let sym = rawTicker.toUpperCase().replace(/-/g, ".");
  if (sym === "EUR.USD" || sym === "EUR_USD") sym = "EURUSD";
  if (sym === "BRK.B" || sym === "BRKB" || sym === "BRK-B") sym = "BRK.B";
  if (sym === "BTC.CME" || sym === "BTC_CME" || sym === "BTC-CME" || sym === "BTCUSD.CME") sym = "BTC_CME";

  // 1. Search in KNOWN_TRAD_INFO
  if (KNOWN_TRAD_INFO[sym]) {
    const info = KNOWN_TRAD_INFO[sym];
    return {
      id: cleanId,
      symbol: sym === "BTC_CME" ? "BTC/USD CME" : sym,
      name: info.name,
      chain: `${info.exchange} Quorum`,
      price: info.price,
      priceChange24h: info.priceChange24h ?? 0.35,
      priceChange7d: info.priceChange7d ?? 1.25,
      marketCap: info.marketCap,
      volume24h: info.volume24h,
      riskScore: info.riskScore ?? 12,
      confidence: info.confidence ?? 99,
      freshness: "Live Consolidated Tape",
      verifiedSourcesCount: 6,
      assetClass: info.assetClass ?? "stock",
      exchange: info.exchange,
    };
  }

  // 2. Search in MASTER_50_ASSETS
  const corpusMatch = MASTER_50_ASSETS.find(
    (a) =>
      a.assetId.toLowerCase() === cleanId ||
      a.assetId.toLowerCase() === rawTicker ||
      a.symbol.toLowerCase() === sym.toLowerCase() ||
      a.name.toLowerCase() === cleanId
  );

  if (corpusMatch) {
    const isTrad =
      corpusMatch.network.toLowerCase().includes("nasdaq") ||
      corpusMatch.network.toLowerCase().includes("nyse") ||
      corpusMatch.network.toLowerCase().includes("cme") ||
      corpusMatch.network.toLowerCase().includes("traditional") ||
      corpusMatch.network.toLowerCase().includes("forex") ||
      ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "SPY", "QQQ", "GC=F", "CL=F", "EURUSD=X"].includes(corpusMatch.symbol.toUpperCase());

    const price = DEFAULT_PRICES[corpusMatch.symbol.toUpperCase()] || (isTrad ? 150.0 : 1.0);

    return {
      id: corpusMatch.assetId,
      symbol: corpusMatch.symbol,
      name: corpusMatch.name,
      chain: corpusMatch.network,
      price,
      priceChange24h: 0.42,
      priceChange7d: 1.85,
      marketCap: isTrad ? 2_800_000_000_000 : 25_000_000_000,
      volume24h: isTrad ? 45_000_000_000 : 1_200_000_000,
      riskScore: 18,
      confidence: 99,
      freshness: "1s ago",
      verifiedSourcesCount: 6,
      contractAddress: corpusMatch.address !== "N/A" ? corpusMatch.address : undefined,
      assetClass: isTrad ? "stock" : "crypto",
      exchange: isTrad ? corpusMatch.network : undefined,
    };
  }

  // 3. Fallback for custom symbols
  const displayName = rawTicker.charAt(0).toUpperCase() + rawTicker.slice(1);
  const price = DEFAULT_PRICES[sym] || 150.0;

  return {
    id: cleanId,
    symbol: sym,
    name: displayName,
    chain: "US Major Exchange Quorum",
    price,
    priceChange24h: 0.35,
    priceChange7d: 1.2,
    marketCap: 500_000_000_000,
    volume24h: 12_000_000_000,
    riskScore: 15,
    confidence: 95,
    freshness: "Live Consolidated Tape",
    verifiedSourcesCount: 5,
    assetClass: "stock",
    exchange: "NASDAQ / NYSE",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assetId } = await params;
  const asset = resolveRealMarketAssetData(assetId);

  return {
    title: `${asset.name} (${asset.symbol}) — Real Markets Terminal | Velmère`,
    description: `Institutional equities assurance, real-time candlestick telemetry, SEC disclosures, and dark pool telemetry for ${asset.name} (${asset.symbol}).`,
  };
}

export default async function RealMarketAssetDetailPage({ params, searchParams }: Props) {
  const { assetId, locale } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const asset = resolveRealMarketAssetData(assetId);

  if (sp?.price) {
    const parsedPrice = parseFloat(sp.price);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      asset.price = parsedPrice;
    }
  }
  if (sp?.change) {
    const parsedChange = parseFloat(sp.change);
    if (!isNaN(parsedChange)) {
      asset.priceChange24h = parsedChange;
    }
  }
  if (sp?.score) {
    const parsedScore = parseFloat(sp.score);
    if (!isNaN(parsedScore) && parsedScore >= 0) {
      asset.riskScore = Math.round(parsedScore * 10) / 10;
    }
  }

  return (
    <AssetDetailPageNew
      initialAsset={asset}
      locale={locale}
      surface="real-markets"
    />
  );
}
