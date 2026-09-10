/**
 * Velmère Security Engine — Input Sanitizer & Defensive Boundary
 *
 * Implements strict defense-in-depth against:
 * - XSS & HTML injection in user-supplied contract metadata
 * - Path traversal in file generation and report exports
 * - Control character poisoning in log and database streams
 * - Multi-vector SSRF (decimal/hex/octal IPs, IPv6 mapped, cloud IMDS, internal subnets)
 */

const DANGEROUS_HTML_PATTERNS = /<[^>]*>|javascript:|data:|vbscript:/gi;
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f]/g;
const PATH_TRAVERSAL_PATTERNS = /(\.\.[/\\]|[/\\]\.\.|^\/|^\\)/;

export function sanitizeContractInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(DANGEROUS_HTML_PATTERNS, "")
    .replace(CONTROL_CHARACTERS, "")
    .trim()
    .slice(0, 256);
}

export function assertNoPathTraversal(value: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("path_traversal_detected: empty path");
  }
  if (PATH_TRAVERSAL_PATTERNS.test(value) || value.includes("..")) {
    throw new Error(`path_traversal_detected: ${value}`);
  }
}

export function isValidEthereumAddress(address: unknown): address is `0x${string}` {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Normalizes IPv4 address from standard dotted quad, octal, hex, or integer forms into uint32
 */
function parseIpv4ToUint32(host: string): number | null {
  const clean = host.replace(/^\[|\]$/g, "").trim().toLowerCase();

  // Single integer / hex integer representation (e.g. 2130706433 or 0x7f000001)
  if (/^(?:0x[0-9a-f]+|\d+)$/.test(clean)) {
    const val = clean.startsWith("0x") ? parseInt(clean, 16) : parseInt(clean, 10);
    if (!isNaN(val) && val >= 0 && val <= 0xffffffff) {
      return val >>> 0;
    }
  }

  const parts = clean.split(".");
  if (parts.length >= 1 && parts.length <= 4) {
    const nums: number[] = [];
    for (const p of parts) {
      if (/^0x[0-9a-f]+$/i.test(p)) {
        nums.push(parseInt(p, 16));
      } else if (/^0[0-7]+$/.test(p)) {
        nums.push(parseInt(p, 8));
      } else if (/^\d+$/.test(p)) {
        nums.push(parseInt(p, 10));
      } else {
        return null;
      }
    }
    if (nums.some((n) => isNaN(n) || n < 0)) return null;

    if (parts.length === 4) {
      if (nums.some((n) => n > 255)) return null;
      return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
    }
    if (parts.length === 1 && nums[0] <= 0xffffffff) {
      return nums[0] >>> 0;
    }
    if (parts.length === 2 && nums[0] <= 255 && nums[1] <= 0xffffff) {
      return (((nums[0] << 24) | nums[1]) >>> 0);
    }
    if (parts.length === 3 && nums[0] <= 255 && nums[1] <= 255 && nums[2] <= 0xffff) {
      return (((nums[0] << 24) | (nums[1] << 16) | nums[2]) >>> 0);
    }
  }
  return null;
}

/**
 * Validates if an IPv4 uint32 address is a private, loopback, link-local, or reserved address
 */
function isRestrictedIpv4(ip: number): boolean {
  const byte0 = (ip >>> 24) & 0xff;
  const byte1 = (ip >>> 16) & 0xff;

  // 0.0.0.0/8 (Current network)
  if (byte0 === 0) return true;
  // 10.0.0.0/8 (Private)
  if (byte0 === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (byte0 === 100 && (byte1 & 0xc0) === 64) return true;
  // 127.0.0.0/8 (Loopback)
  if (byte0 === 127) return true;
  // 169.254.0.0/16 (Link-Local / Cloud IMDS)
  if (byte0 === 169 && byte1 === 254) return true;
  // 172.16.0.0/12 (Private)
  if (byte0 === 172 && byte1 >= 16 && byte1 <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (byte0 === 192 && byte1 === 168) return true;
  // 192.0.0.0/24 (IETF assignments), 192.0.2.0/24 (TEST-NET-1)
  if (byte0 === 192 && byte1 === 0) return true;
  // 198.18.0.0/15 (Benchmark), 198.51.100.0/24 (TEST-NET-2)
  if (byte0 === 198 && (byte1 === 18 || byte1 === 19 || byte1 === 51)) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (byte0 === 203 && byte1 === 0) return true;
  // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved / Future use)
  if (byte0 >= 224) return true;

  return false;
}

/**
 * Comprehensive SSRF protection for RPC & external source fetchers
 */
export function isSafeRpcEndpoint(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    // 1. Protocol validation: strictly http or https
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    // 2. Reject credentials in URL (e.g. http://user:pass@legit.com@internal)
    if (parsed.username || parsed.password) return false;

    // Clean hostname
    let host = parsed.hostname.toLowerCase().trim();
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.slice(1, -1);
    }

    // 3. Domain blacklist
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host.endsWith(".home") ||
      host.endsWith(".corp") ||
      host.endsWith(".test") ||
      host.endsWith(".example") ||
      host.endsWith(".invalid") ||
      host === "metadata.google.internal" ||
      host === "instance-data"
    ) {
      return false;
    }

    // 4. Try IPv4 parsing (handles decimal, octal, hex representations)
    const ipv4Int = parseIpv4ToUint32(host);
    if (ipv4Int !== null) {
      if (isRestrictedIpv4(ipv4Int)) return false;
      return true;
    }

    // 5. IPv6 checks
    if (host.includes(":")) {
      // Loopback ::1 or ::
      if (host === "::1" || host === "::" || /^0*(:0*)+1$/.test(host)) return false;
      // IPv4-mapped IPv6: ::ffff:127.0.0.1 or normalized ::ffff:7f00:1
      if (host.startsWith("::ffff:") || host.startsWith("0:0:0:0:0:ffff:")) {
        const mappedPart = host.split("ffff:")[1];
        if (mappedPart) {
          if (mappedPart.includes(".")) {
            const mappedIpv4 = parseIpv4ToUint32(mappedPart);
            if (mappedIpv4 !== null && isRestrictedIpv4(mappedIpv4)) return false;
          } else if (mappedPart.includes(":")) {
            const hexParts = mappedPart.split(":");
            if (hexParts.length === 2) {
              const val = ((parseInt(hexParts[0], 16) << 16) | parseInt(hexParts[1], 16)) >>> 0;
              if (isRestrictedIpv4(val)) return false;
            }
          }
        }
      }
      // Link-local unicast: fe80::/10
      if (/^fe[89ab][0-9a-f]/i.test(host)) return false;
      // Unique Local Addresses (ULA) / Private IPv6: fc00::/7 (fc00:: - fdff::)
      if (/^f[cd][0-9a-f]{2}:/i.test(host)) return false;
      // Multicast: ff00::/8
      if (/^ff[0-9a-f]{2}:/i.test(host)) return false;
      // Documentation: 2001:db8::/32
      if (/^2001:0?db8:/i.test(host)) return false;
    }

    return true;
  } catch {
    return false;
  }
}
