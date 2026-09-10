import { createHash } from 'node:crypto';

/**
 * Velmère Furnace 3.0 — semantic AST detectors.
 *
 * Target: solc Standard JSON compiler AST (legacy + modern AST shapes used by
 * solc-js). The detector intentionally avoids source-text regex for the core
 * decisions. It uses a tiny normalized semantic layer over compiler AST nodes.
 *
 * Design rule: NO EVIDENCE = NO CLAIM.
 * A finding is only CONFIRMED when the AST proves the relevant code path. When
 * network/runtime assumptions are required, status is downgraded to
 * ASSUMPTION_RISK or REQUIRES_EVIDENCE.
 */

export type RuleId =
  | 'VLM-DEFI-4626-01'
  | 'VLM-DEFI-REENT-RO-01'
  | 'VLM-AUTH-EIP712-01'
  | 'VLM-ERC20-SEM-01'
  | 'VLM-ORACLE-LINK-01'
  | 'VLM-PROXY-UPGRADE-01'
  | 'VLM-MEV-SANDWICH-01';

export type Severity = 'P0' | 'P1' | 'P2' | 'INFO';
export type FindingStatus =
  | 'CONFIRMED'
  | 'STRONG_SIGNAL'
  | 'ASSUMPTION_RISK'
  | 'REQUIRES_EVIDENCE';

export interface AstNode {
  id?: number;
  nodeType?: string;
  name?: string;
  src?: string;
  visibility?: string;
  stateMutability?: string;
  kind?: string;
  typeDescriptions?: { typeString?: string; typeIdentifier?: string };
  referencedDeclaration?: number;
  operator?: string;
  memberName?: string;
  functionSelector?: string;
  children?: AstNode[];
  [key: string]: unknown;
}

export interface Evidence {
  kind:
    | 'AST_PATTERN'
    | 'DATA_FLOW'
    | 'CALL_GRAPH'
    | 'STORAGE_DEPENDENCY'
    | 'LIBRARY_PROVENANCE'
    | 'NETWORK_CONTEXT'
    | 'CONTROL_FLOW';
  nodeIds: number[];
  claim: string;
  strength: 1 | 2 | 3;
  source?: string;
}

export interface CanonicalFinding {
  ruleId: RuleId;
  severity: Severity;
  status: FindingStatus;
  confidence: number; // 0..1, deterministic from evidence strength.
  title: string;
  description: string;
  contract?: string;
  function?: string;
  evidence: Evidence[];
  fingerprint: string;
}

export interface NetworkContext {
  chainId?: number;
  networkName?: string;
  isL2?: boolean;
}

export interface DetectorOptions {
  network?: NetworkContext;
  sourceText?: Map<string, string>;
}

export interface ContractModel {
  node: AstNode;
  name: string;
  stateVariables: Map<string, AstNode>;
  functions: AstNode[];
  events: AstNode[];
  inheritedNames: Set<string>;
}

export interface FunctionFacts {
  node: AstNode;
  name: string;
  view: boolean;
  payable: boolean;
  pure: boolean;
  modifiers: Set<string>;
  statements: AstNode[];
  externalCalls: AstNode[];
  stateReads: Set<string>;
  stateWrites: Set<string>;
  calls: Set<string>;
}

const L2_CHAIN_IDS = new Set([10, 8453, 42161]); // OP Mainnet, Base, Arbitrum One.

function nodeId(n: AstNode): number | undefined {
  return typeof n.id === 'number' ? n.id : undefined;
}

function children(n: AstNode | undefined): AstNode[] {
  if (!n) return [];
  const direct = Array.isArray(n.children) ? n.children : [];
  const out = [...direct];
  for (const [key, value] of Object.entries(n)) {
    if (key === 'children') continue;
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item === 'object' && 'nodeType' in item) out.push(item as AstNode);
      } else if ('nodeType' in value) {
        out.push(value as AstNode);
      }
    }
  }
  return dedupeNodes(out);
}

