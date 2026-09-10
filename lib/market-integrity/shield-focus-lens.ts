import type { Pass513ShieldVerificationQueue } from "./shield-verification-queue";
import type { Pass521ShieldEvidenceDrilldown } from "./shield-evidence-drilldown";
import type { Pass535ShieldAttachmentLinking } from "./shield-attachment-linking";

export type Pass541ShieldFocusLens = {
  version: "shield-focus-lens";
  state: "critical_focus" | "verification_focus" | "stable_focus" | "empty";
  activeLaneId: string | null;
  priorityRank: number | null;
  evidenceCompleteness: number;
  linkedAttachmentIds: string[];
  headline: string;
  explanation: string;
  primaryAction: string;
  boundary: string;
};

export function buildPass541ShieldFocusLens(
  locale: "pl" | "de" | "en",
  drilldown: Pass521ShieldEvidenceDrilldown,
  queue: Pass513ShieldVerificationQueue,
  linking: Pass535ShieldAttachmentLinking,
): Pass541ShieldFocusLens {
  if (!drilldown.activeId) {
    return {
      version: "shield-focus-lens",
      state: "empty",
      activeLaneId: null,
      priorityRank: null,
      evidenceCompleteness: 0,
      linkedAttachmentIds: [],
      headline:
        locale === "pl"
          ? "Brak aktywnej osi do zbadania"
          : locale === "de"
            ? "Keine aktive Achse zur Prüfung"
            : "No active lane is available for investigation",
      explanation: drilldown.whatIsMissing,
      primaryAction: drilldown.nextVerification,
      boundary: drilldown.boundary,
    };
  }

  const queueItem = queue.items.find((item) => item.id === drilldown.activeId);
  const laneAttachments = linking.attachments.filter(
    (attachment) => attachment.laneId === drilldown.activeId,
  );
  const linked = laneAttachments.filter(
    (attachment) => attachment.linkState === "linked",
  );
  const evidenceCompleteness = Math.round(
    (linked.length / Math.max(laneAttachments.length, 1)) * 100,
  );
  const state: Pass541ShieldFocusLens["state"] =
    drilldown.evidenceState === "conflict" || queueItem?.state === "critical"
      ? "critical_focus"
      : drilldown.evidenceState === "missing" ||
          drilldown.evidenceState === "limited" ||
          evidenceCompleteness < 100
        ? "verification_focus"
        : "stable_focus";
  const copy = {
    pl: {
      critical_focus: "Najpierw rozwiąż konflikt w aktywnej osi",
      verification_focus: "Aktywna oś wymaga uzupełnienia dowodów",
      stable_focus: "Aktywna oś jest wsparta, obserwuj zmiany",
      why: "Shield łączy priorytet kolejki, stan dowodów i linkowanie kapsuł.",
    },
    de: {
      critical_focus: "Zuerst den Konflikt der aktiven Achse lösen",
      verification_focus: "Die aktive Achse benötigt zusätzliche Evidenz",
      stable_focus: "Die aktive Achse ist gestützt; Änderungen beobachten",
      why: "Shield verbindet Warteschlangenpriorität, Evidenzstatus und Kapselverknüpfung.",
    },
    en: {
      critical_focus: "Resolve the conflict in the active lane first",
      verification_focus: "The active lane requires additional evidence",
      stable_focus: "The active lane is supported; monitor for changes",
      why: "Shield combines queue priority, evidence state and capsule linkage.",
    },
  } as const;

  return {
    version: "shield-focus-lens",
    state,
    activeLaneId: drilldown.activeId,
    priorityRank: queueItem?.rank ?? null,
    evidenceCompleteness,
    linkedAttachmentIds: linked.map((attachment) => attachment.attachmentId),
    headline: copy[locale][state],
    explanation: `${copy[locale].why} ${drilldown.whyItMatters}`,
    primaryAction: queueItem?.action || drilldown.nextVerification,
    boundary:
      "Focus Lens prioritizes evidence work only. It does not rank assets, predict price, or replace source review.",
  };
}
