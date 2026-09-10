export type ControlCharacterPolicy = {
  allowHorizontalTab?: boolean;
  allowLineFeed?: boolean;
  allowCarriageReturn?: boolean;
  allowFormFeed?: boolean;
};

function isBidiControl(codePoint: number) {
  return codePoint === 0x061c
    || codePoint === 0x200e
    || codePoint === 0x200f
    || (codePoint >= 0x202a && codePoint <= 0x202e)
    || (codePoint >= 0x2066 && codePoint <= 0x2069);
}

export function isUnsafeControlOrBidi(
  codePoint: number,
  policy: ControlCharacterPolicy = {},
) {
  if (isBidiControl(codePoint)) return true;
  if (codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) return true;
  if (codePoint < 0 || codePoint > 0x1f) return false;
  if (codePoint === 0x09 && policy.allowHorizontalTab) return false;
  if (codePoint === 0x0a && policy.allowLineFeed) return false;
  if (codePoint === 0x0c && policy.allowFormFeed) return false;
  if (codePoint === 0x0d && policy.allowCarriageReturn) return false;
  return true;
}

export function containsUnsafeControlOrBidi(
  value: string,
  policy: ControlCharacterPolicy = {},
) {
  for (const character of value) {
    if (isUnsafeControlOrBidi(character.codePointAt(0) ?? -1, policy)) return true;
  }
  return false;
}

export function stripUnsafeControlOrBidi(
  value: string,
  replacement = "",
  policy: ControlCharacterPolicy = {},
) {
  let output = "";
  for (const character of value) {
    output += isUnsafeControlOrBidi(character.codePointAt(0) ?? -1, policy)
      ? replacement
      : character;
  }
  return output;
}

export function isPdfTrailingWhitespace(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? -1;
    if (![0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(codePoint)) return false;
  }
  return true;
}
