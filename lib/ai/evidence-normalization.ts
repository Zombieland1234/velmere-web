function clean(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function ascii(value: unknown) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export type EvidenceSourceDescriptor = {
  id?: unknown;
  label?: unknown;
  mode?: unknown;
  freshness?: unknown;
  note?: unknown;
};

export type EvidenceTimestampState =
  | "fresh"
  | "aging"
  | "stale"
  | "future"
  | "invalid"
  | "missing";

export type EvidenceTimestampAssessment = {
  state: EvidenceTimestampState;
  observedAt: string | null;
  ageMinutes: number | null;
  futureSkewSeconds: number | null;
};

export function normalizeProviderFamily(value: unknown) {
  const original = clean(value);
  const lower = ascii(original);
  if (!lower) return "";
  if (/\b(alpha\s*vantage|alphavantage)\b/.test(lower)) return "Alpha Vantage";
  if (/\b(twelve\s*data|twelvedata)\b/.test(lower)) return "Twelve Data";
  if (/\bfinnhub\b/.test(lower)) return "Finnhub";
  if (/\b(iex(?:\s*cloud)?)\b/.test(lower)) return "IEX";
  if (/\b(sec|edgar)\b/.test(lower)) return "SEC EDGAR";
  if (/\bcoinmarketcap\b/.test(lower)) return "CoinMarketCap";
  if (/\bmexc\b/.test(lower)) return "MEXC";
  if (/\bokx\b/.test(lower)) return "OKX";
  if (/\bbybit\b/.test(lower)) return "Bybit";
  if (/\b(yahoo|finance\.yahoo)\b/.test(lower)) return "Yahoo Finance";
  if (/\bstooq\b/.test(lower)) return "Stooq";
  if (/\bcoingecko\b/.test(lower)) return "CoinGecko";
  if (/\bbinance\b/.test(lower)) return "Binance";
  if (/\bcoinbase\b/.test(lower)) return "Coinbase";
  if (/\bkraken\b/.test(lower)) return "Kraken";
  if (/\bdexscreener\b/.test(lower)) return "DexScreener";
  if (/\betherscan\b/.test(lower)) return "Etherscan";
  if (/\bsolscan\b/.test(lower)) return "Solscan";
  if (/\balchemy\b/.test(lower)) return "Alchemy";
  if (/\bquicknode\b/.test(lower)) return "QuickNode";
  if (/\bpolygon(?:\.io)?\b/.test(lower)) return "Polygon";
  if (/\b(velmere|vlm|source ledger|local table|internal page|cross asset shield)\b/.test(lower)) return "Velmère internal";
  if (/\b(missing|unavailable|unknown|brak|niedostep|nicht verfugbar|provider required|source required|fixture|mock|synthetic|preview only)\b/.test(lower)) return "missing";
  if (/^(primary|secondary|second|main)?\s*(market\s*)?(source|provider|feed|quote|lane|adapter|router|client)(\s*(preview|fallback|cached))?$/i.test(original)) return "missing";
  return original
    .replace(/\s+(quote|chart|adapter|api|rest|websocket|ws|source|provider|router|lane|feed|client)$/i, "")
    .trim() || original;
}

function sourceModeIsLive(value: unknown) {
  const mode = ascii(value).replace(/[^a-z_]+/g, "");
  return mode === "live" || mode === "live_table";
}

function familyFromSource(source: EvidenceSourceDescriptor) {
  if (!sourceModeIsLive(source.mode)) return "";
  const label = clean(source.label);
  const id = clean(source.id);
  const note = clean(source.note);
  for (const candidate of [label, id]) {
    const family = normalizeProviderFamily(candidate);
    if (family && family !== "missing" && family !== "Velmère internal") return family;
  }
  if (note) {
    const family = normalizeProviderFamily(note);
    // Notes are only accepted when they resolve to a known canonical family.
    // This prevents arbitrary prose from becoming a fake independent provider.
    if (family && family !== note && family !== "missing" && family !== "Velmère internal") return family;
  }
  return "";
}

export function independentLiveProviderSources<T extends EvidenceSourceDescriptor>(
  sources: readonly T[] | null | undefined,
) {
  const seen = new Set<string>();
  const result: Array<{ family: string; source: T }> = [];
  for (const source of sources ?? []) {
    const family = familyFromSource(source);
    if (!family) continue;
    const key = family.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ family, source });
  }
  return result;
}

export function independentLiveProviderFamilies(
  sources: readonly EvidenceSourceDescriptor[] | null | undefined,
) {
  return independentLiveProviderSources(sources).map((entry) => entry.family);
}