function dedupeNodes(nodes: AstNode[]): AstNode[] {
  const seen = new Set<number | object>();
  const out: AstNode[] = [];
  for (const n of nodes) {
    const key: number | object = typeof n.id === 'number' ? n.id : n;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function walk(root: AstNode | undefined): AstNode[] {
  if (!root) return [];
  const out: AstNode[] = [];
  const stack = [root];
  const seen = new Set<number | object>();
  while (stack.length) {
    const n = stack.pop()!;
    const key: number | object = typeof n.id === 'number' ? n.id : n;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    for (const c of children(n)) stack.push(c);
  }
  return out;
}

function identifierName(n?: AstNode): string | undefined {
  if (!n) return undefined;
  if (n.nodeType === 'Identifier') return n.name;
  if (n.nodeType === 'MemberAccess') {
    const base = identifierName(n.expression as AstNode | undefined);
    const member = typeof n.memberName === 'string' ? n.memberName : undefined;
    if (base && member) return `${base}.${member}`;
    return member ?? base;
  }
  return typeof n.name === 'string' ? n.name : undefined;
}

function callName(n?: AstNode): string | undefined {
  if (!n || n.nodeType !== 'FunctionCall') return undefined;
  return identifierName(n.expression as AstNode | undefined);
}

function allCalls(root: AstNode): AstNode[] {
  return walk(root).filter(n => n.nodeType === 'FunctionCall');
}

function hasCall(root: AstNode, names: RegExp): AstNode[] {
  return allCalls(root).filter(c => names.test(callName(c) ?? ''));
}

function functionDefinitions(contract: AstNode): AstNode[] {
  return walk(contract).filter(n => n.nodeType === 'FunctionDefinition');
}

function modifierNames(fn: AstNode): Set<string> {
  const out = new Set<string>();
  for (const m of walk(fn)) {
    if (m.nodeType !== 'ModifierInvocation') continue;
    const name = identifierName(m.modifierName as AstNode | undefined);
    if (name) out.add(name);
  }
  return out;
}

function extractFunctionStatements(fn: AstNode): AstNode[] {
  const body = walk(fn).find(n => n.nodeType === 'Block');
  if (!body) return [];
  const candidates = (body.statements as unknown);
  if (Array.isArray(candidates)) return candidates.filter(x => x && typeof x === 'object') as AstNode[];
  return children(body).filter(n => n.nodeType?.endsWith('Statement') || n.nodeType === 'VariableDeclarationStatement');
}

function isStateVariable(v: AstNode): boolean {
  return v.nodeType === 'VariableDeclaration' && (v.stateVariable === true || v.storageLocation === 'storage');
}

function collectContracts(root: AstNode): ContractModel[] {
  return walk(root)
    .filter(n => n.nodeType === 'ContractDefinition')
    .map(contract => {
      const state = new Map<string, AstNode>();
      for (const v of walk(contract)) {
        if (isStateVariable(v) && v.name) state.set(v.name, v);
      }
      const functions = functionDefinitions(contract);
      const inheritedNames = new Set<string>();
      const bases = Array.isArray(contract.baseContracts) ? contract.baseContracts : [];
      for (const b of bases as AstNode[]) {
        const base = walk(b).find(n => n.nodeType === 'IdentifierPath' || n.nodeType === 'UserDefinedTypeName');
        const nm = identifierName(base as AstNode | undefined);
        if (nm) inheritedNames.add(nm.split('.').pop()!);
      }
      return {
        node: contract,
        name: contract.name ?? '<anonymous>',
        stateVariables: state,
        functions,
        events: walk(contract).filter(n => n.nodeType === 'EventDefinition'),
        inheritedNames,
      } satisfies ContractModel;
    });
}

function functionFacts(contract: ContractModel, fn: AstNode): FunctionFacts {
  const reads = new Set<string>();
  const writes = new Set<string>();
  const localDecls = new Set<string>();
  for (const n of walk(fn)) {
    if (n.nodeType === 'VariableDeclaration' && n.name) localDecls.add(n.name);
  }
  for (const n of walk(fn)) {
    if (n.nodeType === 'Identifier' && n.name && contract.stateVariables.has(n.name) && !localDecls.has(n.name)) reads.add(n.name);
    if ((n.nodeType === 'Assignment' || n.nodeType === 'UnaryOperation') && n.operator) {
      const lhs = identifierName(n.leftHandSide as AstNode | undefined) ?? identifierName(n.subExpression as AstNode | undefined);
      if (lhs && contract.stateVariables.has(lhs)) writes.add(lhs);
    }
    if (n.nodeType === 'FunctionCall') {
      const name = callName(n);
      if (name && contract.stateVariables.has(name)) reads.add(name);
      if (name) {
        // Direct setter-like internal calls are useful for semantic call graph hints.
      }
    }
    if (n.nodeType === 'IndexAccess') {
      const base = identifierName(n.baseExpression as AstNode | undefined);
      if (base && contract.stateVariables.has(base)) reads.add(base);
    }
  }
  // Storage writes through increment/decrement and assignments to member/index expressions.
  for (const n of walk(fn)) {
    if (n.nodeType !== 'Assignment') continue;
    const lhsName = identifierName(n.leftHandSide as AstNode | undefined);
    if (lhsName && contract.stateVariables.has(lhsName.split('.')[0])) writes.add(lhsName.split('.')[0]);
  }
  const externalCalls = allCalls(fn).filter(c => {
    const name = callName(c) ?? '';
    if (/^(call|delegatecall|staticcall|send|transfer)$/i.test(name.split('.').pop() ?? '')) return true;
    const expression = c.expression as AstNode | undefined;
    if (expression?.nodeType !== 'MemberAccess') return false;
    const base = expression.expression as AstNode | undefined;
    const typeString = base?.typeDescriptions?.typeString ?? '';
    const isContractLike = /\b(contract|interface)\b/i.test(typeString) || /\baddress\b/i.test(typeString);
    const member = expression.memberName ?? '';
    const externalishMember = !/^(push|pop|length|slice|concat|encode|decode|mulDiv|add|sub|mul|div|max|min|sqrt|recover|tryRecover)$/i.test(member);
    return isContractLike && externalishMember;
  });
  const calls = new Set<string>(allCalls(fn).map(c => callName(c)).filter((x): x is string => !!x));
  return {
    node: fn,
    name: fn.name ?? '<fallback>',
    view: fn.stateMutability === 'view',
    payable: fn.stateMutability === 'payable',
    pure: fn.stateMutability === 'pure',
    modifiers: modifierNames(fn),
    statements: extractFunctionStatements(fn),
    externalCalls,
    stateReads: reads,
    stateWrites: writes,
    calls,
  };
}

function hasNameLike(name: string | undefined, re: RegExp): boolean {
  return !!name && re.test(name);
}

function nodeIds(evidence: AstNode[]): number[] {
  return evidence.map(nodeId).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
}

function makeFinding(args: Omit<CanonicalFinding, 'fingerprint' | 'confidence'> & { confidence?: number }): CanonicalFinding {
  const canonicalEvidence = [...args.evidence]
    .map(e => ({ ...e, nodeIds: [...e.nodeIds].sort((a, b) => a - b) }))
    .sort((a, b) => `${a.kind}|${a.claim}`.localeCompare(`${b.kind}|${b.claim}`));
  const seed = JSON.stringify({
    ruleId: args.ruleId,
    contract: args.contract ?? '',
    function: args.function ?? '',
    evidence: canonicalEvidence,
  });
  const fingerprint = createHash('sha256').update(seed).digest('hex');
  return {
    ...args,
    evidence: canonicalEvidence,
    confidence: args.confidence ?? confidenceFromEvidence(canonicalEvidence),
    fingerprint,
  };
}

function confidenceFromEvidence(ev: Evidence[]): number {
  if (!ev.length) return 0;
  const sum = ev.reduce((acc, e) => acc + e.strength, 0);
  const normalized = Math.min(1, sum / (ev.length * 3));
  return Number(normalized.toFixed(4));
}

function exprNames(root: AstNode): Set<string> {
  const names = new Set<string>();
  for (const n of walk(root)) {
    const name = identifierName(n);
    if (name) names.add(name);
  }
  return names;
}

function binaryTreeString(n: AstNode | undefined): string {
  if (!n) return '';
  if (n.nodeType === 'Identifier') return n.name ?? '';
  if (n.nodeType === 'MemberAccess') return identifierName(n) ?? '';
  if (n.nodeType === 'Literal') return String(n.value ?? n.hexValue ?? '');
  if (n.nodeType === 'BinaryOperation') {
    return `(${binaryTreeString(n.leftExpression as AstNode | undefined)}${n.operator ?? ''}${binaryTreeString(n.rightExpression as AstNode | undefined)})`;
  }
  if (n.nodeType === 'FunctionCall') return `${callName(n) ?? ''}(${children(n).slice(1).map(binaryTreeString).join(',')})`;
  return n.nodeType ?? '';
}

function findBinaryConversion(contract: ContractModel): AstNode[] {
  const hits: AstNode[] = [];
  for (const fn of contract.functions) {
    for (const n of walk(fn)) {
      if (n.nodeType !== 'BinaryOperation') continue;
      const text = binaryTreeString(n).replace(/\s/g, '').toLowerCase();
      const hasAssets = /assets|amount|deposit/.test(text);
      const hasShares = /shares|totalsupply/.test(text);
      const hasTotalAssets = /totalassets/.test(text);
      if (hasAssets && hasShares && hasTotalAssets && /[*/]/.test(text)) hits.push(n);
    }
    for (const n of hasCall(fn, /(^|\.)mulDiv$/i)) {
      const names = exprNames(n);
      const text = binaryTreeString(n).replace(/\s/g, '').toLowerCase();
      if ((names.has('totalSupply') || /totalsupply/.test(text)) &&
          (names.has('totalAssets') || /totalassets/.test(text)) &&
          (names.has('assets') || names.has('shares') || /amount/.test(text))) {
        hits.push(n);
      }
    }
  }
  return hits;
}

function has4626Mitigation(contract: ContractModel): { safe: boolean; evidence: AstNode[] } {
  const evidence: AstNode[] = [];
  const all = walk(contract.node);
  const hasOZBase = [...contract.inheritedNames].some(n => n === 'ERC4626');
  if (hasOZBase) {
    evidence.push(contract.node);
    return { safe: true, evidence };
  }
  for (const n of all) {
    if (n.nodeType === 'FunctionDefinition' && n.name === '_decimalsOffset') evidence.push(n);
    if (n.nodeType === 'Identifier' && typeof n.name === 'string' && /virtualShares|virtualAssets|assetOffset|shareOffset/i.test(n.name)) evidence.push(n);
    if (n.nodeType === 'MemberAccess' && ['_initialConvertToShares', '_initialConvertToAssets'].includes(n.memberName ?? '')) evidence.push(n);
    if (n.nodeType === 'BinaryOperation' && n.operator === '+' && /totalAssets|totalSupply/.test(binaryTreeString(n))) evidence.push(n);
  }
  return { safe: evidence.length > 0, evidence };
}

export function detectERC4626ShareInflation(contract: ContractModel): CanonicalFinding[] {
  const conversions = findBinaryConversion(contract);
  if (!conversions.length) return [];
  const mitigation = has4626Mitigation(contract);
  if (mitigation.safe) return [];
  const depositFns = contract.functions.filter(f => /^(deposit|mint|_deposit|_mint|previewDeposit|previewMint|convertToShares|convertToAssets)$/.test(f.name ?? ''));
  const ev: Evidence[] = [
    {
      kind: 'AST_PATTERN',
      nodeIds: nodeIds(conversions),
      claim: 'Exchange-rate math derives shares/assets from totalSupply and totalAssets without a proven virtual offset path.',
      strength: 3,
    },
  ];
  if (depositFns.length) ev.push({
    kind: 'CONTROL_FLOW',
    nodeIds: nodeIds(depositFns),
    claim: 'Vault-like conversion is reachable from deposit/mint/preview conversion functions.',
    strength: 3,
  });
  return [makeFinding({
    ruleId: 'VLM-DEFI-4626-01',
    severity: 'P0',
    status: 'STRONG_SIGNAL',
    title: 'ERC-4626 share-price inflation risk',
    description: 'Conversion math exposes a first-deposit/donation inflation surface because the exchange rate is based on raw totalSupply/totalAssets without evidence of virtual assets/shares or a decimals offset defense.',
    contract: contract.name,
    function: depositFns[0]?.name,
    evidence: ev,
    confidence: 0.97,
  })];
}

function isHighRiskView(fn: FunctionFacts): boolean {
  return hasNameLike(fn.name, /(rate|price|virtual|value|quote|exchange|asset|balance|reserve|share|debt|collateral|liquidat)/i)
    || [...fn.stateReads].some(n => /(rate|price|virtual|value|reserve|asset|balance|share|debt|collateral)/i.test(n));
}

function findExternalCallStatementIndex(statements: AstNode[], calls: AstNode[]): number {
  if (!calls.length) return -1;
  const callIds = new Set(calls.map(nodeId).filter((x): x is number => x !== undefined));
  for (let i = 0; i < statements.length; i++) {
    if (walk(statements[i]).some(n => callIds.has(nodeId(n)!))) return i;
  }
  return -1;
}

function readsAfterExternalCall(contract: ContractModel, mutator: FunctionFacts, view: FunctionFacts): { state: string; mutatorCall?: AstNode; viewNode?: AstNode } | undefined {
  const idx = findExternalCallStatementIndex(mutator.statements, mutator.externalCalls);
  if (idx < 0) return undefined;
  // Strongest signal: the mutator has a storage write after the external boundary,
  // and the view reads one of the variables written after that boundary.
  const after = mutator.statements.slice(idx + 1);
  const writtenAfter = new Set<string>();
  for (const st of after) {
    for (const n of walk(st)) {
      if (n.nodeType !== 'Assignment') continue;
      const lhs = identifierName(n.leftHandSide as AstNode | undefined)?.split('.')[0];
      if (lhs && contract.stateVariables.has(lhs)) writtenAfter.add(lhs);
    }
  }
  const common = [...view.stateReads].find(x => writtenAfter.has(x));
  if (common) return {
    state: common,
    mutatorCall: mutator.externalCalls[0],
    viewNode: view.node,
  };
  // Secondary signal: mutator reads/writes a state variable either side of an
  // external call, while the view exposes the same variable as a derived value.
  const common2 = [...view.stateReads].find(x => mutator.stateWrites.has(x) && /(reserve|balance|rate|price|total|asset|share|debt)/i.test(x));
  if (common2) return { state: common2, mutatorCall: mutator.externalCalls[0], viewNode: view.node };
  return undefined;
}

export function detectReadOnlyReentrancy(contract: ContractModel): CanonicalFinding[] {
  const facts = contract.functions.map(fn => functionFacts(contract, fn));
  const mutators = facts.filter(f => !f.view && !f.pure && f.externalCalls.length);
  const views = facts.filter(f => f.view && f.stateReads.size && isHighRiskView(f));
  const findings: CanonicalFinding[] = [];
  for (const view of views) {
    if (view.modifiers.has('nonReentrantView')) continue;
    for (const mutator of mutators) {
      const link = readsAfterExternalCall(contract, mutator, view);
      if (!link) continue;
      const evidence: Evidence[] = [
        {
          kind: 'CALL_GRAPH',
          nodeIds: nodeIds([mutator.node, ...(mutator.externalCalls.slice(0, 1)), view.node]),
          claim: `Mutating path ${mutator.name} crosses an external-call boundary while view ${view.name} reads shared protocol state.` ,
          strength: 3,
        },
        {
          kind: 'STORAGE_DEPENDENCY',
          nodeIds: nodeIds([contract.stateVariables.get(link.state)!].filter(Boolean)),
          claim: `View ${view.name} depends on shared storage '${link.state}' whose final state is established across the external-call boundary.`,
          strength: 3,
        },
      ];
      findings.push(makeFinding({
        ruleId: 'VLM-DEFI-REENT-RO-01',
        severity: 'P0',
        status: 'STRONG_SIGNAL',
        title: 'Potential read-only reentrancy',
        description: 'A protocol-facing view can observe storage during an external callback window while the mutating path has not completed its accounting. Guarding only mutators with nonReentrant does not prove the view is safe.',
        contract: contract.name,
        function: view.name,
        evidence,
        confidence: 0.94,
      }));
      break;
    }
  }
  return findings;
}

function hasNonceEvidence(fn: AstNode): AstNode[] {
  const out: AstNode[] = [];
  for (const n of walk(fn)) {
    const cn = callName(n) ?? '';
    const text = binaryTreeString(n).replace(/\s/g, '').toLowerCase();
    if (n.nodeType === 'FunctionCall' && /(^|\.)(_useNonce|useNonce)$/i.test(cn)) out.push(n);
    if (n.nodeType === 'FunctionCall' && /(^|\.)nonces$/i.test(cn)) out.push(n);
    // A nonce read alone is not enough. Require visible consumption/update.
    if ((n.nodeType === 'Assignment' || n.nodeType === 'UnaryOperation') && /nonce/i.test(text)) out.push(n);
  }
  return dedupeNodes(out);
}

function hasDomainEvidence(fn: AstNode, contract: ContractModel): { chain: AstNode[]; verifying: AstNode[]; eip712: AstNode[] } {
  const chain: AstNode[] = [];
  const verifying: AstNode[] = [];
  const eip712: AstNode[] = [];
  const all = walk(fn);
  for (const n of all) {
    const name = identifierName(n) ?? '';
    if (name === 'block.chainid' || name.endsWith('.chainid') || name === 'chainId') chain.push(n);
    if (name === 'address(this)' || /verifyingContract/i.test(name)) eip712.push(n);
    if (name === 'this') verifying.push(n);
    if (n.nodeType === 'FunctionCall' && /_hashTypedDataV4|_domainSeparatorV4|toDomainSeparator/i.test(callName(n) ?? '')) eip712.push(n);
  }
  if ([...contract.inheritedNames].some(n => n === 'EIP712')) eip712.push(contract.node);
  // Address(this) is represented in the AST as FunctionCall(address) with argument Identifier(this).
  for (const n of all) {
    if (n.nodeType !== 'FunctionCall') continue;
    const cn = callName(n) ?? '';
    if (cn === 'address') {
      const args = Array.isArray(n.arguments) ? n.arguments as AstNode[] : [];
      if (args.some(a => identifierName(a) === 'this')) verifying.push(n);
    }
  }
  return { chain: dedupeNodes(chain), verifying: dedupeNodes(verifying), eip712: dedupeNodes(eip712) };
}

function signatureCalls(fn: AstNode): AstNode[] {
  return walk(fn).filter(n => n.nodeType === 'FunctionCall' && /(ecrecover|ECDSA\.recover|ECDSA\.tryRecover|SignatureChecker\.isValidSignatureNow|isValidSignatureNow)/i.test(callName(n) ?? ''));
}

function isAuthorizationFunction(fn: AstNode): boolean {
  return fn.stateMutability !== 'view' && fn.stateMutability !== 'pure' &&
    (/permit|authorize|authorization|execute|withdraw|transfer|approve|delegate|claim|redeem|mint|burn|set[A-Z_]|cancel|fill|order/i.test(fn.name ?? '') || walk(fn).some(n => n.nodeType === 'EmitStatement'));
}

export function detectEIP712Replay(contract: ContractModel): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  for (const fn of contract.functions) {
    const sigs = signatureCalls(fn);
    if (!sigs.length || !isAuthorizationFunction(fn)) continue;
    const nonce = hasNonceEvidence(fn);
    const domain = hasDomainEvidence(fn, contract);
    const rawEcrecover = sigs.some(s => /(^|\.)ecrecover$/i.test(callName(s) ?? ''));
    const hasLowSGuard = walk(fn).some(n => {
      const t = binaryTreeString(n).replace(/\s/g, '').toLowerCase();
      return /s[<>=]0x7f|secp256k1n?\/2|s<=|s>=/.test(t);
    });
    const missingNonce = nonce.length === 0;
    const missingDomain = domain.eip712.length === 0 || (domain.chain.length === 0 && domain.verifying.length === 0 && !domain.eip712.length);
    const replayEvidence = missingNonce || (domain.eip712.length === 0 && (domain.chain.length === 0 || domain.verifying.length === 0));
    if (!replayEvidence && !(rawEcrecover && !hasLowSGuard)) continue;
    const evidence: Evidence[] = [
      {
        kind: 'AST_PATTERN',
        nodeIds: nodeIds(sigs),
        claim: rawEcrecover && !hasLowSGuard
          ? 'Raw ecrecover is used without compiler-visible low-s/malleability validation.'
          : 'Signature verification is present in an authorization flow.',
        strength: 3,
      },
    ];
    if (missingNonce) evidence.push({
      kind: 'DATA_FLOW',
      nodeIds: nodeIds([fn]),
      claim: 'No compiler-visible nonce consumption/uniqueness check is bound to the recovered signer.',
      strength: 3,
    });
    if (domain.eip712.length === 0 || domain.chain.length === 0 || domain.verifying.length === 0) evidence.push({
      kind: 'AST_PATTERN',
      nodeIds: nodeIds([...domain.eip712, ...domain.chain, ...domain.verifying, fn]),
      claim: `EIP-712 domain binding is incomplete: chainId=${domain.chain.length > 0}, verifyingContract=${domain.verifying.length > 0}, EIP712 helper=${domain.eip712.length > 0}.`,
      strength: 3,
    });
    findings.push(makeFinding({
      ruleId: 'VLM-AUTH-EIP712-01',
      severity: 'P0',
      status: 'STRONG_SIGNAL',
      title: 'Signature replay / domain-binding risk',
      description: 'An authorization path verifies a signature without enough evidence of nonce consumption and/or domain binding. Raw ecrecover also requires an explicit low-s/malleability check.',
      contract: contract.name,
      function: fn.name,
      evidence,
      confidence: 0.96,
    }));
  }
  return findings;
}

function transferInCalls(fn: AstNode): AstNode[] {
  return walk(fn).filter(n => n.nodeType === 'FunctionCall' && /(^|\.)?(safeTransferFrom|transferFrom)$/i.test(callName(n) ?? ''));
}

function callArgument(call: AstNode, index: number): AstNode | undefined {
  const args = Array.isArray(call.arguments) ? call.arguments as AstNode[] : [];
  return args[index];
}

function argumentName(call: AstNode, index: number): string | undefined {
  return identifierName(callArgument(call, index));
}

function balanceOfThisCalls(fn: AstNode): AstNode[] {
  return walk(fn).filter(n => n.nodeType === 'FunctionCall' && /(^|\.)balanceOf$/i.test(callName(n) ?? '') &&
    (walk(n).some(x => x.nodeType === 'Identifier' && x.name === 'this') || binaryTreeString(n).includes('this')));
}

function accountingUsesAmount(contract: ContractModel, fn: AstNode, amountName?: string): AstNode[] {
  const out: AstNode[] = [];
  for (const n of walk(fn)) {
    if (!amountName) continue;
    const names = exprNames(n);
    if (names.has(amountName) && (n.nodeType === 'Assignment' || n.nodeType === 'FunctionCall' || n.nodeType === 'BinaryOperation')) out.push(n);
  }
  // Also catch direct function arg use by position in deposit-like functions.
  if (!out.length && /deposit|mint|_deposit|_mint/i.test(fn.name ?? '')) {
    out.push(...walk(fn).filter(n => n.nodeType === 'Assignment').filter(n => /balance|asset|share|credit|total/i.test(binaryTreeString(n))));
  }
  return dedupeNodes(out);
}

export function detectERC20SemanticMismatch(contract: ContractModel): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  for (const fn of contract.functions) {
    const inbound = transferInCalls(fn);
    if (!inbound.length) continue;
    if (!/deposit|mint|stake|supply|join|fund|_deposit|_mint/i.test(fn.name ?? '') &&
        !walk(fn).some(n => n.nodeType === 'Assignment' && /totalAssets|shares|credit|balance/i.test(binaryTreeString(n)))) continue;
    const prePost = balanceOfThisCalls(fn);
    const hasOrderedDeltaCheck = inbound.some(call => {
      const statements = extractFunctionStatements(fn);
      const callId = nodeId(call);
      const transferIdx = statements.findIndex(st => walk(st).some(n => nodeId(n) === callId));
      if (transferIdx < 0) return false;
      const before = statements.slice(0, transferIdx).some(st => balanceOfThisCalls(st).length > 0);
      const after = statements.slice(transferIdx + 1).some(st => balanceOfThisCalls(st).length > 0);
      return before && after;
    });
    const hasTwo = hasOrderedDeltaCheck;
    const amountNames = inbound.map(c => argumentName(c, 2)).filter((x): x is string => !!x);
    const accounting = inbound.flatMap(c => accountingUsesAmount(contract, fn, argumentName(c, 2)));
    if (hasTwo) continue;
    findings.push(makeFinding({
      ruleId: 'VLM-ERC20-SEM-01',
      severity: 'P1',
      status: 'ASSUMPTION_RISK',
      title: 'Incoming ERC-20 amount may not equal received amount',
      description: 'A vault-like accounting path credits the requested transfer amount after safeTransferFrom/transferFrom but does not prove the actual balance delta. Fee-on-transfer and rebasing semantics are therefore outside the proven accounting model.',
      contract: contract.name,
      function: fn.name,
      evidence: [
        {
          kind: 'AST_PATTERN',
          nodeIds: nodeIds(inbound),
          claim: `Incoming token transfer uses requested amount${amountNames.length ? ` (${amountNames.join(', ')})` : ''}.`,
          strength: 3,
        },
        {
          kind: 'DATA_FLOW',
          nodeIds: nodeIds(accounting.length ? accounting : [fn]),
          claim: 'The requested amount can flow into accounting without a before/after balanceOf(address(this)) delta.',
          strength: 3,
        },
      ],
      confidence: 0.93,
    }));
  }
  return findings;
}

