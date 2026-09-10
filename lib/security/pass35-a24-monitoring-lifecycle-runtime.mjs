import { createHash } from "node:crypto";

export const A24_POLICY_SCHEMA = "velmere.pass35.a24-monitoring-lifecycle-policy.v1";
export const A24_INPUT_SCHEMA = "velmere.pass35.a24-monitoring-lifecycle-input.v1";
export const A24_REPORT_SCHEMA = "velmere.pass35.a24-monitoring-lifecycle-report.v1";
export const A24_BENCHMARK_SCHEMA = "velmere.pass35.a24-monitoring-lifecycle-benchmark.v1";

const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/iu;
const ADDRESS_RE = /^0x[a-f0-9]{40}$/iu;
const TX_RE = /^0x[a-f0-9]{64}$/iu;
const CASE_RE = /^AUD-[A-Z0-9-]{8,64}$/u;
const RULE_RE = /^A17_[A-Z0-9_]{4,64}$/u;
const EVENT_RE = /^EV-[A-Z0-9-]{4,64}$/u;
const ACTION_RE = /^ACT-[A-Z0-9-]{4,64}$/u;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const INPUT_CLASSES = new Set(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"]);

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function sha256(value) { return `sha256:${createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex")}`; }
function round(value, digits = 6) { return Number(value.toFixed(digits)); }
function unique(values) { return [...new Set((values ?? []).map(String))].sort(); }
function ms(value) { const n = Date.parse(String(value ?? "")); return Number.isFinite(n) ? n : null; }
function digest(value) { const text = String(value ?? "").toLowerCase(); return DIGEST_RE.test(text) ? (text.startsWith("sha256:") ? text : `sha256:${text}`) : null; }
function clone(value) { return structuredClone(value); }
function maxSeverity(values, policy) { const order = policy.severityOrder; return [...values].sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? "LOW"; }
function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return { lower: 0, upper: 0 };
  const p = successes / total; const z2 = z * z; const den = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / den;
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / den;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)) };
}

export function verifyA24Policy(policy) {
  if (!policy || policy.schemaVersion !== A24_POLICY_SCHEMA || policy.passId !== "PASS35_A24") return false;
  if (!Array.isArray(policy.ruleTypes) || policy.ruleTypes.length !== 6 || new Set(policy.ruleTypes).size !== 6) return false;
  if (!policy.requiredRuleTypes?.every((type) => policy.ruleTypes.includes(type))) return false;
  if (policy.benchmark?.families?.length !== 12 || policy.benchmark.expectedCases !== 192 || policy.benchmark.expectedFrozen !== 72 || policy.benchmark.expectedMutations !== 2304 || policy.benchmark.mutationTypes?.length !== 12) return false;
  if (Object.values(policy.hardStops ?? {}).some((value) => value !== false)) return false;
  return policy.workflow?.partialIncidentClosureForbidden === true && policy.workflow?.postConditionReceiptsRequired === true;
}

