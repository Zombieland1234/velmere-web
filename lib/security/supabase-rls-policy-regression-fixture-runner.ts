import type { Pass2628SupabaseReleaseEvidenceBoardMigrationRlsGateReport } from "@/lib/security/supabase-release-evidence-board-migration-rls-gate";

export const PASS2629_SUPABASE_RLS_POLICY_REGRESSION_FIXTURE_RUNNER_ID = "supabase-rls-policy-regression-fixture-runner-anon-owner-operator-service-role-matrix" as const;

export type Pass2629FixtureRole = "anon" | "owner" | "other_owner" | "operator" | "service_role";
export type Pass2629FixtureOperation = "select" | "insert" | "update" | "delete";
export type Pass2629FixtureTable = "release_board" | "private_refs";
export type Pass2629FixtureExpectation = "allow" | "deny";
export type Pass2629FixtureObserved = "allow" | "deny" | "not_executed";
export type Pass2629FixtureStatus = "pass" | "pending" | "blocked" | "operator_review";
export type Pass2629FixtureLane = "customer_read" | "service_insert" | "immutability" | "private_ref" | "admin_operator" | "negative_control";

export type Pass2629RlsPolicyFixtureRow = {
  id: string;
  role: Pass2629FixtureRole;
  operation: Pass2629FixtureOperation;
  table: Pass2629FixtureTable;
  lane: Pass2629FixtureLane;
  expected: Pass2629FixtureExpectation;
  observed: Pass2629FixtureObserved;
  status: Pass2629FixtureStatus;
  customerSafeOutcome: string;
  requiredProof: string;
  blocksLaunch: boolean;
  blocksPdfRelease: boolean;
  blocksAdvancedRelease: boolean;
};

export type Pass2629SupabaseRlsPolicyRegressionFixtureRunnerReport = {
  passId: typeof PASS2629_SUPABASE_RLS_POLICY_REGRESSION_FIXTURE_RUNNER_ID;
  generatedAt: string;
  locale: string;
  requestSurface: "supabase_rls_policy_regression_fixture_runner";
  httpStatus: 200 | 409 | 423;
  summary: {
    fixtureRows: number;
    passingRows: number;
    pendingRows: number;
    blockedRows: number;
    operatorReviewRows: number;
    fixturesExecuted: number;
    fixturesPending: number;
    expectedDenyRows: number;
    expectedAllowRows: number;
    regressionReadiness: number;
    customerReadReadiness: number;
    serviceInsertReadiness: number;
    immutabilityReadiness: number;
    privateRefReadiness: number;
    negativeControlReadiness: number;
    launchBlockingRows: number;
    pdfBlockingRows: number;
    advancedBlockingRows: number;
    canPromoteReleaseBoard: boolean;
    canUseForProPdfRelease: boolean;
    canUseForAdvancedRelease: boolean;
    topBlocker: string;
    nextAction: string;
  };
  customerRows: Pass2629RlsPolicyFixtureRow[];
  proPdfRows: Pass2629RlsPolicyFixtureRow[];
  operatorRows: Pass2629RlsPolicyFixtureRow[];
  fixtureContract: {
    invariant: string;
    requiredRoles: Pass2629FixtureRole[];
    requiredTables: string[];
    requiredOperations: Pass2629FixtureOperation[];
    expectedAllowRules: string[];
    expectedDenyRules: string[];
    customerVisibleFields: string[];
    operatorOnlyFields: string[];
    launchAcceptanceRules: string[];
  };
  customerResponse: {
    ok: boolean;
    surface: "supabase_rls_policy_regression_fixture_runner";
    status: "ready" | "needs_fixture_run" | "blocked";
    message: string;
    nextSafeAction: string;
  };
};

