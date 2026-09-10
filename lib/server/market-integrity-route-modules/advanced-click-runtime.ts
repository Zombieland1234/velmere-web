import { type VlmAccessDepth, type VlmAccessSurface, type VlmAccessPurpose } from "@/lib/commerce/vlm-advanced-only-access-policy";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { buildPass2192AdvancedClickRuntimeProof } from "@/lib/ai/advanced-click-runtime-proof";
import { buildPass2195RuntimeUxBinding, buildPass2195RuntimeUxBindingReport, stateForAdvancedAccessMode } from "@/lib/ui/runtime-ux-binding";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength, securityJson } from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";

const PASS2192_AUDIT_BOUNDARY =
  "advanced-click-runtime-proof: same-origin endpoint that resolves Basic/Pro/Advanced click outcomes so UI never has a dead click and Advanced remains paid/local-demo gated";

type Body = {
  depth?: VlmAccessDepth;
  surface?: VlmAccessSurface;
  locale?: "pl" | "en" | "de";
  assetId?: string;
  symbol?: string;
  returnPath?: string;
};

function normalizeDepth(value: unknown): VlmAccessDepth {
  return value === "basic" || value === "pro" || value === "advanced" ? value : "basic";
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "en" || value === "de" || value === "pl" ? value : "pl";
}

function normalizeSurface(value: unknown): VlmAccessSurface {
  return value === "browser" || value === "audit" || value === "real-markets" || value === "shield" || value === "unknown" ? value : "shield";
}

function purposeForSurface(surface: VlmAccessSurface): VlmAccessPurpose {
  if (surface === "browser") return "pdf";
  if (surface === "audit") return "audit";
  return "analysis";
}

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "default", {
    keyPrefix: "pass2192-advanced-click-runtime",
    queryParam: "q",
    allowEmptyQuery: true,
  });
  if (!shield.ok) return shield.response;

  return securityJson({
    ok: true,
    auditBoundary: PASS2192_AUDIT_BOUNDARY,
    pass2195UxBinding: buildPass2195RuntimeUxBindingReport("pl"),
    proof: buildPass2192AdvancedClickRuntimeProof({
      staticRoutePresent: true,
      staticClientNoticePresent: true,
      staticClientGateFetchPresent: true,
    }),
    ...abuseShieldResponseMeta(shield),
  });
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 16 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "pass2192-advanced-click-runtime-write",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const shield = await applyApiAbuseShield(request, "default", {
    keyPrefix: "pass2192-advanced-click-runtime-write",
    queryParam: "q",
    allowEmptyQuery: true,
    allowedMethods: ["POST"],
  });
  if (!shield.ok) return shield.response;

  const parsedBody = await readBoundedJsonBody<Body>(request, 16 * 1024, { maxDepth: 8 });
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.value;

  const depth = normalizeDepth(body.depth);
  const locale = normalizeLocale(body.locale);
  const surface = normalizeSurface(body.surface);
  const accessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "advanced_click",
    request,
    purposeOverride: purposeForSurface(surface),
    surfaceOverride: surface,
    depth,
    locale,
    assetId: body.assetId,
    symbol: body.symbol,
    returnPath: body.returnPath,
  });

  const proof = buildPass2192AdvancedClickRuntimeProof({
    staticRoutePresent: true,
    staticClientNoticePresent: true,
    staticClientGateFetchPresent: true,
  });

  if (!accessGate.ok) {
    const uxBinding = buildPass2195RuntimeUxBinding("advanced_checkout_required", locale);
    return securityJson(
      {
        ...toVlmPaidSurfacePaymentRequiredPayload(accessGate),
        action: "checkout_required",
        clickRuntime: {
          state: "checkout_required",
          noDeadClick: true,
          userVisibleOutcome: "checkout",
          message: uxBinding.customerMessage,
          uxStateCode: uxBinding.stateCode,
          receiptCode: uxBinding.receiptCode,
        },
        uxBinding,
        auditBoundary: PASS2192_AUDIT_BOUNDARY,
        proof,
        ...abuseShieldResponseMeta(shield),
      },
      { status: 402, headers: accessGate.headers },
    );
  }

  const readyUxBinding = buildPass2195RuntimeUxBinding(
    stateForAdvancedAccessMode({ ok: true, accessMode: accessGate.accessMode }),
    locale,
  );

  return securityJson({
    ok: true,
    mode: "authorized",
    publication: { scope: "entitlement_action", liveMarketClaimed: false },
    action: "start_analysis",
    clickRuntime: {
      state: depth === "advanced" ? "advanced_ready" : `${depth}_ready`,
      noDeadClick: true,
      userVisibleOutcome: "analysis",
      localDemo: false,
      message: readyUxBinding.customerMessage,
      uxStateCode: readyUxBinding.stateCode,
      receiptCode: readyUxBinding.receiptCode,
    },
    uxBinding: readyUxBinding,
    access: {
      depth: accessGate.depth,
      paidRequired: accessGate.paidRequired,
      accessMode: accessGate.accessMode,
      reason: accessGate.reason,
      policy: accessGate.policy,
    },
    auditBoundary: PASS2192_AUDIT_BOUNDARY,
    proof,
    ...abuseShieldResponseMeta(shield),
  });
}
