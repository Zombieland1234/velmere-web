import type { Pass4588HonestCloseoutPlan } from "./market-data-sanity-presentation";

export const PASS4589_EXECUTION_PROOF_LADDER_CONTRACT = {
  passId: "PASS4589",
  purpose:
    "Turn the honest 100% blocker into an operator-ready proof ladder: each missing live claim receipt becomes a named lane with a command, UI posture and hard fail-closed status.",
  publicTopkaLiveAllowed: false,
  rule:
    "Public 100% remains blocked until every lane is executed and archived: npm/build/typecheck, provider smoke, mobile screenshots, payment entitlement replay and security receipt proof.",
} as const;

export type Pass4589ProofLaneKey =
  | "build"
  | "provider"
  | "mobile"
  | "payment"
  | "security";

export type Pass4589ProofLaneStatus = "executed" | "prepared" | "blocked";
export type Pass4589ProofStage = "visual-ready" | "operator-ready" | "receipt-collecting" | "live-claim-ready";

export type Pass4589ProofLane = {
  key: Pass4589ProofLaneKey;
  label: string;
  status: Pass4589ProofLaneStatus;
  command: string;
  blocks: string;
  weight: number;
};

export type Pass4589ExecutionProofLadder = {
  stage: Pass4589ProofStage;
  operatorScore: number;
  liveClaimCeiling: number;
  conceptCeiling: number;
  label: string;
  body: string;
  action: string;
  command: string;
  lanes: Pass4589ProofLane[];
  executedLanes: number;
  preparedLanes: number;
  blockedLanes: number;
  canClaimLive100: boolean;
};

