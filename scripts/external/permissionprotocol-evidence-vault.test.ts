import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { EvidenceVault } from "../../lib/security/evidence-vault/evidence-vault.ts";
import { verifyLocalPublishedAudit } from "../../lib/security/evidence-vault/public-verification.ts";
import { GET as verifyRoute } from "../../app/api/audit/verify/[id]/route.ts";
import { NextRequest } from "next/server";

async function main() {
  const work = process.env.PP_WORK ?? "/tmp/pp";
  const root = resolve(process.cwd(), "evidence");
  const auditId = "permissionprotocol-rcpt-dg-cmtd3mwmw00155is990y35ue1";

  const receiptBytes = readFileSync(resolve(work, "receipt.json"));
  const keysBytes = readFileSync(resolve(work, "keys.json"));
  const receipt = JSON.parse(receiptBytes.toString("utf8"));
  const keyset = JSON.parse(keysBytes.toString("utf8"));
  const artifact = receipt.artifact;
  const payload = Buffer.from(artifact.payload_bytes_b64, "base64");
  const digest = createHash("sha256").update(payload).digest();
  const hashMatch = digest.toString("hex") === artifact.signed_payload_hash;

  const key = keyset.keys.find((k: any) => k.key_id === artifact.key_id);
  if (!key) throw new Error("receipt key id not found in current key set");
  const raw = Buffer.from(key.public_key_b64, "base64");
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
  const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
  const signature = Buffer.from(artifact.signature_b64, "base64");
  const signatureVerified = cryptoVerify(null, digest, publicKey, signature);
  const mutated = Buffer.from(digest); mutated[0] ^= 1;
  const mutationRejected = !cryptoVerify(null, mutated, publicKey, signature);

  const payloadObject = JSON.parse(payload.toString("utf8"));
  const request = JSON.parse(payloadObject.requestJson);
  const expiredAtReview = Date.now() > Date.parse(payloadObject.expiresAt);
  const verifierOutput = readFileSync(resolve(work, "verifier.stdout.txt"), "utf8");
  const commitHttpStatus = Number(readFileSync(resolve(work, "commit-http-status.txt"), "utf8").trim());

  if (!hashMatch || !signatureVerified || !mutationRejected) throw new Error("independent receipt verification failed");
  if (!verifierOutput.includes("VERIFIED: rcpt_dg_cmtd3mwmw00155is990y35ue1")) throw new Error("publisher CLI did not verify exact receipt");

  const independent = {
    receiptId: artifact.receipt_id,
    signedPayloadHash: artifact.signed_payload_hash,
    hashMatch,
    keyId: artifact.key_id,
    keyStatus: key.status,
    keyRevokedAt: key.revoked_at,
    signatureVerified,
    mutatedDigestRejected: mutationRejected,
    issuedAt: payloadObject.createdAt,
    expiresAt: payloadObject.expiresAt,
    expiredAtReview,
    providerCliVersion: JSON.parse(readFileSync(resolve(work, "npm-package.json"), "utf8")).version,
    providerCliVerified: true,
    context: request.scope,
    contextInterpretation: "CALLER_SUPPLIED_AND_NOT_INTERPRETED_BY_PERMISSION_PROTOCOL",
    referencedCommitPublicResolutionHttpStatus: commitHttpStatus,
  };
  writeFileSync(resolve(work, "independent-result.json"), JSON.stringify(independent, null, 2));

  const vault = new EvidenceVault(root);
  vault.storeArtifact(auditId, { category: "static", filename: "receipt.json", content: receiptBytes });
  vault.storeArtifact(auditId, { category: "static", filename: "keys.json", content: keysBytes });
  vault.storeArtifact(auditId, { category: "human-review", filename: "independent-result.json", content: JSON.stringify(independent, null, 2) });
  vault.storeArtifact(auditId, { category: "human-review", filename: "provider-cli-output.txt", content: verifierOutput });

  const pdf = Buffer.from(
    "%PDF-1.4\n% Velmere reference only public receipt verification record\n" +
    "Permission Protocol receipt rcpt_dg_cmtd3mwmw00155is990y35ue1\n" +
    "Cryptographic signature verified. Current enforcement validity expired at review time.\n%%EOF\n",
    "utf8",
  );
  vault.storeArtifact(auditId, { category: "report", filename: "permissionprotocol-reference.pdf", content: pdf });

  const manifest = vault.buildAndStoreManifest({
    auditId,
    name: "Permission Protocol public Deploy Gate receipt",
    repositoryUrl: "https://github.com/permission-protocol/site",
    commitHash: request.scope.commitSha,
    sourceHash: createHash("sha256").update(receiptBytes).digest("hex"),
    toolchain: [
      { name: "node-crypto", version: process.version, command: "SHA-256 payload verification and Ed25519 signature verification", status: "PASS" },
      { name: "permission-protocol-verify", version: independent.providerCliVersion, command: "public receipt verifier", status: "PASS" },
      { name: "velmere-evidence-vault", version: "current-q21", command: "artifact hashing, Merkle root and public integrity verification", status: "PASS" },
    ],
    reportBuffer: pdf,
  });
  const manifestPath = resolve(root, auditId, "manifest", "manifest.json");
  const publicManifest = { ...manifest, publication: { visibility: "public" as const, scope: "integrity-only" as const } };
  writeFileSync(manifestPath, JSON.stringify(publicManifest, null, 2), "utf8");

  const verification = await verifyLocalPublishedAudit(auditId, root);
  if (!verification.ok || verification.status !== "INTEGRITY_MATCH") throw new Error("Velmere Evidence Vault verification failed");

  const routeResponse = await verifyRoute(new NextRequest("http://localhost/api/audit/verify/" + auditId), { params: Promise.resolve({ id: auditId }) });
  const routeBody = await routeResponse.json();
  if (routeResponse.status !== 200 || routeBody.status !== "INTEGRITY_MATCH") throw new Error("actual Velmere verification API route failed");

  const result = {
    schema: "velmere.external-evidence-case.v1",
    baseVelmereCommit: "5062db5e5c68416b3d179441bfac98913946d16e",
    subject: independent,
    velmereEvidenceVault: verification,
    actualVelmereApiRoute: { httpStatus: routeResponse.status, body: routeBody },
    claimBoundary: {
      receiptBytesAndSignature: "SUPPORTED_BY_INDEPENDENT_REPLAY",
      currentIssuerKeyStatus: key.status === "active" && key.revoked_at == null ? "SUPPORTED_AT_REVIEW_TIME" : "NOT_SUPPORTED",
      providerOfflineCliCryptographicResult: "SUPPORTED",
      currentEnforcementValidity: expiredAtReview ? "EXPIRED_REAUTHORIZATION_REQUIRED" : "CURRENT",
      commitContextIntegrityInsideReceipt: "TAMPER_EVIDENT",
      commitIdentityTruth: "NOT_ESTABLISHED_BY_PERMISSION_PROTOCOL_RECEIPT",
      publicCommitResolution: commitHttpStatus === 200 ? "OBSERVED" : "NOT_VERIFIED",
      staleAfterRepositoryOrPolicyChange: "NOT_EXPRESSED_BY_RECEIPT_LIFECYCLE",
      correctnessOfHumanDecision: "NOT_COVERED",
      productionSecurityCertification: "NOT_COVERED",
    },
  };
  mkdirSync(resolve(work, "final"), { recursive: true });
  writeFileSync(resolve(work, "final", "velmere-result.json"), JSON.stringify(result, null, 2));
  writeFileSync(resolve(work, "final", "velmere-manifest.json"), JSON.stringify(publicManifest, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
