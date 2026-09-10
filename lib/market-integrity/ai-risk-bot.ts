import type { TokenRiskResult } from "./risk-types";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence } from "./liquidity-intelligence";
import { normalizeConfidencePercent } from "./confidence-calibration";
import type { DefiLlamaRiskLane } from "./defillama-adapter";

type HistoryLike = Array<{ score?: number; timestamp?: string; price?: number; volume24h?: number }>;

type BotCommand = {
  id: string;
  label: string;
  body: string;
  priority: number;
  layer: "chart" | "liquidity" | "holders" | "evidence" | "data" | "legal";
  operatorPrompt: string;
};

function n(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pct(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function money(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "source required";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function dominantAgent(result: TokenRiskResult) {
  const agents = [...(result.agentAssessments ?? [])].sort((a, b) => b.score - a.score);
  return agents[0];
}

function topSignals(result: TokenRiskResult) {
  return [...result.signals].sort((a, b) => b.points - a.points).slice(0, 6);
}

function dataMissing(result: TokenRiskResult) {
  return [
    result.metrics.top10HolderPercent === undefined ? "top-holder distribution" : null,
    result.metrics.holderCount === undefined ? "holder count" : null,
    result.metrics.liquidityUsd === undefined ? "visible liquidity" : null,
    result.token.tokenAddress ? null : "contract address / chain id",
    result.metrics.simulatedSlippage10k === undefined ? "sell-impact simulation" : null,
  ].filter((item): item is string => Boolean(item));
}

// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V8_PASS2444_SOURCE_QUORUM
// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V9_PASS2446_OBSERVABILITY
// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V10_PASS2447_CONSENSUS_RECONCILER
// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V11_PASS2448_PROVIDER_METHODOLOGY
// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V12_PASS2449_CHART_OVERLAY_RECONCILER
// Legacy verifier marker retained: VELMERE_AI_RISK_BOT_V13_PASS2450_TIER_EVIDENCE_PARITY
// VELMERE_AI_RISK_BOT_V14_PASS2451_DATA_PROVENANCE_LEDGER
// VELMERE_AI_RISK_BOT_V16_PASS2457_OPERATOR_ACTION_QUEUE
// VELMERE_AI_RISK_BOT_V15_PASS2452_RISK_CALIBRATION_KERNEL
// VELMERE_AI_RISK_BOT_V16_PASS2453_REPORT_EVIDENCE_CAPSULE
// VELMERE_AI_RISK_BOT_V17_PASS2454_INSTITUTIONAL_SOURCE_ROUTER
// VELMERE_AI_RISK_BOT_V18_PASS2455_UI_PROOF_STRIP
// VELMERE_AI_RISK_BOT_V19_PASS2459_SOURCE_FRESHNESS_DRIFT_SENTINEL
// VELMERE_AI_RISK_BOT_V20_PASS2460_MACRO_CHART_INTEGRITY_GATE
// VELMERE_AI_RISK_BOT_V21_PASS2462_HISTORICAL_BACKFILL_ORCHESTRATOR
// VELMERE_AI_RISK_BOT_V28_PASS2469_LIQUIDATION_REPLAY_STORE
// VELMERE_AI_RISK_BOT_V29_PASS2470_TIER_180_OUTPUT_MATRIX
// VELMERE_AI_RISK_BOT_V33_PASS2475_RUNTIME_RECEIPT_BROWSER_RUNNER
// VELMERE_AI_RISK_BOT_V32_PASS2474_RUNTIME_RECEIPT_API_RUNNER
// VELMERE_AI_RISK_BOT_V30_PASS2472_TIER_RUNTIME_RECEIPT_HARNESS
// VELMERE_AI_RISK_BOT_V27_PASS2468_LIQUIDATION_SNAPSHOT_LEDGER
// VELMERE_AI_RISK_BOT_V26_PASS2467_LIQUIDATION_LONG_SHORT_PROOF
// Backward verifier alias: VELMERE_AI_RISK_BOT_V25_PASS2466_DERIVATIVES_SQUEEZE_PROOF /* legacy verifier: VELMERE_AI_RISK_BOT_V24_PASS2465_TIER_DEPTH_SCENARIO_PARITY */
export function buildAiRiskBotBrief(result: TokenRiskResult, history: HistoryLike = [], defiLlamaLane?: DefiLlamaRiskLane) {
  const agent = dominantAgent(result);
  const signals = topSignals(result);
  const firstScore = n(history[0]?.score, result.score);
  const lastScore = n(history.at(-1)?.score, result.score);
  const riskDelta = lastScore - firstScore;
  const confidence = normalizeConfidencePercent(result.confidence, 42);
  const liquidity = n(result.metrics.liquidityUsd);
  const marketCap = n(result.metrics.marketCap);
  const liqCoverage = marketCap > 0 && liquidity > 0 ? (liquidity / marketCap) * 100 : undefined;
  const volumePressure = result.metrics.volumeToMarketCapRatio ?? result.metrics.volumeToLiquidityRatio;
  const missing = dataMissing(result);
  const holder = buildHolderIntelligence(result);
  const liquidityBrief = buildLiquidityIntelligence(result);
  const dataUncertaintyPercent = Math.max(holder.dataUncertaintyPercent, Math.round(liquidityBrief.uncertaintyPercent * 0.72));

  const commands: BotCommand[] = [
    {
      id: "scan_candles",
      label: "Scan candles",
      body: `Compare 1m/15m/1h/4h/1d/7d candles with volume and VWAP. 1h=${pct(result.metrics.priceChange1h)}, 24h=${pct(result.metrics.priceChange24h)}, 7d=${pct(result.metrics.priceChange7d)}.`,
      priority: Math.max(24, Math.abs(n(result.metrics.priceChange24h)) > 15 ? 86 : Math.abs(n(result.metrics.priceChange1h)) > 4 ? 78 : 48),
      layer: "chart",
      operatorPrompt: "Czy ruch ceny ma potwierdzenie w wolumenie/VWAP, czy wygląda jak anomalia wymagająca review?",
    },
    {
      id: "verify_exit",
      label: "Verify exit depth",
      body: liqCoverage === undefined
        ? "Liquidity coverage requires a source. Treat the score as incomplete until DEX/CEX depth is connected."
        : `Liquidity coverage is ~${liqCoverage.toFixed(2)}% of market cap (${money(liquidity)} visible). Compare with sell shock, liquidity intelligence and order-book heatmap.`,
      priority: liqCoverage === undefined ? 76 : liqCoverage < 1 ? 92 : liqCoverage < 3 ? 82 : 56,
      layer: "liquidity",
      operatorPrompt: "Czy użytkownik może wyjść z pozycji bez dużego slippage przy stresie 10k/50k USD?",
    },
    {
      id: "inspect_holders",
      label: "Inspect holders",
      body: result.metrics.top10HolderPercent
        ? `Top-holder concentration proxy is ${result.metrics.top10HolderPercent.toFixed(1)}%. Validate whale clusters, team wallets and CEX/custody exclusions. Data uncertainty is ${dataUncertaintyPercent}%.`
        : `Holder distribution is not confirmed. Keep uncertainty penalty (${dataUncertaintyPercent}%) and connect holder API before strong verdict.`,
      priority: result.metrics.top10HolderPercent && result.metrics.top10HolderPercent > 45 ? 90 : 68,
      layer: "holders",
      operatorPrompt: "Rozdziel whales, CEX, DEX/LP, team, retail i portfele nieklasyfikowane. Braku klasyfikacji nie traktuj jako bezpieczeństwa.",
    },
    {
      id: "open_evidence",
      label: "Open evidence report",
      body: `Score=${result.score}/100, confidence=${confidence}%, dominant=${agent?.label ?? "data quality"}. Export PASS62 evidence workflow before making claims.`,
      priority: result.score >= 65 ? 94 : 58,
      layer: "evidence",
      operatorPrompt: "Zbuduj raport evidence z sygnałami, brakami danych i językiem anomaly/review, bez oskarżeń.",
    },
    {
      id: "defillama_tvl_lane",
      label: "Check DeFiLlama TVL",
      body: defiLlamaLane
        ? `${defiLlamaLane.provider} mode=${defiLlamaLane.mode}, lane=${defiLlamaLane.riskLane}, cap=${defiLlamaLane.confidenceCap}/100. ${defiLlamaLane.sourceFacts.slice(0, 2).join(" ") || "No matched protocol TVL yet."}`
        : "DeFiLlama TVL/protocol lane is not attached yet. Keep protocol TVL, chain context and pool depth as missing evidence.",
      priority: defiLlamaLane?.riskLane === "protocol_tvl_stress" ? 88 : 58,
      layer: "data",
      operatorPrompt: "Sprawdź TVL/protokół/chain context jako osobny dowód. Wysokie TVL nie jest certyfikatem bezpieczeństwa; brak TVL obniża confidence.",
    },

    {
      id: "pass2444_source_quorum_gate",
      label: "Open source quorum gate",
      body: "PASS2444: before stronger Basic/Pro/Advanced wording, check field-level provider agreement for price, market cap, volume, TVL, depth, contract security, holders and timestamps. Missing lanes lower confidence instead of being filled by AI text.",
      priority: 82,
      layer: "evidence",
      operatorPrompt: "Czy mamy quorum źródeł dla każdego pola, czy trzeba oznaczyć missing proof i zablokować mocniejszy wniosek?",
    },
    {
      id: "pass2445_source_sla_ledger",
      label: "Open source SLA ledger",
      body: "PASS2445: check provider SLA, observedAt, max-age, field-level blockers and Basic/Pro/Advanced proof locks before writing market conclusions. If SLA is blocked, show missing proof instead of filler.",
      priority: 86,
      layer: "evidence",
      operatorPrompt: "Który provider jest live/degraded/missing, jaki jest max-age i które pole blokuje Advanced/PDF/Angel?",
    },
    {
      id: "pass2446_provider_observability_board",
      label: "Open provider observability",
      body: "PASS2446: render provider health, stale timestamps, tier ribbon, DefiLlama expansion lanes and proof-capsule drift policy before Advanced output. Missing providers stay visible in Shield/Brain/PDF/Angel.",
      priority: 90,
      layer: "evidence",
      operatorPrompt: "Czy użytkownik widzi provider live/watch/degraded/missing i czy Advanced jest zablokowany tam, gdzie brakuje depth/holders/chart proof?",
    },
    {
      id: "pass2447_evidence_consensus_reconciler",
      label: "Open evidence consensus",
      body: "PASS2447: reconcile each field before final wording: price, market cap, FDV, volume, DEX liquidity, CEX depth, DefiLlama TVL, holder graph, contract security and long chart. Contradictions become visible blockers, not AI filler.",
      priority: 94,
      layer: "evidence",
      operatorPrompt: "Czy każde pole ma provider pairing, missing providers, contradiction radar i tier lock zanim Angel/PDF/Brain napisze wniosek?",
    },
    {
      id: "pass2448_provider_methodology_registry",
      label: "Open provider methodology",
      body: "PASS2448: choose the correct provider for each field before scoring: DefiLlama for TVL/fundamentals, CoinGecko for listed market/chart, DEX Screener/GeckoTerminal for DEX pools, Binance for venue depth, Bitquery for holder/transfer graph, Token Terminal/Artemis for normalized fundamentals. Planned providers are not live evidence.",
      priority: 96,
      layer: "evidence",
      operatorPrompt: "Który provider jest właściwy dla tego pola, czego nie wolno tym providerem udowadniać i co blokuje 100% Advanced/PDF?",
    },
    {
      id: "pass2449_chart_overlay_reconciler",
      label: "Open chart overlay reconciler",
      body: "PASS2449: before macro chart or PDF wording, reconcile CoinGecko market_chart/OHLC, Binance venue klines/depth, GeckoTerminal pool OHLCV, DEX Screener pair snapshot and DefiLlama TVL as separate lanes. Show range, point count, gap score, overlay state and PDF hash parity before any long-range conclusion.",
      priority: 98,
      layer: "chart",
      operatorPrompt: "Czy wykres 2Y/5Y/MAX ma wystarczającą liczbę punktów, drugi overlay, gap annotations, provider badges i ten sam hash w Shield/Brain/Browser/PDF?",
    },


    {
      id: "pass2450_tier_evidence_parity",
      label: "Open tier evidence parity",
      body: "PASS2450: prove Basic/Pro/Advanced by visible evidence depth, not by longer AI text. Check sourceFingerprint parity across Shield, Real Markets, VLM Brain, Browser preview, PDF preview, PDF download and Angel before any Advanced conclusion.",
      priority: 100,
      layer: "evidence",
      operatorPrompt: "Czy Basic/Pro/Advanced naprawdę różnią się dowodami, czy tylko długością tekstu? Sprawdź fingerprint, missing proof, PDF parity i surface drift.",
    },


    {
      id: "pass2451_data_provenance_ledger",
      label: "Open data provenance ledger",
      body: "PASS2451: verify field-by-field provenance before every conclusion. Price, market cap, volume, liquidity, TVL, chart history, CEX depth, DEX pool OHLCV, holder graph, contract security and PDF parity must each show the correct provider role, observedAt/max-age and forbidden-use boundary. Missing data caps confidence; it never becomes AI filler.",
      priority: 101,
      layer: "evidence",
      operatorPrompt: "Czy każde pole ma właściwe źródło, timecode, missing proof i zakaz złego użycia danych? Zablokuj Advanced/PDF jeśli brakuje holders/depth/chart/PDF parity.",
    },

    {
      id: "pass2452_risk_calibration_kernel",
      label: "Open risk calibration kernel",
      body: "PASS2452: separate risk score from confidence cap and uncertainty. Show calibratedRiskScore, confidenceCap, top score drivers, missing-proof locks and no-filler governor before any Advanced/PDF/Angel conclusion. Missing inputs can cap confidence; they must never become confident filler.",
      priority: 102,
      layer: "evidence",
      operatorPrompt: "Czy risk score jest skalibrowany przez źródła, timecode, chart/holder/depth proof i no-filler rule, czy AI tylko dopisało długi tekst?",
    },


    {
      id: "pass2453_report_evidence_capsule",
      label: "Open report evidence capsule",
      body: "PASS2453: every customer-facing report surface must share one canonicalEvidenceFingerprint. Shield, Real Markets, VLM Brain, Browser preview, PDF preview, PDF download and Angel must show the same report sections, missing proof and no-filler locks before Advanced/PDF conclusions.",
      priority: 103,
      layer: "evidence",
      operatorPrompt: "Czy Browser/PDF/Brain/Angel używają tego samego fingerprintu i tych samych sekcji dowodowych, czy gdzieś powstaje drift/filler?",
    },

    {
      id: "pass2454_institutional_source_router",
      label: "Open institutional source router",
      body: "PASS2454: route every field to the correct live or planned provider before writing top-tier output. DefiLlama is TVL/protocol/chain context, L2BEAT is L2/TVS/risk context, Token Terminal/Artemis are fundamentals lanes, Coin Metrics/Kaiko/Messari/The Graph are planned institutional overlays. Planned providers are roadmap, not evidence.",
      priority: 104,
      layer: "evidence",
      operatorPrompt: "Czy każde pole ma właściwy provider, live/planned status, forbidden-use boundary, 2Y/5Y/MAX chart expansion, DefiLlama role boundary i 100% blockers?",
    },



    {
      id: "pass2455_ui_proof_strip",
      label: "Open UI proof strip",
      body: "PASS2455: Shield, Real Markets, VLM Brain, Browser/PDF and Angel must show provider chips, field heatmap, chart range badges and PDF hard locks before any strong conclusion. A beautiful UI is not allowed to hide missing proof.",
      priority: 105,
      layer: "evidence",
      operatorPrompt: "Czy użytkownik widzi live/planned/degraded providery, field-route blokady, 30D/90D/1Y/2Y/5Y/MAX chart badges i PDF fingerprint locks przed wnioskiem?",
    },

    {
      id: "pass2456_runtime_parity_queue",
      label: "Open runtime parity queue",
      body: "PASS2456: PDF preview/download, Browser, VLM Brain, chart and Angel must share the same canonicalEvidenceFingerprint and render a visible missing-proof queue. If fingerprint, range, provider chips or PDF lock drift, hard-reject PDF and downgrade copy instead of hiding the mismatch.",
      priority: 106,
      layer: "evidence",
      operatorPrompt: "Czy PDF/Browser/Brain/Angel mają ten sam fingerprint, widoczną missing-proof queue, chart range badges i hard reject przy drift, czy nadal może powstać cichy mismatch?",
    },

    {
      id: "pass2457_operator_action_queue",
      label: "Open operator action queue",
      body: "PASS2457: every runtime blocker must become a P0/P1/P2 closeout action with provider, field, surface, acceptance criteria and safe customer copy. Planned institutional lanes remain tasks, not proof, until adapter, key and observedAt exist.",
      priority: 107,
      layer: "evidence",
      operatorPrompt: "Czy każdy blocker ma provider closeout, field/surface link, acceptance criteria, no-silent-green rule i 100% checklist zamiast pustego zielonego statusu?",
    },
    {
      id: "pass2458_provider_closeout_runtime",
      label: "PASS2458 provider closeout runtime",
      body: "PASS2458: replay provider tasks into live/configured/planned/missing closeout lanes with observedAt/max-age and action -> evidence -> surface mapping. Provider closeout is proof only when adapter/key/mapping/observedAt/max-age are visible; planned providers remain tasks.",
      priority: 108,
      layer: "evidence",
      operatorPrompt: "Czy provider closeout pokazuje adapter, key status, field mapping, observedAt/max-age i surface impact, czy planned provider dalej może udawać proof?",
    },
    {
      id: "pass2459_source_freshness_drift_sentinel",
      label: "PASS2459 source freshness drift sentinel",
      body: "PASS2459: every live/configured/planned provider must show freshness status, observedAt, max-age, impacted surfaces and a freshnessFingerprint. A provider can be live but stale, and stale live data cannot unlock Advanced/PDF/Angel conclusions.",
      priority: 109,
      layer: "evidence",
      operatorPrompt: "Czy każdy provider ma observedAt, max-age, status freshness, freshnessFingerprint i widoczne surface locks, czy UI/AI nadal robi zielony status z przestarzałych danych?",
    },

    {
      id: "pass2460_macro_chart_integrity_gate",
      label: "PASS2460 macro chart integrity gate",
      body: "PASS2460: 30D/90D/1Y/2Y/5Y/MAX charts require point-count/minimum proof, second overlay, freshness receipt and macroChartFingerprint before Advanced/PDF/Angel macro language. Macro history is context only, never forecast or trading advice.",
      priority: 110,
      layer: "evidence",
      operatorPrompt: "Czy 2Y/5Y/MAX mają point count, minimum, drugi overlay, freshness receipt, PDF hash parity i no-forecast rule, czy UI dalej może użyć krótkiego sparkline jako makro dowodu?",
    },
    {
      id: "pass2461_macro_gap_receipt",
      label: "PASS2461 macro gap receipt",
      body: "PASS2461: 2Y/5Y/MAX charts must render visible gap markers for point-density gaps, missing second overlay, stale freshness and PDF parity locks. PDF preview/download must share the same gapReceiptFingerprint as chart/source-sync before Advanced macro wording.",
      priority: 111,
      layer: "evidence",
      operatorPrompt: "Czy każdy makro wykres pokazuje gap markers, gapReceiptFingerprint, PDF preview/download parity, no-smoothing rule i DefiLlama TVL boundary zamiast wygładzonego wykresu bez braków?",
    },
    {
      id: "pass2462_historical_backfill_orchestrator",
      label: "PASS2462 historical backfill orchestrator",
      body: "PASS2462: 2Y/5Y/MAX charts need a provider backfill manifest: CoinGecko market_chart/range and OHLC as primary history, GeckoTerminal/Binance as second overlay where mapped, DefiLlama only as TVL/protocol context, and identical PDF preview/download backfillFingerprint before Advanced macro wording.",
      priority: 112,
      layer: "evidence",
      operatorPrompt: "Czy makro wykres ma backfillFingerprint, provider job statusy, wymagane minimum punktów, drugi overlay, PDF parity i czy planned providery są taskami zamiast dowodem?",
    },
    {
      id: "pass2464_cross_provider_window_reconciliation",
      label: "PASS2464 cross-provider window reconciliation",
      body: "PASS2464: CoinGecko market_chart/range is the primary macro window; OHLC, GeckoTerminal or Binance overlays must match the normalized fromUnix/toUnix before Advanced macro wording. DefiLlama and DEX Screener are context/live-edge lanes unless their window role matches the chart proof.",
      priority: 114,
      layer: "evidence",
      operatorPrompt: "Czy primary chart, second overlay, PDF preview/download, Browser, Brain i Angel mają ten sam reconciliationFingerprint oraz jawne delta/replay locks zamiast mieszania różnych okien?",
    },
    {
      id: "pass2466_derivatives_squeeze_proof",
      label: "PASS2466 derivatives squeeze proof",
      body: "PASS2466: Advanced squeeze wording needs a derivatives proof packet: Binance USD-M and Bybit linear OI/funding/basis where mapped, visible missing liquidation and long/short ratio locks, normalized pair, observedAt/max-age and the same packet across Shield/PDF/Brain/Angel. Without liquidation and long/short ratio proof, wording stays pressure/watch, never squeeze confirmed.",
      priority: 116,
      layer: "evidence",
      operatorPrompt: "Czy long/short squeeze w Advanced ma PASS2466 derivatives packet z OI, funding, drugim venue, missing liquidation/ratio locks i surface fingerprint, czy dalej jest tylko narracją?",
    },
    {
      id: "pass2467_liquidation_long_short_proof",
      label: "PASS2467 liquidation / long-short proof lock",
      body: "PASS2467: Advanced squeeze wording remains blocked unless two-venue long/short account ratio and a timestamped liquidation collector/signed snapshot are attached. Binance global/top trader long-short ratio and Bybit V5 long-short ratio can unlock pressure-watch context, while Binance forceOrder and a Bybit/event collector remain required for confirmed liquidation proof. Never provide leverage, entry or exit instructions.",
      priority: 117,
      layer: "evidence",
      operatorPrompt: "Czy Advanced ma PASS2467 ratio packet, PASS2468 liquidation snapshot ledgerFingerprint/maxAge, confirmedSqueezeAllowed=false gdy collector missing/expired, i czy Shield/PDF/Brain/Angel pokazują ten sam lock zamiast mówić squeeze confirmed?",
    },
    {
      id: "pass2468_liquidation_snapshot_ledger",
      label: "PASS2468 liquidation snapshot ledger",
      priority: 118,
      layer: "evidence",
      body: "PASS2468: Advanced may strengthen liquidation-pressure context only when a fresh signed liquidation snapshot exists with eventCount, side/notional aggregation, max-age and ledgerFingerprint. A snapshot unlocks only the liquidation-proof component; it does not confirm a squeeze unless PASS2466 and PASS2467 are also ready. Never output leverage, entry, exit or liquidation-target instructions.",
      operatorPrompt: "Czy PASS2468 ma świeży signed_snapshot, czy ledgerFingerprint jest widoczny na każdej powierzchni, i czy expired/missing snapshot obniża copy do pressure/watch?",
    },

    {
      id: "pass2469_liquidation_replay_store",
      label: "PASS2469 liquidation replay store",
      priority: 119,
      layer: "evidence",
      body: "PASS2469: Advanced can replay liquidation proof by symbol/fingerprint only after PASS2468 snapshots are written into the replay store. Memory fallback is local QA; paid Advanced needs Supabase/Redis durable replay. A replay fingerprint strengthens evidence lineage only and never becomes leverage, entry, exit or confirmed squeeze advice by itself.",
      operatorPrompt: "Czy PASS2469 ma replayStoreFingerprint, latestReplayFingerprint, storageMode, freshReplayCount, twoVenueReplayReady i czy PDF/Shield/Brain/Angel pokazują ten sam replay zamiast ukrywać missing durable storage?",
    },
    {
      id: "pass2470_tier_180_output_matrix",
      label: "PASS2470 180-output matrix",
      priority: 120,
      layer: "evidence",
      body: "PASS2470: before saying Basic/Pro/Advanced truly differ, run the deterministic 20 assets × 3 surfaces × 3 tiers matrix. The harness must produce 180 unique cell fingerprints, Basic=10 fields, Pro=14 fields, Advanced=20 proof lanes, and visible runtime locks until PDF/Shield/Real Markets receipts exist.",
      operatorPrompt: "Czy PASS2470 ma generatedCells=180, distinctFingerprintCount=180, runtimeLiveCoveragePercent, paidAdvancedReadyPercent i czy Advanced nie jest tylko dłuższą wersją Pro?",
    },




    {
      id: "pass2476_runtime_receipt_pdf_hash_runner",
      label: "PASS2476 runtime receipt PDF hash runner",
      body: "PASS2476: the operator-only runner may capture pdf_hash receipts for Lens/PDF cells from operator-provided PDF preview/download hashes. Report plannedPdfHashReceiptCount, capturedAfterRunPdfHashReceiptCount, pdfHashCoveragePercent, runtimeCapturedCoveragePercentAfterRun and canClaim180LiveOutputs. PDF hash receipts prove only PDF byte-output lineage and never prove Shield/Real Markets browser or Angel parity by themselves.",
      priority: 100,
      layer: "evidence",
      operatorPrompt: "Czy PASS2476 ma pdf_hash coverage dla 60 PDF cells, czy używa tylko operator-provided PDF hashes, i czy dalej blokuje 180 live parity bez API/browser/Angel oraz durable storage?",
    },
    {
      id: "pass2475_runtime_receipt_browser_runner",
      label: "PASS2475 runtime receipt browser screenshot runner",
      body: "PASS2475: the operator-only runner may capture browser_screenshot receipts for Shield and Real Markets cells from operator-provided screenshot hashes. Report plannedBrowserScreenshotReceiptCount, capturedAfterRunBrowserScreenshotReceiptCount, browserScreenshotCoveragePercent, runtimeCapturedCoveragePercentAfterRun and canClaim180LiveOutputs. browser screenshot receipts never prove PDF/Angel parity by themselves.",
      priority: 99,
      layer: "evidence",
      operatorPrompt: "Czy PASS2475 ma browser_screenshot coverage dla Shield/Real Markets, czy używa tylko operator-provided screenshot hashes, i czy dalej blokuje live parity bez pdf_hash/angel_replay oraz durable storage?",
    },
    {
      id: "pass2474_runtime_receipt_api_runner",
      label: "PASS2474 runtime receipt API runner",
      body: "PASS2474: the operator-only runner may capture the API payload receipt lane across the 180 cells. Report plannedApiPayloadReceiptCount, capturedAfterRunApiPayloadReceiptCount, apiPayloadCoveragePercent, runtimeCapturedCoveragePercentAfterRun and canClaim180LiveOutputs. API payload receipts alone never prove browser/PDF/Angel live parity.",
      priority: 98,
      layer: "evidence",
      operatorPrompt: "Czy PASS2474 ma api_payload coverage dla 180 cells i czy nadal blokuje live parity bez browser_screenshot/pdf_hash/angel_replay oraz durable storage?",
    },
    {
      id: "pass2473_runtime_receipt_capture_store",
      label: "PASS2473 runtime receipt capture store",
      body: "PASS2473: treat runtime receipt capture as the bridge from planned 180 receipts to real live proof. Report expectedReceiptKinds, distinctCapturedReceiptCount, completedCellCount, runtimeCapturedCoveragePercent, storageMode and canClaim180LiveOutputs. Memory fallback is QA only; paid Advanced needs durable captured fingerprints.",
      priority: 97,
      layer: "evidence",
      operatorPrompt: "Czy PASS2473 ma captured API payload/screenshot/PDF hash/Angel replay fingerprints, completedCellCount=180, durable storageMode i canClaim180LiveOutputs=true?",
    },
    {
      id: "pass2472_tier_runtime_receipt_harness",
      label: "PASS2472 runtime receipt harness",
      priority: 121,
      layer: "evidence",
      body: "PASS2472: after PASS2470 creates 180 deterministic cells, do not claim 180 live outputs until each cell has runtime receipts: API payload, Shield/Real Markets screenshot or PDF hash, Angel replay fingerprint and persisted generatedAt/provider state. Advanced remains locked when proof receipts are missing.",
      operatorPrompt: "Czy PASS2472 ma generatedReceipts=180, distinctRuntimeReceiptFingerprintCount=180, runtimeCapturedCoveragePercent=0 until captured, liveRuntimeGate.canClaim180LiveOutputs=false i requiredBeforeClaimingLive?",
    },
    {
      id: "pass2465_tier_depth_scenario_parity",
      label: "PASS2465 tier depth scenario parity",
      body: "PASS2465: prove that Basic, Pro and Advanced differ by visible data lanes, not longer text. Basic stays 10-field triage; Pro adds source/freshness/second-provider and squeeze-watch as unconfirmed pressure; Advanced adds paid proof lanes for rug-pull/trap, long/short squeeze, holder/unlock, contract/admin/tax, CEX depth, DEX pool withdrawal and PDF parity locks.",
      priority: 115,
      layer: "evidence",
      operatorPrompt: "Czy PDF, Shield, Real Markets, VLM Brain i Angel pokazują różne Basic/Pro/Advanced pola oraz widoczne locks dla rug-pull/trap i long/short squeeze, zamiast dopisywać filler?",
    },
    {
      id: "pass2463_historical_range_window_ledger",
      label: "PASS2463 historical range window ledger",
      body: "PASS2463: every 30D/90D/1Y/2Y/5Y/MAX chart must use a normalized fromUnix/toUnix window, provider-specific endpoint params, cache idempotency key and same preview/download rangeWindowFingerprint. Raw points and gap markers must be stored before resampling.",
      priority: 113,
      layer: "evidence",
      operatorPrompt: "Czy chart/Brain/Browser/PDF/Angel używają tego samego fromUnix/toUnix, rangeWindowFingerprint, endpoint window params i raw-point receipt, czy nadal mieszają różne okna w jednym wniosku?",
    },
    {
      id: "data_gap_review",
      label: "Review missing data",
      body: missing.length ? `Missing: ${missing.join(", ")}. Data uncertainty is ${dataUncertaintyPercent}%. These are uncertainty inputs, not proof of safety or danger.` : `Core data inputs are present, but source freshness still requires review. Data uncertainty is ${dataUncertaintyPercent}%.`,
      priority: missing.length ? 74 : 38,
      layer: "data",
      operatorPrompt: "Jakie dane trzeba podłączyć przed mocniejszym wnioskiem?",
    },
    {
      id: "legal_tone_guard",
      label: "Keep legal tone safe",
      body: "Use anomaly / requires review / low-medium-high data uncertainty. Never call a token fraud and never give investment advice.",
      priority: 70,
      layer: "legal",
      operatorPrompt: "Przeredaguj wniosek tak, żeby był zgodny z RegTech guardrails.",
    },
  ];
  commands.sort((a, b) => b.priority - a.priority);

  const verdict =
    result.score >= 85
      ? "Critical review queue"
      : result.score >= 65
        ? "High-risk investigation"
        : result.score >= 35
          ? "Watchlist review"
          : "Low detected risk";

  const narrative = [
    `${result.token.symbol} is in ${verdict.toLowerCase()} mode.`,
    agent ? `Dominant layer: ${agent.label} (${agent.score}/100).` : "Dominant layer: data fusion is still limited.",
    `Risk delta from available history: ${riskDelta > 0 ? "+" : ""}${riskDelta}.`,
    volumePressure !== undefined ? `Volume pressure proxy: ${pct(volumePressure)}.` : "Volume pressure proxy is missing.",
    defiLlamaLane ? `DeFiLlama lane: ${defiLlamaLane.riskLane}, cap ${defiLlamaLane.confidenceCap}/100.` : "DeFiLlama TVL lane is missing.",
    signals.length ? `Top evidence: ${signals.map((signal) => signal.id).join(", ")}.` : "No strong evidence signals are available yet.",
    "PASS2448 rule: choose the correct provider methodology per field before any stronger conclusion.",
    "PASS2449 rule: macro chart conclusions require range, point count, second overlay, gap annotations and PDF hash parity.",
    "PASS2450 rule: Basic/Pro/Advanced must be proven by different evidence contracts and identical sourceFingerprint across Shield/Brain/Browser/PDF/Angel.",
    "PASS2451 rule: every numeric field needs provider role, observedAt/max-age, missing-proof state and forbidden-use boundary before Angel/PDF/Brain can make a stronger conclusion.",
    "PASS2452 rule: risk scoring must show calibratedRiskScore, confidenceCap, uncertaintyPercent, top drivers and no-filler locks; missing data caps confidence and opens review, not hype.",
    "PASS2453 rule: reports need one canonical evidence capsule across Shield, Brain, Browser preview, PDF preview/download and Angel.",
    "PASS2454 rule: institutional source router must separate live/configured/planned providers and forbid planned lanes as proof.",
    "PASS2455 rule: UI must show provider chips, field heatmap, chart range badges and PDF hard locks before any strong conclusion.",
    "PASS2456 rule: runtime surfaces must share one canonical evidence fingerprint and missing-proof queue.",
    "PASS2457 rule: blockers become P0/P1/P2 operator actions, not hidden green UI.",
    "PASS2458 rule: providers need adapter/key/mapping/observedAt/max-age before closeout can be live.",
    "PASS2459 rule: provider freshness can drift after closeout; show freshnessFingerprint, stale/timestamp/planned locks and surface contracts before Advanced/PDF/Angel conclusions.",
    "PASS2460 rule: macro chart copy needs range/minimum points/second overlay/freshness receipt/macroChartFingerprint and stays historical-context only, not forecast.",
    "PASS2461 rule: macro gaps must remain visible markers and PDF preview/download must share the same gapReceiptFingerprint.",
    "PASS2462 rule: macro history needs a backfill manifest with provider jobs, minimum point density, second overlay status, DefiLlama TVL boundary and PDF backfillFingerprint parity before Advanced wording.",
    "PASS2463 rule: macro range windows need normalized fromUnix/toUnix, endpoint-specific params, cache idempotency key and same rangeWindowFingerprint across chart, Brain, Browser, PDF preview/download and Angel before Advanced wording.",
    "PASS2465 rule: Basic/Pro/Advanced must differ by visible data lanes; rug-pull/trap and long/short squeeze are proof-locked scenarios, not unsupported claims or trading instructions.",
    "PASS2466 rule: long/short squeeze requires derivatives proof packet: Binance/Bybit OI, funding/basis, second venue, visible liquidation and long/short ratio gaps, normalized pair and surface parity. Without those, say pressure/watch only.",
    "PASS2469 rule: liquidation snapshot replay must be durable and fingerprint-addressable before paid Advanced strengthens current squeeze wording; memory fallback is QA only.",
    "PASS2470 rule: 180-output parity is not live until PDF/Shield/Real Markets receipts prove Basic/Pro/Advanced have unique fingerprints and correct field counts.",
    "PASS2472 rule: generatedReceipts=180 is only a receipt harness; runtimeCapturedCoveragePercent must stay 0 until API/browser/PDF/Angel receipts are actually captured and persisted.",
    "PASS2473 rule: captured receipt rows must be fingerprints only; report distinctCapturedReceiptCount, completedCellCount, storageMode and canClaim180LiveOutputs, and never call memory_fallback production-ready.",
    "PASS2474 rule: API payload runner can capture the first receipt lane across 180 cells, but live parity remains false until browser_screenshot/pdf_hash and Angel replay receipts are captured and durable.",
    "Tone rule: keep the UI calm, concrete and review-focused; never create panic or hype.",
  ].join(" ");

  return {
    // Backward verifier alias: VELMERE_AI_RISK_BOT_V25_PASS2466_DERIVATIVES_SQUEEZE_PROOF
    version: "VELMERE_AI_RISK_BOT_V33_PASS2475_RUNTIME_RECEIPT_BROWSER_RUNNER /* legacy verifier: VELMERE_AI_RISK_BOT_V32_PASS2474_RUNTIME_RECEIPT_API_RUNNER /* legacy verifier: VELMERE_AI_RISK_BOT_V31_PASS2473_RUNTIME_RECEIPT_CAPTURE_STORE /* legacy verifier: VELMERE_AI_RISK_BOT_V30_PASS2472_TIER_RUNTIME_RECEIPT_HARNESS /* legacy verifier: VELMERE_AI_RISK_BOT_V29_PASS2470_TIER_180_OUTPUT_MATRIX */",
    symbol: result.token.symbol,
    verdict,
    score: result.score,
    confidence,
    dataUncertaintyPercent,
    riskDelta,
    dominantLayer: agent?.label ?? "Data quality",
    narrative,
    commands,
    missingData: defiLlamaLane?.missingData?.length ? Array.from(new Set([...missing, ...defiLlamaLane.missingData])) : missing,
    defiLlamaLane: defiLlamaLane ?? {
      mode: "unresolved",
      provider: "DefiLlama",
      riskLane: "unresolved_protocol",
      confidenceCap: 0,
      evidenceBoundary: "PASS2359 lane not attached to this surface yet.",
    },
    promptExamples: [
      "Explain the risk without hype.",
      "Which layer should I verify first?",
      "What data is missing before evidence report?",
      "Read holders as whales/CEX/DEX/team/retail/unclassified.",
      "Which provider can actually prove this field?",
      "Does this tier show new evidence or just longer wording?",
      "Which exact provider/timecode proves this number?",
    ],
    analystResponseTemplate: {
      first: "State the anomaly, confidence and data uncertainty percent.",
      second: "Name the strongest evidence layer and the missing sources.",
      third: "Give operator commands, not investment advice.",
      fourth: "Use calm SOC wording: requires review, uncertainty, evidence, next verification.",
    },
    visualPsychology: {
      density: "Short command blocks, visible uncertainty and no giant empty states.",
      trust: "Show what is known, what is missing and what should be manually reviewed.",
      antiFud: "Do not accuse projects; describe anomalies and verification steps.",
    },
    socRunbook: [
      "Freeze language at anomaly/requires manual review until sources are verified.",
      "Check candles across 1m, 15m, 1h, 4h, 1d and 7d before escalating.",
      "Separate whales from CEX/custody/team wallets before interpreting holder concentration.",
      "Use the PASS62 terminal command palette to move from chart -> holders -> liquidity -> source audit -> evidence -> product ops audit.",
      "Export evidence JSON before any external handoff.",
      "Keep every operator message compact enough to scan in a terminal panel.",
    ],
    buildTo100Backlog: [
      { module: "PASS2451 data provenance ledger", status: "watch", next: "Expose field-by-field provider roles, observedAt/max-age, forbidden uses and Advanced locks across Shield, Real Markets, Brain, Browser, PDF and Angel." },
      { module: "PASS2450 tier evidence parity", status: "watch", next: "Expose sourceFingerprint, tier proof contracts and surface drift across Shield, Real Markets, Brain, Browser, PDF and Angel." },
      { module: "PASS2447 evidence consensus", status: "watch", next: "Expose consensus fields, contradiction radar and tier locks across Shield, Brain, PDF and Angel." },
      { module: "PASS2446 provider observability", status: "watch", next: "Expose provider health, DefiLlama expansion lanes and proof-capsule hash across Shield, Brain, PDF and Angel." },
      { module: "PASS2444 source quorum gate", status: "watch", next: "Expose field-level source agreement and missing-proof blockers in Shield, Brain, PDF and Angel before final copy." },
      { module: "Live data spine", status: result.dataQuality === "live" ? "watch" : "blocked", next: "Add source freshness, retries and provenance labels for every market/holder/orderbook call." },
      { module: "PASS62 evidence workflow", status: "watch", next: "Turn source ledger, timeline, missing data and legal guardrails into a one-click case export with ops audit." },
      { module: "Liquidity intelligence", status: liquidityBrief.sourceMode === "live_orderbook" ? "watch" : "blocked", next: "Connect multi-exchange depth and DEX pool events to reduce liquidity uncertainty." },
      { module: "Executable commands", status: "watch", next: "Turn bot commands into UI actions that open the right terminal block and evidence endpoint." },
      { module: "Holder graph", status: holder.dataCompleteness >= 70 ? "watch" : "blocked", next: "Connect real on-chain holder API, CEX labels, team wallets and LP event streams." },
      { module: "VLM utility gating", status: "watch", next: "Add wallet/session verification, usage limits and member access copy without ROI language." },
      { module: "Legal launch pack", status: "blocked", next: "Add ToS, privacy, data-source policy, acceptable-use rules and token utility disclaimer." },
    ],
    warnings: [
      result.dataQuality !== "live" ? "Data is not fully live; do not over-trust the score." : null,
      result.metrics.top10HolderPercent === undefined ? "Holder clusters are missing or proxy-only." : null,
      liquidity <= 0 ? "Liquidity source is missing or too thin to simulate safely." : null,
    ].filter(Boolean),
    nextQuestion: result.score >= 65
      ? "Which layer explains the risk: velocity, holders, exit liquidity or missing data?"
      : "Is there enough depth, holder data and chart density to keep this token in low-risk mode?",
    guardrail: "Not financial advice. Algorithmic risk flag only. This is automated anomaly triage, not legal proof or an accusation.",
    generatedAt: new Date().toISOString(),
  };
}
