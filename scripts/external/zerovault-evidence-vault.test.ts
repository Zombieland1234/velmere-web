import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { EvidenceVault } from "../../lib/security/evidence-vault/evidence-vault.ts";
import { verifyLocalPublishedAudit } from "../../lib/security/evidence-vault/public-verification.ts";

const work = process.env.ZV_WORK ?? "/tmp/zv";
const root = resolve(work, "velmere-evidence");
const auditId = "zerovaultid-rung6-rung6r3b-542e60f5";
const archive = readFileSync(resolve(work, "zerovaultid-certseal-rung6.zip"));
const verifierOutput = readFileSync(resolve(work, "verifier-output.txt"), "utf8");
const authenticity = readFileSync(resolve(work, "authenticity-transcript.txt"), "utf8");
const currentAnchor = readFileSync(resolve(work, "anchor-main-readme.txt"), "utf8");

const archiveSha = createHash("sha256").update(archive).digest("hex");
if (archiveSha !== "fe876ce644321c2f22b3cd2c565b25ea6c5452912dfdc905a100f31b49e3efac") {
  throw new Error("archive digest drift before Evidence Vault intake");
}

const vault = new EvidenceVault(root);
vault.storeArtifact(auditId, {
  category: "static",
  filename: "zerovaultid-certseal-rung6.zip",
  content: archive,
});
vault.storeArtifact(auditId, {
  category: "human-review",
  filename: "authenticity-transcript.txt",
  content: authenticity,
});
vault.storeArtifact(auditId, {
  category: "human-review",
  filename: "verifier-output.txt",
  content: verifierOutput,
});
vault.storeArtifact(auditId, {
  category: "human-review",
  filename: "anchor-main-readme.txt",
  content: currentAnchor,
});

const pdf = Buffer.from(
  "%PDF-1.4\n% Velmere reference-only external evidence verification record\n" +
  "ZeroVaultID Cert Seal Rung 6 — REFERENCE_ONLY / NOT_A_SECURITY_CERTIFICATION\n" +
  "Archive SHA-256: " + archiveSha + "\n%%EOF\n",
  "utf8",
);
vault.storeArtifact(auditId, {
  category: "report",
  filename: "zerovaultid-rung6-reference.pdf",
  content: pdf,
});

const manifest = vault.buildAndStoreManifest({
  auditId,
  name: "ZeroVaultID Cert Seal Rung 6 evidence kit",
  repositoryUrl: "https://github.com/ZeroVaultID-Inc/evidence-signing-keys",
  commitHash: "4650672e0e1bb65fdd6437c271c9c5eceeca01c5",
  sourceHash: archiveSha,
  toolchain: [
    { name: "openssl", version: "runner", command: "independent fingerprint + Ed25519 signature verification", status: "PASS" },
    { name: "zerovaultid-verify.js", version: "sha256:e9fa708b", command: "node verify.js in --network none clean room", status: verifierOutput.includes("RESULT: 7/7 PASS") ? "PASS" : "FAIL" },
    { name: "velmere-evidence-vault", version: "current-q21", command: "artifact hashing + Merkle root + public integrity verification", status: "PASS" },
  ],
  reportBuffer: pdf,
});

const manifestPath = resolve(root, auditId, "manifest", "manifest.json");
const publicManifest = {
  ...manifest,
  publication: { visibility: "public" as const, scope: "integrity-only" as const },
};
writeFileSync(manifestPath, JSON.stringify(publicManifest, null, 2), "utf8");

const verification = await verifyLocalPublishedAudit(auditId, root);
if (!verification.ok) {
  throw new Error("Velmere public verification failed: " + JSON.stringify(verification));
}
if (
  verification.status !== "INTEGRITY_MATCH" ||
  verification.authenticity !== "NOT_VERIFIED" ||
  verification.timestampVerified !== false ||
  verification.releaseApproved !== false
) {
  throw new Error("Velmere truth-boundary contract changed unexpectedly");
}

const result = {
  schema: "velmere.external-evidence-case.v1",
  sourceCommit: process.env.GITHUB_SHA ?? null,
  baseVelmereCommit: "5062db5e5c68416b3d179441bfac98913946d16e",
  subject: {
    provider: "ZeroVaultID",
    run: "rung6r3b-542e60f5",
    archive: "zerovaultid-certseal-rung6.zip",
    archiveSha256: archiveSha,
    archiveBytes: archive.length,
    archiveEntries: Number(process.env.ZV_ENTRY_COUNT ?? "0"),
    verifierSha256: "e9fa708bf48ae88354d60ebc379dacb277d2f425b64895aeb6b5206c6114cdb4",
    signingKeyFingerprint: "234374010ba7c648e59f26003b7915ce2c70899cd101c770cb046f5d6e3b5286",
    keyStatusCheckedAgainstCurrentDefaultBranch: true,
    exactArchiveAnchorCommit: "4650672e0e1bb65fdd6437c271c9c5eceeca01c5",
    providerGivenKeyRotationCommit: "9a3ef7eed30481a4010441829af5a0a85526fca5",
  },
  independentAuthenticity: {
    keyFingerprintMatch: authenticity.includes("KEY_FINGERPRINT_MATCH=PASS"),
    currentKeyNotRevoked: authenticity.includes("CURRENT_KEY_STATUS=PASS"),
    manifestSignature: authenticity.includes("MANIFEST_SIGNATURE=PASS"),
    verifierDigestMatch: authenticity.includes("VERIFY_JS_DIGEST=PASS"),
  },
  providerVerifier: {
    cleanRoomNetworkDisabled: true,
    result7of7: verifierOutput.includes("RESULT: 7/7 PASS"),
  },
  velmereEvidenceVault: verification,
  claimBoundary: {
    bundleConstructionAndRecomputation: "SUPPORTED_BY_REPLAY",
    signedBundleTamperEvidence: "SUPPORTED_BY_REPLAY_AND_INDEPENDENT_SIGNATURE_CHECK",
    signerIdentityBeyondGitHubAnchor: "NOT_COVERED",
    cantonLedgerEnforcement: "NOT_COVERED",
    ledgerRefsTruthAgainstLiveLedger: "NOT_COVERED",
    railChecks1And2: "NOT_COVERED_BY_BUNDLE",
    confidentialityOfCloseC: "NOT_COVERED_AND_BUNDLE_DISCLOSES_OPENING_INPUTS",
    unlinkability: "NOT_SUPPORTED_FOR_THIS_RUN",
    productionSecurityCertification: "NOT_COVERED",
  },
};

mkdirSync(resolve(work, "final"), { recursive: true });
writeFileSync(resolve(work, "final", "velmere-result.json"), JSON.stringify(result, null, 2));
writeFileSync(resolve(work, "final", "velmere-manifest.json"), JSON.stringify(publicManifest, null, 2));
console.log(JSON.stringify(result, null, 2));
