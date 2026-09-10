export type StripeCredentialMode = "test" | "live" | "missing" | "mixed";

export type RuntimePaymentAuthority = {
  credentialMode: StripeCredentialMode;
  requestedMode: "test" | "live" | "missing";
  modeMatches: boolean;
  testPaymentsAllowed: boolean;
  livePaymentsAllowed: boolean;
  blockers: string[];
};

function enabled(value: string | undefined) {
  return value === "true";
}

export function detectStripeCredentialMode(
  env: NodeJS.ProcessEnv = process.env,
): StripeCredentialMode {
  const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishable = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!secret && !publishable) return "missing";
  const secretMode = secret.startsWith("sk_test_")
    ? "test"
    : secret.startsWith("sk_live_")
      ? "live"
      : "missing";
  const publishableMode = publishable.startsWith("pk_test_")
    ? "test"
    : publishable.startsWith("pk_live_")
      ? "live"
      : "missing";
  return secretMode === publishableMode && secretMode !== "missing"
    ? secretMode
    : "mixed";
}

export function evaluateRuntimePaymentAuthority(
  env: NodeJS.ProcessEnv = process.env,
): RuntimePaymentAuthority {
  const credentialMode = detectStripeCredentialMode(env);
  const requestedMode =
    env.PAYMENTS_MODE === "test"
      ? "test"
      : env.PAYMENTS_MODE === "live"
        ? "live"
        : "missing";
  const modeMatches = requestedMode === credentialMode;
  const webhookReady = Boolean(env.STRIPE_WEBHOOK_SECRET?.trim());
  const testPaymentsAllowed =
    requestedMode === "test" &&
    credentialMode === "test" &&
    webhookReady;

  // Live payment authority is intentionally conjunctive and fail-closed. A
  // single convenience flag cannot promote a release or enable charging.
  const liveGates = {
    releaseDecision: env.VELMERE_RELEASE_DECISION === "GO",
    live: enabled(env.VELMERE_LIVE),
    saleEnabled: enabled(env.VELMERE_SALE_ENABLED),
    productionApproved: enabled(env.VELMERE_PRODUCTION_APPROVED),
    rightsApproved: enabled(env.VELMERE_PROVIDER_RIGHTS_APPROVED),
    legalApproved: enabled(env.VELMERE_LEGAL_APPROVED),
    exactReleaseId: Boolean(env.VELMERE_EXACT_RELEASE_ID?.trim()),
    releaseApprovalDigest:
      /^[a-f0-9]{64}$/.test(env.VELMERE_RELEASE_APPROVAL_SHA256?.trim() ?? ""),
  };
  const livePaymentsAllowed =
    requestedMode === "live" &&
    credentialMode === "live" &&
    webhookReady &&
    Object.values(liveGates).every(Boolean);

  const blockers: string[] = [];
  if (requestedMode === "missing") blockers.push("PAYMENTS_MODE must be explicitly test or live.");
  if (credentialMode === "missing") blockers.push("Stripe key pair is missing or malformed.");
  if (credentialMode === "mixed") blockers.push("Stripe secret and publishable keys use different or unknown modes.");
  if (!modeMatches && requestedMode !== "missing") blockers.push("PAYMENTS_MODE does not match the Stripe credential mode.");
  if (!webhookReady) blockers.push("STRIPE_WEBHOOK_SECRET is required before creating paid sessions.");
  if (requestedMode === "live") {
    for (const [gate, ready] of Object.entries(liveGates)) {
      if (!ready) blockers.push(`Live payment authority gate is closed: ${gate}.`);
    }
  }

  return {
    credentialMode,
    requestedMode,
    modeMatches,
    testPaymentsAllowed,
    livePaymentsAllowed,
    blockers,
  };
}

export function runtimePaymentModeAllowed(
  authority: RuntimePaymentAuthority,
) {
  return authority.requestedMode === "test"
    ? authority.testPaymentsAllowed
    : authority.livePaymentsAllowed;
}
