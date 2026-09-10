export const R7_BROWSER_ACCOUNT_ARTIFACT_POLICY_ID =
  "r7-browser-account-artifact-persistence-v1" as const;

export type R7BrowserArtifactDepth = "basic" | "pro" | "advanced";

export type R7BrowserAccountArtifactDecision = Readonly<{
  schemaVersion: typeof R7_BROWSER_ACCOUNT_ARTIFACT_POLICY_ID;
  depth: R7BrowserArtifactDepth;
  accountBound: boolean;
  requestAllowed: boolean;
  persistExactAccountArtifact: boolean;
  anonymousBasicAllowed: boolean;
  failureCode: "account_session_required_for_paid_artifact" | null;
  customerFinalPromoted: false;
}>;

/**
 * Basic may be rendered anonymously, but an authenticated Basic request must
 * receive the same immutable account-artifact treatment as paid tiers. Paid
 * tiers remain fail-closed without an account. This policy creates no FINAL
 * credit; it only prevents the Basic route from silently dropping persistence.
 */
export function decideR7BrowserAccountArtifact(args: {
  depth: R7BrowserArtifactDepth;
  accountId?: string | null;
}): R7BrowserAccountArtifactDecision {
  const accountBound = String(args.accountId ?? "").trim().length > 0;
  if (args.depth === "basic") {
    return {
      schemaVersion: R7_BROWSER_ACCOUNT_ARTIFACT_POLICY_ID,
      depth: args.depth,
      accountBound,
      requestAllowed: true,
      persistExactAccountArtifact: accountBound,
      anonymousBasicAllowed: true,
      failureCode: null,
      customerFinalPromoted: false,
    };
  }
  return {
    schemaVersion: R7_BROWSER_ACCOUNT_ARTIFACT_POLICY_ID,
    depth: args.depth,
    accountBound,
    requestAllowed: accountBound,
    persistExactAccountArtifact: accountBound,
    anonymousBasicAllowed: false,
    failureCode: accountBound ? null : "account_session_required_for_paid_artifact",
    customerFinalPromoted: false,
  };
}
