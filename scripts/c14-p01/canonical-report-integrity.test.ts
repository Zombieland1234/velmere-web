import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildCanonicalAuditReport,
  type AuditTier,
} from "../../lib/security/audit-canonical-report";
import { verifyReportPki } from "../../lib/security/audit-pki-signature";
import { canonicalJson } from "../../lib/security/canonical-json";

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

for (const tier of ["basic", "pro", "advanced"] as const satisfies readonly AuditTier[]) {
  test(`final ${tier} report digest is exactly the digest signed by its PKI attestation`, () => {
    const report = buildCanonicalAuditReport({
      reportId: `rep_c14p01_integrity_${tier}`,
      caseRef: `case_c14p01_integrity_${tier}`,
      contractAddress: "0x1234567890123456789012345678901234567891",
      contractName: "C14P01 Integrity Probe",
      network: "Ethereum Mainnet",
      chainId: "1",
      locale: "en",
      rawBytecode: "0x60006000f3",
    }, tier);

    const { reportDigest, pkiAttestation, ...unsignedCore } = report;
    assert.ok(pkiAttestation);
    assert.equal(reportDigest, sha256(canonicalJson(unsignedCore)));
    const cleanDigest = reportDigest.startsWith("sha256:") ? reportDigest.slice(7) : reportDigest;
    assert.equal(pkiAttestation.signedDigest, cleanDigest);
    assert.equal(pkiAttestation.timestampToken.messageImprint, cleanDigest);
    assert.equal(verifyReportPki(pkiAttestation), true);
  });
}
