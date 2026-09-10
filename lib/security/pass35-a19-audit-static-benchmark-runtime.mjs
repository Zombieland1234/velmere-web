import { createHash } from "node:crypto";

export const POLICY_SCHEMA = "velmere.pass35.a19-audit-static-benchmark-policy.v1";
export const RUNTIME_SCHEMA = "velmere.pass35.a19-audit-static-benchmark-runtime.v1";
const SEVERITIES = new Set(["critical", "high", "medium", "low", "informational"]);

const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};
const round = (value, digits = 6) => Number(value.toFixed(digits));
const ratio = (num, den) => den ? num / den : 0;
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denominator;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)) };
}

export function verifyA19AuditStaticPolicy(policy) {
  if (!policy || policy.schemaVersion !== POLICY_SCHEMA || policy.passId !== "PASS35_A19") return false;
  if (!Array.isArray(policy.families) || policy.families.length !== 15) return false;
  if (new Set(policy.families.map((row) => row.id)).size !== 15) return false;
  if (!policy.families.every((row) => /^[A-Z0-9_]+$/.test(row.id) && SEVERITIES.has(row.severity))) return false;
  if (policy.corpus?.expectedCases !== 240 || policy.mutations?.expectedTotal !== 2880) return false;
  if (!Array.isArray(policy.mutations?.types) || policy.mutations.types.length !== 12) return false;
  if (Object.values(policy.hardStops ?? {}).some((value) => value !== false)) return false;
  return true;
}

function stripCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") { out += "  "; i += 2; state = "line"; continue; }
      if (ch === "/" && next === "*") { out += "  "; i += 2; state = "block"; continue; }
      if (ch === '"' || ch === "'") { quote = ch; out += " "; i += 1; state = "string"; continue; }
      out += ch; i += 1; continue;
    }
    if (state === "line") {
      if (ch === "\n") { out += "\n"; state = "code"; } else out += " ";
      i += 1; continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") { out += "  "; i += 2; state = "code"; }
      else { out += ch === "\n" ? "\n" : " "; i += 1; }
      continue;
    }
    if (state === "string") {
      if (ch === "\\") { out += "  "; i += 2; continue; }
      if (ch === quote) { out += " "; i += 1; state = "code"; continue; }
      out += ch === "\n" ? "\n" : " "; i += 1;
    }
  }
  return out;
}

function findMatchingBrace(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseParamNames(params) {
  return params.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const tokens = part.replace(/\b(memory|calldata|storage|payable|indexed)\b/g, " ").trim().split(/\s+/);
    return tokens.length > 1 ? tokens[tokens.length - 1].replace(/[^A-Za-z0-9_]/g, "") : "";
  }).filter(Boolean);
}

