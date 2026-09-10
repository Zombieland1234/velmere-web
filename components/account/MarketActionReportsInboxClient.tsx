"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { copyPrivateAccountArtifactSummary } from "@/lib/security/browser-system-clipboard";
import { resolveServerArtifactStatus } from "@/lib/account/server-artifact-response";
import {
  clearPrivateAccountTabStore,
  getPrivateAccountTabStoreSnapshot,
  purgeLegacyPrivateAccountLocalStorage,
  readPrivateAccountTabArray,
  subscribePrivateAccountTabStore,
  writePrivateAccountTabArray,
} from "@/lib/account/private-account-ephemeral-store";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Eye,
  FileText,
  RefreshCw,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "next-intl";

type SupportedLocale = "pl" | "en" | "de";

type VaultBridgeLane = { lane?: string; state?: string; proof?: string };

type Pass4549ReviewStatus = "acknowledged" | "operator-review" | "export-ready";

type Pass4549ReviewEntry = {
  schema: "velmere.pass4549.account-report-review-state.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  status: Pass4549ReviewStatus;
  queuedAt: string;
  digest: string;
  boundary: string;
  lanes: VaultBridgeLane[];
  serverAck?: string;
};

type Pass4550PackageStatus =
  "pdf-ready" | "operator-review-required" | "metadata-only-fallback";

