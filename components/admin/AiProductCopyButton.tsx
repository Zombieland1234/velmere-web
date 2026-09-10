"use client";


import { readBrowserJsonObject } from "@/lib/security/browser-json-response-boundary";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedString } from "@/lib/products/catalog";
import type { ProductImportDraft } from "@/lib/products/types";

type AiProductCopyButtonProps = {
  token: string;
  drafts: ProductImportDraft[];
};

type AiProductCopyResponse = { text?: string; error?: string };

async function readAiJson(response: Response) {
  return readBrowserJsonObject<AiProductCopyResponse>(response, {
    maxBytes: 512 * 1024,
    maxDepth: 16,
    maxNodes: 20_000,
  });
}

export default function AiProductCopyButton({ token, drafts }: AiProductCopyButtonProps) {
  const t = useTranslations("Ai");
  const locale = useLocale() as "pl" | "en" | "de";
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const input = useMemo(
    () =>
      drafts
        .slice(0, 5)
        .map((draft) => ({
          title: getLocalizedString(draft.product.title, locale),
          description: getLocalizedString(draft.product.description, locale),
          shortDescription: getLocalizedString(draft.product.shortDescription, locale),
          provider: draft.product.provider,
          status: draft.product.status,
          price: draft.product.price,
          sizes: draft.product.variants.map((variant) => variant.size || variant.title).filter(Boolean),
          shipping: draft.product.truth?.deliveryNote ?? null,
          manualImagePolicy: "operator manually uploads final Velmère product media; AI must not fetch, invent or reuse provider image URLs",
          warnings: draft.warnings,
          brain: draft.brain
            ? {
                garmentType: draft.brain.detected.garmentType,
                readiness: draft.brain.readiness.level,
                score: draft.brain.readiness.score,
                missing: draft.brain.readiness.missing.map((item) => item.label),
                seoTitle: getLocalizedString(draft.brain.naming.seoTitle, locale),
                metaDescription: getLocalizedString(draft.brain.naming.metaDescription, locale),
              }
            : null,
        })),
    [drafts, locale],
  );

  const run = async () => {
    setStatus("loading");
    setError("");
    setResult("");
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: "import_cleanup",
          locale,
          input: JSON.stringify(input, null, 2),
        }),
      });
      const result = await readAiJson(response);
      if (!result.ok || !response.ok || typeof result.value.text !== "string") {
        reportBrowserBoundaryFailure({
          event: "admin_ai_copy_response_rejected",
          error: new Error(result.ok ? "admin_ai_copy_unavailable" : result.code),
        });
        throw new Error("admin_ai_copy_unavailable");
      }
      setResult(result.value.text);
    } catch (caught) {
      reportBrowserBoundaryFailure({ event: "admin_ai_copy_request_failed", error: caught });
      setError(t("failed"));
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.10] bg-black/[0.25] p-4 text-sm leading-7 text-white/[0.58]" data-pass2512-product-import-truth="printful-tapstitch-manual-naming-size-material-image-owner-boundary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("adminBody")}</p>
        <button
          type="button"
          onClick={run}
          disabled={!token || drafts.length === 0 || status === "loading"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-velmere-gold/[0.35] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-velmere-gold transition-colors hover:bg-velmere-gold hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {t("generate")}
        </button>
      </div>
      {error && <p className="mt-3 text-velmere-gold">{error}</p>}
      {result && (
        <textarea
          readOnly
          value={result}
          rows={8}
          className="mt-4 w-full rounded-lg border border-white/[0.10] bg-black/[0.35] p-4 text-sm leading-7 text-white outline-none"
        />
      )}
    </div>
  );
}
