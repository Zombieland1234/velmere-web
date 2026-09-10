export const AUDIT_COMPILER_CANONICAL_PACKET_SCHEMA: "velmere.pass36.a102r44p39.audit-compiler-canonical-packet.v1";
export function buildAuditCompilerCanonicalPacket(input: { tier: "basic" | "pro" | "advanced"; caseRef: string; reviewLayer: Record<string, unknown>; deploymentBinding?: Record<string, unknown> | null; proxyBinding?: Record<string, unknown> | null; locale?: string }): Record<string, unknown>;
export function verifyAuditCompilerCanonicalPacket(value: unknown): boolean;
export function verifyAuditCompilerPacketSet(packets: unknown[]): { status: string; checks: number; passed: number; failed: number; rows: unknown[] };
