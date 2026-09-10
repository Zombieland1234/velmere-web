import { createHmac, randomBytes } from "node:crypto";
import { foldVlmSecurityConfusables, normalizeVlmText } from "./vlm-security";

export type VlmAdviceFlag =
  | "individualized_trading_instruction"
  | "position_sizing_or_leverage"
  | "individualized_financial_advice"
  | "individualized_legal_advice"
  | "evasion_or_concealment"
  | "professional_impersonation"
  | "guarantee_or_certification"
  | "uncalibrated_probability_claim";

export type VlmAdviceBoundaryDecision =
  | "ALLOW_INFORMATIONAL_ANALYSIS"
  | "ABSTAIN_INDIVIDUALIZED_ADVICE"
  | "REJECT_EVASION_OR_CONCEALMENT"
  | "REJECT_GUARANTEE_OR_CERTIFICATION"
  | "REJECT_UNCALIBRATED_PROBABILITY";

export type VlmAdviceBoundaryInspection = {
  allowed: boolean;
  decision: VlmAdviceBoundaryDecision;
  flags: VlmAdviceFlag[];
  normalized: string;
  /** Opaque per-call identifier. It is intentionally non-deterministic and must not be used to correlate prompts. */
  fingerprint: string;
  publicCode: string | null;
  safeReframe: string | null;
};

const ADVICE_FINGERPRINT_SECRET =
  process.env.VELMERE_ADVICE_FINGERPRINT_SECRET?.trim() || randomBytes(32).toString("hex");

