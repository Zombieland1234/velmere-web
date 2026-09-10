export type Pass595TokenKind =
  | "wallet"
  | "url"
  | "identifier"
  | "german_compound"
  | "long_token";

export type Pass595ExtremeToken = {
  value: string;
  kind: Pass595TokenKind;
  length: number;
  segments: number;
};

export type Pass595ExtremeTypographyHardening = {
  version: "extreme-typography-hardening";
  state: "ready" | "review";
  tokenCount: number;
  tokens: Pass595ExtremeToken[];
  policies: {
    browser: "overflow-wrap:anywhere;word-break:break-word;hyphens:auto";
    pdf: "delimiter-first-fixed-chunk";
  };
  boundary: string;
};

const URL_PATTERN = /^https?:\/\//i;
const WALLET_PATTERN = /^(0x[a-f0-9]{32,}|[13][a-km-zA-HJ-NP-Z1-9]{25,}|[a-z0-9]{48,})$/i;
const IDENTIFIER_PATTERN = /^[a-z0-9_-]{28,}$/i;

export function classifyPass595Token(
  token: string,
  locale: "pl" | "de" | "en",
): Pass595TokenKind {
  if (URL_PATTERN.test(token)) return "url";
  if (WALLET_PATTERN.test(token)) return "wallet";
  if (IDENTIFIER_PATTERN.test(token)) return "identifier";
  if (locale === "de" && token.length >= 26 && /^[A-Za-zÄÖÜäöüß-]+$/.test(token)) {
    return "german_compound";
  }
  return "long_token";
}

function splitByDelimiters(token: string) {
  return token
    .split(/(?<=[/:?&=._-])|(?=[/:?&=._-])/g)
    .filter(Boolean);
}

export function splitPass595ExtremeToken(
  token: string,
  width: number,
  locale: "pl" | "de" | "en" = "en",
): string[] {
  const safeWidth = Math.max(8, Math.floor(width));
  if (token.length <= safeWidth) return [token];
  const kind = classifyPass595Token(token, locale);
  const delimiterParts = kind === "url" ? splitByDelimiters(token) : [token];
  const output: string[] = [];

  for (const part of delimiterParts) {
    if (part.length <= safeWidth) {
      output.push(part);
      continue;
    }
    const chunk = kind === "wallet" || kind === "identifier" ? Math.min(14, safeWidth) : safeWidth;
    for (let index = 0; index < part.length; index += chunk) {
      output.push(part.slice(index, index + chunk));
    }
  }
  return output;
}

export function buildPass595ExtremeTypographyHardening(input: {
  locale: "pl" | "de" | "en";
  values: readonly string[];
  width?: number;
}): Pass595ExtremeTypographyHardening {
  const width = Math.max(18, input.width ?? 42);
  const rawTokens = input.values
    .flatMap((value) => value.split(/\s+/g))
    .map((token) => token.trim())
    .filter((token) => token.length > width);
  const tokens = Array.from(new Set(rawTokens)).slice(0, 40).map((value) => ({
    value,
    kind: classifyPass595Token(value, input.locale),
    length: value.length,
    segments: splitPass595ExtremeToken(value, width, input.locale).length,
  }));

  return {
    version: "extreme-typography-hardening",
    state: tokens.every((token) => token.segments > 1) ? "ready" : "review",
    tokenCount: tokens.length,
    tokens,
    policies: {
      browser: "overflow-wrap:anywhere;word-break:break-word;hyphens:auto",
      pdf: "delimiter-first-fixed-chunk",
    },
    boundary:
      "Long wallet addresses, IDs, URLs and German compounds receive deterministic break opportunities before layout. No token is allowed to widen an A4 cell or Reader card.",
  };
}
