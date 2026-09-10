import { foldVlmSecurityConfusables, inspectVlmText, type VlmSecurityInspection } from "./vlm-security";

const META_PROMPT_ANALYSIS = [
  /\b(?:analy[sz]e|explain|identify|classify|critique|translate|why is|why does)\b.{0,90}\b(?:malicious|unsafe|injection|prompt|instruction\w*|message\w*|quoted|example\w*)\b/i,
  /\b(?:przeanalizuj|wyjasnij|zidentyfikuj|sklasyfikuj|skrytykuj|przetlumacz|dlaczego)\b.{0,100}\b(?:zlosliw\w*|niebezpieczn\w*|injection|prompt|instrukcj\w*|wiadomosc\w*|cytat\w*|przyklad\w*)\b/i,
  /\b(?:analysiere|erklaere|identifiziere|klassifiziere|kritisiere|ubersetze|warum)\b.{0,100}\b(?:bosartig\w*|gefahrlich\w*|injection|prompt|anweisung\w*|nachricht\w*|zitat\w*|beispiel\w*)\b/i,
];

const EXECUTION_INTENT = [
  /\b(?:then|after that|also|now)\b.{0,30}\b(?:execute|follow|obey|apply|run|call|send|upload|reveal)\b/i,
  /\b(?:a potem|potem|rowniez|teraz)\b.{0,30}\b(?:wykonaj|zastosuj|uruchom|wywolaj|wyslij|ujawnij)\b/i,
  /\b(?:danach|dann|auch|jetzt)\b.{0,30}\b(?:ausfuhren|befolgen|anwenden|starten|aufrufen|senden|offenbaren)\b/i,
];

const QUOTE_OR_EXPLICIT_SAMPLE = /["'“”„«»`]|(?:malicious prompt|unsafe prompt|zlosliwy prompt|niebezpieczny prompt|bosartiger prompt|gefahrlicher prompt|quoted example|cytowany przyklad|zitiertes beispiel)/i;

function any(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

export function inspectVlmUserPrompt(value: unknown, max = 24_000): VlmSecurityInspection {
  const inspection = inspectVlmText(value, max);
  if (inspection.safe) return inspection;
  const text = foldVlmSecurityConfusables(inspection.normalized).normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  const meta = any(META_PROMPT_ANALYSIS, text) && QUOTE_OR_EXPLICIT_SAMPLE.test(text);
  const executionIntent = any(EXECUTION_INTENT, text);
  const disallowedFlags = inspection.flags.filter((flag) => [
    "secret_material",
    "encoded_payload",
    "oversized_input",
  ].includes(flag));
  if (!meta || executionIntent || disallowedFlags.length > 0) return inspection;
  return {
    ...inspection,
    safe: true,
    risk: "review",
    score: Math.min(69, inspection.score),
  };
}
