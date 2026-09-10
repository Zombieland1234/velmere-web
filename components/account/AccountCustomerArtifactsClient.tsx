"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { fetchWithCustomerAuth } from "@/lib/auth/customer-auth-fetch";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA,
  P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA,
  p86PublicAccountArtifactListMatchesDetail,
  parseP86PublicAccountArtifactDetail,
  parseP86PublicAccountArtifactList,
  type P86PublicAccountArtifactDetail,
  type P86PublicAccountArtifactListRow,
} from "@/lib/reporting/public-account-artifact-contract";

type SupportedLocale = "pl" | "en" | "de";

const copy = {
  en: {
    kicker: "Durable account vault",
    title: "Saved customer reports",
    body: "Only reports read back from your protected account storage appear here. PDF actions remain locked until the stored blob is verified.",
    loading: "Loading saved reports…",
    empty: "No durable customer reports have been saved yet.",
    error: "Saved reports are temporarily unavailable. No unverified PDF link has been exposed.",
    retry: "Try again",
    select: "Verify saved report",
    verifying: "Verifying the stored PDF…",
    verified: "Durable storage and identical preview/download bytes verified.",
    unavailable: "Exact stored PDF is unavailable",
    preview: "Preview verified PDF",
    download: "Download verified PDF",
    pages: "pages",
    ephemeral: "The activity inbox below is separate and may contain current-tab metadata; it is not durable report storage.",
  },
  pl: {
    kicker: "Trwały sejf konta",
    title: "Zapisane raporty klienta",
    body: "Pokazujemy tylko raporty odczytane z chronionego magazynu Twojego konta. PDF pozostaje zablokowany do czasu sprawdzenia zapisanego pliku.",
    loading: "Wczytuję zapisane raporty…",
    empty: "Nie zapisano jeszcze żadnego trwałego raportu klienta.",
    error: "Zapisane raporty są chwilowo niedostępne. Nie udostępniono niezweryfikowanego linku PDF.",
    retry: "Spróbuj ponownie",
    select: "Sprawdź zapisany raport",
    verifying: "Sprawdzam zapisany PDF…",
    verified: "Potwierdzono trwały zapis oraz identyczne bajty podglądu i pobrania.",
    unavailable: "Dokładny zapisany PDF jest niedostępny",
    preview: "Podejrzyj zweryfikowany PDF",
    download: "Pobierz zweryfikowany PDF",
    pages: "stron",
    ephemeral: "Skrzynka aktywności poniżej jest oddzielna i może zawierać metadane tylko z bieżącej karty; nie jest trwałym magazynem raportów.",
  },
  de: {
    kicker: "Dauerhafter Konto-Tresor",
    title: "Gespeicherte Kundenberichte",
    body: "Hier erscheinen nur Berichte, die aus dem geschützten Kontospeicher zurückgelesen wurden. PDF-Aktionen bleiben bis zur Prüfung des gespeicherten Blobs gesperrt.",
    loading: "Gespeicherte Berichte werden geladen…",
    empty: "Es wurden noch keine dauerhaften Kundenberichte gespeichert.",
    error: "Gespeicherte Berichte sind vorübergehend nicht verfügbar. Kein ungeprüfter PDF-Link wurde freigegeben.",
    retry: "Erneut versuchen",
    select: "Gespeicherten Bericht prüfen",
    verifying: "Gespeicherte PDF-Datei wird geprüft…",
    verified: "Dauerhafte Speicherung und identische Vorschau-/Download-Bytes bestätigt.",
    unavailable: "Exakt gespeicherte PDF-Datei ist nicht verfügbar",
    preview: "Geprüfte PDF ansehen",
    download: "Geprüfte PDF herunterladen",
    pages: "Seiten",
    ephemeral: "Der Aktivitäts-Posteingang darunter ist getrennt und kann Metadaten nur aus dem aktuellen Tab enthalten; er ist kein dauerhafter Berichtsspeicher.",
  },
} as const;

