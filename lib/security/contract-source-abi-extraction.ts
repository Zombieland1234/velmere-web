import { C0_OR_TEMPLATE_META_PATTERN, JSON_CONTROL_NO_DELETE_PATTERN } from "./ascii-control-characters";

import { parseStrictJsonText } from "./strict-json-boundary";
import { buildVerifiedSolidityAnalysisCorpus, parseVerifiedSoliditySourceBundle } from "./verified-solidity-source-bundle";
import type { AuditReviewSubmission } from "./audit-review-flow";
import {
  readPass2572AuditProviderPrivateStaticEvidence,
  type Pass2572AuditProviderRuntimeReport,
} from "./audit-provider-runtime-client";
import type { Pass2576AuditPermissionParserReport, Pass2576VerifiedStaticEvidence } from "./audit-permission-parser";
import type { Pass2582RealProviderAdapterHardeningReport } from "./real-provider-adapter-hardening";

export const PASS2583_CONTRACT_SOURCE_ABI_EXTRACTION_ID = "contract-source-abi-extraction" as const;

export type Pass2583ExtractionState =
  | "verified"
  | "partial"
  | "queued"
  | "missing_input"
  | "needs_key"
  | "blocked";

export type Pass2583FunctionRisk =
  | "owner_control"
  | "admin_role"
  | "mint_supply"
  | "pause_freeze"
  | "blacklist_blocklist"
  | "proxy_upgrade"
  | "tax_fee"
  | "trading_limit"
  | "rescue_sweep"
  | "permit_approval"
  | "unknown";

export type Pass2583FunctionSurface = {
  name: string;
  canonicalSignature: string;
  selector: string;
  selectorState: "known" | "queued" | "not_applicable";
  source: "abi" | "source" | "bytecode";
  mutability: "view" | "pure" | "payable" | "nonpayable" | "unknown";
  visibility: "public" | "external" | "internal" | "private" | "unknown";
  riskFamily: Pass2583FunctionRisk;
  customerSafeLine: string;
  proPdfLine: string;
  operatorAction: string;
};

export type Pass2583ProxyHint = {
  id: string;
  label: string;
  state: "detected" | "not_detected" | "unknown" | "blocked";
  evidence: string[];
  missing: string[];
  customerLine: string;
  proPdfLine: string;
  operatorAction: string;
};

export type Pass2583ExtractionRow = {
  label: string;
  state: Pass2583ExtractionState;
  output: string;
};

export type Pass2583ContractSourceAbiExtractionReport = {
  passId: typeof PASS2583_CONTRACT_SOURCE_ABI_EXTRACTION_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
    chainId: string;
  };
  rule: string;
  customerRule: string;
  proRule: string;
  operatorRule: string;
  extractionContract: {
    schemaVersion: string;
    explorerSourceRule: string;
    abiRule: string;
    selectorRule: string;
    proxyRule: string;
    safetyBoundary: string;
  };
  sourceGate: {
    state: Pass2583ExtractionState;
    verified: boolean;
    sourceAvailable: boolean;
    abiAvailable: boolean;
    bytecodeAvailable: boolean;
    compilerVersion?: string;
    proxyLike: boolean;
    confidenceCap: number;
    output: string;
  };
  functionSurfaces: Pass2583FunctionSurface[];
  proxyHints: Pass2583ProxyHint[];
  summary: {
    totalFunctions: number;
    ownerAdminFunctions: number;
    supplyControlFunctions: number;
    transferRestrictionFunctions: number;
    proxyUpgradeFunctions: number;
    customerVisibleRows: number;
    /** PASS4143 compatibility alias for unresolved/queued permission extraction surfaces. */
    queued: number;
    proOnlyRows: number;
    operatorActions: number;
    extractionReadiness: number;
    nextCriticalStep: string;
    canFeedPermissionParser: boolean;
    canFinalSignFromStaticExtraction: boolean;
  };
  publicRows: Pass2583ExtractionRow[];
  proPdfRows: Pass2583ExtractionRow[];
  operatorRows: Pass2583ExtractionRow[];
  nextImplementationBacklog: string[];
};

type BuilderInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  sourceText?: string;
  abiText?: string;
  bytecodeText?: string;
  verifiedStaticEvidence?: Pass2576VerifiedStaticEvidence | null;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
  permissionParser?: Pass2576AuditPermissionParserReport | null;
  realProviderAdapterHardening?: Pass2582RealProviderAdapterHardeningReport | null;
};