type Pass4550PdfPackageEntry = {
  schema: "velmere.pass4550.account-report-pdf-package.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  operatorQueue: string;
  status: Pass4550PackageStatus;
  generatedAt: string;
  digest: string;
  reviewStatus: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4551PackageDeliveryStatus =
  | "package-ready"
  | "operator-review-required"
  | "release-queued"
  | "client-fallback";

type Pass4551PackageDeliveryEntry = {
  schema: "velmere.pass4551.account-report-package-delivery.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseRoute: string;
  status: Pass4551PackageDeliveryStatus;
  generatedAt: string;
  digest: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4552AccountReleaseStatus =
  | "release-ready"
  | "operator-review-required"
  | "account-release-queued"
  | "client-fallback";

type Pass4552AccountReleaseEntry = {
  schema: "velmere.pass4552.account-report-release-gate.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  status: Pass4552AccountReleaseStatus;
  generatedAt: string;
  digest: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4553CustomerReceiptStatus =
  | "customer-visible-ready"
  | "operator-review-required"
  | "release-pending"
  | "client-fallback";

type Pass4553CustomerReceiptEntry = {
  schema: "velmere.pass4553.account-customer-release-receipt.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  status: Pass4553CustomerReceiptStatus;
  generatedAt: string;
  digest: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4554DownloadManifestStatus =
  | "download-manifest-ready"
  | "operator-review-required"
  | "customer-release-pending"
  | "client-fallback";

type Pass4554DownloadManifestEntry = {
  schema: "velmere.pass4554.account-download-manifest.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  status: Pass4554DownloadManifestStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4555DownloadAccessStatus =
  | "access-token-ready"
  | "operator-review-required"
  | "download-manifest-pending"
  | "client-fallback";

type Pass4555DownloadAccessEntry = {
  schema: "velmere.pass4555.account-download-access-capsule.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  accessCapsuleId: string;
  accessRoute: string;
  accessTokenId: string;
  expiresAt: string;
  consumptionPolicy: string;
  status: Pass4555DownloadAccessStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4556DownloadConsumptionStatus =
  | "download-consumed"
  | "operator-review-required"
  | "access-expired"
  | "access-pending"
  | "client-fallback";

type Pass4556DownloadConsumptionEntry = {
  schema: "velmere.pass4556.account-download-consumption-ledger.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  accessCapsuleId: string;
  accessRoute: string;
  accessTokenId: string;
  expiresAt: string;
  consumptionPolicy: string;
  consumptionId: string;
  consumedAt: string;
  downloadSessionId: string;
  downloadAuditHash: string;
  status: Pass4556DownloadConsumptionStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4557DownloadCloseoutStatus =
  | "download-closed"
  | "operator-review-required"
  | "consumption-pending"
  | "session-revoked"
  | "client-fallback";

type Pass4557DownloadCloseoutEntry = {
  schema: "velmere.pass4557.account-download-closeout-receipt.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  accessCapsuleId: string;
  accessRoute: string;
  accessTokenId: string;
  expiresAt: string;
  consumptionPolicy: string;
  consumptionId: string;
  consumedAt: string;
  downloadSessionId: string;
  downloadAuditHash: string;
  closeoutId: string;
  closedAt: string;
  sessionFinalizedHash: string;
  revokePolicy: string;
  status: Pass4557DownloadCloseoutStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4558PostCloseoutAttestationStatus =
  | "post-closeout-attested"
  | "operator-review-required"
  | "closeout-pending"
  | "client-fallback";

type Pass4558PostCloseoutAttestationEntry = {
  schema: "velmere.pass4558.account-post-closeout-attestation.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  accessCapsuleId: string;
  accessRoute: string;
  accessTokenId: string;
  consumptionId: string;
  downloadSessionId: string;
  closeoutId: string;
  sessionFinalizedHash: string;
  attestationId: string;
  attestedAt: string;
  publicProofPointer: string;
  archiveRoute: string;
  retentionPolicy: string;
  status: Pass4558PostCloseoutAttestationStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};

type Pass4559PublicProofIndexStatus =
  | "public-proof-indexed"
  | "operator-review-required"
  | "attestation-pending"
  | "client-fallback";

type Pass4559PublicProofIndexEntry = {
  schema: "velmere.pass4559.account-public-proof-index.v1";
  source: InboxReportEntry["source"];
  symbol: string;
  timeframe: string;
  vaultPointer: string;
  packageId: string;
  pdfPointer: string;
  deliveryId: string;
  releaseId: string;
  releasePointer: string;
  customerReceiptId: string;
  customerRoute: string;
  downloadPointer: string;
  downloadManifestId: string;
  downloadRoute: string;
  accessCapsuleId: string;
  accessRoute: string;
  accessTokenId: string;
  consumptionId: string;
  downloadSessionId: string;
  closeoutId: string;
  sessionFinalizedHash: string;
  attestationId: string;
  publicProofPointer: string;
  archiveRoute: string;
  publicIndexId: string;
  indexedAt: string;
  transparencyRoute: string;
  proofDigest: string;
  redactionPolicy: string;
  status: Pass4559PublicProofIndexStatus;
  generatedAt: string;
  digest: string;
  checksum: string;
  reviewGate: string;
  boundary: string;
  lanes: VaultBridgeLane[];
};


type VaultBridgeEntry = {
  schema?: string;
  source?: string;
  symbol?: string;
  timeframe?: string;
  deliveryState?: string;
  vaultPointer?: string;
  accountRoute?: string;
  digest?: string;
  serverStored?: boolean;
  boundary?: string;
  lanes?: VaultBridgeLane[];
};

type ComposerDraftEntry = {
  schema?: string;
  symbol?: string;
  timeframe?: string;
  draftState?: string;
  actionCount?: number;
  readyCount?: number;
  reviewCount?: number;
  generatedAt?: string;
  boundary?: string;
};

type InboxReportEntry = {
  key: string;
  source: "asset-detail" | "shield-pro";
  schema: string;
  symbol: string;
  timeframe: string;
  deliveryState: string;
  vaultPointer: string;
  accountRoute: string;
  digest: string;
  serverStored: boolean;
  boundary: string;
  lanes: VaultBridgeLane[];
  draft?: ComposerDraftEntry;
};

const STORAGE_KEYS = {
  assetBridge: "velmere:pass4547:asset-report-vault-bridge",
  shieldProBridge: "velmere:pass4547:shield-pro-report-vault-bridge",
  assetDraft: "velmere:pass4546:asset-report-composer",
  shieldProDraft: "velmere:pass4546:shield-pro-terminal-report-composer",
  reviewState: "velmere:pass4549:account-report-review-state",
  pdfPackage: "velmere:pass4550:account-report-pdf-package",
  packageDelivery: "velmere:pass4551:account-report-package-delivery",
  accountRelease: "velmere:pass4552:account-report-release-gate",
  customerReceipt: "velmere:pass4553:account-customer-release-receipt",
  downloadManifest: "velmere:pass4554:account-download-manifest",
  downloadAccess: "velmere:pass4555:account-download-access-capsule",
  downloadConsumption: "velmere:pass4556:account-download-consumption-ledger",
  downloadCloseout: "velmere:pass4557:account-download-closeout-receipt",
  postCloseoutAttestation: "velmere:pass4558:account-post-closeout-attestation",
  publicProofIndex: "velmere:pass4559:account-public-proof-index",
} as const;

const INBOX_SYNC_EVENTS = [
  "velmere:pass4546-asset-report-composer",
  "velmere:pass4546-shield-pro-report-composer",
  "velmere:pass4547-asset-report-vault-bridge",
  "velmere:pass4547-shield-pro-report-vault-bridge",
  "velmere:pass4549-account-report-review-state",
  "velmere:pass4550-account-report-pdf-package",
  "velmere:pass4551-account-report-package-delivery",
  "velmere:pass4552-account-report-release-gate",
  "velmere:pass4553-account-customer-release-receipt",
  "velmere:pass4554-account-download-manifest",
  "velmere:pass4555-account-download-access-capsule",
  "velmere:pass4556-account-download-consumption-ledger",
  "velmere:pass4557-account-download-closeout-receipt",
  "velmere:pass4558-account-post-closeout-attestation",
  "velmere:pass4559-account-public-proof-index",
  "velmere:pass4825-account-inbox-refresh",
  "popstate",
] as const;

const SERVER_INBOX_SNAPSHOT = "server-inbox-snapshot";
let manualInboxRevision = 0;

function subscribeInboxSnapshot(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  purgeLegacyPrivateAccountLocalStorage();
  const unsubscribeTabStore = subscribePrivateAccountTabStore(onStoreChange);
  INBOX_SYNC_EVENTS.forEach((eventName) => window.addEventListener(eventName, onStoreChange));
  return () => {
    unsubscribeTabStore();
    INBOX_SYNC_EVENTS.forEach((eventName) => window.removeEventListener(eventName, onStoreChange));
  };
}

function getInboxSnapshot() {
  if (typeof window === "undefined") return SERVER_INBOX_SNAPSHOT;
  return [
    String(manualInboxRevision),
    window.location.search,
    getPrivateAccountTabStoreSnapshot(),
  ].join("\u001f");
}

function getServerInboxSnapshot() {
  return SERVER_INBOX_SNAPSHOT;
}

function requestInboxRefresh() {
  if (typeof window === "undefined") return;
  manualInboxRevision += 1;
  window.dispatchEvent(new Event("velmere:pass4825-account-inbox-refresh"));
}

const copy = {
  en: {
    kicker: "Account Vault",
    title: "Market reports inbox.",
    body: "Report Composer outputs from Shield, Real Markets and Shield Pro now land in one account console inbox. It reads current-tab draft metadata and server-confirmed vault pointers, highlights review gates and keeps paid unlock/trade execution separated.",
    refresh: "Refresh inbox",
    clear: "Clear inbox pointers",
    copied: "pointer copied",
    copy: "Copy pointer",
    emptyTitle: "No market report queued yet.",
    emptyBody:
      "Open Shield, Real Markets or Shield Pro, click an instrument, run an action and prepare a report. The vault bridge pointer will appear here.",
    total: "Reports",
    review: "Needs review",
    ready: "Vault ready",
    local: "Local only",
    source: "Source",
    state: "State",
    route: "Account route",
    digest: "Digest",
    lanes: "Delivery lanes",
    draft: "Draft",
    server: "Server stored",
    boundary: "Boundary",
    highlighted: "Requested vault",
    noDraft: "draft metadata not found",
    openDetail: "Open detail",
    detailTitle: "Report detail bridge",
    detailBody:
      "Review the vault pointer, draft state, delivery lanes and account handoff before PDF/operator export.",
    noSelection: "Select a report to inspect its account handoff.",
    acknowledge: "Acknowledge",
    queueReview: "Queue review",
    copyDetail: "Copy detail packet",
    reviewState: "Review state",
    reviewQueued: "review queued",
    acknowledged: "acknowledged",
    handoff: "Handoff",
    guardrail: "Guardrail",
    detailPacketCopied: "detail copied",
    pdfPackageTitle: "PDF / operator package",
    pdfPackageBody:
      "Build a metadata-only package from the selected report detail, review state and vault pointer before PDF/account export.",
    preparePdf: "Prepare PDF package",
    copyPdfPackage: "Copy PDF packet",
    pdfReady: "PDF ready",
    pdfReview: "Operator review required",
    pdfFallback: "client fallback",
    packageId: "Package ID",
    pdfPointer: "PDF pointer",
    operatorQueue: "Operator queue",
    noPdfPackage: "No PDF package prepared for this report yet.",
    pdfPackageCopied: "PDF packet copied",
    packageDeliveryTitle: "Package delivery checkpoint",
    packageDeliveryBody:
      "Sync the PDF/operator package into a delivery checkpoint before account release. Review-required packages stay blocked instead of pretending the PDF is finished.",
    syncDelivery: "Sync delivery checkpoint",
    copyDelivery: "Copy delivery checkpoint",
    deliveryReady: "Package ready",
    deliveryReview: "Operator review required",
    deliveryQueued: "Release queued",
    deliveryFallback: "client fallback",
    deliveryId: "Delivery ID",
    releaseRoute: "Release route",
    reviewGate: "Review gate",
    noPackageDelivery: "No delivery checkpoint synced for this package yet.",
    packageDeliveryCopied: "delivery copied",
    releaseGateTitle: "Account release gate",
    releaseGateBody:
      "Finalize the delivery checkpoint into an account-release receipt. Review-required packages stay blocked; ready packages receive a release pointer without paid unlock or trading execution.",
    syncRelease: "Sync release gate",
    copyRelease: "Copy release receipt",
    releaseReady: "Release ready",
    releaseReview: "Operator review required",
    releaseQueued: "Account release queued",
    releaseFallback: "client fallback",
    releaseId: "Release ID",
    releasePointer: "Release pointer",
    noAccountRelease:
      "No account release receipt synced for this delivery yet.",
    accountReleaseCopied: "release copied",
    customerReceiptTitle: "Customer release receipt",
    customerReceiptBody:
      "Turn the account release into a customer-visible receipt and download manifest. Review-required reports stay blocked, and the manifest remains metadata-only.",
    syncCustomerReceipt: "Prepare customer receipt",
    copyCustomerReceipt: "Copy customer receipt",
    customerReceiptReady: "Customer visible ready",
    customerReceiptReview: "Operator review required",
    customerReceiptPending: "Release pending",
    customerReceiptFallback: "client fallback",
    customerReceiptId: "Customer receipt ID",
    customerRoute: "Customer route",
    downloadPointer: "Download pointer",
    noCustomerReceipt:
      "No customer release receipt prepared for this release yet.",
    customerReceiptCopied: "customer receipt copied",
    downloadManifestTitle: "Download manifest gate",
    downloadManifestBody:
      "Confirm the customer receipt into a download manifest. Review-required or pending releases stay blocked; ready releases receive only a metadata pointer, checksum and account route.",
    syncDownloadManifest: "Prepare download manifest",
    copyDownloadManifest: "Copy download manifest",
    downloadManifestReady: "Download manifest ready",
    downloadManifestReview: "Operator review required",
    downloadManifestPending: "Customer release pending",
    downloadManifestFallback: "client fallback",
    downloadManifestId: "Download manifest ID",
    downloadRoute: "Download route",
    checksum: "Checksum",
    noDownloadManifest:
      "No download manifest prepared for this customer receipt yet.",
    downloadManifestCopied: "download manifest copied",
    downloadAccessTitle: "Download access capsule",
    downloadAccessBody:
      "Turns the metadata manifest into a short-lived access capsule. Review-required or pending manifests stay blocked; ready manifests receive only a route, token ID and consumption policy.",
    syncDownloadAccess: "Prepare access capsule",
    copyDownloadAccess: "Copy access capsule",
    downloadAccessReady: "Access token ready",
    downloadAccessReview: "Operator review required",
    downloadAccessPending: "Manifest pending",
    downloadAccessFallback: "client fallback",
    accessCapsuleId: "Access capsule ID",
    accessRoute: "Access route",
    accessTokenId: "Token ID",
    expiresAt: "Expires at",
    consumptionPolicy: "Consumption policy",
    noDownloadAccess:
      "No access capsule prepared for this download manifest yet.",
    downloadAccessCopied: "access capsule copied",
    consumptionTitle: "Download consumption ledger",
    consumptionBody:
      "Consumes a short-lived access capsule into a one-time download session receipt. Expired, pending or review-required capsules stay blocked; ready capsules only receive metadata proof, never a binary PDF claim.",
    consumeAccess: "Consume access capsule",
    copyConsumption: "Copy consumption ledger",
    consumptionReady: "Download session consumed",
    consumptionReview: "Operator review required",
    consumptionExpired: "Access expired",
    consumptionPending: "Access pending",
    consumptionFallback: "client fallback",
    consumptionId: "Consumption ID",
    consumedAt: "Consumed at",
    downloadSessionId: "Download session",
    downloadAuditHash: "Audit hash",
    noConsumption:
      "No download consumption ledger for this access capsule yet.",
    consumptionCopied: "consumption ledger copied",
    closeoutTitle: "Download closeout receipt",
    closeoutBody:
      "Finalizes a consumed download session into a closeout receipt. Review-required or pending sessions stay blocked; consumed sessions receive only metadata finalization and a revocation policy.",
    syncCloseout: "Finalize download closeout",
    copyCloseout: "Copy closeout receipt",
    closeoutReady: "Download closed",
    closeoutReview: "Operator review required",
    closeoutPending: "Consumption pending",
    closeoutRevoked: "Session revoked",
    closeoutFallback: "client fallback",
    closeoutId: "Closeout ID",
    closedAt: "Closed at",
    sessionFinalizedHash: "Finalized hash",
    revokePolicy: "Revoke policy",
    noCloseout: "No download closeout receipt for this consumption yet.",
    closeoutCopied: "closeout copied",
    attestationTitle: "Post-closeout attestation",
    attestationBody:
      "Seals a closed download session into a metadata-only proof index. Pending or review-required closeouts stay blocked; completed closeouts receive an attestation pointer, archive route and retention policy.",
    syncAttestation: "Seal attestation",
    copyAttestation: "Copy attestation",
    attestationReady: "Attested",
    attestationReview: "Operator review required",
    attestationPending: "Closeout pending",
    attestationFallback: "client fallback",
    attestationId: "Attestation ID",
    attestedAt: "Attested at",
    publicProofPointer: "Proof pointer",
    archiveRoute: "Archive route",
    retentionPolicy: "Retention policy",
    noAttestation: "No post-closeout attestation sealed for this download yet.",
    attestationCopied: "attestation copied",
    proofIndexTitle: "Public proof index",
    proofIndexBody:
      "Publishes the post-closeout attestation into a metadata-only transparency index. Review-required or pending attestations stay blocked; ready attestations expose only a redacted proof digest and route.",
    syncProofIndex: "Publish proof index",
    copyProofIndex: "Copy proof index",
    proofIndexReady: "Proof indexed",
    proofIndexReview: "Operator review required",
    proofIndexPending: "Attestation pending",
    proofIndexFallback: "client fallback",
    publicIndexId: "Public index ID",
    indexedAt: "Indexed at",
    transparencyRoute: "Transparency route",
    proofDigest: "Proof digest",
    redactionPolicy: "Redaction policy",
    noProofIndex: "No public proof index published for this attestation yet.",
    proofIndexCopied: "proof index copied",
  },
  pl: {
    kicker: "Account Vault",
    title: "Skrzynka raportów marketowych.",
    body: "Report Composer ze Shield, Real Markets i Shield Pro trafia teraz do jednej skrzynki konta. Panel czyta metadane vault bridge, pokazuje review gate i dalej oddziela paid unlock oraz trade execution.",
    refresh: "Odśwież skrzynkę",
    clear: "Wyczyść pointery",
    copied: "pointer skopiowany",
    copy: "Kopiuj pointer",
    emptyTitle: "Brak raportu w kolejce.",
    emptyBody:
      "Wejdź w Shield, Real Markets albo Shield Pro, kliknij instrument, wykonaj akcję i przygotuj report. Pointer vault bridge pojawi się tutaj.",
    total: "Raporty",
    review: "Wymaga review",
    ready: "Vault ready",
    local: "Tylko lokalnie",
    source: "Źródło",
    state: "Stan",
    route: "Trasa konta",
    digest: "Digest",
    lanes: "Delivery lanes",
    draft: "Draft",
    server: "Server stored",
    boundary: "Granica",
    highlighted: "Wybrany vault",
    noDraft: "brak metadanych draftu",
    openDetail: "Otwórz szczegóły",
    detailTitle: "Most szczegółów raportu",
    detailBody:
      "Sprawdź vault pointer, draft state, delivery lanes i handoff konta przed exportem PDF/operator.",
    noSelection: "Wybierz raport, żeby sprawdzić jego handoff w koncie.",
    acknowledge: "Potwierdź",
    queueReview: "Kolejka review",
    copyDetail: "Kopiuj detail packet",
    reviewState: "Stan review",
    reviewQueued: "review w kolejce",
    acknowledged: "potwierdzono",
    handoff: "Handoff",
    guardrail: "Guardrail",
    detailPacketCopied: "detail skopiowany",
    pdfPackageTitle: "Pakiet PDF / operator",
    pdfPackageBody:
      "Zbuduj metadata-only package z wybranych szczegółów raportu, review state i vault pointer przed exportem PDF/account.",
    preparePdf: "Przygotuj pakiet PDF",
    copyPdfPackage: "Kopiuj pakiet PDF",
    pdfReady: "PDF ready",
    pdfReview: "Wymaga operator review",
    pdfFallback: "client fallback",
    packageId: "Package ID",
    pdfPointer: "PDF pointer",
    operatorQueue: "Kolejka operatora",
    noPdfPackage: "Brak przygotowanego pakietu PDF dla tego raportu.",
    pdfPackageCopied: "pakiet PDF skopiowany",
    packageDeliveryTitle: "Checkpoint dostarczenia pakietu",
    packageDeliveryBody:
      "Synchronizuje pakiet PDF/operator do checkpointu dostarczenia przed release w koncie. Pakiety wymagające review zostają zablokowane zamiast udawać gotowy PDF.",
    syncDelivery: "Synchronizuj delivery checkpoint",
    copyDelivery: "Kopiuj delivery checkpoint",
    deliveryReady: "Pakiet ready",
    deliveryReview: "Wymaga operator review",
    deliveryQueued: "Release w kolejce",
    deliveryFallback: "client fallback",
    deliveryId: "Delivery ID",
    releaseRoute: "Release route",
    reviewGate: "Review gate",
    noPackageDelivery: "Brak delivery checkpointu dla tego pakietu.",
    packageDeliveryCopied: "delivery skopiowane",
    releaseGateTitle: "Brama release konta",
    releaseGateBody:
      "Domyka delivery checkpoint do receiptu release w koncie. Pakiety wymagające review zostają zablokowane; gotowe dostają release pointer bez paid unlock i bez trade execution.",
    syncRelease: "Synchronizuj release gate",
    copyRelease: "Kopiuj release receipt",
    releaseReady: "Release ready",
    releaseReview: "Wymaga operator review",
    releaseQueued: "Release konta w kolejce",
    releaseFallback: "client fallback",
    releaseId: "Release ID",
    releasePointer: "Release pointer",
    noAccountRelease: "Brak receiptu release dla tego delivery.",
    accountReleaseCopied: "release skopiowany",
    customerReceiptTitle: "Receipt release klienta",
    customerReceiptBody:
      "Zamienia release konta w receipt widoczny dla klienta i manifest pobrania. Raporty wymagające review zostają zablokowane, a manifest zostaje metadata-only.",
    syncCustomerReceipt: "Przygotuj receipt klienta",
    copyCustomerReceipt: "Kopiuj receipt klienta",
    customerReceiptReady: "Gotowe dla klienta",
    customerReceiptReview: "Wymaga operator review",
    customerReceiptPending: "Release pending",
    customerReceiptFallback: "client fallback",
    customerReceiptId: "Customer receipt ID",
    customerRoute: "Trasa klienta",
    downloadPointer: "Download pointer",
    noCustomerReceipt: "Brak receiptu release klienta dla tego release.",
    customerReceiptCopied: "receipt klienta skopiowany",
    downloadManifestTitle: "Brama manifestu pobrania",
    downloadManifestBody:
      "Potwierdza customer receipt do manifestu pobrania. Raporty review-required albo pending zostają zablokowane; gotowe dostają tylko metadata pointer, checksum i trasę konta.",
    syncDownloadManifest: "Przygotuj manifest pobrania",
    copyDownloadManifest: "Kopiuj manifest pobrania",
    downloadManifestReady: "Manifest pobrania ready",
    downloadManifestReview: "Wymaga operator review",
    downloadManifestPending: "Customer release pending",
    downloadManifestFallback: "client fallback",
    downloadManifestId: "Download manifest ID",
    downloadRoute: "Trasa pobrania",
    checksum: "Checksum",
    noDownloadManifest: "Brak manifestu pobrania dla tego customer receipt.",
    downloadManifestCopied: "manifest pobrania skopiowany",
    downloadAccessTitle: "Kapsuła dostępu do pobrania",
    downloadAccessBody:
      "Zamienia metadata manifest w krótkotrwałą kapsułę dostępu. Manifesty review-required albo pending zostają zablokowane; gotowe dostają tylko trasę, token ID i politykę użycia.",
    syncDownloadAccess: "Przygotuj kapsułę dostępu",
    copyDownloadAccess: "Kopiuj kapsułę dostępu",
    downloadAccessReady: "Token dostępu ready",
    downloadAccessReview: "Wymaga operator review",
    downloadAccessPending: "Manifest pending",
    downloadAccessFallback: "client fallback",
    accessCapsuleId: "Access capsule ID",
    accessRoute: "Access route",
    accessTokenId: "Token ID",
    expiresAt: "Wygasa",
    consumptionPolicy: "Polityka użycia",
    noDownloadAccess: "Brak kapsuły dostępu dla tego manifestu pobrania.",
    downloadAccessCopied: "kapsuła dostępu skopiowana",
    consumptionTitle: "Ledger użycia pobrania",
    consumptionBody:
      "Zużywa krótkotrwałą kapsułę dostępu do jednorazowego receipt sesji pobrania. Kapsuły expired, pending albo review-required zostają zablokowane; gotowe dostają tylko metadata proof, nigdy fake PDF binary.",
    consumeAccess: "Zużyj kapsułę dostępu",
    copyConsumption: "Kopiuj ledger użycia",
    consumptionReady: "Sesja pobrania zużyta",
    consumptionReview: "Wymaga operator review",
    consumptionExpired: "Access wygasł",
    consumptionPending: "Access pending",
    consumptionFallback: "client fallback",
    consumptionId: "Consumption ID",
    consumedAt: "Zużyto",
    downloadSessionId: "Sesja pobrania",
    downloadAuditHash: "Audit hash",
    noConsumption: "Brak ledgera użycia dla tej kapsuły dostępu.",
    consumptionCopied: "ledger użycia skopiowany",
    closeoutTitle: "Receipt zamknięcia pobrania",
    closeoutBody:
      "Domyka zużytą sesję pobrania do closeout receipt. Sesje review-required albo pending zostają zablokowane; zużyte sesje dostają tylko metadata finalization i politykę revocation.",
    syncCloseout: "Domknij closeout pobrania",
    copyCloseout: "Kopiuj closeout receipt",
    closeoutReady: "Pobranie zamknięte",
    closeoutReview: "Wymaga operator review",
    closeoutPending: "Consumption pending",
    closeoutRevoked: "Sesja revoked",
    closeoutFallback: "client fallback",
    closeoutId: "Closeout ID",
    closedAt: "Zamknięto",
    sessionFinalizedHash: "Finalized hash",
    revokePolicy: "Polityka revocation",
    noCloseout: "Brak closeout receipt dla tego użycia pobrania.",
    closeoutCopied: "closeout skopiowany",
    attestationTitle: "Attestacja po closeout",
    attestationBody:
      "Zamyka zakończoną sesję pobrania do metadata-only proof index. Closeouty pending albo review-required zostają zablokowane; domknięte pobrania dostają pointer attestacji, trasę archiwum i politykę retencji.",
    syncAttestation: "Zapieczętuj attestację",
    copyAttestation: "Kopiuj attestację",
    attestationReady: "Attested",
    attestationReview: "Wymaga operator review",
    attestationPending: "Closeout pending",
    attestationFallback: "client fallback",
    attestationId: "Attestation ID",
    attestedAt: "Attested at",
    publicProofPointer: "Proof pointer",
    archiveRoute: "Archive route",
    retentionPolicy: "Polityka retencji",
    noAttestation: "Brak attestacji po closeout dla tego pobrania.",
    attestationCopied: "attestacja skopiowana",
    proofIndexTitle: "Publiczny indeks dowodu",
    proofIndexBody:
      "Publikuje attestację po closeout do metadata-only transparency index. Attestacje review-required albo pending zostają zablokowane; gotowe pokazują tylko zredagowany proof digest i trasę.",
    syncProofIndex: "Opublikuj proof index",
    copyProofIndex: "Kopiuj proof index",
    proofIndexReady: "Proof indexed",
    proofIndexReview: "Wymaga operator review",
    proofIndexPending: "Attestacja pending",
    proofIndexFallback: "client fallback",
    publicIndexId: "Public index ID",
    indexedAt: "Zindeksowano",
    transparencyRoute: "Trasa transparency",
    proofDigest: "Proof digest",
    redactionPolicy: "Polityka redakcji",
    noProofIndex: "Brak publicznego proof index dla tej attestacji.",
    proofIndexCopied: "proof index skopiowany",
  },
  de: {
    kicker: "Account Vault",
    title: "Market Reports Inbox.",
    body: "Report-Composer-Ausgaben aus Shield, Real Markets und Shield Pro landen jetzt in einer Account-Inbox. Das Panel liest Vault-Bridge-Metadaten, zeigt Review-Gates und trennt Paid Unlock sowie Trade Execution weiterhin ab.",
    refresh: "Inbox aktualisieren",
    clear: "Pointer löschen",
    copied: "Pointer kopiert",
    copy: "Pointer kopieren",
    emptyTitle: "Noch kein Market Report in der Queue.",
    emptyBody:
      "Öffne Shield, Real Markets oder Shield Pro, wähle ein Instrument, starte eine Aktion und bereite einen Report vor. Der Vault-Bridge-Pointer erscheint hier.",
    total: "Reports",
    review: "Review nötig",
    ready: "Vault ready",
    local: "Nur lokal",
    source: "Quelle",
    state: "Status",
    route: "Account Route",
    digest: "Digest",
    lanes: "Delivery Lanes",
    draft: "Draft",
    server: "Server stored",
    boundary: "Boundary",
    highlighted: "Angefragter Vault",
    noDraft: "Draft-Metadaten fehlen",
    openDetail: "Details öffnen",
    detailTitle: "Report Detail Bridge",
    detailBody:
      "Prüfe Vault Pointer, Draft-Status, Delivery Lanes und Account-Handoff vor PDF-/Operator-Export.",
    noSelection: "Wähle einen Report, um das Account-Handoff zu prüfen.",
    acknowledge: "Bestätigen",
    queueReview: "Review Queue",
    copyDetail: "Detail-Paket kopieren",
    reviewState: "Review-Status",
    reviewQueued: "Review queued",
    acknowledged: "bestätigt",
    handoff: "Handoff",
    guardrail: "Guardrail",
    detailPacketCopied: "Detail kopiert",
    pdfPackageTitle: "PDF-/Operator-Paket",
    pdfPackageBody:
      "Erstellt ein metadata-only Paket aus Report-Detail, Review-Status und Vault-Pointer vor PDF-/Account-Export.",
    preparePdf: "PDF-Paket vorbereiten",
    copyPdfPackage: "PDF-Paket kopieren",
    pdfReady: "PDF ready",
    pdfReview: "Operator Review nötig",
    pdfFallback: "Client fallback",
    packageId: "Package ID",
    pdfPointer: "PDF Pointer",
    operatorQueue: "Operator Queue",
    noPdfPackage: "Für diesen Report wurde noch kein PDF-Paket vorbereitet.",
    pdfPackageCopied: "PDF-Paket kopiert",
    packageDeliveryTitle: "Package Delivery Checkpoint",
    packageDeliveryBody:
      "Synchronisiert das PDF-/Operator-Paket in einen Delivery-Checkpoint vor dem Account-Release. Review-pflichtige Pakete bleiben blockiert statt als fertiges PDF zu erscheinen.",
    syncDelivery: "Delivery Checkpoint synchronisieren",
    copyDelivery: "Delivery Checkpoint kopieren",
    deliveryReady: "Paket ready",
    deliveryReview: "Operator Review nötig",
    deliveryQueued: "Release queued",
    deliveryFallback: "Client fallback",
    deliveryId: "Delivery ID",
    releaseRoute: "Release Route",
    reviewGate: "Review Gate",
    noPackageDelivery:
      "Für dieses Paket wurde noch kein Delivery Checkpoint synchronisiert.",
    packageDeliveryCopied: "Delivery kopiert",
    releaseGateTitle: "Account Release Gate",
    releaseGateBody:
      "Finalisiert den Delivery Checkpoint in einen Account-Release-Receipt. Review-pflichtige Pakete bleiben blockiert; bereite Pakete erhalten einen Release Pointer ohne Paid Unlock oder Trade Execution.",
    syncRelease: "Release Gate synchronisieren",
    copyRelease: "Release Receipt kopieren",
    releaseReady: "Release ready",
    releaseReview: "Operator Review erforderlich",
    releaseQueued: "Account Release in Queue",
    releaseFallback: "client fallback",
    releaseId: "Release ID",
    releasePointer: "Release Pointer",
    noAccountRelease:
      "Für diese Delivery wurde noch kein Account Release Receipt synchronisiert.",
    accountReleaseCopied: "Release kopiert",
    customerReceiptTitle: "Customer Release Receipt",
    customerReceiptBody:
      "Wandelt den Account Release in einen kundensichtbaren Receipt und ein Download-Manifest um. Review-pflichtige Reports bleiben blockiert; das Manifest bleibt metadata-only.",
    syncCustomerReceipt: "Customer Receipt vorbereiten",
    copyCustomerReceipt: "Customer Receipt kopieren",
    customerReceiptReady: "Customer visible ready",
    customerReceiptReview: "Operator Review erforderlich",
    customerReceiptPending: "Release pending",
    customerReceiptFallback: "client fallback",
    customerReceiptId: "Customer Receipt ID",
    customerRoute: "Customer Route",
    downloadPointer: "Download Pointer",
    noCustomerReceipt:
      "Für diesen Release wurde noch kein Customer Release Receipt vorbereitet.",
    customerReceiptCopied: "Customer Receipt kopiert",
    downloadManifestTitle: "Download-Manifest-Gate",
    downloadManifestBody:
      "Bestätigt den Customer Receipt in ein Download-Manifest. Review-pflichtige oder pending Releases bleiben blockiert; fertige Releases erhalten nur Metadata-Pointer, Checksumme und Account-Route.",
    syncDownloadManifest: "Download-Manifest vorbereiten",
    copyDownloadManifest: "Download-Manifest kopieren",
    downloadManifestReady: "Download Manifest ready",
    downloadManifestReview: "Operator Review erforderlich",
    downloadManifestPending: "Customer Release pending",
    downloadManifestFallback: "client fallback",
    downloadManifestId: "Download Manifest ID",
    downloadRoute: "Download Route",
    checksum: "Checksumme",
    noDownloadManifest:
      "Für diesen Customer Receipt wurde noch kein Download-Manifest vorbereitet.",
    downloadManifestCopied: "Download Manifest kopiert",
    downloadAccessTitle: "Download Access Capsule",
    downloadAccessBody:
      "Wandelt das Metadata-Manifest in eine kurzlebige Access Capsule um. Review-pflichtige oder pending Manifeste bleiben blockiert; fertige Manifeste erhalten nur Route, Token-ID und Consumption Policy.",
    syncDownloadAccess: "Access Capsule vorbereiten",
    copyDownloadAccess: "Access Capsule kopieren",
    downloadAccessReady: "Access Token ready",
    downloadAccessReview: "Operator Review erforderlich",
    downloadAccessPending: "Manifest pending",
    downloadAccessFallback: "client fallback",
    accessCapsuleId: "Access Capsule ID",
    accessRoute: "Access Route",
    accessTokenId: "Token ID",
    expiresAt: "Läuft ab",
    consumptionPolicy: "Consumption Policy",
    noDownloadAccess:
      "Für dieses Download-Manifest wurde noch keine Access Capsule vorbereitet.",
    downloadAccessCopied: "Access Capsule kopiert",
    consumptionTitle: "Download Consumption Ledger",
    consumptionBody:
      "Verbraucht eine kurzlebige Access Capsule in einen One-Time-Download-Session-Receipt. Abgelaufene, pending oder review-pflichtige Capsules bleiben blockiert; fertige Capsules erhalten nur Metadata-Proof, keinen Binary-PDF-Claim.",
    consumeAccess: "Access Capsule verbrauchen",
    copyConsumption: "Consumption Ledger kopieren",
    consumptionReady: "Download Session verbraucht",
    consumptionReview: "Operator Review erforderlich",
    consumptionExpired: "Access abgelaufen",
    consumptionPending: "Access pending",
    consumptionFallback: "client fallback",
    consumptionId: "Consumption ID",
    consumedAt: "Verbraucht am",
    downloadSessionId: "Download Session",
    downloadAuditHash: "Audit Hash",
    noConsumption:
      "Für diese Access Capsule gibt es noch keinen Consumption Ledger.",
    consumptionCopied: "Consumption Ledger kopiert",
    closeoutTitle: "Download Closeout Receipt",
    closeoutBody:
      "Finalisiert eine verbrauchte Download-Session in einen Closeout Receipt. Review-pflichtige oder pending Sessions bleiben blockiert; verbrauchte Sessions erhalten nur Metadata-Finalisierung und Revocation Policy.",
    syncCloseout: "Download Closeout finalisieren",
    copyCloseout: "Closeout Receipt kopieren",
    closeoutReady: "Download geschlossen",
    closeoutReview: "Operator Review erforderlich",
    closeoutPending: "Consumption pending",
    closeoutRevoked: "Session revoked",
    closeoutFallback: "client fallback",
    closeoutId: "Closeout ID",
    closedAt: "Geschlossen am",
    sessionFinalizedHash: "Finalized Hash",
    revokePolicy: "Revocation Policy",
    noCloseout: "Für diese Consumption gibt es noch keinen Closeout Receipt.",
    closeoutCopied: "Closeout kopiert",
    attestationTitle: "Post-Closeout-Attestation",
    attestationBody:
      "Versiegelt eine geschlossene Download-Session in einen metadata-only Proof-Index. Pending- oder review-pflichtige Closeouts bleiben blockiert; abgeschlossene Closeouts erhalten Attestation Pointer, Archivroute und Retention Policy.",
    syncAttestation: "Attestation versiegeln",
    copyAttestation: "Attestation kopieren",
    attestationReady: "Attested",
    attestationReview: "Operator Review erforderlich",
    attestationPending: "Closeout pending",
    attestationFallback: "client fallback",
    attestationId: "Attestation ID",
    attestedAt: "Attested at",
    publicProofPointer: "Proof Pointer",
    archiveRoute: "Archive Route",
    retentionPolicy: "Retention Policy",
    noAttestation: "Für diesen Download wurde noch keine Post-Closeout-Attestation versiegelt.",
    attestationCopied: "Attestation kopiert",
    proofIndexTitle: "Public Proof Index",
    proofIndexBody:
      "Publiziert die Post-Closeout-Attestation in einen metadata-only Transparency Index. Review-pflichtige oder pending Attestations bleiben blockiert; fertige Attestations zeigen nur redigierten Proof Digest und Route.",
    syncProofIndex: "Proof Index publizieren",
    copyProofIndex: "Proof Index kopieren",
    proofIndexReady: "Proof indexed",
    proofIndexReview: "Operator Review erforderlich",
    proofIndexPending: "Attestation pending",
    proofIndexFallback: "client fallback",
    publicIndexId: "Public Index ID",
    indexedAt: "Indexed at",
    transparencyRoute: "Transparency Route",
    proofDigest: "Proof Digest",
    redactionPolicy: "Redaction Policy",
    noProofIndex: "Für diese Attestation wurde noch kein Public Proof Index veröffentlicht.",
    proofIndexCopied: "Proof Index kopiert",
  },
} satisfies Record<SupportedLocale, Record<string, string>>;

function safeArrayFromStorage<T>(key: string): T[] {
  return readPrivateAccountTabArray<T>(key);
}

function entryKey(symbol: string, timeframe: string) {
  return `${symbol.toUpperCase()}::${timeframe.toUpperCase()}`;
}

function asSource(
  entry: VaultBridgeEntry,
  fallback: InboxReportEntry["source"],
): InboxReportEntry["source"] {
  const source = String(entry.source || "").toLowerCase();
  return source.includes("shield-pro") ? "shield-pro" : fallback;
}

function normalizeBridge(
  entry: VaultBridgeEntry,
  fallbackSource: InboxReportEntry["source"],
  draftMap: Map<string, ComposerDraftEntry>,
): InboxReportEntry | null {
  const symbol = String(entry.symbol || "")
    .trim()
    .toUpperCase();
  const timeframe = String(entry.timeframe || "")
    .trim()
    .toUpperCase();
  const vaultPointer = String(entry.vaultPointer || "").trim();
  if (!symbol || !timeframe || !vaultPointer) return null;
  const source = asSource(entry, fallbackSource);
  return {
    key: `${source}:${vaultPointer}`,
    source,
    schema: String(
      entry.schema || "velmere.pass4547.report-composer-vault-bridge.v1",
    ),
    symbol,
    timeframe,
    deliveryState: String(entry.deliveryState || "not-queued"),
    vaultPointer,
    accountRoute: String(
      entry.accountRoute || `/account?tab=reports&vault=${vaultPointer}`,
    ),
    digest: String(entry.digest || "digest-pending"),
    serverStored: Boolean(entry.serverStored),
    boundary: String(
      entry.boundary || "metadata-only-no-paid-unlock-no-trade-execution",
    ),
    lanes: Array.isArray(entry.lanes) ? entry.lanes : [],
    draft:
      draftMap.get(`${source}:${entryKey(symbol, timeframe)}`) ||
      draftMap.get(entryKey(symbol, timeframe)),
  };
}

function readInboxReports(): InboxReportEntry[] {
  const assetDrafts = safeArrayFromStorage<ComposerDraftEntry>(
    STORAGE_KEYS.assetDraft,
  );
  const shieldProDrafts = safeArrayFromStorage<ComposerDraftEntry>(
    STORAGE_KEYS.shieldProDraft,
  );
  const draftMap = new Map<string, ComposerDraftEntry>();
  for (const draft of assetDrafts) {
    if (draft.symbol && draft.timeframe) {
      draftMap.set(
        entryKey(String(draft.symbol), String(draft.timeframe)),
        draft,
      );
      draftMap.set(
        `asset-detail:${entryKey(String(draft.symbol), String(draft.timeframe))}`,
        draft,
      );
    }
  }
  for (const draft of shieldProDrafts) {
    if (draft.symbol && draft.timeframe) {
      draftMap.set(
        `shield-pro:${entryKey(String(draft.symbol), String(draft.timeframe))}`,
        draft,
      );
    }
  }

  const bridges = [
    ...safeArrayFromStorage<VaultBridgeEntry>(STORAGE_KEYS.assetBridge).map(
      (entry) => normalizeBridge(entry, "asset-detail", draftMap),
    ),
    ...safeArrayFromStorage<VaultBridgeEntry>(STORAGE_KEYS.shieldProBridge).map(
      (entry) => normalizeBridge(entry, "shield-pro", draftMap),
    ),
  ].filter(Boolean) as InboxReportEntry[];

  const seen = new Set<string>();
  return bridges
    .filter((entry) => {
      const unique = `${entry.source}:${entry.vaultPointer}`;
      if (seen.has(unique)) return false;
      seen.add(unique);
      return true;
    })
    .slice(0, 24);
}

function readReviewState(): Pass4549ReviewEntry[] {
  return safeArrayFromStorage<Pass4549ReviewEntry>(
    STORAGE_KEYS.reviewState,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4549.account-report-review-state.v1" &&
      Boolean(entry.vaultPointer),
  );
}

function persistReviewState(entry: Pass4549ReviewEntry) {
  if (typeof window === "undefined") return;
  const existing = readReviewState().filter(
    (item) => item.vaultPointer !== entry.vaultPointer,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.reviewState, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4549-account-report-review-state", {
      detail: entry,
    }),
  );
}

function readPdfPackageState(): Pass4550PdfPackageEntry[] {
  return safeArrayFromStorage<Pass4550PdfPackageEntry>(
    STORAGE_KEYS.pdfPackage,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4550.account-report-pdf-package.v1" &&
      Boolean(entry.vaultPointer),
  );
}

function persistPdfPackage(entry: Pass4550PdfPackageEntry) {
  if (typeof window === "undefined") return;
  const existing = readPdfPackageState().filter(
    (item) => item.vaultPointer !== entry.vaultPointer,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.pdfPackage, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4550-account-report-pdf-package", {
      detail: entry,
    }),
  );
}

function readPackageDeliveryState(): Pass4551PackageDeliveryEntry[] {
  return safeArrayFromStorage<Pass4551PackageDeliveryEntry>(
    STORAGE_KEYS.packageDelivery,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4551.account-report-package-delivery.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.packageId),
  );
}

function persistPackageDelivery(entry: Pass4551PackageDeliveryEntry) {
  if (typeof window === "undefined") return;
  const existing = readPackageDeliveryState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.packageId !== entry.packageId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.packageDelivery, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4551-account-report-package-delivery", {
      detail: entry,
    }),
  );
}

