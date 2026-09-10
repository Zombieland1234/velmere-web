import type { Pass611PdfAccessibilityPhase2 } from "./pdf-accessibility-phase-2";

export type Pass642ExternalValidatorReceipt = {
  validator: "veraPDF" | "PAC" | "other";
  validatorVersion: string;
  profile: "PDF/UA-1" | "PDF/UA-2" | "custom";
  executedAt: string;
  passed: boolean;
  machineCheckFailures: number;
  reportSha256: string | null;
  humanReview: "not_run" | "review" | "passed" | "failed";
  notes: string[];
};

export type Pass642PdfUaExternalValidationLane = {
  version: "pdfua-external-validation-lane";
  state:
    | "structural_ready"
    | "machine_pass_human_review"
    | "validated"
    | "blocked";
  structuralChecks: Array<{
    id: string;
    passed: boolean;
    evidence: string;
  }>;
  externalReceipt: Pass642ExternalValidatorReceipt | null;
  externalValidationRequired: true;
  complianceClaim: "PDF/UA-1" | "PDF/UA-2" | null;
  nextAction: string;
  boundary: string;
};

function safeIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

export function buildPass642PdfUaExternalValidationLane(input: {
  accessibility: Pass611PdfAccessibilityPhase2;
  externalReceipt?: Pass642ExternalValidatorReceipt | null;
}): Pass642PdfUaExternalValidationLane {
  const accessibility = input.accessibility;
  const structuralChecks = [
    {
      id: "document-language",
      passed: Boolean(accessibility.documentLanguage),
      evidence: accessibility.documentLanguage,
    },
    {
      id: "heading-outline",
      passed:
        accessibility.reader.headingOutline.some((heading) => heading.level === 1) &&
        accessibility.reader.headingOutline.some((heading) => heading.level === 2),
      evidence: `${accessibility.reader.headingOutline.length} semantic headings`,
    },
    {
      id: "reading-order",
      passed: accessibility.reader.readingOrder.length === accessibility.pdf.pageSections,
      evidence: accessibility.reader.readingOrder.join(" > "),
    },
    {
      id: "chart-alternative",
      passed: accessibility.reader.chartAlternative.trim().length >= 24,
      evidence: accessibility.reader.chartAlternative.slice(0, 160),
    },
    {
      id: "struct-tree-root",
      passed: accessibility.pdf.structTreeRootPrepared && accessibility.pdf.markedContent,
      evidence: "StructTreeRoot prepared and marked content enabled",
    },
    {
      id: "metadata",
      passed: accessibility.pdf.titleMetadata && accessibility.pdf.languageMetadata,
      evidence: "title and language metadata prepared",
    },
    {
      id: "no-unproven-claim",
      passed: accessibility.pdf.pdfUaClaim === false,
      evidence: "PDF/UA claim remains disabled until external validation and manual QA pass",
    },
  ];
  const structuralReady = structuralChecks.every((check) => check.passed);
  const receipt = input.externalReceipt
    ? {
        ...input.externalReceipt,
        executedAt: safeIso(input.externalReceipt.executedAt),
        validatorVersion: input.externalReceipt.validatorVersion.trim().slice(0, 80),
        reportSha256: input.externalReceipt.reportSha256?.trim().toLowerCase() || null,
        notes: input.externalReceipt.notes.map((note) => note.trim().slice(0, 240)),
      }
    : null;

  const machinePass = Boolean(
    receipt?.passed && receipt.machineCheckFailures === 0,
  );
  const validated = Boolean(
    structuralReady &&
      machinePass &&
      receipt?.humanReview === "passed" &&
      (receipt.profile === "PDF/UA-1" || receipt.profile === "PDF/UA-2"),
  );
  const state: Pass642PdfUaExternalValidationLane["state"] = !structuralReady ||
    receipt?.humanReview === "failed" ||
    Boolean(receipt && (!receipt.passed || receipt.machineCheckFailures > 0))
    ? "blocked"
    : validated
      ? "validated"
      : machinePass
        ? "machine_pass_human_review"
        : "structural_ready";

  return {
    version: "pdfua-external-validation-lane",
    state,
    structuralChecks,
    externalReceipt: receipt,
    externalValidationRequired: true,
    complianceClaim: validated
      ? (receipt?.profile as "PDF/UA-1" | "PDF/UA-2")
      : null,
    nextAction:
      state === "validated"
        ? "Archive the validator report, human-review receipt and PDF hash with the release capsule."
        : state === "machine_pass_human_review"
          ? "Complete manual reading-order, alternative-text and table-semantics review before making any PDF/UA claim."
          : state === "blocked"
            ? "Fix failed structural or external validation checks and rerun the same PDF binary."
            : "Run veraPDF or PAC against the exact downloaded PDF, then complete the human checkpoints that machine validation cannot prove.",
    boundary:
      "Velmère never infers PDF/UA conformance from internal structure alone. A claim is enabled only for the exact hashed binary after machine validation and explicit manual QA.",
  };
}
