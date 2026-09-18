import { applyDurableRateLimit } from "../../lib/security/durable-rate-limit";

const [key, limitRaw, countRaw] = process.argv.slice(2);
const limit = Number(limitRaw);
const count = Number(countRaw);
if (!key || !Number.isInteger(limit) || !Number.isInteger(count)) throw new Error("usage: key limit count");
const rows = await Promise.all(Array.from({ length: count }, () => applyDurableRateLimit({
  namespace: "c14-multi-process",
  key,
  limit,
  windowMs: 60_000,
})));
process.stdout.write(JSON.stringify({
  allowed: rows.filter((row) => row.ok).length,
  denied: rows.filter((row) => !row.ok && row.reason === "rate_limit_exceeded").length,
  unavailable: rows.filter((row) => row.mode === "unavailable").length,
  boundaryKeys: [...new Set(rows.map((row) => row.boundaryKey))],
}));
