import { z } from "zod";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";
import { recordVlmPolicyRejection } from "./vlm-security-events";

export const VLM_TOOL_NAMES = [
  "getMarketSnapshot",
  "getCandles",
  "getLiquiditySnapshot",
  "getHolderDistribution",
  "getContractSignals",
  "getSourceStatus",
  "getRealMarketSnapshot",
  "getExchangeHealth",
  "getPreviousAnalysis",
] as const;

export type VlmToolName = (typeof VLM_TOOL_NAMES)[number];

const toolArgsSchema = z.object({ assetId: z.string().min(1).max(180).optional() }).strict();

export type VlmToolContext = {
  packet: VlmCanonicalFactPacket;
  previousAnalysis?: unknown;
};

export type VlmToolResult = {
  name: VlmToolName;
  ok: boolean;
  data: unknown;
};

export const VLM_FUNCTION_DECLARATIONS = VLM_TOOL_NAMES.map((name) => ({
  name,
  description: `Read the already-authorized Velmère ${name.replace(/^get/, "")} facts for the current asset. No network URL, code execution, filesystem or secrets are available.`,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: { assetId: { type: "string", description: "Optional current asset id." } },
  },
}));

function selectFact(packet: VlmCanonicalFactPacket, ids: string[]) {
  return packet.facts.filter((fact) => ids.includes(fact.id));
}

export async function executeVlmTool(
  name: string,
  rawArgs: unknown,
  context: VlmToolContext,
): Promise<VlmToolResult> {
  if (!VLM_TOOL_NAMES.includes(name as VlmToolName)) {
    recordVlmPolicyRejection({ vector: "tool", reason: "tool_not_allowed", score: 92 });
    return { name: "getMarketSnapshot", ok: false, data: { error: "Tool is not allowed." } };
  }
  const parsed = toolArgsSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    recordVlmPolicyRejection({ vector: "tool", reason: "invalid_tool_arguments", score: 82 });
    return { name: name as VlmToolName, ok: false, data: { error: "Invalid tool arguments." } };
  }
  if (parsed.data.assetId && parsed.data.assetId !== context.packet.asset.id) {
    recordVlmPolicyRejection({ vector: "tool", reason: "cross_asset_tool_escape", score: 96 });
    return { name: name as VlmToolName, ok: false, data: { error: "Tool asset is outside the current fact packet." } };
  }

  const packet = context.packet;
  const dataByTool: Record<VlmToolName, unknown> = {
    getMarketSnapshot: selectFact(packet, ["price", "price-change-1h", "price-change-24h", "price-change-7d", "price-change-30d", "market-cap", "fdv", "volume-24h"]),
    getCandles: { available: false, reason: "Candles were not included in the canonical packet." },
    getLiquiditySnapshot: selectFact(packet, ["liquidity-usd", "slippage-10k"]),
    getHolderDistribution: selectFact(packet, ["holder-count", "top10-holder-percent"]),
    getContractSignals: { contractAddress: packet.asset.contractAddress ?? null, facts: selectFact(packet, ["sell-tax"]), signals: packet.signals.filter((signal) => /contract|honeypot|mint|tax|blacklist/i.test(signal.id)) },
    getSourceStatus: { sources: packet.sources, arbitration: packet.sourceArbitration },
    getRealMarketSnapshot: packet.asset.assetClass === "crypto" ? { available: false, reason: "Current packet is crypto; use getMarketSnapshot." } : packet.facts,
    getExchangeHealth: { available: false, reason: "Exchange health is not present in the current packet." },
    getPreviousAnalysis: context.previousAnalysis ?? { available: false },
  };
  return { name: name as VlmToolName, ok: true, data: dataByTool[name as VlmToolName] };
}

export async function executeBoundedVlmTools(
  calls: Array<{ name?: string; args?: unknown }>,
  context: VlmToolContext,
  maxCalls = 3,
) {
  const results: VlmToolResult[] = [];
  const uniqueCalls = calls.filter((call, index, all) =>
    Boolean(call.name) && all.findIndex((candidate) => candidate.name === call.name) === index,
  );
  for (const call of uniqueCalls.slice(0, Math.min(maxCalls, 3))) {
    results.push(await executeVlmTool(call.name ?? "", call.args, context));
  }
  return results;
}
