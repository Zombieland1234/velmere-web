import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";

import { sha256Token } from "../security/cryptographic-digest";
import type { Pass469PdfDownloadReceipt } from "@/lib/market-integrity/pdf-a4-download-receipt";

export type Pass470KeyboardControl = {
  id: string;
  role: "combobox" | "button" | "link" | "dialog" | "tab";
  label: string;
  tabbable: boolean;
  escapeCloses?: boolean;
  enterActivates?: boolean;
  spaceActivates?: boolean;
};

export type Pass470KeyboardAudit = {
  version: "pass470-keyboard-qa-v1";
  ok: boolean;
  failures: string[];
  focusOrder: string[];
  modalTrapRequired: boolean;
  closeControlPresent: boolean;
};

function clean(value: unknown, fallback = "", max = 160) {
  const text = typeof value === "string" ? value : fallback;
  return text.replace(ASCII_CONTROL_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max) || fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stableHash(value: string) {
  return sha256Token(value, 16);
}

export function auditPass470KeyboardFlow(
  controls: Pass470KeyboardControl[],
): Pass470KeyboardAudit {
  const failures: string[] = [];
  const focusOrder = controls.filter((control) => control.tabbable).map((control) => control.id);
  if (!controls.some((control) => control.role === "combobox" && control.tabbable)) {
    failures.push("search combobox must be tabbable");
  }
  if (!controls.some((control) => control.id === "lens-download-link" && control.role === "link" && control.tabbable)) {
    failures.push("download link must stay in the keyboard focus order");
  }
  if (!controls.some((control) => control.id === "lens-preview-close" && control.escapeCloses)) {
    failures.push("preview close must be reachable and Escape-bound");
  }
  if (!controls.filter((control) => control.id.startsWith("lens-depth-")).every((control) => control.enterActivates && control.spaceActivates)) {
    failures.push("all PDF depth buttons must activate on Enter and Space");
  }
  if (new Set(focusOrder).size !== focusOrder.length) {
    failures.push("keyboard focus order contains duplicate control ids");
  }
  return {
    version: "pass470-keyboard-qa-v1",
    ok: failures.length === 0,
    failures,
    focusOrder,
    modalTrapRequired: true,
    closeControlPresent: controls.some((control) => control.id === "lens-preview-close"),
  };
}

export type Pass470ReceiptHistoryItem = {
  receiptId: string;
  createdAt: string;
  filename: string;
  symbol: string;
  depth: "basic" | "pro" | "advanced";
  sourceConfidence: number;
  sourceCount: number;
};

export type Pass470ReceiptHistory = {
  version: "pass470-receipt-history-v1";
  total: number;
  visible: Pass470ReceiptHistoryItem[];
  latest?: Pass470ReceiptHistoryItem;
  summary: string;
  redaction: "no_raw_payload";
  checksum: string;
};

function toHistoryItem(receipt: Pass469PdfDownloadReceipt): Pass470ReceiptHistoryItem {
  return {
    receiptId: clean(receipt.receiptId, "receipt", 80),
    createdAt: clean(receipt.createdAt, "", 80),
    filename: clean(receipt.filename, "velmere-report.pdf", 160),
    symbol: clean(receipt.symbol, "REPORT", 24).toUpperCase(),
    depth: receipt.depth,
    sourceConfidence: Math.max(0, Math.min(100, Math.round(number(receipt.sourceConfidence)))),
    sourceCount: Math.max(0, Math.min(99, Math.floor(number(receipt.sourceCount)))),
  };
}

export function buildPass470ReceiptHistory(
  receipts: Pass469PdfDownloadReceipt[],
  limit = 5,
): Pass470ReceiptHistory {
  const seen = new Set<string>();
  const valid = (Array.isArray(receipts) ? receipts : [])
    .map(toHistoryItem)
    .filter((item) => {
      if (!item.receiptId || !item.createdAt || !Number.isFinite(Date.parse(item.createdAt))) return false;
      if (seen.has(item.receiptId)) return false;
      seen.add(item.receiptId);
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const visible = valid.slice(0, Math.max(1, Math.min(20, Math.floor(limit))));
  const latest = visible[0];
  const summary = latest
    ? `${latest.symbol} · ${latest.depth.toUpperCase()} · ${latest.sourceConfidence}% · ${latest.receiptId}`
    : "No local PDF receipts yet";
  const checksum = stableHash(
    visible
      .map((item) => [item.receiptId, item.createdAt, item.filename, item.symbol, item.depth, item.sourceConfidence, item.sourceCount].join("|"))
      .join("::"),
  );
  return {
    version: "pass470-receipt-history-v1",
    total: valid.length,
    visible,
    latest,
    summary,
    redaction: "no_raw_payload",
    checksum,
  };
}

export type Pass470RuntimeGuardInput = {
  resultId?: unknown;
  symbol?: unknown;
  sources?: unknown;
  chips?: unknown;
  missingData?: unknown;
  sourceConfidence?: unknown;
};

export function buildPass470RuntimeGuard(input: Pass470RuntimeGuardInput) {
  const sources = Array.isArray(input.sources) ? input.sources.length : 0;
  const chips = Array.isArray(input.chips) ? input.chips.length : 0;
  const missingData = Array.isArray(input.missingData) ? input.missingData.length : 0;
  const sourceConfidence = Math.max(0, Math.min(100, Math.round(number(input.sourceConfidence))));
  const symbol = clean(input.symbol, clean(input.resultId, "UNKNOWN", 40), 24).toUpperCase();
  const risks = [
    sources === 0 ? "source_required" : null,
    sourceConfidence < 35 ? "low_confidence" : null,
    missingData > 0 ? "missing_data_visible" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    version: "pass470-runtime-guard-v1" as const,
    symbol,
    sources,
    chips,
    missingData,
    sourceConfidence,
    safeToRender: Boolean(symbol) && sourceConfidence >= 0,
    risks,
  };
}

export const PASS470_BROWSER_RUNTIME_QA_CONTRACT = true;
