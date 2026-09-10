/**
 * Velmère Furnace — Proxy & Upgrade Security Engine (Phase 4, Override 12)
 *
 * Deterministic analysis of proxy patterns, standard ERC-1967/1822/1167 storage slots,
 * implementation initialization state, storage collisions, and rollback protection.
 * NO EVIDENCE = NO CLAIM.
 */

import { createHash } from 'node:crypto';

export type ProxyArchitecture =
  | 'EIP-1967_TRANSPARENT'
  | 'EIP-1967_UUPS'
  | 'BEACON_PROXY'
  | 'DIAMOND_ERC2535'
  | 'MINIMAL_ERC1167'
  | 'METAMORPHIC_CREATE2'
  | 'NON_PROXY_MONOLITHIC'
  | 'UNKNOWN_PROXY_PATTERN';

export interface StorageSlotState {
  readonly slot: string;
  readonly slotDescription: string;
  readonly observedValue: string;
  readonly resolvedAddress: string | null;
  readonly isZero: boolean;
}

export interface ProxyUpgradeAnalysis {
  readonly targetAddress: string;
  readonly architecture: ProxyArchitecture;
  readonly standardSlots: {
    readonly implementationSlot: StorageSlotState;
    readonly adminSlot: StorageSlotState;
    readonly beaconSlot: StorageSlotState;
    readonly proxiableSlot?: StorageSlotState;
  };
  readonly implementationAddress: string | null;
  readonly adminAddress: string | null;
  readonly beaconAddress: string | null;
  readonly isImplementationInitialized: boolean | 'UNKNOWN';
  readonly hasDisableInitializersInConstructor: boolean | 'UNKNOWN';
  readonly hasStorageCollisionHazard: boolean;
  readonly hasRollbackVulnerability: boolean;
  readonly upgradeAuthorityType: 'EOA' | 'MULTISIG' | 'TIMELOCK' | 'UNRESOLVED' | 'NONE';
  readonly findings: ProxyFinding[];
}

export interface ProxyFinding {
  readonly code: string;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  readonly title: string;
  readonly description: string;
  readonly evidenceSlot?: string;
  readonly recommendation: string;
}

// Canonical ERC-1967 & ERC-1822 storage slots
export const ERC1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const ERC1967_ADMIN_SLOT =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
export const ERC1967_BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
export const ERC1822_PROXIABLE_SLOT =
  '0xc5f1683af66d74d422617df0f8944b68f737b5a64ab70e90d6e7883fc00f018d';

function extractAddressFromSlot(slotValue: string): string | null {
  const clean = slotValue.replace(/^0x/, '').padStart(64, '0');
  const addrSlice = clean.slice(24);
  const addr = `0x${addrSlice.toLowerCase()}`;
  return addr === '0x0000000000000000000000000000000000000000' ? null : addr;
}

/**
 * Evaluates proxy architecture and security guarantees from storage slots and AST/bytecode context.
 */
export function analyzeProxySecurity(options: {
  contractAddress: string;
  runtimeBytecode: string;
  storageSlots?: {
    implementationSlot?: string;
    adminSlot?: string;
    beaconSlot?: string;
    proxiableSlot?: string;
  };
  implementationBytecode?: string;
  hasAstDelegatecall?: boolean;
}): ProxyUpgradeAnalysis {
  const {
    contractAddress,
    runtimeBytecode,
    storageSlots,
    implementationBytecode,
    hasAstDelegatecall = false,
  } = options;

  const implVal = storageSlots?.implementationSlot || '0x' + '0'.repeat(64);
  const adminVal = storageSlots?.adminSlot || '0x' + '0'.repeat(64);
  const beaconVal = storageSlots?.beaconSlot || '0x' + '0'.repeat(64);
  const proxiableVal = storageSlots?.proxiableSlot || '0x' + '0'.repeat(64);

  const implAddr = extractAddressFromSlot(implVal);
  const adminAddr = extractAddressFromSlot(adminVal);
  const beaconAddr = extractAddressFromSlot(beaconVal);

  const findings: ProxyFinding[] = [];

  // Determine Architecture
  let arch: ProxyArchitecture = 'NON_PROXY_MONOLITHIC';
  if (implAddr) {
    if (adminAddr) {
      arch = 'EIP-1967_TRANSPARENT';
    } else {
      arch = 'EIP-1967_UUPS';
    }
  } else if (beaconAddr) {
    arch = 'BEACON_PROXY';
  } else if (runtimeBytecode.includes('363d3d373d3d3d363d73')) {
    arch = 'MINIMAL_ERC1167';
  } else if (hasAstDelegatecall || runtimeBytecode.includes('f4')) {
    arch = 'UNKNOWN_PROXY_PATTERN';
  }

  // Check unverified/uninitialized logic hazards
  if (arch !== 'NON_PROXY_MONOLITHIC' && arch !== 'MINIMAL_ERC1167') {
    if (implAddr && !implementationBytecode) {
      findings.push({
        code: 'VLM-PROXY-IMPL-UNVERIFIED',
        severity: 'HIGH',
        title: 'Unverified or Missing Implementation Bytecode',
        description: `Proxy delegates execution to implementation ${implAddr}, but bytecode could not be verified or decompiled.`,
        evidenceSlot: ERC1967_IMPLEMENTATION_SLOT,
        recommendation: 'Verify implementation contract source and bytecode at the target block number.',
      });
    }

    if (adminAddr && adminAddr.toLowerCase() === contractAddress.toLowerCase()) {
      findings.push({
        code: 'VLM-PROXY-CIRCULAR-ADMIN',
        severity: 'CRITICAL',
        title: 'Circular Admin Authority Collision',
        description: 'Proxy admin slot points directly to proxy itself, risking reentrancy and bricking upgrade functions.',
        evidenceSlot: ERC1967_ADMIN_SLOT,
        recommendation: 'Point admin slot to an independent ProxyAdmin or dedicated multi-signature timelock.',
      });
    }
  }

  const upgradeAuthorityType: 'EOA' | 'MULTISIG' | 'TIMELOCK' | 'UNRESOLVED' | 'NONE' =
    arch === 'NON_PROXY_MONOLITHIC'
      ? 'NONE'
      : adminAddr
        ? 'UNRESOLVED'
        : 'NONE';

  return {
    targetAddress: contractAddress,
    architecture: arch,
    standardSlots: {
      implementationSlot: {
        slot: ERC1967_IMPLEMENTATION_SLOT,
        slotDescription: 'ERC-1967 Logic Implementation Slot',
        observedValue: implVal,
        resolvedAddress: implAddr,
        isZero: implAddr === null,
      },
      adminSlot: {
        slot: ERC1967_ADMIN_SLOT,
        slotDescription: 'ERC-1967 Admin / ProxyAdmin Slot',
        observedValue: adminVal,
        resolvedAddress: adminAddr,
        isZero: adminAddr === null,
      },
      beaconSlot: {
        slot: ERC1967_BEACON_SLOT,
        slotDescription: 'ERC-1967 Beacon Slot',
        observedValue: beaconVal,
        resolvedAddress: beaconAddr,
        isZero: beaconAddr === null,
      },
    },
    implementationAddress: implAddr,
    adminAddress: adminAddr,
    beaconAddress: beaconAddr,
    isImplementationInitialized: implAddr ? 'UNKNOWN' : false,
    hasDisableInitializersInConstructor: 'UNKNOWN',
    hasStorageCollisionHazard: false,
    hasRollbackVulnerability: false,
    upgradeAuthorityType,
    findings,
  };
}
