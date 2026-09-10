import { randomUUID } from "node:crypto";
import { fetchWithDeadline, readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetch } from "@/lib/network/safe-egress";
import { writeOperationalEvent } from "@/lib/security/operational-log-boundary";
import type { TokenRiskResult } from "./risk-types";
import type { ShieldChatResponse } from "./shield-chat";
import type { Pass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";

export type Pass426AngelLocale = "pl" | "en" | "de";
export type Pass426AngelProviderMode = "sealed_local" | "local_openai_compatible" | "server_openai_compatible" | "provider_error_fallback";
export type Pass426AngelClaimState = "facts_only" | "guarded" | "source_bound";

export type Pass426AngelAnswer = {
  version: "angel-provider-gateway";
  generatedAt: string;
  persona: "Velmère Angel";
  providerMode: Pass426AngelProviderMode;
  model: string;
  locale: Pass426AngelLocale;
  claimState: Pass426AngelClaimState;
  answer: string;
  cards: Array<{ label: string; value: string; body: string }>;
  citations: Array<{ id: string; label: string; state: string }>;
  blockedClaims: string[];
  safetyRails: string[];
  providerDiagnostics: {
    enabled: boolean;
    providerClass: "disabled" | "local" | "remote";
    usedNetworkProvider: boolean;
    ms: number;
    errorCode?: "timeout" | "upstream_rejected" | "invalid_response" | "network_failure";
    correlationId?: string;
  };
};

type OpenAiCompatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAiCompatResponse = {
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  output_text?: string;
  error?: { message?: string } | string;
};

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1";
const LOCAL_ANGEL_ORIGINS = new Set([
  "http://127.0.0.1:1234",
  "http://localhost:1234",
  "http://[::1]:1234",
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://[::1]:11434",
]);
const MAX_ANGEL_REQUEST_BYTES = 262_144;
const MAX_ANGEL_RESPONSE_BYTES = 512 * 1024;

function safeProviderErrorCode(error: unknown): NonNullable<Pass426AngelAnswer["providerDiagnostics"]["errorCode"]> {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (error instanceof DOMException && error.name === "AbortError" || message.includes("timeout")) return "timeout";
  if (message.includes("provider returned")) return "upstream_rejected";
  if (message.includes("json") || message.includes("response_too_large")) return "invalid_response";
  return "network_failure";
}

function angelRemoteAllowedHosts() {
  return new Set(
    (process.env.VELMERE_ANGEL_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean),
  );
}

function isAllowedLocalAngelBase(baseUrl: string) {
  try {
    return LOCAL_ANGEL_ORIGINS.has(new URL(baseUrl).origin);
  } catch {
    return false;
  }
}
const DEFAULT_MODEL = "velmere-angel-local";

function assertRemoteAngelProviderAuthority(): never {
  throw new Error(
    "angel_remote_provider_rights_and_processor_authority_not_verified",
  );
}

function now() {
  return new Date().toISOString();
}

function safeLocale(locale?: string | null): Pass426AngelLocale {
  return locale === "en" || locale === "de" || locale === "pl" ? locale : "pl";
}

function clampText(input: unknown, max = 1800) {
  return String(input ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toPct(value: unknown, fallback = 0) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return `${Math.round(n)}%`;
}

function riskLabel(score: number, locale: Pass426AngelLocale) {
  if (score >= 82) return locale === "pl" ? "krytyczne" : locale === "de" ? "kritisch" : "critical";
  if (score >= 62) return locale === "pl" ? "wysokie" : locale === "de" ? "hoch" : "high";
  if (score >= 35) return locale === "pl" ? "obserwacja" : locale === "de" ? "Beobachtung" : "watch";
  return locale === "pl" ? "niskie" : locale === "de" ? "niedrig" : "low";
}

function chooseClaimState(brain: Pass422BrainMemoryCore): Pass426AngelClaimState {
  const brake = brain.pass425.hallucinationBrake.allowance;
  if (brake === "facts_only" || brain.pass425.arbitrationMode === "stale_or_missing_sealed") return "facts_only";
  if (brake === "cautious_summary" || brain.pass425.confidenceBand === "low" || brain.pass425.confidenceBand === "guarded") return "guarded";
  return "source_bound";
}

function blockedClaims(brain: Pass422BrainMemoryCore) {
  return Array.from(new Set([
    ...brain.pass425.hallucinationBrake.blockedClaims,
    "pretending to be ChatGPT, Gemini, or another external brand",
    "claiming sentience or independent life",
    "investment instruction",
    "guaranteed price direction",
  ])).slice(0, 10);
}

function safetyRails(locale: Pass426AngelLocale) {
  if (locale === "de") {
    return [
      "Angel antwortet nur aus dem Velmère-Payload und markiert fehlende Daten.",
      "Keine Kauf-/Verkaufsanweisung und keine garantierte Richtung.",
      "API-Keys bleiben serverseitig; niemals im Browser oder in der App.",
      "Lokales Modell ist optional; deterministischer Fallback bleibt aktiv.",
    ];
  }
  if (locale === "en") {
    return [
      "Angel answers only from the Velmère payload and names missing data.",
      "No buy/sell instruction and no guaranteed direction.",
      "API keys stay server-side; never in browser or mobile code.",
      "Local model is optional; deterministic fallback remains active.",
    ];
  }
  return [
    "Angel odpowiada tylko z payloadu Velmère i pokazuje brakujące dane.",
    "Bez instrukcji kup/sprzedaj i bez gwarancji kierunku ceny.",
    "Klucze API zostają po stronie serwera; nigdy w browserze ani apce.",
    "Model lokalny jest opcjonalny; deterministic fallback zostaje aktywny.",
  ];
}

function compactPayload(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  deterministic: ShieldChatResponse;
  prompt: string;
  locale: Pass426AngelLocale;
}) {
  const topRail = input.brain.evidenceRail[0];
  const topMissing = input.brain.missingData.slice(0, 8);
  return {
    locale: input.locale,
    userPrompt: clampText(input.prompt, 900),
    asset: input.brain.asset,
    score: input.result.score,
    level: input.result.level,
    brainConfidence: input.brain.confidence,
    claimState: chooseClaimState(input.brain),
    arbitration: input.brain.pass425.arbitrationMode,
    confidenceBand: input.brain.pass425.confidenceBand,
    hallucinationAllowance: input.brain.pass425.hallucinationBrake.allowance,
    memory: {
      livingState: input.brain.livingState,
      sampleCount: input.brain.memory.sampleCount,
      retentionYears: input.brain.longTermMemory.retentionYears,
      overfitGuard: input.brain.memory.overfitGuard,
      trend: input.brain.memory.trend,
      antiOverfitReason: input.brain.memory.overfitReason,
    },
    sources: {
      sourceCount: input.brain.sourceGenome.sourceCount,
      secondProvider: input.brain.sourceGenome.secondProvider,
      providerRisk: input.brain.sourceGenome.providerRisk,
      freshness: input.brain.sourceGenome.freshness,
    },
    strongestEvidence: topRail ? {
      label: topRail.label,
      score: topRail.score,
      reason: topRail.reason,
      evidence: topRail.evidence.slice(0, 4),
    } : null,
    missingData: topMissing,
    deterministicAnswer: input.deterministic.answer,
    nextActions: input.deterministic.nextActions.slice(0, 4),
  };
}

function systemPrompt(locale: Pass426AngelLocale) {
  const language = locale === "de" ? "German" : locale === "en" ? "English" : "Polish";
  return [
    "You are Velmère Angel, a private source-bound market risk assistant inside Velmère Shield.",
    "You are not ChatGPT, not Gemini and not a generic public chatbot. Your visible persona is Angel.",
    `Answer in ${language}.`,
    "Use only the provided JSON payload. Do not add external facts, prices, news, providers or claims.",
    "Never provide buy/sell instructions, guaranteed price direction, legal proof, fraud accusation or hidden certainty.",
    "If data is missing or the second provider is weak, say that confidence is limited.",
    "Keep the answer short, premium, calm and useful. Prefer 3-6 sentences plus short next steps.",
  ].join("\n");
}

function userPrompt(payload: ReturnType<typeof compactPayload>) {
  return `Velmère payload:\n${JSON.stringify(payload, null, 2)}\n\nWrite Angel's answer now.`;
}

function sanitizeModelOutput(text: string, locale: Pass426AngelLocale, fallback: string) {
  const clean = clampText(text, 1800);
  if (!clean) return fallback;
  const lower = clean.toLowerCase();
  const banned = [
    "guaranteed",
    "gwarant",
    "garantiert",
    "buy now",
    "sell now",
    "kup teraz",
    "sprzedaj teraz",
    "na pewno wzrośnie",
    "will definitely",
    "scam confirmed",
    "fraud confirmed",
  ];
  if (banned.some((item) => lower.includes(item))) return fallback;
  const sentenceLimit = locale === "pl" ? 9 : 8;
  const parts = clean.split(/(?<=[.!?])\s+/).slice(0, sentenceLimit);
  return parts.join(" ").trim() || fallback;
}

function deterministicAngelAnswer(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  deterministic: ShieldChatResponse;
  prompt: string;
  locale: Pass426AngelLocale;
}) {
  const { result, brain, locale } = input;
  const symbol = result.token.symbol.toUpperCase();
  const risk = riskLabel(result.score, locale);
  const missing = brain.missingData.length ? brain.missingData.slice(0, 4).join(" · ") : locale === "pl" ? "brak kluczowych braków" : locale === "de" ? "keine Kernlücken" : "no core gaps";
  const top = brain.evidenceRail[0]?.label ?? (locale === "pl" ? "brak dominującej warstwy" : locale === "de" ? "keine dominante Ebene" : "no dominant layer");
  if (locale === "de") {
    return `Angel widzi ${symbol} jako ${risk} Risk-Review (${result.score}/100, Konfidenz ${brain.confidence}%). Dominante Ebene: ${top}. Quellenmodus: ${brain.pass425.arbitrationMode}, Zweitprovider: ${brain.sourceGenome.secondProvider}, Halluzinationsbremse: ${brain.pass425.hallucinationBrake.allowance}. Fehlende Daten: ${missing}. Nächster Schritt: ${input.deterministic.nextActions[0] ?? "Quellen und fehlende Felder prüfen."}`;
  }
  if (locale === "en") {
    return `Angel reads ${symbol} as a ${risk} risk review (${result.score}/100, confidence ${brain.confidence}%). Dominant layer: ${top}. Source mode: ${brain.pass425.arbitrationMode}, second provider: ${brain.sourceGenome.secondProvider}, hallucination brake: ${brain.pass425.hallucinationBrake.allowance}. Missing data: ${missing}. Next step: ${input.deterministic.nextActions[0] ?? "Verify sources and missing fields."}`;
  }
  return `Angel widzi ${symbol} jako poziom ryzyka: ${risk} (${result.score}/100, confidence ${brain.confidence}%). Dominująca warstwa: ${top}. Tryb źródeł: ${brain.pass425.arbitrationMode}, drugi provider: ${brain.sourceGenome.secondProvider}, hamulec halucynacji: ${brain.pass425.hallucinationBrake.allowance}. Brakujące dane: ${missing}. Następny krok: ${input.deterministic.nextActions[0] ?? "sprawdź źródła i brakujące pola."}`;
}

