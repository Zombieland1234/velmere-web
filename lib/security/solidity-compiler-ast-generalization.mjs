import crypto from "node:crypto";

export const COMPILER_AST_ANALYZER_CLASS = "SOLC_0_8_24_AST_STORAGE_LAYOUT_IR_REVIEW_V1";
export const COMPILER_AST_SIGNAL_CATALOG = Object.freeze({
  open_mint: { severity: "high", title: "Externally reachable mint path lacks authorization" },
  unguarded_initializer: { severity: "high", title: "Privileged initialization path lacks one-time protection" },
  missing_pause_guard: { severity: "medium", title: "State-changing value path bypasses the contract pause control" },
  insolvent_withdraw: { severity: "high", title: "Withdrawal path lacks a compiler-observed solvency guard" },
  cross_chain_replay: { severity: "high", title: "Cross-domain execution key lacks complete domain binding" },
  permit_no_deadline: { severity: "medium", title: "Signature-based allowance path lacks an expiry check" },
  signature_replay: { severity: "high", title: "Signature authorization lacks nonce or domain separation" },
  spot_oracle: { severity: "high", title: "Price-sensitive path consumes an instantaneous reserve/spot observation" },
  low_quorum: { severity: "high", title: "Governance success condition accepts a one-vote quorum" },
  transfer_policy_bypass: { severity: "high", title: "Privileged balance movement bypasses an available transfer policy" },
  fee_token_mismatch: { severity: "medium", title: "Deposit accounting trusts the requested amount instead of observed token balance delta" },
  post_balance_share_accounting: { severity: "high", title: "Share minting uses a post-deposit balance in the denominator" },
  storage_layout_collision: { severity: "critical", title: "Compared implementation storage layouts are incompatible" },
  unprotected_upgrade: { severity: "critical", title: "Implementation pointer can be changed without compiler-observed authorization" },
  unchecked_low_level_call: { severity: "medium", title: "Low-level call result is not compiler-observed as checked" },
  reentrancy_state_after_call: { severity: "high", title: "Externally callable path performs an interaction before a state effect" },
});

const HEX64 = /^[a-f0-9]{64}$/u;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};

function parseSrc(src) {
  const [startRaw, lengthRaw, fileRaw] = String(src ?? "0:0:-1").split(":");
  return { start: Number(startRaw), length: Number(lengthRaw), fileIndex: Number(fileRaw) };
}

function lineForOffset(source, offset) {
  return String(source ?? "").slice(0, Math.max(0, offset)).split("\n").length;
}

function walk(node, visit, parent = null) {
  if (!node || typeof node !== "object") return;
  visit(node, parent);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, parent);
    return;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") walk(value, visit, node);
  }
}

function descendants(node, predicate = () => true) {
  const rows = [];
  walk(node, (current) => {
    if (current !== node && predicate(current)) rows.push(current);
  });
  return rows;
}

function nodeContains(node, predicate) {
  let found = false;
  walk(node, (current) => {
    if (!found && predicate(current)) found = true;
  });
  return found;
}

function expressionName(node) {
  if (!node || typeof node !== "object") return "";
  if (node.nodeType === "Identifier") return String(node.name ?? "");
  if (node.nodeType === "IdentifierPath") return String(node.name ?? "");
  if (node.nodeType === "MemberAccess") {
    const left = expressionName(node.expression);
    return left ? `${left}.${String(node.memberName ?? "")}` : String(node.memberName ?? "");
  }
  if (node.nodeType === "ElementaryTypeNameExpression") return String(node.typeName?.name ?? "");
  if (node.nodeType === "FunctionCall") {
    const called = expressionName(node.expression);
    const args = Array.isArray(node.arguments) ? node.arguments.map(expressionName).join(",") : "";
    return `${called}(${args})`;
  }
  if (node.nodeType === "IndexAccess") return `${expressionName(node.baseExpression)}[]`;
  if (node.nodeType === "TupleExpression") return `(${(node.components ?? []).map(expressionName).join(",")})`;
  if (node.nodeType === "Literal") return String(node.value ?? node.hexValue ?? "");
  return "";
}

function isMsgSender(node) {
  if (node?.nodeType === "MemberAccess" && node.memberName === "sender" && expressionName(node.expression) === "msg") return true;
  return node?.nodeType === "FunctionCall"
    && ["_msgSender", "msgSender"].includes(expressionName(node.expression))
    && (node.arguments?.length ?? 0) === 0;
}
function isMsgValue(node) {
  return node?.nodeType === "MemberAccess" && node.memberName === "value" && expressionName(node.expression) === "msg";
}
function isBlockTimestamp(node) {
  return node?.nodeType === "MemberAccess" && node.memberName === "timestamp" && expressionName(node.expression) === "block";
}
function isBlockChainId(node) {
  return node?.nodeType === "MemberAccess" && node.memberName === "chainid" && expressionName(node.expression) === "block";
}
function isAddressThis(node) {
  if (node?.nodeType !== "FunctionCall" || !Array.isArray(node.arguments) || node.arguments.length !== 1) return false;
  const expression = node.expression;
  const isAddressCast = expressionName(expression) === "address"
    || (expression?.nodeType === "ElementaryTypeNameExpression" && String(expression.typeName?.name ?? expression.typeName?.typeDescriptions?.typeString ?? "") === "address");
  return isAddressCast && node.arguments[0]?.nodeType === "Identifier" && node.arguments[0]?.name === "this";
}
function isAddressThisBalance(node) {
  return node?.nodeType === "MemberAccess" && node.memberName === "balance" && isAddressThis(node.expression);
}
function isRequireOrAssert(call) {
  return call?.nodeType === "FunctionCall" && ["require", "assert"].includes(expressionName(call.expression));
}
function isEcrecover(call) {
  return call?.nodeType === "FunctionCall" && expressionName(call.expression) === "ecrecover";
}
function isKeccak(call) {
  return call?.nodeType === "FunctionCall" && ["keccak256", "sha3"].includes(expressionName(call.expression));
}
function unwrapCallExpression(expression) {
  let current = expression;
  while (current?.nodeType === "FunctionCallOptions") current = current.expression;
  while (current?.nodeType === "FunctionCall"
    && current.expression?.nodeType === "MemberAccess"
    && ["value", "gas"].includes(String(current.expression.memberName ?? ""))) {
    current = current.expression.expression;
    while (current?.nodeType === "FunctionCallOptions") current = current.expression;
  }
  return current;
}
function isLowLevelCall(call) {
  const expression = call?.nodeType === "FunctionCall" ? unwrapCallExpression(call.expression) : null;
  return expression?.nodeType === "MemberAccess"
    && ["call", "delegatecall", "staticcall", "callcode", "send"].includes(String(expression.memberName ?? ""));
}
function isExternalInteraction(call) {
  if (isLowLevelCall(call)) return true;
  const expression = call?.nodeType === "FunctionCall" ? unwrapCallExpression(call.expression) : null;
  if (expression?.nodeType !== "MemberAccess") return false;
  const memberName = String(expression.memberName ?? "");
  if (["transfer", "safeTransfer", "transferFrom", "safeTransferFrom"].includes(memberName)) return true;
  const receiverType = String(expression.expression?.typeDescriptions?.typeString ?? "");
  const functionType = String(expression.typeDescriptions?.typeString ?? "");
  return /^contract\s/iu.test(receiverType) && !/\b(?:view|pure)\b/iu.test(functionType);
}

function typeLabel(variable) {
  return String(variable?.typeDescriptions?.typeString ?? variable?.typeName?.name ?? "");
}
function isMappingType(variable, valuePattern) {
  const label = typeLabel(variable).replace(/\s+/gu, " ");
  return label.startsWith("mapping(") && valuePattern.test(label);
}
function isAddressVariable(variable) {
  return /^address(?: payable)?$/u.test(typeLabel(variable).trim());
}
function isBoolVariable(variable) {
  return /^bool$/u.test(typeLabel(variable).trim());
}
function isUintVariable(variable) {
  return /^uint(?:\d+)?$/u.test(typeLabel(variable).trim());
}
function isExternallyCallable(fn) {
  return fn?.nodeType === "FunctionDefinition" && ["external", "public"].includes(String(fn.visibility ?? ""));
}
function functionKindName(fn) {
  const kind = String(fn?.kind ?? "function");
  if (kind !== "function") return kind;
  return String(fn?.name ?? "");
}

