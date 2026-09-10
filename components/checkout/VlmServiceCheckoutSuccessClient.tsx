"use client";


import { publicBrowserFailureCode } from "@/lib/security/browser-error-redaction";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildVlmPaidReturnPath,
  getVlmPaidProduct,
  normalizePaidContext,
  normalizeVlmPaidProductId,
  type VlmPaidAccessContext,
} from "@/lib/commerce/vlm-paid-access";
import {
  clearVlmPaidCheckoutIntent,
  readVlmPaidCheckoutIntent,
  writeVlmPaidAccessBundle,
} from "@/lib/commerce/vlm-paid-access-client";
import CustomerSafeAuditTimeline from "@/components/security/CustomerSafeAuditTimeline";
import { rememberAuditCaseRef } from "@/lib/security/audit-case-client-registry";
import { buildPass2368CustomerSafeAuditTimeline, type Pass2368AuditTimelineStage } from "@/lib/security/customer-safe-audit-timeline";

type State = "idle" | "verifying" | "ready" | "error";

type VerifyResponse = {
  ok?: boolean;
  expiresAt?: string;
  context?: Partial<VlmPaidAccessContext>;
  error?: string;
  demoMode?: string;
  warning?: string;
  entitlement?: { id?: string; auditQueueId?: string | null; ledgerMode?: string; source?: string; status?: string };
  auditCase?: { caseRef?: string; status?: string; entitlementVerified?: boolean; analysisStarted?: boolean };
  pass2362?: { paymentState?: string; queueState?: string; productionBoundary?: string };
  pass2364?: { paymentRail?: string; stripeLineCurrency?: string | null; stripeLineAmount?: string | number | null; replayState?: string };
};

const PASS2268_MAX_MANUAL_VERIFY_RETRIES = 3;

function normalizeAuditCaseRefForClient(value: unknown) {
  const clean = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return /^AUD-[A-Z0-9]{8,16}$/.test(clean) ? clean : "";
}

function pass2268FriendlyVerifyError(locale: string, error: unknown) {
  const clean = publicBrowserFailureCode(
    error,
    ["missing_vlm_receipt", "payment_required", "checkout_unavailable", "verify_failed"],
    "verify_failed",
  );
  if (clean === "missing_vlm_receipt") return clean;
  if (locale === "pl") {
    if (clean === "payment_required") return "Receipt nie potwierdził jeszcze płatnego dostępu.";
    return "Nie udało się potwierdzić receipt. Spróbuj ponownie.";
  }
  if (locale === "de") {
    if (clean === "payment_required") return "Receipt hat den bezahlten Access noch nicht bestätigt.";
    return "Receipt konnte nicht bestätigt werden. Bitte erneut versuchen.";
  }
  if (clean === "payment_required") return "The receipt has not confirmed paid access yet.";
  return "Could not verify the receipt. Try again.";
}

function pass2266AccessSavedMessage(locale: string, payload: VerifyResponse) {
  const isDemo = payload.demoMode === "local_paid_access_demo";
  const auditQueued = payload.auditCase?.status === "queued_paid_review" && payload.auditCase?.entitlementVerified === true;
  const date = payload.expiresAt ? payload.expiresAt.slice(0, 10) : "";
  if (locale === "pl") {
    if (isDemo) return auditQueued
      ? "Lokalny receipt demo zweryfikowany; sprawa testowo trafiła do kolejki. To nie jest live płatność."
      : "Lokalny entitlement demo potwierdzony. To nie jest live płatność.";
    if (auditQueued) return "Płatność potwierdzona. Sprawa trafiła do kolejki audytowej; analiza nie została uruchomiona automatycznie.";
    return date ? `Dostęp serwerowy potwierdzony do ${date}.` : "Dostęp serwerowy potwierdzony dla tej sesji konta.";
  }
  if (locale === "de") {
    if (isDemo) return auditQueued
      ? "Lokaler Demo-Receipt verifiziert; der Fall wurde nur testweise eingereiht. Keine Live-Zahlung."
      : "Lokales Demo-Entitlement bestätigt. Das ist keine Live-Zahlung.";
    if (auditQueued) return "Zahlung bestätigt. Der Fall wurde in die Audit-Warteschlange gestellt; die Analyse wurde nicht automatisch gestartet.";
    return date ? `Server-Access bis ${date} bestätigt.` : "Server-Access für diese Kontositzung bestätigt.";
  }
  if (isDemo) return auditQueued
    ? "Local demo receipt verified; the case was queued for testing only. This is not a live payment."
    : "Local demo entitlement confirmed. This is not a live payment.";
  if (auditQueued) return "Payment verified. The case entered the audit queue; analysis was not started automatically.";
  return date ? `Server access confirmed until ${date}.` : "Server access confirmed for this account session.";
}

