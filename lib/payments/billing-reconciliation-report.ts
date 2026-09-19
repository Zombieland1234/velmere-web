/** Strict reader of the Q9 read-only diagnostic. Never authorizes access/repair.
 * Fingerprints are correlatable pseudonymous identifiers, not anonymized data.
 */
export const RECONCILIATION_CODES = {
  ACTIVE_GRANT_UNDER_TERMINAL_HOLD: ['error','entitlement'],
  HOLD_GRANT_BINDING_MISMATCH: ['error','hold'],
  WATERMARK_IDENTITY_MISMATCH: ['error','watermark'],
  EFFECT_EVENT_TYPE_MISMATCH: ['error','effect'],
  EVENT_LEASE_EXPIRED: ['warning','event'],
  EFFECT_LEASE_EXPIRED: ['warning','effect'],
  EVENT_RETRY_PENDING: ['warning','event'],
  EFFECT_RETRY_PENDING: ['warning','effect'],
  EVENT_DEAD_LETTER: ['warning','event'],
  EFFECT_DEAD_LETTER: ['warning','effect'],
  EFFECT_WITHOUT_INBOX: ['warning','effect'],
  PROCESSED_EVENT_WITH_UNFINISHED_EFFECT: ['warning','effect'],
  COMPLETED_TERMINAL_EFFECT_WITHOUT_LIFECYCLE: ['error','effect'],
} as const;
export type ReconciliationCode = keyof typeof RECONCILIATION_CODES;
export type ReconciliationIssue = {code:ReconciliationCode;severity:'error'|'warning';entity:'entitlement'|'event'|'effect'|'hold'|'watermark';fingerprint:string};
const countKeys = ['entitlements','lifecycleEvents','effects','events','eventIdentities','watermarks','terminalHolds'] as const;
export type BillingReconciliationReport = {
  schema:'velmere.billing-reconciliation.v1'; scope:'INTERNAL_DATABASE_CONSISTENCY_NOT_STRIPE_TRUTH';
  observedAt:string;readOnly:true;releaseApproved:false;sampleLimit:100;
  counts:Record<typeof countKeys[number],number>;
  issueCount:number;errorCount:number;warningCount:number;truncated:boolean;
  verdict:'EMPTY'|'REVIEW_REQUIRED'|'CONSISTENT_WITHIN_SCOPE';issues:ReconciliationIssue[];
};
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_RECONCILIATION_REPORT');
  return value as Record<string,unknown>;
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):void {
  if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(value,k)))throw new Error('INVALID_RECONCILIATION_REPORT');
}
function count(value:unknown):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('INVALID_RECONCILIATION_REPORT');
  return value;
}
export function parseBillingReconciliationReport(input:unknown):BillingReconciliationReport {
  const r=record(input);
  exactKeys(r,['schema','scope','observedAt','readOnly','releaseApproved','sampleLimit','counts','issueCount','errorCount','warningCount','truncated','verdict','issues']);
  if(r.schema!=='velmere.billing-reconciliation.v1'||r.scope!=='INTERNAL_DATABASE_CONSISTENCY_NOT_STRIPE_TRUTH'||r.readOnly!==true||r.releaseApproved!==false||r.sampleLimit!==100)throw new Error('INVALID_RECONCILIATION_REPORT');
  if(typeof r.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.observedAt)||!Number.isFinite(Date.parse(r.observedAt))||new Date(r.observedAt).toISOString()!==r.observedAt)throw new Error('INVALID_RECONCILIATION_REPORT');
  const c=record(r.counts);exactKeys(c,countKeys);
  const counts=Object.fromEntries(countKeys.map(k=>[k,count(c[k])])) as BillingReconciliationReport['counts'];
  const issueCount=count(r.issueCount),errorCount=count(r.errorCount),warningCount=count(r.warningCount);
  if(errorCount+warningCount!==issueCount||!Number.isSafeInteger(errorCount+warningCount)||r.truncated!==(issueCount>100)||!Array.isArray(r.issues)||r.issues.length!==Math.min(issueCount,100))throw new Error('INVALID_RECONCILIATION_REPORT');
  const seen=new Set<string>();
  const issues:ReconciliationIssue[]=r.issues.map(value=>{
    const i=record(value);exactKeys(i,['code','severity','entity','fingerprint']);
    if(typeof i.code!=='string'||!Object.prototype.hasOwnProperty.call(RECONCILIATION_CODES,i.code))throw new Error('INVALID_RECONCILIATION_REPORT');
    const code=i.code as ReconciliationCode,[severity,entity]=RECONCILIATION_CODES[code];
    if(i.severity!==severity||i.entity!==entity||typeof i.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(i.fingerprint))throw new Error('INVALID_RECONCILIATION_REPORT');
    const key=code+':'+i.fingerprint;if(seen.has(key))throw new Error('INVALID_RECONCILIATION_REPORT');seen.add(key);
    return {code,severity,entity,fingerprint:i.fingerprint};
  });
  const sampledErrors=issues.filter(i=>i.severity==='error').length,sampledWarnings=issues.length-sampledErrors;
  if(sampledErrors>errorCount||sampledWarnings>warningCount||(!r.truncated&&(sampledErrors!==errorCount||sampledWarnings!==warningCount)))throw new Error('INVALID_RECONCILIATION_REPORT');
  const verdict:BillingReconciliationReport['verdict']=issueCount>0?'REVIEW_REQUIRED':Object.values(counts).every(v=>v===0)?'EMPTY':'CONSISTENT_WITHIN_SCOPE';
  if(r.verdict!==verdict)throw new Error('INVALID_RECONCILIATION_REPORT');
  return {schema:r.schema,scope:r.scope,observedAt:r.observedAt,readOnly:true,releaseApproved:false,sampleLimit:100,counts,issueCount,errorCount,warningCount,truncated:issueCount>100,verdict,issues};
}
