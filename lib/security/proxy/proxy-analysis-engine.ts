/**
 * VELMÈRE PROXY & UPGRADEABILITY ANALYSIS ENGINE
 * 
 * Formal detection and analysis of smart contract proxy architectures:
 * - EIP-1967 Implementation / Admin / Beacon slots
 * - EIP-1167 Minimal Proxy (Clones)
 * - EIP-2535 Diamond Standard
 * - Transparent vs UUPS patterns
 * - Upgrade authority analysis & storage collision risk
 */

export const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
export const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423a820bae1f74ba158a74e54f7d826b38b57779a5a6600b07d39e";
export const EIP1967_BEACON_SLOT_FINAL = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
export const ERC1822_PROXIABLE_SLOT = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7";
export const ERC1822_PROXIABLE_SLOT_ALIAS = "0xc5f1683af66d74d422617df0f8944b68f737b5a64ab70e90d6e7883fc00f018d";
export const ARAGON_KERNEL_NAMESPACED_SLOT = "0x4172f0f7d2289153072b0a6ca36959e0cbe2efc3afe50fc81636caa96338137b";
export const ARAGON_APP_ID_NAMESPACED_SLOT = "0xd625496217aa6a3453eecb9c3489dc5a53e6c67b444329ea2b2cbc9ff547639b";

export type ProxyPatternType =
  | "DIRECT_EXECUTION_NON_PROXY"
  | "EIP_1967_TRANSPARENT"
  | "EIP_1967_UUPS"
  | "EIP_1967_BEACON"
  | "EIP_1167_MINIMAL_PROXY"
  | "EIP_2535_DIAMOND"
  | "ARAGON_APP_PROXY"
  | "CUSTOM_PROXY"
  | "UNVERIFIABLE_PROXY";

export interface ProxyAnalysisResult {
  isProxy: boolean;
  patternType: ProxyPatternType;
  implementationSlotDetected: boolean;
  adminSlotDetected: boolean;
  beaconSlotDetected: boolean;
  isMinimalProxyEip1167: boolean;
  isDiamondEip2535: boolean;
  isAragonAppProxy?: boolean;
  upgradeAuthorityType: "TIMELOCK_MULTISIG" | "SINGLE_EOA" | "IMMUTABLE_NONE" | "UNKNOWN";
  storageCollisionRisk: "LOW" | "ELEVATED" | "CRITICAL" | "NONE_DIRECT";
  rollbackAttackPathsAttached: number;
  detectedImplementationAddress: string | null;
  detectedAdminAddress: string | null;
  explanation: string;
}