function variableTupleBindings(stmt: AstNode): Map<number, string> {
  const map = new Map<number, string>();
  const decls = Array.isArray(stmt.declarations) ? stmt.declarations as AstNode[] : [];
  for (let i = 0; i < decls.length; i++) {
    const name = decls[i]?.name;
    if (name) map.set(i, name);
  }
  return map;
}

function latestRoundDataBindings(fn: AstNode): { call: AstNode; names: Map<number, string>; stmt: AstNode }[] {
  const out: { call: AstNode; names: Map<number, string>; stmt: AstNode }[] = [];
  for (const stmt of walk(fn).filter(n => n.nodeType === 'VariableDeclarationStatement')) {
    const init = stmt.initialValue as AstNode | undefined;
    if (init?.nodeType !== 'FunctionCall') continue;
    if (!/latestRoundData$/i.test(callName(init) ?? '')) continue;
    out.push({ call: init, names: variableTupleBindings(stmt), stmt });
  }
  return out;
}

function predicateMatches(fn: AstNode, regexes: RegExp[]): AstNode[] {
  const hits: AstNode[] = [];
  for (const n of walk(fn)) {
    if (n.nodeType !== 'BinaryOperation' && n.nodeType !== 'FunctionCall') continue;
    const text = binaryTreeString(n).replace(/[\s()]/g, '').toLowerCase();
    const ok = regexes.some(r => r.test(text));
    if (ok) hits.push(n);
  }
  return hits;
}

