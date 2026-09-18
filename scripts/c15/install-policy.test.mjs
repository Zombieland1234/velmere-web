import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInstallScriptPolicy } from './install-policy.mjs';

test('C15 install evidence marks true ignore-scripts as suppressed, never executed', () => {
  const actual = classifyInstallScriptPolicy(true);
  assert.equal(actual.dependencyLifecycle, 'SUPPRESSED_BY_EFFECTIVE_IGNORE_SCRIPTS');
  assert.equal(actual.allInstallScriptsExecuted, false);
  assert.equal(actual.executionAttested, false);
});
test('C15 allowing scripts alone is not evidence that they ran', () => {
  const actual = classifyInstallScriptPolicy(false);
  assert.equal(actual.dependencyLifecycle, 'EXECUTION_NOT_PROVEN_BY_CONFIGURATION');
  assert.equal(actual.allInstallScriptsExecuted, false);
  assert.equal(actual.executionAttested, false);
});
test('C15 install evidence cannot silently default missing effective config', () => {
  assert.throws(() => classifyInstallScriptPolicy(undefined), TypeError);
});
test('C15 install evidence rejects misleading string booleans', () => {
  assert.throws(() => classifyInstallScriptPolicy('false'), TypeError);
  assert.throws(() => classifyInstallScriptPolicy('true'), TypeError);
});