function collectReferenceIds(node) {
  const ids = new Set();
  walk(node, (current) => {
    if (["Identifier", "IdentifierPath", "MemberAccess"].includes(current?.nodeType) && Number.isInteger(current.referencedDeclaration)) {
      ids.add(current.referencedDeclaration);
    }
  });
  return ids;
}
function referencesAny(node, ids) {
  if (!ids?.size) return false;
  return nodeContains(node, (current) => Number.isInteger(current?.referencedDeclaration) && ids.has(current.referencedDeclaration));
}
function referencesId(node, id) {
  return Number.isInteger(id) && nodeContains(node, (current) => current?.referencedDeclaration === id);
}

function conditionNodes(contextNodes) {
  const conditions = [];
  for (const root of contextNodes) {
    walk(root, (node) => {
      if (isRequireOrAssert(node) && node.arguments?.[0]) conditions.push(node.arguments[0]);
      if (node?.nodeType === "IfStatement" && node.condition) conditions.push(node.condition);
    });
  }
  return conditions;
}

function stateWriteRows(root, stateIds) {
  const rows = [];
  walk(root, (node) => {
    if (node?.nodeType === "Assignment" && referencesAny(node.leftHandSide, stateIds)) {
      rows.push({ node, start: parseSrc(node.src).start, operator: node.operator, stateIds: [...collectReferenceIds(node.leftHandSide)].filter((id) => stateIds.has(id)) });
    }
    if (node?.nodeType === "UnaryOperation" && ["++", "--", "delete"].includes(String(node.operator ?? "")) && referencesAny(node.subExpression, stateIds)) {
      rows.push({ node, start: parseSrc(node.src).start, operator: node.operator, stateIds: [...collectReferenceIds(node.subExpression)].filter((id) => stateIds.has(id)) });
    }
  });
  return rows.sort((a, b) => a.start - b.start);
}

function buildModel(compilerOutput, sources) {
  const nodesById = new Map();
  const parentByNode = new WeakMap();
  const sourcePathByNode = new WeakMap();
  const contracts = new Map();
  const functions = new Map();
  const modifiers = new Map();
  const variables = new Map();
  const sourcePaths = Object.keys(sources).sort();

  for (const sourcePath of sourcePaths) {
    const ast = compilerOutput?.sources?.[sourcePath]?.ast;
    if (!ast) continue;
    walk(ast, (node, parent) => {
      if (parent && typeof node === "object") parentByNode.set(node, parent);
      if (typeof node === "object") sourcePathByNode.set(node, sourcePath);
      if (Number.isInteger(node?.id)) nodesById.set(node.id, node);
      if (node?.nodeType === "ContractDefinition") contracts.set(node.id, node);
      if (node?.nodeType === "FunctionDefinition") functions.set(node.id, node);
      if (node?.nodeType === "ModifierDefinition") modifiers.set(node.id, node);
      if (node?.nodeType === "VariableDeclaration") variables.set(node.id, node);
    });
  }

  const contractByChild = new Map();
  for (const contract of contracts.values()) {
    for (const node of contract.nodes ?? []) {
      if (Number.isInteger(node?.id)) contractByChild.set(node.id, contract.id);
    }
  }

  const baseContractIds = (contract) => {
    const ids = Array.isArray(contract?.linearizedBaseContracts) ? contract.linearizedBaseContracts : [contract?.id];
    return ids.filter((id) => contracts.has(id));
  };
  const contractStateVariables = (contract) => {
    const rows = [];
    for (const contractId of baseContractIds(contract)) {
      const current = contracts.get(contractId);
      for (const node of current?.nodes ?? []) if (node?.nodeType === "VariableDeclaration" && node.stateVariable === true) rows.push(node);
    }
    return rows;
  };
  const contractFunctions = (contract) => {
    const rows = [];
    for (const contractId of baseContractIds(contract)) {
      const current = contracts.get(contractId);
      for (const node of current?.nodes ?? []) if (node?.nodeType === "FunctionDefinition") rows.push(node);
    }
    return rows;
  };
  const contractModifiers = (contract) => {
    const rows = [];
    for (const contractId of baseContractIds(contract)) {
      const current = contracts.get(contractId);
      for (const node of current?.nodes ?? []) if (node?.nodeType === "ModifierDefinition") rows.push(node);
    }
    return rows;
  };

  const calledInternalFunctions = (root) => {
    const ids = [];
    walk(root, (node) => {
      if (node?.nodeType !== "FunctionCall") return;
      const ref = node.expression?.referencedDeclaration;
      const target = functions.get(ref);
      if (target && ["internal", "private"].includes(String(target.visibility ?? ""))) ids.push(target.id);
    });
    return ids;
  };

  const functionClosure = (fn, { maxDepth = 8 } = {}) => {
    const rows = [];
    const visited = new Set();
    const visitFunction = (current, depth) => {
      if (!current || visited.has(current.id) || depth > maxDepth) return;
      visited.add(current.id);
      rows.push(current);
      for (const id of calledInternalFunctions(current.body)) visitFunction(functions.get(id), depth + 1);
    };
    visitFunction(fn, 0);
    return rows;
  };

  const functionContext = (fn, options = {}) => {
    const roots = [];
    for (const current of functionClosure(fn, options)) {
      if (current.body) roots.push(current.body);
      for (const invocation of current.modifiers ?? []) {
        const modifier = modifiers.get(invocation?.modifierName?.referencedDeclaration ?? invocation?.referencedDeclaration);
        if (modifier?.body) roots.push(modifier.body);
      }
    }
    return roots;
  };

  return {
    nodesById,
    parentByNode,
    sourcePathByNode,
    contracts,
    functions,
    modifiers,
    variables,
    contractByChild,
    baseContractIds,
    contractStateVariables,
    contractFunctions,
    contractModifiers,
    functionClosure,
    functionContext,
    sourcePaths,
  };
}

function stateGetterFunctionIds(model, stateIds) {
  const ids = new Set();
  for (const fn of model.functions.values()) {
    if (!fn?.body || !Number.isInteger(fn.id)) continue;
    let returnsState = false;
    walk(fn.body, (node) => {
      if (node?.nodeType === "Return" && referencesAny(node.expression, stateIds)) returnsState = true;
    });
    if (returnsState) ids.add(fn.id);
  }
  return ids;
}

function conditionReferencesStateOrGetter(condition, stateIds, getterIds) {
  if (referencesAny(condition, stateIds)) return true;
  return nodeContains(condition, (node) => node?.nodeType === "FunctionCall"
    && getterIds.has(node.expression?.referencedDeclaration ?? node.expression?.expression?.referencedDeclaration));
}

function hasAuthorization(fn, contract, model) {
  const explicitModifierNames = (fn.modifiers ?? []).map((invocation) => String(invocation?.modifierName?.name ?? invocation?.modifierName?.namePath ?? ""));
  if (explicitModifierNames.some((name) => /^(?:onlyOwner|onlyAdmin|onlyRole|auth|authorized|governance|requiresAuth|ownerOnly|adminOnly|restricted)$/iu.test(name))) return true;
  const stateVars = model.contractStateVariables(contract);
  const stateIds = new Set(stateVars.map((row) => row.id));
  const roleMappingIds = new Set(stateVars.filter((row) => isMappingType(row, /=>\s*bool\)?$/u)).map((row) => row.id));
  const getterIds = stateGetterFunctionIds(model, stateIds);
  const roots = model.functionContext(fn);
  const conditions = conditionNodes(roots);
  for (const condition of conditions) {
    const hasSender = nodeContains(condition, isMsgSender);
    if (!hasSender) continue;
    if (conditionReferencesStateOrGetter(condition, stateIds, getterIds)) return true;
    if (referencesAny(condition, roleMappingIds)) return true;
  }
  for (const invocation of fn.modifiers ?? []) {
    const modifier = model.modifiers.get(invocation?.modifierName?.referencedDeclaration ?? invocation?.referencedDeclaration);
    if (!modifier?.body) continue;
    const modifierConditions = conditionNodes([modifier.body]);
    if (modifierConditions.some((condition) => nodeContains(condition, isMsgSender) && referencesAny(condition, stateIds))) return true;
  }
  return false;
}

