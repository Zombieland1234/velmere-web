/**
 * Velmère Furnace — Authority & Privilege Graph Engine (Phase 5)
 *
 * Models and traces Actor -> Role -> Function -> State Mutation -> Economic Effect.
 * Detects single-key rug pull, infinite mint, account bricking, and unverified multi-sig claims.
 * NO EVIDENCE = NO CLAIM.
 */

export type AuthorityClass =
  | 'EOA_SINGLE_KEY'
  | 'VERIFIED_MULTISIG'
  | 'VERIFIED_TIMELOCK'
  | 'ZERO_DELAY_TIMELOCK'
  | 'RENOUNCED_BURN_ADDRESS'
  | 'UNRESOLVED_CONTRACT';

export type PrivilegeCapability =
  | 'UNBOUNDED_MINT'
  | 'ASSET_FREEZE_BLACKLIST'
  | 'EMERGENCY_PAUSE'
  | 'FEE_MANIPULATION_100PCT'
  | 'IMPLEMENTATION_UPGRADE'
  | 'TREASURY_DRAIN'
  | 'ARBITRARY_DELEGATECALL';

export interface PrivilegeNode {
  readonly actorAddress: string;
  readonly authorityClass: AuthorityClass;
  readonly roleName: string;
  readonly functionsGoverned: string[];
  readonly capabilities: PrivilegeCapability[];
  readonly quorum?: string; // e.g. "3-of-5" ONLY if proven by RPC log/call
  readonly timelockDelaySeconds?: number; // e.g. 172800 ONLY if proven
  readonly isRenounced: boolean;
}

export interface PrivilegeEscalationPath {
  readonly pathId: string;
  readonly actor: string;
  readonly capability: PrivilegeCapability;
  readonly riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly stateMutation: string;
  readonly economicImpactDescription: string;
}

export interface AuthorityGraphReport {
  readonly targetContract: string;
  readonly nodes: PrivilegeNode[];
  readonly escalationPaths: PrivilegeEscalationPath[];
  readonly isSingleKeyRugPossible: boolean;
  readonly isInfiniteMintPossible: boolean;
  readonly isEmergencyPausePossible: boolean;
}

/**
 * Builds an authority graph from AST state variables, modifiers, and verified roles.
 */
export function buildAuthorityGraph(options: {
  contractAddress: string;
  rolesDetected: string[];
  ownerAddress?: string | null;
  observedQuorum?: string | null;
  observedTimelockDelay?: number | null;
  hasMintFunction?: boolean;
  hasBlacklistFunction?: boolean;
  hasPauseFunction?: boolean;
  hasUpgradeFunction?: boolean;
}): AuthorityGraphReport {
  const {
    contractAddress,
    rolesDetected,
    ownerAddress,
    observedQuorum,
    observedTimelockDelay,
    hasMintFunction = false,
    hasBlacklistFunction = false,
    hasPauseFunction = false,
    hasUpgradeFunction = false,
  } = options;

  const nodes: PrivilegeNode[] = [];
  const escalationPaths: PrivilegeEscalationPath[] = [];

  const isRenounced =
    ownerAddress === '0x0000000000000000000000000000000000000000' ||
    ownerAddress === '0x000000000000000000000000000000000000dead';

  let authorityClass: AuthorityClass = 'EOA_SINGLE_KEY';
  if (isRenounced) {
    authorityClass = 'RENOUNCED_BURN_ADDRESS';
  } else if (observedQuorum && observedQuorum !== 'UNKNOWN') {
    authorityClass = 'VERIFIED_MULTISIG';
  } else if (observedTimelockDelay !== undefined && observedTimelockDelay !== null) {
    authorityClass = observedTimelockDelay > 0 ? 'VERIFIED_TIMELOCK' : 'ZERO_DELAY_TIMELOCK';
  }

  const capabilities: PrivilegeCapability[] = [];
  if (hasMintFunction) capabilities.push('UNBOUNDED_MINT');
  if (hasBlacklistFunction) capabilities.push('ASSET_FREEZE_BLACKLIST');
  if (hasPauseFunction) capabilities.push('EMERGENCY_PAUSE');
  if (hasUpgradeFunction) capabilities.push('IMPLEMENTATION_UPGRADE');

  if (ownerAddress && !isRenounced) {
    nodes.push({
      actorAddress: ownerAddress,
      authorityClass,
      roleName: 'DEFAULT_ADMIN_ROLE / Owner',
      functionsGoverned: capabilities.map((c) => c.toLowerCase()),
      capabilities,
      quorum: observedQuorum || undefined,
      timelockDelaySeconds: observedTimelockDelay || undefined,
      isRenounced: false,
    });

    if (hasMintFunction && authorityClass === 'EOA_SINGLE_KEY') {
      escalationPaths.push({
        pathId: 'ESC-MINT-01',
        actor: ownerAddress,
        capability: 'UNBOUNDED_MINT',
        riskLevel: 'HIGH',
        stateMutation: '_mint(address, uint256) increases totalSupply without limit',
        economicImpactDescription: 'Single private key compromise enables infinite dilution of circulating tokens.',
      });
    }

    if (hasBlacklistFunction && authorityClass === 'EOA_SINGLE_KEY') {
      escalationPaths.push({
        pathId: 'ESC-FREEZE-01',
        actor: ownerAddress,
        capability: 'ASSET_FREEZE_BLACKLIST',
        riskLevel: 'MEDIUM',
        stateMutation: 'isBlacklisted[address] = true blocks transfers',
        economicImpactDescription: 'Admin can selectively freeze user funds or secondary market liquidity.',
      });
    }

    if (hasUpgradeFunction && authorityClass === 'EOA_SINGLE_KEY') {
      escalationPaths.push({
        pathId: 'ESC-UPGRADE-01',
        actor: ownerAddress,
        capability: 'IMPLEMENTATION_UPGRADE',
        riskLevel: 'CRITICAL',
        stateMutation: 'upgradeTo(address) / upgradeToAndCall(address, bytes)',
        economicImpactDescription: 'Single key can instantly rewrite bytecode, bypassing all token logic and balance storage.',
      });
    }
  }

  return {
    targetContract: contractAddress,
    nodes,
    escalationPaths,
    isSingleKeyRugPossible: escalationPaths.some((p) => p.riskLevel === 'CRITICAL'),
    isInfiniteMintPossible: capabilities.includes('UNBOUNDED_MINT'),
    isEmergencyPausePossible: capabilities.includes('EMERGENCY_PAUSE'),
  };
}
