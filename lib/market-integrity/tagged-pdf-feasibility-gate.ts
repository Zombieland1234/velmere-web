export type Pass593TaggedPdfFeasibilityGate = {
  version: "tagged-pdf-feasibility-gate";
  state: "metadata_only" | "tagged_candidate" | "blocked";
  canClaimTaggedPdf: boolean;
  checks: {
    languageMetadata: boolean;
    titleMetadata: boolean;
    structTreeRoot: boolean;
    markInfo: boolean;
    roleMap: boolean;
    readingOrderProof: boolean;
    internalLinks: boolean;
  };
  missing: string[];
  boundary: string;
};

export function buildPass593TaggedPdfFeasibilityGate(input: {
  languageMetadata: boolean;
  titleMetadata: boolean;
  structTreeRoot: boolean;
  markInfo: boolean;
  roleMap: boolean;
  readingOrderProof: boolean;
  internalLinks: boolean;
}): Pass593TaggedPdfFeasibilityGate {
  const requiredForTaggedClaim = [
    ["StructTreeRoot", input.structTreeRoot],
    ["MarkInfo", input.markInfo],
    ["RoleMap", input.roleMap],
    ["reading_order_proof", input.readingOrderProof],
  ] as const;
  const missing = requiredForTaggedClaim
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const metadataReady = input.languageMetadata && input.titleMetadata;
  const canClaimTaggedPdf = metadataReady && missing.length === 0;

  return {
    version: "tagged-pdf-feasibility-gate",
    state: canClaimTaggedPdf
      ? "tagged_candidate"
      : metadataReady
        ? "metadata_only"
        : "blocked",
    canClaimTaggedPdf,
    checks: { ...input },
    missing,
    boundary: canClaimTaggedPdf
      ? "The binary contains the structural markers required for a tagged-PDF candidate, but formal PDF/UA conformance still requires specialist validation."
      : "The binary exposes selectable text plus title and language metadata only. Velmère does not describe it as a fully tagged or PDF/UA-conformant document.",
  };
}

export function inspectPass593PdfBuffer(
  value: Uint8Array | string,
): Pass593TaggedPdfFeasibilityGate {
  const source =
    typeof value === "string"
      ? value
      : new TextDecoder("latin1").decode(value);
  return buildPass593TaggedPdfFeasibilityGate({
    languageMetadata: /\/Lang\s*\(/.test(source),
    titleMetadata: /\/Title\s*\(/.test(source),
    structTreeRoot: /\/StructTreeRoot\b/.test(source),
    markInfo: /\/MarkInfo\s*<<[\s\S]*?\/Marked\s+true/.test(source),
    roleMap: /\/RoleMap\s*<</.test(source),
    readingOrderProof: /\/StructParents\b/.test(source),
    internalLinks: /\/Subtype\s*\/Link\b/.test(source),
  });
}
