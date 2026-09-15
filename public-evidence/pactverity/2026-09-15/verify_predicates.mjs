import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

const fixturePath = new URL('./source/scenarios.json', import.meta.url);
const raw = await readFile(fixturePath);
const scenarios = JSON.parse(raw.toString('utf8'));
const scenario = scenarios.find((s) => s.id === 'output-integrity-mismatch');
if (!scenario) {
  console.error('ERROR: scenario output-integrity-mismatch not found');
  process.exit(2);
}

const checks = {
  latency: scenario.evidence.measuredLatencyMs <= scenario.criteria.maxLatencyMs,
  uptime: scenario.evidence.uptimeBps >= scenario.criteria.minUptimeBps,
  freshness: scenario.evidence.freshnessSeconds <= scenario.criteria.maxFreshnessSeconds,
  output_integrity: scenario.evidence.observedOutputSha256 === scenario.criteria.expectedOutputSha256,
};

const statuses = Object.values(checks).map((v) => (v ? 'pass' : 'fail'));
const overall = statuses.every((s) => s === 'pass') ? 'pass' : 'fail';
const matchedExpectedStatuses = JSON.stringify(statuses) === JSON.stringify(scenario.expectedCheckStatuses);
const matchedExpectedOutcome = overall === scenario.expectedOutcome;

const result = {
  schema: 'velmere.pactverity.predicate-reproduction.v1',
  source: {
    repository: 'PactVerityHQ/pactverity',
    commit: 'b34f4f346eb51e88e172616411d8074cf5832cc8',
    file: 'benchmark/scenarios.json',
    gitBlobSha: '596633aeb0eb46b327b007836939b1a582dd935f',
    sha256: createHash('sha256').update(raw).digest('hex'),
  },
  scenario: scenario.id,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
  },
  comparisons: {
    latency: {
      expression: 'measuredLatencyMs <= maxLatencyMs',
      values: [scenario.evidence.measuredLatencyMs, scenario.criteria.maxLatencyMs],
      result: checks.latency,
    },
    uptime: {
      expression: 'uptimeBps >= minUptimeBps',
      values: [scenario.evidence.uptimeBps, scenario.criteria.minUptimeBps],
      result: checks.uptime,
    },
    freshness: {
      expression: 'freshnessSeconds <= maxFreshnessSeconds',
      values: [scenario.evidence.freshnessSeconds, scenario.criteria.maxFreshnessSeconds],
      result: checks.freshness,
    },
    output_integrity: {
      expression: 'observedOutputSha256 === expectedOutputSha256',
      values: [scenario.evidence.observedOutputSha256, scenario.criteria.expectedOutputSha256],
      result: checks.output_integrity,
    },
  },
  actualStatuses: statuses,
  expectedStatuses: scenario.expectedCheckStatuses,
  overall,
  expectedOutcome: scenario.expectedOutcome,
  matchedExpectedStatuses,
  matchedExpectedOutcome,
  scope: {
    liveReceiptApiExecuted: false,
    liveReceiptCreated: false,
    liveReceiptVerified: false,
    originalMeasurementsIndependentlyValidated: false,
  },
};

console.log(JSON.stringify(result, null, 2));
process.exit(matchedExpectedStatuses && matchedExpectedOutcome ? 0 : 1);