function scanForm(value: unknown) {
  return foldVlmSecurityConfusables(value)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^\p{L}\p{N}%€$£+\-.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function any(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

const META_ANALYSIS = [
  /\b(?:explain|analyse|analyze|identify|classify|critique|why is|why are|what makes|translate)\b.{0,80}\b(?:claim|phrase|statement|message|example|warning|manipulat|mislead|unsafe|risky|problem|probabil|forecast|calibrat)/i,
  /\b(?:wyjasnij|przeanalizuj|zidentyfikuj|sklasyfikuj|ocen|skrytykuj|wskaz|dlaczego)\b.{0,90}\b(?:twierdzen|fraze|frazę|zdanie|wiadomosc|wiadomość|przyklad|przykład|ostrzezen|manipulac|wprowadz|mylac|prawdopodob|prognoz|kalibr|problem|cytowan)/i,
  /\b(?:erklaere|erklare|analysiere|identifiziere|klassifiziere|kritisiere|warum)\b.{0,90}\b(?:behauptung|phrase|aussage|nachricht|beispiel|warnung|manipul|irrefuhr|irrefuehr|wahrscheinlich|prognos|kalibrier)/i,
  /\b(?:quoted|quotation|cytat|zitat|source text|tekst zrodlowy|quelltext)\b/i,
];

const PERSONAL_CONTEXT = [
  /\b(?:should|can|do|would) i\b/i,
  /\b(?:for me|my (?:money|budget|portfolio|position|trade|case|contract|tax|situation|account|savings))\b/i,
  /\b(?:i have|i hold|i opened|i entered|i bought|i signed|i need to terminate|i want to cancel)\b/i,
  /\b(?:co mam zrobic|czy mam|powinienem|powinnam|dla mnie|moj(?:e|a)? (?:pieniadze|budzet|portfolio|pozycj\w*|trade|spraw\w*|umow\w*|podatk\w*|oszczednosci))\b/i,
  /\b(?:mam otwart\w* pozycj|wszedlem|weszlam|kupilem|kupilam|podpisalem|podpisalam|chce rozwiazac|chce zerwac)\b/i,
  /\b(?:soll ich|darf ich|fur mich|mein(?:e|er|en)? (?:geld|budget|portfolio|position|fall|vertrag|steuer|situation|konto|ersparnisse))\b/i,
  /\b(?:ich habe|ich halte|ich bin eingestiegen|ich habe gekauft|ich habe unterschrieben|ich will kundigen|ich mochte kundigen)\b/i,
];

const TRADE_ACTIONS = [
  "buy", "sell", "short", "long", "enter", "exit", "close", "hold", "coin", "token",
  "kup", "sprzedaj", "shortuj", "long", "wejdz", "zamknij", "trzymaj", "monete", "moneta", "token",
  "kauf", "kaufen", "verkauf", "verkaufen", "shorten", "long gehen", "einsteigen", "aussteigen", "schliess", "schliessen", "halt", "halten", "coin", "token",
];

const TRADING_INSTRUCTION = [
  /\b(?:which|what) (?:coin|token|asset|trade)\b.{0,70}\b(?:buy|pick|choose|enter|short|long)\b/i,
  /\b(?:buy|sell|short|long|enter|exit|close|hold)\b.{0,55}\b(?:now|today|immediately|this trade|this position|for me|with my)/i,
  /\b(?:tell me exactly|give me an exact entry|exact stop loss|exact take profit|make the decision for me)\b/i,
  /\b(?:jaka|ktora|ktora|wybierz)\b.{0,30}\b(?:monete|moneta|krypto|token|pozycj\w*)\b.{0,70}\b(?:kupic|wybrac|wejsc|short|long)/i,
  /\b(?:kup|sprzedaj|shortuj|otworz longa|wejdz|zamknij|trzymaj)\b.{0,55}\b(?:teraz|dzisiaj|natychmiast|te pozycje|za moje|dla mnie)/i,
  /\b(?:powiedz dokladnie|dokladne wejscie|dokladny stop loss|dokladny take profit|zdecyduj za mnie)\b/i,
  /\b(?:welchen|welche|was fur einen)\b.{0,35}\b(?:coin|token|trade|position)\b.{0,70}\b(?:kaufen|wahlen|einsteigen|shorten|long gehen)/i,
  /\b(?:kauf(?:e|en)?|verkauf(?:e|en)?|shorte?n?|geh long|long gehen|steig(?:e)? ein|einsteigen|steig(?:e)? aus|aussteigen|schliess(?:e|en)?|halt(?:e|en)?)\b.{0,55}\b(?:jetzt|heute|sofort|diesen trade|diese position|fur mich|mit meinem)/i,
  /\b(?:genauer einstieg|exakter stop loss|exaktes take profit|entscheide fur mich)\b/i,
  /\b(?:you should|you must|my recommendation is to)\b.{0,65}\b(?:buy|sell|short|go long|enter|exit|close|hold)\b/i,
  /\b(?:powinienes|powinnas|musisz|moja rekomendacja to)\b.{0,65}\b(?:kup|sprzedaj|shortuj|otworz longa|wejdz|zamknij|trzymaj)\b/i,
  /\b(?:du solltest|du musst|meine empfehlung ist)\b.{0,65}\b(?:kauf|verkauf|short|geh long|steig|schliess|halt)\w*\b/i,
];

const POSITION_SIZING = [
  /\b(?:how much|what percentage|position size|leverage|margin|x\s*\d{1,3}|\d{1,3}\s*x)\b.{0,75}\b(?:invest|risk|use|put|trade|reasonable|safe|sensible|okay)\b/i,
  /\b(?:is|would)\b.{0,25}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|leverage|margin)\b.{0,45}\b(?:reasonable|safe|sensible|okay|too much)\b/i,
  /\b(?:should i|can i)\b.{0,40}\b(?:risk|put|allocate)\b.{0,25}\b\d{1,3}\s*(?:%|percent)\b/i,
  /\b(?:ile|jaki procent|wielkosc pozycji|dzwigni\w*|margin|x\s*\d{1,3}|\d{1,3}\s*x)\b.{0,75}\b(?:zainwestowac|ryzykowac|uzyc|wplacic|rozsadn\w*|bezpieczn\w*|okej|za duz\w*)\b/i,
  /\b(?:czy|bedzie)\b.{0,25}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|dzwigni\w*|margin)\b.{0,45}\b(?:rozsadn\w*|bezpieczn\w*|okej|za duz\w*)\b/i,
  /\bile\b.{0,30}\b(?:wrzucic|wlozyc|zainwestowac)\b.{0,50}\b(?:longa|shorta|dzwigni\w*|\d{1,3}\s*x)\b/i,
  /\bczy mam\b.{0,40}\b(?:zaryzykowac|wlozyc|przeznaczyc)\b.{0,25}\b\d{1,3}\s*(?:%|procent)\b/i,
  /\b(?:wie viel|welcher prozentsatz|positionsgroesse|hebel|margin|x\s*\d{1,3}|\d{1,3}\s*x)\b.{0,75}\b(?:investieren|riskieren|verwenden|einsetzen|vernunftig|sicher|okay|zu hoch)\b/i,
  /\b(?:ist|ware)\b.{0,25}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|hebel|margin)\b.{0,45}\b(?:vernunftig|sinnvoll|sicher|okay|zu hoch)\b/i,
  /\b(?:soll ich|kann ich)\b.{0,40}\b(?:riskieren|einsetzen|allozieren)\b.{0,25}\b\d{1,3}\s*(?:%|prozent)\b/i,
  /\b(?:use|take|apply|increase|set)\b.{0,55}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|leverage|margin)\b/i,
  /\b(?:uzyj|wez|zastosuj|zwieksz|ustaw)\b.{0,55}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|dzwign\w*|margin)\b/i,
  /\b(?:nutze|verwende|nimm|erhohe|setze)\b.{0,55}\b(?:x\s*\d{1,3}|\d{1,3}\s*x|hebel|margin)\b/i,
];

