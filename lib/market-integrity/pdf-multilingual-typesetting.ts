export type Pass533PdfLocale = "pl" | "de" | "en";

export type Pass533TypesettingAudit = {
  version: "pdf-multilingual-typesetting";
  locale: Pass533PdfLocale;
  fontProfile: "helvetica-winansi";
  automaticHyphenation: boolean;
  hyphenatedTokens: number;
  longIdentifierTokens: number;
  cssLanguageTag: string;
  boundary: string;
};

const vowelPattern: Record<Pass533PdfLocale, RegExp> = {
  pl: /[aąeęioóuy]/i,
  de: /[aäeioöuüy]/i,
  en: /[aeiouy]/i,
};

function isPass533Letter(value: string | undefined) {
  return Boolean(value && /[A-Za-zÀ-ÖØ-öø-ÿĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(value));
}

function isIdentifier(token: string) {
  return /https?:\/\/|0x[a-f\d]{8,}|[_/:.=]|\d{5,}/i.test(token);
}

function preferredSplit(
  token: string,
  target: number,
  locale: Pass533PdfLocale,
) {
  const minimum = Math.max(4, Math.floor(target * 0.55));
  const maximum = Math.min(token.length - 3, target);
  for (let offset = 0; offset <= maximum - minimum; offset += 1) {
    const candidates = [maximum - offset, minimum + offset];
    for (const index of candidates) {
      if (index < 3 || index >= token.length - 2) continue;
      const before = token[index - 1];
      const after = token[index];
      if (
        isPass533Letter(before) &&
        isPass533Letter(after) &&
        vowelPattern[locale].test(before) !== vowelPattern[locale].test(after)
      ) {
        return index;
      }
    }
  }
  return maximum;
}

export function splitPass533PdfToken(
  token: string,
  width: number,
  locale: Pass533PdfLocale,
) {
  const safeWidth = Math.max(8, Math.floor(width));
  if (token.length <= safeWidth) return [token];
  if (isIdentifier(token)) {
    const chunks: string[] = [];
    for (let index = 0; index < token.length; index += safeWidth)
      chunks.push(token.slice(index, index + safeWidth));
    return chunks;
  }
  const chunks: string[] = [];
  let remaining = token;
  while (remaining.length > safeWidth) {
    const split = preferredSplit(remaining, safeWidth - 1, locale);
    chunks.push(`${remaining.slice(0, split)}-`);
    remaining = remaining.slice(split);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function buildPass533TypesettingAudit(
  text: string,
  locale: Pass533PdfLocale,
): Pass533TypesettingAudit {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const longTokens = tokens.filter((token) => token.length > 18);
  return {
    version: "pdf-multilingual-typesetting",
    locale,
    fontProfile: "helvetica-winansi",
    automaticHyphenation: locale === "pl" || locale === "de",
    hyphenatedTokens: longTokens.filter((token) => !isIdentifier(token)).length,
    longIdentifierTokens: longTokens.filter(isIdentifier).length,
    cssLanguageTag: locale,
    boundary:
      "Language-aware breaks are conservative. Identifiers wrap without invented punctuation, while long prose tokens prefer vowel/consonant boundaries.",
  };
}