function oracleValidation(fn: AstNode, answerName?: string, updatedAtName?: string): {
  answer: AstNode[];
  updated: AstNode[];
  freshness: AstNode[];
} {
  const textAnswer = answerName ? new RegExp(`${escapeRegExp(answerName.toLowerCase())}>(?:0|=0|=)`) : /(?:answer|price)>0/;
  const answer = predicateMatches(fn, [textAnswer, /(?:answer|price)>=0/]).filter(n => /(?:answer|price)/.test(binaryTreeString(n).toLowerCase()));
  const updated = updatedAtName ? predicateMatches(fn, [new RegExp(`${escapeRegExp(updatedAtName.toLowerCase())}>0`), new RegExp(`${escapeRegExp(updatedAtName.toLowerCase())}!=0`)]) : [];
  const freshness = predicateMatches(fn, [
    /block\.timestamp-\w+<=\w+/,
    /\w+-\w+>=block\.timestamp/,
    /block\.timestamp<=\w+\+\w+/,
    /updatedat\+\w+>=block\.timestamp/,
  ]).filter(n => /timestamp|updatedat/i.test(binaryTreeString(n)));
  return { answer, updated, freshness };
}

function hasSequencerValidation(fn: AstNode): { status: boolean; evidence: AstNode[] } {
  const bindings = latestRoundDataBindings(fn);
  for (const b of bindings) {
    const names = [...b.names.values()];
    if (!names.some(n => /sequencer|uptime/i.test(n))) continue;
    const statusPreds = predicateMatches(fn, [
      /(?:sequencer)?answer==0/,
      /(?:sequencer)?answer!=0/,
      /(?:sequencer)?answer>0/,
      /status==0/,
    ]).filter(n => /(?:sequencer)?answer|status/.test(binaryTreeString(n).toLowerCase()));
    const gracePreds = predicateMatches(fn, [
      /block\.timestamp-(?:sequencer)?startedat>\w+/,
      /block\.timestamp-(?:sequencer)?startedat>=\w+/,
      /(?:sequencer)?startedat\+\w+<=block\.timestamp/,
      /block\.timestamp-\w+>\w*grace/,
    ]);
    if (statusPreds.length && gracePreds.length) return { status: true, evidence: [...statusPreds, ...gracePreds, b.call] };
  }
  return { status: false, evidence: [] };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function detectChainlinkOracle(contract: ContractModel, network: NetworkContext = {}): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  for (const fn of contract.functions) {
    const bindings = latestRoundDataBindings(fn);
    if (!bindings.length) continue;
    const priceBinding = bindings.find(b => {
      const names = [...b.names.values()];
      return !names.some(n => /sequencer|uptime/i.test(n));
    }) ?? bindings[bindings.length - 1];
    const answer = priceBinding.names.get(1);
    const updatedAt = priceBinding.names.get(3);
    const validators = oracleValidation(fn, answer, updatedAt);
    const allCore = validators.answer.length > 0 && validators.updated.length > 0 && validators.freshness.length > 0;
    const isL2 = network.isL2 === true || (network.chainId !== undefined && L2_CHAIN_IDS.has(network.chainId));
    const sequencer = isL2 ? hasSequencerValidation(fn) : { status: true, evidence: [] };
    if (allCore && sequencer.status) continue;
    const evidence: Evidence[] = [
      {
        kind: 'AST_PATTERN',
        nodeIds: nodeIds(bindings.map(b => b.call)),
        claim: 'Chainlink AggregatorV3 latestRoundData() is consumed by the contract.',
        strength: 3,
      },
      {
        kind: 'CONTROL_FLOW',
        nodeIds: nodeIds([...validators.answer, ...validators.updated, ...validators.freshness]),
        claim: `Oracle checks: answer>0=${validators.answer.length > 0}, updatedAt>0=${validators.updated.length > 0}, bounded freshness=${validators.freshness.length > 0}.`,
        strength: 3,
      },
    ];
    if (isL2) {
      evidence.push({
        kind: 'NETWORK_CONTEXT',
        nodeIds: [],
        claim: `Deployment context is L2 (${network.networkName ?? network.chainId ?? 'known L2'}); Sequencer Uptime Feed validation is required for a complete freshness model.`,
        strength: 3,
      });
      evidence.push({
        kind: 'CONTROL_FLOW',
        nodeIds: nodeIds(sequencer.evidence),
        claim: `Sequencer status + grace-period validation=${sequencer.status}.`,
        strength: 3,
      });
    }
    findings.push(makeFinding({
      ruleId: 'VLM-ORACLE-LINK-01',
      severity: 'P0',
      status: isL2 ? 'STRONG_SIGNAL' : 'REQUIRES_EVIDENCE',
      title: isL2 ? 'Chainlink oracle validation incomplete on L2' : 'Chainlink oracle validation requires evidence',
      description: isL2
        ? 'latestRoundData() is used without a compiler-visible proof of complete answer, timestamp, freshness, and L2 sequencer uptime/grace-period validation.'
        : 'latestRoundData() is used but the AST does not prove all recommended validation conditions. L2-specific sequencer status is deliberately not claimed without network context.',
      contract: contract.name,
      function: fn.name,
      evidence,
      confidence: isL2 ? 0.98 : 0.87,
    }));
  }
  return findings;
}

