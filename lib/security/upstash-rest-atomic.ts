import { brokeredConfiguredOriginFetch } from "@/lib/network/brokered-egress";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

export type UpstashRestProvider = "upstash" | "vercel_kv";

export interface UpstashRestConfig {
  url: string;
  token: string;
  provider: UpstashRestProvider;
}

export class UpstashRestCommandError extends Error {
  readonly code: string;
  readonly provider: UpstashRestProvider | "unconfigured";
  readonly status?: number;

  constructor(args: { code: string; message: string; provider: UpstashRestProvider | "unconfigured"; status?: number }) {
    super(args.message);
    this.name = "UpstashRestCommandError";
    this.code = args.code;
    this.provider = args.provider;
    this.status = args.status;
  }
}

export function resolveUpstashRestConfig(): UpstashRestConfig | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl.replace(/\/$/, ""), token: upstashToken, provider: "upstash" };
  }
  const kvUrl = process.env.KV_REST_API_URL?.trim();
  const kvToken = process.env.KV_REST_API_TOKEN?.trim();
  if (kvUrl && kvToken) {
    return { url: kvUrl.replace(/\/$/, ""), token: kvToken, provider: "vercel_kv" };
  }
  return null;
}

export function hasUpstashRestConfig(): boolean {
  return resolveUpstashRestConfig() !== null;
}

function safeOperation(value: string | undefined): string {
  return (value?.trim() || "upstash_rest_command").replace(/[^a-zA-Z0-9:_.-]/g, "_").slice(0, 120);
}

export async function executeUpstashRestCommand<T = unknown>(
  command: ReadonlyArray<string | number>,
  options: {
    config?: UpstashRestConfig;
    timeoutMs?: number;
    maxResponseBytes?: number;
    operation?: string;
  } = {},
): Promise<T> {
  const config = options.config ?? resolveUpstashRestConfig();
  if (!config) {
    throw new UpstashRestCommandError({
      code: "upstash_rest_unconfigured",
      message: "Upstash/Vercel KV REST credentials are not configured",
      provider: "unconfigured",
    });
  }
  if (command.length === 0 || typeof command[0] !== "string") {
    throw new UpstashRestCommandError({
      code: "upstash_rest_command_invalid",
      message: "Redis command must contain an operation name",
      provider: config.provider,
    });
  }
  const operation = safeOperation(options.operation);
  const maxResponseBytes = Math.max(1_024, Math.min(options.maxResponseBytes ?? 1_048_576, 4_194_304));
  const response = await brokeredConfiguredOriginFetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(command.map((value) => String(value))),
    cache: "no-store",
  }, {
    configuredProfile: "upstash_rest",
    environment: config.provider === "upstash"
      ? { UPSTASH_REDIS_REST_URL: config.url }
      : { KV_REST_API_URL: config.url },
    timeoutMs: Math.max(250, Math.min(options.timeoutMs ?? 2_200, 10_000)),
    maxRequestBytes: 1_048_576,
    maxResponseBytes,
    operation,
  });
  const payload = await readJsonResponseBounded<{ result?: unknown; error?: string }>(
    response,
    maxResponseBytes,
  );
  if (!response.ok) {
    throw new UpstashRestCommandError({
      code: `upstash_rest_http_${response.status}`,
      message: `${operation} failed with status ${response.status}`,
      provider: config.provider,
      status: response.status,
    });
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    throw new UpstashRestCommandError({
      code: "upstash_rest_command_error",
      message: payload.error.slice(0, 240),
      provider: config.provider,
      status: response.status,
    });
  }
  return payload.result as T;
}

export async function executeUpstashRestEval<T = unknown>(args: {
  script: string;
  keys?: string[];
  argv?: Array<string | number>;
  config?: UpstashRestConfig;
  timeoutMs?: number;
  maxResponseBytes?: number;
  operation?: string;
}): Promise<T> {
  const keys = args.keys ?? [];
  const argv = args.argv ?? [];
  if (!args.script.trim()) {
    throw new UpstashRestCommandError({
      code: "upstash_rest_eval_script_missing",
      message: "Redis EVAL script is required",
      provider: args.config?.provider ?? resolveUpstashRestConfig()?.provider ?? "unconfigured",
    });
  }
  return executeUpstashRestCommand<T>([
    "EVAL",
    args.script,
    String(keys.length),
    ...keys,
    ...argv,
  ], {
    config: args.config,
    timeoutMs: args.timeoutMs,
    maxResponseBytes: args.maxResponseBytes,
    operation: args.operation ?? "upstash_rest_eval",
  });
}

export const UPSTASH_ATOMIC_LIST_APPEND_LUA = [
  "local length = redis.call('LPUSH', KEYS[1], ARGV[1])",
  "redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]) - 1)",
  "return length",
].join("\n");

export async function appendTrimmedUpstashList(args: {
  key: string;
  value: string;
  maxLength: number;
  config?: UpstashRestConfig;
  timeoutMs?: number;
  operation?: string;
}): Promise<number> {
  const result = await executeUpstashRestEval<unknown>({
    script: UPSTASH_ATOMIC_LIST_APPEND_LUA,
    keys: [args.key],
    argv: [args.value, Math.max(1, Math.min(Math.trunc(args.maxLength), 100_000))],
    config: args.config,
    timeoutMs: args.timeoutMs,
    operation: args.operation ?? "upstash_list_append_trim",
  });
  const length = Number(result);
  if (!Number.isFinite(length) || length < 0) {
    throw new UpstashRestCommandError({
      code: "upstash_rest_list_result_invalid",
      message: "Redis list append returned an invalid length",
      provider: args.config?.provider ?? resolveUpstashRestConfig()?.provider ?? "unconfigured",
    });
  }
  return length;
}
