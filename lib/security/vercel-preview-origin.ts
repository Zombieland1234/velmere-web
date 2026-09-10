const VERCEL_PREVIEW_SUFFIX = ".vercel.app" as const;
const DNS_HOSTNAME_MAX_LENGTH = 253;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export type VercelPreviewOriginEnvironment = {
  readonly [key: string]: string | undefined;
  VERCEL_ENV?: string;
  VERCEL_BRANCH_URL?: string;
};

/**
 * Resolve the server-owned stable Vercel branch alias without ever trusting a
 * request Host. Vercel production and every non-preview environment are
 * deliberately ineligible for this fallback.
 */
export function resolveVercelPreviewBranchOrigin(
  env: VercelPreviewOriginEnvironment,
) {
  if (env.VERCEL_ENV !== "preview") return null;
  const hostname = env.VERCEL_BRANCH_URL;
  if (
    typeof hostname !== "string" ||
    hostname.length === 0 ||
    hostname.length > DNS_HOSTNAME_MAX_LENGTH ||
    hostname !== hostname.toLowerCase() ||
    !hostname.endsWith(VERCEL_PREVIEW_SUFFIX)
  ) {
    return null;
  }

  const labels = hostname.split(".");
  if (labels.length < 3 || labels.some((label) => !DNS_LABEL.test(label))) {
    return null;
  }
  return `https://${hostname}`;
}
