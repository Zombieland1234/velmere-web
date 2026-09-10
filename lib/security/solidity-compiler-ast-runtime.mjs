import crypto from "node:crypto";
import {
  analyzeSolidityCompilerAst as analyzeR44P38GeneralizationAst,
  COMPILER_AST_SIGNAL_CATALOG as R44P38_GENERALIZATION_SIGNAL_CATALOG,
} from "./solidity-compiler-ast-generalization.mjs";

export const SOLIDITY_COMPILER_AST_ANALYZER_ID = "velmere-solidity-compiler-ast-bounded-v1";
export const SOLIDITY_COMPILER_AST_ANALYZER_CLASS = "SOLC_STANDARD_JSON_AST_IR_BOUNDED_RULE_ENGINE_V1";
export const SOLIDITY_COMPILER_AST_SCHEMA = "velmere.pass36.solidity-compiler-ast-evidence.v1";
export const SOLIDITY_COMPILER_OUTPUT_AST_SCHEMA = "velmere.pass36.solidity-compiler-output-ast-evidence.v1";
export const LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID = "AST_LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK";

const SOURCE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.@+\-/]{1,240}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const EXPECTED_SOLC_PREFIX = "0.8.24+commit.e11b9ed9";
const LEGACY_ARITHMETIC_MAX_EXCLUSIVE = Object.freeze([0, 8, 0]);
const MAX_SOURCE_FILES = 256;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

const R44P38_GENERALIZATION_RULE_IDS = Object.freeze({
  open_mint: "AST_EXTERNALLY_CALLABLE_MINT_WITHOUT_AUTH",
  unguarded_initializer: "AST_UNGUARDED_INITIALIZER",
  missing_pause_guard: "AST_R44P38_MISSING_PAUSE_GUARD",
  insolvent_withdraw: "AST_R44P38_INSOLVENT_WITHDRAW",
  cross_chain_replay: "AST_R44P38_CROSS_CHAIN_REPLAY",
  permit_no_deadline: "AST_PERMIT_DEADLINE_MISSING",
  signature_replay: "AST_SIGNATURE_REPLAY_DOMAIN_OR_NONCE_MISSING",
  spot_oracle: "AST_R44P38_INSTANT_SPOT_ORACLE",
  low_quorum: "AST_R44P38_LOW_QUORUM",
  transfer_policy_bypass: "AST_R44P38_TRANSFER_POLICY_BYPASS",
  fee_token_mismatch: "AST_R44P38_FEE_TOKEN_ACCOUNTING_MISMATCH",
  post_balance_share_accounting: "AST_R44P38_POST_BALANCE_SHARE_ACCOUNTING",
  storage_layout_collision: "AST_R44P38_STORAGE_LAYOUT_COLLISION",
  unprotected_upgrade: "AST_R44P38_UNPROTECTED_UPGRADE",
  unchecked_low_level_call: "AST_UNCHECKED_LOW_LEVEL_CALL",
  reentrancy_state_after_call: "AST_EXTERNAL_INTERACTION_BEFORE_STATE_EFFECT",
});

const R44P38_GENERALIZATION_REMEDIATION = Object.freeze({
  open_mint: "Bind every issuance path to an explicit, revocable role and test unauthorized minting across inherited and wrapped call paths.",
  unguarded_initializer: "Use a durable initializer/reinitializer guard, lock implementation contracts, and test repeated and unauthorized initialization.",
  missing_pause_guard: "Apply the same emergency-stop policy to every value-moving state path and test pause transitions across internal wrappers.",
  insolvent_withdraw: "Enforce post-withdraw solvency or liquidity invariants before transferring value and validate them with fuzz and invariant tests.",
  cross_chain_replay: "Bind message identity to source domain, destination chain, verifying contract, unique nonce and authenticated messenger, then test replay across chains and deployments.",
  permit_no_deadline: "Bind an explicit expiry into the signed payload and enforce it before changing authorization state.",
  signature_replay: "Use chain/contract domain separation plus a durable nonce or consumed-digest registry and reject zero-address recovery.",
  spot_oracle: "Use a manipulation-resistant, freshness-checked oracle or time-weighted observation and define fail-closed stale-data behavior.",
  low_quorum: "Raise the quorum to a governance-approved threshold and test low-participation, delegation and emergency paths.",
  transfer_policy_bypass: "Apply the same denylist/freeze/transfer policy to privileged balance movement and record every exceptional path.",
  fee_token_mismatch: "Credit only the observed token balance delta and test fee-on-transfer, rebasing and callback-capable assets.",
  post_balance_share_accounting: "Compute shares from the pre-deposit asset base or an equivalent invariant-safe formulation and test first-deposit and donation attacks.",
  storage_layout_collision: "Preserve the complete append-only storage prefix, use namespaced storage where appropriate, and verify every upgrade against compiler layouts.",
  unprotected_upgrade: "Restrict implementation changes to reviewed governance with delay, rollback and storage-layout verification.",
  unchecked_low_level_call: "Capture and validate the call result and returned data, then test failure, callback and partial-execution paths.",
  reentrancy_state_after_call: "Apply checks-effects-interactions or a reviewed reentrancy guard and add malicious callback and token-hook invariants.",
});

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function normalizeSourcePath(value) {
  const raw = String(value ?? "");
  if (raw.includes("\\")) return null;
  const text = raw.replace(/^\.\//u, "");
  if (!SOURCE_PATH.test(text) || text.includes("//") || text.includes("\u0000")) return null;
  return text;
}

function normalizeSources(sourceFiles) {
  const blockers = [];
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) blockers.push("compiler_ast_source_bundle_empty");
  if ((sourceFiles?.length ?? 0) > MAX_SOURCE_FILES) blockers.push("compiler_ast_source_file_count_exceeded");
  const seen = new Set();
  let bytes = 0;
  const rows = [];
  for (const [index, row] of (sourceFiles ?? []).entries()) {
    const sourcePath = normalizeSourcePath(row?.path);
    if (!sourcePath) {
      blockers.push(`compiler_ast_source_path_invalid:${index}`);
      continue;
    }
    if (seen.has(sourcePath)) blockers.push(`compiler_ast_source_path_duplicate:${sourcePath}`);
    seen.add(sourcePath);
    const content = String(row?.content ?? "").replace(/\r\n?/gu, "\n");
    const byteLength = Buffer.byteLength(content);
    bytes += byteLength;
    if (byteLength === 0) blockers.push(`compiler_ast_source_empty:${sourcePath}`);
    rows.push({ path: sourcePath, content, byteLength, sha256: sha256(content) });
  }
  if (bytes > MAX_SOURCE_BYTES) blockers.push("compiler_ast_source_bytes_exceeded");
  rows.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const canonical = stable(rows.map(({ path, content }) => ({ path, content })));
  return { rows, blockers: [...new Set(blockers)].sort(), totalBytes: bytes, canonical, sourceBundleSha256: sha256(canonical) };
}

function parseSrc(src) {
  const parts = String(src ?? "").split(":");
  return {
    offset: Number(parts[0] ?? -1),
    length: Number(parts[1] ?? 0),
    sourceIndex: Number(parts[2] ?? -1),
  };
}

function lineForOffset(content, offset) {
  return content.slice(0, Math.max(0, offset)).split("\n").length;
}

function visit(node, callback, parent = null) {
  if (!node || typeof node !== "object") return;
  callback(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === "typeDescriptions" || key === "scope") continue;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, callback, node);
    } else if (value && typeof value === "object") {
      visit(value, callback, node);
    }
  }
}

function containsNode(node, predicate) {
  let found = false;
  visit(node, (candidate) => {
    if (!found && predicate(candidate)) found = true;
  });
  return found;
}

function unwrapCallTargetExpression(expression) {
  let current = expression;
  while (current?.nodeType === "FunctionCallOptions") current = current.expression;
  // Solidity <=0.4 represents `.call.value(x)(...)` and `.call.gas(x)(...)`
  // as nested FunctionCall(MemberAccess(value|gas)) wrappers instead of
  // FunctionCallOptions. Peel those wrappers so the underlying call kind is
  // derived from compiler AST shape rather than source spelling.
  while (current?.nodeType === "FunctionCall"
    && current.expression?.nodeType === "MemberAccess"
    && ["value", "gas"].includes(String(current.expression.memberName ?? ""))) {
    current = current.expression.expression;
    while (current?.nodeType === "FunctionCallOptions") current = current.expression;
  }
  return current;
}

function callName(node) {
  if (node?.nodeType !== "FunctionCall") return null;
  const expression = unwrapCallTargetExpression(node.expression);
  if (expression?.nodeType === "Identifier" || expression?.nodeType === "IdentifierPath") return expression.name ?? null;
  if (expression?.nodeType === "MemberAccess") return expression.memberName ?? null;
  return null;
}

function isMember(node, rootName, memberName) {
  return node?.nodeType === "MemberAccess"
    && node.memberName === memberName
    && node.expression?.nodeType === "Identifier"
    && node.expression.name === rootName;
}

function isMsgSender(node) {
  if (isMember(node, "msg", "sender")) return true;
  return node?.nodeType === "FunctionCall"
    && ["_msgSender", "msgSender"].includes(String(callName(node) ?? ""))
    && (node.arguments?.length ?? 0) === 0;
}

function isTxOrigin(node) {
  return isMember(node, "tx", "origin");
}

function isBlockTimestamp(node) {
  return isMember(node, "block", "timestamp");
}

function isBlockChainId(node) {
  return isMember(node, "block", "chainid");
}

function isAddressThisCall(node) {
  if (node?.nodeType !== "FunctionCall") return false;
  const expression = node.expression;
  const isAddressCast = callName(node) === "address"
    || (expression?.nodeType === "ElementaryTypeNameExpression" && expression.typeName?.name === "address");
  return isAddressCast && (node.arguments ?? []).some((argument) => argument?.nodeType === "Identifier" && argument.name === "this");
}

function referencedDeclarationIds(node) {
  const ids = new Set();
  visit(node, (candidate) => {
    if (Number.isInteger(candidate?.referencedDeclaration)) ids.add(Number(candidate.referencedDeclaration));
  });
  return ids;
}

function functionCalls(node) {
  const rows = [];
  visit(node, (candidate) => {
    if (candidate?.nodeType === "FunctionCall") rows.push(candidate);
  });
  return rows;
}

function lowLevelCallKind(node) {
  if (node?.nodeType !== "FunctionCall") return null;
  const expression = unwrapCallTargetExpression(node.expression);
  if (expression?.nodeType !== "MemberAccess") return null;
  const memberName = String(expression.memberName ?? "");
  return ["call", "callcode", "delegatecall", "staticcall", "send", "transfer"].includes(memberName) ? memberName : null;
}

function highLevelExternalCallKind(node) {
  if (node?.nodeType !== "FunctionCall") return null;
  const expression = unwrapCallTargetExpression(node.expression);
  if (expression?.nodeType !== "MemberAccess") return null;
  const receiverType = String(expression.expression?.typeDescriptions?.typeString ?? "");
  const functionType = String(expression.typeDescriptions?.typeString ?? "");
  if (!/^contract\s/iu.test(receiverType) || /\b(?:view|pure)\b/iu.test(functionType)) return null;
  return String(expression.memberName ?? "external-call");
}

function sourceExcerpt(sourceRow, src) {
  const { offset, length } = parseSrc(src);
  return sourceRow.content.slice(Math.max(0, offset), Math.max(0, offset) + Math.min(Math.max(0, length), 320)).replace(/\s+/gu, " ").trim();
}

