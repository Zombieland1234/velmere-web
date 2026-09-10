import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256BytesDigest, sha256Digest } from "@/lib/security/cryptographic-digest";
import { readResponseBytesBounded } from "@/lib/network/fetch-with-deadline";
import { safeEgressFetchWithTrace, VelmereEgressPolicyError } from "@/lib/network/safe-egress";
import { buildPass2814ExternalUrlDecision } from "@/lib/market-integrity/top1-source-poisoning-ssrf-firewall";

export const PASS5001_AUDIT_ADJUDICATED_AUTHORITY_EVIDENCE_ID = "pass5001-audit-adjudicated-authority-evidence-v1" as const;

export type AuditAuthorityEvidenceState = "confirmed" | "not_applicable" | "partial" | "blocked" | "error";
export type AuditAuthorityReceiptClass = "chain_official_docs" | "project_maintainer";

export type AuditAuthorityReceipt = {
  schemaVersion: "velmere.audit-authority-receipt.v1";
  id: string;
  authorityClass: AuditAuthorityReceiptClass;
  providerId: string;
  providerFamily: string;
  upstreamRoot: string;
  independenceEligible: true;
  targetBound: boolean;
  statusCode: number;
  contentType: string;
  bodyBytes: number;
  bodyDigest: string;
  requestUrlDigest: string;
  observedAt: string;
  sourceTimestamp: string | null;
  sourceTimestampProvenance: "provider" | "transport_received";
  assertions: string[];
  receiptDigest: string;
};

export type AuditAdjudicatedAuthorityEvidence = {
  schemaVersion: typeof PASS5001_AUDIT_ADJUDICATED_AUTHORITY_EVIDENCE_ID;
  state: AuditAuthorityEvidenceState;
  generatedAt: string;
  target: {
    chain: string;
    chainId: string | null;
    contractAddress: string | null;
    projectName: string | null;
    canonicalReferenceId: string | null;
  };
  category: "deployment_identity";
  adverseKind: "wrong_contract_at_expected_address" | null;
  severity: "critical" | null;
  riskFloor: number | null;
  confidence: number;
  finding: string | null;
  customerLine: string | null;
  proPdfLine: string | null;
  documentedAlternateAddress: string | null;
  authorityRoots: string[];
  receipts: AuditAuthorityReceipt[];
  blockers: string[];
  evidenceDigest: string;
  truthBoundary: string;
};

type CanonicalReference = {
  id: string;
  projectName: string;
  canonicalAddress: string;
  sourceRepo: string;
  sourceCommit: string;
  p70SourceSha256: string;
  maintainerAuthorityUrl: string;
};

type ChainAuthority = {
  chainId: string;
  officialDocsHost: string;
  defaultContractsUrl: string;
};

const CANONICAL_REFERENCES: readonly CanonicalReference[] = Object.freeze([
  {
    id: "p70-multicall3-canonical-reference",
    projectName: "Multicall3",
    canonicalAddress: "0xca11bde05977b3631167028862be2a173976ca11",
    sourceRepo: "mds1/multicall3",
    sourceCommit: "b667d67ecfa5361a81e8f110234ce242613b0012",
    p70SourceSha256: "sha256:2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e",
    maintainerAuthorityUrl: "https://raw.githubusercontent.com/mds1/multicall3/b667d67ecfa5361a81e8f110234ce242613b0012/README.md",
  },
]);

const CHAIN_AUTHORITIES: Readonly<Record<string, ChainAuthority>> = Object.freeze({
  ancient8: {
    chainId: "888888888",
    officialDocsHost: "docs.ancient8.gg",
    defaultContractsUrl: "https://docs.ancient8.gg/using-ancient8-chain/contracts",
  },
});

