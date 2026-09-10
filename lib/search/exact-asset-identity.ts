import {
  buildVelmereShieldBridge,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";

export type ExactCryptoIdentity = {
  symbol: string;
  id: string;
  name: string;
};

const EXACT_CRYPTO_IDENTITIES: Record<string, ExactCryptoIdentity> = {
  aave: { symbol: "AAVE", id: "aave", name: "Aave" },
  ada: { symbol: "ADA", id: "cardano", name: "Cardano" },
  cardano: { symbol: "ADA", id: "cardano", name: "Cardano" },
  apt: { symbol: "APT", id: "aptos", name: "Aptos" },
  aptos: { symbol: "APT", id: "aptos", name: "Aptos" },
  arb: { symbol: "ARB", id: "arbitrum", name: "Arbitrum" },
  arbitrum: { symbol: "ARB", id: "arbitrum", name: "Arbitrum" },
  atom: { symbol: "ATOM", id: "cosmos", name: "Cosmos" },
  cosmos: { symbol: "ATOM", id: "cosmos", name: "Cosmos" },
  avax: { symbol: "AVAX", id: "avalanche-2", name: "Avalanche" },
  avalanche: { symbol: "AVAX", id: "avalanche-2", name: "Avalanche" },
  bch: { symbol: "BCH", id: "bitcoin-cash", name: "Bitcoin Cash" },
  bnb: { symbol: "BNB", id: "binancecoin", name: "BNB" },
  btc: { symbol: "BTC", id: "bitcoin", name: "Bitcoin" },
  bitcoin: { symbol: "BTC", id: "bitcoin", name: "Bitcoin" },
  doge: { symbol: "DOGE", id: "dogecoin", name: "Dogecoin" },
  dogecoin: { symbol: "DOGE", id: "dogecoin", name: "Dogecoin" },
  dot: { symbol: "DOT", id: "polkadot", name: "Polkadot" },
  polkadot: { symbol: "DOT", id: "polkadot", name: "Polkadot" },
  eth: { symbol: "ETH", id: "ethereum", name: "Ethereum" },
  ethereum: { symbol: "ETH", id: "ethereum", name: "Ethereum" },
  fil: { symbol: "FIL", id: "filecoin", name: "Filecoin" },
  filecoin: { symbol: "FIL", id: "filecoin", name: "Filecoin" },
  hbar: { symbol: "HBAR", id: "hedera-hashgraph", name: "Hedera" },
  hedera: { symbol: "HBAR", id: "hedera-hashgraph", name: "Hedera" },
  icp: { symbol: "ICP", id: "internet-computer", name: "Internet Computer" },
  inj: { symbol: "INJ", id: "injective-protocol", name: "Injective" },
  injective: { symbol: "INJ", id: "injective-protocol", name: "Injective" },
  ldo: { symbol: "LDO", id: "lido-dao", name: "Lido DAO" },
  link: { symbol: "LINK", id: "chainlink", name: "Chainlink" },
  chainlink: { symbol: "LINK", id: "chainlink", name: "Chainlink" },
  ltc: { symbol: "LTC", id: "litecoin", name: "Litecoin" },
  litecoin: { symbol: "LTC", id: "litecoin", name: "Litecoin" },
  mkr: { symbol: "MKR", id: "maker", name: "Maker" },
  maker: { symbol: "MKR", id: "maker", name: "Maker" },
  near: { symbol: "NEAR", id: "near", name: "NEAR Protocol" },
  op: { symbol: "OP", id: "optimism", name: "Optimism" },
  optimism: { symbol: "OP", id: "optimism", name: "Optimism" },
  shib: { symbol: "SHIB", id: "shiba-inu", name: "Shiba Inu" },
  sol: { symbol: "SOL", id: "solana", name: "Solana" },
  solana: { symbol: "SOL", id: "solana", name: "Solana" },
  sui: { symbol: "SUI", id: "sui", name: "Sui" },
  ton: { symbol: "TON", id: "the-open-network", name: "Toncoin" },
  toncoin: { symbol: "TON", id: "the-open-network", name: "Toncoin" },
  trx: { symbol: "TRX", id: "tron", name: "TRON" },
  tron: { symbol: "TRX", id: "tron", name: "TRON" },
  uni: { symbol: "UNI", id: "uniswap", name: "Uniswap" },
  uniswap: { symbol: "UNI", id: "uniswap", name: "Uniswap" },
  xlm: { symbol: "XLM", id: "stellar", name: "Stellar" },
  stellar: { symbol: "XLM", id: "stellar", name: "Stellar" },
  xrp: { symbol: "XRP", id: "ripple", name: "XRP" },
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveExactCryptoIdentity(query: string) {
  return EXACT_CRYPTO_IDENTITIES[normalize(query)] ?? null;
}

export function matchesExactCryptoIdentity(
  result: Pick<VelmereSearchResult, "symbol" | "id" | "title">,
  identity: ExactCryptoIdentity,
) {
  const idMatches = result.id.trim().toLowerCase() === identity.id;
  const symbolMatches = result.symbol?.trim().toUpperCase() === identity.symbol;
  const titleMatches = result.title.trim().toLowerCase() === identity.name.toLowerCase();
  // Coin symbols are not globally unique. Never accept a different CoinGecko id
  // merely because its ticker collides with the requested canonical asset.
  return idMatches || (symbolMatches && titleMatches);
}

export function buildExactCryptoIdentityFallback(
  identity: ExactCryptoIdentity,
  locale: "pl" | "en" | "de",
): VelmereSearchResult {
  const bridge = buildVelmereShieldBridge(identity.symbol, identity.id);
  const copy = locale === "pl"
    ? {
        summary: `${identity.name} (${identity.symbol}) zostało rozpoznane dokładnie po symbolu. Bieżące dane rynkowe nie zostały potwierdzone w tym żądaniu.`,
        why: "Dokładna tożsamość aktywa jest ważniejsza niż zwrócenie podobnie brzmiącego, ale błędnego instrumentu.",
        next: `Ponów pobranie źródeł dla ${identity.symbol} lub otwórz Shield; raport pozostaje zablokowany przed mocnym werdyktem bez świeżych danych.`,
      }
    : locale === "de"
      ? {
          summary: `${identity.name} (${identity.symbol}) wurde exakt anhand des Symbols erkannt. Aktuelle Marktdaten wurden in dieser Anfrage nicht bestätigt.`,
          why: "Eine exakte Asset-Identität ist wichtiger als ein ähnlich benanntes, aber falsches Instrument.",
          next: `Quellen für ${identity.symbol} erneut abrufen oder Shield öffnen; ohne frische Daten bleibt ein starkes Urteil gesperrt.`,
        }
      : {
          summary: `${identity.name} (${identity.symbol}) was resolved by an exact symbol lock. Current market data was not confirmed in this request.`,
          why: "Exact asset identity is more important than returning a similarly named but incorrect instrument.",
          next: `Retry sources for ${identity.symbol} or open Shield; a strong verdict stays blocked without fresh data.`,
        };
  return {
    id: identity.id,
    title: identity.name,
    symbol: identity.symbol,
    category: "token",
    tone: "blocked",
    summary: copy.summary,
    whyItMatters: copy.why,
    missingData: [
      "fresh live market provider response",
      "second-source venue agreement",
    ],
    nextOperatorStep: copy.next,
    sourceMode: "missing",
    sourceConfidence: 0,
    shieldHref: bridge.href,
    avatarLabel: identity.symbol,
    bridge,
    sources: [
      {
        id: "exact-symbol-identity-lock",
        label: "Exact symbol identity lock",
        mode: "missing",
        freshness: "missing",
        confidence: 0,
        note: "Identity is canonical, but current price/evidence providers were not attached.",
      },
    ],
    chips: ["exact symbol", "identity locked", "live data required"],
    marketSnapshot: { assetClass: "crypto" },
  };
}