function validateInput(input, policy) {
  const blockers = []; const add = (ok, code) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === A24_INPUT_SCHEMA, "a24_schema_invalid");
  add(INPUT_CLASSES.has(input?.inputClass), "a24_input_class_invalid");
  add(CASE_RE.test(String(input?.caseRef ?? "")), "a24_case_ref_invalid");
  add(ISO_RE.test(String(input?.observedAt ?? "")), "a24_observed_at_invalid");
  const target = input?.target ?? {};
  add(/^\d+$/u.test(String(target.chainId ?? "")) && BigInt(target.chainId || "0") > 0n, "a24_chain_id_invalid");
  add(ADDRESS_RE.test(String(target.contractAddress ?? "")), "a24_target_address_invalid");
  add(digest(target.runtimeBytecodeSha256) !== null, "a24_runtime_digest_invalid");
  add(digest(target.auditReportSha256) !== null, "a24_audit_report_digest_invalid");
  for (const field of ["ruleCatalogSha256", "providerConfigurationSha256", "playbookRootSha256", "customerHandoffSha256"]) add(digest(input?.bindings?.[field]) !== null, `a24_${field}_invalid`);
  const rules = Array.isArray(input?.rules) ? input.rules : [];
  add(rules.length >= 1 && rules.length <= 64, "a24_rule_count_invalid");
  add(new Set(rules.map((row) => row?.ruleId)).size === rules.length, "a24_rule_duplicate_id");
  for (const row of rules) {
    add(RULE_RE.test(String(row?.ruleId ?? "")), "a24_rule_id_invalid");
    add(policy.ruleTypes.includes(row?.type), "a24_rule_type_invalid");
    add(policy.severityOrder.includes(row?.severity), "a24_rule_severity_invalid");
    add(Number.isSafeInteger(row?.deliverySlaSec) && row.deliverySlaSec >= 1 && row.deliverySlaSec <= 86400, "a24_delivery_sla_invalid");
    add(Number.isSafeInteger(row?.ackSlaSec) && row.ackSlaSec >= 1 && row.ackSlaSec <= 86400, "a24_ack_sla_invalid");
    add(Number.isSafeInteger(row?.correlationWindowSec) && row.correlationWindowSec >= 1 && row.correlationWindowSec <= 86400, "a24_correlation_window_invalid");
    add(Number.isFinite(row?.threshold), "a24_rule_threshold_invalid");
    add(Array.isArray(row?.requiredActions) && row.requiredActions.length >= 1, "a24_rule_actions_invalid");
    for (const action of row?.requiredActions ?? []) add(ACTION_RE.test(String(action?.actionId ?? "")) && typeof action?.type === "string" && action.type.length >= 4, "a24_action_definition_invalid");
    add(typeof row?.customerCommunicationRequired === "boolean", "a24_rule_communication_invalid");
  }
  const events = Array.isArray(input?.events) ? input.events : [];
  add(events.length >= 1 && events.length <= 256, "a24_event_count_invalid");
  add(new Set(events.map((row) => row?.eventId)).size === events.length, "a24_event_id_duplicate");
  for (const event of events) {
    add(EVENT_RE.test(String(event?.eventId ?? "")), "a24_event_id_invalid");
    add(policy.ruleTypes.includes(event?.type), "a24_event_type_invalid");
    add(String(event?.chainId ?? "") === String(target.chainId ?? "") && String(event?.contractAddress ?? "").toLowerCase() === String(target.contractAddress ?? "").toLowerCase(), "a24_event_target_mismatch");
    add(Number.isSafeInteger(event?.blockNumber) && event.blockNumber >= 0 && Number.isSafeInteger(event?.logIndex) && event.logIndex >= 0, "a24_event_position_invalid");
    add(TX_RE.test(String(event?.txHash ?? "")), "a24_event_tx_invalid");
    add(ISO_RE.test(String(event?.observedAt ?? "")) && ISO_RE.test(String(event?.receivedAt ?? "")) && ms(event.receivedAt) >= ms(event.observedAt), "a24_event_time_invalid");
    add(digest(event?.sourceReceiptSha256) !== null, "a24_event_source_digest_invalid");
    add(typeof event?.values === "object" && event.values !== null, "a24_event_values_invalid");
  }
  for (const collection of ["deliveries", "acknowledgements", "actions", "communications"]) add(Array.isArray(input?.workflow?.[collection]), `a24_${collection}_invalid`);
  add(typeof input?.resolution === "object" && input.resolution !== null, "a24_resolution_invalid");
  if (input?.inputClass === "CUSTOMER_SUPPLIED_VERIFIED") blockers.push("a24_live_provider_delivery_and_real_incident_receipts_missing");
  return unique(blockers);
}

function eventIdentity(event) { return `${event.chainId}|${String(event.contractAddress).toLowerCase()}|${String(event.txHash).toLowerCase()}|${event.logIndex}|${event.type}`; }
function eventOrder(event) { return [event.blockNumber, event.logIndex, ms(event.observedAt), event.eventId]; }
function compareOrder(a, b) { const x = eventOrder(a), y = eventOrder(b); for (let i = 0; i < x.length; i += 1) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; }

