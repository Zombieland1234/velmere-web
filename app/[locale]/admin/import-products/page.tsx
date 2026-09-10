"use client";

import { sha256Token } from "@/lib/security/cryptographic-digest";
import { readBrowserJsonObject } from "@/lib/security/browser-json-response-boundary";
import { reportBrowserBoundaryFailure } from "@/lib/security/browser-error-redaction";
import {
  clearAdminProductDraftCurrentTabState,
  purgeLegacyAdminProductDraftBrowserState,
  readAdminProductDraftCurrentTabState,
  writeAdminProductDraftCurrentTabState,
} from "@/lib/security/admin-product-draft-browser-state";

import { fetchSameOriginWithDeadline } from "@/lib/network/fetch-with-deadline";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileUp, LinkIcon, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import AiProductCopyButton from "@/components/admin/AiProductCopyButton";
import VlmProductBrainEditor from "@/components/admin/VlmProductBrainEditor";
import VlmProductCustomerPreview from "@/components/admin/VlmProductCustomerPreview";
import VlmProductPublishDecisionModal from "@/components/admin/VlmProductPublishDecisionModal";
import AdminToolsLockedPanel from "@/components/launch/AdminToolsLockedPanel";
import OrderEventLedgerPanel from "@/components/launch/OrderEventLedgerPanel";
import AdminRouteGatePanel from "@/components/launch/AdminRouteGatePanel";
import AdminServerAuthContractPanel from "@/components/launch/AdminServerAuthContractPanel";
import PublishPermissionGatePanel from "@/components/launch/PublishPermissionGatePanel";
import SecretRedactionPolicyPanel from "@/components/launch/SecretRedactionPolicyPanel";
import AdminMutationAuditPanel from "@/components/launch/AdminMutationAuditPanel";
import AdminAuditPersistencePanel from "@/components/launch/AdminAuditPersistencePanel";
import PublishRollbackContextPanel from "@/components/launch/PublishRollbackContextPanel";
import SupportSafeTimelinePanel from "@/components/launch/SupportSafeTimelinePanel";
import AdminAuditWriteApiPanel from "@/components/launch/AdminAuditWriteApiPanel";
import CustomerSafeExportBoundaryPanel from "@/components/launch/CustomerSafeExportBoundaryPanel";
import AdminAuthSessionGuardPanel from "@/components/launch/AdminAuthSessionGuardPanel";
import AdminIdempotencyStorePanel from "@/components/launch/AdminIdempotencyStorePanel";
import LuxurySection from "@/components/layout/LuxurySection";
import type { ProductImportDraft } from "@/lib/products/types";
import type { ProductPublishTargetStatus } from "@/lib/products/publish-decision";
import { formatMoney, getLocalizedString } from "@/lib/products/catalog";
import { getClientAdminEnvironmentGate } from "@/lib/launch/admin-environment-gate";

const adminGateCopy = "admin gate / launch control";

type Tab = "links" | "printful" | "csv";

const TABS: Array<{ id: Tab; icon: typeof LinkIcon }> = [
  { id: "links", icon: LinkIcon },
  { id: "printful", icon: RefreshCw },
  { id: "csv", icon: FileUp },
];


type AdminTextChangeEvent = { target: { value: string } };
type AdminCheckboxChangeEvent = { target: { checked: boolean } };
type AdminFileInputChangeEvent = { currentTarget: { files?: FileList | null } };

function simpleAdminCopy(locale: string) {
  if (locale === "pl") {
    return {
      kicker: "Private admin · ręczne media",
      title: "Prosty panel produktów",
      body: "Importuj dane z Printful jako drafty, dodaj własne zdjęcia produktu ręcznie, pozwól VLM Product Brain uporządkować opis, rozmiary i provider truth, a potem publikuj tylko preview albo coming soon. Zdjęcia providera nie są importowane.",
      steps: ["1 · Sync Printful", "2 · Edytuj produkt", "3 · Dodaj max 4 zdjęcia", "4 · Przelicz AI gate"],
      ownerNote: "Tylko lokalny panel ownera. Drafty zostają prywatne; active publish jest blokowany dopóki shipping, materiał i legal nie są potwierdzone.",
    };
  }
  if (locale === "de") {
    return {
      kicker: "Private Admin · manuelle Medien",
      title: "Einfaches Produkt-Cockpit",
      body: "Importiere Printful-Daten als Drafts, füge eigene Produktbilder manuell hinzu, lasse VLM Product Brain Copy, Größen und Provider Truth bereinigen und veröffentliche nur Preview oder Coming Soon. Provider-Bilder werden nicht importiert.",
      steps: ["1 · Printful Sync", "2 · Produkt bearbeiten", "3 · Max. 4 Bilder", "4 · AI Gate prüfen"],
      ownerNote: "Nur lokales Owner Panel. Drafts bleiben privat; Active Publish bleibt blockiert, bis Shipping, Material und Legal bestätigt sind.",
    };
  }
  return {
    kicker: "Private admin · manual media",
    title: "Simple product cockpit",
    body: "Import Printful data as drafts, add your own product images manually, let VLM Product Brain clean copy/size/provider truth, then publish only as preview or coming soon. No provider photos are imported.",
    steps: ["1 · Sync Printful", "2 · Edit product", "3 · Add max 4 photos", "4 · Re-check AI gate"],
    ownerNote: "Local owner panel only. Drafts stay private; active publish remains blocked until shipping, material and legal checks are complete.",
  };
}

async function readApiJson(response: Response) {
  return readBrowserJsonObject<Record<string, unknown>>(response, {
    maxBytes: 512 * 1024,
    maxDepth: 48,
    maxNodes: 75_000,
  });
}

