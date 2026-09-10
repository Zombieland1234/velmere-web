export type Pass2884DependencyRealityState =
  | "external_dependency_tree_missing"
  | "internal_alias_compatibility_missing"
  | "typecheck_probe_still_blocked"
  | "build_input_gate_ready"
  | "clean_build_ready";

export type Pass2884DependencySurface =
  | "node_modules_install"
  | "package_lock_integrity"
  | "internal_compatibility_aliases"
  | "typecheck_first_error_digest"
  | "runtime_visual_queue"
  | "production_claim_copy";

export type Pass2884DependencyFinding = {
  readonly surface: Pass2884DependencySurface;
  readonly severity: "P0" | "P1" | "P2";
  readonly status: "blocked" | "repaired_static" | "needs_install" | "needs_runtime_evidence" | "ready";
  readonly evidence: string;
  readonly nextProof: string;
};

export type Pass2884DependencyRealityBuildInputGate = {
  readonly pass: 2884;
  readonly state: Pass2884DependencyRealityState;
  readonly hardRule: string;
  readonly canClaimCleanTypecheck: boolean;
  readonly canClaimCleanBuild: boolean;
  readonly internalAliasCompatibilityReady: boolean;
  readonly externalDependencyTreeInstalled: boolean;
  readonly packageLockPresent: boolean;
  readonly repairedAliases: readonly string[];
  readonly externalPackagesRequired: readonly string[];
  readonly findings: readonly Pass2884DependencyFinding[];
  readonly acceptanceGates: readonly string[];
  readonly nextPassRecommendation: string;
};

export const PASS2884_REPAIRED_INTERNAL_ALIASES = [
  "@/lib/market-integrity/live-market",
  "@/lib/market-integrity/market-data",
  "@/lib/market-integrity/real-market-vlm-risk",
  "@/lib/security/api-guards",
  "@/lib/security/rate-limit",
] as const;

export const PASS2884_EXTERNAL_PACKAGES_REQUIRED = [
  "next",
  "react",
  "react-dom",
  "next-intl",
  "lucide-react",
  "@stripe/stripe-js",
  "stripe",
  "@supabase/supabase-js",
  "@tanstack/react-query",
  "wagmi",
  "viem",
  "zustand",
  "tailwindcss",
  "typescript",
  "@types/node",
  "@types/react",
  "@types/react-dom",
] as const;

export const PASS2884_DEPENDENCY_REALITY_FINDINGS: readonly Pass2884DependencyFinding[] = [
  {
    surface: "internal_compatibility_aliases",
    severity: "P0",
    status: "repaired_static",
    evidence: "PASS2884 restored stale internal import paths for live-market, market-data, real-market-vlm-risk, api-guards and rate-limit by forwarding them to canonical modules.",
    nextProof: "After npm ci, rerun typecheck and confirm these five internal alias paths no longer appear as Cannot find module blockers.",
  },
  {
    surface: "node_modules_install",
    severity: "P0",
    status: "needs_install",
    evidence: "The delivered ZIP intentionally does not carry node_modules; typecheck still cannot resolve Next/React/jsx-runtime/lucide/next-intl/Stripe/wagmi/zustand until dependencies are installed from package-lock.json.",
    nextProof: "Run npm ci in the project root, preserve npm ci log/hash, then run npm run typecheck and npm run build.",
  },
  {
    surface: "package_lock_integrity",
    severity: "P0",
    status: "ready",
    evidence: "package-lock.json is present and can be hashed as the build input source of truth.",
    nextProof: "Attach package-lock hash and npm ci receipt to release evidence board before production claim.",
  },
  {
    surface: "typecheck_first_error_digest",
    severity: "P0",
    status: "blocked",
    evidence: "Typecheck remains blocked by missing external dependency tree in this container artifact; project-level strict errors cannot be trusted yet.",
    nextProof: "After dependency install, generate first 100 TypeScript errors and split true code defects from external missing packages.",
  },
  {
    surface: "runtime_visual_queue",
    severity: "P1",
    status: "needs_runtime_evidence",
    evidence: "Shield charts/table, Real Markets icon/chart skeletons, PDF tier parity and mobile QA remain the next visible runtime queue after dependency install.",
    nextProof: "Run screenshot/DOM smoke for Shield rows >10, right-side chart skeleton/source chart, Real Markets icon coverage, BTC/AAPL tier matrix and mobile modals.",
  },
  {
    surface: "production_claim_copy",
    severity: "P0",
    status: "blocked",
    evidence: "Velmère can still claim near-world-class architecture, not clean production, until PASS2884 build input gates produce npm ci/typecheck/build receipts.",
    nextProof: "Only flip production copy after dependency install, typecheck, build, route smoke and visual runtime evidence pass.",
  },
] as const;

export const PASS2884_DEPENDENCY_REALITY_ACCEPTANCE_GATES = [
  "PASS2884 gate 1: Internal alias compatibility must be restored before useful TypeScript triage; stale imports may not be mixed with true dependency failures.",
  "PASS2884 gate 2: node_modules is not shipped in the ZIP; clean typecheck/build cannot be claimed until npm ci is executed from package-lock.json in the receiving environment.",
  "PASS2884 gate 3: package-lock hash and npm ci receipt are production build inputs and must be preserved before public launch claims.",
  "PASS2884 gate 4: After install, typecheck must be rerun and the first-error digest must exclude PASS2884 internal alias paths.",
  "PASS2884 gate 5: Shield/Real Markets/PDF/mobile runtime fixes remain blocked behind dependency install evidence, but their QA queue must stay P0/P1, not optional polish.",
] as const;

export function buildPass2884DependencyRealityBuildInputGate(input?: {
  readonly externalDependencyTreeInstalled?: boolean;
  readonly packageLockPresent?: boolean;
  readonly internalAliasCompatibilityReady?: boolean;
}): Pass2884DependencyRealityBuildInputGate {
  const externalDependencyTreeInstalled = input?.externalDependencyTreeInstalled ?? false;
  const packageLockPresent = input?.packageLockPresent ?? true;
  const internalAliasCompatibilityReady = input?.internalAliasCompatibilityReady ?? true;

  let state: Pass2884DependencyRealityState;
  if (!internalAliasCompatibilityReady) state = "internal_alias_compatibility_missing";
  else if (!externalDependencyTreeInstalled) state = "external_dependency_tree_missing";
  else state = "typecheck_probe_still_blocked";

  return {
    pass: 2884,
    state,
    hardRule: "PASS2884: Dependency/build input reality must be separated from product code reality; internal stale aliases are repaired, but clean typecheck/build remain blocked until npm ci restores the external dependency tree and produces receipts.",
    canClaimCleanTypecheck: false,
    canClaimCleanBuild: false,
    internalAliasCompatibilityReady,
    externalDependencyTreeInstalled,
    packageLockPresent,
    repairedAliases: PASS2884_REPAIRED_INTERNAL_ALIASES,
    externalPackagesRequired: PASS2884_EXTERNAL_PACKAGES_REQUIRED,
    findings: PASS2884_DEPENDENCY_REALITY_FINDINGS,
    acceptanceGates: PASS2884_DEPENDENCY_REALITY_ACCEPTANCE_GATES,
    nextPassRecommendation: "PASS2885 should run/prepare install receipts and then attack the first true TypeScript errors plus Shield/Real Markets visible chart/icon runtime fixes.",
  };
}

export const PASS2884_DEPENDENCY_REALITY_BUILD_INPUT_GATE_FIXTURE = buildPass2884DependencyRealityBuildInputGate();
