import { safeEgressFetch } from "@/lib/network/safe-egress";

const MAX_ALERT_BYTES = 4096;
export type AuthSecurityAlertPayload = {
  schemaVersion: "velmere.auth-security-alert.v1";
  severity: "medium" | "high" | "critical";
  eventFamily: "session" | "oauth" | "recovery" | "binding" | "rls";
  outcome: "rejected" | "conflict" | "unavailable";
  eventCount: number;
  timeBucket: string;
};
export type AuthSecurityAlertDelivery = { state: "not_configured" } | { state: "delivered"; status: number } | { state: "failed"; retryable: true; errorCode: string };
function allowedHosts() { return (process.env.VELMERE_ALERT_WEBHOOK_ALLOWED_HOSTS ?? "").split(",").map((x: string) => x.trim().toLowerCase()).filter(Boolean); }
function safeCode(error: unknown) { return (error instanceof Error ? error.message : "auth_alert_delivery_failed").replace(/[^a-zA-Z0-9:_-]/g,"_").slice(0,120); }
async function postPinnedJson(url: string, payload: AuthSecurityAlertPayload) {
  const hosts = allowedHosts(); if (!hosts.length) throw new Error("alert_sink_allowlist_missing");
  const body=JSON.stringify(payload); if(Buffer.byteLength(body)>MAX_ALERT_BYTES) throw new Error("alert_sink_payload_too_large");
  const response=await safeEgressFetch(url,{method:"POST",headers:{"content-type":"application/json","content-length":String(Buffer.byteLength(body)),"user-agent":"velmere-auth-security-worker/1"},body},{
    allowedHosts:hosts,allowSubdomains:false,maxRedirects:0,timeoutMs:5000,operation:"auth_security_alert",allowedMethods:["POST"],maxRequestBytes:MAX_ALERT_BYTES,maxResponseBytes:16_384,
  });
  return response.status;
}
export async function emitAuthSecurityAlert(payload: AuthSecurityAlertPayload): Promise<AuthSecurityAlertDelivery> {
  const url=process.env.VELMERE_ALERT_WEBHOOK_URL?.trim(); if(!url) return {state:"not_configured"};
  try { const status=await postPinnedJson(url,payload); return status>=200&&status<300?{state:"delivered",status}:{state:"failed",retryable:true,errorCode:`alert_sink_http_${status}`}; }
  catch(error){ return {state:"failed",retryable:true,errorCode:safeCode(error)}; }
}