function hasOneTimeGuard(fn, contract, model) {
  const boolIds = new Set(model.contractStateVariables(contract).filter(isBoolVariable).map((row) => row.id));
  if (!boolIds.size) return false;
  const roots = model.functionContext(fn);
  const guardedIds = new Set();
  for (const condition of conditionNodes(roots)) {
    for (const id of boolIds) if (referencesId(condition, id)) guardedIds.add(id);
  }
  const writtenTrue = new Set();
  for (const root of roots) {
    walk(root, (node) => {
      if (node?.nodeType !== "Assignment") return;
      const ids = [...collectReferenceIds(node.leftHandSide)].filter((id) => boolIds.has(id));
      const isTrue = node.rightHandSide?.nodeType === "Literal" && String(node.rightHandSide.value) === "true";
      if (isTrue) for (const id of ids) writtenTrue.add(id);
    });
  }
  return [...guardedIds].some((id) => writtenTrue.has(id));
}

function pauseVariableIds(contract, model) {
  const boolVars = model.contractStateVariables(contract).filter(isBoolVariable);
  const ids = new Set();
  for (const variable of boolVars) {
    for (const fn of model.contractFunctions(contract)) {
      if (!hasAuthorization(fn, contract, model)) continue;
      const writes = model.functionContext(fn).flatMap((root) => stateWriteRows(root, new Set([variable.id])));
      if (writes.length) ids.add(variable.id);
    }
  }
  return ids;
}

function hasPauseGuard(fn, pauseIds, model) {
  if (!pauseIds.size) return false;
  return conditionNodes(model.functionContext(fn)).some((condition) => referencesAny(condition, pauseIds));
}

function localStateProvenance(roots, stateIds) {
  const provenance = new Map();
  for (const root of roots) {
    walk(root, (node) => {
      if (node?.nodeType !== "VariableDeclarationStatement" || !node.initialValue) return;
      const stateRefs = new Set([...collectReferenceIds(node.initialValue)].filter((id) => stateIds.has(id)));
      if (!stateRefs.size) return;
      for (const declaration of node.declarations ?? []) if (Number.isInteger(declaration?.id)) provenance.set(declaration.id, stateRefs);
    });
  }
  return provenance;
}

function expandedStateReferences(node, stateIds, localProvenance) {
  const refs = collectReferenceIds(node);
  const expanded = new Set([...refs].filter((id) => stateIds.has(id)));
  for (const id of refs) for (const stateId of localProvenance.get(id) ?? []) expanded.add(stateId);
  return expanded;
}

function hasMsgSenderAddressStateGuard(roots, addressStateIds) {
  return conditionNodes(roots).some((condition) => nodeContains(condition, (node) => {
    if (node?.nodeType !== "BinaryOperation" || !["==", "!="].includes(String(node.operator ?? ""))) return false;
    const leftSender = nodeContains(node.leftExpression, isMsgSender);
    const rightSender = nodeContains(node.rightExpression, isMsgSender);
    const leftRefs = collectReferenceIds(node.leftExpression);
    const rightRefs = collectReferenceIds(node.rightExpression);
    return (leftSender && [...rightRefs].some((id) => addressStateIds.has(id))) || (rightSender && [...leftRefs].some((id) => addressStateIds.has(id)));
  }));
}

function parametersBoundToPredicate(roots, parameterIdSet, predicate) {
  const bound = new Set();
  for (const condition of conditionNodes(roots)) {
    walk(condition, (node) => {
      if (node?.nodeType !== "BinaryOperation" || !["==", "!="].includes(String(node.operator ?? ""))) return;
      const leftRefs = collectReferenceIds(node.leftExpression);
      const rightRefs = collectReferenceIds(node.rightExpression);
      if (nodeContains(node.leftExpression, predicate)) for (const id of rightRefs) if (parameterIdSet.has(id)) bound.add(id);
      if (nodeContains(node.rightExpression, predicate)) for (const id of leftRefs) if (parameterIdSet.has(id)) bound.add(id);
    });
  }
  return bound;
}

function parameterIds(fn, predicate = () => true) {
  const ids = new Set();
  for (const list of [fn?.parameters?.parameters ?? [], fn?.returnParameters?.parameters ?? []]) {
    for (const variable of list) if (Number.isInteger(variable?.id) && predicate(variable)) ids.add(variable.id);
  }
  return ids;
}

function contextParameterIds(fn, model, predicate = () => true) {
  const ids = new Set();
  for (const current of model.functionClosure(fn)) {
    for (const id of parameterIds(current, predicate)) ids.add(id);
  }
  return ids;
}

function functionHasNamedCall(roots, names) {
  return roots.some((root) => nodeContains(root, (node) => node?.nodeType === "FunctionCall" && names.has(expressionName(unwrapCallExpression(node.expression)))));
}

function functionHasMemberCall(roots, memberNames) {
  return roots.some((root) => nodeContains(root, (node) => {
    if (node?.nodeType !== "FunctionCall") return false;
    const expression = unwrapCallExpression(node.expression);
    return expression?.nodeType === "MemberAccess" && memberNames.has(String(expression.memberName ?? ""));
  }));
}

function branchContainsRevertLike(node, model, depth = 0, seen = new Set()) {
  if (!node || depth > 5) return false;
  if (nodeContains(node, (candidate) => candidate?.nodeType === "RevertStatement" || (candidate?.nodeType === "FunctionCall" && expressionName(candidate.expression) === "revert"))) return true;
  let found = false;
  walk(node, (candidate) => {
    if (found || candidate?.nodeType !== "FunctionCall") return;
    const name = expressionName(candidate.expression);
    if (/(?:revert|fail|throw)/iu.test(name)) { found = true; return; }
    const referenced = candidate.expression?.referencedDeclaration ?? candidate.expression?.expression?.referencedDeclaration;
    if (!Number.isInteger(referenced) || seen.has(referenced)) return;
    const child = model.functions.get(referenced);
    if (!child?.body) return;
    const nextSeen = new Set(seen); nextSeen.add(referenced);
    if (branchContainsRevertLike(child.body, model, depth + 1, nextSeen)) found = true;
  });
  return found;
}

function functionChecksBooleanParameter(fn, parameterId, model, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 5 || seen.has(fn.id)) return false;
  const nextSeen = new Set(seen); nextSeen.add(fn.id);
  let checked = false;
  walk(fn.body, (node) => {
    if (checked) return;
    if (isRequireOrAssert(node) && referencesId(node.arguments?.[0], parameterId)) checked = true;
    if (node?.nodeType === "IfStatement" && referencesId(node.condition, parameterId)
      && (branchContainsRevertLike(node.trueBody, model) || branchContainsRevertLike(node.falseBody, model))) checked = true;
    if (node?.nodeType === "FunctionCall") {
      const referenced = node.expression?.referencedDeclaration ?? node.expression?.expression?.referencedDeclaration;
      const child = Number.isInteger(referenced) ? model.functions.get(referenced) : null;
      if (!child?.body) return;
      for (let index = 0; index < (node.arguments?.length ?? 0); index += 1) {
        if (!referencesId(node.arguments[index], parameterId)) continue;
        const childParam = child.parameters?.parameters?.[index];
        if (Number.isInteger(childParam?.id) && functionChecksBooleanParameter(child, childParam.id, model, depth + 1, nextSeen)) checked = true;
      }
    }
  });
  return checked;
}

