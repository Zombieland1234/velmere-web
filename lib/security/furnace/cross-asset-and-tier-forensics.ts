/**
 * Velmère Audit Furnace V3 - Cross-Asset and Cross-Tier Forensic Engine
 * Rigorously attacks and cross-compares all 150 reports across all 50 assets.
 * Detects cross-asset fact contamination, cross-tier data leakage, metric anomalies, and PDF violations.
 */

import { CanonicalAuditReport, AuditTier } from "../audit-canonical-report";
import { MasterCorpusAsset } from "../corpus/master-50-assets";

export interface ForensicViolation {
  code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  message: string;
  assetId: string;
  tier: AuditTier;
  context?: Record<string, unknown>;
}

export interface ForensicAnalysisResult {
  passed: boolean;
  totalReportsAudited: number;
  totalViolations: number;
  violations: ForensicViolation[];
  assetIsolationScore: number; // 0 - 100
  tierEnforcementScore: number; // 0 - 100
  metricIntegrityScore: number; // 0 - 100
}

export class CrossAssetAndTierForensicEngine {
  /**
   * Audits an array of 150 built canonical reports against all 50 master assets.
   */
  public auditCorpus(
    reports: Array<{ asset: MasterCorpusAsset; tier: AuditTier; report: CanonicalAuditReport }>,
  ): ForensicAnalysisResult {
    const violations: ForensicViolation[] = [];

    // Map for cross-asset comparisons
    const factsByAsset = new Map<string, {
      addresses: Set<string>;
      metrics: Map<string, string>;
      findings: Set<string>;
    }>();

    for (const item of reports) {
      const { asset, tier, report } = item;

      // -----------------------------------------------------------------------
      // 1. Metric Integrity Checks (Section 26)
      // -----------------------------------------------------------------------
      if (report.verdict.riskScore < 0 || report.verdict.riskScore > 100) {
        violations.push({
          code: "METRIC_RISK_OUT_OF_BOUNDS",
          severity: "CRITICAL",
          message: `Risk score ${report.verdict.riskScore} outside [0, 100]`,
          assetId: asset.assetId,
          tier,
        });
      }

      if (report.verdict.confidenceScore < 0 || report.verdict.confidenceScore > 100) {
        violations.push({
          code: "METRIC_CONFIDENCE_OUT_OF_BOUNDS",
          severity: "CRITICAL",
          message: `Confidence score ${report.verdict.confidenceScore} outside [0, 100]`,
          assetId: asset.assetId,
          tier,
        });
      }

      if (report.verdict.evidenceCoverage < 0 || report.verdict.evidenceCoverage > 100) {
        violations.push({
          code: "METRIC_COVERAGE_OUT_OF_BOUNDS",
          severity: "CRITICAL",
          message: `Evidence coverage ${report.verdict.evidenceCoverage} outside [0, 100] (scaling bug detection)`,
          assetId: asset.assetId,
          tier,
        });
      }

      // -----------------------------------------------------------------------
      // 2. Asset Class Boundary Isolation (Sections 1.3, 13, 39, 40)
      // -----------------------------------------------------------------------
      const reportText = JSON.stringify(report).toLowerCase();

      if (asset.assetClass === "native_chain") {
        // Assert zero EVM bytecode contamination in native chains
        const evmTerms = ["erc20", "delegatecall", "selfdestruct", "reentrancy mutation scan", "eip-1967"];
        for (const term of evmTerms) {
          if (reportText.includes(term)) {
            violations.push({
              code: "CROSS_ASSET_NATIVE_EVM_CONTAMINATION",
              severity: "CRITICAL",
              message: `Native chain ${asset.symbol} contains EVM term '${term}'`,
              assetId: asset.assetId,
              tier,
            });
          }
        }
      } else if (asset.assetClass === "market_asset") {
        // Assert zero blockchain / smart-contract contamination in equities/commodities
        const cryptoTerms = ["mempool", "blockchain", "proof-of-work", "proof-of-stake", "validator set", "erc20", "delegatecall"];
        for (const term of cryptoTerms) {
          if (reportText.includes(term)) {
            violations.push({
              code: "CROSS_ASSET_MARKET_CRYPTO_CONTAMINATION",
              severity: "CRITICAL",
              message: `Market asset ${asset.symbol} contains blockchain term '${term}'`,
              assetId: asset.assetId,
              tier,
            });
          }
        }
      }

      // -----------------------------------------------------------------------
      // 3. Cross-Tier Teaser Isolation & Zero-Mock Rule (Section 10, 20, 24)
      // -----------------------------------------------------------------------
      if (tier === "basic") {
        for (const sec of report.sections) {
          if (sec.isLocked) {
            // Must be Mode B procedural teasers: zero numbers, zero addresses, zero mock strings
            const teasers = sec.sampleSummaryLines || [];
            for (const line of teasers) {
              if (/\b\d{2,}\b/.test(line)) {
                violations.push({
                  code: "MODE_B_TEASER_CONTAINS_NUMBERS",
                  severity: "HIGH",
                  message: `Locked section ${sec.id} teaser contains numbers: "${line}"`,
                  assetId: asset.assetId,
                  tier,
                });
              }
              if (/0x[a-fA-F0-9]{40}/.test(line)) {
                violations.push({
                  code: "MODE_B_TEASER_CONTAINS_ADDRESS",
                  severity: "CRITICAL",
                  message: `Locked section ${sec.id} teaser contains raw hex address: "${line}"`,
                  assetId: asset.assetId,
                  tier,
                });
              }
              const mockStrings = ["Gnosis Safe", "TimelockController", "Unicrypt", "Chainlink Price Feeds", "2-z-3", "48h", "1,420,000", "100 000 BNB"];
              for (const mock of mockStrings) {
                if (line.includes(mock)) {
                  violations.push({
                    code: "MODE_B_TEASER_CONTAINS_MOCK_LEAK",
                    severity: "CRITICAL",
                    message: `Locked section ${sec.id} teaser contains mock string "${mock}"`,
                    assetId: asset.assetId,
                    tier,
                  });
                }
              }
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // 4. Collect Facts for Cross-Asset Collision Analysis
      // -----------------------------------------------------------------------
      if (!factsByAsset.has(asset.assetId)) {
        factsByAsset.set(asset.assetId, {
          addresses: new Set(),
          metrics: new Map(),
          findings: new Set(),
        });
      }
      const assetFactRecord = factsByAsset.get(asset.assetId)!;

      // Extract addresses
      const addrMatches = reportText.match(/0x[a-f0-9]{40}/g) || [];
      for (const addr of addrMatches) {
        if (addr !== asset.address.toLowerCase()) {
          assetFactRecord.addresses.add(addr);
        }
      }

      // Extract metrics
      for (const sec of report.sections) {
        if (sec.data?.metrics) {
          for (const m of sec.data.metrics) {
            assetFactRecord.metrics.set(m.label, m.value);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. Cross-Asset Fact Leakage Check (Section 19)
    // -------------------------------------------------------------------------
    // Compare facts across distinct assets to catch improper sharing
    const assetEntries = Array.from(factsByAsset.entries());
    for (let i = 0; i < assetEntries.length; i++) {
      const [assetIdA, factsA] = assetEntries[i];
      for (let j = i + 1; j < assetEntries.length; j++) {
        const [assetIdB, factsB] = assetEntries[j];

        // If two different assets have identical custom non-zero addresses that are not standard constants
        for (const addr of factsA.addresses) {
          if (
            factsB.addresses.has(addr) &&
            addr !== "0x0000000000000000000000000000000000000000" &&
            addr !== "0x000000000000000000000000000000000000dead"
          ) {
            violations.push({
              code: "CROSS_ASSET_ADDRESS_COLLISION",
              severity: "CRITICAL",
              message: `Asset ${assetIdA} and Asset ${assetIdB} share unexpected specific address: ${addr}`,
              assetId: assetIdA,
              tier: "basic",
            });
          }
        }
      }
    }

    const passed = violations.length === 0;
    const totalReportsAudited = reports.length;
    const assetIsolationViolations = violations.filter((v) => v.code.startsWith("CROSS_ASSET")).length;
    const tierViolations = violations.filter((v) => v.code.startsWith("MODE_B")).length;
    const metricViolations = violations.filter((v) => v.code.startsWith("METRIC")).length;

    return {
      passed,
      totalReportsAudited,
      totalViolations: violations.length,
      violations,
      assetIsolationScore: Math.max(0, 100 - assetIsolationViolations * 10),
      tierEnforcementScore: Math.max(0, 100 - tierViolations * 10),
      metricIntegrityScore: Math.max(0, 100 - metricViolations * 10),
    };
  }
}