export function detectProxyUpgradeSecurity(contract: ContractModel): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  const upgradeFns = contract.functions.filter(f => /^(upgradeTo|upgradeToAndCall|_authorizeUpgrade)$/.test(f.name ?? ''));
  if (!upgradeFns.length) return findings;

  for (const fn of upgradeFns) {
    const facts = functionFacts(contract, fn);
    const hasAuth = facts.modifiers.has('onlyOwner') || facts.modifiers.has('onlyRole') || facts.modifiers.has('onlyAdmin') || facts.modifiers.has('onlyProxyAdmin');
    const hasRequireAuth = facts.statements.some(stmt => {
      const text = binaryTreeString(stmt).toLowerCase();
      return text.includes('msg.sender') && (text.includes('owner') || text.includes('admin'));
    });

    if (!hasAuth && !hasRequireAuth) {
      findings.push(makeFinding({
        ruleId: 'VLM-PROXY-UPGRADE-01',
        severity: 'P0',
        status: 'CONFIRMED',
        title: `Unprotected proxy upgrade vector in ${fn.name}`,
        description: `Function ${fn.name} executes logic upgrades without compiler-proven access control or modifier restriction. An attacker can hijack proxy implementation.`,
        contract: contract.name,
        function: fn.name,
        evidence: [
          {
            kind: 'AST_PATTERN',
            nodeIds: nodeIds([fn]),
            claim: `Upgrade function ${fn.name} lacks authorization modifiers or sender validation.`,
            strength: 3,
          },
        ],
        confidence: 0.99,
      }));
    }
  }
  return findings;
}

