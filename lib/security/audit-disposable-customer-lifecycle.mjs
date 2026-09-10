import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const R44P23_DISPOSABLE_CUSTOMER_LIFECYCLE_ID =
  "r44p23-disposable-customer-lifecycle-v1";

const SAFE_ID = /^[A-Za-z0-9._:@-]{1,120}$/u;
const SAFE_KEY = /^[A-Za-z0-9._:-]{8,160}$/u;
const TOKEN_TTL_MAX_MS = 15 * 60_000;
const SESSION_TTL_MAX_MS = 24 * 60 * 60_000;
const DOWNLOAD_DOMAIN = "velmere:r44p23:download:v1:";
const WEBHOOK_DOMAIN = "velmere:r44p23:webhook:v1:";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64url(value) {
  return Buffer.from(value, "base64url");
}

function timingSafeHex(left, right) {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function requireId(value, label) {
  const normalized = String(value ?? "").trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function requireKey(value, label) {
  const normalized = String(value ?? "").trim();
  if (!SAFE_KEY.test(normalized)) throw new Error(`${label}_invalid`);
  return normalized;
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
}

function fsyncDirectory(directory) {
  if (process.platform === "win32") return;
  try {
    const fd = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if (error && (error.code === "EPERM" || error.code === "EINVAL" || error.code === "EBADF")) return;
    throw error;
  }
}

function atomicWrite(file, data, options = {}) {
  ensurePrivateDirectory(path.dirname(file));
  const temp = `${file}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  const fd = fs.openSync(temp, options.exclusive ? "wx" : "w", 0o600);
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(temp, 0o600);
  if (options.exclusive && fs.existsSync(file)) {
    fs.unlinkSync(temp);
    throw new Error("record_exists");
  }
  fs.renameSync(temp, file);
  fsyncDirectory(path.dirname(file));
}

function atomicWriteJson(file, value, options = {}) {
  atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`, options);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(lockPath, callback, timeoutMs = 5_000) {
  ensurePrivateDirectory(path.dirname(lockPath));
  const started = Date.now();
  let fd = null;
  while (fd === null) {
    try {
      fd = fs.openSync(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() - started > timeoutMs) throw new Error("lock_timeout", { cause: error });
      sleepSync(10);
    }
  }
  try {
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.fsyncSync(fd);
    return callback();
  } finally {
    fs.closeSync(fd);
    fs.rmSync(lockPath, { force: true });
    fsyncDirectory(path.dirname(lockPath));
  }
}

function makePdf(text) {
  const escaped = String(text).replace(/\\/gu, "\\\\").replace(/\(/gu, "\\(").replace(/\)/gu, "\\)");
  const stream = `BT /F1 11 Tf 48 760 Td (${escaped}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output));
    output += object;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "binary");
}

function parseToken(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2 || !parts.every(Boolean)) return null;
  try {
    const payload = JSON.parse(fromBase64url(parts[0]).toString("utf8"));
    return { encoded: parts[0], signature: parts[1], payload };
  } catch {
    return null;
  }
}

function errorResult(status, error, extra = {}) {
  return { ok: false, status, error, ...extra };
}

export class DisposableAuditLifecycleStore {
  constructor({ root, downloadSecret, webhookSecret, now = () => Date.now() }) {
    this.root = path.resolve(root);
    this.downloadSecret = String(downloadSecret ?? "");
    this.webhookSecret = String(webhookSecret ?? "");
    this.now = now;
    if (this.downloadSecret.length < 32 || this.webhookSecret.length < 32) {
      throw new Error("strong_test_secrets_required");
    }
    ensurePrivateDirectory(this.root);
    for (const name of [
      "accounts", "sessions", "jobs", "entitlements", "tokens", "webhooks",
      "idempotency/intake", "private-artifacts", "ledger/events", "locks", "tombstones",
    ]) ensurePrivateDirectory(path.join(this.root, name));
    const headPath = path.join(this.root, "ledger/head.json");
    if (!fs.existsSync(headPath)) {
      atomicWriteJson(headPath, { sequence: 0, hash: "0".repeat(64) }, { exclusive: true });
    }
  }

  accountPath(accountId) {
    return path.join(this.root, "accounts", `${sha256(accountId)}.json`);
  }

  sessionPath(token) {
    return path.join(this.root, "sessions", `${sha256(token)}.json`);
  }

  jobPath(jobId) {
    return path.join(this.root, "jobs", `${requireId(jobId, "job_id")}.json`);
  }

  entitlementPath(entitlementId) {
    return path.join(this.root, "entitlements", `${requireId(entitlementId, "entitlement_id")}.json`);
  }

  tokenPath(token) {
    return path.join(this.root, "tokens", `${sha256(token)}.json`);
  }

  artifactDirectory(accountId, jobId) {
    return path.join(this.root, "private-artifacts", sha256(accountId), requireId(jobId, "job_id"));
  }

  appendEvent(type, data) {
    const eventType = requireId(type, "event_type");
    return withLock(path.join(this.root, "locks/ledger.lock"), () => {
      const headPath = path.join(this.root, "ledger/head.json");
      const head = readJson(headPath);
      const sequence = Number(head.sequence) + 1;
      const safeData = canonicalize(data);
      const body = {
        schemaVersion: "velmere.pass36.a102r44p23.lifecycle-event.v1",
        sequence,
        previousHash: head.hash,
        type: eventType,
        occurredAt: new Date(this.now()).toISOString(),
        data: safeData,
      };
      const eventHash = sha256(canonicalJson(body));
      const event = { ...body, eventHash };
      const eventPath = path.join(this.root, "ledger/events", `${String(sequence).padStart(8, "0")}-${eventHash}.json`);
      atomicWriteJson(eventPath, event, { exclusive: true });
      atomicWriteJson(headPath, { sequence, hash: eventHash });
      return event;
    });
  }

  createAccount(accountId) {
    const id = requireId(accountId, "account_id");
    const file = this.accountPath(id);
    if (fs.existsSync(file)) return readJson(file);
    const record = {
      schemaVersion: "velmere.pass36.a102r44p23.account.v1",
      accountId: id,
      accountHash: sha256(id),
      state: "ACTIVE",
      createdAt: new Date(this.now()).toISOString(),
      deletedAt: null,
    };
    atomicWriteJson(file, record, { exclusive: true });
    this.appendEvent("ACCOUNT_CREATED", { accountHash: record.accountHash });
    return record;
  }

  createSession({ accountId, ttlMs = 30 * 60_000 }) {
    const account = this.createAccount(accountId);
    if (account.state !== "ACTIVE") throw new Error("account_not_active");
    const boundedTtl = Math.max(1_000, Math.min(Number(ttlMs), SESSION_TTL_MAX_MS));
    const token = crypto.randomBytes(32).toString("base64url");
    const record = {
      schemaVersion: "velmere.pass36.a102r44p23.session.v1",
      tokenHash: sha256(token),
      accountId: account.accountId,
      accountHash: account.accountHash,
      issuedAtMs: this.now(),
      expiresAtMs: this.now() + boundedTtl,
      state: "ACTIVE",
    };
    atomicWriteJson(this.sessionPath(token), record, { exclusive: true });
    this.appendEvent("SESSION_CREATED", { accountHash: account.accountHash, sessionHash: record.tokenHash, expiresAtMs: record.expiresAtMs });
    return { token, record };
  }

  authenticate(sessionToken) {
    const token = String(sessionToken ?? "");
    if (token.length < 16) return errorResult(401, "UNAUTHENTICATED");
    const file = this.sessionPath(token);
    if (!fs.existsSync(file)) return errorResult(401, "UNAUTHENTICATED");
    const session = readJson(file);
    if (session.state !== "ACTIVE") return errorResult(401, "SESSION_REVOKED");
    if (this.now() >= Number(session.expiresAtMs)) return errorResult(401, "SESSION_EXPIRED");
    const accountFile = this.accountPath(session.accountId);
    if (!fs.existsSync(accountFile)) return errorResult(401, "UNAUTHENTICATED");
    const account = readJson(accountFile);
    if (account.state !== "ACTIVE") return errorResult(401, "SESSION_REVOKED");
    return { ok: true, status: 200, session, account };
  }

  createIntake({ sessionToken, idempotencyKey, tier, source, simulateInterruptOnce = false }) {
    const auth = this.authenticate(sessionToken);
    if (!auth.ok) return auth;
    const normalizedTier = String(tier ?? "").toLowerCase();
    if (!new Set(["basic", "pro", "advanced"]).has(normalizedTier)) return errorResult(400, "TIER_INVALID");
    if (normalizedTier === "advanced") return errorResult(409, "ADVANCED_NOT_FOR_SALE");
    const key = requireKey(idempotencyKey, "idempotency_key");
    const rawSource = String(source ?? "");
    const sourceBytes = Buffer.byteLength(rawSource);
    if (sourceBytes < 1 || sourceBytes > 64 * 1024) return errorResult(413, "SOURCE_SIZE_INVALID");
    const payloadDigest = sha256(canonicalJson({ tier: normalizedTier, sourceSha256: sha256(rawSource), simulateInterruptOnce: Boolean(simulateInterruptOnce) }));
    const idemPath = path.join(this.root, "idempotency/intake", `${sha256(`${auth.account.accountId}:${key}`)}.json`);
    return withLock(path.join(this.root, "locks/intake.lock"), () => {
      if (fs.existsSync(idemPath)) {
        const existing = readJson(idemPath);
        if (existing.payloadDigest !== payloadDigest) return errorResult(409, "IDEMPOTENCY_CONFLICT");
        return { ok: true, status: 200, idempotentReplay: true, job: readJson(this.jobPath(existing.jobId)) };
      }
      const jobId = `job_${crypto.randomBytes(16).toString("hex")}`;
      const entitlementId = normalizedTier === "pro" ? `ent_${crypto.randomBytes(16).toString("hex")}` : null;
      const job = {
        schemaVersion: "velmere.pass36.a102r44p23.job.v1",
        jobId,
        accountId: auth.account.accountId,
        accountHash: auth.account.accountHash,
        tier: normalizedTier,
        source: rawSource,
        sourceSha256: sha256(rawSource),
        state: "QUEUED",
        attempts: 0,
        simulateInterruptOnce: Boolean(simulateInterruptOnce),
        entitlementId,
        expectedPayment: normalizedTier === "pro" ? { amountMinor: 4900, currency: "EUR" } : null,
        reportVersion: 1,
        createdAt: new Date(this.now()).toISOString(),
        updatedAt: new Date(this.now()).toISOString(),
      };
      atomicWriteJson(this.jobPath(jobId), job, { exclusive: true });
      if (entitlementId) {
        atomicWriteJson(this.entitlementPath(entitlementId), {
          schemaVersion: "velmere.pass36.a102r44p23.entitlement.v1",
          entitlementId,
          accountId: auth.account.accountId,
          accountHash: auth.account.accountHash,
          jobId,
          tier: normalizedTier,
          status: "PENDING_PAYMENT",
          revision: 1,
          updatedAt: new Date(this.now()).toISOString(),
        }, { exclusive: true });
      }
      atomicWriteJson(idemPath, { accountHash: auth.account.accountHash, payloadDigest, jobId }, { exclusive: true });
      this.appendEvent("AUDIT_INTAKE_CREATED", { accountHash: auth.account.accountHash, jobId, tier: normalizedTier, sourceSha256: job.sourceSha256, entitlementHash: entitlementId ? sha256(entitlementId) : null });
      return { ok: true, status: 202, idempotentReplay: false, job };
    });
  }

  readOwnedJob(sessionToken, jobId) {
    const auth = this.authenticate(sessionToken);
    if (!auth.ok) return auth;
    let file;
    try { file = this.jobPath(jobId); } catch { return errorResult(400, "JOB_ID_INVALID"); }
    if (!fs.existsSync(file)) return errorResult(404, "JOB_NOT_FOUND");
    const job = readJson(file);
    if (job.accountId !== auth.account.accountId) return errorResult(403, "WRONG_ACCOUNT");
    return { ok: true, status: 200, auth, job };
  }

  signWebhook(rawBody) {
    return `sha256=${hmac(this.webhookSecret, `${WEBHOOK_DOMAIN}${rawBody}`)}`;
  }

  processWebhook(rawBody, suppliedSignature) {
    const raw = String(rawBody ?? "");
    const expected = hmac(this.webhookSecret, `${WEBHOOK_DOMAIN}${raw}`);
    const supplied = String(suppliedSignature ?? "").replace(/^sha256=/u, "");
    if (!timingSafeHex(expected, supplied)) return errorResult(401, "WEBHOOK_SIGNATURE_INVALID");
    let event;
    try { event = JSON.parse(raw); } catch { return errorResult(400, "WEBHOOK_JSON_INVALID"); }
    const allowedKeys = new Set(["eventId", "type", "jobId", "accountId", "amountMinor", "currency"]);
    if (Object.keys(event).some((key) => !allowedKeys.has(key))) return errorResult(400, "WEBHOOK_FIELDS_INVALID");
    let eventId;
    let jobId;
    let accountId;
    try {
      eventId = requireId(event.eventId, "event_id");
      jobId = requireId(event.jobId, "job_id");
      accountId = requireId(event.accountId, "account_id");
    } catch {
      return errorResult(400, "WEBHOOK_IDENTIFIER_INVALID");
    }
    const type = String(event.type ?? "");
    if (!new Set(["payment_succeeded", "refund_succeeded", "chargeback_created"]).has(type)) return errorResult(400, "WEBHOOK_TYPE_INVALID");
    const eventDigest = sha256(raw);
    const eventPath = path.join(this.root, "webhooks", `${eventId}.json`);
    return withLock(path.join(this.root, "locks/webhook.lock"), () => {
      if (fs.existsSync(eventPath)) {
        const existing = readJson(eventPath);
        if (existing.eventDigest !== eventDigest) return errorResult(409, "WEBHOOK_IDEMPOTENCY_CONFLICT");
        return { ok: true, status: 200, idempotentReplay: true, entitlement: readJson(this.entitlementPath(existing.entitlementId)) };
      }
      const jobFile = this.jobPath(jobId);
      if (!fs.existsSync(jobFile)) return errorResult(404, "JOB_NOT_FOUND");
      const job = readJson(jobFile);
      if (job.accountId !== accountId || !job.entitlementId) return errorResult(409, "WEBHOOK_BINDING_INVALID");
      const entitlementFile = this.entitlementPath(job.entitlementId);
      const entitlement = readJson(entitlementFile);
      if (type === "payment_succeeded") {
        const expectedAmount = Number(job.expectedPayment?.amountMinor);
        const expectedCurrency = String(job.expectedPayment?.currency ?? "");
        if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor !== expectedAmount || event.currency !== expectedCurrency) {
          return errorResult(409, "PAYMENT_AMOUNT_BINDING_INVALID");
        }
        if (entitlement.status === "REFUNDED" || entitlement.status === "REVOKED_CHARGEBACK" || entitlement.status === "REVOKED_ACCOUNT_DELETED") {
          return errorResult(409, "TERMINAL_ENTITLEMENT_CANNOT_REACTIVATE");
        }
      } else if (entitlement.status !== "ACTIVE") {
        return errorResult(409, "REVERSAL_REQUIRES_ACTIVE_ENTITLEMENT");
      }
      const nextStatus = type === "payment_succeeded" ? "ACTIVE" : type === "refund_succeeded" ? "REFUNDED" : "REVOKED_CHARGEBACK";
      const stateChanged = entitlement.status !== nextStatus;
      const next = {
        ...entitlement,
        status: nextStatus,
        revision: stateChanged ? Number(entitlement.revision) + 1 : Number(entitlement.revision),
        updatedAt: new Date(this.now()).toISOString(),
        sourceEventId: eventId,
      };
      atomicWriteJson(entitlementFile, next);
      if (type !== "payment_succeeded") this.revokeJobTokens(jobId, nextStatus);
      atomicWriteJson(eventPath, { eventId, eventDigest, entitlementId: job.entitlementId, type, processedAt: new Date(this.now()).toISOString() }, { exclusive: true });
      this.appendEvent("PAYMENT_WEBHOOK_APPLIED", { accountHash: job.accountHash, jobId, eventIdHash: sha256(eventId), type, entitlementHash: sha256(job.entitlementId), nextStatus, revision: next.revision });
      return { ok: true, status: 200, idempotentReplay: false, entitlement: next };
    });
  }

  entitlementAllows(job) {
    if (job.tier === "basic") return { ok: true, revision: 0 };
    if (job.tier !== "pro" || !job.entitlementId) return errorResult(403, "TIER_NOT_DELIVERABLE");
    const entitlement = readJson(this.entitlementPath(job.entitlementId));
    if (entitlement.status !== "ACTIVE") return errorResult(403, "ENTITLEMENT_NOT_ACTIVE", { entitlementStatus: entitlement.status });
    return { ok: true, revision: Number(entitlement.revision), entitlement };
  }

  issueDownloadToken({ sessionToken, jobId, ttlMs = 60_000 }) {
    const owned = this.readOwnedJob(sessionToken, jobId);
    if (!owned.ok) return owned;
    const { job, auth } = owned;
    if (job.state !== "COMPLETED") return errorResult(409, "REPORT_NOT_READY");
    const access = this.entitlementAllows(job);
    if (!access.ok) return access;
    const boundedTtl = Math.max(1_000, Math.min(Number(ttlMs), TOKEN_TTL_MAX_MS));
    const payload = {
      v: 1,
      jti: crypto.randomBytes(16).toString("hex"),
      accountHash: auth.account.accountHash,
      jobId: job.jobId,
      tier: job.tier,
      reportVersion: job.reportVersion,
      entitlementRevision: access.revision,
      issuedAtMs: this.now(),
      expiresAtMs: this.now() + boundedTtl,
    };
    const encoded = base64url(canonicalJson(payload));
    const signature = hmac(this.downloadSecret, `${DOWNLOAD_DOMAIN}${encoded}`);
    const token = `${encoded}.${signature}`;
    atomicWriteJson(this.tokenPath(token), {
      schemaVersion: "velmere.pass36.a102r44p23.download-token-record.v1",
      tokenHash: sha256(token),
      payload,
      state: "ISSUED",
      issuedAt: new Date(this.now()).toISOString(),
      consumedAt: null,
      revokedReason: null,
    }, { exclusive: true });
    this.appendEvent("DOWNLOAD_TOKEN_ISSUED", { accountHash: payload.accountHash, jobId: payload.jobId, tokenHash: sha256(token), expiresAtMs: payload.expiresAtMs, entitlementRevision: payload.entitlementRevision });
    return { ok: true, status: 201, token, expiresAtMs: payload.expiresAtMs };
  }

  verifyTokenSignature(token) {
    const parsed = parseToken(token);
    if (!parsed) return errorResult(400, "TOKEN_INVALID");
    const expected = hmac(this.downloadSecret, `${DOWNLOAD_DOMAIN}${parsed.encoded}`);
    if (!timingSafeHex(expected, parsed.signature)) return errorResult(403, "TOKEN_SIGNATURE_INVALID");
    return { ok: true, parsed };
  }

  consumeDownload({ sessionToken, token }) {
    const auth = this.authenticate(sessionToken);
    if (!auth.ok) return auth;
    const signature = this.verifyTokenSignature(token);
    if (!signature.ok) return signature;
    const { payload } = signature.parsed;
    if (payload.accountHash !== auth.account.accountHash) return errorResult(403, "WRONG_ACCOUNT");
    const tokenFile = this.tokenPath(token);
    if (!fs.existsSync(tokenFile)) return errorResult(404, "TOKEN_NOT_FOUND");
    return withLock(path.join(this.root, "locks/token-consume.lock"), () => {
      const record = readJson(tokenFile);
      if (record.state === "CONSUMED") return errorResult(409, "TOKEN_REPLAYED");
      if (record.state === "REVOKED") return errorResult(410, "TOKEN_REVOKED", { reason: record.revokedReason });
      if (this.now() >= Number(payload.expiresAtMs)) return errorResult(410, "TOKEN_EXPIRED");
      const owned = this.readOwnedJob(sessionToken, payload.jobId);
      if (!owned.ok) return owned;
      const { job } = owned;
      if (job.tier !== payload.tier || Number(job.reportVersion) !== Number(payload.reportVersion)) return errorResult(409, "TOKEN_REPORT_BINDING_MISMATCH");
      const access = this.entitlementAllows(job);
      if (!access.ok) return access;
      if (Number(access.revision) !== Number(payload.entitlementRevision)) return errorResult(410, "TOKEN_ENTITLEMENT_REVISION_STALE");
      if (!job.pdfPath || !fs.existsSync(job.pdfPath)) return errorResult(404, "ARTIFACT_MISSING");
      const bytes = fs.readFileSync(job.pdfPath);
      if (sha256(bytes) !== job.pdfSha256) return errorResult(409, "ARTIFACT_TAMPERED");
      const consumed = { ...record, state: "CONSUMED", consumedAt: new Date(this.now()).toISOString() };
      atomicWriteJson(tokenFile, consumed);
      this.appendEvent("DOWNLOAD_TOKEN_CONSUMED", { accountHash: payload.accountHash, jobId: payload.jobId, tokenHash: sha256(token), artifactSha256: job.pdfSha256 });
      return { ok: true, status: 200, bytes, digest: job.pdfSha256, contentType: "application/pdf" };
    });
  }

  revokeJobTokens(jobId, reason) {
    for (const file of fs.readdirSync(path.join(this.root, "tokens"))) {
      if (!file.endsWith(".json")) continue;
      const full = path.join(this.root, "tokens", file);
      const record = readJson(full);
      if (record.payload?.jobId !== jobId || record.state !== "ISSUED") continue;
      atomicWriteJson(full, { ...record, state: "REVOKED", revokedReason: String(reason), revokedAt: new Date(this.now()).toISOString() });
    }
  }

  deleteAccount({ sessionToken, idempotencyKey }) {
    const auth = this.authenticate(sessionToken);
    if (!auth.ok) return auth;
    const key = requireKey(idempotencyKey, "delete_idempotency_key");
    const receiptPath = path.join(this.root, "tombstones", `${sha256(`${auth.account.accountId}:${key}`)}.json`);
    return withLock(path.join(this.root, "locks/delete-account.lock"), () => {
      if (fs.existsSync(receiptPath)) return { ok: true, status: 200, idempotentReplay: true, receipt: readJson(receiptPath) };
      const accountFile = this.accountPath(auth.account.accountId);
      const account = readJson(accountFile);
      const deletedAt = new Date(this.now()).toISOString();
      atomicWriteJson(accountFile, {
        schemaVersion: account.schemaVersion,
        accountId: null,
        accountHash: account.accountHash,
        state: "DELETED",
        createdAt: account.createdAt,
        deletedAt,
      });
      for (const file of fs.readdirSync(path.join(this.root, "sessions"))) {
        const full = path.join(this.root, "sessions", file);
        const session = readJson(full);
        if (session.accountId === auth.account.accountId) atomicWriteJson(full, { ...session, accountId: null, state: "REVOKED_ACCOUNT_DELETED" });
      }
      for (const file of fs.readdirSync(path.join(this.root, "entitlements"))) {
        const full = path.join(this.root, "entitlements", file);
        const entitlement = readJson(full);
        if (entitlement.accountId === auth.account.accountId) atomicWriteJson(full, { ...entitlement, accountId: null, status: "REVOKED_ACCOUNT_DELETED", revision: Number(entitlement.revision) + 1, updatedAt: deletedAt });
      }
      for (const file of fs.readdirSync(path.join(this.root, "tokens"))) {
        const full = path.join(this.root, "tokens", file);
        const token = readJson(full);
        if (token.payload?.accountHash === auth.account.accountHash) atomicWriteJson(full, { ...token, state: "REVOKED", revokedReason: "ACCOUNT_DELETED", revokedAt: deletedAt });
      }
      const artifactRoot = path.join(this.root, "private-artifacts", auth.account.accountHash);
      fs.rmSync(artifactRoot, { recursive: true, force: true });
      for (const file of fs.readdirSync(path.join(this.root, "jobs"))) {
        const full = path.join(this.root, "jobs", file);
        const job = readJson(full);
        if (job.accountId === auth.account.accountId) fs.rmSync(full, { force: true });
      }
      const receipt = { schemaVersion: "velmere.pass36.a102r44p23.account-deletion-receipt.v1", accountHash: auth.account.accountHash, deletedAt, artifactsPurged: !fs.existsSync(artifactRoot), jobsPurged: true };
      atomicWriteJson(receiptPath, receipt, { exclusive: true });
      this.appendEvent("ACCOUNT_DELETED", { accountHash: auth.account.accountHash, artifactsPurged: true, jobsPurged: true });
      return { ok: true, status: 200, idempotentReplay: false, receipt };
    });
  }

  verifyLedger() {
    const files = fs.readdirSync(path.join(this.root, "ledger/events")).filter((name) => name.endsWith(".json")).sort();
    let previous = "0".repeat(64);
    let sequence = 0;
    for (const file of files) {
      const event = readJson(path.join(this.root, "ledger/events", file));
      const { eventHash, ...body } = event;
      sequence += 1;
      if (event.sequence !== sequence || event.previousHash !== previous || sha256(canonicalJson(body)) !== eventHash) {
        return { ok: false, sequence, file };
      }
      previous = eventHash;
    }
    const head = readJson(path.join(this.root, "ledger/head.json"));
    return { ok: head.sequence === sequence && head.hash === previous, sequence, hash: previous };
  }

  scanForRawSensitive(values) {
    const needles = values.map((value) => String(value)).filter((value) => value.length >= 8);
    const hits = [];
    for (const directory of ["ledger", "webhooks", "tombstones"]) {
      const root = path.join(this.root, directory);
      for (const file of walkFiles(root)) {
        const text = fs.readFileSync(file, "utf8");
        for (const needle of needles) if (text.includes(needle)) hits.push({ file: path.relative(this.root, file), needleHash: sha256(needle) });
      }
    }
    return hits;
  }
}

function walkFiles(directory) {
  const rows = [];
  if (!fs.existsSync(directory)) return rows;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...walkFiles(full));
    else if (entry.isFile()) rows.push(full);
  }
  return rows;
}

export function runDisposableAuditWorker({ root, jobId, now = () => Date.now() }) {
  const resolvedRoot = path.resolve(root);
  const jobFile = path.join(resolvedRoot, "jobs", `${requireId(jobId, "job_id")}.json`);
  if (!fs.existsSync(jobFile)) return { ok: false, exitCode: 66, error: "JOB_NOT_FOUND" };
  return withLock(path.join(resolvedRoot, "locks", `${jobId}.worker.lock`), () => {
    const job = readJson(jobFile);
    if (job.state === "COMPLETED") return { ok: true, exitCode: 0, idempotentReplay: true, job };
    const attempts = Number(job.attempts ?? 0) + 1;
    if (job.simulateInterruptOnce && attempts === 1) {
      const interrupted = { ...job, attempts, state: "INTERRUPTED_RETRYABLE", updatedAt: new Date(now()).toISOString() };
      atomicWriteJson(jobFile, interrupted);
      return { ok: false, exitCode: 75, error: "INTERRUPTED_RETRYABLE", job: interrupted };
    }
    const artifactDir = path.join(resolvedRoot, "private-artifacts", job.accountHash, job.jobId);
    ensurePrivateDirectory(artifactDir);
    const packet = {
      schemaVersion: "velmere.pass36.a102r44p23.local-runtime-packet.v1",
      jobId: job.jobId,
      accountHash: job.accountHash,
      tier: job.tier,
      sourceSha256: job.sourceSha256,
      findingConfidence: "NOT_CALIBRATED",
      evidenceCompleteness: "LOCAL_DISPOSABLE_RUNTIME_ONLY",
      reviewStatus: job.tier === "pro" ? "MANUAL_QA_REQUIRED_BEFORE_CUSTOMER_DELIVERY" : "AUTOMATED_UNREVIEWED",
      adjudicationStatus: "NOT_PERFORMED",
      customerCredit: false,
      stagingCredit: false,
      liveCredit: false,
      saleCredit: false,
    };
    const packetBytes = Buffer.from(`${JSON.stringify(packet, null, 2)}\n`);
    const packetPath = path.join(artifactDir, "packet.json");
    atomicWrite(packetPath, packetBytes);
    const pdfBytes = makePdf(`Velmere ${job.tier.toUpperCase()} local disposable lifecycle report ${job.jobId} - NOT CALIBRATED`);
    const pdfPath = path.join(artifactDir, "report.pdf");
    atomicWrite(pdfPath, pdfBytes);
    const completed = {
      ...job,
      attempts,
      state: "COMPLETED",
      packetPath,
      packetSha256: sha256(packetBytes),
      pdfPath,
      pdfSha256: sha256(pdfBytes),
      completedAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
    };
    atomicWriteJson(jobFile, completed);
    return { ok: true, exitCode: 0, idempotentReplay: false, job: completed };
  });
}