function triggered(rule, event) {
  const v = event.values ?? {};
  switch (rule.type) {
    case "ADMIN_CHANGE": return v.changed === true && v.approvedWindow !== true;
    case "PROXY_UPGRADE": return typeof v.implementationHash === "string" && typeof v.approvedImplementationHash === "string" && v.implementationHash !== v.approvedImplementationHash;
    case "PAUSE_STATE": return v.stateChanged === true && v.approvedTicket !== true;
    case "SUPPLY_CHANGE": return Math.abs(Number(v.deltaPct ?? 0)) >= rule.threshold;
    case "LIQUIDITY_DROP": return Number(v.dropPct ?? 0) >= rule.threshold;
    case "ORACLE_DEVIATION": return Number(v.deviationPct ?? 0) >= rule.threshold || Number(v.staleSec ?? 0) >= Number(v.maxFreshnessSec ?? Number.MAX_SAFE_INTEGER);
    default: return false;
  }
}

function findByRule(rows, ruleId) { return (rows ?? []).filter((row) => row?.ruleId === ruleId); }

export function analyzeA24MonitoringCase(input, policy) {
  if (!verifyA24Policy(policy)) throw new Error("a24_policy_invalid");
  const blockers = validateInput(input, policy);
  const originalEvents = Array.isArray(input?.events) ? input.events : [];
  const outOfOrderInput = originalEvents.some((event, index) => index > 0 && compareOrder(originalEvents[index - 1], event) > 0);
  const seen = new Set(); const canonicalEvents = []; let duplicatesDropped = 0;
  for (const event of [...originalEvents].sort(compareOrder)) {
    const identity = eventIdentity(event);
    if (seen.has(identity)) { duplicatesDropped += 1; continue; }
    seen.add(identity); canonicalEvents.push(event);
  }
  const rules = Array.isArray(input?.rules) ? input.rules : [];
  const triggeredRules = [];
  for (const rule of rules) {
    const matched = canonicalEvents.filter((event) => event.type === rule.type && triggered(rule, event));
    if (matched.length) triggeredRules.push({ rule, events: matched });
  }
  const workflowRows = { deliveries: input?.workflow?.deliveries ?? [], acknowledgements: input?.workflow?.acknowledgements ?? [], actions: input?.workflow?.actions ?? [], communications: input?.workflow?.communications ?? [] };
  const incidents = [];
  for (const item of triggeredRules) {
    const { rule, events } = item;
    const detectedAtMs = Math.min(...events.map((event) => ms(event.receivedAt)));
    const eventIds = events.map((event) => event.eventId).sort();
    const incidentId = `INC-${sha256(`${input.caseRef}|${rule.ruleId}|${eventIds.join("|")}`).slice(7, 23).toUpperCase()}`;
    const local = [];
    const deliveries = findByRule(workflowRows.deliveries, rule.ruleId);
    const delivery = deliveries.find((row) => row.status === "DELIVERED" && digest(row.receiptSha256) && ISO_RE.test(String(row.deliveredAt ?? "")));
    if (!delivery) local.push(`a24_delivery_missing:${rule.ruleId}`);
    else if ((ms(delivery.deliveredAt) - detectedAtMs) / 1000 > rule.deliverySlaSec) local.push(`a24_delivery_sla_breached:${rule.ruleId}`);
    const acks = findByRule(workflowRows.acknowledgements, rule.ruleId);
    const ack = acks.find((row) => row.status === "ACKNOWLEDGED" && digest(row.receiptSha256) && typeof row.actorRole === "string" && row.actorRole.length >= 3 && ISO_RE.test(String(row.acknowledgedAt ?? "")));
    if (!ack) local.push(`a24_ack_missing:${rule.ruleId}`);
    else if (delivery && (ms(ack.acknowledgedAt) - ms(delivery.deliveredAt)) / 1000 > rule.ackSlaSec) local.push(`a24_ack_sla_breached:${rule.ruleId}`);
    const actionRows = findByRule(workflowRows.actions, rule.ruleId);
    for (const required of rule.requiredActions) {
      const action = actionRows.find((row) => row.actionId === required.actionId && row.status === "PASS" && digest(row.receiptSha256) && ISO_RE.test(String(row.executedAt ?? "")));
      if (!action) local.push(`a24_required_action_missing_or_failed:${rule.ruleId}:${required.actionId}`);
    }
    let communication = null;
    if (rule.customerCommunicationRequired) {
      communication = findByRule(workflowRows.communications, rule.ruleId).find((row) => row.status === "SENT" && digest(row.receiptSha256) && ISO_RE.test(String(row.sentAt ?? "")));
      if (!communication) local.push(`a24_customer_communication_missing:${rule.ruleId}`);
    }
    const resolution = input?.resolution ?? {};
    const post = Array.isArray(resolution.postConditionReceipts) ? resolution.postConditionReceipts.filter((row) => row.ruleId === rule.ruleId && row.status === "PASS" && digest(row.receiptSha256)) : [];
    if (!ISO_RE.test(String(resolution.resolvedAt ?? "")) || resolution.closeRequested !== true || post.length === 0) local.push(`a24_resolution_or_postcondition_missing:${rule.ruleId}`);
    let state = "DETECTED";
    if (delivery && !local.some((x) => x.startsWith("a24_delivery"))) state = "ALERT_DELIVERED";
    if (state === "ALERT_DELIVERED" && ack && !local.some((x) => x.startsWith("a24_ack"))) state = "ACKNOWLEDGED";
    if (state === "ACKNOWLEDGED" && !local.some((x) => x.startsWith("a24_required_action"))) state = "RESPONDING";
    if (state === "RESPONDING" && (!rule.customerCommunicationRequired || communication)) state = "COMMUNICATED";
    if (state === "COMMUNICATED" && !local.some((x) => x.startsWith("a24_resolution"))) state = "CLOSED_LOCAL";
    incidents.push({ incidentId, ruleId: rule.ruleId, type: rule.type, severity: rule.severity, eventIds, lifecycleState: state, blockers: unique(local), detectionReceiptSha256: sha256({ caseRef: input.caseRef, ruleId: rule.ruleId, eventIds, detectedAtMs }), workflowReceiptSha256: sha256({ deliveries, acks, actionRows, communication, resolution }) });
    blockers.push(...local);
  }
  const uniqueBlockers = unique(blockers);
  const closureEligibleLocal = triggeredRules.length === 0 ? uniqueBlockers.length === 0 : uniqueBlockers.length === 0 && incidents.every((row) => row.lifecycleState === "CLOSED_LOCAL");
  const core = {
    schemaVersion: A24_REPORT_SCHEMA,
    passId: "PASS35_A24",
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    target: { chainId: String(input?.target?.chainId ?? ""), contractAddress: String(input?.target?.contractAddress ?? "").toLowerCase(), runtimeBytecodeSha256: digest(input?.target?.runtimeBytecodeSha256), auditReportSha256: digest(input?.target?.auditReportSha256) },
    bindings: { ruleCatalogSha256: digest(input?.bindings?.ruleCatalogSha256), providerConfigurationSha256: digest(input?.bindings?.providerConfigurationSha256), playbookRootSha256: digest(input?.bindings?.playbookRootSha256), customerHandoffSha256: digest(input?.bindings?.customerHandoffSha256) },
    eventCount: originalEvents.length,
    uniqueEventCount: canonicalEvents.length,
    duplicatesDropped,
    outOfOrderInput,
    canonicalEventOrder: canonicalEvents.map((event) => event.eventId),
    triggeredRuleCount: triggeredRules.length,
    incidentCount: incidents.length,
    incidentSeverity: maxSeverity(incidents.map((row) => row.severity), policy),
    incidents,
    lifecycleComplete: closureEligibleLocal,
    closureEligibleLocal,
    status: uniqueBlockers.length ? "BLOCKED_LOCAL_MONITORING_LIFECYCLE" : triggeredRules.length ? "VERIFIED_LOCAL_MONITORING_LIFECYCLE" : "VERIFIED_LOCAL_NO_INCIDENT",
    assuranceClass: "LOCAL_GENERATED_MONITORING_LIFECYCLE",
    liveMonitoringActive: false,
    liveAlertDeliveryClaimed: false,
    realIncidentClaimed: false,
    realCaseExecution: false,
    paidGateEligible: false,
    sellEnabled: false,
    promotionAllowed: false,
    blockers: uniqueBlockers,
    limitations: [
      "Generated/offline events and workflow records prove deterministic lifecycle logic only.",
      "No live provider, production alert channel, real acknowledgement, real incident action or customer communication was executed.",
      "Local closure cannot authorize paid delivery or a full lifecycle monitoring claim."
    ],
    truthBoundary: policy.truthBoundary
  };
  return { ...core, reportSha256: sha256(core) };
}

