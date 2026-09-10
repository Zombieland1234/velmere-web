import type {
  AssetCategoryLike,
  Pass4577SessionClockLike,
  Pass4579VisibleDataDecision,
} from "./market-data-sanity-source";
import {
  pass4573SanitizeAssetPercent,
  pass4579VisibleDataDecision,
} from "./market-data-sanity-source";

export const PASS4580_DIRECTIONAL_TONE_CONTRACT = {
  passId: "PASS4580",
  purpose:
    "Prevent Real Markets from using green/red directional psychology for last-close, delayed or limited values. Only fresh live source-bound rows may use directional color; everything else stays neutral and labelled.",
  publicTopkaLiveAllowed: false,
  rule:
    "A positive/negative percent can be printed only if the data decision allows it, but green/red tone is reserved for decision=show and tone=live. Limited last-close/delayed rows use neutral monochrome percent and chart strokes.",
} as const;

export type Pass4580VisibleValueTone = "directional" | "neutral" | "withheld";

export function pass4580VisibleValueTone(
  decision: Pick<Pass4579VisibleDataDecision, "decision" | "tone" | "canShowPercent" | "canShowChart"> | null | undefined,
): Pass4580VisibleValueTone {
  if (!decision || !decision.canShowPercent || decision.decision === "withheld") return "withheld";
  if (decision.decision === "show" && decision.tone === "live" && decision.canShowChart) return "directional";
  return "neutral";
}

export function pass4580MayUseDirectionalColor(
  decision: Pick<Pass4579VisibleDataDecision, "decision" | "tone" | "canShowPercent" | "canShowChart"> | null | undefined,
): boolean {
  return pass4580VisibleValueTone(decision) === "directional";
}

export function pass4580VisibleValueStatus(
  decision: Pick<Pass4579VisibleDataDecision, "decision" | "tone" | "canShowPercent" | "canShowChart" | "auditStatus"> | null | undefined,
): "verified" | "review" | "missing" {
  if (!decision || decision.decision === "withheld" || !decision.canShowPercent) return "missing";
  if (pass4580MayUseDirectionalColor(decision)) return "verified";
  return "review";
}


export const PASS4581_WINDOW_AWARE_MOVEMENT_CONTRACT = {
  passId: "PASS4581",
  purpose:
    "Make visible Real Markets movement windows session-aware: 1H never pretends to be live from last-close data, while 24H/7D/30D may be shown as neutral labelled values when the provider state is delayed or last-close and the raw move survives the strict asset envelope.",
  publicTopkaLiveAllowed: false,
  rule:
    "Percent values are decided per window, not per row. Fresh live can show 1H/24H/7D/30D. Delayed or last-close can only show day-or-longer values in neutral tone. Withheld rows stay em-dash with source proof pending.",
} as const;

export type Pass4581WindowMovementTier = "live-window" | "neutral-session-window" | "withheld-window";

export type Pass4581WindowMovementDecision = {
  tier: Pass4581WindowMovementTier;
  mayPrintValue: boolean;
  mayUseDirectionalTone: boolean;
  windowLabel: "1H" | "24H" | "7D" | "30D" | "custom";
  reason: string;
};

export function pass4581WindowLabel(windowSeconds: number): Pass4581WindowMovementDecision["windowLabel"] {
  if (windowSeconds <= 60 * 60) return "1H";
  if (windowSeconds <= 24 * 60 * 60) return "24H";
  if (windowSeconds <= 7 * 24 * 60 * 60) return "7D";
  if (windowSeconds <= 30 * 24 * 60 * 60) return "30D";
  return "custom";
}

