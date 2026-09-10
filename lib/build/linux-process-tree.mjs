import fs from "node:fs";
import path from "node:path";

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readStatus(procRoot, pid) {
  const filePath = path.join(procRoot, String(pid), "status");
  const text = fs.readFileSync(filePath, "utf8");
  const fields = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    fields.set(line.slice(0, separator), line.slice(separator + 1).trim());
  }
  const rssMatch = fields.get("VmRSS")?.match(/^(\d+)\s+kB$/u);
  return {
    pid,
    ppid: positiveInteger(fields.get("PPid")) ?? 0,
    rssKb: rssMatch ? Number(rssMatch[1]) : 0,
    state: fields.get("State") ?? "unknown",
    threads: positiveInteger(fields.get("Threads")) ?? 0,
    command: fields.get("Name") ?? "unknown",
  };
}

function readChildren(procRoot, pid) {
  const filePath = path.join(procRoot, String(pid), "task", String(pid), "children");
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return [];
  }
  if (!text) return [];
  return text.split(/\s+/u).map(positiveInteger).filter((value) => value !== null);
}

export function linuxProcessTreeSnapshot(rootPid, { procRoot = "/proc", capturedAt = new Date().toISOString() } = {}) {
  const normalizedRootPid = positiveInteger(rootPid);
  if (normalizedRootPid === null) return null;
  const wanted = new Set();
  const stack = [normalizedRootPid];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (wanted.has(pid)) continue;
    wanted.add(pid);
    for (const childPid of readChildren(procRoot, pid)) {
      if (!wanted.has(childPid)) stack.push(childPid);
    }
  }
  const processes = [];
  for (const pid of wanted) {
    try {
      processes.push(readStatus(procRoot, pid));
    } catch {
      // A process may exit between tree discovery and status collection.
    }
  }
  if (processes.length === 0) return null;
  processes.sort((a, b) => b.rssKb - a.rssKb || a.pid - b.pid);
  return {
    capturedAt,
    samplingMethod: "linux-proc-children",
    processCount: processes.length,
    totalRssKb: processes.reduce((sum, row) => sum + row.rssKb, 0),
    totalCpuPercent: null,
    processes: processes.slice(0, 20),
  };
}

export function progressWatchdogState({
  previousBytes = 0,
  currentBytes = 0,
  previousProgressMs,
  nowMs,
  stallMs,
}) {
  const progressed = currentBytes !== previousBytes;
  const lastProgressMs = progressed ? nowMs : previousProgressMs;
  return {
    progressed,
    currentBytes,
    lastProgressMs,
    stalled: nowMs - lastProgressMs >= stallMs,
  };
}