function baseRule(type, index = 0) {
  const sev = ["HIGH", "CRITICAL", "MEDIUM", "HIGH", "HIGH", "CRITICAL"][["ADMIN_CHANGE", "PROXY_UPGRADE", "PAUSE_STATE", "SUPPLY_CHANGE", "LIQUIDITY_DROP", "ORACLE_DEVIATION"].indexOf(type)];
  return { ruleId: `A17_${type}`, type, severity: sev, deliverySlaSec: 60, ackSlaSec: 120, correlationWindowSec: 300, threshold: type === "ORACLE_DEVIATION" ? 5 : type === "LIQUIDITY_DROP" ? 30 : type === "SUPPLY_CHANGE" ? 10 : 1, requiredActions: [{ actionId: `ACT-${type.replaceAll("_", "-")}`, type: `EXECUTE_${type}_PLAYBOOK` }], customerCommunicationRequired: index % 3 !== 2 };
}
function eventValues(type, shouldTrigger) {
  switch (type) {
    case "ADMIN_CHANGE": return { changed: shouldTrigger, approvedWindow: false };
    case "PROXY_UPGRADE": return { implementationHash: shouldTrigger ? "0x02" : "0x01", approvedImplementationHash: "0x01" };
    case "PAUSE_STATE": return { stateChanged: shouldTrigger, approvedTicket: false };
    case "SUPPLY_CHANGE": return { deltaPct: shouldTrigger ? 12 : 2 };
    case "LIQUIDITY_DROP": return { dropPct: shouldTrigger ? 35 : 5 };
    case "ORACLE_DEVIATION": return { deviationPct: shouldTrigger ? 7 : 1, staleSec: 30, maxFreshnessSec: 300 };
    default: return {};
  }
}
function makeCase(family, index) {
  const type = family.endsWith("_ALERT") ? family.replace("_ALERT", "") : "ORACLE_DEVIATION";
  const familyToken = family.replaceAll("_", "-");
  const rule = baseRule(type, index);
  const triggerExpected = family.endsWith("_ALERT") ? index % 2 === 0 : true;
  const t0 = Date.parse("2026-07-23T10:00:00.000Z") + index * 600000;
  const iso = (offsetSec) => new Date(t0 + offsetSec * 1000).toISOString();
  const event = { eventId: `EV-${String(index).padStart(2, "0")}-${familyToken}`, type, chainId: "1", contractAddress: "0x1111111111111111111111111111111111111111", blockNumber: 1000 + index, txHash: `0x${(index + 1).toString(16).padStart(64, "0")}`, logIndex: 0, observedAt: iso(0), receivedAt: iso(5), sourceReceiptSha256: `sha256:${"1".repeat(64)}`, values: eventValues(type, triggerExpected) };
  const events = [event];
  let expectedDuplicatesDropped = 0, expectedOutOfOrder = false;
  if (family === "DUPLICATE_EVENT_DEDUP") { events.push({ ...clone(event), eventId: `${event.eventId}-DUP` }); expectedDuplicatesDropped = 1; }
  if (family === "OUT_OF_ORDER_EVENT_ORDERING") { const later = { ...clone(event), eventId: `${event.eventId}-LATER`, blockNumber: event.blockNumber + 1, txHash: `0x${(index + 100).toString(16).padStart(64, "0")}`, observedAt: iso(10), receivedAt: iso(12) }; events.unshift(later); expectedOutOfOrder = true; }
  const deliveryLate = family === "ALERT_DELIVERY_SLA" && index % 2 === 1;
  const ackLate = family === "ACKNOWLEDGEMENT_SLA" && index % 2 === 1;
  const actionBad = family === "PLAYBOOK_ACTION_COMPLETENESS" && index % 2 === 1;
  const commBad = family === "CUSTOMER_COMMUNICATION_COMPLETENESS" && index % 2 === 1;
  const deliveryAt = iso(deliveryLate ? 90 : 20);
  const ackAt = iso(deliveryLate ? 100 : ackLate ? 200 : 40);
  const workflow = {
    deliveries: [{ ruleId: rule.ruleId, status: "DELIVERED", deliveredAt: deliveryAt, receiptSha256: `sha256:${"2".repeat(64)}` }],
    acknowledgements: [{ ruleId: rule.ruleId, status: "ACKNOWLEDGED", acknowledgedAt: ackAt, actorRole: "SECURITY_ON_CALL", receiptSha256: `sha256:${"3".repeat(64)}` }],
    actions: [{ ruleId: rule.ruleId, actionId: rule.requiredActions[0].actionId, status: actionBad ? "FAIL" : "PASS", executedAt: iso(50), receiptSha256: `sha256:${"4".repeat(64)}` }],
    communications: rule.customerCommunicationRequired ? [{ ruleId: rule.ruleId, status: commBad ? "NOT_SENT" : "SENT", sentAt: iso(55), receiptSha256: `sha256:${"5".repeat(64)}` }] : []
  };
  const expectedLifecycleComplete = triggerExpected ? !(deliveryLate || ackLate || actionBad || (commBad && rule.customerCommunicationRequired)) : true;
  return {
    input: { schemaVersion: A24_INPUT_SCHEMA, inputClass: "SYNTHETIC_OFFLINE", caseRef: `AUD-A24-${familyToken}-${String(index).padStart(2, "0")}`, observedAt: iso(0), target: { chainId: "1", contractAddress: "0x1111111111111111111111111111111111111111", runtimeBytecodeSha256: `sha256:${"a".repeat(64)}`, auditReportSha256: `sha256:${"b".repeat(64)}` }, bindings: { ruleCatalogSha256: `sha256:${"c".repeat(64)}`, providerConfigurationSha256: `sha256:${"d".repeat(64)}`, playbookRootSha256: `sha256:${"e".repeat(64)}`, customerHandoffSha256: `sha256:${"f".repeat(64)}` }, rules: [rule], events, workflow, resolution: { closeRequested: true, resolvedAt: iso(70), postConditionReceipts: [{ ruleId: rule.ruleId, status: "PASS", receiptSha256: `sha256:${"6".repeat(64)}` }] } },
    expected: { triggered: triggerExpected ? 1 : 0, lifecycleComplete: expectedLifecycleComplete, duplicatesDropped: expectedDuplicatesDropped, outOfOrderInput: expectedOutOfOrder }
  };
}

