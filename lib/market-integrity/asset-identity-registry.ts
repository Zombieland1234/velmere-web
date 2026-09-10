export type Pass481AssetIdentity = {
  symbol: string;
  label: string;
  glyph: string;
  assetClass: "crypto" | "exchange_token" | "stock" | "etf" | "fx" | "commodity" | "real_estate" | "index" | "exchange" | "market";
  aliases?: string[];
  simpleIcon?: string;
  imageUrl?: string;
};

const cryptoImage = (path: string) => `https://assets.coingecko.com/coins/images/${path}`;

export const PASS481_ASSET_IDENTITIES: Pass481AssetIdentity[] = [
  { symbol: "BTC", label: "Bitcoin", glyph: "₿", assetClass: "crypto", aliases: ["BTC-USD", "BTCUSDT"], imageUrl: cryptoImage("1/large/bitcoin.png") },
  { symbol: "ETH", label: "Ethereum", glyph: "Ξ", assetClass: "crypto", aliases: ["ETH-USD", "ETHUSDT"], imageUrl: cryptoImage("279/large/ethereum.png") },
  { symbol: "SOL", label: "Solana", glyph: "◎", assetClass: "crypto", aliases: ["SOL-USD", "SOLUSDT"], imageUrl: cryptoImage("4128/large/solana.png") },
  { symbol: "BNB", label: "BNB", glyph: "BNB", assetClass: "exchange_token", aliases: ["BNB-USD", "BNBUSDT"], imageUrl: cryptoImage("825/large/bnb-icon2_2x.png") },
  { symbol: "USDT", label: "Tether", glyph: "₮", assetClass: "crypto", imageUrl: cryptoImage("325/large/Tether.png") },
  { symbol: "USDC", label: "USD Coin", glyph: "$", assetClass: "crypto", imageUrl: cryptoImage("6319/large/USD_Coin_icon.png") },
  { symbol: "XRP", label: "XRP", glyph: "X", assetClass: "crypto", imageUrl: cryptoImage("44/large/xrp-symbol-white-128.png") },
  { symbol: "ADA", label: "Cardano", glyph: "ADA", assetClass: "crypto", imageUrl: cryptoImage("975/large/cardano.png") },
  { symbol: "DOGE", label: "Dogecoin", glyph: "Ð", assetClass: "crypto", imageUrl: cryptoImage("5/large/dogecoin.png") },
  { symbol: "AVAX", label: "Avalanche", glyph: "A", assetClass: "crypto", imageUrl: cryptoImage("12559/large/Avalanche_Circle_RedWhite_Trans.png") },
  { symbol: "LINK", label: "Chainlink", glyph: "LINK", assetClass: "crypto", imageUrl: cryptoImage("877/large/chainlink-new-logo.png") },
  { symbol: "DOT", label: "Polkadot", glyph: "DOT", assetClass: "crypto", imageUrl: cryptoImage("12171/large/polkadot.png") },
  { symbol: "POL", label: "Polygon", glyph: "POL", assetClass: "crypto", aliases: ["MATIC"], imageUrl: cryptoImage("4713/large/polygon.png") },
  { symbol: "LTC", label: "Litecoin", glyph: "Ł", assetClass: "crypto", imageUrl: cryptoImage("2/large/litecoin.png") },
  { symbol: "TRX", label: "TRON", glyph: "TRX", assetClass: "crypto", imageUrl: cryptoImage("1094/large/tron-logo.png") },
  { symbol: "TON", label: "Toncoin", glyph: "TON", assetClass: "crypto", imageUrl: cryptoImage("17980/large/ton_symbol.png") },
  { symbol: "SHIB", label: "Shiba Inu", glyph: "SHIB", assetClass: "crypto", imageUrl: cryptoImage("11939/large/shiba.png") },
  { symbol: "UNI", label: "Uniswap", glyph: "UNI", assetClass: "crypto", imageUrl: cryptoImage("12504/large/uniswap-logo.png") },
  { symbol: "ATOM", label: "Cosmos", glyph: "ATOM", assetClass: "crypto", imageUrl: cryptoImage("1481/large/cosmos_hub.png") },
  { symbol: "NEAR", label: "NEAR", glyph: "N", assetClass: "crypto", imageUrl: cryptoImage("10365/large/near.jpg") },
  { symbol: "APT", label: "Aptos", glyph: "APT", assetClass: "crypto", imageUrl: cryptoImage("26455/large/aptos_round.png") },
  { symbol: "ARB", label: "Arbitrum", glyph: "ARB", assetClass: "crypto", imageUrl: cryptoImage("16547/large/arb.jpg") },
  { symbol: "OP", label: "Optimism", glyph: "OP", assetClass: "crypto", imageUrl: cryptoImage("25244/large/Optimism.png") },
  { symbol: "SUI", label: "Sui", glyph: "SUI", assetClass: "crypto", imageUrl: cryptoImage("26375/large/sui_asset.jpeg") },
  { symbol: "PEPE", label: "Pepe", glyph: "PEPE", assetClass: "crypto", imageUrl: cryptoImage("29850/large/pepe-token.jpeg") },
  { symbol: "OM", label: "MANTRA", glyph: "OM", assetClass: "crypto", aliases: ["OM-USD", "OMUSDT", "mantra-dao"], imageUrl: cryptoImage("12586/large/mantra.png") },
  { symbol: "LAB", label: "LAB Protocol", glyph: "LAB", assetClass: "crypto", aliases: ["LAB-USD", "LABUSDT"] },
  { symbol: "VLM", label: "Velmère", glyph: "V", assetClass: "crypto" },

  { symbol: "AAPL", label: "Apple", glyph: "AAPL", assetClass: "stock", simpleIcon: "apple" },
  { symbol: "NVDA", label: "NVIDIA", glyph: "NV", assetClass: "stock", simpleIcon: "nvidia" },
  { symbol: "MSFT", label: "Microsoft", glyph: "MS", assetClass: "stock", simpleIcon: "microsoft" },
  { symbol: "TSLA", label: "Tesla", glyph: "T", assetClass: "stock", simpleIcon: "tesla" },
  { symbol: "AMZN", label: "Amazon", glyph: "AMZ", assetClass: "stock", simpleIcon: "amazon" },
  { symbol: "GOOG", label: "Alphabet", glyph: "G", assetClass: "stock", aliases: ["GOOGL"], simpleIcon: "google" },
  { symbol: "META", label: "Meta", glyph: "M", assetClass: "stock", simpleIcon: "meta" },
  { symbol: "NFLX", label: "Netflix", glyph: "N", assetClass: "stock", simpleIcon: "netflix" },
  { symbol: "AMD", label: "AMD", glyph: "AMD", assetClass: "stock", simpleIcon: "amd" },
  { symbol: "INTC", label: "Intel", glyph: "INT", assetClass: "stock", simpleIcon: "intel" },
  { symbol: "ORCL", label: "Oracle", glyph: "ORC", assetClass: "stock", simpleIcon: "oracle" },
  { symbol: "IBM", label: "IBM", glyph: "IBM", assetClass: "stock", simpleIcon: "ibm" },
  { symbol: "SAP", label: "SAP", glyph: "SAP", assetClass: "stock", simpleIcon: "sap" },
  { symbol: "ASML", label: "ASML", glyph: "ASML", assetClass: "stock", simpleIcon: "asml" },
  { symbol: "MC.PA", label: "LVMH", glyph: "LV", assetClass: "stock", aliases: ["LVMH"], simpleIcon: "lvmh" },
  { symbol: "COIN", label: "Coinbase", glyph: "COIN", assetClass: "stock", simpleIcon: "coinbase" },
  { symbol: "NDAQ", label: "Nasdaq Inc.", glyph: "NQ", assetClass: "stock", simpleIcon: "nasdaq" },
  { symbol: "JPM", label: "JPMorgan", glyph: "JPM", assetClass: "stock", simpleIcon: "jpmorgan" },
  { symbol: "V", label: "Visa", glyph: "V", assetClass: "stock", simpleIcon: "visa" },
  { symbol: "MA", label: "Mastercard", glyph: "MA", assetClass: "stock", simpleIcon: "mastercard" },
  { symbol: "BRK.B", label: "Berkshire Hathaway", glyph: "BRK", assetClass: "stock", aliases: ["BRK", "BRK-B", "BRKB"], simpleIcon: "berkshirehathaway" },
  { symbol: "WMT", label: "Walmart", glyph: "WMT", assetClass: "stock", simpleIcon: "walmart" },
  { symbol: "LLY", label: "Eli Lilly", glyph: "LLY", assetClass: "stock", simpleIcon: "elililly" },

  { symbol: "SPY", label: "SPDR S&P 500 ETF", glyph: "SPY", assetClass: "etf", simpleIcon: "statestreet" },
  { symbol: "QQQ", label: "Invesco QQQ", glyph: "QQQ", assetClass: "etf", simpleIcon: "invesco" },
  { symbol: "TLT", label: "iShares 20+ Year Treasury Bond ETF", glyph: "TLT", assetClass: "etf", simpleIcon: "ishares" },
  { symbol: "USO", label: "United States Oil Fund", glyph: "USO", assetClass: "commodity", aliases: ["USO-ETF"] },
  { symbol: "BTC/USD CME Futures", label: "Bitcoin CME Futures", glyph: "BTC", assetClass: "market", aliases: ["BTC1!", "BTC=F", "BTC-CME", "BTC/USD"] },
  { symbol: "VNQ", label: "Vanguard Real Estate ETF", glyph: "VNQ", assetClass: "real_estate", simpleIcon: "vanguard" },
  { symbol: "IYR", label: "iShares U.S. Real Estate ETF", glyph: "IYR", assetClass: "real_estate", simpleIcon: "ishares" },
  { symbol: "GLD", label: "SPDR Gold Shares", glyph: "Au", assetClass: "etf", simpleIcon: "statestreet" },
  { symbol: "SLV", label: "iShares Silver Trust", glyph: "Ag", assetClass: "etf", simpleIcon: "ishares" },
  { symbol: "EEM", label: "iShares MSCI Emerging Markets ETF", glyph: "EM", assetClass: "etf", simpleIcon: "ishares" },
  { symbol: "PLD", label: "Prologis", glyph: "PLD", assetClass: "real_estate" },

  { symbol: "S&P 500", label: "S&P 500", glyph: "S&P", assetClass: "index", aliases: ["SPX", "^GSPC"] },
  { symbol: "NDX", label: "Nasdaq 100", glyph: "NDX", assetClass: "index", aliases: ["^NDX", "NASDAQ 100"] },
  { symbol: "DAX", label: "DAX", glyph: "DAX", assetClass: "index", aliases: ["^GDAXI"] },
  { symbol: "DJI", label: "Dow Jones", glyph: "DJI", assetClass: "index", aliases: ["^DJI"] },
  { symbol: "FTSE", label: "FTSE 100", glyph: "FTSE", assetClass: "index", aliases: ["^FTSE"] },
  { symbol: "VIX", label: "CBOE Volatility Index", glyph: "VIX", assetClass: "index", aliases: ["^VIX"] },

  { symbol: "EUR/USD", label: "Euro / U.S. Dollar", glyph: "€/$", assetClass: "fx", aliases: ["EURUSD", "EURUSD=X"] },
  { symbol: "USD/JPY", label: "U.S. Dollar / Japanese Yen", glyph: "$/¥", assetClass: "fx", aliases: ["USDJPY", "USDJPY=X"] },
  { symbol: "EUR/PLN", label: "Euro / Polish Złoty", glyph: "€/zł", assetClass: "fx", aliases: ["EURPLN", "EURPLN=X"] },
  { symbol: "USD/PLN", label: "U.S. Dollar / Polish Złoty", glyph: "$/zł", assetClass: "fx", aliases: ["USDPLN", "USDPLN=X"] },
  { symbol: "GBP/USD", label: "British Pound / U.S. Dollar", glyph: "£/$", assetClass: "fx", aliases: ["GBPUSD", "GBPUSD=X"] },
  { symbol: "DXY", label: "U.S. Dollar Index", glyph: "$", assetClass: "index", aliases: ["DX-Y.NYB"] },

  { symbol: "GC", label: "Gold", glyph: "Au", assetClass: "commodity", aliases: ["XAU", "XAU/USD", "GC=F"] },
  { symbol: "SI", label: "Silver", glyph: "Ag", assetClass: "commodity", aliases: ["XAG", "XAG/USD", "SI=F"] },
  { symbol: "CL", label: "WTI Crude Oil", glyph: "OIL", assetClass: "commodity", aliases: ["WTI", "CL=F"] },
  { symbol: "BZ", label: "Brent Crude", glyph: "OIL", assetClass: "commodity", aliases: ["BRENT", "BZ=F"] },
  { symbol: "HG", label: "Copper", glyph: "Cu", assetClass: "commodity", aliases: ["COPPER", "HG=F"] },
  { symbol: "NG", label: "Natural Gas", glyph: "GAS", assetClass: "commodity", aliases: ["NATGAS", "NG=F"] },

  { symbol: "BINANCE", label: "Binance", glyph: "BN", assetClass: "exchange", simpleIcon: "binance" },
  { symbol: "MEXC", label: "MEXC", glyph: "MX", assetClass: "exchange", simpleIcon: "mexc" },
  { symbol: "COINBASE", label: "Coinbase", glyph: "CB", assetClass: "exchange", simpleIcon: "coinbase" },
  { symbol: "KRAKEN", label: "Kraken", glyph: "KR", assetClass: "exchange", simpleIcon: "kraken" },
  { symbol: "BYBIT", label: "Bybit", glyph: "BY", assetClass: "exchange", simpleIcon: "bybit" },
  { symbol: "OKX", label: "OKX", glyph: "OKX", assetClass: "exchange", simpleIcon: "okx" },
  { symbol: "KUCOIN", label: "KuCoin", glyph: "KC", assetClass: "exchange", simpleIcon: "kucoin" },
  { symbol: "BITGET", label: "Bitget", glyph: "BG", assetClass: "exchange", simpleIcon: "bitget" },
  { symbol: "GATE.IO", label: "Gate.io", glyph: "GT", assetClass: "exchange", aliases: ["GATEIO"], simpleIcon: "gateio" },
];

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

