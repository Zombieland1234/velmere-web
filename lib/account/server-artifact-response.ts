export type ServerArtifactResolution<Status extends string> = {
  status: Status;
  serverConfirmed: boolean;
  reason: "confirmed" | "blocked_status" | "missing_payload" | "invalid_envelope" | "invalid_status" | "missing_ready_field";
};

function nonEmptyText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveServerArtifactStatus<Status extends string>(args: {
  payload: Record<string, unknown> | undefined;
  expectedSchema: string;
  allowedStatuses: readonly Status[];
  readyStatus: Status;
  fallbackStatus: Status;
  requiredReadyFields: readonly string[];
}): ServerArtifactResolution<Status> {
  if (!args.payload) {
    return { status: args.fallbackStatus, serverConfirmed: false, reason: "missing_payload" };
  }

  if (args.payload.schema !== args.expectedSchema) {
    return { status: args.fallbackStatus, serverConfirmed: false, reason: "invalid_envelope" };
  }

  const rawStatus = args.payload.status;
  if (typeof rawStatus !== "string" || !args.allowedStatuses.includes(rawStatus as Status)) {
    return { status: args.fallbackStatus, serverConfirmed: false, reason: "invalid_status" };
  }

  const status = rawStatus as Status;
  if (status !== args.readyStatus) {
    return { status, serverConfirmed: false, reason: "blocked_status" };
  }

  if (!args.requiredReadyFields.every((field) => nonEmptyText(args.payload?.[field]))) {
    return { status: args.fallbackStatus, serverConfirmed: false, reason: "missing_ready_field" };
  }

  return { status, serverConfirmed: true, reason: "confirmed" };
}