function lowLevelCallChecked(fn, call, model) {
  let parent = model.parentByNode.get(call);
  while (parent) {
    if (isRequireOrAssert(parent)) return true;
    if (parent?.nodeType === "IfStatement" && nodeContains(parent.condition, (candidate) => candidate === call)) return true;
    if (["ExpressionStatement", "VariableDeclarationStatement", "Assignment", "Block", "FunctionDefinition"].includes(parent.nodeType)) break;
    parent = model.parentByNode.get(parent);
  }

  const statement = (() => {
    let current = call;
    while (current && !["VariableDeclarationStatement", "ExpressionStatement"].includes(current.nodeType)) current = model.parentByNode.get(current);
    return current;
  })();
  if (statement?.nodeType === "VariableDeclarationStatement") {
    const captured = new Set((statement.declarations ?? []).filter(Boolean).map((row) => row.id));
    if (captured.size) {
      const roots = model.functionContext(fn);
      for (const condition of conditionNodes(roots)) if (referencesAny(condition, captured)) return true;
      if (roots.some((root) => nodeContains(root, (node) => node?.nodeType === "Return" && referencesAny(node.expression, captured)))) return true;
      const callStart = parseSrc(call.src).start;
      for (const root of roots) {
        walk(root, (node) => {
          if (node?.nodeType !== "IfStatement" || parseSrc(node.src).start <= callStart) return;
          if (referencesAny(node.condition, captured) && (branchContainsRevertLike(node.trueBody, model) || branchContainsRevertLike(node.falseBody, model))) captured.add(-1);
        });
        if (captured.has(-1)) return true;
        walk(root, (node) => {
          if (node?.nodeType !== "FunctionCall" || parseSrc(node.src).start <= callStart) return;
          const referenced = node.expression?.referencedDeclaration ?? node.expression?.expression?.referencedDeclaration;
          const child = Number.isInteger(referenced) ? model.functions.get(referenced) : null;
          if (!child?.body) return;
          for (let index = 0; index < (node.arguments?.length ?? 0); index += 1) {
            const matched = [...captured].some((id) => id >= 0 && referencesId(node.arguments[index], id));
            const childParam = child.parameters?.parameters?.[index];
            if (matched && Number.isInteger(childParam?.id) && functionChecksBooleanParameter(child, childParam.id, model)) captured.add(-1);
          }
        });
        if (captured.has(-1)) return true;
      }
    }
  }
  return false;
}

function reentrancyGuarded(fn, contract, model) {
  const stateVars = model.contractStateVariables(contract);
  const lockIds = new Set(stateVars.filter((row) => isBoolVariable(row) || isUintVariable(row)).map((row) => row.id));
  for (const invocation of fn.modifiers ?? []) {
    const modifier = model.modifiers.get(invocation?.modifierName?.referencedDeclaration ?? invocation?.referencedDeclaration);
    if (!modifier?.body) continue;
    const src = String(model.sourcePathByNode.get(modifier) ?? "");
    const body = modifier.body;
    const placeholders = descendants(body, (node) => node?.nodeType === "PlaceholderStatement");
    if (!placeholders.length) continue;
    const guards = conditionNodes([body]).some((condition) => referencesAny(condition, lockIds));
    const writes = stateWriteRows(body, lockIds);
    if (guards && writes.length >= 2) return true;
    if (src && String(modifier.name ?? "").toLowerCase().includes("nonreentrant")) return true;
  }
  return false;
}

function functionOrderedEvents(fn, contract, model) {
  const stateIds = new Set(model.contractStateVariables(contract).map((row) => row.id));
  const events = [];
  const stack = new Set();
  let sequence = 0;

  const push = (kind, node, extra = {}) => {
    sequence += 1;
    events.push({ kind, order: sequence, node, ...extra });
  };

  const processNode = (node, depth = 0) => {
    if (!node || depth > 8) return;
    if (node.nodeType === "Block") {
      for (const statement of node.statements ?? []) processNode(statement, depth);
      return;
    }

    // Evaluate calls in lexical order. Internal/private calls are expanded at
    // the call site so source offsets from different files cannot reorder the
    // caller's state effects.
    const localCalls = descendants(node, (current) => current?.nodeType === "FunctionCall")
      .sort((a, b) => parseSrc(a.src).start - parseSrc(b.src).start);
    for (const call of localCalls) {
      const expression = unwrapCallExpression(call.expression);
      const ref = expression?.referencedDeclaration;
      const target = model.functions.get(ref);
      if (target && ["internal", "private"].includes(String(target.visibility ?? "")) && !stack.has(target.id)) {
        stack.add(target.id);
        processNode(target.body, depth + 1);
        stack.delete(target.id);
      } else if (isExternalInteraction(call)) {
        push("interaction", call);
      }
    }

    // State writes in the caller statement occur after evaluating its RHS and
    // call arguments. This preserves checks-effects-interactions across files.
    for (const write of stateWriteRows(node, stateIds)) push("state-write", write.node);

    // Explicitly traverse control-flow bodies that are not represented as a
    // top-level Block. The rule remains bounded and path-insensitive.
    if (node.nodeType === "IfStatement") {
      processNode(node.trueBody, depth + 1);
      processNode(node.falseBody, depth + 1);
    } else if (["ForStatement", "WhileStatement", "DoWhileStatement"].includes(String(node.nodeType ?? ""))) {
      processNode(node.body, depth + 1);
    } else if (node.nodeType === "TryStatement") {
      for (const clause of node.clauses ?? []) processNode(clause.block, depth + 1);
    }
  };

  // Modifier interactions before the placeholder execute before the body;
  // interactions after it execute after the body.
  const beforeModifierCalls = [];
  const afterModifierCalls = [];
  for (const invocation of fn.modifiers ?? []) {
    const modifier = model.modifiers.get(invocation?.modifierName?.referencedDeclaration ?? invocation?.referencedDeclaration);
    if (!modifier?.body) continue;
    let placeholderStart = Number.POSITIVE_INFINITY;
    walk(modifier.body, (node) => {
      if (node?.nodeType === "PlaceholderStatement") placeholderStart = Math.min(placeholderStart, parseSrc(node.src).start);
    });
    for (const call of descendants(modifier.body, (node) => node?.nodeType === "FunctionCall")) {
      if (!isExternalInteraction(call)) continue;
      const row = { call, modifierName: modifier.name ?? null, beforePlaceholder: parseSrc(call.src).start < placeholderStart };
      (row.beforePlaceholder ? beforeModifierCalls : afterModifierCalls).push(row);
    }
  }
  for (const row of beforeModifierCalls) push("interaction", row.call, row);
  processNode(fn.body, 0);
  for (const row of afterModifierCalls) push("interaction", row.call, row);
  return events;
}


function directCallsInSourceOrder(fn) {
  if (!fn?.body) return [];
  return descendants(fn.body, (node) => node?.nodeType === "FunctionCall")
    .sort((left, right) => parseSrc(left.src).start - parseSrc(right.src).start);
}

function internalCallTarget(call, model) {
  const expression = unwrapCallExpression(call?.expression);
  const referenced = expression?.referencedDeclaration ?? expression?.expression?.referencedDeclaration;
  const target = Number.isInteger(referenced) ? model.functions.get(referenced) : null;
  return target && ["internal", "private"].includes(String(target.visibility ?? "")) ? target : null;
}

function locallyDispatchedTarget(call, model) {
  const expression = unwrapCallExpression(call?.expression);
  const referenced = expression?.referencedDeclaration ?? expression?.expression?.referencedDeclaration;
  const target = Number.isInteger(referenced) ? model.functions.get(referenced) : null;
  if (!target) return null;
  if (["Identifier", "IdentifierPath"].includes(String(expression?.nodeType ?? ""))) return target;
  return null;
}

function closureContainsExternalInteraction(fn, model, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 8 || seen.has(fn.id)) return false;
  const nextSeen = new Set(seen); nextSeen.add(fn.id);
  let found = false;
  walk(fn.body, (node) => {
    if (found || node?.nodeType !== "FunctionCall") return;
    if (isExternalInteraction(node)) { found = true; return; }
    const target = internalCallTarget(node, model);
    if (target && closureContainsExternalInteraction(target, model, depth + 1, nextSeen)) found = true;
  });
  return found;
}

function recursiveStateReads(node, stateIds, model, depth = 0, seen = new Set()) {
  const reads = new Set([...collectReferenceIds(node)].filter((id) => stateIds.has(id)));
  if (depth > 8) return reads;
  walk(node, (current) => {
    if (current?.nodeType !== "FunctionCall") return;
    const target = locallyDispatchedTarget(current, model) ?? internalCallTarget(current, model);
    if (!target?.body || seen.has(target.id)) return;
    const nextSeen = new Set(seen); nextSeen.add(target.id);
    for (const id of recursiveStateReads(target.body, stateIds, model, depth + 1, nextSeen)) reads.add(id);
  });
  return reads;
}