function stableDraftKey(seed: string) {
  return sha256Token(seed, 16);
}

function normalizeImportedDraftIds(input: ProductImportDraft[]) {
  const seen = new Map<string, number>();
  return input.map((draft, index) => {
    const seed = [
      draft.draftId,
      draft.product.provider,
      draft.product.providerProductId,
      draft.product.slug,
      draft.product.variants.map((variant) => variant.providerVariantId || variant.sku || variant.id).join("|"),
      index,
    ].filter(Boolean).join(":");
    const baseId = draft.product.providerProductId
      ? `draft_${draft.product.provider}_${draft.product.providerProductId}`
      : draft.draftId || `draft_manual_${stableDraftKey(seed)}`;
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const uniqueId = count === 0 ? baseId : `${baseId}_${count + 1}_${stableDraftKey(seed)}`;
    return {
      ...draft,
      draftId: uniqueId,
      product: {
        ...draft.product,
        id: uniqueId,
        slug: draft.product.slug || uniqueId.replace(/^draft_/, ""),
      },
    };
  });
}

function uniqueSelectedDrafts(drafts: ProductImportDraft[], selectedIds: string[]) {
  const selectedSet = new Set(selectedIds);
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    if (!selectedSet.has(draft.draftId)) return false;
    const stable = draft.product.providerProductId
      ? `${draft.product.provider}:${draft.product.providerProductId}`
      : draft.product.slug || draft.draftId;
    if (seen.has(stable)) return false;
    seen.add(stable);
    return true;
  });
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function getDraftStableKey(draft: ProductImportDraft) {
  if (draft.product.providerProductId) return `${draft.product.provider}:${draft.product.providerProductId}`;
  return draft.product.slug || draft.product.id || draft.draftId;
}

function mergeImportedDrafts(existing: ProductImportDraft[], incoming: ProductImportDraft[]) {
  const existingByStable = new Map(existing.map((draft) => [getDraftStableKey(draft), draft]));
  return incoming.map((draft) => {
    const previous = existingByStable.get(getDraftStableKey(draft));
    if (!previous) return draft;
    const previousProduct = previous.product;
    const nextProduct = draft.product;
    return {
      ...draft,
      draftId: previous.draftId || draft.draftId,
      product: {
        ...nextProduct,
        id: previousProduct.id || nextProduct.id,
        slug: previousProduct.slug || nextProduct.slug,
        title: previousProduct.title ?? nextProduct.title,
        shortDescription: previousProduct.shortDescription ?? nextProduct.shortDescription,
        description: previousProduct.description ?? nextProduct.description,
        truth: previousProduct.truth ?? nextProduct.truth,
        collection: previousProduct.collection || nextProduct.collection,
        status: previousProduct.status === "coming_soon" || previousProduct.status === "active" ? previousProduct.status : nextProduct.status,
        tags: Array.from(new Set([...(nextProduct.tags ?? []), ...(previousProduct.tags ?? [])])),
        images: previousProduct.images.length ? previousProduct.images : nextProduct.images,
      },
    };
  });
}

function getDraftActionState(draft: ProductImportDraft, locale: string) {
  const hasImages = draft.product.images.length > 0;
  const rechecked = Boolean(draft.brain);
  const status = draft.product.status;
  if (status === "coming_soon") {
    return {
      step: "LIVE",
      label: locale === "pl" ? "Jest na shopie" : locale === "de" ? "Im Shop sichtbar" : "Visible on shop",
      help: `/${locale}/shop`,
      tone: "border-emerald-300/[0.22] bg-emerald-500/[0.055] text-emerald-100/[0.78]",
    };
  }
  if (!hasImages) {
    return {
      step: "1",
      label: locale === "pl" ? "Dodaj zdjęcia" : locale === "de" ? "Bilder hinzufügen" : "Add photos",
      help: locale === "pl" ? "Kliknij Edytuj / zdjęcia i wrzuć 1–4 zdjęcia." : locale === "de" ? "Bearbeiten klicken und 1–4 Bilder laden." : "Click Edit / photos and upload 1–4 images.",
      tone: "border-red-300/[0.24] bg-red-500/[0.06] text-red-50/[0.78]",
    };
  }
  if (!rechecked) {
    return {
      step: "2",
      label: locale === "pl" ? "Przelicz AI" : locale === "de" ? "AI prüfen" : "Re-check AI",
      help: locale === "pl" ? "Po zdjęciach kliknij Re-check AI gate." : locale === "de" ? "Nach Bildern AI Gate prüfen." : "After photos, click Re-check AI gate.",
      tone: "border-velmere-gold/[0.22] bg-velmere-gold/[0.055] text-velmere-gold",
    };
  }
  return {
    step: "3",
    label: locale === "pl" ? "Publish Coming Soon" : locale === "de" ? "Coming Soon publishen" : "Publish Coming Soon",
    help: locale === "pl" ? "Zaznacz i kliknij Publish Coming Soon." : locale === "de" ? "Markieren und Coming Soon publishen." : "Select it and click Publish Coming Soon.",
    tone: "border-cyan-300/[0.18] bg-cyan-500/[0.045] text-cyan-50/[0.72]",
  };
}