const CHAIN_ID_BY_NAME: Record<string, string> = {
  eth: "1",
  ethereum: "1",
  mainnet: "1",
  bsc: "56",
  binance: "56",
  bnb: "56",
  polygon: "137",
  matic: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  avalanche: "43114",
  avax: "43114",
  fantom: "250",
  linea: "59144",
  mantle: "5000",
};

const KNOWN_SELECTORS: Record<string, string> = {
  "owner()": "0x8da5cb5b",
  "transferOwnership(address)": "0xf2fde38b",
  "renounceOwnership()": "0x715018a6",
  "pause()": "0x8456cb59",
  "unpause()": "0x3f4ba83a",
  "mint(address,uint256)": "0x40c10f19",
  "burn(uint256)": "0x42966c68",
  "approve(address,uint256)": "0x095ea7b3",
  "transfer(address,uint256)": "0xa9059cbb",
  "transferFrom(address,address,uint256)": "0x23b872dd",
  "allowance(address,address)": "0xdd62ed3e",
  "balanceOf(address)": "0x70a08231",
  "totalSupply()": "0x18160ddd",
  "symbol()": "0x95d89b41",
  "name()": "0x06fdde03",
  "decimals()": "0x313ce567",
  "upgradeTo(address)": "0x3659cfe6",
  "upgradeToAndCall(address,bytes)": "0x4f1ef286",
  "implementation()": "0x5c60da1b",
  "admin()": "0xf851a440",
  "grantRole(bytes32,address)": "0x2f2ff15d",
  "revokeRole(bytes32,address)": "0xd547741f",
  "renounceRole(bytes32,address)": "0x36568abe",
  "hasRole(bytes32,address)": "0x91d14854",
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(C0_OR_TEMPLATE_META_PATTERN, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function safeText(value: unknown, max = 400_000) {
  if (typeof value !== "string") return "";
  return value.replace(JSON_CONTROL_NO_DELETE_PATTERN, " ").slice(0, max);
}

function chainIdFrom(chain: string | undefined) {
  const normalized = String(chain || "ethereum").trim().toLowerCase();
  return CHAIN_ID_BY_NAME[normalized] || (/^\d+$/.test(normalized) ? normalized : "1");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function abiItems(abiText: string): Array<Record<string, unknown>> {
  if (!abiText.trim()) return [];
  try {
    const parsed = parseStrictJsonText(abiText, { maxBytes: 400_000, maxDepth: 32, maxNodes: 50_000, requireObject: false });
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { abi?: unknown }).abi)
        ? (parsed as { abi: unknown[] }).abi
        : [];
    return items.filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      if (record.type !== "function") return false;
      return typeof record.name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(record.name) && Array.isArray(record.inputs);
    });
  } catch {
    return [];
  }
  return [];
}

function verifiedSourceText(value: unknown) {
  const bundle = parseVerifiedSoliditySourceBundle(value);
  if (!bundle.valid || !bundle.complete) return "";
  const analysis = buildVerifiedSolidityAnalysisCorpus(bundle, 1_600_000);
  return analysis.complete ? analysis.corpus : "";
}

function verifiedBytecode(value: unknown) {
  const raw = safeText(value, 180_000).trim().toLowerCase();
  return /^0x(?:[a-f0-9]{2}){16,}$/.test(raw) ? raw : "";
}

function identityBoundStaticEvidence(input: BuilderInput, contractAddress: string | undefined, chain: string) {
  const privateProviderEvidence = readPass2572AuditProviderPrivateStaticEvidence(input.providerRuntime);
  const evidence: Pass2576VerifiedStaticEvidence | null | undefined = input.verifiedStaticEvidence ?? (privateProviderEvidence
    ? {
        contractAddress: privateProviderEvidence.contractAddress,
        chain,
        provider: privateProviderEvidence.provider,
        observedAt: privateProviderEvidence.observedAt,
        responseDigest: privateProviderEvidence.responseDigest,
        sourceText: privateProviderEvidence.sourceText,
        abiText: privateProviderEvidence.abiText,
      }
    : null);
  if (
    !evidence ||
    !contractAddress ||
    !/^0x[a-fA-F0-9]{40}$/.test(evidence.contractAddress) ||
    evidence.contractAddress.toLowerCase() !== contractAddress.toLowerCase() ||
    evidence.chain.trim().toLowerCase() !== chain.trim().toLowerCase() ||
    !evidence.provider.trim() ||
    !Number.isFinite(Date.parse(evidence.observedAt)) ||
    !/^(?:sha256:)?[a-fA-F0-9]{64}$/.test(evidence.responseDigest)
  ) return null;
  return evidence;
}

