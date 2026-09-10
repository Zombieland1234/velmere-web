import { JSON_CONTROL_NO_DELETE_PATTERN } from "./ascii-control-characters";

import { parseStrictJsonText } from "./strict-json-boundary";
import { sha256Digest } from "./cryptographic-digest";
import { detectP78Erc2771MulticallContext, type P78Erc2771MulticallResult, type P78SourceFile } from "./erc2771-multicall-context-detector";
import { buildVerifiedSolidityAnalysisCorpus, parseVerifiedSoliditySourceBundle } from "./verified-solidity-source-bundle";
import type { AuditReviewSubmission } from "./audit-review-flow";
import {
  readPass2572AuditProviderPrivateStaticEvidence,
  type Pass2572AuditProviderRuntimeReport,
} from "./audit-provider-runtime-client";
import type { Pass2574AuditClaimLedgerReport, Pass2574EvidenceGrade } from "./audit-claim-ledger";
import type { Pass2575AuditSourceFreshnessReport } from "./audit-source-freshness";

export const PASS2576_AUDIT_PERMISSION_PARSER_ID = "audit-permission-parser" as const;

export type Pass2576PermissionCategory =
  | "ownership"
  | "admin_roles"
  | "mint_supply"
  | "pause_freeze"
  | "blacklist_blocklist"
  | "upgrade_proxy"
  | "tax_fee"
  | "trading_limits"
  | "rescue_sweep"
  | "permit_approval"
  | "context_integrity";

export type Pass2576PermissionState =
  | "detected"
  | "not_detected"
  | "unknown"
  | "blocked"
  | "not_applicable";

export type Pass2576PermissionSeverity = "info" | "watch" | "elevated" | "critical";

export type Pass2576PermissionSignal = {
  id: string;
  category: Pass2576PermissionCategory;
  label: string;
  state: Pass2576PermissionState;
  severity: Pass2576PermissionSeverity;
  matchedPatterns: string[];
  evidence: string[];
  missing: string[];
  riskDelta: number;
  confidenceDelta: number;
  basicLine: string;
  proPdfLine: string;
  advancedAction: string;
  canShowInBasic: boolean;
  requiresPro: boolean;
};

export type Pass2576AuditPermissionParserReport = {
  passId: typeof PASS2576_AUDIT_PERMISSION_PARSER_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  advancedRule: string;
  parserMode: string;
  summary: {
    totalSignals: number;
    detected: number;
    notDetected: number;
    unknown: number;
    blocked: number;
    elevatedOrCritical: number;
    riskDelta: number;
    confidenceDelta: number;
    basicVisible: number;
    proRequired: number;
  };
  basicRows: Array<{ label: string; status: Pass2576PermissionState; severity: Pass2576PermissionSeverity; output: string }>;
  proPdfRows: Array<{ label: string; status: Pass2576PermissionState; severity: Pass2576PermissionSeverity; output: string }>;
  advancedQueue: string[];
  signals: Pass2576PermissionSignal[];
};

export type Pass2576VerifiedStaticEvidence = {
  contractAddress: string;
  chain: string;
  provider: string;
  observedAt: string;
  responseDigest: string;
  sourceText?: string;
  abiText?: string;
  bytecodeText?: string;
};

type PermissionParserInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  sourceText?: string;
  abiText?: string;
  bytecodeText?: string;
  verifiedStaticEvidence?: Pass2576VerifiedStaticEvidence | null;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  claimLedger?: Pass2574AuditClaimLedgerReport | null;
  sourceFreshness?: Pass2575AuditSourceFreshnessReport | null;
};

