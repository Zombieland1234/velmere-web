export type AdminEnvironmentGateStatus = "locked" | "preview" | "enabled";

export type AdminEnvironmentGateSnapshot = {
  status: AdminEnvironmentGateStatus;
  isUnlocked: boolean;
  sourceMode: "public_env_only";
  envFlagName: "NEXT_PUBLIC_ADMIN_TOOLS_ENABLED";
  allowedEnvName: "NEXT_PUBLIC_ADMIN_TOOLS_ENV";
  activeEnvironment: string;
  reasons: string[];
  nextStep: string;
};

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function getClientAdminEnvironmentGate(): AdminEnvironmentGateSnapshot {
  const enabled = normalize(process.env.NEXT_PUBLIC_ADMIN_TOOLS_ENABLED);
  const activeEnvironment = normalize(process.env.NEXT_PUBLIC_ADMIN_TOOLS_ENV) || "unset";
  const isUnlocked = enabled === "true" && ["local", "staging", "ops"].includes(activeEnvironment);

  if (isUnlocked) {
    return {
      status: activeEnvironment === "local" ? "preview" : "enabled",
      isUnlocked: true,
      sourceMode: "public_env_only",
      envFlagName: "NEXT_PUBLIC_ADMIN_TOOLS_ENABLED",
      allowedEnvName: "NEXT_PUBLIC_ADMIN_TOOLS_ENV",
      activeEnvironment,
      reasons: ["public admin tools flag is enabled", "active environment is allowlisted", "locked UI can reveal operator tools"],
      nextStep: "Replace this public-env preview gate with real server auth, role checks and audit storage before production.",
    };
  }

  const reasons = [];
  if (enabled !== "true") reasons.push("NEXT_PUBLIC_ADMIN_TOOLS_ENABLED is not true");
  if (!["local", "staging", "ops"].includes(activeEnvironment)) reasons.push("NEXT_PUBLIC_ADMIN_TOOLS_ENV is not allowlisted");
  if (reasons.length === 0) reasons.push("admin tooling remains locked until server auth exists");

  return {
    status: "locked",
    isUnlocked: false,
    sourceMode: "public_env_only",
    envFlagName: "NEXT_PUBLIC_ADMIN_TOOLS_ENABLED",
    allowedEnvName: "NEXT_PUBLIC_ADMIN_TOOLS_ENV",
    activeEnvironment,
    reasons,
    nextStep: "Keep import and publish controls hidden. Wire server auth, admin role, environment kill switch and import audit before launch.",
  };
}

export function getAdminEnvironmentGateLaunchNote() {
  return "Client env gate is only a locked-surface UX guard. Production still needs server-side auth, role checks, environment kill switch and audit persistence.";
}
