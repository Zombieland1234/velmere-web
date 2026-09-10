import { createSecureRuntimeId } from "@/lib/runtime/secure-runtime-id";
import { getVisibleProducts, getLocalizedString, formatMoney } from "@/lib/products/catalog";
import { sanitizeVlmText } from "@/lib/ai/vlm-security";
import type { AngelEvidenceContextInput } from "@/lib/ai/angel-evidence-context";
import { buildPass2280OutputAuditMatrix, detectPass2280AssetPolicy } from "@/lib/ai/audit-output-perfection";
import { buildPass2281AngelPremiumAuditScaffold } from "@/lib/ai/worldclass-output-contract";
import { buildPass2282AngelAuditScaffold } from "@/lib/ai/live-output-audit-harness";

export const MAX_MESSAGES = 10;
export const MAX_CHARS_PER_MESSAGE = 1400;
// PASS2220 compatibility marker: pass2220_complete_chat_reply_no_ellipsis; prior floor was basic: 900.
export type AngelReportContextDepth = "basic" | "pro" | "advanced";
export const ANGEL_STANDALONE_PRODUCT_ID = "angel" as const;
export const ANGEL_TRUTH_STANDARD_INVARIANT = "SAME_TRUTH_AND_SAFETY_AT_EVERY_REPORT_CONTEXT_DEPTH" as const;
export const ANGEL_MAX_OUTPUT_TOKENS_BY_REPORT_CONTEXT = {
  basic: 1_100,
  pro: 1_600,
  advanced: 2_100,
} as const;
// Backward-compatible alias. The key means report context depth, never a separate Angel product tier.
export const ANGEL_MAX_OUTPUT_TOKENS_BY_DEPTH = ANGEL_MAX_OUTPUT_TOKENS_BY_REPORT_CONTEXT;

export const PASS2221_ANGEL_ENGINE_MARKER =
  "pass2221-angel-engine-dedupe-context-complete-reply" as const;
export const PASS2222_ANGEL_ENGINE_MARKER =
  "pass2222-angel-safe-diagnostics-runtime-lane-log" as const;
export const PASS2223_ANGEL_ADVANCED_SERVER_GATE_MARKER =
  "pass2223-angel-advanced-server-side-entitlement-gate" as const;
export const PASS2227_ANGEL_WORLDCLASS_TENPACK_MARKER =
  "pass2227-angel-worldclass-tenpack-durable-memory-prompt-guard" as const;

export type AngelRole = "user" | "assistant";
export type AngelChatMessage = { role: AngelRole; content: string };
export type AngelRequestBody = {
  message?: string;
  locale?: "pl" | "en" | "de";
  history?: AngelChatMessage[];
  sessionId?: string;
  depth?: AngelReportContextDepth;
  evidenceContext?: AngelEvidenceContextInput | null;
};

export function buildAngelRequestId(req: Request) {
  const header = sanitizeVlmText(req.headers.get("x-velmere-angel-request"), 120);
  if (header) return header;
  return createSecureRuntimeId("angel-api");
}

export function buildCatalogContext(locale: "pl" | "en" | "de") {
  return getVisibleProducts()
    .slice(0, 18)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      title: getLocalizedString(product.title, locale),
      description: getLocalizedString(product.description, locale),
      price: formatMoney(product.price, locale),
      status: product.status,
      fulfilmentMode: product.fulfilmentMode,
      collection: product.collection,
      tags: product.tags.slice(0, 12),
      variants: product.variants.slice(0, 12).map((variant) => ({
        id: variant.id,
        title: variant.title,
        size: variant.size,
        price: variant.price
          ? formatMoney(variant.price, locale)
          : formatMoney(product.price, locale),
        available: Boolean(
          variant.providerVariantId ||
          product.providerVariantIds?.[variant.id] ||
          product.fulfilmentMode !== "automatic",
        ),
      })),
    }));
}

export function cleanMessages(history: AngelChatMessage[] = []) {
  return history
    .filter(
      (message): message is AngelChatMessage =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: sanitizeVlmText(message.content, MAX_CHARS_PER_MESSAGE),
    }));
}

