import type { VelmereSearchMode, VelmereSearchResult } from "./intelligence-search-contract";

export type VelmereLiveSearchAdapterStatus = "planned" | "blocked" | "preview";
export type VelmereLiveSearchAdapterKind = "web" | "token" | "contract" | "osint" | "velmere_docs";

export type VelmereLiveSearchAdapter = {
  id: string;
  kind: VelmereLiveSearchAdapterKind;
  status: VelmereLiveSearchAdapterStatus;
  priority: "P0" | "P1" | "P2";
  label: string;
  purpose: string;
  missing: string[];
  nextStep: string;
  safetyBoundary: string;
};

export type VelmereLiveSearchPreview = {
  schemaVersion: "velmere-live-search-adapter-preview-v1";
  query: string;
  mode: VelmereSearchMode;
  generatedAt: string;
  adapters: VelmereLiveSearchAdapter[];
  results: VelmereSearchResult[];
  storageWritePerformed: false;
  externalFetchPerformed: false;
  productionBoundary: string;
};

export const velmereLiveSearchAdapters: VelmereLiveSearchAdapter[] = [
  {
    id: "token-index-adapter",
    kind: "token",
    status: "preview",
    priority: "P0",
    label: "Token index adapter",
    purpose: "Map symbols, names and contract hints into short Velmère capsules and Shield bridge links.",
    missing: ["provider logo source", "server cache", "source freshness envelope"],
    nextStep: "Attach cached token metadata provider and keep fallback avatars when image is missing.",
    safetyBoundary: "Token index can suggest context, but cannot output final risk verdicts.",
  },
  {
    id: "contract-analyzer-adapter",
    kind: "contract",
    status: "blocked",
    priority: "P0",
    label: "Contract analyzer adapter",
    purpose: "Prepare owner/proxy/mint/pause/tax/blacklist fields before opening full Shield.",
    missing: ["chain/address validator", "contract analyzer", "snapshot ledger write"],
    nextStep: "Implement server-only contract analyzer envelope with source timestamp.",
    safetyBoundary: "Contract findings must be phrased as flags requiring review, not accusations.",
  },
  {
    id: "osint-queue-adapter",
    kind: "osint",
    status: "blocked",
    priority: "P1",
    label: "OSINT queue adapter",
    purpose: "Collect source URLs, KOL/social context and disclosure notes for manual review.",
    missing: ["source URL ledger", "reviewer identity", "safe paraphrase store"],
    nextStep: "Create OSINT queue with timestamps and no defamatory final claims.",
    safetyBoundary: "OSINT lane cannot claim intent, crime or fraud without formal evidence.",
  },
  {
    id: "velmere-docs-adapter",
    kind: "velmere_docs",
    status: "preview",
    priority: "P1",
    label: "Velmère docs adapter",
    purpose: "Search Velmère pages, Shield explainers, VLM access copy and policy pages.",
    missing: ["site index build step", "localized doc chunks", "route scoring"],
    nextStep: "Generate a lightweight local docs index for PL/EN/DE pages.",
    safetyBoundary: "Docs adapter only explains Velmère surfaces and does not answer as legal/financial advice.",
  },
  {
    id: "public-web-adapter",
    kind: "web",
    status: "planned",
    priority: "P2",
    label: "Public web adapter",
    purpose: "Future public-web search gateway with source ledger, timestamps and safe summaries.",
    missing: ["provider choice", "cache/rate policy", "citation/source ledger", "abuse controls"],
    nextStep: "Select provider and implement server-side search with strict source ledger.",
    safetyBoundary: "Public web summaries must be source-attributed, timestamped and free of certainty claims.",
  },
];

export function createLiveSearchAdapterPreview(
  query: string,
  mode: VelmereSearchMode,
  results: VelmereSearchResult[],
): VelmereLiveSearchPreview {
  return {
    schemaVersion: "velmere-live-search-adapter-preview-v1",
    query: query.trim().slice(0, 96),
    mode,
    generatedAt: new Date().toISOString(),
    adapters: velmereLiveSearchAdapters,
    results,
    storageWritePerformed: false,
    externalFetchPerformed: false,
    productionBoundary:
      "Preview only. No external web/OSINT fetch is performed and no search result should be treated as a final Shield verdict.",
  };
}
