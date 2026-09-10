import { sha256Digest } from "@/lib/security/cryptographic-digest";
export type Pass469PdfDepth = "basic" | "pro" | "advanced";

export type Pass469A4Region = {
  id: string;
  page: 1 | 2 | 3 | 4;
  top: number;
  height: number;
};

export type Pass469A4Layout = {
  version: "pass469-a4-layout-v1";
  pageWidth: 595;
  pageHeight: 842;
  safeContentBottom: number;
  footer: {
    boundaryY: number;
    pageY: number;
    signatureY: number;
  };
  pageOne: {
    verdict: Pass469A4Region;
    metadataTop: number;
    brief: Pass469A4Region;
    market: Pass469A4Region;
    checked: Pass469A4Region;
    missing: Pass469A4Region;
  };
  pageTwo: {
    sourceRowTops: number[];
    sourceRowHeight: number;
    secondProvider: Pass469A4Region;
    nextAction: Pass469A4Region;
    providerTruth: Pass469A4Region;
  };
  pageThree: {
    basic?: Pass469A4Region;
    pro?: Pass469A4Region;
    selected?: Pass469A4Region;
    missingPolicy: Pass469A4Region;
  };
  pageFour: {
    advanced?: Pass469A4Region;
    waterfall: Pass469A4Region;
    sourceBoundary?: Pass469A4Region;
    primaryNextAction?: Pass469A4Region;
    missingFields: Pass469A4Region;
    finalNextAction?: Pass469A4Region;
  };
  regions: Pass469A4Region[];
  audit: {
    ok: boolean;
    errors: string[];
  };
};

const PAGE_WIDTH = 595 as const;
const PAGE_HEIGHT = 842 as const;
const SAFE_CONTENT_BOTTOM = 78;

function region(
  id: string,
  page: Pass469A4Region["page"],
  top: number,
  height: number,
): Pass469A4Region {
  return { id, page, top, height };
}