function readAccountReleaseState(): Pass4552AccountReleaseEntry[] {
  return safeArrayFromStorage<Pass4552AccountReleaseEntry>(
    STORAGE_KEYS.accountRelease,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4552.account-report-release-gate.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.deliveryId),
  );
}

function persistAccountRelease(entry: Pass4552AccountReleaseEntry) {
  if (typeof window === "undefined") return;
  const existing = readAccountReleaseState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.deliveryId !== entry.deliveryId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.accountRelease, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4552-account-report-release-gate", {
      detail: entry,
    }),
  );
}

function readCustomerReceiptState(): Pass4553CustomerReceiptEntry[] {
  return safeArrayFromStorage<Pass4553CustomerReceiptEntry>(
    STORAGE_KEYS.customerReceipt,
  ).filter(
    (entry) =>
      entry?.schema ===
        "velmere.pass4553.account-customer-release-receipt.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.releaseId),
  );
}

function persistCustomerReceipt(entry: Pass4553CustomerReceiptEntry) {
  if (typeof window === "undefined") return;
  const existing = readCustomerReceiptState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.releaseId !== entry.releaseId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.customerReceipt, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4553-account-customer-release-receipt", {
      detail: entry,
    }),
  );
}

function readDownloadManifestState(): Pass4554DownloadManifestEntry[] {
  return safeArrayFromStorage<Pass4554DownloadManifestEntry>(
    STORAGE_KEYS.downloadManifest,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4554.account-download-manifest.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.customerReceiptId),
  );
}

function persistDownloadManifest(entry: Pass4554DownloadManifestEntry) {
  if (typeof window === "undefined") return;
  const existing = readDownloadManifestState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.customerReceiptId !== entry.customerReceiptId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.downloadManifest, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4554-account-download-manifest", {
      detail: entry,
    }),
  );
}

function readDownloadAccessState(): Pass4555DownloadAccessEntry[] {
  return safeArrayFromStorage<Pass4555DownloadAccessEntry>(
    STORAGE_KEYS.downloadAccess,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4555.account-download-access-capsule.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.downloadManifestId),
  );
}

function persistDownloadAccess(entry: Pass4555DownloadAccessEntry) {
  if (typeof window === "undefined") return;
  const existing = readDownloadAccessState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.downloadManifestId !== entry.downloadManifestId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.downloadAccess, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4555-account-download-access-capsule", {
      detail: entry,
    }),
  );
}

function readDownloadConsumptionState(): Pass4556DownloadConsumptionEntry[] {
  return safeArrayFromStorage<Pass4556DownloadConsumptionEntry>(
    STORAGE_KEYS.downloadConsumption,
  ).filter(
    (entry) =>
      entry?.schema ===
        "velmere.pass4556.account-download-consumption-ledger.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.accessCapsuleId),
  );
}

function persistDownloadConsumption(entry: Pass4556DownloadConsumptionEntry) {
  if (typeof window === "undefined") return;
  const existing = readDownloadConsumptionState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.accessCapsuleId !== entry.accessCapsuleId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.downloadConsumption, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4556-account-download-consumption-ledger", {
      detail: entry,
    }),
  );
}

function readDownloadCloseoutState(): Pass4557DownloadCloseoutEntry[] {
  return safeArrayFromStorage<Pass4557DownloadCloseoutEntry>(
    STORAGE_KEYS.downloadCloseout,
  ).filter(
    (entry) =>
      entry?.schema ===
        "velmere.pass4557.account-download-closeout-receipt.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.consumptionId),
  );
}

function persistDownloadCloseout(entry: Pass4557DownloadCloseoutEntry) {
  if (typeof window === "undefined") return;
  const existing = readDownloadCloseoutState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.consumptionId !== entry.consumptionId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.downloadCloseout, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4557-account-download-closeout-receipt", {
      detail: entry,
    }),
  );
}

function readPostCloseoutAttestationState(): Pass4558PostCloseoutAttestationEntry[] {
  return safeArrayFromStorage<Pass4558PostCloseoutAttestationEntry>(
    STORAGE_KEYS.postCloseoutAttestation,
  ).filter(
    (entry) =>
      entry?.schema ===
        "velmere.pass4558.account-post-closeout-attestation.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.closeoutId),
  );
}

function persistPostCloseoutAttestation(
  entry: Pass4558PostCloseoutAttestationEntry,
) {
  if (typeof window === "undefined") return;
  const existing = readPostCloseoutAttestationState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.closeoutId !== entry.closeoutId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.postCloseoutAttestation, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4558-account-post-closeout-attestation", {
      detail: entry,
    }),
  );
}

function readPublicProofIndexState(): Pass4559PublicProofIndexEntry[] {
  return safeArrayFromStorage<Pass4559PublicProofIndexEntry>(
    STORAGE_KEYS.publicProofIndex,
  ).filter(
    (entry) =>
      entry?.schema === "velmere.pass4559.account-public-proof-index.v1" &&
      Boolean(entry.vaultPointer) &&
      Boolean(entry.attestationId),
  );
}

function persistPublicProofIndex(entry: Pass4559PublicProofIndexEntry) {
  if (typeof window === "undefined") return;
  const existing = readPublicProofIndexState().filter(
    (item) =>
      item.vaultPointer !== entry.vaultPointer ||
      item.attestationId !== entry.attestationId,
  );
  const next = [entry, ...existing].slice(0, 80);
  writePrivateAccountTabArray(STORAGE_KEYS.publicProofIndex, next);
  window.dispatchEvent(
    new CustomEvent("velmere:pass4559-account-public-proof-index", {
      detail: entry,
    }),
  );
}

