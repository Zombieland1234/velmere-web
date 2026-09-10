import { ASCII_CONTROL_OR_MARKUP_PATTERN, JSON_CONTROL_NO_DELETE_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import {
  safeEgressFetchWithTrace,
  VelmereEgressPolicyError,
} from "@/lib/network/safe-egress";
import { buildPass2814ExternalUrlDecision } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";

export const PASS4807_PUBLIC_SOURCE_RECEIPTS_ID = "pass4807-content-bound-public-source-receipts-v1" as const;

export type AuditPublicSourceKind = "audit" | "docs" | "github" | "website";
export type AuditPublicSourceState = "confirmed" | "partial" | "missing" | "blocked" | "error";
export type AuditPublicSourceFreshness = "fresh" | "acceptable" | "stale" | "unknown";

export type AuditPublicSourceReceipt = {
  schemaVersion: "velmere.audit-public-source-receipt.v1";
  kind: AuditPublicSourceKind;
  state: AuditPublicSourceState;
  submittedUrlHash: string | null;
  requestedUrl: string | null;
  finalUrl: string | null;
  finalUrlHash: string | null;
  redirectChain: Array<{ from: string; status: number; to: string | null }>;
  redirectRoot: string;
  statusCode: number | null;
  contentType: string | null;
  contentLength: number;
  bodyDigest: string | null;
  normalizedTextDigest: string | null;
  observedAt: string;
  lastModifiedAt: string | null;
  etagDigest: string | null;
  freshness: AuditPublicSourceFreshness;
  contentBound: boolean;
  identity: {
    requestedAddress: string | null;
    exactAddressPresent: boolean;
    extractedAddressCount: number;
    chainMentioned: boolean;
  };
  scopeSignals: string[];
  licenseSignals: string[];
  missing: string[];
  receiptDigest: string;
};

export type AuditPublicSourceReceiptReport = {
  schemaVersion: typeof PASS4807_PUBLIC_SOURCE_RECEIPTS_ID;
  generatedAt: string;
  contractAddress: string | null;
  chain: string;
  receipts: AuditPublicSourceReceipt[];
  summary: {
    submitted: number;
    contentBound: number;
    exactIdentityBound: number;
    blocked: number;
    errors: number;
    aggregateRoot: string;
  };
  customerRows: Array<{ label: string; status: AuditPublicSourceState; output: string }>;
  missing: string[];
};

const MAX_SOURCE_BYTES = 1_500_000;
const TEXTUAL_TYPES = [
  "text/",
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/xhtml+xml",
  "application/javascript",
];

function clean(value: unknown, max = 600) {
  return typeof value === "string" ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, max) : "";
}

function normalizedAddress(value: unknown) {
  const address = clean(value, 96).toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

function publicUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function allowedHostsFor(value: string) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  const hosts = new Set([host]);
  if (host === "github.com" || host.endsWith(".github.com")) {
    hosts.add("github.com");
    hosts.add("raw.githubusercontent.com");
    hosts.add("api.github.com");
  }
  return hosts;
}

function normalizedText(bytes: Uint8Array, contentType: string) {
  if (!TEXTUAL_TYPES.some((prefix) => contentType.startsWith(prefix))) return "";
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 600_000);
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(JSON_CONTROL_NO_DELETE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500_000);
}

function sourceSignals(text: string) {
  const scope: string[] = [];
  const license: string[] = [];
  const scopePatterns: Array<[string, RegExp]> = [
    ["smart-contract-audit", /smart\s+contract\s+audit|security\s+audit/i],
    ["scope-section", /\bscope\b|in[- ]scope|out[- ]of[- ]scope/i],
    ["findings-section", /\bfindings?\b|severity|critical|high|medium|low/i],
    ["source-code", /pragma\s+solidity|contract\s+[A-Za-z_]|interface\s+[A-Za-z_]/i],
    ["proxy-upgrade", /proxy|implementation|upgradeable|delegatecall/i],
    ["permissions", /owner|admin|accesscontrol|onlyowner|role/i],
  ];
  const licensePatterns: Array<[string, RegExp]> = [
    ["MIT", /\bMIT License\b|SPDX-License-Identifier:\s*MIT/i],
    ["Apache-2.0", /Apache License,? Version 2\.0|SPDX-License-Identifier:\s*Apache-2\.0/i],
    ["GPL", /GNU (?:GENERAL PUBLIC LICENSE|GPL)|SPDX-License-Identifier:\s*GPL/i],
    ["BSD", /BSD (?:2-Clause|3-Clause|License)/i],
    ["UNLICENSED", /SPDX-License-Identifier:\s*UNLICENSED/i],
  ];
  for (const [label, pattern] of scopePatterns) if (pattern.test(text)) scope.push(label);
  for (const [label, pattern] of licensePatterns) if (pattern.test(text)) license.push(label);
  return { scope: scope.slice(0, 12), license: license.slice(0, 8) };
}

