import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2820PdfRenderStatus = "render_ready" | "redacted_ready" | "skeleton_required" | "blocked";
export type Pass2820ReleaseStatus = "pass" | "warn" | "block";

type Locale = "pl" | "en" | "de";

type Pass2820PageInput = {
  page: number;
  title: string;
  requiredForTier: VelmereTier;
  status: "prepared" | "requires_live_receipts" | "requires_human_review" | string;
};

export type Pass2820PdfRenderPageDecision = {
  page: number;
  title: string;
  requiredForTier: VelmereTier;
  inputStatus: string;
  renderDecision: "render" | "redact_paid_evidence" | "render_skeleton" | "operator_review_required";
  reason: string;
};

export type Pass2820PdfRenderCleanroomGate = {
  schemaVersion: "pass2820_pdf_render_cleanroom_gate_v1";
  surface: string;
  locale: Locale;
  tier: VelmereTier;
  status: Pass2820PdfRenderStatus;
  blockedReasons: string[];
  localePurity: {
    selectedLocale: Locale;
    allowedLocales: Locale[];
    rule: string;
    forbiddenMixedLocaleCopy: string[];
  };
  debugRedaction: {
    forbiddenTokens: string[];
    fixtureLabelRequired: boolean;
    rule: string;
  };
  paidEvidenceRedaction: {
    paidEvidenceAllowed: boolean;
    sourceReceiptBundleAllowed: boolean;
    rawEndpointDisclosureAllowed: boolean;
    watermarkRequired: boolean;
    rule: string;
  };
  chartRenderBoundary: {
    sourceChartAccepted: boolean;
    skeletonRequired: boolean;
    rule: string;
  };
  pageDecisions: Pass2820PdfRenderPageDecision[];
  releaseGate: {
    status: Pass2820ReleaseStatus;
    reason: string;
  };
  rendererRules: string[];
};

export const PASS2820_PDF_RENDER_CLEANROOM_ACCEPTANCE_GATES = [
  "PDF render cleanroom must use one locale only; mixed PL/EN/DE copy blocks release.",
  "Debug/dev copy such as KERNEL, density cap, TODO, stack traces or raw fixture labels cannot appear in customer PDFs.",
  "Fixture/prepared data may render only with a visible fixture/prepared label and cannot look like live source proof.",
  "Basic PDFs must redact paid source receipt bundles, raw endpoint details and human-review notes.",
  "Pro/Advanced evidence pages require server receipt, account binding, one-time report token and payload-hash parity before rendering unredacted.",
  "Charts in PDFs must obey lifecycle receipts: source_bound charts render; missing/stale/degraded charts render neutral skeleton boxes.",
  "PDF, UI preview and account delivery must show the same report ID, payload hash, source receipt root and render-cleanroom decision.",
] as const;

function pageDecisionFor(page: Pass2820PageInput, args: { tier: VelmereTier; paidEvidenceAllowed: boolean }): Pass2820PdfRenderPageDecision {
  const paidPage = page.requiredForTier === "Pro" || page.requiredForTier === "Advanced";
  if (page.status === "requires_human_review") {
    return {
      page: page.page,
      title: page.title,
      requiredForTier: page.requiredForTier,
      inputStatus: page.status,
      renderDecision: args.tier === "Advanced" && args.paidEvidenceAllowed ? "operator_review_required" : "redact_paid_evidence",
      reason: "Human-review notes are operator/private evidence and cannot render as customer proof until Advanced entitlement and review receipt exist.",
    };
  }
  if (paidPage && !args.paidEvidenceAllowed) {
    return {
      page: page.page,
      title: page.title,
      requiredForTier: page.requiredForTier,
      inputStatus: page.status,
      renderDecision: "redact_paid_evidence",
      reason: "Paid evidence page is present in the manifest but redacted until server receipt, account binding, one-time token and payload hash pass.",
    };
  }
  if (page.status === "requires_live_receipts") {
    return {
      page: page.page,
      title: page.title,
      requiredForTier: page.requiredForTier,
      inputStatus: page.status,
      renderDecision: "render_skeleton",
      reason: "Live receipts are required before this page can show source-bound proof; render skeleton/receipt-pending state instead of fake content.",
    };
  }
  return {
    page: page.page,
    title: page.title,
    requiredForTier: page.requiredForTier,
    inputStatus: page.status,
    renderDecision: "render",
    reason: "Prepared customer-safe page can render with locale-pure copy and no paid/source overclaim.",
  };
}

