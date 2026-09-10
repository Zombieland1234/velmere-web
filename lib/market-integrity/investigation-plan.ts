import type { MarketRiskSnapshot } from "./market-memory";
import type { RiskAgentId, RiskSignalId, TokenRiskResult } from "./risk-types";

export type InvestigationPriority = "low" | "medium" | "high" | "critical";

export type InvestigationTask = {
  id: string;
  agent: RiskAgentId | "social" | "mempool" | "cross_chain" | "human_review";
  priority: InvestigationPriority;
  title: string;
  reason: string;
  requiredData: string[];
  status: "ready" | "requires_api" | "requires_human_review";
};

export type InvestigationPlan = {
  version: string;
  token: string;
  priority: InvestigationPriority;
  confidence: number;
  riskVelocity?: number;
  summary: string;
  tasks: InvestigationTask[];
  limitations: string[];
};

function priorityFromScore(score: number): InvestigationPriority {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function hasSignal(result: TokenRiskResult, id: RiskSignalId) {
  return result.signals.some((signal) => signal.id === id);
}

function riskVelocity(history: MarketRiskSnapshot[]) {
  if (history.length < 2) return undefined;
  const first = history[0];
  const last = history.at(-1)!;
  const hours = Math.max(1 / 60, (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 3_600_000);
  return Number(((last.score - first.score) / hours).toFixed(2));
}

export function buildInvestigationPlan(result: TokenRiskResult, history: MarketRiskSnapshot[] = []): InvestigationPlan {
  const tasks: InvestigationTask[] = [];
  const score = result.score;
  const confidence = result.confidence ?? 0.35;
  const velocity = riskVelocity(history);

  const add = (task: InvestigationTask) => {
    if (!tasks.some((item) => item.id === task.id)) tasks.push(task);
  };

  if (
    hasSignal(result, "parabolic_24h_gain") ||
    hasSignal(result, "parabolic_7d_gain") ||
    hasSignal(result, "parabolic_30d_gain") ||
    hasSignal(result, "multi_timeframe_pump")
  ) {
    add({
      id: "pump-velocity-review",
      agent: "velocity",
      priority: score >= 85 ? "critical" : "high",
      title: "Parabolic pump validation",
      reason: "Cena wykazuje gwałtowny wzrost w jednym lub wielu oknach czasowych. Trzeba odróżnić organiczny news od sztucznego pumpu.",
      requiredData: ["30d price history", "listing date", "news/social timeline", "exchange listing events"],
      status: "ready",
    });
    add({
      id: "social-onchain-correlation",
      agent: "social",
      priority: "high",
      title: "Social vs on-chain correlation",
      reason: "Przy parabolicznym wzroście trzeba sprawdzić, czy hype społecznościowy pojawił się przed ruchem, czy dopiero po zakupach dużych portfeli.",
      requiredData: ["X/Twitter mentions", "Telegram/Discord timeline", "large buys before social spike"],
      status: "requires_api",
    });
  }

  if (
    hasSignal(result, "thin_liquidity") ||
    hasSignal(result, "very_thin_liquidity") ||
    hasSignal(result, "low_dex_liquidity") ||
    hasSignal(result, "wash_trading_risk") ||
    hasSignal(result, "market_volume_stress")
  ) {
    add({
      id: "liquidity-depth-simulation",
      agent: "liquidity",
      priority: score >= 65 ? "high" : "medium",
      title: "Liquidity and slippage simulation",
      reason: "Market cap lub wolumen może wyglądać mocno, ale realna płynność może być zbyt cienka do wyjścia z pozycji.",
      requiredData: ["DEX liquidity", "CEX order book depth", "$10k/$50k sell simulation", "volume/market cap ratio"],
      status: "ready",
    });
  }

  if (
    hasSignal(result, "orderbook_slippage_risk") ||
    hasSignal(result, "orderbook_imbalance") ||
    hasSignal(result, "orderbook_depth_collapse")
  ) {
    add({
      id: "microstructure-spoofing-watch",
      agent: "microstructure",
      priority: "high",
      title: "Order book spoofing and depth watch",
      reason: "Order book pokazuje poślizg, asymetrię lub spadek głębokości. To może wskazywać na iluzję płynności.",
      requiredData: ["order book snapshots", "cancel/execute ratio", "bid-ask walls", "spread history"],
      status: "requires_api",
    });
  }

  if (
    hasSignal(result, "holder_concentration") ||
    hasSignal(result, "supply_overhang") ||
    hasSignal(result, "fdv_marketcap_gap") ||
    hasSignal(result, "exchange_deposit_anomaly")
  ) {
    add({
      id: "holder-cluster-review",
      agent: "holders",
      priority: score >= 65 ? "high" : "medium",
      title: "Holder cluster and supply review",
      reason: "Koncentracja podaży albo duża różnica FDV/market cap może oznaczać ryzyko zrzutu podaży przez małą grupę adresów.",
      requiredData: ["top holders", "funding source graph", "CEX deposit flows", "vesting schedule"],
      status: "requires_api",
    });
  }

  if (
    hasSignal(result, "honeypot_risk") ||
    hasSignal(result, "high_sell_tax") ||
    hasSignal(result, "mint_risk") ||
    hasSignal(result, "blacklist_risk") ||
    hasSignal(result, "contract_privileges")
  ) {
    add({
      id: "contract-security-escalation",
      agent: "contract",
      priority: "critical",
      title: "Smart contract security escalation",
      reason: "Wykryto flagi kontraktu: honeypot, podatki, mint, blacklist, pause lub inne uprawnienia ownera.",
      requiredData: ["verified source code", "bytecode", "owner/admin functions", "sell simulation"],
      status: "requires_human_review",
    });
  }

  if (confidence < 0.45 || hasSignal(result, "insufficient_data")) {
    add({
      id: "data-quality-hardening",
      agent: "data",
      priority: "medium",
      title: "Data quality hardening",
      reason: "Brak danych nie oznacza bezpieczeństwa. Wynik ma ograniczoną pewność i wymaga lepszych źródeł.",
      requiredData: ["contract address", "chain", "holders", "liquidity", "order book", "historical snapshots"],
      status: "ready",
    });
  }

  if (score >= 85) {
    add({
      id: "human-forensic-review",
      agent: "human_review",
      priority: "critical",
      title: "Manual forensic review",
      reason: "Meta-score jest krytyczny. Automatyczny sygnał powinien trafić do człowieka przed publiczną interpretacją.",
      requiredData: ["full evidence bundle", "timestamps", "source links", "on-chain transaction list"],
      status: "requires_human_review",
    });
  }

  if (!tasks.length) {
    add({
      id: "baseline-monitoring",
      agent: "data",
      priority: "low",
      title: "Baseline monitoring",
      reason: "Brak dużych anomalii w aktualnie podłączonych źródłach. System powinien kontynuować cykliczny monitoring.",
      requiredData: ["next market sweep", "risk memory snapshots"],
      status: "ready",
    });
  }

  const priority = tasks.some((task) => task.priority === "critical")
    ? "critical"
    : tasks.some((task) => task.priority === "high")
      ? "high"
      : priorityFromScore(score);

  return {
    version: "velmere-shield-investigation-plan-v1",
    token: result.token.symbol,
    priority,
    confidence,
    riskVelocity: velocity,
    summary:
      priority === "critical"
        ? "Wymagana eskalacja: system wykrył krytyczną kombinację sygnałów lub ryzyko kontraktu."
        : priority === "high"
          ? "Wymagany głębszy review: wykryto istotne sygnały rynkowe, płynnościowe lub podażowe."
          : priority === "medium"
            ? "Monitoring rozszerzony: token ma sygnały do obserwacji albo ograniczoną jakość danych."
            : "Monitoring bazowy: brak dużych anomalii w aktualnie podłączonych źródłach.",
    tasks: tasks.sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      return rank[b.priority] - rank[a.priority];
    }),
    limitations: [
      "To nie jest dowód prawny, oskarżenie ani porada inwestycyjna.",
      "Automatyczny scoring zależy od jakości publicznych API i dostępności danych.",
      "Pełna wersja instytucjonalna wymaga holder clustering, social NLP, mempool telemetry i cross-chain graph analysis.",
    ],
  };
}
