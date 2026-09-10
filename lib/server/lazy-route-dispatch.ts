
export type LazyRouteMethod = "GET" | "POST" | "PUT" | "PATCH";
export type LazyRouteHandler = (request: Request) => Response | Promise<Response>;
export type LazyRouteHandlerModule = Partial<Record<LazyRouteMethod, LazyRouteHandler>>;
export type LazyRouteDescriptor = {
  readonly methods: readonly LazyRouteMethod[];
  readonly load: () => Promise<unknown>;
};
export type LazyRouteRegistry = Readonly<Record<string, LazyRouteDescriptor>>;

function response(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
      ...headers,
    },
  });
}

export async function dispatchLazyRoute(options: {
  method: LazyRouteMethod;
  key: string;
  request: Request;
  registry: LazyRouteRegistry;
  unknownError: string;
  unavailableError: string;
}) {
  const { method, key, request, registry, unknownError, unavailableError } = options;
  if (key.length > 96 || !/^[a-z0-9-]+$/.test(key) || !Object.prototype.hasOwnProperty.call(registry, key)) {
    return response({ ok: false, error: unknownError }, 404);
  }
  const descriptor = registry[key];
  if (!descriptor.methods.includes(method)) {
    return response({ ok: false, error: "method_not_allowed" }, 405, { allow: descriptor.methods.join(", ") });
  }
  let loadedModule: LazyRouteHandlerModule;
  try {
    loadedModule = (await descriptor.load()) as LazyRouteHandlerModule;
  } catch {
    return response({ ok: false, error: unavailableError }, 503, { "retry-after": "30" });
  }
  const handler = loadedModule[method];
  if (typeof handler !== "function") {
    return response({ ok: false, error: unavailableError }, 503, { "retry-after": "30" });
  }
  try {
    return await handler(request);
  } catch (err) {
    console.error('[lazy-route-dispatch ERROR]', key, err);
    return response({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

export function optionsLazyRoute(options: {
  key: string;
  registry: LazyRouteRegistry;
  unknownError: string;
}) {
  const { key, registry, unknownError } = options;
  if (key.length > 96 || !/^[a-z0-9-]+$/.test(key) || !Object.prototype.hasOwnProperty.call(registry, key)) {
    return response({ ok: false, error: unknownError }, 404);
  }
  const descriptor = registry[key];
  const allowed = new Set<string>(descriptor.methods);
  if (allowed.has("GET")) allowed.add("HEAD");
  allowed.add("OPTIONS");
  return new Response(null, {
    status: 204,
    headers: {
      allow: [...allowed].join(", "),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function invokeLazyRouteHandler(options: {
  method: LazyRouteMethod;
  request: Request;
  load: () => Promise<unknown>;
  unavailableError: string;
}) {
  const { method, request, load, unavailableError } = options;
  let loadedModule: LazyRouteHandlerModule;
  try {
    loadedModule = (await load()) as LazyRouteHandlerModule;
  } catch {
    return response({ ok: false, error: unavailableError }, 503, { "retry-after": "30" });
  }
  const handler = loadedModule[method];
  if (typeof handler !== "function") {
    return response({ ok: false, error: unavailableError }, 503, { "retry-after": "30" });
  }
  return handler(request);
}
