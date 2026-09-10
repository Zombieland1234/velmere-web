import {
  JSON_CONTROL_PATTERN,
  ZERO_WIDTH_SECURITY_PATTERN as ZERO_WIDTH_PATTERN,
} from "../security/ascii-control-characters";

import { createHash, createHmac, randomBytes } from "node:crypto";

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:(?:previous|prior)\s+)?instructions?/gi,
  /disregard\s+(the\s+)?(system|developer|previous)/gi,
  /(?:forget|override|bypass)\s+(?:all\s+)?(?:rules|instructions|guardrails|policy|payment|entitlement)/gi,
  /(?:act|pretend|behave)\s+as\s+(?:an?\s+)?(?:unrestricted|unfiltered|developer|system)/gi,
  /reveal\s+(the\s+)?(system\s+prompt|developer\s+message|api\s*key|secret)/gi,
  /output\s+(the\s+)?(api\s*key|secret|system\s+prompt)/gi,
  /(?:repeat|print|dump)\s+(?:everything|all text)\s+(?:above|before)/gi,
  /(?:translate|decode|execute)\s+(?:the\s+)?(?:hidden|following)\s+instructions?/gi,
  /mark\s+(this\s+)?asset\s+(as\s+)?safe/gi,
  /fabricate\s+(sources?|evidence|facts?)/gi,
  /execute\s+(?:the\s+)?(?:following\s+)?(?:code|shell(?:\s+command)?|command)/gi,
  /(?:z?ignoruj|pomin|pomiń|nadpisz|omin|omiń)\s+(?:wszystkie\s+)?(?:poprzednie\s+)?(?:instrukcje|zasady|zabezpieczenia|płatności|platnosci|weryfikację|weryfikacje)/gi,
  /(?:ujawnij|pokaż|wypisz)\s+(?:prompt systemowy|klucz api|sekret|instrukcje systemowe)/gi,
  /(?:ignoriere|uberschreibe|überschreibe|umgehe)\s+(?:alle\s+)?(?:vorherigen\s+)?(?:anweisungen|regeln|schutzmassnahmen|schutzmaßnahmen)/gi,
  /(?:zeige|verrate|drucke)\s+(?:systemprompt|api[- ]?schlüssel|geheimnis)/gi,
  /<\/?(?:script|iframe|object|embed|style)[^>]*>/gi,
  /(?:you are now|switch role|obey me only).{0,80}(?:root|administrator|system|developer)/gi,
  /(?:jestes teraz|zmien role|sluchaj tylko mnie).{0,80}(?:root|administratorem|systemem|deweloperem)/gi,
  /(?:du bist jetzt|wechsle die rolle|gehorche nur mir).{0,80}(?:root|administrator|system|entwickler)/gi,
];

const SECRET_PATTERNS = [
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /(?:sk|AIza|ghp|xox[baprs])[-_A-Za-z0-9]{16,}/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /\b(?:seed phrase|private key|mnemonic)\s*[:=]\s*[^\n]{8,}/gi,
  /\b(?:authorization|x-api-key)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:password|passwd|hasło|passwort)\s*[:=]\s*[^\s,;]{6,}/gi,
  /\b(?:bearer)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
];