function canonicalType(input: unknown) {
  if (!input || typeof input !== "object") return "";
  const raw = String((input as { type?: unknown }).type ?? "").trim();
  return raw || "unknown";
}

function functionRisk(name: string, signature: string): Pass2583FunctionRisk {
  const value = `${name} ${signature}`.toLowerCase();
  if (/upgrade|implementation|proxy|delegatecall/.test(value)) return "proxy_upgrade";
  if (/blacklist|blocklist|denylist|blocked|whitelist|allowlist/.test(value)) return "blacklist_blocklist";
  if (/grantrole|revokerole|renouncerole|default_admin|admin|role|owner|ownership/.test(value)) return /owner/.test(value) ? "owner_control" : "admin_role";
  if (/mint|supply|burn/.test(value)) return "mint_supply";
  if (/pause|unpause|freeze|frozen/.test(value)) return "pause_freeze";
  if (/tax|fee|exclude.*fee|setfee|settax/.test(value)) return "tax_fee";
  if (/maxtx|maxwallet|limit|cooldown|tradingenabled|enabletrading/.test(value)) return "trading_limit";
  if (/rescue|sweep|withdrawstuck|recovererc20|emergencywithdraw/.test(value)) return "rescue_sweep";
  if (/permit|approval|approve|allowance/.test(value)) return "permit_approval";
  return "unknown";
}

function riskCustomerLine(locale: string, risk: Pass2583FunctionRisk, signature: string) {
  if (risk === "unknown") return t(locale, `${signature}: funkcja bez wysokiego customer-safe alertu w tej warstwie.`, `${signature}: Funktion ohne hohen customer-safe Alarm in dieser Schicht.`, `${signature}: function has no high customer-safe alert in this layer.`);
  if (risk === "proxy_upgrade") return t(locale, `${signature}: możliwy upgrade/proxy — wymaga Pro/Advanced, bo logika może się zmienić.`, `${signature}: moegliches Upgrade/Proxy — Pro/Advanced noetig, weil Logik aenderbar sein kann.`, `${signature}: possible upgrade/proxy surface — Pro/Advanced required because logic may change.`);
  if (risk === "owner_control" || risk === "admin_role") return t(locale, `${signature}: funkcja kontroli owner/admin — trzeba sprawdzić kto ma uprawnienie.`, `${signature}: Owner/Admin Kontrollfunktion — Berechtigte muessen geprueft werden.`, `${signature}: owner/admin control function — caller authority must be reviewed.`);
  if (risk === "mint_supply") return t(locale, `${signature}: kontrola podaży — Pro powinien sprawdzić cap, role i historię użycia.`, `${signature}: Supply-Kontrolle — Pro sollte Cap, Rollen und Nutzungshistorie pruefen.`, `${signature}: supply control — Pro should review cap, roles and usage history.`);
  if (risk === "blacklist_blocklist" || risk === "pause_freeze" || risk === "trading_limit") return t(locale, `${signature}: możliwe ograniczenie transferu/użytkownika — wymaga dokładnej mapy uprawnień.`, `${signature}: moegliche Transfer/User-Beschraenkung — genaue Permission Map noetig.`, `${signature}: possible transfer/user restriction — detailed permission map required.`);
  return t(locale, `${signature}: funkcja wymaga Pro mapowania wpływu na użytkownika.`, `${signature}: Funktion braucht Pro-Mapping des User-Impacts.`, `${signature}: function requires Pro user-impact mapping.`);
}

function operatorAction(locale: string, risk: Pass2583FunctionRisk, signature: string) {
  if (risk === "unknown") return t(locale, `${signature}: zachować w indeksie, ale bez customer risk claimu.`, `${signature}: im Index behalten, aber ohne Customer-Risk-Claim.`, `${signature}: keep indexed, but do not create a customer risk claim.`);
  return t(locale, `${signature}: automatycznie rozwiązać caller, role, multisig/timelock, eventy i zgodność z docs przed finalnym werdyktem.`, `${signature}: Caller, Rollen, Multisig/Timelock, Events und Docs-Konsistenz automatisiert vor dem finalen Urteil auflösen.`, `${signature}: automatically resolve caller, roles, multisig/timelock, events and docs consistency before the final verdict.`);
}

