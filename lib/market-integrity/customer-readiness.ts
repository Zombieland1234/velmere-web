export const CUSTOMER_READINESS_CONTRACT_VERSION = "customer-readiness-v3" as const;

export type CustomerReadinessEnvironment = "production" | "preview" | "development";
export type CustomerReadinessPersistence = "durable-configured" | "ephemeral-preview";

export type CustomerReadinessPayload = {
  contractVersion: typeof CUSTOMER_READINESS_CONTRACT_VERSION;
  service: "market-integrity";
  status: "withheld";
  environment: CustomerReadinessEnvironment;
  persistence: CustomerReadinessPersistence;
  claimBoundary: "configuration-only-no-health-credit";
  operationalHealthProven: false;
  customerDeliveryReady: false;
  blockers: string[];
  generatedAt: string;
};

function normalizeEnvironment(value: string | undefined): CustomerReadinessEnvironment {
  if (value === "production") return "production";
  if (value === "preview") return "preview";
  return "development";
}

export function buildCustomerReadiness(input: {
  generatedAt?: Date;
  vercelEnvironment?: string;
  durablePersistenceConfigured: boolean;
}): CustomerReadinessPayload {
  const generatedAt = input.generatedAt ?? new Date();
  return {
    contractVersion: CUSTOMER_READINESS_CONTRACT_VERSION,
    service: "market-integrity",
    status: "withheld",
    environment: normalizeEnvironment(input.vercelEnvironment),
    persistence: input.durablePersistenceConfigured ? "durable-configured" : "ephemeral-preview",
    claimBoundary: "configuration-only-no-health-credit",
    operationalHealthProven: false,
    customerDeliveryReady: false,
    blockers: [
      ...(!input.durablePersistenceConfigured ? ["durable_persistence_not_configured"] : []),
      "live_db_provider_queue_health_not_proven",
    ],
    generatedAt: generatedAt.toISOString(),
  };
}
