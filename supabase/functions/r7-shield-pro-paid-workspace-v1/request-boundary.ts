/** Transport guard for the existing Shield workspace handler; never grants access. */
export const workspaceRequestBoundaryVersion = 'velmere.c8.workspace-request-boundary.v1';
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};
const fail = (status: number, error: string) => new Response(JSON.stringify({ ok: false, error }), { status, headers });

export async function guardWorkspaceRequest(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  options: { maxDurationMs?: number } = {},
): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');
  const duration = options.maxDurationMs ?? 10_000;
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 30_000) {
    return fail(503, 'runtime_unavailable');
  }
  const maxBytes = 4096;
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return fail(415, 'json_content_type_required');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    return fail(400, 'request_framing_invalid');
  }
  if (length !== null && Number(length) > maxBytes) return fail(413, 'request_too_large');
  const transfer = request.headers.get('transfer-encoding');
  if ((transfer !== null && (transfer.trim().toLowerCase() !== 'chunked' || length !== null)) ||
      (request.headers.has('content-encoding') && request.headers.get('content-encoding')?.toLowerCase() !== 'identity')) {
    return fail(400, 'request_framing_invalid');
  }
  if (request.signal.aborted) return fail(400, 'request_aborted');
  if (!request.body) return fail(400, 'invalid_body');
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = request.body.getReader(); }
  catch { return fail(400, 'invalid_body'); }
  let stopRead: ((reason: Error) => void) | undefined;
  let timedOut = false;
  const expires = performance.now() + duration;
  const timer = setTimeout(() => { timedOut = true; stopRead?.(new Error('timeout')); }, duration);
  const abort = () => stopRead?.(new Error('abort'));
  request.signal.addEventListener('abort', abort, { once: true });
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  const storage = new Uint8Array(maxBytes);
  let size = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new Error('abort');
      if (performance.now() >= expires) { timedOut = true; throw new Error('timeout'); }
      const chunk = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        stopRead = reject;
        void reader.read().then(resolve, reject);
      });
      stopRead = undefined;
      if (request.signal.aborted) throw new Error('abort');
      if (performance.now() >= expires) { timedOut = true; throw new Error('timeout'); }
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) throw new Error('chunk');
      if (chunk.value.length > maxBytes - size) { cancel(); return fail(413, 'request_too_large'); }
      storage.set(chunk.value, size);
      size += chunk.value.length;
    }
  } catch {
    cancel();
    return fail(timedOut ? 408 : 400, timedOut ? 'request_timeout' : 'invalid_body');
  } finally {
    stopRead = undefined;
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  if (length !== null && Number(length) !== size) return fail(400, 'request_framing_invalid');
  const bytes = storage.slice(0, size);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('number');
      return value;
    });
  } catch { return fail(400, 'invalid_json'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'request_shape_invalid');
  const fields = parsed as Record<string, unknown>;
  if (['schemaVersion', 'tier', 'locale', 'operation'].some(key =>
    fields[key] !== undefined && typeof fields[key] !== 'string') ||
    (fields.workspaceId !== undefined && fields.workspaceId !== null && typeof fields.workspaceId !== 'string')) {
    return fail(400, 'request_field_type_invalid');
  }
  // Preserve original bytes, headers, schema validation, Auth.getUser and RPC authorization.
  // The existing handler now sees at most 4096 bytes from memory, never an unbounded stream.
  try { return await handler(new Request(request, { body: bytes })); }
  catch { return fail(503, 'workspace_unavailable'); }
}