export function buildPass2820PdfRenderCleanroomGate(args: {
  surface: string;
  locale: Locale;
  tier: VelmereTier;
  paidEvidenceAllowed: boolean;
  sourceChartAccepted: boolean;
  pages: Pass2820PageInput[];
  containsDebugCopy?: boolean;
  mixedLocaleDetected?: boolean;
  fixtureLabelPresent?: boolean;
}): Pass2820PdfRenderCleanroomGate {
  const pageDecisions = args.pages.map((page) => pageDecisionFor(page, args));
  const blockedReasons = [
    args.mixedLocaleDetected ? "mixed locale copy detected" : null,
    args.containsDebugCopy ? "debug/developer copy detected" : null,
    !args.fixtureLabelPresent && pageDecisions.some((page) => page.renderDecision === "render_skeleton") ? "skeleton/prepared pages need visible fixture/prepared label" : null,
  ].filter(Boolean) as string[];
  const hasRedaction = pageDecisions.some((page) => page.renderDecision === "redact_paid_evidence");
  const skeletonRequired = !args.sourceChartAccepted || pageDecisions.some((page) => page.renderDecision === "render_skeleton");
  const status: Pass2820PdfRenderStatus = blockedReasons.length
    ? "blocked"
    : hasRedaction
      ? "redacted_ready"
      : skeletonRequired
        ? "skeleton_required"
        : "render_ready";
  const releaseStatus: Pass2820ReleaseStatus = status === "blocked" ? "block" : status === "render_ready" ? "pass" : "warn";

  return {
    schemaVersion: "pass2820_pdf_render_cleanroom_gate_v1",
    surface: args.surface,
    locale: args.locale,
    tier: args.tier,
    status,
    blockedReasons,
    localePurity: {
      selectedLocale: args.locale,
      allowedLocales: ["pl", "en", "de"],
      rule: "The PDF renderer receives exactly one locale and must never mix PL/EN/DE strings inside a customer report.",
      forbiddenMixedLocaleCopy: ["Wykres / Chart mixed label", "Quelle / Source mixed label", "Ryzyko / Risk mixed label"],
    },
    debugRedaction: {
      forbiddenTokens: ["KERNEL", "density cap", "TODO", "console.log", "stack trace", "undefined", "[object Object]"],
      fixtureLabelRequired: true,
      rule: "Developer/debug strings and unlabelled fixtures are stripped or block release before PDF render.",
    },
    paidEvidenceRedaction: {
      paidEvidenceAllowed: args.paidEvidenceAllowed,
      sourceReceiptBundleAllowed: args.paidEvidenceAllowed && args.tier !== "Basic",
      rawEndpointDisclosureAllowed: args.paidEvidenceAllowed && args.tier === "Advanced",
      watermarkRequired: args.tier === "Basic" || !args.paidEvidenceAllowed,
      rule: "Paid evidence is redacted until entitlement gates pass; Basic remains public pre-screen/watermarked evidence, not full receipt bundle.",
    },
    chartRenderBoundary: {
      sourceChartAccepted: args.sourceChartAccepted,
      skeletonRequired: !args.sourceChartAccepted,
      rule: "PDF chart visuals follow the same chart lifecycle receipt as UI: no source_bound receipt means neutral skeleton/unavailable box.",
    },
    pageDecisions,
    releaseGate: {
      status: releaseStatus,
      reason: releaseStatus === "block"
        ? blockedReasons.join("; ")
        : releaseStatus === "pass"
          ? "PDF cleanroom can render unredacted source-bound report for the requested tier."
          : "PDF can render only with redactions/skeletons and visible missing-evidence labels.",
    },
    rendererRules: [
      "Render cover and executive summary from the same payload hash used by UI preview and account delivery.",
      "Do not render raw provider bodies, stack traces, API secrets or unmoderated community text in customer PDFs.",
      "Use neutral skeleton boxes for missing charts rather than decorative fake sparklines.",
      "Show redaction labels where paid/human-review evidence is locked; never silently omit a locked evidence lane.",
    ],
  };
}
