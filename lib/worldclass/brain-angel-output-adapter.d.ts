export type WorldclassTier = "basic" | "pro" | "advanced";
export type WorldclassLocale = "pl" | "en" | "de";
export declare function buildWorldclassVlmBrainOutput(args: Record<string, unknown>): Record<string, unknown>;
export declare function buildWorldclassAngelOutput(args: Record<string, unknown>): Record<string, unknown>;
export declare function buildBrainAngelEvidenceReceipt(packet: Record<string, unknown>): string;
