import { normalizeVlmText } from "./vlm-security";

export const VLM_TEXT_PROVIDER_SYSTEM_INSTRUCTION_MAX_CHARS = 12_000;
export const VLM_TEXT_PROVIDER_PROMPT_MAX_CHARS = 24_000;

export type TrustedProviderSystemInstructionBoundary = {
  ok: boolean;
  value: string;
  charCount: number;
  maxChars: typeof VLM_TEXT_PROVIDER_SYSTEM_INSTRUCTION_MAX_CHARS;
  error: "trusted_system_instruction_empty" | "trusted_system_instruction_oversized" | null;
};

function normalizeTrustedInstruction(value: unknown) {
  return normalizeVlmText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trusted server policy must be complete or rejected. Prefix truncation is not
 * a safe degradation because the omitted suffix may contain a critical rule.
 */
export function inspectTrustedProviderSystemInstruction(
  value: unknown,
): TrustedProviderSystemInstructionBoundary {
  const normalized = normalizeTrustedInstruction(value);
  const charCount = normalized.length;
  const error = !charCount
    ? "trusted_system_instruction_empty" as const
    : charCount > VLM_TEXT_PROVIDER_SYSTEM_INSTRUCTION_MAX_CHARS
      ? "trusted_system_instruction_oversized" as const
      : null;
  return {
    ok: error === null,
    value: normalized,
    charCount,
    maxChars: VLM_TEXT_PROVIDER_SYSTEM_INSTRUCTION_MAX_CHARS,
    error,
  };
}