const MAX_AUTHORITY_BYTES = 1_500_000;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function clean(value: unknown, max = 600) {
  return typeof value === "string" ? value.replace(/[<>{}\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function normalizedAddress(value: unknown) {
  const address = clean(value, 96).toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

function normalizedChain(value: unknown) {
  return clean(value, 48).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function publicUrl(value: string) {
  const parsed = new URL(value);
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString();
}

function hostOf(value: string) {
  return new URL(value).hostname.toLowerCase();
}

function pinnedRawGithubSource(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "raw.githubusercontent.com") return null;
  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/([a-fA-F0-9]{40})\/README\.md$/);
  return match ? { repo: `${match[1]}/${match[2]}`.toLowerCase(), commit: match[3]!.toLowerCase() } : null;
}

function normalizeText(bytes: Uint8Array, contentType: string) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 900_000);
  if (contentType === "application/json" || contentType.endsWith("+json")) return text.replace(/\s+/g, " ").trim();
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressesBoundToProjectLabel(text: string, projectName: string) {
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*(?:[:=-–—]\\s*)?(0x[a-fA-F0-9]{40})(?=\\s|$)`, "gi");
  const addresses = new Set<string>();
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match && addresses.size < 8) {
    const address = match[1]?.toLowerCase() ?? null;
    if (address) addresses.add(address);
    match = pattern.exec(text);
  }
  return Array.from(addresses);
}

function timestampFromHeaders(headers: Headers) {
  const value = headers.get("last-modified");
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

async function fetchAuthority(url: string, operation: string, allowedHosts: string[]) {
  const decision = buildPass2814ExternalUrlDecision(url);
  if (!decision.allowed || !decision.normalizedUrl) throw new Error(`authority_url_blocked:${operation}`);
  const allowed = new Set(allowedHosts.map((item) => item.toLowerCase()));
  if (!allowed.has(hostOf(decision.normalizedUrl))) throw new Error(`authority_host_not_allowed:${operation}`);
  const started = Date.now();
  const { response, trace } = await safeEgressFetchWithTrace(decision.normalizedUrl, {
    method: "GET",
    cache: "no-store",
    headers: { accept: "text/html,text/plain,application/json,*/*;q=0.1", "user-agent": "VelmereAuditAuthority/5001" },
  }, {
    allowedHosts: allowed,
    allowSubdomains: false,
    maxRedirects: 2,
    timeoutMs: 7_500,
    operation,
    allowedMethods: ["GET"],
    maxRequestBytes: 0,
    maxResponseBytes: MAX_AUTHORITY_BYTES,
  });
  const bytes = await readResponseBytesBounded(response, MAX_AUTHORITY_BYTES);
  const finalHost = hostOf(trace.finalUrl);
  if (!allowed.has(finalHost)) throw new Error(`authority_redirect_host_not_allowed:${operation}`);
  if (!response.ok || bytes.byteLength === 0) throw new Error(`authority_http_${response.status}:${operation}`);
  const contentType = (response.headers.get("content-type") ?? "application/octet-stream").split(";", 1)[0]!.trim().toLowerCase();
  const observedAt = new Date().toISOString();
  return {
    bytes,
    text: normalizeText(bytes, contentType),
    contentType,
    statusCode: response.status,
    observedAt,
    receivedAt: observedAt,
    sourceTimestamp: timestampFromHeaders(response.headers),
    finalUrl: publicUrl(trace.finalUrl),
    latencyMs: Math.max(0, Date.now() - started),
  };
}

function receipt(args: Omit<AuditAuthorityReceipt, "schemaVersion" | "receiptDigest">): AuditAuthorityReceipt {
  const unsigned = { schemaVersion: "velmere.audit-authority-receipt.v1" as const, ...args };
  return { ...unsigned, receiptDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function isStrictAuditAuthorityReceipt(value: AuditAuthorityReceipt) {
  return value.schemaVersion === "velmere.audit-authority-receipt.v1"
    && value.targetBound === true
    && value.independenceEligible === true
    && value.statusCode >= 200 && value.statusCode < 300
    && value.bodyBytes > 0
    && SHA256_PATTERN.test(value.bodyDigest)
    && SHA256_PATTERN.test(value.requestUrlDigest)
    && SHA256_PATTERN.test(value.receiptDigest)
    && Boolean(value.upstreamRoot.trim())
    && Boolean(value.providerFamily.trim())
    && Number.isFinite(Date.parse(value.observedAt));
}

export function verifyAuditAdjudicatedAuthorityEvidence(value: AuditAdjudicatedAuthorityEvidence | null | undefined) {
  if (!value || value.schemaVersion !== PASS5001_AUDIT_ADJUDICATED_AUTHORITY_EVIDENCE_ID) return false;
  const { evidenceDigest, ...unsigned } = value;
  if (sha256Digest(canonicalJson(unsigned)) !== evidenceDigest) return false;
  if (value.state !== "confirmed") return value.receipts.length === 0 || value.receipts.every(isStrictAuditAuthorityReceipt);
  if (value.adverseKind !== "wrong_contract_at_expected_address" || value.category !== "deployment_identity") return false;
  if (!value.target.contractAddress || !value.documentedAlternateAddress || value.target.contractAddress === value.documentedAlternateAddress) return false;
  if (value.receipts.length < 2 || !value.receipts.every(isStrictAuditAuthorityReceipt)) return false;
  if (new Set(value.receipts.map((item) => item.upstreamRoot)).size < 2) return false;
  if (new Set(value.receipts.map((item) => item.authorityClass)).size < 2) return false;
  return value.authorityRoots.length >= 2 && value.riskFloor !== null && value.riskFloor >= 80 && value.confidence >= 90;
}

function finalize(value: Omit<AuditAdjudicatedAuthorityEvidence, "evidenceDigest">): AuditAdjudicatedAuthorityEvidence {
  const evidenceDigest = sha256Digest(canonicalJson(value));
  return { ...value, evidenceDigest };
}

function emptyEvidence(args: {
  state: Exclude<AuditAuthorityEvidenceState, "confirmed">;
  chain: string;
  chainId: string | null;
  contractAddress: string | null;
  projectName: string | null;
  canonicalReferenceId: string | null;
  blockers: string[];
}): AuditAdjudicatedAuthorityEvidence {
  return finalize({
    schemaVersion: PASS5001_AUDIT_ADJUDICATED_AUTHORITY_EVIDENCE_ID,
    state: args.state,
    generatedAt: new Date().toISOString(),
    target: {
      chain: args.chain,
      chainId: args.chainId,
      contractAddress: args.contractAddress,
      projectName: args.projectName,
      canonicalReferenceId: args.canonicalReferenceId,
    },
    category: "deployment_identity",
    adverseKind: null,
    severity: null,
    riskFloor: null,
    confidence: 0,
    finding: null,
    customerLine: null,
    proPdfLine: null,
    documentedAlternateAddress: null,
    authorityRoots: [],
    receipts: [],
    blockers: args.blockers.slice(0, 16),
    truthBoundary: "No adverse deployment-identity claim is created unless a canonical reference, official chain authority and independent project-maintainer authority all bind to the same target.",
  });
}

export async function buildAuditAdjudicatedAuthorityEvidence(input: {
  chain?: string | null;
  contractAddress?: string | null;
  docsUrl?: string | null;
  maintainerUrl?: string | null;
}): Promise<AuditAdjudicatedAuthorityEvidence> {
  const chain = normalizedChain(input.chain) || "ethereum";
  const contractAddress = normalizedAddress(input.contractAddress);
  const reference = contractAddress ? CANONICAL_REFERENCES.find((item) => item.canonicalAddress === contractAddress) ?? null : null;
  const authority = CHAIN_AUTHORITIES[chain] ?? null;
  if (!contractAddress || !reference || !authority) {
    return emptyEvidence({
      state: "not_applicable",
      chain,
      chainId: authority?.chainId ?? null,
      contractAddress,
      projectName: reference?.projectName ?? null,
      canonicalReferenceId: reference?.id ?? null,
      blockers: [!contractAddress ? "evm_contract_address_required" : null, !reference ? "canonical_reference_not_registered" : null, !authority ? "chain_authority_not_registered" : null].filter((item): item is string => Boolean(item)),
    });
  }

  const docsUrl = clean(input.docsUrl, 700) || authority.defaultContractsUrl;
  const maintainerUrl = clean(input.maintainerUrl, 700) || reference.maintainerAuthorityUrl;
  try {
    if (hostOf(docsUrl) !== authority.officialDocsHost) throw new Error("official_chain_docs_host_mismatch");
    const pinnedMaintainer = pinnedRawGithubSource(maintainerUrl);
    if (!pinnedMaintainer || pinnedMaintainer.repo !== reference.sourceRepo.toLowerCase() || pinnedMaintainer.commit !== reference.sourceCommit.toLowerCase()) throw new Error("project_maintainer_repository_or_commit_mismatch");

    const [docs, maintainer] = await Promise.all([
      fetchAuthority(docsUrl, "audit_authority_chain_docs", [authority.officialDocsHost]),
      fetchAuthority(maintainerUrl, "audit_authority_project_maintainer", ["raw.githubusercontent.com"]),
    ]);

    const docsLower = docs.text.toLowerCase();
    const projectMentionedInDocs = docsLower.includes(reference.projectName.toLowerCase());
    const chainMentionedInDocs = docsLower.includes(chain) || docsLower.includes("ancient8");
    const projectBoundAddresses = addressesBoundToProjectLabel(docs.text, reference.projectName);
    const documentedAlternateAddress = projectBoundAddresses.find((address) => address !== contractAddress) ?? null;
    if (!projectMentionedInDocs || !chainMentionedInDocs || !documentedAlternateAddress) throw new Error("official_docs_role_address_contradiction_not_bound");

    const maintainerLower = maintainer.text.toLowerCase();
    const maintainerBound = maintainerLower.includes(reference.projectName.toLowerCase())
      && maintainerLower.includes(chain)
      && maintainerLower.includes(contractAddress)
      && maintainerLower.includes("has been compromised")
      && (maintainerLower.includes("custom contract being deployed to the multicall3 address on ancient8")
        || maintainerLower.includes("only the ancient8 deployment is known to be incorrect"));
    if (!maintainerBound) throw new Error("project_maintainer_pinned_readme_adverse_statement_not_bound");

    const docsReceipt = receipt({
      id: `authority-chain-docs-${sha256Digest(docs.finalUrl).replace(/^sha256:/, "").slice(0, 20)}`,
      authorityClass: "chain_official_docs",
      providerId: `official-docs:${authority.officialDocsHost}`,
      providerFamily: "official_chain_authority",
      upstreamRoot: authority.officialDocsHost,
      independenceEligible: true,
      targetBound: true,
      statusCode: docs.statusCode,
      contentType: docs.contentType,
      bodyBytes: docs.bytes.byteLength,
      bodyDigest: sha256BytesDigest(docs.bytes),
      requestUrlDigest: sha256Digest(docs.finalUrl),
      observedAt: docs.observedAt,
      sourceTimestamp: docs.sourceTimestamp,
      sourceTimestampProvenance: docs.sourceTimestamp ? "provider" : "transport_received",
      assertions: [
        `chain:${chain}`,
        `project:${reference.projectName}`,
        `documented_address:${documentedAlternateAddress}`,
        `requested_address_absent:${!projectBoundAddresses.includes(contractAddress)}`,
      ],
    });
    const sourceTimestamp = maintainer.sourceTimestamp;
    const maintainerReceipt = receipt({
      id: `authority-project-maintainer-${sha256Digest(maintainer.finalUrl).replace(/^sha256:/, "").slice(0, 20)}`,
      authorityClass: "project_maintainer",
      providerId: `github-pinned-readme:${reference.sourceRepo}@${reference.sourceCommit}`,
      providerFamily: "project_maintainer_repository_authority",
      upstreamRoot: "raw.githubusercontent.com",
      independenceEligible: true,
      targetBound: true,
      statusCode: maintainer.statusCode,
      contentType: maintainer.contentType,
      bodyBytes: maintainer.bytes.byteLength,
      bodyDigest: sha256BytesDigest(maintainer.bytes),
      requestUrlDigest: sha256Digest(maintainer.finalUrl),
      observedAt: maintainer.observedAt,
      sourceTimestamp: sourceTimestamp ?? null,
      sourceTimestampProvenance: sourceTimestamp ? "provider" : "transport_received",
      assertions: [
        `repository:${reference.sourceRepo}`,
        `source_commit:${reference.sourceCommit}`,
        `project:${reference.projectName}`,
        `chain:${chain}`,
        `wrong_contract_address:${contractAddress}`,
      ],
    });

    const authorityRoots = [docsReceipt.upstreamRoot, maintainerReceipt.upstreamRoot];
    const value = finalize({
      schemaVersion: PASS5001_AUDIT_ADJUDICATED_AUTHORITY_EVIDENCE_ID,
      state: "confirmed",
      generatedAt: new Date().toISOString(),
      target: {
        chain,
        chainId: authority.chainId,
        contractAddress,
        projectName: reference.projectName,
        canonicalReferenceId: reference.id,
      },
      category: "deployment_identity",
      adverseKind: "wrong_contract_at_expected_address",
      severity: "critical",
      riskFloor: 90,
      confidence: 96,
      finding: `${reference.projectName} deployment identity mismatch on ${chain}: the expected canonical address ${contractAddress} is not the address currently documented by the official chain authority.`,
      customerLine: `Critical deployment-identity mismatch: official ${chain} documentation assigns ${reference.projectName} to ${documentedAlternateAddress}, while the project maintainer independently documents that the canonical ${contractAddress} deployment on ${chain} was created with a compromised deployer key as a different contract. Current runtime bytecode remains unverified until RPC quorum is available.`,
      proPdfLine: `Deployment identity contradiction confirmed by two independent authorities. canonical=${contractAddress}; official_chain_documented=${documentedAlternateAddress}; repo=${reference.sourceRepo}; sourceCommit=${reference.sourceCommit}; p70Source=${reference.p70SourceSha256}; runtimeBytecode=current_unverified.`,
      documentedAlternateAddress,
      authorityRoots,
      receipts: [docsReceipt, maintainerReceipt],
      blockers: ["current_runtime_bytecode_quorum_unavailable"],
      truthBoundary: "This evidence proves a deployment-identity contradiction, not a source-code vulnerability or exploitability finding. The 90/100 risk floor applies only to the audited deployment identity because using the wrong contract at an expected canonical address is a critical integrity hazard; current runtime bytecode remains explicitly unverified until independent RPC quorum exists.",
    });
    if (!verifyAuditAdjudicatedAuthorityEvidence(value)) throw new Error("adjudicated_authority_evidence_self_verification_failed");
    return value;
  } catch (error) {
    const reason = error instanceof VelmereEgressPolicyError ? error.code : error instanceof Error ? error.message.slice(0, 180) : "authority_evidence_failed";
    return emptyEvidence({
      state: error instanceof VelmereEgressPolicyError ? "blocked" : "error",
      chain,
      chainId: authority.chainId,
      contractAddress,
      projectName: reference.projectName,
      canonicalReferenceId: reference.id,
      blockers: [reason],
    });
  }
}
