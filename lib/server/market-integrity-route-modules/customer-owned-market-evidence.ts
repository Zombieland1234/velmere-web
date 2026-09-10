import { randomUUID } from "node:crypto";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import {
  createCustomerOwnedMarketEvidenceAuthority,
  CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID,
  CUSTOMER_OWNED_MARKET_EVIDENCE_TTL_SECONDS,
} from "@/lib/market-integrity/customer-owned-market-evidence-authority";
import {
  normalizeMarketImpactAssetKey,
  normalizeMarketImpactSnapshots,
} from "@/lib/market-integrity/market-impact-input-validation";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  rejectOversizedUrl,
  securityJson,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

const MAX_BODY_BYTES = 900 * 1024;
const ATTESTATION_VERSION = "velmere.customer-owned-market-evidence-attestation.v1" as const;

type AttestationPayload = {
  assetKey?: unknown;
  marketImpactSnapshots?: unknown;
  sourceClass?: unknown;
  exportAllowed?: unknown;
  attestation?: unknown;
};

function validSourceClass(value: unknown) {
  if (value === undefined) return "CUSTOMER_OWNED" as const;
  return value === "CUSTOMER_OWNED" || value === "OWNER_AUTHORIZED_NON_PRODUCTION"
    ? value
    : null;
}

function validAttestation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attestation = value as Record<string, unknown>;
  return attestation.ownershipOrAuthorityConfirmed === true
    && attestation.privateCustomerDisplayConfirmed === true
    && attestation.derivedAnalyticsConfirmed === true
    && attestation.cacheConfirmed === true
    && attestation.retentionConfirmed === true
    && attestation.noPublicRedistributionConfirmed === true
    && Object.keys(attestation).sort().join("|") === [
      "cacheConfirmed",
      "derivedAnalyticsConfirmed",
      "noPublicRedistributionConfirmed",
      "ownershipOrAuthorityConfirmed",
      "privateCustomerDisplayConfirmed",
      "retentionConfirmed",
    ].sort().join("|");
}

export async function POST(request: Request) {
  const oversizedUrl = rejectOversizedUrl(request, 2_048);
  if (oversizedUrl) return oversizedUrl;
  const oversizedBody = rejectLargeContentLength(request, MAX_BODY_BYTES);
  if (oversizedBody) return oversizedBody;
  const originError = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originError) return originError;
  const rate = await applyApiRateLimit(request, {
    keyPrefix: "customer-owned-market-evidence-attestation",
    limit: 6,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const account = await resolveRequestAccount(request);
  if (!account) {
    return securityJson({
      ok: false,
      error: "account_session_required",
    }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const parsed = await readBoundedJsonBody<AttestationPayload>(request, MAX_BODY_BYTES, { maxDepth: 18 });
  if (!parsed.ok) return parsed.response;
  const assetKey = normalizeMarketImpactAssetKey(parsed.value.assetKey);
  if (!assetKey) return securityJson({ ok: false, error: "asset_key_required" }, { status: 400 });
  const sourceClass = validSourceClass(parsed.value.sourceClass);
  if (!sourceClass) return securityJson({ ok: false, error: "source_class_invalid" }, { status: 400 });
  if (parsed.value.exportAllowed !== undefined && typeof parsed.value.exportAllowed !== "boolean") {
    return securityJson({ ok: false, error: "export_right_invalid" }, { status: 400 });
  }
  if (!validAttestation(parsed.value.attestation)) {
    return securityJson({
      ok: false,
      error: "customer_market_evidence_attestation_incomplete",
      required: [
        "ownershipOrAuthorityConfirmed",
        "privateCustomerDisplayConfirmed",
        "derivedAnalyticsConfirmed",
        "cacheConfirmed",
        "retentionConfirmed",
        "noPublicRedistributionConfirmed",
      ],
    }, { status: 400 });
  }
  const snapshots = normalizeMarketImpactSnapshots(parsed.value.marketImpactSnapshots, {
    expectedAssetKey: assetKey,
    forceEvidenceStatus: "verified_staging",
  });
  if (!snapshots) {
    return securityJson({ ok: false, error: "validated_market_impact_snapshots_required" }, { status: 400 });
  }

  try {
    const receipt = createCustomerOwnedMarketEvidenceAuthority({
      receiptId: `customer-market:${randomUUID()}`,
      accountId: account.accountId,
      assetKey,
      snapshots,
      sourceClass,
      exportAllowed: parsed.value.exportAllowed === true,
    });
    return securityJson({
      ok: true,
      mode: "customer_owned_attested",
      schemaVersion: ATTESTATION_VERSION,
      authorityVersion: CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID,
      receipt,
      boundary: {
        accountBound: true,
        snapshotBound: true,
        privateCustomerDisplayOnly: true,
        publicDisplayAuthorized: false,
        redistributionAuthorized: false,
        independentLegalReviewCompleted: false,
        sourceIndependenceVerifiedByVelmere: false,
        liveMarketDataClaimed: false,
        customerFinalEligible: false,
      },
      expiresInSeconds: CUSTOMER_OWNED_MARKET_EVIDENCE_TTL_SECONDS,
    }, {
      status: 201,
      headers: {
        "cache-control": "no-store",
        "x-velmere-market-evidence-authority": CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID,
        "x-velmere-rate-limit-remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "customer_market_evidence_attestation_failed";
    return securityJson({ ok: false, error: code }, {
      status: code === "customer_market_evidence_secret_missing_or_weak" ? 503 : 422,
      headers: { "cache-control": "no-store" },
    });
  }
}