function buildClientDownloadConsumption(
  entry: Pass4555DownloadAccessEntry,
  serverPayload?: Record<string, unknown>,
): Pass4556DownloadConsumptionEntry {
  const now = new Date();
  const expiresAtMs = Date.parse(entry.expiresAt);
  const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime();
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    !expired &&
    (entry.status === "download-manifest-pending" ||
      entry.status === "client-fallback" ||
      !entry.status.includes("ready") ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4556.account-download-consumption-ledger.v1",
    allowedStatuses: ["download-consumed", "operator-review-required", "access-expired", "access-pending", "client-fallback"] as const,
    readyStatus: "download-consumed",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["consumptionId", "consumedAt", "downloadSessionId", "downloadAuditHash", "digest", "checksum"],
  });
  const consumptionReady = !reviewRequired && !expired && !pending && statusResolution.serverConfirmed;
  const consumptionId = String(
    serverPayload?.consumptionId ||
      `consume-${entry.accessCapsuleId}-${entry.digest.slice(-8)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const downloadSessionId = String(
    serverPayload?.downloadSessionId ||
      `session-${entry.accessTokenId}-${entry.checksum.slice(-8)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const downloadAuditHash = String(
    serverPayload?.downloadAuditHash ||
      `audit-${entry.checksum.replace(/[^a-z0-9]/gi, "").slice(0, 28)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-");
  const status: Pass4556DownloadConsumptionStatus = reviewRequired
    ? "operator-review-required"
    : expired
      ? "access-expired"
      : pending
        ? "access-pending"
        : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4556.account-download-consumption-ledger.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId: entry.downloadManifestId,
    downloadRoute: entry.downloadRoute,
    accessCapsuleId: entry.accessCapsuleId,
    accessRoute: entry.accessRoute,
    accessTokenId: entry.accessTokenId,
    expiresAt: entry.expiresAt,
    consumptionPolicy: entry.consumptionPolicy,
    consumptionId,
    consumedAt: String(serverPayload?.consumedAt || now.toISOString()),
    downloadSessionId,
    downloadAuditHash,
    status,
    generatedAt: String(serverPayload?.generatedAt || now.toISOString()),
    digest: String(serverPayload?.digest || entry.digest),
    checksum: String(serverPayload?.checksum || entry.checksum),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : expired
            ? "access-expired"
            : pending
              ? "access-pending"
              : consumptionReady
                ? "consumption-clear"
                : "client-fallback-unverified"),
    ),
    boundary:
      "pass4556-download-consumption-ledger-metadata-only-one-time-no-paid-unlock-no-trade-execution-no-binary-pdf",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "access-capsule",
            state: entry.status,
            proof: entry.accessCapsuleId,
          },
          {
            lane: "expiry-gate",
            state: expired ? "expired" : "valid",
            proof: entry.expiresAt,
          },
          {
            lane: "consumption-ledger",
            state:
              consumptionReady ? "consumed" : "blocked",
            proof: consumptionId,
          },
          {
            lane: "download-session",
            state:
              consumptionReady ? "metadata-session-ready" : "withheld",
            proof: downloadSessionId,
          },
        ],
  };
}

function buildClientDownloadCloseout(
  entry: Pass4556DownloadConsumptionEntry,
  serverPayload?: Record<string, unknown>,
): Pass4557DownloadCloseoutEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    (entry.status === "access-pending" ||
      entry.status === "access-expired" ||
      entry.status === "client-fallback" ||
      !entry.status.includes("consumed") ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4557.account-download-closeout-receipt.v1",
    allowedStatuses: ["download-closed", "operator-review-required", "consumption-pending", "session-revoked", "client-fallback"] as const,
    readyStatus: "download-closed",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["closeoutId", "closedAt", "sessionFinalizedHash", "digest", "checksum"],
  });
  const closeoutReady = !reviewRequired && !pending && statusResolution.serverConfirmed;
  const closeoutId = String(
    serverPayload?.closeoutId ||
      `closeout-${entry.consumptionId}-${entry.digest.slice(-8)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const sessionFinalizedHash = String(
    serverPayload?.sessionFinalizedHash ||
      `final-${entry.downloadAuditHash.replace(/[^a-z0-9]/gi, "").slice(0, 28)}-${entry.checksum.slice(-8)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-");
  const revokePolicy = String(
    serverPayload?.revokePolicy ||
      "one-time-session-closed-token-material-never-exposed-replay-blocked",
  );
  const status: Pass4557DownloadCloseoutStatus = reviewRequired
    ? "operator-review-required"
    : pending
      ? "consumption-pending"
      : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4557.account-download-closeout-receipt.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId: entry.downloadManifestId,
    downloadRoute: entry.downloadRoute,
    accessCapsuleId: entry.accessCapsuleId,
    accessRoute: entry.accessRoute,
    accessTokenId: entry.accessTokenId,
    expiresAt: entry.expiresAt,
    consumptionPolicy: entry.consumptionPolicy,
    consumptionId: entry.consumptionId,
    consumedAt: entry.consumedAt,
    downloadSessionId: entry.downloadSessionId,
    downloadAuditHash: entry.downloadAuditHash,
    closeoutId,
    closedAt: String(serverPayload?.closedAt || new Date().toISOString()),
    sessionFinalizedHash,
    revokePolicy,
    status,
    generatedAt: String(serverPayload?.generatedAt || new Date().toISOString()),
    digest: String(serverPayload?.digest || entry.digest),
    checksum: String(serverPayload?.checksum || entry.checksum),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : pending
            ? "consumption-pending"
            : closeoutReady
              ? "download-closeout-clear"
              : "client-fallback-unverified"),
    ),
    boundary:
      "pass4557-download-closeout-receipt-metadata-only-session-finalized-no-paid-unlock-no-trade-execution-no-binary-pdf-no-token-material",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "consumption-ledger",
            state: entry.status,
            proof: entry.consumptionId,
          },
          {
            lane: "session-finalization",
            state: closeoutReady ? "closed" : "blocked",
            proof: sessionFinalizedHash,
          },
          {
            lane: "replay-revocation",
            state: closeoutReady ? "revoked" : "waiting",
            proof: revokePolicy,
          },
          {
            lane: "account-audit-trail",
            state: closeoutReady ? "metadata-ready" : "withheld",
            proof: closeoutId,
          },
        ],
  };
}

function buildClientPostCloseoutAttestation(
  entry: Pass4557DownloadCloseoutEntry,
  serverPayload?: Record<string, unknown>,
): Pass4558PostCloseoutAttestationEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    (entry.status === "consumption-pending" ||
      entry.status === "session-revoked" ||
      entry.status === "client-fallback" ||
      !entry.status.includes("closed") ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4558.account-post-closeout-attestation.v1",
    allowedStatuses: ["post-closeout-attested", "operator-review-required", "closeout-pending", "client-fallback"] as const,
    readyStatus: "post-closeout-attested",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["attestationId", "attestedAt", "publicProofPointer", "digest", "checksum"],
  });
  const attestationReady = !reviewRequired && !pending && statusResolution.serverConfirmed;
  const attestationId = String(
    serverPayload?.attestationId ||
      `attest-${entry.closeoutId}-${entry.digest.slice(-8)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const publicProofPointer = String(
    serverPayload?.publicProofPointer ||
      `proof-index://${entry.source}/${entry.symbol}/${entry.timeframe}/${attestationId}`,
  ).toLowerCase();
  const archiveRoute = String(
    serverPayload?.archiveRoute ||
      `/account?tab=reports&vault=${encodeURIComponent(entry.vaultPointer)}&attestation=${encodeURIComponent(attestationId)}`,
  );
  const retentionPolicy = String(
    serverPayload?.retentionPolicy ||
      "metadata-proof-index-retained-raw-payload-and-token-material-never-stored",
  );
  const status: Pass4558PostCloseoutAttestationStatus = reviewRequired
    ? "operator-review-required"
    : pending
      ? "closeout-pending"
      : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4558.account-post-closeout-attestation.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId: entry.downloadManifestId,
    downloadRoute: entry.downloadRoute,
    accessCapsuleId: entry.accessCapsuleId,
    accessRoute: entry.accessRoute,
    accessTokenId: entry.accessTokenId,
    consumptionId: entry.consumptionId,
    downloadSessionId: entry.downloadSessionId,
    closeoutId: entry.closeoutId,
    sessionFinalizedHash: entry.sessionFinalizedHash,
    attestationId,
    attestedAt: String(serverPayload?.attestedAt || new Date().toISOString()),
    publicProofPointer,
    archiveRoute,
    retentionPolicy,
    status,
    generatedAt: String(serverPayload?.generatedAt || new Date().toISOString()),
    digest: String(serverPayload?.digest || entry.digest),
    checksum: String(serverPayload?.checksum || entry.checksum),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : pending
            ? "download-closeout-pending"
            : attestationReady
              ? "post-closeout-attestation-clear"
              : "client-fallback-unverified"),
    ),
    boundary:
      "pass4558-post-closeout-attestation-metadata-only-public-proof-index-no-paid-unlock-no-trade-execution-no-binary-pdf-no-token-material",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "download-closeout",
            state: entry.status,
            proof: entry.closeoutId,
          },
          {
            lane: "proof-index",
            state: attestationReady ? "attested" : "blocked",
            proof: publicProofPointer,
          },
          {
            lane: "archive-route",
            state: attestationReady ? "metadata-ready" : "waiting",
            proof: archiveRoute,
          },
          {
            lane: "retention-policy",
            state: "metadata-only",
            proof: retentionPolicy,
          },
        ],
  };
}

function buildClientPublicProofIndex(
  entry: Pass4558PostCloseoutAttestationEntry,
  serverPayload?: Record<string, unknown>,
): Pass4559PublicProofIndexEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    (entry.status === "closeout-pending" ||
      entry.status === "client-fallback" ||
      !entry.status.includes("attested") ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4559.account-public-proof-index.v1",
    allowedStatuses: ["public-proof-indexed", "operator-review-required", "attestation-pending", "client-fallback"] as const,
    readyStatus: "public-proof-indexed",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["publicIndexId", "indexedAt", "transparencyRoute", "proofDigest", "digest", "checksum"],
  });
  const publicIndexCandidate = String(serverPayload?.publicIndexId || "");
  const canonicalPublicIndexId = /^pubidx-[a-f0-9]{48}$/u.test(publicIndexCandidate)
    ? publicIndexCandidate
    : null;
  const expectedTransparencyRoute = canonicalPublicIndexId
    ? `/proof/market-integrity/${canonicalPublicIndexId}`
    : null;
  const transparencyRouteCandidate = String(serverPayload?.transparencyRoute || "");
  const registryHeadEventDigest = String(serverPayload?.registryHeadEventDigest || "");
  const proofDigestCandidate = String(serverPayload?.proofDigest || "");
  const registryBound = serverPayload?.publicationRegistryAuthority === "velmere.verify-public-projection.v1"
    && /^[a-f0-9]{64}$/u.test(registryHeadEventDigest)
    && /^[a-f0-9]{64}$/u.test(proofDigestCandidate)
    && expectedTransparencyRoute !== null
    && transparencyRouteCandidate === expectedTransparencyRoute;
  const publicProofReady = !reviewRequired
    && !pending
    && statusResolution.serverConfirmed
    && registryBound;
  const publicIndexId = canonicalPublicIndexId ?? "WITHHELD_DURABLE_VERIFY_PUBLICATION_ID";
  const transparencyRoute = publicProofReady && expectedTransparencyRoute
    ? expectedTransparencyRoute
    : "WITHHELD_DURABLE_VERIFY_PUBLICATION_ROUTE";
  const proofDigest = publicProofReady && /^[a-f0-9]{64}$/u.test(proofDigestCandidate)
    ? proofDigestCandidate
    : "WITHHELD_DURABLE_VERIFY_PROOF_DIGEST";
  const redactionPolicy = String(
    serverPayload?.redactionPolicy ||
      "public-index-exposes-only-redacted-metadata-no-customer-payload-no-token-material",
  );
  const status: Pass4559PublicProofIndexStatus = reviewRequired
    ? "operator-review-required"
    : pending
      ? "attestation-pending"
      : publicProofReady
        ? statusResolution.status
        : "client-fallback";
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4559.account-public-proof-index.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId: entry.downloadManifestId,
    downloadRoute: entry.downloadRoute,
    accessCapsuleId: entry.accessCapsuleId,
    accessRoute: entry.accessRoute,
    accessTokenId: entry.accessTokenId,
    consumptionId: entry.consumptionId,
    downloadSessionId: entry.downloadSessionId,
    closeoutId: entry.closeoutId,
    sessionFinalizedHash: entry.sessionFinalizedHash,
    attestationId: entry.attestationId,
    publicProofPointer: entry.publicProofPointer,
    archiveRoute: entry.archiveRoute,
    publicIndexId,
    indexedAt: String(serverPayload?.indexedAt || new Date().toISOString()),
    transparencyRoute,
    proofDigest,
    redactionPolicy,
    status,
    generatedAt: String(serverPayload?.generatedAt || new Date().toISOString()),
    digest: String(serverPayload?.digest || entry.digest),
    checksum: String(serverPayload?.checksum || entry.checksum),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : pending
            ? "post-closeout-attestation-pending"
            : publicProofReady
              ? "public-proof-index-clear"
              : "client-fallback-unverified"),
    ),
    boundary:
      "pass4559-public-proof-index-redacted-metadata-only-no-paid-unlock-no-trade-execution-no-binary-pdf-no-token-material-no-customer-payload",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "post-closeout-attestation",
            state: entry.status,
            proof: entry.attestationId,
          },
          {
            lane: "redaction-gate",
            state: "metadata-redacted",
            proof: redactionPolicy,
          },
          {
            lane: "public-proof-index",
            state: publicProofReady ? "indexed" : "blocked",
            proof: publicIndexId,
          },
          {
            lane: "transparency-route",
            state: publicProofReady ? "metadata-ready" : "withheld",
            proof: transparencyRoute,
          },
        ],
  };
}

function buildClientDownloadAccess(
  entry: Pass4554DownloadManifestEntry,
  serverPayload?: Record<string, unknown>,
): Pass4555DownloadAccessEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    (entry.status === "customer-release-pending" ||
      !entry.status.includes("ready") ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4555.account-download-access-capsule.v1",
    allowedStatuses: ["access-token-ready", "operator-review-required", "download-manifest-pending", "client-fallback"] as const,
    readyStatus: "access-token-ready",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["accessCapsuleId", "accessRoute", "accessTokenId", "expiresAt", "digest", "checksum"],
  });
  const accessReady = !reviewRequired && !pending && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const accessCapsuleId = String(
    serverPayload?.accessCapsuleId ||
      `access-${entry.downloadManifestId}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const accessTokenId = String(
    serverPayload?.accessTokenId ||
      `token-${entry.checksum.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const accessRoute = String(
    serverPayload?.accessRoute ||
      `/account?tab=reports&vault=${encodeURIComponent(entry.vaultPointer)}&manifest=${encodeURIComponent(entry.downloadManifestId)}&access=${encodeURIComponent(accessCapsuleId)}`,
  );
  const expiresAt = String(
    serverPayload?.expiresAt ||
      new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  );
  const consumptionPolicy = String(
    serverPayload?.consumptionPolicy ||
      "one-manifest-one-access-capsule-review-gated-metadata-only",
  );
  const status: Pass4555DownloadAccessStatus = reviewRequired
    ? "operator-review-required"
    : pending
      ? "download-manifest-pending"
      : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4555.account-download-access-capsule.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId: entry.downloadManifestId,
    downloadRoute: entry.downloadRoute,
    accessCapsuleId,
    accessRoute,
    accessTokenId,
    expiresAt,
    consumptionPolicy,
    status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    checksum: String(serverPayload?.checksum || entry.checksum),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : pending
            ? "download-manifest-pending"
            : accessReady
              ? "access-capsule-clear"
              : "client-fallback-unverified"),
    ),
    boundary:
      "pass4555-download-access-capsule-metadata-only-short-lived-no-paid-unlock-no-trade-execution-no-binary-pdf",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "download-manifest",
            state: entry.status,
            proof: entry.downloadManifestId,
          },
          {
            lane: "review-gate",
            state: reviewRequired ? "blocked" : pending ? "waiting" : accessReady ? "clear" : "blocked",
            proof: entry.reviewGate,
          },
          {
            lane: "access-capsule",
            state: accessReady ? "short-lived-ready" : "blocked",
            proof: accessCapsuleId,
          },
          {
            lane: "consumption-policy",
            state: accessReady ? "armed" : "waiting",
            proof: consumptionPolicy,
          },
        ],
  };
}