type PatternSpec = {
  id: string;
  category: Pass2576PermissionCategory;
  label: string;
  severity: Pass2576PermissionSeverity;
  patterns: RegExp[];
  fallbackRisk: number;
  requiresPro?: boolean;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeText(value: unknown, max = 80_000) {
  if (typeof value !== "string") return "";
  return value.replace(JSON_CONTROL_NO_DELETE_PATTERN, " ").slice(0, max);
}

type TrustedParserCorpus = {
  corpus: string;
  sourceValid: boolean;
  sourceComplete: boolean;
  sourceFormat: string;
  sourceDigest: string | null;
  sourceFiles: P78SourceFile[];
  abiValid: boolean;
  bytecodeValid: boolean;
};

const SELECTOR_SIGNATURES: Record<string, string> = {
  "8da5cb5b": "owner()",
  f2fde38b: "transferOwnership(address)",
  "715018a6": "renounceOwnership()",
  "8456cb59": "pause()",
  "3f4ba83a": "unpause()",
  "40c10f19": "mint(address,uint256)",
  "3659cfe6": "upgradeTo(address)",
  "4f1ef286": "upgradeToAndCall(address,bytes)",
  "5c60da1b": "implementation()",
  f851a440: "admin()",
  "2f2ff15d": "grantRole(bytes32,address)",
  d547741f: "revokeRole(bytes32,address)",
  "91d14854": "hasRole(bytes32,address)",
};

function verifiedAbiCorpus(value: unknown) {
  const raw = safeText(value, 400_000);
  if (!raw.trim()) return "";
  try {
    const parsed = parseStrictJsonText(raw, { maxBytes: 400_000, maxDepth: 32, maxNodes: 50_000, requireObject: false }) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { abi?: unknown }).abi)
        ? (parsed as { abi: unknown[] }).abi
        : [];
    const functions = items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { type?: unknown; name?: unknown; inputs?: unknown };
      if (record.type !== "function" || typeof record.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(record.name)) return [];
      const inputs = Array.isArray(record.inputs)
        ? record.inputs.map((entry) => entry && typeof entry === "object" ? String((entry as { type?: unknown }).type ?? "unknown") : "unknown")
        : [];
      return [`function ${record.name}(${inputs.join(",")})`];
    });
    return functions.join("\n").slice(0, 120_000);
  } catch {
    return "";
  }
}

function verifiedBytecodeCorpus(value: unknown) {
  const raw = safeText(value, 160_000).trim().toLowerCase();
  if (!/^0x(?:[a-f0-9]{2}){16,}$/.test(raw)) return { valid: false, corpus: "" };
  const corpus = Object.entries(SELECTOR_SIGNATURES)
    .filter(([selector]) => raw.includes(selector))
    .map(([, signature]) => `function ${signature}`)
    .join("\n");
  return { valid: true, corpus };
}

function verifiedStaticEvidence(input: PermissionParserInput) {
  const privateProviderEvidence = readPass2572AuditProviderPrivateStaticEvidence(input.providerRuntime);
  const evidence: Pass2576VerifiedStaticEvidence | null | undefined = input.verifiedStaticEvidence ?? (privateProviderEvidence && input.providerRuntime
    ? {
        contractAddress: privateProviderEvidence.contractAddress,
        chain: input.providerRuntime.target.chain,
        provider: privateProviderEvidence.provider,
        observedAt: privateProviderEvidence.observedAt,
        responseDigest: privateProviderEvidence.responseDigest,
        sourceText: privateProviderEvidence.sourceText,
        abiText: privateProviderEvidence.abiText,
      }
    : null);
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain;
  if (
    !evidence ||
    !contractAddress ||
    !/^0x[a-fA-F0-9]{40}$/.test(evidence.contractAddress) ||
    evidence.contractAddress.toLowerCase() !== contractAddress.toLowerCase() ||
    !chain || evidence.chain.trim().toLowerCase() !== chain.trim().toLowerCase() ||
    !evidence.provider.trim() ||
    !Number.isFinite(Date.parse(evidence.observedAt)) ||
    !/^(?:sha256:)?[a-fA-F0-9]{64}$/.test(evidence.responseDigest)
  ) return null;
  return evidence;
}

/**
 * Only syntactically validated raw source, ABI and deployed-bytecode fields enter
 * the parser. Provider claims, missing lists, customer copy, PDF copy, URLs and
 * adapter descriptions are deliberately excluded: they are prose, not evidence.
 */
function trustedSourceCorpus(input: PermissionParserInput): TrustedParserCorpus {
  const raw = verifiedStaticEvidence(input);
  const sourceBundle = parseVerifiedSoliditySourceBundle(raw?.sourceText);
  const sourceAnalysis = buildVerifiedSolidityAnalysisCorpus(sourceBundle, 1_600_000);
  const abi = verifiedAbiCorpus(raw?.abiText);
  const bytecode = verifiedBytecodeCorpus(raw?.bytecodeText);
  return {
    corpus: [sourceAnalysis.corpus, abi, bytecode.corpus].filter(Boolean).join("\n").slice(0, 1_800_000),
    sourceValid: sourceBundle.valid && Boolean(sourceAnalysis.corpus),
    sourceComplete: sourceBundle.valid && sourceBundle.complete && sourceAnalysis.complete,
    sourceFormat: sourceBundle.format,
    sourceDigest: sourceBundle.sourceDigest,
    sourceFiles: sourceBundle.valid ? sourceBundle.files : [],
    abiValid: Boolean(abi),
    bytecodeValid: bytecode.valid,
  };
}