export function auditPass469A4Regions(
  regions: Pass469A4Region[],
  safeContentBottom = SAFE_CONTENT_BOTTOM,
) {
  const errors: string[] = [];
  for (const item of regions) {
    const bottom = item.top - item.height;
    if (item.top > PAGE_HEIGHT - 20) {
      errors.push(`${item.id}: top ${item.top} exceeds A4 content ceiling`);
    }
    if (bottom < safeContentBottom) {
      errors.push(
        `${item.id}: bottom ${bottom} enters the reserved footer below ${safeContentBottom}`,
      );
    }
    if (item.height <= 0) errors.push(`${item.id}: non-positive height`);
  }

  for (const page of [1, 2, 3, 4] as const) {
    const pageRegions = regions
      .filter((item) => item.page === page)
      .sort((a, b) => b.top - a.top);
    for (let index = 0; index < pageRegions.length - 1; index += 1) {
      const upper = pageRegions[index];
      const lower = pageRegions[index + 1];
      const upperBottom = upper.top - upper.height;
      if (upperBottom < lower.top) {
        errors.push(
          `page ${page}: ${upper.id} overlaps ${lower.id} by ${lower.top - upperBottom}pt`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function buildPass469A4Layout(
  depth: Pass469PdfDepth,
  sourceCount: number,
): Pass469A4Layout {
  const pageOne = {
    verdict: region("page1-verdict", 1, 638, 82),
    metadataTop: 536,
    brief: region("page1-brief", 1, 468, 92),
    market: region("page1-market", 1, 356, 86),
    checked: region("page1-checked", 1, 250, 70),
    missing: region("page1-missing", 1, 164, 62),
  };

  const pageTwo = {
    sourceRowTops: [724, 662, 600, 538].slice(
      0,
      Math.max(0, Math.min(4, Math.floor(sourceCount))),
    ),
    sourceRowHeight: 48,
    secondProvider: region("page2-second-provider", 2, 462, 96),
    nextAction: region("page2-next-action", 2, 346, 96),
    providerTruth: region("page2-provider-truth", 2, 230, 108),
  };

  const pageThree =
    depth === "advanced"
      ? {
          basic: region("page3-basic", 3, 654, 210),
          pro: region("page3-pro", 3, 424, 260),
          missingPolicy: region("page3-missing-policy", 3, 148, 62),
        }
      : {
          selected: region("page3-selected-tier", 3, 654, 480),
          missingPolicy: region("page3-missing-policy", 3, 154, 66),
        };

  const pageFour =
    depth === "advanced"
      ? {
          advanced: region("page4-advanced", 4, 686, 320),
          waterfall: region("page4-waterfall", 4, 346, 126),
          missingFields: region("page4-missing-fields", 4, 200, 54),
          finalNextAction: region("page4-final-next-action", 4, 128, 48),
        }
      : {
          waterfall: region("page4-waterfall", 4, 686, 126),
          sourceBoundary: region("page4-source-boundary", 4, 540, 90),
          primaryNextAction: region("page4-primary-next-action", 4, 430, 112),
          missingFields: region("page4-missing-fields", 4, 298, 70),
        };

  const regions: Pass469A4Region[] = [
    pageOne.verdict,
    pageOne.brief,
    pageOne.market,
    pageOne.checked,
    pageOne.missing,
    ...pageTwo.sourceRowTops.map((top, index) =>
      region(`page2-source-${index + 1}`, 2, top, pageTwo.sourceRowHeight),
    ),
    pageTwo.secondProvider,
    pageTwo.nextAction,
    pageTwo.providerTruth,
    ...Object.values(pageThree).filter(
      (item): item is Pass469A4Region =>
        Boolean(item && typeof item === "object" && "page" in item),
    ),
    ...Object.values(pageFour).filter(
      (item): item is Pass469A4Region =>
        Boolean(item && typeof item === "object" && "page" in item),
    ),
  ];
  const audit = auditPass469A4Regions(regions);
  if (!audit.ok) {
    throw new Error(`PASS469 A4 layout rejected: ${audit.errors.join(" | ")}`);
  }

  return {
    version: "pass469-a4-layout-v1",
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    safeContentBottom: SAFE_CONTENT_BOTTOM,
    footer: { boundaryY: 60, pageY: 54, signatureY: 34 },
    pageOne,
    pageTwo,
    pageThree,
    pageFour,
    regions,
    audit,
  };
}

export type Pass469PdfDownloadReceipt = {
  version: "pass469-pdf-download-receipt-v1";
  receiptId: string;
  event: "download_initiated";
  createdAt: string;
  filename: string;
  symbol: string;
  depth: Pass469PdfDepth;
  reportChecksum: string;
  sourceConfidence: number;
  sourceCount: number;
  containsRawPayload: false;
  checksum: string;
};

const RECEIPT_STORAGE_KEY = "velmere:pass469:pdf-download-receipts";
let inMemoryPdfDownloadReceipts: Pass469PdfDownloadReceipt[] = [];
let legacyReceiptStoragePurged = false;

function clean(value: unknown, max = 120) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function stableHash(value: string) {
  return sha256Digest(value);
}

function receiptChecksum(
  receipt: Omit<Pass469PdfDownloadReceipt, "checksum">,
) {
  return stableHash(
    [
      receipt.version,
      receipt.receiptId,
      receipt.event,
      receipt.createdAt,
      receipt.filename,
      receipt.symbol,
      receipt.depth,
      receipt.reportChecksum,
      receipt.sourceConfidence,
      receipt.sourceCount,
    ].join("::"),
  );
}

export function buildPass469PdfDownloadReceipt(input: {
  filename: string;
  symbol: string;
  depth: Pass469PdfDepth;
  reportChecksum: string;
  sourceConfidence: number;
  sourceCount: number;
  now?: Date;
}): Pass469PdfDownloadReceipt {
  const createdAt = (input.now ?? new Date()).toISOString();
  const filename = clean(input.filename, 160) || "velmere-report.pdf";
  const symbol = clean(input.symbol, 24).toUpperCase() || "REPORT";
  const reportChecksum = clean(input.reportChecksum, 96) || "unavailable";
  const sourceConfidence = Math.max(
    0,
    Math.min(100, Math.round(Number(input.sourceConfidence) || 0)),
  );
  const sourceCount = Math.max(
    0,
    Math.min(99, Math.floor(Number(input.sourceCount) || 0)),
  );
  const receiptId = `vlm469-${stableHash(
    `${filename}:${symbol}:${input.depth}:${reportChecksum}:${createdAt}`,
  )}`;
  const base = {
    version: "pass469-pdf-download-receipt-v1" as const,
    receiptId,
    event: "download_initiated" as const,
    createdAt,
    filename,
    symbol,
    depth: input.depth,
    reportChecksum,
    sourceConfidence,
    sourceCount,
    containsRawPayload: false as const,
  };
  return { ...base, checksum: receiptChecksum(base) };
}

function isPass469Receipt(value: unknown): value is Pass469PdfDownloadReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<Pass469PdfDownloadReceipt>;
  if (receipt.version !== "pass469-pdf-download-receipt-v1") return false;
  if (receipt.event !== "download_initiated") return false;
  if (receipt.depth !== "basic" && receipt.depth !== "pro" && receipt.depth !== "advanced") return false;
  if (receipt.containsRawPayload !== false || !clean(receipt.receiptId, 80)) return false;
  const { checksum, ...base } = receipt as Pass469PdfDownloadReceipt;
  return receiptChecksum(base) === checksum;
}

function purgeLegacyPass469ReceiptStorage() {
  if (legacyReceiptStoragePurged || typeof window === "undefined") return;
  legacyReceiptStoragePurged = true;
  try {
    window.localStorage.removeItem(RECEIPT_STORAGE_KEY);
  } catch {
    // Legacy report metadata is never read or migrated.
  }
}

export function writePass469PdfDownloadReceipt(
  receipt: Pass469PdfDownloadReceipt,
) {
  if (typeof window === "undefined" || !isPass469Receipt(receipt)) return false;
  purgeLegacyPass469ReceiptStorage();
  const existing = readPass469PdfDownloadReceipts();
  inMemoryPdfDownloadReceipts = [
    receipt,
    ...existing.filter((item) => item.receiptId !== receipt.receiptId),
  ]
    .slice(0, 20)
    .map((item) => ({ ...item }));
  return true;
}

export function readPass469PdfDownloadReceipts() {
  if (typeof window === "undefined") return [] as Pass469PdfDownloadReceipt[];
  purgeLegacyPass469ReceiptStorage();
  return inMemoryPdfDownloadReceipts
    .filter(isPass469Receipt)
    .slice(0, 20)
    .map((item) => ({ ...item }));
}
