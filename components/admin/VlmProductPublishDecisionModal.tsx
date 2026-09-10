"use client";


import { readBrowserJsonObject } from "@/lib/security/browser-json-response-boundary";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/products/catalog";
import type { ProductImportDraft } from "@/lib/products/types";
import type {
  ProductPublishBatchDecision,
  ProductPublishTargetStatus,
} from "@/lib/products/publish-decision";
import type { ProductPublishAuditLedger } from "@/lib/products/product-publish-audit-ledger";
import type { ProductPublishStateStorageResult } from "@/lib/products/product-publish-state-storage";

type PublishResponse = {
  reviewedDrafts?: ProductImportDraft[];
  decision?: ProductPublishBatchDecision;
  auditLedger?: ProductPublishAuditLedger;
  productStateStorage?: ProductPublishStateStorageResult;
  message?: string;
  error?: string;
};

type VlmProductPublishDecisionModalProps = {
  token: string;
  drafts: ProductImportDraft[];
  locale: string;
  targetStatus: ProductPublishTargetStatus;
  onClose: () => void;
  onCommitted: (drafts: ProductImportDraft[], message: string) => void;
};

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  close: string;
  refresh: string;
  confirm: string;
  committing: string;
  confirmLabel: string;
  typeLabel: string;
  selected: string;
  allowed: string;
  blocked: string;
  review: string;
  batch: string;
  snapshot: string;
  reasons: string;
  emptyReasons: string;
  finalStatus: string;
  activeBlock: string;
  comingSoon: string;
  active: string;
  checklist: string;
  auditLedger: string;
  auditReceipt: string;
  storageMode: string;
  statusStorage: string;
  checksum: string;
  blockedMessage: string;
  operatorNote: string;
};

