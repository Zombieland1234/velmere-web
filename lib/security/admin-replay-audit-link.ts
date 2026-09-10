export const PASS2370_ADMIN_REPLAY_AUDIT_LINK_ID = "pass2370-admin-replay-board-audit-inbox-deeplink" as const;

export type Pass2370AuditInboxFocus = {
  evidenceId?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  scenarioId?: string;
  q?: string;
};

export type Pass2370LinkableEvidenceRow = {
  id?: string;
  auditQueueId?: string;
  accountMessageId?: string;
  accountId?: string;
  scenarioId?: string;
  evidenceRef?: string;
  label?: string;
};

const SAFE_LOCALES = new Set(["pl", "en", "de"]);

export function normalizePass2370Locale(locale?: string) {
  return SAFE_LOCALES.has(String(locale || "")) ? String(locale) : "en";
}

export function cleanPass2370FocusToken(value: unknown, max = 140) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .replace(/[<>{}[\]`$\\]/g, " ")
    .replace(/\b(?:sk_live|pk_live|whsec|Bearer)\b[^\s]*/gi, "[redacted]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted-card-like]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

export function parsePass2370AuditFocus(input: Record<string, unknown> | URLSearchParams): Pass2370AuditInboxFocus {
  const get = (key: string) => input instanceof URLSearchParams ? input.get(key) : input[key];
  return {
    evidenceId: cleanPass2370FocusToken(get("focusEvidenceId") ?? get("evidenceId")),
    auditQueueId: cleanPass2370FocusToken(get("focusAuditQueueId") ?? get("auditQueueId")),
    accountMessageId: cleanPass2370FocusToken(get("focusMessageId") ?? get("accountMessageId") ?? get("messageId")),
    accountId: cleanPass2370FocusToken(get("focusAccountId") ?? get("accountId")),
    scenarioId: cleanPass2370FocusToken(get("focusScenarioId") ?? get("scenarioId")),
    q: cleanPass2370FocusToken(get("focusQ") ?? get("q")),
  };
}

export function hasPass2370AuditFocus(focus?: Pass2370AuditInboxFocus | null): focus is Pass2370AuditInboxFocus {
  return Boolean(focus?.evidenceId || focus?.auditQueueId || focus?.accountMessageId || focus?.accountId || focus?.scenarioId || focus?.q);
}

export function pass2370FocusQuery(focus: Pass2370AuditInboxFocus) {
  const params = new URLSearchParams();
  if (focus.evidenceId) params.set("focusEvidenceId", focus.evidenceId);
  if (focus.auditQueueId) params.set("focusAuditQueueId", focus.auditQueueId);
  if (focus.accountMessageId) params.set("focusMessageId", focus.accountMessageId);
  if (focus.accountId) params.set("focusAccountId", focus.accountId);
  if (focus.scenarioId) params.set("focusScenarioId", focus.scenarioId);
  if (focus.q) params.set("focusQ", focus.q);
  return params;
}

export function buildPass2370AuditInboxHref(locale: string, row: Pass2370LinkableEvidenceRow) {
  const focus: Pass2370AuditInboxFocus = {
    evidenceId: cleanPass2370FocusToken(row.id),
    auditQueueId: cleanPass2370FocusToken(row.auditQueueId),
    accountMessageId: cleanPass2370FocusToken(row.accountMessageId),
    accountId: cleanPass2370FocusToken(row.accountId),
    scenarioId: cleanPass2370FocusToken(row.scenarioId),
    q: cleanPass2370FocusToken(row.evidenceRef || row.label, 90),
  };
  const params = pass2370FocusQuery(focus);
  return `/${normalizePass2370Locale(locale)}/admin/security/audit-inbox?${params.toString()}#pass2370-linked-audit-message`;
}

export function pass2370FocusMatchesMessage(message: {
  id?: string;
  requestId?: string;
  auditQueueId?: string;
  accountId?: string;
  paymentEvidenceRefs?: string[];
  title?: string;
  projectName?: string;
}, focus?: Pass2370AuditInboxFocus | null) {
  if (!hasPass2370AuditFocus(focus)) return false;
  const values = [
    message.id,
    message.requestId,
    message.auditQueueId,
    message.accountId,
    ...(message.paymentEvidenceRefs ?? []),
    message.title,
    message.projectName,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  const strictTargets = [focus.accountMessageId, focus.auditQueueId, focus.accountId, focus.evidenceId]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  if (strictTargets.some((target) => values.some((value) => value === target || value.includes(target)))) return true;

  const soft = [focus.scenarioId, focus.q]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());
  return soft.length > 0 && soft.some((target) => values.some((value) => value.includes(target)));
}

export function buildPass2370FocusSummary(focus?: Pass2370AuditInboxFocus | null) {
  if (!hasPass2370AuditFocus(focus)) return undefined;
  const bits = [
    focus.auditQueueId ? `queue ${focus.auditQueueId}` : undefined,
    focus.accountMessageId ? `message ${focus.accountMessageId}` : undefined,
    focus.accountId ? `account ${focus.accountId}` : undefined,
    focus.evidenceId ? `evidence ${focus.evidenceId}` : undefined,
    focus.scenarioId ? `scenario ${focus.scenarioId}` : undefined,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Replay evidence focus";
}
