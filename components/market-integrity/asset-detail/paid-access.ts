import type { VlmPaidAccessContext, VlmPaidProductId } from "../../../lib/commerce/vlm-paid-access";
import { readVlmPaidAccessToken } from "../../../lib/commerce/vlm-paid-access-client";
import type { VlmAssetDetailModalData } from "./contract";
import type { AnalysisTierLabel, VlmServerEvidencePacket } from "./analysis-contract";
import { fetchAssetDetailJson } from "./network";
import { createBrowserSecureId } from "../../../lib/runtime/browser-secure-id";
import { resolvePass35PaidUiStopSell } from "../../../lib/commerce/pass35-paid-ui-stop-sell";
import { getVlmCurrentSkuTruth } from "../../../lib/commerce/vlm-current-sku-truth";

export type PaidAnalysisTier = "Pro" | "Advanced";
export type AssetDetailLocale = VlmPaidAccessContext["locale"];

type CommercialDeliveryPayload = {
  state?: string;
  deliveryAllowed?: boolean;
  captureAllowed?: boolean;
  blockers?: string[];
};

type VlmAccessPayload = {
  mode?: string;
  error?: string;
  customerMessage?: string;
  publicEvidencePacket?: VlmServerEvidencePacket;
  commercialReadiness?: {
    customerMessage?: string;
    tiers?: {
      pro?: { sellReady?: boolean };
      advanced?: { sellReady?: boolean };
    };
  };
  commercialDelivery?: CommercialDeliveryPayload;
  access?: {
    depth?: string;
    paidRequired?: boolean;
    accessMode?: string;
  };
  uxBinding?: { customerMessage?: string };
  clickRuntime?: { message?: string };
};

const REAL_MARKET_CLASSES = new Set([
  "stock",
  "etf",
  "fx",
  "commodity",
  "real_estate",
  "index",
  "exchange",
  "market",
]);