function makeFinding({ ruleId, severity, title, description, remediation, sourcePath, sourceRow, contractName, functionName, node, limitations = [] }) {
  const { offset, length } = parseSrc(node?.src);
  const line = lineForOffset(sourceRow.content, offset);
  const core = {
    ruleId,
    state: "finding",
    severity,
    title,
    description,
    remediation,
    sourcePath,
    contractName: contractName ?? null,
    functionName: functionName ?? null,
    line,
    astNodeId: Number.isInteger(node?.id) ? node.id : null,
    sourceSpan: { offset, length },
    excerpt: sourceExcerpt(sourceRow, node?.src),
    confidenceClass: "COMPILER_AST_BOUNDED_RULE_NOT_EXPLOITABILITY_PROOF",
    limitations: [
      "Compiler AST evidence proves the syntactic/semantic shape matched by this bounded rule; it does not prove path reachability or exploitability.",
      "Independent reviewer adjudication remains required before customer-facing vulnerability claims.",
      ...limitations,
    ],
  };
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

function mapR44P38GeneralizationFinding(row, normalizedSources) {
  const ruleId = R44P38_GENERALIZATION_RULE_IDS[row.signalId] ?? `AST_R44P38_${String(row.signalId).toUpperCase()}`;
  const sourcePath = typeof row.sourcePath === "string" && normalizedSources.rows.some((item) => item.path === row.sourcePath)
    ? row.sourcePath
    : normalizedSources.rows[0]?.path ?? "unknown.sol";
  const sourceRow = normalizedSources.rows.find((item) => item.path === sourcePath) ?? normalizedSources.rows[0] ?? { content: "" };
  const line = Number.isInteger(row.line) && row.line > 0 ? row.line : 1;
  const lines = String(sourceRow.content ?? "").split("\n");
  const excerpt = String(lines[line - 1] ?? "").trim().slice(0, 320);
  const offset = lines.slice(0, Math.max(0, line - 1)).reduce((sum, value) => sum + Buffer.byteLength(value) + 1, 0);
  const core = {
    ruleId,
    state: "finding",
    severity: row.severity,
    title: row.title,
    description: `The exact solc 0.8.24 compiler AST matched the bounded R44P38 signal ${row.signalId}. This is a review-priority signal, not exploitability or reachability proof.`,
    remediation: R44P38_GENERALIZATION_REMEDIATION[row.signalId] ?? "Review the compiler-observed path, establish the intended invariant, and add independent tests before relying on the result.",
    sourcePath,
    contractName: row.contractName ?? null,
    functionName: row.functionName ?? null,
    line,
    astNodeId: null,
    sourceSpan: { offset, length: Buffer.byteLength(excerpt) },
    excerpt,
    confidenceClass: "COMPILER_AST_BOUNDED_RULE_NOT_EXPLOITABILITY_PROOF",
    limitations: [
      "This signal belongs to a bounded locally designed compiler-AST benchmark; independent ground truth and real-protocol validation remain absent.",
      "No symbolic path feasibility, chain state, economic invariant proof or exploit reproduction is implied.",
    ],
  };
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

function mergeCompilerAstFindingRows(primary, generalization) {
  const rows = [];
  const seen = new Set();
  for (const row of [...generalization, ...primary]) {
    const key = `${row.ruleId}|${row.sourcePath}|${row.contractName ?? ""}|${row.functionName ?? ""}|${row.line ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows.sort((left, right) => `${left.sourcePath}|${left.line}|${left.ruleId}|${left.functionName ?? ""}`.localeCompare(`${right.sourcePath}|${right.line}|${right.ruleId}|${right.functionName ?? ""}`));
}

function applyContextQualifiedInteractionOrdering(primaryFindings, generalizationAnalysis) {
  const contexts = Array.isArray(generalizationAnalysis?.suppressedInteractionPatterns)
    ? generalizationAnalysis.suppressedInteractionPatterns
    : [];
  const contextKeys = new Set(contexts.map((row) => `${row.sourcePath ?? ""}|${row.contractName ?? ""}|${row.functionName ?? ""}`));
  const kept = [];
  const suppressed = [];
  for (const finding of primaryFindings) {
    const key = `${finding.sourcePath ?? ""}|${finding.contractName ?? ""}|${finding.functionName ?? ""}`;
    if (finding.ruleId === "AST_EXTERNAL_INTERACTION_BEFORE_STATE_EFFECT" && contextKeys.has(key)) {
      suppressed.push({
        ruleId: finding.ruleId,
        sourcePath: finding.sourcePath,
        contractName: finding.contractName,
        functionName: finding.functionName,
        line: finding.line,
        classification: "CONTEXT_QUALIFIED_REVIEW_ROW_NOT_CONFIRMED_FINDING",
        independentReviewRequired: true,
      });
      continue;
    }
    kept.push(finding);
  }
  return { findings: kept, suppressed };
}

function buildContractIndex(output, normalizedSources) {
  const sourceRows = new Map(normalizedSources.rows.map((row) => [row.path, row]));
  const contractsById = new Map();
  const functionsById = new Map();
  const modifiersById = new Map();
  const variablesById = new Map();
  const nodesById = new Map();
  const parentById = new Map();
  const sourceUnits = [];
  for (const [sourcePath, sourceOutput] of Object.entries(output.sources ?? {})) {
    const ast = sourceOutput?.ast;
    if (!ast || !sourceRows.has(sourcePath)) continue;
    sourceUnits.push({ sourcePath, sourceId: sourceOutput.id ?? null, astId: ast.id ?? null });
    visit(ast, (node, parent) => {
      if (Number.isInteger(node?.id)) {
        nodesById.set(node.id, { node, sourcePath });
        if (Number.isInteger(parent?.id)) parentById.set(node.id, parent.id);
      }
      if (node?.nodeType === "ContractDefinition") contractsById.set(node.id, { node, sourcePath });
      if (node?.nodeType === "FunctionDefinition") functionsById.set(node.id, { node, sourcePath });
      if (node?.nodeType === "ModifierDefinition") modifiersById.set(node.id, { node, sourcePath });
      if (node?.nodeType === "VariableDeclaration") variablesById.set(node.id, { node, sourcePath });
    });
  }
  return { sourceRows, contractsById, functionsById, modifiersById, variablesById, nodesById, parentById, sourceUnits };
}

function contractStateVariableIds(contractRow, index) {
  const ids = new Set();
  const linearized = Array.isArray(contractRow.node.linearizedBaseContracts)
    ? contractRow.node.linearizedBaseContracts
    : [contractRow.node.id];
  for (const contractId of linearized) {
    const row = index.contractsById.get(contractId);
    for (const child of row?.node?.nodes ?? []) {
      if (child?.nodeType === "VariableDeclaration" && child.stateVariable === true && Number.isInteger(child.id)) ids.add(child.id);
    }
  }
  return ids;
}

function contractStateVariableNames(contractRow, index) {
  const result = new Map();
  for (const id of contractStateVariableIds(contractRow, index)) {
    const variable = index.variablesById.get(id)?.node;
    result.set(id, String(variable?.name ?? ""));
  }
  return result;
}

function modifierNames(fn) {
  return (fn.modifiers ?? []).map((row) => row?.modifierName?.name ?? row?.modifierName?.namePath ?? "").filter(Boolean);
}

function isExternallyCallable(fn) {
  return fn?.kind !== "constructor" && (fn?.visibility === "public" || fn?.visibility === "external");
}

function isStateReference(node, stateIds) {
  return Number.isInteger(node?.referencedDeclaration) && stateIds.has(node.referencedDeclaration);
}

function isPrivilegedStateReference(node, stateNames) {
  const id = Number(node?.referencedDeclaration);
  const name = stateNames.get(id) ?? "";
  return /(?:owner|creator|admin|authority|controller|governor|guardian|operator|role|minter|implementation|beacon|upgrader)/iu.test(name);
}

function isDynamicArrayStateVariable(variable) {
  const typeString = String(variable?.typeDescriptions?.typeString ?? "").replace(/\s+/gu, " ").trim();
  return /\[\](?: storage)?$/u.test(typeString) || variable?.typeName?.nodeType === "ArrayTypeName" && variable.typeName.length === null;
}

function hasUnboundedDynamicArrayIndexWrite(fn, stateIds, dynamicArrayIds) {
  if (!fn?.body || dynamicArrayIds.size === 0) return false;
  const params = parameterIds(fn);
  let found = false;
  visit(fn.body, (node) => {
    if (found || (node?.nodeType !== "Assignment" && node?.nodeType !== "UnaryOperation")) return;
    const target = node.nodeType === "Assignment" ? node.leftHandSide : node.subExpression;
    if (target?.nodeType !== "IndexAccess") return;
    const baseRefs = referencedDeclarationIds(target.baseExpression);
    const indexRefs = referencedDeclarationIds(target.indexExpression);
    if ([...baseRefs].some((id) => stateIds.has(id) && dynamicArrayIds.has(id)) && [...indexRefs].some((id) => params.has(id))) found = true;
  });
  return found;
}

function mappingIndexedBySender(node) {
  if (node?.nodeType !== "IndexAccess" || !node.indexExpression) return false;
  return containsNode(node.indexExpression, isMsgSender);
}

function isMappingStateVariable(variable) {
  const typeString = String(variable?.typeDescriptions?.typeString ?? "").replace(/\s+/gu, " ").trim();
  return typeString.startsWith("mapping(") || variable?.typeName?.nodeType === "Mapping";
}

function withdrawalAccountingSignals(fn, stateIds, index) {
  if (!fn?.body) return { missingConsumption: [], invertedLimits: [] };
  const mappingIds = new Set([...stateIds].filter((id) => isMappingStateVariable(index.variablesById.get(id)?.node)));
  const params = parameterIds(fn);
  const writtenMappings = new Set();
  for (const row of stateWriteRows(fn, stateIds)) {
    for (const id of referencedDeclarationIds(row.node)) if (mappingIds.has(id)) writtenMappings.add(id);
  }

  const missingConsumption = [];
  for (const call of functionCalls(fn.body)) {
    const kind = lowLevelCallKind(call);
    if (!["transfer", "send", "call"].includes(String(kind ?? ""))) continue;
    const expression = unwrapCallTargetExpression(call.expression);
    const receiver = expression?.nodeType === "MemberAccess" ? expression.expression : null;
    if (!receiver || !containsNode(receiver, isMsgSender)) continue;
    const argumentMappingIds = new Set();
    for (const argument of call.arguments ?? []) {
      for (const id of referencedDeclarationIds(argument)) if (mappingIds.has(id)) argumentMappingIds.add(id);
    }
    for (const id of argumentMappingIds) if (!writtenMappings.has(id)) missingConsumption.push({ call, mappingId: id });
  }

  const invertedLimits = [];
  visit(fn.body, (node) => {
    if (node?.nodeType !== "BinaryOperation" || ![">=", "<="].includes(String(node.operator ?? ""))) return;
    const leftRefs = referencedDeclarationIds(node.leftExpression);
    const rightRefs = referencedDeclarationIds(node.rightExpression);
    const leftParam = [...leftRefs].some((id) => params.has(id));
    const rightParam = [...rightRefs].some((id) => params.has(id));
    const leftMapping = [...leftRefs].some((id) => mappingIds.has(id));
    const rightMapping = [...rightRefs].some((id) => mappingIds.has(id));
    // Safe withdrawal bounds are amount <= balance or balance >= amount.
    // The opposite orientation permits values at or above the recorded balance.
    const inverted = (node.operator === ">=" && leftParam && rightMapping)
      || (node.operator === "<=" && leftMapping && rightParam);
    if (inverted) invertedLimits.push(node);
  });
  return { missingConsumption, invertedLimits };
}

function conditionHasSenderAuth(node, stateIds, stateNames, functionSummary, depth = 0) {
  if (!node || depth > 4) return false;
  if (node.nodeType === "BinaryOperation" && ["==", "!="].includes(node.operator)) {
    const leftSender = containsNode(node.leftExpression, isMsgSender);
    const rightSender = containsNode(node.rightExpression, isMsgSender);
    if (leftSender !== rightSender) {
      const other = leftSender ? node.rightExpression : node.leftExpression;
      if (containsNode(other, (candidate) => isStateReference(candidate, stateIds) || isPrivilegedStateReference(candidate, stateNames) || mappingIndexedBySender(candidate))) return true;
    }
  }
  if (node.nodeType === "IndexAccess" && mappingIndexedBySender(node)) return true;
  if (node.nodeType === "FunctionCall") {
    const referenced = Number(node.expression?.referencedDeclaration ?? node.expression?.expression?.referencedDeclaration);
    if (Number.isInteger(referenced) && functionSummary(referenced, depth + 1).returnsSenderAuth) return true;
  }
  return Object.entries(node).some(([key, value]) => {
    if (key === "typeDescriptions" || key === "scope") return false;
    if (Array.isArray(value)) return value.some((child) => child && typeof child === "object" && conditionHasSenderAuth(child, stateIds, stateNames, functionSummary, depth));
    return value && typeof value === "object" ? conditionHasSenderAuth(value, stateIds, stateNames, functionSummary, depth) : false;
  });
}

function containsRevert(node) {
  return containsNode(node, (candidate) => candidate?.nodeType === "RevertStatement" || (candidate?.nodeType === "FunctionCall" && callName(candidate) === "revert"));
}

function accessAnalysis(contractRow, index) {
  const stateIds = contractStateVariableIds(contractRow, index);
  const stateNames = contractStateVariableNames(contractRow, index);
  const cache = new Map();
  const active = new Set();

  const summarizeFunction = (functionId, depth = 0) => {
    if (cache.has(functionId)) return cache.get(functionId);
    if (active.has(functionId) || depth > 4) return { returnsSenderAuth: false, enforcesSenderAuth: false };
    active.add(functionId);
    const fn = index.functionsById.get(functionId)?.node;
    let returnsSenderAuth = false;
    let enforcesSenderAuth = false;
    if (fn?.body) {
      visit(fn.body, (node) => {
        if (node?.nodeType === "Return" && conditionHasSenderAuth(node.expression, stateIds, stateNames, summarizeFunction, depth + 1)) returnsSenderAuth = true;
        if (node?.nodeType === "FunctionCall" && ["require", "assert"].includes(callName(node))) {
          if (conditionHasSenderAuth(node.arguments?.[0], stateIds, stateNames, summarizeFunction, depth + 1)) enforcesSenderAuth = true;
        }
        if (node?.nodeType === "IfStatement" && conditionHasSenderAuth(node.condition, stateIds, stateNames, summarizeFunction, depth + 1)) {
          if (containsRevert(node.trueBody) || containsRevert(node.falseBody)) enforcesSenderAuth = true;
        }
      });
      for (const call of functionCalls(fn.body)) {
        const referenced = Number(call.expression?.referencedDeclaration ?? call.expression?.expression?.referencedDeclaration);
        if (Number.isInteger(referenced) && referenced !== functionId) {
          const child = summarizeFunction(referenced, depth + 1);
          if (child.enforcesSenderAuth) enforcesSenderAuth = true;
        }
      }
    }
    const result = { returnsSenderAuth, enforcesSenderAuth };
    cache.set(functionId, result);
    active.delete(functionId);
    return result;
  };

  const modifierEnforces = (modifierId) => {
    const modifier = index.modifiersById.get(modifierId)?.node;
    if (!modifier?.body) return false;
    let enforced = false;
    visit(modifier.body, (node) => {
      if (node?.nodeType === "FunctionCall" && ["require", "assert"].includes(callName(node)) && conditionHasSenderAuth(node.arguments?.[0], stateIds, stateNames, summarizeFunction)) enforced = true;
      if (node?.nodeType === "IfStatement" && conditionHasSenderAuth(node.condition, stateIds, stateNames, summarizeFunction) && (containsRevert(node.trueBody) || containsRevert(node.falseBody))) enforced = true;
    });
    return enforced;
  };

  const functionHasAccessControl = (fn) => {
    const names = modifierNames(fn);
    if (names.some((name) => /^(?:onlyOwner|onlyAdmin|onlyRole|auth|authorized|governance|requiresAuth|ownerOnly|adminOnly)$/iu.test(name))) return true;
    for (const invocation of fn.modifiers ?? []) {
      const id = Number(invocation?.modifierName?.referencedDeclaration);
      if (Number.isInteger(id) && modifierEnforces(id)) return true;
    }
    return summarizeFunction(fn.id).enforcesSenderAuth;
  };

  return { stateIds, stateNames, summarizeFunction, functionHasAccessControl };
}

function ancestorChain(node, index) {
  const rows = [node];
  let current = node;
  const seen = new Set();
  while (Number.isInteger(current?.id) && index.parentById.has(current.id) && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = index.nodesById.get(index.parentById.get(current.id))?.node;
    if (!parent) break;
    rows.push(parent);
    current = parent;
  }
  return rows;
}

function branchContainsRevertLike(node, index, depth = 0, seen = new Set()) {
  if (!node || depth > 5) return false;
  if (containsRevert(node)) return true;
  let found = false;
  visit(node, (candidate) => {
    if (found || candidate?.nodeType !== "FunctionCall") return;
    const name = String(callName(candidate) ?? "");
    if (/(?:revert|fail|throw)/iu.test(name)) { found = true; return; }
    const referenced = referencedFunctionId(candidate);
    if (referenced === null || seen.has(referenced)) return;
    const child = index.functionsById.get(referenced)?.node;
    if (!child?.body) return;
    const nextSeen = new Set(seen); nextSeen.add(referenced);
    if (branchContainsRevertLike(child.body, index, depth + 1, nextSeen)) found = true;
  });
  return found;
}

function functionChecksBooleanParameter(fn, parameterId, index, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 5 || seen.has(fn.id)) return false;
  const nextSeen = new Set(seen); nextSeen.add(fn.id);
  let checked = false;
  visit(fn.body, (node) => {
    if (checked) return;
    if (node?.nodeType === "FunctionCall" && ["require", "assert"].includes(callName(node))) {
      if (referencedDeclarationIds(node.arguments?.[0]).has(parameterId)) checked = true;
    }
    if (node?.nodeType === "IfStatement" && referencedDeclarationIds(node.condition).has(parameterId)) {
      if (branchContainsRevertLike(node.trueBody, index) || branchContainsRevertLike(node.falseBody, index)) checked = true;
    }
    if (node?.nodeType === "FunctionCall") {
      const referenced = referencedFunctionId(node);
      const child = referenced !== null ? index.functionsById.get(referenced)?.node : null;
      if (!child?.body) return;
      const args = node.arguments ?? [];
      for (let argIndex = 0; argIndex < args.length; argIndex += 1) {
        if (!referencedDeclarationIds(args[argIndex]).has(parameterId)) continue;
        const childParam = child.parameters?.parameters?.[argIndex];
        if (Number.isInteger(childParam?.id) && functionChecksBooleanParameter(child, childParam.id, index, depth + 1, nextSeen)) checked = true;
      }
    }
  });
  return checked;
}

function lowLevelCallChecked(call, fn, index) {
  const chain = ancestorChain(call, index);
  const directRequire = chain.some((node) => node?.nodeType === "FunctionCall" && node !== call && ["require", "assert"].includes(callName(node)));
  const conditionalCheck = chain.some((node) => node?.nodeType === "IfStatement" && containsNode(node.condition, (candidate) => candidate === call));
  if (directRequire || conditionalCheck || chain.some((node) => node?.nodeType === "Return")) return true;
  const declaration = chain.find((node) => node?.nodeType === "VariableDeclarationStatement");
  if (!declaration) return false;
  const boolIds = (declaration.declarations ?? []).filter(Boolean).map((row) => row.id).filter(Number.isInteger);
  if (boolIds.length === 0) return false;
  const callOffset = parseSrc(call.src).offset;
  let checked = false;
  visit(fn.body, (node) => {
    if (checked || !node || typeof node !== "object") return;
    if (parseSrc(node.src).offset <= callOffset) return;
    if (node.nodeType === "IfStatement") {
      const refs = referencedDeclarationIds(node.condition);
      if (boolIds.some((id) => refs.has(id)) && (branchContainsRevertLike(node.trueBody, index) || branchContainsRevertLike(node.falseBody, index))) checked = true;
      return;
    }
    if (node.nodeType === "Return") {
      const refs = referencedDeclarationIds(node.expression);
      if (boolIds.some((id) => refs.has(id))) checked = true;
      return;
    }
    if (node.nodeType !== "FunctionCall") return;
    if (["require", "assert"].includes(callName(node))) {
      const refs = referencedDeclarationIds(node.arguments?.[0]);
      if (boolIds.some((id) => refs.has(id))) checked = true;
      return;
    }
    const referenced = referencedFunctionId(node);
    const child = referenced !== null ? index.functionsById.get(referenced)?.node : null;
    if (!child?.body) return;
    for (let argIndex = 0; argIndex < (node.arguments?.length ?? 0); argIndex += 1) {
      const refs = referencedDeclarationIds(node.arguments[argIndex]);
      const captured = boolIds.find((id) => refs.has(id));
      const childParam = child.parameters?.parameters?.[argIndex];
      if (captured !== undefined && Number.isInteger(childParam?.id) && functionChecksBooleanParameter(child, childParam.id, index)) checked = true;
    }
  });
  return checked;
}

function stateWriteRows(fn, stateIds) {
  const rows = [];
  visit(fn.body, (node) => {
    const isWrite = node?.nodeType === "Assignment"
      || (node?.nodeType === "UnaryOperation" && ["++", "--", "delete"].includes(node.operator));
    if (!isWrite) return;
    const target = node.nodeType === "Assignment" ? node.leftHandSide : node.subExpression;
    const refs = referencedDeclarationIds(target);
    if ([...refs].some((id) => stateIds.has(id))) rows.push({ node, offset: parseSrc(node.src).offset });
  });
  return rows.sort((a, b) => a.offset - b.offset);
}

function referencedFunctionId(call) {
  const expression = unwrapCallTargetExpression(call?.expression);
  const value = Number(expression?.referencedDeclaration);
  return Number.isInteger(value) ? value : null;
}

function functionContainsCallNameRecursive(fn, names, index, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 4 || seen.has(fn.id)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(fn.id);
  for (const call of functionCalls(fn.body)) {
    if (names.has(callName(call) ?? "")) return true;
    const referenced = referencedFunctionId(call);
    if (referenced !== null) {
      const child = index.functionsById.get(referenced)?.node;
      if (functionContainsCallNameRecursive(child, names, index, depth + 1, nextSeen)) return true;
    }
  }
  return false;
}

function functionContainsPredicateRecursive(fn, predicate, index, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 4 || seen.has(fn.id)) return false;
  if (containsNode(fn.body, predicate)) return true;
  const nextSeen = new Set(seen);
  nextSeen.add(fn.id);
  for (const call of functionCalls(fn.body)) {
    const referenced = referencedFunctionId(call);
    if (referenced === null) continue;
    const child = index.functionsById.get(referenced)?.node;
    if (functionContainsPredicateRecursive(child, predicate, index, depth + 1, nextSeen)) return true;
  }
  return false;
}

function functionHasExternalInteraction(fn, index, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 4 || seen.has(fn.id)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(fn.id);
  for (const call of functionCalls(fn.body)) {
    const kind = lowLevelCallKind(call);
    const externalKind = highLevelExternalCallKind(call);
    const name = callName(call);
    if ((kind && kind !== "staticcall") || externalKind || ["safeTransfer", "safeTransferFrom", "transfer", "transferFrom"].includes(name ?? "")) return true;
    const referenced = referencedFunctionId(call);
    if (referenced !== null && functionHasExternalInteraction(index.functionsById.get(referenced)?.node, index, depth + 1, nextSeen)) return true;
  }
  return false;
}

function modifierInteractionRows(fn, index) {
  const rows = [];
  const fnRange = parseSrc(fn.src);
  const fnStart = fnRange.offset;
  const fnEnd = fnRange.offset + fnRange.length;
  for (const [modifierIndex, invocation] of (fn.modifiers ?? []).entries()) {
    const modifierId = Number(invocation?.modifierName?.referencedDeclaration ?? invocation?.referencedDeclaration);
    const modifier = Number.isInteger(modifierId) ? index.modifiersById.get(modifierId)?.node : null;
    if (!modifier?.body) continue;
    let placeholderOffset = Number.POSITIVE_INFINITY;
    visit(modifier.body, (node) => {
      if (node?.nodeType === "PlaceholderStatement") placeholderOffset = Math.min(placeholderOffset, parseSrc(node.src).offset);
    });
    for (const call of functionCalls(modifier.body)) {
      const kind = lowLevelCallKind(call);
      const externalKind = highLevelExternalCallKind(call);
      const name = callName(call);
      const referenced = referencedFunctionId(call);
      const child = referenced !== null ? index.functionsById.get(referenced)?.node : null;
      const interactionKind = kind && kind !== "staticcall"
        ? kind
        : externalKind
          ? `high-level:${externalKind}`
          : ["safeTransfer", "safeTransferFrom", "transfer", "transferFrom"].includes(name ?? "")
            ? name
            : child && functionHasExternalInteraction(child, index)
              ? "modifier-internal-wrapper-external-interaction"
              : null;
      if (!interactionKind) continue;
      const sourceOffset = parseSrc(call.src).offset;
      const beforePlaceholder = sourceOffset < placeholderOffset;
      const syntheticOffset = beforePlaceholder
        ? fnStart - 1 - ((fn.modifiers?.length ?? 1) - modifierIndex) / 1000
        : fnEnd + 1 + modifierIndex / 1000;
      rows.push({ node: call, kind: interactionKind, offset: syntheticOffset, modifierName: modifier.name ?? null, beforePlaceholder });
    }
  }
  return rows;
}

function interactionRows(fn, index) {
  const rows = [];
  for (const call of functionCalls(fn.body)) {
    const kind = lowLevelCallKind(call);
    const externalKind = highLevelExternalCallKind(call);
    const name = callName(call);
    if (kind && kind !== "staticcall") rows.push({ node: call, kind, offset: parseSrc(call.src).offset });
    else if (externalKind) rows.push({ node: call, kind: `high-level:${externalKind}`, offset: parseSrc(call.src).offset });
    else if (["safeTransfer", "safeTransferFrom", "transfer", "transferFrom"].includes(name ?? "")) rows.push({ node: call, kind: name, offset: parseSrc(call.src).offset });
    else {
      const referenced = referencedFunctionId(call);
      const child = referenced !== null ? index.functionsById.get(referenced)?.node : null;
      if (child && functionHasExternalInteraction(child, index)) rows.push({ node: call, kind: "internal-wrapper-external-interaction", offset: parseSrc(call.src).offset });
    }
  }
  rows.push(...modifierInteractionRows(fn, index));
  return rows.sort((a, b) => a.offset - b.offset);
}

function functionHasInitializerGuard(fn, stateIds, stateNames) {
  const names = modifierNames(fn);
  if (names.some((name) => /^(?:initializer|reinitializer|onlyInitializing)$/iu.test(name))) return true;
  let checked = false;
  let written = false;
  visit(fn.body, (node) => {
    if (node?.nodeType === "FunctionCall" && ["require", "assert"].includes(callName(node))) {
      const refs = referencedDeclarationIds(node.arguments?.[0]);
      if ([...refs].some((id) => /(?:initialized|initializing)/iu.test(stateNames.get(id) ?? ""))) checked = true;
    }
    if (node?.nodeType === "Assignment") {
      const refs = referencedDeclarationIds(node.leftHandSide);
      if ([...refs].some((id) => stateIds.has(id) && /(?:initialized|initializing)/iu.test(stateNames.get(id) ?? ""))) written = true;
    }
  });
  return checked && written;
}

function parameterIds(fn) {
  return new Set((fn.parameters?.parameters ?? []).map((row) => row?.id).filter(Number.isInteger));
}

function delegatecallTargetParameterIds(call, fn) {
  const expression = unwrapCallTargetExpression(call.expression);
  const target = expression?.nodeType === "MemberAccess" ? expression.expression : null;
  if (!target) return new Set();
  const refs = referencedDeclarationIds(target);
  const params = parameterIds(fn);
  return new Set([...refs].filter((id) => params.has(id)));
}

function delegatecallTargetIsParameter(call, fn) {
  return delegatecallTargetParameterIds(call, fn).size > 0;
}

function delegatecallTargetHasStatePolicyGuard(call, fn, stateIds) {
  const targetIds = delegatecallTargetParameterIds(call, fn);
  if (!targetIds.size || !fn?.body) return false;
  let guarded = false;
  const conditionHasIndexedPolicy = (condition) => containsNode(condition, (candidate) => {
    if (candidate?.nodeType !== "IndexAccess") return false;
    const baseRefs = referencedDeclarationIds(candidate.baseExpression);
    const indexRefs = referencedDeclarationIds(candidate.indexExpression);
    return [...baseRefs].some((id) => stateIds.has(id)) && [...indexRefs].some((id) => targetIds.has(id));
  });
  visit(fn.body, (node) => {
    if (guarded) return;
    if (node?.nodeType === "FunctionCall" && ["require", "assert"].includes(callName(node)) && conditionHasIndexedPolicy(node.arguments?.[0])) guarded = true;
    if (node?.nodeType === "IfStatement" && conditionHasIndexedPolicy(node.condition) && (containsRevert(node.trueBody) || containsRevert(node.falseBody))) guarded = true;
  });
  return guarded;
}

function functionHasDomainBinding(fn, index) {
  return functionContainsPredicateRecursive(fn, isBlockChainId, index)
    && functionContainsPredicateRecursive(fn, isAddressThisCall, index);
}

function reachableFunctionBodies(fn, index, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 6 || seen.has(fn.id)) return [];
  const nextSeen = new Set(seen);
  nextSeen.add(fn.id);
  const rows = [fn.body];
  for (const call of functionCalls(fn.body)) {
    const referenced = referencedFunctionId(call);
    if (referenced === null) continue;
    const child = index.functionsById.get(referenced)?.node;
    if (child && ["internal", "private"].includes(String(child.visibility ?? ""))) rows.push(...reachableFunctionBodies(child, index, depth + 1, nextSeen));
  }
  return rows;
}

function functionHasNonceBinding(fn, stateIds, stateNames, index) {
  if (!fn?.body) return false;
  const bodies = reachableFunctionBodies(fn, index);
  const mutatedStateIds = new Set();
  const localStateProvenance = new Map();
  const payloadRefs = new Set();
  const recoveryRefs = new Set();

  for (const body of bodies) visit(body, (node) => {
    if (node?.nodeType === "VariableDeclarationStatement" && node.initialValue) {
      const stateRefs = [...referencedDeclarationIds(node.initialValue)].filter((id) => stateIds.has(id));
      if (stateRefs.length > 0) {
        for (const declaration of node.declarations ?? []) {
          if (Number.isInteger(declaration?.id)) localStateProvenance.set(declaration.id, new Set(stateRefs));
        }
      }
      if (containsNode(node.initialValue, (candidate) => candidate?.nodeType === "UnaryOperation" && ["++", "--", "delete"].includes(candidate.operator))) {
        for (const id of stateRefs) mutatedStateIds.add(id);
      }
    }

    if (node?.nodeType === "Assignment" || node?.nodeType === "UnaryOperation") {
      const target = node.nodeType === "Assignment" ? node.leftHandSide : node.subExpression;
      for (const id of referencedDeclarationIds(target)) if (stateIds.has(id)) mutatedStateIds.add(id);
    }

    if (node?.nodeType === "FunctionCall") {
      const name = callName(node) ?? "";
      if (["keccak256", "sha256", "encode", "encodePacked"].includes(name)) {
        for (const id of referencedDeclarationIds(node)) payloadRefs.add(id);
      }
      if (name === "ecrecover") {
        for (const id of referencedDeclarationIds(node)) recoveryRefs.add(id);
      }
    }
  });

  const payloadStateIds = new Set([...payloadRefs].filter((id) => stateIds.has(id)));
  for (const id of payloadRefs) {
    for (const stateId of localStateProvenance.get(id) ?? []) payloadStateIds.add(stateId);
  }
  if ([...mutatedStateIds].some((id) => payloadStateIds.has(id))) return true;

  // Durable used-digest registries often mutate a state mapping indexed by the
  // same digest supplied to ecrecover. This bounded relation is name-independent.
  let usedDigestRegistry = false;
  for (const body of bodies) visit(body, (node) => {
    if (usedDigestRegistry || (node?.nodeType !== "Assignment" && node?.nodeType !== "UnaryOperation")) return;
    const target = node.nodeType === "Assignment" ? node.leftHandSide : node.subExpression;
    const targetRefs = referencedDeclarationIds(target);
    const touchesState = [...targetRefs].some((id) => stateIds.has(id));
    const sharesRecoveryValue = [...targetRefs].some((id) => recoveryRefs.has(id));
    if (touchesState && sharesRecoveryValue) usedDigestRegistry = true;
  });
  if (usedDigestRegistry) return true;

  // Internal nonce consumers (for example an inherited `_useNonce` helper)
  // are accepted only when the reachable helper actually mutates a state
  // variable whose semantic role is nonce/used-digest tracking.
  if ([...mutatedStateIds].some((id) => /(?:nonce|used|digest|executed|consumed)/iu.test(stateNames.get(id) ?? ""))) return true;

  // Keep an explicit-name fallback for simple direct nonce/used-digest state,
  // while the primary decision above survives identifier renaming.
  return [...mutatedStateIds].some((id) => /(?:nonce|used|digest|executed|consumed)/iu.test(stateNames.get(id) ?? ""));
}

function functionHasDeadlineCheck(fn) {
  const deadlineIds = new Set((fn.parameters?.parameters ?? []).filter((row) => /(?:deadline|expiry|expires|validUntil)/iu.test(String(row?.name ?? ""))).map((row) => row.id));
  if (deadlineIds.size === 0) return false;
  let found = false;
  visit(fn.body, (node) => {
    if (found || node?.nodeType !== "BinaryOperation" || !["<", "<=", ">", ">="].includes(node.operator)) return;
    const hasTimestamp = containsNode(node, isBlockTimestamp);
    const refs = referencedDeclarationIds(node);
    if (hasTimestamp && [...deadlineIds].some((id) => refs.has(id))) found = true;
  });
  return found;
}

function compilerSemanticTuple(version) {
  const match = String(version ?? "").match(/^(\d+)\.(\d+)\.(\d+)(?:\+|\b)/u);
  return match ? match.slice(1, 4).map((value) => Number.parseInt(value, 10)) : null;
}

function semanticTupleLessThan(left, right) {
  if (!Array.isArray(left) || left.length !== 3) return false;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] < right[index]) return true;
    if (left[index] > right[index]) return false;
  }
  return false;
}

function legacyMultiplicationRuleEvaluation(compilerVersion, compilationExecuted) {
  const semanticVersion = compilerSemanticTuple(compilerVersion);
  const legacyEligible = Boolean(semanticVersion && semanticTupleLessThan(semanticVersion, LEGACY_ARITHMETIC_MAX_EXCLUSIVE));
  const status = !compilationExecuted
    ? "WITHHELD_COMPILATION_NOT_EXECUTED"
    : !semanticVersion
      ? "WITHHELD_COMPILER_VERSION_UNPARSEABLE"
      : legacyEligible
        ? "EVALUATED_LEGACY_COMPILER"
        : "NOT_APPLICABLE_SOLC_0_8_OR_LATER";
  return {
    ruleId: LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID,
    status,
    compilerVersion: String(compilerVersion ?? ""),
    compilerRange: ">=0.4.0 <0.8.0",
    exactCompilerBound: Boolean(semanticVersion),
    legacyWraparoundSemantics: legacyEligible,
    supportedScope: "DIRECT_OR_LOCAL_ALIAS_UNSIGNED_EXTERNAL_PARAMETER_TAINT_TO_BOUNDED_NATIVE_TOKEN_PAYMENT_OR_SEMANTIC_STATE_SINK",
    candidateMultiplications: 0,
    unsignedExternalTaintedMultiplications: 0,
    boundedEconomicSinkMatches: 0,
    guardedOrRangeProvenSuppressions: 0,
    findings: 0,
    broadArithmeticCoverageCredit: false,
    exploitabilityCredit: false,
    formalAccuracyCredit: false,
  };
}

function uintBits(node) {
  const typeString = String(node?.typeDescriptions?.typeString ?? node?.commonType?.typeString ?? "");
  const match = typeString.match(/(?:^|\b)uint(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?(?:\b|$)/u);
  if (!match) return null;
  return match[1] ? Number.parseInt(match[1], 10) : 256;
}

function literalBigInt(node) {
  if (node?.nodeType !== "Literal" || !["number", "rationalNumber"].includes(String(node.kind ?? "number"))) return null;
  const raw = String(node.value ?? "").replaceAll("_", "");
  if (/^0x[a-f0-9]+$/iu.test(raw) || /^\d+$/u.test(raw)) {
    try { return BigInt(raw); } catch { return null; }
  }
  return null;
}

function nodeEndOffset(node) {
  const { offset, length } = parseSrc(node?.src);
  return Math.max(0, offset) + Math.max(0, length);
}

function buildFunctionValueFlow(fn) {
  const parameters = parameterIds(fn);
  const declarations = new Map();
  const initializers = new Map();
  const assignments = new Map();
  visit(fn.body, (node) => {
    if (node?.nodeType === "VariableDeclarationStatement") {
      for (const declaration of node.declarations ?? []) {
        if (!Number.isInteger(declaration?.id)) continue;
        declarations.set(declaration.id, declaration);
        if (node.initialValue) initializers.set(declaration.id, {
          expression: node.initialValue,
          offset: parseSrc(node.initialValue.src).offset,
        });
      }
    }
    if (node?.nodeType === "Assignment" && node.leftHandSide?.nodeType === "Identifier") {
      const id = Number(node.leftHandSide.referencedDeclaration);
      if (!Number.isInteger(id)) return;
      const rows = assignments.get(id) ?? [];
      rows.push({ expression: node.rightHandSide, offset: parseSrc(node.src).offset });
      assignments.set(id, rows);
    }
  });
  for (const parameter of fn.parameters?.parameters ?? []) {
    if (Number.isInteger(parameter?.id)) declarations.set(parameter.id, parameter);
  }
  for (const rows of assignments.values()) rows.sort((left, right) => left.offset - right.offset);
  return { parameters, declarations, initializers, assignments };
}

function valueExpressionsBefore(id, flow, beforeOffset) {
  const rows = [];
  const initial = flow.initializers.get(id);
  if (initial && initial.offset <= beforeOffset) rows.push(initial);
  for (const assignment of flow.assignments.get(id) ?? []) {
    if (assignment.offset <= beforeOffset) rows.push(assignment);
  }
  return rows.sort((left, right) => right.offset - left.offset);
}

function expressionIsExternallyTainted(expression, flow, beforeOffset, seen = new Set()) {
  if (!expression || seen.size > 32) return false;
  if (containsNode(expression, (node) => isMember(node, "msg", "value") || isMember(node, "msg", "data"))) return true;
  for (const id of referencedDeclarationIds(expression)) {
    if (flow.parameters.has(id)) return true;
    if (seen.has(id) || !flow.declarations.has(id)) continue;
    const nextSeen = new Set(seen); nextSeen.add(id);
    const latest = valueExpressionsBefore(id, flow, beforeOffset)[0];
    if (latest && expressionIsExternallyTainted(latest.expression, flow, latest.offset, nextSeen)) return true;
  }
  return false;
}

function expressionDependsOnMultiplication(expression, multiplication, flow, beforeOffset, seen = new Set()) {
  if (!expression || seen.size > 32) return false;
  if (containsNode(expression, (node) => node === multiplication || Number.isInteger(node?.id) && node.id === multiplication.id)) return true;
  for (const id of referencedDeclarationIds(expression)) {
    if (seen.has(id) || !flow.declarations.has(id)) continue;
    const nextSeen = new Set(seen); nextSeen.add(id);
    const latest = valueExpressionsBefore(id, flow, beforeOffset)[0];
    if (latest && expressionDependsOnMultiplication(latest.expression, multiplication, flow, latest.offset, nextSeen)) return true;
  }
  return false;
}

function expressionSharesValue(left, right) {
  const leftLiteral = literalBigInt(left);
  const rightLiteral = literalBigInt(right);
  if (leftLiteral !== null && rightLiteral !== null) return leftLiteral === rightLiteral;
  const leftIds = referencedDeclarationIds(left);
  const rightIds = referencedDeclarationIds(right);
  return [...leftIds].some((id) => rightIds.has(id));
}

function conditionProvesMultiplicationIdentity(condition, multiplication, flow, beforeOffset) {
  let proven = false;
  visit(condition, (comparison) => {
    if (proven || comparison?.nodeType !== "BinaryOperation" || comparison.operator !== "==") return;
    for (const [divisionSide, otherSide] of [
      [comparison.leftExpression, comparison.rightExpression],
      [comparison.rightExpression, comparison.leftExpression],
    ]) {
      const divisions = [];
      visit(divisionSide, (node) => {
        if (node?.nodeType === "BinaryOperation" && node.operator === "/") divisions.push(node);
      });
      for (const division of divisions) {
        if (!expressionDependsOnMultiplication(division.leftExpression, multiplication, flow, beforeOffset)) continue;
        const denominatorIsLeft = expressionSharesValue(division.rightExpression, multiplication.leftExpression);
        const denominatorIsRight = expressionSharesValue(division.rightExpression, multiplication.rightExpression);
        if (denominatorIsLeft && expressionSharesValue(otherSide, multiplication.rightExpression)) proven = true;
        if (denominatorIsRight && expressionSharesValue(otherSide, multiplication.leftExpression)) proven = true;
      }
    }
  });
  return proven;
}

function collectConjunctiveUpperBounds(condition, bounds) {
  if (!condition || condition.nodeType !== "BinaryOperation") return;
  if (condition.operator === "&&") {
    collectConjunctiveUpperBounds(condition.leftExpression, bounds);
    collectConjunctiveUpperBounds(condition.rightExpression, bounds);
    return;
  }
  if (!["<", "<=", ">", ">="].includes(String(condition.operator ?? ""))) return;
  const candidates = condition.operator === "<" || condition.operator === "<="
    ? [[condition.leftExpression, condition.rightExpression, condition.operator === "<"]]
    : [[condition.rightExpression, condition.leftExpression, condition.operator === ">"]];
  for (const [boundedExpression, literalExpression, strict] of candidates) {
    if (boundedExpression?.nodeType !== "Identifier") continue;
    const id = Number(boundedExpression.referencedDeclaration);
    const literal = literalBigInt(literalExpression);
    if (!Number.isInteger(id) || literal === null || literal < 0n) continue;
    const maximum = strict ? literal - 1n : literal;
    if (maximum < 0n) continue;
    const previous = bounds.get(id);
    if (previous === undefined || maximum < previous) bounds.set(id, maximum);
  }
}

function aliasDeclarationId(expression, flow, beforeOffset, seen = new Set()) {
  if (expression?.nodeType !== "Identifier") return Number.isInteger(expression?.referencedDeclaration) ? Number(expression.referencedDeclaration) : null;
  const id = Number(expression.referencedDeclaration);
  if (!Number.isInteger(id) || seen.has(id)) return null;
  const latest = valueExpressionsBefore(id, flow, beforeOffset)[0];
  if (!latest || latest.expression?.nodeType !== "Identifier") return id;
  const nextSeen = new Set(seen); nextSeen.add(id);
  return aliasDeclarationId(latest.expression, flow, latest.offset, nextSeen) ?? id;
}

function expressionUpperBound(expression, bounds, flow, beforeOffset) {
  const literal = literalBigInt(expression);
  if (literal !== null) return literal;
  const bits = uintBits(expression);
  if (bits === null) return null;
  let maximum = (1n << BigInt(bits)) - 1n;
  if (expression?.nodeType === "Identifier") {
    const directId = Number(expression.referencedDeclaration);
    const aliasId = aliasDeclarationId(expression, flow, beforeOffset);
    for (const id of [directId, aliasId]) {
      const bounded = bounds.get(id);
      if (bounded !== undefined && bounded < maximum) maximum = bounded;
    }
  }
  return maximum;
}

function astPathToNode(root, target) {
  const pathRows = [];
  function search(node) {
    if (!node || typeof node !== "object") return false;
    pathRows.push(node);
    if (node === target) return true;
    for (const [key, value] of Object.entries(node)) {
      if (key === "typeDescriptions" || key === "scope") continue;
      if (Array.isArray(value)) {
        for (const child of value) if (search(child)) return true;
      } else if (value && typeof value === "object" && search(value)) return true;
    }
    pathRows.pop();
    return false;
  }
  return search(root) ? pathRows : [];
}

function directGuardCondition(statement) {
  if (statement?.nodeType === "ExpressionStatement"
    && statement.expression?.nodeType === "FunctionCall"
    && ["require", "assert"].includes(callName(statement.expression))
    && statement.expression.arguments?.[0]) return statement.expression.arguments[0];
  if (statement?.nodeType === "IfStatement"
    && containsRevert(statement.falseBody)
    && !containsRevert(statement.trueBody)) return statement.condition;
  return null;
}

function dominatingGuardConditions(fn, sinkNode) {
  const pathRows = astPathToNode(fn.body, sinkNode);
  if (pathRows.length === 0) return [];
  const conditions = [];
  for (let index = 0; index < pathRows.length - 1; index += 1) {
    const node = pathRows[index];
    const child = pathRows[index + 1];
    if (node?.nodeType === "Block" && Array.isArray(node.statements)) {
      const childStatementIndex = node.statements.indexOf(child);
      if (childStatementIndex >= 0) {
        for (const statement of node.statements.slice(0, childStatementIndex)) {
          const condition = directGuardCondition(statement);
          if (condition) conditions.push(condition);
        }
      }
    }
    if (node?.nodeType === "IfStatement" && child === node.trueBody && node.condition) conditions.push(node.condition);
  }
  return conditions;
}

function multiplicationIsGuardedOrRangeSafe(multiplication, fn, flow, sinkNode) {
  const sinkEndOffset = nodeEndOffset(sinkNode);
  const conditions = dominatingGuardConditions(fn, sinkNode);
  if (conditions.some((condition) => conditionProvesMultiplicationIdentity(condition, multiplication, flow, sinkEndOffset))) return true;
  const bounds = new Map();
  for (const condition of conditions) collectConjunctiveUpperBounds(condition, bounds);
  const leftMaximum = expressionUpperBound(multiplication.leftExpression, bounds, flow, sinkEndOffset);
  const rightMaximum = expressionUpperBound(multiplication.rightExpression, bounds, flow, sinkEndOffset);
  const resultBits = uintBits(multiplication);
  if (leftMaximum === null || rightMaximum === null || resultBits === null) return false;
  return leftMaximum * rightMaximum <= (1n << BigInt(resultBits)) - 1n;
}

function isEconomicStateTarget(target, stateIds, stateNames) {
  for (const id of referencedDeclarationIds(target)) {
    if (!stateIds.has(id)) continue;
    if (/(?:balance|supply|allowance|credit|debt|deposit|reserve|payment|price|fee|cost|amount|escrow|stake|reward)/iu.test(stateNames.get(id) ?? "")) return true;
  }
  return false;
}

function isAddressBalance(node) {
  return node?.nodeType === "MemberAccess"
    && node.memberName === "balance"
    && (containsNode(node.expression, isAddressThisCall) || /address(?: payable)?/iu.test(String(node.expression?.typeDescriptions?.typeString ?? "")));
}

function boundedEconomicSinkRows(fn, multiplication, flow, stateIds, stateNames) {
  const rows = [];
  const add = (node, expression, kind) => {
    const endOffset = nodeEndOffset(node);
    if (!expressionDependsOnMultiplication(expression, multiplication, flow, endOffset)) return;
    rows.push({ node, expression, kind, endOffset });
  };
  visit(fn.body, (node) => {
    if (node?.nodeType === "FunctionCall") {
      const rawExpression = node.expression;
      if (rawExpression?.nodeType === "MemberAccess" && rawExpression.memberName === "value") {
        for (const argument of node.arguments ?? []) add(node, argument, "LEGACY_CALL_VALUE");
      }
      if (rawExpression?.nodeType === "FunctionCallOptions") {
        for (let optionIndex = 0; optionIndex < (rawExpression.names?.length ?? 0); optionIndex += 1) {
          if (rawExpression.names[optionIndex] === "value") add(node, rawExpression.options?.[optionIndex], "CALL_OPTIONS_VALUE");
        }
      }
      const target = unwrapCallTargetExpression(rawExpression);
      const memberName = target?.nodeType === "MemberAccess" ? String(target.memberName ?? "") : String(callName(node) ?? "");
      const receiverType = String(target?.expression?.typeDescriptions?.typeString ?? "");
      const addressValueTransfer = ["transfer", "send"].includes(memberName) && /^address(?: payable)?$/iu.test(receiverType);
      const contractAmountMethod = ["transfer", "transferFrom", "approve"].includes(memberName) && /^contract\s/iu.test(receiverType);
      const namedSupplyMethod = ["mint", "_mint", "burn", "_burn"].includes(memberName);
      if (addressValueTransfer || contractAmountMethod || namedSupplyMethod) {
        const amount = node.arguments?.at(-1);
        if (amount) add(node, amount, addressValueTransfer ? "NATIVE_VALUE_TRANSFER" : namedSupplyMethod ? "TOKEN_SUPPLY_AMOUNT" : "TOKEN_AMOUNT");
      }
      if (["require", "assert"].includes(callName(node)) && node.arguments?.[0]) {
        const condition = node.arguments[0];
        const economicComparison = containsNode(condition, (candidate) => isMember(candidate, "msg", "value") || isAddressBalance(candidate))
          || [...referencedDeclarationIds(condition)].some((id) => stateIds.has(id) && /(?:balance|supply|allowance|credit|debt|deposit|reserve|payment|price|fee|cost|amount|escrow|stake|reward)/iu.test(stateNames.get(id) ?? ""));
        if (economicComparison) add(node, condition, "ECONOMIC_VALUE_VALIDATION");
      }
    }
    if (node?.nodeType === "Assignment" && isEconomicStateTarget(node.leftHandSide, stateIds, stateNames)) {
      add(node, node.rightHandSide, "SEMANTIC_ECONOMIC_STATE_WRITE");
    }
  });
  return rows.sort((left, right) => left.endOffset - right.endOffset || left.kind.localeCompare(right.kind));
}

function detectLegacyUncheckedMultiplicationEconomicSink({ fn, flow, stateIds, stateNames, compilerVersion, evaluation, pushFinding, contractRow, sourceRow, fnName }) {
  if (evaluation.status !== "EVALUATED_LEGACY_COMPILER") return;
  const multiplications = [];
  visit(fn.body, (node) => {
    if (node?.nodeType === "BinaryOperation" && node.operator === "*") multiplications.push(node);
  });
  evaluation.candidateMultiplications += multiplications.length;
  for (const multiplication of multiplications) {
    if (uintBits(multiplication) === null) continue;
    const multiplicationOffset = parseSrc(multiplication.src).offset;
    const externalTaint = expressionIsExternallyTainted(multiplication.leftExpression, flow, multiplicationOffset)
      || expressionIsExternallyTainted(multiplication.rightExpression, flow, multiplicationOffset);
    if (!externalTaint) continue;
    evaluation.unsignedExternalTaintedMultiplications += 1;
    const sinks = boundedEconomicSinkRows(fn, multiplication, flow, stateIds, stateNames);
    evaluation.boundedEconomicSinkMatches += sinks.length;
    const unguarded = [];
    for (const sink of sinks) {
      if (multiplicationIsGuardedOrRangeSafe(multiplication, fn, flow, sink.node)) evaluation.guardedOrRangeProvenSuppressions += 1;
      else unguarded.push(sink);
    }
    if (unguarded.length === 0) continue;
    const sinkKinds = [...new Set(unguarded.map((row) => row.kind))].sort();
    pushFinding(makeFinding({
      ruleId: LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID,
      severity: "high",
      title: "Legacy unchecked multiplication reaches a bounded economic sink",
      description: `Exact compiler ${compilerVersion} AST shows unsigned multiplication influenced by an externally supplied parameter reaching ${sinkKinds.join(", ")} without a recognized division-identity check or range proof. This is review priority only, not exploitability proof.`,
      remediation: "Use checked multiplication or a compiler with checked arithmetic, retain explicit input bounds where business limits are narrower, and add boundary tests around the maximum accepted values.",
      sourcePath: contractRow.sourcePath,
      sourceRow,
      contractName: contractRow.node.name,
      functionName: fnName,
      node: multiplication,
      limitations: [
        "This family is limited to exact compiler versions before Solidity 0.8.0, unsigned values, direct/local-alias parameter taint and bounded native/token/payment/semantic-state sinks.",
        "It does not claim broad arithmetic coverage, interprocedural taint completeness, path feasibility, economic loss, severity accuracy or exploitability.",
      ],
    }));
    evaluation.findings += 1;
  }
}

function analyzeAst(output, normalizedSources, { compilerVersion = "" } = {}) {
  const index = buildContractIndex(output, normalizedSources);
  const findings = [];
  const legacyMultiplicationEvaluation = legacyMultiplicationRuleEvaluation(compilerVersion, true);
  const seen = new Set();
  const pushFinding = (finding) => {
    const key = `${finding.ruleId}|${finding.sourcePath}|${finding.contractName}|${finding.functionName}|${finding.astNodeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      findings.push(finding);
    }
  };

  for (const contractRow of index.contractsById.values()) {
    const sourceRow = index.sourceRows.get(contractRow.sourcePath);
    if (!sourceRow) continue;
    const access = accessAnalysis(contractRow, index);
    const stateIds = access.stateIds;
    const stateNames = access.stateNames;
    const dynamicArrayIds = new Set([...stateIds].filter((id) => isDynamicArrayStateVariable(index.variablesById.get(id)?.node)));

    for (const fn of (contractRow.node.nodes ?? []).filter((node) => node?.nodeType === "FunctionDefinition" && node.body)) {
      const fnName = fn.kind === "constructor" ? "constructor" : String(fn.name ?? "");
      const externallyCallable = isExternallyCallable(fn);
      const accessControlled = access.functionHasAccessControl(fn);
      const calls = functionCalls(fn.body);

      if (externallyCallable) {
        detectLegacyUncheckedMultiplicationEconomicSink({
          fn,
          flow: buildFunctionValueFlow(fn),
          stateIds,
          stateNames,
          compilerVersion,
          evaluation: legacyMultiplicationEvaluation,
          pushFinding,
          contractRow,
          sourceRow,
          fnName,
        });
      }

      if (externallyCallable && !accessControlled && hasUnboundedDynamicArrayIndexWrite(fn, stateIds, dynamicArrayIds)) {
        pushFinding(makeFinding({
          ruleId: "AST_UNBOUNDED_DYNAMIC_STORAGE_INDEX_WRITE",
          severity: "high",
          title: "User-controlled dynamic storage index write lacks authorization",
          description: "The compiler AST confirms an externally callable function writes a dynamic storage array at an index derived from a function parameter without a recognized authorization boundary.",
          remediation: "Use a bounded data structure, validate the index against an invariant-safe limit, and restrict privileged storage mutation to explicit authorization.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: fn,
          limitations: ["This bounded rule identifies user-controlled dynamic-array storage writes; exploitability and exact storage corruption require layout and path review."],
        }));
      }

      if (externallyCallable) {
        const accounting = withdrawalAccountingSignals(fn, stateIds, index);
        for (const row of accounting.missingConsumption) {
          pushFinding(makeFinding({
            ruleId: "AST_WITHDRAWAL_BALANCE_NOT_CONSUMED",
            severity: "critical",
            title: "Withdrawal transfers a recorded balance without consuming it",
            description: "The compiler AST confirms an externally callable path transfers value to msg.sender using a state-mapping balance but does not update that mapping in the function body.",
            remediation: "Consume or zero the recorded balance before the external transfer, use checks-effects-interactions, and add repeated-withdrawal invariants.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: row.call,
            limitations: ["The rule is bounded to direct msg.sender transfers and mapping-backed values; interprocedural accounting requires additional review."],
          }));
        }
        for (const condition of accounting.invertedLimits) {
          pushFinding(makeFinding({
            ruleId: "AST_WITHDRAWAL_LIMIT_COMPARISON_INVERTED",
            severity: "critical",
            title: "Withdrawal limit comparison is inverted",
            description: "The compiler AST confirms a withdrawal-like amount parameter is constrained in the direction amount >= recorded balance (or the equivalent reversed form), rather than amount <= balance.",
            remediation: "Require the requested amount to be less than or equal to the caller's recorded balance and test boundary values, underflow and repeated withdrawal.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: condition,
            limitations: ["The rule identifies a bounded comparison orientation; full business-logic intent and arithmetic semantics still require review."],
          }));
        }
      }

      if (externallyCallable && functionContainsPredicateRecursive(fn, isTxOrigin, index)) {
        pushFinding(makeFinding({
          ruleId: "AST_TX_ORIGIN_AUTH",
          severity: "high",
          title: "Authorization path references tx.origin",
          description: "The compiler AST confirms that this externally callable function or a bounded internal helper it invokes references tx.origin. Contract-mediated calls can make tx.origin-based authorization unsafe.",
          remediation: "Use msg.sender with explicit role or ownership checks and add intermediary-contract regression tests.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: fn,
          limitations: ["The bounded call-graph walk follows statically referenced internal helpers to depth four; dynamic dispatch and external calls remain outside this rule."],
        }));
      }

      for (const call of calls) {
        const lowLevelKind = lowLevelCallKind(call);
        if (lowLevelKind && ["call", "callcode", "delegatecall", "staticcall", "send"].includes(lowLevelKind) && !lowLevelCallChecked(call, fn, index)) {
          pushFinding(makeFinding({
            ruleId: "AST_UNCHECKED_LOW_LEVEL_CALL",
            severity: lowLevelKind === "delegatecall" || lowLevelKind === "callcode" ? "high" : "medium",
            title: `Unchecked ${lowLevelKind} result`,
            description: `The compiler AST confirms that the ${lowLevelKind} return value is not consumed by a require/assert check or a later checked boolean result.`,
            remediation: "Capture the return value, validate success and returned data, and test failure and callback paths.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: call,
          }));
        }

        if (lowLevelKind === "delegatecall" && externallyCallable && delegatecallTargetIsParameter(call, fn) && !accessControlled && !delegatecallTargetHasStatePolicyGuard(call, fn, stateIds)) {
          pushFinding(makeFinding({
            ruleId: "AST_UNGUARDED_DELEGATECALL_TARGET",
            severity: "high",
            title: "Externally supplied delegatecall target lacks evident authorization",
            description: "The compiler AST binds the delegatecall target to a function parameter on an externally callable function without a recognized authorization boundary.",
            remediation: "Remove caller-controlled delegatecall targets or bind them to an authorized, versioned implementation registry with upgrade delay and storage-layout checks.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: call,
          }));
        }
      }

      if (externallyCallable && !modifierNames(fn).some((name) => /nonReentrant/iu.test(name))) {
        const interactions = interactionRows(fn, index);
        const writes = stateWriteRows(fn, stateIds);
        const first = interactions.find((interaction) => writes.some((write) => write.offset > interaction.offset));
        if (first) {
          pushFinding(makeFinding({
            ruleId: "AST_EXTERNAL_INTERACTION_BEFORE_STATE_EFFECT",
            severity: "high",
            title: "External interaction precedes a persistent state effect",
            description: "The compiler AST confirms an external interaction occurs before a later write to contract state in the same externally callable function.",
            remediation: "Apply checks-effects-interactions or a reviewed reentrancy guard, then add malicious-callback and token-hook invariants.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: first.node,
            limitations: ["Statement ordering alone does not establish that every later state write is security-sensitive; manual path review remains required."],
          }));
        }
      }

      const invokesMint = functionContainsCallNameRecursive(fn, new Set(["mint", "_mint", "safeMint", "_safeMint"]), index);
      const invokesBurn = functionContainsCallNameRecursive(fn, new Set(["burn", "_burn"]), index);
      const mintNamed = /(?:mint|issue|createTokens?)/iu.test(fnName);
      if (externallyCallable && (invokesMint || mintNamed) && !invokesBurn && !accessControlled) {
        pushFinding(makeFinding({
          ruleId: "AST_EXTERNALLY_CALLABLE_MINT_WITHOUT_AUTH",
          severity: "high",
          title: "Externally callable mint path lacks evident authorization",
          description: "The compiler AST confirms a public or external mint-like function without a recognized owner, role or sender authorization boundary.",
          remediation: "Require an explicit minter/role policy, test unauthorized issuance, role revocation and upgrade paths, and bind supply invariants.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: fn,
        }));
      }

      const writesPrivileged = containsNode(fn.body, (node) => {
        if (node?.nodeType !== "Assignment" && node?.nodeType !== "UnaryOperation") return false;
        const target = node.nodeType === "Assignment" ? node.leftHandSide : node.subExpression;
        return containsNode(target, (candidate) => isPrivilegedStateReference(candidate, stateNames));
      });
      const initializerLike = /^(?:init|initialize|reinitialize|setup|bootstrap|configure)/iu.test(fnName);
      if (externallyCallable && initializerLike && writesPrivileged && !functionHasInitializerGuard(fn, stateIds, stateNames)) {
        pushFinding(makeFinding({
          ruleId: "AST_UNGUARDED_INITIALIZER",
          severity: "high",
          title: "Initializer-like privileged state write lacks a one-time guard",
          description: "The compiler AST confirms an externally callable initializer-like function writes privileged state without a recognized initializer modifier or durable initialized-state guard.",
          remediation: "Use a one-time initializer/reinitializer guard, lock implementation contracts, and test repeated and unauthorized initialization.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: fn,
        }));
      }

      if (externallyCallable && writesPrivileged && !initializerLike && !accessControlled) {
        pushFinding(makeFinding({
          ruleId: "AST_UNPROTECTED_PRIVILEGED_STATE_WRITE",
          severity: "high",
          title: "Externally callable privileged-state write lacks evident authorization",
          description: "The compiler AST confirms this function writes owner, admin, role, implementation or operator state without a recognized authorization boundary.",
          remediation: "Require explicit role or governance authorization and test unauthorized privilege creation, replacement and deletion.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: fn,
        }));
      }

      const hasEcrecover = functionContainsCallNameRecursive(fn, new Set(["ecrecover"]), index);
      if (externallyCallable && hasEcrecover) {
        const domainBound = functionHasDomainBinding(fn, index);
        const nonceBound = functionHasNonceBinding(fn, stateIds, stateNames, index);
        if (!domainBound || !nonceBound) {
          pushFinding(makeFinding({
            ruleId: "AST_SIGNATURE_REPLAY_DOMAIN_OR_NONCE_MISSING",
            severity: "high",
            title: "Signature path lacks complete domain or nonce binding",
            description: `The compiler AST confirms ecrecover is used while ${!domainBound ? "chain/contract domain binding" : "durable nonce or used-digest binding"} is not evident in the same function.`,
            remediation: "Use EIP-712 domain separation, chain ID, verifying contract, durable nonces or used-digest tracking, expiry and zero-address validation.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: fn,
          }));
        }
        if ((/permit/iu.test(fnName) || (fn.parameters?.parameters ?? []).some((parameter) => /(?:owner|spender|value)/iu.test(String(parameter?.name ?? "")))) && !functionHasDeadlineCheck(fn)) {
          pushFinding(makeFinding({
            ruleId: "AST_PERMIT_DEADLINE_MISSING",
            severity: "medium",
            title: "Permit-style signature path lacks an enforced deadline",
            description: "The compiler AST confirms a permit-like signature flow without a comparison between block.timestamp and a deadline/expiry parameter.",
            remediation: "Bind an explicit deadline into the signed payload and enforce expiry before changing authorization state.",
            sourcePath: contractRow.sourcePath,
            sourceRow,
            contractName: contractRow.node.name,
            functionName: fnName,
            node: fn,
          }));
        }
      }

      for (const call of calls.filter((candidate) => callName(candidate) === "selfdestruct")) {
        pushFinding(makeFinding({
          ruleId: "AST_SELFDESTRUCT_SURFACE",
          severity: "high",
          title: "Selfdestruct lifecycle surface",
          description: "The compiler AST confirms a selfdestruct call is present in an executable function body.",
          remediation: "Remove the destructive path where possible or bind it to explicit governance, delay, monitoring and chain-specific tests.",
          sourcePath: contractRow.sourcePath,
          sourceRow,
          contractName: contractRow.node.name,
          functionName: fnName,
          node: call,
        }));
      }
    }
  }

  findings.sort((left, right) => `${left.sourcePath}|${left.line}|${left.ruleId}|${left.functionName ?? ""}`.localeCompare(`${right.sourcePath}|${right.line}|${right.ruleId}|${right.functionName ?? ""}`));
  return { findings, index, ruleEvaluations: [legacyMultiplicationEvaluation] };
}

function storageLayoutRows(output) {
  const rows = [];
  for (const [sourcePath, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [contractName, contract] of Object.entries(contracts ?? {})) {
      const layout = contract?.storageLayout;
      if (!layout) continue;
      rows.push({
        sourcePath,
        contractName,
        storage: (layout.storage ?? []).map((row) => ({
          astId: row.astId,
          contract: row.contract,
          label: row.label,
          offset: Number(row.offset),
          slot: String(row.slot),
          type: String(row.type),
        })),
        typesSha256: sha256(stable(layout.types ?? {})),
        layoutSha256: sha256(stable(layout)),
      });
    }
  }
  return rows.sort((a, b) => `${a.sourcePath}:${a.contractName}`.localeCompare(`${b.sourcePath}:${b.contractName}`));
}

function irRows(output) {
  const rows = [];
  for (const [sourcePath, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [contractName, contract] of Object.entries(contracts ?? {})) {
      rows.push({
        sourcePath,
        contractName,
        irSha256: typeof contract?.ir === "string" ? sha256(contract.ir) : null,
        irOptimizedSha256: typeof contract?.irOptimized === "string" ? sha256(contract.irOptimized) : null,
        bytecodeSha256: typeof contract?.evm?.bytecode?.object === "string" ? sha256(contract.evm.bytecode.object) : null,
        deployedBytecodeSha256: typeof contract?.evm?.deployedBytecode?.object === "string" ? sha256(contract.evm.deployedBytecode.object) : null,
      });
    }
  }
  return rows.sort((a, b) => `${a.sourcePath}:${a.contractName}`.localeCompare(`${b.sourcePath}:${b.contractName}`));
}

function normalizeHexObject(value) {
  const text = String(value ?? "").toLowerCase();
  return /^(?:[a-f0-9]{2})*$/u.test(text) ? text : "";
}

function stripSolidityMetadataObject(value) {
  const hex = normalizeHexObject(value);
  if (hex.length < 4) return { core: hex, metadataBytes: 0, stripped: false };
  const metadataBytes = Number.parseInt(hex.slice(-4), 16);
  const metadataHexLength = (metadataBytes + 2) * 2;
  if (!Number.isInteger(metadataBytes) || metadataBytes <= 0 || metadataHexLength >= hex.length) {
    return { core: hex, metadataBytes: 0, stripped: false };
  }
  return { core: hex.slice(0, -metadataHexLength), metadataBytes, stripped: true };
}

function bytecodeRows(output) {
  const rows = [];
  for (const [sourcePath, contracts] of Object.entries(output.contracts ?? {})) {
    for (const [contractName, contract] of Object.entries(contracts ?? {})) {
      const creationBytecode = normalizeHexObject(contract?.evm?.bytecode?.object);
      const deployedBytecode = normalizeHexObject(contract?.evm?.deployedBytecode?.object);
      const creationCore = stripSolidityMetadataObject(creationBytecode);
      const deployedCore = stripSolidityMetadataObject(deployedBytecode);
      rows.push({
        sourcePath,
        contractName,
        creationBytecode,
        deployedBytecode,
        creationByteLength: creationBytecode.length / 2,
        deployedByteLength: deployedBytecode.length / 2,
        creationBytecodeSha256: sha256(creationBytecode),
        deployedBytecodeSha256: sha256(deployedBytecode),
        creationCoreSha256: sha256(creationCore.core),
        deployedCoreSha256: sha256(deployedCore.core),
        creationMetadataBytes: creationCore.metadataBytes,
        deployedMetadataBytes: deployedCore.metadataBytes,
      });
    }
  }
  return rows.sort((a, b) => `${a.sourcePath}:${a.contractName}`.localeCompare(`${b.sourcePath}:${b.contractName}`));
}

export function buildSolidityCompilerInput(sourceFiles, settings = {}) {
  const normalized = normalizeSources(sourceFiles);
  if (normalized.blockers.length) throw new Error(`compiler_ast_input_blocked:${normalized.blockers.join(",")}`);
  const sources = Object.fromEntries(normalized.rows.map((row) => [row.path, { content: row.content }]));
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: {
        enabled: settings.optimizerEnabled === true,
        runs: Number.isInteger(settings.optimizerRuns) ? settings.optimizerRuns : 200,
      },
      viaIR: settings.viaIR === true,
      evmVersion: settings.evmVersion ?? "paris",
      metadata: { bytecodeHash: settings.metadataBytecodeHash ?? "none" },
      remappings: Array.isArray(settings.remappings) ? settings.remappings : [],
      libraries: settings.libraries ?? {},
      outputSelection: {
        "*": {
          "": ["ast"],
          "*": [
            "abi",
            "storageLayout",
            "ir",
            "irOptimized",
            "evm.bytecode.object",
            "evm.deployedBytecode.object",
            "evm.methodIdentifiers",
          ],
        },
      },
    },
  };
  return { input, normalized };
}