const FINANCIAL_ADVICE = [
  /\b(?:personal financial advice|fiduciary advice|best investment for me|what should i invest in|where should i put my money)\b/i,
  /\b(?:osobista porada finansowa|najlepsza inwestycja dla mnie|w co powinienem zainwestowac|w co powinnam zainwestowac|gdzie ulokowac moje pieniadze)\b/i,
  /\b(?:personliche finanzberatung|beste anlage fur mich|worin soll ich investieren|wohin mit meinem geld)\b/i,
];

const LEGAL_ADVICE = [
  /\b(?:act as (?:my )?(?:lawyer|attorney|legal counsel)|give me (?:a )?(?:binding )?legal opinion|will i win (?:the )?case|what should i sign|is this legal for me)\b/i,
  /\b(?:can i|should i|how do i)\b.{0,60}\b(?:terminate|cancel|rescind|break|void)\b.{0,60}\b(?:my|this)\b.{0,20}\b(?:contract|agreement|lease)\b/i,
  /\b(?:without|avoid)\b.{0,35}\b(?:penalty|fee|liability)\b.{0,35}\b(?:contract|agreement|lease|termination)\b/i,
  /\b(?:badz moim prawnikiem|daj mi (?:wiazaca )?opinie prawna|daj opinie prawna|czy wygram sprawe|co mam podpisac|czy to jest legalne dla mnie)\b/i,
  /\b(?:czy moge|powinienem|jak mam)\b.{0,60}\b(?:rozwiazac|zerwac|uniewaznic|odstapic)\b.{0,60}\b(?:moja|te|umowe|umowa|najem)\b/i,
  /\b(?:bez|uniknac)\b.{0,35}\b(?:kary|oplaty|odpowiedzialnosci)\b.{0,35}\b(?:umow|rozwiaz|najem)/i,
  /\b(?:podpisalem|podpisalam|mam)\b.{0,45}\b(?:umowe|umowa|najem|kontrakt)\b.{0,90}\b(?:zerwac|rozwiazac|odstapic|uniewaznic|bez kary|uniknac kary)\b/i,
  /\b(?:jak mam|czy moge)\b.{0,45}\b(?:ja |to )?(?:zerwac|rozwiazac|odstapic|uniewaznic)\b.{0,45}\b(?:bez kary|bez oplaty|bez odpowiedzialnosci)\b/i,
  /\b(?:sei mein anwalt|gib mir ein (?:verbindliches )?rechtsgutachten|werde ich den fall gewinnen|was soll ich unterschreiben|ist das fur mich legal)\b/i,
  /\b(?:kann ich|soll ich|wie kann ich)\b.{0,60}\b(?:kundigen|aufheben|widerrufen|beenden)\b.{0,60}\b(?:meinen|diesen|vertrag|mietvertrag|vereinbarung)\b/i,
  /\b(?:ohne|vermeiden)\b.{0,35}\b(?:strafe|gebuhr|haftung)\b.{0,35}\b(?:vertrag|kundigung|mietvertrag)/i,
  /\b(?:unterschrieben|ich habe|mein)\b.{0,55}\b(?:vertrag|mietvertrag|vereinbarung)\b.{0,90}\b(?:kundigen|aufheben|widerrufen|beenden|ohne strafe)\b/i,
  /\b(?:wie kann ich|kann ich)\b.{0,45}\b(?:ihn |sie )?(?:kundigen|aufheben|widerrufen|beenden)\b.{0,45}\b(?:ohne strafe|ohne gebuhr|ohne haftung)\b/i,
];

