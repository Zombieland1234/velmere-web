import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { EvidenceVault } from "../../lib/security/evidence-vault/evidence-vault.ts";
import { verifyLocalPublishedAudit } from "../../lib/security/evidence-vault/public-verification.ts";
import { createEvidenceRecord, type ClaimRecord, type EvidenceStatus } from "../../lib/security/evidence/evidence-record.ts";
import { GET as verifyRoute } from "../../app/api/audit/verify/[id]/route.ts";
import { NextRequest } from "next/server";

type Pass2 = {
  schema: string;
  archive: Record<string, unknown>;
  executionOrderFinding: {
    exit: number;
    manifestMismatchDetected: boolean;
    mismatchedExecutableRanAfterDetection: boolean;
    marker: string | null;
    finalResult: string | null;
  };
  claims: Array<{ id: string; claim: string; status: EvidenceStatus; basis: string }>;
};

function publicize(root: string, auditId: string, manifest: any) {
  const path = resolve(root, auditId, "manifest", "manifest.json");
  const publicManifest = { ...manifest, publication: { visibility: "public" as const, scope: "integrity-only" as const } };
  writeFileSync(path, JSON.stringify(publicManifest, null, 2));
  return publicManifest;
}

async function verifyThroughActualRoute(auditId: string) {
  const response = await verifyRoute(
    new NextRequest("http://localhost/api/audit/verify/" + auditId),
    { params: Promise.resolve({ id: auditId }) },
  );
  return { httpStatus: response.status, body: await response.json() };
}

