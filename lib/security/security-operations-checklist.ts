export type SecurityChecklistStatus = "ready" | "partial" | "manual" | "blocked";
export type SecurityChecklistPhase = "vercel_env" | "waf_rules" | "runtime_qa" | "release_gate";

export type SecurityChecklistItem = {
  id: string;
  phase: SecurityChecklistPhase;
  status: SecurityChecklistStatus;
  progress: number;
  title: string;
  purpose: string;
  envKeys?: string[];
  vercelSteps: string[];
  validation: string[];
  blockerIfMissing: string;
};

export const securityChecklistItems: SecurityChecklistItem[] = [
  {
    id: "upstash-rate-limit-env",
    phase: "vercel_env",
    status: "partial",
    progress: 72,
    title: "Upstash Redis rate-limit env",
    purpose: "Enable distributed rate-limit decisions instead of memory fallback.",
    envKeys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    vercelSteps: [
      "Open Vercel Project → Settings → Environment Variables.",
      "Add Upstash REST URL and token for Production and Preview if needed.",
      "Redeploy and verify `/api/security/readiness` shows provider mode beyond memory fallback.",
    ],
    validation: ["node scripts/vercel-preflight.mjs", "GET /api/security/readiness"],
    blockerIfMissing: "Public API protection falls back to per-runtime memory limits.",
  },
  {
    id: "security-admin-gate-env",
    phase: "vercel_env",
    status: "partial",
    progress: 78,
    title: "Security admin gate env",
    purpose: "Keep security events, exports and console behind a server-side token gate.",
    envKeys: [
      "VELMERE_SECURITY_ADMIN_ENABLED",
      "VELMERE_SECURITY_ADMIN_TOKEN_SHA256",
      "VELMERE_SECURITY_ADMIN_CONSOLE_ENABLED",
      "VELMERE_SECURITY_ADMIN_SCOPES",
    ],
    vercelSteps: [
      "Generate a strong random admin token locally.",
      "Store only its SHA-256 hash in Vercel as `VELMERE_SECURITY_ADMIN_TOKEN_SHA256`.",
      "Keep console visibility disabled until browser QA is finished.",
      "Test API with `Authorization: Bearer <token>`.",
    ],
    validation: ["GET /api/security/events with token", "GET /api/security/export with token"],
    blockerIfMissing: "Security console remains locked and sensitive security APIs reject operator reads.",
  },
  {
    id: "security-event-append-env",
    phase: "vercel_env",
    status: "partial",
    progress: 66,
    title: "Security event append env",
    purpose: "Mirror redacted security events into durable Upstash list storage.",
    envKeys: ["VELMERE_SECURITY_EVENT_UPSTASH_KEY", "VELMERE_SECURITY_EVENT_UPSTASH_MAX", "VELMERE_SECURITY_EVENT_APPEND_TIMEOUT_MS"],
    vercelSteps: [
      "Choose a namespaced Upstash list key, e.g. `velmere:security:events:prod`.",
      "Set max retained entries and timeout.",
      "Trigger a safe test event and confirm append mode in `/api/security/readiness`.",
    ],
    validation: ["GET /api/security/event-store with token", "GET /api/security/admin-audit with token"],
    blockerIfMissing: "Security events remain preview/memory-only and can reset between runtime instances.",
  },
  {
    id: "waf-scanner-paths",
    phase: "waf_rules",
    status: "manual",
    progress: 58,
    title: "Block scanner paths at the edge",
    purpose: "Stop common scanner noise before it reaches Next.js routes.",
    vercelSteps: [
      "Open Vercel Firewall / WAF rules.",
      "Create block/challenge rule for paths containing `.env`, `wp-admin`, `phpmyadmin`, `etc/passwd`, `xmlrpc.php`, `/.git`.",
      "Add a log-only phase first if traffic is unknown.",
    ],
    validation: ["Check Vercel firewall logs", "Confirm app-level abuse shield events drop after rule"],
    blockerIfMissing: "Known scanner paths continue hitting app-level routes.",
  },
  {
    id: "waf-user-agent-rate",
    phase: "waf_rules",
    status: "manual",
    progress: 52,
    title: "Scanner user-agent and high-rate API rule",
    purpose: "Challenge or block scanner-like user agents and high-frequency API clients.",
    vercelSteps: [
      "Create rule for user agents containing sqlmap, nikto, nmap, masscan, wpscan, dirbuster, gobuster.",
      "Create stricter rate limits for `/api/market-integrity/*` and `/api/security/*`.",
      "Keep admin API allowlist/token flow documented.",
    ],
    validation: ["Vercel firewall logs", "GET /api/security/alerts with token"],
    blockerIfMissing: "App-level rate-limit handles abuse, but edge cost/noise remains higher.",
  },
  {
    id: "runtime-security-smoke",
    phase: "runtime_qa",
    status: "manual",
    progress: 61,
    title: "Runtime security smoke test",
    purpose: "Verify production security behavior after deploy.",
    vercelSteps: [
      "Open `/security` and verify public copy has no overclaim language.",
      "Open `/admin/security` without env and confirm locked state.",
      "Call `/api/security/events` without token and confirm 401/503.",
      "Call `/api/security/trust` and confirm safe public response.",
      "Trigger a harmless short-query search and confirm no UI break.",
    ],
    validation: ["node scripts/vercel-preflight.mjs", "npm run verify:shield-all", "manual Vercel browser QA"],
    blockerIfMissing: "Security layer is implemented but not proven on the deployed runtime.",
  },
  {
    id: "release-gate",
    phase: "release_gate",
    status: "blocked",
    progress: 48,
    title: "Security release gate",
    purpose: "Prevent public launch until key security operations are confirmed.",
    vercelSteps: [
      "Confirm Upstash env provider mode.",
      "Confirm admin gate token flow.",
      "Confirm WAF scanner rules.",
      "Confirm export contains no raw IP/query/secrets.",
      "Confirm payment/webhook review is scheduled separately.",
    ],
    validation: ["Security checklist signed off", "Browser QA signed off", "Webhook review signed off"],
    blockerIfMissing: "Do not publicly market launch readiness as complete.",
  },
];

