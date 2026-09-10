/** Stable refresh-registration result shared with risk-types without importing the registry runtime. */
export type Pass4653RefreshRegistration = {
  schemaVersion: "pass4653_refresh_registration_v1";
  registered: boolean;
  durable: boolean;
  mode: "memory" | "supabase" | "not_configured";
  targetKey: string;
  nextRefreshAt: string;
  blockers: string[];
};