function normalizeAngelIntentText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameAngelTurn(a: string, b: string) {
  return normalizeAngelIntentText(a) === normalizeAngelIntentText(b);
}

export function buildDedupedAngelConversation(
  history: AngelChatMessage[],
  message: string,
) {
  const last = history.at(-1);
  if (message && last?.role === "user" && sameAngelTurn(last.content, message)) {
    return history.slice(-(MAX_MESSAGES + 1));
  }
  return [
    ...history,
    ...(message ? [{ role: "user" as const, content: message }] : []),
  ].slice(-(MAX_MESSAGES + 1));
}

export function detectAngelFallbackLane(text: string) {
  const lower = normalizeAngelIntentText(text);

  // Access must describe a real access/payment intent. A market-price question such
  // as "price of BTC" must remain in the market lane rather than being treated as
  // a checkout request merely because it contains the word "price".
  const explicitAccessIntent = /stripe|checkout|entitlement|subscription|server[- ]side receipt|payment proof|payment|paywall|unlock|paid access|connect wallet|płatno|platno|zapła|zaplac|odblok|dostęp płat|dostep plat|bezahlen|zahlung|freischalt|zugang|abo/.test(lower);
  const priceOfTierIntent = /price|cost|cena|koszt|preis/.test(lower)
    && /\b(pro|advanced|tier|plan|subscription|audit|pdf|shield)\b/.test(lower);
  if (explicitAccessIntent || priceOfTierIntent) return "access" as const;

  // Delivery format is more specific than the underlying subject. "BTC PDF" and
  // "security audit report" therefore stay in the PDF lane.
  if (/\bpdf\b|lens|report|raport|bericht|download|pobierz|export/.test(lower)) return "pdf" as const;
  if (/audit|security|vulnerability|proof|evidence|scope|disclosure|audyt|bezpiecze|dow[oó]d|luka|sicher|nachweis|smart contract|kontrakt/.test(lower)) return "audit" as const;
  if (/shield|real markets|market|coin|token|crypto|btc|eth|sol|msft|aapl|nvda|spy|etf|forex|\bfx\b|wykres|giełd|börse|markt|whale|liquidity|płynno|plynno/.test(lower)) return "markets" as const;
  if (/size|fit|hoodie|shirt|spodnie|rozmiar|drop|wear|tragen|größe|collection|kolekcj/.test(lower)) return "store" as const;
  return "general" as const;
}

export function isCasualAngelSmallTalk(text: string) {
  const compact = text
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźżäöüß0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return false;
  if (/(btc|eth|sol|aapl|nvda|spy|pdf|audit|shield|wallet|stripe|vlm|risk|chart|market|token|contract|shop|hoodie|fit|product)/i.test(compact)) return false;
  return /^(hey|hi|hello|yo|sup|siema|elo|hej|czesc|cześć|co robisz|what u doin|what are you doing|test|ok|okej|dobra)$/.test(compact);
}

export function buildCasualAngelReply(locale: "pl" | "en" | "de") {
  if (locale === "pl") {
    return "Jestem Angel — mogę pomóc przy audycie, Shield, PDF, VLM, sklepie albo dopasowaniu kolekcji. Napisz konkretny temat, a odpowiem bez udawania brakujących danych.";
  }
  if (locale === "de") {
    return "Ich bin Angel — ich kann bei Audit, Shield, PDF, VLM, Store oder Collection-Fit helfen. Nenne den konkreten Kontext, und ich antworte ohne fehlende Daten zu erfinden.";
  }
  return "I’m Angel — I can help with audit, Shield, PDF, VLM, the store, or collection fit. Give me the context and I’ll answer without pretending missing data is confirmed.";
}

export function localeName(locale: "pl" | "en" | "de") {
  if (locale === "pl") return "Polish";
  if (locale === "de") return "German";
  return "English";
}

