"use client";

import { stripUnsafeControlOrBidi } from "@/lib/security/control-character-policy";

const SAFE_EVENT = /^[a-z][a-z0-9_.:-]{2,79}$/;
const SAFE_CODE = /^[a-z][a-z0-9_]{2,79}$/;
const SAFE_REFERENCE = /^[a-zA-Z0-9_-]{6,96}$/;

export const PASS36_A102R13_BROWSER_ERROR_REDACTION_ID =
  "velmere.pass36.a102r13.browser-error-redaction.v1" as const;

function safeToken(value: unknown, fallback: string, pattern = SAFE_CODE) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return pattern.test(normalized) ? normalized : fallback;
}

function randomReference() {
  try {
    const candidate = globalThis.crypto?.randomUUID?.().replaceAll("-", "");
    if (candidate && /^[a-f0-9]{32}$/i.test(candidate)) return `ui_${candidate.toLowerCase()}`;
  } catch {
    // Reference generation must never interfere with the fail-closed UI fallback.
  }
  return "ui_error_reference_unavailable";
}

export function createBrowserErrorReference(digest?: unknown) {
  const candidate = stripUnsafeControlOrBidi(String(digest ?? "").trim()).slice(0, 96);
  return SAFE_REFERENCE.test(candidate) ? candidate : randomReference();
}

export function classifyBrowserError(error: unknown) {
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name ?? "Error")
    : "Error";
  return {
    name: stripUnsafeControlOrBidi(name).replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 48) || "Error",
    code: "render_failure",
  } as const;
}

export function reportBrowserBoundaryFailure(input: {
  event: string;
  error: unknown;
  digest?: unknown;
}) {
  const event = safeToken(input.event, "browser_boundary_failure", SAFE_EVENT);
  const reference = createBrowserErrorReference(input.digest);
  const classified = classifyBrowserError(input.error);
  console.error(JSON.stringify({
    schemaVersion: PASS36_A102R13_BROWSER_ERROR_REDACTION_ID,
    event,
    reference,
    errorName: classified.name,
    publicCode: classified.code,
    rawMessageIncluded: false,
    stackIncluded: false,
    componentStackIncluded: false,
  }));
  return { reference, publicCode: classified.code } as const;
}

export function publicBrowserFailureCode(error: unknown, allowed: readonly string[], fallback: string) {
  const candidate = error instanceof Error ? error.message.trim().toLowerCase() : "";
  if (!SAFE_CODE.test(candidate)) return fallback;
  return allowed.includes(candidate) ? candidate : fallback;
}
