import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
export type OrderBookLevel = {
  price: number;
  quantity: number;
  notionalUsd: number;
  cumulativeUsd: number;
};

export type OrderBookDepthResult = {
  symbol: string;
  bestBid?: number;
  bestAsk?: number;
  spreadPercent?: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bidAskImbalancePercent: number;
  simulatedSellSlippage10k?: number;
  simulatedBuySlippage10k?: number;
  riskPoints: number;
  signals: Array<{ id: "thin_book" | "slippage" | "imbalance"; label: string; points: number }>;
  source: "Binance spot depth";
};

type DepthResponse = { bids?: [string, string][]; asks?: [string, string][] };

function n(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLevels(levels: [string, string][]) {
  let cumulativeUsd = 0;
  return levels.slice(0, 60).map(([priceRaw, qtyRaw]) => {
    const price = n(priceRaw);
    const quantity = n(qtyRaw);
    const notionalUsd = price * quantity;
    cumulativeUsd += notionalUsd;
    return { price, quantity, notionalUsd, cumulativeUsd };
  }).filter((level) => level.price > 0 && level.quantity > 0);
}

function simulateSellSlippage(bids: [string, string][], notionalUsd: number, mid: number) {
  let remaining = notionalUsd;
  let receivedBase = 0;
  let weightedPriceValue = 0;
  for (const [priceRaw, qtyRaw] of bids) {
    if (remaining <= 0) break;
    const price = n(priceRaw);
    const qty = n(qtyRaw);
    const levelUsd = price * qty;
    const consumeUsd = Math.min(remaining, levelUsd);
    receivedBase += price ? consumeUsd / price : 0;
    weightedPriceValue += consumeUsd;
    remaining -= consumeUsd;
  }
  if (remaining > 0 || receivedBase <= 0 || mid <= 0) return undefined;
  const avgExecution = weightedPriceValue / receivedBase;
  return Math.max(0, ((mid - avgExecution) / mid) * 100);
}

function simulateBuySlippage(asks: [string, string][], notionalUsd: number, mid: number) {
  let remaining = notionalUsd;
  let acquiredBase = 0;
  let spentUsd = 0;
  for (const [priceRaw, qtyRaw] of asks) {
    if (remaining <= 0) break;
    const price = n(priceRaw);
    const qty = n(qtyRaw);
    const levelUsd = price * qty;
    const consumeUsd = Math.min(remaining, levelUsd);
    acquiredBase += price ? consumeUsd / price : 0;
    spentUsd += consumeUsd;
    remaining -= consumeUsd;
  }
  if (remaining > 0 || acquiredBase <= 0 || mid <= 0) return undefined;
  const avgExecution = spentUsd / acquiredBase;
  return Math.max(0, ((avgExecution - mid) / mid) * 100);
}

export async function fetchBinanceOrderBook(symbol: string): Promise<OrderBookDepthResult> {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pair = clean.endsWith("USDT") ? clean : `${clean}USDT`;
  const response = await brokeredEgressFetch(`https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(pair)}&limit=100`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4_000),
    next: { revalidate: 20 },
  } as RequestInit & { next: { revalidate: number } }, { profile: "binance_spot", operation: "binance_orderbook", timeoutMs: 4_000 });
  if (!response.ok) throw new Error(`Binance depth request failed with status ${response.status}`);
  const data = await readJsonResponseBounded<DepthResponse>(response, 1_048_576);
  const bids = data.bids ?? [];
  const asks = data.asks ?? [];
  const bestBid = bids[0] ? n(bids[0][0]) : undefined;
  const bestAsk = asks[0] ? n(asks[0][0]) : undefined;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : undefined;
  const spreadPercent = mid && bestBid && bestAsk ? ((bestAsk - bestBid) / mid) * 100 : undefined;
  const bidLevels = normalizeLevels(bids);
  const askLevels = normalizeLevels(asks);
  const bidDepthUsd = bidLevels.reduce((sum, level) => sum + level.notionalUsd, 0);
  const askDepthUsd = askLevels.reduce((sum, level) => sum + level.notionalUsd, 0);
  const totalDepth = bidDepthUsd + askDepthUsd;
  const bidAskImbalancePercent = totalDepth > 0 ? ((bidDepthUsd - askDepthUsd) / totalDepth) * 100 : 0;
  const simulatedSellSlippage10k = mid ? simulateSellSlippage(bids, 10_000, mid) : undefined;
  const simulatedBuySlippage10k = mid ? simulateBuySlippage(asks, 10_000, mid) : undefined;
  const signals: OrderBookDepthResult["signals"] = [];
  if (totalDepth < 250_000) signals.push({ id: "thin_book", label: "Thin visible order book", points: 18 });
  if ((simulatedSellSlippage10k ?? 0) > 8 || (simulatedBuySlippage10k ?? 0) > 8) signals.push({ id: "slippage", label: "High $10k slippage simulation", points: 22 });
  if (Math.abs(bidAskImbalancePercent) > 55) signals.push({ id: "imbalance", label: "Bid/ask depth imbalance", points: 10 });
  return { symbol: pair, bestBid, bestAsk, spreadPercent, bidDepthUsd, askDepthUsd, bids: bidLevels, asks: askLevels, bidAskImbalancePercent, simulatedSellSlippage10k, simulatedBuySlippage10k, riskPoints: Math.min(45, signals.reduce((sum, signal) => sum + signal.points, 0)), signals, source: "Binance spot depth" };
}
