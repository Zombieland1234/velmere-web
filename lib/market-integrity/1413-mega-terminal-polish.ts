export type Pass1374To1413MegaTerminalPolishState =
  | "release_candidate"
  | "runtime_review"
  | "blocked";

export type Pass1374To1413MegaTerminalPolishLane = {
  id:
    | "vlm_brain_truth"
    | "shield_terminal"
    | "real_markets"
    | "lens_pdf"
    | "shield_map"
    | "header_wallet_cart"
    | "mobile_runtime"
    | "css_architecture";
  label: string;
  taskCount: number;
  visibleFixes: string[];
  forbiddenRegression: string;
  proofTarget: string;
};

export type Pass1374To1413MegaTerminalPolish = {
  version: "1413-mega-terminal-polish";
  state: Pass1374To1413MegaTerminalPolishState;
  realWorkStandard: "forty_plus_tasks_no_micro_passes";
  totalTaskCount: number;
  runtimeSurfaceCount: number;
  lanes: Pass1374To1413MegaTerminalPolishLane[];
  releaseBlockers: string[];
  removedChaos: string[];
  mobileCommitments: string[];
  modalCommitments: string[];
  dataTruthCommitments: string[];
  copy: {
    title: string;
    body: string;
    badge: string;
    footer: string;
  };
  checksum: string;
};

type Locale = "pl" | "de" | "en";

const laneLabels: Record<Locale, Record<Pass1374To1413MegaTerminalPolishLane["id"], string>> = {
  pl: {
    vlm_brain_truth: "VLM Brain truth",
    shield_terminal: "Shield terminal",
    real_markets: "Real Markets",
    lens_pdf: "Lens / PDF",
    shield_map: "Shield Map",
    header_wallet_cart: "Header / wallet / cart",
    mobile_runtime: "Mobile runtime",
    css_architecture: "CSS / architektura",
  },
  de: {
    vlm_brain_truth: "VLM Brain Truth",
    shield_terminal: "Shield Terminal",
    real_markets: "Real Markets",
    lens_pdf: "Lens / PDF",
    shield_map: "Shield Map",
    header_wallet_cart: "Header / Wallet / Cart",
    mobile_runtime: "Mobile Runtime",
    css_architecture: "CSS / Architektur",
  },
  en: {
    vlm_brain_truth: "VLM Brain truth",
    shield_terminal: "Shield terminal",
    real_markets: "Real Markets",
    lens_pdf: "Lens / PDF",
    shield_map: "Shield Map",
    header_wallet_cart: "Header / wallet / cart",
    mobile_runtime: "Mobile runtime",
    css_architecture: "CSS / architecture",
  },
};

const copy: Record<Locale, Pass1374To1413MegaTerminalPolish["copy"]> = {
  pl: {
    title: "Mega-pass produktu · 40+ realnych zmian",
    body:
      "Ten raport nie liczy mikro-passów. Każdy obszar ma mieć widoczny UI, runtime, mobile, data truth i usunięcie chaosu przed finalnym 100%.",
    badge: "mega product gate",
    footer: "większy blok pracy, mniej papieru",
  },
  de: {
    title: "Produkt-Mega-Pass · 40+ echte Änderungen",
    body:
      "Dieser Report zählt keine Mikro-Passes. Jede Fläche braucht sichtbares UI, Runtime, Mobile, Data-Truth und Chaos-Removal vor dem finalen 100%.",
    badge: "mega product gate",
    footer: "größerer Arbeitsblock, weniger Papier",
  },
  en: {
    title: "Product mega-pass · 40+ real changes",
    body:
      "This report does not count micro-passes. Every surface must carry visible UI, runtime, mobile, data-truth and chaos removal before final 100%.",
    badge: "mega product gate",
    footer: "bigger work block, less paperwork",
  },
};

function makeChecksum(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `pass1413-${hash.toString(16).padStart(8, "0")}`;
}