export function assessEvidenceTimestamp(
  value: unknown,
  options: {
    nowMs?: number;
    futureToleranceMs?: number;
    freshWithinMinutes?: number;
    staleAfterMinutes?: number;
  } = {},
): EvidenceTimestampAssessment {
  const raw = clean(value);
  if (!raw) return { state: "missing", observedAt: null, ageMinutes: null, futureSkewSeconds: null };
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return { state: "invalid", observedAt: null, ageMinutes: null, futureSkewSeconds: null };
  const nowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  const futureToleranceMs = Math.max(0, options.futureToleranceMs ?? 120_000);
  const futureSkewMs = parsed - nowMs;
  if (futureSkewMs > futureToleranceMs) {
    return {
      state: "future",
      observedAt: new Date(parsed).toISOString(),
      ageMinutes: null,
      futureSkewSeconds: Math.round(futureSkewMs / 1_000),
    };
  }
  const ageMinutes = Math.max(0, Math.round((nowMs - parsed) / 60_000));
  const freshWithinMinutes = Math.max(0, options.freshWithinMinutes ?? 5);
  const staleAfterMinutes = Math.max(freshWithinMinutes, options.staleAfterMinutes ?? 30);
  const state: EvidenceTimestampState = ageMinutes <= freshWithinMinutes
    ? "fresh"
    : ageMinutes <= staleAfterMinutes
      ? "aging"
      : "stale";
  return {
    state,
    observedAt: new Date(parsed).toISOString(),
    ageMinutes,
    futureSkewSeconds: futureSkewMs > 0 ? Math.round(futureSkewMs / 1_000) : 0,
  };
}

export function independentProviderFamilies(
  values: readonly (string | null | undefined)[] | null | undefined,
  options: { includeInternal?: boolean; includeMissing?: boolean } = {},
) {
  const seen = new Set<string>();
  const families: string[] = [];
  for (const value of values ?? []) {
    const family = normalizeProviderFamily(value);
    if (!family) continue;
    if (!options.includeInternal && family === "Velmère internal") continue;
    if (!options.includeMissing && family === "missing") continue;
    const key = family.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    families.push(family);
  }
  return families;
}

export function evidenceLaneKey(value: unknown) {
  const text = ascii(value).replace(/[^a-z0-9]+/g, " ").trim();
  if (!text) return "";
  if (/\b(asset identity|identity|symbol identity|instrument identity)\b/.test(text)) return "asset_identity";
  if (/\b(primary|main|first)\b.*\b(source|provider|quote|feed)\b|\b(primary source|primary market source|native market quote|equity quote|index quote|quote provider|index provider)\b/.test(text)) return "primary_source";
  if (/\b(second|independent|cross venue|cross provider)\b.*\b(source|provider|quote|confirmation|check)\b|\bsecond source\b/.test(text)) return "second_source";
  if (/\b(timestamp|freshness|fresh|stale|market session timestamp|quote freshness|source freshness)\b/.test(text)) return "freshness";
  if (/\b(cadence|history|persistent history|historical)\b/.test(text)) return "cadence_history";
  if (/\b(confidence|source confidence|confidence cap)\b/.test(text)) return "confidence";
  if (/\b(orderbook|order book|venue depth|depth snapshot|liquidity spread|spread liquidity)\b/.test(text)) return "market_depth";
  if (/\b(holders?|holder concentration|supply)\b/.test(text)) return "holders_supply";
  if (/\b(contract|admin|permissions?|owner|mint|blacklist)\b/.test(text)) return "contract_admin";
  if (/\b(contradiction|divergence)\b/.test(text)) return "contradiction_divergence";
  if (/\b(operator sign off|manual sign off|manual QA|reviewer sign off)\b/.test(text)) return "human_review";
  if (/\b(payment|receipt|entitlement|stripe|blik|web3)\b/.test(text)) return "payment_receipt";
  if (/\b(missing data|missing lane|missing proof|source gap)\b/.test(text)) return "missing_data";
  return text;
}

export function reconcileEvidenceLanes(args: {
  required?: readonly (string | null | undefined)[] | null;
  confirmed?: readonly (string | null | undefined)[] | null;
  limited?: readonly (string | null | undefined)[] | null;
  explicitMissing?: readonly (string | null | undefined)[] | null;
}) {
  const confirmed = Array.from(new Set((args.confirmed ?? []).map(clean).filter(Boolean)));
  const limited = Array.from(new Set((args.limited ?? []).map(clean).filter(Boolean)));
  const explicitMissing = Array.from(new Set((args.explicitMissing ?? []).map(clean).filter(Boolean)));
  const confirmedKeys = new Set(confirmed.map(evidenceLaneKey).filter(Boolean));
  const limitedKeys = new Set(limited.map(evidenceLaneKey).filter(Boolean));
  const explicitMissingKeys = new Set(explicitMissing.map(evidenceLaneKey).filter(Boolean));
  const conflicts = confirmed.filter((lane) => explicitMissingKeys.has(evidenceLaneKey(lane)));
  const requiredMissing = (args.required ?? [])
    .map(clean)
    .filter(Boolean)
    .filter((lane) => {
      const key = evidenceLaneKey(lane);
      return !confirmedKeys.has(key) && !limitedKeys.has(key);
    });
  const missing = Array.from(new Set([...explicitMissing, ...requiredMissing]));
  return { confirmed, limited, missing, conflicts } as const;
}
