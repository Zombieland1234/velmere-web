export const DIALOG_FOCUS_RETURN_OBSERVER_TIMEOUT_MS = 1200;

type DialogFocusSessionToken = symbol;
type DialogFocusRoot = Pick<HTMLElement, "contains">;
type DialogFocusSession = {
  token: DialogFocusSessionToken;
  root: DialogFocusRoot | null;
};

let focusEpoch = 0;
const activeDialogStack: DialogFocusSession[] = [];

function findDialogSessionIndex(token: DialogFocusSessionToken) {
  return activeDialogStack.findIndex((entry) => entry.token === token);
}

function currentTopDialogSession() {
  return activeDialogStack.at(-1) ?? null;
}

export function createDialogFocusSessionToken(): DialogFocusSessionToken {
  return Symbol("velmere-dialog-focus-session");
}

export function beginDialogFocusSession(
  token: DialogFocusSessionToken,
  root: DialogFocusRoot | null = null,
) {
  const existingIndex = findDialogSessionIndex(token);
  if (existingIndex >= 0) activeDialogStack.splice(existingIndex, 1);
  activeDialogStack.push({ token, root });
  focusEpoch += 1;
  return focusEpoch;
}

export function endDialogFocusSession(token: DialogFocusSessionToken) {
  const existingIndex = findDialogSessionIndex(token);
  if (existingIndex < 0) return focusEpoch;
  activeDialogStack.splice(existingIndex, 1);
  focusEpoch += 1;
  return focusEpoch;
}

export function isTopDialogFocusSession(token: DialogFocusSessionToken) {
  return currentTopDialogSession()?.token === token;
}

export function captureDialogFocusReturnEpoch() {
  return focusEpoch;
}

export function isDialogFocusReturnEpochCurrent(capturedEpoch: number) {
  return capturedEpoch === focusEpoch;
}

export function canRestoreDialogFocus(
  capturedEpoch: number,
  target: Pick<Node, "parentNode"> | null = null,
) {
  if (!isDialogFocusReturnEpochCurrent(capturedEpoch)) return false;
  const top = currentTopDialogSession();
  if (!top) return true;
  return Boolean(target && top.root?.contains(target as Node));
}

export function activeDialogFocusSessionCount() {
  return activeDialogStack.length;
}

export function resetDialogFocusReturnPolicyForTests() {
  activeDialogStack.length = 0;
  focusEpoch = 0;
}
