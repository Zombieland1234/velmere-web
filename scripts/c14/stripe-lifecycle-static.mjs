import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

const packageJson = JSON.parse(read("package.json"));
const historicalStripeScript = String(packageJson.scripts?.["test:a97:stripe"] ?? "");
const referenced = [...historicalStripeScript.matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|ts|js))/g)].map((m) => m[1]);
const missingHistoricalStripeTestFiles = [...new Set(referenced.filter((p) => !exists(p)))];

const checkout = read("app/api/checkout/vlm-service/route.ts");
const containment = read("lib/commerce/vlm-paid-checkout-containment.ts");
const shared = read("lib/payments/stripe-webhook/shared.ts");
const registry = read("lib/db/supabase-rpc-operation-registry.ts");
const schema = read("lib/db/schema.sql");

const requiredRegistryRpcNames = [
  "velmere_claim_stripe_webhook_event",
  "velmere_apply_payment_event_watermark",
  "velmere_claim_stripe_webhook_effect",
  "velmere_complete_stripe_webhook_effect",
  "velmere_fail_stripe_webhook_effect",
  "velmere_dead_letter_stripe_webhook_effect",
  "velmere_apply_vlm_paid_entitlement_lifecycle_event",
  "velmere_create_or_read_vlm_paid_entitlement",
];
// The reconciliation worker is intentionally invoked through the bounded RPC helper
// rather than the named registry, but its database function is still required.
const requiredCanonicalSchemaRpcNames = [
  ...requiredRegistryRpcNames,
  "velmere_run_stripe_webhook_reconciliation_worker",
];

const rpcRegistryPresence = Object.fromEntries(requiredRegistryRpcNames.map((name) => [name, registry.includes(name)]));
const missingRegistryRpc = requiredRegistryRpcNames.filter((name) => !rpcRegistryPresence[name]);
const canonicalSchemaPresence = Object.fromEntries(requiredCanonicalSchemaRpcNames.map((name) => [name, schema.includes(name)]));
const missingCanonicalSchemaRpc = requiredCanonicalSchemaRpcNames.filter((name) => !canonicalSchemaPresence[name]);

const subscriptionEventMarkers = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];
const subscriptionEventsImplemented = subscriptionEventMarkers.filter((marker) => shared.includes(marker));

const result = {
  schemaVersion: "velmere.c14-p19.stripe-lifecycle-static.v1",
  sourceSha: process.env.GITHUB_SHA ?? null,
  checkout: {
    stripeCheckoutCreatePresent: checkout.includes("stripe.checkout.sessions.create"),
    oneTimePaymentModePresent: checkout.includes('mode: "payment"'),
    subscriptionModePresent: checkout.includes('mode: "subscription"'),
    containmentActiveInSource: containment.includes("active: true"),
    containmentReasonPresent: containment.includes("durable_opaque_server_checkout_flow_not_implemented"),
  },
  webhook: {
    signatureConstructionPresent: read("lib/payments/stripe-webhook/ingress.ts").includes("constructEvent"),
    subscriptionEventsImplemented,
    subscriptionLifecycleImplemented: subscriptionEventsImplemented.length > 0,
  },
  durableStorage: {
    registryHasRequiredRpcNames: missingRegistryRpc.length === 0,
    missingRegistryRpc,
    canonicalSchemaHasRequiredRpcNames: missingCanonicalSchemaRpc.length === 0,
    missingCanonicalSchemaRpc,
  },
  historicalEvidence: {
    a97StripeScriptPresent: Boolean(historicalStripeScript),
    referencedFiles: referenced,
    missingReferencedFiles: missingHistoricalStripeTestFiles,
  },
  classification: {
    hostedPaidVlmLifecycle: "BLOCKED",
    reasonCodes: [
      ...(containment.includes("active: true") ? ["paid_checkout_containment_active"] : []),
      ...(missingCanonicalSchemaRpc.length ? ["canonical_schema_missing_runtime_payment_rpcs"] : []),
      ...(missingHistoricalStripeTestFiles.length ? ["historical_a97_test_files_missing"] : []),
      ...(subscriptionEventsImplemented.length === 0 ? ["subscription_lifecycle_not_implemented"] : []),
    ],
  },
};

const outDir = process.env.C14_P19_EVIDENCE_DIR;
if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "STRIPE_LIFECYCLE_STATIC.json"), JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result, null, 2));

if (!result.checkout.stripeCheckoutCreatePresent) process.exitCode = 1;
if (!result.webhook.signatureConstructionPresent) process.exitCode = 1;
if (!result.durableStorage.registryHasRequiredRpcNames) process.exitCode = 1;
