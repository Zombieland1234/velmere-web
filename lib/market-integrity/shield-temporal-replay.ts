import type { Pass513ShieldVerificationQueue } from "./shield-verification-queue";
import type { Pass521ShieldEvidenceDrilldown } from "./shield-evidence-drilldown";
import type { Pass535ShieldAttachmentLinking } from "./shield-attachment-linking";

export type Pass548ReplayFrame = {
  id: string;
  index: number;
  phase: "observe" | "compare" | "verify" | "link";
  label: string;
  detail: string;
  state: "complete" | "active" | "pending";
};

export type Pass548ShieldTemporalReplay = {
  version: "shield-temporal-replay";
  state: "ready" | "incomplete" | "blocked";
  frames: Pass548ReplayFrame[];
  activeIndex: number;
  headline: string;
  boundary: string;
};

export function buildPass548ShieldTemporalReplay(
  locale: "pl" | "de" | "en",
  drilldown: Pass521ShieldEvidenceDrilldown,
  queue: Pass513ShieldVerificationQueue,
  linking: Pass535ShieldAttachmentLinking,
): Pass548ShieldTemporalReplay {
  const queueItem = queue.items.find((item) => item.id === drilldown.activeId) ?? queue.items[0] ?? null;
  const laneAttachments = linking.attachments.filter((attachment) => attachment.laneId === drilldown.activeId);
  const linked = laneAttachments.filter((attachment) => attachment.linkState === "linked").length;
  const frames: Pass548ReplayFrame[] = [
    {
      id: "observe",
      index: 0,
      phase: "observe",
      label: locale === "pl" ? "Obserwacja" : locale === "de" ? "Beobachtung" : "Observation",
      detail: drilldown.whatIsKnown,
      state: drilldown.activeId ? "complete" : "pending",
    },
    {
      id: "compare",
      index: 1,
      phase: "compare",
      label: locale === "pl" ? "Porównanie" : locale === "de" ? "Vergleich" : "Comparison",
      detail: drilldown.whatIsMissing,
      state: drilldown.evidenceState === "supported" ? "complete" : drilldown.activeId ? "active" : "pending",
    },
    {
      id: "verify",
      index: 2,
      phase: "verify",
      label: locale === "pl" ? "Weryfikacja" : locale === "de" ? "Verifikation" : "Verification",
      detail: queueItem?.action || drilldown.nextVerification,
      state: drilldown.evidenceState === "supported" ? "complete" : queueItem ? "active" : "pending",
    },
    {
      id: "link",
      index: 3,
      phase: "link",
      label: locale === "pl" ? "Powiązanie" : locale === "de" ? "Verknüpfung" : "Linkage",
      detail:
        locale === "pl"
          ? `${linked}/${laneAttachments.length} kapsuł ma pełne źródło i timestamp.`
          : locale === "de"
            ? `${linked}/${laneAttachments.length} Kapseln besitzen Quelle und Zeitstempel.`
            : `${linked}/${laneAttachments.length} capsules have a complete source and timestamp.`,
      state: laneAttachments.length > 0 && linked === laneAttachments.length ? "complete" : laneAttachments.length ? "active" : "pending",
    },
  ];
  const activeIndex = Math.max(0, frames.findIndex((frame) => frame.state === "active"));
  const state: Pass548ShieldTemporalReplay["state"] =
    !drilldown.activeId
      ? "blocked"
      : frames.every((frame) => frame.state === "complete")
        ? "ready"
        : "incomplete";
  return {
    version: "shield-temporal-replay",
    state,
    frames,
    activeIndex,
    headline:
      state === "ready"
        ? locale === "pl"
          ? "Ścieżka dowodowa aktywnej osi jest kompletna"
          : locale === "de"
            ? "Der Evidenzpfad der aktiven Achse ist vollständig"
            : "The active lane evidence path is complete"
        : state === "blocked"
          ? locale === "pl"
            ? "Brak aktywnej osi do odtworzenia"
            : locale === "de"
              ? "Keine aktive Achse zur Wiedergabe"
              : "No active lane is available for replay"
          : locale === "pl"
            ? "Replay pokazuje najbliższy brak w ścieżce dowodowej"
            : locale === "de"
              ? "Die Wiedergabe zeigt die nächste Lücke im Evidenzpfad"
              : "The replay shows the next gap in the evidence path",
    boundary:
      "Replay orders the current evidence states; it does not invent chronology where source timestamps are absent.",
  };
}
