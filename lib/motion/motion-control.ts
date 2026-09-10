export type Pass542MotionMode = "full" | "efficient" | "still";

export type Pass542MotionControl = {
  version: "motion-control";
  mode: Pass542MotionMode;
  ambientAllowed: boolean;
  functionalTransitionsAllowed: boolean;
  targetFps: 0 | 30 | 45 | 60;
  label: string;
  actionLabel: string;
  reason: string;
  boundary: string;
};

export function buildPass542MotionControl(
  locale: "pl" | "de" | "en",
  systemReducedMotion: boolean,
  frameState: "sampling" | "stable" | "constrained",
  manuallyPaused: boolean,
): Pass542MotionControl {
  const mode: Pass542MotionMode =
    systemReducedMotion || manuallyPaused
      ? "still"
      : frameState === "constrained" || frameState === "sampling"
        ? "efficient"
        : "full";
  const copy = {
    pl: {
      full: "Pełny ruch",
      efficient: "Ruch oszczędny",
      still: "Ruch zatrzymany",
      pause: "Zatrzymaj ambient motion",
      resume: "Wznów ambient motion",
      system: "Systemowe ustawienie ograniczania ruchu ma pierwszeństwo.",
      manual: "Ambient motion został zatrzymany ręcznie.",
      constrained: "Budżet klatek jest ograniczony, więc ruch został uproszczony.",
      stable: "Urządzenie utrzymuje stabilny budżet klatek.",
    },
    de: {
      full: "Volle Bewegung",
      efficient: "Effiziente Bewegung",
      still: "Bewegung pausiert",
      pause: "Ambient Motion pausieren",
      resume: "Ambient Motion fortsetzen",
      system: "Die systemweite Einstellung zur Bewegungsreduktion hat Vorrang.",
      manual: "Ambient Motion wurde manuell pausiert.",
      constrained: "Das Frame-Budget ist begrenzt, daher wurde die Bewegung reduziert.",
      stable: "Das Gerät hält ein stabiles Frame-Budget.",
    },
    en: {
      full: "Full motion",
      efficient: "Efficient motion",
      still: "Motion paused",
      pause: "Pause ambient motion",
      resume: "Resume ambient motion",
      system: "The system reduced-motion preference takes priority.",
      manual: "Ambient motion was paused manually.",
      constrained: "Frame budget is constrained, so motion has been simplified.",
      stable: "The device is sustaining a stable frame budget.",
    },
  } as const;
  const localized = copy[locale];
  const reason = systemReducedMotion
    ? localized.system
    : manuallyPaused
      ? localized.manual
      : frameState === "constrained" || frameState === "sampling"
        ? localized.constrained
        : localized.stable;

  return {
    version: "motion-control",
    mode,
    ambientAllowed: mode === "full",
    functionalTransitionsAllowed: !systemReducedMotion,
    targetFps: mode === "still" ? 0 : mode === "efficient" ? 30 : 60,
    label: localized[mode],
    actionLabel: manuallyPaused ? localized.resume : localized.pause,
    reason,
    boundary:
      "The control pauses non-essential ambient motion only. Functional state changes, focus visibility and keyboard navigation remain available.",
  };
}
