import type { Pass2838CustomerExportChannel } from "@/lib/market-integrity/top1-customer-export-redaction-packet-gate";
import type { Pass2840CustomerExportLedgerChannel } from "@/lib/market-integrity/top1-customer-export-delivery-ledger-persistence-gate";
import type { Pass2841CustomerAckChannel } from "@/lib/market-integrity/top1-customer-export-ack-signed-receipt-gate";
import type { Pass2842CustomerExportHoldReason } from "@/lib/market-integrity/top1-customer-export-dispute-chargeback-hold-gate";
import type { Pass2843CustomerExportOperatorReleaseDecision } from "@/lib/market-integrity/top1-customer-export-operator-release-reinstatement-gate";
import type { Pass2850CustomerExportArchiveChannel } from "@/lib/market-integrity/top1-customer-export-final-archive-bundle-gate";
import type { Pass2851CustomerExportRetentionChannel } from "@/lib/market-integrity/top1-customer-export-archive-retention-legal-hold-gate";
import type { Pass2852CustomerExportPurgeChannel } from "@/lib/market-integrity/top1-customer-export-retention-purge-execution-tombstone-gate";
import type { Pass2853CustomerExportResidualScanChannel } from "@/lib/market-integrity/top1-customer-export-post-purge-privacy-attestation-gate";
import type { Pass2863CustomerExportSupervisoryResidualScanChannel } from "@/lib/market-integrity/top1-customer-export-supervisory-post-purge-residual-evidence-scan-gate";
import type { Pass2864CustomerExportSupervisoryCorrectedRescanChannel } from "@/lib/market-integrity/top1-customer-export-supervisory-residual-finding-remediation-rescan-close-gate";
import type { Pass2866CustomerExportSupervisoryResolutionNoticeTarget } from "@/lib/market-integrity/top1-customer-export-supervisory-residual-escalation-resolution-freeze-lift-gate";

export type CustomerExportLedgerStatus = "pending" | "active" | "expired" | "recalled" | "retention_closed" | "blocked";

function oneOf<const T extends readonly string[]>(value: string | null, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

export const CUSTOMER_EXPORT_CHANNELS = ["account_download", "email_notice", "api_handoff", "support_attachment"] as const satisfies readonly Pass2838CustomerExportChannel[];
export const CUSTOMER_EXPORT_LEDGER_CHANNELS = ["account_vault", "email_notice", "api_handoff", "support_attachment"] as const satisfies readonly Pass2840CustomerExportLedgerChannel[];
export const CUSTOMER_EXPORT_ACK_CHANNELS = ["account_vault", "email_notice", "api_handoff", "support_attachment", "customer_portal"] as const satisfies readonly Pass2841CustomerAckChannel[];
export const CUSTOMER_EXPORT_LEDGER_STATUSES = ["pending", "active", "expired", "recalled", "retention_closed", "blocked"] as const satisfies readonly CustomerExportLedgerStatus[];
export const CUSTOMER_EXPORT_HOLD_REASONS = ["none", "payment_dispute", "chargeback", "payment_withdrawal", "policy_violation", "compliance_review", "customer_dispute", "refund_credit_collision", "payload_source_drift"] as const satisfies readonly Pass2842CustomerExportHoldReason[];
export const CUSTOMER_EXPORT_RELEASE_DECISIONS = ["none", "reinstate_account_download", "reinstate_email_notice", "reinstate_api_handoff", "reinstate_support_attachment", "reinstate_all_channels", "deny_reinstatement"] as const satisfies readonly Pass2843CustomerExportOperatorReleaseDecision[];

export const CUSTOMER_EXPORT_ARCHIVE_CHANNELS = ["account_vault", "email", "api", "support"] as const satisfies readonly Pass2850CustomerExportArchiveChannel[];
export const CUSTOMER_EXPORT_RETENTION_CHANNELS = ["account_vault", "email", "api", "support"] as const satisfies readonly Pass2851CustomerExportRetentionChannel[];
export const CUSTOMER_EXPORT_PURGE_CHANNELS = ["account_vault", "email", "api", "support"] as const satisfies readonly Pass2852CustomerExportPurgeChannel[];
export const CUSTOMER_EXPORT_RESIDUAL_SCAN_CHANNELS = ["account_vault", "email", "api", "support"] as const satisfies readonly Pass2853CustomerExportResidualScanChannel[];
export const CUSTOMER_EXPORT_SUPERVISORY_RESIDUAL_SCAN_CHANNELS = ["regulator_access_index", "auditor_access_index", "support_attachment_cache", "legal_case_cache", "operator_console_cache", "secure_vault_index"] as const satisfies readonly Pass2863CustomerExportSupervisoryResidualScanChannel[];
export const CUSTOMER_EXPORT_SUPERVISORY_CORRECTED_RESCAN_CHANNELS = ["regulator_access_index", "auditor_access_index", "support_attachment_cache", "legal_case_cache", "operator_console_cache", "secure_vault_index"] as const satisfies readonly Pass2864CustomerExportSupervisoryCorrectedRescanChannel[];
export const CUSTOMER_EXPORT_SUPERVISORY_RESOLUTION_NOTICE_TARGETS = ["customer", "regulator", "auditor", "internal_privacy_supervisor"] as const satisfies readonly Pass2866CustomerExportSupervisoryResolutionNoticeTarget[];

export function safeCustomerExportChannel(value: string | null, fallback: Pass2838CustomerExportChannel = "account_download"): Pass2838CustomerExportChannel {
  return oneOf(value, CUSTOMER_EXPORT_CHANNELS, fallback);
}

export function safeCustomerExportLedgerChannel(value: string | null, fallback: Pass2840CustomerExportLedgerChannel = "account_vault"): Pass2840CustomerExportLedgerChannel {
  return oneOf(value, CUSTOMER_EXPORT_LEDGER_CHANNELS, fallback);
}

export function safeCustomerExportAckChannel(value: string | null, fallback: Pass2841CustomerAckChannel = "customer_portal"): Pass2841CustomerAckChannel {
  return oneOf(value, CUSTOMER_EXPORT_ACK_CHANNELS, fallback);
}

export function safeCustomerExportLedgerStatus(value: string | null, fallback: CustomerExportLedgerStatus = "active"): CustomerExportLedgerStatus {
  return oneOf(value, CUSTOMER_EXPORT_LEDGER_STATUSES, fallback);
}

export function safeCustomerExportHoldReason(value: string | null, fallback: Pass2842CustomerExportHoldReason = "none"): Pass2842CustomerExportHoldReason {
  return oneOf(value, CUSTOMER_EXPORT_HOLD_REASONS, fallback);
}

export function safeCustomerExportReleaseDecision(value: string | null, fallback: Pass2843CustomerExportOperatorReleaseDecision = "reinstate_all_channels"): Pass2843CustomerExportOperatorReleaseDecision {
  return oneOf(value, CUSTOMER_EXPORT_RELEASE_DECISIONS, fallback);
}
