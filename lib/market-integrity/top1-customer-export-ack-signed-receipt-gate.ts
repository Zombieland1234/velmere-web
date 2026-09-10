import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type {
  Pass2840CustomerExportDeliveryLedgerPersistenceGate,
  Pass2840CustomerExportLedgerChannel,
} from "@/lib/market-integrity/top1-customer-export-delivery-ledger-persistence-gate";

export type Pass2841CustomerExportAcknowledgementState =
  | "ledger_blocked"
  | "ack_not_required"
  | "ack_pending"
  | "ack_receipt_missing"
  | "signature_missing"
  | "signature_unverified"
  | "channel_mismatch"
  | "payload_drift_blocked"
  | "ack_expired"
  | "customer_disputed"
  | "ack_revoked"
  | "signed_receipt_ready";

export type Pass2841CustomerAckChannel = Pass2840CustomerExportLedgerChannel | "customer_portal";

export type Pass2841CustomerExportAcknowledgementSignedReceiptGate = {
  schemaVersion: "pass2841_customer_export_ack_signed_receipt_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  acknowledgementState: Pass2841CustomerExportAcknowledgementState;
  acknowledgementReadinessScore: number;
  acknowledgementEnvelope: {
    acknowledgementRequired: boolean;
    acknowledgementLedgerRowId: string | null;
    customerAckReceiptId: string | null;
    signedReceiptId: string | null;
    presentedExportPacketId: string | null;
    presentedPayloadHash: string | null;
    presentedSourceReceiptRoot: string | null;
    acknowledgedAt: string | null;
    acknowledgementExpiresAt: string | null;
    channel: Pass2841CustomerAckChannel;
    termsVersion: "customer_export_ack_terms_v1";
  };
  signedReceiptContract: {
    receiptSchemaVersion: "customer_export_signed_receipt_v1";
    customerAccountIdHash: string | null;
    signatureHash: string | null;
    signatureVerified: boolean;
    signerNonceHash: string | null;
    operatorCountersignatureId: string | null;
    notificationOpenReceiptId: string | null;
    acknowledgementIpHash: string | null;
    userAgentHash: string | null;
  };
  acknowledgementPolicy: {
    canServeCustomerVisibleExport: boolean;
    canSendFinalEmailNotice: boolean;
    canExposeFinalApiHandoff: boolean;
    canAttachFinalSupportPacket: boolean;
    canClaimCustomerAcknowledged: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  acknowledgementRiskSignals: {
    previousLedgerBlocked: boolean;
    acknowledgementRequiredButMissing: boolean;
    missingAckReceipt: boolean;
    missingSignedReceipt: boolean;
    signatureMissing: boolean;
    signatureUnverified: boolean;
    channelMismatch: boolean;
    packetHashOrSourceRootMismatch: boolean;
    payloadOrSourceRootDrift: boolean;
    acknowledgementExpired: boolean;
    customerDisputed: boolean;
    acknowledgementRevoked: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2841_CUSTOMER_EXPORT_ACK_SIGNED_RECEIPT_ACCEPTANCE_GATES = [
  "PASS2841: Durable export ledger persistence does not equal customer acknowledgement; account download, email, API and support handoff require a separate acknowledgement/signed-receipt boundary when customer-visible paid evidence is delivered.",
  "PASS2841: Customer acknowledgement must bind exportPacketId, payloadHash, sourceReceiptRoot, channel, terms version, account identity hash and signed receipt ID before final customer-visible delivery is claimed.",
  "PASS2841: Acknowledgement receipts must be append-only and revocable; revoked, disputed, expired or mismatched acknowledgements freeze final email/API/support attachment release.",
  "PASS2841: Signature hash and nonce hash must be stored server-side; wallet/account acknowledgement is identity proof only and must not expose raw account IDs, tokens or payment IDs.",
  "PASS2841: Each customer acknowledgement must carry customer-safe copy that says the export is evidence delivery, not financial advice, not a guarantee and not a buy/sell instruction.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redact(value: string | null | undefined) {
  if (!value) return null;
  const clean = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 10) return `${clean.slice(0, 3)}…redacted`;
  return `${clean.slice(0, 5)}…${clean.slice(-5)}`;
}

function asStamp(value: string | null | undefined) {
  if (!value) return null;
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : null;
}

export function buildPass2841CustomerExportAcknowledgementSignedReceiptGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportDeliveryLedgerPersistenceGate: Pass2840CustomerExportDeliveryLedgerPersistenceGate;
  generatedAt?: string;
  acknowledgementRequired?: boolean;
  acknowledgementLedgerRowId?: string | null;
  customerAckReceiptId?: string | null;
  signedReceiptId?: string | null;
  presentedExportPacketId?: string | null;
  presentedPayloadHash?: string | null;
  presentedSourceReceiptRoot?: string | null;
  acknowledgedAt?: string | null;
  acknowledgementExpiresAt?: string | null;
  channel?: Pass2841CustomerAckChannel;
  customerAccountIdHash?: string | null;
  signatureHash?: string | null;
  signatureVerified?: boolean;
  signerNonceHash?: string | null;
  operatorCountersignatureId?: string | null;
  notificationOpenReceiptId?: string | null;
  acknowledgementIpHash?: string | null;
  userAgentHash?: string | null;
  channelMismatch?: boolean;
  packetHashOrSourceRootMismatch?: boolean;
  payloadOrSourceRootDrift?: boolean;
  customerDisputed?: boolean;
  acknowledgementRevoked?: boolean;
}): Pass2841CustomerExportAcknowledgementSignedReceiptGate {
  const previousGate = args.customerExportDeliveryLedgerPersistenceGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const acknowledgementRequired = args.acknowledgementRequired !== false;
  const channel = args.channel ?? "customer_portal";
  const previousClear = Boolean(previousGate.persistencePolicy.canPersistExportPacket && !previousGate.persistenceRiskSignals.payloadOrSourceRootDrift);
  const ledgerRowReady = Boolean(args.acknowledgementLedgerRowId);
  const ackReceiptReady = Boolean(args.customerAckReceiptId);
  const signedReceiptReady = Boolean(args.signedReceiptId);
  const signatureHashReady = Boolean(args.signatureHash);
  const signatureVerified = args.signatureVerified !== false && signatureHashReady;
  const ackAtReady = Boolean(args.acknowledgedAt);
  const nowStamp = asStamp(generatedAt) ?? Date.now();
  const expiresStamp = asStamp(args.acknowledgementExpiresAt);
  const acknowledgementExpired = Boolean(expiresStamp && expiresStamp <= nowStamp);
  const channelMismatch = Boolean(args.channelMismatch);
  const packetHashOrSourceRootMismatch = Boolean(args.packetHashOrSourceRootMismatch);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || previousGate.persistenceRiskSignals.payloadOrSourceRootDrift);
  const customerDisputed = Boolean(args.customerDisputed);
  const acknowledgementRevoked = Boolean(args.acknowledgementRevoked);

  const ackClear = Boolean(
    previousClear &&
      (!acknowledgementRequired || (
        ledgerRowReady &&
        ackReceiptReady &&
        signedReceiptReady &&
        signatureHashReady &&
        signatureVerified &&
        ackAtReady &&
        !channelMismatch &&
        !packetHashOrSourceRootMismatch &&
        !payloadOrSourceRootDrift &&
        !acknowledgementExpired &&
        !customerDisputed &&
        !acknowledgementRevoked
      )),
  );

  const acknowledgementState: Pass2841CustomerExportAcknowledgementState = !previousClear
    ? "ledger_blocked"
    : !acknowledgementRequired
      ? "ack_not_required"
      : payloadOrSourceRootDrift || packetHashOrSourceRootMismatch
        ? "payload_drift_blocked"
        : acknowledgementRevoked
          ? "ack_revoked"
          : customerDisputed
            ? "customer_disputed"
            : acknowledgementExpired
              ? "ack_expired"
              : channelMismatch
                ? "channel_mismatch"
                : !ledgerRowReady || !ackAtReady
                  ? "ack_pending"
                  : !ackReceiptReady
                    ? "ack_receipt_missing"
                    : !signedReceiptReady || !signatureHashReady
                      ? "signature_missing"
                      : !signatureVerified
                        ? "signature_unverified"
                        : "signed_receipt_ready";

  const acknowledgementReadinessScore = clamp(
    previousGate.persistenceReadinessScore +
      (previousClear ? 10 : -36) +
      (acknowledgementRequired ? 0 : 6) +
      (ledgerRowReady ? 12 : -20) +
      (ackReceiptReady ? 14 : -22) +
      (signedReceiptReady ? 14 : -22) +
      (signatureHashReady ? 10 : -18) +
      (signatureVerified ? 12 : -24) +
      (ackAtReady ? 8 : -14) -
      (channelMismatch ? 18 : 0) -
      (packetHashOrSourceRootMismatch ? 28 : 0) -
      (payloadOrSourceRootDrift ? 32 : 0) -
      (acknowledgementExpired ? 18 : 0) -
      (customerDisputed ? 22 : 0) -
      (acknowledgementRevoked ? 30 : 0),
  );

  const reason = !previousClear
    ? "PASS2840 delivery ledger persistence is not clear; customer acknowledgement cannot approve an unpersisted or unsafe export."
    : !acknowledgementRequired
      ? "Acknowledgement is not required for this fixture path, but customer-visible paid evidence still remains bounded by ledger, expiry and redaction policies."
      : payloadOrSourceRootDrift || packetHashOrSourceRootMismatch
        ? "Payload/source-root or packet binding mismatch blocks final customer-visible delivery; replay and reseal before asking for acknowledgement again."
        : acknowledgementRevoked
          ? "Acknowledgement has been revoked; freeze final delivery and append a revocation receipt."
          : customerDisputed
            ? "Customer disputed the acknowledgement/export; freeze final delivery and route to support review."
            : acknowledgementExpired
              ? "Acknowledgement window expired; regenerate the acknowledgement request and signed receipt envelope."
              : channelMismatch
                ? "Acknowledgement channel does not match the delivery ledger channel; store a new channel-specific acknowledgement receipt."
                : !ledgerRowReady || !ackAtReady
                  ? "Customer acknowledgement ledger row or acknowledgedAt timestamp is missing."
                  : !ackReceiptReady
                    ? "Customer acknowledgement receipt ID is missing."
                    : !signedReceiptReady || !signatureHashReady
                      ? "Signed receipt ID or signature hash is missing."
                      : !signatureVerified
                        ? "Signed receipt exists but signature verification is not confirmed server-side."
                        : "Customer acknowledgement is signed, verified, packet-bound, channel-bound and safe to reference for final customer-visible export delivery.";

  return {
    schemaVersion: "pass2841_customer_export_ack_signed_receipt_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    acknowledgementState,
    acknowledgementReadinessScore,
    acknowledgementEnvelope: {
      acknowledgementRequired,
      acknowledgementLedgerRowId: redact(args.acknowledgementLedgerRowId),
      customerAckReceiptId: redact(args.customerAckReceiptId),
      signedReceiptId: redact(args.signedReceiptId),
      presentedExportPacketId: redact(args.presentedExportPacketId),
      presentedPayloadHash: redact(args.presentedPayloadHash),
      presentedSourceReceiptRoot: redact(args.presentedSourceReceiptRoot),
      acknowledgedAt: args.acknowledgedAt ?? null,
      acknowledgementExpiresAt: args.acknowledgementExpiresAt ?? null,
      channel,
      termsVersion: "customer_export_ack_terms_v1",
    },
    signedReceiptContract: {
      receiptSchemaVersion: "customer_export_signed_receipt_v1",
      customerAccountIdHash: redact(args.customerAccountIdHash),
      signatureHash: redact(args.signatureHash),
      signatureVerified,
      signerNonceHash: redact(args.signerNonceHash),
      operatorCountersignatureId: redact(args.operatorCountersignatureId),
      notificationOpenReceiptId: redact(args.notificationOpenReceiptId),
      acknowledgementIpHash: redact(args.acknowledgementIpHash),
      userAgentHash: redact(args.userAgentHash),
    },
    acknowledgementPolicy: {
      canServeCustomerVisibleExport: ackClear,
      canSendFinalEmailNotice: ackClear && channel === "email_notice",
      canExposeFinalApiHandoff: ackClear && channel === "api_handoff",
      canAttachFinalSupportPacket: ackClear && channel === "support_attachment",
      canClaimCustomerAcknowledged: ackClear && acknowledgementRequired,
      canClaimWorldClass100: false,
      reason,
    },
    acknowledgementRiskSignals: {
      previousLedgerBlocked: !previousClear,
      acknowledgementRequiredButMissing: acknowledgementRequired && (!ledgerRowReady || !ackAtReady),
      missingAckReceipt: acknowledgementRequired && !ackReceiptReady,
      missingSignedReceipt: acknowledgementRequired && !signedReceiptReady,
      signatureMissing: acknowledgementRequired && !signatureHashReady,
      signatureUnverified: acknowledgementRequired && !signatureVerified,
      channelMismatch,
      packetHashOrSourceRootMismatch,
      payloadOrSourceRootDrift,
      acknowledgementExpired,
      customerDisputed,
      acknowledgementRevoked,
    },
    customerSafeCopy:
      "I acknowledge that this export is an evidence delivery packet, not financial advice, not a guarantee, not a buy/sell instruction, and that missing evidence/source freshness may limit confidence.",
    operatorNextActions: [
      previousClear ? "PASS2840 ledger persistence is clear; request customer acknowledgement for final delivery." : "Do not request customer acknowledgement until PASS2840 delivery ledger persistence clears.",
      ledgerRowReady ? "Customer acknowledgement ledger row is present." : "Create append-only customer acknowledgement ledger row before final delivery.",
      ackReceiptReady ? "Customer acknowledgement receipt ID is present." : "Persist customer acknowledgement receipt ID tied to exportPacketId/payloadHash/sourceReceiptRoot.",
      signedReceiptReady && signatureHashReady ? "Signed receipt and signature hash are present." : "Store signed receipt ID, signature hash and signer nonce hash server-side.",
      signatureVerified ? "Signature verification is confirmed." : "Verify acknowledgement signature/nonce on the server before release.",
      !channelMismatch ? "Acknowledgement channel matches delivery context." : "Regenerate channel-specific acknowledgement receipt before email/API/support handoff.",
      !packetHashOrSourceRootMismatch && !payloadOrSourceRootDrift ? "Payload/source-root binding is stable." : "Replay, reseal and restart acknowledgement because packet binding drifted.",
      !customerDisputed && !acknowledgementRevoked ? "No dispute/revocation blocks final delivery." : "Freeze final delivery and route to support review with revocation/dispute receipt.",
    ],
  };
}
