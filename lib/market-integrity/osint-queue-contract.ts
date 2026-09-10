export type OsintQueueItemKind = "kol_social" | "news_source" | "project_claim" | "token_narrative" | "disclosure_review";
export type OsintQueueStatus = "queued" | "needs_source" | "manual_review" | "blocked";
export type OsintQueuePriority = "P0" | "P1" | "P2";

export type OsintQueueItem = {
  id: string;
  kind: OsintQueueItemKind;
  status: OsintQueueStatus;
  priority: OsintQueuePriority;
  title: string;
  capsule: string;
  sourceRequirements: string[];
  safeWording: string;
  blockedClaims: string[];
  nextOperatorStep: string;
};

export type OsintQueuePreview = {
  schemaVersion: "velmere-osint-queue-preview-v1";
  mode: "osint_queue_preview_only";
  generatedAt: string;
  items: OsintQueueItem[];
  storageWritePerformed: false;
  externalFetchPerformed: false;
  productionBoundary: string;
};

export const osintQueueItems: OsintQueueItem[] = [
  {
    id: "kol-disclosure-review",
    kind: "kol_social",
    status: "manual_review",
    priority: "P1",
    title: "KOL / paid disclosure review",
    capsule: "Check whether social attention is organic, sponsored, coordinated or unclear.",
    sourceRequirements: ["post URL", "timestamp", "author handle", "disclosure text", "reviewer note"],
    safeWording: "Promotional context requires review. Disclosure status is unclear until sources are attached.",
    blockedClaims: ["unsupported paid-promotion accusation", "unsupported manipulation accusation", "criminal intent"],
    nextOperatorStep: "Create source ledger row and paraphrase the claim without copying long source text.",
  },
  {
    id: "narrative-spike-review",
    kind: "token_narrative",
    status: "queued",
    priority: "P1",
    title: "Narrative spike review",
    capsule: "Track whether a token is moving because of narrative pressure instead of source-confirmed fundamentals.",
    sourceRequirements: ["source list", "time window", "volume/attention comparison", "manual note"],
    safeWording: "Narrative attention appears elevated, but causality is not confirmed.",
    blockedClaims: ["guaranteed catalyst", "engineered volume proven", "unsupported coordination accusation"],
    nextOperatorStep: "Compare source timestamp, volume lane and social timing before escalating.",
  },
  {
    id: "project-claim-check",
    kind: "project_claim",
    status: "needs_source",
    priority: "P0",
    title: "Project claim check",
    capsule: "Review roadmap, partnership or exchange claims before they enter a VLM capsule.",
    sourceRequirements: ["official source URL", "archived timestamp", "claim text", "counter-source if available"],
    safeWording: "The claim is unverified until official source and timestamp are attached.",
    blockedClaims: ["partnership confirmed without source", "listing confirmed without source", "official guarantee"],
    nextOperatorStep: "Attach official source or keep result as missing data.",
  },
  {
    id: "negative-news-context",
    kind: "news_source",
    status: "manual_review",
    priority: "P1",
    title: "Negative news context",
    capsule: "Summarize potentially negative news carefully with source, date and neutral wording.",
    sourceRequirements: ["publisher URL", "date", "affected entity", "short paraphrase", "confidence"],
    safeWording: "A source reports a concern. Manual review is required before using it as risk evidence.",
    blockedClaims: ["unsupported scam accusation", "unsupported fraud accusation", "criminal operation"],
    nextOperatorStep: "Use neutral paraphrase and cite source ledger in final export.",
  },
  {
    id: "disclosure-evidence-export",
    kind: "disclosure_review",
    status: "blocked",
    priority: "P0",
    title: "Evidence export readiness",
    capsule: "OSINT items must be export-safe: source URL, timestamp, reviewer and safe paraphrase.",
    sourceRequirements: ["source ledger", "reviewer identity", "timestamp", "retention policy"],
    safeWording: "OSINT export is blocked until source ledger and reviewer workflow exist.",
    blockedClaims: ["final accusation", "definitive intent", "unsafe legal conclusion"],
    nextOperatorStep: "Implement durable OSINT ledger before final report export.",
  },
];

export function createOsintQueuePreview(): OsintQueuePreview {
  return {
    schemaVersion: "velmere-osint-queue-preview-v1",
    mode: "osint_queue_preview_only",
    generatedAt: new Date().toISOString(),
    items: osintQueueItems,
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "OSINT Queue is a manual-review workflow. It does not fetch sources automatically and cannot produce accusations or final verdicts.",
  };
}

export function getOsintQueueSummary(items = osintQueueItems) {
  const blocked = items.filter((item) => item.status === "blocked").length;
  const manualReview = items.filter((item) => item.status === "manual_review").length;
  const needsSource = items.filter((item) => item.status === "needs_source").length;
  const queued = items.filter((item) => item.status === "queued").length;

  return {
    schemaVersion: "velmere-osint-queue-summary-v1",
    total: items.length,
    blocked,
    manualReview,
    needsSource,
    queued,
    readinessProgress: 72,
    nextCriticalStep: "Create durable OSINT source ledger with safe paraphrase and reviewer identity.",
  };
}
