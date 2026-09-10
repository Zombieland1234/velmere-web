import type {
  PublishedPublicProof,
  VerifyStatus,
} from "@/lib/market-integrity/public-proof-publication-resolver";

const STATUS_PRESENTATION: Record<VerifyStatus, { label: string; background: string; foreground: string }> = {
  VERIFIED: { label: "VERIFIED", background: "#146b4a", foreground: "#f4fff9" },
  VERIFIED_AGAIN: { label: "VERIFIED AGAIN", background: "#146b4a", foreground: "#f4fff9" },
  CHANGE_DETECTED: { label: "CHANGE DETECTED", background: "#8a3b12", foreground: "#fff8f2" },
  REVALIDATION_REQUIRED: { label: "REVALIDATION REQUIRED", background: "#8a3b12", foreground: "#fff8f2" },
  REVALIDATING: { label: "REVALIDATING", background: "#785514", foreground: "#fffbed" },
  MONITORING_UNAVAILABLE: { label: "MONITORING UNAVAILABLE", background: "#4b5563", foreground: "#f9fafb" },
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function canonicalOrigin(value: string) {
  try {
    const parsed = new URL(value);
    const loopback = parsed.protocol === "http:"
      && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]");
    if (
      (parsed.protocol !== "https:" && !loopback)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function buildVerifyDynamicBadge(input: {
  proof: PublishedPublicProof;
  canonicalSiteOrigin: string;
}) {
  const origin = canonicalOrigin(input.canonicalSiteOrigin);
  if (!origin) return null;
  const proof = input.proof;
  const presentation = STATUS_PRESENTATION[proof.currentStatus];
  if (!presentation) return null;
  const green = proof.monitoringCurrent
    && (proof.currentStatus === "VERIFIED" || proof.currentStatus === "VERIFIED_AGAIN");
  if (green !== (presentation.background === "#146b4a")) return null;
  const canonicalUrl = new URL(proof.canonicalPath, `${origin}/`).toString();
  const statusLabel = escapeXml(presentation.label);
  const identityLabel = escapeXml(
    `${proof.chainId}:${proof.contractAddress.slice(0, 8)}…${proof.contractAddress.slice(-6)}`,
  );
  const title = escapeXml(`Velmère Verify — ${presentation.label}`);
  const description = escapeXml(
    `Dynamic status for chain ${proof.chainId}, contract ${proof.contractAddress}. Last checked ${proof.lastCheckedAt}.`,
  );
  const href = escapeXml(canonicalUrl);
  const version = escapeXml(`v${proof.auditVersion}.${proof.publicationVersion}`);
  const head = escapeXml(proof.headEventDigest.slice(0, 12));
  const risk = escapeXml(proof.riskStatus.replaceAll("_", " "));
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="76" viewBox="0 0 420 76" role="img">',
    `<title>${title}</title>`,
    `<desc>${description}</desc>`,
    `<a href="${href}" target="_top">`,
    '<rect width="420" height="76" rx="12" fill="#111827"/>',
    `<rect x="154" width="266" height="76" rx="12" fill="${presentation.background}"/>`,
    '<rect x="154" width="12" height="76" fill="#111827"/>',
    '<text x="18" y="30" fill="#f9fafb" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">VELMÈRE VERIFY</text>',
    `<text x="18" y="52" fill="#9ca3af" font-family="Arial,Helvetica,sans-serif" font-size="10">${identityLabel}</text>`,
    `<text x="170" y="25" fill="${presentation.foreground}" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700">${statusLabel}</text>`,
    `<text x="170" y="44" fill="${presentation.foreground}" opacity="0.88" font-family="Arial,Helvetica,sans-serif" font-size="9">RISK ${risk}</text>`,
    `<text x="170" y="61" fill="${presentation.foreground}" opacity="0.72" font-family="Arial,Helvetica,sans-serif" font-size="9">${version} · ${head}</text>`,
    "</a>",
    "</svg>",
  ].join("");
  return {
    schemaVersion: "velmere.verify-dynamic-badge.v1" as const,
    svg,
    canonicalUrl,
    status: proof.currentStatus,
    green,
    headEventDigest: proof.headEventDigest,
  };
}
