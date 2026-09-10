import { sha256Token } from "../security/cryptographic-digest";
import type { Pass582SourceCitationRail } from "./source-citation-rail";

export type Pass594ClaimFootnote = {
  claimId: `C${string}`;
  fieldId: string;
  claimAnchor: `lens-claim-${string}`;
  sourceIds: Array<`S${string}`>;
  sourceAnchors: Array<`lens-source-${string}`>;
};

export type Pass594SourceReturn = {
  sourceId: `S${string}`;
  sourceAnchor: `lens-source-${string}`;
  claimIds: Array<`C${string}`>;
  claimAnchors: Array<`lens-claim-${string}`>;
};

export type Pass594BidirectionalSourceFootnotes = {
  version: "bidirectional-source-footnotes";
  claims: Pass594ClaimFootnote[];
  sources: Pass594SourceReturn[];
  linkedClaims: number;
  linkedSources: number;
  checksum: string;
  boundary: string;
};

function hash(value: string) {
  return sha256Token(value, 16);
}

export function buildPass594BidirectionalSourceFootnotes(input: {
  fields: readonly { id: string; state?: string }[];
  citationRail: Pass582SourceCitationRail;
}): Pass594BidirectionalSourceFootnotes {
  const available = input.citationRail.citations.filter(
    (citation) => citation.state !== "missing",
  );
  const fallback = input.citationRail.citations;
  const sourcePool = available.length ? available : fallback;

  const claims = input.fields.map((field, index) => {
    const number = String(index + 1).padStart(2, "0");
    const primary = sourcePool[index % Math.max(1, sourcePool.length)];
    const secondary =
      sourcePool.length > 1 && field.state === "review"
        ? sourcePool[(index + 1) % sourcePool.length]
        : undefined;
    const selected = [primary, secondary].filter(
      (citation, citationIndex, values): citation is NonNullable<typeof citation> =>
        Boolean(citation) &&
        values.findIndex((candidate) => candidate?.id === citation?.id) ===
          citationIndex,
    );

    return {
      claimId: `C${number}` as const,
      fieldId: field.id,
      claimAnchor: `lens-claim-${number}` as const,
      sourceIds: selected.map((citation) => citation.id),
      sourceAnchors: selected.map((citation) => citation.anchor),
    };
  });

  const sources = input.citationRail.citations.map((citation) => {
    const linked = claims.filter((claim) => claim.sourceIds.includes(citation.id));
    return {
      sourceId: citation.id,
      sourceAnchor: citation.anchor,
      claimIds: linked.map((claim) => claim.claimId),
      claimAnchors: linked.map((claim) => claim.claimAnchor),
    };
  });
  const canonical = [
    ...claims.map(
      (claim) => `${claim.claimId}:${claim.fieldId}:${claim.sourceIds.join(",")}`,
    ),
    ...sources.map(
      (source) => `${source.sourceId}:${source.claimIds.join(",")}`,
    ),
  ].join("|");

  return {
    version: "bidirectional-source-footnotes",
    claims,
    sources,
    linkedClaims: claims.filter((claim) => claim.sourceIds.length > 0).length,
    linkedSources: sources.filter((source) => source.claimIds.length > 0).length,
    checksum: `VLM-FOOTNOTE-${hash(canonical)}`,
    boundary:
      "Reader claims link to source anchors and source rows return to the linked claim. The PDF binary carries matching internal Link annotations without exposing operator diagnostics.",
  };
}
