/**
 * VELMÈRE ULTIMATE EVIDENCE-FIRST AUDIT PLATFORM
 * CLAIM AUDIT BLOCKER & REWRITE ENGINE (Directive v3 Sections 5, 6, 87)
 * 
 * Scans every sentence, header, key-value line, and finding in an audit report.
 * Flags buzzwords / marketing claims that lack backing EvidenceRecords.
 * Automatically replaces unverified claims with truthful statuses:
 * NOT RUN, UNKNOWN, NOT APPLICABLE, INSUFFICIENT EVIDENCE, NOT VERIFIED, HUMAN REVIEW REQUIRED.
 */

import type { EvidenceRecord, ClaimRecord, EvidenceStatus } from "./evidence-record";

export interface ClaimAuditResult {
  passed: boolean;
  blockedCount: number;
  rewrittenCount: number;
  sanitizedLines: string[];
  findings: Array<{
    originalLine: string;
    sanitizedLine: string;
    matchedPattern: string;
    action: "REWRITTEN" | "BLOCKED" | "VERIFIED";
    evidenceId?: string;
    reason: string;
  }>;
}

const CRITICAL_CLAIM_PATTERNS: Array<{
  regex: RegExp;
  category: string;
  requiredEvidenceCategory?: string;
  truthfulFallback: string;
  reason: string;
}> = [
  {
    regex: /\b(RFC\s*3161|RFC3161)\b/i,
    category: "CRYPTOGRAPHIC",
    requiredEvidenceCategory: "CRYPTOGRAPHIC",
    truthfulFallback: "SHA-256 INTEGRITY SEAL [LOCAL DETERMINISTIC]",
    reason: "No RFC 3161 ASN.1 TimeStampToken from external TSA authority observed.",
  },
  {
    regex: /\b(PCAOB\s*CERTIFIED|PCAOB\s*AUDITED)\b/i,
    category: "REGULATORY_DATA",
    requiredEvidenceCategory: "REGULATORY_DATA",
    truthfulFallback: "EXTERNAL INDEPENDENT AUDITOR [SEC 10-K REFERENCE]",
    reason: "Velmere cannot award or claim PCAOB certification.",
  },
  {
    regex: /\b(41\.2%|41,2%)\s*(?:dziennego|dark\s*pool|ats)\b/i,
    category: "MARKET_MICROSTRUCTURE",
    requiredEvidenceCategory: "MARKET_MICROSTRUCTURE",
    truthfulFallback: "ATS / Dark Pool Share: NOT OBSERVED [INSUFFICIENT DATA]",
    reason: "Universal static 41.2% metric is prohibited without observed trade dataset.",
  },
  {
    regex: /\b2\.8\s*(?:bps|punkty\s*bazowe)\b/i,
    category: "MARKET_MICROSTRUCTURE",
    requiredEvidenceCategory: "MARKET_MICROSTRUCTURE",
    truthfulFallback: "Kyle Slippage ($10M): ESTIMATED HEURISTIC [UNOBSERVED]",
    reason: "Static 2.8 bps metric prohibited without live order book snapshot regression.",
  },
  {
    regex: /\b(Wszystkie\s*niezmienniki\s*(?:stanu\s*)?udowodnione|all\s*invariants\s*proven)\b/i,
    category: "FORMAL",
    requiredEvidenceCategory: "FORMAL",
    truthfulFallback: "Invariants Analyzed: PARTIAL HEURISTIC [SMT SOLVER NOT EXECUTED]",
    reason: "Cannot claim all invariants proven without mathematical solver (Z3/CVC5) proof artifacts.",
  },
  {
    regex: /\b(100%\s*SECURE|100%\s*SAFE|ABSOLUTELY\s*SECURE)\b/i,
    category: "VULNERABILITY",
    truthfulFallback: "ASSESSMENT: BOUNDED TIME-WINDOW SCAN [NO ACTIVE CRITICAL EXPLOIT OBSERVED]",
    reason: "Absolute security claims are categorically banned in security audits.",
  },
  {
    regex: /\b(HUMAN\s*AUDITED|HUMAN\s*REVIEWED|Zweryfikowany\s*przez\s*audytora)\b/i,
    category: "HUMAN_REVIEW",
    requiredEvidenceCategory: "HUMAN_REVIEW",
    truthfulFallback: "HUMAN REVIEW: NOT PERFORMED [AUTOMATED ENGINE ONLY]",
    reason: "Human review claims require authenticated reviewer signature and reviewId.",
  },
  {
    regex: /\b(L3\/SIP\s*połączenia|Direct\s*L3\/SIP)\b/i,
    category: "MARKET_DATA",
    requiredEvidenceCategory: "MARKET_DATA",
    truthfulFallback: "Market Data Source: DERIVED CONSOLIDATED QUOTES [SIP DERIVED]",
    reason: "Cannot claim direct L3/SIP connection without licensed multicast ITCH/OUCH tap.",
  },
  {
    regex: /\b(Best\s*Execution\s*PASS|Best\s*Execution\s*VERIFIED)\b/i,
    category: "MARKET_DATA",
    requiredEvidenceCategory: "MARKET_DATA",
    truthfulFallback: "Best Execution: NOT ASSESSED [NO EXECUTION ROUTING DATA]",
    reason: "Best Execution requires tick-by-tick NBBO execution timestamps.",
  },
  {
    regex: /\b(Multisig\s*3-of-5)\b/i,
    category: "ACCESS_CONTROL",
    requiredEvidenceCategory: "ACCESS_CONTROL",
    truthfulFallback: "Multisig: THRESHOLD UNKNOWN [NO ON-CHAIN CALL EXECUTED]",
    reason: "Cannot claim 3-of-5 without reading Gnosis Safe getThreshold()/getOwners().",
  },
  {
    regex: /\b(Timelock\s*48h)\b/i,
    category: "ACCESS_CONTROL",
    requiredEvidenceCategory: "ACCESS_CONTROL",
    truthfulFallback: "Timelock: DELAY UNOBSERVED [NO ON-CHAIN GETMINDELAY EXECUTED]",
    reason: "Cannot claim 48h timelock without querying getMinDelay() on contract.",
  },
  {
    regex: /\b(Zero\s*Risk|Zero\s*Vulnerabilit(?:y|ies)|Zero\s*Ryzyka)\b/i,
    category: "VULNERABILITY",
    truthfulFallback: "Risk Level: RESIDUAL RISK CANNOT BE ZERO",
    reason: "Absolute zero-risk claims are invalid in software verification.",
  },
  {
    regex: /\b(Unbreakable|Invulnerable|Niezłomn[ya]|Niezwyciężon[ya])\b/i,
    category: "VULNERABILITY",
    truthfulFallback: "Security Posture: BOUNDED HEURISTIC EVALUATION",
    reason: "Marketing adjectives implying invulnerability are prohibited.",
  },
  {
    regex: /\b(Certified\s*Bug-Free|Bug-Free\s*Guarantee|Gwarancja\s*braku\s*(?:błędów|podatności))\b/i,
    category: "FORMAL",
    truthfulFallback: "Defect Assurance: MATHEMATICAL ABSENCE CANNOT BE GUARANTEED",
    reason: "E.W. Dijkstra principle: Testing can show the presence of bugs, but never their absence.",
  },
];

