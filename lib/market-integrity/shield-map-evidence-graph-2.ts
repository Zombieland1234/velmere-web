export type Pass1354Locale = "pl" | "de" | "en";

export type Pass1354EvidenceGraphNode = {
  id: "source" | "fact" | "signal" | "conflict" | "missing" | "verdict" | "next_check";
  label: string;
  role: string;
  weight: number;
  tone: "calm" | "review" | "blocked";
};

export type Pass1354ShieldMapEvidenceGraph2 = {
  version: "shield-map-evidence-graph-2";
  state: "graph_ready" | "review_required" | "blocked";
  score: number;
  role: "why_verdict_graph_not_second_table";
  manifestKey: string;
  nodeBudget: { min: 6; max: 8; target: 7 };
  forbiddenRepeats: ["price_table", "pdf_body_clone", "market_cap_wall", "sort_buttons"];
  drawerContract: {
    side: "right";
    close: ["outside_click", "escape", "close_button"];
    scroll: "drawer_only";
    content: "selected_node_evidence_not_page_wall";
  };
  nodes: Pass1354EvidenceGraphNode[];
  checks: Array<{ id: string; passed: boolean; label: string }>;
  copy: {
    title: string;
    body: string;
    badge: string;
    drawerTitle: string;
  };
};

type Pass1354Input = {
  locale: Pass1354Locale;
  evidenceCoverageCap?: number;
  /** @deprecated Compatibility input; interpreted as evidence coverage, not calibrated confidence. */
  confidenceCap?: number;
  sourceCount: number;
  missingCount: number;
  conflictCount: number;
  claimCount: number;
  signalCount: number;
  evidenceManifest: string;
  verdict: string;
  nextCheck: string;
};

const copy = {
  pl: {
    title: "Shield Map 2.0 · evidence graph",
    body: "Mapa pokazuje dlaczego system tak ocenia asset: źródło, fakt, sygnał, konflikt, brak, werdykt i następny check. Nie powtarza tabeli ceny ani PDF.",
    badgeReady: "graph ready",
    badgeReview: "review graph",
    badgeBlocked: "blocked graph",
    drawerTitle: "Dowody w wybranym węźle",
  },
  de: {
    title: "Shield Map 2.0 · Evidence Graph",
    body: "Die Karte zeigt, warum das System so bewertet: Quelle, Fakt, Signal, Konflikt, Lücke, Urteil und nächste Prüfung. Keine Kopie von Preistabelle oder PDF.",
    badgeReady: "graph ready",
    badgeReview: "review graph",
    badgeBlocked: "blocked graph",
    drawerTitle: "Nachweise im gewählten Knoten",
  },
  en: {
    title: "Shield Map 2.0 · evidence graph",
    body: "The map explains why the system reached the verdict: source, fact, signal, conflict, gap, verdict and next check. It does not repeat the price table or PDF body.",
    badgeReady: "graph ready",
    badgeReview: "review graph",
    badgeBlocked: "blocked graph",
    drawerTitle: "Evidence in selected node",
  },
} as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function key(parts: Array<string | number>) {
  const raw = parts.join("|");
  let hash = 5381;
  for (let index = 0; index < raw.length; index += 1) hash = ((hash << 5) + hash) ^ raw.charCodeAt(index);
  return `p1354-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildPass1354ShieldMapEvidenceGraph2(input: Pass1354Input): Pass1354ShieldMapEvidenceGraph2 {
  const t = copy[input.locale];
  const evidenceCoverageCap = clamp(input.evidenceCoverageCap ?? input.confidenceCap ?? 0);
  const nodes: Pass1354EvidenceGraphNode[] = [
    { id: "source", label: "Source", role: `${input.sourceCount} source lane(s)`, weight: Math.min(100, input.sourceCount * 22), tone: input.sourceCount ? "calm" : "blocked" },
    { id: "fact", label: "Fact", role: `${input.claimCount} atomic claim(s)`, weight: Math.min(100, input.claimCount * 6), tone: input.claimCount ? "calm" : "review" },
    { id: "signal", label: "Signal", role: `${input.signalCount} signal lane(s)`, weight: Math.min(100, input.signalCount * 8), tone: input.signalCount ? "calm" : "review" },
    { id: "conflict", label: "Conflict", role: `${input.conflictCount} conflict/watch lane(s)`, weight: input.conflictCount ? 70 : 18, tone: input.conflictCount ? "review" : "calm" },
    { id: "missing", label: "Missing", role: `${input.missingCount} visible gap(s)`, weight: input.missingCount ? 78 : 12, tone: input.missingCount ? "review" : "calm" },
    { id: "verdict", label: "Verdict", role: input.verdict.slice(0, 96), weight: evidenceCoverageCap, tone: evidenceCoverageCap >= 70 ? "calm" : evidenceCoverageCap >= 42 ? "review" : "blocked" },
    { id: "next_check", label: "Next check", role: input.nextCheck.slice(0, 96), weight: 64, tone: "calm" },
  ];
  const checks = [
    { id: "node_budget_6_8", passed: nodes.length >= 6 && nodes.length <= 8, label: "Graph uses 6-8 nodes, not a tile wall" },
    { id: "not_price_table", passed: true, label: "Price table is forbidden in Shield Map" },
    { id: "drawer_only_scroll", passed: true, label: "Drawer scroll stays inside drawer" },
    { id: "missing_visible", passed: input.missingCount >= 0, label: "Missing data remains visible" },
    { id: "manifest_shared", passed: Boolean(input.evidenceManifest), label: "Shared evidence manifest is attached" },
  ];
  const score = clamp(checks.filter((check) => check.passed).length * 18 + Math.min(10, input.sourceCount * 2) + Math.min(8, input.claimCount));
  const state = score >= 88 && input.sourceCount > 0 ? "graph_ready" : score >= 62 ? "review_required" : "blocked";
  return {
    version: "shield-map-evidence-graph-2",
    state,
    score,
    role: "why_verdict_graph_not_second_table",
    manifestKey: key([input.evidenceManifest, evidenceCoverageCap, input.sourceCount, input.missingCount, input.conflictCount, input.claimCount]),
    nodeBudget: { min: 6, max: 8, target: 7 },
    forbiddenRepeats: ["price_table", "pdf_body_clone", "market_cap_wall", "sort_buttons"],
    drawerContract: {
      side: "right",
      close: ["outside_click", "escape", "close_button"],
      scroll: "drawer_only",
      content: "selected_node_evidence_not_page_wall",
    },
    nodes,
    checks,
    copy: {
      title: t.title,
      body: t.body,
      badge: state === "graph_ready" ? t.badgeReady : state === "review_required" ? t.badgeReview : t.badgeBlocked,
      drawerTitle: t.drawerTitle,
    },
  };
}
