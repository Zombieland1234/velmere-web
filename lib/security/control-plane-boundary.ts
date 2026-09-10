import { createHash, timingSafeEqual } from "node:crypto";
import { isPass4659ControlPlanePath } from "@/lib/security/api-surface-registry";

export const PASS4658_CONTROL_PLANE_BOUNDARY_ID = "pass4658-private-control-plane-boundary-v1" as const;



function isProductionLike(env: Record<string, string | undefined>) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function truthy(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeHexDigest(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? Buffer.from(normalized, "hex") : null;
}

function tokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const token = (request.headers.get("x-velmere-control-plane-token") || bearer).trim();
  return token.length >= 32 && token.length <= 512 ? token : "";
}

export function isPass4658ControlPlanePath(pathname: string) {
  const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  return isPass4659ControlPlanePath(normalized);
}

export type Pass4658ControlPlaneDecision = {
  applies: boolean;
  allowed: boolean;
  hiddenStatus: 404 | null;
  reason:
    | "not_control_plane"
    | "nonproduction_open"
    | "control_plane_disabled"
    | "control_plane_hash_invalid"
    | "control_plane_token_missing"
    | "control_plane_token_invalid"
    | "control_plane_authenticated";
};

export function evaluatePass4658ControlPlaneBoundary(args: {
  request: Request;
  pathname: string;
  env?: Record<string, string | undefined>;
}): Pass4658ControlPlaneDecision {
  const env = args.env ?? process.env;
  if (!isPass4658ControlPlanePath(args.pathname)) {
    return { applies: false, allowed: true, hiddenStatus: null, reason: "not_control_plane" };
  }

  const production = isProductionLike(env);
  const localLockdown = truthy(env.VELMERE_CONTROL_PLANE_LOCAL_LOCKDOWN);
  if (!production && !localLockdown) {
    return { applies: true, allowed: true, hiddenStatus: null, reason: "nonproduction_open" };
  }

  if (!truthy(env.VELMERE_CONTROL_PLANE_API_ENABLED)) {
    return { applies: true, allowed: false, hiddenStatus: 404, reason: "control_plane_disabled" };
  }

  const expected = safeHexDigest(env.VELMERE_CONTROL_PLANE_BEARER_SHA256);
  if (!expected) {
    return { applies: true, allowed: false, hiddenStatus: 404, reason: "control_plane_hash_invalid" };
  }

  const token = tokenFromRequest(args.request);
  if (!token) {
    return { applies: true, allowed: false, hiddenStatus: 404, reason: "control_plane_token_missing" };
  }
  const supplied = sha256(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { applies: true, allowed: false, hiddenStatus: 404, reason: "control_plane_token_invalid" };
  }

  return { applies: true, allowed: true, hiddenStatus: null, reason: "control_plane_authenticated" };
}