export function buildAngelOperatingContext(locale: "pl" | "en" | "de") {
  const pl = locale === "pl";
  const de = locale === "de";
  return {
    scopeVersion: "pass2183-angel-audit-scope-v1",
    allowedSurfaces: [
      "audit-watch",
      "advanced-audit-offer",
      "vlm-brain",
      "shield",
      "real-markets",
      "whale-watch",
      "critical-risk-alerts",
      "lens-pdf",
      "square",
      "account",
      "checkout",
      "clothing-store",
    ],
    rule: pl
      ? "Angel nie jest tylko botem od ubrań. Jeżeli rozmowa/handoff dotyczy audytu, projektów, VLM Brain, security, Stripe, Supabase, PDF albo marketów, kontynuuj dokładnie ten kontekst."
      : de
        ? "Angel ist nicht nur ein Mode-Bot. Wenn Handoff oder Gespräch Audit, Projekte, VLM Brain, Security, Stripe, Supabase, PDF oder Märkte betrifft, bleibe in diesem Kontext."
        : "Angel is not only a clothing bot. If the handoff or conversation is about audit, projects, VLM Brain, security, Stripe, Supabase, PDF or markets, continue that exact context.",
    auditBoundaries: pl
      ? [
          "bez instrukcji exploitów",
          "bez aktywnych testów bez zgody",
          "pokazuj scope, dowody, braki i bezpieczne kroki naprawy",
          "oddzielaj fakty od hipotez",
          "Basic jest ograniczonym darmowym prescreenem po finalnym browser reteście; Pro jest wyłącznie betą na zaproszenie z obowiązkowym manual QA; Advanced nie jest na sprzedaż; claimy human-review i certyfikacji są wyłączone",
        ]
      : de
        ? [
            "keine Exploit-Anleitungen",
            "keine aktiven Tests ohne Zustimmung",
            "Scope, Evidenz, Lücken und sichere Fix-Schritte zeigen",
            "Fakten von Hypothesen trennen",
            "Basic ist nach finalem Browser-Retest ein begrenzter kostenloser Prescreen; Pro ist nur eine Einladungs-Beta mit verpflichtender manueller QA; Advanced ist nicht zum Verkauf; Human-Review- und Zertifizierungsclaims sind deaktiviert",
          ]
        : [
            "no exploit instructions",
            "no active testing without authorization",
            "show scope, evidence, gaps and safe remediation steps",
            "separate facts from hypotheses",
            "Basic is a limited free prescreen after final browser retest; Pro is invitation-only beta with mandatory manual QA; Advanced is not for sale; human-review and certification claims are disabled",
          ],
    suggestedAuditContinuations: pl
      ? [
          "Ustal scope projektu",
          "Wypisz dowody i missing proof",
          "Zrób bezpieczny plan napraw",
          "Przygotuj disclosure bez exploita",
          "Zamień wynik na checklistę operatora",
        ]
      : de
        ? [
            "Projekt-Scope klären",
            "Evidenz und Missing Proof notieren",
            "Sicheren Fix-Plan erstellen",
            "Disclosure ohne Exploit vorbereiten",
            "Ergebnis in Operator-Checkliste umwandeln",
          ]
        : [
            "Lock project scope",
            "List evidence and missing proof",
            "Create safe remediation plan",
            "Prepare disclosure without exploit",
            "Turn result into operator checklist",
          ],
  };
}

export function completionNote(locale: "pl" | "en" | "de") {
  if (locale === "de")
    return " Wenn du willst, führe ich im nächsten Schritt fort.";
  if (locale === "pl")
    return " Jeżeli chcesz, w następnym kroku kontynuuję dalej.";
  return " I can continue in the next step.";
}

export function normalizeAngelServerReply(text: string, locale: "pl" | "en" | "de") {
  const cleaned = sanitizeVlmText(text, 7_200)
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return cleaned;
  if (/(\.{3}|…)\s*$/.test(cleaned)) {
    return cleaned.replace(/(\.{3}|…)\s*$/, `.${completionNote(locale)}`);
  }
  return cleaned;
}