export default function VlmServiceCheckoutSuccessClient({
  locale,
  sessionId,
  productId,
  returnPath,
  auditCaseRef,
}: {
  locale: string;
  sessionId?: string;
  productId?: string;
  returnPath?: string;
  auditCaseRef?: string;
}) {
  const normalizedProductId = normalizeVlmPaidProductId(productId);
  const product = useMemo(
    () =>
      normalizedProductId
        ? getVlmPaidProduct(normalizedProductId, locale)
        : null,
    [locale, normalizedProductId],
  );
  const hasVerifiableReceipt = Boolean(normalizedProductId && sessionId);
  const [state, setState] = useState<State>(
    hasVerifiableReceipt ? "verifying" : normalizedProductId ? "error" : "idle",
  );
  const [message, setMessage] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [pass2362QueueId, setPass2362QueueId] = useState("");
  const [pass2362LedgerMode, setPass2362LedgerMode] = useState("");
  const [pass2364Rail, setPass2364Rail] = useState("");
  const [pass2364ReplayState, setPass2364ReplayState] = useState("");
  const [auditCaseStatus, setAuditCaseStatus] = useState("");
  const [savedContext, setSavedContext] = useState<VlmPaidAccessContext | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [resumeHref, setResumeHref] = useState(
    buildVlmPaidReturnPath({ returnPath }, `/${locale}`),
  );

  useEffect(() => {
    const reference = normalizeAuditCaseRefForClient(auditCaseRef);
    if (reference) rememberAuditCaseRef(reference, { tier: normalizedProductId === "vlm_advanced_audit_human_review" ? "advanced" : normalizedProductId === "vlm_pro_audit_review" ? "pro" : undefined });
  }, [auditCaseRef, normalizedProductId]);
  const canResumeWithAccess = state === "ready";
  const retryAttempt = retryCount + 1;
  const canRetryVerify =
    hasVerifiableReceipt &&
    state === "error" &&
    retryCount < PASS2268_MAX_MANUAL_VERIFY_RETRIES;
  const pass2368TimelineStage: Pass2368AuditTimelineStage = state === "ready"
    ? pass2362QueueId
      ? "analysis_queue"
      : "access_verified"
    : state === "error"
      ? "blocked"
      : state === "verifying"
        ? "verifying_access"
        : "intake";
  const pass2368Timeline = useMemo(() => buildPass2368CustomerSafeAuditTimeline({
    locale,
    stage: pass2368TimelineStage,
    queueId: pass2362QueueId,
    paymentRail: pass2364Rail,
  }), [locale, pass2362QueueId, pass2364Rail, pass2368TimelineStage]);

  const verifyReceipt = useCallback(
    async (signal?: AbortSignal) => {
      if (!normalizedProductId || !sessionId) {
        setMessage("missing_vlm_receipt");
        setState("error");
        return;
      }
      setState("verifying");
      const params = new URLSearchParams(window.location.search);
      const pendingIntent = readVlmPaidCheckoutIntent();
      const pendingContext =
        pendingIntent?.productId === normalizedProductId ? pendingIntent.context : null;
      const productCellId = params.get("product_cell")?.trim() || "";
      if (
        !pendingIntent
        || pendingIntent.productId !== normalizedProductId
        || pendingIntent.sessionId !== sessionId
        || !pendingIntent.checkoutVerificationBindingToken
        || !productCellId
      ) {
        throw new Error("checkout_verification_binding_missing");
      }
      const surfaceParam = params.get("surface") || pendingContext?.surface;
      const surface =
        surfaceParam === "real-markets" ||
        surfaceParam === "browser" ||
        surfaceParam === "audit" ||
        surfaceParam === "shield"
          ? surfaceParam
          : product?.accessScope === "audit_advanced_analysis" ||
              product?.accessScope === "audit_advanced_human_review" ||
              product?.accessScope === "audit_pro_review"
            ? "audit"
            : product?.accessScope === "vlm_advanced_pdf"
              ? "browser"
              : "shield";
      const context = normalizePaidContext(
        {
          surface,
          locale:
            locale === "pl" || locale === "de" || locale === "en" ? locale : "en",
          assetId: params.get("assetId") || pendingContext?.assetId || undefined,
          symbol: params.get("symbol") || pendingContext?.symbol || undefined,
          depth:
            params.get("depth") === "advanced" || pendingContext?.depth === "advanced"
              ? "advanced"
              : params.get("depth") === "pro" || pendingContext?.depth === "pro"
                ? "pro"
                : product?.accessScope === "vlm_advanced_pdf" ||
                    product?.accessScope === "vlm_advanced_analysis" ||
                    (product?.accessScope === "audit_advanced_analysis" || product?.accessScope === "audit_advanced_human_review")
                  ? "advanced"
                  : product?.accessScope === "audit_pro_review" ||
                      product?.accessScope === "vlm_pro_analysis" ||
                      product?.accessScope === "vlm_pro_pdf"
                    ? "pro"
                    : undefined,
          requestId: params.get("requestId") || pendingContext?.requestId || undefined,
          auditCaseRef: params.get("auditCaseRef") || auditCaseRef || pendingContext?.auditCaseRef || undefined,
          returnPath: buildVlmPaidReturnPath(
            { returnPath: returnPath || pendingContext?.returnPath },
            `/${locale}`,
          ),
        },
        locale,
      );
      const response = await fetch("/api/checkout/vlm-service/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          productId: normalizedProductId,
          productCellId,
          checkoutVerificationBindingToken:
            pendingIntent.checkoutVerificationBindingToken,
          locale,
          context,
        }),
        signal,
      });
      const payload = await readJsonResponseBounded<VerifyResponse>(response, 2 * 1024 * 1024).catch(() => null);
      if (
        !response.ok
        || !payload?.ok
        || !payload.entitlement?.id
        || (payload.entitlement.status !== "active" && payload.entitlement.status !== "paid")
        || (payload.entitlement.ledgerMode !== "durable" && payload.entitlement.ledgerMode !== "memory")
      ) {
        throw new Error(payload?.error || "verify_failed");
      }
      const storageContext = normalizePaidContext(
        payload.context || context,
        locale,
      );
      writeVlmPaidAccessBundle({
        productId: normalizedProductId,
        context: storageContext,
        token: "",
        expiresAt: payload.expiresAt,
        sessionId,
        demoMode: payload.demoMode,
      });
      setSavedContext(storageContext);
      setResumeHref(buildVlmPaidReturnPath(storageContext, `/${locale}`));
      clearVlmPaidCheckoutIntent();
      setDemoMode(payload.demoMode === "local_paid_access_demo");
      setPass2362QueueId(payload.entitlement?.auditQueueId || "");
      setPass2362LedgerMode(payload.entitlement?.ledgerMode || "");
      setPass2364Rail(payload.pass2364?.paymentRail || "");
      setPass2364ReplayState(payload.pass2364?.replayState || "");
      setAuditCaseStatus(payload.auditCase?.status || "");
      const confirmedCaseRef = normalizeAuditCaseRefForClient(payload.auditCase?.caseRef || storageContext.auditCaseRef || auditCaseRef);
      if (confirmedCaseRef) rememberAuditCaseRef(confirmedCaseRef, { tier: normalizedProductId === "vlm_advanced_audit_human_review" ? "advanced" : normalizedProductId === "vlm_pro_audit_review" ? "pro" : undefined, lastSeenAt: new Date().toISOString() });
      setMessage(pass2266AccessSavedMessage(locale, payload));
      setState("ready");
    },
    [
      locale,
      normalizedProductId,
      product?.accessScope,
      returnPath,
      auditCaseRef,
      sessionId,
    ],
  );

  useEffect(() => {
    if (!normalizedProductId) return undefined;
    if (!sessionId) {
      const timer = window.setTimeout(() => {
        setMessage("missing_vlm_receipt");
        setState("error");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      verifyReceipt(controller.signal).catch((error) => {
        if (controller.signal.aborted) return;
        window.setTimeout(() => {
          if (controller.signal.aborted) return;
          setMessage(pass2268FriendlyVerifyError(locale, error));
          setState("error");
        }, 0);
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, normalizedProductId, sessionId, verifyReceipt, retryCount]);

  if (!product) return null;

  const isAuditReceipt = normalizedProductId === "vlm_pro_audit_review" || normalizedProductId === "vlm_advanced_audit_human_review";
  const labels =
    locale === "pl"
      ? {
          title: "Dostęp VLM",
          verifying:
            "Weryfikujemy istniejące zaproszenie lub legacy entitlement. Nowy publiczny checkout jest wyłączony.",
          ready: isAuditReceipt
            ? "Dostęp kontrolowanej bety został zweryfikowany. Sprawa jest w kolejce automatycznej analizy; human review nie jest zawarty."
            : "Dostęp testowy zapisany. Wróć do poprzedniego ekranu; publiczna sprzedaż pozostaje wyłączona.",
          error:
            "Brakuje ważnego zaproszenia lub istniejącego entitlementu. Publiczny checkout jest wyłączony.",
          back: "Wróć i kontynuuj",
          backWithoutUnlock: "Wróć do Basic",
          retry: "Sprawdź receipt ponownie",
          demo: "Tryb lokalny demo — bez publicznej sprzedaży",
          missingReceipt: "Brakuje legacy receipt/session ID. Wróć do Basic; nie uruchamiaj nowego publicznego checkoutu.",
          retryLimit: "Limit ponownych prób osiągnięty. Wróć do Basic albo skontaktuj się w sprawie zaproszenia do bety Pro.",
          attempts: "Próba",
          context: "Kontekst",
          surface: "Ekran",
          asset: "Asset",
          paymentChain: "Receipt → Ledger → Analysis queue",
          paymentRail: "Tor płatności",
        }
      : locale === "de"
        ? {
            title: "VLM Access",
            verifying:
              "Bestehende Einladung oder Legacy-Entitlement wird geprüft. Der öffentliche Checkout ist deaktiviert.",
            ready: isAuditReceipt
              ? "Der kontrollierte Beta-Zugang wurde verifiziert. Der Fall ist in der automatisierten Analyse-Queue; Human Review ist nicht enthalten."
              : "Testzugang gespeichert. Kehre zurück; der öffentliche Verkauf bleibt deaktiviert.",
            error:
              "Eine gültige Einladung oder ein bestehendes Entitlement fehlt. Der öffentliche Checkout ist deaktiviert.",
            back: "Zurück und fortfahren",
            backWithoutUnlock: "Zu Basic zurück",
            retry: "Receipt erneut prüfen",
            demo: "Lokaler Demo-Modus — kein öffentlicher Verkauf",
            missingReceipt: "Legacy Receipt/Session-ID fehlt. Kehre zu Basic zurück; starte keinen neuen öffentlichen Checkout.",
            retryLimit: "Retry-Limit erreicht. Kehre zu Basic zurück oder frage nach einer Pro-Beta-Einladung.",
            attempts: "Versuch",
            context: "Kontext",
            surface: "Surface",
            asset: "Asset",
            paymentChain: "Receipt → Ledger → Analysis Queue",
            paymentRail: "Zahlungsweg",
          }
        : {
            title: "VLM access",
            verifying: "Verifying an existing invitation or legacy entitlement. New public checkout is disabled.",
            ready: isAuditReceipt
              ? "Controlled beta access verified. The case is in the automated analysis queue; human review is not included."
              : "Evaluation access saved. Return to the previous screen; public sale remains disabled.",
            error:
              "A valid invitation or existing entitlement is missing. Public checkout is disabled.",
            back: "Return and continue",
            backWithoutUnlock: "Return to Basic",
            retry: "Check receipt again",
            demo: "Local demo mode — no public sale",
            missingReceipt: "Legacy receipt/session ID is missing. Return to Basic; do not start a new public checkout.",
            retryLimit: "Retry limit reached. Return to Basic or request Pro beta access.",
            attempts: "Attempt",
            context: "Context",
            surface: "Surface",
            asset: "Asset",
            paymentChain: "Receipt → Ledger → Analysis Queue",
            paymentRail: "Payment Rail",
          };

  return (
    <div
      className="mt-5 rounded-2xl border border-cyan-200/[0.14] bg-cyan-300/[0.04] p-4 text-left"
      data-pass2024-vlm-service-access="checkout-success-token-store"
      data-pass2258-vlm-service-access="server-demo-or-stripe-token-store"
      data-pass2259-vlm-service-access="bundle-store-pending-intent-cleared"
      data-pass2260-vlm-service-access="context-visible-same-surface-resume"
      data-pass2262-vlm-service-access="pending-intent-context-fallback"
      data-pass2263-vlm-service-access="sanitized-resume-link-stale-intent-clear"
      data-pass2265-vlm-service-access={canResumeWithAccess ? "verified-token-resume-enabled" : state === "error" ? "error-return-without-unlock" : "verifying-return-locked"}
      data-pass2266-vlm-service-access="localized-demo-message-and-client-owned-resume"
      data-pass2267-vlm-service-access={state === "error" ? "retry-or-safe-return-no-unlock" : "receipt-verification-stateful"}
      data-pass2268-vlm-service-access={state === "error" ? canRetryVerify ? "bounded-retry-available" : "bounded-retry-exhausted" : state === "ready" ? "verified-resume-ready" : "verifying-with-attempt-counter"}
      data-pass2362-vlm-service-payment={pass2362QueueId ? "receipt-ledger-analysis-queue" : state === "ready" ? "receipt-ledger-advanced-unlock" : "pending-receipt-ledger"}
      data-pass2364-vlm-service-payment={pass2364Rail || "pending-payment-rail"}
      data-pass4612-audit-receipt={isAuditReceipt ? auditCaseStatus || "pending-audit-case-transition" : "not-audit-product"}
      data-pass4614-audit-account-portal={isAuditReceipt ? "case-ref-bookmarked-for-account-portal" : "not-audit-product"}
      aria-live="polite"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.70]">
        {labels.title} · {product.shortLabel}
      </p>
      <p className="mt-2 text-xs leading-6 text-white/[0.58]">
        {state === "verifying"
          ? labels.verifying
          : state === "ready"
            ? labels.ready
            : message === "missing_vlm_receipt"
              ? labels.missingReceipt
              : labels.error}
      </p>
      {hasVerifiableReceipt && state !== "ready" ? (
        <p
          className="mt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.34]"
          data-pass2268-paid-access-attempts="bounded-retry-counter"
        >
          {labels.attempts} {retryAttempt}/{PASS2268_MAX_MANUAL_VERIFY_RETRIES + 1}
        </p>
      ) : null}
      {state === "error" && !canRetryVerify && hasVerifiableReceipt ? (
        <p className="mt-2 text-[11px] leading-5 text-amber-100/[0.70]">
          {labels.retryLimit}
        </p>
      ) : null}
      {demoMode ? (
        <p
          className="mt-3 inline-flex rounded-full border border-amber-200/[0.18] bg-amber-300/[0.055] px-3 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-amber-100/[0.76]"
          data-pass2258-demo-access="local-only-no-live-charge"
        >
          {labels.demo}
        </p>
      ) : null}
      {message && message !== "missing_vlm_receipt" ? (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.38]">
          {message}
        </p>
      ) : null}
      {state === "ready" && pass2362QueueId ? (
        <div
          className="mt-3 rounded-xl border border-emerald-200/[0.12] bg-emerald-300/[0.045] p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-100/[0.72]"
          data-pass2362-analysis-queue="visible-after-receipt-ledger"
        >
          <p>{labels.paymentChain}</p>
          <p className="mt-1 break-all text-white/[0.42]">{pass2362LedgerMode || "ledger"} · {pass2362QueueId}</p>
        </div>
      ) : null}
      {state === "ready" && pass2364Rail ? (
        <div
          className="mt-3 rounded-xl border border-cyan-200/[0.10] bg-cyan-300/[0.035] p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/[0.68]"
          data-pass2364-payment-rail-replay="visible-on-success"
        >
          <p>{labels.paymentRail}: {pass2364Rail}</p>
          {pass2364ReplayState ? (
            <p className="mt-1 break-all text-white/[0.38]">{pass2364ReplayState}</p>
          ) : null}
        </div>
      ) : null}
      {normalizedProductId === "vlm_advanced_audit_human_review" ? (
        <div className="mt-3" data-pass2368-checkout-audit-timeline="receipt-to-analysis-to-report-ready">
          <CustomerSafeAuditTimeline timeline={pass2368Timeline} compact={state === "ready"} />
        </div>
      ) : null}
      {savedContext ? (
        <dl
          className="mt-3 grid gap-2 rounded-xl border border-white/[0.07] bg-black/[0.18] p-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38] sm:grid-cols-2"
          data-pass2260-paid-access-context="visible-before-return"
        >
          <div>
            <dt>{labels.surface}</dt>
            <dd className="mt-1 text-cyan-100/[0.72]">{savedContext.surface}</dd>
          </div>
          <div>
            <dt>{labels.asset}</dt>
            <dd className="mt-1 truncate text-white/[0.68]">
              {savedContext.auditCaseRef || savedContext.symbol || savedContext.assetId || savedContext.requestId || "—"}
            </dd>
          </div>
        </dl>
      ) : null}
      {resumeHref ? (
        canResumeWithAccess ? (
          <a
            href={resumeHref}
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.055] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100"
            data-pass2259-paid-access-return="same-context-resume"
            data-pass2263-paid-access-return="sanitized-client-resume"
            data-pass2265-paid-access-return="verified-token-saved-before-resume"
            data-pass2266-paid-access-return="only-client-verified-resume-visible"
            data-pass2268-paid-access-return="verified-token-resume-visible"
          >
            {labels.back}
          </a>
        ) : state === "error" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {canRetryVerify ? (
              <button
                type="button"
                onClick={() => setRetryCount((count) => Math.min(count + 1, PASS2268_MAX_MANUAL_VERIFY_RETRIES))}
                className="inline-flex min-h-11 items-center rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.045] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100/[0.82]"
                data-pass2267-paid-access-return="retry-verify-without-new-checkout"
                data-pass2268-paid-access-return="bounded-retry-verify-without-new-checkout"
              >
                {labels.retry}
              </button>
            ) : null}
            <a
              href={resumeHref}
              className="inline-flex min-h-11 items-center rounded-full border border-rose-200/[0.16] bg-rose-500/[0.045] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-rose-100/[0.82]"
              data-pass2265-paid-access-return="error-safe-return-no-unlock"
              data-pass2267-paid-access-return="error-return-keeps-pending-intent"
            >
              {labels.backWithoutUnlock}
            </a>
          </div>
        ) : (
          <span
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.34]"
            data-pass2265-paid-access-return="locked-until-verify-finishes"
            data-pass2268-paid-access-return="locked-with-attempt-counter"
          >
            {labels.verifying}
          </span>
        )
      ) : null}
    </div>
  );
}
