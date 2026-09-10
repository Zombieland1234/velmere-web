export type VlmBehavioralEffect =
  | "access"
  | "market_provider"
  | "model"
  | "tool"
  | "durable"
  | "security_telemetry";

export type VlmBehavioralTraceEvent = {
  sequence: number;
  stage: string;
  effect: VlmBehavioralEffect | null;
  outcome: "ENTER" | "CALLED" | "RETURNED" | "REJECTED" | "THREW";
};

export type VlmBehavioralTraceSink = (
  event: Omit<VlmBehavioralTraceEvent, "sequence">,
) => void;
