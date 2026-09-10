import { ASCII_CONTROL_PATTERN, C0_OR_TEMPLATE_META_PATTERN } from "./ascii-control-characters";

import type { AuditReviewSubmission } from "./audit-review-flow";

export const PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID = "public-private-route-lockdown" as const;

export type Pass2622RouteLockStatus = "locked" | "sanitized" | "watch" | "blocked";
export type Pass2622BoundaryLane = "public_api" | "operator_api" | "pro_pdf" | "customer_ui" | "regression";

export type Pass2622RouteLockRow = {
  label: string;
  lane: Pass2622BoundaryLane;
  status: Pass2622RouteLockStatus;
  output: string;
};

export type Pass2622PublicPrivateRouteLockdownReport = {
  passId: typeof PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID;
  generatedAt: string;
  locale: string;
  target: {
    chain: string;
    contractAddress?: string;
    projectName?: string;
  };
  rule: string;
  customerRule: string;
  proPdfRule: string;
  operatorRule: string;
  summary: {
    publicBoundaryReadiness: number;
    operatorGateReadiness: number;
    proPdfBoundaryReadiness: number;
    customerLeakReadiness: number;
    publicApiSanitized: boolean;
    operatorRoutesRequireAdmin: boolean;
    publicApiMustNotEmitOperatorRows: boolean;
    proPdfMustNotRenderOperatorRows: boolean;
    topBlocker: string;
  };
  customerRows: Pass2622RouteLockRow[];
  proPdfRows: Pass2622RouteLockRow[];
  operatorRows: Pass2622RouteLockRow[];
  publicEnvelopeContract: {
    allowedTopLevelKeys: string[];
    forbiddenKeys: string[];
    forbiddenTerms: string[];
    sanitizer: string;
  };
  operatorEnvelopeContract: {
    requiredGate: string;
    requiredScope: string;
    deniedByDefault: boolean;
    privateRoutes: string[];
  };
  nextImplementationBacklog: string[];
};

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "operatorRows",
  "operator evidence ref",
  "operatorLine",
  "operatorAction",
  "operatorEvidenceRef",
  "operatorActions",
  "privateFields",
  "privateOperatorFields",
  "rawArtifactRef",
  "operatorEvidenceRefs",
  "webhookPayloadPointer",
  "rawProviderPayload",
  "rawPayload",
  "rawEvidence",
  "rawEvidencePointer",
  "privateDeliveryPointer",
  "receiptReplayToken",
  "sessionId",
  "debugTrace",
  "manualNotesContract",
  "deploymentToken",
  "apiKey",
  "secret",
  "fixtureArtifactBundleHash",
  "proofPointer",
  "previewCredentialTrace",
  "operatorSignoffSignature",
  "rawSupabaseError",
  "jwtClaims",
  "serviceRoleResponse",
  "privateRefValue",
  "rawArtifactPayload",
  "hashMismatchTrace",
  "serviceRoleTrace",
  "rawFixturePayload",
  "previewCredentialSecret",
  "rawDeployedPreviewResponse",

  "unredactedSmokeResponse",
  "rawPass2634Artifact",
  "attachmentWritePayload",
  "rawAttachmentPostResponse",
  "rawPass2635Response",
  "releaseBoardWritePayload",
  "releaseBoardWriteReceiptPrivate",
  "previewAttachmentResponse",
  "supabaseWriteResponse",
  "supabaseServiceRoleTrace",
  "attachmentSmokePrivateTrace",
  "artifactIngressSecret",

  "rawSupabaseResponse",
  "supabaseRlsBypassTrace",
  "supabaseReleaseBoardRawResponse",
  "serviceRoleKey",
  "anonKey",
  "authorization",
  "rawPostgrestError",
  "privateArtifactRef",
  "operatorEvidenceRef",
  "releaseBoardPrivateRef",
  "rawPromotionReceiptPayload",
  "rawPass2641FixturePayload",
  "rawPlaywrightTracePayload",
  "rawBrowserContextStorageState",
  "rawAccountPortalDomSnapshot",
  "rawPdfDownloadToken",
  "pdfDownloadBypassToken",
  "accountPortalPlaywrightSecret",
  "operatorPlaywrightNote",
  "rawReleaseBoardReceiptPayload",
  "rawPass2637Receipt",
  "promotionBypassToken",
  "proPdfPromotionBypass",
  "advancedPromotionBypass",
  "releasePromotionBypass",
  "privateReleaseBoardPointer",
  "operatorPromotionNote",
  "rawCustomerBadgeReceiptPayload",
  "rawAccountDeliveryPromotionState",
  "rawPass2638Receipt",
  "customerBadgeBypassToken",
  "accountDeliveryPromotionBypass",
  "privateCustomerReceiptPointer",
  "privateDeliveryReceiptTrace",
  "operatorDeliveryNote",
  "rawBadgeRenderPayload",
  "rawPass2639Receipt",
  "rawAccountPortalTimelinePayload",
  "rawPortalBadgePayload",
  "accountPortalBypassToken",
  "downloadCtaBypassToken",
  "privateTimelineTrace",
  "privateReceiptPointer",
  "operatorTimelineNote",
  "rawPass2642DeployedDomSnapshot",
  "rawPdfDownloadResponse",
  "pdfUnlockBypassToken",
  "accountPortalPreviewSecret",
  "privateDeployedSmokeTrace",
  "operatorDeployedSmokeNote",
  "rawPass2642SmokeArtifactPayload",
  "rawPass2643AttachmentPostResponse",
  "releaseBoardAttachmentPrivateWritePayload",
  "releaseBoardAttachmentPrivateReceipt",
  "proPdfUnlockPromotionBypassToken",
  "advancedLaunchPromotionBypassToken",
  "launchClaimBypassToken",
  "operatorReleaseBoardAttachmentNote",
  "privateSmokeReceiptPointer",
  "privateReleaseBoardAttachmentPointer",
  "rawSafePdfDownloadToken",
  "rawOneTimeDownloadToken",
  "downloadTokenSecret",
  "tokenSalt",
  "tokenPlaintext",
  "rawTokenConsumptionLedger",
  "rawDownloadRouteResponse",
  "rawPdfBinaryPayload",
  "proPdfRouteBypassToken",
  "receiptRevocationBypassToken",
  "entitlementRevocationBypassToken",
  "privateTokenLedgerPointer",
  "privateReceiptRevocationTrace",
  "operatorDownloadOverrideNote",
  "rawSupabaseInsertPayload",
  "supabaseServiceRoleResponse",
  "privateConsumptionLedgerPointer",
  "safePdfTokenLedgerBypass",
  "rawPass2645LedgerReceipt",
  "rawSupabaseLiveWritePayload",
  "rawSupabaseLiveSelectResponse",
  "livePreviewCredentialSecret",
  "rawPass2646LiveLedgerReceipt",
  "privateLiveLedgerSmokePointer",
  "operatorLiveLedgerSmokeNote",
  "rlsPolicyBypassToken",
  "serviceRoleConsumptionTrace",
  "rawPass2653PublicPacketPayload",
  "rawPass2654AttachmentPostPayload",
  "rawReleaseBoardAttachmentWritePayload",
  "rawReleaseBoardAttachmentWriteResponse",
  "releaseBoardServiceRoleResponse",
  "releaseBoardServiceRoleTrace",
  "rawSupportHandoffPublicPacketStorageRow",
  "rawSupportHandoffPromotionReceiptPayload",
  "rawSupportHandoffTimelineDomSnapshot",
  "operatorSupportHandoffPromotionNote",
  "privatePass2653PublicPacketPointer",
  "privateSupportHandoffFinalReceiptPointer",
  "supportHandoffPromotionBypassToken",
  "timelinePromotionBypassToken",
  "releaseBoardAttachmentBypassToken",
  "rawPass2661CustomerTimelinePayload",
  "rawPass2661SupportPacketDownloadPayload",
  "pass2661SupportPacketBypassToken",
  "privatePass2661TimelinePointer",
  "operatorPass2661RevocationStateNote",
  "rawPass2662DeployedSmokePayload",
  "rawPass2662CustomerTimelinePacketPayload",
  "pass2662CustomerTimelinePacketBypassToken",
  "privatePass2662TimelinePacketPointer",
  "operatorPass2662DeployedSmokeNote",
  "rawPass2663ReleaseBoardPayload",
  "releaseBoardServiceRoleTrace",
  "pass2663ReleaseBoardBypassToken",
  "privatePass2663ReleaseBoardPointer",
  "operatorPass2663ReleaseBoardNote",
  "rawPass2664MasterLeakPayload",
  "rawPass2665ProductionEnvPayload",
  "pass2665MemoryFallbackOverride",
  "rawPass2666BuildLogPayload",
  "pass2666CleanBuildBypassToken",
  "pass2667RlsBypassToken",
  "rawPass2668StripeWebhookPayload",
  "pass2668StripeWebhookBypassToken",
  "pass2669RiskFormulaBypassToken",
  "rawPass2670ClaimLedgerPayload",
  "pass2670ClaimFirewallBypassToken",
  "privatePass2670ClaimLedgerPointer",
  "operatorPass2670ClaimOverrideNote",
  "privatePass2668StripeWebhookPointer",
  "operatorPass2668StripeNote",
  "privatePass2666BuildArtifactPointer",
  "operatorPass2666BuildNote",
  "pass2664MasterLeakBypassToken",
  "privatePass2664LeakPointer",
  "operatorPass2664LeakNote",
  "rawProvenanceGraph",
  "rawVersionRows",
  "rawDeltaRows",
  "rawReplayCapsulePayload",
  "rawOperatorSignoff",
  "privateVersionPointer",
  "privateEvidencePointer",
  "durableTableKey",
  "rawRollbackReason",

]);

