/**
 * Velmère CVSS 4.0 Blast Radius & SWC/CWE Vulnerability Matrix (V2 Directive Section 43.6)
 * Maps common smart contract and distributed systems vulnerabilities to formal CVSS 4.0 vectors
 * and computes systemic blast radius across financial loss, state corruption, and contagion.
 */

export interface Cvss4BlastRadiusAssessment {
  vulnerabilityId: string;
  swcId?: string;
  cweId?: string;
  cvss4Vector: string;
  baseScore: number;
  severityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  blastRadius: {
    directFinancialLoss: "UNBOUNDED" | "TOTAL_POOL" | "LIMITED_ALLOWANCE" | "FEE_LEAKAGE" | "NONE";
    stateCorruption: "ARBITRARY_STORAGE_OVERWRITE" | "UNINTENDED_TRANSITION" | "READ_ONLY_DISRUPTION" | "NONE";
    protocolAvailability: "PERMANENT_FREEZE" | "TEMPORARY_HALT" | "DEGRADED" | "UNAFFECTED";
    composabilityContagion: "SYSTEMIC_DEX_LIQUIDATION" | "PRICE_FEED_TAINT" | "ISOLATED_TO_CALLER";
  };
  exploitComplexity: "LOW" | "MEDIUM" | "HIGH";
  privilegesRequired: "NONE" | "LOW" | "HIGH";
}

const SWC_CVSS4_MATRIX: Record<
  string,
  {
    cvss4Vector: string;
    score: number;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    blast: Cvss4BlastRadiusAssessment["blastRadius"];
  }
> = {
  // SWC-107: Reentrancy
  "SWC-107": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H",
    score: 9.8,
    severity: "CRITICAL",
    blast: {
      directFinancialLoss: "TOTAL_POOL",
      stateCorruption: "UNINTENDED_TRANSITION",
      protocolAvailability: "PERMANENT_FREEZE",
      composabilityContagion: "SYSTEMIC_DEX_LIQUIDATION",
    },
  },
  // SWC-105: Unprotected Ether/Token Withdrawal
  "SWC-105": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N",
    score: 9.2,
    severity: "CRITICAL",
    blast: {
      directFinancialLoss: "UNBOUNDED",
      stateCorruption: "UNINTENDED_TRANSITION",
      protocolAvailability: "UNAFFECTED",
      composabilityContagion: "ISOLATED_TO_CALLER",
    },
  },
  // SWC-106: Unprotected SELFDESTRUCT
  "SWC-106": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H",
    score: 9.5,
    severity: "CRITICAL",
    blast: {
      directFinancialLoss: "TOTAL_POOL",
      stateCorruption: "ARBITRARY_STORAGE_OVERWRITE",
      protocolAvailability: "PERMANENT_FREEZE",
      composabilityContagion: "PRICE_FEED_TAINT",
    },
  },
  // SWC-112: Delegatecall to Untrusted Callee
  "SWC-112": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:H/SI:H/SA:H",
    score: 10.0,
    severity: "CRITICAL",
    blast: {
      directFinancialLoss: "UNBOUNDED",
      stateCorruption: "ARBITRARY_STORAGE_OVERWRITE",
      protocolAvailability: "PERMANENT_FREEZE",
      composabilityContagion: "SYSTEMIC_DEX_LIQUIDATION",
    },
  },
  // SWC-115: Authorization through tx.origin
  "SWC-115": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:A/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N",
    score: 7.9,
    severity: "HIGH",
    blast: {
      directFinancialLoss: "LIMITED_ALLOWANCE",
      stateCorruption: "UNINTENDED_TRANSITION",
      protocolAvailability: "UNAFFECTED",
      composabilityContagion: "ISOLATED_TO_CALLER",
    },
  },
  // SWC-116: Block values as a proxy for time / randomness
  "SWC-116": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N",
    score: 5.3,
    severity: "MEDIUM",
    blast: {
      directFinancialLoss: "FEE_LEAKAGE",
      stateCorruption: "UNINTENDED_TRANSITION",
      protocolAvailability: "UNAFFECTED",
      composabilityContagion: "ISOLATED_TO_CALLER",
    },
  },
  // SWC-134: Message call with hardcoded gas amount
  "SWC-134": {
    cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N",
    score: 4.8,
    severity: "LOW",
    blast: {
      directFinancialLoss: "NONE",
      stateCorruption: "NONE",
      protocolAvailability: "DEGRADED",
      composabilityContagion: "ISOLATED_TO_CALLER",
    },
  },
};

export function assessCvss4BlastRadius(params: {
  findingId: string;
  swcId?: string;
  cweId?: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
}): Cvss4BlastRadiusAssessment {
  const { findingId, swcId, cweId, severity } = params;

  if (swcId && SWC_CVSS4_MATRIX[swcId]) {
    const entry = SWC_CVSS4_MATRIX[swcId];
    return {
      vulnerabilityId: findingId,
      swcId,
      cweId,
      cvss4Vector: entry.cvss4Vector,
      baseScore: entry.score,
      severityLevel: entry.severity,
      blastRadius: entry.blast,
      exploitComplexity: entry.score >= 9.0 ? "LOW" : "MEDIUM",
      privilegesRequired: "NONE",
    };
  }

  // Fallback calibrated mapping based on severity
  switch (severity) {
    case "critical":
      return {
        vulnerabilityId: findingId,
        swcId,
        cweId,
        cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
        baseScore: 9.3,
        severityLevel: "CRITICAL",
        blastRadius: {
          directFinancialLoss: "TOTAL_POOL",
          stateCorruption: "UNINTENDED_TRANSITION",
          protocolAvailability: "PERMANENT_FREEZE",
          composabilityContagion: "PRICE_FEED_TAINT",
        },
        exploitComplexity: "LOW",
        privilegesRequired: "NONE",
      };
    case "high":
      return {
        vulnerabilityId: findingId,
        swcId,
        cweId,
        cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:M/VA:N/SC:N/SI:N/SA:N",
        baseScore: 7.7,
        severityLevel: "HIGH",
        blastRadius: {
          directFinancialLoss: "LIMITED_ALLOWANCE",
          stateCorruption: "UNINTENDED_TRANSITION",
          protocolAvailability: "UNAFFECTED",
          composabilityContagion: "ISOLATED_TO_CALLER",
        },
        exploitComplexity: "MEDIUM",
        privilegesRequired: "LOW",
      };
    case "medium":
      return {
        vulnerabilityId: findingId,
        swcId,
        cweId,
        cvss4Vector: "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:M/VI:L/VA:N/SC:N/SI:N/SA:N",
        baseScore: 5.6,
        severityLevel: "MEDIUM",
        blastRadius: {
          directFinancialLoss: "FEE_LEAKAGE",
          stateCorruption: "NONE",
          protocolAvailability: "UNAFFECTED",
          composabilityContagion: "ISOLATED_TO_CALLER",
        },
        exploitComplexity: "HIGH",
        privilegesRequired: "NONE",
      };
    default:
      return {
        vulnerabilityId: findingId,
        swcId,
        cweId,
        cvss4Vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:L/SC:N/SI:N/SA:N",
        baseScore: 3.1,
        severityLevel: "LOW",
        blastRadius: {
          directFinancialLoss: "NONE",
          stateCorruption: "NONE",
          protocolAvailability: "DEGRADED",
          composabilityContagion: "ISOLATED_TO_CALLER",
        },
        exploitComplexity: "LOW",
        privilegesRequired: "NONE",
      };
  }
}