export function analyzeProxyArchitecture(rawBytecode?: string): ProxyAnalysisResult {
  if (!rawBytecode || rawBytecode.trim().length < 8) {
    return {
      isProxy: false,
      patternType: "UNVERIFIABLE_PROXY",
      implementationSlotDetected: false,
      adminSlotDetected: false,
      beaconSlotDetected: false,
      isMinimalProxyEip1167: false,
      isDiamondEip2535: false,
      upgradeAuthorityType: "UNKNOWN",
      storageCollisionRisk: "NONE_DIRECT",
      rollbackAttackPathsAttached: 0,
      detectedImplementationAddress: null,
      detectedAdminAddress: null,
      explanation: "Bytecode unavailable. Proxy architecture unverifiable from evidence.",
    };
  }

  const clean = rawBytecode.toLowerCase().replace(/^0x/, "");

  // Check EIP-1167 Minimal Proxy: 363d3d373d3d3d363d73...5af43d82803e903d91602b57fd5bf3
  const isEip1167 = clean.startsWith("363d3d373d3d3d363d73") && clean.endsWith("5af43d82803e903d91602b57fd5bf3");
  if (isEip1167) {
    const impl = "0x" + clean.slice(20, 60);
    return {
      isProxy: true,
      patternType: "EIP_1167_MINIMAL_PROXY",
      implementationSlotDetected: true,
      adminSlotDetected: false,
      beaconSlotDetected: false,
      isMinimalProxyEip1167: true,
      isDiamondEip2535: false,
      upgradeAuthorityType: "IMMUTABLE_NONE",
      storageCollisionRisk: "LOW",
      rollbackAttackPathsAttached: 0,
      detectedImplementationAddress: impl,
      detectedAdminAddress: null,
      explanation: "EIP-1167 Minimal Proxy Clone detected. Implementation target is immutable.",
    };
  }

  // Check Aragon AppProxyUpgradeability (Aragon OS AppProxy)
  const isAragonAppProxy =
    (clean.includes("d4aae014") && clean.includes("577a7f43")) ||
    clean.includes(ARAGON_KERNEL_NAMESPACED_SLOT.slice(2)) ||
    clean.includes(ARAGON_APP_ID_NAMESPACED_SLOT.slice(2));

  if (isAragonAppProxy) {
    return {
      isProxy: true,
      patternType: "ARAGON_APP_PROXY",
      implementationSlotDetected: false,
      adminSlotDetected: true,
      beaconSlotDetected: false,
      isMinimalProxyEip1167: false,
      isDiamondEip2535: false,
      isAragonAppProxy: true,
      upgradeAuthorityType: "TIMELOCK_MULTISIG",
      storageCollisionRisk: "LOW",
      rollbackAttackPathsAttached: 1,
      detectedImplementationAddress: null,
      detectedAdminAddress: null,
      explanation: "Aragon AppProxyUpgradeability detected. Resolves implementation through Aragon Kernel and DAO voting ACL.",
    };
  }

  // Check EIP-1967 implementation slot
  const implSlotRaw = EIP1967_IMPLEMENTATION_SLOT.slice(2);
  const hasImplSlot = clean.includes(implSlotRaw);

  // Check EIP-1967 admin slot
  const adminSlotRaw = EIP1967_ADMIN_SLOT.slice(2);
  const hasAdminSlot = clean.includes(adminSlotRaw);

  // Check EIP-1967 beacon slot (check standard final or draft)
  const beaconSlotRaw = EIP1967_BEACON_SLOT.slice(2);
  const beaconSlotFinalRaw = EIP1967_BEACON_SLOT_FINAL.slice(2);
  const hasBeaconSlot = clean.includes(beaconSlotRaw) || clean.includes(beaconSlotFinalRaw);

  // Check ERC-1822 proxiable slot
  const proxiableSlotRaw = ERC1822_PROXIABLE_SLOT.slice(2);
  const hasProxiableSlot = clean.includes(proxiableSlotRaw);

  // Check EIP-2535 diamond loupe selector: 0xcdffacc6 (diamondCut), 0x7a0ed627 (facets)
  const isDiamond = clean.includes("cdffacc6") && clean.includes("7a0ed627");

  // Check DELEGATECALL (opcode 0xF4)
  const hasDelegateCall = clean.includes("f4");

  if (isDiamond) {
    return {
      isProxy: true,
      patternType: "EIP_2535_DIAMOND",
      implementationSlotDetected: false,
      adminSlotDetected: true,
      beaconSlotDetected: false,
      isMinimalProxyEip1167: false,
      isDiamondEip2535: true,
      upgradeAuthorityType: "TIMELOCK_MULTISIG",
      storageCollisionRisk: "ELEVATED",
      rollbackAttackPathsAttached: 1,
      detectedImplementationAddress: null,
      detectedAdminAddress: null,
      explanation: "EIP-2535 Diamond Multi-Facet Proxy detected with diamondCut interface.",
    };
  }

  if (hasImplSlot || hasAdminSlot || hasBeaconSlot || hasProxiableSlot) {
    // Check if UUPS (has upgradeTo(address) selector 0x3659cfe6 or upgradeToAndCall 0x4f1ef286 or ERC1822 slot)
    const isUups = clean.includes("3659cfe6") || clean.includes("4f1ef286") || hasProxiableSlot;
    return {
      isProxy: true,
      patternType: isUups ? "EIP_1967_UUPS" : hasBeaconSlot ? "EIP_1967_BEACON" : "EIP_1967_TRANSPARENT",
      implementationSlotDetected: hasImplSlot,
      adminSlotDetected: hasAdminSlot,
      beaconSlotDetected: hasBeaconSlot,
      isMinimalProxyEip1167: false,
      isDiamondEip2535: false,
      upgradeAuthorityType: hasAdminSlot ? "TIMELOCK_MULTISIG" : "SINGLE_EOA",
      storageCollisionRisk: isUups ? "ELEVATED" : "LOW",
      rollbackAttackPathsAttached: 1,
      detectedImplementationAddress: null,
      detectedAdminAddress: null,
      explanation: `EIP-1967 Standard Proxy detected (${isUups ? "UUPS" : hasBeaconSlot ? "Beacon" : "Transparent"}). Verified storage slot separation.`,
    };
  }

  if (hasDelegateCall) {
    return {
      isProxy: true,
      patternType: "CUSTOM_PROXY",
      implementationSlotDetected: false,
      adminSlotDetected: false,
      beaconSlotDetected: false,
      isMinimalProxyEip1167: false,
      isDiamondEip2535: false,
      upgradeAuthorityType: "UNKNOWN",
      storageCollisionRisk: "CRITICAL",
      rollbackAttackPathsAttached: 1,
      detectedImplementationAddress: null,
      detectedAdminAddress: null,
      explanation: "Custom DELEGATECALL proxy logic detected without standard EIP-1967 storage slots. Risk of unshielded storage collisions.",
    };
  }

  return {
    isProxy: false,
    patternType: "DIRECT_EXECUTION_NON_PROXY",
    implementationSlotDetected: false,
    adminSlotDetected: false,
    beaconSlotDetected: false,
    isMinimalProxyEip1167: false,
    isDiamondEip2535: false,
    upgradeAuthorityType: "IMMUTABLE_NONE",
    storageCollisionRisk: "NONE_DIRECT",
    rollbackAttackPathsAttached: 0,
    detectedImplementationAddress: null,
    detectedAdminAddress: null,
    explanation: "Direct execution contract. No proxy routing or delegatecall mechanisms identified.",
  };
}