function getMainProductIssue(draft: ProductImportDraft, locale: string) {
  const hasImages = draft.product.images.length > 0;
  const materialMissing = draft.brain?.readiness.missing.some((item) => item.id.includes("material") || item.label.toLowerCase().includes("material")) || false;
  const sizeMissing = draft.brain?.providerAdapter.sizeGuideStatus === "missing" || draft.brain?.readiness.missing.some((item) => item.id.includes("size"));
  if (!hasImages) return locale === "pl" ? "Dodaj zdjęcia" : locale === "de" ? "Bilder hinzufügen" : "Add photos";
  if (materialMissing) return locale === "pl" ? "Uzupełnij materiał/skład" : locale === "de" ? "Material ergänzen" : "Add material";
  if (sizeMissing) return locale === "pl" ? "Tabela cm później" : locale === "de" ? "Größentabelle später" : "Size chart later";
  if (draft.validationErrors.length) return locale === "pl" ? "Sprawdź blokery" : locale === "de" ? "Blocker prüfen" : "Check blockers";
  return locale === "pl" ? "Można dać Coming Soon" : locale === "de" ? "Coming Soon möglich" : "Ready for Coming Soon";
}

function getProductFitLabel(product: ProductImportDraft["product"], locale: string) {
  const tags = new Set(product.tags.map((tag) => tag.toLowerCase()));
  const collection = (product.collection ?? "").toLowerCase();
  if (tags.has("unisex") || collection.includes("unisex")) return "Unisex → Men + Women";
  if (tags.has("men") || collection.includes("men") || collection.includes("mę")) return locale === "pl" ? "Męskie" : "Men";
  if (tags.has("women") || collection.includes("women") || collection.includes("dam")) return locale === "pl" ? "Damskie" : "Women";
  return locale === "pl" ? "Ustaw fit" : locale === "de" ? "Fit setzen" : "Set fit";
}

function getSimpleAdminWords(locale: string) {
  if (locale === "pl") {
    return {
      now: "Co robisz teraz",
      selected: "zaznaczone",
      addPhotos: "Dodaj zdjęcia",
      addPhotosHelp: "Kliknij Edytuj / zdjęcia i wrzuć 1–4 własne zdjęcia. Pierwsze zdjęcie będzie główne na shopie.",
      recheck: "Przelicz AI gate",
      recheckHelp: "Po zmianach kliknij Re-check. AI ma tylko sprawdzić braki, opis, rozmiary i języki — nie dodaje zdjęć.",
      publish: "Opublikuj Coming Soon",
      publishHelp: "Zaznacz produkt i kliknij Publish Coming Soon. Produkt pojawi się na /shop jako zapowiedź, bez aktywnej sprzedaży.",
      shop: "Otwórz shop",
      product: "Produkt",
      photos: "Zdjęcia",
      brain: "AI gate",
      missing: "Braki",
      next: "Następny krok",
      actions: "Akcje",
      noPhoto: "Brak zdjęcia",
      firstPhoto: "1. zdjęcie = główne",
      showDetails: "Pokaż techniczne szczegóły",
      edit: "Edytuj / zdjęcia",
      preview: "Preview",
      comingSoon: "Po Publish Coming Soon zobaczysz produkt na /shop.",
      autoSaved: "Pamięć draftów bieżącej karty aktywna",
      cacheLoaded: "Odtworzono drafty z pamięci bieżącej karty dla tego administratora.",
      cacheFull: "Snapshot bieżącej karty jest zbyt duży — opublikuj lub usuń drafty przed kolejnymi zdjęciami.",
      clearLocal: "Wyczyść drafty bieżącej karty",
      selectAll: "Zaznacz wszystko",
      unselectAll: "Odznacz",
      memory: "Pamięć draftów bieżącej karty",
    };
  }
  if (locale === "de") {
    return {
      now: "Was jetzt tun",
      selected: "ausgewählt",
      addPhotos: "Bilder hinzufügen",
      addPhotosHelp: "Klicke Bearbeiten / Bilder und lade 1–4 eigene Bilder hoch. Das erste Bild ist das Shop-Hauptbild.",
      recheck: "AI Gate prüfen",
      recheckHelp: "Nach Änderungen Re-check klicken. AI prüft nur Lücken, Copy, Größen und Sprachen — keine Bilder.",
      publish: "Coming Soon publishen",
      publishHelp: "Produkt markieren und Publish Coming Soon klicken. Es erscheint als Vorschau im Shop, ohne aktiven Verkauf.",
      shop: "Shop öffnen",
      product: "Produkt",
      photos: "Bilder",
      brain: "AI Gate",
      missing: "Lücken",
      next: "Nächster Schritt",
      actions: "Aktionen",
      noPhoto: "Kein Bild",
      firstPhoto: "1. Bild = Hauptbild",
      showDetails: "Technische Details anzeigen",
      edit: "Bearbeiten / Bilder",
      preview: "Vorschau",
      comingSoon: "Nach Publish Coming Soon siehst du das Produkt auf /shop.",
      autoSaved: "Draft-Speicher des aktuellen Tabs aktiv",
      cacheLoaded: "Drafts aus dem aktuellen Tab für diesen Administrator wiederhergestellt.",
      cacheFull: "Der aktuelle Tab-Snapshot ist zu groß — veröffentlichen oder Drafts löschen.",
      clearLocal: "Drafts des aktuellen Tabs löschen",
      selectAll: "Alle markieren",
      unselectAll: "Auswahl löschen",
      memory: "Aktueller Tab-Draft-Speicher",
    };
  }
  return {
    now: "What to do now",
    selected: "selected",
    addPhotos: "Add photos",
    addPhotosHelp: "Click Edit / photos and upload 1–4 owned images. The first image becomes the main shop image.",
    recheck: "Re-check AI gate",
    recheckHelp: "After edits, click Re-check. AI only checks gaps, copy, sizes and languages — it never adds images.",
    publish: "Publish Coming Soon",
    publishHelp: "Select the product and click Publish Coming Soon. It appears on /shop as a preview, without active checkout.",
    shop: "Open shop",
    product: "Product",
    photos: "Photos",
    brain: "AI gate",
    missing: "Missing",
    next: "Next step",
    actions: "Actions",
    noPhoto: "No photo",
    firstPhoto: "1st image = main",
    showDetails: "Show technical details",
    edit: "Edit / photos",
    preview: "Preview",
    comingSoon: "After Publish Coming Soon you will see the product on /shop.",
    autoSaved: "Current-tab draft memory active",
    cacheLoaded: "Restored current-tab drafts for this administrator.",
    cacheFull: "The current-tab snapshot is too large — publish or clear drafts before adding more images.",
    clearLocal: "Clear current-tab drafts",
    selectAll: "Select all",
    unselectAll: "Unselect",
    memory: "Current-tab draft memory",
  };
}

