import { hashVelmereAccountBinding } from "@/lib/auth/account-session";
import { verifyVlmPaidAccountEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import type { AuditTier } from "@/lib/security/audit-canonical-report";
import {
  verifyPass4822AccountCustomerArtifactOwner,
  type AccountCustomerArtifactSnapshot,
} from "@/lib/reporting/account-customer-artifact-snapshot";

export type HistoricalArtifactTier = AuditTier;
export type HistoricalArtifactPolicyState = "defined" | "undefined";
export type HistoricalArtifactAccessReason =
  | "basic_owner_access"
  | "current_entitlement_sufficient"
  | "owner_mismatch"
  | "current_entitlement_required"
  | "paid_surface_policy_undefined"
  | "artifact_tier_invalid";

export type HistoricalArtifactAccessDecision = {
  allowed: boolean;
  policyState: HistoricalArtifactPolicyState;
  reason: HistoricalArtifactAccessReason;
  requiredTier: HistoricalArtifactTier | null;
  currentTier: HistoricalArtifactTier;
};

const rank: Record<HistoricalArtifactTier, number> = { basic: 0, pro: 1, advanced: 2 };

function normalizeTier(value: unknown): HistoricalArtifactTier | null {
  return value === "basic" || value === "pro" || value === "advanced" ? value : null;
}

export function historicalArtifactRequiredTier(
  snapshot: Pick<AccountCustomerArtifactSnapshot, "requestedTier" | "deliveredTier">,
): HistoricalArtifactTier | null {
  return normalizeTier(snapshot.deliveredTier ?? snapshot.requestedTier);
}

export function evaluateHistoricalArtifactAccess(args: {
  ownerMatches: boolean;
  requiredTier: HistoricalArtifactTier | null;
  currentTier: HistoricalArtifactTier;
  paidPolicyDefined: boolean;
}): HistoricalArtifactAccessDecision {
  if (!args.ownerMatches) return {
    allowed: false,
    policyState: args.paidPolicyDefined ? "defined" : "undefined",
    reason: "owner_mismatch",
    requiredTier: args.requiredTier,
    currentTier: args.currentTier,
  };
  if (!args.requiredTier) return {
    allowed: false, policyState: "undefined", reason: "artifact_tier_invalid",
    requiredTier: null, currentTier: args.currentTier,
  };
  if (args.requiredTier === "basic") return {
    allowed: true, policyState: "defined", reason: "basic_owner_access",
    requiredTier: "basic", currentTier: args.currentTier,
  };
  if (!args.paidPolicyDefined) return {
    allowed: false, policyState: "undefined", reason: "paid_surface_policy_undefined",
    requiredTier: args.requiredTier, currentTier: args.currentTier,
  };
  if (rank[args.currentTier] >= rank[args.requiredTier]) return {
    allowed: true, policyState: "defined", reason: "current_entitlement_sufficient",
    requiredTier: args.requiredTier, currentTier: args.currentTier,
  };
  return {
    allowed: false, policyState: "defined", reason: "current_entitlement_required",
    requiredTier: args.requiredTier, currentTier: args.currentTier,
  };
}

function auditCaseRefFromSnapshot(snapshot: AccountCustomerArtifactSnapshot): string | undefined {
  if (!snapshot.payload || typeof snapshot.payload !== "object" || Array.isArray(snapshot.payload)) return undefined;
  const value = (snapshot.payload as Record<string, unknown>).caseRef;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160).toUpperCase() : undefined;
}

async function resolveCurrentAuditTier(accountId: string, snapshot: AccountCustomerArtifactSnapshot): Promise<HistoricalArtifactTier> {
  const accountIdHash = hashVelmereAccountBinding(accountId);
  const auditCaseRef = auditCaseRefFromSnapshot(snapshot);
  const advanced = await verifyVlmPaidAccountEntitlement({
    productId: "vlm_advanced_audit_human_review",
    context: { accountIdHash, auditCaseRef },
  });
  if (advanced.ok && advanced.entitlement) return "advanced";
  const pro = await verifyVlmPaidAccountEntitlement({
    productId: "vlm_pro_audit_review",
    context: { accountIdHash, auditCaseRef },
  });
  if (pro.ok && pro.entitlement) return "pro";
  return "basic";
}

export async function authorizeHistoricalCustomerArtifactAccess(args: {
  snapshot: AccountCustomerArtifactSnapshot;
  accountId: string;
  resolveAuditTier?: (accountId: string, snapshot: AccountCustomerArtifactSnapshot) => Promise<HistoricalArtifactTier>;
}): Promise<HistoricalArtifactAccessDecision> {
  const ownerMatches = verifyPass4822AccountCustomerArtifactOwner(args.snapshot, args.accountId);
  const requiredTier = historicalArtifactRequiredTier(args.snapshot);
  if (!ownerMatches || !requiredTier || requiredTier === "basic") {
    return evaluateHistoricalArtifactAccess({
      ownerMatches,
      requiredTier,
      currentTier: "basic",
      paidPolicyDefined: args.snapshot.surface === "audit" || requiredTier === "basic",
    });
  }
  if (args.snapshot.surface !== "audit") {
    return evaluateHistoricalArtifactAccess({
      ownerMatches: true, requiredTier, currentTier: "basic", paidPolicyDefined: false,
    });
  }
  const currentTier = await (args.resolveAuditTier ?? resolveCurrentAuditTier)(args.accountId, args.snapshot);
  return evaluateHistoricalArtifactAccess({
    ownerMatches: true, requiredTier, currentTier, paidPolicyDefined: true,
  });
}
