import type { Pass2500EntitlementIncidentResponseDisclosureLock } from "./entitlement-incident-response-disclosure-lock";

export const PASS2501_MASTER_MAP_REBALANCE_AUDIT_ID = "master-map-rebalance-audit-v1" as const;

export type Pass2501SurfaceId =
  | "master_txt"
  | "browser_pdf"
  | "shield_map"
  | "angel_ux"
  | "cart_wallet_checkout"
  | "real_markets_data"
  | "shield_modal_table"
  | "visual_globe"
  | "security_entitlement";

export type Pass2501SurfaceState = "rebalanced" | "active_next" | "watch" | "cooldown" | "blocked";

export type Pass2501SurfaceAuditLane = {
  id: Pass2501SurfaceId;
  label: string;
  state: Pass2501SurfaceState;
  progressPercent: number;
  priorityRank: number;
  recentTunnelRisk: "low" | "medium" | "high";
  evidenceRule: string;
  nextActions: string[];
};

export type Pass2501MasterMapRebalanceAudit = {
  id: typeof PASS2501_MASTER_MAP_REBALANCE_AUDIT_ID;
  state: "rebalance_active" | "needs_operator_review" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  antiTunnelCooldownEnforced: boolean;
  entitlementBranchCooldown: boolean;
  restoredExpandedProgressTxt: boolean;
  minimumNonEntitlementLanesPerPass: number;
  selectedNonEntitlementFocus: Pass2501SurfaceId[];
  lockedOutForNextPass: Pass2501SurfaceId[];
  surfaceLanes: Pass2501SurfaceAuditLane[];
  nextImplementationQueue: string[];
  progressMatrixDelta: Array<{ lane: Pass2501SurfaceId; before: number; after: number; reason: string }>;
  pass2500IncidentGuard?: {
    available: boolean;
    finalPaidIncidentResponseAllowed: boolean;
    note: string;
  };
  masterTxtRules: string[];
  fingerprint: string;
};

function clean(value?: string | null) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 80) || "unknown";
}

function lane(id: Pass2501SurfaceId, label: string, progressPercent: number, priorityRank: number, nextActions: string[], state: Pass2501SurfaceState = "active_next", recentTunnelRisk: Pass2501SurfaceAuditLane["recentTunnelRisk"] = "low"): Pass2501SurfaceAuditLane {
  return {
    id,
    label,
    state,
    progressPercent,
    priorityRank,
    recentTunnelRisk,
    evidenceRule: "Do not mark this lane complete from entitlement/security work. It needs direct UI/runtime/data evidence and a TXT progress delta.",
    nextActions,
  };
}