function mutate(input, type) {
  const out = clone(input);
  switch (type) {
    case "schema_invalid": out.schemaVersion = "bad"; break;
    case "input_class_invalid": out.inputClass = "LIVE"; break;
    case "case_ref_invalid": out.caseRef = "bad"; break;
    case "target_address_invalid": out.target.contractAddress = "0x1"; break;
    case "runtime_digest_invalid": out.target.runtimeBytecodeSha256 = "bad"; break;
    case "duplicate_rule_id": out.rules.push(clone(out.rules[0])); break;
    case "event_id_duplicate": out.events.push({ ...clone(out.events[0]), txHash: `0x${"9".repeat(64)}` }); break;
    case "event_source_digest_invalid": out.events[0].sourceReceiptSha256 = "bad"; break;
    case "event_target_mismatch": out.events[0].contractAddress = "0x2222222222222222222222222222222222222222"; break;
    case "event_time_invalid": out.events[0].receivedAt = "bad"; break;
    case "playbook_root_digest_invalid": out.bindings.playbookRootSha256 = "bad"; break;
    case "customer_handoff_digest_invalid": out.bindings.customerHandoffSha256 = "bad"; break;
    default: throw new Error(`unknown_mutation:${type}`);
  }
  return out;
}

export function runA24Benchmark(policy) {
  if (!verifyA24Policy(policy)) throw new Error("a24_policy_invalid");
  const rows = [];
  for (const family of policy.benchmark.families) for (let index = 0; index < 16; index += 1) {
    const generated = makeCase(family, index);
    const report = analyzeA24MonitoringCase(generated.input, policy);
    const frozen = index >= 10;
    rows.push({ family, index, frozen, expected: generated.expected, actual: { triggered: report.triggeredRuleCount, lifecycleComplete: report.lifecycleComplete, duplicatesDropped: report.duplicatesDropped, outOfOrderInput: report.outOfOrderInput, unsafeClosure: report.lifecycleComplete && report.blockers.length > 0 }, passed: report.triggeredRuleCount === generated.expected.triggered && report.lifecycleComplete === generated.expected.lifecycleComplete && report.duplicatesDropped === generated.expected.duplicatesDropped && report.outOfOrderInput === generated.expected.outOfOrderInput && !(report.lifecycleComplete && report.blockers.length), reportSha256: report.reportSha256 });
  }
  const frozenRows = rows.filter((row) => row.frozen);
  const mutations = [];
  for (const [rowIndex, row] of rows.entries()) {
    const generated = makeCase(row.family, row.index);
    for (const type of policy.benchmark.mutationTypes) {
      const report = analyzeA24MonitoringCase(mutate(generated.input, type), policy);
      mutations.push({ rowIndex, family: row.family, type, killed: report.blockers.length > 0, reportSha256: report.reportSha256 });
    }
  }
  const frozenCorrect = frozenRows.filter((row) => row.passed).length;
  const unsafeClosures = frozenRows.filter((row) => row.actual.unsafeClosure).length;
  const falseBlocks = frozenRows.filter((row) => row.expected.lifecycleComplete && !row.actual.lifecycleComplete).length;
  const core = {
    schemaVersion: A24_BENCHMARK_SCHEMA,
    passId: "PASS35_A24",
    sourceRevisionId: policy.sourceRevisionId,
    denominators: { cases: rows.length, frozen: frozenRows.length, mutations: mutations.length, families: policy.benchmark.families.length },
    frozen: { correct: frozenCorrect, accuracy: round(frozenCorrect / frozenRows.length), triggerAccuracy: round(frozenRows.filter((row) => row.expected.triggered === row.actual.triggered).length / frozenRows.length), lifecycleAccuracy: round(frozenRows.filter((row) => row.expected.lifecycleComplete === row.actual.lifecycleComplete).length / frozenRows.length), dedupeAccuracy: round(frozenRows.filter((row) => row.expected.duplicatesDropped === row.actual.duplicatesDropped).length / frozenRows.length), orderingAccuracy: round(frozenRows.filter((row) => row.expected.outOfOrderInput === row.actual.outOfOrderInput).length / frozenRows.length), unsafeClosures, falseBlocks, wilson95: wilson(frozenCorrect, frozenRows.length) },
    mutation: { total: mutations.length, killed: mutations.filter((row) => row.killed).length, survived: mutations.filter((row) => !row.killed).length, killRate: round(mutations.filter((row) => row.killed).length / mutations.length) },
    rows,
    mutations,
    localOnly: true,
    liveMonitoringActive: false,
    realIncidentClaimed: false,
    paidGateEligible: false,
    sellEnabled: false,
    truthBoundary: policy.truthBoundary
  };
  return { ...core, integritySha256: sha256(core) };
}

