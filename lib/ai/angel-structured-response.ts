import type { AngelEvidenceGuide, AngelLocale, AngelDepth } from "./angel-evidence-context";

export type AngelStructuredConfidence = "NOT_CALIBRATED" | "EVIDENCE_BOUNDED" | "WITHHELD";
export type AngelStructuredSeverity = "informational" | "watch" | "high" | "critical" | "unknown";

export type AngelStructuredResponse = {
  schemaVersion: "velmere.angel.structured-response.v1";
  productId: "angel";
  productClass: "STANDALONE_PRODUCT";
  reportContextDepth: AngelDepth;
  truthInvariantAcrossReportDepth: true;
  scope: string[];
  severity: AngelStructuredSeverity;
  confidence: {
    state: AngelStructuredConfidence;
    capPercent: number | null;
    probabilityClaimAllowed: false;
  };
  evidence: {
    verifiedAuthority: boolean;
    providers: string[];
    confirmedLanes: string[];
    limitedLanes: string[];
  };
  assumptions: string[];
  contradictions: string[];
  missingProof: string[];
  limitations: string[];
  safeRemediation: string[];
  nextSafeCheck: string[];
  abstention: {
    required: boolean;
    reasons: string[];
  };
  safety: {
    personalizedInvestmentAdvice: false;
    leverageGuidance: false;
    positionSizingGuidance: false;
    guaranteedOutcome: false;
    hiddenPromptDisclosure: false;
    privateArtifactDisclosure: false;
  };
};

const COPY: Record<AngelLocale, {
  noAuthority: string;
  noProbability: string;
  missingEvidence: string;
  verifySource: string;
  resolveConflict: string;
}> = {
  pl: {
    noAuthority: "Brak zweryfikowanej, serwerowo podpisanej authority dla wniosku.",
    noProbability: "Wynik nie jest skalibrowanym prawdopodobieństwem ani poradą inwestycyjną.",
    missingEvidence: "Brakujące dowody ograniczają werdykt; Angel powinien wstrzymać silną odpowiedź.",
    verifySource: "Zweryfikuj brakującą lane w źródle pierwotnym i zachowaj receipt.",
    resolveConflict: "Rozwiąż konflikt źródeł przed podniesieniem pewności.",
  },
  en: {
    noAuthority: "No verified server-signed authority supports a strong conclusion.",
    noProbability: "The output is not a calibrated probability or personalized investment advice.",
    missingEvidence: "Missing proof limits the verdict; Angel must abstain from a strong answer.",
    verifySource: "Verify the missing lane against a primary source and retain its receipt.",
    resolveConflict: "Resolve source conflicts before increasing confidence.",
  },
  de: {
    noAuthority: "Für eine starke Schlussfolgerung fehlt eine verifizierte serverseitig signierte Authority.",
    noProbability: "Das Ergebnis ist keine kalibrierte Wahrscheinlichkeit und keine persönliche Anlageberatung.",
    missingEvidence: "Fehlende Nachweise begrenzen das Urteil; Angel muss starke Aussagen zurückhalten.",
    verifySource: "Die fehlende Lane an einer Primärquelle prüfen und den Receipt aufbewahren.",
    resolveConflict: "Quellenkonflikte vor einer höheren Konfidenz auflösen.",
  },
};

function cleanList(values: readonly unknown[], maximum = 180): string[] {
  return Array.from(new Set(values
    .map((value) => typeof value === "string" ? value.replace(/[<>\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : "")
    .filter(Boolean)));
}

function severityFromGuide(guide: AngelEvidenceGuide): AngelStructuredSeverity {
  const score = guide.sourceState.riskScore;
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "watch";
  return "informational";
}

export function buildAngelStructuredResponse(args: {
  locale: AngelLocale;
  reportContextDepth: AngelDepth;
  guide: AngelEvidenceGuide;
  reply: string;
}): AngelStructuredResponse {
  const copy = COPY[args.locale];
  const missingProof = cleanList([...args.guide.lanes.missing, ...args.guide.lanes.locked]);
  const contradictions = cleanList(args.guide.lanes.conflicts);
  const providers = cleanList(args.guide.sourceState.providers, 120);
  const verifiedAuthority = args.guide.authority.verified === true;
  // The guide may carry a source/evidence ceiling, but it does not carry a
  // calibration authority. Keep that number out of customer confidence fields.
  const abstentionReasons = [
    ...(!verifiedAuthority ? [copy.noAuthority] : []),
    ...(missingProof.length > 0 ? [copy.missingEvidence] : []),
    ...(contradictions.length > 0 ? [copy.resolveConflict] : []),
  ];
  const limitations = cleanList([
    copy.noProbability,
    ...(!verifiedAuthority ? [copy.noAuthority] : []),
    ...missingProof.map((lane) => `missing:${lane}`),
    ...contradictions.map((lane) => `conflict:${lane}`),
  ], 280);
  const safeRemediation = cleanList([
    ...(missingProof.length > 0 ? [copy.verifySource] : []),
    ...(contradictions.length > 0 ? [copy.resolveConflict] : []),
  ], 280);
  const nextSafeCheck = cleanList([
    ...(args.guide.lanes.missing.length > 0 ? args.guide.lanes.missing.map((lane) => `verify:${lane}`) : []),
    ...(args.guide.lanes.conflicts.length > 0 ? args.guide.lanes.conflicts.map((lane) => `reconcile:${lane}`) : []),
  ], 220).slice(0, args.reportContextDepth === "basic" ? 3 : args.reportContextDepth === "pro" ? 8 : 20);
  const confidenceState: AngelStructuredConfidence = !verifiedAuthority
    ? "WITHHELD"
    : missingProof.length > 0 || contradictions.length > 0
      ? "EVIDENCE_BOUNDED"
      : "NOT_CALIBRATED";
  return {
    schemaVersion: "velmere.angel.structured-response.v1",
    productId: "angel",
    productClass: "STANDALONE_PRODUCT",
    reportContextDepth: args.reportContextDepth,
    truthInvariantAcrossReportDepth: true,
    scope: cleanList([args.guide.runtimeLane, ...args.guide.mentionedAssets], 80),
    severity: severityFromGuide(args.guide),
    confidence: {
      state: confidenceState,
      capPercent: null,
      probabilityClaimAllowed: false,
    },
    evidence: {
      verifiedAuthority,
      providers,
      confirmedLanes: cleanList(args.guide.lanes.confirmed, 120),
      limitedLanes: cleanList(args.guide.lanes.limited, 120),
    },
    assumptions: [],
    contradictions,
    missingProof,
    limitations,
    safeRemediation,
    nextSafeCheck,
    abstention: {
      required: abstentionReasons.length > 0,
      reasons: cleanList(abstentionReasons, 280),
    },
    safety: {
      personalizedInvestmentAdvice: false,
      leverageGuidance: false,
      positionSizingGuidance: false,
      guaranteedOutcome: false,
      hiddenPromptDisclosure: false,
      privateArtifactDisclosure: false,
    },
  };
}

export function verifyAngelStructuredResponse(value: AngelStructuredResponse): boolean {
  return value.schemaVersion === "velmere.angel.structured-response.v1"
    && value.productId === "angel"
    && value.productClass === "STANDALONE_PRODUCT"
    && value.truthInvariantAcrossReportDepth === true
    && value.confidence.probabilityClaimAllowed === false
    && Object.values(value.safety).every((allowed) => allowed === false)
    && Array.isArray(value.missingProof)
    && Array.isArray(value.nextSafeCheck);
}