export function pass4581WindowMovementDecision(
  quote: Pass4577SessionClockLike | null | undefined,
  category: AssetCategoryLike,
  locale: "pl" | "de" | "en",
  windowSeconds: number,
): Pass4581WindowMovementDecision {
  const decision = pass4579VisibleDataDecision(quote, category, locale);
  const windowLabel = pass4581WindowLabel(windowSeconds);
  const isIntraday = windowSeconds <= 60 * 60;
  const isDayOrLonger = windowSeconds >= 24 * 60 * 60;

  if (decision.decision === "show" && decision.tone === "live" && decision.canShowPercent) {
    return {
      tier: "live-window",
      mayPrintValue: true,
      mayUseDirectionalTone: decision.canShowChart,
      windowLabel,
      reason: locale === "pl"
        ? "świeży provider live dla tego okna"
        : locale === "de"
          ? "frischer Live-Provider für dieses Fenster"
          : "fresh live provider for this window",
    };
  }

  if (decision.decision === "limited" && decision.canShowPercent && isDayOrLonger) {
    return {
      tier: "neutral-session-window",
      mayPrintValue: true,
      mayUseDirectionalTone: false,
      windowLabel,
      reason: locale === "pl"
        ? "wartość sesyjna pokazana neutralnie, bez udawania live"
        : locale === "de"
          ? "Sitzungswert neutral angezeigt, kein Live-Schein"
          : "session value shown neutrally, not pretending live",
    };
  }

  return {
    tier: "withheld-window",
    mayPrintValue: false,
    mayUseDirectionalTone: false,
    windowLabel,
    reason: isIntraday
      ? locale === "pl"
        ? "1H ukryte bez świeżego ticku live"
        : locale === "de"
          ? "1H ohne frischen Live-Tick verborgen"
          : "1H withheld without a fresh live tick"
      : locale === "pl"
        ? "ruch ukryty do czasu dowodu źródła"
        : locale === "de"
          ? "Bewegung bis zum Quellenbeleg verborgen"
          : "movement withheld until source proof",
  };
}

export function pass4581SanitizeWindowPercent(
  value: number | null | undefined,
  category: AssetCategoryLike,
  windowSeconds: number,
  symbol: string | null | undefined,
  quote: Pass4577SessionClockLike | null | undefined,
  locale: "pl" | "de" | "en",
): number | null {
  const windowDecision = pass4581WindowMovementDecision(quote, category, locale, windowSeconds);
  if (!windowDecision.mayPrintValue) return null;
  const sanitized = pass4573SanitizeAssetPercent(value, category, windowSeconds, symbol, "live");
  return typeof sanitized === "number" ? sanitized : null;
}

export function pass4581WindowToneAttribute(decision: Pass4581WindowMovementDecision): string {
  if (decision.tier === "live-window" && decision.mayUseDirectionalTone) return "directional-live-window";
  if (decision.tier === "neutral-session-window") return "neutral-session-window";
  return "withheld-window";
}

export const PASS4582_MARKET_CALM_PSYCHOLOGY_CONTRACT = {
  passId: "PASS4582",
  purpose:
    "Turn the visible Real Markets trust system into a premium psychology layer: calm status first, color only when earned, and no pressure-language when sources are limited.",
  publicTopkaLiveAllowed: false,
  rule:
    "The interface should tell the user whether the market view is live, session-neutral or source-waiting before showing emotional movement cues.",
} as const;

export type Pass4582MarketCalmState = "calm-live" | "session-neutral" | "source-wait";

export type Pass4582MarketCalmSignal = {
  state: Pass4582MarketCalmState;
  score: number;
  label: string;
  body: string;
  action: string;
};

