import { isSha256Digest } from "@/lib/security/cryptographic-digest";

type UnknownRecord = Record<string, unknown>;

const MAX_LIVE_AGE_MS = 5 * 60_000;
const MAX_CLOCK_SKEW_MS = 30_000;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function blockersAreExplicitlyEmpty(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

/**
 * A quote may use words such as `live` for a provider transport state. That is
 * not a customer-facing LIVE proof. Only an explicit, complete, signed server
 * delivery gate may authorize the label.
 */
export function hasServerVerifiedQuoteLiveGate(value: unknown, nowMs = Date.now()) {
  const quote = record(value);
  if (!quote) return false;
  const delivery = record(quote.liveDeliveryGate) ?? record(quote.delivery);
  if (!delivery) return false;
  const receiptRoot = String(delivery.sourceReceiptRoot ?? "").trim();
  const receiptDigest = String(delivery.receiptDigest ?? "").trim();
  const sourceAsOfMs = Date.parse(String(delivery.sourceAsOf ?? ""));
  return (
    delivery.state === "live_verified"
    && delivery.serverVerified === true
    && delivery.liveClaimAllowed === true
    && delivery.exactIdentity === true
    && delivery.completenessBps === 10_000
    && isSha256Digest(receiptRoot)
    && isSha256Digest(receiptDigest)
    && Number.isFinite(sourceAsOfMs)
    && sourceAsOfMs <= nowMs + MAX_CLOCK_SKEW_MS
    && nowMs - sourceAsOfMs <= MAX_LIVE_AGE_MS
    && blockersAreExplicitlyEmpty(delivery.blockers)
  );
}

/** The PASS6 kline route exposes a narrower but still explicit live gate. */
export function hasServerVerifiedKlineLiveGate(value: unknown) {
  const payload = record(value);
  if (!payload || payload.mode !== "live_verified" || payload.freshness !== "source_timestamped") {
    return false;
  }
  const delivery = record(payload.delivery);
  if (!delivery) return false;
  return (
    delivery.state === "live_verified"
    && delivery.exactIdentity === true
    && Number(delivery.independentProviderCount) >= 2
    && Number(delivery.goodProviderCount) >= 2
    && Number(delivery.freshProviderCount) >= 2
    && delivery.withholdCandles === false
    && blockersAreExplicitlyEmpty(delivery.blockers)
  );
}

export type CustomerMarketDataState =
  | "live_verified"
  | "partial_not_live"
  | "last_known_good"
  | "unverified";