const EVASION = [
  /\b(?:evade|avoid|hide|conceal|launder|make invisible|keep off the books|not show)\b.{0,100}\b(?:tax|reporting|regulator|authorities|ownership|funds|transfers?|transactions?)\b/i,
  /\b(?:tax|reporting|regulator|authorities|ownership|funds|transfers?|transactions?)\b.{0,100}\b(?:not see|not notice|cannot trace|untraceable|hidden|concealed)\b/i,
  /\b(?:ukryj|obejdz|uniknij|zataj|wypierz|zrob niewidoczn|poza ewidencj|nie pokazuj)\b.{0,100}\b(?:podatek|podatk\w*|zgloszen|regulatora|urzed\w*|wlasnosc|srodki|przelew\w*|transakcj\w*)\b/i,
  /\b(?:podatek|podatk\w*|urzad\w*|zgloszen\w*|przelew\w*|transakcj\w*)\b.{0,100}\b(?:nie zobacz|nie widz|nie wykry|nie sledz|niewidoczn|ukryt|zatajon)/i,
  /\b(?:umgehen|vermeiden|verbergen|verschleiern|waschen|unsichtbar machen|nicht melden)\b.{0,100}\b(?:steuer|meldung|aufsicht|behorden|eigentum|gelder|uberweisung\w*|transaktion\w*)\b/i,
  /\b(?:steuer|behorden|meldung|uberweisung\w*|transaktion\w*)\b.{0,100}\b(?:nicht sehen|nicht bemerken|nicht verfolgen|unsichtbar|verborgen|verschleiert)\b/i,
];

const IMPERSONATION = [
  /\b(?:i am your lawyer|as your attorney|as your financial adviser|as your financial advisor|as your fiduciary)\b/i,
  /\b(?:jestem twoim prawnikiem|jako twoj prawnik|jako twoj doradca finansowy)\b/i,
  /\b(?:ich bin dein anwalt|als dein anwalt|als dein finanzberater)\b/i,
];