export function buildPass4582MarketCalmSignal(args: {
  totalRows: number;
  liveRows: number;
  chartRows: number;
  printableWindows: number;
  totalWindows: number;
  neutralSessionWindows: number;
  locale: "pl" | "de" | "en";
}): Pass4582MarketCalmSignal {
  const totalRows = Math.max(0, args.totalRows);
  const totalWindows = Math.max(0, args.totalWindows);
  const liveRatio = totalRows > 0 ? args.liveRows / totalRows : 0;
  const chartRatio = totalRows > 0 ? args.chartRows / totalRows : 0;
  const valueRatio = totalWindows > 0 ? args.printableWindows / totalWindows : 0;
  const neutralRatio = totalWindows > 0 ? args.neutralSessionWindows / totalWindows : 0;
  const score = Math.max(0, Math.min(100, Math.round(liveRatio * 44 + chartRatio * 34 + valueRatio * 16 + Math.min(0.18, neutralRatio) * 6)));

  if (liveRatio >= 0.62 && chartRatio >= 0.45) {
    return {
      state: "calm-live",
      score,
      label: args.locale === "pl" ? "Tryb spokojny live" : args.locale === "de" ? "Ruhiger Live-Modus" : "Calm live mode",
      body: args.locale === "pl"
        ? "Kolor i ruch są dozwolone tylko tam, gdzie źródło jest świeże."
        : args.locale === "de"
          ? "Farbe und Bewegung sind nur bei frischer Quelle erlaubt."
          : "Color and movement are allowed only where the source is fresh.",
      action: args.locale === "pl" ? "pokazuj bez presji" : args.locale === "de" ? "ohne Druck anzeigen" : "show without pressure",
    };
  }

  if (args.printableWindows > 0 || args.neutralSessionWindows > 0) {
    return {
      state: "session-neutral",
      score,
      label: args.locale === "pl" ? "Tryb neutralny sesji" : args.locale === "de" ? "Neutraler Sitzungsmodus" : "Neutral session mode",
      body: args.locale === "pl"
        ? "Dane sesyjne są czytelne, ale bez zielono-czerwonej psychologii live."
        : args.locale === "de"
          ? "Sitzungsdaten bleiben lesbar, aber ohne grün-rote Live-Psychologie."
          : "Session data stays readable without green/red live psychology.",
      action: args.locale === "pl" ? "oznacz neutralnie" : args.locale === "de" ? "neutral markieren" : "label neutrally",
    };
  }

  return {
    state: "source-wait",
    score,
    label: args.locale === "pl" ? "Oczekiwanie na źródło" : args.locale === "de" ? "Warten auf Quelle" : "Waiting for source",
    body: args.locale === "pl"
      ? "Brak świeżego dowodu oznacza skeleton zamiast udawanych emocji rynku."
      : args.locale === "de"
        ? "Ohne frischen Beleg erscheint Skeleton statt erfundener Markt-Emotion."
        : "No fresh proof means a skeleton instead of invented market emotion.",
    action: args.locale === "pl" ? "nie udawaj live" : args.locale === "de" ? "kein Live vortäuschen" : "do not pretend live",
  };
}

export const PASS4583_VISUAL_PSYCHOLOGY_CONTRACT = {
  passId: "PASS4583",
  purpose:
    "Add a visible premium focus lane above critical market/audit/terminal surfaces so the user reads the product as observe -> verify -> decide, not as noisy trading bait.",
  publicTopkaLiveAllowed: false,
  rule:
    "High-motion or directional UI must be visually subordinated to a calm focus sequence: observe the source, verify confidence, then decide the risk posture.",
} as const;

export type Pass4583FocusRailItem = {
  key: "observe" | "verify" | "decide";
  label: string;
  value: string;
  tone: "ready" | "neutral" | "hold";
};