function buildClientDownloadManifest(
  entry: Pass4553CustomerReceiptEntry,
  serverPayload?: Record<string, unknown>,
): Pass4554DownloadManifestEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const pending =
    !reviewRequired &&
    (entry.status === "release-pending" ||
      String(serverPayload?.status || "").includes("pending"));
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4554.account-download-manifest.v1",
    allowedStatuses: ["download-manifest-ready", "operator-review-required", "customer-release-pending", "client-fallback"] as const,
    readyStatus: "download-manifest-ready",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["downloadManifestId", "downloadRoute", "checksum", "digest"],
  });
  const manifestReady = !reviewRequired && !pending && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const downloadManifestId = String(
    serverPayload?.downloadManifestId ||
      `manifest-${entry.customerReceiptId}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const downloadRoute = String(
    serverPayload?.downloadRoute ||
      `/account?tab=reports&vault=${encodeURIComponent(entry.vaultPointer)}&receipt=${encodeURIComponent(entry.customerReceiptId)}&manifest=${encodeURIComponent(downloadManifestId)}`,
  );
  const checksum = String(
    statusResolution.serverConfirmed
      ? serverPayload?.checksum
      : "unverified-no-server-checksum",
  );
  const status: Pass4554DownloadManifestStatus = reviewRequired
    ? "operator-review-required"
    : pending
      ? "customer-release-pending"
      : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4554.account-download-manifest.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId: entry.customerReceiptId,
    customerRoute: entry.customerRoute,
    downloadPointer: entry.downloadPointer,
    downloadManifestId,
    downloadRoute,
    status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    checksum,
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : pending
            ? "customer-release-pending"
            : manifestReady
              ? "download-manifest-clear"
              : "client-fallback-unverified"),
    ),
    boundary:
      "pass4554-download-manifest-metadata-only-no-paid-unlock-no-trade-execution-no-binary-pdf",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "customer-receipt",
            state: entry.status,
            proof: entry.customerReceiptId,
          },
          {
            lane: "review-gate",
            state: reviewRequired ? "blocked" : pending ? "waiting" : manifestReady ? "clear" : "blocked",
            proof: entry.reviewGate,
          },
          {
            lane: "download-manifest",
            state: manifestReady ? "metadata-ready" : "blocked",
            proof: downloadManifestId,
          },
          {
            lane: "account-route",
            state: manifestReady ? "ready" : "waiting",
            proof: downloadRoute,
          },
        ],
  };
}

function buildClientCustomerReceipt(
  entry: Pass4552AccountReleaseEntry,
  serverPayload?: Record<string, unknown>,
): Pass4553CustomerReceiptEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4553.account-customer-release-receipt.v1",
    allowedStatuses: ["customer-visible-ready", "operator-review-required", "release-pending", "client-fallback"] as const,
    readyStatus: "customer-visible-ready",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["customerReceiptId", "customerRoute", "downloadPointer", "digest"],
  });
  const customerReceiptReady = !reviewRequired && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const customerReceiptId = String(
    serverPayload?.customerReceiptId ||
      `customer-${entry.releaseId}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const customerRoute = String(
    serverPayload?.customerRoute ||
      `/account?tab=reports&vault=${encodeURIComponent(entry.vaultPointer)}&release=${encodeURIComponent(entry.releaseId)}&receipt=${encodeURIComponent(customerReceiptId)}`,
  );
  const downloadPointer = String(
    serverPayload?.downloadPointer ||
      `download-manifest://${entry.source}/${entry.symbol}/${entry.timeframe}/${customerReceiptId}`,
  );
  const status: Pass4553CustomerReceiptStatus = reviewRequired
    ? "operator-review-required"
    : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4553.account-customer-release-receipt.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId: entry.releaseId,
    releasePointer: entry.releasePointer,
    customerReceiptId,
    customerRoute,
    downloadPointer,
    status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : customerReceiptReady
            ? "customer-release-clear"
            : "client-fallback-unverified"),
    ),
    boundary:
      "pass4553-customer-release-receipt-metadata-only-no-paid-unlock-no-trade-execution",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "account-release",
            state: entry.status,
            proof: entry.releasePointer,
          },
          {
            lane: "review-gate",
            state: reviewRequired ? "blocked" : customerReceiptReady ? "clear" : "blocked",
            proof: entry.reviewGate,
          },
          {
            lane: "customer-route",
            state: customerReceiptReady ? "ready" : "waiting",
            proof: customerRoute,
          },
          {
            lane: "download-manifest",
            state: customerReceiptReady ? "metadata-ready" : "blocked",
            proof: downloadPointer,
          },
        ],
  };
}

function buildClientAccountRelease(
  entry: Pass4551PackageDeliveryEntry,
  serverPayload?: Record<string, unknown>,
): Pass4552AccountReleaseEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    entry.reviewGate.includes("review") ||
    String(serverPayload?.status || "").includes("review");
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4552.account-report-release-gate.v1",
    allowedStatuses: ["account-release-queued", "operator-review-required", "client-fallback"] as const,
    readyStatus: "account-release-queued",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["releaseId", "releasePointer", "digest"],
  });
  const releaseReady = !reviewRequired && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const releaseId = String(
    serverPayload?.releaseId ||
      `release-${entry.deliveryId}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const releasePointer = String(
    serverPayload?.releasePointer ||
      `account-release://${entry.source}/${entry.symbol}/${entry.timeframe}/${releaseId}`,
  );
  const status: Pass4552AccountReleaseStatus = reviewRequired
    ? "operator-review-required"
    : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4552.account-report-release-gate.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId: entry.deliveryId,
    releaseId,
    releasePointer,
    status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired ? "operator-review-required" : releaseReady ? "account-release-clear" : "client-fallback-unverified"),
    ),
    boundary:
      "pass4552-account-release-metadata-only-no-paid-unlock-no-trade-execution",
    lanes: serverLanes.length
      ? serverLanes
      : [
          {
            lane: "delivery-checkpoint",
            state: entry.status,
            proof: entry.deliveryId,
          },
          {
            lane: "review-gate",
            state: reviewRequired ? "blocked" : releaseReady ? "clear" : "blocked",
            proof: entry.reviewGate,
          },
          {
            lane: "account-release",
            state: releaseReady ? "queued" : "waiting",
            proof: releasePointer,
          },
          {
            lane: "customer-visible",
            state: releaseReady ? "metadata-ready" : "blocked",
            proof: entry.releaseRoute,
          },
        ],
  };
}

function buildClientPackageDelivery(
  entry: Pass4550PdfPackageEntry,
  serverPayload?: Record<string, unknown>,
): Pass4551PackageDeliveryEntry {
  const reviewRequired =
    entry.status === "operator-review-required" ||
    String(serverPayload?.status || "").includes("review");
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4551.account-report-package-delivery.v1",
    allowedStatuses: ["package-ready", "operator-review-required", "release-queued", "client-fallback"] as const,
    readyStatus: "package-ready",
    fallbackStatus: "client-fallback",
    requiredReadyFields: ["deliveryId", "releaseRoute", "digest"],
  });
  const deliveryReady = !reviewRequired && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const deliveryId = String(
    serverPayload?.deliveryId ||
      `delivery-${entry.packageId}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const releaseRoute = String(
    serverPayload?.releaseRoute ||
      `/account?tab=reports&vault=${encodeURIComponent(entry.vaultPointer)}&package=${encodeURIComponent(entry.packageId)}`,
  );
  const status: Pass4551PackageDeliveryStatus = reviewRequired
    ? "operator-review-required"
    : statusResolution.status;
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4551.account-report-package-delivery.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId: entry.packageId,
    pdfPointer: entry.pdfPointer,
    deliveryId,
    releaseRoute,
    status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    reviewGate: String(
      serverPayload?.reviewGate ||
        (reviewRequired
          ? "operator-review-required"
          : deliveryReady
            ? "metadata-package-clear"
            : "client-fallback-unverified"),
    ),
    boundary:
      "pass4551-delivery-checkpoint-metadata-only-no-paid-unlock-no-trade-execution",
    lanes: serverLanes.length
      ? serverLanes
      : [
          { lane: "package-intake", state: "ready", proof: entry.packageId },
          {
            lane: "pdf-pointer",
            state: deliveryReady ? "ready" : "blocked",
            proof: entry.pdfPointer,
          },
          {
            lane: "operator-review",
            state: reviewRequired ? "required" : deliveryReady ? "clear" : "waiting",
            proof: entry.operatorQueue,
          },
          {
            lane: "account-release",
            state: deliveryReady ? "ready" : "waiting",
            proof: releaseRoute,
          },
        ],
  };
}

function buildClientPdfPackage(
  entry: InboxReportEntry,
  review: Pass4549ReviewEntry | undefined,
  serverPayload?: Record<string, unknown>,
): Pass4550PdfPackageEntry {
  const reviewRequired =
    isReviewRequired(entry) ||
    review?.status === "operator-review" ||
    String(serverPayload?.status || "").includes("review");
  const statusResolution = resolveServerArtifactStatus({
    payload: serverPayload,
    expectedSchema: "velmere.pass4550.account-report-pdf-package.v1",
    allowedStatuses: ["pdf-ready", "operator-review-required", "metadata-only-fallback"] as const,
    readyStatus: "pdf-ready",
    fallbackStatus: "metadata-only-fallback",
    requiredReadyFields: ["packageId", "pdfPointer", "digest"],
  });
  const packageReady = !reviewRequired && statusResolution.serverConfirmed;
  const generatedAt = new Date().toISOString();
  const packageId = String(
    serverPayload?.packageId ||
      `pkg-${entry.source}-${entry.symbol}-${entry.timeframe}-${entry.digest.slice(0, 10)}`,
  )
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const pdfPointer = String(
    serverPayload?.pdfPointer ||
      `pdf://${entry.source}/${entry.symbol}/${entry.timeframe}/${entry.vaultPointer}`,
  );
  const operatorQueue = String(
    serverPayload?.operatorQueue ||
      (reviewRequired ? "operator-review" : "account-pdf-ready"),
  );
  const serverLanes = Array.isArray(serverPayload?.lanes)
    ? (serverPayload?.lanes as VaultBridgeLane[])
    : [];
  return {
    schema: "velmere.pass4550.account-report-pdf-package.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    packageId,
    pdfPointer,
    operatorQueue,
    status: reviewRequired ? "operator-review-required" : statusResolution.status,
    generatedAt,
    digest: String(serverPayload?.digest || entry.digest),
    reviewStatus:
      review?.status ||
      (reviewRequired ? "review-required" : "ready-for-export"),
    boundary:
      "account-pdf-package-metadata-only-no-paid-unlock-no-trade-execution",
    lanes: serverLanes.length
      ? serverLanes
      : [
          { lane: "report-detail", state: "ready", proof: entry.vaultPointer },
          {
            lane: "review-state",
            state: reviewRequired ? "review-required" : "ready",
            proof: review?.status || "not-reviewed",
          },
          {
            lane: "pdf-package",
            state: packageReady ? "ready" : "blocked",
            proof: packageId,
          },
          {
            lane: "operator-queue",
            state: reviewRequired ? "review-required" : "metadata-only",
            proof: operatorQueue,
          },
        ],
  };
}

function buildPass4549ReviewEntry(
  entry: InboxReportEntry,
  status: Pass4549ReviewStatus,
  serverAck?: string,
): Pass4549ReviewEntry {
  const reviewRequired =
    isReviewRequired(entry) || status === "operator-review";
  return {
    schema: "velmere.pass4549.account-report-review-state.v1",
    source: entry.source,
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    vaultPointer: entry.vaultPointer,
    status: reviewRequired ? "operator-review" : status,
    queuedAt: new Date().toISOString(),
    digest: entry.digest,
    serverAck,
    boundary: "account-review-metadata-only-no-paid-unlock-no-trade-execution",
    lanes: [
      { lane: "account-inbox", state: "ready", proof: entry.accountRoute },
      {
        lane: "vault-pointer",
        state: entry.serverStored ? "ready" : "metadata-only",
        proof: entry.vaultPointer,
      },
      {
        lane: "review-gate",
        state: reviewRequired ? "review-required" : "ready",
        proof: entry.draft?.draftState || entry.deliveryState,
      },
      {
        lane: "pdf-operator-export",
        state: reviewRequired ? "waiting" : "ready",
        proof: status,
      },
    ],
  };
}

function isReviewRequired(entry: InboxReportEntry) {
  return (
    entry.deliveryState.includes("review") ||
    entry.draft?.draftState === "operator-review" ||
    Number(entry.draft?.reviewCount || 0) > 0
  );
}

function isVaultReady(entry: InboxReportEntry) {
  return entry.deliveryState.includes("ready") && !isReviewRequired(entry);
}

type InboxExternalState = {
  reports: InboxReportEntry[];
  selectedVault: string;
  reviewState: Pass4549ReviewEntry[];
  pdfPackages: Pass4550PdfPackageEntry[];
  packageDeliveries: Pass4551PackageDeliveryEntry[];
  accountReleases: Pass4552AccountReleaseEntry[];
  customerReceipts: Pass4553CustomerReceiptEntry[];
  downloadManifests: Pass4554DownloadManifestEntry[];
  downloadAccessCapsules: Pass4555DownloadAccessEntry[];
  downloadConsumptions: Pass4556DownloadConsumptionEntry[];
  downloadCloseouts: Pass4557DownloadCloseoutEntry[];
  postCloseoutAttestations: Pass4558PostCloseoutAttestationEntry[];
  publicProofIndexes: Pass4559PublicProofIndexEntry[];
};

const EMPTY_INBOX_EXTERNAL_STATE: InboxExternalState = {
  reports: [],
  selectedVault: "",
  reviewState: [],
  pdfPackages: [],
  packageDeliveries: [],
  accountReleases: [],
  customerReceipts: [],
  downloadManifests: [],
  downloadAccessCapsules: [],
  downloadConsumptions: [],
  downloadCloseouts: [],
  postCloseoutAttestations: [],
  publicProofIndexes: [],
};

function readInboxExternalState(): InboxExternalState {
  return {
    reports: readInboxReports(),
    selectedVault: typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("vault") ?? "",
    reviewState: readReviewState(),
    pdfPackages: readPdfPackageState(),
    packageDeliveries: readPackageDeliveryState(),
    accountReleases: readAccountReleaseState(),
    customerReceipts: readCustomerReceiptState(),
    downloadManifests: readDownloadManifestState(),
    downloadAccessCapsules: readDownloadAccessState(),
    downloadConsumptions: readDownloadConsumptionState(),
    downloadCloseouts: readDownloadCloseoutState(),
    postCloseoutAttestations: readPostCloseoutAttestationState(),
    publicProofIndexes: readPublicProofIndexState(),
  };
}