const GUARANTEE = [
  /\b(?:guaranteed|certain|sure-fire|risk-free|cannot lose|can't lose|impossible to lose|practically impossible to lose|no downside|zero risk)\b.{0,45}\b(?:profit|return|investment|trade|money|loss|safe|compliance)?/i,
  /\b(?:certified safe|legally guaranteed|completely safe|virtually certain|near certainty)\b/i,
  /\b(?:certify|write|issue)\b.{0,80}\b(?:certification|certificate)\b.{0,100}\b(?:safe|cannot be hacked|no exploit|every critical bug)\b/i,
  /\bguarantee\b.{0,100}\b(?:audit|contract|token)\b.{0,100}\b(?:every|all|no)\b.{0,50}\b(?:bug|exploit|vulnerability)\b/i,
  /\b(?:gwarantowan\w*|pewny|bez ryzyka|nie da sie stracic|praktycznie nie mozna stracic|praktycznie niemozliw\w*|niemozliw\w* stracic|zero ryzyka|brak ryzyka)\b.{0,45}\b(?:zysk|zwrot|inwestycj|trade|pieniadz|strat|bezpiecz|zgodn)?/i,
  /\b(?:certyfikowan\w* bezpieczn\w*|prawnie gwarantowan\w*|niemal pewn\w*)\b/i,
  /\b(?:napisz|wystaw|poswiadcz)\b.{0,80}\b(?:certyfikat|certyfikacj\w*)\b.{0,100}\b(?:bezpiecz|nie da sie zhakowac|brak exploita|wszystkie krytyczne bledy)\b/i,
  /\bzagwarantuj\b.{0,100}\b(?:audyt|kontrakt|token)\b.{0,100}\b(?:wszystkie|brak)\b.{0,50}\b(?:bled\w*|exploit|podatnosc)\b/i,
  /\b(?:garantiert|sicherer gewinn|risikofrei|kein verlust moglich|praktisch unmoglich zu verlieren|null risiko|ohne risiko)\b.{0,45}\b(?:gewinn|rendite|anlage|trade|geld|verlust|sicher|konform)?/i,
  /\b(?:zertifiziert sicher|rechtlich garantiert|nahezu sicher|praktisch sicher)\b/i,
  /\b(?:zertifiziere|schreibe|stelle)\b.{0,80}\b(?:zertifikat|zertifizierung)\b.{0,100}\b(?:sicher|nicht gehackt|kein exploit|alle kritischen fehler)\b/i,
  /\bzertifiziere\b.{0,120}\b(?:vollstandig sicher|vollständig sicher|kein exploit|nicht gehackt)\b/i,
  /\bgarantiere\b.{0,100}\b(?:audit|vertrag|token)\b.{0,100}\b(?:alle|keine)\b.{0,50}\b(?:fehler|exploit|schwachstelle)\b/i,
];

const UNCALIBRATED_PROBABILITY = [
  /\b\d{1,3}(?:[.,]\d+)?\s*(?:%|percent|procent|prozent)\b.{0,55}\b(?:chance|probability|likelihood|confidence|prawdopodobienstw\w*|szans\w*|pewnosc|wahrscheinlichkeit|sicherheit)\b/i,
  /\b(?:chance|probability|likelihood|confidence|prawdopodobienstw\w*|szans\w*|pewnosc|wahrscheinlichkeit|sicherheit)\b.{0,55}\b\d{1,3}(?:[.,]\d+)?\s*(?:%|percent|procent|prozent)\b/i,
  /\b\d{1,3}(?:[.,]\d+)?\s*%\s+(?:chance|probability|likelihood|confidence)\b/i,
  /\b(?:chance|probability|likelihood|confidence)\s+(?:is|of|equals?)\s+\d{1,3}(?:[.,]\d+)?\s*%\b/i,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:out of|in)\s+(?:ten|hundred)\b.{0,45}\b(?:chance|probability|profit|win|loss)/i,
  /\b(?:eighty[ -]?seven|ninety|seventy[ -]?five|fifty)\s+percent\b/i,
  /\b\d{1,3}(?:[.,]\d+)?\s*%\s+(?:szans|prawdopodobienstw|pewnosci)\w*\b/i,
  /\b(?:szansa|prawdopodobienstwo|pewnosc)\s+(?:wynosi|to|jest)\s+\d{1,3}(?:[.,]\d+)?\s*%\b/i,
  /\b(?:osiem|dziewiec|siedem)\s+(?:na|z)\s+(?:dziesiec|stu)\b.{0,45}\b(?:szans|prawdopodobienstw|zysk|wygran|strat)/i,
  /\b(?:osiemdziesiat siedem|dziewiecdziesiat|siedemdziesiat piec|piecdziesiat)\s+procent\b/i,
  /\b\d{1,3}(?:[.,]\d+)?\s*%\s+(?:wahrscheinlichkeit|chance|sicherheit)\b/i,
  /\b(?:wahrscheinlichkeit|chance|sicherheit)\s+(?:betragt|ist)\s+\d{1,3}(?:[.,]\d+)?\s*%\b/i,
  /\b(?:acht|neun|sieben)\s+von\s+(?:zehn|hundert)\b.{0,45}\b(?:chance|wahrscheinlichkeit|gewinn|verlust)/i,
  /\b(?:siebenundachtzig|neunzig|funfundsiebzig|fuenfundsiebzig|funfzig|fuenfzig)\s+prozent\b/i,
  /\b(?:gewinnwahrscheinlichkeit|verlustwahrscheinlichkeit)\b.{0,35}(?:\d{1,3}(?:[.,]\d+)?\s*%|prozent)/i,
];

function privacyOpaqueFingerprint(normalized: string, flags: VlmAdviceFlag[]) {
  const nonce = randomBytes(16).toString("hex");
  return createHmac("sha256", ADVICE_FINGERPRINT_SECRET)
    .update(JSON.stringify({ nonce, normalized, flags: [...flags].sort() }))
    .digest("hex")
    .slice(0, 24);
}

function informationalReframe(flags: VlmAdviceFlag[]) {
  if (flags.includes("individualized_legal_advice")) {
    return "I can explain general legal or regulatory issues, evidence to collect, and questions for a qualified professional, but I cannot provide an individualized legal conclusion.";
  }
  if (flags.includes("individualized_trading_instruction") || flags.includes("position_sizing_or_leverage") || flags.includes("individualized_financial_advice")) {
    return "I can provide evidence-bound risk factors, uncertainty, and neutral scenarios, but not a personalized buy/sell, leverage, position-size, or portfolio instruction.";
  }
  return null;
}