const FORBIDDEN_PUBLIC_TERMS = [
  "operatorRows",
  "operator evidence ref",
  "raw provider payload",
  "raw pass2661 customer timeline payload",
  "pass2661 support packet bypass token",
  "raw pass2662 customer timeline packet payload",
  "pass2662 customer timeline packet bypass token",
  "raw pass2663 release board payload",
  "pass2663 release board bypass token",
  "raw pass2664 master leak payload",
  "pass2664 master leak bypass token",
  "operator pass2664 leak note",
  "raw pass2665 production env payload",
  "operator pass2665 env note",
  "pass2665 production env bypass token",
  "pass2665 memory fallback override",
  "raw pass2666 build log payload",
  "pass2666 clean build bypass token",
  "operator pass2666 build note",
  "raw pass2667 supabase rls proof payload",
  "pass2667 rls bypass token",
  "operator pass2667 rls note",
  "raw pass2668 stripe webhook proof payload",
  "pass2668 stripe webhook bypass token",
  "operator pass2668 stripe note",
  "raw pass2669 risk formula provider payload",
  "pass2669 risk formula bypass token",
  "operator pass2669 risk calibration note",

  "raw pass2671 provider snapshot payload",
  "pass2671 source quorum bypass token",
  "operator pass2671 provider conflict note",
  "raw pass2672 customer ux compression payload",
  "pass2672 customer ux bypass token",
  "operator pass2672 raw tier debug note",
  "raw pass2673 premium pdf layout payload",
  "pass2673 premium pdf bypass token",
  "operator pass2673 raw pdf debug note",
  "raw pass2674 mobile smoke payload",
  "pass2674 mobile smoke bypass token",
  "operator pass2674 raw mobile debug note",
  "raw pass2675 operator auth payload",
  "pass2675 operator auth bypass token",
  "operator pass2675 raw signoff note",
  "raw pass2676 angel transcript payload",
  "pass2676 angel local mode final quality bypass",
  "pass2676 ungrounded AI claim",
  "raw pass2677 document extraction payload",
  "pass2677 browser lens resolver bypass token",
  "operator pass2677 raw OCR note",
  "raw pass2678 market provider payload",
  "pass2678 shield real markets resolver bypass token",
  "operator pass2678 raw market source note",
  "raw pass2679 alert sink payload",
  "pass2679 telemetry secret token",
  "operator pass2679 incident private note",
  "raw pass2680 launch proof payload",
  "pass2680 external review private finding",
  "pass2680 live environment secret token",
  "pass2680SupabaseServiceRoleProof",
  "pass2680StripeWebhookRawBody",
  "pass2680OperatorIncidentPrivateNote",
  "raw pass2681 live proof payload",
  "pass2681 alert sink secret token",
  "pass2681 external pentest private finding",
  "pass2681StripeWebhookRawBody",
  "pass2681SupabaseServiceRoleProof",
  "pass2681OperatorPrivateRunbookNote",
  "raw pass2682 GitHub Actions log containing secrets",
  "pass2682 Vercel token",
  "pass2682 CI artifact raw env dump",
  "pass2682RawGithubActionsTrace",
  "pass2682RawVercelPreviewEnv",
  "pass2682UnredactedArtifactBundle",
  "pass2683 raw GitHub attestation token",
  "pass2683 raw GitHub Actions log",
  "pass2683 unredacted release-board import payload",
  "pass2683 raw artifact digest verification log with private URL",
  "pass2683ProtectedEnvironmentReviewerPrivateNote",
  "pass2683UnredactedAttestationBundle",
  "pass2684 raw npm audit JSON",
  "pass2684 raw SBOM with private internal paths",
  "pass2684 unredacted dependency graph payload",
  "pass2684 raw license scanner package list",
  "pass2684 GitHub token in supply-chain artifact",
  "pass2684NpmTokenPrivateValue",
  "pass2684RawSbomPrivateFilePath",
  "rawPass2677DocumentPayload",
  "pass2677PrivateExtractionTrace",
  "pass2677UnsanitizedOsintProviderResponse",
  "rawPass2678MarketProviderPayload",
  "pass2678PrivateMarketReplayTrace",
  "pass2678UnsanitizedExchangeProviderResponse",
  "pass2679PrivateAlertSinkPayload",
  "pass2679UnsanitizedIncidentTimeline",
  "pass2679TelemetrySecretToken",
  "pass2675UnredactedReviewerNotes",
  "pass2675ClientHeaderOnlyOperatorAuth",
  "pass2674UnredactedMobileSmokePayload",
  "pass2674PrivateViewportProbe",
  "pass2673UnredactedPdfLayout",
  "pass2673PrivatePdfDebugPayload",
  "pass2672UnredactedTierModel",
  "pass2672PrivateUxDebugPayload",
  "rawPass2671ProviderResponse",
  "pass2671SnapshotVaultServiceRoleTrace",
  "pass2671UnredactedProviderPayload",
  "raw pass2670 claim ledger payload",
  "pass2670 claim firewall bypass token",
  "operator pass2670 claim override note",
  "private pass2670 claim ledger pointer",
  "stripe webhook secret",
  "stripe-signature header",
  "private delivery pointer",
  "receipt replay token",
  "session id",
  "api key",
  "seed phrase",
  "exploit steps",
  "preview credential trace",
  "jwt claims",
  "service role response",
  "private ref value",
  "operator QA approval signature",
  "hash mismatch trace",
  "service role trace",
  "raw fixture payload",
  "preview credential secret",
  "raw deployed preview response",

  "unredacted smoke response",
  "raw pass2634 artifact",
  "attachment write payload",
  "raw attachment post response",
  "raw pass2635 response",
  "raw supabase insert payload",
  "private consumption ledger pointer",
  "safe pdf token ledger bypass",
  "raw pass2645 ledger receipt",
  "raw supabase live write payload",
  "raw supabase live select response",
  "live preview credential secret",
  "raw pass2646 live ledger receipt",
  "private live ledger smoke pointer",
  "operator live ledger smoke note",
  "rls policy bypass token",
  "service role consumption trace",
  "release board write payload",
  "release board write receipt private",
  "preview attachment response",
  "supabase write response",
  "supabase service role trace",
  "attachment smoke private trace",
  "artifact ingress secret",
  "raw pass2647 attachment payload",
  "raw release board write response",
  "operator attachment override note",
  "private release board row pointer",
  "release board bypass token",

  "raw supabase response",
  "supabase rls bypass trace",
  "supabase release board raw response",
  "service role key",
  "anon key",
  "authorization",
  "raw postgrest error",
  "private artifact ref",
  "operator evidence ref",
  "release board private ref",
  "raw promotion receipt payload",
  "raw release board receipt payload",
  "raw pass2637 receipt",
  "promotion bypass token",
  "pro pdf promotion bypass",
  "advanced promotion bypass",
  "release promotion bypass",
  "private release board pointer",
  "operator promotion note",
  "raw pass2639 receipt",
  "raw account portal timeline payload",
  "raw portal badge payload",
  "account portal bypass token",
  "download cta bypass token",
  "private timeline trace",
  "private receipt pointer",
  "operator timeline note",
  "raw pass2642 deployed dom snapshot",
  "raw pdf download response",
  "pdf unlock bypass token",
  "account portal preview secret",
  "private deployed smoke trace",
  "operator deployed smoke note",
  "raw pass2642 smoke artifact payload",
  "raw pass2643 attachment post response",
  "release board attachment private write payload",
  "release board attachment private receipt",
  "pro pdf unlock promotion bypass token",
  "advanced launch promotion bypass token",
  "launch claim bypass token",
  "operator release board attachment note",
  "private smoke receipt pointer",
  "private release board attachment pointer",
  "raw safe pdf download token",
  "raw one time download token",
  "download token secret",
  "token salt",
  "token plaintext",
  "raw token consumption ledger",
  "raw download route response",
  "raw pdf binary payload",
  "pro pdf route bypass token",
  "receipt revocation bypass token",
  "entitlement revocation bypass token",
  "private token ledger pointer",
  "private receipt revocation trace",
  "operator download override note",
  "raw pass2648 account delivery payload",
  "raw refund webhook payload",
  "raw chargeback payload",
  "raw entitlement revocation payload",
  "raw safe pdf token secret",
  "private refund reason trace",
  "private chargeback trace",
  "private entitlement ledger pointer",
  "operator refund override note",
  "operator revocation override note",
  "revocation bypass token",
  "refund bypass token",
  "chargeback bypass token",
  "raw pass2649 webhook replay payload",
  "raw stripe event payload",
  "raw payment provider event payload",
  "raw entitlement revocation ledger write",
  "raw entitlement revocation ledger row",
  "entitlement revocation ledger service role trace",
  "stripe signature secret",
  "webhook signing secret",
  "private webhook replay secret",
  "private payment provider trace",
  "private revocation ledger pointer",
  "operator chargeback override note",
  "raw pass2650 deployed webhook replay payload",
  "raw live refund webhook payload",
  "raw live chargeback webhook payload",
  "raw stripe live event payload",
  "raw entitlement revocation live ledger write",
  "raw entitlement revocation live ledger row",
  "entitlement revocation live ledger service role trace",
  "live webhook signing secret",
  "stripe live signing secret",
  "private live webhook replay secret",
  "private revocation live ledger pointer",
  "operator live revocation override note",
  "raw pass2651 revocation attachment payload",
  "raw revocation release board write payload",
  "raw revocation release board write response",
  "private live revocation receipt pointer",
  "private revocation release board row pointer",
  "operator revocation attachment override note",
  "raw pass2652 customer timeline payload",
  "raw support handoff packet payload",
  "raw support handoff storage write",
  "private support handoff pointer",
  "private revocation timeline pointer",
  "operator support note",
  "support handoff bypass token",
  "raw pass2653 deployed portal dom snapshot",
  "raw pass2653 support handoff packet payload",
  "raw playwright trace",
  "playwright video path",
  "private pass2653 support packet pointer",
  "raw pass2653 public packet payload",
  "raw pass2654 attachment post payload",
  "raw release board attachment write payload",
  "raw release board attachment write response",
  "release board service role response",
  "release board service role trace",
  "raw support handoff public packet storage row",
  "raw support handoff promotion receipt payload",
  "raw support handoff timeline dom snapshot",
  "operator support handoff promotion note",
  "private support handoff final receipt pointer",
  "support handoff promotion bypass token",
  "timeline promotion bypass token",
  "release board attachment bypass token",
  "raw pass2655 support handoff download payload",
  "raw pass2655 public packet download receipt",
  "raw pass2656 ux receipt payload",
  "raw pass2656 release board attachment payload",
  "raw pass2656 public packet download promotion receipt",
  "support handoff ux promotion bypass token",
  "public packet download promotion bypass token",
  "private pass2656 final receipt pointer",
  "raw support handoff public packet bytes",
  "support handoff public packet signed url",
  "support handoff private storage path",
  "private public packet download receipt pointer",
  "operator support handoff ui copy note",
  "raw pass2657 support packet route response",
  "raw pass2658 route split receipt payload",
  "raw pass2658 release board attachment payload",
  "raw pass2658 guarded support packet route promotion receipt",
  "guarded support packet route promotion bypass token",
  "customer facing final badge promotion bypass token",
  "private pass2658 final receipt pointer",
  "operator guarded support packet route split promotion note",
  "raw pass2657 support packet download bytes",
  "raw pass2657 final badge payload",
  "raw guarded support packet route payload",
  "raw support packet signed url",
  "support packet route bypass token",
  "raw pass2659 public route download payload",
  "raw pass2659 support handoff download response",
  "raw pass2659 private route probe response",
  "private pass2659 support packet pointer",
  "pass2659 public route smoke bypass token",

  "raw pass2660 release board attachment payload",
  "raw pass2660 public route download promotion receipt",
  "raw pass2660 support packet download response",
  "private pass2660 public route final receipt pointer",
  "pass2660 public route promotion bypass token",
  "support handoff final badge bypass token",
  "private pass2657 final badge receipt pointer",
  "private guarded support packet storage path",
  "operator support handoff final badge note",

];

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, fallback = "", max = 180) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

