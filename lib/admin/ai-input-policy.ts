import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";

export type AdminAiPolicyReason =
  | "instruction_override"
  | "system_prompt_exfiltration"
  | "authentication_or_payment_bypass"
  | "secret_exfiltration"
  | "raw_prompt_echo";

function normalizeForPolicy(input: string) {
  return input.toLowerCase().replace(ASCII_CONTROL_PATTERN, " ").replace(/\s+/g, " ").trim();
}

export function detectAdminAiPolicyReasons(input: string): AdminAiPolicyReason[] {
  const normalized = normalizeForPolicy(input);
  const reasons = new Set<AdminAiPolicyReason>();
  if (/\b(ignore|disregard|forget|override)\b.{0,48}\b(previous|prior|system|developer|hidden)\b.{0,32}\b(instruction|message|prompt|rule)s?\b/i.test(normalized)
    || /\b(jailbreak|dan mode|developer mode)\b/i.test(normalized)) {
    reasons.add("instruction_override");
  }
  if (/\b(reveal|show|print|display|leak|extract)\b.{0,48}\b(system prompt|developer message|hidden instruction|internal prompt)\b/i.test(normalized)) {
    reasons.add("system_prompt_exfiltration");
  }
  if (/\b(bypass|disable|remove|skip|forge)\b.{0,48}\b(authentication|authorization|admin token|payment|entitlement|checkout|webhook|subscription)\b/i.test(normalized)) {
    reasons.add("authentication_or_payment_bypass");
  }
  if (/\b(reveal|show|print|display|leak|extract|exfiltrate)\b.{0,48}\b(api key|secret|environment variable|env var|bearer token|private key|seed phrase)\b/i.test(normalized)) {
    reasons.add("secret_exfiltration");
  }
  if (/\b(echo|repeat|return|output)\b.{0,32}\b(raw prompt|system prompt|developer prompt|untrusted input verbatim)\b/i.test(normalized)) {
    reasons.add("raw_prompt_echo");
  }
  return [...reasons];
}