const identityBySymbol = new Map<string, Pass481AssetIdentity>();
for (const identity of PASS481_ASSET_IDENTITIES) {
  identityBySymbol.set(normalize(identity.symbol), identity);
  for (const alias of identity.aliases ?? []) identityBySymbol.set(normalize(alias), identity);
}

export function resolvePass481Identity(value: string) {
  const raw = normalize(value);
  const withoutQuote = raw.replace(/[-/]?(USD|USDT|USDC)$/i, "");
  return identityBySymbol.get(raw) ?? identityBySymbol.get(withoutQuote);
}

export function resolvePass481ExchangeBrand(value: string) {
  const identity = resolvePass481Identity(value);
  return identity?.assetClass === "exchange" ? identity.simpleIcon : undefined;
}

export const PASS481_MARKET_GLYPHS: Record<string, string> = Object.fromEntries(
  PASS481_ASSET_IDENTITIES.map((identity) => [normalize(identity.symbol), identity.glyph]),
);

export function resolvePass481Glyph(value: string) {
  const normalized = normalize(value);
  const registered = resolvePass481Identity(normalized)?.glyph ?? PASS481_MARKET_GLYPHS[normalized];
  if (registered) return registered;
  const fallback = normalized.replace(/[^A-Z0-9€$£¥₿]/g, "").slice(0, 3);
  return fallback || "MKT";
}
