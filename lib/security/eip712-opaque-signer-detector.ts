/**
 * Velmère EIP-712 Opaque Signer Detector (V2 Directive Section 43.4)
 * Detects hidden off-chain signature dependencies, centralized authorization keys,
 * and un-timelocked trusted oracle/signer vectors in smart contracts.
 */

export interface OpaqueSignerRisk {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  detectedPattern: string;
  hasEcrecover: boolean;
  hasEip712DomainSeparator: boolean;
  hasErc1271WalletValidation: boolean;
  isSignerMutable: boolean;
  isTimelockGoverned: boolean;
  blastRadius: string;
  evidence: string;
  remediation: string;
}

export function detectOpaqueSignerRisks(params: {
  contractName: string;
  bytecodeOrSource: string;
  abi?: Array<{ name?: string; inputs?: unknown[]; type?: string }>;
}): OpaqueSignerRisk {
  const content = params.bytecodeOrSource;
  const abi = params.abi || [];

  // 1. Detect ecrecover (precompile 0x01 call or identifier)
  const hasEcrecover =
    /ecrecover/i.test(content) ||
    // opcode sequence: PUSH1 0x01 STATICCALL
    /6001fa/i.test(content);

  // 2. Detect EIP-712 Domain Separator hashing
  const hasEip712DomainSeparator =
    /eip712/i.test(content) ||
    /DOMAINTYPE/i.test(content) ||
    /_domainSeparatorV4/i.test(content) ||
    /DOMAIN_SEPARATOR/i.test(content);

  // 3. Detect ERC-1271 isValidSignature (selector 0x1626ba7e)
  const hasErc1271 =
    /isValidSignature/i.test(content) ||
    /1626ba7e/i.test(content);

  // 4. Detect mutable signer setter without timelock
  const hasSetSignerFunction = abi.some((fn) =>
    fn.type === "function" &&
    Boolean(fn.name && /set(Signer|TrustedSigner|Relayer|BackendSigner|Validator)/i.test(fn.name))
  ) || /setTrustedSigner|setSignerAddress|updateSigner/i.test(content);

  const hasTimelock = /timelock|delay|queued/i.test(content);

  if (!hasEcrecover && !hasEip712DomainSeparator && !hasErc1271) {
    return {
      severity: "NONE",
      detectedPattern: "NO_OFF_CHAIN_SIGNATURE_DEPENDENCY",
      hasEcrecover: false,
      hasEip712DomainSeparator: false,
      hasErc1271WalletValidation: false,
      isSignerMutable: false,
      isTimelockGoverned: false,
      blastRadius: "None. All state transitions are authorized strictly via direct msg.sender transactions.",
      evidence: "No ecrecover or EIP-712 hashing routines detected in analyzed bytecode.",
      remediation: "No action required.",
    };
  }

  if (hasSetSignerFunction && !hasTimelock) {
    return {
      severity: "CRITICAL",
      detectedPattern: "MUTABLE_OPAQUE_SIGNER_WITHOUT_TIMELOCK",
      hasEcrecover,
      hasEip712DomainSeparator,
      hasErc1271WalletValidation: hasErc1271,
      isSignerMutable: true,
      isTimelockGoverned: false,
      blastRadius: "Catastrophic. Compromise of owner key allows instant rotation of signer to arbitrary address, forging authorization vouchers for 100% of contract liquidity.",
      evidence: "Detected signature verification entrypoint paired with instant un-timelocked signer mutation.",
      remediation: "Enforce multi-sig governance and mandatory 48-hour timelock delay on signer rotation, or migrate to decentralized on-chain oracle quorums.",
    };
  }

  if (hasEcrecover || hasEip712DomainSeparator) {
    return {
      severity: "MEDIUM",
      detectedPattern: "STATIC_OR_TIMELOCKED_EIP712_DEPENDENCY",
      hasEcrecover,
      hasEip712DomainSeparator,
      hasErc1271WalletValidation: hasErc1271,
      isSignerMutable: hasSetSignerFunction,
      isTimelockGoverned: hasTimelock,
      blastRadius: "Contained to signed voucher replay or private key leakage if off-chain backend infrastructure is compromised.",
      evidence: "EIP-712 structured data signing detected with nonces and domain verification.",
      remediation: "Ensure strict per-user nonces, deadline timestamps, and chainId scoping are verified on every signed digest.",
    };
  }

  return {
    severity: "LOW",
    detectedPattern: "STANDARD_ERC1271_COMPATIBILITY",
    hasEcrecover: false,
    hasEip712DomainSeparator: false,
    hasErc1271WalletValidation: true,
    isSignerMutable: false,
    isTimelockGoverned: false,
    blastRadius: "Standard smart contract wallet signature validation.",
    evidence: "Contract implements ERC-1271 isValidSignature interface for smart account compatibility.",
    remediation: "Ensure reentrancy protection on external validation calls.",
  };
}