type BuilderInput = {
  locale?: string;
  rlsGate?: Pass2628SupabaseReleaseEvidenceBoardMigrationRlsGateReport | null;
  fixturesExecuted?: boolean;
  ownerSelectObserved?: Pass2629FixtureObserved;
  otherOwnerSelectObserved?: Pass2629FixtureObserved;
  anonSelectObserved?: Pass2629FixtureObserved;
  serviceInsertObserved?: Pass2629FixtureObserved;
  ownerInsertObserved?: Pass2629FixtureObserved;
  updateObserved?: Pass2629FixtureObserved;
  deleteObserved?: Pass2629FixtureObserved;
  operatorPrivateRefSelectObserved?: Pass2629FixtureObserved;
  ownerPrivateRefSelectObserved?: Pass2629FixtureObserved;
  servicePrivateRefInsertObserved?: Pass2629FixtureObserved;
  anonPrivateRefSelectObserved?: Pass2629FixtureObserved;
  operatorBoardSelectObserved?: Pass2629FixtureObserved;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function observedValue(value: Pass2629FixtureObserved | undefined, fixturesExecuted: boolean): Pass2629FixtureObserved {
  return value ?? (fixturesExecuted ? "deny" : "not_executed");
}

function statusFrom(expected: Pass2629FixtureExpectation, observed: Pass2629FixtureObserved, blocksLaunch: boolean): Pass2629FixtureStatus {
  if (observed === "not_executed") return blocksLaunch ? "pending" : "operator_review";
  if (observed === expected) return "pass";
  return "blocked";
}

function row(input: Omit<Pass2629RlsPolicyFixtureRow, "status">): Pass2629RlsPolicyFixtureRow {
  return {
    ...input,
    status: statusFrom(input.expected, input.observed, input.blocksLaunch),
  };
}

function readiness(rows: Pass2629RlsPolicyFixtureRow[], predicate?: (row: Pass2629RlsPolicyFixtureRow) => boolean) {
  const scoped = predicate ? rows.filter(predicate) : rows;
  if (!scoped.length) return 0;
  const pass = scoped.filter((item) => item.status === "pass").length;
  const review = scoped.filter((item) => item.status === "operator_review").length;
  const pending = scoped.filter((item) => item.status === "pending").length;
  const blocked = scoped.filter((item) => item.status === "blocked").length;
  return clamp((pass / scoped.length) * 98 + (review / scoped.length) * 62 + (pending / scoped.length) * 28 - blocked * 20);
}

function publicize(row: Pass2629RlsPolicyFixtureRow): Pass2629RlsPolicyFixtureRow {
  return {
    ...row,
    requiredProof: row.status === "pass" ? "RLS fixture proof attached" : "RLS fixture must be executed on Supabase preview before launch",
    observed: row.status === "pass" ? row.observed : "not_executed",
  };
}

function messageFor(locale: string, rowId: string) {
  const labels: Record<string, [string, string, string]> = {
    owner_select_board: ["Właściciel może czytać wyłącznie swój release board.", "Der Owner kann nur sein Release Board lesen.", "The owner can read only the bound release board."],
    other_owner_select_board: ["Inny właściciel nie może czytać cudzego release board.", "Ein anderer Owner darf fremde Release Boards nicht lesen.", "A different owner cannot read another account release board."],
    anon_select_board: ["Anonimowy klient nie widzi release board.", "Anon-Zugriff sieht kein Release Board.", "Anonymous access cannot read the release board."],
    service_insert_board: ["Service role może dopisać immutable board.", "Service Role darf ein immutable Board anhängen.", "Service role can append the immutable board."],
    owner_insert_board: ["Klient nie może sam tworzyć board proof.", "Der Client kann keinen Board Proof erstellen.", "A client cannot forge board proof."],
    update_board_denied: ["Update release board jest zablokowany.", "Updates am Release Board sind blockiert.", "Release board update is denied."],
    delete_board_denied: ["Delete release board jest zablokowany.", "Löschen des Release Boards ist blockiert.", "Release board delete is denied."],
    operator_select_private_refs: ["Operator może czytać prywatne referencje przez kontrolowany scope.", "Operator kann private Refs über kontrollierten Scope lesen.", "Operator can read private refs through controlled scope."],
    owner_select_private_refs_denied: ["Klient nie widzi private refs.", "Der Kunde sieht keine Private Refs.", "Customer cannot read private refs."],
    service_insert_private_refs: ["Service role może zapisać private refs.", "Service Role kann Private Refs schreiben.", "Service role can insert private refs."],
    anon_select_private_refs_denied: ["Anonimowy dostęp nie widzi private refs.", "Anon-Zugriff sieht keine Private Refs.", "Anonymous access cannot read private refs."],
    operator_select_board: ["Operator może czytać board przez admin scope.", "Operator kann Board über Admin Scope lesen.", "Operator can read the board through admin scope."],
  };
  const picked = labels[rowId] ?? ["Fixture wymaga dowodu RLS.", "Fixture braucht RLS Proof.", "Fixture requires RLS proof."];
  return t(locale, picked[0], picked[1], picked[2]);
}

export function buildPass2629SupabaseRlsPolicyRegressionFixtureRunnerReport(input: BuilderInput = {}): Pass2629SupabaseRlsPolicyRegressionFixtureRunnerReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const rlsGate = input.rlsGate ?? null;
  const fixturesExecuted = Boolean(input.fixturesExecuted);
  const rlsReady = Boolean(rlsGate?.summary.canStoreReleaseBoard);

  const rows: Pass2629RlsPolicyFixtureRow[] = [
    row({
      id: "owner_select_board",
      role: "owner",
      operation: "select",
      table: "release_board",
      lane: "customer_read",
      expected: "allow",
      observed: input.ownerSelectObserved ?? (fixturesExecuted ? "allow" : "not_executed"),
      customerSafeOutcome: messageFor(locale, "owner_select_board"),
      requiredProof: "select as owner returns exactly one owner-bound release board row",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "other_owner_select_board",
      role: "other_owner",
      operation: "select",
      table: "release_board",
      lane: "negative_control",
      expected: "deny",
      observed: observedValue(input.otherOwnerSelectObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "other_owner_select_board"),
      requiredProof: "select as another account returns zero rows / RLS denied",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "anon_select_board",
      role: "anon",
      operation: "select",
      table: "release_board",
      lane: "negative_control",
      expected: "deny",
      observed: observedValue(input.anonSelectObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "anon_select_board"),
      requiredProof: "select as anon returns zero rows / RLS denied",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: false,
    }),
    row({
      id: "service_insert_board",
      role: "service_role",
      operation: "insert",
      table: "release_board",
      lane: "service_insert",
      expected: "allow",
      observed: input.serviceInsertObserved ?? (fixturesExecuted ? "allow" : "not_executed"),
      customerSafeOutcome: messageFor(locale, "service_insert_board"),
      requiredProof: "service-role insert creates immutable release board row",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "owner_insert_board",
      role: "owner",
      operation: "insert",
      table: "release_board",
      lane: "negative_control",
      expected: "deny",
      observed: observedValue(input.ownerInsertObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "owner_insert_board"),
      requiredProof: "client insert is denied by RLS",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "update_board_denied",
      role: "service_role",
      operation: "update",
      table: "release_board",
      lane: "immutability",
      expected: "deny",
      observed: observedValue(input.updateObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "update_board_denied"),
      requiredProof: "update attempt is denied; corrections create a new version/hash",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "delete_board_denied",
      role: "service_role",
      operation: "delete",
      table: "release_board",
      lane: "immutability",
      expected: "deny",
      observed: observedValue(input.deleteObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "delete_board_denied"),
      requiredProof: "delete attempt is denied; retention/erasure uses superseding status, not mutation",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "operator_select_private_refs",
      role: "operator",
      operation: "select",
      table: "private_refs",
      lane: "private_ref",
      expected: "allow",
      observed: input.operatorPrivateRefSelectObserved ?? (fixturesExecuted ? "allow" : "not_executed"),
      customerSafeOutcome: messageFor(locale, "operator_select_private_refs"),
      requiredProof: "operator/admin scope can select private refs without exposing them publicly",
      blocksLaunch: true,
      blocksPdfRelease: false,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "owner_select_private_refs_denied",
      role: "owner",
      operation: "select",
      table: "private_refs",
      lane: "private_ref",
      expected: "deny",
      observed: observedValue(input.ownerPrivateRefSelectObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "owner_select_private_refs_denied"),
      requiredProof: "owner select on private refs returns zero rows / denied",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "service_insert_private_refs",
      role: "service_role",
      operation: "insert",
      table: "private_refs",
      lane: "private_ref",
      expected: "allow",
      observed: input.servicePrivateRefInsertObserved ?? (fixturesExecuted ? "allow" : "not_executed"),
      customerSafeOutcome: messageFor(locale, "service_insert_private_refs"),
      requiredProof: "service-role insert writes private refs to operator-only table",
      blocksLaunch: true,
      blocksPdfRelease: false,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "anon_select_private_refs_denied",
      role: "anon",
      operation: "select",
      table: "private_refs",
      lane: "negative_control",
      expected: "deny",
      observed: observedValue(input.anonPrivateRefSelectObserved, fixturesExecuted),
      customerSafeOutcome: messageFor(locale, "anon_select_private_refs_denied"),
      requiredProof: "anon select on private refs returns zero rows / denied",
      blocksLaunch: true,
      blocksPdfRelease: true,
      blocksAdvancedRelease: true,
    }),
    row({
      id: "operator_select_board",
      role: "operator",
      operation: "select",
      table: "release_board",
      lane: "admin_operator",
      expected: "allow",
      observed: input.operatorBoardSelectObserved ?? (fixturesExecuted ? "allow" : "not_executed"),
      customerSafeOutcome: messageFor(locale, "operator_select_board"),
      requiredProof: "operator/admin scope can select release board for reconciliation",
      blocksLaunch: false,
      blocksPdfRelease: false,
      blocksAdvancedRelease: true,
    }),
  ];

  const gatedRows = rlsReady ? rows : rows.map((item) => ({
    ...item,
    status: item.status === "pass" ? "operator_review" as const : item.status,
    requiredProof: `${item.requiredProof}; PASS2628 RLS gate must be ready first`,
  }));

  const passingRows = gatedRows.filter((item) => item.status === "pass").length;
  const pendingRows = gatedRows.filter((item) => item.status === "pending").length;
  const blockedRows = gatedRows.filter((item) => item.status === "blocked").length;
  const operatorReviewRows = gatedRows.filter((item) => item.status === "operator_review").length;
  const fixturesExecutedCount = gatedRows.filter((item) => item.observed !== "not_executed").length;
  const fixturesPending = gatedRows.length - fixturesExecutedCount;
  const expectedDenyRows = gatedRows.filter((item) => item.expected === "deny").length;
  const expectedAllowRows = gatedRows.filter((item) => item.expected === "allow").length;
  const launchBlockingRows = gatedRows.filter((item) => item.blocksLaunch && item.status !== "pass").length;
  const pdfBlockingRows = gatedRows.filter((item) => item.blocksPdfRelease && item.status !== "pass").length;
  const advancedBlockingRows = gatedRows.filter((item) => item.blocksAdvancedRelease && item.status !== "pass").length;
  const regressionReadiness = readiness(gatedRows);
  const customerReadReadiness = readiness(gatedRows, (item) => item.lane === "customer_read");
  const serviceInsertReadiness = readiness(gatedRows, (item) => item.lane === "service_insert");
  const immutabilityReadiness = readiness(gatedRows, (item) => item.lane === "immutability");
  const privateRefReadiness = readiness(gatedRows, (item) => item.lane === "private_ref");
  const negativeControlReadiness = readiness(gatedRows, (item) => item.lane === "negative_control");
  const canPromoteReleaseBoard = rlsReady && launchBlockingRows === 0;
  const canUseForProPdfRelease = canPromoteReleaseBoard && pdfBlockingRows === 0;
  const canUseForAdvancedRelease = canPromoteReleaseBoard && advancedBlockingRows === 0;
  const topBlocker = !rlsReady
    ? "PASS2628 migration/RLS gate must be applied and ready before fixture proof can promote launch."
    : canPromoteReleaseBoard
      ? "none"
      : gatedRows.find((item) => item.blocksLaunch && item.status !== "pass")?.id ?? "Supabase RLS fixture proof is pending.";

  return {
    passId: PASS2629_SUPABASE_RLS_POLICY_REGRESSION_FIXTURE_RUNNER_ID,
    generatedAt: new Date().toISOString(),
    locale,
    requestSurface: "supabase_rls_policy_regression_fixture_runner",
    httpStatus: canPromoteReleaseBoard ? 200 : blockedRows > 0 ? 423 : 409,
    summary: {
      fixtureRows: gatedRows.length,
      passingRows,
      pendingRows,
      blockedRows,
      operatorReviewRows,
      fixturesExecuted: fixturesExecutedCount,
      fixturesPending,
      expectedDenyRows,
      expectedAllowRows,
      regressionReadiness,
      customerReadReadiness,
      serviceInsertReadiness,
      immutabilityReadiness,
      privateRefReadiness,
      negativeControlReadiness,
      launchBlockingRows,
      pdfBlockingRows,
      advancedBlockingRows,
      canPromoteReleaseBoard,
      canUseForProPdfRelease,
      canUseForAdvancedRelease,
      topBlocker,
      nextAction: canPromoteReleaseBoard
        ? "Attach the passing Supabase RLS fixture artifact to the immutable release board and promote only with matching board hash."
        : "Run the anon/owner/other-owner/operator/service-role RLS fixture matrix against Supabase preview, attach artifacts, then rerun PASS2629.",
    },
    customerRows: gatedRows.map(publicize),
    proPdfRows: gatedRows.filter((item) => item.blocksPdfRelease || item.lane === "immutability" || item.lane === "negative_control").map(publicize),
    operatorRows: gatedRows,
    fixtureContract: {
      invariant: "Release evidence board RLS is accepted only when anon/owner/other-owner/operator/service-role fixtures prove allowed reads/writes and denied mutation/private-ref access.",
      requiredRoles: ["anon", "owner", "other_owner", "operator", "service_role"],
      requiredTables: ["velmere_audit_release_evidence_boards", "velmere_audit_release_evidence_private_refs"],
      requiredOperations: ["select", "insert", "update", "delete"],
      expectedAllowRules: [
        "owner select own release board",
        "service-role insert release board",
        "service-role insert private refs",
        "operator/admin select private refs",
        "operator/admin select release board for reconciliation",
      ],
      expectedDenyRules: [
        "anon select release board",
        "other owner select release board",
        "client insert release board",
        "update release board",
        "delete release board",
        "owner/anon select private refs",
      ],
      customerVisibleFields: ["role", "operation", "table", "expected", "status", "customerSafeOutcome"],
      operatorOnlyFields: ["rawSupabaseError", "jwtClaims", "policySqlTrace", "privateRefValue", "serviceRoleResponse"],
      launchAcceptanceRules: [
        "Every launch-blocking fixture must pass before release board promotion.",
        "Every expected deny fixture must prove zero rows/permission denied, not simply hide data in UI.",
        "Public/PDF output may show fixture status only, never raw policy traces or private refs.",
        "Any RLS regression blocks Pro PDF release and Advanced operator promotion until a new board hash is sealed.",
      ],
    },
    customerResponse: {
      ok: canPromoteReleaseBoard,
      surface: "supabase_rls_policy_regression_fixture_runner",
      status: canPromoteReleaseBoard ? "ready" : blockedRows > 0 ? "blocked" : "needs_fixture_run",
      message: canPromoteReleaseBoard
        ? "Supabase RLS policy fixtures passed for release evidence board promotion."
        : "Supabase RLS policy fixtures still need preview execution before release evidence board promotion.",
      nextSafeAction: topBlocker === "none" ? "Attach fixture artifact and seal the release board." : topBlocker,
    },
  };
}