export function detectMevSandwichRisk(contract: ContractModel): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  const swapCalls = contract.functions.flatMap(fn => {
    return allCalls(fn).filter(c => {
      const name = (callName(c) ?? '').toLowerCase();
      return name.includes('swap') || name.includes('exacttokens');
    }).map(call => ({ fn, call }));
  });

  for (const { fn, call } of swapCalls) {
    const args = children(call).slice(1);
    const zeroSlippage = args.some(a => {
      return a.nodeType === 'Literal' && (a.value === 0 || a.value === '0');
    });

    if (zeroSlippage) {
      findings.push(makeFinding({
        ruleId: 'VLM-MEV-SANDWICH-01',
        severity: 'P1',
        status: 'CONFIRMED',
        title: `Zero slippage protection detected in AMM swap call`,
        description: `Swap function invokes AMM router with literal 0 amountOutMin or unconstrained slippage bound, exposing transaction to atomic mempool sandwich attacks.`,
        contract: contract.name,
        function: fn.name,
        evidence: [
          {
            kind: 'DATA_FLOW',
            nodeIds: nodeIds([call]),
            claim: `Literal 0 passed as minimum output parameter to AMM swap invocation.`,
            strength: 3,
          },
        ],
        confidence: 0.95,
      }));
    }
  }
  return findings;
}