// PASS2279 compatibility marker: buildPass2279PremiumAuditFallback upgraded into PASS2280/PASS2281 premium scaffold.
export function buildPass2280PremiumAuditFallback(args: {
  locale: "pl" | "en" | "de";
  laneCopy: string;
  tierCopy: string;
  missingCopy: string;
  evidenceCopy: string;
  assetHint?: string | null;
  depth?: AngelReportContextDepth;
  sourceCount?: number;
  confidenceCap?: number | null;
}) {
  const matrix = buildPass2280OutputAuditMatrix();
  const assetPolicy = detectPass2280AssetPolicy([args.assetHint ?? "", args.laneCopy, args.tierCopy, args.missingCopy, args.evidenceCopy].join(" "));
  const tier = matrix.tierContracts[args.depth ?? "basic"];
  const sourceStateLine = ` Sources=${args.sourceCount ?? 0}; confidenceCap=${typeof args.confidenceCap === "number" ? Math.round(args.confidenceCap) + "%" : "source-dependent"}; angelProduct=standalone; angelAccess=FREE_BASIC_ONLY; reportContextDepth=${tier.tier}; reportContextIsNotAngelTier=true; truthStandard=${ANGEL_TRUTH_STANDARD_INVARIANT}; findingConfidence=NOT_CALIBRATED.`;
  const assetLine = assetPolicy ? ` Asset policy: ${assetPolicy.kind}; primary=${assetPolicy.primaryLane}; second=${assetPolicy.secondLane}; never=${assetPolicy.neverClaimWithoutProof.slice(0, 3).join(", ")}.` : " Asset policy: confirm scope/symbol before strong claims.";
  const pass2281Scaffold = buildPass2281AngelPremiumAuditScaffold({
    locale: args.locale,
    depth: args.depth ?? "basic",
    assetHint: args.assetHint ?? args.laneCopy,
    sourceCount: args.sourceCount ?? 0,
    missingCount: [args.missingCopy, args.evidenceCopy].filter(Boolean).length,
    hasSecondProvider: (args.sourceCount ?? 0) >= 2,
  }).join(" ");
  const pass2282Scaffold = buildPass2282AngelAuditScaffold({
    locale: args.locale,
    depth: args.depth ?? "basic",
    assetText: args.assetHint ?? args.laneCopy,
    confirmedSources: args.sourceCount ? ["primary source"] : [],
    missingLanes: [args.missingCopy, args.evidenceCopy].filter(Boolean),
    confidenceCap: args.confidenceCap,
  }).join(" ");
  if (args.locale === "de") {
    return [
      "Angel Evidence Mode — PASS2280 Audit Output QA.",
      `Verdict: ${args.laneCopy}`,
      `Quellen: bestätigte Quellen zuerst; fehlende Quellen werden als Lücke gezeigt, nicht als Fake-Confidence.${args.evidenceCopy}${assetLine}${sourceStateLine}`,
      "Risiko: Eine numerische Risikozahl darf nur gezeigt werden, wenn der aktuelle Evidenzkontext sie tatsächlich liefert; Fallback erfindet keine Zahl. BTC/native Assets bekommen keine ERC20-Contract/Admin-Lanes ohne Token-Contract-Scope.",
      args.tierCopy || "Angel-Chat ist aktuell ein einziges kostenloses Basic-Evidenzprodukt. Pro/Advanced sind hier keine zusätzlichen Angel-Chat-Modi; Berichtskontext darf den Wahrheits- und Sicherheitsstandard nicht verändern.",
      args.missingCopy || "Gaps: fehlende Source-Lanes werden vor starken Aussagen genannt.",
      `Direkter Angel-Chat: kostenloser Basic-Modus; keine zusätzliche Pro/Advanced-Chat-Funktion wird behauptet.`,
      pass2281Scaffold,
      pass2282Scaffold,
      "Nächster sicherer Schritt: Symbol, Tier, Quelle und fehlende Lane prüfen; keine ROI-, Preis- oder Security-Garantien.",
    ].join("\n");
  }
  if (args.locale === "pl") {
    return [
      "Angel Evidence Mode — PASS2280 Audit Output QA.",
      `Werdykt: ${args.laneCopy}`,
      `Źródła: najpierw potwierdzone źródła; brakujące źródła pokazuję jako lukę, nie jako sztuczną pewność.${args.evidenceCopy}${assetLine}${sourceStateLine}`,
      "Ryzyko: liczbowy wynik ryzyka pokazuję tylko wtedy, gdy aktualny kontekst dowodowy naprawdę go dostarcza; fallback nie wymyśla liczby. BTC/native assets nie dostają ERC20 contract/admin lanes bez scope kontraktu tokena.",
      args.tierCopy || "Angel chat jest obecnie jednym darmowym produktem Basic opartym na dowodach. Pro/Advanced nie są tutaj dodatkowymi trybami czatu Angel; kontekst raportu nie może zmieniać standardu prawdy i bezpieczeństwa.",
      args.missingCopy || "Braki: brakujące source lanes idą przed mocnymi twierdzeniami.",
      "Bezpośredni Angel chat: darmowy tryb Basic; nie deklaruję dodatkowej funkcji czatu Pro/Advanced.",
      pass2281Scaffold,
      pass2282Scaffold,
      "Następny bezpieczny krok: sprawdzić symbol, tier, źródło i brakującą lane; bez ROI, obietnic ceny i fałszywych certyfikatów.",
    ].join("\n");
  }
  return [
    "Angel Evidence Mode — PASS2280 Audit Output QA.",
    `Verdict: ${args.laneCopy}`,
    `Sources: confirmed sources first; missing sources stay visible as gaps, not fake confidence.${args.evidenceCopy}${assetLine}${sourceStateLine}`,
    "Risk: a numeric risk score is shown only when the current evidence context actually provides it; fallback never invents a number. BTC/native assets do not get ERC20 contract/admin lanes without token-contract scope.",
    args.tierCopy || "Angel chat currently exposes one free Basic evidence product. Pro/Advanced are not additional Angel chat modes here; report context cannot change the truth or safety standard.",
    args.missingCopy || "Gaps: missing source lanes come before strong claims.",
    `Direct Angel chat: free Basic mode; no additional Pro/Advanced chat capability is claimed.`,
    pass2281Scaffold,
    pass2282Scaffold,
    "Next safe step: verify symbol, tier, source and missing lane; no ROI, price or security guarantees.",
  ].join("\n");
}

