import { sha256Token } from "../security/cryptographic-digest";
import type { Pass528ShieldEvidencePacket } from "./shield-evidence-packet";

export type Pass535LinkedAttachment =
  Pass528ShieldEvidencePacket["attachments"][number] & {
    attachmentId: string;
    sourceId: string;
    sourceLabel: string;
    observedAt: number | null;
    linkState: "linked" | "partial" | "unlinked";
  };

export type Pass535ShieldAttachmentLinking = {
  version: "shield-attachment-linking";
  attachments: Pass535LinkedAttachment[];
  linkedCount: number;
  timestampedCount: number;
  state: "linked" | "partial" | "unlinked";
  boundary: string;
};

function stableId(value: string) {
  return sha256Token(value, 16);
}

export function buildPass535ShieldAttachmentLinking(
  packet: Pass528ShieldEvidencePacket,
  sourceLabel: string | null | undefined,
  sourceTimestamp: number | null | undefined,
): Pass535ShieldAttachmentLinking {
  const cleanSource = sourceLabel?.trim() || "";
  const observedAt =
    Number.isFinite(sourceTimestamp) && Number(sourceTimestamp) > 0
      ? Number(sourceTimestamp) > 10_000_000_000
        ? Math.round(Number(sourceTimestamp) / 1000)
        : Math.round(Number(sourceTimestamp))
      : null;
  const sourceId = cleanSource
    ? `src-${stableId(cleanSource)}`
    : "source-unlinked";
  const attachments = packet.attachments.map((attachment) => {
    const linkState: Pass535LinkedAttachment["linkState"] =
      cleanSource && observedAt
        ? "linked"
        : cleanSource || observedAt
          ? "partial"
          : "unlinked";
    return {
      ...attachment,
      attachmentId: `att-${stableId(`${attachment.id}:${sourceId}:${observedAt ?? "unknown"}`)}`,
      sourceId,
      sourceLabel: cleanSource || "source not identified",
      observedAt,
      linkState,
    };
  });
  const linkedCount = attachments.filter(
    (attachment) => attachment.linkState === "linked",
  ).length;
  const timestampedCount = attachments.filter(
    (attachment) => attachment.observedAt !== null,
  ).length;
  const state: Pass535ShieldAttachmentLinking["state"] =
    attachments.length && linkedCount === attachments.length
      ? "linked"
      : attachments.some((attachment) => attachment.linkState !== "unlinked")
        ? "partial"
        : "unlinked";
  return {
    version: "shield-attachment-linking",
    attachments,
    linkedCount,
    timestampedCount,
    state,
    boundary:
      "Attachment IDs bind visible Shield capsules to the supplied source label and timestamp. Missing source metadata stays explicitly unlinked.",
  };
}