const SPECS: PatternSpec[] = [
  {
    id: "owner-control",
    category: "ownership",
    label: "Owner / ownership control",
    severity: "watch",
    fallbackRisk: 8,
    patterns: [/\bowner\s*\(/i, /\bonlyOwner\b/i, /\bOwnable\b/i, /\btransferOwnership\b/i, /\brenounceOwnership\b/i],
  },
  {
    id: "admin-roles",
    category: "admin_roles",
    label: "Admin roles / role-based control",
    severity: "elevated",
    fallbackRisk: 12,
    patterns: [/DEFAULT_ADMIN_ROLE/i, /\bAccessControl\b/i, /\bgrantRole\b/i, /\brevokeRole\b/i, /\bhasRole\b/i, /\badmin\b/i],
    requiresPro: true,
  },
  {
    id: "mint-supply",
    category: "mint_supply",
    label: "Mint / supply expansion",
    severity: "elevated",
    fallbackRisk: 14,
    patterns: [/\bmint\s*\(/i, /\b_mint\s*\(/i, /MINTER_ROLE/i, /increaseSupply/i, /setSupply/i],
    requiresPro: true,
  },
  {
    id: "pause-freeze",
    category: "pause_freeze",
    label: "Pause / freeze controls",
    severity: "elevated",
    fallbackRisk: 13,
    patterns: [/\bpause\s*\(/i, /\bunpause\s*\(/i, /\bPausable\b/i, /freeze/i, /frozen/i],
    requiresPro: true,
  },
  {
    id: "blacklist-blocklist",
    category: "blacklist_blocklist",
    label: "Blacklist / blocklist controls",
    severity: "critical",
    fallbackRisk: 18,
    patterns: [/blacklist/i, /blocklist/i, /denylist/i, /isBlacklisted/i, /setBlacklist/i, /blockedAddress/i],
    requiresPro: true,
  },
  {
    id: "upgrade-proxy",
    category: "upgrade_proxy",
    label: "Proxy / upgradeability",
    severity: "critical",
    fallbackRisk: 20,
    patterns: [/\bproxy\b/i, /upgradeTo/i, /upgradeToAndCall/i, /implementation\s*\(/i, /UUPSUpgradeable/i, /TransparentUpgradeableProxy/i, /delegatecall/i],
    requiresPro: true,
  },
  {
    id: "tax-fee",
    category: "tax_fee",
    label: "Tax / fee controls",
    severity: "watch",
    fallbackRisk: 10,
    patterns: [/setFee/i, /setTax/i, /buyTax/i, /sellTax/i, /feeRecipient/i, /excludeFromFee/i, /_tax/i, /\btax\b/i],
    requiresPro: true,
  },
  {
    id: "trading-limits",
    category: "trading_limits",
    label: "Trading limits / transfer restrictions",
    severity: "watch",
    fallbackRisk: 9,
    patterns: [/maxTx/i, /maxWallet/i, /tradingEnabled/i, /enableTrading/i, /cooldown/i, /transferLimit/i, /limitsInEffect/i],
    requiresPro: true,
  },
  {
    id: "rescue-sweep",
    category: "rescue_sweep",
    label: "Rescue / sweep functions",
    severity: "watch",
    fallbackRisk: 8,
    patterns: [/rescueToken/i, /sweep/i, /withdrawStuck/i, /recoverERC20/i, /emergencyWithdraw/i],
    requiresPro: true,
  },
  {
    id: "permit-approval",
    category: "permit_approval",
    label: "Permit / approval surface",
    severity: "info",
    fallbackRisk: 3,
    patterns: [/\bpermit\s*\(/i, /EIP712/i, /DOMAIN_SEPARATOR/i, /increaseAllowance/i, /decreaseAllowance/i],
  },
];

function statusWord(locale: string, state: Pass2576PermissionState) {
  if (state === "detected") return t(locale, "wykryto", "erkannt", "detected");
  if (state === "not_detected") return t(locale, "nie wykryto", "nicht erkannt", "not detected");
  if (state === "blocked") return t(locale, "zablokowane", "blockiert", "blocked");
  if (state === "not_applicable") return t(locale, "nie dotyczy", "nicht zutreffend", "not applicable");
  return t(locale, "niepewne", "unklar", "unknown");
}

function lineFor(locale: string, spec: PatternSpec, state: Pass2576PermissionState, matched: string[]) {
  if (state === "detected") {
    return t(
      locale,
      `${spec.label}: wykryto sygnał (${matched.slice(0, 2).join(", ")}). Pro powinien potwierdzić zakres uprawnień przed mocnym werdyktem.`,
      `${spec.label}: Signal erkannt (${matched.slice(0, 2).join(", ")}). Pro sollte den Berechtigungsumfang bestätigen.`,
      `${spec.label}: signal detected (${matched.slice(0, 2).join(", ")}). Pro should confirm permission scope before a strong verdict.`,
    );
  }
  if (state === "not_detected") {
    return t(
      locale,
      `${spec.label}: nie wykryto w dostępnych danych, ale brak pełnego source/ABI może ograniczać pewność.`,
      `${spec.label}: in verfuegbaren Daten nicht erkannt, aber fehlende Source/ABI kann Confidence begrenzen.`,
      `${spec.label}: not detected in available data, but missing full source/ABI can limit confidence.`,
    );
  }
  if (state === "blocked") {
    return t(
      locale,
      `${spec.label}: parser czeka na explorer/source API lub pełny ABI.`,
      `${spec.label}: Parser wartet auf Explorer/Source API oder volles ABI.`,
      `${spec.label}: parser is waiting for explorer/source API or full ABI.`,
    );
  }
  return t(
    locale,
    `${spec.label}: brak wystarczających danych do potwierdzenia lub wykluczenia.`,
    `${spec.label}: nicht genug Daten fuer Bestaetigung oder Ausschluss.`,
    `${spec.label}: not enough evidence to confirm or exclude.`,
  );
}

function safePatternEvidence(specId: string, matchedPatterns: string[], sourceDigest: string | null) {
  return matchedPatterns.slice(0, 4).map((pattern, index) =>
    `verified-static-pattern:${specId}:${index + 1}:${sha256Digest(`${sourceDigest ?? "no-source-digest"}|${specId}|${pattern}`).replace(/^sha256:/, "").slice(0, 20)}`
  );
}

function contextIntegritySignal(locale: string, trusted: TrustedParserCorpus): Pass2576PermissionSignal | null {
  if (!trusted.sourceValid || trusted.sourceFiles.length === 0) return null;
  const detector: P78Erc2771MulticallResult = detectP78Erc2771MulticallContext(trusted.sourceFiles);
  if (detector.classification !== "SOURCE_PATTERN_RISK_SIGNAL") return null;
  const evidence = detector.evidence.slice(0, 8).map((item) =>
    `verified-source-ref:${item.kind}:${sha256Digest(`${trusted.sourceDigest ?? "no-source-digest"}|${item.path}|${item.line}|${item.kind}`).replace(/^sha256:/, "").slice(0, 24)}`
  );
  return {
    id: "erc2771-multicall-context-integrity",
    category: "context_integrity",
    label: "ERC2771 + Multicall forwarded-context integrity",
    state: "detected",
    severity: "elevated",
    matchedPatterns: [
      "ERC2771 + Multicall composition",
      "raw self-delegatecall multicall",
      "no recognized source-level mitigation",
    ],
    evidence,
    missing: [
      "exact deployed bytecode binding",
      "trusted-forwarder runtime state at an exact block",
      "independent fork/replay adjudication of affected privileges",
    ],
    riskDelta: 18,
    confidenceDelta: 4,
    basicLine: t(
      locale,
      "Zweryfikowane źródło zawiera historyczny wzorzec ryzyka ERC2771 + Multicall. To nie jest jeszcze dowód exploitability aktualnego deploymentu.",
      "Die verifizierte Source enthält das historische ERC2771 + Multicall Risikomuster. Das ist noch kein Beweis für Exploitability des aktuellen Deployments.",
      "Verified source contains the historical ERC2771 + Multicall risk pattern. This is not yet proof that the current deployment is exploitable.",
    ),
    proPdfLine: `ERC2771+Multicall context-integrity; state=detected; severity=elevated; sourceFormat=${trusted.sourceFormat}; sourceComplete=${trusted.sourceComplete}; trustedForwarderRuntimeState=${detector.trustedForwarderRuntimeState}; exploitabilityProven=false; evidenceRefs=${evidence.join(",") || "none"}`,
    advancedAction: t(
      locale,
      "Automatycznie związać exact deployed bytecode, current trusted-forwarder state i fork/replay z tym samym evidence snapshotem przed eskalacją severity lub FINAL.",
      "Exact deployed Bytecode, aktuellen Trusted-Forwarder-State und Fork/Replay automatisiert an denselben Evidence-Snapshot binden, bevor Severity oder FINAL eskaliert werden.",
      "Automatically bind exact deployed bytecode, current trusted-forwarder state and fork/replay to the same evidence snapshot before escalating severity or FINAL.",
    ),
    canShowInBasic: true,
    requiresPro: true,
  };
}

function confidenceState(input: PermissionParserInput, trusted: TrustedParserCorpus) {
  const explorer = input.providerRuntime?.lanes.find((lane) => /explorer|source|abi/i.test(`${lane.id} ${lane.label} ${lane.provider}`));
  const hasRaw = trusted.sourceValid || trusted.abiValid || trusted.bytecodeValid;
  const hasCompleteStaticScope = trusted.sourceValid && trusted.sourceComplete && trusted.abiValid;
  const blocked = !hasRaw && Boolean(explorer?.state === "blocked" || explorer?.state === "error" || explorer?.state === "timeout");
  return { hasRaw, hasCompleteStaticScope, blocked, explorerState: explorer?.state };
}

export function buildPass2576AuditPermissionParserReport(input: PermissionParserInput): Pass2576AuditPermissionParserReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName;
  const trusted = trustedSourceCorpus(input);
  const corpus = trusted.corpus;
  const availability = confidenceState(input, trusted);

  const baseSignals: Pass2576PermissionSignal[] = SPECS.map((spec) => {
    const matchedPatterns = spec.patterns
      .filter((pattern) => pattern.test(corpus))
      .map((pattern) => pattern.source.replace(/\\b|\\s\*|\\\(|\(\?:|\)|\[/g, "").slice(0, 42))
      .slice(0, 6);
    const evidence = safePatternEvidence(spec.id, matchedPatterns, trusted.sourceDigest);
    const state: Pass2576PermissionState = matchedPatterns.length
      ? "detected"
      : availability.blocked
        ? "blocked"
        : availability.hasCompleteStaticScope
          ? "not_detected"
          : "unknown";
    const riskDelta = state === "detected" ? spec.fallbackRisk : state === "unknown" ? 3 : state === "blocked" ? 2 : 0;
    const confidenceDelta = state === "detected" ? 8 : state === "not_detected" ? 4 : state === "blocked" ? -8 : -12;
    const basicLine = lineFor(locale, spec, state, matchedPatterns.length ? matchedPatterns : [statusWord(locale, state)]);
    const proPdfLine = `${spec.label}; state=${state}; severity=${spec.severity}; riskDelta=${riskDelta}; confidenceDelta=${confidenceDelta}; matches=${matchedPatterns.join(", ") || "none"}; explorerState=${availability.explorerState ?? "none"}`;
    const advancedAction = state === "detected"
      ? t(locale, "Zmapować kto może użyć funkcji, czy jest timelock/multisig i czy funkcja wpływa na user funds.", "Pruefen wer die Funktion nutzen kann, Timelock/Multisig und User-Fund Impact.", "Map who can call it, whether timelock/multisig exists and whether it can affect user funds.")
      : state === "not_detected"
        ? t(locale, "Zachować jako nie wykryto tylko z zakresem źródła i timestampem.", "Nur mit Source-Scope und Timestamp als nicht erkannt behalten.", "Keep as not detected only with source scope and timestamp.")
        : t(locale, "Pobrać pełne source/ABI z explorera przed finalnym PDF.", "Volle Source/ABI vom Explorer vor finalem PDF holen.", "Fetch full source/ABI from explorer before final PDF.");
    return {
      id: spec.id,
      category: spec.category,
      label: spec.label,
      state,
      severity: spec.severity,
      matchedPatterns,
      evidence,
      missing: state === "detected" ? [] : ["full source/ABI scope confirmation", "second-source confirmation for Pro"],
      riskDelta,
      confidenceDelta,
      basicLine,
      proPdfLine,
      advancedAction,
      canShowInBasic: state === "detected" || state === "not_detected" || state === "blocked",
      requiresPro: spec.requiresPro === true || state === "detected" || state === "unknown",
    };
  });
  const contextSignal = contextIntegritySignal(locale, trusted);
  const signals: Pass2576PermissionSignal[] = contextSignal ? [contextSignal, ...baseSignals] : baseSignals;

  const detected = signals.filter((signal) => signal.state === "detected").length;
  const notDetected = signals.filter((signal) => signal.state === "not_detected").length;
  const unknown = signals.filter((signal) => signal.state === "unknown").length;
  const blocked = signals.filter((signal) => signal.state === "blocked").length;
  const elevatedOrCritical = signals.filter((signal) => signal.state === "detected" && (signal.severity === "elevated" || signal.severity === "critical")).length;
  const riskDelta = clamp(signals.reduce((sum, signal) => sum + signal.riskDelta, 0), 0, 100);
  const confidenceDelta = clamp(signals.reduce((sum, signal) => sum + signal.confidenceDelta, 0), -45, 45);

  return {
    passId: PASS2576_AUDIT_PERMISSION_PARSER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2576 dodaje permission parser: owner, admin roles, mint, pause/freeze, blacklist, proxy, tax, transfer limits i rescue functions nie mogą być opisane bez source/ABI boundary.",
      "PASS2576 fuegt Permission Parser hinzu: Owner, Admin Roles, Mint, Pause/Freeze, Blacklist, Proxy, Tax, Transfer Limits und Rescue Functions brauchen Source/ABI Boundary.",
      "PASS2576 adds a permission parser: owner, admin roles, mint, pause/freeze, blacklist, proxy, tax, transfer limits and rescue functions require a source/ABI boundary.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje tylko customer-safe sygnały permissions i jasno mówi, kiedy potrzeba Pro do mapy uprawnień.",
      "Basic zeigt nur customer-safe Permission-Signale und markiert klar, wann Pro fuer die Permission Map noetig ist.",
      "Basic shows customer-safe permission signals only and clearly marks when Pro is needed for the permission map.",
    ),
    proRule: t(
      locale,
      "Pro PDF zapisuje permission map z risk delta, confidence delta, source scope i brakami do potwierdzenia.",
      "Pro PDF speichert Permission Map mit Risk Delta, Confidence Delta, Source Scope und fehlenden Bestaetigungen.",
      "Pro PDF records the permission map with risk delta, confidence delta, source scope and missing confirmations.",
    ),
    advancedRule: t(
      locale,
      "Advanced automatycznie rozwiązuje caller control, timelock/multisig, user-fund impact i zgodność z dokumentacją; human review pozostaje tylko opcjonalnym QA poza entitlementem.",
      "Advanced löst Caller Control, Timelock/Multisig, User-Fund Impact und Docs-Konsistenz automatisiert; Human Review bleibt optionales QA außerhalb des Entitlements.",
      "Advanced automatically resolves caller control, timelock/multisig, user-fund impact and docs consistency; human review remains optional QA outside the entitlement.",
    ),
    parserMode: "passive fail-closed static parser; identity-bound private source/ABI only; plain Solidity plus bounded Etherscan standard-json multi-file normalization; public evidence uses digests/pattern refs, never raw source/ABI; no exploit instructions; no active testing",
    summary: {
      totalSignals: signals.length,
      detected,
      notDetected,
      unknown,
      blocked,
      elevatedOrCritical,
      riskDelta,
      confidenceDelta,
      basicVisible: signals.filter((signal) => signal.canShowInBasic).length,
      proRequired: signals.filter((signal) => signal.requiresPro).length,
    },
    basicRows: signals
      .filter((signal) => signal.canShowInBasic)
      .slice(0, 11)
      .map((signal) => ({ label: signal.label, status: signal.state, severity: signal.severity, output: signal.basicLine })),
    proPdfRows: signals.slice(0, 12).map((signal) => ({
      label: signal.label,
      status: signal.state,
      severity: signal.severity,
      output: signal.proPdfLine,
    })),
    advancedQueue: signals
      .filter((signal) => signal.requiresPro || signal.state === "detected" || signal.state === "unknown" || signal.state === "blocked")
      .slice(0, 12)
      .map((signal) => `${signal.label}: ${signal.advancedAction}`),
    signals,
  };
}

export function gradeFromPermissionState(state: Pass2576PermissionState): Pass2574EvidenceGrade {
  if (state === "detected" || state === "not_detected") return "partial";
  if (state === "blocked") return "blocked";
  if (state === "not_applicable") return "confirmed";
  return "missing";
}
