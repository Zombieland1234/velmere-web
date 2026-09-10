import { randomUUID } from "node:crypto";
import { sanitizeVlmText } from "@/lib/ai/vlm-security";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { reportApiError } from "@/lib/security/api-error-envelope";
import { readBoundedBodyBytes } from "@/lib/security/payment-webhook-guard";
import { POST as angelPost } from "@/app/api/angel/route";

const STREAM_PROTOCOL = "angel-sse-v1" as const;
const PROVIDER_DEADLINE_MS = 34_000;
const MAX_REPLY_CHARS = 12_000;
const MAX_CHUNKS = 180;
const MIN_DELTA_DELAY_MS = 10;

type AngelJsonPayload = {
  reply?: string;
  providerMode?: string;
  model?: string | null;
  diagnostics?: Record<string, unknown>;
  entitlement?: Record<string, unknown>;
  error?: string;
};

function sseEncode(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function safeEntitlement(value: Record<string, unknown> | undefined) {
  if (!value) return null;
  return {
    depth: typeof value.depth === "string" ? value.depth : null,
    paidRequired: value.paidRequired === true,
    accessMode: typeof value.accessMode === "string" ? value.accessMode : null,
  };
}

function streamProviderError(error: unknown) {
  const reported = reportApiError(error, {
    route: "/api/angel/stream",
    code: "angel_stream_bootstrap_failed",
    status: 500,
  });
  return securityJson({
    error: "Angel stream bootstrap failed.",
    providerError: reported.publicCode,
    correlationId: reported.correlationId,
  }, { status: reported.status });
}

function chunkReply(reply: string) {
  const clean = sanitizeVlmText(reply, MAX_REPLY_CHARS).replace(/\r\n/g, "\n");
  if (!clean) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    const remaining = clean.length - cursor;
    const size = remaining > 900 ? 190 : remaining > 360 ? 128 : 80;
    const chunkWindow = clean.slice(cursor, cursor + size + 42);
    const breaks = Array.from(chunkWindow.matchAll(/[\s.,;:!?\n]/g)).map((match) => match.index ?? 0);
    const best =
      breaks.filter((index) => index >= size * 0.55 && index <= size + 42).at(-1) ??
      breaks.filter((index) => index >= size * 0.45).at(0) ??
      size;
    const end = Math.min(clean.length, cursor + best);
    chunks.push(clean.slice(cursor, Math.max(cursor + 1, end)));
    cursor = Math.max(cursor + 1, end);
  }
  return chunks;
}

export async function POST(req: Request) {
  const sizeGuard = rejectLargeContentLength(req, 48 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(req, {
    allowMissingOrigin: process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production",
  });
  if (originGuard) return originGuard;
  const rateLimit = await applyApiRateLimit(req, { keyPrefix: "angel-chat-stream", limit: 30, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const boundedBody = await readBoundedBodyBytes(req, 48 * 1024);
  if (!boundedBody.ok) return boundedBody.response;
  // Keep the exact bytes: the inner Angel route performs the JSON parse and
  // must see precisely the stream that crossed this outer boundary.
  const innerRequestBody = boundedBody.bytes.slice();
  const requestUrl = req.url;
  const requestMethod = req.method;
  const requestHeaders = new Headers(req.headers);
  const requestId = sanitizeVlmText(req.headers.get("x-velmere-angel-request"), 120) || randomUUID();
  let bridgeAbortController: AbortController | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const write = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          if (controller.desiredSize !== null && controller.desiredSize < -32) {
            closed = true;
            bridgeAbortController?.abort();
            try {
              controller.close();
            } catch {
              // The stream may already be closed by a concurrent disconnect.
            }
            return;
          }
          controller.enqueue(encoder.encode(sseEncode(event, { ...data, requestId, protocol: STREAM_PROTOCOL })));
        } catch {
          closed = true;
          bridgeAbortController?.abort();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Closing an already-closed stream is an idempotent terminal outcome.
        }
      };

      write("meta", { status: 102, providerMode: "provider_pending", statusLabel: "provider pending" });
      const heartbeatStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        write("heartbeat", {
          status: 102,
          providerMode: "provider_pending",
          at: new Date().toISOString(),
          elapsedMs: Date.now() - heartbeatStartedAt,
          softDeadlineMs: PROVIDER_DEADLINE_MS,
        });
      }, 2_500);

      bridgeAbortController = new AbortController();
      const providerAbortController = bridgeAbortController;
      const requestAbortListener = () => providerAbortController.abort();
      req.signal.addEventListener("abort", requestAbortListener, { once: true });
      let providerDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        const providerDeadline = new Promise<Response>((resolve) => {
          providerDeadlineTimer = setTimeout(() => {
            providerAbortController.abort();
            resolve(securityJson({ error: "Angel stream provider deadline reached safely." }, { status: 504 }));
          }, PROVIDER_DEADLINE_MS);
        });
        const providerRequest = new Request(requestUrl, {
          method: requestMethod,
          headers: requestHeaders,
          body: innerRequestBody.byteLength ? innerRequestBody : undefined,
          signal: providerAbortController.signal,
        });
        const innerResponse = await Promise.race([angelPost(providerRequest), providerDeadline])
          .catch(streamProviderError);
        const status = innerResponse.status;
        const payload = await readJsonResponseBounded<AngelJsonPayload>(innerResponse, 128 * 1024).catch(() => ({} as AngelJsonPayload));
        const entitlement = safeEntitlement(payload.entitlement);

        write("meta", {
          status,
          providerMode: payload.providerMode ?? "unknown",
          model: payload.model ?? null,
          entitlement,
        });

        if (status < 200 || status >= 300 || !payload.reply) {
          write("error", {
            error: payload.error ?? "Angel stream could not produce a reply.",
            status,
            providerMode: payload.providerMode ?? "error",
            entitlement,
          });
          return;
        }

        const finalReply = sanitizeVlmText(String(payload.reply), MAX_REPLY_CHARS);
        const rawChunks = chunkReply(finalReply);
        const chunks = rawChunks.slice(0, MAX_CHUNKS);
        const finishReason = rawChunks.length > MAX_CHUNKS
          ? "chunk_cap_reached"
          : finalReply.length >= MAX_REPLY_CHARS
            ? "reply_char_cap_reached"
            : "complete";
        for (const chunk of chunks) {
          if (closed || providerAbortController.signal.aborted) return;
          write("delta", { delta: chunk });
          await new Promise((resolve) => setTimeout(resolve, MIN_DELTA_DELAY_MS));
        }
        write("done", {
          reply: finalReply,
          providerMode: payload.providerMode ?? "unknown",
          model: payload.model ?? null,
          entitlement,
          finishReason,
        });
      } catch (error) {
        if (!providerAbortController.signal.aborted) {
          const reported = reportApiError(error, {
            route: "/api/angel/stream",
            code: "angel_stream_runtime_failed",
            status: 500,
          });
          write("error", {
            error: "Angel stream failed safely.",
            providerMode: "stream_error",
            providerError: reported.publicCode,
            correlationId: reported.correlationId,
          });
        }
      } finally {
        if (providerDeadlineTimer) clearTimeout(providerDeadlineTimer);
        req.signal.removeEventListener("abort", requestAbortListener);
        if (!providerAbortController.signal.aborted) providerAbortController.abort();
        if (bridgeAbortController === providerAbortController) bridgeAbortController = null;
        clearInterval(heartbeat);
        close();
      }
    },
    cancel() {
      bridgeAbortController?.abort();
      bridgeAbortController = null;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Velmere-Stream-Protocol": STREAM_PROTOCOL,
    },
  });
}
