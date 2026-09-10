import { getSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/db/supabase";
import { supabaseServiceRestRequest } from "@/lib/db/supabase-service-rest";
import { inspectVlmText, sanitizeVlmText, stableHash } from "@/lib/ai/vlm-security";
import { recordVlmSecurityInspection } from "@/lib/ai/vlm-security-events";

export type AngelDurableMemoryMode = "supabase" | "local_session_memory" | "disabled";

export type AngelDurableMemory = {
  sessionHash: string;
  locale: "pl" | "en" | "de";
  lane: string;
  summary: string;
  recentTopics: string[];
  turnCount: number;
  updatedAt: string;
  mode: AngelDurableMemoryMode;
};

const PASS2227_ANGEL_DURABLE_MEMORY_MARKER =
  "pass2227-angel-durable-memory-supabase-safe-local-fallback" as const;
const PASS2229_ANGEL_MEMORY_COMPRESSION_MARKER =
  "pass2229-angel-memory-compressed-no-text-wall" as const;
const PASS2232_ANGEL_MEMORY_TTL_MARKER =
  "pass2232-angel-memory-ttl-lane-compression-safe-release" as const;
const localMemory = new Map<string, AngelDurableMemory>();
const MAX_LOCAL_MEMORIES = 220;
const MAX_RECENT_TOPICS = 6;
const LOCAL_MEMORY_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DURABLE_MEMORY_DELETE_TIMEOUT_MS = 5_000;

function exactBoundedIdentity(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  const clean = sanitizeVlmText(trimmed, max);
  return clean === trimmed ? clean : null;
}

function sessionHash(sessionId?: string, accountId?: string) {
  const clean = exactBoundedIdentity(sessionId, 120);
  const account = exactBoundedIdentity(accountId, 160);
  if (!clean || !account) return null;
  return stableHash({ namespace: "velmere-angel-durable-memory-v2", accountId: account, sessionId: clean });
}

function pruneLocalMemory() {
  const now = Date.now();
  for (const [key, value] of localMemory.entries()) {
    const updated = Date.parse(value.updatedAt);
    if (!Number.isFinite(updated) || now - updated > LOCAL_MEMORY_TTL_MS) localMemory.delete(key);
  }
  while (localMemory.size > MAX_LOCAL_MEMORIES) {
    const oldest = Array.from(localMemory.entries()).sort((a, b) =>
      a[1].updatedAt.localeCompare(b[1].updatedAt),
    )[0]?.[0];
    if (!oldest) break;
    localMemory.delete(oldest);
  }
}

function safeTopic(value?: string) {
  const clean = sanitizeVlmText(value, 180).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const inspection = inspectVlmText(clean, 240);
  recordVlmSecurityInspection({
    inspection,
    vector: "memory",
    route: "/internal/angel/durable-memory-topic",
    profile: "angel-chat",
  });
  return inspection.risk === "none" ? clean : "";
}

function safeSummary(value?: string) {
  const clean = sanitizeVlmText(value, 1_800).replace(/\r\n/g, "\n").trim();
  if (!clean) return "";
  const inspection = inspectVlmText(clean, 2_000);
  recordVlmSecurityInspection({
    inspection,
    vector: "memory",
    route: "/internal/angel/durable-memory-summary",
    profile: "angel-chat",
  });
  return inspection.risk === "none" ? clean : "";
}


function normalizeAngelMemoryLine(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^(Angel|VLM Brain|Velmère)\s*[:–-]\s*/i, "")
    .trim()
    .slice(0, 240);
}

function compressAngelMemorySummary(previous = "", next = "") {
  const merged = [previous, next]
    .filter(Boolean)
    .join("\n")
    .split(/\n+/)
    .map((line) => normalizeAngelMemoryLine(line.replace(/^[\s•*-]+/, "")))
    .filter(Boolean);
  const unique = Array.from(new Set(merged));
  const priority = unique.filter((line) => /audit|shield|market|pdf|access|advanced|stripe|supabase|koszyk|cart|menu|lag|scroll|modal|brain|angel|security|błąd|blad|error|bug/i.test(line));
  const rest = unique.filter((line) => !priority.includes(line));
  return [...priority, ...rest].slice(-10).join("\n").slice(-1_800);
}