export const wafRuleDrafts = [
  {
    id: "block-known-scanner-paths",
    action: "block_or_challenge",
    expression:
      "path contains `.env` OR `wp-admin` OR `phpmyadmin` OR `etc/passwd` OR `xmlrpc.php` OR `/.git`",
    rationale: "These paths are not part of Velmère and are common scanner probes.",
  },
  {
    id: "challenge-scanner-user-agents",
    action: "challenge",
    expression:
      "user-agent contains sqlmap OR nikto OR nmap OR masscan OR wpscan OR dirbuster OR gobuster OR python-requests OR curl OR wget",
    rationale: "Scanner/automation clients should not freely hit public API routes.",
  },
  {
    id: "rate-limit-public-api",
    action: "rate_limit",
    expression: "path starts with `/api/market-integrity/` OR `/api/security/`",
    rationale: "Public analysis/search/security endpoints must be protected from high-frequency abuse.",
  },
  {
    id: "protect-admin-routes",
    action: "challenge_or_admin_allowlist",
    expression: "path starts with `/admin` OR path contains `/api/security/export` OR `/api/security/events`",
    rationale: "Admin and security export surfaces should be behind both app-level auth and edge controls.",
  },
];

export function buildSecurityOperationsChecklistSnapshot() {
  const averageProgress = Math.round(securityChecklistItems.reduce((sum, item) => sum + item.progress, 0) / securityChecklistItems.length);
  const blocked = securityChecklistItems.filter((item) => item.status === "blocked").length;
  const manual = securityChecklistItems.filter((item) => item.status === "manual").length;

  return {
    schemaVersion: "velmere-security-operations-checklist-v1",
    mode: "vercel_env_waf_runtime_qa_checklist",
    generatedAt: new Date().toISOString(),
    averageProgress,
    blocked,
    manual,
    items: securityChecklistItems,
    wafRuleDrafts,
    productionBoundary:
      "Checklist is an operator guide. Vercel envs, WAF rules and runtime QA must be applied and verified in the Vercel dashboard before relying on them.",
  };
}