export function buildPass2501MasterMapRebalanceAudit(args: {
  query?: string | null;
  symbol?: string | null;
  pass2500?: Pass2500EntitlementIncidentResponseDisclosureLock | null;
  recentPassWindow?: string[];
}): Pass2501MasterMapRebalanceAudit {
  const query = clean(args.query || args.symbol || "velmere");
  const symbol = clean(args.symbol || args.query || "VLM").toUpperCase();
  const recentPassWindow = args.recentPassWindow?.length ? args.recentPassWindow : ["PASS2490", "PASS2491", "PASS2492", "PASS2493", "PASS2494", "PASS2495", "PASS2496", "PASS2497", "PASS2498", "PASS2499", "PASS2500"];
  const entitlementTunnelCount = recentPassWindow.filter((item) => /249\d|2500/i.test(item)).length;
  const entitlementBranchCooldown = entitlementTunnelCount >= 5;

  const surfaceLanes: Pass2501SurfaceAuditLane[] = [
    lane("master_txt", "Expanded master TXT progress map", 92, 1, [
      "Restore the full expanded progress TXT after the short PASS2499 report regression.",
      "Every pass must append: before audit, chosen lanes, implemented changes, QA, next lanes, and percent deltas.",
      "Keep an anti-tunnel line that blocks more than 2 consecutive passes in the same branch unless P0.",
    ], "rebalanced"),
    lane("browser_pdf", "Browser/Lens/PDF preview/download parity", 45, 2, [
      "Browser public result should be compact: price, market cap, 24h change, source and PDF CTA; no 10-line wall.",
      "Preview payload and downloaded PDF payload must share the same manifest/hash.",
      "PL/EN/DE PDF text needs debug/KERNEL/string-mix scan before paid copy.",
    ]),
    lane("shield_map", "Shield Map identity, logo, and simplified analysis UX", 35, 3, [
      "Fix missing logos in Shield Map search suggestions and active asset tile.",
      "Stop duplicate label patterns such as Solana SOL (SOL).",
      "Add a simple active context rail before Orbit/analysis so Angel knows selected asset and module.",
    ]),
    lane("angel_ux", "Angel active context badge and evidence-first UX", 58, 4, [
      "Show active context badge: Shield / Real Markets / Audit / Browser / Account / Store.",
      "Delay visible answer enough to show thinking animation, but do not fake evidence.",
      "Lead every market/audit answer with missing proof lanes before narrative.",
    ]),
    lane("cart_wallet_checkout", "Cart, wallet drawer, Stripe/BLIK demo checkout", 42, 5, [
      "Remove invisible overlay click blockers in cart/menu/wallet popups.",
      "Unify slide animation timing with rounded drawer geometry and click-outside close.",
      "Stripe test mode card/BLIK service checkout should create server-side entitlement only after webhook/replay.",
    ]),
    lane("real_markets_data", "Real Markets SEC/Companyfacts and second-provider data", 46, 6, [
      "Hydrate AAPL/NVDA/SPY with SEC CIK/submissions/companyfacts/XBRL freshness.",
      "Separate stock/ETF/fundamental proof from crypto holder/DEX copy.",
      "Add stale/second-provider banner when quote/fundamental sources disagree.",
    ]),
    lane("shield_modal_table", "Shield modal/table runtime and chart polish", 68, 7, [
      "Re-test wheel zoom/drag/pinch so chart does not scroll background page.",
      "Triple-state sort must remain stable after row/modal interactions.",
      "Risk strip and Basic/Pro/Advanced cards must be one contained modal path.",
    ], "watch"),
    lane("visual_globe", "Visual globe/atelier map refinement", 28, 8, [
      "Use screenshot-first audit before changing globe position/continents again.",
      "Remove top/bottom bands, sharpen continent mask, and add user-approved markers only after visual confirmation.",
      "Keep globe separate from data/security passes to avoid accidental regressions.",
    ], "watch"),
    lane("security_entitlement", "Security/entitlement chain", 91, 9, [
      "Cooldown: only patch when another lane needs it or a P0 appears.",
      "Run regression verifiers but do not spend the next pass on entitlement-only work.",
      "Keep wallet connect as identity only and paid Advanced as server entitlement only.",
    ], entitlementBranchCooldown ? "cooldown" : "watch", "high"),
  ];

  const selectedNonEntitlementFocus = surfaceLanes
    .filter((item) => item.id !== "security_entitlement" && item.state !== "watch")
    .sort((a, b) => a.priorityRank - b.priorityRank)
    .slice(0, 5)
    .map((item) => item.id);

  const nextImplementationQueue = surfaceLanes
    .filter((item) => selectedNonEntitlementFocus.includes(item.id))
    .flatMap((item) => item.nextActions.slice(0, 2))
    .slice(0, 10);

  const fingerprint = `PASS2501-${[query, symbol, selectedNonEntitlementFocus.join("-"), entitlementBranchCooldown ? "ENTITLEMENT-COOLDOWN" : "BALANCED"].map(clean).join("-").toUpperCase()}`.slice(0, 180);

  return {
    id: PASS2501_MASTER_MAP_REBALANCE_AUDIT_ID,
    state: "rebalance_active",
    query,
    symbol,
    generatedAt: new Date().toISOString(),
    antiTunnelCooldownEnforced: true,
    entitlementBranchCooldown,
    restoredExpandedProgressTxt: true,
    minimumNonEntitlementLanesPerPass: 3,
    selectedNonEntitlementFocus,
    lockedOutForNextPass: entitlementBranchCooldown ? ["security_entitlement"] : [],
    surfaceLanes,
    nextImplementationQueue,
    progressMatrixDelta: [
      { lane: "master_txt", before: 20, after: 92, reason: "Restored full expanded TXT map after PASS2499 short-report regression." },
      { lane: "browser_pdf", before: 45, after: 47, reason: "Promoted to next implementation lane with explicit preview/download parity acceptance criteria." },
      { lane: "shield_map", before: 35, after: 37, reason: "Promoted to next implementation lane with logo/name/active-context acceptance criteria." },
      { lane: "angel_ux", before: 58, after: 60, reason: "Promoted active context badge and evidence-first answer contract." },
      { lane: "cart_wallet_checkout", before: 42, after: 44, reason: "Promoted overlay/animation/Stripe demo blockers back into active queue." },
      { lane: "security_entitlement", before: 91, after: 91, reason: "No further entitlement-only progress counted; branch is in cooldown." },
    ],
    pass2500IncidentGuard: {
      available: Boolean(args.pass2500),
      finalPaidIncidentResponseAllowed: Boolean(args.pass2500?.finalPaidIncidentResponseAllowed),
      note: "PASS2501 does not weaken PASS2500. It prevents entitlement/security from monopolizing the next implementation passes.",
    },
    masterTxtRules: [
      "Every pass starts by reading the expanded TXT/master map and latest ZIP, then choosing at least 3 non-entitlement lanes unless a P0 security incident exists.",
      "Every pass appends new ideas and missing work to the TXT before closing the ZIP.",
      "A progress percentage can move only when code/TXT/QA changed for that lane; security work cannot increase UI/PDF/cart/globe percentages.",
      "Next passes should rotate Browser/PDF, Shield Map, Angel UX, cart/wallet/checkout, Real Markets data, and visual polish.",
    ],
    fingerprint,
  };
}