export function shouldAttachPass2357RiskLead(lane: ReturnType<typeof detectAngelFallbackLane>, text: string) {
  if (lane === "markets" || lane === "audit" || lane === "pdf" || lane === "access") return true;
  return /\b(BTC|ETH|SOL|BNB|USDT|USDC|AAPL|NVDA|SPY|QQQ|risk|ryzyk|audyt|audit|shield|real markets|pdf|browser)\b/i.test(text);
}

export function buildPass2357AngelRiskLead(args: {
  locale: "pl" | "en" | "de";
  lane: ReturnType<typeof detectAngelFallbackLane>;
  depth: "basic" | "pro" | "advanced";
  sourceCount: number;
  confidenceCap: number | null;
  missingCount: number;
  lockedCount: number;
  assets: string[];
  paidAccessVerified: boolean;
  text: string;
}) {
  if (!shouldAttachPass2357RiskLead(args.lane, args.text)) return "";
  const confidence = typeof args.confidenceCap === "number" ? `${Math.round(args.confidenceCap)}%` : "source-dependent";
  const assets = args.assets.length ? args.assets.slice(0, 4).join(", ") : "scope not fixed";
  if (args.locale === "pl") {
    return [
      "Velmère risk lane — krótki kontekst przed odpowiedzią:",
      `- Zakres: ${assets}; tryb: ${args.depth}; lane: ${args.lane}.`,
      `- Źródła: ${args.sourceCount}; limit pewności: ${confidence}; braki: ${args.missingCount}; locked: ${args.lockedCount}.`,
      `- Advanced: NOT_FOR_SALE; ewentualny wewnętrzny entitlement jest tylko testem i nie zmienia publicznej decyzji.`,
      "- Zasada: najpierw liczby, source-sync, consensus/contradiction radar i missing-data, potem wniosek — bez lania wody i bez obietnic ceny.",
    ].join("\n");
  }
  if (args.locale === "de") {
    return [
      "Velmère risk lane — Kurzkontext vor der Antwort:",
      `- Scope: ${assets}; Modus: ${args.depth}; Lane: ${args.lane}.`,
      `- Quellen: ${args.sourceCount}; Konfidenzlimit: ${confidence}; Lücken: ${args.missingCount}; locked: ${args.lockedCount}.`,
      `- Advanced: NOT_FOR_SALE; ein internes Entitlement ist nur Evaluierung und ändert die öffentliche Entscheidung nicht.`,
      "- Regel: Zahlen, Source-Sync und Missing-Data zuerst, dann Schlussfolgerung — keine Preisversprechen.",
    ].join("\n");
  }
  return [
    "Velmère risk lane — short context before the answer:",
    `- Scope: ${assets}; mode: ${args.depth}; lane: ${args.lane}.`,
    `- Sources: ${args.sourceCount}; confidence cap: ${confidence}; gaps: ${args.missingCount}; locked: ${args.lockedCount}.`,
    `- Advanced: NOT_FOR_SALE; any internal entitlement is evaluation-only and does not change the public decision.`,
    "- Rule: numbers, source-sync, consensus/contradiction radar and missing-data first, then conclusion — no price promises.",
  ].join("\n");
}

