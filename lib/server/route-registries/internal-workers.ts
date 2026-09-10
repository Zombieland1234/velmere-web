import type { LazyRouteRegistry } from "@/lib/server/lazy-route-dispatch";

export const INTERNAL_WORKERS_ROUTES = {
  "auth-security-alerts": { methods: ["POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/auth-security-alerts") },
  "commerce-fulfilment-outbox": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/commerce-fulfilment-outbox") },
  "durable-computation-alerts": { methods: ["POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/durable-computation-alerts") },
  "durable-computation-operations": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/durable-computation-operations") },
  "durable-computation-promotion": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/durable-computation-promotion") },
  "fulfilment-incident-outbox": { methods: ["POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/fulfilment-incident-outbox") },
  "fulfilment-provider-sync": { methods: ["POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/fulfilment-provider-sync") },
  "stripe-webhook-reconciliation": { methods: ["POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/stripe-webhook-reconciliation") },
  "verify-continuous-monitor": { methods: ["GET", "POST"] as const, load: () => import("@/lib/server/internal-worker-route-modules/verify-continuous-monitor") },
} as const satisfies LazyRouteRegistry;