function conditionRevertsOnFailure(conditionNode, model) {
  const parent = model.parentByNode.get(conditionNode);
  if (isRequireOrAssert(parent)) return true;
  let current = parent;
  while (current && current.nodeType !== "FunctionDefinition") {
    if (current.nodeType === "IfStatement" && current.condition === conditionNode) {
      return branchContainsRevertLike(current.trueBody, model) || branchContainsRevertLike(current.falseBody, model);
    }
    current = model.parentByNode.get(current);
  }
  return false;
}

function recursiveStateWriteRows(fn, stateIds, model, depth = 0, seen = new Set()) {
  if (!fn?.body || depth > 8 || seen.has(fn.id)) return [];
  const nextSeen = new Set(seen); nextSeen.add(fn.id);
  const rows = [...stateWriteRows(fn.body, stateIds)];
  for (const call of directCallsInSourceOrder(fn)) {
    const target = internalCallTarget(call, model);
    if (!target) continue;
    rows.push(...recursiveStateWriteRows(target, stateIds, model, depth + 1, nextSeen));
  }
  return rows;
}

function revertingConditionStateReads(fn, stateIds, model) {
  if (!fn?.body) return new Set();
  const ids = new Set();
  for (const condition of conditionNodes([fn.body])) {
    if (!conditionRevertsOnFailure(condition, model)) continue;
    for (const id of recursiveStateReads(condition, stateIds, model)) ids.add(id);
  }
  return ids;
}

function validatedTerminalStateTransition(fn, contract, model, events) {
  const stateRows = model.contractStateVariables(contract);
  const stateIds = new Set(stateRows.map((row) => row.id));
  const firstInteraction = events.findIndex((row) => row.kind === "interaction");
  if (firstInteraction < 0) return null;
  const writesAfter = events.slice(firstInteraction + 1).filter((row) => row.kind === "state-write");
  if (!writesAfter.length) return null;

  const directCalls = directCallsInSourceOrder(fn);
  const interactionCallIndex = directCalls.findIndex((call) => isExternalInteraction(call)
    || closureContainsExternalInteraction(internalCallTarget(call, model), model));
  if (interactionCallIndex < 0) return null;

  const preValidatedIds = new Set();
  const preValidatingHelpers = [];
  for (const call of directCalls.slice(0, interactionCallIndex)) {
    const target = internalCallTarget(call, model);
    if (!target?.body) continue;
    const reads = revertingConditionStateReads(target, stateIds, model);
    if (!reads.size) continue;
    for (const id of reads) preValidatedIds.add(id);
    preValidatingHelpers.push(String(target.name ?? "internal-helper"));
  }
  if (!preValidatedIds.size) return null;

  const validatedWriteNodes = new Set();
  const postValidatingHelpers = [];
  const coveredIds = new Set();
  for (const call of directCalls.slice(interactionCallIndex + 1)) {
    const target = internalCallTarget(call, model);
    if (!target?.body) continue;
    const targetWrites = recursiveStateWriteRows(target, stateIds, model);
    if (!targetWrites.length) continue;
    const targetWriteIds = new Set(targetWrites.flatMap((row) => row.stateIds));
    const firstWriteStart = Math.min(...targetWrites.map((row) => row.start));
    const checks = conditionNodes([target.body]).filter((condition) => parseSrc(condition.src).start < firstWriteStart);
    const checkedIds = new Set();
    for (const condition of checks) {
      if (!conditionRevertsOnFailure(condition, model)) continue;
      for (const id of recursiveStateReads(condition, stateIds, model)) if (targetWriteIds.has(id)) checkedIds.add(id);
    }
    if (![...targetWriteIds].every((id) => checkedIds.has(id) && preValidatedIds.has(id))) continue;
    for (const row of targetWrites) validatedWriteNodes.add(row.node);
    for (const id of targetWriteIds) coveredIds.add(id);
    postValidatingHelpers.push(String(target.name ?? "internal-helper"));
  }

  if (!validatedWriteNodes.size || !writesAfter.every((row) => validatedWriteNodes.has(row.node))) return null;
  const stateNames = [...coveredIds].map((id) => String(model.variables.get(id)?.name ?? `state-${id}`)).sort();
  return {
    patternId: "PRE_AND_POST_CALL_STATE_REVALIDATION_BEFORE_TERMINAL_WRITE",
    preValidatingHelpers: [...new Set(preValidatingHelpers)].sort(),
    postValidatingHelpers: [...new Set(postValidatingHelpers)].sort(),
    stateVariablesCovered: stateNames,
    stateWritesCovered: writesAfter.length,
    classification: "BOUNDED_CONTEXT_REVIEW_NOT_CONFIRMED_VULNERABILITY",
    independentReviewRequired: true,
  };
}

function callIsCheckedByRevertingCondition(call, model) {
  let current = call;
  while (current && current.nodeType !== "FunctionDefinition") {
    const parent = model.parentByNode.get(current);
    if (!parent) break;
    if (isRequireOrAssert(parent)) return true;
    if (parent.nodeType === "IfStatement" && nodeContains(parent.condition, (candidate) => candidate === call)) {
      return branchContainsRevertLike(parent.trueBody, model) || branchContainsRevertLike(parent.falseBody, model);
    }
    current = parent;
  }
  return false;
}

function writeStateNames(rows, model) {
  return [...new Set(rows.flatMap((row) => row.stateIds)
    .map((id) => String(model.variables.get(id)?.name ?? `state-${id}`)))].sort();
}

function stateNamesMatch(names, pattern) {
  return names.length > 0 && names.every((name) => pattern.test(name));
}

function temporaryMintSettlementPattern(fn, contract, model, events) {
  const stateIds = new Set(model.contractStateVariables(contract).map((row) => row.id));
  const calls = directCallsInSourceOrder(fn);
  const firstInteraction = calls.findIndex((call) => isExternalInteraction(call)
    || closureContainsExternalInteraction(internalCallTarget(call, model), model));
  if (firstInteraction < 0) return null;
  const interaction = calls[firstInteraction];
  if (!callIsCheckedByRevertingCondition(interaction, model)) return null;

  const beforeCalls = calls.slice(0, firstInteraction);
  const afterCalls = calls.slice(firstInteraction + 1);
  const mintCall = beforeCalls.find((call) => ["_mint", "mint"].includes(expressionName(unwrapCallExpression(call.expression))));
  const mintTarget = internalCallTarget(mintCall, model);
  const mintWrites = recursiveStateWriteRows(mintTarget, stateIds, model);
  const mintStateNames = writeStateNames(mintWrites, model);
  if (!mintTarget || !stateNamesMatch(mintStateNames, /(balance|supply)/iu)) return null;

  const allowedWritePatterns = new Map([
    ["_spendAllowance", /allow/iu],
    ["spendAllowance", /allow/iu],
    ["_burn", /(balance|supply)/iu],
    ["burn", /(balance|supply)/iu],
    ["_transfer", /(balance|supply)/iu],
    ["transfer", /(balance|supply)/iu],
  ]);
  const allowedWriteNodes = new Set();
  const settlementHelpers = [];
  let hasAllowanceRecovery = false;
  let hasBurn = false;
  for (const call of afterCalls) {
    if (isExternalInteraction(call)) return null;
    const target = internalCallTarget(call, model);
    if (!target?.body) continue;
    const name = expressionName(unwrapCallExpression(call.expression));
    const writes = recursiveStateWriteRows(target, stateIds, model);
    if (!writes.length) {
      if (!["view", "pure"].includes(String(target.stateMutability ?? ""))
        && !["_flashFeeReceiver", "flashFeeReceiver"].includes(name)) return null;
      continue;
    }
    const pattern = allowedWritePatterns.get(name);
    const names = writeStateNames(writes, model);
    if (!pattern || !stateNamesMatch(names, pattern)) return null;
    if (["_spendAllowance", "spendAllowance"].includes(name)) hasAllowanceRecovery = true;
    if (["_burn", "burn"].includes(name)) hasBurn = true;
    for (const row of writes) allowedWriteNodes.add(row.node);
    settlementHelpers.push({ name, stateVariables: names });
  }
  if (!hasAllowanceRecovery || !hasBurn || !allowedWriteNodes.size) return null;

  const interactionStart = parseSrc(interaction.src).start;
  const directWritesAfter = stateWriteRows(fn.body, stateIds).filter((row) => row.start > interactionStart);
  if (directWritesAfter.length) return null;
  const eventInteraction = events.findIndex((row) => row.kind === "interaction");
  const writesAfter = eventInteraction >= 0 ? events.slice(eventInteraction + 1).filter((row) => row.kind === "state-write") : [];
  if (!writesAfter.length || !writesAfter.every((row) => allowedWriteNodes.has(row.node))) return null;

  const returnsTrue = nodeContains(fn.body, (node) => node?.nodeType === "Return"
    && node.expression?.nodeType === "Literal" && String(node.expression.value) === "true");
  if (!returnsTrue) return null;
  return {
    patternId: "CHECKED_TEMPORARY_MINT_ALLOWANCE_RECOVERY_AND_BURN",
    classification: "BOUNDED_CONTEXT_REVIEW_NOT_CONFIRMED_VULNERABILITY",
    interactionName: expressionName(unwrapCallExpression(interaction.expression)),
    mintStateVariables: mintStateNames,
    settlementHelpers,
    stateWritesCovered: writesAfter.length,
    independentReviewRequired: true,
  };
}

