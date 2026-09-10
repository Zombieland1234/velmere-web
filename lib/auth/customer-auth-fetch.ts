"use client";

import { ASCII_CONTROL_PATTERN } from "../security/ascii-control-characters";


import { fetchWithDeadline } from "@/lib/network/fetch-with-deadline";

const RETRYABLE_AUTH_CODES = new Set([
  "missing_token",
  "invalid_token",
  "account_session_required",
  "CUSTOMER_DATA_AUTH_REQUIRED",
  "CUSTOMER_WRITE_AUTH_REQUIRED",
]);

export type CustomerAuthRefreshBudget = { remaining: 0 | 1 };

export function createCustomerAuthRefreshBudget(): CustomerAuthRefreshBudget {
  return { remaining: 1 };
}

function requestTarget(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function isCustomerAuthSameOriginInput(
  input: RequestInfo | URL,
  browserOrigin = typeof window === "undefined" ? "" : window.location.origin,
) {
  const target = requestTarget(input);
  if (ASCII_CONTROL_PATTERN.test(target) || target.includes("\\")) return false;
  if (target.startsWith("/")) return !target.startsWith("//");
  if (!browserOrigin) return false;
  try {
    return new URL(target).origin === new URL(browserOrigin).origin;
  } catch {
    return false;
  }
}

function assertCustomerAuthSameOriginInput(input: RequestInfo | URL) {
  if (!isCustomerAuthSameOriginInput(input)) {
    throw new TypeError("customer_auth_same_origin_request_required");
  }
}

async function shouldRefresh(response: Response) {
  if (response.status !== 401) return false;
  try {
    const clone = response.clone();
    const payload = await clone.json() as { code?: string; error?: string };
    return RETRYABLE_AUTH_CODES.has(payload.code ?? "") || RETRYABLE_AUTH_CODES.has(payload.error ?? "");
  } catch {
    return true;
  }
}

async function refreshSession() {
  const response = await fetchWithDeadline("/api/auth/session", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }, { timeoutMs: 8_000, operation: "customer_auth_refresh" });
  return response.ok;
}

export async function fetchWithCustomerAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: {
    retryAuthOnce?: boolean;
    timeoutMs?: number;
    operation?: string;
    refreshBudget?: CustomerAuthRefreshBudget;
  } = {},
) {
  const execute = () => {
    assertCustomerAuthSameOriginInput(input);
    return fetchWithDeadline(input, {
      ...init,
      credentials: "same-origin",
    }, { timeoutMs: options.timeoutMs, operation: options.operation ?? "customer_authenticated_fetch" });
  };

  let response = await execute();
  if (options.retryAuthOnce === false || !(await shouldRefresh(response))) return response;
  if (options.refreshBudget && options.refreshBudget.remaining !== 1) return response;
  if (options.refreshBudget) options.refreshBudget.remaining = 0;
  if (!(await refreshSession())) return response;
  response = await execute();
  return response;
}