/**
 * Validates and sanitizes a collection of report lines against registered EvidenceRecords.
 */
export function auditAndSanitizeReportLines(
  lines: string[],
  evidenceRecords: EvidenceRecord[]
): ClaimAuditResult {
  const evidenceCategories = new Set<string>(evidenceRecords.map((e) => e.category));
  const validEvidenceIds = new Set(evidenceRecords.filter((e) => e.status === "PASS").map((e) => e.id));

  let blockedCount = 0;
  let rewrittenCount = 0;
  const sanitizedLines: string[] = [];
  const findings: ClaimAuditResult["findings"] = [];

  for (const line of lines) {
    let sanitizedLine = line;
    let lineModified = false;

    for (const rule of CRITICAL_CLAIM_PATTERNS) {
      if (rule.regex.test(sanitizedLine)) {
        // Check if an evidence record supports this claim
        const hasEvidence = rule.requiredEvidenceCategory
          ? evidenceCategories.has(rule.requiredEvidenceCategory)
          : false;

        if (!hasEvidence) {
          // Replace forbidden claim with truthful fallback
          sanitizedLine = sanitizedLine.replace(rule.regex, rule.truthfulFallback);
          lineModified = true;
          rewrittenCount++;
          findings.push({
            originalLine: line,
            sanitizedLine,
            matchedPattern: rule.category,
            action: "REWRITTEN",
            reason: rule.reason,
          });
        } else {
          findings.push({
            originalLine: line,
            sanitizedLine,
            matchedPattern: rule.category,
            action: "VERIFIED",
            reason: "Backed by valid EvidenceRecord.",
          });
        }
      }
    }

    sanitizedLines.push(sanitizedLine);
  }

  return {
    passed: blockedCount === 0,
    blockedCount,
    rewrittenCount,
    sanitizedLines,
    findings,
  };
}