function boundedInteractionContext(fn, contract, model, events) {
  return validatedTerminalStateTransition(fn, contract, model, events)
    ?? temporaryMintSettlementPattern(fn, contract, model, events)
    ?? null;
}

function storageLayouts(compilerOutput) {
  const rows = new Map();
  for (const [sourcePath, contracts] of Object.entries(compilerOutput?.contracts ?? {})) {
    for (const [contractName, artifact] of Object.entries(contracts ?? {})) {
      rows.set(contractName, { sourcePath, contractName, storageLayout: artifact?.storageLayout ?? null, ir: artifact?.irOptimized ?? artifact?.ir ?? null });
    }
  }
  return rows;
}

function storageLayoutCompatible(left, right) {
  const a = left?.storageLayout;
  const b = right?.storageLayout;
  if (!a || !b || !Array.isArray(a.storage) || !Array.isArray(b.storage)) return { compatible: false, reason: "layout_missing" };
  const resolve = (layout, entry) => {
    const type = layout.types?.[entry.type] ?? {};
    return { slot: String(entry.slot), offset: Number(entry.offset), bytes: Number(type.numberOfBytes ?? 0), label: String(type.label ?? entry.type), encoding: String(type.encoding ?? "") };
  };
  const leftRows = a.storage.map((entry) => resolve(a, entry));
  const rightRows = b.storage.map((entry) => resolve(b, entry));
  for (let index = 0; index < leftRows.length; index += 1) {
    const expected = leftRows[index];
    const actual = rightRows[index];
    if (!actual) return { compatible: false, reason: "candidate_shorter", index, expected, actual: null };
    if (expected.slot !== actual.slot || expected.offset !== actual.offset || expected.bytes !== actual.bytes || expected.label !== actual.label || expected.encoding !== actual.encoding) {
      return { compatible: false, reason: "prefix_mismatch", index, expected, actual };
    }
  }
  return { compatible: true, reason: "prefix_compatible", baselineEntries: leftRows.length, candidateEntries: rightRows.length };
}

function compileErrorRows(compilerOutput) {
  return (compilerOutput?.errors ?? []).filter((row) => row?.severity === "error").map((row) => ({ type: row.type, component: row.component, message: row.formattedMessage ?? row.message }));
}

