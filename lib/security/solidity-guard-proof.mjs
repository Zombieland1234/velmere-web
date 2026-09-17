/** Conservative, straight-line boolean storage mutex recognizer; not a compiler proof.
 * Unsupported control flow is REVIEW_REQUIRED, never an excuse to suppress a finding.
 * Source/bytecode identity is a separate requirement and is not proved here.
 */
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function proveFunctionMutex(fn, modifiers, stateVariables, functions, contracts) {
  const contract = contracts.find((item) => item.name === fn.contractName);
  if (!contract || contract.hasInheritance || /\bassembly\b|\.\s*delegatecall\b/.test(contract.code)) return false;
  // Other modifiers and unresolved inherited/internal effects are not mutex proof.
  let suffix = fn.tail.replace(/\breturns\s*\([^)]*\)/g, '')
    .replace(/\b(?:public|external|internal|private|pure|view|payable|virtual)\b/g, '').trim();
  const used = modifiers.filter((modifier) => modifier.contractName === fn.contractName &&
    new RegExp(`(?:^|\\s)${escape(modifier.name)}(?:\\s*\\([^)]*\\))?(?:\\s|$)`).test(suffix));
  if (used.length !== 1) return false;
  const modifier = used[0];
  suffix = suffix.replace(new RegExp(`^${escape(modifier.name)}(?:\\s*\\(\\s*\\))?$`), '').trim();
  if (suffix || modifier.params.trim()) return false;
  for (const name of stateVariables) {
    if (!identifier.test(name)) continue;
    const g = escape(name);
    const check = `(?:!\\s*${g}|${g}\\s*==\\s*false|false\\s*==\\s*${g})`;
    const shape = new RegExp(`^\\s*(?:require|assert)\\s*\\(\\s*${check}\\s*(?:,\\s*)?\\)\\s*;\\s*${g}\\s*=\\s*true\\s*;\\s*_\\s*;\\s*${g}\\s*=\\s*false\\s*;\\s*$`);
    if (!shape.test(modifier.body)) continue;
    // Any reference to the lock from another function may shadow/reset/expose it;
    // do not attempt a permissive regex approximation of alias/data flow here.
    const reference = new RegExp(`\\b${g}\\b`);
    if (functions.some((other) => other.contractName === fn.contractName &&
      !other.isConstructorKeyword && (reference.test(other.body) || reference.test(other.params)))) continue;
    if (modifiers.some((other) => other !== modifier && other.contractName === fn.contractName &&
      (reference.test(other.body) || reference.test(other.params)))) continue;
    return true;
  }
  return false;
}