function getCopy(
  locale: string,
  targetStatus: ProductPublishTargetStatus,
): Copy {
  if (locale === "pl") {
    return {
      eyebrow: "Final publish · durable audit · product status",
      title:
        targetStatus === "active"
          ? "Potwierdź aktywną publikację"
          : "Potwierdź Coming Soon",
      subtitle:
        "To jest ostatni ekran przed zmianą statusu. VLM Product Brain robi re-check, pokazuje snapshot produktu, blokery, różnice statusów i wymaga potwierdzenia operatora.",
      close: "Zamknij",
      refresh: "Odśwież decyzję",
      confirm: "Potwierdzam publikację",
      committing: "Publikuję...",
      confirmLabel: "Rozumiem blokery i potwierdzam batch trace.",
      typeLabel:
        "Dla aktywnej sprzedaży wpisz ACTIVE. Dla Coming Soon wpisz SOON.",
      selected: "Wybrane",
      allowed: "Allowed",
      blocked: "Blocked",
      review: "Review",
      batch: "Batch trace",
      snapshot: "Snapshot klienta / providera",
      reasons: "Powody / blokery",
      emptyReasons: "Brak blockerów po ostatnim re-checku.",
      finalStatus: "Finalny status",
      activeBlock:
        "Active zablokowane — produkt spadnie do coming soon albo wymaga poprawy.",
      comingSoon: "coming soon",
      active: "active",
      checklist: "Operator checklist",
      auditLedger: "Ledger audytu",
      auditReceipt: "Receipt audytu",
      storageMode: "Tryb zapisu",
      statusStorage: "Status produktu",
      checksum: "Checksum",
      blockedMessage:
        "Nie można zatwierdzić, dopóki decyzja batcha jest zablokowana.",
      operatorNote:
        "Ten ekran waliduje produkt, tworzy receipt, zapisuje redacted audit ledger i zapisuje publication state produktu, jeżeli Upstash jest skonfigurowany.",
    };
  }
  if (locale === "de") {
    return {
      eyebrow: "Final publish · durable audit · product status",
      title:
        targetStatus === "active"
          ? "Aktive Veröffentlichung bestätigen"
          : "Coming Soon bestätigen",
      subtitle:
        "Letzter Bildschirm vor Statusänderung. VLM Product Brain re-checkt, zeigt Produkt-Snapshot, Blocker, Status-Diffs und verlangt Operator-Bestätigung.",
      close: "Schließen",
      refresh: "Entscheidung aktualisieren",
      confirm: "Veröffentlichung bestätigen",
      committing: "Veröffentliche...",
      confirmLabel: "Ich verstehe die Blocker und bestätige den Batch Trace.",
      typeLabel: "Für active ACTIVE eingeben. Für Coming Soon SOON eingeben.",
      selected: "Ausgewählt",
      allowed: "Allowed",
      blocked: "Blocked",
      review: "Review",
      batch: "Batch trace",
      snapshot: "Customer / Provider snapshot",
      reasons: "Gründe / Blocker",
      emptyReasons: "Keine Blocker nach dem letzten Re-check.",
      finalStatus: "Finaler Status",
      activeBlock:
        "Active ist blockiert — Produkt fällt auf coming soon zurück oder braucht Korrektur.",
      comingSoon: "coming soon",
      active: "active",
      checklist: "Operator checklist",
      auditLedger: "Audit-Ledger",
      auditReceipt: "Audit-Beleg",
      storageMode: "Speichermodus",
      statusStorage: "Produktstatus",
      checksum: "Checksum",
      blockedMessage:
        "Bestätigung ist blockiert, solange die Batch-Entscheidung blockiert ist.",
      operatorNote:
        "Dieser Bildschirm validiert das Produkt, erstellt Receipts und schreibt Audit-Ledger plus Publication-State, wenn Upstash konfiguriert ist.",
    };
  }
  return {
    eyebrow: "Final publish · durable audit · product status",
    title:
      targetStatus === "active"
        ? "Confirm active publish"
        : "Confirm Coming Soon",
    subtitle:
      "This is the last screen before changing status. VLM Product Brain re-checks the draft, shows product snapshot, blockers, status diff and requires operator confirmation.",
    close: "Close",
    refresh: "Refresh decision",
    confirm: "Confirm publish",
    committing: "Publishing...",
    confirmLabel: "I understand the blockers and confirm the batch trace.",
    typeLabel: "Type ACTIVE for active sale. Type SOON for Coming Soon.",
    selected: "Selected",
    allowed: "Allowed",
    blocked: "Blocked",
    review: "Review",
    batch: "Batch trace",
    snapshot: "Customer / provider snapshot",
    reasons: "Reasons / blockers",
    emptyReasons: "No blockers after the latest re-check.",
    finalStatus: "Final status",
    activeBlock:
      "Active is blocked — product will fall back to coming soon or needs edits.",
    comingSoon: "coming soon",
    active: "active",
    checklist: "Operator checklist",
    auditLedger: "Audit ledger",
    auditReceipt: "Audit receipt",
    storageMode: "Storage mode",
    statusStorage: "Product status",
    checksum: "Checksum",
    blockedMessage: "You cannot confirm while the batch decision is blocked.",
    operatorNote:
      "This screen validates the product, creates receipts and writes the redacted audit ledger plus product publication state when Upstash is configured.",
  };
}

function statusClass(status: string) {
  if (
    status === "active" ||
    status === "ready" ||
    status === "pass" ||
    status === "allowed"
  )
    return "border-emerald-300/[0.24] bg-emerald-500/[0.06] text-emerald-100/[0.82]";
  if (status === "blocked" || status === "block" || status === "draft")
    return "border-red-300/[0.24] bg-red-500/[0.06] text-red-100/[0.78]";
  return "border-velmere-gold/[0.26] bg-velmere-gold/[0.06] text-velmere-gold";
}

function requiredPhrase(targetStatus: ProductPublishTargetStatus) {
  return targetStatus === "active" ? "ACTIVE" : "SOON";
}

function titleForDraft(draft: ProductImportDraft | undefined) {
  if (!draft) return "";
  return (
    draft.product.title.pl ||
    draft.product.title.en ||
    draft.product.title.de ||
    draft.product.slug
  );
}

async function readApiJson(response: Response) {
  return readBrowserJsonObject<PublishResponse>(response, {
    maxBytes: 512 * 1024,
    maxDepth: 48,
    maxNodes: 75_000,
  });
}

