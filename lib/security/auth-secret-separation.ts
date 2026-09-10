import { Buffer } from "node:buffer";

export const PASS36_A89_AUTH_SECRET_SEPARATION_ID = "velmere.pass36.a89.auth-secret-separation.v1" as const;
const MIN_BYTES = 32;

type SecretRow = {
  id: string;
  env: string;
  value: string;
  requiredFor: readonly string[];
};

function read(env: NodeJS.ProcessEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function inspectAuthSecretSeparation(env: NodeJS.ProcessEnv = process.env) {
  const productionLike = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const rows: SecretRow[] = [
    { id: "account_session", env: "VELMERE_ACCOUNT_SESSION_SECRET_CURRENT", value: read(env, "VELMERE_ACCOUNT_SESSION_SECRET_CURRENT", "VELMERE_ACCOUNT_SESSION_SECRET"), requiredFor: ["account_cookie"] },
    { id: "session_family", env: "VELMERE_AUTH_SESSION_FAMILY_SECRET_CURRENT", value: read(env, "VELMERE_AUTH_SESSION_FAMILY_SECRET_CURRENT", "VELMERE_AUTH_SESSION_FAMILY_SECRET"), requiredFor: ["session_rotation", "cross_device_revocation"] },
    { id: "auth_flow", env: "VELMERE_AUTH_FLOW_SECRET_CURRENT", value: read(env, "VELMERE_AUTH_FLOW_SECRET_CURRENT", "VELMERE_AUTH_FLOW_SECRET"), requiredFor: ["oauth", "email_change", "recovery_flow"] },
    { id: "password_recovery_grant", env: "VELMERE_PASSWORD_RECOVERY_GRANT_SECRET_CURRENT", value: read(env, "VELMERE_PASSWORD_RECOVERY_GRANT_SECRET_CURRENT"), requiredFor: ["password_update"] },
    { id: "trusted_account_header", env: "VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_CURRENT", value: read(env, "VELMERE_TRUSTED_ACCOUNT_HEADER_HMAC_SECRET_CURRENT"), requiredFor: ["server_to_server_account_identity"] },
    { id: "privacy_fingerprint", env: "VELMERE_SECURITY_FINGERPRINT_SECRET", value: read(env, "VELMERE_SECURITY_FINGERPRINT_SECRET"), requiredFor: ["stable_private_fingerprints"] },
  ];
  const inspected = rows.map((row) => ({
    id: row.id,
    env: row.env,
    configured: Boolean(row.value),
    byteLength: Buffer.byteLength(row.value, "utf8"),
    strong: Buffer.byteLength(row.value, "utf8") >= MIN_BYTES,
    requiredFor: row.requiredFor,
  }));
  const reusedPairs: Array<{ left: string; right: string }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[i]?.value && rows[i]?.value === rows[j]?.value) reusedPairs.push({ left: rows[i]!.id, right: rows[j]!.id });
    }
  }
  const core = inspected.filter((row) => ["account_session", "session_family", "auth_flow", "password_recovery_grant"].includes(row.id));
  const oauthReady = core.filter((row) => row.id !== "password_recovery_grant").every((row) => row.strong) && !reusedPairs.some((pair) => pair.left !== "password_recovery_grant" && pair.right !== "password_recovery_grant");
  const recoveryReady = core.every((row) => row.strong) && reusedPairs.length === 0;
  const fullProductionReady = inspected.every((row) => row.strong) && reusedPairs.length === 0;
  return {
    schemaVersion: PASS36_A89_AUTH_SECRET_SEPARATION_ID,
    productionLike,
    minimumBytes: MIN_BYTES,
    rows: inspected,
    reusedPairs,
    accountSessionReady: inspected.find((row) => row.id === "account_session")?.strong === true,
    oauthReady,
    recoveryReady,
    fullProductionReady,
    failClosedRequired: productionLike,
    boundary: "Production auth keys are purpose-separated. A key reused across account sessions, flow state, session families, recovery grants, trusted headers or privacy fingerprints is not production-ready.",
  } as const;
}
