# C12 deployment requirements

C12 does not disable production rate limiting. The initial C11 503 is a closed
configuration gate (trusted ingress, dedicated fingerprint HMAC and durable
storage). `config-preflight.ts` diagnoses configuration only; it does not claim
that the storage is reachable or a runtime report executed.

Existing Vercel profile remains unchanged: set `VELMERE_TRUSTED_PROXY_PROFILE=vercel`
on Vercel, use the overwritten Vercel client address header, configure a dedicated
`VELMERE_SECURITY_FINGERPRINT_SECRET` of at least 32 bytes, and configure a real
durable backend. All secrets belong in the platform's secret manager.

C12 adds opt-in `VELMERE_RATE_LIMIT_BACKEND=redis` plus `REDIS_URL` using the
maintainer's pinned `@redis/client@6.2.1`. Remote Redis requires `rediss://` with
certificate verification. Plaintext is only allowed to explicit loopback addresses.
The URL is never read from HTTP input. No fallback to process memory, no automatic
command replay or offline queue. Atomic Lua uses the Redis server clock. Each call
has a 2200ms budget; failure is a 503. Shared state is Redis state; select persistence,
HA, backup and ACL policy appropriate to the real deployment. CI persistence is not
proof of your hosted Redis disaster recovery.

A separately managed private ingress may use `VELMERE_TRUSTED_PROXY_PROFILE=signed_proxy`.
Configure `VELMERE_PROXY_HMAC_SECRET` (64 random hex digits, distinct from the
fingerprint key) and `VELMERE_PROXY_HMAC_AUDIENCE` (3-96 lowercase letters/digits,
period, underscore, dash; first char alphanumeric). The ingress MUST overwrite
all `x-velmere-proxy-*` headers, derive the address from its actual socket peer and
never echo/log the signature. An upstream CDN needs its own trusted IP procedure.
Do not copy client-controlled XFF into this assertion.

For `address`, Unix millisecond `timestamp`, and configured `audience`, sign UTF-8:
`velmere-proxy-address-v1\n${audience}\n${timestamp}\n${address}`
using HMAC-SHA256; lowercase hex goes in `x-velmere-proxy-signature`, the exact IP
in `x-velmere-proxy-address`, timestamp in `x-velmere-proxy-time`. Assertions are
valid at most 30 seconds, with 2 seconds future skew. This authenticates a limiter
identity ONLY, NOT the user, body, route, payment or entitlement. A replay retains
the same identity and consumes its quota. Production APIs still enforce sessions,
entitlements, provider rules and bounded input independently.

`production-e2e.mjs` launches the unchanged production Next build, local real Redis
with AOF, and a private loopback HMAC proxy using randomly generated ephemeral keys.
It does not pretend to be Vercel, override Auth/RPC/worker functions, or issue paid
grants. It tests Basic runtime JSON/PDF/SSR, anonymous paid denial, two app instances,
shared quotas, forged headers, a Redis outage and recovery. Public RPC dependency
failures remain failures. This is a self-hosted CI qualification, not hosted Vercel
or Stripe checkout. Credentials and Redis database files are removed, not uploaded.

Vercel connector did not expose environment-variable read/write actions in this
session. Do not assume the new native Redis backend or signed proxy is enabled on
Vercel just because its preview compiled. No automatic production promotion.