export default function MarketActionReportsInboxClient() {
  const activeLocale = useLocale() as SupportedLocale;
  const t = copy[activeLocale] ?? copy.en;
  const externalSnapshot = useSyncExternalStore(
    subscribeInboxSnapshot,
    getInboxSnapshot,
    getServerInboxSnapshot,
  );
  const externalState = useMemo(
    () => externalSnapshot === SERVER_INBOX_SNAPSHOT
      ? EMPTY_INBOX_EXTERNAL_STATE
      : readInboxExternalState(),
    [externalSnapshot],
  );
  const {
    reports,
    selectedVault,
    reviewState,
    pdfPackages,
    packageDeliveries,
    accountReleases,
    customerReceipts,
    downloadManifests,
    downloadAccessCapsules,
    downloadConsumptions,
    downloadCloseouts,
    postCloseoutAttestations,
    publicProofIndexes,
  } = externalState;
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [copied, setCopied] = useState("");

  const metrics = useMemo(() => {
    const reviewCount = reports.filter(isReviewRequired).length;
    const readyCount = reports.filter(isVaultReady).length;
    return {
      total: reports.length,
      review: reviewCount,
      ready: readyCount,
      local: reports.filter((entry) => !entry.serverStored).length,
    };
  }, [reports]);

  const reviewMap = useMemo(
    () => new Map(reviewState.map((entry) => [entry.vaultPointer, entry])),
    [reviewState],
  );
  const selectedReport = useMemo(() => {
    if (selectedVault) {
      const byVault = reports.find(
        (entry) => entry.vaultPointer === selectedVault,
      );
      if (byVault) return byVault;
    }
    return (
      reports.find((entry) => entry.key === selectedReportKey) ||
      reports[0] ||
      null
    );
  }, [reports, selectedReportKey, selectedVault]);
  const selectedReview = selectedReport
    ? reviewMap.get(selectedReport.vaultPointer)
    : undefined;
  const selectedPdfPackage = selectedReport
    ? pdfPackages.find(
        (entry) => entry.vaultPointer === selectedReport.vaultPointer,
      )
    : undefined;
  const selectedPackageDelivery = selectedPdfPackage
    ? packageDeliveries.find(
        (entry) =>
          entry.vaultPointer === selectedPdfPackage.vaultPointer &&
          entry.packageId === selectedPdfPackage.packageId,
      )
    : undefined;
  const selectedAccountRelease = selectedPackageDelivery
    ? accountReleases.find(
        (entry) =>
          entry.vaultPointer === selectedPackageDelivery.vaultPointer &&
          entry.deliveryId === selectedPackageDelivery.deliveryId,
      )
    : undefined;
  const selectedCustomerReceipt = selectedAccountRelease
    ? customerReceipts.find(
        (entry) =>
          entry.vaultPointer === selectedAccountRelease.vaultPointer &&
          entry.releaseId === selectedAccountRelease.releaseId,
      )
    : undefined;
  const selectedDownloadManifest = selectedCustomerReceipt
    ? downloadManifests.find(
        (entry) =>
          entry.vaultPointer === selectedCustomerReceipt.vaultPointer &&
          entry.customerReceiptId === selectedCustomerReceipt.customerReceiptId,
      )
    : undefined;
  const selectedDownloadAccess = selectedDownloadManifest
    ? downloadAccessCapsules.find(
        (entry) =>
          entry.vaultPointer === selectedDownloadManifest.vaultPointer &&
          entry.downloadManifestId ===
            selectedDownloadManifest.downloadManifestId,
      )
    : undefined;
  const selectedDownloadConsumption = selectedDownloadAccess
    ? downloadConsumptions.find(
        (entry) =>
          entry.vaultPointer === selectedDownloadAccess.vaultPointer &&
          entry.accessCapsuleId === selectedDownloadAccess.accessCapsuleId,
      )
    : undefined;
  const selectedDownloadCloseout = selectedDownloadConsumption
    ? downloadCloseouts.find(
        (entry) =>
          entry.vaultPointer === selectedDownloadConsumption.vaultPointer &&
          entry.consumptionId === selectedDownloadConsumption.consumptionId,
      )
    : undefined;
  const selectedPostCloseoutAttestation = selectedDownloadCloseout
    ? postCloseoutAttestations.find(
        (entry) =>
          entry.vaultPointer === selectedDownloadCloseout.vaultPointer &&
          entry.closeoutId === selectedDownloadCloseout.closeoutId,
      )
    : undefined;
  const selectedPublicProofIndex = selectedPostCloseoutAttestation
    ? publicProofIndexes.find(
        (entry) =>
          entry.vaultPointer === selectedPostCloseoutAttestation.vaultPointer &&
          entry.attestationId === selectedPostCloseoutAttestation.attestationId,
      )
    : undefined;

  const syncReportReview = async (
    entry: InboxReportEntry,
    status: Pass4549ReviewStatus,
  ) => {
    let serverAck = "client-only";
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-review",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema: "velmere.pass4549.account-report-review-request.v1",
            status,
            pointer: entry.vaultPointer,
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            digest: entry.digest,
            deliveryState: entry.deliveryState,
            draftState: entry.draft?.draftState || "draft-missing",
          }),
        },
      );
      if (response.ok) {
        const payload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
        serverAck = String(payload?.ackId || payload?.schema || "server-ack");
      }
    } catch {
      serverAck = "client-fallback-api-unavailable";
    }
    const next = buildPass4549ReviewEntry(entry, status, serverAck);
    persistReviewState(next);
  };

  const preparePdfPackage = async (entry: InboxReportEntry) => {
    const review = reviewMap.get(entry.vaultPointer);
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-package",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema: "velmere.pass4550.account-report-package-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            digest: entry.digest,
            deliveryState: entry.deliveryState,
            draftState: entry.draft?.draftState || "draft-missing",
            reviewStatus: review?.status || "not-reviewed",
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = undefined;
    }
    const next = buildClientPdfPackage(entry, review, serverPayload);
    persistPdfPackage(next);
    setCopied(`pdf:${entry.key}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyPdfPackage = async (entry: Pass4550PdfPackageEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`pdf-package:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncPackageDelivery = async (entry: Pass4550PdfPackageEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-package-delivery",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4551.account-report-package-delivery-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            operatorQueue: entry.operatorQueue,
            packageStatus: entry.status,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientPackageDelivery(entry, serverPayload);
    persistPackageDelivery(next);
    setCopied(`delivery:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyPackageDelivery = async (entry: Pass4551PackageDeliveryEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`package-delivery:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncAccountRelease = async (entry: Pass4551PackageDeliveryEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-release",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema: "velmere.pass4552.account-report-release-gate-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            deliveryStatus: entry.status,
            releaseRoute: entry.releaseRoute,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientAccountRelease(entry, serverPayload);
    persistAccountRelease(next);
    setCopied(`release:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyAccountRelease = async (entry: Pass4552AccountReleaseEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`account-release:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncCustomerReceipt = async (entry: Pass4552AccountReleaseEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-customer-receipt",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4553.account-customer-release-receipt-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            releaseStatus: entry.status,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientCustomerReceipt(entry, serverPayload);
    persistCustomerReceipt(next);
    setCopied(`customer-receipt:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyCustomerReceipt = async (entry: Pass4553CustomerReceiptEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`customer-receipt-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncDownloadManifest = async (entry: Pass4553CustomerReceiptEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-download-manifest",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema: "velmere.pass4554.account-download-manifest-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            customerReceiptStatus: entry.status,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientDownloadManifest(entry, serverPayload);
    persistDownloadManifest(next);
    setCopied(`download-manifest:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyDownloadManifest = async (entry: Pass4554DownloadManifestEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`download-manifest-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncDownloadAccess = async (entry: Pass4554DownloadManifestEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-download-access",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4555.account-download-access-capsule-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            downloadManifestId: entry.downloadManifestId,
            downloadRoute: entry.downloadRoute,
            downloadManifestStatus: entry.status,
            checksum: entry.checksum,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientDownloadAccess(entry, serverPayload);
    persistDownloadAccess(next);
    setCopied(`download-access:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyDownloadAccess = async (entry: Pass4555DownloadAccessEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`download-access-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const consumeDownloadAccess = async (entry: Pass4555DownloadAccessEntry) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-download-consumption",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4556.account-download-consumption-ledger-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            downloadManifestId: entry.downloadManifestId,
            downloadRoute: entry.downloadRoute,
            accessCapsuleId: entry.accessCapsuleId,
            accessRoute: entry.accessRoute,
            accessTokenId: entry.accessTokenId,
            expiresAt: entry.expiresAt,
            accessStatus: entry.status,
            consumptionPolicy: entry.consumptionPolicy,
            checksum: entry.checksum,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientDownloadConsumption(entry, serverPayload);
    persistDownloadConsumption(next);
    setCopied(`download-consumption:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyDownloadConsumption = async (
    entry: Pass4556DownloadConsumptionEntry,
  ) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`download-consumption-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncDownloadCloseout = async (
    entry: Pass4556DownloadConsumptionEntry,
  ) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-download-closeout",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4557.account-download-closeout-receipt-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            downloadManifestId: entry.downloadManifestId,
            downloadRoute: entry.downloadRoute,
            accessCapsuleId: entry.accessCapsuleId,
            accessRoute: entry.accessRoute,
            accessTokenId: entry.accessTokenId,
            expiresAt: entry.expiresAt,
            consumptionPolicy: entry.consumptionPolicy,
            consumptionId: entry.consumptionId,
            consumedAt: entry.consumedAt,
            downloadSessionId: entry.downloadSessionId,
            downloadAuditHash: entry.downloadAuditHash,
            consumptionStatus: entry.status,
            checksum: entry.checksum,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientDownloadCloseout(entry, serverPayload);
    persistDownloadCloseout(next);
    setCopied(`download-closeout:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyDownloadCloseout = async (
    entry: Pass4557DownloadCloseoutEntry,
  ) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`download-closeout-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncPostCloseoutAttestation = async (
    entry: Pass4557DownloadCloseoutEntry,
  ) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-post-closeout-attestation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema:
              "velmere.pass4558.account-post-closeout-attestation-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            downloadManifestId: entry.downloadManifestId,
            downloadRoute: entry.downloadRoute,
            accessCapsuleId: entry.accessCapsuleId,
            accessRoute: entry.accessRoute,
            accessTokenId: entry.accessTokenId,
            consumptionId: entry.consumptionId,
            downloadSessionId: entry.downloadSessionId,
            closeoutId: entry.closeoutId,
            sessionFinalizedHash: entry.sessionFinalizedHash,
            closeoutStatus: entry.status,
            checksum: entry.checksum,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientPostCloseoutAttestation(entry, serverPayload);
    persistPostCloseoutAttestation(next);
    setCopied(`post-closeout-attestation:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyPostCloseoutAttestation = async (
    entry: Pass4558PostCloseoutAttestationEntry,
  ) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`post-closeout-attestation-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const syncPublicProofIndex = async (
    entry: Pass4558PostCloseoutAttestationEntry,
  ) => {
    let serverPayload: Record<string, unknown> | undefined;
    try {
      const response = await fetch(
        "/api/market-integrity/action-report-public-proof-index",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schema: "velmere.pass4559.account-public-proof-index-request.v1",
            source: entry.source,
            symbol: entry.symbol,
            timeframe: entry.timeframe,
            vaultPointer: entry.vaultPointer,
            packageId: entry.packageId,
            pdfPointer: entry.pdfPointer,
            deliveryId: entry.deliveryId,
            releaseId: entry.releaseId,
            releasePointer: entry.releasePointer,
            customerReceiptId: entry.customerReceiptId,
            customerRoute: entry.customerRoute,
            downloadPointer: entry.downloadPointer,
            downloadManifestId: entry.downloadManifestId,
            downloadRoute: entry.downloadRoute,
            accessCapsuleId: entry.accessCapsuleId,
            accessRoute: entry.accessRoute,
            accessTokenId: entry.accessTokenId,
            consumptionId: entry.consumptionId,
            downloadSessionId: entry.downloadSessionId,
            closeoutId: entry.closeoutId,
            sessionFinalizedHash: entry.sessionFinalizedHash,
            attestationId: entry.attestationId,
            publicProofPointer: entry.publicProofPointer,
            archiveRoute: entry.archiveRoute,
            attestationStatus: entry.status,
            checksum: entry.checksum,
            reviewGate: entry.reviewGate,
            digest: entry.digest,
            boundary: entry.boundary,
          }),
        },
      );
      if (response.ok)
        serverPayload = await readJsonResponseBounded<Record<string, unknown>>(response, 2 * 1024 * 1024);
    } catch {
      serverPayload = { status: "client-fallback" };
    }
    const next = buildClientPublicProofIndex(entry, serverPayload);
    persistPublicProofIndex(next);
    setCopied(`public-proof-index:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyPublicProofIndex = async (
    entry: Pass4559PublicProofIndexEntry,
  ) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`public-proof-index-copy:${entry.vaultPointer}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const copyDetailPacket = async (entry: InboxReportEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(`detail:${entry.key}`);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const clearPointers = () => {
    clearPrivateAccountTabStore(Object.values(STORAGE_KEYS));
    purgeLegacyPrivateAccountLocalStorage();
    requestInboxRefresh();
  };

  const copyPointer = async (entry: InboxReportEntry) => {
    try {
      await copyPrivateAccountArtifactSummary(entry);
    } catch {
      // Clipboard is best-effort; the UI still marks the intent.
    }
    setCopied(entry.key);
    window.setTimeout(() => setCopied(""), 1600);
  };

  return (
    <section
      className="pass4548-market-reports-inbox mt-7"
      data-pass4548-account-market-reports-inbox="reads-pass4547-vault-bridges-from-shield-realmarkets-shieldpro"
      data-pass4548-report-count={String(reports.length)}
      data-pass4548-selected-vault={selectedVault || "none"}
      data-pass4549-account-report-detail-bridge="inbox-to-review-pdf-operator-handoff"
      data-pass4549-review-count={String(reviewState.length)}
      data-pass4550-account-report-pdf-package-count={String(
        pdfPackages.length,
      )}
      data-pass4551-account-report-package-delivery-count={String(
        packageDeliveries.length,
      )}
      data-pass4552-account-release-count={String(accountReleases.length)}
      data-pass4553-customer-receipt-count={String(customerReceipts.length)}
      data-pass4554-download-manifest-count={String(downloadManifests.length)}
      data-pass4555-download-access-capsule-count={String(
        downloadAccessCapsules.length,
      )}
      data-pass4556-download-consumption-ledger-count={String(
        downloadConsumptions.length,
      )}
      data-pass4557-download-closeout-receipt-count={String(
        downloadCloseouts.length,
      )}
      data-pass4558-post-closeout-attestation-count={String(
        postCloseoutAttestations.length,
      )}
      data-pass4559-public-proof-index-count={String(publicProofIndexes.length)}
    >
      <div className="pass4548-market-reports-head">
        <span className="pass4548-market-reports-icon" aria-hidden="true">
          <DatabaseZap className="h-5 w-5" />
        </span>
        <div>
          <p>{t.kicker}</p>
          <h2>{t.title}</h2>
          <small>{t.body}</small>
        </div>
      </div>

      <div className="pass4548-market-reports-toolbar">
        <button type="button" onClick={requestInboxRefresh}>
          <RefreshCw className="h-4 w-4" /> {t.refresh}
        </button>
        <button type="button" onClick={clearPointers}>
          <ShieldCheck className="h-4 w-4" /> {t.clear}
        </button>
      </div>

      <div
        className="pass4548-market-reports-metrics"
        data-pass4548-account-report-metrics="total-ready-review-local"
      >
        <span>
          <small>{t.total}</small>
          <strong>{metrics.total}</strong>
        </span>
        <span>
          <small>{t.ready}</small>
          <strong>{metrics.ready}</strong>
        </span>
        <span>
          <small>{t.review}</small>
          <strong>{metrics.review}</strong>
        </span>
        <span>
          <small>{t.local}</small>
          <strong>{metrics.local}</strong>
        </span>
      </div>

      {reports.length === 0 ? (
        <div
          className="pass4548-market-reports-empty"
          data-pass4548-account-report-empty-state="no-report-pointer-yet"
        >
          <FileText className="h-5 w-5" aria-hidden="true" />
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptyBody}</p>
        </div>
      ) : (
        <div className="pass4548-market-reports-grid">
          {reports.map((entry) => {
            const highlighted =
              selectedVault && selectedVault === entry.vaultPointer;
            return (
              <article
                key={entry.key}
                className="pass4548-market-report-card"
                data-pass4548-report-source={entry.source}
                data-pass4548-report-state={entry.deliveryState}
                data-pass4548-report-highlighted={
                  highlighted ? "true" : "false"
                }
              >
                <div className="pass4548-market-report-card-top">
                  <span>
                    <small>{t.source}</small>
                    <strong>
                      {entry.source === "shield-pro"
                        ? "Shield Pro"
                        : "Shield / Real Markets"}
                    </strong>
                  </span>
                  <em>{highlighted ? t.highlighted : entry.deliveryState}</em>
                </div>
                <h3>
                  {entry.symbol} · {entry.timeframe}
                </h3>
                <div className="pass4548-market-report-card-matrix">
                  <span>
                    <small>{t.state}</small>
                    <strong>{entry.deliveryState}</strong>
                  </span>
                  <span>
                    <small>{t.server}</small>
                    <strong>{String(entry.serverStored)}</strong>
                  </span>
                  <span>
                    <small>{t.digest}</small>
                    <strong>{entry.digest}</strong>
                  </span>
                  <span>
                    <small>{t.draft}</small>
                    <strong>{entry.draft?.draftState || t.noDraft}</strong>
                  </span>
                </div>
                <div className="pass4548-market-report-pointer">
                  <small>{t.route}</small>
                  <strong>{entry.accountRoute}</strong>
                </div>
                <div className="pass4548-market-report-pointer">
                  <small>{t.boundary}</small>
                  <strong>{entry.boundary}</strong>
                </div>
                <div className="pass4548-market-report-lanes">
                  <small>{t.lanes}</small>
                  {(entry.lanes.length
                    ? entry.lanes
                    : [
                        {
                          lane: "account-console",
                          state: "metadata-only",
                          proof: entry.schema,
                        },
                      ]
                  ).map((lane, index) => (
                    <span key={`${entry.key}-${lane.lane || index}`}>
                      <b>{lane.lane || "lane"}</b>
                      <em>{lane.state || "pending"}</em>
                      <small>{lane.proof || "proof pending"}</small>
                    </span>
                  ))}
                </div>
                <div className="pass4549-market-report-card-actions">
                  <button
                    type="button"
                    onClick={() => setSelectedReportKey(entry.key)}
                    data-pass4549-open-report-detail="true"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    {t.openDetail}
                  </button>
                  <button type="button" onClick={() => void copyPointer(entry)}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    {copied === entry.key ? t.copied : t.copy}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div
        className="pass4549-account-report-detail-bridge"
        data-pass4549-account-report-detail-selected={
          selectedReport?.vaultPointer || "none"
        }
        data-pass4549-account-report-review-state={
          selectedReview?.status || "not-reviewed"
        }
      >
        <div className="pass4549-account-report-detail-head">
          <span aria-hidden="true">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <p>{t.detailTitle}</p>
            <h3>{t.detailTitle}</h3>
            <small>{t.detailBody}</small>
          </div>
        </div>

        {selectedReport ? (
          <div className="pass4549-account-report-detail-grid">
            <div className="pass4549-account-report-detail-main">
              <div className="pass4549-account-report-detail-title">
                <span>
                  <small>{t.source}</small>
                  <strong>
                    {selectedReport.source === "shield-pro"
                      ? "Shield Pro"
                      : "Shield / Real Markets"}
                  </strong>
                </span>
                <span>
                  <small>{t.state}</small>
                  <strong>{selectedReport.deliveryState}</strong>
                </span>
                <span>
                  <small>{t.reviewState}</small>
                  <strong>
                    {selectedReview?.status ||
                      (isReviewRequired(selectedReport)
                        ? "review-required"
                        : "ready-for-ack")}
                  </strong>
                </span>
              </div>
              <h4>
                {selectedReport.symbol} · {selectedReport.timeframe}
              </h4>
              <div className="pass4549-account-report-detail-matrix">
                <span>
                  <small>{t.route}</small>
                  <strong>{selectedReport.accountRoute}</strong>
                </span>
                <span>
                  <small>{t.digest}</small>
                  <strong>{selectedReport.digest}</strong>
                </span>
                <span>
                  <small>{t.draft}</small>
                  <strong>
                    {selectedReport.draft?.draftState || t.noDraft}
                  </strong>
                </span>
                <span>
                  <small>{t.guardrail}</small>
                  <strong>{selectedReport.boundary}</strong>
                </span>
              </div>
              <div className="pass4549-account-report-detail-actions">
                <button
                  type="button"
                  onClick={() =>
                    void syncReportReview(selectedReport, "acknowledged")
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {selectedReview?.status === "acknowledged"
                    ? t.acknowledged
                    : t.acknowledge}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void syncReportReview(selectedReport, "operator-review")
                  }
                >
                  <SendHorizontal className="h-4 w-4" aria-hidden="true" />
                  {selectedReview?.status === "operator-review"
                    ? t.reviewQueued
                    : t.queueReview}
                </button>
                <button
                  type="button"
                  onClick={() => void copyDetailPacket(selectedReport)}
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  {copied === `detail:${selectedReport.key}`
                    ? t.detailPacketCopied
                    : t.copyDetail}
                </button>
              </div>
              <div
                className="pass4550-account-report-pdf-package"
                data-pass4550-account-report-pdf-package="detail-review-to-pdf-operator-export"
                data-pass4550-pdf-package-state={
                  selectedPdfPackage?.status || "not-prepared"
                }
              >
                <div className="pass4550-account-report-pdf-package-head">
                  <span>{t.pdfPackageTitle}</span>
                  <small>{t.pdfPackageBody}</small>
                </div>
                {selectedPdfPackage ? (
                  <div className="pass4550-account-report-pdf-package-grid">
                    <span>
                      <small>{t.packageId}</small>
                      <strong>{selectedPdfPackage.packageId}</strong>
                    </span>
                    <span>
                      <small>{t.pdfPointer}</small>
                      <strong>{selectedPdfPackage.pdfPointer}</strong>
                    </span>
                    <span>
                      <small>{t.operatorQueue}</small>
                      <strong>{selectedPdfPackage.operatorQueue}</strong>
                    </span>
                    <span>
                      <small>{t.state}</small>
                      <strong>
                        {selectedPdfPackage.status === "pdf-ready"
                          ? t.pdfReady
                          : selectedPdfPackage.status ===
                              "operator-review-required"
                            ? t.pdfReview
                            : t.pdfFallback}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <p>{t.noPdfPackage}</p>
                )}
                <div className="pass4550-account-report-pdf-package-lanes">
                  {(
                    selectedPdfPackage?.lanes || [
                      {
                        lane: "detail-review",
                        state: selectedReview?.status || "not-reviewed",
                        proof: selectedReport.vaultPointer,
                      },
                      {
                        lane: "pdf-package",
                        state: "waiting",
                        proof: selectedReport.digest,
                      },
                    ]
                  ).map((lane, index) => (
                    <span
                      key={`${selectedReport.key}-pdf-${lane.lane || index}`}
                    >
                      <b>{lane.lane || "lane"}</b>
                      <em>{lane.state || "pending"}</em>
                      <small>{lane.proof || "proof pending"}</small>
                    </span>
                  ))}
                </div>
                <div className="pass4550-account-report-pdf-package-actions">
                  <button
                    type="button"
                    onClick={() => void preparePdfPackage(selectedReport)}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {copied === `pdf:${selectedReport.key}`
                      ? t.pdfReady
                      : t.preparePdf}
                  </button>
                  {selectedPdfPackage ? (
                    <button
                      type="button"
                      onClick={() => void copyPdfPackage(selectedPdfPackage)}
                    >
                      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      {copied ===
                      `pdf-package:${selectedPdfPackage.vaultPointer}`
                        ? t.pdfPackageCopied
                        : t.copyPdfPackage}
                    </button>
                  ) : null}
                </div>
                <div
                  className="pass4551-account-report-package-delivery"
                  data-pass4551-account-report-package-delivery="pdf-package-to-account-release-checkpoint"
                  data-pass4551-package-delivery-state={
                    selectedPackageDelivery?.status || "not-synced"
                  }
                >
                  <div className="pass4551-account-report-package-delivery-head">
                    <span>{t.packageDeliveryTitle}</span>
                    <small>{t.packageDeliveryBody}</small>
                  </div>
                  {selectedPackageDelivery ? (
                    <div className="pass4551-account-report-package-delivery-grid">
                      <span>
                        <small>{t.deliveryId}</small>
                        <strong>{selectedPackageDelivery.deliveryId}</strong>
                      </span>
                      <span>
                        <small>{t.releaseRoute}</small>
                        <strong>{selectedPackageDelivery.releaseRoute}</strong>
                      </span>
                      <span>
                        <small>{t.reviewGate}</small>
                        <strong>{selectedPackageDelivery.reviewGate}</strong>
                      </span>
                      <span>
                        <small>{t.state}</small>
                        <strong>
                          {selectedPackageDelivery.status === "package-ready"
                            ? t.deliveryReady
                            : selectedPackageDelivery.status ===
                                "operator-review-required"
                              ? t.deliveryReview
                              : selectedPackageDelivery.status ===
                                  "release-queued"
                                ? t.deliveryQueued
                                : t.deliveryFallback}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <p>{t.noPackageDelivery}</p>
                  )}
                  <div className="pass4551-account-report-package-delivery-lanes">
                    {(
                      selectedPackageDelivery?.lanes ||
                      selectedPdfPackage?.lanes || [
                        {
                          lane: "pdf-package",
                          state: selectedPdfPackage
                            ? selectedPdfPackage.status
                            : "waiting",
                          proof: selectedReport.vaultPointer,
                        },
                        {
                          lane: "account-release",
                          state: "waiting",
                          proof: selectedReport.digest,
                        },
                      ]
                    ).map((lane, index) => (
                      <span
                        key={`${selectedReport.key}-delivery-${lane.lane || index}`}
                      >
                        <b>{lane.lane || "lane"}</b>
                        <em>{lane.state || "pending"}</em>
                        <small>{lane.proof || "proof pending"}</small>
                      </span>
                    ))}
                  </div>
                  <div className="pass4551-account-report-package-delivery-actions">
                    {selectedPdfPackage ? (
                      <button
                        type="button"
                        onClick={() =>
                          void syncPackageDelivery(selectedPdfPackage)
                        }
                      >
                        <SendHorizontal
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {copied ===
                        `delivery:${selectedPdfPackage.vaultPointer}`
                          ? t.deliveryQueued
                          : t.syncDelivery}
                      </button>
                    ) : null}
                    {selectedPackageDelivery ? (
                      <button
                        type="button"
                        onClick={() =>
                          void copyPackageDelivery(selectedPackageDelivery)
                        }
                      >
                        <ClipboardCheck
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {copied ===
                        `package-delivery:${selectedPackageDelivery.vaultPointer}`
                          ? t.packageDeliveryCopied
                          : t.copyDelivery}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div
                  className="pass4552-account-report-release-gate"
                  data-pass4552-account-report-release-gate="delivery-checkpoint-to-account-release-receipt"
                  data-pass4552-account-release-state={
                    selectedAccountRelease?.status || "not-synced"
                  }
                >
                  <div className="pass4552-account-report-release-gate-head">
                    <span>{t.releaseGateTitle}</span>
                    <small>{t.releaseGateBody}</small>
                  </div>
                  {selectedAccountRelease ? (
                    <div className="pass4552-account-report-release-gate-grid">
                      <span>
                        <small>{t.releaseId}</small>
                        <strong>{selectedAccountRelease.releaseId}</strong>
                      </span>
                      <span>
                        <small>{t.releasePointer}</small>
                        <strong>{selectedAccountRelease.releasePointer}</strong>
                      </span>
                      <span>
                        <small>{t.reviewGate}</small>
                        <strong>{selectedAccountRelease.reviewGate}</strong>
                      </span>
                      <span>
                        <small>{t.state}</small>
                        <strong>
                          {selectedAccountRelease.status === "release-ready"
                            ? t.releaseReady
                            : selectedAccountRelease.status ===
                                "operator-review-required"
                              ? t.releaseReview
                              : selectedAccountRelease.status ===
                                  "account-release-queued"
                                ? t.releaseQueued
                                : t.releaseFallback}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <p>{t.noAccountRelease}</p>
                  )}
                  <div className="pass4552-account-report-release-gate-lanes">
                    {(
                      selectedAccountRelease?.lanes ||
                      selectedPackageDelivery?.lanes || [
                        {
                          lane: "delivery-checkpoint",
                          state: selectedPackageDelivery
                            ? selectedPackageDelivery.status
                            : "waiting",
                          proof: selectedReport.vaultPointer,
                        },
                        {
                          lane: "account-release",
                          state: "waiting",
                          proof: selectedReport.digest,
                        },
                      ]
                    ).map((lane, index) => (
                      <span
                        key={`${selectedReport.key}-release-${lane.lane || index}`}
                      >
                        <b>{lane.lane || "lane"}</b>
                        <em>{lane.state || "pending"}</em>
                        <small>{lane.proof || "proof pending"}</small>
                      </span>
                    ))}
                  </div>
                  <div className="pass4552-account-report-release-gate-actions">
                    {selectedPackageDelivery ? (
                      <button
                        type="button"
                        onClick={() =>
                          void syncAccountRelease(selectedPackageDelivery)
                        }
                      >
                        <SendHorizontal
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {copied ===
                        `release:${selectedPackageDelivery.vaultPointer}`
                          ? t.releaseQueued
                          : t.syncRelease}
                      </button>
                    ) : null}
                    {selectedAccountRelease ? (
                      <button
                        type="button"
                        onClick={() =>
                          void copyAccountRelease(selectedAccountRelease)
                        }
                      >
                        <ClipboardCheck
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {copied ===
                        `account-release:${selectedAccountRelease.vaultPointer}`
                          ? t.accountReleaseCopied
                          : t.copyRelease}
                      </button>
                    ) : null}
                  </div>
                  <div
                    className="pass4553-account-customer-release-receipt"
                    data-pass4553-account-customer-release-receipt="account-release-to-customer-visible-download-manifest"
                    data-pass4553-customer-receipt-state={
                      selectedCustomerReceipt?.status || "not-prepared"
                    }
                  >
                    <div className="pass4553-account-customer-release-receipt-head">
                      <span>{t.customerReceiptTitle}</span>
                      <small>{t.customerReceiptBody}</small>
                    </div>
                    {selectedCustomerReceipt ? (
                      <div className="pass4553-account-customer-release-receipt-grid">
                        <span>
                          <small>{t.customerReceiptId}</small>
                          <strong>
                            {selectedCustomerReceipt.customerReceiptId}
                          </strong>
                        </span>
                        <span>
                          <small>{t.customerRoute}</small>
                          <strong>
                            {selectedCustomerReceipt.customerRoute}
                          </strong>
                        </span>
                        <span>
                          <small>{t.downloadPointer}</small>
                          <strong>
                            {selectedCustomerReceipt.downloadPointer}
                          </strong>
                        </span>
                        <span>
                          <small>{t.state}</small>
                          <strong>
                            {selectedCustomerReceipt.status ===
                            "customer-visible-ready"
                              ? t.customerReceiptReady
                              : selectedCustomerReceipt.status ===
                                  "operator-review-required"
                                ? t.customerReceiptReview
                                : selectedCustomerReceipt.status ===
                                    "release-pending"
                                  ? t.customerReceiptPending
                                  : t.customerReceiptFallback}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <p>{t.noCustomerReceipt}</p>
                    )}
                    <div className="pass4553-account-customer-release-receipt-lanes">
                      {(
                        selectedCustomerReceipt?.lanes ||
                        selectedAccountRelease?.lanes || [
                          {
                            lane: "account-release",
                            state: selectedAccountRelease
                              ? selectedAccountRelease.status
                              : "waiting",
                            proof: selectedReport.vaultPointer,
                          },
                          {
                            lane: "customer-receipt",
                            state: "waiting",
                            proof: selectedReport.digest,
                          },
                        ]
                      ).map((lane, index) => (
                        <span
                          key={`${selectedReport.key}-customer-receipt-${lane.lane || index}`}
                        >
                          <b>{lane.lane || "lane"}</b>
                          <em>{lane.state || "pending"}</em>
                          <small>{lane.proof || "proof pending"}</small>
                        </span>
                      ))}
                    </div>
                    <div className="pass4553-account-customer-release-receipt-actions">
                      {selectedAccountRelease ? (
                        <button
                          type="button"
                          onClick={() =>
                            void syncCustomerReceipt(selectedAccountRelease)
                          }
                        >
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          {copied ===
                          `customer-receipt:${selectedAccountRelease.vaultPointer}`
                            ? t.customerReceiptReady
                            : t.syncCustomerReceipt}
                        </button>
                      ) : null}
                      {selectedCustomerReceipt ? (
                        <button
                          type="button"
                          onClick={() =>
                            void copyCustomerReceipt(selectedCustomerReceipt)
                          }
                        >
                          <ClipboardCheck
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          {copied ===
                          `customer-receipt-copy:${selectedCustomerReceipt.vaultPointer}`
                            ? t.customerReceiptCopied
                            : t.copyCustomerReceipt}
                        </button>
                      ) : null}
                    </div>
                    <div
                      className="pass4554-account-download-manifest"
                      data-pass4554-account-download-manifest="customer-receipt-to-metadata-download-gate"
                      data-pass4554-download-manifest-state={
                        selectedDownloadManifest?.status || "not-prepared"
                      }
                    >
                      <div className="pass4554-account-download-manifest-head">
                        <span>{t.downloadManifestTitle}</span>
                        <small>{t.downloadManifestBody}</small>
                      </div>
                      {selectedDownloadManifest ? (
                        <div className="pass4554-account-download-manifest-grid">
                          <span>
                            <small>{t.downloadManifestId}</small>
                            <strong>
                              {selectedDownloadManifest.downloadManifestId}
                            </strong>
                          </span>
                          <span>
                            <small>{t.downloadRoute}</small>
                            <strong>
                              {selectedDownloadManifest.downloadRoute}
                            </strong>
                          </span>
                          <span>
                            <small>{t.checksum}</small>
                            <strong>{selectedDownloadManifest.checksum}</strong>
                          </span>
                          <span>
                            <small>{t.state}</small>
                            <strong>
                              {selectedDownloadManifest.status ===
                              "download-manifest-ready"
                                ? t.downloadManifestReady
                                : selectedDownloadManifest.status ===
                                    "operator-review-required"
                                  ? t.downloadManifestReview
                                  : selectedDownloadManifest.status ===
                                      "customer-release-pending"
                                    ? t.downloadManifestPending
                                    : t.downloadManifestFallback}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <p>{t.noDownloadManifest}</p>
                      )}
                      <div className="pass4554-account-download-manifest-lanes">
                        {(
                          selectedDownloadManifest?.lanes ||
                          selectedCustomerReceipt?.lanes || [
                            {
                              lane: "customer-receipt",
                              state: selectedCustomerReceipt
                                ? selectedCustomerReceipt.status
                                : "waiting",
                              proof: selectedReport.vaultPointer,
                            },
                            {
                              lane: "download-manifest",
                              state: "waiting",
                              proof: selectedReport.digest,
                            },
                          ]
                        ).map((lane, index) => (
                          <span
                            key={`${selectedReport.key}-download-manifest-${lane.lane || index}`}
                          >
                            <b>{lane.lane || "lane"}</b>
                            <em>{lane.state || "pending"}</em>
                            <small>{lane.proof || "proof pending"}</small>
                          </span>
                        ))}
                      </div>
                      <div className="pass4554-account-download-manifest-actions">
                        {selectedCustomerReceipt ? (
                          <button
                            type="button"
                            onClick={() =>
                              void syncDownloadManifest(selectedCustomerReceipt)
                            }
                          >
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            {copied ===
                            `download-manifest:${selectedCustomerReceipt.vaultPointer}`
                              ? t.downloadManifestReady
                              : t.syncDownloadManifest}
                          </button>
                        ) : null}
                        {selectedDownloadManifest ? (
                          <button
                            type="button"
                            onClick={() =>
                              void copyDownloadManifest(
                                selectedDownloadManifest,
                              )
                            }
                          >
                            <ClipboardCheck
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            {copied ===
                            `download-manifest-copy:${selectedDownloadManifest.vaultPointer}`
                              ? t.downloadManifestCopied
                              : t.copyDownloadManifest}
                          </button>
                        ) : null}
                      </div>
                      <div
                        className="pass4555-account-download-access-capsule"
                        data-pass4555-account-download-access-capsule="download-manifest-to-short-lived-access-token-gate"
                        data-pass4555-download-access-state={
                          selectedDownloadAccess?.status || "not-prepared"
                        }
                      >
                        <div className="pass4555-account-download-access-capsule-head">
                          <span>{t.downloadAccessTitle}</span>
                          <small>{t.downloadAccessBody}</small>
                        </div>
                        {selectedDownloadAccess ? (
                          <div className="pass4555-account-download-access-capsule-grid">
                            <span>
                              <small>{t.accessCapsuleId}</small>
                              <strong>
                                {selectedDownloadAccess.accessCapsuleId}
                              </strong>
                            </span>
                            <span>
                              <small>{t.accessRoute}</small>
                              <strong>
                                {selectedDownloadAccess.accessRoute}
                              </strong>
                            </span>
                            <span>
                              <small>{t.accessTokenId}</small>
                              <strong>
                                {selectedDownloadAccess.accessTokenId}
                              </strong>
                            </span>
                            <span>
                              <small>{t.expiresAt}</small>
                              <strong>
                                {selectedDownloadAccess.expiresAt}
                              </strong>
                            </span>
                            <span>
                              <small>{t.consumptionPolicy}</small>
                              <strong>
                                {selectedDownloadAccess.consumptionPolicy}
                              </strong>
                            </span>
                            <span>
                              <small>{t.state}</small>
                              <strong>
                                {selectedDownloadAccess.status ===
                                "access-token-ready"
                                  ? t.downloadAccessReady
                                  : selectedDownloadAccess.status ===
                                      "operator-review-required"
                                    ? t.downloadAccessReview
                                    : selectedDownloadAccess.status ===
                                        "download-manifest-pending"
                                      ? t.downloadAccessPending
                                      : t.downloadAccessFallback}
                              </strong>
                            </span>
                          </div>
                        ) : (
                          <p>{t.noDownloadAccess}</p>
                        )}
                        <div className="pass4555-account-download-access-capsule-lanes">
                          {(
                            selectedDownloadAccess?.lanes ||
                            selectedDownloadManifest?.lanes || [
                              {
                                lane: "download-manifest",
                                state: selectedDownloadManifest
                                  ? selectedDownloadManifest.status
                                  : "waiting",
                                proof: selectedReport.vaultPointer,
                              },
                              {
                                lane: "access-capsule",
                                state: "waiting",
                                proof: selectedReport.digest,
                              },
                            ]
                          ).map((lane, index) => (
                            <span
                              key={`${selectedReport.key}-download-access-${lane.lane || index}`}
                            >
                              <b>{lane.lane || "lane"}</b>
                              <em>{lane.state || "pending"}</em>
                              <small>{lane.proof || "proof pending"}</small>
                            </span>
                          ))}
                        </div>
                        <div className="pass4555-account-download-access-capsule-actions">
                          {selectedDownloadManifest ? (
                            <button
                              type="button"
                              onClick={() =>
                                void syncDownloadAccess(
                                  selectedDownloadManifest,
                                )
                              }
                            >
                              <ShieldCheck
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {copied ===
                              `download-access:${selectedDownloadManifest.vaultPointer}`
                                ? t.downloadAccessReady
                                : t.syncDownloadAccess}
                            </button>
                          ) : null}
                          {selectedDownloadAccess ? (
                            <button
                              type="button"
                              onClick={() =>
                                void copyDownloadAccess(selectedDownloadAccess)
                              }
                            >
                              <ClipboardCheck
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {copied ===
                              `download-access-copy:${selectedDownloadAccess.vaultPointer}`
                                ? t.downloadAccessCopied
                                : t.copyDownloadAccess}
                            </button>
                          ) : null}
                        </div>
                        <div
                          className="pass4556-account-download-consumption-ledger"
                          data-pass4556-account-download-consumption-ledger="one-time-access-capsule-consumption-receipt"
                          data-pass4556-download-consumption-state={
                            selectedDownloadConsumption?.status ||
                            "not-consumed"
                          }
                        >
                          <div className="pass4556-account-download-consumption-ledger-head">
                            <span>{t.consumptionTitle}</span>
                            <small>{t.consumptionBody}</small>
                          </div>
                          {selectedDownloadConsumption ? (
                            <div className="pass4556-account-download-consumption-ledger-grid">
                              <span>
                                <small>{t.consumptionId}</small>
                                <strong>
                                  {selectedDownloadConsumption.consumptionId}
                                </strong>
                              </span>
                              <span>
                                <small>{t.consumedAt}</small>
                                <strong>
                                  {selectedDownloadConsumption.consumedAt}
                                </strong>
                              </span>
                              <span>
                                <small>{t.downloadSessionId}</small>
                                <strong>
                                  {
                                    selectedDownloadConsumption.downloadSessionId
                                  }
                                </strong>
                              </span>
                              <span>
                                <small>{t.downloadAuditHash}</small>
                                <strong>
                                  {
                                    selectedDownloadConsumption.downloadAuditHash
                                  }
                                </strong>
                              </span>
                              <span>
                                <small>{t.state}</small>
                                <strong>
                                  {selectedDownloadConsumption.status ===
                                  "download-consumed"
                                    ? t.consumptionReady
                                    : selectedDownloadConsumption.status ===
                                        "operator-review-required"
                                      ? t.consumptionReview
                                      : selectedDownloadConsumption.status ===
                                          "access-expired"
                                        ? t.consumptionExpired
                                        : selectedDownloadConsumption.status ===
                                            "access-pending"
                                          ? t.consumptionPending
                                          : t.consumptionFallback}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <p>{t.noConsumption}</p>
                          )}
                          <div className="pass4556-account-download-consumption-ledger-lanes">
                            {(
                              selectedDownloadConsumption?.lanes ||
                              selectedDownloadAccess?.lanes || [
                                {
                                  lane: "access-capsule",
                                  state: selectedDownloadAccess
                                    ? selectedDownloadAccess.status
                                    : "waiting",
                                  proof: selectedReport.vaultPointer,
                                },
                                {
                                  lane: "consumption-ledger",
                                  state: "waiting",
                                  proof: selectedReport.digest,
                                },
                              ]
                            ).map((lane, index) => (
                              <span
                                key={`${selectedReport.key}-download-consumption-${lane.lane || index}`}
                              >
                                <b>{lane.lane || "lane"}</b>
                                <em>{lane.state || "pending"}</em>
                                <small>{lane.proof || "proof pending"}</small>
                              </span>
                            ))}
                          </div>
                          <div className="pass4556-account-download-consumption-ledger-actions">
                            {selectedDownloadAccess ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void consumeDownloadAccess(
                                    selectedDownloadAccess,
                                  )
                                }
                              >
                                <DatabaseZap
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `download-consumption:${selectedDownloadAccess.vaultPointer}`
                                  ? t.consumptionReady
                                  : t.consumeAccess}
                              </button>
                            ) : null}
                            {selectedDownloadConsumption ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyDownloadConsumption(
                                    selectedDownloadConsumption,
                                  )
                                }
                              >
                                <ClipboardCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `download-consumption-copy:${selectedDownloadConsumption.vaultPointer}`
                                  ? t.consumptionCopied
                                  : t.copyConsumption}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className="pass4557-account-download-closeout-receipt"
                          data-pass4557-account-download-closeout-receipt="consumption-ledger-to-session-finalization-revocation"
                          data-pass4557-download-closeout-state={
                            selectedDownloadCloseout?.status || "not-closed"
                          }
                        >
                          <div className="pass4557-account-download-closeout-receipt-head">
                            <span>{t.closeoutTitle}</span>
                            <small>{t.closeoutBody}</small>
                          </div>
                          {selectedDownloadCloseout ? (
                            <div className="pass4557-account-download-closeout-receipt-grid">
                              <span>
                                <small>{t.closeoutId}</small>
                                <strong>{selectedDownloadCloseout.closeoutId}</strong>
                              </span>
                              <span>
                                <small>{t.closedAt}</small>
                                <strong>{selectedDownloadCloseout.closedAt}</strong>
                              </span>
                              <span>
                                <small>{t.sessionFinalizedHash}</small>
                                <strong>
                                  {selectedDownloadCloseout.sessionFinalizedHash}
                                </strong>
                              </span>
                              <span>
                                <small>{t.revokePolicy}</small>
                                <strong>{selectedDownloadCloseout.revokePolicy}</strong>
                              </span>
                              <span>
                                <small>{t.state}</small>
                                <strong>
                                  {selectedDownloadCloseout.status ===
                                  "download-closed"
                                    ? t.closeoutReady
                                    : selectedDownloadCloseout.status ===
                                        "operator-review-required"
                                      ? t.closeoutReview
                                      : selectedDownloadCloseout.status ===
                                          "consumption-pending"
                                        ? t.closeoutPending
                                        : selectedDownloadCloseout.status ===
                                            "session-revoked"
                                          ? t.closeoutRevoked
                                          : t.closeoutFallback}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <p>{t.noCloseout}</p>
                          )}
                          <div className="pass4557-account-download-closeout-receipt-lanes">
                            {(
                              selectedDownloadCloseout?.lanes ||
                              selectedDownloadConsumption?.lanes || [
                                {
                                  lane: "download-consumption",
                                  state: selectedDownloadConsumption
                                    ? selectedDownloadConsumption.status
                                    : "waiting",
                                  proof: selectedReport.vaultPointer,
                                },
                                {
                                  lane: "session-closeout",
                                  state: "waiting",
                                  proof: selectedReport.digest,
                                },
                              ]
                            ).map((lane, index) => (
                              <span
                                key={`${selectedReport.key}-download-closeout-${lane.lane || index}`}
                              >
                                <b>{lane.lane || "lane"}</b>
                                <em>{lane.state || "pending"}</em>
                                <small>{lane.proof || "proof pending"}</small>
                              </span>
                            ))}
                          </div>
                          <div className="pass4557-account-download-closeout-receipt-actions">
                            {selectedDownloadConsumption ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void syncDownloadCloseout(
                                    selectedDownloadConsumption,
                                  )
                                }
                              >
                                <CheckCircle2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `download-closeout:${selectedDownloadConsumption.vaultPointer}`
                                  ? t.closeoutReady
                                  : t.syncCloseout}
                              </button>
                            ) : null}
                            {selectedDownloadCloseout ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyDownloadCloseout(
                                    selectedDownloadCloseout,
                                  )
                                }
                              >
                                <ClipboardCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `download-closeout-copy:${selectedDownloadCloseout.vaultPointer}`
                                  ? t.closeoutCopied
                                  : t.copyCloseout}
                              </button>
                            ) : null}
                          </div>
                        <div
                          className="pass4558-account-post-closeout-attestation"
                          data-pass4558-account-post-closeout-attestation="closeout-to-proof-index-archive-retention"
                          data-pass4558-post-closeout-attestation-state={
                            selectedPostCloseoutAttestation?.status ||
                            "not-attested"
                          }
                        >
                          <div className="pass4558-account-post-closeout-attestation-head">
                            <span>{t.attestationTitle}</span>
                            <small>{t.attestationBody}</small>
                          </div>
                          {selectedPostCloseoutAttestation ? (
                            <div className="pass4558-account-post-closeout-attestation-grid">
                              <span>
                                <small>{t.attestationId}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.attestationId}
                                </strong>
                              </span>
                              <span>
                                <small>{t.attestedAt}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.attestedAt}
                                </strong>
                              </span>
                              <span>
                                <small>{t.publicProofPointer}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.publicProofPointer}
                                </strong>
                              </span>
                              <span>
                                <small>{t.archiveRoute}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.archiveRoute}
                                </strong>
                              </span>
                              <span>
                                <small>{t.retentionPolicy}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.retentionPolicy}
                                </strong>
                              </span>
                              <span>
                                <small>{t.state}</small>
                                <strong>
                                  {selectedPostCloseoutAttestation.status ===
                                  "post-closeout-attested"
                                    ? t.attestationReady
                                    : selectedPostCloseoutAttestation.status ===
                                        "operator-review-required"
                                      ? t.attestationReview
                                      : selectedPostCloseoutAttestation.status ===
                                          "closeout-pending"
                                        ? t.attestationPending
                                        : t.attestationFallback}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <p>{t.noAttestation}</p>
                          )}
                          <div className="pass4558-account-post-closeout-attestation-lanes">
                            {(
                              selectedPostCloseoutAttestation?.lanes ||
                              selectedDownloadCloseout?.lanes || [
                                {
                                  lane: "download-closeout",
                                  state: selectedDownloadCloseout
                                    ? selectedDownloadCloseout.status
                                    : "waiting",
                                  proof: selectedReport.vaultPointer,
                                },
                                {
                                  lane: "proof-index",
                                  state: "waiting",
                                  proof: selectedReport.digest,
                                },
                              ]
                            ).map((lane, index) => (
                              <span
                                key={`${selectedReport.key}-post-closeout-attestation-${lane.lane || index}`}
                              >
                                <b>{lane.lane || "lane"}</b>
                                <em>{lane.state || "pending"}</em>
                                <small>{lane.proof || "proof pending"}</small>
                              </span>
                            ))}
                          </div>
                          <div className="pass4558-account-post-closeout-attestation-actions">
                            {selectedDownloadCloseout ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void syncPostCloseoutAttestation(
                                    selectedDownloadCloseout,
                                  )
                                }
                              >
                                <ShieldCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `post-closeout-attestation:${selectedDownloadCloseout.vaultPointer}`
                                  ? t.attestationReady
                                  : t.syncAttestation}
                              </button>
                            ) : null}
                            {selectedPostCloseoutAttestation ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyPostCloseoutAttestation(
                                    selectedPostCloseoutAttestation,
                                  )
                                }
                              >
                                <ClipboardCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `post-closeout-attestation-copy:${selectedPostCloseoutAttestation.vaultPointer}`
                                  ? t.attestationCopied
                                  : t.copyAttestation}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className="pass4559-account-public-proof-index"
                          data-pass4559-account-public-proof-index="attestation-to-redacted-transparency-route"
                          data-pass4559-public-proof-index-state={
                            selectedPublicProofIndex?.status || "not-indexed"
                          }
                        >
                          <div className="pass4559-account-public-proof-index-head">
                            <span>{t.proofIndexTitle}</span>
                            <small>{t.proofIndexBody}</small>
                          </div>
                          {selectedPublicProofIndex ? (
                            <div className="pass4559-account-public-proof-index-grid">
                              <span>
                                <small>{t.publicIndexId}</small>
                                <strong>{selectedPublicProofIndex.publicIndexId}</strong>
                              </span>
                              <span>
                                <small>{t.indexedAt}</small>
                                <strong>{selectedPublicProofIndex.indexedAt}</strong>
                              </span>
                              <span>
                                <small>{t.transparencyRoute}</small>
                                <strong>{selectedPublicProofIndex.transparencyRoute}</strong>
                              </span>
                              <span>
                                <small>{t.proofDigest}</small>
                                <strong>{selectedPublicProofIndex.proofDigest}</strong>
                              </span>
                              <span>
                                <small>{t.redactionPolicy}</small>
                                <strong>{selectedPublicProofIndex.redactionPolicy}</strong>
                              </span>
                              <span>
                                <small>{t.state}</small>
                                <strong>
                                  {selectedPublicProofIndex.status === "public-proof-indexed"
                                    ? t.proofIndexReady
                                    : selectedPublicProofIndex.status === "operator-review-required"
                                      ? t.proofIndexReview
                                      : selectedPublicProofIndex.status === "attestation-pending"
                                        ? t.proofIndexPending
                                        : t.proofIndexFallback}
                                </strong>
                              </span>
                            </div>
                          ) : (
                            <p>{t.noProofIndex}</p>
                          )}
                          <div className="pass4559-account-public-proof-index-lanes">
                            {(
                              selectedPublicProofIndex?.lanes ||
                              selectedPostCloseoutAttestation?.lanes || [
                                {
                                  lane: "post-closeout-attestation",
                                  state: selectedPostCloseoutAttestation
                                    ? selectedPostCloseoutAttestation.status
                                    : "waiting",
                                  proof: selectedReport.vaultPointer,
                                },
                                {
                                  lane: "public-proof-index",
                                  state: "waiting",
                                  proof: selectedReport.digest,
                                },
                              ]
                            ).map((lane, index) => (
                              <span
                                key={`${selectedReport.key}-public-proof-index-${lane.lane || index}`}
                              >
                                <b>{lane.lane || "lane"}</b>
                                <em>{lane.state || "pending"}</em>
                                <small>{lane.proof || "proof pending"}</small>
                              </span>
                            ))}
                          </div>
                          <div className="pass4559-account-public-proof-index-actions">
                            {selectedPostCloseoutAttestation ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void syncPublicProofIndex(
                                    selectedPostCloseoutAttestation,
                                  )
                                }
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                                {copied ===
                                `public-proof-index:${selectedPostCloseoutAttestation.vaultPointer}`
                                  ? t.proofIndexReady
                                  : t.syncProofIndex}
                              </button>
                            ) : null}
                            {selectedPublicProofIndex ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void copyPublicProofIndex(selectedPublicProofIndex)
                                }
                              >
                                <ClipboardCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {copied ===
                                `public-proof-index-copy:${selectedPublicProofIndex.vaultPointer}`
                                  ? t.proofIndexCopied
                                  : t.copyProofIndex}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div className="pass4549-account-report-detail-lanes">
              <small>{t.handoff}</small>
              {(selectedReview?.lanes || selectedReport.lanes || []).map(
                (lane, index) => (
                  <span
                    key={`${selectedReport.key}-detail-${lane.lane || index}`}
                  >
                    <b>{lane.lane || "lane"}</b>
                    <em>{lane.state || "pending"}</em>
                    <small>{lane.proof || "proof pending"}</small>
                  </span>
                ),
              )}
              {selectedReview?.serverAck ? (
                <strong>{selectedReview.serverAck}</strong>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="pass4549-account-report-detail-empty">
            {t.noSelection}
          </p>
        )}
      </div>
    </section>
  );
}