export function analyzeSolidityCompilerOutputAst({
  compilerOutput,
  sourceFiles,
  compilerVersion,
  expectedCompilerVersionPrefix = compilerVersion,
  storageComparisonPairs = [],
  observedAt = new Date().toISOString(),
  profile = "EXTERNAL_STANDARD_JSON_COMPILER_OUTPUT",
}) {
  if (!compilerOutput || typeof compilerOutput !== "object") throw new Error("compiler_output_required");
  const normalized = normalizeSources(sourceFiles);
  if (normalized.blockers.length) throw new Error(`compiler_ast_input_blocked:${normalized.blockers.join(",")}`);
  const version = String(compilerVersion ?? "");
  if (!version) throw new Error("compiler_version_required");
  const diagnostics = Array.isArray(compilerOutput.errors) ? compilerOutput.errors.map((row) => ({
    severity: String(row?.severity ?? "unknown"),
    type: String(row?.type ?? "unknown"),
    errorCode: row?.errorCode ?? null,
    sourceLocation: row?.sourceLocation ?? null,
    message: String(row?.message ?? ""),
    formattedMessageSha256: sha256(String(row?.formattedMessage ?? row?.message ?? "")),
  })) : [];
  const compilerErrors = diagnostics.filter((row) => row.severity === "error");
  const compilerWarnings = diagnostics.filter((row) => row.severity === "warning");
  const astMissing = normalized.rows.filter((row) => !compilerOutput?.sources?.[row.path]?.ast?.nodeType).map((row) => row.path);
  const compilationStatus = compilerErrors.length
    ? "WITHHELD_COMPILATION_ERROR"
    : astMissing.length
      ? "WITHHELD_COMPACT_AST_UNAVAILABLE"
      : "EXECUTED";
  const analysis = compilationStatus === "EXECUTED"
    ? analyzeAst(compilerOutput, normalized, { compilerVersion: version })
    : { findings: [], index: { sourceUnits: [] }, ruleEvaluations: [legacyMultiplicationRuleEvaluation(version, false)] };
  const generalizationAnalysis = compilationStatus === "EXECUTED"
    ? analyzeR44P38GeneralizationAst({
      compilerOutput,
      sources: Object.fromEntries(normalized.rows.map((row) => [row.path, row.content])),
      storageComparisonPairs,
      expectedCompilerVersion: String(expectedCompilerVersionPrefix ?? version),
    })
    : null;
  const generalizationFindings = generalizationAnalysis
    ? generalizationAnalysis.findings.map((row) => mapR44P38GeneralizationFinding(row, normalized))
    : [];
  const interactionContextFilter = applyContextQualifiedInteractionOrdering(analysis.findings, generalizationAnalysis);
  const mergedFindings = mergeCompilerAstFindingRows(interactionContextFilter.findings, generalizationFindings);
  const storageLayouts = storageLayoutRows(compilerOutput);
  const irArtifacts = irRows(compilerOutput);
  const bytecodeArtifacts = bytecodeRows(compilerOutput);
  const core = {
    schemaVersion: SOLIDITY_COMPILER_OUTPUT_AST_SCHEMA,
    analyzerId: SOLIDITY_COMPILER_AST_ANALYZER_ID,
    analyzerClass: SOLIDITY_COMPILER_AST_ANALYZER_CLASS,
    profile: String(profile ?? "EXTERNAL_STANDARD_JSON_COMPILER_OUTPUT"),
    observedAt,
    compiler: {
      family: "solc-js",
      version,
      expectedVersionPrefix: String(expectedCompilerVersionPrefix ?? version),
      exactExpectedVersion: version.startsWith(String(expectedCompilerVersionPrefix ?? version)),
    },
    inputIdentity: {
      sourceFiles: normalized.rows.length,
      sourceBytes: normalized.totalBytes,
      sourceBundleSha256: normalized.sourceBundleSha256,
    },
    compilation: {
      status: compilationStatus,
      compilerOutputSha256: sha256(stable(compilerOutput)),
      errorCount: compilerErrors.length,
      warningCount: compilerWarnings.length,
      astMissing,
      sourceUnits: analysis.index.sourceUnits?.length ?? 0,
      contracts: irArtifacts.length,
      diagnostics,
    },
    findings: mergedFindings,
    ruleCoverage: [...new Set(mergedFindings.map((finding) => finding.ruleId))].sort(),
    ruleEvaluations: analysis.ruleEvaluations,
    r44p38Generalization: generalizationAnalysis ? {
      analyzerClass: generalizationAnalysis.analyzerClass,
      analyzerRevision: generalizationAnalysis.analyzerRevision ?? null,
      signalFamilies: Object.keys(R44P38_GENERALIZATION_SIGNAL_CATALOG).length,
      observedSignals: generalizationAnalysis.signals,
      findings: generalizationAnalysis.findings.length,
      suppressedInteractionPatterns: Array.isArray(generalizationAnalysis.suppressedInteractionPatterns)
        ? generalizationAnalysis.suppressedInteractionPatterns
        : [],
      suppressedBaseInteractionFindings: interactionContextFilter.suppressed,
      sourceBundleSha256: generalizationAnalysis.sourceBundleSha256,
      compilerOutputBindingSha256: generalizationAnalysis.compilerOutputBindingSha256,
      localCompilerAstCredit: true,
      independentGroundTruthCredit: false,
      realProtocolAccuracyCredit: false,
    } : null,
    storageLayouts,
    irArtifacts,
    bytecodeArtifacts,
    blockers: [
      ...compilerErrors.map((row) => `solc_error:${row.errorCode ?? row.type}`),
      ...astMissing.map((sourcePath) => `compact_ast_unavailable:${sourcePath}`),
    ].sort(),
    creditBoundary: {
      compilerOutputAstCredit: compilationStatus === "EXECUTED",
      legacyCompilerAstCredit: compilationStatus === "EXECUTED" && !version.startsWith(EXPECTED_SOLC_PREFIX),
      currentCompilerAstCredit: compilationStatus === "EXECUTED" && version.startsWith(EXPECTED_SOLC_PREFIX),
      legacyUncheckedMultiplicationEconomicSinkEvaluationCredit: analysis.ruleEvaluations?.some((row) => row.ruleId === LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID && row.status === "EVALUATED_LEGACY_COMPILER") === true,
      broadArithmeticCoverageCredit: false,
      independentGroundTruthCredit: false,
      realProtocolAccuracyCredit: false,
      formalPrecisionCredit: false,
      formalFalsePositiveRateCredit: false,
      exploitabilityCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
      worldClassCredit: false,
    },
    limitations: [
      "The evidence is derived from supplied Standard JSON compiler output and exact source bytes; it is not a complete path-feasibility or business-logic proof.",
      "Legacy compiler AST support varies by compiler version; missing compact AST is withheld rather than interpreted as a safe result.",
      "Public benchmark labels and public control candidates are not a substitute for two independent reviewers, sealed ground truth or customer outcomes.",
    ],
  };
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

export function analyzeSolidityCompilerAst({ solc, sourceFiles, settings = {}, storageComparisonPairs = [], observedAt = new Date().toISOString() }) {
  if (!solc || typeof solc.compile !== "function" || typeof solc.version !== "function") throw new Error("compiler_ast_solc_adapter_invalid");
  const { input, normalized } = buildSolidityCompilerInput(sourceFiles, settings);
  const compilerVersion = String(solc.version());
  const standardJson = stable(input);
  const outputRaw = String(solc.compile(JSON.stringify(input)));
  let output;
  try {
    output = JSON.parse(outputRaw);
  } catch {
    throw new Error("compiler_ast_solc_output_not_json");
  }
  const diagnostics = Array.isArray(output.errors) ? output.errors.map((row) => ({
    severity: String(row?.severity ?? "unknown"),
    type: String(row?.type ?? "unknown"),
    errorCode: row?.errorCode ?? null,
    sourceLocation: row?.sourceLocation ?? null,
    message: String(row?.message ?? ""),
    formattedMessageSha256: sha256(String(row?.formattedMessage ?? row?.message ?? "")),
  })) : [];
  const compilerErrors = diagnostics.filter((row) => row.severity === "error");
  const compilerWarnings = diagnostics.filter((row) => row.severity === "warning");
  const compilationStatus = normalized.blockers.length || compilerErrors.length ? "BLOCKED_OR_FAILED" : "EXECUTED";
  const analysis = compilationStatus === "EXECUTED"
    ? analyzeAst(output, normalized, { compilerVersion })
    : { findings: [], index: { sourceUnits: [] }, ruleEvaluations: [legacyMultiplicationRuleEvaluation(compilerVersion, false)] };
  const generalizationAnalysis = compilationStatus === "EXECUTED"
    ? analyzeR44P38GeneralizationAst({
      compilerOutput: output,
      sources: Object.fromEntries(normalized.rows.map((row) => [row.path, row.content])),
      storageComparisonPairs,
      expectedCompilerVersion: EXPECTED_SOLC_PREFIX,
    })
    : null;
  const generalizationFindings = generalizationAnalysis
    ? generalizationAnalysis.findings.map((row) => mapR44P38GeneralizationFinding(row, normalized))
    : [];
  const interactionContextFilter = applyContextQualifiedInteractionOrdering(analysis.findings, generalizationAnalysis);
  const mergedFindings = mergeCompilerAstFindingRows(interactionContextFilter.findings, generalizationFindings);
  const storageLayouts = storageLayoutRows(output);
  const irArtifacts = irRows(output);
  const bytecodeArtifacts = bytecodeRows(output);
  const core = {
    schemaVersion: SOLIDITY_COMPILER_AST_SCHEMA,
    analyzerId: SOLIDITY_COMPILER_AST_ANALYZER_ID,
    analyzerClass: SOLIDITY_COMPILER_AST_ANALYZER_CLASS,
    observedAt,
    compiler: {
      family: "solc-js",
      version: compilerVersion,
      expectedVersionPrefix: EXPECTED_SOLC_PREFIX,
      exactExpectedVersion: compilerVersion.startsWith(EXPECTED_SOLC_PREFIX),
    },
    inputIdentity: {
      sourceFiles: normalized.rows.length,
      sourceBytes: normalized.totalBytes,
      sourceBundleSha256: normalized.sourceBundleSha256,
      standardJsonInputSha256: sha256(standardJson),
      settingsSha256: sha256(stable(input.settings)),
    },
    compilation: {
      status: compilationStatus,
      outputSha256: sha256(outputRaw),
      errorCount: compilerErrors.length,
      warningCount: compilerWarnings.length,
      sourceUnits: analysis.index.sourceUnits?.length ?? 0,
      contracts: irArtifacts.length,
      diagnostics,
    },
    findings: mergedFindings,
    ruleCoverage: [...new Set(mergedFindings.map((finding) => finding.ruleId))].sort(),
    ruleEvaluations: analysis.ruleEvaluations,
    r44p38Generalization: generalizationAnalysis ? {
      analyzerClass: generalizationAnalysis.analyzerClass,
      analyzerRevision: generalizationAnalysis.analyzerRevision ?? null,
      signalFamilies: Object.keys(R44P38_GENERALIZATION_SIGNAL_CATALOG).length,
      observedSignals: generalizationAnalysis.signals,
      findings: generalizationFindings.length,
      suppressedInteractionPatterns: Array.isArray(generalizationAnalysis.suppressedInteractionPatterns)
        ? generalizationAnalysis.suppressedInteractionPatterns
        : [],
      suppressedBaseInteractionFindings: interactionContextFilter.suppressed,
      sourceBundleSha256: generalizationAnalysis.sourceBundleSha256,
      compilerOutputBindingSha256: generalizationAnalysis.compilerOutputBindingSha256,
      localCompilerAstCredit: true,
      independentGroundTruthCredit: false,
      realProtocolAccuracyCredit: false,
    } : null,
    storageLayouts,
    irArtifacts,
    bytecodeArtifacts,
    blockers: [...normalized.blockers, ...compilerErrors.map((row) => `solc_error:${row.errorCode ?? row.type}`)].sort(),
    creditBoundary: {
      localCompilerAstCredit: compilationStatus === "EXECUTED" && compilerVersion.startsWith(EXPECTED_SOLC_PREFIX),
      localIrBindingCredit: compilationStatus === "EXECUTED" && irArtifacts.some((row) => row.irSha256 || row.irOptimizedSha256),
      localMetamorphicGeneralizationLayerCredit: compilationStatus === "EXECUTED" && Boolean(generalizationAnalysis),
      legacyUncheckedMultiplicationEconomicSinkEvaluationCredit: analysis.ruleEvaluations?.some((row) => row.ruleId === LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID && row.status === "EVALUATED_LEGACY_COMPILER") === true,
      broadArithmeticCoverageCredit: false,
      realProtocolAccuracyCredit: false,
      independentGroundTruthCredit: false,
      exploitabilityCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
    },
    limitations: [
      "The rule set is bounded and does not establish complete Solidity semantic coverage.",
      "No symbolic execution, path feasibility, chain state, fork replay or exploit reproduction is performed by this module.",
      "Compiler AST and IR bindings reduce lexical fragility but do not substitute for independent ground truth or qualified manual review.",
      "The R44P38 generalization lane is locally designed and must not be represented as unseen real-protocol accuracy.",
    ],
  };
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

export function verifySolidityCompilerAstEvidence(evidence, sourceFiles) {
  const checks = [];
  const check = (id, ok, detail = null) => checks.push({ id, ok: Boolean(ok), detail });
  const normalized = normalizeSources(sourceFiles);
  const currentCompilerEvidence = evidence?.schemaVersion === SOLIDITY_COMPILER_AST_SCHEMA;
  const suppliedCompilerOutputEvidence = evidence?.schemaVersion === SOLIDITY_COMPILER_OUTPUT_AST_SCHEMA;
  check("schema", currentCompilerEvidence || suppliedCompilerOutputEvidence);
  check("analyzer", evidence?.analyzerId === SOLIDITY_COMPILER_AST_ANALYZER_ID && evidence?.analyzerClass === SOLIDITY_COMPILER_AST_ANALYZER_CLASS);
  check("compiler", evidence?.compiler?.exactExpectedVersion === true && (currentCompilerEvidence
    ? String(evidence?.compiler?.version ?? "").startsWith(EXPECTED_SOLC_PREFIX)
    : Boolean(compilerSemanticTuple(evidence?.compiler?.version))));
  check("source-binding", evidence?.inputIdentity?.sourceBundleSha256 === normalized.sourceBundleSha256, { expected: normalized.sourceBundleSha256, actual: evidence?.inputIdentity?.sourceBundleSha256 });
  check("compilation", evidence?.compilation?.status === "EXECUTED" && evidence?.compilation?.errorCount === 0);
  check("digest-fields", currentCompilerEvidence
    ? DIGEST.test(String(evidence?.inputIdentity?.standardJsonInputSha256 ?? "")) && DIGEST.test(String(evidence?.compilation?.outputSha256 ?? ""))
    : DIGEST.test(String(evidence?.compilation?.compilerOutputSha256 ?? "")));
  check("findings", Array.isArray(evidence?.findings) && evidence.findings.every((finding) => typeof finding?.ruleId === "string" && DIGEST.test(String(finding?.evidenceSha256 ?? ""))));
  check("bytecode-artifacts", Array.isArray(evidence?.bytecodeArtifacts) && evidence.bytecodeArtifacts.every((row) => typeof row?.sourcePath === "string" && typeof row?.contractName === "string" && /^(?:[a-f0-9]{2})*$/u.test(String(row?.deployedBytecode ?? "")) && DIGEST.test(String(row?.deployedBytecodeSha256 ?? ""))));
  const legacyRuleEvaluation = evidence?.ruleEvaluations?.find((row) => row?.ruleId === LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID);
  check("legacy-rule-evaluation", Boolean(legacyRuleEvaluation)
    && legacyRuleEvaluation.broadArithmeticCoverageCredit === false
    && legacyRuleEvaluation.exploitabilityCredit === false
    && legacyRuleEvaluation.formalAccuracyCredit === false
    && (legacyRuleEvaluation.status === "EVALUATED_LEGACY_COMPILER" || legacyRuleEvaluation.status === "NOT_APPLICABLE_SOLC_0_8_OR_LATER"));
  check("credit-boundary", (currentCompilerEvidence
    ? evidence?.creditBoundary?.localCompilerAstCredit === true
    : evidence?.creditBoundary?.compilerOutputAstCredit === true)
    && evidence?.creditBoundary?.broadArithmeticCoverageCredit === false
    && evidence?.creditBoundary?.realProtocolAccuracyCredit === false
    && evidence?.creditBoundary?.independentGroundTruthCredit === false
    && evidence?.creditBoundary?.exploitabilityCredit === false
    && evidence?.creditBoundary?.customerCredit === false
    && evidence?.creditBoundary?.saleCredit === false
    && evidence?.creditBoundary?.liveCredit === false);
  if (evidence && typeof evidence === "object") {
    const { evidenceSha256, ...core } = evidence;
    check("self-digest", evidenceSha256 === sha256(stable(core)), { expected: sha256(stable(core)), actual: evidenceSha256 });
  } else {
    check("self-digest", false);
  }
  const failed = checks.filter((row) => !row.ok);
  return { ok: failed.length === 0, checks, failed };
}

export function compareStorageLayouts({ before, after }) {
  const normalize = (layout) => (layout?.storage ?? []).map((row) => ({
    label: String(row.label ?? ""),
    slot: String(row.slot ?? ""),
    offset: Number(row.offset ?? 0),
    type: String(row.type ?? ""),
  }));
  const left = normalize(before);
  const right = normalize(after);
  const issues = [];
  for (let index = 0; index < left.length; index += 1) {
    const previous = left[index];
    const next = right[index];
    if (!next) {
      issues.push({ code: "STORAGE_ENTRY_REMOVED", index, before: previous, after: null });
      continue;
    }
    if (previous.slot !== next.slot || previous.offset !== next.offset || previous.type !== next.type) {
      issues.push({ code: "STORAGE_SLOT_OR_TYPE_CHANGED", index, before: previous, after: next });
    }
  }
  return {
    compatibleAppendOnlyPrefix: issues.length === 0,
    beforeEntries: left.length,
    afterEntries: right.length,
    issues,
    comparisonSha256: sha256(stable({ left, right, issues })),
  };
}
