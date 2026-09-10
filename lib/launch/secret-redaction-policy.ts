import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type SecretRedactionStatus = "ready" | "partial" | "blocked" | "manual_review";

export type SecretRedactionItem = {
  id: string;
  label: string;
  status: SecretRedactionStatus;
  progress: number;
  sourceMode: "policy_draft" | "static_guard" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const secretRedactionPolicy: SecretRedactionItem[] = [
  {
    id: "browser-visible-secret-scan",
    label: "Browser-visible secret scan",
    status: "partial",
    progress: 54,
    sourceMode: "static_guard",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Deployable UI must not contain provider tokens, payment keys, webhook secrets or raw private IDs.",
    safetyBoundary: "Public NEXT_PUBLIC names may exist, but private secrets must never appear in client code.",
    blockers: ["secret pattern coverage", "CI enforcement", "false positive allowlist"],
    nextStep: "Static secret guard and redacted logger now exist; next add CI enforcement and response allowlist."
  },
  {
    id: "raw-provider-redaction",
    label: "Raw provider response redaction",
    status: "blocked",
    progress: 24,
    sourceMode: "policy_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Admin UI shows reviewed fields, not raw provider JSON containing private metadata.",
    safetyBoundary: "No raw provider response, payment provider payload or webhook body in customer-visible UI.",
    blockers: ["response mapper", "safe field allowlist", "debug off switch"],
    nextStep: "Add safe provider response mapper before enabling provider sync preview.",
  },
  {
    id: "log-redaction",
    label: "Log redaction",
    status: "blocked",
    progress: 38,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Operational logs hide tokens, keys, payload signatures and sensitive provider identifiers.",
    safetyBoundary: "No console logging of auth sessions, payment payloads, provider tokens or webhook signatures.",
    blockers: ["logger wrapper", "redaction rules", "error formatter", "debug policy"],
    nextStep: "Redacted logger helper now exists; next route admin/provider/payment logs through it server-side."
  },
  {
    id: "private-prompt-redaction",
    label: "Private prompt redaction",
    status: "manual_review",
    progress: 40,
    sourceMode: "policy_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Internal prompts, private scoring weights and sensitive heuristics stay out of public exports.",
    safetyBoundary: "Evidence reports explain workflow without leaking private system internals.",
    blockers: ["export allowlist", "prompt filter", "scoring redaction"],
    nextStep: "Reuse evidence export redaction rules for all admin and Shield outputs.",
  },
];

export function getSecretRedactionSummary() {
  return summarizeLaunchReadiness(secretRedactionPolicy);
}