function fromAbi(locale: string, abiText: string): Pass2583FunctionSurface[] {
  return abiItems(abiText)
    .filter((item) => item.type === "function" && typeof item.name === "string")
    .slice(0, 80)
    .map((item) => {
      const name = String(item.name ?? "unknown");
      const inputs = Array.isArray(item.inputs) ? item.inputs.map(canonicalType).join(",") : "";
      const canonicalSignature = `${name}(${inputs})`;
      const riskFamily = functionRisk(name, canonicalSignature);
      const mutabilityRaw = String(item.stateMutability ?? "unknown");
      const mutability = mutabilityRaw === "view" || mutabilityRaw === "pure" || mutabilityRaw === "payable" || mutabilityRaw === "nonpayable" ? mutabilityRaw : "unknown";
      const selector = KNOWN_SELECTORS[canonicalSignature] ?? "selector_queued_keccak256";
      return {
        name,
        canonicalSignature,
        selector,
        selectorState: selector.startsWith("0x") ? "known" : "queued",
        source: "abi" as const,
        mutability,
        visibility: "external" as const,
        riskFamily,
        customerSafeLine: riskCustomerLine(locale, riskFamily, canonicalSignature),
        proPdfLine: `${canonicalSignature}; selector=${selector}; selectorState=${selector.startsWith("0x") ? "known" : "queued"}; mutability=${mutability}; source=abi; riskFamily=${riskFamily}`,
        operatorAction: operatorAction(locale, riskFamily, canonicalSignature),
      };
    });
}

function normalizeArgList(args: string) {
  if (!args.trim()) return "";
  return args
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] || "unknown")
    .filter(Boolean)
    .join(",");
}

function fromSource(locale: string, sourceText: string): Pass2583FunctionSurface[] {
  const text = verifiedSourceText(sourceText);
  if (!text.trim()) return [];
  const functions: Pass2583FunctionSurface[] = [];
  const regex = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*([^;{]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) && functions.length < 90) {
    const name = match[1] || "unknown";
    const args = normalizeArgList(match[2] || "");
    const modifiers = match[3] || "";
    const canonicalSignature = `${name}(${args})`;
    const riskFamily = functionRisk(name, `${canonicalSignature} ${modifiers}`);
    const visibility = /\bexternal\b/.test(modifiers) ? "external" : /\bpublic\b/.test(modifiers) ? "public" : /\binternal\b/.test(modifiers) ? "internal" : /\bprivate\b/.test(modifiers) ? "private" : "unknown";
    const mutability = /\bview\b/.test(modifiers) ? "view" : /\bpure\b/.test(modifiers) ? "pure" : /\bpayable\b/.test(modifiers) ? "payable" : "unknown";
    const selector = KNOWN_SELECTORS[canonicalSignature] ?? "selector_queued_keccak256";
    functions.push({
      name,
      canonicalSignature,
      selector,
      selectorState: selector.startsWith("0x") ? "known" : "queued",
      source: "source",
      mutability,
      visibility,
      riskFamily,
      customerSafeLine: riskCustomerLine(locale, riskFamily, canonicalSignature),
      proPdfLine: `${canonicalSignature}; selector=${selector}; selectorState=${selector.startsWith("0x") ? "known" : "queued"}; mutability=${mutability}; visibility=${visibility}; source=source; riskFamily=${riskFamily}`,
      operatorAction: operatorAction(locale, riskFamily, canonicalSignature),
    });
  }
  return functions;
}

function fromBytecode(locale: string, bytecodeText: string): Pass2583FunctionSurface[] {
  const bytecode = verifiedBytecode(bytecodeText);
  if (!bytecode) return [];
  return Object.entries(KNOWN_SELECTORS).flatMap(([canonicalSignature, selector]) => {
    if (!bytecode.includes(selector.slice(2).toLowerCase())) return [];
    const name = canonicalSignature.slice(0, canonicalSignature.indexOf("("));
    const riskFamily = functionRisk(name, canonicalSignature);
    return [{
      name,
      canonicalSignature,
      selector,
      selectorState: "known" as const,
      source: "bytecode" as const,
      mutability: "unknown" as const,
      visibility: "unknown" as const,
      riskFamily,
      customerSafeLine: riskCustomerLine(locale, riskFamily, canonicalSignature),
      proPdfLine: `${canonicalSignature}; selector=${selector}; selectorState=known; source=bytecode; riskFamily=${riskFamily}`,
      operatorAction: operatorAction(locale, riskFamily, canonicalSignature),
    }];
  });
}

