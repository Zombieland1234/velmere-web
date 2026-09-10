import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildVlmShieldInvestigator } from "@/lib/market-integrity/shield-investigator";
import { buildEvidenceReportDraft } from "@/lib/market-integrity/evidence-report";
import { checkRateLimit, guardrailHeaders } from "@/lib/market-integrity/api-guardrails";
import { persistSourceSnapshot } from "@/lib/market-integrity/source-snapshot-ledger";
import { buildTerminalEvidenceExport } from "@/lib/market-integrity/terminal-evidence-export";
import { buildSafeDownloadDisposition } from "@/lib/security/download-response-boundary";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request, "evidence-export");
  const baseHeaders = guardrailHeaders(rateLimit);
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const format = searchParams.get("format")?.trim().toLowerCase() === "json" ? "json" : "markdown";

  if (!query) {
    return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400, headers: baseHeaders });
  }

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const investigator = buildVlmShieldInvestigator(result);
    const evidenceReport = buildEvidenceReportDraft(result, investigator);
    const sourceSnapshot = await persistSourceSnapshot(result, investigator, evidenceReport);
    const terminalEvidenceExport = buildTerminalEvidenceExport(result, {
      activeCommand: "export",
      chartSource: "evidence-export-route",
      sessionMode: "operator_session",
      exportInfrastructureReady: false,
      persistentAuditLogReady: false,
      rateLimitMiddlewareReady: false,
    });
    const filenameStem = `${evidenceReport.reportId}-${result.token.symbol}`;

    if (format === "json") {
      const download = buildSafeDownloadDisposition({ disposition: "attachment", filenameStem, mediaKind: "json", fallbackStem: "vlm-shield-report" });
      return new NextResponse(JSON.stringify({ mode: "draft", result, investigator, evidenceReport, sourceSnapshot, terminalEvidenceExport }, null, 2), {
        headers: {
          "content-type": download.contentType,
          "content-disposition": download.contentDisposition,
          ...baseHeaders,
        },
      });
    }

    const download = buildSafeDownloadDisposition({ disposition: "attachment", filenameStem, mediaKind: "markdown", fallbackStem: "vlm-shield-report" });
    return new NextResponse(evidenceReport.markdown, {
      headers: {
        "content-type": download.contentType,
        "content-disposition": download.contentDisposition,
        ...baseHeaders,
      },
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/evidence-export", code: "evidence_export_failed", status: 502, headers: baseHeaders });
  }
}
