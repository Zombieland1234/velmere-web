import { randomUUID } from "node:crypto";
import { emitAuthSecurityAlert, type AuthSecurityAlertPayload } from "@/lib/observability/auth-security-alert-sink";
import { runRegisteredServiceRoleRpc, type SupabaseRpcOperation } from "@/lib/db/supabase-rpc-operation-registry";

type RpcRunner=(input:{operation:SupabaseRpcOperation;args?:Record<string,unknown>})=>Promise<{data:unknown}>;
export type AuthSecurityAlertWorkerDependencies={rpc:RpcRunner;emit:typeof emitAuthSecurityAlert;workerToken:()=>string};
export const authSecurityAlertWorkerDependencies:AuthSecurityAlertWorkerDependencies={rpc:runRegisteredServiceRoleRpc,emit:emitAuthSecurityAlert,workerToken:randomUUID};
type AlertRow={id:number;event_family:AuthSecurityAlertPayload["eventFamily"];outcome:AuthSecurityAlertPayload["outcome"];severity:AuthSecurityAlertPayload["severity"];event_count:number;time_bucket:string};
const AUTH_ALERT_ROW_KEYS = ["event_count", "event_family", "id", "outcome", "severity", "time_bucket"] as const;
function rows(data:unknown):AlertRow[]{
  if(!Array.isArray(data))throw new Error("auth_alert_claim_telemetry_invalid:not_array");
  return data.map((item,index)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`auth_alert_claim_telemetry_invalid:row_${index}`);
    const row=item as Record<string,unknown>;
    if(Object.keys(row).sort().join("|")!==AUTH_ALERT_ROW_KEYS.join("|"))throw new Error(`auth_alert_claim_telemetry_invalid:keys_${index}`);
    if(!Number.isSafeInteger(row.id)||Number(row.id)<=0)throw new Error(`auth_alert_claim_telemetry_invalid:id_${index}`);
    if(!["session","oauth","recovery","binding","rls"].includes(String(row.event_family)))throw new Error(`auth_alert_claim_telemetry_invalid:event_family_${index}`);
    if(!["rejected","conflict","unavailable"].includes(String(row.outcome)))throw new Error(`auth_alert_claim_telemetry_invalid:outcome_${index}`);
    if(!["medium","high","critical"].includes(String(row.severity)))throw new Error(`auth_alert_claim_telemetry_invalid:severity_${index}`);
    if(!Number.isSafeInteger(row.event_count)||Number(row.event_count)<1||Number(row.event_count)>1_000_000)throw new Error(`auth_alert_claim_telemetry_invalid:event_count_${index}`);
    if(typeof row.time_bucket!=="string"||!Number.isFinite(Date.parse(row.time_bucket)))throw new Error(`auth_alert_claim_telemetry_invalid:time_bucket_${index}`);
    return {
      id:Number(row.id),
      event_family:row.event_family as AlertRow["event_family"],
      outcome:row.outcome as AlertRow["outcome"],
      severity:row.severity as AlertRow["severity"],
      event_count:Number(row.event_count),
      time_bucket:new Date(row.time_bucket).toISOString(),
    };
  });
}
export async function runAuthSecurityAlertWorker(input:{limit?:number;leaseSeconds?:number}={},dependencies:AuthSecurityAlertWorkerDependencies=authSecurityAlertWorkerDependencies){
  const limit=Math.max(1,Math.min(Math.trunc(input.limit??20),100)); const leaseSeconds=Math.max(15,Math.min(Math.trunc(input.leaseSeconds??60),300)); const workerToken=dependencies.workerToken();
  const claimed=await dependencies.rpc({operation:"auth_alert_worker_claim",args:{p_limit:limit,p_lease_seconds:leaseSeconds,p_worker_token:workerToken}});
  const items=rows(claimed.data); const summary={schemaVersion:"velmere.auth-security-alert-worker.v1" as const,claimed:items.length,delivered:0,retried:0,deadLettered:0,conflicts:0,notConfigured:0};
  for(const item of items){
    const delivery=await dependencies.emit({schemaVersion:"velmere.auth-security-alert.v1",severity:item.severity,eventFamily:item.event_family,outcome:item.outcome,eventCount:Math.max(1,Math.min(item.event_count,1_000_000)),timeBucket:new Date(item.time_bucket).toISOString()});
    const delivered=delivery.state==="delivered"; const errorCode=delivery.state==="failed"?delivery.errorCode:delivery.state==="not_configured"?"alert_sink_not_configured":"";
    const settled=await dependencies.rpc({operation:"auth_alert_event_settle",args:{p_id:item.id,p_worker_token:workerToken,p_delivered:delivered,p_error_code:errorCode}});
    const status=typeof settled.data==="string"?settled.data:"";
    if(delivered&&status==="delivered")summary.delivered+=1;
    else if(!delivered&&status==="dead_letter")summary.deadLettered+=1;
    else if(!delivered&&status==="retry")summary.retried+=1;
    else summary.conflicts+=1;
    if(delivery.state==="not_configured")summary.notConfigured+=1;
  }
  return summary;
}