export function buildPass4583VisualFocusRail(args: {
  calmState: Pass4582MarketCalmState;
  liveRows: number;
  totalRows: number;
  printableWindows: number;
  totalWindows: number;
  chartRows: number;
  locale: "pl" | "de" | "en";
}): Pass4583FocusRailItem[] {
  const totalRows = Math.max(0, args.totalRows);
  const totalWindows = Math.max(0, args.totalWindows);
  const liveRatio = totalRows > 0 ? args.liveRows / totalRows : 0;
  const valueRatio = totalWindows > 0 ? args.printableWindows / totalWindows : 0;
  const chartRatio = totalRows > 0 ? args.chartRows / totalRows : 0;
  const observeTone: Pass4583FocusRailItem["tone"] = liveRatio >= 0.55 ? "ready" : liveRatio > 0 ? "neutral" : "hold";
  const verifyTone: Pass4583FocusRailItem["tone"] = valueRatio >= 0.5 ? "ready" : valueRatio > 0 ? "neutral" : "hold";
  const decideTone: Pass4583FocusRailItem["tone"] = args.calmState === "calm-live" && chartRatio >= 0.45 ? "ready" : args.calmState === "session-neutral" ? "neutral" : "hold";
  const pct = (ratio: number) => `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  const l = args.locale;
  return [
    {
      key: "observe",
      label: l === "pl" ? "Obserwuj źródło" : l === "de" ? "Quelle beobachten" : "Observe source",
      value: observeTone === "ready" ? pct(liveRatio) : observeTone === "neutral" ? pct(liveRatio) : l === "pl" ? "czekaj" : l === "de" ? "warten" : "wait",
      tone: observeTone,
    },
    {
      key: "verify",
      label: l === "pl" ? "Weryfikuj ruch" : l === "de" ? "Bewegung prüfen" : "Verify move",
      value: verifyTone === "hold" ? (l === "pl" ? "brak presji" : l === "de" ? "kein Druck" : "no pressure") : pct(valueRatio),
      tone: verifyTone,
    },
    {
      key: "decide",
      label: l === "pl" ? "Decyzja bez FOMO" : l === "de" ? "Entscheid ohne FOMO" : "Decide without FOMO",
      value: decideTone === "ready" ? (l === "pl" ? "chart live" : l === "de" ? "Chart live" : "chart live") : decideTone === "neutral" ? (l === "pl" ? "neutralnie" : l === "de" ? "neutral" : "neutral") : (l === "pl" ? "wstrzymaj" : l === "de" ? "halten" : "hold"),
      tone: decideTone,
    },
  ];
}



export const PASS4584_PREMIUM_DECISION_POSTURE_CONTRACT = {
  passId: "PASS4584",
  purpose:
    "Convert the calm psychology rail into a product-level posture: source-led when evidence is live, balanced when session data is readable, and quiet-hold when the UI should slow down instead of creating pressure.",
  publicTopkaLiveAllowed: false,
  rule:
    "Before charts, colors or movement get emotional weight, the UI must declare the current posture and motion budget: source-led, balanced watch, or quiet hold.",
} as const;

export type Pass4584PremiumPostureMode = "source-led" | "balanced-watch" | "quiet-hold";

export type Pass4584PremiumDecisionPosture = {
  mode: Pass4584PremiumPostureMode;
  tone: "ready" | "neutral" | "hold";
  label: string;
  body: string;
  action: string;
  motionBudget: "slow" | "very-slow" | "still";
  score: number;
};

export function buildPass4584PremiumDecisionPosture(args: {
  calmState: Pass4582MarketCalmState;
  liveRows: number;
  totalRows: number;
  chartRows: number;
  printableWindows: number;
  totalWindows: number;
  locale: "pl" | "de" | "en";
}): Pass4584PremiumDecisionPosture {
  const totalRows = Math.max(0, args.totalRows);
  const totalWindows = Math.max(0, args.totalWindows);
  const liveRatio = totalRows > 0 ? args.liveRows / totalRows : 0;
  const chartRatio = totalRows > 0 ? args.chartRows / totalRows : 0;
  const valueRatio = totalWindows > 0 ? args.printableWindows / totalWindows : 0;
  const score = Math.max(0, Math.min(100, Math.round(liveRatio * 42 + chartRatio * 34 + valueRatio * 24)));
  const l = args.locale;

  if (args.calmState === "calm-live" && liveRatio >= 0.6 && chartRatio >= 0.45) {
    return {
      mode: "source-led",
      tone: "ready",
      label: l === "pl" ? "Postawa source-led" : l === "de" ? "Source-led Haltung" : "Source-led posture",
      body: l === "pl"
        ? "Interfejs może oddychać: źródła są świeże, ale ruch dalej zostaje spokojny."
        : l === "de"
          ? "Die Oberfläche darf atmen: Quellen sind frisch, Bewegung bleibt ruhig."
          : "The interface may breathe: sources are fresh, while motion stays calm.",
      action: l === "pl" ? "pokazuj z klasą" : l === "de" ? "mit Klasse zeigen" : "show with class",
      motionBudget: "slow",
      score,
    };
  }

  if (args.calmState === "session-neutral" || valueRatio > 0) {
    return {
      mode: "balanced-watch",
      tone: "neutral",
      label: l === "pl" ? "Postawa balanced watch" : l === "de" ? "Balanced-Watch Haltung" : "Balanced watch posture",
      body: l === "pl"
        ? "Dane są czytelne, ale bez emocjonalnych kolorów i bez presji decyzji."
        : l === "de"
          ? "Daten bleiben lesbar, aber ohne emotionale Farben und Entscheidungsdruck."
          : "Data stays readable without emotional colors or decision pressure.",
      action: l === "pl" ? "czytaj neutralnie" : l === "de" ? "neutral lesen" : "read neutrally",
      motionBudget: "very-slow",
      score,
    };
  }

  return {
    mode: "quiet-hold",
    tone: "hold",
    label: l === "pl" ? "Postawa quiet hold" : l === "de" ? "Quiet-Hold Haltung" : "Quiet hold posture",
    body: l === "pl"
      ? "Brak źródła oznacza ciszę wizualną: skeleton, brak FOMO, brak udawania rynku."
      : l === "de"
        ? "Ohne Quelle bleibt die Oberfläche still: Skeleton, kein FOMO, kein Markt-Schein."
        : "No source means visual silence: skeleton, no FOMO, no fake market feeling.",
    action: l === "pl" ? "czekaj na dowód" : l === "de" ? "auf Beleg warten" : "wait for proof",
    motionBudget: "still",
    score,
  };
}

export const PASS4585_ATTENTION_BUDGET_CONTRACT = {
  passId: "PASS4585",
  purpose:
    "Compress the growing trust/psychology rails into a luxury attention budget so premium screens stay calm, minimal and decision-led instead of adding more visible noise.",
  publicTopkaLiveAllowed: false,
  rule:
    "A surface may show several trust signals only inside one executive decision stack. Mobile and limited-source states must collapse copy before adding more motion or badges.",
} as const;

export type Pass4585AttentionDensity = "executive" | "standard" | "silent";

export type Pass4585AttentionBudget = {
  density: Pass4585AttentionDensity;
  label: string;
  body: string;
  action: string;
  maxVisibleSignals: 1 | 2 | 3;
  mobileMode: "single-line" | "compact-stack";
  motionPermission: "breathe" | "minimal" | "still";
};

export function buildPass4585AttentionBudget(args: {
  postureMode: Pass4584PremiumPostureMode;
  motionBudget: Pass4584PremiumDecisionPosture["motionBudget"];
  totalRows: number;
  liveRows: number;
  printableWindows: number;
  totalWindows: number;
  locale: "pl" | "de" | "en";
}): Pass4585AttentionBudget {
  const totalRows = Math.max(0, args.totalRows);
  const totalWindows = Math.max(0, args.totalWindows);
  const liveRatio = totalRows > 0 ? args.liveRows / totalRows : 0;
  const valueRatio = totalWindows > 0 ? args.printableWindows / totalWindows : 0;
  const l = args.locale;

  if (args.postureMode === "source-led" && liveRatio >= 0.62 && valueRatio >= 0.45) {
    return {
      density: "executive",
      label: l === "pl" ? "Executive view" : l === "de" ? "Executive View" : "Executive view",
      body: l === "pl"
        ? "Jedna spokojna hierarchia: źródło, ruch, decyzja. Bez dokładania hałasu."
        : l === "de"
          ? "Eine ruhige Hierarchie: Quelle, Bewegung, Entscheidung. Kein zusätzlicher Lärm."
          : "One calm hierarchy: source, movement, decision. No extra noise.",
      action: l === "pl" ? "utrzymaj ciszę premium" : l === "de" ? "Premium-Ruhe halten" : "keep premium silence",
      maxVisibleSignals: 3,
      mobileMode: "compact-stack",
      motionPermission: args.motionBudget === "slow" ? "breathe" : "minimal",
    };
  }

  if (args.postureMode === "balanced-watch" || valueRatio > 0) {
    return {
      density: "standard",
      label: l === "pl" ? "Balanced view" : l === "de" ? "Balanced View" : "Balanced view",
      body: l === "pl"
        ? "Sygnały są czytelne, ale tekst i animacja muszą zostać krótkie."
        : l === "de"
          ? "Signale bleiben lesbar, Text und Bewegung bleiben kurz."
          : "Signals stay readable while text and motion stay short.",
      action: l === "pl" ? "kompresuj komunikaty" : l === "de" ? "Hinweise komprimieren" : "compress cues",
      maxVisibleSignals: 2,
      mobileMode: "single-line",
      motionPermission: "minimal",
    };
  }

  return {
    density: "silent",
    label: l === "pl" ? "Silent view" : l === "de" ? "Silent View" : "Silent view",
    body: l === "pl"
      ? "Gdy brakuje dowodu, ekran ma się wyciszyć zamiast udawać aktywność."
      : l === "de"
        ? "Ohne Beleg wird die Oberfläche still statt Aktivität vorzutäuschen."
        : "When proof is missing, the screen goes quiet instead of pretending activity.",
    action: l === "pl" ? "pokaż tylko dowód / skeleton" : l === "de" ? "nur Beleg / Skeleton zeigen" : "show proof / skeleton only",
    maxVisibleSignals: 1,
    mobileMode: "single-line",
    motionPermission: "still",
  };
}


export const PASS4586_EXECUTIVE_SILENCE_CONTRACT = {
  passId: "PASS4586",
  purpose:
    "Turn attention budget from a visual wrapper into an actual visibility plan: one-line, two-cue or full-stack, so premium screens stop rendering rails that the user should not process.",
  publicTopkaLiveAllowed: false,
  rule:
    "Do not merely shrink noisy trust rails with CSS. If the attention budget says one or two signals, the UI must withhold extra visible rails and preserve them only as hidden QA/receipt context.",
} as const;

export type Pass4586ExecutiveSilenceMode = "one-line" | "two-cue" | "full-stack";

export type Pass4586VisibleRailPlan = {
  mode: Pass4586ExecutiveSilenceMode;
  showCalmRail: boolean;
  showFocusRail: boolean;
  showPostureRail: boolean;
  label: string;
  summaryLine: string;
  withheldRails: string[];
};

export function buildPass4586VisibleRailPlan(args: {
  density: Pass4585AttentionDensity;
  maxVisibleSignals: Pass4585AttentionBudget["maxVisibleSignals"];
  motionPermission: Pass4585AttentionBudget["motionPermission"];
  locale: "pl" | "de" | "en";
}): Pass4586VisibleRailPlan {
  const l = args.locale;
  if (args.maxVisibleSignals <= 1 || args.density === "silent" || args.motionPermission === "still") {
    return {
      mode: "one-line",
      showCalmRail: true,
      showFocusRail: false,
      showPostureRail: false,
      label: l === "pl" ? "Tryb jednej linii" : l === "de" ? "Ein-Zeilen-Modus" : "One-line mode",
      summaryLine: l === "pl" ? "tylko najważniejszy sygnał" : l === "de" ? "nur das wichtigste Signal" : "only the highest-signal cue",
      withheldRails: ["focus", "posture"],
    };
  }

  if (args.maxVisibleSignals === 2 || args.density === "standard" || args.motionPermission === "minimal") {
    return {
      mode: "two-cue",
      showCalmRail: true,
      showFocusRail: true,
      showPostureRail: false,
      label: l === "pl" ? "Tryb dwóch sygnałów" : l === "de" ? "Zwei-Signal-Modus" : "Two-cue mode",
      summaryLine: l === "pl" ? "źródło i decyzja bez trzeciego paska" : l === "de" ? "Quelle und Entscheidung ohne dritte Leiste" : "source and decision without a third rail",
      withheldRails: ["posture"],
    };
  }

  return {
    mode: "full-stack",
    showCalmRail: true,
    showFocusRail: true,
    showPostureRail: true,
    label: l === "pl" ? "Pełny stack premium" : l === "de" ? "Voller Premium-Stack" : "Full premium stack",
    summaryLine: l === "pl" ? "pełna hierarchia tylko przy mocnych źródłach" : l === "de" ? "volle Hierarchie nur bei starken Quellen" : "full hierarchy only when sources earned it",
    withheldRails: [],
  };
}


export const PASS4587_PREMIUM_INTERACTION_RHYTHM_CONTRACT = {
  passId: "PASS4587",
  purpose:
    "Move the premium surfaces from visual silence into interaction silence: rows, rails, focus states and motion must follow one calm rhythm before any user opens a modal or acts on a signal.",
  publicTopkaLiveAllowed: false,
  rule:
    "Every visible market/audit cue must have a rhythm state. Live/source-led screens may breathe slowly; limited screens stay still; mobile must prefer single-focus navigation over stacked motion.",
} as const;

export type Pass4587InteractionRhythm = "still" | "slow" | "very-slow";
export type Pass4587FocusPosture = "proof-first" | "observe-first" | "source-led";
export type Pass4587VisualDensity = "single-focus" | "balanced-focus" | "executive-focus";

export type Pass4587PremiumInteractionRhythm = {
  rhythm: Pass4587InteractionRhythm;
  focusPosture: Pass4587FocusPosture;
  density: Pass4587VisualDensity;
  label: string;
  shortRule: string;
  microcopy: string;
  rowAffordance: string;
  modalPace: string;
  pointerIntent: "read" | "inspect" | "decide";
};

export function buildPass4587PremiumInteractionRhythm(args: {
  visibleRailMode: Pass4586ExecutiveSilenceMode;
  attentionDensity: Pass4585AttentionDensity;
  motionPermission: Pass4585AttentionBudget["motionPermission"];
  mobileMode: Pass4585AttentionBudget["mobileMode"];
  locale: "pl" | "de" | "en";
}): Pass4587PremiumInteractionRhythm {
  const l = args.locale;
  if (args.visibleRailMode === "full-stack" && args.attentionDensity === "executive" && args.motionPermission === "breathe") {
    return {
      rhythm: "slow",
      focusPosture: "source-led",
      density: "executive-focus",
      label: l === "pl" ? "Rytm źródłowy" : l === "de" ? "Quellenrhythmus" : "Source rhythm",
      shortRule: l === "pl" ? "ruch dopiero po źródle" : l === "de" ? "Bewegung erst nach Quelle" : "motion only after source",
      microcopy: l === "pl" ? "Pełny ekran oddycha tylko gdy źródła na to zasłużą." : l === "de" ? "Der volle Screen atmet nur, wenn Quellen es verdienen." : "The full screen breathes only when sources earned it.",
      rowAffordance: "quiet-left-accent-slow-hover",
      modalPace: "open-with-calm-depth",
      pointerIntent: "decide",
    };
  }

  if (args.visibleRailMode === "two-cue" || args.attentionDensity === "standard" || args.motionPermission === "minimal") {
    return {
      rhythm: "very-slow",
      focusPosture: "observe-first",
      density: args.mobileMode === "single-line" ? "single-focus" : "balanced-focus",
      label: l === "pl" ? "Rytm obserwacji" : l === "de" ? "Beobachtungsrhythmus" : "Observation rhythm",
      shortRule: l === "pl" ? "czytaj, potem otwieraj" : l === "de" ? "erst lesen, dann öffnen" : "read before opening",
      microcopy: l === "pl" ? "Wiersz ma zaprosić do analizy, nie wymuszać reakcji." : l === "de" ? "Die Zeile lädt zur Analyse ein, ohne Reaktion zu erzwingen." : "The row invites analysis without forcing reaction.",
      rowAffordance: "hairline-left-accent-no-jump",
      modalPace: "open-without-snap",
      pointerIntent: "inspect",
    };
  }

  return {
    rhythm: "still",
    focusPosture: "proof-first",
    density: "single-focus",
    label: l === "pl" ? "Rytm dowodu" : l === "de" ? "Beweisrhythmus" : "Proof rhythm",
    shortRule: l === "pl" ? "najpierw dowód" : l === "de" ? "Beleg zuerst" : "proof first",
    microcopy: l === "pl" ? "Gdy dowód jest słaby, interfejs zostaje nieruchomy." : l === "de" ? "Bei schwachem Beleg bleibt die Oberfläche still." : "When proof is weak, the interface stays still.",
    rowAffordance: "static-skeleton-no-emotion",
    modalPace: "open-only-on-intent",
    pointerIntent: "read",
  };
}

export const PASS4588_HONEST_100_CLOSEOUT_CONTRACT = {
  passId: "PASS4588",
  purpose:
    "Refuse fake 100% claims while pushing one-message closeout work into a measurable final-gap plan across premium UI, UX, psychology, motion, mobile and live-proof gates.",
  publicTopkaLiveAllowed: false,
  rule:
    "A surface can visually approach 100 only for concept/demo readiness. Live topka świata remains capped until build, provider, payment, security, mobile and screenshot receipts exist.",
} as const;

export type Pass4588CloseoutMode = "demo-max" | "proof-gated" | "live-proof-ready";

export type Pass4588HonestCloseoutPlan = {
  mode: Pass4588CloseoutMode;
  conceptCeiling: number;
  liveClaimCeiling: number;
  label: string;
  body: string;
  proofGate: string;
  nextAction: string;
  missingProofs: string[];
  canClaimUi100: boolean;
  canClaimLive100: boolean;
};

export function buildPass4588Honest100CloseoutPlan(args: {
  premiumMinimalism: number;
  psychology: number;
  ux: number;
  motion: number;
  mobile: number;
  liveProof: number;
  buildReceipt?: boolean;
  providerSmoke?: boolean;
  mobileScreenshots?: boolean;
  paymentReplay?: boolean;
  securityProof?: boolean;
  locale: "pl" | "de" | "en";
}): Pass4588HonestCloseoutPlan {
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const conceptCeiling = clamp(
    args.premiumMinimalism * 0.24 +
    args.psychology * 0.22 +
    args.ux * 0.20 +
    args.motion * 0.16 +
    args.mobile * 0.18,
  );
  const proofReceipts = [args.buildReceipt, args.providerSmoke, args.mobileScreenshots, args.paymentReplay, args.securityProof].filter(Boolean).length;
  const liveClaimCeiling = clamp(args.liveProof * 0.60 + proofReceipts * 8);
  const l = args.locale;
  const missingProofs = [
    args.buildReceipt ? null : "npm-ci-build-typecheck",
    args.providerSmoke ? null : "provider-smoke",
    args.mobileScreenshots ? null : "mobile-screenshot-qa",
    args.paymentReplay ? null : "payment-entitlement-replay",
    args.securityProof ? null : "security-receipt-proof",
  ].filter((item): item is string => Boolean(item));
  const canClaimLive100 = liveClaimCeiling >= 100 && missingProofs.length === 0;
  const canClaimUi100 = conceptCeiling >= 96 && args.mobile >= 90;

  if (canClaimLive100) {
    return {
      mode: "live-proof-ready",
      conceptCeiling,
      liveClaimCeiling,
      label: l === "pl" ? "Live proof gotowy" : l === "de" ? "Live-Proof bereit" : "Live proof ready",
      body: l === "pl"
        ? "Wszystkie bramki dowodowe są obecne; dopiero wtedy claim 100% może być publiczny."
        : l === "de"
          ? "Alle Proof-Gates sind vorhanden; erst dann darf 100% öffentlich stehen."
          : "All proof gates are present; only then may a 100% claim be public.",
      proofGate: "all-receipts-present",
      nextAction: l === "pl" ? "publikuj z receipt" : l === "de" ? "mit Receipt veröffentlichen" : "publish with receipt",
      missingProofs,
      canClaimUi100,
      canClaimLive100,
    };
  }

  if (conceptCeiling >= 80) {
    return {
      mode: "demo-max",
      conceptCeiling,
      liveClaimCeiling,
      label: l === "pl" ? "Demo blisko sufitu" : l === "de" ? "Demo nahe am Limit" : "Demo near ceiling",
      body: l === "pl"
        ? "Wygląd i psychologia mogą iść wysoko, ale 100% bez proof-runnera byłoby fake claimem."
        : l === "de"
          ? "Look und Psychologie können hochgehen, aber 100% ohne Proof-Runner wäre ein Fake-Claim."
          : "Visuals and psychology can climb high, but 100% without a proof runner would be a fake claim.",
      proofGate: missingProofs.join("|") || "proof-recheck-required",
      nextAction: l === "pl" ? "dociśnij mobile + proof-runner" : l === "de" ? "Mobile + Proof-Runner härten" : "harden mobile + proof runner",
      missingProofs,
      canClaimUi100,
      canClaimLive100,
    };
  }

  return {
    mode: "proof-gated",
    conceptCeiling,
    liveClaimCeiling,
    label: l === "pl" ? "100% zablokowane przez dowody" : l === "de" ? "100% durch Proofs blockiert" : "100% blocked by proof",
    body: l === "pl"
      ? "Ekran może wyglądać lepiej, ale publiczny claim musi czekać na build, provider, mobile i security receipts."
      : l === "de"
        ? "Die Oberfläche kann besser aussehen, aber der öffentliche Claim wartet auf Build-, Provider-, Mobile- und Security-Receipts."
        : "The screen can look better, but the public claim must wait for build, provider, mobile and security receipts.",
    proofGate: missingProofs.join("|") || "proof-recheck-required",
    nextAction: l === "pl" ? "najpierw dowody, potem 100" : l === "de" ? "erst Proofs, dann 100" : "proof first, then 100",
    missingProofs,
    canClaimUi100,
    canClaimLive100,
  };
}


