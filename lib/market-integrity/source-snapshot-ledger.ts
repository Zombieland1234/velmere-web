import { readJsonResponseBounded, readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import type { TokenRiskResult } from "./risk-types";
import type { InvestigatorProtocol } from "./shield-investigator";
import type { EvidenceReportDraft } from "./evidence-report";

export type SourceSnapshotMode = "memory" | "supabase";

export type SourceSnapshot = {
  id: string;
  reportId: string;
  symbol: string;
  name: string;
  timestamp: string;
  sourceState: TokenRiskResult["dataQuality"];
  overallRisk: number | null;
  confidence: InvestigatorProtocol["confidence"];
  confidenceScore: number;
  finalVerdict: InvestigatorProtocol["finalVerdict"];
  missingData: string[];
  blockedBy: string[];
  sourceLedger: EvidenceReportDraft["sourceLedger"];
  webQueries: string[];
};

export type SourceSnapshotWriteResult = {
  mode: SourceSnapshotMode;
  stored: boolean;
  snapshot: SourceSnapshot;
  error?: string;
};

type SourceSnapshotStore = {
  snapshots: Map<string, SourceSnapshot[]>;
  lastPersistAt?: string;
  lastError?: string;
};

const globalKey = "__velmereSourceSnapshotLedger";

type GlobalWithSourceSnapshotLedger = typeof globalThis & {
  [globalKey]?: SourceSnapshotStore;
};

function getStore(): SourceSnapshotStore {
  const globalObject = globalThis as GlobalWithSourceSnapshotLedger;
  if (!globalObject[globalKey]) globalObject[globalKey] = { snapshots: new Map() };
  return globalObject[globalKey]!;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function snapshotKey(symbol: string) {
  return symbol.toLowerCase().replace(/[^a-z0-9:_-]/g, "-");
}

export function buildSourceSnapshot(
  result: TokenRiskResult,
  investigator: InvestigatorProtocol,
  evidenceReport: EvidenceReportDraft,
): SourceSnapshot {
  const symbol = result.token.symbol || "TOKEN";
  return {
    id: `${snapshotKey(symbol)}:${evidenceReport.reportId}`,
    reportId: evidenceReport.reportId,
    symbol,
    name: result.token.name || symbol,
    timestamp: new Date().toISOString(),
    sourceState: result.dataQuality,
    overallRisk: investigator.overallRisk,
    confidence: investigator.confidence,
    confidenceScore: investigator.confidenceScore,
    finalVerdict: investigator.finalVerdict,
    missingData: investigator.caseFrame.missingData,
    blockedBy: evidenceReport.blockedBy,
    sourceLedger: evidenceReport.sourceLedger,
    webQueries: investigator.webQueries,
  };
}

function persistToMemory(snapshot: SourceSnapshot): SourceSnapshotWriteResult {
  const store = getStore();
  const key = snapshotKey(snapshot.symbol);
  const history = store.snapshots.get(key) ?? [];
  const exists = history.some((item) => item.reportId === snapshot.reportId);
  if (!exists) store.snapshots.set(key, [...history, snapshot].slice(-96));
  store.lastPersistAt = new Date().toISOString();
  store.lastError = undefined;
  return { mode: "memory", stored: !exists, snapshot };
}

async function persistToSupabase(snapshot: SourceSnapshot): Promise<SourceSnapshotWriteResult> {
  const config = getSupabaseConfig();
  if (!config) return persistToMemory(snapshot);

  const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/velmere_source_snapshots`, {
    method: "POST",
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: snapshot.id,
      report_id: snapshot.reportId,
      symbol: snapshot.symbol,
      name: snapshot.name,
      timestamp: snapshot.timestamp,
      source_state: snapshot.sourceState,
      overall_risk: snapshot.overallRisk,
      confidence: snapshot.confidence,
      confidence_score: snapshot.confidenceScore,
      final_verdict: snapshot.finalVerdict,
      missing_data: snapshot.missingData,
      blocked_by: snapshot.blockedBy,
      source_ledger: snapshot.sourceLedger,
      web_queries: snapshot.webQueries,
    }),
  }, { configuredProfile: "supabase", operation: "source_snapshot_write", timeoutMs: 5_000 });

  if (!response.ok) {
    const error = new TextDecoder().decode(await readResponseBytesBounded(response, 64_000)).slice(0, 64_000) || "unknown supabase error";
    const fallback = persistToMemory(snapshot);
    return { ...fallback, mode: "memory", error };
  }

  return { mode: "supabase", stored: true, snapshot };
}

export async function persistSourceSnapshot(
  result: TokenRiskResult,
  investigator: InvestigatorProtocol,
  evidenceReport: EvidenceReportDraft,
): Promise<SourceSnapshotWriteResult> {
  const snapshot = buildSourceSnapshot(result, investigator, evidenceReport);
  return persistToSupabase(snapshot);
}

export async function getSourceSnapshots(symbol: string, limit = 24): Promise<SourceSnapshot[]> {
  const key = snapshotKey(symbol);
  const config = getSupabaseConfig();

  if (config) {
    const params = new URLSearchParams({
      select: "*",
      symbol: `eq.${symbol.toUpperCase()}`,
      order: "timestamp.desc",
      limit: String(Math.max(1, Math.min(96, limit))),
    });
    const response = await brokeredConfiguredOriginFetch(`${config.url}/rest/v1/velmere_source_snapshots?${params.toString()}`, {
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
      },
      cache: "no-store",
    }, { configuredProfile: "supabase", operation: "source_snapshot_read", timeoutMs: 5_000 });
    if (response.ok) {
      const rows = await readJsonResponseBounded<Array<{
        id: string;
        report_id: string;
        symbol: string;
        name: string;
        timestamp: string;
        source_state: TokenRiskResult["dataQuality"];
        overall_risk: number;
        confidence: InvestigatorProtocol["confidence"];
        confidence_score: number;
        final_verdict: InvestigatorProtocol["finalVerdict"];
        missing_data?: string[];
        blocked_by?: string[];
        source_ledger?: EvidenceReportDraft["sourceLedger"];
        web_queries?: string[];
      }>>(response, 2_000_000);
      return rows.map((row) => ({
        id: row.id,
        reportId: row.report_id,
        symbol: row.symbol,
        name: row.name,
        timestamp: row.timestamp,
        sourceState: row.source_state,
        overallRisk: row.overall_risk,
        confidence: row.confidence,
        confidenceScore: row.confidence_score,
        finalVerdict: row.final_verdict,
        missingData: row.missing_data ?? [],
        blockedBy: row.blocked_by ?? [],
        sourceLedger: row.source_ledger ?? [],
        webQueries: row.web_queries ?? [],
      }));
    }
  }

  const store = getStore();
  return (store.snapshots.get(key) ?? []).slice(-limit).reverse();
}

export function getSourceSnapshotLedgerMeta() {
  const store = getStore();
  return {
    mode: getSupabaseConfig() ? "supabase" as const : "memory" as const,
    symbols: Array.from(store.snapshots.keys()),
    lastPersistAt: store.lastPersistAt,
    lastError: store.lastError,
  };
}