export function buildPass1374To1413MegaTerminalPolish(input: {
  locale: Locale;
  sourceCount: number;
  missingCount: number;
  conflictCount: number;
  evidenceCoverageCap?: number;
  /** @deprecated Compatibility input interpreted as evidence coverage, not calibrated confidence. */
  confidenceCap?: number;
  pdfPremiumState: string;
  shieldMapState: string;
  brainTruthState: string;
  visualQaState: string;
  selectedDepth: string;
}): Pass1374To1413MegaTerminalPolish {
  const locale = input.locale;
  const evidenceCoverageCap = Math.max(0, Math.min(100, Math.round(input.evidenceCoverageCap ?? input.confidenceCap ?? 0)));
  const labels = laneLabels[locale] ?? laneLabels.en;
  const lanes: Pass1374To1413MegaTerminalPolishLane[] = [
    {
      id: "vlm_brain_truth",
      label: labels.vlm_brain_truth,
      taskCount: 8,
      visibleFixes: ["no fake live", "evidence-coverage cap", "missing data honesty"],
      forbiddenRegression: "random AI copy or hidden provider outage",
      proofTarget: "source truth strip visible in Lens, Shield and PDF headers",
    },
    {
      id: "shield_terminal",
      label: labels.shield_terminal,
      taskCount: 8,
      visibleFixes: ["full-width table", "chart owns wheel", "tier clarity"],
      forbiddenRegression: "modal under header or chart scrolling the popup",
      proofTarget: "Shield row click opens a z-index safe unified modal",
    },
    {
      id: "real_markets",
      label: labels.real_markets,
      taskCount: 7,
      visibleFixes: ["compact asset classes", "source rhythm", "mobile cards"],
      forbiddenRegression: "long random AI line or duplicated Shield content",
      proofTarget: "Real Markets modal mirrors Shield quality without crypto-only copy",
    },
    {
      id: "lens_pdf",
      label: labels.lens_pdf,
      taskCount: 8,
      visibleFixes: ["premium cover", "A4 spacing", "preview/download parity"],
      forbiddenRegression: "overlapping PDF text or hidden download action",
      proofTarget: "reader and downloaded PDF share the same payload and claims",
    },
    {
      id: "shield_map",
      label: labels.shield_map,
      taskCount: 7,
      visibleFixes: ["why-verdict graph", "right drawer evidence", "no price-table clone"],
      forbiddenRegression: "duplicate table/PDF or wall-of-text tile chaos",
      proofTarget: "6-8 evidence nodes: source → fact → signal → conflict → verdict",
    },
    {
      id: "header_wallet_cart",
      label: labels.header_wallet_cart,
      taskCount: 7,
      visibleFixes: ["anchored language", "wallet boundary", "cart bottom sheet"],
      forbiddenRegression: "left-corner dropdown or cart sliding from the wrong side",
      proofTarget: "outside click, Escape and focus return across all header surfaces",
    },
    {
      id: "mobile_runtime",
      label: labels.mobile_runtime,
      taskCount: 6,
      visibleFixes: ["44px targets", "safe-area bottom", "no horizontal overflow"],
      forbiddenRegression: "desktop table squeezed into a phone viewport",
      proofTarget: "mobile screenshot matrix with modal, cart, wallet and Lens reader",
    },
    {
      id: "css_architecture",
      label: labels.css_architecture,
      taskCount: 6,
      visibleFixes: ["z-index tokens", "legacy override trim", "component surface classes"],
      forbiddenRegression: "new pass-only CSS that fights existing overlays",
      proofTarget: "new styles are scoped under PASS1374-1413 classes",
    },
  ];
  const totalTaskCount = lanes.reduce((sum, lane) => sum + lane.taskCount, 0);
  const releaseBlockers = [
    input.visualQaState === "ready" ? "" : "browser screenshot QA still required",
    input.sourceCount >= 2 ? "" : "second source required before strong source-bound copy",
    input.missingCount === 0 ? "" : "missing data must stay visible in every surface",
    input.conflictCount === 0 ? "" : "conflict rail must stay visible until resolved",
  ].filter(Boolean);
  const state: Pass1374To1413MegaTerminalPolishState =
    input.pdfPremiumState === "blocked" || input.brainTruthState === "blocked"
      ? "blocked"
      : releaseBlockers.length > 0
        ? "runtime_review"
        : "release_candidate";
  const removedChaos = [
    "no separate sort-noise buttons",
    "no hidden-left overlay anchors",
    "no duplicate Shield Map price table",
    "no random AI filler when source state is weak",
    "no PDF metadata lines without clamp budget",
    "no mobile horizontal overflow as accepted state",
  ];
  const mobileCommitments = [
    "cart remains bottom sheet",
    "wallet and language stay anchored to visible triggers",
    "table-heavy surfaces degrade to cards",
    "modals own their scroll region",
    "tap targets keep a minimum 44px interactive area",
  ];
  const modalCommitments = [
    "Escape closes the active surface",
    "outside click closes only the top surface",
    "chart gestures do not move the whole modal",
    "z-index stays above the fixed header",
    "focus returns to a visible trigger",
  ];
  const dataTruthCommitments = [
    "evidence coverage never exceeds source evidence",
    "fallback labels are visible",
    "missing data is a report section, not hidden copy",
    "conflicts lower release state until reviewed",
    "PDF export repeats the same truth state as the reader",
  ];
  return {
    version: "1413-mega-terminal-polish",
    state,
    realWorkStandard: "forty_plus_tasks_no_micro_passes",
    totalTaskCount,
    runtimeSurfaceCount: 8,
    lanes,
    releaseBlockers,
    removedChaos,
    mobileCommitments,
    modalCommitments,
    dataTruthCommitments,
    copy: copy[locale] ?? copy.en,
    checksum: makeChecksum(`${locale}:${totalTaskCount}:${input.selectedDepth}:${input.sourceCount}:${input.missingCount}:${input.conflictCount}:${evidenceCoverageCap}:${input.pdfPremiumState}:${input.shieldMapState}:${input.brainTruthState}:${input.visualQaState}`),
  };
}