export function analyzeSolidityCompilerAst({ compilerOutput, sources, storageComparisonPairs = [], expectedCompilerVersion = "0.8.24+commit.e11b9ed9" }) {
  if (!compilerOutput || typeof compilerOutput !== "object") throw new Error("compiler_output_required");
  if (!sources || typeof sources !== "object" || Array.isArray(sources) || !Object.keys(sources).length) throw new Error("source_bundle_required");
  const errors = compileErrorRows(compilerOutput);
  if (errors.length) throw new Error(`compiler_errors:${sha256(stable(errors))}`);
  const sourcePaths = Object.keys(sources).sort();
  for (const sourcePath of sourcePaths) {
    if (typeof sources[sourcePath] !== "string") throw new Error(`source_content_invalid:${sourcePath}`);
    if (!compilerOutput?.sources?.[sourcePath]?.ast) throw new Error(`compiler_ast_missing:${sourcePath}`);
  }

  const model = buildModel(compilerOutput, sources);
  const layouts = storageLayouts(compilerOutput);
  const findings = [];
  const suppressedInteractionPatterns = [];
  const add = (signalId, node, detail = {}) => {
    const definition = COMPILER_AST_SIGNAL_CATALOG[signalId];
    if (!definition) return;
    const sourcePath = node ? model.sourcePathByNode.get(node) ?? null : detail.sourcePath ?? null;
    const range = node ? parseSrc(node.src) : { start: 0, length: 0, fileIndex: -1 };
    const line = sourcePath ? lineForOffset(sources[sourcePath], range.start) : null;
    const key = `${signalId}|${sourcePath ?? "storage"}|${line ?? 0}|${detail.contractName ?? ""}|${detail.functionName ?? ""}`;
    if (findings.some((row) => row.key === key)) return;
    findings.push({
      key,
      signalId,
      severity: definition.severity,
      title: definition.title,
      sourcePath,
      line,
      contractName: detail.contractName ?? null,
      functionName: detail.functionName ?? null,
      evidence: detail,
      compilerBacked: true,
      exploitabilityProven: false,
      independentReview: false,
    });
  };

  for (const contract of model.contracts.values()) {
    if (["interface", "library"].includes(String(contract.contractKind ?? ""))) continue;
    const stateVars = model.contractStateVariables(contract);
    const stateIds = new Set(stateVars.map((row) => row.id));
    const uintMappingIds = new Set(stateVars.filter((row) => isMappingType(row, /=>\s*uint(?:\d+)?\)?$/u)).map((row) => row.id));
    const boolMappingIds = new Set(stateVars.filter((row) => isMappingType(row, /=>\s*bool\)?$/u)).map((row) => row.id));
    const nestedUintMappingIds = new Set(stateVars.filter((row) => /mapping\([^)]*address[^)]*=>\s*mapping\([^)]*address[^)]*=>\s*uint/u.test(typeLabel(row).replace(/\s+/gu, " "))).map((row) => row.id));
    const uintStateIds = new Set(stateVars.filter(isUintVariable).map((row) => row.id));
    const addressStateIds = new Set(stateVars.filter(isAddressVariable).map((row) => row.id));
    const pauseIds = pauseVariableIds(contract, model);

    const contractRoots = [...model.contractFunctions(contract).map((fn) => fn.body).filter(Boolean), ...model.contractModifiers(contract).map((modifier) => modifier.body).filter(Boolean)];
    const hasDelegatecall = functionHasMemberCall(contractRoots, new Set(["delegatecall", "callcode"]));
    const implementationIds = new Set();
    if (hasDelegatecall) {
      for (const root of contractRoots) {
        walk(root, (node) => {
          if (node?.nodeType === "FunctionCall" && node.expression?.nodeType === "MemberAccess" && ["delegatecall", "callcode"].includes(String(node.expression.memberName ?? ""))) {
            for (const id of collectReferenceIds(node.expression.expression)) if (addressStateIds.has(id)) implementationIds.add(id);
          }
        });
      }
    }

    for (const fn of model.contractFunctions(contract)) {
      if (!isExternallyCallable(fn)) continue;
      const roots = model.functionContext(fn);
      const auth = hasAuthorization(fn, contract, model);
      const writes = roots.flatMap((root) => stateWriteRows(root, stateIds));
      const functionName = functionKindName(fn);
      const detailBase = { contractName: contract.name, functionName };

      const emitsMintEvent = roots.some((root) => nodeContains(root, (node) => node?.nodeType === "EmitStatement"
        && nodeContains(node.eventCall, (child) => isAddressThis(child) === false && child?.nodeType === "FunctionCall"
          && expressionName(child.expression) === "address" && child.arguments?.[0]?.nodeType === "Literal" && String(child.arguments[0].value) === "0")));
      const increasesMapping = writes.some((row) => ["+=", "="].includes(String(row.operator)) && row.stateIds.some((id) => uintMappingIds.has(id)));
      const increasesUint = writes.some((row) => ["+=", "="].includes(String(row.operator)) && row.stateIds.some((id) => uintStateIds.has(id)));
      const pairedBurn = functionHasNamedCall(roots, new Set(["burn", "_burn"]));
      if (increasesMapping && increasesUint && emitsMintEvent && !pairedBurn && !auth) add("open_mint", fn, detailBase);

      const writesAddressPrivilege = writes.some((row) => row.stateIds.some((id) => addressStateIds.has(id)));
      const initializerLike = /^(?:init|initialize|reinitialize|setup|bootstrap|configure)/iu.test(functionName);
      if (initializerLike && writesAddressPrivilege && !hasDelegatecall && fn.kind !== "constructor" && !auth && !hasOneTimeGuard(fn, contract, model)) add("unguarded_initializer", fn, detailBase);

      const movesValue = functionHasMemberCall(roots, new Set(["transfer", "safeTransfer", "transferFrom", "safeTransferFrom", "call", "send"])) || writes.some((row) => row.stateIds.some((id) => uintMappingIds.has(id)));
      const isPauseAdmin = writes.some((row) => row.stateIds.some((id) => pauseIds.has(id))) && auth;
      if (pauseIds.size && movesValue && !isPauseAdmin && !hasPauseGuard(fn, pauseIds, model)) add("missing_pause_guard", fn, detailBase);

      const mappingWrites = new Set(writes.flatMap((row) => row.stateIds).filter((id) => uintMappingIds.has(id)));
      const transfersValue = functionHasMemberCall(roots, new Set(["transfer", "safeTransfer", "call", "send"]));
      const reducesMappedBalance = writes.some((row) => row.stateIds.some((id) => uintMappingIds.has(id)) && (row.operator === "-=" || nodeContains(row.node, (node) => node?.nodeType === "BinaryOperation" && node.operator === "-")));
      const withdrawalLike = /(?:withdraw|redeem|release|claim|exit|cashout|unstake|payout)/iu.test(functionName);
      if (withdrawalLike && mappingWrites.size && (transfersValue || reducesMappedBalance) && uintMappingIds.size >= 2) {
        const provenance = localStateProvenance(roots, uintMappingIds);
        const guardRefs = new Set();
        for (const condition of conditionNodes(roots)) for (const id of expandedStateReferences(condition, uintMappingIds, provenance)) guardRefs.add(id);
        if (guardRefs.size < 2) add("insolvent_withdraw", fn, detailBase);
      }

      const keccakCalls = roots.flatMap((root) => descendants(root, isKeccak));
      const bytesParamIds = contextParameterIds(fn, model, (row) => /^bytes(?: (?:calldata|memory|storage)(?: ref)?)?$/u.test(typeLabel(row).trim()));
      const hasBytesParam = bytesParamIds.size > 0;
      const uintParamIds = contextParameterIds(fn, model, (row) => isUintVariable(row));
      const crossDomainCandidate = hasBytesParam && keccakCalls.length && writes.some((row) => row.stateIds.some((id) => isMappingType(model.variables.get(id), /=>\s*bool\)?$/u)));
      if (crossDomainCandidate) {
        const best = keccakCalls.find((call) => nodeContains(call, isBlockChainId) || nodeContains(call, isAddressThis)) ?? keccakCalls[0];
        const referencedUintParameters = [...collectReferenceIds(best)].filter((id) => {
          const variable = model.variables.get(id);
          return variable && variable.stateVariable !== true && isUintVariable(variable);
        });
        const boundUintParams = new Set([...uintParamIds].filter((id) => referencesId(best, id)).concat(referencedUintParameters)).size;
        const messageBound = [...bytesParamIds].some((id) => referencesId(best, id));
        const senderAuthenticated = auth || hasMsgSenderAddressStateGuard(roots, addressStateIds);
        const addressParamIds = contextParameterIds(fn, model, (row) => isAddressVariable(row));
        const chainBoundParams = parametersBoundToPredicate(roots, uintParamIds, isBlockChainId);
        const destinationBoundParams = parametersBoundToPredicate(roots, addressParamIds, isAddressThis);
        const chainIdBound = nodeContains(best, isBlockChainId) || [...chainBoundParams].some((id) => referencesId(best, id));
        const destinationBound = nodeContains(best, isAddressThis) || [...destinationBoundParams].some((id) => referencesId(best, id));
        const complete = chainIdBound && destinationBound && boundUintParams >= 1 && messageBound && senderAuthenticated;
        if (!complete) add("cross_chain_replay", fn, { ...detailBase, boundUintParams, messageBound, chainIdBound, destinationBound, senderAuthenticated });
      }

      const ecrecoverCalls = roots.flatMap((root) => descendants(root, isEcrecover));
      if (ecrecoverCalls.length) {
        const hasDomain = roots.some((root) => nodeContains(root, isBlockChainId)) && roots.some((root) => nodeContains(root, isAddressThis));
        const nonceIds = new Set(stateVars.filter((row) => /nonce|used|replay/iu.test(String(row.name ?? "")) || isMappingType(row, /=>\s*(?:uint|bool)/u)).map((row) => row.id));
        const hasNonce = roots.some((root) => referencesAny(root, nonceIds) && stateWriteRows(root, nonceIds).length > 0);
        if (!hasDomain || !hasNonce) add("signature_replay", fn, { ...detailBase, domainBound: hasDomain, nonceBound: hasNonce });

        const writesAllowance = writes.some((row) => row.stateIds.some((id) => nestedUintMappingIds.has(id)));
        if (writesAllowance) {
          const deadlineChecked = conditionNodes(roots).some((condition) => {
            if (!nodeContains(condition, isBlockTimestamp)) return false;
            return [...collectReferenceIds(condition)].some((id) => {
              const variable = model.variables.get(id);
              return variable && variable.stateVariable !== true && isUintVariable(variable);
            });
          });
          if (!deadlineChecked) add("permit_no_deadline", fn, detailBase);
        }
      }

      const usesInstantSpot = functionHasMemberCall(roots, new Set(["getReserves", "spot"]));
      const usesWindowedOracle = functionHasMemberCall(roots, new Set(["observe", "consult", "latestRoundData", "getRoundData"]));
      if (usesInstantSpot && !usesWindowedOracle) add("spot_oracle", fn, detailBase);

      const returnsBool = (fn.returnParameters?.parameters ?? []).some((row) => isBoolVariable(row));
      const decisionLike = returnsBool && ["view", "pure"].includes(String(fn.stateMutability ?? ""));
      const lowQuorum = decisionLike && roots.some((root) => nodeContains(root, (node) => {
        if (node?.nodeType !== "BinaryOperation" || ![">=", "<=", ">", "<"].includes(String(node.operator ?? ""))) return false;
        const leftLiteral = node.leftExpression?.nodeType === "Literal" ? Number(node.leftExpression.value) : null;
        const rightLiteral = node.rightExpression?.nodeType === "Literal" ? Number(node.rightExpression.value) : null;
        const literal = Number.isFinite(leftLiteral) ? leftLiteral : rightLiteral;
        const other = Number.isFinite(leftLiteral) ? node.rightExpression : node.leftExpression;
        return Number.isFinite(literal) && literal <= 1 && referencesAny(other, new Set([...uintStateIds, ...parameterIds(fn, isUintVariable)]));
      }));
      if (lowQuorum) add("low_quorum", fn, detailBase);

      if (boolMappingIds.size && mappingWrites.size >= 1) {
        const policyRead = roots.some((root) => referencesAny(root, boolMappingIds));
        const addressParamIds = contextParameterIds(fn, model, (row) => isAddressVariable(row));
        const mappingWriteRows = writes.filter((row) => row.stateIds.some((id) => uintMappingIds.has(id)));
        const indexedAddressParams = new Set();
        for (const row of mappingWriteRows) {
          for (const id of collectReferenceIds(row.node)) if (addressParamIds.has(id)) indexedAddressParams.add(id);
        }
        const movesBetweenAddresses = mappingWriteRows.length >= 2 && indexedAddressParams.size >= 2;
        if (movesBetweenAddresses && !policyRead) add("transfer_policy_bypass", fn, { ...detailBase, authorizationObserved: auth, indexedAddressParameters: indexedAddressParams.size });
      }

      const usesTransferFrom = functionHasMemberCall(roots, new Set(["transferFrom", "safeTransferFrom"]));
      if (usesTransferFrom && mappingWrites.size) {
        const observesBalance = functionHasMemberCall(roots, new Set(["balanceOf"]));
        if (!observesBalance) add("fee_token_mismatch", fn, detailBase);
      }

      const postBalanceArithmetic = roots.some((root) => nodeContains(root, (node) => {
        if (node?.nodeType !== "BinaryOperation" || !["/", "*"].includes(String(node.operator ?? ""))) return false;
        if (!nodeContains(node, isAddressThisBalance)) return false;
        const hasMsgValueSubtraction = nodeContains(node, (child) => child?.nodeType === "BinaryOperation" && child.operator === "-" && nodeContains(child, isAddressThisBalance) && nodeContains(child, isMsgValue));
        return !hasMsgValueSubtraction;
      }));
      const postStateDenominatorArithmetic = roots.some((root) => nodeContains(root, (node) => {
        if (node?.nodeType !== "BinaryOperation" || node.operator !== "/") return false;
        const denominator = node.rightExpression;
        const additiveDenominator = denominator?.nodeType === "BinaryOperation" && denominator.operator === "+"
          ? denominator
          : descendants(denominator, (candidate) => candidate?.nodeType === "BinaryOperation" && candidate.operator === "+")[0] ?? null;
        if (!additiveDenominator) return false;
        const denominatorRefs = collectReferenceIds(additiveDenominator);
        const numeratorRefs = collectReferenceIds(node.leftExpression);
        const isUintInput = (id) => {
          const variable = model.variables.get(id);
          return variable && variable.stateVariable !== true && isUintVariable(variable);
        };
        const isUintState = (id) => {
          const variable = model.variables.get(id);
          return variable && variable.stateVariable === true && isUintVariable(variable);
        };
        const denominatorHasState = [...denominatorRefs].some(isUintState);
        const denominatorHasInput = [...denominatorRefs].some(isUintInput);
        const numeratorHasInput = [...numeratorRefs].some(isUintInput);
        const numeratorHasState = [...numeratorRefs].some(isUintState);
        return denominatorHasState && denominatorHasInput && numeratorHasInput && numeratorHasState;
      }));
      if ((postBalanceArithmetic && roots.some((root) => nodeContains(root, isMsgValue))) || postStateDenominatorArithmetic) add("post_balance_share_accounting", fn, detailBase);

      if (hasDelegatecall && implementationIds.size && writes.some((row) => row.stateIds.some((id) => implementationIds.has(id))) && !auth) add("unprotected_upgrade", fn, detailBase);

      const lowCalls = roots.flatMap((root) => descendants(root, isLowLevelCall));
      for (const call of lowCalls) if (!lowLevelCallChecked(fn, call, model)) add("unchecked_low_level_call", call, detailBase);

      const events = functionOrderedEvents(fn, contract, model);
      const firstInteraction = events.findIndex((row) => row.kind === "interaction");
      const stateAfter = firstInteraction >= 0 && events.slice(firstInteraction + 1).some((row) => row.kind === "state-write");
      if (stateAfter && !reentrancyGuarded(fn, contract, model)) {
        const boundedContext = boundedInteractionContext(fn, contract, model, events);
        if (boundedContext) {
          suppressedInteractionPatterns.push({
            contractName: contract.name,
            functionName,
            sourcePath: model.sourcePathByNode.get(fn) ?? null,
            line: lineForOffset(sources[model.sourcePathByNode.get(fn) ?? ""] ?? "", parseSrc(fn.src).start),
            ...boundedContext,
          });
        } else {
          add("reentrancy_state_after_call", fn, detailBase);
        }
      }
    }
  }

  for (const pair of storageComparisonPairs) {
    const baseline = layouts.get(pair.baselineContract);
    const candidate = layouts.get(pair.candidateContract);
    if (!baseline || !candidate) throw new Error(`storage_pair_contract_missing:${pair.baselineContract}:${pair.candidateContract}`);
    const comparison = storageLayoutCompatible(baseline, candidate);
    if (!comparison.compatible) add("storage_layout_collision", null, { sourcePath: candidate.sourcePath, contractName: candidate.contractName, functionName: null, comparison, baselineContract: pair.baselineContract, candidateContract: pair.candidateContract });
  }

  findings.sort((a, b) => `${a.signalId}|${a.sourcePath ?? ""}|${a.line ?? 0}|${a.contractName ?? ""}|${a.functionName ?? ""}`.localeCompare(`${b.signalId}|${b.sourcePath ?? ""}|${b.line ?? 0}|${b.contractName ?? ""}|${b.functionName ?? ""}`));
  const compilerContracts = [...layouts.values()].map((row) => ({
    sourcePath: row.sourcePath,
    contractName: row.contractName,
    storageEntries: row.storageLayout?.storage?.length ?? 0,
    storageLayoutSha256: row.storageLayout ? sha256(stable(row.storageLayout)) : null,
    irSha256: typeof row.ir === "string" ? sha256(row.ir) : null,
    irAvailable: typeof row.ir === "string" && row.ir.length > 0,
  })).sort((a, b) => `${a.sourcePath}|${a.contractName}`.localeCompare(`${b.sourcePath}|${b.contractName}`));
  const sourceBundleSha256 = sha256(stable(sourcePaths.map((sourcePath) => ({ sourcePath, sha256: sha256(sources[sourcePath]) }))));
  const compilerOutputBindingSha256 = sha256(stable({
    sourceAsts: sourcePaths.map((sourcePath) => ({ sourcePath, astSha256: sha256(stable(compilerOutput.sources[sourcePath].ast)) })),
    contracts: compilerContracts,
  }));
  const signalCounts = Object.fromEntries(Object.keys(COMPILER_AST_SIGNAL_CATALOG).map((id) => [id, findings.filter((row) => row.signalId === id).length]));
  return {
    schemaVersion: "velmere.pass36.solidity-compiler-ast-generalization.v1",
    analyzerClass: COMPILER_AST_ANALYZER_CLASS,
    compilerVersionExpected: expectedCompilerVersion,
    sourceFiles: sourcePaths.length,
    contracts: compilerContracts.length,
    sourceBundleSha256,
    compilerOutputBindingSha256,
    findings: findings.map(({ key, ...row }) => row),
    signals: [...new Set(findings.map((row) => row.signalId))].sort(),
    signalCounts,
    compilerContracts,
    analyzerRevision: "R44P45_CONTEXT_QUALIFIED_INTERACTION_ORDERING_V3",
    suppressedInteractionPatterns: suppressedInteractionPatterns.sort((left, right) => `${left.sourcePath ?? ""}|${left.functionName ?? ""}|${left.patternId}`.localeCompare(`${right.sourcePath ?? ""}|${right.functionName ?? ""}|${right.patternId}`)),
    localCompilerAstCredit: true,
    realProtocolAccuracyCredit: false,
    independentGroundTruthCredit: false,
    customerCredit: false,
    paidSaleCredit: false,
    liveCredit: false,
    limitations: [
      "Compiler-backed AST/storage-layout/IR review layer for bounded signal families; not a complete path-feasibility or business-logic proof.",
      "No independent labels, real deployed protocol corpus, exploit reproduction or qualified human adjudication is granted by this result.",
    ],
  };
}

export function verifyCompilerAstAnalysisShape(value) {
  return Boolean(value
    && value.schemaVersion === "velmere.pass36.solidity-compiler-ast-generalization.v1"
    && value.analyzerClass === COMPILER_AST_ANALYZER_CLASS
    && HEX64.test(String(value.sourceBundleSha256 ?? ""))
    && HEX64.test(String(value.compilerOutputBindingSha256 ?? ""))
    && Array.isArray(value.findings)
    && value.localCompilerAstCredit === true
    && value.realProtocolAccuracyCredit === false
    && value.paidSaleCredit === false
    && value.liveCredit === false);
}