export const ASSET_DETAIL_BINDING_MAX_AGE_MS = 10 * 60_000;
export const ASSET_DETAIL_MAX_PAID_TOKEN_CHARS = 8_192;

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function normalizedIdentity(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function createAssetDetailRequestId(prefix: string) {
  return createBrowserSecureId(prefix.replaceAll("/", "-")).slice(0, 160);
}

export function normalizePaidAnalysisAccessToken(value: unknown) {
  const token = String(value ?? "").trim();
  if (token.length < 8 || token.length > ASSET_DETAIL_MAX_PAID_TOKEN_CHARS) return "";
  if (hasControlCharacter(token)) return "";
  return token;
}

export function verifyEvidencePacketBinding(args: {
  packet: VlmServerEvidencePacket | null | undefined;
  data: VlmAssetDetailModalData;
  tier: AnalysisTierLabel;
  requestId: string;
  now?: number;
}) {
  const packet = args.packet;
  const expectedDepth = args.tier === "Basic" ? "basic" : args.tier === "Pro" ? "pro" : "advanced";
  const expectedSurface = assetDetailApiSurface(args.data);
  const expectedSymbol = normalizedIdentity(args.data.symbol);
  const issuedAtMs = Date.parse(packet?.requestBinding?.issuedAt ?? "");
  const now = args.now ?? Date.now();
  const ageMs = now - issuedAtMs;

  const reasons: string[] = [];
  if (!packet) reasons.push("packet_missing");
  if (normalizedIdentity(packet?.asset?.symbol) !== expectedSymbol) reasons.push("asset_symbol_mismatch");
  if (packet?.depth !== expectedDepth) reasons.push("packet_depth_mismatch");
  if (packet?.surface !== expectedSurface) reasons.push("packet_surface_mismatch");
  if (packet?.requestBinding?.requestId !== args.requestId) reasons.push("request_id_mismatch");
  if (normalizedIdentity(packet?.requestBinding?.query) !== expectedSymbol) reasons.push("request_query_mismatch");
  if (packet?.requestBinding?.depth !== expectedDepth) reasons.push("request_depth_mismatch");
  if (packet?.requestBinding?.surface !== expectedSurface) reasons.push("request_surface_mismatch");
  if (!Number.isFinite(issuedAtMs)) reasons.push("request_issued_at_invalid");
  else if (ageMs < -60_000) reasons.push("request_issued_at_future");
  else if (ageMs > ASSET_DETAIL_BINDING_MAX_AGE_MS) reasons.push("request_binding_expired");

  return { ok: reasons.length === 0, reasons, expectedDepth, expectedSurface, expectedSymbol };
}

export function assetDetailPaidSurface(data: VlmAssetDetailModalData): VlmPaidAccessContext["surface"] {
  if (data.analysisSurface === "shield-pro") return "shield-pro";
  if (data.assetClass === "crypto" || data.assetClass === "exchange_token") return "shield";
  if (data.assetClass && REAL_MARKET_CLASSES.has(data.assetClass)) return "real-markets";
  const label = `${data.assetClassLabel ?? ""} ${data.exchangeLabel ?? ""}`.toLowerCase();
  if (/real markets|stock|equity|etf|forex|\bfx\b|commodity|reit|index|exchange/.test(label)) return "real-markets";
  return "shield";
}

export function assetDetailApiSurface(data: VlmAssetDetailModalData) {
  const surface = assetDetailPaidSurface(data);
  if (surface === "shield-pro") return "shield_pro" as const;
  return surface === "real-markets" ? "real_markets" as const : "shield" as const;
}

export function resolveAssetDetailLocale(value?: string | null): AssetDetailLocale {
  const normalized = value?.toLowerCase().split("-")[0];
  return normalized === "de" ? "de" : normalized === "en" ? "en" : "pl";
}

export function currentAssetDetailLocale(): AssetDetailLocale {
  if (typeof document === "undefined") return "pl";
  return resolveAssetDetailLocale(document.documentElement.lang);
}

export function paidAnalysisProductId(tier: PaidAnalysisTier): VlmPaidProductId {
  return tier === "Pro" ? "vlm_pro_analysis_single" : "vlm_advanced_analysis_single";
}

export function paidAnalysisAccessContext(args: {
  data: VlmAssetDetailModalData;
  tier: PaidAnalysisTier;
  locale?: AssetDetailLocale;
  returnPath?: string;
}): VlmPaidAccessContext {
  return {
    surface: assetDetailPaidSurface(args.data),
    locale: args.locale ?? currentAssetDetailLocale(),
    assetId: args.data.symbol,
    symbol: args.data.symbol,
    depth: args.tier === "Pro" ? "pro" : "advanced",
    returnPath: args.returnPath,
  };
}

function currentReturnPath() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function readPaidAnalysisAccessToken(data: VlmAssetDetailModalData, tier: PaidAnalysisTier) {
  return normalizePaidAnalysisAccessToken(readVlmPaidAccessToken(
    paidAnalysisProductId(tier),
    paidAnalysisAccessContext({ data, tier, returnPath: currentReturnPath() }),
  ));
}

export function paidAnalysisCheckoutHref(data: VlmAssetDetailModalData, tier: PaidAnalysisTier) {
  const locale = currentAssetDetailLocale();
  const truth = getVlmCurrentSkuTruth(tier === "Pro" ? "pro" : "advanced", locale);
  // Compatibility name retained for existing callers, but a public checkout URL is
  // deliberately never returned while the canonical R44P16 SKU truth disables sale.
  return tier === "Pro" && truth.decision === "INVITATION_ONLY_CONTROLLED_BETA"
    ? `/${locale}/contact?topic=vlm-pro-controlled-beta&asset=${encodeURIComponent(data.symbol)}`
    : `/${locale}/trust-center`;
}

export function paidAnalysisUiStopSell(
  data: VlmAssetDetailModalData,
  tier: PaidAnalysisTier,
) {
  return resolvePass35PaidUiStopSell({
    productId: paidAnalysisProductId(tier),
    surface: assetDetailPaidSurface(data),
    tier: tier === "Pro" ? "pro" : "advanced",
  });
}

export function paidTierCopy(tier: PaidAnalysisTier, locale = currentAssetDetailLocale()) {
  const truth = getVlmCurrentSkuTruth(tier === "Pro" ? "pro" : "advanced", locale);
  return {
    checkout: truth.actionLabel,
    unavailable: `${truth.availabilityLabel}. ${truth.description}`,
    payment: locale === "de"
      ? "Der öffentliche Checkout ist deaktiviert. Ein vorhandener interner Testzugang wird ausschließlich serverseitig geprüft."
      : locale === "pl"
        ? "Publiczny checkout jest wyłączony. Istniejący wewnętrzny dostęp testowy jest weryfikowany wyłącznie po stronie serwera."
        : "Public checkout is disabled. Existing internal evaluation access is verified server-side only.",
  };
}

function vlmRequestBody(
  data: VlmAssetDetailModalData,
  depth: "basic" | "pro" | "advanced",
  prompt: string,
  requestId: string,
) {
  return JSON.stringify({
    query: data.symbol,
    locale: currentAssetDetailLocale(),
    depth,
    surface: assetDetailApiSurface(data),
    prompt,
    requestId,
  });
}

function strictPaidDeliveryVerified(
  payload: VlmAccessPayload | null,
  data: VlmAssetDetailModalData,
  tier: PaidAnalysisTier,
  requestId: string,
) {
  const expectedDepth = tier === "Pro" ? "pro" : "advanced";
  return payload?.access?.paidRequired === true
    && payload.access.depth === expectedDepth
    && payload.commercialDelivery?.state === "paid_delivery_ready"
    && payload.commercialDelivery.deliveryAllowed === true
    && payload.commercialDelivery.captureAllowed === true
    && verifyEvidencePacketBinding({ packet: payload.publicEvidencePacket, data, tier, requestId }).ok;
}

export async function fetchPaidTierReadiness(args: {
  data: VlmAssetDetailModalData;
  tier: PaidAnalysisTier;
  signal?: AbortSignal;
}) {
  const requestId = createAssetDetailRequestId(`readiness:${args.data.symbol}:${args.tier}`);
  const { response, payload } = await fetchAssetDetailJson<VlmAccessPayload>(
    "/api/market-integrity/vlm",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: vlmRequestBody(args.data, "basic", `${args.data.name} · paid tier readiness preflight`, requestId),
    },
    { signal: args.signal },
  );
  const key = args.tier === "Pro" ? "pro" : "advanced";
  return {
    ok: response.ok && payload?.commercialReadiness?.tiers?.[key]?.sellReady === true,
    status: response.status,
    message: payload?.commercialReadiness?.customerMessage
      || payload?.customerMessage
      || paidTierCopy(args.tier).unavailable,
  };
}

