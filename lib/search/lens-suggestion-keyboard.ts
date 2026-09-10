export type LensSuggestionKeyboardInput = {
  key: string;
  optionCount: number;
  activeIndex: number | null;
  open: boolean;
};

export type LensSuggestionKeyboardDecision = {
  handled: boolean;
  open: boolean;
  activeIndex: number | null;
  selectIndex: number | null;
};

function safeOptionCount(optionCount: number): number {
  return Number.isSafeInteger(optionCount) && optionCount > 0
    ? optionCount
    : 0;
}

function safeActiveIndex(
  activeIndex: number | null,
  optionCount: number,
): number | null {
  return Number.isSafeInteger(activeIndex) &&
    activeIndex !== null &&
    activeIndex >= 0 &&
    activeIndex < optionCount
    ? activeIndex
    : null;
}

export function nextLensSuggestionKeyboardDecision({
  key,
  optionCount: rawOptionCount,
  activeIndex: rawActiveIndex,
  open,
}: LensSuggestionKeyboardInput): LensSuggestionKeyboardDecision {
  const optionCount = safeOptionCount(rawOptionCount);
  const activeIndex = open
    ? safeActiveIndex(rawActiveIndex, optionCount)
    : null;
  const unchanged = {
    handled: false,
    open,
    activeIndex,
    selectIndex: null,
  } as const;

  if (key === "Escape") {
    return open
      ? {
          handled: true,
          open: false,
          activeIndex: null,
          selectIndex: null,
        }
      : unchanged;
  }

  if (optionCount === 0) return unchanged;

  if (key === "ArrowDown") {
    return {
      handled: true,
      open: true,
      activeIndex:
        activeIndex === null ? 0 : (activeIndex + 1) % optionCount,
      selectIndex: null,
    };
  }

  if (key === "ArrowUp") {
    return {
      handled: true,
      open: true,
      activeIndex:
        activeIndex === null
          ? optionCount - 1
          : (activeIndex - 1 + optionCount) % optionCount,
      selectIndex: null,
    };
  }

  if (!open) return unchanged;

  if (key === "Home" || key === "End") {
    return {
      handled: true,
      open: true,
      activeIndex: key === "Home" ? 0 : optionCount - 1,
      selectIndex: null,
    };
  }

  if (key === "Enter" && activeIndex !== null) {
    return {
      handled: true,
      open: false,
      activeIndex: null,
      selectIndex: activeIndex,
    };
  }

  return unchanged;
}