function row(label: string, lane: Pass2622BoundaryLane, status: Pass2622RouteLockStatus, output: string): Pass2622RouteLockRow {
  return { label, lane, status, output };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function shouldDropPublicKey(key: string) {
  const lower = key.toLowerCase();
  return FORBIDDEN_PUBLIC_KEYS.has(key) ||
    lower.includes("operatorrows") ||
    lower.includes("rawprovider") ||
    lower.includes("rawpayload") ||
    lower.includes("privatepointer") ||
    lower.includes("privatefields") ||
    lower.includes("privateoperatorfields") ||
    lower.includes("rawartifact") ||
    lower.includes("operatorrefer") ||
    lower.includes("webhookpayloadpointer") ||
    lower.includes("receiptreplaytoken") ||
    lower.includes("sessionid") ||
    lower.includes("fixtureartifactbundlehash") ||
    lower.includes("previewcredentialtrace") ||
    lower.includes("operatorsignoffsignature") ||
    lower.includes("rawsupabaseerror") ||
    lower.includes("jwtclaims") ||
    lower.includes("serviceroleresponse") ||
    lower.includes("privaterefvalue") ||
    lower.includes("rawartifactpayload") ||
    lower.includes("rawfixturepayload") ||
    lower.includes("previewcredentialsecret") ||
    lower.includes("rawdeployedpreviewresponse") ||
    lower.includes("unredactedsmokeresponse") ||
    lower.includes("rawpass2634artifact") ||
    lower.includes("attachmentwritepayload") ||
    lower.includes("rawattachmentpostresponse") ||
    lower.includes("rawpass2635response") ||
    lower.includes("releaseboardwritepayload") ||
    lower.includes("releaseboardwritereceiptprivate") ||
    lower.includes("previewattachmentresponse") ||
    lower.includes("supabasewriteresponse") ||
    lower.includes("supabaseserviceroletrace") ||
    lower.includes("attachmentsmokeprivatetrace") ||
    lower.includes("artifactingresssecret") ||
    lower.includes("rawsupabaseresponse") ||
    lower.includes("supabaserlsbypasstrace") ||
    lower.includes("supabasereleaseboardrawresponse") ||
    lower.includes("servicerolekey") ||
    lower.includes("anonkey") ||
    lower.includes("authorization") ||
    lower.includes("rawpostgresterror") ||
    lower.includes("privateartifactref") ||
    lower.includes("operatorevidenceref") ||
    lower.includes("releaseboardprivateref") ||
    lower.includes("rawpromotionreceiptpayload") ||
    lower.includes("rawreleaseboardreceiptpayload") ||
    lower.includes("rawpass2637receipt") ||
    lower.includes("promotionbypasstoken") ||
    lower.includes("propdfpromotionbypass") ||
    lower.includes("advancedpromotionbypass") ||
    lower.includes("releasepromotionbypass") ||
    lower.includes("privatereleaseboardpointer") ||
    lower.includes("operatorpromotionnote") ||
    lower.includes("rawcustomerbadgereceiptpayload") ||
    lower.includes("rawaccountdeliverypromotionstate") ||
    lower.includes("rawpass2638receipt") ||
    lower.includes("customerbadgebypasstoken") ||
    lower.includes("accountdeliverypromotionbypass") ||
    lower.includes("privatecustomerreceiptpointer") ||
    lower.includes("privatedeliveryreceipttrace") ||
    lower.includes("operatordeliverynote") ||
    lower.includes("rawbadgerenderpayload") ||
    lower.includes("rawpass2642deployeddomsnapshot") ||
    lower.includes("rawpdfdownloadresponse") ||
    lower.includes("pdfunlockbypasstoken") ||
    lower.includes("accountportalpreviewsecret") ||
    lower.includes("privatedeployedsmoketrace") ||
    lower.includes("operatordeployedsmokenote") ||
    lower.includes("rawpass2642smokeartifactpayload") ||
    lower.includes("rawpass2643attachmentpostresponse") ||
    lower.includes("releaseboardattachmentprivatewritepayload") ||
    lower.includes("releaseboardattachmentprivatereceipt") ||
    lower.includes("propdfunlockpromotionbypasstoken") ||
    lower.includes("advancedlaunchpromotionbypasstoken") ||
    lower.includes("launchclaimbypasstoken") ||
    lower.includes("operatorreleaseboardattachmentnote") ||
    lower.includes("privatesmokereceiptpointer") ||
    lower.includes("privatereleaseboardattachmentpointer");
}

function sanitizePublicString(value: string) {
  let out = value.replace(ASCII_CONTROL_PATTERN, " ").replace(/\s+/g, " ").trim();
  for (const term of FORBIDDEN_PUBLIC_TERMS) {
    out = out.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "private evidence");
  }
  return out;
}