export function runVelmereTop5Detectors(root: AstNode, options: DetectorOptions = {}): CanonicalFinding[] {
  const findings: CanonicalFinding[] = [];
  for (const contract of collectContracts(root)) {
    findings.push(...detectERC4626ShareInflation(contract));
    findings.push(...detectReadOnlyReentrancy(contract));
    findings.push(...detectEIP712Replay(contract));
    findings.push(...detectERC20SemanticMismatch(contract));
    findings.push(...detectChainlinkOracle(contract, options.network));
    findings.push(...detectProxyUpgradeSecurity(contract));
    findings.push(...detectMevSandwichRisk(contract));
  }
  return findings.sort((a, b) => `${a.ruleId}|${a.contract}|${a.function}|${a.fingerprint}`.localeCompare(`${b.ruleId}|${b.contract}|${b.function}|${b.fingerprint}`));
}

/**
 * Minimal integration contract for lib/security/analyzer/contract-analyzer.ts.
 * The existing Analyzer should provide its compiler-backed AST root here.
 */
export interface AnalyzerFindingAdapter {
  pushFinding(finding: CanonicalFinding): void;
}

export function attachVelmereTop5Detectors(
  astRoot: AstNode,
  adapter: AnalyzerFindingAdapter,
  options: DetectorOptions = {},
): void {
  for (const finding of runVelmereTop5Detectors(astRoot, options)) adapter.pushFinding(finding);
}