const ENCODED_PAYLOAD_PATTERNS = [
  /\b(?:data:text\/(?:html|javascript)|javascript:|vbscript:)/i,
  /(?:^|[\s"'(])(?:file|gopher):\/\//i,
  /\b(?:base64|rot13|unicode escape|hex decode)\b.{0,80}\b(?:instruction|prompt|execute|decode)\b/i,
  /\b[A-Za-z0-9+/]{160,}={0,2}\b/,
  /(?:decode|execute|odkoduj|wykonaj|dekodiere|fuhre).{0,100}base64.{0,100}(?:hidden instructions|ukryte instrukcje|versteckte anweisung)/i,
];

const ROLE_CONFUSION_PATTERNS = [
  /(?:^|\n)\s*(?:system|developer|assistant)\s*:\s*(?:ignore|override|reveal|execute|you are)/i,
  /<\|(?:system|developer|assistant|im_start|im_end)\|>/i,
  /\[(?:system|developer|inst)\]/i,
  /(?:begin|start)\s+(?:system|developer)\s+(?:message|instructions?)/i,
  /["']role["']\s*:\s*["'](?:system|developer)["']/i,
  /["'](?:system_instruction|developer_message)["']\s*:/i,
];

const DATA_EXFILTRATION_PATTERNS = [
  /\b(?:send|upload|post|forward|exfiltrate)\b.{0,100}\b(?:secret|token|key|prompt|conversation|history|data)\b/i,
  /\b(?:wyślij|wyslij|prześlij|przeslij|ujawnij)\b.{0,100}\b(?:sekret|token|klucz|prompt|historię|dane)\b/i,
  /\b(?:sende|übertrage|offenbare)\b.{0,100}\b(?:geheimnis|token|schlüssel|prompt|verlauf|daten)\b/i,
  /\b(?:169\.254\.169\.254|metadata\.google\.internal|localhost|127\.0\.0\.1)\b/i,
  /\b(?:fetch|curl|wget|request)\b.{0,80}\b(?:metadata|internal|localhost|webhook|callback)\b/i,
  /(?:reveal|show|print|display).{0,80}(?:system prompt|developer instructions?)/i,
  /(?:print|list|dump|show|reveal).{0,100}(?:api keys?|tokens?|cookies?|environment variables?|hidden variables?)/i,
  /(?:ujawnij|pokaż|wyswietl|wyświetl).{0,80}(?:prompt systemowy|instrukcj\w* dewelopersk\w*)/i,
  /(?:wypisz|pokaz|ujawnij).{0,100}(?:klucze api|tokeny|cookies|zmienne srodowiskowe|ukryte zmienne)/i,
  /(?:zeige|offenbare|drucke).{0,80}(?:systemprompt|entwickleranweisung\w*)/i,
  /(?:gib|liste|drucke|zeige).{0,100}(?:api schlussel|tokens?|cookies?|umgebungsvariablen|versteckte variablen)/i,
];

const TOOL_MANIPULATION_PATTERNS = [
  /\b(?:call|invoke|execute|run)\b.{0,80}\b(?:tool|function|plugin|connector)\b/i,
  /\b(?:wywołaj|wywolaj|uruchom)\b.{0,80}\b(?:narzędzie|funkcję|plugin|konektor)\b/i,
  /\b(?:rufe|starte|führe)\b.{0,80}\b(?:tool|funktion|plugin|connector)\b/i,
  /(?:tool_call|function_call|recipient_name)\s*[:=]/i,
  /(?:uruchom|wywolaj).{0,100}(?:wszystkie )?(?:wewnetrzne )?(?:narzedzia|funkcje).{0,100}(?:wylacz|omin).{0,60}(?:bezpieczen|kontrol)/i,
  /(?:rufe|starte|fuhre).{0,100}(?:alle )?(?:internen )?(?:tools|funktionen).{0,100}(?:deaktiviere|umgehe).{0,60}(?:sicherheits|prufung)/i,
];

const MEMORY_POISONING_PATTERNS = [
  /\b(?:remember|store|save)\b.{0,100}\b(?:instruction|rule|system prompt|for future|next session)\b/i,
  /\b(?:zapamiętaj|zapamietaj|zapisz)\b.{0,100}\b(?:instrukcję|zasadę|prompt|na przyszłość|następną sesję)\b/i,
  /\b(?:merke|speichere)\b.{0,100}\b(?:anweisung|regel|systemprompt|für später|nächste sitzung)\b/i,
  /(?:zapamiętaj|zapamietaj|zapisz).{0,120}(?:na przyszłość|zasad|instrukcj|następn\w* sesj)/i,
  /(?:merke|speichere).{0,120}(?:später|sitzung|regel|anweisung|systemprompt)/i,
  /remember permanently.{0,140}(?:instructions?|override|safety polic)/i,
  /zapamietaj na zawsze.{0,140}(?:instrukcj|nadpis|zasad bezpieczen)/i,
  /merke dir dauerhaft.{0,140}(?:anweisung|uberschreib|sicherheitsregeln)/i,
];

const SHADOW_MANIPULATION_PATTERNS = [
  /\b(?:skip|bypass|disable|force|override)\b.{0,80}\b(?:shadow|reviewer|review|approval|verdict)\b/i,
  /\b(?:omiń|wyłącz|wymuś|nadpisz)\b.{0,80}\b(?:shadow|recenzję|recenzenta|akceptację|werdykt)\b/i,
  /\b(?:überspringe|deaktiviere|erzwinge|überschreibe)\b.{0,80}\b(?:shadow|prüfung|prüfer|freigabe|urteil)\b/i,
];

const RECEIPT_MANIPULATION_PATTERNS = [
  /\b(?:forge|replace|override|fake|mark)\b.{0,80}\b(?:receipt|signature|hash|integrity)\b/i,
  /\b(?:sfałszuj|podmień|nadpisz|oznacz)\b.{0,80}\b(?:receipt|podpis|hash|integralność|ważn\w*)\b/i,
  /\b(?:fälsche|ersetze|überschreibe|markiere)\b.{0,80}\b(?:beleg|signatur|hash|integrität|gültig)\b/i,
  /(?:ändere|verstecke|losche).{0,100}(?:signierten receipt|fehlgeschlagene prufungen|receipt status)/i,
  /\b(?:reuse|replay|rotate|replace)\b.{0,80}\b(?:receipt|key id|public key|signing key)\b/i,
  /\b(?:change|edit|hide|delete)\b.{0,100}\b(?:signed receipt|failed checks?|receipt status)\b/i,
  /\b(?:użyj ponownie|powtórz|obróć|podmień)\b.{0,80}\b(?:receipt|key id|klucz publiczny|klucz podpisu)\b/i,
  /(?:zmien|ukryj|usun).{0,100}(?:podpisany receipt|niezaliczone testy|status receiptu)/i,
  /\b(?:wiederverwende|wiederhole|rotiere|ersetze)\b.{0,80}\b(?:beleg|key id|öffentlichen schlüssel|signierschlüssel)\b/i,
];

const EVIDENCE_QUORUM_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|fake)\b.{0,90}\b(?:evidence quorum|quorum|two[- ]provider|independent source|source coverage)\b/i,
  /\b(?:zignoruj|omiń|wyłącz|wymuś|nadpisz|sfałszuj)\b.{0,90}\b(?:kworum|dwa źródła|dwóch providerów|niezależne źródło|pokrycie źródeł)\b/i,
  /\b(?:ignoriere|überspringe|deaktiviere|erzwinge|überschreibe|fälsche)\b.{0,90}\b(?:evidenzquorum|quorum|zwei provider|unabhängige quelle|quellenabdeckung)\b/i,
  /(?:zignoruj|wymus).{0,100}(?:brak providerow|evidence quorum).{0,50}(?:verified|zweryfikowan)/i,
];

const TEMPORAL_CONSISTENCY_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|fake)\b.{0,110}\b(?:temporal consistency|evidence half[- ]life|freshness gate|timestamp decay|stale evidence|time decay)\b/i,
  /\b(?:zignoruj|omin|omij|wylacz|wyłącz|wymus|wymuś|nadpisz|sfalszuj|sfałszuj)\b.{0,110}\b(?:spojnosc czasowa|spójność czasowa|polowiczny czas dowodu|half life|swiezosc|świeżość|stare dowody|zanik czasowy)\b/i,
  /\b(?:ignoriere|ueberspringe|überspringe|deaktiviere|erzwinge|ueberschreibe|uberschreibe|überschreibe|faelsche|fälsche)\b.{0,110}\b(?:zeitliche konsistenz|evidenz half[- ]life|frische gate|zeitstempelverfall|veraltete evidenz)\b/i,
];

