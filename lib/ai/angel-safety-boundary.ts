import {
  inspectVlmAdviceBoundary,
  type VlmAdviceBoundaryInspection,
} from "./vlm-advice-boundary";
import { inspectVlmUserPrompt } from "./vlm-user-prompt-boundary";
import {
  foldVlmSecurityConfusables,
  inspectVlmText,
  normalizeVlmText,
  type VlmSecurityFlag,
  type VlmSecurityInspection,
} from "./vlm-security";

export const ANGEL_SAFETY_LIMITS = {
  maxMessages: 10,
  maxCharsPerMessage: 1_400,
  maxConversationChars: 6_000,
} as const;

type AngelSafetyLocale = "pl" | "en" | "de";
type RawAngelHistoryEntry = { role?: unknown; content?: unknown };

const ASSISTANT_PRIVILEGE_ESCALATION = [
  /\b(?:new|updated|hidden|privileged|higher[- ]priority)\b.{0,40}\b(?:system|developer|instruction|policy|rule|priority)\b/i,
  /\b(?:system|developer|instruction|policy|rule|priority)\b.{0,80}\b(?:ignore|override|replace|follow|obey|always|must|higher priority|buy|sell|leverage)\b/i,
  /\b(?:from now on|treat this as|you must always|always tell the user)\b/i,
  /\b(?:nowa|ukryta|uprzywilejowana|wyzszy priorytet)\b.{0,40}\b(?:zasada|instrukcja|polityka|systemowa|deweloperska)\b/i,
  /\b(?:od teraz|traktuj to jako|musisz zawsze|zawsze mow uzytkownikowi)\b/i,
  /\b(?:neue|aktualisierte|versteckte|privilegierte|hohere prioritat)\b.{0,40}\b(?:systemregel|entwicklerregel|anweisung|richtlinie|regel)\b/i,
  /\b(?:ab jetzt|behandle dies als|du musst immer|sage dem nutzer immer)\b/i,
];

export type AngelRequestSafetyPreflight = {
  decision: "ALLOW" | "ABSTAIN" | "REJECT";
  code: string | null;
  securityInspection: VlmSecurityInspection;
  securityFlags: VlmSecurityFlag[];
  adviceInspection: VlmAdviceBoundaryInspection;
  providerInspectionText: string;
};

function oversizedInspection(value: string): VlmSecurityInspection {
  const base = inspectVlmText(value, Number.MAX_SAFE_INTEGER);
  return {
    ...base,
    safe: false,
    risk: "block",
    score: Math.max(72, base.score),
    flags: Array.from(new Set([...base.flags, "oversized_input" as const])),
  };
}

function emptyAdviceInspection() {
  return inspectVlmAdviceBoundary("");
}

