import {snapshotData} from "./data-input";
/**
 * C5 evaluator integrated into the recovered C6 runtime delivery boundary.
 * This does not assert identity with the missing UI2 archive.
 * Load policies only from a trusted server-owned registry. Never accept a policy
 * or `nowMs` from a browser/request. This is a permission evaluator, not a license
 * verifier, signature verifier, customer entitlement gate, or provider adapter.
 */
export const OPERATIONS = Object.freeze([
  'fetch', 'derive', 'display_derived', 'export_derived_pdf',
  'export_derived_json', 'export_raw', 'cache', 'llm_inference', 'model_training',
] as const);
export type Operation = typeof OPERATIONS[number];
export type Environment = 'internal_test' | 'closed_beta' | 'production';
export interface Request {
  providerId: string;
  datasetId: string;
  productId: string;
  environment: Environment;
  operations: Operation[];
  cacheTtlSeconds?: number;
}
export interface Policy {
  schemaVersion: 'velmere.provider-use-policy.v1';
  providerId: string;
  policyVersion: string;
  status: 'approved' | 'review_pending' | 'revoked';
  evidence: {
    reference: string;
    reviewStatus: 'verified' | 'pending';
    verifiedAt: string;
    reviewBy: string;
    effectiveFrom: string;
    expiresAt: string | null;
  };
  grants: {
    datasetId: string;
    productId: string;
    environment: Environment;
    operations: Operation[];
    maxCacheTtlSeconds?: number;
  }[];
}
export interface Decision {
  allowed: boolean;
  code: string;
  providerId: string | null;
  policyVersion: string | null;
  evidenceReference: string | null;
  evaluatedAtMs: number | null;
  /** Exclusive wall-clock deadline; NOT a cached authorization or revocation lease. */
  validUntilMs: number | null;
  deniedOperations: string[];
}
const ENVIRONMENTS = new Set(['internal_test', 'closed_beta', 'production']);
const OPS = new Set<string>(OPERATIONS);
const has = (x: object, k: string): boolean => Object.prototype.hasOwnProperty.call(x, k);
function object(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
    && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
}
function text(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 512
    && x.trim() === x && [...x].every(c => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127) && x !== '*';
}
function operations(x: unknown): x is Operation[] {
  return Array.isArray(x) && x.length > 0 && x.length <= OPERATIONS.length
    && x.every(o => typeof o === 'string' && OPS.has(o)) && new Set(x).size === x.length;
}
function positiveInteger(x: unknown): x is number {
  return typeof x === 'number' && Number.isSafeInteger(x) && x > 0;
}
/** Accept canonical UTC instants only, rejecting silent date normalization. */
function instant(x: unknown): number | null {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(x)) return null;
  const ms = Date.parse(x);
  if (!Number.isFinite(ms)) return null;
  const canonical = x.includes('.') ? x : x.replace('Z', '.000Z');
  return new Date(ms).toISOString() === canonical ? ms : null;
}
function validRequest(x: unknown): x is Request {
  return object(x) && ['providerId', 'datasetId', 'productId', 'environment', 'operations'].every(k=>has(x,k))
    && text(x.providerId) && text(x.datasetId) && text(x.productId)
    && typeof x.environment === 'string' && ENVIRONMENTS.has(x.environment)
    && operations(x.operations)
    && (!has(x, 'cacheTtlSeconds') || positiveInteger(x.cacheTtlSeconds))
    && (!x.operations.includes('cache') || positiveInteger(x.cacheTtlSeconds));
}
function validPolicy(x: unknown): x is Policy {
  if (!object(x) || !['schemaVersion','providerId','policyVersion','status','evidence','grants'].every(k=>has(x,k))
      || x.schemaVersion !== 'velmere.provider-use-policy.v1'
      || !text(x.providerId) || !text(x.policyVersion)
      || (typeof x.status !== 'string' || !['approved','review_pending','revoked'].includes(x.status))
      || !object(x.evidence) || !Array.isArray(x.grants) || x.grants.length > 1000) return false;
  const e=x.evidence;
  if (!['reference','reviewStatus','verifiedAt','reviewBy','effectiveFrom','expiresAt'].every(k=>has(e,k))
      || !text(e.reference) || (typeof e.reviewStatus !== 'string' || !['verified','pending'].includes(e.reviewStatus))
      || instant(e.verifiedAt)===null || instant(e.reviewBy)===null || instant(e.effectiveFrom)===null
      || !(e.expiresAt===null || instant(e.expiresAt)!==null)) return false;
  return x.grants.every(g => object(g)
    && ['datasetId','productId','environment','operations'].every(k=>has(g,k))
    && text(g.datasetId) && text(g.productId)
    && typeof g.environment==='string' && ENVIRONMENTS.has(g.environment)
    && operations(g.operations)
    && (!has(g,'maxCacheTtlSeconds') || positiveInteger(g.maxCacheTtlSeconds))
    && (!g.operations.includes('cache') || positiveInteger(g.maxCacheTtlSeconds)));
}
/** Re-evaluate at fetch, cache write, customer display, and each export. */
export function evaluateProviderUse(policyInput: unknown, requestInput: unknown, nowMs: number): Decision {
  const base: Decision = { allowed:false,code:'INVALID_CLOCK',providerId:null,policyVersion:null,
    evidenceReference:null,evaluatedAtMs:null,validUntilMs:null,deniedOperations:[] };
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8_640_000_000_000_000) return base;
  base.evaluatedAtMs=nowMs;
  const requestSnapshot = snapshotData(requestInput);
  if (!requestSnapshot.ok || !validRequest(requestSnapshot.value)) return {...base,code:'INVALID_REQUEST'};
  const request=requestSnapshot.value;
  base.providerId=request.providerId;
  const policySnapshot = snapshotData(policyInput);
  if (!policySnapshot.ok || !validPolicy(policySnapshot.value)) return {...base,code:'INVALID_POLICY'};
  const policy=policySnapshot.value;
  base.policyVersion=policy.policyVersion;
  base.evidenceReference=policy.evidence.reference;
  if (policy.providerId!==request.providerId) return {...base,code:'PROVIDER_MISMATCH'};
  if (policy.status!=='approved') return {...base,code:policy.status==='revoked'?'POLICY_REVOKED':'POLICY_NOT_APPROVED'};
  const e=policy.evidence;
  if(e.reviewStatus!=='verified') return {...base,code:'EVIDENCE_NOT_VERIFIED'};
  const reviewed=instant(e.verifiedAt)!; const reviewBy=instant(e.reviewBy)!; const effective=instant(e.effectiveFrom)!;
  const expiry=e.expiresAt===null ? null : instant(e.expiresAt)!;
  if(reviewBy<=reviewed || (expiry!==null && expiry<=effective)) return {...base,code:'INVALID_EVIDENCE_WINDOW'};
  if(reviewed>nowMs || effective>nowMs) return {...base,code:'EVIDENCE_NOT_YET_EFFECTIVE'};
  if(nowMs>=reviewBy) return {...base,code:'EVIDENCE_REVIEW_DUE'};
  if(expiry!==null && nowMs>=expiry) return {...base,code:'PERMISSION_EXPIRED'};
  const grants=policy.grants.filter(g => g.datasetId===request.datasetId
    && g.productId===request.productId && g.environment===request.environment);
  if(grants.length===0) return {...base,code:'SCOPE_NOT_APPROVED',deniedOperations:[...request.operations]};
  const denied=request.operations.filter(op => !grants.some(g => g.operations.includes(op)
    && (op!=='cache' || (request.cacheTtlSeconds! <= g.maxCacheTtlSeconds!))));
  if (request.operations.includes('cache')) {
    const cacheWindowSeconds = Math.floor((Math.min(reviewBy, expiry ?? reviewBy) - nowMs) / 1000);
    if (request.cacheTtlSeconds! > cacheWindowSeconds && !denied.includes('cache')) denied.push('cache');
  }
  if(denied.length) return {...base,code:'OPERATION_NOT_APPROVED',deniedOperations:denied};
  return {...base,allowed:true,code:'ALLOW',validUntilMs:Math.min(reviewBy,expiry ?? reviewBy)};
}