function freshness(lastModified: string | null, observedAt: string): AuditPublicSourceFreshness {
  if (!lastModified) return "unknown";
  const modified = Date.parse(lastModified);
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(modified) || !Number.isFinite(observed) || modified > observed + 60_000) return "unknown";
  const ageDays = (observed - modified) / 86_400_000;
  if (ageDays <= 30) return "fresh";
  if (ageDays <= 180) return "acceptable";
  return "stale";
}

function finalizeReceipt(value: Omit<AuditPublicSourceReceipt, "receiptDigest">): AuditPublicSourceReceipt {
  return { ...value, receiptDigest: sha256Digest(canonicalJson(value)) };
}

function emptyReceipt(kind: AuditPublicSourceKind, rawUrl: string | null, contractAddress: string | null, chain: string, state: AuditPublicSourceState, missing: string[]): AuditPublicSourceReceipt {
  const observedAt = new Date().toISOString();
  const normalized = rawUrl ? publicUrl(rawUrl) : null;
  const base: Omit<AuditPublicSourceReceipt, "receiptDigest"> = {
    schemaVersion: "velmere.audit-public-source-receipt.v1",
    kind,
    state,
    submittedUrlHash: rawUrl ? sha256Digest(rawUrl) : null,
    requestedUrl: normalized,
    finalUrl: null,
    finalUrlHash: null,
    redirectChain: [],
    redirectRoot: sha256Digest("[]"),
    statusCode: null,
    contentType: null,
    contentLength: 0,
    bodyDigest: null,
    normalizedTextDigest: null,
    observedAt,
    lastModifiedAt: null,
    etagDigest: null,
    freshness: "unknown",
    contentBound: false,
    identity: { requestedAddress: contractAddress, exactAddressPresent: false, extractedAddressCount: 0, chainMentioned: false },
    scopeSignals: [],
    licenseSignals: [],
    missing: [...missing, `chain:${chain}`].slice(0, 12),
  };
  return finalizeReceipt(base);
}

