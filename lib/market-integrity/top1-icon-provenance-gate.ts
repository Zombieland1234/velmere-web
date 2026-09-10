import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { VelmereReportAssetFamily } from "@/lib/market-integrity/report-asset-family";

export type Pass2818IconProvider =
  | "coingecko_image"
  | "twelvedata_logo"
  | "official_brand_asset"
  | "curated_internal_asset"
  | "safe_text_fallback";

export type Pass2818IconStatus =
  | "approved_source_bound"
  | "fallback_required"
  | "blocked_unsafe_source"
  | "not_allowed_on_surface";

export type Pass2818IconSurface = "Shield" | "Real Markets" | "Shield Pro" | "PDF" | "Community" | "Report Access";

export type Pass2818IconProvenanceGate = {
  schemaVersion: "pass2818_icon_provenance_gate_v1";
  surface: Pass2818IconSurface;
  symbol: string;
  assetFamily: VelmereReportAssetFamily;
  tier: VelmereTier;
  provider: Pass2818IconProvider;
  status: Pass2818IconStatus;
  sourceUrl: string | null;
  cachePolicy: {
    proxyRequired: boolean;
    maxBytes: number;
    allowedContentTypes: string[];
    inlineSvgAllowed: false;
    hotlinkingAllowed: false;
    cacheTtlSeconds: number;
  };
  licensePolicy: {
    status: "approved" | "needs_review" | "fallback_only";
    note: string;
  };
  securityChecks: string[];
  blockedReasons: string[];
  rendererRule: string;
  pdfRule: string;
  shieldProRule: string;
  releaseGate: {
    status: "pass" | "warn" | "block";
    reasons: string[];
  };
};

export const PASS2818_ICON_PROVENANCE_ACCEPTANCE_GATES = [
  "Public Shield and Real Markets may show asset/exchange icons only from approved provider/cache registry or a safe text fallback.",
  "Shield Pro remains text-first monochrome: no asset icons, logos, green/red/gold emotional color cues or hotlinked images.",
  "External icon SVG is never injected inline; image proxy/cache validates protocol, host, content type, byte size and CSP/no-sniff headers.",
  "Missing or license-unclear icon sources must render fallback initials and mark icon provenance as fallback_required, never a broken image.",
  "PDF cannot treat an icon/logo as evidence; logos are presentation metadata and source receipts remain separate from visual branding.",
  "Provider icon outages must not break tables or PDF generation; they degrade to fallback text and preserve source/risk confidence separately.",
] as const;

const cryptoSymbols = new Set(["BTC", "ETH", "SOL", "BNB", "USDT", "USDC", "XRP", "ADA", "DOGE", "LINK", "AVAX", "DOT", "MATIC", "POL"]);
const exchangeSymbols = new Set(["BINANCE", "MEXC", "OKX", "BYBIT", "COINBASE", "KRAKEN", "EUREX", "XETRA"]);

function normalizeSymbol(symbol: string) {
  return (symbol || "ASSET").toUpperCase().replace(/[^A-Z0-9._/=-]/g, "").slice(0, 32) || "ASSET";
}

function familyProvider(symbol: string, family: VelmereReportAssetFamily): Pass2818IconProvider {
  if (family === "native_crypto" || family === "erc20" || family === "stablecoin" || cryptoSymbols.has(symbol)) return "coingecko_image";
  if (family === "equity" || family === "etf" || family === "fx" || family === "commodity" || family === "real_estate") return "twelvedata_logo";
  if (family === "exchange_health" || exchangeSymbols.has(symbol)) return "official_brand_asset";
  return "safe_text_fallback";
}

function approvedSourceUrl(symbol: string, provider: Pass2818IconProvider) {
  if (provider === "coingecko_image") return `velmere-cache://coingecko/icons/${encodeURIComponent(symbol.toLowerCase())}`;
  if (provider === "twelvedata_logo") return `velmere-cache://twelvedata/logo/${encodeURIComponent(symbol)}`;
  if (provider === "official_brand_asset") return `velmere-curated://official-brand-assets/${encodeURIComponent(symbol)}`;
  if (provider === "curated_internal_asset") return `velmere-curated://internal/${encodeURIComponent(symbol)}`;
  return null;
}