const SOURCE_INTEGRITY_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|fake)\b.{0,100}\b(?:source integrity|source sentinel|provider family|source health|source provenance|source trust)\b/i,
  /\b(?:zignoruj|omin|omij|wylacz|wyłącz|wymus|wymuś|nadpisz|sfalszuj|sfałszuj)\b.{0,100}\b(?:integralnosc zrodel|integralność źródeł|source sentinel|rodzina providera|rodzine providera|zdrowie zrodel|zdrowie źródeł|pochodzenie zrodla|pochodzenie źródła|zaufanie zrodla|zaufanie źródła)\b/i,
  /\b(?:ignoriere|ueberspringe|überspringe|deaktiviere|erzwinge|ueberschreibe|uberschreibe|überschreibe|faelsche|fälsche)\b.{0,100}\b(?:quellenintegritaet|quellenintegrität|source sentinel|providerfamilie|quellengesundheit|quellenherkunft|quellenvertrauen)\b/i,
  /(?:replace|change|podmien|ersetze).{0,80}(?:source hash|hash zrodla|source hash).{0,80}(?:manifest|still match|nadal zgadza|weiter passe)/i,
];

const NARRATIVE_DRIFT_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|fake)\b.{0,110}\b(?:narrative drift|drift lock|previous analysis|story consistency|verdict history|tone change)\b/i,
  /\b(?:zignoruj|omin|omij|wylacz|wyłącz|wymus|wymuś|nadpisz|sfalszuj|sfałszuj)\b.{0,110}\b(?:dryf narracji|blokade dryfu|blokadę dryfu|poprzednia analiza|historia werdyktu|zmiana tonu)\b/i,
  /\b(?:ignoriere|ueberspringe|überspringe|deaktiviere|erzwinge|ueberschreibe|uberschreibe|überschreibe|faelsche|fälsche)\b.{0,110}\b(?:narrative drift|drift lock|vorherige analyse|urteilsverlauf|tonwechsel)\b/i,
];