async function fetchReceipt(kind: AuditPublicSourceKind, rawUrl: string | null, contractAddress: string | null, chain: string): Promise<AuditPublicSourceReceipt> {
  if (!rawUrl) return emptyReceipt(kind, null, contractAddress, chain, "missing", [`${kind}Url not submitted`]);
  const decision = buildPass2814ExternalUrlDecision(rawUrl);
  if (!decision.allowed || !decision.normalizedUrl) {
    return emptyReceipt(kind, rawUrl, contractAddress, chain, "blocked", decision.blockedReasons.length ? decision.blockedReasons : ["source_url_blocked"]);
  }
  const observedAt = new Date().toISOString();
  try {
    const { response, trace } = await safeEgressFetchWithTrace(decision.normalizedUrl, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "text/html,text/plain,application/json,application/pdf;q=0.9,*/*;q=0.2", "user-agent": "VelmereAuditSourceReceipt/4807" },
    }, {
      allowedHosts: allowedHostsFor(decision.normalizedUrl),
      allowSubdomains: false,
      maxRedirects: 3,
      timeoutMs: 5_000,
      operation: `audit_public_source_${kind}`,
      allowedMethods: ["GET"],
      maxRequestBytes: 0,
      maxResponseBytes: MAX_SOURCE_BYTES,
    });
    const bytes = await readResponseBytesBounded(response, MAX_SOURCE_BYTES);
    const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";", 1)[0]!.trim().toLowerCase();
    const text = normalizedText(bytes, contentType);
    const addresses = Array.from(new Set((text.match(/0x[a-fA-F0-9]{40}/g) ?? []).map((value) => value.toLowerCase()))).slice(0, 256);
    const exactAddressPresent = Boolean(contractAddress && addresses.includes(contractAddress));
    const chainMentioned = new RegExp(`\\b${chain.replace(/[^a-zA-Z0-9]+/g, "[ _-]?")}\\b`, "i").test(text);
    const signals = sourceSignals(text);
    const lastModifiedRaw = response.headers.get("last-modified");
    const lastModifiedAt = lastModifiedRaw && Number.isFinite(Date.parse(lastModifiedRaw)) ? new Date(Date.parse(lastModifiedRaw)).toISOString() : null;
    const redirectChain = trace.redirects.map((hop) => {
      let resolvedLocation: string | null;
      try { resolvedLocation = hop.location ? new URL(hop.location, hop.url).toString() : null; } catch { resolvedLocation = null; }
      return { from: publicUrl(hop.url) ?? "redacted", status: hop.status, to: publicUrl(resolvedLocation) };
    });
    const ok = response.ok && bytes.byteLength > 0;
    const missing = [
      !response.ok ? `http_status:${response.status}` : null,
      !text && contentType !== "application/pdf" ? "unsupported_or_empty_text_content" : null,
      contractAddress && !exactAddressPresent ? "requested_contract_not_found_in_source_content" : null,
      !signals.license.length ? "license_not_detected" : null,
    ].filter((item): item is string => Boolean(item));
    const base: Omit<AuditPublicSourceReceipt, "receiptDigest"> = {
      schemaVersion: "velmere.audit-public-source-receipt.v1",
      kind,
      state: ok ? (exactAddressPresent || !contractAddress ? "confirmed" : "partial") : "error",
      submittedUrlHash: sha256Digest(rawUrl),
      requestedUrl: publicUrl(decision.normalizedUrl),
      finalUrl: publicUrl(trace.finalUrl),
      finalUrlHash: sha256Digest(trace.finalUrl),
      redirectChain,
      redirectRoot: sha256Digest(canonicalJson(redirectChain)),
      statusCode: response.status,
      contentType,
      contentLength: bytes.byteLength,
      bodyDigest: ok ? sha256BytesDigest(bytes) : null,
      normalizedTextDigest: text ? sha256Digest(text) : null,
      observedAt,
      lastModifiedAt,
      etagDigest: response.headers.get("etag") ? sha256Digest(response.headers.get("etag")!) : null,
      freshness: freshness(lastModifiedAt, observedAt),
      contentBound: ok,
      identity: { requestedAddress: contractAddress, exactAddressPresent, extractedAddressCount: addresses.length, chainMentioned },
      scopeSignals: signals.scope,
      licenseSignals: signals.license,
      missing: missing.slice(0, 12),
    };
    return finalizeReceipt(base);
  } catch (error) {
    const code = error instanceof VelmereEgressPolicyError ? error.code : error instanceof Error ? error.message.slice(0, 120) : "source_fetch_failed";
    return emptyReceipt(kind, rawUrl, contractAddress, chain, error instanceof VelmereEgressPolicyError ? "blocked" : "error", [code]);
  }
}

export async function buildAuditPublicSourceReceiptReport(input: {
  auditUrl?: string | null;
  docsUrl?: string | null;
  githubUrl?: string | null;
  website?: string | null;
  contractAddress?: string | null;
  chain?: string | null;
}): Promise<AuditPublicSourceReceiptReport> {
  const contractAddress = normalizedAddress(input.contractAddress);
  const chain = clean(input.chain, 48) || "ethereum";
  const urls: Array<[AuditPublicSourceKind, string | null]> = [
    ["audit", clean(input.auditUrl, 600) || null],
    ["docs", clean(input.docsUrl, 600) || null],
    ["github", clean(input.githubUrl, 600) || null],
    ["website", clean(input.website, 600) || null],
  ];
  const receipts = await Promise.all(urls.map(([kind, url]) => fetchReceipt(kind, url, contractAddress, chain)));
  const submitted = receipts.filter((item) => item.submittedUrlHash).length;
  const contentBound = receipts.filter((item) => item.contentBound).length;
  const exactIdentityBound = receipts.filter((item) => item.contentBound && item.identity.exactAddressPresent).length;
  const blocked = receipts.filter((item) => item.state === "blocked").length;
  const errors = receipts.filter((item) => item.state === "error").length;
  const aggregateRoot = sha256Digest(canonicalJson(receipts.map((item) => item.receiptDigest)));
  return {
    schemaVersion: PASS4807_PUBLIC_SOURCE_RECEIPTS_ID,
    generatedAt: new Date().toISOString(),
    contractAddress,
    chain,
    receipts,
    summary: { submitted, contentBound, exactIdentityBound, blocked, errors, aggregateRoot },
    customerRows: receipts.map((item) => ({
      label: `${item.kind.toUpperCase()} public source`,
      status: item.state,
      output: item.contentBound
        ? `Content-bound ${item.contentType ?? "source"}; identity ${item.identity.exactAddressPresent ? "matched" : "not proven"}; freshness ${item.freshness}.`
        : `Source unavailable: ${item.missing[0] ?? "not submitted"}.`,
    })),
    missing: receipts.flatMap((item) => item.missing.map((reason) => `${item.kind}:${reason}`)).slice(0, 24),
  };
}
