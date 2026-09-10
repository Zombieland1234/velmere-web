import type { VlmDepth, VlmLocale, VlmSurface } from "./vlm-contract";
import { inspectVlmText, sanitizeVlmText, stableHash } from "./vlm-security";
import { recordVlmSecurityInspection } from "./vlm-security-events";

export type VlmSessionMemory = {
  sessionId: string;
  locale: VlmLocale;
  depth: VlmDepth;
  surface: VlmSurface;
  assetId?: string;
  recentQuestions: string[];
  lastSummary?: string;
  lastNarrativeFingerprint?: string;
  lastEvidenceFingerprint?: string;
  lastVerdict?: string;
  lastConfidence?: number;
  updatedAt: string;
  expiresAt: number;
};

const memory = new Map<string, VlmSessionMemory>();
const DEFAULT_TTL_MS = 30 * 60_000;
const MAX_SESSIONS = 500;

function prune() {
  const now = Date.now();
  for (const [key, value] of memory) if (value.expiresAt <= now) memory.delete(key);
  while (memory.size > MAX_SESSIONS) {
    const oldest = memory.keys().next().value as string | undefined;
    if (!oldest) break;
    memory.delete(oldest);
  }
}

function memoryKey(sessionId?: string) {
  const normalized = sanitizeVlmText(sessionId, 120);
  return normalized ? stableHash({ namespace: "vlm-session-v2", sessionId: normalized }) : null;
}

export function readVlmSessionMemory(
  sessionId?: string,
  scope?: { assetId?: string; surface?: VlmSurface },
) {
  if (!sessionId) return null;
  prune();
  const key = memoryKey(sessionId);
  if (!key) return null;
  const value = memory.get(key) ?? null;
  if (!value) return null;
  if (scope?.assetId && value.assetId && scope.assetId !== value.assetId) return null;
  if (scope?.surface && value.surface !== scope.surface) return null;
  return value;
}

export function writeVlmSessionMemory(input: {
  sessionId?: string;
  locale: VlmLocale;
  depth: VlmDepth;
  surface: VlmSurface;
  assetId?: string;
  question?: string;
  summary?: string;
  narrativeFingerprint?: string;
  evidenceFingerprint?: string;
  verdict?: string;
  confidence?: number;
  ttlMs?: number;
}) {
  if (!input.sessionId) return null;
  prune();
  const key = memoryKey(input.sessionId);
  if (!key) return null;
  const previousValue = memory.get(key);
  const sameScope =
    (!input.assetId || !previousValue?.assetId || input.assetId === previousValue.assetId) &&
    (!previousValue || input.surface === previousValue.surface);
  const previous = sameScope ? previousValue : undefined;
  const questionInspection = inspectVlmText(input.question, 500);
  const summaryInspection = inspectVlmText(input.summary, 1000);
  recordVlmSecurityInspection({ inspection: questionInspection, vector: "memory", route: "/internal/vlm/memory-question" });
  recordVlmSecurityInspection({ inspection: summaryInspection, vector: "memory", route: "/internal/vlm/memory-summary" });
  const recentQuestions = Array.from(new Set([
    ...(previous?.recentQuestions ?? []),
    ...(input.question && questionInspection.risk === "none" ? [sanitizeVlmText(input.question, 500)] : []),
  ])).filter(Boolean).slice(-6);
  const ttlMs = Math.min(Math.max(input.ttlMs ?? DEFAULT_TTL_MS, 60_000), 24 * 60 * 60_000);
  const value: VlmSessionMemory = {
    sessionId: sanitizeVlmText(input.sessionId, 120),
    locale: input.locale,
    depth: input.depth,
    surface: input.surface,
    assetId: input.assetId ? sanitizeVlmText(input.assetId, 180) : undefined,
    recentQuestions,
    lastSummary: input.summary && summaryInspection.risk === "none" ? sanitizeVlmText(input.summary, 1000) : previous?.lastSummary,
    lastNarrativeFingerprint: input.narrativeFingerprint ? sanitizeVlmText(input.narrativeFingerprint, 80) : previous?.lastNarrativeFingerprint,
    lastEvidenceFingerprint: input.evidenceFingerprint ? sanitizeVlmText(input.evidenceFingerprint, 80) : previous?.lastEvidenceFingerprint,
    lastVerdict: input.verdict ? sanitizeVlmText(input.verdict, 40) : previous?.lastVerdict,
    lastConfidence: typeof input.confidence === "number" && Number.isFinite(input.confidence) ? Math.round(Math.max(0, Math.min(100, input.confidence))) : previous?.lastConfidence,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
  };
  memory.set(key, value);
  prune();
  return value;
}

export function clearVlmSessionMemory(sessionId?: string) {
  if (!sessionId) return false;
  const key = memoryKey(sessionId);
  return key ? memory.delete(key) : false;
}

export function getVlmMemoryStats() {
  prune();
  return { sessions: memory.size, maxSessions: MAX_SESSIONS };
}