async function main() {
  const work = resolve(process.env.ZV_WORK ?? "/tmp/zv-pass2");
  const authenticZip = readFileSync(process.env.ZV_ZIP!);
  const forgedZip = readFileSync(resolve(work, "combined-semantic-forgery.zip"));
  const pass2 = JSON.parse(readFileSync(resolve(work, "pass2-result.json"), "utf8")) as Pass2;
  const providerOutput = readFileSync(process.env.ZV_PROVIDER_OUTPUT!, "utf8");

  const evidenceRoot = resolve(process.cwd(), "evidence");
  const authenticId = "zerovaultid-rung6-pass2";
  const forgedId = "zerovaultid-rung6-pass2-nonauthentic-control";
  rmSync(resolve(evidenceRoot, authenticId), { recursive: true, force: true });
  rmSync(resolve(evidenceRoot, forgedId), { recursive: true, force: true });

  const claimRecords: ClaimRecord[] = pass2.claims.map((c, i) => ({
    claimId: c.id,
    claimText: c.claim,
    claimType: c.id.includes("KEY") || c.id.includes("SIGNATURE") || c.id.includes("FILES") ? "CRYPTOGRAPHIC_SEAL" : "SECURITY_INVARIANT",
    evidenceIds: ["EV-ZV-PASS2-001"],
    confidence: c.status === "PASS" || c.status === "FAIL" ? 100 : c.status === "WARN" ? 85 : 70,
    status: c.status,
    source: "ZeroVaultID public Cert Seal Rung 6 kit + Velmere Pass 2 replay",
    calculation: c.basis,
    timestamp: new Date().toISOString(),
  }));

  const rawPass2Evidence = createEvidenceRecord({
    id: "EV-ZV-PASS2-001",
    auditId: authenticId,
    category: "CRYPTOGRAPHIC",
    status: pass2.executionOrderFinding.mismatchedExecutableRanAfterDetection ? "WARN" : "PASS",
    method: "AUTOMATED_EXECUTION",
    source: "ZeroVaultID public Cert Seal Rung 6 kit",
    tool: "velmere-external-evidence-pass2",
    toolVersion: "q21",
    timestamp: new Date().toISOString(),
    command: "scripts/external/zerovault-pass2.py",
    environment: "GitHub Actions Ubuntu 24.04; provider verifier in node:20 --network none",
    inputData: authenticZip,
    outputData: pass2,
    normalizedArtifact: {
      executionOrderFinding: pass2.executionOrderFinding,
      claimCount: claimRecords.length,
    },
  });
  const rawEvidenceRuntime = rawPass2Evidence as unknown as Record<string, unknown>;
  const evidenceRecordFactoryRetainedRawInputs = "inputData" in rawEvidenceRuntime || "outputData" in rawEvidenceRuntime;
  const { inputData: _rawInputData, outputData: _rawOutputData, ...pass2Evidence } = rawEvidenceRuntime;
  if (!evidenceRecordFactoryRetainedRawInputs) {
    throw new Error("Expected current Q21 createEvidenceRecord raw-input retention finding was not reproduced");
  }

  const vault = new EvidenceVault(evidenceRoot);
  vault.storeArtifact(authenticId, { category: "static", filename: "zerovaultid-certseal-rung6.zip", content: authenticZip });
  vault.storeArtifact(authenticId, { category: "human-review", filename: "pass2-result.json", content: JSON.stringify(pass2, null, 2) });
  vault.storeArtifact(authenticId, { category: "human-review", filename: "claim-records.json", content: JSON.stringify(claimRecords, null, 2) });
  vault.storeArtifact(authenticId, { category: "human-review", filename: "provider-verifier-output.txt", content: providerOutput });
  vault.storeArtifact(authenticId, { category: "human-review", filename: "evidence-record.json", content: JSON.stringify(pass2Evidence, null, 2) });
  const pdf = Buffer.from(
    "%PDF-1.4\n% Velmere ZeroVaultID Pass 2 reference record\n" +
    "Scope: evidence semantics / mutation / claim boundaries. NOT A PRODUCTION SECURITY CERTIFICATION.\n%%EOF\n",
  );
  vault.storeArtifact(authenticId, { category: "report", filename: "zerovaultid-pass2-reference.pdf", content: pdf });
  const authenticManifest = vault.buildAndStoreManifest({
    auditId: authenticId,
    name: "ZeroVaultID Cert Seal Rung 6 — Velmere Pass 2",
    repositoryUrl: "https://github.com/ZeroVaultID-Inc/evidence-signing-keys",
    commitHash: "4650672e0e1bb65fdd6437c271c9c5eceeca01c5",
    sourceHash: "fe876ce644321c2f22b3cd2c565b25ea6c5452912dfdc905a100f31b49e3efac",
    evidenceRecords: [pass2Evidence],
    toolchain: [
      { name: "zerovaultid-verify.js", version: "sha256:e9fa708b", status: "PASS" },
      { name: "velmere-external-evidence-pass2", version: "q21", status: "PASS_WITH_FINDING" },
      { name: "velmere-evidence-vault", version: "3.0.0-institutional", status: "PASS" },
    ],
    reportBuffer: pdf,
  });
  const authenticPublicManifest = publicize(evidenceRoot, authenticId, authenticManifest);
  mkdirSync(resolve(work, "velmere"), { recursive: true });
  writeFileSync(resolve(work, "velmere", "authentic-manifest.json"), JSON.stringify(authenticPublicManifest, null, 2));
  const authenticLocal = await verifyLocalPublishedAudit(authenticId, evidenceRoot);
  const authenticRoute = await verifyThroughActualRoute(authenticId);
  mkdirSync(resolve(work, "velmere"), { recursive: true });
  writeFileSync(resolve(work, "velmere", "authentic-debug.json"), JSON.stringify({ authenticLocal, authenticRoute }, null, 2));
  console.log("AUTHENTIC_DEBUG", JSON.stringify({ authenticLocal, authenticRoute }, null, 2));
  if (!authenticLocal.ok || authenticRoute.httpStatus !== 200 || authenticRoute.body.status !== "INTEGRITY_MATCH") {
    throw new Error("Authentic Pass 2 Velmere route failed");
  }

  // Control: a self-consistent bundle re-signed by a non-authentic key is still a perfectly
  // internally consistent byte artifact. The current public route MUST NOT call it authentic.
  const controlVault = new EvidenceVault(evidenceRoot);
  controlVault.storeArtifact(forgedId, { category: "static", filename: "combined-semantic-forgery.zip", content: forgedZip });
  const controlPdf = Buffer.from("%PDF-1.4\n% NON-AUTHENTIC CONTROL — integrity-only\n%%EOF\n");
  controlVault.storeArtifact(forgedId, { category: "report", filename: "nonauthentic-control.pdf", content: controlPdf });
  const controlManifest = controlVault.buildAndStoreManifest({
    auditId: forgedId,
    name: "ZeroVaultID non-authentic re-signing control",
    sourceHash: createEvidenceRecord({
      id: "EV-TMP", auditId: forgedId, category: "SYSTEM", status: "PASS", method: "CALCULATED",
      source: "local", tool: "sha256", timestamp: new Date().toISOString(), inputData: forgedZip, outputData: forgedZip,
    }).inputHash,
    reportBuffer: controlPdf,
    toolchain: [{ name: "velmere-evidence-vault", version: "3.0.0-institutional", status: "PASS" }],
  });
  publicize(evidenceRoot, forgedId, controlManifest);
  const forgedRoute = await verifyThroughActualRoute(forgedId);
  if (forgedRoute.httpStatus !== 200 || forgedRoute.body.status !== "INTEGRITY_MATCH" || forgedRoute.body.authenticity !== "NOT_VERIFIED") {
    throw new Error("Integrity-only boundary changed for non-authentic control");
  }

  const final = {
    schema: "velmere.external-evidence-pass2-result.v1",
    baseVelmereCommit: "5062db5e5c68416b3d179441bfac98913946d16e",
    pass2Evidence,
    claimRecords,
    authentic: {
      evidenceVault: authenticLocal,
      actualApiRoute: authenticRoute,
    },
    nonAuthenticResignedControl: {
      actualApiRoute: forgedRoute,
      expectedInterpretation: "INTEGRITY_MATCH_ONLY_NOT_PROVIDER_AUTHENTICITY",
    },
    productBoundary: {
      publicVerificationRouteScope: "LOCAL_ARTIFACT_BYTES_AND_MANIFEST_NOT_AUDIT_VALIDITY",
      externalProviderKeyFingerprintAndRevocationAreNotInputsToThisRoute: true,
      automaticProviderKeyRevocationToStaleIsNotEstablishedByThisRoute: true,
      externalTrustAdapterNeededForProviderAuthenticityElevation: true,
      evidenceRecordFactoryRetainsRawInputOutputAtRuntime: evidenceRecordFactoryRetainedRawInputs,
      evidenceRecordFactoryImpactObserved: "47.7MB_SERIALIZED_RECORD_FROM_4.5MB_ZIP_CAUSED_STRICT_PUBLIC_MANIFEST_REJECTION",
    },
    keyFinding: pass2.executionOrderFinding,
  };

  mkdirSync(resolve(work, "velmere"), { recursive: true });
  writeFileSync(resolve(work, "velmere", "pass2-velmere-result.json"), JSON.stringify(final, null, 2));
  writeFileSync(resolve(work, "velmere", "claim-records.json"), JSON.stringify(claimRecords, null, 2));
  console.log(JSON.stringify({
    claims: claimRecords.reduce<Record<string, number>>((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {}),
    authenticRoute: { status: authenticRoute.httpStatus, result: authenticRoute.body.status, authenticity: authenticRoute.body.authenticity },
    forgedControlRoute: { status: forgedRoute.httpStatus, result: forgedRoute.body.status, authenticity: forgedRoute.body.authenticity },
    executionOrderFinding: pass2.executionOrderFinding,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
