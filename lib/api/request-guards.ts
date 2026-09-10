import { NextResponse } from "next/server";
import { resolveRequestAccount } from "@/lib/auth/account-session";
import { applyApiRateLimit } from "@/lib/security/api-guard";


export type VelmereSession = {
  id: string;
  displayName: string;
  handle: string;
  source: "preview" | "server" | "account";
  email?: string;
  provider?: string;
};

export async function getVelmereSession(request: Request): Promise<VelmereSession | null> {
  const serverSecret = process.env.VELMERE_SERVER_SESSION_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (serverSecret && auth === `Bearer ${serverSecret}`) {
    return { id: "server-session", displayName: "Velmère Member", handle: "@member", source: "server", provider: "server" };
  }

  const account = await resolveRequestAccount(request);
  if (account) {
    return {
      id: account.accountId,
      displayName: account.displayName,
      handle: account.handle,
      email: account.email,
      provider: account.provider,
      source: account.sessionSource === "preview" ? "preview" : "account",
    };
  }

  return null;
}

export async function requireVelmereSession(request: Request): Promise<{ session: VelmereSession; response: null } | { session: null; response: NextResponse }> {
  const session = await getVelmereSession(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "AUTH_REQUIRED", message: "Sign in before writing to Velmère Square." },
        { status: 401 },
      ),
    };
  }
  return { session, response: null };
}

export async function rateLimit(request: Request, key: string, limit = 12, windowMs = 60_000) {
  const decision = await applyApiRateLimit(request, { keyPrefix: `legacy-request-guards:${key}`, limit, windowMs });
  return decision.ok ? null : NextResponse.json(
    { error: decision.response.status === 429 ? "RATE_LIMITED" : "RATE_LIMIT_UNAVAILABLE", message: decision.response.status === 429 ? "Too many actions. Wait before trying again." : "Rate-limit protection is unavailable." },
    { status: decision.response.status, headers: decision.response.headers },
  );
}