export function verifyA24Report(report) {
  if (!report || report.schemaVersion !== A24_REPORT_SCHEMA || !DIGEST_RE.test(String(report.reportSha256 ?? ""))) return false;
  const { reportSha256, ...core } = report;
  return sha256(core) === digest(reportSha256) && report.liveMonitoringActive === false && report.realIncidentClaimed === false && report.paidGateEligible === false && report.sellEnabled === false;
}
export function verifyA24Benchmark(report, policy) {
  if (!report || report.schemaVersion !== A24_BENCHMARK_SCHEMA || !verifyA24Policy(policy)) return false;
  const { integritySha256, ...core } = report;
  return sha256(core) === digest(integritySha256) && report.denominators.cases === policy.benchmark.expectedCases && report.denominators.frozen === policy.benchmark.expectedFrozen && report.denominators.mutations === policy.benchmark.expectedMutations && report.frozen.accuracy === 1 && report.frozen.triggerAccuracy === 1 && report.frozen.lifecycleAccuracy === 1 && report.frozen.dedupeAccuracy === 1 && report.frozen.orderingAccuracy === 1 && report.frozen.unsafeClosures === 0 && report.frozen.falseBlocks === 0 && report.mutation.killRate === 1 && report.liveMonitoringActive === false && report.paidGateEligible === false;
}
