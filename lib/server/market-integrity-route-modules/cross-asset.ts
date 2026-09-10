import { NextResponse } from "next/server";
import { buildCrossAssetCollapseRadar } from "@/lib/market-integrity/cross-asset-collapse-radar";
import { buildExchangeHealthAdapterPreview } from "@/lib/market-integrity/exchange-health-adapter";
import { buildAiHumanCopyEngine } from "@/lib/market-integrity/ai-human-copy-engine";
import { buildGlobalRiskMap } from "@/lib/market-integrity/global-risk-map";
import { buildMarketSourceCadenceMatrix } from "@/lib/market-integrity/market-source-cadence-matrix";
import { buildSecondSourceDivergenceMatrix } from "@/lib/market-integrity/second-source-divergence-matrix";
import { buildUniversalAssetMarketMatrix } from "@/lib/market-integrity/universal-asset-market-matrix";
import { buildRealMarketProviderContract } from "@/lib/market-integrity/real-market-provider-contract";
import { pass388WorldMarketClarityContract } from "@/lib/market-integrity/world-market-clarity-terminal";
import { pass389PublicLaunchTerminalContract } from "@/lib/market-integrity/public-launch-terminal";
import { pass461VenueHealthContract } from "@/lib/market-integrity/venue-health-runtime";
import { pass462CrossVenueConsensusContract } from "@/lib/market-integrity/cross-venue-consensus";
import { pass463CanonicalPairCoverageContract } from "@/lib/market-integrity/canonical-pair-coverage";
import { pass464FundamentalQualityContract } from "@/lib/market-integrity/fundamental-quality";
import { pass465SecXbrlQualityContract } from "@/lib/market-integrity/sec-xbrl-quality";

export async function GET() {
  const radar = buildCrossAssetCollapseRadar();
  const exchangeHealth = buildExchangeHealthAdapterPreview();
  const humanCopy = buildAiHumanCopyEngine();
  const globalRiskMap = buildGlobalRiskMap();
  const cadenceMatrix = buildMarketSourceCadenceMatrix();
  const secondSourceDivergence = buildSecondSourceDivergenceMatrix();
  const universalAssetMatrix = buildUniversalAssetMarketMatrix();
  const realMarketProviderContract = buildRealMarketProviderContract();
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...radar,
      boundary:
        "Cross-asset anomaly radar only. Not bankruptcy prediction, not exchange certification, not proof of solvency and not investment advice.",
      exchangeHealth,
      humanCopy,
      globalRiskMap,
      cadenceMatrix,
      secondSourceDivergence,
      universalAssetMatrix,
      realMarketProviderContract,
      pass388WorldMarketClarityContract,
      pass389PublicLaunchTerminalContract,
      pass461VenueHealthContract,
      pass462CrossVenueConsensusContract,
      pass463CanonicalPairCoverageContract,
      pass464FundamentalQualityContract,
      pass465SecXbrlQualityContract,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