function dedupeFunctions(items: Pass2583FunctionSurface[]) {
  const seen = new Set<string>();
  const result: Pass2583FunctionSurface[] = [];
  for (const item of items) {
    const key = `${item.canonicalSignature}:${item.riskFamily}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function proxyHints(locale: string, sourceText: string, abiText: string, bytecodeText: string): Pass2583ProxyHint[] {
  const abiCorpus = fromAbi(locale, abiText).map((item) => item.canonicalSignature).join("\n");
  const bytecodeCorpus = fromBytecode(locale, bytecodeText).map((item) => item.canonicalSignature).join("\n");
  const text = `${verifiedSourceText(sourceText)}\n${abiCorpus}\n${bytecodeCorpus}`;
  const specs = [
    {
      id: "erc1967-implementation-slot",
      label: "ERC-1967 implementation/admin slot",
      pattern: /360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc|b53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103|ERC1967|_IMPLEMENTATION_SLOT|_ADMIN_SLOT/i,
      missing: ["eth_getStorageAt implementation/admin slot", "explorer proxy metadata"],
    },
    {
      id: "uups-upgrade-surface",
      label: "UUPS upgrade surface",
      pattern: /UUPSUpgradeable|upgradeTo\s*\(|upgradeToAndCall\s*\(|proxiableUUID/i,
      missing: ["implementation ABI", "upgrade authorization owner/role"],
    },
    {
      id: "transparent-proxy-surface",
      label: "Transparent proxy surface",
      pattern: /TransparentUpgradeableProxy|ProxyAdmin|admin\s*\(\)|changeAdmin/i,
      missing: ["proxy admin address", "admin ownership/multisig"],
    },
    {
      id: "delegatecall-surface",
      label: "Delegatecall surface",
      pattern: /delegatecall|fallback\s*\(|receive\s*\(/i,
      missing: ["implementation target", "fallback routing map"],
    },
  ];
  const hasAnyInput = Boolean(verifiedSourceText(sourceText) || abiCorpus || verifiedBytecode(bytecodeText));
  return specs.map((spec) => {
    const detected = spec.pattern.test(text);
    const state = detected ? "detected" : hasAnyInput ? "not_detected" : "unknown";
    const evidence = detected ? [spec.label, ...(text.match(spec.pattern)?.slice(0, 1) ?? [])].slice(0, 3) : [];
    const customerLine = detected
      ? t(locale, `${spec.label}: wykryto proxy/upgrade hint — finalny werdykt wymaga implementation + admin check.`, `${spec.label}: Proxy/Upgrade-Hinweis erkannt — finaler Verdict braucht Implementation + Admin Check.`, `${spec.label}: proxy/upgrade hint detected — final verdict requires implementation + admin check.`)
      : state === "not_detected"
        ? t(locale, `${spec.label}: nie wykryto w dostępnej warstwie, ale trzeba podać scope źródła.`, `${spec.label}: in verfuegbarer Schicht nicht erkannt, aber Source-Scope muss angegeben werden.`, `${spec.label}: not detected in available layer, but source scope must be stated.`)
        : t(locale, `${spec.label}: brak danych do oceny proxy.`, `${spec.label}: keine Daten fuer Proxy-Bewertung.`, `${spec.label}: no data to assess proxy surface.`);
    return {
      id: spec.id,
      label: spec.label,
      state,
      evidence,
      missing: detected ? spec.missing : ["verified source/ABI", ...spec.missing].slice(0, 3),
      customerLine,
      proPdfLine: `${spec.label}; state=${state}; missing=${(detected ? spec.missing : ["verified source/ABI", ...spec.missing]).join(" | ")}`,
      operatorAction: t(locale, "Jeśli wykryto: pobrać implementation, admin slot, owner/multisig i porównać ABI proxy vs implementation.", "Wenn erkannt: Implementation, Admin Slot, Owner/Multisig holen und Proxy ABI vs Implementation ABI vergleichen.", "If detected: fetch implementation, admin slot, owner/multisig and compare proxy ABI vs implementation ABI."),
    };
  });
}

function stateTone(state: Pass2583ExtractionState) {
  if (state === "verified") return 100;
  if (state === "partial") return 70;
  if (state === "queued") return 48;
  if (state === "needs_key") return 34;
  if (state === "missing_input") return 24;
  return 18;
}

function row(label: string, state: Pass2583ExtractionState, output: string): Pass2583ExtractionRow {
  return { label, state, output };
}

export function buildPass2583ContractSourceAbiExtractionReport(input: BuilderInput): Pass2583ContractSourceAbiExtractionReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.providerRuntime?.target.chain ?? "ethereum";
  const chainId = chainIdFrom(chain);
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName;
  const staticEvidence = identityBoundStaticEvidence(input, contractAddress, chain);
  const sourceText = verifiedSourceText(staticEvidence?.sourceText);
  const rawAbiText = safeText(staticEvidence?.abiText, 400_000);
  const parsedAbi = abiItems(rawAbiText);
  const abiText = parsedAbi.length ? rawAbiText : "";
  const bytecodeText = verifiedBytecode(staticEvidence?.bytecodeText);
  const hasContract = Boolean(contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress));
  const sourceAvailable = Boolean(sourceText);
  const abiAvailable = parsedAbi.length > 0;
  const bytecodeAvailable = Boolean(bytecodeText);
  const adapterNeedsKey = Boolean(input.realProviderAdapterHardening?.providerAdapters.some((lane) => lane.id.includes("etherscan") && lane.state === "needs_key"));
  const compilerVersion = clean(sourceText.match(/CompilerVersion["':\s]+([^",}\s]+)/i)?.[1] || sourceText.match(/pragma\s+solidity\s+([^;]+);/i)?.[1], 80);

  const functionSurfaces = dedupeFunctions([
    ...fromAbi(locale, abiText),
    ...fromSource(locale, sourceText),
    ...fromBytecode(locale, bytecodeText),
  ]).slice(0, 90);

  const hints = proxyHints(locale, sourceText, abiText, bytecodeText);
  const proxyLike = hints.some((hint) => hint.state === "detected") || functionSurfaces.some((item) => item.riskFamily === "proxy_upgrade");
  const sourceGateState: Pass2583ExtractionState = !hasContract
    ? "missing_input"
    : sourceAvailable && abiAvailable
      ? "verified"
      : sourceAvailable || abiAvailable || bytecodeAvailable
        ? "partial"
        : adapterNeedsKey
          ? "needs_key"
          : "blocked";
  const readiness = clamp(
    stateTone(sourceGateState) +
      Math.min(18, functionSurfaces.length * 2) +
      (hints.some((hint) => hint.state !== "unknown") ? 6 : 0) -
      (proxyLike && !abiAvailable ? 8 : 0) - (!sourceAvailable && !abiAvailable && !bytecodeAvailable ? 18 : 0),
    0,
    100,
  );
  const confidenceCap = sourceGateState === "verified" ? 82 : sourceGateState === "partial" ? 58 : sourceGateState === "needs_key" ? 34 : 24;
  const ownerAdminFunctions = functionSurfaces.filter((item) => item.riskFamily === "owner_control" || item.riskFamily === "admin_role").length;
  const supplyControlFunctions = functionSurfaces.filter((item) => item.riskFamily === "mint_supply").length;
  const transferRestrictionFunctions = functionSurfaces.filter((item) => item.riskFamily === "pause_freeze" || item.riskFamily === "blacklist_blocklist" || item.riskFamily === "trading_limit").length;
  const proxyUpgradeFunctions = functionSurfaces.filter((item) => item.riskFamily === "proxy_upgrade").length;

  const publicRows = [
    row("Verified source gate", sourceGateState, sourceGateState === "verified"
      ? t(locale, "Source i ABI dostępne; nadal wymagamy timestampu i drugiego potwierdzenia dla Pro.", "Source und ABI verfuegbar; Timestamp und zweite Bestaetigung fuer Pro bleiben noetig.", "Source and ABI are available; timestamp and second confirmation remain required for Pro.")
      : t(locale, "Brak pełnego source+ABI; Basic nie może udawać pełnej mapy uprawnień.", "Kein vollstaendiges Source+ABI; Basic darf keine volle Permission Map vortaeuschen.", "Full source+ABI is not available; Basic cannot pretend to have a full permission map.")),
    row("Function index", functionSurfaces.length ? "partial" : sourceGateState, t(locale, `${functionSurfaces.length} funkcji/kandydatów w indeksie; ryzykowne funkcje idą do Pro/Advanced.`, `${functionSurfaces.length} Funktionen/Kandidaten im Index; riskante Funktionen gehen zu Pro/Advanced.`, `${functionSurfaces.length} functions/candidates indexed; risky functions go to Pro/Advanced.`)),
    row("Proxy / implementation hint", proxyLike ? "partial" : sourceGateState, proxyLike
      ? t(locale, "Wykryto proxy/upgrade hint; final wymaga implementation/admin check.", "Proxy/Upgrade-Hinweis erkannt; final braucht Implementation/Admin Check.", "Proxy/upgrade hint detected; final requires implementation/admin check.")
      : t(locale, "Brak potwierdzonego proxy hint w dostępnej warstwie.", "Kein bestaetigter Proxy-Hinweis in verfuegbarer Schicht.", "No confirmed proxy hint in the available layer.")),
    row("Customer claim boundary", sourceGateState === "verified" || sourceGateState === "partial" ? "partial" : sourceGateState, t(locale, "Pokazujemy tylko status i braki; pełne selectors/role map zostają w Pro/Operator.", "Wir zeigen nur Status und Luecken; volle Selectors/Role Map bleibt Pro/Operator.", "Only status and gaps are shown; full selectors/role map remains Pro/Operator.")),
  ];

  const proFunctionRows = functionSurfaces
    .filter((item) => item.riskFamily !== "unknown" || item.selectorState === "known")
    .slice(0, 18)
    .map((item) => row(item.canonicalSignature, item.selectorState === "known" ? "verified" : "partial", item.proPdfLine));
  const proProxyRows = hints.slice(0, 6).map((hint) => row(hint.label, hint.state === "detected" ? "partial" : hint.state === "not_detected" ? "partial" : "queued", hint.proPdfLine));

  const operatorRows = [
    row("Explorer source adapter", sourceGateState, `chainId=${chainId}; contract=${contractAddress ?? "missing"}; source=${sourceAvailable}; abi=${abiAvailable}; bytecode=${bytecodeAvailable}; confidenceCap=${confidenceCap}`),
    row("Selector derivation", functionSurfaces.some((item) => item.selectorState === "queued") ? "queued" : functionSurfaces.length ? "verified" : sourceGateState, "Known selectors are exact for common ERC/admin methods; unknown selectors are queued for Ethereum keccak256 derivation in the real adapter."),
    row("Proxy implementation retrieval", proxyLike ? "queued" : "partial", "If proxy-like, queue automated ERC-1967 implementation/admin slot reads and compare proxy ABI with implementation ABI before an Advanced verdict."),
    row("Permission parser handoff", functionSurfaces.length ? "partial" : sourceGateState, "Feed canonical signatures, selector state, risk family and proxy hints into PASS2576/PASS2578 without exposing raw operator payload to Basic."),
  ];

  const nextCriticalStep = !hasContract
    ? "Collect a valid contract address before source/ABI extraction."
    : !sourceAvailable && !abiAvailable && !bytecodeAvailable && adapterNeedsKey
      ? "Add explorer API key and fetch verified source/ABI."
      : !sourceAvailable || !abiAvailable
        ? "Fetch verified source and ABI from explorer adapter."
        : proxyLike
          ? "Fetch implementation/admin metadata before the final verdict."
          : "Attach source timestamp and second-source confirmation to Pro PDF.";

  return {
    passId: PASS2583_CONTRACT_SOURCE_ABI_EXTRACTION_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain, chainId },
    rule: t(
      locale,
      "PASS2583 dodaje bramkę source/ABI: verified source, ABI, funkcje, selectors, proxy hints i owner/admin surfaces muszą być jawnie zmapowane przed mocnym werdyktem.",
      "PASS2583 fuegt Source/ABI Gate hinzu: verified Source, ABI, Funktionen, Selectors, Proxy Hints und Owner/Admin Surfaces muessen vor starkem Verdict gemappt sein.",
      "PASS2583 adds a source/ABI gate: verified source, ABI, functions, selectors, proxy hints and owner/admin surfaces must be explicitly mapped before a strong verdict.",
    ),
    customerRule: t(
      locale,
      "Basic pokazuje tylko czy source/ABI i proxy/permission mapa są gotowe; nie pokazuje surowego kodu ani pełnych operator notes.",
      "Basic zeigt nur ob Source/ABI und Proxy/Permission Map bereit sind; kein Raw Code und keine vollen Operator Notes.",
      "Basic shows only whether source/ABI and proxy/permission mapping are ready; it does not expose raw code or full operator notes.",
    ),
    proRule: t(
      locale,
      "Pro PDF dostaje canonical signatures, selector state, proxy hints, compiler/source scope i braki do potwierdzenia.",
      "Pro PDF bekommt canonical signatures, selector state, proxy hints, compiler/source scope und fehlende Bestaetigungen.",
      "Pro PDF receives canonical signatures, selector state, proxy hints, compiler/source scope and missing confirmations.",
    ),
    operatorRule: t(
      locale,
      "Advanced automatycznie porównuje source, ABI, implementation, admin/owner i role przed finalnym werdyktem; human review jest tylko opcjonalnym QA poza entitlementem.",
      "Advanced vergleicht Source, ABI, Implementation, Admin/Owner und Rollen automatisiert vor dem finalen Urteil; Human Review bleibt optionales QA außerhalb des Entitlements.",
      "Advanced automatically compares source, ABI, implementation, admin/owner and roles before the final verdict; human review remains optional QA outside the entitlement.",
    ),
    extractionContract: {
      schemaVersion: "pass2583.source-abi.v1",
      explorerSourceRule: "sourceCode and ABI are separate evidence lanes; missing one caps confidence",
      abiRule: "ABI functions become canonical signatures; high-impact functions are Pro/Advanced-only",
      selectorRule: "known selectors are emitted only when exact; unknown selectors are queued for real keccak256 adapter",
      proxyRule: "proxy-like hints require automated implementation/admin resolution before the final verdict",
      safetyBoundary: "passive static extraction only; no exploit instructions; no unauthorized active testing",
    },
    sourceGate: {
      state: sourceGateState,
      verified: sourceGateState === "verified",
      sourceAvailable,
      abiAvailable,
      bytecodeAvailable,
      compilerVersion,
      proxyLike,
      confidenceCap,
      output: `${sourceGateState}; source=${sourceAvailable}; abi=${abiAvailable}; bytecode=${bytecodeAvailable}; proxyLike=${proxyLike}; readiness=${readiness}/100`,
    },
    functionSurfaces,
    proxyHints: hints,
    summary: {
      totalFunctions: functionSurfaces.length,
      ownerAdminFunctions,
      supplyControlFunctions,
      transferRestrictionFunctions,
      proxyUpgradeFunctions,
      customerVisibleRows: publicRows.length,
      queued: Math.max(0, functionSurfaces.length - publicRows.length),
      proOnlyRows: proFunctionRows.length + proProxyRows.length,
      operatorActions: operatorRows.length + hints.filter((hint) => hint.state === "detected").length,
      extractionReadiness: readiness,
      nextCriticalStep,
      canFeedPermissionParser: functionSurfaces.length > 0 && (sourceAvailable || abiAvailable || bytecodeAvailable),
      // Verified source/ABI proves static surface availability only. It can never
      // authorize a customer FINAL or vulnerability/exploitability conclusion by itself.
      canFinalSignFromStaticExtraction: false,
    },
    publicRows,
    proPdfRows: [...proFunctionRows, ...proProxyRows].slice(0, 24),
    operatorRows,
    nextImplementationBacklog: [
      "Add Blockscout parity to the private identity-bound explorer evidence adapter before claiming multi-explorer coverage.",
      "Add Ethereum keccak256 selector derivation in the runtime adapter, never sha3-256 fallback.",
      "Read ERC-1967 implementation/admin/beacon storage slots for proxy-like contracts.",
      "Diff proxy ABI vs implementation ABI and mark hidden upgrade/admin functions.",
      "Feed PASS2583 function surfaces into PASS2576 permission parser and PASS2578 report assembler scoring.",
      "Add Pro PDF permission map table with selector state, caller role and missing proof columns.",
    ],
  };
}
