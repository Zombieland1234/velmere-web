const consumedReceipts = new Map<string, number>();
const MAX_RECEIPTS = 10_000;

function prune(now = Date.now()) {
  for (const [receiptId, expiresAt] of consumedReceipts) {
    if (expiresAt <= now) consumedReceipts.delete(receiptId);
  }
  while (consumedReceipts.size > MAX_RECEIPTS) {
    const oldest = consumedReceipts.keys().next().value as string | undefined;
    if (!oldest) break;
    consumedReceipts.delete(oldest);
  }
}

export function consumeVlmReceiptOnce(receiptId: string, expiresAt: string) {
  const now = Date.now();
  prune(now);
  const expiry = Date.parse(expiresAt);
  if (!receiptId || !Number.isFinite(expiry) || expiry <= now) {
    return { ok: false as const, reason: "receipt_not_consumable" };
  }
  if (consumedReceipts.has(receiptId)) {
    return { ok: false as const, reason: "receipt_replay_detected" };
  }
  consumedReceipts.set(receiptId, expiry);
  prune(now);
  return { ok: true as const };
}

export function getVlmReceiptReplayStats() {
  prune();
  return { consumed: consumedReceipts.size, maxReceipts: MAX_RECEIPTS };
}