function uniqueDraftsByIdentity(drafts: ProductImportDraft[]) {
  const seen = new Set<string>();
  return drafts.filter((draft, index) => {
    const key = [
      draft.product.provider,
      draft.product.providerProductId,
      draft.product.slug,
      draft.draftId,
      index,
    ]
      .filter(Boolean)
      .join(":");
    const stable = draft.product.providerProductId
      ? `${draft.product.provider}:${draft.product.providerProductId}`
      : draft.product.slug || draft.draftId || key;
    if (seen.has(stable)) return false;
    seen.add(stable);
    return true;
  });
}

export default function VlmProductPublishDecisionModal({
  token,
  drafts,
  locale,
  targetStatus,
  onClose,
  onCommitted,
}: VlmProductPublishDecisionModalProps) {
  const copy = getCopy(locale, targetStatus);
  const [decision, setDecision] = useState<ProductPublishBatchDecision | null>(
    null,
  );
  const [reviewedDrafts, setReviewedDrafts] =
    useState<ProductImportDraft[]>(drafts);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [accepted, setAccepted] = useState(targetStatus === "coming_soon");
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [auditLedger, setAuditLedger] =
    useState<ProductPublishAuditLedger | null>(null);
  const [productStateStorage, setProductStateStorage] =
    useState<ProductPublishStateStorageResult | null>(null);
  const safeDrafts = useMemo(() => uniqueDraftsByIdentity(drafts), [drafts]);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const loadDecision = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setAccepted(targetStatus === "coming_soon");
    setPhrase("");
    try {
      const response = await fetch("/api/admin/products/publish", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          drafts: safeDrafts,
          status: targetStatus,
          dryRun: true,
        }),
      });
      const result = await readApiJson(response);
      if (!result.ok || !response.ok) {
        reportBrowserBoundaryFailure({
          event: "admin_publish_decision_response_rejected",
          error: new Error(result.ok ? "publish_decision_unavailable" : result.code),
        });
        throw new Error("publish_decision_unavailable");
      }
      const data = result.value;
      setDecision(data.decision ?? null);
      setAuditLedger(data.auditLedger ?? null);
      setProductStateStorage(null);
      setReviewedDrafts(data.reviewedDrafts ?? safeDrafts);
      setMessage(data.message ?? null);
    } catch (error) {
      reportBrowserBoundaryFailure({ event: "admin_publish_decision_request_failed", error });
      setMessage("Publish decision failed.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, safeDrafts, targetStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDecision();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDecision]);

  const operatorConfirmed = targetStatus === "coming_soon" || accepted;
  const canConfirm =
    Boolean(decision?.canCommit) &&
    operatorConfirmed &&
    phrase.trim().toUpperCase() === requiredPhrase(targetStatus) &&
    !committing &&
    !loading;

  const commit = async () => {
    if (!decision || !canConfirm) return;
    setCommitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/products/publish", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          drafts: reviewedDrafts,
          status: targetStatus,
          operatorConfirmation: {
            accepted: true,
            targetStatus,
            batchTraceId: decision.batchTraceId,
            confirmedAt: new Date().toISOString(),
            operatorId: "operator:admin-ui-preview",
          },
        }),
      });
      const result = await readApiJson(response);
      if (!result.ok || !response.ok) {
        reportBrowserBoundaryFailure({
          event: "admin_publish_commit_response_rejected",
          error: new Error(result.ok ? "publish_commit_unavailable" : result.code),
        });
        throw new Error("publish_commit_unavailable");
      }
      const data = result.value;
      setAuditLedger(data.auditLedger ?? auditLedger);
      setProductStateStorage(data.productStateStorage ?? null);
      onCommitted(
        data.reviewedDrafts ?? reviewedDrafts,
        data.message ?? "Publish validated.",
      );
      onClose();
    } catch (error) {
      reportBrowserBoundaryFailure({ event: "admin_publish_commit_request_failed", error });
      setMessage("Publish failed.");
    } finally {
      setCommitting(false);
    }
  };

  const decisions = decision?.decisions ?? [];
  const receiptByDecisionId = useMemo(
    () =>
      new Map(
        (auditLedger?.receipts ?? []).map((receipt) => [
          receipt.decisionId,
          receipt,
        ]),
      ),
    [auditLedger],
  );

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[5.35rem] z-[29] overflow-y-auto bg-black/[0.76] p-4 backdrop-blur-xl md:top-[5.75rem] md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-velmere-gold/[0.18] bg-[#070706] shadow-2xl shadow-black/60">
        <div className="flex flex-col gap-4 border-b border-white/[0.09] bg-white/[0.035] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">
              {copy.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/[0.58]">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDecision}
              disabled={loading || committing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.62] hover:border-velmere-gold/[0.28] hover:text-velmere-gold disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              {copy.refresh}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.62] hover:border-white/[0.25] hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {copy.close}
            </button>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-5 md:p-7">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/[0.38]">
                  {copy.selected}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {decision?.selectedCount ?? drafts.length}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-300/[0.18] bg-emerald-500/[0.045] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/[0.52]">
                  {copy.allowed}
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-100">
                  {decision?.allowedCount ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-red-300/[0.18] bg-red-500/[0.045] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-red-100/[0.52]">
                  {copy.blocked}
                </p>
                <p className="mt-2 text-2xl font-semibold text-red-100">
                  {decision?.blockedCount ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-velmere-gold/[0.20] bg-velmere-gold/[0.055] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-velmere-gold/[0.72]">
                  {copy.review}
                </p>
                <p className="mt-2 text-2xl font-semibold text-velmere-gold">
                  {decision?.reviewCount ?? 0}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.10] bg-black/[0.24] p-4 text-xs leading-6 text-white/[0.58]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono uppercase tracking-[0.16em] text-white/[0.38]">
                  {copy.batch}
                </span>
                <span className="rounded-full border border-white/[0.10] px-3 py-1 font-mono text-white/[0.72]">
                  {decision?.batchTraceId ?? "loading"}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 uppercase tracking-[0.14em] ${statusClass(decision?.canCommit ? "allowed" : "blocked")}`}
                >
                  {decision?.canCommit ? "commit allowed" : "commit blocked"}
                </span>
              </div>
              <p className="mt-3">{copy.operatorNote}</p>
              {auditLedger ? (
                <div className="mt-4 grid gap-2 text-[11px] sm:grid-cols-4">
                  <span className="rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2">
                    {copy.auditLedger}: {auditLedger.batchReceiptId}
                  </span>
                  <span className="rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2">
                    Receipts: {auditLedger.receiptCount}
                  </span>
                  <span className="rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2">
                    {copy.storageMode}: {auditLedger.storage.mode}
                  </span>
                  <span className="rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2">
                    Durable: {auditLedger.durableWrite ? "yes" : "pending"}
                  </span>
                  <span className="rounded-xl border border-white/[0.10] bg-white/[0.025] px-3 py-2">
                    {copy.statusStorage}:{" "}
                    {productStateStorage?.mode ?? "preview"}
                  </span>
                </div>
              ) : null}
              {message ? (
                <p className="mt-3 text-velmere-gold">{message}</p>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="flex min-h-52 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.025] text-white/[0.54]">
                  <Loader2
                    className="mr-3 h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                  VLM Product Brain re-check...
                </div>
              ) : decisions.length ? (
                decisions.map((item) => {
                  const draft =
                    reviewedDrafts.find(
                      (entry) => entry.draftId === item.draftId,
                    ) ?? drafts.find((entry) => entry.draftId === item.draftId);
                  const product = draft?.product;
                  const price = product?.price
                    ? formatMoney(product.price, locale)
                    : "-";
                  return (
                    <article
                      key={item.decisionId}
                      className="overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.03]"
                    >
                      <div className="flex flex-col gap-4 border-b border-white/[0.08] p-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">
                            {item.provider} · {item.slug}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-white">
                            {item.title || titleForDraft(draft)}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.15em]">
                            <span
                              className={`rounded-full border px-3 py-2 ${statusClass(item.snapshot.brainLevel)}`}
                            >
                              AI {item.snapshot.brainLevel} ·{" "}
                              {item.snapshot.brainScore ?? "-"}/100
                            </span>
                            <span
                              className={`rounded-full border px-3 py-2 ${statusClass(item.finalStatus)}`}
                            >
                              {copy.finalStatus}: {item.finalStatus}
                            </span>
                            {item.activeBlocked ? (
                              <span className="rounded-full border border-red-300/[0.25] bg-red-500/[0.055] px-3 py-2 text-red-100/[0.80]">
                                {copy.activeBlock}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right text-sm text-white/[0.66]">
                          <p>{price}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/[0.36]">
                            {item.decisionId}
                          </p>
                          {receiptByDecisionId.get(item.decisionId) ? (
                            <p className="mt-2 rounded-full border border-white/[0.10] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/[0.48]">
                              {copy.auditReceipt}:{" "}
                              {
                                receiptByDecisionId.get(item.decisionId)
                                  ?.receiptId
                              }
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="border-b border-white/[0.08] p-4 lg:border-b-0 lg:border-r">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]">
                            {copy.snapshot}
                          </p>
                          <div className="grid gap-2 text-xs text-white/[0.58] sm:grid-cols-2">
                            <span>Images: {item.snapshot.imageCount}</span>
                            <span>Variants: {item.snapshot.variantCount}</span>
                            <span>
                              Mapped: {item.snapshot.providerMappedVariants}
                            </span>
                            <span>
                              Available: {item.snapshot.availableVariants}
                            </span>
                            <span>Garment: {item.snapshot.garmentType}</span>
                            <span>Source: {item.snapshot.sourceQuality}</span>
                            <span>
                              Mapping: {item.snapshot.providerMappingStatus}
                            </span>
                            <span>Stock: {item.snapshot.stockStatus}</span>
                            <span>
                              Size cm: {item.snapshot.sizeGuideStatus}
                            </span>
                            <span>
                              Checkout:{" "}
                              {item.snapshot.checkoutEnabled
                                ? "enabled"
                                : "blocked"}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]">
                            {copy.reasons}
                          </p>
                          {item.reasons.length ? (
                            <div className="space-y-2">
                              {item.reasons.slice(0, 8).map((reason) => (
                                <div
                                  key={`${item.decisionId}-${reason.source}-${reason.code}-${reason.label}`}
                                  className={`rounded-xl border p-3 text-xs leading-5 ${statusClass(reason.severity)}`}
                                >
                                  <span className="font-mono uppercase tracking-[0.14em]">
                                    {reason.source} / {reason.severity}
                                  </span>
                                  <p className="mt-1">{reason.label}</p>
                                </div>
                              ))}
                              {item.reasons.length > 8 ? (
                                <p className="text-xs text-white/[0.38]">
                                  +{item.reasons.length - 8} more
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="rounded-xl border border-emerald-300/[0.18] bg-emerald-500/[0.05] p-3 text-xs text-emerald-100/[0.78]">
                              {copy.emptyReasons}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-red-300/[0.18] bg-red-500/[0.05] p-5 text-sm text-red-100/[0.78]">
                  No publish decisions returned.
                </div>
              )}
            </div>
          </section>

          <aside className="border-t border-white/[0.09] bg-black/[0.24] p-5 xl:border-l xl:border-t-0">
            <div className="sticky top-6 space-y-5">
              <div
                className={`rounded-2xl border p-4 ${statusClass(decision?.canCommit ? "allowed" : "blocked")}`}
              >
                <div className="flex items-start gap-3">
                  {decision?.canCommit ? (
                    <ShieldCheck
                      className="mt-1 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Lock
                      className="mt-1 h-5 w-5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {copy.checklist}
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {decision?.canCommit
                        ? copy.confirmLabel
                        : copy.blockedMessage}
                    </p>
                  </div>
                </div>
              </div>

              {targetStatus === "active" ? (
                <label className="flex items-start gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4 text-sm leading-6 text-white/[0.62]">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="mt-1"
                  />
                  <span>{copy.confirmLabel}</span>
                </label>
              ) : (
                <div className="rounded-2xl border border-emerald-300/[0.16] bg-emerald-500/[0.045] p-4 text-sm leading-6 text-emerald-50/[0.72]">
                  Coming Soon needs only the phrase below. Active sale still
                  needs full operator confirmation.
                </div>
              )}

              <div>
                <label
                  htmlFor="publish-confirm-phrase"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]"
                >
                  {copy.typeLabel}
                </label>
                <input
                  id="publish-confirm-phrase"
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  placeholder={requiredPhrase(targetStatus)}
                  className="mt-3 h-12 w-full rounded-2xl border border-white/[0.10] bg-black/[0.35] px-4 font-mono text-sm uppercase tracking-[0.16em] text-white outline-none focus:border-velmere-gold"
                />
              </div>

              <button
                type="button"
                onClick={commit}
                disabled={!canConfirm}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-velmere-gold px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/[0.34]"
              >
                {committing ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                )}
                {committing ? copy.committing : copy.confirm}
              </button>

              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4 text-xs leading-6 text-white/[0.46]">
                <div className="mb-2 flex items-center gap-2 text-white/[0.64]">
                  <AlertTriangle
                    className="h-4 w-4 text-velmere-gold"
                    aria-hidden="true"
                  />
                  Status diff
                </div>
                <p>
                  Target:{" "}
                  {targetStatus === "active" ? copy.active : copy.comingSoon}
                </p>
                <p>Required phrase: {requiredPhrase(targetStatus)}</p>
                <p>Batch: {decision?.batchTraceId ?? "-"}</p>
              </div>

              {auditLedger ? (
                <div className="rounded-2xl border border-velmere-gold/[0.18] bg-velmere-gold/[0.045] p-4 text-xs leading-6 text-velmere-gold/[0.78]">
                  <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-velmere-gold">
                    {copy.auditLedger}
                  </p>
                  <p>
                    {copy.auditReceipt}: {auditLedger.batchReceiptId}
                  </p>
                  <p>
                    {copy.storageMode}: {auditLedger.storage.mode}
                  </p>
                  <p>
                    Durable write:{" "}
                    {auditLedger.durableWrite ? "yes" : "pending"}
                  </p>
                  <p>
                    Written receipts:{" "}
                    {auditLedger.storage.writtenReceiptCount ?? 0}
                  </p>
                  <p>Changed: {auditLedger.summary.changedStatuses}</p>
                  <p>Blocked receipts: {auditLedger.summary.blockedReceipts}</p>
                  <p className="mt-2 text-white/[0.44]">
                    {auditLedger.storage.nextStep}
                  </p>
                </div>
              ) : null}

              {productStateStorage ? (
                <div className="rounded-2xl border border-white/[0.10] bg-white/[0.025] p-4 text-xs leading-6 text-white/[0.54]">
                  <p className="mb-2 font-semibold uppercase tracking-[0.16em] text-white/[0.72]">
                    {copy.statusStorage}
                  </p>
                  <p>Mode: {productStateStorage.mode}</p>
                  <p>
                    Durable write:{" "}
                    {productStateStorage.durableWrite ? "yes" : "pending"}
                  </p>
                  <p>
                    Products: {productStateStorage.writtenProductCount}/
                    {productStateStorage.productCount}
                  </p>
                  <p>Changed: {productStateStorage.changedProductCount}</p>
                  <p>
                    Duplicates: {productStateStorage.duplicateDecisionCount}
                  </p>
                  <p className="mt-2 text-white/[0.38]">
                    {productStateStorage.productionBoundary}
                  </p>
                </div>
              ) : null}

              {decision?.canCommit ? (
                <div className="rounded-2xl border border-emerald-300/[0.16] bg-emerald-500/[0.045] p-4 text-xs leading-6 text-emerald-100/[0.76]">
                  <CheckCircle2 className="mb-2 h-4 w-4" aria-hidden="true" />
                  VLM gate is ready for operator confirmation.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
