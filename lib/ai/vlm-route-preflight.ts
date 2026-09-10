import { inspectVlmAdviceBoundary } from "./vlm-advice-boundary";
import { inspectVlmText } from "./vlm-security";
import { inspectVlmUserPrompt } from "./vlm-user-prompt-boundary";
import {
  parseStrictVlmDepth,
  parseStrictVlmLocale,
  primitiveString,
  rejectMixedBodyAndQuery,
  validateBodyObject,
  validateOnlySearchParams,
  type StrictVlmDepth,
  type StrictVlmLocale,
} from "./vlm-route-request-boundary";

export type VlmRoutePreflightValue = {
  query: string;
  prompt: string | undefined;
  locale: StrictVlmLocale;
  depth: StrictVlmDepth;
  queryInspection: ReturnType<typeof inspectVlmText>;
  promptInspection: ReturnType<typeof inspectVlmUserPrompt>;
  adviceBoundary: ReturnType<typeof inspectVlmAdviceBoundary>;
};

export type VlmRoutePreflightResult =
  | { ok: true; value: VlmRoutePreflightValue }
  | { ok: false; response: Response; code: string };

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function evaluateVlmRoutePreflight(input: {
  request: Request;
  body?: Record<string, unknown> | null;
  defaultLocale: StrictVlmLocale;
  defaultDepth: StrictVlmDepth;
  defaultPrompt?: string;
  queryRequired?: boolean;
  onInspection?: (value: Pick<VlmRoutePreflightValue, "queryInspection" | "promptInspection">) => void;
}): VlmRoutePreflightResult {
  const allowedFields = ["query", "prompt", "locale", "depth"] as const;
  const url = new URL(input.request.url);
  const queryBoundary = validateOnlySearchParams(url, allowedFields);
  if (queryBoundary) return { ok: false, response: jsonResponse({ mode: "error", error: queryBoundary.code, field: queryBoundary.field }, 400), code: queryBoundary.code };
  if (input.body) {
    const bodyBoundary = validateBodyObject(input.body, allowedFields);
    if (bodyBoundary) return { ok: false, response: jsonResponse({ mode: "error", error: bodyBoundary.code, field: bodyBoundary.field }, 400), code: bodyBoundary.code };
    const shadowBoundary = rejectMixedBodyAndQuery(url, input.body, allowedFields);
    if (shadowBoundary) return { ok: false, response: jsonResponse({ mode: "error", error: shadowBoundary.code, field: shadowBoundary.field }, 400), code: shadowBoundary.code };
  }
  const source = input.body ?? Object.fromEntries(allowedFields.map((field) => [field, url.searchParams.get(field) ?? undefined]));
  const queryField = primitiveString(source.query, "query", 180, input.queryRequired ?? true);
  const promptField = primitiveString(source.prompt ?? input.defaultPrompt, "prompt", 800, Boolean(input.defaultPrompt));
  if (!queryField.ok) return { ok: false, response: jsonResponse({ mode: "error", error: queryField.failure.code, field: queryField.failure.field }, 400), code: queryField.failure.code };
  if (!promptField.ok) return { ok: false, response: jsonResponse({ mode: "error", error: promptField.failure.code, field: promptField.failure.field }, 400), code: promptField.failure.code };
  const localeField = parseStrictVlmLocale(source.locale, input.defaultLocale);
  const depthField = parseStrictVlmDepth(source.depth, input.defaultDepth);
  if (!localeField.ok) return { ok: false, response: jsonResponse({ mode: "error", error: localeField.failure.code, field: localeField.failure.field }, 400), code: localeField.failure.code };
  if (!depthField.ok) return { ok: false, response: jsonResponse({ mode: "error", error: depthField.failure.code, field: depthField.failure.field }, 400), code: depthField.failure.code };

  const queryInspection = inspectVlmText(queryField.value, 180);
  const promptInspection = inspectVlmUserPrompt(promptField.value, 800);
  input.onInspection?.({ queryInspection, promptInspection });
  if (!queryInspection.safe || !promptInspection.safe) {
    return { ok: false, response: jsonResponse({ mode: "error", error: "security_policy", flags: [...queryInspection.flags, ...promptInspection.flags] }, 400), code: "security_policy" };
  }
  const adviceBoundary = inspectVlmAdviceBoundary(promptInspection.normalized || undefined);
  if (!adviceBoundary.allowed) {
    const status = adviceBoundary.decision === "REJECT_EVASION_OR_CONCEALMENT" ? 400 : 422;
    return {
      ok: false,
      response: jsonResponse({
        mode: "abstain",
        error: adviceBoundary.publicCode,
        decision: adviceBoundary.decision,
        flags: adviceBoundary.flags,
        safeReframe: adviceBoundary.safeReframe,
      }, status),
      code: adviceBoundary.publicCode ?? "advice_boundary",
    };
  }
  return {
    ok: true,
    value: {
      query: queryInspection.normalized.slice(0, 180),
      prompt: promptInspection.normalized || undefined,
      locale: localeField.value,
      depth: depthField.value,
      queryInspection,
      promptInspection,
      adviceBoundary,
    },
  };
}

export async function executeVlmPreflightBeforeProvider<T>(
  input: Parameters<typeof evaluateVlmRoutePreflight>[0],
  provider: (value: VlmRoutePreflightValue) => Promise<T>,
): Promise<{ response?: Response; value?: T; providerCalls: number }> {
  let providerCalls = 0;
  const preflight = evaluateVlmRoutePreflight(input);
  if (!preflight.ok) return { response: preflight.response, providerCalls };
  providerCalls += 1;
  const value = await provider(preflight.value);
  return { value, providerCalls };
}
