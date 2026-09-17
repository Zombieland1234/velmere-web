/** Safe CLI diagnostic: reads configuration, never prints credential values or marks connectivity PASS. */
import { inspectDurableRateLimitRuntime } from '../../lib/security/durable-rate-limit';
import { buildPrivacyFingerprintReadiness } from '../../lib/security/privacy-fingerprint';
import { inspectSignedProxyConfig } from '../../lib/security/signed-proxy-identity';
const durable=inspectDurableRateLimitRuntime();const privacy=buildPrivacyFingerprintReadiness();
const profile=process.env.VELMERE_TRUSTED_PROXY_PROFILE;
const trustedProxyConfigured=profile==='signed_proxy'?inspectSignedProxyConfig().configured:profile==='vercel'&&process.env.VERCEL==='1'&&['preview','production','development'].includes(process.env.VERCEL_ENV??'');
const blockers=[!trustedProxyConfigured?'TRUSTED_PROXY_CONFIGURATION_MISSING':null,!privacy.productionReady?'FINGERPRINT_SECRET_MISSING_OR_WEAK':null,!durable.productionConfigured?'DURABLE_STORAGE_CONFIGURATION_MISSING':null].filter(Boolean);
console.log(JSON.stringify({at:new Date().toISOString(),sourceSha:process.env.GITHUB_SHA??process.env.VERCEL_GIT_COMMIT_SHA??null,profile:profile??'unconfigured',productionLike:durable.productionLike,storageMode:durable.mode,configuredAdapter:durable.exactRuntimeAdapter,trustedProxyConfigured,privacySecretConfigured:privacy.productionReady,configurationReady:blockers.length===0,connectivityVerified:false,blockers},null,2));
if(blockers.length)process.exitCode=1;
