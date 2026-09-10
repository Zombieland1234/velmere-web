import { safeEgressFetch } from "@/lib/network/safe-egress";
import type { StripeWebhookReconciliationSeverity } from "@/lib/payments/stripe-webhook-reconciliation-policy";

const MAX_ALERT_BYTES = 8_192;

export type StripeWebhookAlertPayload = {
  schemaVersion: "velmere.stripe-webhook-worker-alert.v1";
  severity: StripeWebhookReconciliationSeverity;
  reasonCodes: string[];
  counts: {
    staleReleased: number;
    retryReady: number;
    deadLettered: number;
    completedWithoutEvent: number;
  };
};

export type StripeWebhookAlertDelivery =
  | { state: "not_required" | "not_configured" }
  | { state: "delivered"; status: number }
  | { state: "failed"; retryable: true; errorCode: string };

function allowedHosts() {
  return (process.env.VELMERE_ALERT_WEBHOOK_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value: string) => value.trim().toLowerCase())
    .filter(Boolean);
}

function safeCode(error: unknown) {
  return (error instanceof Error ? error.message : "alert_delivery_failed")
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 120);
}

async function postPinnedJson(url: string, payload: StripeWebhookAlertPayload) {
  const hosts = allowedHosts();
  if (!hosts.length) throw new Error("alert_sink_allowlist_missing");
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body, "utf8") > MAX_ALERT_BYTES) throw new Error("alert_sink_payload_too_large");
  const response = await safeEgressFetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body, "utf8")),
      "user-agent": "velmere-stripe-webhook-worker/1",
    },
    body,
  }, {
    allowedHosts: hosts,
    allowSubdomains: false,
    maxRedirects: 0,
    timeoutMs: 5_000,
    operation: "stripe_webhook_worker_alert",
    allowedMethods: ["POST"],
    maxRequestBytes: MAX_ALERT_BYTES,
    maxResponseBytes: 16_384,
  });
  return response.status;
}

export async function emitStripeWebhookWorkerAlert(input: {
  required: boolean;
  payload: StripeWebhookAlertPayload;
}): Promise<StripeWebhookAlertDelivery> {
  if (!input.required) return { state: "not_required" };
  const url = process.env.VELMERE_ALERT_WEBHOOK_URL?.trim();
  if (!url) return { state: "not_configured" };
  try {
    const status = await postPinnedJson(url, input.payload);
    if (status < 200 || status >= 300) {
      return { state: "failed", retryable: true, errorCode: `alert_sink_http_${status}` };
    }
    return { state: "delivered", status };
  } catch (error) {
    return { state: "failed", retryable: true, errorCode: safeCode(error) };
  }
}