export default function AdminImportProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("AdminImport");
  const adminEnvironmentGate = getClientAdminEnvironmentGate();
  const simpleCopy = simpleAdminCopy(locale);
  const simpleWords = getSimpleAdminWords(locale);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("printful");
  const [urls, setUrls] = useState("");
  const [csv, setCsv] = useState("");
  const [draftsState, setDrafts] = useState<ProductImportDraft[]>([]);
  const drafts: ProductImportDraft[] = draftsState as ProductImportDraft[];
  const [selectedDraftIdsState, setSelectedDraftIds] = useState<string[]>([]);
  const selectedDraftIds: string[] = selectedDraftIdsState as string[];
  const [activeEditorDraftId, setActiveEditorDraftId] = useState<string | null>(null);
  const [activePreviewDraftId, setActivePreviewDraftId] = useState<string | null>(null);
  const [pendingPublishStatus, setPendingPublishStatus] = useState<ProductPublishTargetStatus | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "publishing" | "rechecking">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [memoryState, setMemoryState] = useState<string | null>(null);
  const isBusy = status !== "idle";

  const selectedDrafts = useMemo(
    () => uniqueSelectedDrafts(drafts, selectedDraftIds),
    [drafts, selectedDraftIds],
  );
  const activeEditorDraft = useMemo(
    () => drafts.find((draft: ProductImportDraft) => draft.draftId === activeEditorDraftId) ?? null,
    [activeEditorDraftId, drafts],
  );
  const activePreviewDraft = useMemo(
    () => drafts.find((draft: ProductImportDraft) => draft.draftId === activePreviewDraftId) ?? null,
    [activePreviewDraftId, drafts],
  );
  const hasSelectedDraftErrors = selectedDrafts.some((draft: ProductImportDraft) => draft.validationErrors.length > 0);
  const brainSummary = useMemo(() => {
    const analysed: ProductImportDraft[] = drafts.filter((draft: ProductImportDraft) => draft.brain || draft.warnings.some((warning: string) => warning.startsWith("VLM Product Brain")));
    const sizes = Array.from(new Set(analysed.flatMap((draft: ProductImportDraft) => draft.brain?.detected.sizes ?? draft.product.variants.map((variant) => variant.size).filter(Boolean))));
    const garments = Array.from(
      new Set(
        analysed
          .map((draft: ProductImportDraft) => draft.brain?.detected.garmentType)
          .filter((tag: string | undefined): tag is string => Boolean(tag)),
      ),
    );
    const avgScore = analysed.length
      ? Math.round(analysed.reduce((sum: number, draft: ProductImportDraft) => sum + (draft.brain?.readiness.score ?? 0), 0) / analysed.length)
      : 0;
    const blocked = analysed.filter((draft: ProductImportDraft) => draft.brain?.readiness.level === "blocked").length;
    return { analysed: analysed.length, sizes, garments, avgScore, blocked };
  }, [drafts]);
  const brainCopy = locale === "pl"
    ? { title: "VLM Product Brain v2", body: "Czyta nazwę, opis, warianty, rozmiary, provider i cenę. Zdjęć nie ściąga — finalne media dodaje ręcznie operator. Potem układa nazwę, SEO, truth profile oraz gate publikacji: ready / review / blocked." }
    : locale === "de"
      ? { title: "VLM Product Brain v2", body: "Liest Titel, Beschreibung, Varianten, Größen, Provider und Preis. Bilder werden nicht importiert — finale Medien werden manuell ergänzt. Danach erstellt er Name, SEO, Truth Profile und Publish-Gate: ready / review / blocked." }
      : { title: "VLM Product Brain v2", body: "Reads title, description, variants, sizes, provider and price. It does not import images — final product media is added manually by the operator. Then it prepares garment name, SEO, truth profile and publish gate: ready / review / blocked." };

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const adminDraftScopeDigest = useMemo(
    () => token.trim() ? sha256Token(`admin-product-draft-scope:${token.trim()}`, 32) : "",
    [token],
  );

  useEffect(() => {
    purgeLegacyAdminProductDraftBrowserState();
    const timer = window.setTimeout(() => {
      if (!adminDraftScopeDigest) {
        setDrafts([]);
        setSelectedDraftIds([]);
        setActiveEditorDraftId(null);
        setActivePreviewDraftId(null);
        setMemoryLoaded(false);
        setMemoryState(null);
        return;
      }
      const snapshot = readAdminProductDraftCurrentTabState(adminDraftScopeDigest);
      if (snapshot) {
        const restored = normalizeImportedDraftIds(snapshot.drafts);
        const restoredIds = new Set(restored.map((draft: ProductImportDraft) => draft.draftId));
        const selected = uniqueIds(snapshot.selectedDraftIds).filter((id) => restoredIds.has(id));
        setDrafts(restored);
        setSelectedDraftIds(selected.length ? selected : uniqueIds(restored.map((draft: ProductImportDraft) => draft.draftId)));
        setMemoryState(simpleWords.cacheLoaded);
      } else {
        setDrafts([]);
        setSelectedDraftIds([]);
        setActiveEditorDraftId(null);
        setActivePreviewDraftId(null);
        setMemoryState(null);
      }
      setMemoryLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [adminDraftScopeDigest, simpleWords.cacheLoaded]);

  useEffect(() => {
    if (!memoryLoaded || !adminDraftScopeDigest) return;
    const result = drafts.length
      ? writeAdminProductDraftCurrentTabState({
          scopeDigest: adminDraftScopeDigest,
          drafts,
          selectedDraftIds: uniqueIds(selectedDraftIds),
        })
      : null;
    if (!drafts.length) {
      clearAdminProductDraftCurrentTabState(adminDraftScopeDigest);
      queueMicrotask(() => setMemoryState(null));
      return;
    }
    queueMicrotask(() => setMemoryState(result?.stored ? simpleWords.autoSaved : simpleWords.cacheFull));
  }, [adminDraftScopeDigest, drafts, memoryLoaded, selectedDraftIds, simpleWords.autoSaved, simpleWords.cacheFull]);

  const runImport = async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const endpoint =
        activeTab === "printful"
          ? "/api/admin/sync-printful"
          : "/api/admin/import-products";
      const body =
        activeTab === "links"
          ? { method: "links", urls }
          : activeTab === "csv"
            ? { method: "csv", csv }
            : {};

      const response = await fetchSameOriginWithDeadline(endpoint, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      }, { timeoutMs: 15_000, operation: "admin_product_import" });
      const result = await readApiJson(response);
      if (!result.ok || !response.ok) {
        reportBrowserBoundaryFailure({
          event: "admin_product_import_response_rejected",
          error: new Error(result.ok ? "product_import_unavailable" : result.code),
        });
        throw new Error("product_import_unavailable");
      }
      const data = result.value;
      const importedDrafts = normalizeImportedDraftIds(Array.isArray(data.drafts) ? (data.drafts as ProductImportDraft[]) : []);
      setDrafts((current: ProductImportDraft[]) => {
        const mergedDrafts = mergeImportedDrafts(current, importedDrafts);
        setSelectedDraftIds(uniqueIds(mergedDrafts.map((draft: ProductImportDraft) => draft.draftId)));
        return mergedDrafts;
      });
      setMessage(data.persisted ? t("persisted") : t("previewOnly"));
    } catch (error) {
      reportBrowserBoundaryFailure({ event: "admin_product_import_request_failed", error });
      setMessage(t("importFailed"));
    } finally {
      setStatus("idle");
    }
  };

  const openPublishDecision = (targetStatus: ProductPublishTargetStatus) => {
    setPendingPublishStatus(targetStatus);
    setMessage(null);
  };

  const handlePublishCommitted = (reviewedDrafts: ProductImportDraft[], nextMessage: string) => {
    if (reviewedDrafts.length) {
      setDrafts((current: ProductImportDraft[]) =>
        current.map((draft: ProductImportDraft) => reviewedDrafts.find((reviewed: ProductImportDraft) => reviewed.draftId === draft.draftId) ?? draft),
      );
    }
    const shopHint = locale === "pl" ? ` Sprawdź sklep: /${locale}/shop.` : locale === "de" ? ` Shop prüfen: /${locale}/shop.` : ` Check shop: /${locale}/shop.`;
    setMessage(`${nextMessage || t("publishValidated")}${shopHint}`);
  };

  const handleCsv = async (event: AdminFileInputChangeEvent) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  };

  const clearLocalDrafts = () => {
    if (adminDraftScopeDigest) clearAdminProductDraftCurrentTabState(adminDraftScopeDigest);
    purgeLegacyAdminProductDraftBrowserState();
    setDrafts([]);
    setSelectedDraftIds([]);
    setActiveEditorDraftId(null);
    setActivePreviewDraftId(null);
    setMemoryState(null);
    setMessage(locale === "pl" ? "Drafty bieżącej karty wyczyszczone." : locale === "de" ? "Drafts des aktuellen Tabs gelöscht." : "Current-tab drafts cleared.");
  };

  const updateDraft = (updatedDraft: ProductImportDraft) => {
    setDrafts((current: ProductImportDraft[]) => current.map((draft: ProductImportDraft) => (draft.draftId === updatedDraft.draftId ? updatedDraft : draft)));
  };

  const recheckProductBrain = async (draftId: string) => {
    const draft = drafts.find((item: ProductImportDraft) => item.draftId === draftId);
    if (!draft || !token) return;
    setStatus("rechecking");
    setMessage(null);
    try {
      const response = await fetchSameOriginWithDeadline("/api/admin/products/brain-review", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ drafts: [draft] }),
      }, { timeoutMs: 15_000, operation: "admin_product_brain_review" });
      const result = await readApiJson(response);
      if (!result.ok || !response.ok) {
        reportBrowserBoundaryFailure({
          event: "admin_product_brain_response_rejected",
          error: new Error(result.ok ? "product_brain_unavailable" : result.code),
        });
        throw new Error("product_brain_unavailable");
      }
      const data = result.value;
      const reviewed = (Array.isArray(data.drafts) ? data.drafts : []) as ProductImportDraft[];
      if (reviewed[0]) updateDraft(reviewed[0]);
      const summary = (data.summary ?? {}) as { ready?: number; review?: number; blocked?: number };
      setMessage(`VLM Product Brain re-check: ${summary.ready ?? 0} ready / ${summary.review ?? 0} review / ${summary.blocked ?? 0} blocked.`);
    } catch (error) {
      reportBrowserBoundaryFailure({ event: "admin_product_brain_request_failed", error });
      setMessage("Product Brain review failed.");
    } finally {
      setStatus("idle");
    }
  };

  if (!adminEnvironmentGate.isUnlocked) {
    return (
      <main className="min-h-[100dvh] bg-velmere-black text-white">
        <LuxurySection className="py-24 md:py-32">
          <AdminToolsLockedPanel locale={locale} gate={adminEnvironmentGate} />
        </LuxurySection>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-velmere-black text-white">
      <LuxurySection className="py-28 md:py-36">
        <section className="mb-8 rounded-[1.6rem] border border-white/[0.10] bg-white/[0.035] p-5 md:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{simpleCopy.kicker}</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <h1 className="font-serif text-4xl leading-tight text-white md:text-6xl">{simpleCopy.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.58]">{simpleCopy.body}</p>
            </div>
            <div className="grid gap-2 text-[11px] uppercase tracking-[0.14em] text-white/[0.50] sm:grid-cols-2">
              {simpleCopy.steps.map((step) => (
                <span key={step} className="rounded-2xl border border-white/[0.08] bg-black/[0.24] px-4 py-3">{step}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <aside className="rounded-lg border border-white/[0.10] bg-white/[0.035] p-5">
            <label htmlFor="admin-token" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.58]">
              {t("token")}
            </label>
            <input
              id="admin-token"
              type="password"
              value={token}
              onChange={(event: AdminTextChangeEvent) => setToken(event.target.value)}
              className="mt-3 h-12 w-full rounded-lg border border-white/[0.10] bg-black/[0.35] px-4 text-sm text-white outline-none focus:border-velmere-gold"
            />
            <p className="mt-3 text-xs leading-5 text-white/[0.42]">{simpleCopy.ownerNote}</p>
            <div className="mt-4 rounded-2xl border border-emerald-300/[0.14] bg-emerald-500/[0.045] p-3 text-xs leading-5 text-emerald-50/[0.68]">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-100/[0.72]">{simpleWords.memory}</p>
              <p className="mt-1">{memoryState ?? simpleWords.autoSaved}</p>
            </div>
            <button
              type="button"
              onClick={clearLocalDrafts}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-white/[0.10] px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.50] transition hover:border-red-200/[0.28] hover:text-red-50"
            >
              {simpleWords.clearLocal}
            </button>

            <div className="mt-6 grid gap-2">
              {TABS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex min-h-12 items-center justify-between rounded-lg border px-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                    activeTab === id
                      ? "border-velmere-gold bg-velmere-gold text-black"
                      : "border-white/[0.10] text-white/[0.58] hover:border-white/[0.25] hover:text-white"
                  }`}
                >
                  {t(`tabs.${id}`)}
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-lg border border-white/[0.10] bg-white/[0.035] p-5 md:p-6">
            {activeTab === "links" && (
              <div>
                <label htmlFor="product-links" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.58]">
                  {t("linksLabel")}
                </label>
                <textarea
                  id="product-links"
                  value={urls}
                  onChange={(event: AdminTextChangeEvent) => setUrls(event.target.value)}
                  rows={8}
                  placeholder={t("linksPlaceholder")}
                  className="mt-3 w-full rounded-lg border border-white/[0.10] bg-black/[0.35] p-4 text-sm leading-7 text-white outline-none placeholder:text-white/[0.28] focus:border-velmere-gold"
                />
                <div className="mt-4 rounded-lg border border-white/[0.10] bg-black/[0.25] p-4 text-sm leading-7 text-white/[0.58]">
                  {t("tapstitchBody")}
                </div>
              </div>
            )}

            {activeTab === "printful" && (
              <div className="rounded-lg border border-white/[0.10] bg-black/[0.25] p-5 text-sm leading-7 text-white/[0.62]">
                {t("printfulBody")}
              </div>
            )}

            {activeTab === "csv" && (
              <div>
                <label htmlFor="csv-upload" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.58]">
                  {t("csvLabel")}
                </label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsv}
                  className="mt-3 block w-full rounded-lg border border-white/[0.10] bg-black/[0.35] p-4 text-sm text-white/[0.62]"
                />
                <textarea
                  value={csv}
                  onChange={(event: AdminTextChangeEvent) => setCsv(event.target.value)}
                  rows={8}
                  placeholder={t("csvPlaceholder")}
                  className="mt-4 w-full rounded-lg border border-white/[0.10] bg-black/[0.35] p-4 text-sm leading-7 text-white outline-none placeholder:text-white/[0.28] focus:border-velmere-gold"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={runImport}
                disabled={!adminEnvironmentGate.isUnlocked || isBusy || !token}
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition-colors hover:bg-velmere-gold disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/[0.34]"
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("import")}
              </button>
              <button
                type="button"
                onClick={() => openPublishDecision("coming_soon")}
                disabled={!adminEnvironmentGate.isUnlocked || isBusy || selectedDrafts.length === 0 || !token}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.12] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.62] transition-colors hover:border-white/[0.25] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("publishComingSoon")}
              </button>
              <button
                type="button"
                onClick={() => openPublishDecision("active")}
                disabled={!adminEnvironmentGate.isUnlocked || isBusy || selectedDrafts.length === 0 || hasSelectedDraftErrors || !token}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-velmere-gold/[0.35] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-velmere-gold transition-colors hover:bg-velmere-gold hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("publishActive")}
              </button>
              <Link
                href={`/${locale}/shop`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.12] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.62] transition-colors hover:border-velmere-gold/[0.30] hover:text-velmere-gold"
              >
                Open shop preview
              </Link>
              <Link
                href={`/${locale}/admin/orders`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-cyan-300/[0.20] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/[0.72] transition-colors hover:border-cyan-200/[0.36] hover:text-cyan-50"
              >
                Order timeline
              </Link>
            </div>

            {message && (
              <div className="mt-5 flex gap-3 rounded-lg border border-velmere-gold/[0.25] bg-velmere-gold/[0.08] p-4 text-sm leading-7 text-white/[0.70]">
                <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-velmere-gold" aria-hidden="true" />
                {message}
              </div>
            )}

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-lg border border-velmere-gold/[0.18] bg-velmere-gold/[0.055] p-4 text-sm leading-7 text-white/[0.64]">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{brainCopy.title}</p>
                <p className="mt-2">{brainCopy.body}</p>
                <div className="mt-4 grid gap-2 text-[11px] uppercase tracking-[0.16em] text-white/[0.46] sm:grid-cols-4">
                  <span>Drafts: {brainSummary.analysed}</span>
                  <span>Score: {brainSummary.avgScore || "-"}</span>
                  <span>Blocked: {brainSummary.blocked}</span>
                  <span>Sizes: {brainSummary.sizes.join("/") || "-"}</span>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-white/[0.42]">Types: {brainSummary.garments.join(", ") || "-"}</p>
              </div>
              <AiProductCopyButton token={token} drafts={selectedDrafts} />
            </div>
          </section>
        </section>

        <section className="mt-6 rounded-[1.35rem] border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{simpleWords.now}</p>
              <h2 className="mt-2 font-serif text-2xl text-white md:text-3xl">{drafts.length ? `${drafts.length} drafts · ${selectedDrafts.length} ${simpleWords.selected}` : "Sync Printful first"}</h2>
              <p className="mt-2 text-sm leading-6 text-white/[0.58]">{simpleWords.comingSoon}</p>
            </div>
            <div className="grid gap-2 text-xs leading-5 text-white/[0.60] md:grid-cols-3 lg:max-w-3xl">
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-3"><b className="text-white">1 · {simpleWords.addPhotos}</b><br />{simpleWords.addPhotosHelp}</div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-3"><b className="text-white">2 · {simpleWords.recheck}</b><br />{simpleWords.recheckHelp}</div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-3"><b className="text-white">3 · {simpleWords.publish}</b><br />{simpleWords.publishHelp}</div>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[1.35rem] border border-white/[0.10] bg-white/[0.035]">
          <div className="flex flex-col gap-3 border-b border-white/[0.10] p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/[0.36]">simple product list</p>
              <h2 className="mt-1 font-serif text-3xl text-white">{t("previewTitle")}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDraftIds(uniqueIds(drafts.map((draft: ProductImportDraft) => draft.draftId)))}
                disabled={!drafts.length}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.12] px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.54] hover:border-white/[0.28] hover:text-white disabled:opacity-35"
              >
                {simpleWords.selectAll}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDraftIds([])}
                disabled={!selectedDraftIds.length}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/[0.12] px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.54] hover:border-white/[0.28] hover:text-white disabled:opacity-35"
              >
                {simpleWords.unselectAll}
              </button>
              <Link
                href={`/${locale}/shop`}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-velmere-gold/[0.28] px-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-velmere-gold hover:bg-velmere-gold hover:text-black"
              >
                {simpleWords.shop}
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="border-b border-white/[0.10] bg-black/[0.18] text-[10px] uppercase tracking-[0.18em] text-white/[0.38]">
                <tr>
                  <th className="w-12 p-4">✓</th>
                  <th className="p-4">{simpleWords.product}</th>
                  <th className="p-4">{simpleWords.photos}</th>
                  <th className="p-4">{simpleWords.brain}</th>
                  <th className="p-4">{simpleWords.missing}</th>
                  <th className="p-4">{simpleWords.next}</th>
                  <th className="p-4">{simpleWords.actions}</th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/[0.42]">
                      {t("emptyPreview")}
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft: ProductImportDraft, draftIndex: number) => {
                    const selected = selectedDraftIds.includes(draft.draftId);
                    const rowKey = `${draft.draftId}:${draft.product.providerProductId ?? draft.product.slug ?? draft.product.id}:${draftIndex}`;
                    const title = getLocalizedString(draft.product.title, locale as "pl" | "en" | "de") || getLocalizedString(draft.product.title, "pl");
                    const firstImage = draft.product.images[0];
                    const visibleIssues = [
                      ...((draft.brain?.readiness.missing ?? []).map((item) => item.label)),
                      ...draft.validationErrors,
                    ].filter(Boolean).slice(0, 3);
                    const allIssues = [...draft.warnings, ...draft.validationErrors];
                    const issueText = visibleIssues.length ? visibleIssues : [getMainProductIssue(draft, locale)];
                    const actionState = getDraftActionState(draft, locale);
                    return (
                      <tr key={rowKey} className="border-b border-white/[0.08] align-top text-white/[0.66] hover:bg-white/[0.025]">
                        <td className="p-4">
                          <input
                            aria-label={`Select ${title}`}
                            type="checkbox"
                            checked={selected}
                            onChange={(event: AdminCheckboxChangeEvent) =>
                              setSelectedDraftIds((current: string[]) =>
                                event.target.checked
                                  ? uniqueIds([...current, draft.draftId])
                                  : current.filter((id: string) => id !== draft.draftId),
                              )
                            }
                          />
                        </td>
                        <td className="p-4">
                          <div className="max-w-[18rem]">
                            <p className="font-semibold text-white">{title}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">
                              <span className="rounded-full border border-white/[0.10] px-2.5 py-1 text-white/[0.48]">{draft.product.provider}</span>
                              <span className="rounded-full border border-white/[0.10] px-2.5 py-1 text-white/[0.48]">{draft.product.price.amount ? formatMoney(draft.product.price, "pl") : "-"}</span>
                              <span className="rounded-full border border-white/[0.10] px-2.5 py-1 text-white/[0.48]">{draft.product.variants.length} sizes</span>
                            </div>
                            <p className="mt-2 text-xs text-white/[0.42]">{getProductFitLabel(draft.product, locale)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {firstImage?.url ? (
                              <div className="h-20 w-16 overflow-hidden rounded-xl bg-black/[0.28]">
                                <Image src={firstImage.url} alt={getLocalizedString(firstImage.alt, "pl")} width={96} height={120} unoptimized className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="flex h-20 w-16 items-center justify-center rounded-xl border border-red-300/[0.18] bg-red-500/[0.045] text-red-100/[0.70]">
                                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                              </div>
                            )}
                            <div>
                              <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${draft.product.images.length ? "text-emerald-100/[0.72]" : "text-red-100/[0.72]"}`}>{draft.product.images.length}/4</p>
                              <p className="mt-1 max-w-[8rem] text-xs leading-5 text-white/[0.44]">{draft.product.images.length ? simpleWords.firstPhoto : simpleWords.noPhoto}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.16em] ${draft.brain?.readiness.level === "blocked" ? "border-red-300/[0.28] text-red-100/[0.74]" : draft.brain?.readiness.level === "ready" ? "border-emerald-300/[0.28] text-emerald-100/[0.74]" : "border-velmere-gold/[0.26] text-velmere-gold"}`}>
                              {draft.brain?.readiness.level ?? "review"} · {draft.brain?.readiness.score ?? "-"}/100
                            </span>
                            <p className="text-xs leading-5 text-white/[0.42]">{draft.brain?.detected.garmentType ?? "type?"} · {draft.brain?.detected.sizes.join("/") || "sizes?"}</p>
                          </div>
                        </td>
                        <td className="max-w-[18rem] p-4">
                          <div className="space-y-2">
                            {issueText.map((issue, issueIndex) => (
                              <p key={`${rowKey}:issue:${issueIndex}`} className="rounded-xl border border-white/[0.08] bg-black/[0.20] px-3 py-2 text-xs leading-5 text-white/[0.58]">{issue}</p>
                            ))}
                            {allIssues.length > 0 ? (
                              <details className="text-xs text-white/[0.42]">
                                <summary className="cursor-pointer text-velmere-gold/[0.78]">{simpleWords.showDetails}</summary>
                                <div className="mt-2 space-y-1 leading-5">
                                  {allIssues.map((warning: string, warningIndex: number) => <p key={`${rowKey}:warning:${warningIndex}:${warning.slice(0, 48)}`}>{warning}</p>)}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className={`max-w-[13rem] rounded-2xl border p-3 ${actionState.tone}`}>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Step {actionState.step}</p>
                            <p className="mt-1 font-semibold text-white">{actionState.label}</p>
                            <p className="mt-2 text-xs leading-5 opacity-75">{actionState.help}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex min-w-[10rem] flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveEditorDraftId(draft.draftId)}
                              className="inline-flex h-10 items-center justify-center rounded-full bg-velmere-gold px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-black hover:bg-white"
                            >
                              {simpleWords.edit}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActivePreviewDraftId(draft.draftId)}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/[0.12] px-4 text-[10px] uppercase tracking-[0.16em] text-white/[0.62] hover:border-velmere-gold/[0.30] hover:text-velmere-gold"
                            >
                              {simpleWords.preview}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-4" data-admin-gate-launch-control-notice="visible">
          <div className="rounded-[1.4rem] border border-cyan-300/[0.14] bg-cyan-400/[0.045] p-4 text-xs leading-6 text-cyan-50/[0.66]">
            {adminGateCopy}: import, publish and customer export surfaces stay behind admin/session, route, mutation-audit, idempotency and support-safe timeline gates before production launch.
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <OrderEventLedgerPanel locale={locale} surface="admin" />
            <AdminRouteGatePanel locale={locale} surface="admin" />
            <AdminServerAuthContractPanel locale={locale} surface="admin" />
            <PublishPermissionGatePanel locale={locale} surface="admin" />
            <SecretRedactionPolicyPanel locale={locale} surface="admin" />
            <AdminMutationAuditPanel locale={locale} surface="admin" />
            <AdminAuditPersistencePanel locale={locale} surface="admin" />
            <PublishRollbackContextPanel locale={locale} surface="admin" />
            <SupportSafeTimelinePanel locale={locale} surface="admin" />
            <AdminAuditWriteApiPanel locale={locale} surface="admin" />
            <CustomerSafeExportBoundaryPanel locale={locale} surface="admin" />
            <AdminAuthSessionGuardPanel locale={locale} surface="admin" />
            <AdminIdempotencyStorePanel locale={locale} surface="admin" />
          </div>
        </section>

        {activeEditorDraft && (
          <VlmProductBrainEditor
            draft={activeEditorDraft}
            locale={locale}
            busy={status === "rechecking"}
            onChange={updateDraft}
            onClose={() => setActiveEditorDraftId(null)}
            onRecheck={recheckProductBrain}
          />
        )}

        {activePreviewDraft && (
          <VlmProductCustomerPreview
            draft={activePreviewDraft}
            locale={locale}
            onClose={() => setActivePreviewDraftId(null)}
          />
        )}

        {pendingPublishStatus && (
          <VlmProductPublishDecisionModal
            token={token}
            drafts={selectedDrafts}
            locale={locale}
            targetStatus={pendingPublishStatus}
            onClose={() => setPendingPublishStatus(null)}
            onCommitted={handlePublishCommitted}
          />
        )}

      </LuxurySection>
    </main>
  );
}