function extractFunctions(source) {
  const clean = stripCommentsAndStrings(source);
  const functions = [];
  const re = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*([^{;]*)\{/g;
  for (const match of clean.matchAll(re)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf("{");
    const close = findMatchingBrace(clean, open);
    if (close < 0) continue;
    const start = match.index ?? 0;
    const header = clean.slice(start, open);
    const body = clean.slice(open + 1, close);
    functions.push({
      name: match[1],
      params: parseParamNames(match[2]),
      header,
      body,
      full: clean.slice(start, close + 1),
      line: clean.slice(0, start).split("\n").length,
      visibility: /\bexternal\b/.test(header) ? "external" : /\bpublic\b/.test(header) ? "public" : /\binternal\b/.test(header) ? "internal" : /\bprivate\b/.test(header) ? "private" : "default",
    });
  }
  return { clean, functions };
}

function hasAccessControl(fn) {
  return /\b(?:onlyOwner|onlyRole|auth|authorized|governanceOnly|onlyAdmin)\b/.test(fn.header)
    || /require\s*\(\s*msg\.sender\s*==\s*(?:owner|admin|governance|timelock)/.test(fn.body)
    || /_checkRole\s*\(/.test(fn.body);
}
function externallyReachable(fn) { return fn.visibility === "external" || fn.visibility === "public"; }
function checkedBooleanCall(fn) {
  if (/require\s*\([^;]*\.call\s*(?:\{|\()/.test(fn.body)) return true;
  const assigned = /\(\s*bool\s+([A-Za-z_][A-Za-z0-9_]*)\s*,[^)]*\)\s*=\s*[^;]*\.call\s*(?:\{|\()/g;
  for (const match of fn.body.matchAll(assigned)) {
    const name = match[1];
    const after = fn.body.slice((match.index ?? 0) + match[0].length);
    if (new RegExp(`require\\s*\\(\\s*${name}\\b`).test(after) || new RegExp(`if\\s*\\(\\s*!\\s*${name}\\b`).test(after) || new RegExp(`${name}\\s*==\\s*false`).test(after)) return true;
  }
  return false;
}
function checkedTokenReturn(fn) {
  if (/\bsafeTransfer(?:From)?\s*\(/.test(fn.body)) return true;
  if (/require\s*\([^;]*\.transfer(?:From)?\s*\(/.test(fn.body)) return true;
  const assigned = /bool\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^;]*\.transfer(?:From)?\s*\(/g;
  for (const match of fn.body.matchAll(assigned)) {
    const after = fn.body.slice((match.index ?? 0) + match[0].length);
    if (new RegExp(`require\\s*\\(\\s*${match[1]}\\b`).test(after)) return true;
  }
  return false;
}

export function analyzeA19SoliditySource(source, policy) {
  if (!verifyA19AuditStaticPolicy(policy)) throw new Error("a19_audit_policy_invalid");
  const severity = Object.fromEntries(policy.families.map((row) => [row.id, row.severity]));
  const { clean, functions } = extractFunctions(source);
  const findings = [];
  const add = (familyId, fn, evidence) => {
    if (findings.some((row) => row.familyId === familyId && row.functionName === (fn?.name ?? null))) return;
    findings.push({ familyId, severity: severity[familyId], functionName: fn?.name ?? null, line: fn?.line ?? 1, evidence, confidence: 0.9 });
  };
  for (const fn of functions) {
    if (/\btx\.origin\b/.test(fn.body)) add("TX_ORIGIN_AUTH", fn, "tx.origin authorization dependency");
    if (/\.call\s*(?:\{|\()/.test(fn.body) && !checkedBooleanCall(fn)) add("UNCHECKED_LOW_LEVEL_CALL", fn, "low-level call result not checked");
    if (/\.delegatecall\s*\(/.test(fn.body)) {
      const expression = fn.body.match(/([A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]+\])?)\.delegatecall\s*\(/)?.[1] ?? "";
      if ((fn.params.includes(expression) || /^(?:target|implementation|impl|logic)$/.test(expression)) && !hasAccessControl(fn) && !/allowedImplementations\s*\[/.test(fn.body)) add("UNTRUSTED_DELEGATECALL", fn, "delegatecall target is caller-controlled or ungoverned");
    }
    if (/\b(?:selfdestruct|suicide)\s*\(/.test(fn.body) && externallyReachable(fn) && !hasAccessControl(fn)) add("UNPROTECTED_SELFDESTRUCT", fn, "destructive operation lacks authorization");
    if (/\.call\s*\{\s*value\s*:/.test(fn.body)) {
      const callAt = fn.body.search(/\.call\s*\{\s*value\s*:/);
      const stateAt = fn.body.search(/\b(?:balances|accountingBalances|credits|withdrawn|shares)\s*\[[^\]]+\]\s*(?:=|-=|\+=)/i);
      if (stateAt > callAt && !/\bnonReentrant\b/.test(fn.header)) add("REENTRANCY_STATE_AFTER_CALL", fn, "external value call occurs before state effect");
    }
    if (/^mint$/i.test(fn.name) && externallyReachable(fn) && /\b_mint\s*\(/.test(fn.body) && !hasAccessControl(fn)) add("UNPROTECTED_MINT", fn, "externally reachable mint lacks authorization");
    if (/^(?:upgradeTo|setImplementation|changeImplementation|upgrade)$/i.test(fn.name) && externallyReachable(fn) && !hasAccessControl(fn)) add("UNPROTECTED_UPGRADE", fn, "upgrade surface lacks authorization");
    if (/\b(?:for|while)\s*\([^)]*\.length[^)]*\)/.test(fn.body) && externallyReachable(fn) && !/(?:MAX_BATCH|limit|end|Math\.min|require\s*\([^)]*\.length\s*<=\s*\d+)/.test(fn.body)) add("UNBOUNDED_STORAGE_LOOP", fn, "external loop scales with dynamic collection length");
    if (/\becrecover\s*\(/.test(fn.body)) {
      const nonce = /\b(?:nonce|nonces|usedNonces|usedDigests)\b/.test(fn.body);
      const expiry = /\bdeadline\b/.test(fn.body) && /block\.timestamp/.test(fn.body);
      const domain = /\b(?:DOMAIN_SEPARATOR|block\.chainid|chainId)\b/.test(fn.body);
      if (!(nonce && expiry && domain)) add("SIGNATURE_REPLAY", fn, "signature flow lacks nonce, expiry or domain binding");
    }
    if (/(?:block\.timestamp|blockhash\s*\(|block\.prevrandao)/.test(fn.body) && /(?:\brandom\b|\bwinner\b|%\s*participants)/i.test(fn.body)) add("TIMESTAMP_RANDOMNESS", fn, "predictable block property used as randomness");
    if (/\.transfer(?:From)?\s*\(/.test(fn.body) && !checkedTokenReturn(fn)) add("UNSAFE_ERC20_RETURN", fn, "ERC20 return value is not validated");
    if (/\bassembly\s*\{[^}]*\bsstore\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/s.test(fn.body)) {
      const slot = fn.body.match(/\bsstore\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/)?.[1];
      if (slot && fn.params.includes(slot) && !hasAccessControl(fn)) add("ARBITRARY_SSTORE_SLOT", fn, "caller-controlled storage slot write");
    }
    if (/^initialize$/i.test(fn.name) && externallyReachable(fn) && !/\binitializer\b/.test(fn.header) && !/require\s*\(\s*!\s*initialized\b/.test(fn.body)) add("PUBLIC_INITIALIZER_NO_GUARD", fn, "initializer lacks one-time guard");
    if (/\bgetReserves\s*\(/.test(fn.body) && /(?:price|quote|reserve0\s*\/\s*reserve1|reserve1\s*\/\s*reserve0|uint256\s*\(\s*reserve0\s*\)\s*\/|uint256\s*\(\s*reserve1\s*\)\s*\/)/i.test(fn.body) && !/(?:observe\s*\(|cumulative|twap)/i.test(fn.body)) add("SPOT_ORACLE_ONLY", fn, "spot reserves used without time-weighted evidence");
    if (/\.call\s*\(\s*data\s*\)/.test(fn.body) && fn.params.includes("target") && fn.params.includes("data") && !hasAccessControl(fn) && !/allowedTargets\s*\[\s*target\s*\]/.test(fn.body)) add("ARBITRARY_EXTERNAL_CALL", fn, "caller-controlled target and calldata execution");
  }
  findings.sort((a, b) => `${a.familyId}|${a.line}`.localeCompare(`${b.familyId}|${b.line}`));
  return { findings, findingIds: findings.map((row) => row.familyId), sourceSha256: sha256(source), cleanSha256: sha256(clean) };
}

const prelude = (name) => `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ninterface IERC20 { function transfer(address,uint256) external returns (bool); function transferFrom(address,address,uint256) external returns (bool); }\ncontract ${name} { address owner; address admin; mapping(address=>uint256) balances; mapping(bytes32=>bool) usedNonces; bool initialized; address constant TRUSTED_IMPL = address(0x1234); mapping(address=>bool) allowedTargets; mapping(address=>bool) allowedImplementations; IERC20 token; address implementation; address[] users; uint256 constant MAX_BATCH=50; modifier onlyOwner(){require(msg.sender==owner);_;} modifier initializer(){require(!initialized); initialized=true;_;} modifier nonReentrant(){_;}\n`;
const end = "}\n";
const names = (i) => ({ user: `user${i}`, amount: `amount${i}`, target: "target", data: "data", slot: "slot", value: `value${i}` });
function template(family, vulnerable, i) {
  const n = names(i); const C = `${family.replaceAll("_", "")}${vulnerable ? "V" : "S"}${i}`;
  const P = prelude(C);
  const safeAccess = i % 2 ? "onlyOwner" : "";
  const accessBody = i % 2 ? "" : "require(msg.sender==owner);";
  const rows = {
    TX_ORIGIN_AUTH: vulnerable ? `function withdraw(address ${n.user}) external { require(tx.origin==owner); balances[${n.user}]=0; }` : `function withdraw(address ${n.user}) external { require(msg.sender==owner); balances[${n.user}]=0; }`,
    UNCHECKED_LOW_LEVEL_CALL: vulnerable ? `function pay(address payable recipient,uint256 ${n.amount}) external onlyOwner { recipient.call{value:${n.amount}}(""); }` : `function pay(address payable recipient,uint256 ${n.amount}) external onlyOwner { (bool ok,)=recipient.call{value:${n.amount}}(""); require(ok); }`,
    UNTRUSTED_DELEGATECALL: vulnerable ? `function run(address target,bytes calldata payload) external { target.delegatecall(payload); }` : `function run(bytes calldata payload) external onlyOwner { TRUSTED_IMPL.delegatecall(payload); }`,
    UNPROTECTED_SELFDESTRUCT: vulnerable ? `function destroy(address payable recipient) external { selfdestruct(recipient); }` : `function destroy(address payable recipient) external onlyOwner { selfdestruct(recipient); }`,
    REENTRANCY_STATE_AFTER_CALL: vulnerable ? `function withdraw() external { uint256 amount=balances[msg.sender]; (bool ok,)=payable(msg.sender).call{value:amount}(""); require(ok); balances[msg.sender]=0; }` : `function withdraw() external nonReentrant { uint256 amount=balances[msg.sender]; balances[msg.sender]=0; (bool ok,)=payable(msg.sender).call{value:amount}(""); require(ok); }`,
    UNPROTECTED_MINT: vulnerable ? `function mint(address to,uint256 ${n.amount}) external { _mint(to,${n.amount}); } function _mint(address,uint256) internal {}` : `function mint(address to,uint256 ${n.amount}) external ${safeAccess} { ${accessBody} _mint(to,${n.amount}); } function _mint(address,uint256) internal {}`,
    UNPROTECTED_UPGRADE: vulnerable ? `function upgradeTo(address next) external { implementation=next; }` : `function upgradeTo(address next) external ${safeAccess} { ${accessBody} implementation=next; }`,
    UNBOUNDED_STORAGE_LOOP: vulnerable ? `function distribute() external { for(uint256 j=0;j<users.length;j++){ balances[users[j]]+=1; } }` : `function distribute(uint256 limit) external { uint256 end=limit<users.length?limit:users.length; require(end<=MAX_BATCH); for(uint256 j=0;j<end;j++){ balances[users[j]]+=1; } }`,
    SIGNATURE_REPLAY: vulnerable ? `function claim(bytes32 digest,uint8 v,bytes32 r,bytes32 s) external { address signer=ecrecover(digest,v,r,s); require(signer==owner); balances[msg.sender]+=1; }` : `function claim(bytes32 digest,uint256 nonce,uint256 deadline,uint8 v,bytes32 r,bytes32 s) external { require(block.timestamp<=deadline); bytes32 bound=keccak256(abi.encode(DOMAIN_SEPARATOR(),block.chainid,digest,nonce,deadline)); require(!usedNonces[bound]); usedNonces[bound]=true; address signer=ecrecover(bound,v,r,s); require(signer==owner); balances[msg.sender]+=1; } function DOMAIN_SEPARATOR() internal pure returns(bytes32){return bytes32(0);}`,
    TIMESTAMP_RANDOMNESS: vulnerable ? `function pickWinner(address[] calldata participants) external view returns(address){ uint256 random=uint256(keccak256(abi.encode(block.timestamp,blockhash(block.number-1)))); return participants[random%participants.length]; }` : `function isOpen(uint256 deadline) external view returns(bool){ return block.timestamp<=deadline; }`,
    UNSAFE_ERC20_RETURN: vulnerable ? `function sendToken(address to,uint256 ${n.amount}) external onlyOwner { token.transfer(to,${n.amount}); }` : `function sendToken(address to,uint256 ${n.amount}) external onlyOwner { require(token.transfer(to,${n.amount})); }`,
    ARBITRARY_SSTORE_SLOT: vulnerable ? `function write(bytes32 slot,bytes32 value) external { assembly { sstore(slot,value) } }` : `function write(bytes32 value) external onlyOwner { bytes32 slot=keccak256("velmere.safe.slot"); assembly { sstore(slot,value) } }`,
    PUBLIC_INITIALIZER_NO_GUARD: vulnerable ? `function initialize(address firstOwner) external { owner=firstOwner; initialized=true; }` : `function initialize(address firstOwner) external initializer { owner=firstOwner; }`,
    SPOT_ORACLE_ONLY: vulnerable ? `function price() external view returns(uint256){ (uint112 reserve0,uint112 reserve1,)=pair().getReserves(); return uint256(reserve0)/uint256(reserve1); } function pair() internal pure returns(Pair){return Pair(address(0));}` : `function price() external view returns(uint256){ (int56[] memory ticks,)=pair().observe(windows()); return uint256(uint56(ticks[1]-ticks[0])); } function pair() internal pure returns(Pair){return Pair(address(0));} function windows() internal pure returns(uint32[] memory x){x=new uint32[](2);}`,
    ARBITRARY_EXTERNAL_CALL: vulnerable ? `function execute(address target,bytes calldata data) external { (bool ok,)=target.call(data); require(ok); }` : `function execute(address target,bytes calldata data) external onlyOwner { require(allowedTargets[target]); (bool ok,)=target.call(data); require(ok); }`,
  };
  const pairDecl = family === "SPOT_ORACLE_ONLY" ? `interface Pair { function getReserves() external view returns(uint112,uint112,uint32); function observe(uint32[] memory) external view returns(int56[] memory,uint160[] memory); }\n` : "";
  return `${pairDecl}${P}${rows[family]}${end}`;
}

function splitForVariant(i) { return i < 3 ? "development" : i < 5 ? "validation" : "frozen_test"; }
function caseRecord(family, vulnerable, i, severity) {
  const source = template(family, vulnerable, i);
  return {
    caseId: `A19-${family}-${vulnerable ? "VULN" : "SAFE"}-${String(i + 1).padStart(2, "0")}`,
    blindCaseId: `BLIND-${sha256(`${family}|${vulnerable}|${i}`).slice(0, 16)}`,
    familyId: family,
    severity,
    vulnerable,
    split: splitForVariant(i),
    source,
    sourceSha256: sha256(source),
  };
}

function mutate(source, type, counterpart) {
  const riskWords = "tx.origin delegatecall selfdestruct ecrecover sstore block.timestamp target.call token.transfer";
  switch (type) {
    case "comment_decoy_front": return `// ${riskWords}\n${source}`;
    case "comment_decoy_inline": return source.replace("contract ", `/* ${riskWords} */ contract `);
    case "string_decoy": return source.replace(/contract ([A-Za-z0-9_]+) \{/, `contract $1 { string constant DECOY = "${riskWords}";`);
    case "whitespace_expand": return source.replace(/\{/g, " {\n ").replace(/;/g, ";\n ");
    case "whitespace_compact": return stripCommentsAndStrings(source).replace(/\s+/g, " ");
    case "rename_irrelevant": return source.replaceAll("balances", "accountingBalances").replaceAll("users", "recipients");
    case "add_safe_helper": return source.replace(/}\s*$/, "function harmless(uint256 x) internal pure returns(uint256){return x+1;} }");
    case "duplicate_comment": return `/* ${riskWords} */\n/* ${riskWords} */\n${source}`;
    case "newline_normalize": return source.replaceAll("\n", "\r\n");
    case "harmless_pragma": return source.replace("pragma solidity ^0.8.24;", "pragma solidity >=0.8.24 <0.9.0;");
    case "strip_comments": return stripCommentsAndStrings(source);
    case "paired_security_flip": return counterpart;
    default: throw new Error(`a19_mutation_unknown:${type}`);
  }
}

export function runA19AuditStaticBenchmark(policy) {
  if (!verifyA19AuditStaticPolicy(policy)) throw new Error("a19_audit_policy_invalid");
  const cases = [];
  for (const family of policy.families) {
    for (let i = 0; i < policy.corpus.variantsPerClass; i += 1) {
      cases.push(caseRecord(family.id, true, i, family.severity));
      cases.push(caseRecord(family.id, false, i, family.severity));
    }
  }
  const results = cases.map((row) => {
    const analysis = analyzeA19SoliditySource(row.source, policy);
    const detected = analysis.findingIds.includes(row.familyId);
    const unexpected = row.vulnerable ? analysis.findingIds.filter((id) => id !== row.familyId) : analysis.findingIds;
    const severityMatch = !row.vulnerable || analysis.findings.find((finding) => finding.familyId === row.familyId)?.severity === row.severity;
    return { ...row, source: undefined, detected, unexpectedFindingIds: unexpected, severityMatch, analysis };
  });
  const mutations = [];
  const byKey = new Map(cases.map((row) => [`${row.familyId}|${row.vulnerable}|${row.caseId.split("-").at(-1)}`, row]));
  for (const row of cases) {
    const variant = row.caseId.split("-").at(-1);
    const counterpart = byKey.get(`${row.familyId}|${!row.vulnerable}|${variant}`);
    for (const type of policy.mutations.types) {
      const mutatedSource = mutate(row.source, type, counterpart.source);
      const analysis = analyzeA19SoliditySource(mutatedSource, policy);
      const observed = analysis.findingIds.includes(row.familyId);
      const expected = type === "paired_security_flip" ? !row.vulnerable : row.vulnerable;
      mutations.push({ caseId: row.caseId, familyId: row.familyId, type, expected, observed, killed: observed === expected, sourceSha256: sha256(mutatedSource), findingIds: analysis.findingIds });
    }
  }
  const scope = (split) => results.filter((row) => !split || row.split === split);
  const metricsFor = (rows) => {
    const tp = rows.filter((row) => row.vulnerable && row.detected).length;
    const fn = rows.filter((row) => row.vulnerable && !row.detected).length;
    const tn = rows.filter((row) => !row.vulnerable && !row.detected && row.unexpectedFindingIds.length === 0).length;
    const fp = rows.filter((row) => !row.vulnerable && (row.detected || row.unexpectedFindingIds.length > 0)).length;
    const recall = ratio(tp, tp + fn); const specificity = ratio(tn, tn + fp); const precision = ratio(tp, tp + fp); const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    const severityCorrect = rows.filter((row) => row.vulnerable && row.detected && row.severityMatch).length;
    return { total: rows.length, tp, fn, tn, fp, recall: round(recall), specificity: round(specificity), precision: round(precision), f1: round(f1), severityAccuracy: round(ratio(severityCorrect, tp)), recallWilson95: wilson(tp, tp + fn), specificityWilson95: wilson(tn, tn + fp) };
  };
  const overall = metricsFor(scope());
  const frozen = metricsFor(scope("frozen_test"));
  const mutationKilled = mutations.filter((row) => row.killed).length;
  const mutationKillRate = ratio(mutationKilled, mutations.length);
  const perFamily = policy.families.map((family) => ({ familyId: family.id, severity: family.severity, ...metricsFor(results.filter((row) => row.familyId === family.id)) }));
  const thresholds = policy.thresholds;
  const gates = {
    corpusDenominator: cases.length === policy.corpus.expectedCases,
    vulnerableDenominator: cases.filter((row) => row.vulnerable).length === policy.corpus.expectedVulnerable,
    remediatedDenominator: cases.filter((row) => !row.vulnerable).length === policy.corpus.expectedRemediated,
    splitDenominators: scope("development").length === policy.corpus.expectedDevelopment && scope("validation").length === policy.corpus.expectedValidation && scope("frozen_test").length === policy.corpus.expectedFrozenTest,
    mutationDenominator: mutations.length === policy.mutations.expectedTotal,
    frozenRecall: frozen.recall >= thresholds.minimumFrozenRecall,
    frozenSpecificity: frozen.specificity >= thresholds.minimumFrozenSpecificity,
    frozenPrecision: frozen.precision >= thresholds.minimumFrozenPrecision,
    frozenF1: frozen.f1 >= thresholds.minimumFrozenF1,
    severityAccuracy: frozen.severityAccuracy >= thresholds.minimumSeverityAccuracy,
    mutationKillRate: mutationKillRate >= thresholds.minimumMutationKillRate,
    safeUnexpectedFindings: frozen.fp <= thresholds.maximumSafeCaseUnexpectedFindings,
    everyFamilyCovered: perFamily.every((row) => row.tp > 0 && row.tn > 0),
  };
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([id]) => id);
  const core = {
    schemaVersion: RUNTIME_SCHEMA,
    passId: policy.passId,
    sourceRevisionId: policy.sourceRevisionId,
    evaluatedAt: "2026-07-23T00:00:00.000+02:00",
    denominators: { families: policy.families.length, cases: cases.length, vulnerable: cases.filter((row) => row.vulnerable).length, remediated: cases.filter((row) => !row.vulnerable).length, development: scope("development").length, validation: scope("validation").length, frozenTest: scope("frozen_test").length, mutations: mutations.length, mutationTypes: policy.mutations.types.length },
    overall,
    frozen,
    mutation: { killed: mutationKilled, total: mutations.length, killRate: round(mutationKillRate), wilson95: wilson(mutationKilled, mutations.length) },
    perFamily,
    gates,
    failedGates,
    localStaticBenchmarkPass: failedGates.length === 0,
    paidGateEligible: false,
    independentExternalFamily: false,
    fullAuditClaimAllowed: false,
    customerPurchaseWorthinessProven: false,
    cases: results.map(({ source, ...row }) => row),
    mutations,
    truthBoundary: policy.truthBoundary,
  };
  return { ...core, integritySha256: sha256(core) };
}

export function verifyA19AuditStaticBenchmark(runtime, _policy) {
  if (!runtime || runtime.schemaVersion !== RUNTIME_SCHEMA) return false;
  const copy = { ...runtime }; delete copy.integritySha256;
  if (sha256(copy) !== runtime.integritySha256) return false;
  if (runtime.denominators.cases !== 240 || runtime.denominators.mutations !== 2880) return false;
  if (runtime.paidGateEligible !== false || runtime.independentExternalFamily !== false || runtime.fullAuditClaimAllowed !== false) return false;
  return runtime.localStaticBenchmarkPass === (runtime.failedGates.length === 0);
}
