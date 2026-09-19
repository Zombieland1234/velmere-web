import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { executeAuditInWorker } from '../../lib/security/v2/isolated-audit-runner';
import { executeFullAuditV2 } from '../../lib/security/v2/master-audit-orchestrator';
import { generateAuditSnapshotId } from '../../lib/security/v2/scoring-and-evidence-engine';
const address = '0x0000000000000000000000000000000000000015';
const call = '6000'.repeat(5) + '60015af15000';
for (const [name, code, expected] of [['live', call, 1], ['dead', '00' + call, 0], ['dynamic', '5f3556005b' + call, 1]] as const) {
  test(`C15 actual bundled worker: ${name} agrees with direct engine`, async () => {
    const input = { contractAddress: address, chainId: '1', bytecode: '0x' + code, fuzzIterations: 0 };
    const direct = executeFullAuditV2(input);
    const worker = await executeAuditInWorker(input);
    const select = (r: typeof direct) => r.findings.filter(f => f.findingId === 'VLM-SEC-UNCHECKED-LOW-LEVEL-CALL-01');
    assert.equal(select(direct).length, expected); assert.deepEqual(select(worker), select(direct));
    assert.equal(worker.snapshot.engineVersion, 'Velmère-V2.5.3');
  });
}

test('C15 snapshot identity is distinct from qualified C14B for identical input', () => {
  const snapshot = generateAuditSnapshotId({contractAddress:address,chainId:'1',bytecode:'0x00'});
  const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
  const oldPayload = JSON.stringify({schema:'velmere.audit-content-snapshot.v2',address,chainId:'1',blockNumber:null,bytecodeSha256:hash(Buffer.from('00','hex')),sourceCodeSha256:null,engineVersion:'Velmère-V2.5.1'});
  assert.equal(snapshot.engineVersion,'Velmère-V2.5.3');
  assert.notEqual(snapshot.snapshotDigest,'0x'+hash(oldPayload));
});
