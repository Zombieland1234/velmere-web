type Pass35AuditSeverity = "critical" | "high" | "medium" | "low" | "info";
type Pass35AuditFindingState = "finding" | "observation" | "not_observed" | "not_applicable" | "blocked";

export type StructuredSignalDefinition = {
  severity: Pass35AuditSeverity;
  state: Pass35AuditFindingState;
  confidence: number;
  title: string;
  description: string;
  remediation: string;
};

const finding = (
  severity: Pass35AuditSeverity,
  confidence: number,
  title: string,
  description: string,
  remediation: string,
): StructuredSignalDefinition => ({ severity, state: "finding", confidence, title, description, remediation });

const observation = (
  severity: Pass35AuditSeverity,
  confidence: number,
  title: string,
  description: string,
  remediation: string,
): StructuredSignalDefinition => ({ severity, state: "observation", confidence, title, description, remediation });

export const STRUCTURED_SIGNAL_CATALOG: Readonly<Record<string, StructuredSignalDefinition>> = Object.freeze({
  tx_origin_auth: finding("high", 94, "Authorization depends on tx.origin", "Authorization depends on the transaction origin and can be bypassed through an intermediary call chain.", "Use explicit role or msg.sender authorization and test intermediary-contract calls."),
  delegatecall: finding("high", 88, "Delegatecall execution surface", "Foreign code executes in the caller storage context and requires exact target, upgrade and storage-layout controls.", "Bind implementations, protect upgrades and test unauthorized target substitution and storage-layout drift."),
  selfdestruct: finding("high", 90, "Destructive lifecycle surface", "A destructive opcode is reachable in source and its authorization and current chain semantics require review.", "Remove it where possible or require governance, delay, monitoring and chain-specific tests."),
  unchecked_call: finding("medium", 86, "Unchecked low-level call result", "A low-level call or send can fail without a verified success condition.", "Capture and validate success and returned data, then test failure and callback paths."),
  reentrancy_order: finding("high", 86, "External interaction precedes state effect", "A withdrawal, refund, close or settlement path performs an external interaction before a subsequent persistent-state effect.", "Apply checks-effects-interactions or a reviewed guard and add adversarial callback tests, including legacy call.value and token-callback paths."),
  reentrancy_modifier_callback: finding("high", 84, "Modifier callback precedes protected function effects", "A modifier used by an externally callable state-changing function performs an external callback before the function body executes.", "Move untrusted callbacks after durable effects, use a reviewed reentrancy guard and test recursive modifier callbacks."),
  open_mint: finding("high", 88, "Externally callable mint lacks authorization", "A public or external mint path does not show a role, owner or minter authorization check.", "Require an explicit role and test unauthorized issuance and role revocation."),
  unguarded_initialize: finding("high", 85, "Initializer lacks a one-time guard", "An initialization path does not show an initializer modifier or durable initialized-state guard.", "Use a one-time initializer guard, lock implementation contracts and test repeated initialization."),
  unprotected_privileged_write: finding("high", 82, "Externally callable privileged-state write", "An externally callable function writes ownership, role or privilege state without an evident authorization guard.", "Require an explicit role or owner policy and test unauthorized privilege creation, replacement and deletion."),
  legacy_constructor_name_mismatch: finding("high", 95, "Legacy constructor name mismatch", "A pre-constructor-keyword contract exposes a public function that initializes privileged state but is not named exactly as the contract.", "Migrate to the constructor keyword or correct the legacy name and test post-deployment reinitialization."),
  spot_oracle: observation("medium", 74, "Spot-price oracle dependency", "A spot or reserve-derived value is used without a demonstrated time-weighted or manipulation-resistant policy.", "Use a reviewed oracle with freshness, deviation and fallback controls and test manipulation scenarios."),
  post_balance_share_accounting: finding("high", 86, "Share accounting uses post-deposit balance", "Share minting appears to divide by a balance that already includes the incoming value.", "Use the pre-deposit asset balance, define rounding direction and add donation/inflation invariants."),
  rounding_zero: finding("medium", 76, "Rounding can create a zero-credit path", "Division-based credit calculation lacks an explicit non-zero result guard.", "Define minimum amounts and rounding direction and test boundary and dust inputs."),
  unbounded_external_loop: finding("high", 84, "Dynamic loop performs external calls", "A loop tied to dynamic state performs external calls and can become gas-bound or blocked by a recipient.", "Use pull payments, pagination or bounded batches and preserve progress across failures."),
  dos_storage_growth_loop: finding("medium", 80, "Large loop grows persistent storage", "A large or dynamic loop repeatedly appends to persistent storage and can exceed the gas limit.", "Bound batch size, paginate writes and measure worst-case gas."),
  dos_failed_refund: finding("high", 88, "Recipient failure can block progress", "A refund or payout failure is required to succeed inside a state transition, allowing a recipient to block progress.", "Use pull payments and isolate failed recipients without reverting the primary transition."),
  dos_storage_array_reset: finding("medium", 80, "Unbounded storage-array reset surface", "A dynamic storage array is reset through whole-array replacement and may become prohibitively expensive under legacy semantics.", "Use logical epochs or bounded deletion and test maximum-size state transitions."),
  signature_replay: finding("high", 82, "Signature replay protection is incomplete", "Signature recovery is present without clear chain/domain and durable nonce or used-digest protection.", "Use EIP-712 domain separation, nonces, expiry, malleability checks and zero-address validation."),
  permit_no_deadline: finding("medium", 84, "Permit-style authorization has no deadline", "A permit-like signature path does not bind an expiry deadline.", "Include deadline and chain/domain fields and test expiry, replay and domain mismatch."),
  storage_collision: finding("high", 86, "Incompatible storage layout variants", "Related contract layouts reorder state and can collide under delegatecall or upgrades.", "Use append-only or namespaced storage and verify layout compatibility in every upgrade."),
  hook_reentrancy: finding("high", 84, "Token hook precedes recipient accounting", "A recipient hook is invoked before the recipient balance is credited.", "Finalize state before the hook or use a reviewed reentrancy guard and callback invariants."),
  fee_token_mismatch: finding("high", 84, "Accounting trusts requested token amount", "Credit is based on the requested transfer amount rather than the balance delta actually received.", "Measure pre/post balances and credit the observed delta, including fee-on-transfer tests."),
  transfer_policy_bypass: finding("high", 82, "Privileged transfer path bypasses policy", "An administrative transfer path does not enforce the same blocked-address policy as ordinary transfers.", "Centralize policy checks and apply them to every transfer path with invariant tests."),
  missing_pause: observation("medium", 64, "Critical borrow path has no pause boundary", "A debt-increasing path does not expose a visible emergency pause guard.", "Add a narrowly scoped, governed pause with monitoring and recovery tests where the threat model requires it."),
  insolvent_withdraw: finding("high", 86, "Withdrawal lacks a solvency check", "Collateral can be reduced without a demonstrated post-withdrawal debt-health invariant.", "Check post-withdrawal collateralization using fresh oracle data and add solvency invariants."),
  low_quorum: finding("high", 90, "Governance proposal can pass with one vote", "The vote threshold permits a proposal to pass with a single vote and no supply-based quorum.", "Bind quorum to a snapshot supply and test low-turnout and manipulation scenarios."),
  front_run_reveal: finding("medium", 80, "Public reveal exposes an order-dependent secret", "A public submission is compared directly with a stored answer without a commit-reveal boundary.", "Use sender-bound commit-reveal with deadlines and replay protection."),
  front_run_preimage: finding("high", 88, "Public preimage solution can be copied", "A public transaction reveals the winning preimage before inclusion and pays the transaction sender.", "Use a sender-bound commit-reveal protocol with separate phases."),
  front_run_reward_race: finding("medium", 80, "Shared reward claim is transaction-order dependent", "A public reward value and claim state can be raced by transactions competing for the same payout.", "Bind claims to prior commitments or identities and make reward updates and claims race-safe."),
  front_run_plaintext_game: finding("high", 86, "Plaintext game choice is visible before settlement", "A player choice is written in plaintext before another participant settles the same round.", "Use commit-reveal or verifiable randomness with deadlines and forfeiture handling."),
  erc20_approval_race: finding("medium", 88, "ERC-20 allowance replacement race", "An allowance is replaced directly without first requiring zero or using increase/decrease allowance semantics.", "Require zero-before-nonzero transitions or expose atomic increase/decrease allowance functions."),
  legacy_short_address_surface: observation("medium", 74, "Legacy ABI short-address surface", "A legacy externally callable function places an address before a wide numeric argument without a payload-length guard.", "Use a modern compiler/ABI decoder and validate calldata length for legacy deployments and integrations."),
  blockhash_random: finding("high", 90, "Blockhash-derived randomness", "Randomness is derived from blockhash with a bounded or modulo transformation and can be influenced or predicted.", "Use a reviewed VRF or commit-reveal design and test manipulation and liveness failures."),
  timestamp_random: finding("high", 90, "Timestamp-derived randomness", "Randomness is derived from block timestamp and can be influenced within consensus tolerance.", "Use a reviewed VRF or commit-reveal design rather than timestamp entropy."),
  cross_chain_replay: finding("high", 86, "Cross-domain message lacks domain binding", "A message identifier does not bind source chain, destination chain, destination contract or messenger identity.", "Bind all domain fields and messenger identity into the replay key and test cross-chain/cross-contract replay."),
});
