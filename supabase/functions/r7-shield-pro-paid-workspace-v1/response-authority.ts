export type ShieldPaidTier = "pro" | "advanced";
export type ShieldLocale = "pl" | "en" | "de";

export type WorkspaceResponseAuthority = {
  tier: ShieldPaidTier;
  locale: ShieldLocale;
  payload: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Treat the database result as the authority for historical workspace identity.
 * Caller-supplied tier/locale select an allowed operation; they never relabel
 * stored workspace data after the RPC has resolved it.
 */
export function resolveWorkspaceResponseAuthority(
  data: Record<string, unknown>,
  operation: string,
): WorkspaceResponseAuthority | null {
  const tier = data.tier;
  const locale = data.locale;
  if ((tier !== "pro" && tier !== "advanced") ||
      (locale !== "pl" && locale !== "en" && locale !== "de")) {
    return null;
  }

  if (operation === "DELETE") {
    return { tier, locale, payload: null };
  }

  if (!isRecord(data.payload)) return null;
  if (data.payload.tier !== tier || data.payload.locale !== locale) return null;
  return { tier, locale, payload: data.payload };
}