const PAYMENT_ENTITLEMENT_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|fake|mark)\b.{0,120}\b(?:payment|paid access|entitlement|stripe session|checkout|402|webhook|audit queue)\b/i,
  /\b(?:zignoruj|omin|omij|wylacz|wyłącz|wymus|wymuś|nadpisz|sfalszuj|sfałszuj|oznacz)\b.{0,120}\b(?:platnosc|płatność|platny dostep|płatny dostęp|entitlement|sesje stripe|sesję stripe|checkout|402|webhook|kolejke audytu|kolejkę audytu)\b/i,
  /\b(?:ignoriere|ueberspringe|überspringe|deaktiviere|erzwinge|ueberschreibe|uberschreibe|überschreibe|faelsche|fälsche|markiere)\b.{0,120}\b(?:zahlung|bezahl\w* zugang|entitlement|stripe session|checkout|402|webhook|audit queue)\b/i,
  /(?:grant|give|nadaj|gib).{0,100}(?:advanced|paid|pro).{0,100}(?:without payment|bez platnosci|ohne zahlung|without entitlement|bez weryfikacji entitlement|ohne entitlement)/i,
];

const DECISION_REVERSIBILITY_MANIPULATION_PATTERNS = [
  /\b(?:ignore|bypass|disable|force|override|hide|fake)\b.{0,120}\b(?:decision reversibility|reversibility score|exit friction|slippage risk|execution friction)\b/i,
  /\b(?:zignoruj|omin|omij|wylacz|wyłącz|wymus|wymuś|ukryj|nadpisz|sfalszuj|sfałszuj)\b.{0,120}\b(?:odwracalnosc decyzji|odwracalność decyzji|poślizg|poslizg|tarcie wykonania|wyjscie z pozycji|wyjście z pozycji)\b/i,
  /\b(?:ignoriere|ueberspringe|überspringe|deaktiviere|erzwinge|verstecke|ueberschreibe|uberschreibe|überschreibe|faelsche|fälsche)\b.{0,120}\b(?:entscheidungs umkehrbarkeit|entscheidungsumkehrbarkeit|reversibility score|slippage risiko|ausführungsfriktion)\b/i,
];

