export interface Pass4337PublicProofApiModuleExecutionContract {
  readonly passId: "PASS4337";
  readonly noVisualChanges: true;
  readonly endpoint: "/api/proof-status";
  readonly mustReturnJsonOnly: true;
  readonly mustUseNoStore: true;
  readonly mustExposeModuleAcceptanceGates: true;
  readonly mustExposeP0AndP1ReceiptQueues: true;
  readonly mustExposeBlockedReasons: true;
  readonly mustKeepPublicTopkaLiveAllowedFalse: true;
  readonly mustNotExposeRawCustomerEvidence: true;
  readonly mustNotExposeRawPaymentTrace: true;
  readonly mustNotExposeProviderSecrets: true;
  readonly mustNotExposeOperatorPrivateKey: true;
}

export const PASS4337_PUBLIC_PROOF_API_MODULE_EXECUTION_CONTRACT: Pass4337PublicProofApiModuleExecutionContract = {
  passId: "PASS4337",
  noVisualChanges: true,
  endpoint: "/api/proof-status",
  mustReturnJsonOnly: true,
  mustUseNoStore: true,
  mustExposeModuleAcceptanceGates: true,
  mustExposeP0AndP1ReceiptQueues: true,
  mustExposeBlockedReasons: true,
  mustKeepPublicTopkaLiveAllowedFalse: true,
  mustNotExposeRawCustomerEvidence: true,
  mustNotExposeRawPaymentTrace: true,
  mustNotExposeProviderSecrets: true,
  mustNotExposeOperatorPrivateKey: true,
};