export function inspectAngelRequestSafety(input: {
  message: unknown;
  history: unknown;
}): AngelRequestSafetyPreflight {
  const rawMessage = input.message === undefined || input.message === null ? "" : input.message;
  const rawHistory = input.history === undefined || input.history === null ? [] : input.history;
  if (typeof rawMessage !== "string" || !Array.isArray(rawHistory)) {
    const inspection = inspectVlmText("invalid_angel_request_shape");
    return { decision: "REJECT", code: "invalid_angel_request_shape", securityInspection: inspection, securityFlags: inspection.flags, adviceInspection: emptyAdviceInspection(), providerInspectionText: "" };
  }
  const entries = rawHistory as RawAngelHistoryEntry[];
  const shapeInvalid = entries.some((entry) => !entry || (entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string" || !entry.content.trim());
  if (shapeInvalid) {
    const inspection = inspectVlmText("invalid_angel_history_shape");
    return { decision: "REJECT", code: "invalid_angel_history_shape", securityInspection: inspection, securityFlags: inspection.flags, adviceInspection: emptyAdviceInspection(), providerInspectionText: "" };
  }
  const normalizedMessage = normalizeVlmText(rawMessage);
  const normalizedEntries = entries.map((entry) => ({ role: entry.role as "user" | "assistant", content: normalizeVlmText(entry.content) }));
  const totalChars = normalizedMessage.length + normalizedEntries.reduce((sum, entry) => sum + entry.content.length, 0);
  const oversized = normalizedMessage.length > ANGEL_SAFETY_LIMITS.maxCharsPerMessage
    || normalizedEntries.some((entry) => entry.content.length > ANGEL_SAFETY_LIMITS.maxCharsPerMessage)
    || normalizedEntries.length > ANGEL_SAFETY_LIMITS.maxMessages
    || totalChars > ANGEL_SAFETY_LIMITS.maxConversationChars;
  const userText = [normalizedMessage, ...normalizedEntries.filter((entry) => entry.role === "user").map((entry) => entry.content)].filter(Boolean).join("\n");
  const providerInspectionText = JSON.stringify({ currentUserMessage: normalizedMessage, history: normalizedEntries });
  if (oversized) {
    const inspection = oversizedInspection(providerInspectionText);
    return { decision: "REJECT", code: "angel_context_too_large", securityInspection: inspection, securityFlags: inspection.flags, adviceInspection: inspectVlmAdviceBoundary(userText), providerInspectionText };
  }
  const userInspection = inspectVlmUserPrompt(userText, ANGEL_SAFETY_LIMITS.maxConversationChars);
  if (!userInspection.safe) {
    return { decision: "REJECT", code: "angel_input_security_policy", securityInspection: userInspection, securityFlags: userInspection.flags, adviceInspection: inspectVlmAdviceBoundary(userText), providerInspectionText };
  }
  for (const entry of normalizedEntries.filter((item) => item.role === "assistant")) {
    const inspection = inspectVlmText(entry.content, ANGEL_SAFETY_LIMITS.maxCharsPerMessage);
    const folded = foldVlmSecurityConfusables(entry.content)
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase();
    const advice = inspectVlmAdviceBoundary(entry.content);
    if (!inspection.safe || ASSISTANT_PRIVILEGE_ESCALATION.some((pattern) => pattern.test(folded)) || !advice.allowed) {
      const flags = Array.from(new Set([...inspection.flags, "role_confusion" as const]));
      return {
        decision: "REJECT",
        code: "assistant_history_privilege_escalation",
        securityInspection: { ...inspection, safe: false, risk: "block", score: Math.max(76, inspection.score), flags },
        securityFlags: flags,
        adviceInspection: advice,
        providerInspectionText,
      };
    }
  }
  const adviceInspection = inspectVlmAdviceBoundary(userText);
  if (adviceInspection.decision === "ABSTAIN_INDIVIDUALIZED_ADVICE") {
    return { decision: "ABSTAIN", code: adviceInspection.publicCode, securityInspection: userInspection, securityFlags: userInspection.flags, adviceInspection, providerInspectionText };
  }
  if (!adviceInspection.allowed) {
    return { decision: "REJECT", code: adviceInspection.publicCode ?? "angel_advice_policy_rejected", securityInspection: userInspection, securityFlags: userInspection.flags, adviceInspection, providerInspectionText };
  }
  return { decision: "ALLOW", code: null, securityInspection: userInspection, securityFlags: userInspection.flags, adviceInspection, providerInspectionText };
}

export function buildAngelAdviceAbstention(locale: AngelSafetyLocale) {
  if (locale === "pl") return "Wstrzymuję się od spersonalizowanej decyzji inwestycyjnej. Mogę przedstawić neutralne, oparte na dowodach czynniki ryzyka, niepewność i bezpieczne kroki weryfikacji, ale nie podejmę za Ciebie decyzji transakcyjnej, dotyczącej wielkości pozycji ani dźwigni.";
  if (locale === "de") return "Ich enthalte mich einer personalisierten Anlageentscheidung. Ich kann neutrale, evidenzgebundene Risikofaktoren, Unsicherheit und sichere Prüfschritte erläutern, treffe aber keine individuelle Handels-, Positionsgrößen- oder Hebelentscheidung für dich.";
  return "I am abstaining from a personalized investment decision. I can provide neutral, evidence-bound risk factors, uncertainty, and safe verification steps, but I will not make an individual trading, position-size, or leverage decision for you.";
}

export function inspectAngelOutputAdvice(value: unknown) {
  const normalized = normalizeVlmText(value).trim();
  const trustedAbstention = (["pl", "en", "de"] as const)
    .map((locale) => buildAngelAdviceAbstention(locale))
    .find((prefix) => normalized === prefix || normalized.startsWith(`${prefix}\n`));
  // The exact server-authored abstention is a safety control, not advice. Only
  // exempt that immutable prefix; any provider/gate suffix is still inspected.
  return inspectVlmAdviceBoundary(trustedAbstention
    ? normalized.slice(trustedAbstention.length).trim()
    : normalized);
}