function requiredResponseBoundary(response: Response, schema: string) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return response.headers.get("x-velmere-contract") === schema
    && cacheControl.split(",").some((value) => value.trim() === "no-store");
}

function localeDate(value: string, locale: SupportedLocale) {
  try {
    return new Intl.DateTimeFormat(
      locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-GB",
      { dateStyle: "medium", timeStyle: "short" },
    ).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AccountCustomerArtifactsClient() {
  const currentLocale = useLocale();
  const locale: SupportedLocale = currentLocale === "pl" || currentLocale === "de" ? currentLocale : "en";
  const t = copy[locale];
  const [artifacts, setArtifacts] = useState<readonly P86PublicAccountArtifactListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verifiedDetail, setVerifiedDetail] = useState<P86PublicAccountArtifactDetail | null>(null);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [detailState, setDetailState] = useState<"idle" | "loading" | "verified" | "unavailable">("idle");
  const [reload, setReload] = useState(0);

  const selectedRow = useMemo(
    () => artifacts.find((artifact) => artifact.artifactId === selectedId) ?? null,
    [artifacts, selectedId],
  );

  const refresh = useCallback(() => {
    setListState("loading");
    setVerifiedDetail(null);
    setDetailState("idle");
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetchWithCustomerAuth(
          "/api/account/customer-artifact?format=json&limit=24",
          {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            redirect: "error",
            signal: controller.signal,
          },
          { retryAuthOnce: true, timeoutMs: 10_000, operation: "account_customer_artifact_list" },
        );
        if (!response.ok || !requiredResponseBoundary(response, P86_PUBLIC_ACCOUNT_ARTIFACT_LIST_SCHEMA)) {
          throw new Error("account_customer_artifact_list_boundary_invalid");
        }
        const payload = await readJsonResponseBounded<unknown>(response, 512_000, {
          timeoutMs: 10_000,
          operation: "account_customer_artifact_list_body",
          jsonMaxDepth: 12,
          jsonMaxNodes: 10_000,
        });
        const parsed = parseP86PublicAccountArtifactList(payload);
        if (!parsed) throw new Error("account_customer_artifact_list_contract_invalid");
        if (!active) return;
        const queryArtifact = new URLSearchParams(window.location.search).get("artifact");
        setArtifacts(parsed.artifacts);
        setSelectedId((previous) => parsed.artifacts.some((row) => row.artifactId === previous)
          ? previous
          : parsed.artifacts.some((row) => row.artifactId === queryArtifact)
            ? queryArtifact
            : null);
        setListState("ready");
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        void error;
        setArtifacts([]);
        setSelectedId(null);
        setListState("error");
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload]);

  useEffect(() => {
    if (!selectedRow) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const route = `/api/account/customer-artifact?id=${encodeURIComponent(selectedRow.artifactId)}&format=json`;
        const response = await fetchWithCustomerAuth(route, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        }, { retryAuthOnce: true, timeoutMs: 10_000, operation: "account_customer_artifact_detail" });
        if (!response.ok || !requiredResponseBoundary(response, P86_PUBLIC_ACCOUNT_ARTIFACT_SCHEMA)) {
          throw new Error("account_customer_artifact_detail_boundary_invalid");
        }
        const payload = await readJsonResponseBounded<unknown>(response, 1_048_576, {
          timeoutMs: 10_000,
          operation: "account_customer_artifact_detail_body",
          jsonMaxDepth: 32,
          jsonMaxNodes: 50_000,
        });
        const parsed = parseP86PublicAccountArtifactDetail(payload);
        if (!parsed
          || !p86PublicAccountArtifactListMatchesDetail(selectedRow, parsed.artifact)
          || !parsed.artifact.exactStoredPdf
          || !parsed.artifact.previewDownloadByteIdentical
          || !parsed.artifact.previewRoute
          || !parsed.artifact.downloadRoute) {
          throw new Error("account_customer_artifact_detail_contract_invalid");
        }
        if (!active) return;
        setVerifiedDetail(parsed.artifact);
        setDetailState("verified");
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        void error;
        setVerifiedDetail(null);
        setDetailState("unavailable");
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedRow]);

  return (
    <section
      className="mt-7 rounded-2xl border border-cyan-200/[0.16] bg-cyan-200/[0.035] p-5 md:p-6"
      aria-labelledby="account-customer-artifacts-title"
      data-testid="account-customer-artifacts"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{t.kicker}</p>
          <h2 id="account-customer-artifacts-title" className="mt-3 text-2xl text-velmere-ivory">{t.title}</h2>
          <p className="mt-3 text-sm leading-7 text-velmere-muted">{t.body}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.12] px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.68] hover:border-cyan-200/[0.30] hover:text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t.retry}
        </button>
      </div>

      <div className="mt-5" aria-live="polite" aria-atomic="true">
        {listState === "loading" ? <p className="text-sm text-white/[0.62]">{t.loading}</p> : null}
        {listState === "error" ? (
          <p className="rounded-xl border border-red-300/[0.18] bg-red-300/[0.04] p-4 text-sm leading-7 text-red-100/[0.82]">{t.error}</p>
        ) : null}
        {listState === "ready" && artifacts.length === 0 ? (
          <p className="rounded-xl border border-white/[0.10] bg-black/[0.18] p-4 text-sm text-white/[0.58]">{t.empty}</p>
        ) : null}
      </div>

      {artifacts.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {artifacts.map((artifact) => {
            const selected = artifact.artifactId === selectedId;
            const verified = verifiedDetail?.artifactId === artifact.artifactId;
            return (
              <article
                key={artifact.artifactId}
                className={`rounded-xl border p-4 ${selected ? "border-cyan-200/[0.28] bg-black/[0.28]" : "border-white/[0.10] bg-black/[0.18]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 shrink-0 text-velmere-gold" aria-hidden="true" />
                      <h3 className="truncate text-base text-velmere-ivory">{artifact.title}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-white/[0.52]">
                      {artifact.subject} · {artifact.deliveredTier ?? artifact.requestedTier} · {artifact.pageCount} {t.pages}
                    </p>
                    <time className="mt-1 block font-mono text-[10px] text-white/[0.38]" dateTime={artifact.generatedAt}>
                      {localeDate(artifact.generatedAt, locale)}
                    </time>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifiedDetail(null);
                      setDetailState("loading");
                      setSelectedId(artifact.artifactId);
                    }}
                    aria-pressed={selected}
                    className="inline-flex min-h-11 items-center rounded-full border border-white/[0.12] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.66] hover:border-cyan-200/[0.30] hover:text-white"
                  >
                    {t.select}
                  </button>
                </div>
                {selected ? (
                  <div className="mt-4 border-t border-white/[0.08] pt-4" aria-live="polite">
                    {detailState === "loading" || detailState === "idle" ? <p className="text-sm text-white/[0.58]">{t.verifying}</p> : null}
                    {detailState === "unavailable" ? (
                      <p className="text-sm text-amber-100/[0.78]">{t.unavailable}</p>
                    ) : null}
                    {verified && verifiedDetail?.previewRoute && verifiedDetail.downloadRoute ? (
                      <>
                        <p className="flex items-center gap-2 text-sm text-emerald-100/[0.82]" data-testid="account-customer-artifact-verified">
                          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> {t.verified}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <a
                            href={verifiedDetail.previewRoute}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-velmere-ivory px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-black"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" /> {t.preview}
                          </a>
                          <a
                            href={verifiedDetail.downloadRoute}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.14] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.76]"
                          >
                            <Download className="h-4 w-4" aria-hidden="true" /> {t.download}
                          </a>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <p className="mt-5 border-t border-white/[0.08] pt-4 text-xs leading-6 text-white/[0.38]">{t.ephemeral}</p>
    </section>
  );
}