export function buildPass4589ExecutionProofLadder(args: {
  closeout: Pick<Pass4588HonestCloseoutPlan, "conceptCeiling" | "liveClaimCeiling" | "missingProofs" | "canClaimLive100">;
  staticSyntaxProbeReady?: boolean;
  localRunnerPrepared?: boolean;
  buildReceipt?: boolean;
  providerSmoke?: boolean;
  mobileScreenshots?: boolean;
  paymentReplay?: boolean;
  securityProof?: boolean;
  locale: "pl" | "de" | "en";
}): Pass4589ExecutionProofLadder {
  const l = args.locale;
  const laneBase: Array<{
    key: Pass4589ProofLaneKey;
    receipt: boolean | undefined;
    preparedFallback: boolean;
    label: [string, string, string];
    command: string;
    blocks: [string, string, string];
    weight: number;
  }> = [
    {
      key: "build",
      receipt: args.buildReceipt,
      preparedFallback: Boolean(args.staticSyntaxProbeReady),
      label: ["Build/typecheck", "Build/Typecheck", "Build/typecheck"],
      command: "npm ci && npm run typecheck && npm run build",
      blocks: ["claim 100% aplikacji", "100%-App-Claim", "100% app claim"],
      weight: 22,
    },
    {
      key: "provider",
      receipt: args.providerSmoke,
      preparedFallback: false,
      label: ["Provider smoke", "Provider-Smoke", "Provider smoke"],
      command: "npm run smoke:routes && npm run verify:pass4589-live-proof-ladder",
      blocks: ["live dane", "Live-Daten", "live data"],
      weight: 20,
    },
    {
      key: "mobile",
      receipt: args.mobileScreenshots,
      preparedFallback: Boolean(args.localRunnerPrepared),
      label: ["Mobile screenshot QA", "Mobile-Screenshot-QA", "Mobile screenshot QA"],
      command: "npx playwright test --project=chromium --grep @mobile",
      blocks: ["publiczne demo mobile", "öffentliches Mobile-Demo", "public mobile demo"],
      weight: 18,
    },
    {
      key: "payment",
      receipt: args.paymentReplay,
      preparedFallback: false,
      label: ["Payment replay", "Payment-Replay", "Payment replay"],
      command: "npm run verify:stripe-advanced-entitlement-proof",
      blocks: ["paid Advanced", "Paid Advanced", "paid Advanced"],
      weight: 20,
    },
    {
      key: "security",
      receipt: args.securityProof,
      preparedFallback: false,
      label: ["Security receipt", "Security-Receipt", "Security receipt"],
      command: "npm run verify:secret-redaction-static && npm run verify:pass4562-public-proof-audit-trail",
      blocks: ["topka świata live", "Top-Live-Claim", "world-class live claim"],
      weight: 20,
    },
  ];

  const languageIndex = l === "pl" ? 0 : l === "de" ? 1 : 2;
  const lanes: Pass4589ProofLane[] = laneBase.map((lane) => ({
    key: lane.key,
    label: lane.label[languageIndex],
    status: lane.receipt ? "executed" : lane.preparedFallback ? "prepared" : "blocked",
    command: lane.command,
    blocks: lane.blocks[languageIndex],
    weight: lane.weight,
  }));

  const executedLanes = lanes.filter((lane) => lane.status === "executed").length;
  const preparedLanes = lanes.filter((lane) => lane.status === "prepared").length;
  const blockedLanes = lanes.filter((lane) => lane.status === "blocked").length;
  const executedWeight = lanes.reduce((sum, lane) => sum + (lane.status === "executed" ? lane.weight : lane.status === "prepared" ? lane.weight * 0.42 : 0), 0);
  const operatorScore = Math.max(0, Math.min(100, Math.round(args.closeout.conceptCeiling * 0.28 + args.closeout.liveClaimCeiling * 0.34 + executedWeight * 0.38)));
  const canClaimLive100 = args.closeout.canClaimLive100 && blockedLanes === 0 && preparedLanes === 0;
  const stage: Pass4589ProofStage = canClaimLive100
    ? "live-claim-ready"
    : executedLanes > 0
      ? "receipt-collecting"
      : preparedLanes > 0
        ? "operator-ready"
        : "visual-ready";

  const label = stage === "live-claim-ready"
    ? (l === "pl" ? "Proof komplet" : l === "de" ? "Proof komplett" : "Proof complete")
    : stage === "receipt-collecting"
      ? (l === "pl" ? "Zbieranie receiptów" : l === "de" ? "Receipts sammeln" : "Collecting receipts")
      : stage === "operator-ready"
        ? (l === "pl" ? "Runner gotowy" : l === "de" ? "Runner bereit" : "Runner ready")
        : (l === "pl" ? "Dowody przed 100" : l === "de" ? "Proof vor 100" : "Proof before 100");

  const body = stage === "live-claim-ready"
    ? (l === "pl" ? "Wszystkie lane mają receipt; live 100 może wyjść publicznie." : l === "de" ? "Alle Lanes haben Receipts; Live 100 darf öffentlich stehen." : "Every lane has a receipt; live 100 can be public.")
    : stage === "receipt-collecting"
      ? (l === "pl" ? "Część dowodów już jest; brakujące lane dalej blokują publiczne 100%." : l === "de" ? "Ein Teil der Beweise ist da; fehlende Lanes blockieren weiter 100%." : "Some proof exists; missing lanes still block public 100%.")
      : stage === "operator-ready"
        ? (l === "pl" ? "UI jest blisko, teraz operator ma odpalić proof-runner i zebrać receipt." : l === "de" ? "Die UI ist nah dran; jetzt muss der Operator den Proof-Runner ausführen." : "The UI is close; the operator must run the proof runner and archive receipts.")
        : (l === "pl" ? "Wygląd można dociągać, ale 100% live czeka na wykonane dowody." : l === "de" ? "Optik kann weiter reifen, aber Live 100 wartet auf ausgeführte Proofs." : "Visuals can keep improving, but live 100 waits for executed proof.");

  const action = stage === "live-claim-ready"
    ? (l === "pl" ? "publikuj z receipt" : l === "de" ? "mit Receipt publizieren" : "publish with receipt")
    : stage === "visual-ready"
      ? (l === "pl" ? "najpierw przygotuj runner" : l === "de" ? "erst Runner vorbereiten" : "prepare runner first")
      : (l === "pl" ? "odpal lane po lane" : l === "de" ? "Lane für Lane ausführen" : "run lane by lane");

  const firstBlocked = lanes.find((lane) => lane.status !== "executed");

  return {
    stage,
    operatorScore,
    liveClaimCeiling: args.closeout.liveClaimCeiling,
    conceptCeiling: args.closeout.conceptCeiling,
    label,
    body,
    action,
    command: firstBlocked?.command ?? "archive-release-receipt",
    lanes,
    executedLanes,
    preparedLanes,
    blockedLanes,
    canClaimLive100,
  };
}
