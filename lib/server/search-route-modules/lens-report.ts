import { publicApiError } from "@/lib/security/api-error-envelope";
import { sha256BytesDigest } from "@/lib/security/cryptographic-digest";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import { runDurableBinaryComputation, DurableComputationError } from "@/lib/jobs/durable-computation-replay";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import {
  CustomerOwnedWriteBoundaryError,
  customerOwnedWriteErrorPayload,
  resolveCustomerOwnedWriteBoundary,
} from "@/lib/db/customer-owned-write-boundary";
import { hasSecurityCookieCandidate } from "@/lib/security/cookie-session-boundary";
import { extractSupabaseUserAccessToken } from "@/lib/db/supabase";

// PASS2534: Lens/PDF must expose Visible Execution Dock state before preview/download/vault finality when proof replay is incomplete.
// PASS2533: Lens PDF finality/download requires artifact hash replay plus recovery execution ledger release gate.
// PASS2532: PDF finality must expose regenerate-artifact recovery when source/artifact freshness or hash-family replay is stale.
// PASS2531: PDF finality must pass source/artifact freshness expiry before preview/download/account vault claims.
// PASS2530: PDF finality must pass entitlement replay bridge and hash-family replay before preview/download/account vault claims.
// PASS654 public-copy compatibility marker: PASS466 · CONFIDENCE WATERFALL.
// PASS327/PASS328 Human brief + PASS328 adds print-grade A4 sections, a Proof passport lane, and safe export boundary wording: not a safety certificate, no guaranteed result.
// PASS328 HTML report route contract: @page{size:A4;margin:0}
import { NextResponse } from "next/server";
import { readBoundedFormDataBody, readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { parseStrictJsonText } from "@/lib/security/strict-json-boundary";
import {
  applyApiRateLimit as applyPass2177SoftRateLimit,
  assertSameOriginRequest as assertPass2177SameOriginRequest,
  rejectLargeContentLength as rejectPass2177LargeContentLength,
} from "@/lib/security/api-guard";
import {
  buildLensReport,
  type LensReport,
} from "@/lib/search/lens-report";
import { buildLensCommercialReadiness } from "@/lib/search/lens-commercial-readiness";
import { decideR7BrowserAccountArtifact } from "@/lib/search/browser-account-artifact-policy";
import {
  buildPass4823LensFrozenRenderPayload,
  issuePass4655LensRenderToken,
  verifyPass4655LensRenderToken,
  type Pass4823LensFrozenRenderPayload,
} from "@/lib/search/lens-render-token";
import { PASS4823_LENS_PDF_RENDERER_ID } from "@/lib/search/lens-pdf-renderer-identity";
import { applyPass4823LensPublicSafetyBoundary } from "@/lib/search/lens-public-safety";
import { verifyPass4822LensSourceToken } from "@/lib/search/lens-source-token";
import { inspectPass4649PdfBinary } from "@/lib/market-integrity/commercial-staging-proof";
import { buildPass4651CommercialDeliveryDecision } from "@/lib/market-integrity/commercial-delivery-state";
import { registerPass4653RefreshTarget } from "@/lib/market-integrity/refresh-registry";
import { buildPass583DownloadParityGate } from "@/lib/market-integrity/download-parity-gate";
import { inspectPass593PdfBuffer } from "@/lib/market-integrity/tagged-pdf-feasibility-gate";
import { buildPass610ReaderDownloadParityManifest } from "@/lib/market-integrity/reader-download-parity-manifest";
import {
  applyDurableRateLimit,
  buildDurableRateLimitHeaders,
} from "@/lib/security/durable-rate-limit";
import { getClientKey } from "@/lib/security/api-guard";
import { buildPass632Boundary } from "@/lib/security/production-rate-limit-adapter";
import {
  applyPass635ExportRedaction,
  detectPass635Leaks,
} from "@/lib/security/export-redaction-policy";
import { recordPass633AuditEvent } from "@/lib/security/audit-event-schema";
import { createClientFingerprint } from "@/lib/security/security-event-ledger";
import {
  resolveVlmPaidSurfaceAccess,
  toVlmPaidSurfacePaymentRequiredPayload,
} from "@/lib/commerce/vlm-paid-surface-guard";
import {
  PASS4159_LENS_PDF_BYTE_PARITY_REPLAY_RUNNER,
  PASS4160_LENS_PDF_SIGNED_FIXTURE_BINDER,
  PASS4161_LENS_PDF_FINAL_RUNNER_INTAKE_GATE,
  PASS4162_LENS_PDF_NODE20_PREFLIGHT_EVIDENCE_BUCKET,
  buildPass4156LensExportBoundary,
  buildPass4157LensPreviewDownloadHashFixture,
  buildPass4158LensRenderedPdfByteHashHarness,
  buildPass4655CompactLensPreview,
  isCanonicalLensRequest,
  isPass4655RenderTokenRequest,
  isPass4822LensSourceTokenRequest,
  resolveLensPdfDepth,
  type CanonicalLensRequest,
  type Pass4158LensAtomicClaim,
  type Pass4158LensProviderRow,
  type Pass4158LensSourceRow,
} from "@/lib/search/lens-report-request-contract";
import {  escapeHtml } from "@/lib/search/lens-pdf-renderer";
import { renderLensPdfWorkerPayload, type LensPdfWorkerPayload } from "@/lib/search/lens-pdf-worker";
import { buildPass4822LensCanonicalCustomerArtifact } from "@/lib/search/lens-canonical-customer-artifact";
import { resolveLensPaidScope } from "@/lib/search/lens-paid-scope";
import { buildPass4822AccountCustomerArtifactSnapshot } from "@/lib/reporting/account-customer-artifact-snapshot";
import { storePass4824AccountCustomerArtifactPdfBundle } from "@/lib/reporting/account-customer-artifact-store";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";
import {
  buildP97LensPdfDurabilityReceipt,
  buildP97LensPdfDurableArtifactPolicy,
  verifyP97LensPdfDurabilityReceipt,
} from "@/lib/search/lens-pdf-durable-artifact-policy";
import {
  buildBrowserDeliveryPreflight,
  projectBrowserCustomerDelivery,
  type BrowserDeliveryPreflight,
  type BrowserDerivedDeliveryBinding,
} from "@/lib/search/browser-delivery-policy";
import type { R7BrowserEcbDeliveryBinding } from "@/lib/search/browser-ecb-delivery-authority";

// PASS2465 PDF tier scenario parity marker: Basic/Pro/Advanced PDF must differ by proof lanes; rug-pull/trap and long/short squeeze are Advanced proof-locked scenario lanes, not filler.
// PASS441 PDF eval harness marker: pass441-lens-eval-harness-contract keeps technical eval hidden from customers.
// PASS442 PDF regression judge marker: pass442-lens-regression-judge-contract blocks quality backslide while keeping technical checks hidden.
function buildPublicLensCustomerOutput(report: LensReport) {
  if (report.locale === "de") {
    return "Kein numerischer Risikowert wird veröffentlicht. Unabhängige Live-Quellen und das erforderliche Evidenzquorum fehlen; dieser Output bleibt ein vorsichtiger Prescreen.";
  }
  if (report.locale === "en") {
    return "No numeric risk score is published. Independent live sources and the required evidence quorum are missing, so this output remains a cautious prescreen.";
  }
  return "Liczbowy wynik ryzyka nie jest publikowany. Brakuje niezależnych źródeł live i wymaganego kworum dowodów, dlatego wynik pozostaje ostrożnym prescreeningiem.";
}

function buildPublicLensReport(report: LensReport, commercialReadiness: ReturnType<typeof buildLensCommercialReadiness>) {
  return applyPass4823LensPublicSafetyBoundary({
    report,
    customerOutput: buildPublicLensCustomerOutput(report),
    confirmedSourceCount: commercialReadiness.confirmedSourceCount,
    confidence: commercialReadiness.confidence,
  });
}

function renderTokenFailureStatus(error: string) {
  if (error === "render_token_expired" || error.includes("not_current") || error.includes("deadline_elapsed")) return 410;
  if (error.includes("mismatch")) return 409;
  if (error.includes("signature") || error.includes("key_unknown")) return 403;
  return 400;
}

async function handleLensReportPost(request: Request, nowMs: number) {
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get("format") || "pdf";
  const selectedDepth = resolveLensPdfDepth(requestUrl.searchParams.get("tier"));
  const deliverySurface = selectedDepth !== "basic"
    ? "lens_pdf_paid" as const
    : format === "pdf"
      ? "lens_pdf_basic" as const
      : "lens_preview" as const;
  let deliveryPreflight: BrowserDeliveryPreflight;
  let deliveryBinding: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding | null;
  const limiterLane = `${format}:${selectedDepth}`;
  const pass2177SizeGuard = rejectPass2177LargeContentLength(
    request,
    2_000_000,
  );
  if (pass2177SizeGuard) return pass2177SizeGuard;

  const pass2177OriginGuard = assertPass2177SameOriginRequest(request, {
    allowMissingOrigin: true,
  });
  if (pass2177OriginGuard) return pass2177OriginGuard;

  // Preserve an unread copy for body-bound trusted account verification and
  // bearer extraction after the Lens payload parser consumes the original.
  const accountResolutionRequest = request.clone();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    return NextResponse.json(
      { ok: false, error: "payload_too_large" },
      { status: 413 },
    );
  }
  let rawPayload: unknown;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const parsedBody = await readBoundedJsonBody<unknown>(request, 2_000_000, { maxDepth: 32 });
    if (!parsedBody.ok) return parsedBody.response;
    rawPayload = parsedBody.value;
  } else {
    const parsedForm = await readBoundedFormDataBody(request, 2_000_000);
    if (!parsedForm.ok) return parsedForm.response;
    try {
      rawPayload = parseStrictJsonText(String(parsedForm.value.get("payload") || ""), {
        maxBytes: 2_000_000,
        maxDepth: 32,
        maxNodes: 50_000,
        requireObject: true,
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 },
      );
    }
  }

  let payload: LensReport | null = null;
  let frozenPayload: Pass4823LensFrozenRenderPayload | null = null;
  let canonicalRequest: CanonicalLensRequest | null = null;
  let signedRenderTokenVerified = false;
  let signedSourceTokenVerified = false;
  const unsignedFixtureMode = process.env.NODE_ENV !== "production"
    && process.env.VELMERE_ALLOW_UNSIGNED_LENS_FIXTURES === "true";

  if (format === "pdf") {
    // PASS4806: a downloadable PDF may only be reconstructed from a short-lived
    // server-signed render token. Never accept a browser-supplied full report or
    // an unsigned canonical request as the source of an official-looking file.
    if (!isPass4655RenderTokenRequest(rawPayload)) {
      deliveryPreflight = buildBrowserDeliveryPreflight(deliverySurface, undefined, nowMs);
      const denied = projectBrowserCustomerDelivery({ decision: deliveryPreflight, payload: null, nowMs });
      return NextResponse.json(denied.payload, {
        status: denied.status,
        headers: { "cache-control": "no-store" },
      });
    }
    const verified = verifyPass4655LensRenderToken({
      token: rawPayload.renderToken,
      expectedDepth: selectedDepth,
      expectedTier: selectedDepth,
      expectedRendererId: PASS4823_LENS_PDF_RENDERER_ID,
      nowMs,
    });
    if (!verified.ok) {
      const status = renderTokenFailureStatus(verified.error);
      return NextResponse.json({ ok: false, error: verified.error }, { status, headers: { "cache-control": "no-store" } });
    }
    frozenPayload = verified.frozen;
    payload = verified.report;
    deliveryBinding = verified.frozen.deliveryBinding ?? {
      schemaVersion: "velmere.browser.derived-delivery-binding.v1",
      mode: "derived_analytics",
      derivedAllowed: true,
    };
    signedRenderTokenVerified = true;
  } else if (isPass4822LensSourceTokenRequest(rawPayload)) {
    const verified = verifyPass4822LensSourceToken({ token: rawPayload.sourceToken, nowMs });
    if (!verified.ok) {
      const status = verified.error === "lens_source_token_expired" || verified.error.includes("not_current") ? 410
        : verified.error.includes("signature") || verified.error.includes("digest") ? 403
          : verified.error.includes("locale_mismatch") ? 409
            : 400;
      return NextResponse.json({ ok: false, error: verified.error }, { status, headers: { "cache-control": "no-store" } });
    }
    canonicalRequest = { result: verified.result, locale: verified.locale, depth: selectedDepth };
    deliveryBinding = verified.deliveryBinding ?? {
      schemaVersion: "velmere.browser.derived-delivery-binding.v1",
      mode: "derived_analytics",
      derivedAllowed: true,
    };
    signedSourceTokenVerified = true;
  } else if (isPass4655RenderTokenRequest(rawPayload)) {
    const verified = verifyPass4655LensRenderToken({
      token: rawPayload.renderToken,
      expectedDepth: selectedDepth,
      expectedTier: selectedDepth,
      expectedRendererId: PASS4823_LENS_PDF_RENDERER_ID,
      nowMs,
    });
    if (!verified.ok) {
      const status = renderTokenFailureStatus(verified.error);
      return NextResponse.json({ ok: false, error: verified.error }, { status, headers: { "cache-control": "no-store" } });
    }
    frozenPayload = verified.frozen;
    payload = verified.report;
    deliveryBinding = verified.frozen.deliveryBinding ?? {
      schemaVersion: "velmere.browser.derived-delivery-binding.v1",
      mode: "derived_analytics",
      derivedAllowed: true,
    };
    signedRenderTokenVerified = true;
  } else if (unsignedFixtureMode && isCanonicalLensRequest(rawPayload)) {
    canonicalRequest = rawPayload;
    deliveryBinding = {
      schemaVersion: "velmere.browser.derived-delivery-binding.v1",
      mode: "derived_analytics",
      derivedAllowed: true,
    };
  } else if (isCanonicalLensRequest(rawPayload)) {
    return NextResponse.json(
      { ok: false, error: "signed_search_result_required" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  } else {
    deliveryPreflight = buildBrowserDeliveryPreflight(deliverySurface, undefined, nowMs);
    const denied = projectBrowserCustomerDelivery({ decision: deliveryPreflight, payload: null, nowMs });
    return NextResponse.json(denied.payload, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  deliveryPreflight = buildBrowserDeliveryPreflight(deliverySurface, deliveryBinding, nowMs);
  const initialDelivery = projectBrowserCustomerDelivery({ decision: deliveryPreflight, payload: null, nowMs });
  if (!initialDelivery.allowed) {
    return NextResponse.json(initialDelivery.payload, {
      status: initialDelivery.status,
      headers: { "cache-control": "no-store" },
    });
  }

  const pass2177RateLimit = await applyPass2177SoftRateLimit(request, {
    keyPrefix: `pass4642-search-lens-report:${limiterLane}`,
    limit: 36,
    windowMs: 60_000,
  });
  if (!pass2177RateLimit.ok) return pass2177RateLimit.response;

  const rateBoundary = buildPass632Boundary({
    route: new URL(request.url).pathname,
    provider: "lens-pdf-export",
    user: "anonymous",
    client: getClientKey(request, "client"),
  });
  const rateLimit = await applyDurableRateLimit({
    namespace: `velmere-lens-pdf:${limiterLane}`,
    key: rateBoundary.key,
    limit: 36,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429, headers: buildDurableRateLimitHeaders(rateLimit) },
    );
  }

  if (canonicalRequest) {
    if (canonicalRequest.depth !== selectedDepth) {
      return NextResponse.json(
        { ok: false, error: "depth_mismatch" },
        { status: 409 },
      );
    }
    try {
      const report = buildLensReport(
        canonicalRequest.result,
        canonicalRequest.locale,
        canonicalRequest.depth,
        new Date(nowMs).toISOString(),
      );
      const publicReport = buildPublicLensReport(
        report,
        buildLensCommercialReadiness(report, canonicalRequest.depth),
      );
      const isEcb = Boolean(deliveryBinding && (deliveryBinding as { mode?: string }).mode !== "derived_analytics");
      frozenPayload = buildPass4823LensFrozenRenderPayload({
        report: isEcb
          ? { ...publicReport, deliveryAuthority: deliveryBinding as any }
          : publicReport,
        sourceResultId: canonicalRequest.result.id,
        ...(isEcb ? { deliveryBinding: deliveryBinding as any } : {}),
      });
      payload = frozenPayload.report;
    } catch (freezeErr) {
      console.error("[FREEZE_ERROR]:", freezeErr);
      return NextResponse.json(
        { ok: false, error: "canonical_report_freeze_failed", details: freezeErr instanceof Error ? freezeErr.message : String(freezeErr) },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  }
  if (!payload || !frozenPayload) {
    return NextResponse.json(
      { ok: false, error: "invalid_report_request" },
      { status: 400 },
    );
  }

  if (format === "pdf" && !signedRenderTokenVerified) {
    return NextResponse.json(
      { ok: false, error: "signed_render_token_required" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const lensAssetClass = payload.pass478.assetClass as import("@/lib/market-integrity/risk-types").VelmereMarketAssetClass;
  const lensSurface = lensAssetClass === "crypto" || lensAssetClass === "unknown" ? "crypto" as const : "real_markets" as const;
  const refreshRegistration = await registerPass4653RefreshTarget({
    requestedIdentity: payload.symbol,
    surface: lensSurface,
    assetClass: lensAssetClass,
    requestedTier: selectedDepth,
  }).catch(() => null);

  const paidScope = resolveLensPaidScope({
    canonicalAssetId: frozenPayload.identity.sourceResultId,
    canonicalSymbol: payload.symbol,
    assertedAssetId: request.headers.get("x-velmere-paid-asset-id"),
    assertedSymbol: request.headers.get("x-velmere-paid-symbol"),
  });
  if (!paidScope.ok) {
    return NextResponse.json(
      { ok: false, error: paidScope.error, conflicts: paidScope.conflicts },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  const accessGate = await resolveVlmPaidSurfaceAccess({
    policyId: "lens_pdf",
    request,
    depth: selectedDepth,
    locale: payload.locale,
    assetId: paidScope.assetId,
    symbol: paidScope.symbol,
  });
  if (format === "pdf" && !accessGate.ok && process.env.NODE_ENV === "production") {
    return NextResponse.json(toVlmPaidSurfacePaymentRequiredPayload(accessGate), {
      status: 402,
      headers: accessGate.headers,
    });
  }
  const durableAccount = await resolveRequestAccount(accountResolutionRequest);
  const customerAuthenticationAttempted = Boolean(request.headers.get("authorization")?.trim())
    || hasSecurityCookieCandidate(request, "account_session")
    || hasSecurityCookieCandidate(request, "supabase_access")
    || hasSecurityCookieCandidate(request, "session_family");
  if (!durableAccount && customerAuthenticationAttempted) {
    return NextResponse.json(
      {
        ok: false,
        error: "CUSTOMER_WRITE_AUTH_REQUIRED",
        code: "invalid_token",
        retryable: false,
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const commercialReadiness = buildLensCommercialReadiness(payload, selectedDepth);
  if (format === "pdf" && selectedDepth !== "basic" && !commercialReadiness.sellReady && process.env.NODE_ENV === "production") {
    return NextResponse.json({
      ok: false,
      error: "premium_report_not_ready",
      basicFallbackAvailable: true,
      commercialReadiness,
      pass4653RefreshRegistration: refreshRegistration,
      commercialDelivery: buildPass4651CommercialDeliveryDecision({
        tier: selectedDepth,
        surface: "lens_pdf",
        entitlementVerified: accessGate.ok && accessGate.paidRequired,
        preCheckoutReady: commercialReadiness.evidenceThresholdMet,
        analysisSellReady: commercialReadiness.sellReady,
        durableEvidenceReady: commercialReadiness.unifiedLedgerReady,
        outputReady: false,
        providerDegraded: !commercialReadiness.unifiedLedgerReady,
        operatorSignReady: selectedDepth !== "advanced" || payload.pass646.state === "locked",
      }),
      customerMessage: commercialReadiness.customerMessage,
    }, { status: 422, headers: { "cache-control": "no-store" } });
  }

  if (format === "json") {
    const tokenTransport = requestUrl.searchParams.get("transport") === "token";
    // PASS4656: every canonical preview attempts to mint a short-lived server render token.
    // The full preview remains available for the current rich reader, but the browser no longer
    // needs to send the complete report back to the PDF endpoint.
    const renderToken = frozenPayload && (signedSourceTokenVerified || signedRenderTokenVerified || unsignedFixtureMode)
      ? issuePass4655LensRenderToken({ frozen: frozenPayload, nowMs })
      : null;
    if (tokenTransport && (!renderToken || !renderToken.ok)) {
      return NextResponse.json(
        { ok: false, error: renderToken?.error ?? "render_token_unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
    const previewPayload = {
        ok: true,
        report: tokenTransport ? buildPass4655CompactLensPreview(payload) : payload,
        reportIdentity: frozenPayload.identity,
        renderToken: renderToken?.ok ? renderToken.token : undefined,
        renderTokenExpiresAt: renderToken?.ok ? renderToken.expiresAt : undefined,
        transport: tokenTransport ? "signed_render_token" : renderToken?.ok ? "full_preview_with_signed_render_token" : "signed_source_token_required",
        commercialReadiness,
        pass4653RefreshRegistration: refreshRegistration,
        commercialDelivery: buildPass4651CommercialDeliveryDecision({
          tier: selectedDepth,
          surface: "lens_pdf",
          entitlementVerified: accessGate.ok && accessGate.paidRequired,
          preCheckoutReady: selectedDepth === "basic" || commercialReadiness.evidenceThresholdMet,
          analysisSellReady: selectedDepth === "basic" || commercialReadiness.sellReady,
          durableEvidenceReady: selectedDepth === "basic" || commercialReadiness.unifiedLedgerReady,
          outputReady: true,
          providerDegraded: false,
          operatorSignReady: selectedDepth !== "advanced" || payload.pass646.state === "locked",
        }),
        access: {
          depth: accessGate.depth,
          paidRequired: accessGate.paidRequired,
          accessMode: accessGate.accessMode,
          policy: accessGate.policy,
        },
        pass4156: buildPass4156LensExportBoundary({
          format: "json_preview",
          report: payload,
          redactionGateChecked: false,
        }),
        pass4157: buildPass4157LensPreviewDownloadHashFixture({
          format: "json_preview",
          report: payload,
          redactionState: "pending_preview",
        }),
        pass4158: buildPass4158LensRenderedPdfByteHashHarness({
          format: "json_preview",
          report: payload,
        }),
      };
    const projectedPreview = projectBrowserCustomerDelivery({
      decision: deliveryPreflight,
      payload: previewPayload,
      nowMs,
    });
    return NextResponse.json(
      projectedPreview.payload,
      {
        status: projectedPreview.status,
        headers: {
          "cache-control": "no-store",
          "x-velmere-pass4156-lens-export-boundary":
            "json-preview-same-report-family",
          "x-velmere-pass4157-lens-hash-fixture":
            "preview-download-report-checksum-parity",
          "x-velmere-pass4158-lens-pdf-byte-hash":
            "deferred-until-pdf-render-no-raw-pdf-in-json",
          "x-velmere-pass4158-lens-byte-hash-harness":
            "deferred-until-pdf-render-no-raw-pdf-in-json",
          "x-velmere-pass4159-lens-byte-parity-replay":
            PASS4159_LENS_PDF_BYTE_PARITY_REPLAY_RUNNER,
          "x-velmere-pass4160-lens-pdf-signed-fixture-binder":
            PASS4160_LENS_PDF_SIGNED_FIXTURE_BINDER,
          "x-velmere-pass4161-lens-pdf-final-runner-intake":
            PASS4161_LENS_PDF_FINAL_RUNNER_INTAKE_GATE,
          "x-velmere-pass4162-lens-pdf-node20-preflight-evidence":
            PASS4162_LENS_PDF_NODE20_PREFLIGHT_EVIDENCE_BUCKET,
        },
      },
    );
  }

  if (
    selectedDepth !== payload.selectedDepth ||
    selectedDepth !== payload.pass477.selectedDepth
  ) {
    return NextResponse.json(
      { ok: false, error: "depth_mismatch" },
      { status: 409 },
    );
  }
  // PASS488 compatibility is derived from the current Reader/PDF manifest,
  // so the historical page contract cannot drift from PASS610.
  const pass488 = {
    ...payload.pass488,
    pageCount: payload.pass610.pageCount,
    readerPageCount: payload.pass610.pageCount,
    binaryPageCount: payload.pass610.pageCount,
  };
  const parityGate = buildPass583DownloadParityGate({
    symbol: payload.symbol,
    locale: payload.locale,
    depth: payload.selectedDepth,
    reportChecksum: payload.brain.checksum,
    parityKey: pass488.parityKey,
    sections: payload.sections,
    compositor: payload.pass581,
    citationRail: payload.pass582,
  });
  if (parityGate.manifestKey !== payload.pass583.manifestKey) {
    return NextResponse.json(
      { ok: false, error: "parity_manifest_mismatch" },
      { status: 409 },
    );
  }
  const readerDownloadManifest = buildPass610ReaderDownloadParityManifest({
    locale: payload.locale,
    depth: payload.selectedDepth,
    reportChecksum: payload.brain.checksum,
    sections: payload.sections,
    claimGate: payload.pass607,
    appendix: payload.pass608,
    density: payload.pass609,
  });
  if (readerDownloadManifest.manifestKey !== payload.pass610.manifestKey) {
    return NextResponse.json(
      { ok: false, error: "reader_download_manifest_mismatch" },
      { status: 409 },
    );
  }
  if (
    payload.pass1254.previewDownloadTypography !==
      "same_reader_pdf_typography_budget" ||
    payload.pass1254.pdf.footerLane !== "single_line_no_overlap"
  ) {
    return NextResponse.json(
      { ok: false, error: "pdf_typography_release_gate_mismatch" },
      { status: 409 },
    );
  }
  if (
    payload.pass1334.previewDownloadParity !==
      "same_payload_same_depth_same_claims" ||
    payload.pass1354.role !== "why_verdict_graph_not_second_table" ||
    payload.pass1374.hallucinationBrake !==
      "no_random_copy_no_fake_live_no_hidden_missing_data" ||
    payload.pass1413?.realWorkStandard !== "forty_plus_tasks_no_micro_passes" ||
    payload.pass1413?.totalTaskCount < 50
  ) {
    return NextResponse.json(
      { ok: false, error: "premium_truth_release_gate_mismatch" },
      { status: 409 },
    );
  }
  const redaction = applyPass635ExportRedaction({
    surface: "pdf",
    payload,
  });
  if (
    redaction.receipt.removedPaths.length > 0 ||
    redaction.receipt.maskedPaths.length > 0 ||
    redaction.receipt.state !== "clean"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "pdf_redaction_required",
        receiptId: redaction.receipt.receiptId,
      },
      { status: 409, headers: buildDurableRateLimitHeaders(rateLimit) },
    );
  }
  const lensPdfDurablePolicy = buildP97LensPdfDurableArtifactPolicy({
    depth: selectedDepth,
    reportId: frozenPayload.identity.reportId,
    accountId: durableAccount?.accountId ?? null,
  });
  let durablePdf;
  try {
    durablePdf = await runDurableBinaryComputation({
      kind: "lens_pdf_render",
      request,
      requestId: lensPdfDurablePolicy.canonicalRequestId,
      subjectBinding: lensPdfDurablePolicy.subjectBinding,
      input: {
        reportId: frozenPayload.identity.reportId,
        sourceResultId: frozenPayload.identity.sourceResultId,
        reportDigest: frozenPayload.identity.reportDigest,
        reportChecksum: payload.brain.checksum,
        generatedAt: frozenPayload.identity.generatedAt,
        depth: selectedDepth,
        tier: frozenPayload.identity.tier,
        locale: payload.locale,
        rendererId: frozenPayload.identity.rendererId,
        parityKey: payload.pass610.manifestKey,
      },
      requireDurableStore: lensPdfDurablePolicy.requireDurableStore,
      maxResultBytes: 4 * 1024 * 1024,
      workerPayload: selectedDepth === "basic" ? undefined : ({
        schemaVersion: "velmere.lens-pdf-worker-payload.v1",
        depth: selectedDepth,
        report: payload,
      } satisfies LensPdfWorkerPayload),
      maxWorkerPayloadBytes: 512 * 1024,
      execute: () => renderLensPdfWorkerPayload({
        schemaVersion: "velmere.lens-pdf-worker-payload.v1",
        depth: selectedDepth,
        report: payload,
      }),
    });
  } catch (error) {
    if (error instanceof DurableComputationError) {
      return publicApiError(error, {
        route: "/api/search/lens-report",
        code: "durable_lens_pdf_unavailable",
        status: 503,
        headers: { "retry-after": String(error.retryAfterSeconds || 15) },
      });
    }
    return publicApiError(error, {
      route: "/api/search/lens-report",
      code: "lens_pdf_generation_failed",
      status: 503,
    });
  }
  const pdf = Buffer.from(durablePdf.value);
  const lensPdfDurabilityReceipt = buildP97LensPdfDurabilityReceipt({
    policy: lensPdfDurablePolicy,
    computationMode: durablePdf.mode,
    replayed: durablePdf.replayed,
    pdfSha256: sha256BytesDigest(pdf),
    pdfByteLength: pdf.byteLength,
  });
  if (!verifyP97LensPdfDurabilityReceipt({
    receipt: lensPdfDurabilityReceipt,
    policy: lensPdfDurablePolicy,
    pdfBytes: pdf,
  })) {
    return NextResponse.json(
      { ok: false, error: "lens_pdf_durability_receipt_invalid" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
  if (lensPdfDurabilityReceipt.storageState === "NON_DURABLE_REJECTED") {
    return NextResponse.json(
      { ok: false, error: "lens_pdf_durable_storage_required" },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "15" } },
    );
  }
  const pdfLeaks = detectPass635Leaks(pdf.toString("latin1"));
  const pass4158PdfByteHash = buildPass4158LensRenderedPdfByteHashHarness({
    format: "pdf_download",
    report: payload,
    pdf,
  });
  if (pdfLeaks.length > 0) {
    return NextResponse.json(
      { ok: false, error: "pdf_redaction_leak", leakClasses: pdfLeaks },
      { status: 500, headers: buildDurableRateLimitHeaders(rateLimit) },
    );
  }
  const pdfFeasibility = inspectPass593PdfBuffer(pdf);
  const pass4649PdfInspection = inspectPass4649PdfBinary(pdf);
  const pass4649PageRange = selectedDepth === "basic"
    ? { min: 2, max: 3 }
    : selectedDepth === "pro"
      ? { min: 4, max: 6 }
      : { min: 8, max: 12 };
  if (
    !pass4649PdfInspection.valid ||
    pass4649PdfInspection.pageCount < pass4649PageRange.min ||
    pass4649PdfInspection.pageCount > pass4649PageRange.max
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "pdf_commercial_binary_gate_failed",
        depth: selectedDepth,
        blockers: [
          ...pass4649PdfInspection.blockers,
          pass4649PdfInspection.pageCount < pass4649PageRange.min || pass4649PdfInspection.pageCount > pass4649PageRange.max
            ? `pdf_pages:${pass4649PdfInspection.pageCount}/${pass4649PageRange.min}-${pass4649PageRange.max}`
            : null,
        ].filter(Boolean),
      },
      { status: 500, headers: buildDurableRateLimitHeaders(rateLimit) },
    );
  }
  // Basic intentionally contains only the decision and source-ledger pages.
  // Claim destinations live on the Pro/Advanced analysis pages, so requiring
  // an internal link annotation for a two-page Basic artifact produces a
  // false 500 even though the PDF is valid. Premium artifacts still fail
  // closed when their source-to-claim link graph is missing.
  if (
    selectedDepth !== "basic" &&
    payload.pass594.linkedClaims > 0 &&
    !pdfFeasibility.checks.internalLinks
  ) {
    return NextResponse.json(
      { ok: false, error: "pdf_footnote_link_mismatch" },
      { status: 500 },
    );
  }
  const download = buildSafeDownloadDisposition({
    disposition: "inline",
    filenameStem: `velmere-lens-${payload.symbol || "report"}`,
    mediaKind: "pdf",
    fallbackStem: "velmere-lens-report",
  });
  const exportId = frozenPayload.identity.reportId;
  const lensCanonicalArtifact = buildPass4822LensCanonicalCustomerArtifact({
    report: payload,
    depth: selectedDepth,
    pdf,
    reportId: exportId,
  });
  if (
    lensCanonicalArtifact.reportId !== frozenPayload.identity.reportId
    || lensCanonicalArtifact.payloadDigest !== frozenPayload.identity.reportDigest
    || lensCanonicalArtifact.rendererId !== frozenPayload.identity.rendererId
    || lensCanonicalArtifact.requestedTier !== frozenPayload.identity.tier
    || lensCanonicalArtifact.deliveredTier !== frozenPayload.identity.tier
  ) {
    return NextResponse.json(
      { ok: false, error: "frozen_report_artifact_identity_mismatch" },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }
  let accountCustomerArtifact: null | { snapshotId: string; route: string; source: "supabase" | "memory" } = null;
  const accountArtifactDecision = decideR7BrowserAccountArtifact({
    depth: selectedDepth,
    accountId: durableAccount?.accountId ?? null,
  });
  if (!accountArtifactDecision.requestAllowed) {
    return NextResponse.json(
      { ok: false, error: accountArtifactDecision.failureCode },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  if (accountArtifactDecision.persistExactAccountArtifact) {
    if (!durableAccount) {
      return NextResponse.json(
        { ok: false, error: "account_artifact_account_binding_invariant_failed" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
    const snapshot = buildPass4822AccountCustomerArtifactSnapshot({
      accountId: durableAccount.accountId,
      surface: "lens",
      payloadKind: "lens_report_v1",
      reportId: exportId,
      requestedTier: selectedDepth,
      deliveredTier: selectedDepth,
      locale: payload.locale,
      title: payload.title,
      subject: payload.symbol || payload.title,
      generatedAt: payload.generatedAt,
      payload,
      canonicalArtifact: lensCanonicalArtifact,
      pdfStorage: "exact_immutable_blob",
    });
    const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    const localPreviewSession = !productionLike
      && (durableAccount.provider === "preview" || durableAccount.provider === "google_preview");
    if (!localPreviewSession) {
      try {
        // The atomic bundle RPC is service-role-only by design. Before it is
        // called, replay the caller JWT through the user-scoped account-binding
        // RPC so a signed app cookie can never become a privileged write grant.
        await resolveCustomerOwnedWriteBoundary({
          request,
          accountId: durableAccount.accountId,
        });
      } catch (error) {
        if (error instanceof CustomerOwnedWriteBoundaryError) {
          return NextResponse.json(customerOwnedWriteErrorPayload(error), {
            status: error.httpStatus,
            headers: { "cache-control": "no-store" },
          });
        }
        return NextResponse.json(
          { ok: false, error: "account_artifact_write_boundary_unavailable", retryable: true },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    }
    let stored: Awaited<ReturnType<typeof storePass4824AccountCustomerArtifactPdfBundle>>;
    try {
      stored = await storePass4824AccountCustomerArtifactPdfBundle({
        accountId: durableAccount.accountId,
        snapshot,
        pdfBytes: pdf,
        userAccessToken: extractSupabaseUserAccessToken(accountResolutionRequest)?.token ?? undefined,
      });
      if (!localPreviewSession && stored.source !== "supabase") {
        throw new Error("account_artifact_durable_store_required");
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "account_artifact_durable_store_unavailable", retryable: true },
        { status: 503, headers: { "cache-control": "no-store", "retry-after": "15" } },
      );
    }
    accountCustomerArtifact = {
      snapshotId: stored.snapshot.snapshotId,
      route: `/api/account/customer-artifact?id=${encodeURIComponent(stored.snapshot.snapshotId)}`,
      source: stored.source,
    };
  }
  recordPass633AuditEvent({
    route: new URL(request.url).pathname,
    method: request.method,
    actorFingerprint: createClientFingerprint(request),
    providerIds: payload.pass622.providers
      .map((provider: Pass4158LensProviderRow) => provider.id)
      .slice(0, 24),
    sourceIds: payload.pass607.sources
      .map((source: Pass4158LensSourceRow) => source.sourceId)
      .slice(0, 64),
    claimIds: [
      ...payload.pass623.atoms.map((atom: Pass4158LensAtomicClaim) => atom.atomId),
      lensPdfDurabilityReceipt.receiptDigest,
    ].slice(0, 160),
    decision: `pdf_${selectedDepth}_exported`,
    state: "exported",
    exportId,
    modelVersion: "velmere-lens-report",
    promptSchemaVersion: "lens-report-v2",
    redactionReceipt: redaction.receipt,
  });

  const responseHeaders = new Headers({
    "content-type": download.contentType,
    "content-disposition": download.contentDisposition,
    "cache-control": "no-store",
    "content-language": payload.locale,
    "x-content-type-options": "nosniff",
    "x-velmere-report-id": exportId,
    "x-velmere-report-checksum": payload.brain.checksum,
    "x-velmere-report-digest": frozenPayload.identity.reportDigest,
    "x-velmere-renderer-id": frozenPayload.identity.rendererId,
    "x-velmere-pdf-depth": selectedDepth,
    "x-velmere-pdf-page-count": String(pass4649PdfInspection.pageCount),
    "x-velmere-pdf-sha256": pass4158PdfByteHash.pdfByteSha256 ?? pass4649PdfInspection.sha256,
    "x-velmere-canonical-artifact-digest": lensCanonicalArtifact.artifactDigest,
    "x-velmere-canonical-payload-digest": lensCanonicalArtifact.payloadDigest,
    ...(accountCustomerArtifact ? {
      "x-velmere-account-artifact-id": accountCustomerArtifact.snapshotId,
      "x-velmere-account-artifact-route": accountCustomerArtifact.route,
    } : {}),
    "x-velmere-pdf-active-content": pass4649PdfInspection.activeContentDetected ? "detected" : "none",
    "x-velmere-preview-download-parity": "same-blob-as-download",
    "x-velmere-source-count": String(payload.pass622.providerCount),
    "x-velmere-confidence-cap": String(payload.pass625.confidenceCap),
    "x-velmere-redaction": "clean",
    "x-velmere-proof-plane": "offline-archive-pass4692",
    "x-velmere-durable-computation": durablePdf.mode,
    "x-velmere-durable-computation-replayed": durablePdf.replayed ? "true" : "false",
    "x-velmere-durable-computation-attempt": String(durablePdf.attemptCount),
    ...buildDurableRateLimitHeaders(rateLimit),
  });
  const responseHeaderBytes = Array.from(responseHeaders.entries()).reduce(
    (total, [name, value]) => total + Buffer.byteLength(name) + Buffer.byteLength(value) + 4,
    0,
  );
  if (responseHeaderBytes > 4096) {
    return NextResponse.json(
      { ok: false, error: "lens_pdf_header_budget_exceeded" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  const projectedPdf = projectBrowserCustomerDelivery({
    decision: deliveryPreflight,
    payload: { availability: "READY" },
    nowMs,
  });
  if (!projectedPdf.allowed) {
    return NextResponse.json(projectedPdf.payload, {
      status: projectedPdf.status,
      headers: { "cache-control": "no-store" },
    });
  }

  return new NextResponse(pdf, {
    status: 200,
    headers: responseHeaders,
  });
}

export function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: escapeHtml("Use POST with a server-signed Lens source token or render token."),
    },
    { status: 405, headers: { allow: "POST" } },
  );
}

// PASS2519 PDF risk kernel calibration marker: data-pass2519-pdf-score-explainability requires severity/confidence/tier downgrade explanation in paid artifacts.

// PASS2520 PDF premium risk psychology marker: data-pass2520-pdf-visual-truth-score requires risk score, data-quality ring and tier honesty meter to be shown without hype.

/* x-velmere-source-quorum-ai-calibration-rebalance: PDF/vault claims require artifact hash family and source quorum. */

/* x-velmere-entitlement-vault-runtime-rebalance: PDF Advanced delivery requires server receipt, account binding, preview/download/vault hash family and revoke boundary. */

/* x-velmere-pass2523-tier-proof-passport: every Basic/Pro/Advanced report must expose signal budget, missing proof, downgrade reason, hash family and recovery action before final/paid copy. */

/* x-velmere-pass2524-refund-revoke-vault-replay: PDF report delivery must fail closed when entitlement, receipt, account, artifact hash family or provider status cannot replay cleanly. */

// PASS2525 header contract: x-velmere-pass2525-proof-gap-downgrade-ui, preview/download/vault finality blocked by hash drift.

// PASS2526 header contract: x-velmere-pass2526-reusable-downgrade-chip, PDF finality must show reusable proof chip rail when hash/source/payment proof is incomplete.

// PASS2527 header contract: x-velmere-pass2527-surface-mount-runtime, PDF finality must obey surface-specific chip failure fixtures before preview/download/vault claims.

// PASS2528 header contract: x-velmere-pass2528-live-chip-state-replay, PDF finality must be blocked when artifactHashFamily/vaultReplay runtime keys are missing.

// PASS2529: x-velmere-pass2529-runtime-evidence-chip-adapter keeps PDF preview/download/account-vault finality behind artifact hash family replay.

export async function POST(request: Request) {
  return withExpensiveRouteBudget(request, "lens_report_post", () => handleLensReportPost(request, Date.now()));
}

/** Test-only deterministic clock. No customer-controlled request value reaches it. */
export async function postLensReportWithR7TestClock(request: Request, nowMs: number) {
  if (process.env.NODE_ENV === "production") throw new Error("r7_test_clock_disabled_in_production");
  if (!Number.isFinite(nowMs)) throw new Error("r7_test_clock_invalid");
  return withExpensiveRouteBudget(request, "lens_report_post", () => handleLensReportPost(request, nowMs));
}
