export const PASS4341_PAYMENT_REPLAY_API_CONTRACT = {
  passId: "PASS4341",
  schema: "velmere.pass4341.public_proof_api_payment_replay_harness.v1",
  publicTopkaLiveAllowed: false,
  headers: ["X-Velmere-Payment-Replay-Harness", "X-Velmere-Public-Topka-Live-Allowed", "Cache-Control"],
  publicStatusMode: "prepared-only-until-executed-payment-replay-receipts",
  forbiddenPublicFields: ["rawPaymentTrace", "stripeSecret", "webhookSecret", "hmacSecret", "cardData", "customerEmail"],
} as const;
