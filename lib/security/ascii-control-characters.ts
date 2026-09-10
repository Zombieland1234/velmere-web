export type AsciiControlReplacementOptions = Readonly<{
  allowHorizontalTab?: boolean;
  allowLineFeed?: boolean;
  allowCarriageReturn?: boolean;
  includeDelete?: boolean;
  includeC1?: boolean;
}>;

function isAllowedWhitespace(codePoint: number, options: AsciiControlReplacementOptions) {
  return (codePoint === 9 && options.allowHorizontalTab === true)
    || (codePoint === 10 && options.allowLineFeed === true)
    || (codePoint === 13 && options.allowCarriageReturn === true);
}

export function isForbiddenAsciiControlCodePoint(
  codePoint: number,
  options: AsciiControlReplacementOptions = {},
) {
  if (codePoint >= 0 && codePoint <= 31) {
    return !isAllowedWhitespace(codePoint, options);
  }
  if (codePoint === 127) return options.includeDelete !== false;
  return options.includeC1 === true && codePoint >= 128 && codePoint <= 159;
}

export function hasForbiddenAsciiControlCharacter(
  value: string,
  options: AsciiControlReplacementOptions = {},
) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && isForbiddenAsciiControlCodePoint(codePoint, options)) {
      return true;
    }
  }
  return false;
}

export function replaceForbiddenAsciiControlCharacters(
  value: string,
  replacement: string,
  options: AsciiControlReplacementOptions = {},
) {
  let output = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    output += codePoint !== undefined && isForbiddenAsciiControlCodePoint(codePoint, options)
      ? replacement
      : character;
  }
  return output;
}

type CharacterBoundaryPredicate = (codePoint: number, character: string) => boolean;

function expandReplacement(
  replacement: string,
  character: string,
  offset: number,
  input: string,
) {
  return replacement.replace(/\$(\$|&|`|')/gu, (_match, token: string) => {
    if (token === "$") return "$";
    if (token === "&") return character;
    if (token === "`") return input.slice(0, offset);
    return input.slice(offset + character.length);
  });
}

class CharacterBoundaryPattern extends RegExp {
  readonly #predicate: CharacterBoundaryPredicate;

  constructor(predicate: CharacterBoundaryPredicate) {
    // The inherited source is intentionally non-matching. The scanner overrides
    // test and replacement so the boundary cannot be weakened by regex state.
    super("(?!)", "gu");
    this.#predicate = predicate;
  }

  override test(value: string) {
    for (const character of value) {
      const codePoint = character.codePointAt(0);
      if (codePoint !== undefined && this.#predicate(codePoint, character)) return true;
    }
    return false;
  }

  override [Symbol.replace](
    value: string,
    replacement: string | ((substring: string, ...args: unknown[]) => string),
  ) {
    let output = "";
    let offset = 0;
    for (const character of value) {
      const codePoint = character.codePointAt(0);
      if (codePoint !== undefined && this.#predicate(codePoint, character)) {
        output += typeof replacement === "function"
          ? replacement(character, offset, value)
          : expandReplacement(replacement, character, offset, value);
      } else {
        output += character;
      }
      offset += character.length;
    }
    return output;
  }
}

function boundary(
  options: AsciiControlReplacementOptions = {},
  extraCharacters = "",
  extraCodePoint: (codePoint: number) => boolean = () => false,
) {
  const extras = new Set(extraCharacters);
  return new CharacterBoundaryPattern((codePoint, character) => (
    isForbiddenAsciiControlCodePoint(codePoint, options)
      || extras.has(character)
      || extraCodePoint(codePoint)
  ));
}

export const ASCII_CONTROL_PATTERN = boundary();
export const JSON_CONTROL_PATTERN = boundary({
  allowHorizontalTab: true,
  allowLineFeed: true,
  allowCarriageReturn: true,
});
export const JSON_CONTROL_NO_DELETE_PATTERN = boundary({
  allowHorizontalTab: true,
  allowLineFeed: true,
  allowCarriageReturn: true,
  includeDelete: false,
});
export const ASCII_CONTROL_OR_MARKUP_PATTERN = boundary({}, "<>`");
export const JSON_CONTROL_OR_MARKUP_PATTERN = boundary({
  allowHorizontalTab: true,
  allowLineFeed: true,
  allowCarriageReturn: true,
}, "<>`");
export const ASCII_CONTROL_OR_ANGLE_PATTERN = boundary({}, "<>");
export const C0_OR_ANGLE_PATTERN = boundary({ includeDelete: false }, "<>");
export const C0_OR_BRACE_ANGLE_PATTERN = boundary({ includeDelete: false }, "<>{}");
export const C0_OR_TEMPLATE_META_PATTERN = boundary({ includeDelete: false }, "<>{}`$\\");
export const C0_C1_PATTERN = boundary({ includeC1: true });
export const C0_C1_OR_BIDI_PATTERN = boundary(
  { includeC1: true },
  "",
  (codePoint) => (codePoint >= 0x202a && codePoint <= 0x202e)
    || (codePoint >= 0x2066 && codePoint <= 0x2069),
);
export const ASCII_CONTROL_OR_BIDI_PATTERN = boundary(
  {},
  "",
  (codePoint) => codePoint === 0x061c
    || codePoint === 0x200e
    || codePoint === 0x200f
    || (codePoint >= 0x202a && codePoint <= 0x202e)
    || (codePoint >= 0x2066 && codePoint <= 0x2069),
);
export const NUL_CR_LF_PATTERN = new CharacterBoundaryPattern(
  (codePoint) => codePoint === 0 || codePoint === 10 || codePoint === 13,
);
export const ZERO_WIDTH_SECURITY_PATTERN = new CharacterBoundaryPattern(
  (codePoint) => codePoint === 0x00ad
    || codePoint === 0x034f
    || codePoint === 0x061c
    || codePoint === 0x115f
    || codePoint === 0x1160
    || codePoint === 0x17b4
    || codePoint === 0x17b5
    || codePoint === 0x180e
    || (codePoint >= 0x200b && codePoint <= 0x200f)
    || (codePoint >= 0x202a && codePoint <= 0x202e)
    || (codePoint >= 0x2060 && codePoint <= 0x206f)
    || codePoint === 0xfeff
    || (codePoint >= 0xfff9 && codePoint <= 0xfffb),
);