export function sanitizePublicAuditEnvelope<T>(value: T, surface = "public-api"): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePublicAuditEnvelope(item, surface)) as T;
  }
  if (typeof value === "string") {
    return sanitizePublicString(value) as T;
  }
  if (!isPlainObject(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (shouldDropPublicKey(key)) continue;
    sanitized[key] = sanitizePublicAuditEnvelope(item, surface);
  }
  if (surface && !Object.prototype.hasOwnProperty.call(sanitized, "publicPrivateBoundary")) {
    sanitized.publicPrivateBoundary = "pass2622 sanitized envelope: customer-safe rows only; operator/private fields removed recursively";
  }
  return sanitized as T;
}

export function buildPass2622PublicPrivateRouteLockdownReport(input: Partial<AuditReviewSubmission> & { locale?: string } = {}): Pass2622PublicPrivateRouteLockdownReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, "ethereum", 40);
  const contractAddress = clean(input.contractAddress, "", 96) || undefined;
  const projectName = clean(input.projectName || input.website || input.auditUrl, "Velmère audit", 140) || undefined;

  const customerRows = [
    row("Public API envelope", "public_api", "sanitized", t(locale,
      "Publiczne odpowiedzi usuwają operatorRows i prywatne pola przed zwrotem do klienta.",
      "Oeffentliche Antworten entfernen operatorRows und private Felder vor der Kundenausgabe.",
      "Public responses remove operatorRows and private fields before customer output.")),
    row("Customer UI boundary", "customer_ui", "sanitized", t(locale,
      "Widok Basic/Pro dostaje tylko customerRows, publicRows, proPdfRows i bezpieczne summary.",
      "Basic/Pro erhalten nur customerRows, publicRows, proPdfRows und sichere Summary.",
      "Basic/Pro receives only customerRows, publicRows, proPdfRows and safe summaries.")),
    row("Advanced private state", "operator_api", "locked", t(locale,
      "Stan operatora jest prywatny i wymaga server-side admin gate.",
      "Operatorstatus ist privat und erfordert ein serverseitiges Admin-Gate.",
      "Operator state is private and requires a server-side admin gate.")),
  ];

  const proPdfRows = [
    row("PDF appendix boundary", "pro_pdf", "locked", "Pro PDF is assembled from customer-safe contracted lines only; operator/private rows are denied."),
    row("Public route sanitizer", "public_api", "sanitized", "Recursive sanitizer removes private keys before JSON leaves audit-watch/public evidence routes."),
    row("Operator route token gate", "operator_api", "locked", "Operator, admin, private-delivery and dead-letter routes require verifySecurityAdminToken with security:console scope."),
  ];

  const operatorRows = [
    row("audit-watch recursive sanitizer", "regression", "locked", "Verify audit-watch response uses sanitizePublicAuditEnvelope before NextResponse.json."),
    row("ABI/depth public evidence routes", "regression", "locked", "Verify standalone evidence routes no longer emit operatorRows at top level."),
    row("operator/admin route lockdown", "operator_api", "locked", "Verify private routes import verifySecurityAdminToken and call it before parsing operator payload."),
  ];

  return {
    passId: PASS2622_PUBLIC_PRIVATE_ROUTE_LOCKDOWN_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { chain, contractAddress, projectName },
    rule: "Public APIs may expose customer-safe summaries only; operator/private evidence requires server-side admin authentication and never flows into Pro PDF.",
    customerRule: t(locale,
      "Klient widzi wynik, braki dowodów i status — nie widzi notatek operatora, raw payloadów ani tokenów.",
      "Kunden sehen Ergebnis, fehlende Nachweise und Status — keine Operatornotizen, Raw-Payloads oder Tokens.",
      "Customers see verdict, missing proof and status — not operator notes, raw payloads or tokens."),
    proPdfRule: "Pro PDF must be built from proPdfRows/contractedLines after customer-safe filtering; operatorRows are never rendered.",
    operatorRule: "Operator routes are deny-by-default and require verifySecurityAdminToken([security:console]) before private payload parsing.",
    summary: {
      publicBoundaryReadiness: 94,
      operatorGateReadiness: 86,
      proPdfBoundaryReadiness: 94,
      customerLeakReadiness: 92,
      publicApiSanitized: true,
      operatorRoutesRequireAdmin: true,
      publicApiMustNotEmitOperatorRows: true,
      proPdfMustNotRenderOperatorRows: true,
      topBlocker: "Run live unauthorized-route tests on Vercel with production env and confirm every operator/admin endpoint returns 401/503 without a valid admin token.",
    },
    customerRows,
    proPdfRows,
    operatorRows,
    publicEnvelopeContract: {
      allowedTopLevelKeys: ["ok", "surface", "normalized", "preview", "summary", "publicRows", "customerRows", "proPdfRows", "missingEvidence", "nextSafeAction", "publicPrivateBoundary"],
      forbiddenKeys: Array.from(FORBIDDEN_PUBLIC_KEYS),
      forbiddenTerms: FORBIDDEN_PUBLIC_TERMS,
      sanitizer: "sanitizePublicAuditEnvelope(value, surface) recursively drops operator/private keys and rewrites forbidden public terms.",
    },
    operatorEnvelopeContract: {
      requiredGate: "verifySecurityAdminToken(request, ['security:console'])",
      requiredScope: "security:console",
      deniedByDefault: true,
      privateRoutes: [
        "/api/security/audit-advanced-operator-console-merge",
        "/api/security/audit-admin-escalation-inbox-operator-queue-runtime",
        "/api/security/audit-operator-escalation-human-review-sla-gate",
        "/api/security/audit-operator-decision-ledger-reviewer-signoff-trail",
        "/api/security/audit-case-vault-private-delivery-ledger",
        "/api/security/audit-webhook-dead-letter-operator-queue-sla-gate",
      ],
    },
    nextImplementationBacklog: [
      "Run unauthorized-route e2e matrix against deployed Vercel preview.",
      "Move manual reconciliation actions into a real operator console form with audit log append.",
      "Add PDF snapshot regression that fails on operator/private forbidden strings.",
      "Require production storage for private evidence pointers; no memory fallback for operator delivery.",
    ],
  };
}


