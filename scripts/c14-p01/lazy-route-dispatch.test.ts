import test from "node:test";
import assert from "node:assert/strict";
import {
  dispatchLazyRoute,
  type LazyRouteRegistry,
} from "../../lib/server/lazy-route-dispatch";

test("lazy route handler failures never disclose raw exception details", async () => {
  const sensitive = "provider https://db.internal.example/internal-sensitive-marker-c14p01 phrase-c14p01-sensitive-material";
  const registry = {
    explode: {
      methods: ["GET"] as const,
      load: async () => ({
        GET: async () => {
          throw new Error(sensitive);
        },
      }),
    },
  } as const satisfies LazyRouteRegistry;

  const captured: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map((value) => value instanceof Error ? (value.stack ?? value.message) : String(value)).join(" "));
  };

  try {
    const response = await dispatchLazyRoute({
      method: "GET",
      key: "explode",
      request: new Request("https://velmere.test/api/internal/workers/explode"),
      registry,
      unknownError: "unknown_internal_worker",
      unavailableError: "internal_worker_temporarily_unavailable",
    });
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 500);
    assert.equal(body.error, "internal_worker_temporarily_unavailable");
    assert.doesNotMatch(JSON.stringify(body), /db\\.internal|internal-sensitive-marker-c14p01|phrase-c14p01-sensitive-material/i);
    assert.doesNotMatch(captured.join("\n"), /db\\.internal|internal-sensitive-marker-c14p01|phrase-c14p01-sensitive-material/i);
  } finally {
    console.error = originalError;
  }
});