export function buildPass2818IconProvenanceGate(args: {
  surface: Pass2818IconSurface;
  symbol: string;
  assetFamily?: VelmereReportAssetFamily;
  tier?: VelmereTier;
  provider?: Pass2818IconProvider;
  sourceUrl?: string | null;
  contentType?: string | null;
  byteLength?: number | null;
  licenseApproved?: boolean;
  hostApproved?: boolean;
  inlineSvgRequested?: boolean;
  generatedAt?: string;
}): Pass2818IconProvenanceGate {
  const symbol = normalizeSymbol(args.symbol);
  const family = args.assetFamily ?? "unknown";
  const tier = args.tier ?? "Basic";
  const provider = args.provider ?? familyProvider(symbol, family);
  const blockedReasons: string[] = [];
  const securityChecks = [
    "https/proxy/cache only",
    "approved provider host or velmere-curated source",
    "content-type image/* only",
    "byte-size budget enforced",
    "x-content-type-options nosniff",
    "no inline external SVG",
  ];

  if (args.surface === "Shield Pro") blockedReasons.push("Shield Pro is text-first monochrome and must not render asset icons.");
  if (args.inlineSvgRequested) blockedReasons.push("external inline SVG requested");
  if (args.hostApproved === false) blockedReasons.push("icon host not approved by registry");
  if (args.contentType && !args.contentType.toLowerCase().startsWith("image/")) blockedReasons.push("icon content-type is not image/*");
  if (typeof args.byteLength === "number" && args.byteLength > 600_000) blockedReasons.push("icon exceeds 600KB safety budget");

  const isFallback = provider === "safe_text_fallback" || args.licenseApproved === false;
  const status: Pass2818IconStatus = args.surface === "Shield Pro"
    ? "not_allowed_on_surface"
    : blockedReasons.length
      ? "blocked_unsafe_source"
      : isFallback
        ? "fallback_required"
        : "approved_source_bound";

  const releaseStatus: "pass" | "warn" | "block" = status === "approved_source_bound" ? "pass" : status === "fallback_required" ? "warn" : "block";

  return {
    schemaVersion: "pass2818_icon_provenance_gate_v1",
    surface: args.surface,
    symbol,
    assetFamily: family,
    tier,
    provider,
    status,
    sourceUrl: args.sourceUrl ?? approvedSourceUrl(symbol, provider),
    cachePolicy: {
      proxyRequired: true,
      maxBytes: 600_000,
      allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/avif", "image/svg+xml"],
      inlineSvgAllowed: false,
      hotlinkingAllowed: false,
      cacheTtlSeconds: 60 * 60 * 24 * 7,
    },
    licensePolicy: {
      status: args.licenseApproved === false ? "fallback_only" : provider === "safe_text_fallback" ? "fallback_only" : provider === "official_brand_asset" ? "needs_review" : "approved",
      note: provider === "official_brand_asset"
        ? "Use only curated official brand assets after license/brand-guideline review."
        : provider === "safe_text_fallback"
          ? "Fallback initials are allowed when licensed logos are missing or unsafe."
          : "Provider asset must stay proxied/cached and separated from evidence receipts.",
    },
    securityChecks,
    blockedReasons,
    rendererRule: status === "approved_source_bound"
      ? "Render icon through Velmère proxy/cache with provenance headers; do not count the icon as a data source."
      : status === "fallback_required"
        ? "Render neutral fallback initials; do not show broken image, emotional colors or source-confidence boost."
        : "Do not render the icon on this surface; use text fallback only.",
    pdfRule: "PDF may include logos only as presentation metadata; source receipts and risk evidence remain separate and hash-bound.",
    shieldProRule: "Shield Pro B/W terminal is text-first and intentionally iconless to avoid brand/color influence.",
    releaseGate: {
      status: releaseStatus,
      reasons: blockedReasons.length ? blockedReasons : status === "fallback_required" ? ["licensed/proxied icon source not confirmed; fallback initials required"] : ["icon provenance gate accepted"],
    },
  };
}

export function buildPass2818IconRegistrySnapshot(args: {
  surface: Pass2818IconSurface;
  symbols: string[];
  assetFamily?: VelmereReportAssetFamily;
  tier?: VelmereTier;
}) {
  const gates = args.symbols.slice(0, 64).map((symbol) => buildPass2818IconProvenanceGate({
    surface: args.surface,
    symbol,
    assetFamily: args.assetFamily ?? "unknown",
    tier: args.tier ?? "Basic",
  }));
  return {
    schemaVersion: "pass2818_icon_registry_snapshot_v1" as const,
    surface: args.surface,
    total: gates.length,
    approved: gates.filter((gate) => gate.status === "approved_source_bound").length,
    fallback: gates.filter((gate) => gate.status === "fallback_required").length,
    blocked: gates.filter((gate) => gate.status === "blocked_unsafe_source" || gate.status === "not_allowed_on_surface").length,
    gates,
    rendererRule: "Icon registry is presentation-only: fallbacks never change risk/confidence/source quorum.",
  };
}