export function fallbackReply(
  locale: "pl" | "en" | "de",
  topicText = "",
  evidenceSummary = "",
  requestedDepth: "basic" | "pro" | "advanced" = "basic",
  sourceCount = 0,
  confidenceCap: number | null = null,
) {
  const lane = detectAngelFallbackLane(topicText);
  const asksTier = /(basic|pro|advanced|tier|poziom|warstw|stufe|analyse|analysis)/i.test(topicText);
  const asksMissing = /(missing|brak|źród|source|quelle|proof|dowod|evidence|pdf|lens|aapl|btc|eth|sol|bnb|usdt)/i.test(topicText);
  const evidenceCopy = evidenceSummary ? ` ${evidenceSummary}` : "";
  const assetHint = (topicText.match(/\b(BTC|ETH|SOL|NVDA|AAPL|SPY|QQQ|S&P\s?500|SP500|NVIDIA|APPLE|BITCOIN|ETHEREUM|SOLANA)\b/i)?.[0] ?? null);
  if (locale === "de") {
    const laneCopy = {
      audit: "Ich bleibe im Audit-Kontext: Scope, Evidenz, Missing Proof und sichere Fix-Schritte.",
      markets: "Ich bleibe im Shield/Real-Markets-Kontext: Symbol, Quelle, Chart, Risiko und nächste Prüfung.",
      pdf: "Ich bleibe im Lens/PDF-Kontext: kurze Analyse, Quellenstatus und sauberer Report-Next-Step.",
      access: "Ich bleibe im Access-Kontext: Basic kostenlos, Pro nur auf Einladung, Advanced nicht zum Verkauf.",
      store: "Ich bleibe im Store-Kontext: Passform, Drop, Verfügbarkeit und Checkout ohne erfundene Daten.",
      general: "Ich halte den Velmère-Kontext: Audit, VLM Brain, PDF, Security, Märkte, Konto und Kleidung bleiben getrennt.",
    }[lane];
    const tierCopy = asksTier
      ? " Direkter Angel-Chat läuft aktuell nur im kostenlosen Basic-Evidenzmodus. Pro und Advanced sind hier keine zusätzlichen Chat-Tiers; ein Report-Kontext darf nur den Kontext, nicht die Wahrheits- oder Sicherheitsregeln verändern."
      : "";
    const missingCopy = asksMissing
      ? " Wenn eine Quelle fehlt, sage ich klar 'Daten fehlen' statt Confidence künstlich zu erhöhen."
      : "";
    return buildPass2280PremiumAuditFallback({ locale, laneCopy, tierCopy, missingCopy, evidenceCopy, assetHint, depth: requestedDepth, sourceCount, confidenceCap });
  }
  if (locale === "pl") {
    const laneCopy = {
      audit: "Trzymam kontekst audytu: scope, dowody, missing proof i bezpieczne kroki naprawy.",
      markets: "Trzymam kontekst Shield/Real Markets: symbol, źródło, wykres, ryzyko i następny check.",
      pdf: "Trzymam kontekst Lens/PDF: krótka analiza, status źródeł i czysty kolejny krok raportu.",
      access: "Trzymam kontekst dostępu: Basic darmowy, Pro tylko na zaproszenie, Advanced nie na sprzedaż.",
      store: "Trzymam kontekst sklepu: rozmiar, drop, dostępność i checkout bez zmyślania danych.",
      general: "Trzymam kontekst Velmère: audyt, VLM Brain, PDF, security, markety, konto i ubrania są oddzielone.",
    }[lane];
    const tierCopy = asksTier
      ? " Bezpośredni Angel chat działa obecnie tylko w darmowym trybie Basic opartym na dowodach. Pro i Advanced nie są tutaj dodatkowymi tierami czatu; kontekst raportu może zmieniać zakres kontekstu, ale nie reguły prawdy ani bezpieczeństwa."
      : "";
    const missingCopy = asksMissing
      ? " Gdy brakuje źródła, pokazuję 'brak danych' zamiast pompować confidence albo udawać pełną analizę."
      : "";
    return buildPass2280PremiumAuditFallback({ locale, laneCopy, tierCopy, missingCopy, evidenceCopy, assetHint, depth: requestedDepth, sourceCount, confidenceCap });
  }
  const laneCopy = {
    audit: "I will keep the audit context: scope, evidence, missing proof and safe remediation steps.",
    markets: "I will keep the Shield/Real Markets context: symbol, source, chart, risk and next check.",
    pdf: "I will keep the Lens/PDF context: short analysis, source status and a clean report next step.",
    access: "I will keep the access context: Basic is free, Pro is invitation-only, and Advanced is not for sale.",
    store: "I will keep the store context: fit, drop, availability and checkout without inventing data.",
    general: "I will keep the Velmère context: audit, VLM Brain, PDF, security, markets, account and clothing stay separated.",
  }[lane];
  const tierCopy = asksTier
    ? " Direct Angel chat currently runs only in the free Basic evidence mode. Pro and Advanced are not additional chat tiers here; report context may change context depth but never the truth or safety rules."
    : "";
  const missingCopy = asksMissing
    ? " When a source is missing, I state the gap instead of inflating confidence or pretending the analysis is complete."
    : "";
  return buildPass2280PremiumAuditFallback({ locale, laneCopy, tierCopy, missingCopy, evidenceCopy, assetHint, depth: requestedDepth, sourceCount, confidenceCap });
}

export function securityReply(locale: "pl" | "en" | "de") {
  if (locale === "de")
    return "Diese Nachricht konnte aus Sicherheitsgründen nicht verarbeitet werden. Formuliere die Velmère-Frage bitte ohne versteckte Anweisungen oder sensible Daten neu.";
  if (locale === "pl")
    return "Ta wiadomość nie mogła zostać przetworzona ze względów bezpieczeństwa. Napisz pytanie o Velmère ponownie, bez ukrytych instrukcji i danych wrażliwych.";
  return "This message could not be processed for security reasons. Rephrase the Velmère question without hidden instructions or sensitive data.";
}

export function advancedPaymentReply(locale: "pl" | "en" | "de") {
  if (locale === "de")
    return "Der öffentliche Checkout ist deaktiviert. Pro ist nur als Einladungs-Beta mit verpflichtender manueller QA verfügbar; Advanced ist nicht zum Verkauf.";
  if (locale === "pl")
    return "Publiczny checkout jest wyłączony. Pro jest wyłącznie betą na zaproszenie z obowiązkowym manual QA; Advanced nie jest na sprzedaż.";
  return "Public checkout is disabled. Pro is invitation-only beta with mandatory manual QA; Advanced is not for sale.";
}
