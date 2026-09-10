export const PASS4342_PROVIDER_LIVE_DATA_API_CONTRACT = {
  passId: "PASS4342",
  schema: "velmere.pass4342.public_proof_api_provider_live_data_smoke_harness.v1",
  publicTopkaLiveAllowed: false,
  headers: ["X-Velmere-Provider-Live-Data-Smoke-Harness", "X-Velmere-Public-Topka-Live-Allowed", "Cache-Control"],
  publicStatusMode: "prepared-only-until-executed-provider-live-data-receipts",
  forbiddenPublicFields: ["providerSecret", "apiKey", "rawProviderResponse", "rawCustomerEvidence", "rawPaymentTrace", "operatorPrivateKey"],
} as const;