export async function readAngelDurableMemory(input: {
  sessionId?: string;
  accountId?: string;
  locale: "pl" | "en" | "de";
}) {
  const hash = sessionHash(input.sessionId, input.accountId);
  if (!hash) return null;
  pruneLocalMemory();
  const supabase = getSupabaseServiceRoleClient();
  if (supabase && hasSupabaseServiceRoleConfig()) {
    const { data, error } = await supabase
      .from("velmere_angel_memories")
      .select("session_hash,locale,lane,summary,recent_topics,turn_count,updated_at")
      .eq("session_hash", hash)
      .maybeSingle();
    if (!error && data) {
      return {
        sessionHash: String(data.session_hash ?? hash),
        locale: (data.locale === "pl" || data.locale === "de" ? data.locale : "en") as "pl" | "en" | "de",
        lane: sanitizeVlmText(data.lane, 48) || "general",
        summary: safeSummary(String(data.summary ?? "")),
        recentTopics: Array.isArray(data.recent_topics)
          ? data.recent_topics.map((topic: unknown) => safeTopic(String(topic))).filter(Boolean).slice(-MAX_RECENT_TOPICS)
          : [],
        turnCount: Number.isFinite(Number(data.turn_count)) ? Number(data.turn_count) : 0,
        updatedAt: String(data.updated_at ?? new Date().toISOString()),
        mode: "supabase" as const,
      } satisfies AngelDurableMemory;
    }
  }
  return localMemory.get(hash) ?? null;
}

export async function writeAngelDurableMemory(input: {
  sessionId?: string;
  accountId?: string;
  locale: "pl" | "en" | "de";
  lane: string;
  userMessage?: string;
  assistantReply?: string;
}) {
  const hash = sessionHash(input.sessionId, input.accountId);
  if (!hash) return { ok: false as const, mode: "disabled" as const, marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER };
  const previous = (await readAngelDurableMemory({ sessionId: input.sessionId, accountId: input.accountId, locale: input.locale })) ?? null;
  const topic = safeTopic(input.userMessage);
  const reply = safeSummary(input.assistantReply);
  const summary = reply
    ? compressAngelMemorySummary(previous?.summary, reply)
    : previous?.summary ?? "";
  const recentTopics = Array.from(new Set([...(previous?.recentTopics ?? []), topic].filter(Boolean))).slice(-MAX_RECENT_TOPICS);
  const value: AngelDurableMemory = {
    sessionHash: hash,
    locale: input.locale,
    lane: sanitizeVlmText(input.lane, 48) || "general",
    summary,
    recentTopics,
    turnCount: (previous?.turnCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    mode: "local_session_memory",
  };

  const supabase = getSupabaseServiceRoleClient();
  if (supabase && hasSupabaseServiceRoleConfig()) {
    const { error } = await supabase.from("velmere_angel_memories").upsert(
      {
        session_hash: value.sessionHash,
        locale: value.locale,
        lane: value.lane,
        summary: value.summary,
        recent_topics: value.recentTopics,
        turn_count: value.turnCount,
        updated_at: value.updatedAt,
      },
      { onConflict: "session_hash" },
    );
    if (!error) return { ok: true as const, mode: "supabase" as const, marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER };
  }

  localMemory.set(hash, value);
  pruneLocalMemory();
  return { ok: true as const, mode: "local_session_memory" as const, marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER };
}

export async function clearAngelDurableMemory(input: { sessionId?: string; accountId?: string }) {
  const hash = sessionHash(input.sessionId, input.accountId);
  if (!hash) {
    return {
      ok: false as const,
      mode: "disabled" as const,
      reason: "invalid_memory_identity" as const,
      marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER,
    };
  }
  localMemory.delete(hash);
  if (hasSupabaseServiceRoleConfig()) {
    try {
      const query = new URLSearchParams({ session_hash: `eq.${hash}` });
      const response = await supabaseServiceRestRequest(
        `/velmere_angel_memories?${query.toString()}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
        DURABLE_MEMORY_DELETE_TIMEOUT_MS,
      );
      if (response?.ok) {
        return {
          ok: true as const,
          mode: "supabase" as const,
          marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER,
        };
      }
    } catch {
      // Durable deletion must fail closed without exposing provider details.
    }
    return {
      ok: false as const,
      mode: "supabase" as const,
      reason: "durable_delete_failed" as const,
      marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER,
    };
  }
  return { ok: true as const, mode: "local_session_memory" as const, marker: PASS2227_ANGEL_DURABLE_MEMORY_MARKER };
}

export function getAngelDurableMemoryMarker() {
  return `${PASS2227_ANGEL_DURABLE_MEMORY_MARKER}:${PASS2229_ANGEL_MEMORY_COMPRESSION_MARKER}:${PASS2232_ANGEL_MEMORY_TTL_MARKER}`;
}