const SECURITY_CONFUSABLES: Record<string, string> = {
  "а": "a", "А": "A", "е": "e", "Е": "E", "о": "o", "О": "O",
  "р": "p", "Р": "P", "с": "c", "С": "C", "у": "y", "У": "Y",
  "х": "x", "Х": "X", "і": "i", "І": "I", "ј": "j", "Ј": "J",
  "к": "k", "К": "K", "м": "m", "М": "M", "т": "t", "Т": "T",
  "в": "b", "В": "B", "н": "h", "Н": "H", "ѕ": "s", "Ѕ": "S",
  "ӏ": "l", "Ι": "I", "ι": "i", "Α": "A", "Β": "B", "Ε": "E",
  "Ζ": "Z", "Η": "H", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O",
  "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X", "ο": "o", "ρ": "p",
  "χ": "x", "ν": "v",
};

export function foldVlmSecurityConfusables(value: unknown) {
  return Array.from(normalizeVlmText(value), (char) => SECURITY_CONFUSABLES[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[łŁ]/g, (char) => char === "Ł" ? "L" : "l")
    .replace(/ß/g, "ss");
}
const SECURITY_FINGERPRINT_SECRET =
  process.env.VELMERE_SECURITY_FINGERPRINT_SECRET?.trim() || randomBytes(32).toString("hex");

export type VlmSecurityFlag =
  | "prompt_injection"
  | "secret_material"
  | "encoded_payload"
  | "role_confusion"
  | "data_exfiltration"
  | "tool_manipulation"
  | "memory_poisoning"
  | "shadow_manipulation"
  | "receipt_manipulation"
  | "evidence_quorum_manipulation"
  | "source_integrity_manipulation"
  | "temporal_consistency_manipulation"
  | "narrative_drift_manipulation"
  | "decision_reversibility_manipulation"
  | "payment_entitlement_manipulation"
  | "mixed_script"
  | "control_characters"
  | "oversized_input";

export type VlmSecurityInspection = {
  safe: boolean;
  risk: "none" | "review" | "block";
  score: number;
  flags: VlmSecurityFlag[];
  normalized: string;
  fingerprint: string;
};

function resetAndTest(pattern: RegExp, text: string) {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

export function normalizeVlmText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(JSON_CONTROL_PATTERN, " ")
    .replace(/\r\n?/g, "\n");
}

function hasSuspiciousMixedScript(text: string) {
  const hasLatin = /[A-Za-z]/.test(text);
  const hasCyrillic = /[\u0400-\u04ff]/.test(text);
  const lookalikeSequence = /[A-Za-z][\u0400-\u04ff]|[\u0400-\u04ff][A-Za-z]/.test(text);
  return hasLatin && hasCyrillic && lookalikeSequence;
}

function inspectionScore(flags: VlmSecurityFlag[]) {
  const weights: Record<VlmSecurityFlag, number> = {
    prompt_injection: 88,
    secret_material: 100,
    encoded_payload: 84,
    role_confusion: 76,
    data_exfiltration: 94,
    tool_manipulation: 78,
    memory_poisoning: 82,
    shadow_manipulation: 92,
    receipt_manipulation: 95,
    evidence_quorum_manipulation: 90,
    source_integrity_manipulation: 92,
    temporal_consistency_manipulation: 91,
    narrative_drift_manipulation: 90,
    decision_reversibility_manipulation: 88,
    payment_entitlement_manipulation: 96,
    mixed_script: 28,
    control_characters: 24,
    oversized_input: 72,
  };
  const unique = Array.from(new Set(flags));
  const strongest = Math.max(0, ...unique.map((flag) => weights[flag]));
  return Math.min(100, strongest + Math.max(0, unique.length - 1) * 4);
}

function securityFingerprint(normalized: string, flags: VlmSecurityFlag[]) {
  return createHmac("sha256", SECURITY_FINGERPRINT_SECRET)
    .update(JSON.stringify({ normalized, flags: [...flags].sort() }))
    .digest("hex")
    .slice(0, 24);
}

export function inspectVlmText(value: unknown, max = 24_000): VlmSecurityInspection {
  const raw = String(value ?? "");
  const normalized = normalizeVlmText(raw);
  const scanText = foldVlmSecurityConfusables(normalized);
  const flags: VlmSecurityFlag[] = [];
  if (INJECTION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("prompt_injection");
  if (SECRET_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("secret_material");
  if (ENCODED_PAYLOAD_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("encoded_payload");
  if (ROLE_CONFUSION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("role_confusion");
  if (DATA_EXFILTRATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("data_exfiltration");
  if (TOOL_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("tool_manipulation");
  if (MEMORY_POISONING_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("memory_poisoning");
  if (SHADOW_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("shadow_manipulation");
  if (RECEIPT_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("receipt_manipulation");
  if (EVIDENCE_QUORUM_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("evidence_quorum_manipulation");
  if (SOURCE_INTEGRITY_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("source_integrity_manipulation");
  if (TEMPORAL_CONSISTENCY_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("temporal_consistency_manipulation");
  if (NARRATIVE_DRIFT_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("narrative_drift_manipulation");
  if (DECISION_REVERSIBILITY_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("decision_reversibility_manipulation");
  if (PAYMENT_ENTITLEMENT_MANIPULATION_PATTERNS.some((pattern) => resetAndTest(pattern, scanText))) flags.push("payment_entitlement_manipulation");
  if (hasSuspiciousMixedScript(normalized)) flags.push("mixed_script");
  if (JSON_CONTROL_PATTERN.test(raw) || resetAndTest(ZERO_WIDTH_PATTERN, raw)) flags.push("control_characters");
  if (normalized.length > max) flags.push("oversized_input");
  const uniqueFlags = Array.from(new Set(flags));
  const score = inspectionScore(uniqueFlags);
  const blocking = score >= 70;
  return {
    safe: !blocking,
    risk: blocking ? "block" : flags.length ? "review" : "none",
    score,
    flags: uniqueFlags,
    normalized,
    fingerprint: securityFingerprint(normalized, uniqueFlags),
  };
}

export function sanitizeVlmText(value: unknown, max = 1000) {
  let text = normalizeVlmText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const pattern of INJECTION_PATTERNS) text = text.replace(pattern, "[filtered instruction]");
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[redacted secret]");
  for (const pattern of ENCODED_PAYLOAD_PATTERNS) text = text.replace(pattern, "[filtered encoded payload]");
  for (const pattern of ROLE_CONFUSION_PATTERNS) text = text.replace(pattern, "[filtered role override]");
  for (const pattern of DATA_EXFILTRATION_PATTERNS) text = text.replace(pattern, "[filtered data exfiltration]");
  for (const pattern of TOOL_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered tool manipulation]");
  for (const pattern of MEMORY_POISONING_PATTERNS) text = text.replace(pattern, "[filtered memory instruction]");
  for (const pattern of SHADOW_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered shadow manipulation]");
  for (const pattern of RECEIPT_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered receipt manipulation]");
  for (const pattern of EVIDENCE_QUORUM_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered evidence quorum manipulation]");
  for (const pattern of SOURCE_INTEGRITY_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered source integrity manipulation]");
  for (const pattern of TEMPORAL_CONSISTENCY_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered temporal consistency manipulation]");
  for (const pattern of NARRATIVE_DRIFT_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered narrative drift manipulation]");
  for (const pattern of DECISION_REVERSIBILITY_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered decision reversibility manipulation]");
  for (const pattern of PAYMENT_ENTITLEMENT_MANIPULATION_PATTERNS) text = text.replace(pattern, "[filtered payment entitlement manipulation]");
  return text.slice(0, max);
}

export function containsPromptInjection(value: unknown) {
  return inspectVlmText(value).flags.includes("prompt_injection");
}

export function containsVlmSecret(value: unknown) {
  return inspectVlmText(value).flags.includes("secret_material");
}

export function sanitizeIdentifier(value: unknown, fallback: string, max = 180) {
  const clean = sanitizeVlmText(value, max).replace(/[^A-Za-z0-9:_./@-]/g, "-");
  return clean || fallback;
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function boundedNumber(value: unknown, min: number, max: number, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function truncateJson<T>(value: T, maxChars = 28_000): { value: T; truncated: boolean } {
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxChars) return { value, truncated: false };
  if (Array.isArray(value)) return { value: value.slice(0, Math.max(1, Math.floor(value.length / 2))) as T, truncated: true };
  return { value, truncated: true };
}
