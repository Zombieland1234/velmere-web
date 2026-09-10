import type { Pass4416LensLocale } from "@/lib/search/lens-locale-copy";

export const PASS4417_LENS_READER_RUNTIME_HELPER_BOUNDARY = {
  passId: "PASS4417",
  mode: "no_visual_browser_lens_reader_runtime_helper_extraction",
  visualChanges: false,
  purpose:
    "Move Browser/Lens reader health labels and animated command prompt runtime math out of VelmereIntelligenceSearchClient while keeping the rendered UI unchanged.",
  publicTopkaLiveAllowed: false,
  worldclassBenchmarkRequired: true,
} as const;

export type Pass4417LensCommandPromptState = {
  index: number;
  count: number;
  deleting: boolean;
};

export type Pass4417LensReaderHealthStatus = "ready" | "review" | "blocked";

export const PASS4417_LENS_COMMAND_PROMPT_TIMING = {
  deletingMs: 44,
  endPauseMs: 2400,
  startPauseMs: 420,
  typingMs: 92,
} as const;

export function pass4417LensCommandPromptDelay(
  state: Pass4417LensCommandPromptState,
  phrase: string,
): number {
  const atEnd = state.count >= phrase.length;
  const atStart = state.count <= 0;
  if (state.deleting) return PASS4417_LENS_COMMAND_PROMPT_TIMING.deletingMs;
  if (atEnd) return PASS4417_LENS_COMMAND_PROMPT_TIMING.endPauseMs;
  if (atStart) return PASS4417_LENS_COMMAND_PROMPT_TIMING.startPauseMs;
  return PASS4417_LENS_COMMAND_PROMPT_TIMING.typingMs;
}

export function nextPass4417LensCommandPromptState(
  current: Pass4417LensCommandPromptState,
  prompts: readonly string[],
): Pass4417LensCommandPromptState {
  const promptCount = Math.max(prompts.length, 1);
  const currentPhrase = prompts[current.index % promptCount] || "";
  if (!current.deleting && current.count >= currentPhrase.length) {
    return { ...current, deleting: true };
  }
  if (current.deleting && current.count <= 0) {
    return {
      index: (current.index + 1) % promptCount,
      count: 0,
      deleting: false,
    };
  }
  return {
    ...current,
    count: current.deleting ? current.count - 1 : current.count + 1,
  };
}

export function pass4417LensReaderHealthLabel(
  locale: Pass4416LensLocale,
  status?: Pass4417LensReaderHealthStatus | null,
): string {
  if (!status) return "";
  if (locale === "pl") {
    if (status === "ready") return "Gotowy do pobrania";
    if (status === "review") return "Wymaga przeglądu";
    return "Zablokowany";
  }
  if (locale === "de") {
    if (status === "ready") return "Downloadbereit";
    if (status === "review") return "Prüfung erforderlich";
    return "Blockiert";
  }
  if (status === "ready") return "Ready to download";
  if (status === "review") return "Review required";
  return "Blocked";
}

export const PASS4417_WORLDCLASS_COMPARISON_ROWS = [
  {
    lane: "Deterministic proof runner",
    velmerePrepared: "94–97.5%",
    certik: "CertiK-style external audit proof discipline",
    openZeppelin: "OpenZeppelin-style library and review discipline",
    trailOfBits: "Trail of Bits-style deep adversarial review discipline",
    chainSecurity: "ChainSecurity-style formal review discipline",
    blocker: "Hosted zero-skip receipt bundle still required before public live claim.",
  },
  {
    lane: "AI/VLM Brain tier evidence",
    velmerePrepared: "88–94%",
    certik: "CertiK-style risk dashboard evidence",
    openZeppelin: "OpenZeppelin-style engineering-first evidence",
    trailOfBits: "Trail of Bits-style attack-path evidence",
    chainSecurity: "ChainSecurity-style spec and invariant evidence",
    blocker: "Provider smoke, AI eval, refusal/uncertainty receipts still required.",
  },
  {
    lane: "Browser/PDF proof parity",
    velmerePrepared: "91–96%",
    certik: "CertiK-style public report discipline",
    openZeppelin: "OpenZeppelin-style clear technical report discipline",
    trailOfBits: "Trail of Bits-style finding-to-evidence discipline",
    chainSecurity: "ChainSecurity-style formal report discipline",
    blocker: "Preview/download/account vault hash parity must be proven live.",
  },
  {
    lane: "Payment/entitlement security",
    velmerePrepared: "76–86%",
    certik: "CertiK-style enterprise delivery controls",
    openZeppelin: "OpenZeppelin-style secure access patterns",
    trailOfBits: "Trail of Bits-style abuse-case testing",
    chainSecurity: "ChainSecurity-style release gate rigor",
    blocker: "Stripe replay, server entitlement receipt and bypass tests still required.",
  },
] as const;