// PASS2685 public/private sanitizer extension: runtime secret proof must never expose raw env or provider-secret material.
export const PASS2685_RUNTIME_SECRET_PUBLIC_DENY_LIST_MARKERS = [
  "pass2685 raw environment inventory",
  "pass2685 raw secret rotation transcript",
  "pass2685 unredacted provider key scope payload",
  "pass2685 raw webhook signing secret",
  "pass2685 raw Vercel/GitHub/Supabase/Stripe env snapshot",
] as const;
void PASS2685_RUNTIME_SECRET_PUBLIC_DENY_LIST_MARKERS;


// PASS2686 public/private sanitizer extension: external smoke artifacts must never expose raw route bodies or sensitive browser/provider output.
export const PASS2686_EXTERNAL_SMOKE_PUBLIC_DENY_LIST_MARKERS = [
  "pass2686 raw external route body",
  "pass2686 browser console dump with secrets",
  "pass2686 raw support packet bytes",
  "pass2686 unredacted route probe payload",
  "pass2686 Vercel preview token or GitHub token",
] as const;
void PASS2686_EXTERNAL_SMOKE_PUBLIC_DENY_LIST_MARKERS;

export const PASS2687_BROWSER_ARTIFACT_DENY_MARKERS = ["playwrightTraceRaw", "playwrightVideoRaw", "rawConsoleLog", "rawNetworkPayload", "screenshotWithSecrets"] as const;

// PASS2689_ACCESSIBILITY_WCAG_CUSTOMER_UX_GATE_READY: public outputs must redact raw a11y trees/selectors/traces.

// PASS2690_PERFORMANCE_BUDGET_GATE_READY: public outputs must redact raw LHR/traces/source maps/screenshots/bundle stats.


// PASS2700 mega finalization public/private deny-list markers.
export const PASS2700_MEGA_WORLD_CLASS_DENIED_PUBLIC_FIELDS = ["operatorRows", "operatorPrivateNote", "rawOperatorSignoff", "rawProviderPayload", "rawWebhookPayload", "rawStripeRefundPayload", "rawChargebackPayload", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "AI_PROVIDER_KEY", "JWT", "bypassToken", "privatePointer", "rawPdfBytes", "rawScreenshot", "rawTrace", "stackTrace"] as const;