async function callOpenAiCompatible(input: {
  messages: OpenAiCompatMessage[];
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const endpoint = `${input.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body = JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.18,
      max_tokens: 520,
    });
    if (Buffer.byteLength(body, "utf8") > MAX_ANGEL_REQUEST_BYTES) {
      throw new Error("Angel provider request exceeds bounded payload policy");
    }
    const init: RequestInit = {
      method: "POST",
      signal: controller.signal,
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey || "velmere-local"}`,
      },
      body,
    };
    const response = isAllowedLocalAngelBase(input.baseUrl)
      ? await fetchWithDeadline(endpoint, init, { timeoutMs: input.timeoutMs, operation: "angel_local_loopback_provider" })
      : (assertRemoteAngelProviderAuthority(), await safeEgressFetch(endpoint, init, {
          allowedHosts: angelRemoteAllowedHosts(),
          allowSubdomains: false,
          allowedMethods: ["POST"],
          maxRedirects: 0,
          timeoutMs: input.timeoutMs,
          maxRequestBytes: MAX_ANGEL_REQUEST_BYTES,
          maxResponseBytes: MAX_ANGEL_RESPONSE_BYTES,
          operation: "angel_openai_compatible_provider",
        }));
    const data = (await readJsonResponseBounded<OpenAiCompatResponse>(response, MAX_ANGEL_RESPONSE_BYTES).catch(() => ({} as OpenAiCompatResponse)));
    if (!response.ok) {
      const detail = typeof data.error === "string" ? data.error : data.error?.message;
      throw new Error(detail || `Provider returned ${response.status}`);
    }
    const text = data.output_text ?? data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";
    return clampText(text, 1800);
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildPass426AngelResponse(input: {
  result: TokenRiskResult;
  brain: Pass422BrainMemoryCore;
  deterministic: ShieldChatResponse;
  prompt: string;
  locale?: string | null;
}): Promise<Pass426AngelAnswer> {
  const started = Date.now();
  const locale = safeLocale(input.locale);
  const fallback = deterministicAngelAnswer({ ...input, locale });
  const provider = String(process.env.VELMERE_ANGEL_PROVIDER ?? "sealed").toLowerCase();
  const enabled = ["local", "lmstudio", "ollama", "openai_compatible", "server"].includes(provider);
  const baseUrl = process.env.VELMERE_ANGEL_BASE_URL || (enabled ? DEFAULT_LOCAL_BASE_URL : "");
  const model = process.env.VELMERE_ANGEL_MODEL || DEFAULT_MODEL;
  const timeoutMs = Math.max(1200, Math.min(12_000, Number(process.env.VELMERE_ANGEL_TIMEOUT_MS || 4500)));
  const payload = compactPayload({ ...input, locale });
  let providerMode: Pass426AngelProviderMode = "sealed_local";
  let answer = fallback;
  let errorCode: Pass426AngelAnswer["providerDiagnostics"]["errorCode"];
  let correlationId: string | undefined;
  let usedNetworkProvider = false;

  if (enabled && baseUrl) {
    try {
      usedNetworkProvider = true;
      const raw = await callOpenAiCompatible({
        baseUrl,
        model,
        timeoutMs,
        apiKey: process.env.VELMERE_ANGEL_API_KEY,
        messages: [
          { role: "system", content: systemPrompt(locale) },
          { role: "user", content: userPrompt(payload) },
        ],
      });
      answer = sanitizeModelOutput(raw, locale, fallback);
      providerMode = isAllowedLocalAngelBase(baseUrl) ? "local_openai_compatible" : "server_openai_compatible";
    } catch (err) {
      errorCode = safeProviderErrorCode(err);
      correlationId = randomUUID();
      writeOperationalEvent({
        level: "warn",
        system: "velmere.angel.provider",
        event: "provider_fallback",
        code: errorCode,
        metrics: {
          providerClass: isAllowedLocalAngelBase(baseUrl) ? "local" : "remote",
          usedNetworkProvider: true,
        },
        identifiers: { correlation: correlationId },
        error: err,
      });
      providerMode = "provider_error_fallback";
      answer = fallback;
    }
  }

  return {
    version: "angel-provider-gateway",
    generatedAt: now(),
    persona: "Velmère Angel",
    providerMode,
    model,
    locale,
    claimState: chooseClaimState(input.brain),
    answer,
    cards: [
      { label: locale === "pl" ? "Ryzyko" : locale === "de" ? "Risiko" : "Risk", value: `${input.result.score}/100`, body: `${riskLabel(input.result.score, locale)} · ${toPct(input.brain.confidence)}` },
      { label: locale === "pl" ? "Źródła" : locale === "de" ? "Quellen" : "Sources", value: input.brain.pass425.arbitrationMode, body: `Second provider: ${input.brain.sourceGenome.secondProvider}; freshness: ${input.brain.sourceGenome.freshness}.` },
      { label: locale === "pl" ? "Pamięć" : locale === "de" ? "Memory" : "Memory", value: input.brain.memory.overfitGuard, body: `${input.brain.longTermMemory.retentionYears}y ledger · ${input.brain.memory.trend} · ${input.brain.pass425.memoryWritePolicy.mode}.` },
    ],
    citations: [
      { id: "risk_payload", label: "Risk engine", state: `${input.result.score}/100` },
      { id: "source_quorum", label: "Source arbitration", state: input.brain.pass425.arbitrationMode },
      { id: "memory_decay", label: "Long-term memory", state: input.brain.memory.overfitGuard },
    ],
    blockedClaims: blockedClaims(input.brain),
    safetyRails: safetyRails(locale),
    providerDiagnostics: {
      enabled,
      providerClass: !enabled ? "disabled" : isAllowedLocalAngelBase(baseUrl) ? "local" : "remote",
      usedNetworkProvider,
      ms: Date.now() - started,
      errorCode,
      correlationId,
    },
  };
}
