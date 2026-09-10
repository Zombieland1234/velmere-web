import { createHash } from "node:crypto";
import { isPrintfulConfigured } from "@/lib/printful/client";

export type FulfilmentProviderId = "printful" | "tapstitch" | "manual";
export type FulfilmentProviderMode = "sandbox" | "live" | "disabled";

export type FulfilmentProviderContract = {
  schemaVersion: "velmere.fulfilment-provider-contract.v1";
  provider: FulfilmentProviderId;
  mode: FulfilmentProviderMode;
  configured: boolean;
  canImportProducts: boolean;
  canMapVariants: boolean;
  canReadStock: boolean;
  canCreateOrderDraft: boolean;
  sandboxAvailable: boolean;
  requiredEnv: string[];
  missingEnv: string[];
  reliabilityScore: number;
  redactionBoundary: {
    rawProviderPayloadStored: false;
    secretsStored: false;
    clientExposesRawPayload: false;
    allowedFields: string[];
  };
  checksum: string;
};

function checksum(value: unknown) {
  return `provider_contract_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 20)}`;
}

function envMissing(keys: string[]) {
  return keys.filter((key) => !process.env[key]);
}

export function buildFulfilmentProviderContract(provider: FulfilmentProviderId): FulfilmentProviderContract {
  const requiredEnv = provider === "printful"
    ? ["PRINTFUL_API_TOKEN"]
    : provider === "tapstitch"
      ? ["TAPSTITCH_API_KEY"]
      : [];
  const missingEnv = envMissing(requiredEnv);
  const configured = provider === "printful" ? isPrintfulConfigured() : provider === "tapstitch" ? missingEnv.length === 0 : true;
  const mode: FulfilmentProviderMode = provider === "manual" ? "sandbox" : configured ? (process.env.VELMERE_PROVIDER_LIVE_MODE === "true" ? "live" : "sandbox") : "disabled";
  const capabilities = {
    canImportProducts: provider === "printful" ? configured : provider === "tapstitch" ? configured : false,
    canMapVariants: provider !== "manual" && configured,
    canReadStock: provider !== "manual" && configured,
    canCreateOrderDraft: provider !== "manual" && configured,
    sandboxAvailable: provider === "manual" || configured || process.env.VELMERE_PROVIDER_SANDBOX_OFFLINE === "true",
  };
  const score = [configured, capabilities.canImportProducts, capabilities.canMapVariants, capabilities.canReadStock, capabilities.canCreateOrderDraft, capabilities.sandboxAvailable].filter(Boolean).length;
  const base = { provider, mode, configured, requiredEnv, missingEnv, ...capabilities };
  return {
    schemaVersion: "velmere.fulfilment-provider-contract.v1",
    provider,
    mode,
    configured,
    ...capabilities,
    requiredEnv,
    missingEnv,
    reliabilityScore: Math.round((score / 6) * 100),
    redactionBoundary: {
      rawProviderPayloadStored: false,
      secretsStored: false,
      clientExposesRawPayload: false,
      allowedFields: ["provider", "mode", "configured", "capabilities", "missing env names", "score", "checksums"],
    },
    checksum: checksum(base),
  };
}

export function buildAllFulfilmentProviderContracts() {
  return ["printful", "tapstitch", "manual"].map((provider) => buildFulfilmentProviderContract(provider as FulfilmentProviderId));
}