export async function verifyPaidTierToken(args: {
  data: VlmAssetDetailModalData;
  tier: PaidAnalysisTier;
  paidAccessToken: string;
  signal?: AbortSignal;
}) {
  const depth = args.tier === "Pro" ? "pro" : "advanced";
  const paidAccessToken = normalizePaidAnalysisAccessToken(args.paidAccessToken);
  const requestId = createAssetDetailRequestId(`verify:${args.data.symbol}:${args.tier}`);
  if (!paidAccessToken) {
    return { ok: false, status: 401, payload: null, packet: null, message: paidTierCopy(args.tier).payment, bindingReasons: ["paid_token_invalid"] };
  }
  const { response, payload } = await fetchAssetDetailJson<VlmAccessPayload>(
    "/api/market-integrity/vlm",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: vlmRequestBody(args.data, depth, `${args.data.name} · paid tier execution verification`, requestId),
    },
    { signal: args.signal },
  );
  const binding = verifyEvidencePacketBinding({ packet: payload?.publicEvidencePacket, data: args.data, tier: args.tier, requestId });
  return {
    ok: response.ok && strictPaidDeliveryVerified(payload, args.data, args.tier, requestId),
    status: response.status,
    payload,
    packet: binding.ok ? payload?.publicEvidencePacket ?? null : null,
    bindingReasons: binding.reasons,
    message: payload?.uxBinding?.customerMessage
      || payload?.clickRuntime?.message
      || payload?.commercialReadiness?.customerMessage
      || payload?.customerMessage
      || paidTierCopy(args.tier).payment,
  };
}

export async function fetchAnalysisEvidencePacket(args: {
  data: VlmAssetDetailModalData;
  tier: AnalysisTierLabel;
  requestId: string;
  paidAccessToken?: string;
  signal?: AbortSignal;
}) {
  const depth = args.tier === "Basic" ? "basic" : args.tier === "Pro" ? "pro" : "advanced";
  const paidAccessToken = args.paidAccessToken ? normalizePaidAnalysisAccessToken(args.paidAccessToken) : "";
  if (args.tier !== "Basic" && !paidAccessToken) {
    return { status: "gated" as const, packet: null, message: paidTierCopy(args.tier).payment, bindingReasons: ["paid_token_invalid"] };
  }
  const { response, payload } = await fetchAssetDetailJson<VlmAccessPayload>(
    "/api/market-integrity/vlm",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: vlmRequestBody(args.data, depth, `${args.data.name} · ${args.data.sourceLabel ?? "source pending"}`, args.requestId),
    },
    { signal: args.signal },
  );

  if (response.status === 402) {
    return {
      status: "gated" as const,
      packet: null,
      message: payload?.uxBinding?.customerMessage || payload?.clickRuntime?.message || "Paid evidence packet requires verified access.",
    };
  }
  if (response.ok && payload?.publicEvidencePacket) {
    const binding = verifyEvidencePacketBinding({ packet: payload.publicEvidencePacket, data: args.data, tier: args.tier, requestId: args.requestId });
    if (!binding.ok) {
      return { status: args.tier === "Basic" ? "limited" as const : "gated" as const, packet: null, message: "Server packet binding failed; the response was rejected.", bindingReasons: binding.reasons };
    }
    if (args.tier !== "Basic" && !strictPaidDeliveryVerified(payload, args.data, args.tier, args.requestId)) {
      return { status: "gated" as const, packet: null, message: paidTierCopy(args.tier).payment, bindingReasons: ["paid_delivery_contract_invalid"] };
    }
    return {
      status: "verified" as const,
      packet: payload.publicEvidencePacket,
      message: "Server packet attached to this result.",
      bindingReasons: [],
    };
  }
  return {
    status: "limited" as const,
    packet: null,
    message: payload?.customerMessage || "Server packet unavailable; local evidence lanes stay visible.",
  };
}