export function inspectVlmAdviceBoundary(value: unknown): VlmAdviceBoundaryInspection {
  const normalized = normalizeVlmText(value).replace(/\s+/g, " ").trim();
  const scan = scanForm(normalized);
  const flags: VlmAdviceFlag[] = [];
  const metaAnalysis = any(META_ANALYSIS, scan);
  const personalized = any(PERSONAL_CONTEXT, scan);

  const personalLexical = personalized || /\b(?:i|me|my|mine|ich|mein\w*|mir|mich|moj\w*|moja|moje|mojego|mojej|dla mnie|mam|chce|chcę)\b/i.test(scan);
  const assetLexical = /\b(?:coin|token|crypto|asset|investment|anlage|vermogenswert|krypto|monet\w*|inwestycj\w*|aktywo)\b/i.test(scan);
  const selectionLexical = /(?:\b(?:pick|choose|select|best|should buy|should enter|decide for me|wybierz|wybrac|najlepsz\w*|powinienem kupic|zdecyduj za mnie|wahle|waehle|beste|soll ich kaufen|entscheide fur mich)\b|\bmam\b.{0,25}\bwejsc\b|\bw jakie\b.{0,25}\bkrypto\b)/i.test(scan);
  const positionLexical = /\b(?:position|trade|leverage|margin|position size|positionsgroesse|hebel|pozycj\w*|dzwign\w*|wielkosc pozycji)\b/i.test(scan);
  const sizingLexical = /\b(?:raise|increase|set|safe|reasonable|too much|how much|zwieksz\w*|zwiększ\w*|ustal|bezpieczn\w*|rozsadn\w*|za duz\w*|erhoh\w*|erhöh\w*|lege|sicher\w*|vernunftig\w*|zu hoch|wie viel)\b/i.test(scan);
  const legalSubject = /\b(?:contract|agreement|lease|vertrag|vereinbarung|mietvertrag|umow\w*|najem|kontrakt)\b/i.test(scan);
  const legalAction = /\b(?:terminate\w*|cancel\w*|void\w*|rescind\w*|break\w*|legal conclusion|without (?:a )?penalty|without (?:a )?fee|kundig\w*|kündig\w*|aufheb\w*|widerruf\w*|beenden|brech\w*|rechtsfolgerung|ohne strafe|ohne gebuhr|ohne kosten|ohne haftung|anulow\w*|uniewaz\w*|unieważ\w*|rozwiaz\w*|rozwiąż\w*|zerw\w*|odstap\w*|odstąp\w*|wniosek prawny|bez kary|bez oplaty|bez opłaty|bez kosztu|bez odpowiedzialnosci|bez odpowiedzialności)\b/i.test(scan);
  const concealVerb = /\b(?:hide\w*|conceal\w*|invisible|untraceable|off (?:the )?.{0,20}records|cannot trace|stop .* seeing|ukry\w*|zataj\w*|niewidoczn\w*|poza ewidencj\w*|nie mogl.*sledz\w*|nie mógł.*śledz\w*|nie pokaz\w*|nie widz\w*|verberg\w*|verschleier\w*|unsichtbar\w*|unauffindbar\w*|ausserhalb der meldung\w*|außerhalb der meldung\w*|nicht verfolgen|verhindere.*sieht)\b/i.test(scan);
  const authoritySubject = /\b(?:tax|tax office|authorit\w*|regulator\w*|reporting|ownership|funds|payments?|transfer\w*|transaction\w*|transaktion\w*|financial office|finanzamt|behord\w*|behörd\w*|aufsicht|meldung|eigentum|gelder|uberweisung|überweisung|steuer|urzad|urząd|organ\w* podatk|regulator|zgloszen|zgłoszen|wlasnosc|własność|srodk\w*|środk\w*|przelew\w*|transakcj\w*|platnosci|płatności|zahlung\w*)\b/i.test(scan);
  const guaranteeGeneric = /\b(?:practically|virtually|nearly|praktisch|nahezu|niemal)\b.{0,30}\b(?:impossible|certain|unmoglich|unmöglich|pewn|niemozliw|niemożliw)\b/i.test(scan)
    || /\b(?:cannot|can't|can not|nie moze|nie może|kann nicht)\b.{0,30}\b(?:lose|go wrong|fail|stracic|stracić|nie udac|nicht schiefgehen|verlieren)\b/i.test(scan)
    || /\b(?:no risk|risk free|risk-free|bez ryzyka|kein risiko|risikofrei\w*|vollig sicher\w*|völlig sicher\w*|calkowicie bezpiecz\w*|całkowicie bezpiecz\w*)\b/i.test(scan);
  const probabilityGeneric = /\b(?:probability|likelihood|chance|confidence|prawdopodobienstwo|prawdopodobieństwo|szans\w*|pewnosc|pewność|wahrscheinlichkeit|sicherheit)\b.{0,55}\b(?:percent|procent|eight|nine|seven|osiem|dziewiec|dziewięc|siedem|acht|neun|sieben|fifty|seventy|eighty|ninety|piecdzies|pięcdzies|siedemdzies|osiemdzies|dziewiecdzies|dziewięcdzies|funfzig|fünfzig|siebzig|achtzig|neunzig)\b/i.test(scan)
    || /\b(?:eight|nine|seven|osiem|dziewiec|dziewięc|siedem|acht|neun|sieben)\b.{0,20}\b(?:out of|in|na|z|von)\b.{0,20}\b(?:ten|dziesiec|dziesięć|zehn)\b/i.test(scan)
    || /\b(?:neunzigprozentig|neunzigprozentige|dziewiecdziesiat procent|dziewięćdziesiąt procent|eighty seven percent|seventy five percent)\b/i.test(scan);

  const evasion = any(EVASION, scan) || (concealVerb && authoritySubject);
  const impersonation = any(IMPERSONATION, scan);
  const guarantee = any(GUARANTEE, scan) || guaranteeGeneric;
  const probability = any(UNCALIBRATED_PROBABILITY, scan) || probabilityGeneric;
  const legal = any(LEGAL_ADVICE, scan) || (personalLexical && legalSubject && legalAction);
  const directTrading = any(TRADING_INSTRUCTION, scan)
    || (personalized && hasAny(scan, TRADE_ACTIONS))
    || (personalLexical && assetLexical && selectionLexical);
  const positionSizing = any(POSITION_SIZING, scan) || (personalLexical && positionLexical && sizingLexical);
  const financial = any(FINANCIAL_ADVICE, scan);

  // Educational criticism of a quoted unsafe statement is allowed unless the user also asks to execute it
  // for their own situation. Evasion and professional impersonation are never exempted by a meta wrapper.
  const educationalExemption = metaAnalysis && !personalized && !evasion && !impersonation;

  if (evasion) flags.push("evasion_or_concealment");
  if (impersonation) flags.push("professional_impersonation");
  if (guarantee && !educationalExemption) flags.push("guarantee_or_certification");
  if (probability && !educationalExemption) flags.push("uncalibrated_probability_claim");
  if (legal && !educationalExemption) flags.push("individualized_legal_advice");
  if (directTrading && !educationalExemption) flags.push("individualized_trading_instruction");
  if (positionSizing && !educationalExemption) flags.push("position_sizing_or_leverage");
  if (financial && !educationalExemption) flags.push("individualized_financial_advice");

  const unique = Array.from(new Set(flags));
  let decision: VlmAdviceBoundaryDecision = "ALLOW_INFORMATIONAL_ANALYSIS";
  let publicCode: string | null = null;
  if (unique.includes("evasion_or_concealment")) {
    decision = "REJECT_EVASION_OR_CONCEALMENT";
    publicCode = "evasion_or_concealment_not_supported";
  } else if (unique.includes("guarantee_or_certification") || unique.includes("professional_impersonation")) {
    decision = "REJECT_GUARANTEE_OR_CERTIFICATION";
    publicCode = "guarantee_or_professional_impersonation_not_supported";
  } else if (unique.includes("uncalibrated_probability_claim")) {
    decision = "REJECT_UNCALIBRATED_PROBABILITY";
    publicCode = "uncalibrated_probability_not_supported";
  } else if (unique.some((flag) => [
    "individualized_trading_instruction",
    "position_sizing_or_leverage",
    "individualized_financial_advice",
    "individualized_legal_advice",
  ].includes(flag))) {
    decision = "ABSTAIN_INDIVIDUALIZED_ADVICE";
    publicCode = "individualized_advice_not_supported";
  }

  return {
    allowed: decision === "ALLOW_INFORMATIONAL_ANALYSIS",
    decision,
    flags: unique,
    normalized,
    fingerprint: privacyOpaqueFingerprint(normalized, unique),
    publicCode,
    safeReframe: informationalReframe(unique),
  };
}
