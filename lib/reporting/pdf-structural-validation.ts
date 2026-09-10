/**
 * Fail-closed validation for the passive, classic-xref PDF subset emitted by
 * Velmere's current renderer.
 *
 * This is intentionally not a general ISO 32000 parser. Unsupported features
 * (incremental updates, xref/object streams, indirect stream lengths and
 * encryption) are rejected instead of being guessed at. The boundary proves
 * that every classic xref entry resolves to the declared indirect object and
 * that the trailer Root reaches a bounded Catalog -> Pages -> Kids -> Page
 * tree. It also tokenizes PDF names (including #xx escapes) outside streams so
 * active content cannot be hidden behind encoded names or string/stream text.
 */

export const VELMERE_PDF_STRUCTURAL_VALIDATION_SCHEMA =
  "velmere.pdf-structural-validation.v2" as const;

export const VELMERE_PDF_STRUCTURAL_MIN_BYTES = 1;
export const VELMERE_PDF_STRUCTURAL_MAX_BYTES = 8 * 1024 * 1024;

export type PdfStructuralValidation = Readonly<{
  schemaVersion: typeof VELMERE_PDF_STRUCTURAL_VALIDATION_SCHEMA;
  valid: boolean;
  byteLength: number;
  version: string | null;
  headerValid: boolean;
  eofValid: boolean;
  startXrefValid: boolean;
  xrefTargetValid: boolean;
  indirectObjectCount: number;
  catalogPresent: boolean;
  pageTreePresent: boolean;
  pageCount: number;
  activeContentDetected: boolean;
  activeContentMarkers: readonly string[];
  blockers: readonly string[];
}>;

const MAX_XREF_SECTIONS = 64;
const MAX_INDIRECT_OBJECTS = 100_000;
const MAX_PARSE_DEPTH = 32;
const MAX_PARSED_VALUES = 250_000;
const MAX_PAGE_TREE_DEPTH = 32;
const MAX_PAGE_TREE_NODES = 10_000;

// Names whose semantics can execute code, launch another handler, attach or
// submit data, embed rich media, or activate an unsupported PDF container.
// Dest is intentionally not included: current A83 artifacts contain passive
// internal destinations, while action dictionaries and URI actions are denied.
const ACTIVE_CONTENT_NAMES = new Set([
  "JavaScript",
  "JS",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "OpenAction",
  "AA",
  "A",
  "AcroForm",
  "XFA",
  "RichMedia",
  "RichMediaContent",
  "RichMediaSettings",
  "Movie",
  "Sound",
  "Rendition",
  "SubmitForm",
  "ResetForm",
  "ImportData",
  "URI",
  "GoTo",
  "GoToR",
  "GoToE",
  "GoTo3DView",
  "Thread",
  "Hide",
  "Named",
  "SetOCGState",
  "Trans",
  "Collection",
  "Filespec",
  "EF",
  "FileAttachment",
  "Screen",
  "3D",
  "3DD",
  "Encrypt",
  "ObjStm",
  "XRef",
]);

type PdfName = Readonly<{ kind: "name"; value: string }>;
type PdfRef = Readonly<{ kind: "ref"; objectNumber: number; generation: number }>;
type PdfKeyword = Readonly<{ kind: "keyword"; value: string }>;
type PdfString = Readonly<{ kind: "string" }>;
type PdfDict = Map<string, PdfValue>;
type PdfValue = null | boolean | number | PdfName | PdfRef | PdfKeyword | PdfString | PdfDict | PdfValue[];

type Token =
  | Readonly<{ kind: "name"; value: string }>
  | Readonly<{ kind: "number"; raw: string; value: number }>
  | Readonly<{ kind: "keyword"; value: string }>
  | Readonly<{ kind: "string" }>
  | Readonly<{ kind: "dict_open" | "dict_close" | "array_open" | "array_close" }>;

type XrefEntry = Readonly<{
  objectNumber: number;
  generation: number;
  offset: number;
  inUse: boolean;
}>;

type ParsedIndirectObject = Readonly<{
  objectNumber: number;
  generation: number;
  value: PdfValue;
  hasStream: boolean;
  names: readonly string[];
}>;

function isWhitespaceCode(code: number) {
  return code === 0 || code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function isDelimiterCharacter(character: string | undefined) {
  if (character === undefined) return true;
  const code = character.charCodeAt(0);
  return isWhitespaceCode(code) || "()<>[]{}/%".includes(character);
}

function isHex(character: string | undefined) {
  return character !== undefined && /^[0-9A-Fa-f]$/u.test(character);
}

function onlyIgnorable(text: string, start: number, end: number) {
  let cursor = start;
  while (cursor < end) {
    if (isWhitespaceCode(text.charCodeAt(cursor))) {
      cursor += 1;
      continue;
    }
    if (text[cursor] === "%") {
      cursor += 1;
      while (cursor < end && text[cursor] !== "\r" && text[cursor] !== "\n") cursor += 1;
      continue;
    }
    return false;
  }
  return true;
}

function terminalEofOffset(text: string) {
  let cursor = text.length - 1;
  while (cursor >= 0 && isWhitespaceCode(text.charCodeAt(cursor))) cursor -= 1;
  if (cursor < 4 || text.slice(cursor - 4, cursor + 1) !== "%%EOF") return -1;
  return cursor - 4;
}

function parseFooter(text: string, eofOffset: number) {
  const terminal = text.slice(0, eofOffset + 5);
  const match = /(?:^|[\r\n])startxref[ \t]*(?:\r\n|\r|\n)([0-9]+)[ \t]*(?:\r\n|\r|\n)+%%EOF$/u.exec(terminal);
  if (!match?.[1]) return null;
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset) || offset <= 0 || offset >= eofOffset) return null;
  return {
    offset,
    footerStart: (match.index ?? 0) + (match[0].startsWith("\r") || match[0].startsWith("\n") ? 1 : 0),
  };
}

class PdfLexer {
  readonly names: string[] = [];
  private readonly cache: Token[] = [];
  private parsedValues = 0;
  cursor: number;

  constructor(
    private readonly text: string,
    start: number,
    private readonly end: number,
  ) {
    this.cursor = start;
  }

  private fail(code: string): never {
    throw new Error(code);
  }

  skipIgnorable() {
    while (this.cursor < this.end) {
      const code = this.text.charCodeAt(this.cursor);
      if (isWhitespaceCode(code)) {
        this.cursor += 1;
        continue;
      }
      if (this.text[this.cursor] === "%") {
        this.cursor += 1;
        while (this.cursor < this.end && this.text[this.cursor] !== "\r" && this.text[this.cursor] !== "\n") {
          this.cursor += 1;
        }
        continue;
      }
      break;
    }
  }

  private readName(): Token {
    this.cursor += 1;
    let decoded = "";
    while (this.cursor < this.end && !isDelimiterCharacter(this.text[this.cursor])) {
      const character = this.text[this.cursor]!;
      if (character === "#") {
        const high = this.text[this.cursor + 1];
        const low = this.text[this.cursor + 2];
        if (!isHex(high) || !isHex(low)) this.fail("pdf_name_encoding_invalid");
        decoded += String.fromCharCode(Number.parseInt(`${high}${low}`, 16));
        this.cursor += 3;
      } else {
        decoded += character;
        this.cursor += 1;
      }
    }
    if (!decoded) this.fail("pdf_empty_name_invalid");
    this.names.push(decoded);
    return { kind: "name", value: decoded };
  }

  private readLiteralString(): Token {
    this.cursor += 1;
    let depth = 1;
    while (this.cursor < this.end) {
      const character = this.text[this.cursor]!;
      if (character === "\\") {
        this.cursor += 1;
        if (this.cursor >= this.end) this.fail("pdf_literal_string_unterminated");
        if (this.text[this.cursor] === "\r" && this.text[this.cursor + 1] === "\n") this.cursor += 2;
        else this.cursor += 1;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        this.cursor += 1;
        if (depth === 0) return { kind: "string" };
        continue;
      }
      this.cursor += 1;
    }
    this.fail("pdf_literal_string_unterminated");
  }

  private readHexString(): Token {
    this.cursor += 1;
    while (this.cursor < this.end) {
      const character = this.text[this.cursor]!;
      if (character === ">") {
        this.cursor += 1;
        return { kind: "string" };
      }
      if (!isWhitespaceCode(character.charCodeAt(0)) && !isHex(character)) {
        this.fail("pdf_hex_string_invalid");
      }
      this.cursor += 1;
    }
    this.fail("pdf_hex_string_unterminated");
  }

  private readToken(): Token | null {
    this.skipIgnorable();
    if (this.cursor >= this.end) return null;
    const character = this.text[this.cursor]!;
    const next = this.text[this.cursor + 1];
    if (character === "<" && next === "<") {
      this.cursor += 2;
      return { kind: "dict_open" };
    }
    if (character === ">" && next === ">") {
      this.cursor += 2;
      return { kind: "dict_close" };
    }
    if (character === "[") {
      this.cursor += 1;
      return { kind: "array_open" };
    }
    if (character === "]") {
      this.cursor += 1;
      return { kind: "array_close" };
    }
    if (character === "/") return this.readName();
    if (character === "(") return this.readLiteralString();
    if (character === "<") return this.readHexString();
    if (character === ">" || character === "{" || character === "}") this.fail("pdf_token_delimiter_invalid");

    const remainder = this.text.slice(this.cursor, this.end);
    const number = /^[+-]?(?:\d+\.\d*|\d+|\.\d+)/u.exec(remainder);
    if (number && isDelimiterCharacter(remainder[number[0].length])) {
      this.cursor += number[0].length;
      const value = Number(number[0]);
      if (!Number.isFinite(value)) this.fail("pdf_number_invalid");
      return { kind: "number", raw: number[0], value };
    }
    let end = this.cursor;
    while (end < this.end && !isDelimiterCharacter(this.text[end])) end += 1;
    if (end === this.cursor) this.fail("pdf_token_invalid");
    const value = this.text.slice(this.cursor, end);
    this.cursor = end;
    return { kind: "keyword", value };
  }

  peek(distance = 0) {
    while (this.cache.length <= distance) {
      const token = this.readToken();
      if (!token) break;
      this.cache.push(token);
    }
    return this.cache[distance] ?? null;
  }

  take() {
    const token = this.peek();
    if (token) this.cache.shift();
    return token;
  }

  parseValue(depth = 0): PdfValue {
    if (depth > MAX_PARSE_DEPTH) this.fail("pdf_parse_depth_exceeded");
    this.parsedValues += 1;
    if (this.parsedValues > MAX_PARSED_VALUES) this.fail("pdf_parse_value_limit_exceeded");
    const token = this.take();
    if (!token) this.fail("pdf_value_missing");
    if (token.kind === "name") return { kind: "name", value: token.value };
    if (token.kind === "string") return { kind: "string" };
    if (token.kind === "number") {
      const generation = this.peek(0);
      const reference = generation?.kind === "number" ? this.peek(1) : null;
      if (Number.isSafeInteger(token.value) && token.value >= 0
        && generation?.kind === "number" && Number.isSafeInteger(generation.value) && generation.value >= 0
        && reference?.kind === "keyword" && reference.value === "R") {
        this.take();
        this.take();
        return { kind: "ref", objectNumber: token.value, generation: generation.value };
      }
      return token.value;
    }
    if (token.kind === "keyword") {
      if (token.value === "null") return null;
      if (token.value === "true") return true;
      if (token.value === "false") return false;
      return { kind: "keyword", value: token.value };
    }
    if (token.kind === "array_open") {
      const values: PdfValue[] = [];
      while (this.peek()?.kind !== "array_close") {
        if (!this.peek()) this.fail("pdf_array_unterminated");
        values.push(this.parseValue(depth + 1));
      }
      this.take();
      return values;
    }
    if (token.kind === "dict_open") {
      const dictionary: PdfDict = new Map();
      while (this.peek()?.kind !== "dict_close") {
        const key = this.take();
        if (!key) this.fail("pdf_dictionary_unterminated");
        if (key.kind !== "name") this.fail("pdf_dictionary_key_invalid");
        if (dictionary.has(key.value)) this.fail("pdf_dictionary_duplicate_key");
        dictionary.set(key.value, this.parseValue(depth + 1));
      }
      this.take();
      return dictionary;
    }
    this.fail("pdf_unexpected_closing_delimiter");
  }
}

function asDict(value: PdfValue | undefined) {
  return value instanceof Map ? value : null;
}

function asName(value: PdfValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Map)
    && "kind" in value && value.kind === "name" ? value.value : null;
}

function asRef(value: PdfValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Map)
    && "kind" in value && value.kind === "ref" ? value : null;
}

function asNonnegativeInteger(value: PdfValue | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function referenceKey(reference: PdfRef) {
  return `${reference.objectNumber}:${reference.generation}`;
}

function parseXrefAndTrailer(text: string, xrefOffset: number, footerStart: number) {
  if (text.slice(xrefOffset, xrefOffset + 4) !== "xref"
    || !isDelimiterCharacter(text[xrefOffset + 4])) {
    throw new Error("pdf_xref_target_invalid");
  }
  let cursor = xrefOffset + 4;
  const skipWhitespace = () => {
    while (cursor < footerStart && isWhitespaceCode(text.charCodeAt(cursor))) cursor += 1;
  };
  const entries = new Map<number, XrefEntry>();
  let sectionCount = 0;
  while (true) {
    skipWhitespace();
    if (text.slice(cursor, cursor + 7) === "trailer" && isDelimiterCharacter(text[cursor + 7])) {
      cursor += 7;
      break;
    }
    sectionCount += 1;
    if (sectionCount > MAX_XREF_SECTIONS) throw new Error("pdf_xref_section_limit_exceeded");
    const header = /^(\d+)[ \t]+(\d+)(?:[ \t]*(?:\r\n|\r|\n))/u.exec(text.slice(cursor, footerStart));
    if (!header?.[1] || !header[2]) throw new Error("pdf_xref_section_header_invalid");
    const first = Number(header[1]);
    const count = Number(header[2]);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(count) || count < 1
      || first < 0 || first + count > MAX_INDIRECT_OBJECTS) {
      throw new Error("pdf_xref_section_range_invalid");
    }
    cursor += header[0].length;
    for (let index = 0; index < count; index += 1) {
      const row = /^(\d{10})[ \t](\d{5})[ \t]([nf])[ \t]*(?:\r\n|\r|\n)/u.exec(text.slice(cursor, footerStart));
      if (!row?.[1] || !row[2] || !row[3]) throw new Error("pdf_xref_entry_invalid");
      const objectNumber = first + index;
      if (entries.has(objectNumber)) throw new Error("pdf_xref_duplicate_object_entry");
      entries.set(objectNumber, {
        objectNumber,
        generation: Number(row[2]),
        offset: Number(row[1]),
        inUse: row[3] === "n",
      });
      cursor += row[0].length;
    }
  }
  if (entries.size < 1) throw new Error("pdf_xref_entries_missing");
  const lexer = new PdfLexer(text, cursor, footerStart);
  const trailer = asDict(lexer.parseValue());
  if (!trailer) throw new Error("pdf_trailer_dictionary_invalid");
  lexer.skipIgnorable();
  if (lexer.cursor !== footerStart) throw new Error("pdf_trailer_trailing_content_invalid");
  const trailerNames = [...lexer.names];
  const size = asNonnegativeInteger(trailer.get("Size"));
  if (size === null || size < 1 || size > MAX_INDIRECT_OBJECTS) throw new Error("pdf_trailer_size_invalid");
  if (entries.size !== size) throw new Error("pdf_xref_size_coverage_mismatch");
  for (let objectNumber = 0; objectNumber < size; objectNumber += 1) {
    if (!entries.has(objectNumber)) throw new Error("pdf_xref_size_coverage_mismatch");
  }
  const zero = entries.get(0);
  if (!zero || zero.inUse || zero.generation !== 65535) throw new Error("pdf_xref_free_object_zero_invalid");
  const root = asRef(trailer.get("Root"));
  if (!root) throw new Error("pdf_trailer_root_missing");
  if (trailer.has("Prev") || trailer.has("XRefStm")) throw new Error("pdf_incremental_xref_unsupported");
  return { entries, trailerNames, root };
}

function parseIndirectObject(
  text: string,
  entry: XrefEntry,
  boundary: number,
): ParsedIndirectObject {
  const slice = text.slice(entry.offset, boundary);
  const header = /^(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj/u.exec(slice);
  if (!header || !isDelimiterCharacter(slice[header[0].length])
    || Number(header[1]) !== entry.objectNumber || Number(header[2]) !== entry.generation) {
    throw new Error(`pdf_xref_object_target_mismatch:${entry.objectNumber}:${entry.generation}`);
  }
  const endObject = slice.lastIndexOf("endobj");
  if (endObject < header[0].length
    || !isDelimiterCharacter(slice[endObject - 1])
    || !isDelimiterCharacter(slice[endObject + 6])
    || !onlyIgnorable(slice, endObject + 6, slice.length)) {
    throw new Error(`pdf_indirect_object_termination_invalid:${entry.objectNumber}:${entry.generation}`);
  }
  const lexer = new PdfLexer(slice, header[0].length, endObject);
  const value = lexer.parseValue();
  lexer.skipIgnorable();
  let hasStream = false;
  if (lexer.cursor < endObject) {
    if (slice.slice(lexer.cursor, lexer.cursor + 6) !== "stream"
      || !isDelimiterCharacter(slice[lexer.cursor + 6])) {
      throw new Error(`pdf_indirect_object_trailing_content:${entry.objectNumber}:${entry.generation}`);
    }
    const dictionary = asDict(value);
    if (!dictionary) throw new Error("pdf_stream_dictionary_missing");
    const length = asNonnegativeInteger(dictionary.get("Length"));
    if (length === null) throw new Error("pdf_indirect_stream_length_unsupported");
    let streamStart = lexer.cursor + 6;
    if (slice.slice(streamStart, streamStart + 2) === "\r\n") streamStart += 2;
    else if (slice[streamStart] === "\r" || slice[streamStart] === "\n") streamStart += 1;
    else throw new Error("pdf_stream_eol_invalid");
    let streamEnd = streamStart + length;
    if (streamEnd > endObject) throw new Error("pdf_stream_length_out_of_range");
    if (slice.slice(streamEnd, streamEnd + 9) !== "endstream") {
      if (slice.slice(streamEnd, streamEnd + 2) === "\r\n") streamEnd += 2;
      else if (slice[streamEnd] === "\r" || slice[streamEnd] === "\n") streamEnd += 1;
    }
    if (slice.slice(streamEnd, streamEnd + 9) !== "endstream"
      || !isDelimiterCharacter(slice[streamEnd + 9])
      || !onlyIgnorable(slice, streamEnd + 9, endObject)) {
      throw new Error("pdf_stream_length_mismatch");
    }
    hasStream = true;
  }
  return {
    objectNumber: entry.objectNumber,
    generation: entry.generation,
    value,
    hasStream,
    names: [...lexer.names],
  };
}

function validatePageTree(args: {
  root: PdfRef;
  objects: ReadonlyMap<string, ParsedIndirectObject>;
}) {
  const catalog = args.objects.get(referenceKey(args.root));
  const catalogDictionary = asDict(catalog?.value);
  const catalogPresent = Boolean(catalogDictionary && !catalog?.hasStream
    && asName(catalogDictionary.get("Type")) === "Catalog");
  if (!catalogPresent || !catalogDictionary) throw new Error("pdf_catalog_root_invalid");
  const pagesRoot = asRef(catalogDictionary.get("Pages"));
  if (!pagesRoot) throw new Error("pdf_catalog_pages_reference_missing");

  const visiting = new Set<string>();
  const visited = new Set<string>();
  let nodes = 0;
  let pages = 0;
  const walk = (reference: PdfRef, parent: PdfRef | null, depth: number): number => {
    if (depth > MAX_PAGE_TREE_DEPTH) throw new Error("pdf_page_tree_depth_exceeded");
    nodes += 1;
    if (nodes > MAX_PAGE_TREE_NODES) throw new Error("pdf_page_tree_node_limit_exceeded");
    const key = referenceKey(reference);
    if (visiting.has(key) || visited.has(key)) throw new Error("pdf_page_tree_cycle_or_duplicate");
    visiting.add(key);
    const object = args.objects.get(key);
    const dictionary = asDict(object?.value);
    if (!object || object.hasStream || !dictionary) throw new Error("pdf_page_tree_object_invalid");
    const type = asName(dictionary.get("Type"));
    const declaredParent = asRef(dictionary.get("Parent"));
    if (parent && (!declaredParent || referenceKey(declaredParent) !== referenceKey(parent))) {
      throw new Error("pdf_page_parent_mismatch");
    }
    let discovered: number;
    if (type === "Page") {
      pages += 1;
      discovered = 1;
    } else if (type === "Pages") {
      if (!parent && declaredParent) throw new Error("pdf_page_root_parent_invalid");
      const kids = dictionary.get("Kids");
      const count = asNonnegativeInteger(dictionary.get("Count"));
      if (!Array.isArray(kids) || kids.length < 1 || count === null || count < 1) {
        throw new Error("pdf_pages_kids_or_count_invalid");
      }
      discovered = 0;
      for (const kid of kids) {
        const child = asRef(kid);
        if (!child) throw new Error("pdf_pages_kid_reference_invalid");
        discovered += walk(child, reference, depth + 1);
      }
      if (count !== discovered) throw new Error("pdf_pages_count_mismatch");
    } else {
      throw new Error("pdf_page_tree_type_invalid");
    }
    visiting.delete(key);
    visited.add(key);
    return discovered;
  };
  const pageCount = walk(pagesRoot, null, 0);
  if (pageCount < 1 || pages !== pageCount) throw new Error("pdf_page_count_missing");
  return { catalogPresent: true, pageTreePresent: true, pageCount };
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values));
}

export function inspectPdfStructure(bytes: Uint8Array): PdfStructuralValidation {
  const buffer = Buffer.from(bytes);
  const text = buffer.toString("latin1");
  const byteLength = buffer.byteLength;
  const blockers: string[] = [];
  const header = /^%PDF-(1\.[0-7]|2\.0)(?:\r\n|\r|\n)/u.exec(text.slice(0, 16));
  const version = header?.[1] ?? null;
  const headerValid = version !== null;
  const eofOffset = terminalEofOffset(text);
  const eofValid = eofOffset >= 0;
  const footer = eofValid ? parseFooter(text, eofOffset) : null;
  const startXrefValid = footer !== null;
  const xrefTargetValid = Boolean(footer
    && text.slice(footer.offset, footer.offset + 4) === "xref"
    && isDelimiterCharacter(text[footer.offset + 4]));
  let indirectObjectCount = 0;
  let catalogPresent = false;
  let pageTreePresent = false;
  let pageCount = 0;
  const decodedNames: string[] = [];

  if (byteLength < VELMERE_PDF_STRUCTURAL_MIN_BYTES || byteLength > VELMERE_PDF_STRUCTURAL_MAX_BYTES) {
    blockers.push(`pdf_byte_length_out_of_range:${byteLength}/${VELMERE_PDF_STRUCTURAL_MIN_BYTES}-${VELMERE_PDF_STRUCTURAL_MAX_BYTES}`);
  }
  if (!headerValid) blockers.push("pdf_header_invalid");
  if (!eofValid) blockers.push("pdf_terminal_eof_invalid");
  if (!startXrefValid) blockers.push("pdf_startxref_invalid");
  if (startXrefValid && !xrefTargetValid) blockers.push("pdf_xref_target_invalid");

  if (blockers.length === 0 && footer) {
    try {
      const parsedXref = parseXrefAndTrailer(text, footer.offset, footer.footerStart);
      decodedNames.push(...parsedXref.trailerNames);
      const inUse = [...parsedXref.entries.values()].filter((entry) => entry.inUse);
      indirectObjectCount = inUse.length;
      if (inUse.length < 1 || inUse.length > MAX_INDIRECT_OBJECTS) {
        throw new Error("pdf_indirect_object_count_invalid");
      }
      const ordered = [...inUse].sort((left, right) => left.offset - right.offset);
      const offsets = new Set<number>();
      for (const entry of ordered) {
        if (!Number.isSafeInteger(entry.offset) || entry.offset <= 0 || entry.offset >= footer.offset
          || offsets.has(entry.offset)) {
          throw new Error("pdf_xref_object_offset_invalid");
        }
        offsets.add(entry.offset);
      }
      const objects = new Map<string, ParsedIndirectObject>();
      ordered.forEach((entry, index) => {
        const boundary = ordered[index + 1]?.offset ?? footer.offset;
        const object = parseIndirectObject(text, entry, boundary);
        objects.set(`${entry.objectNumber}:${entry.generation}`, object);
        decodedNames.push(...object.names);
      });
      const tree = validatePageTree({ root: parsedXref.root, objects });
      catalogPresent = tree.catalogPresent;
      pageTreePresent = tree.pageTreePresent;
      pageCount = tree.pageCount;
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : "pdf_structural_parser_failed");
    }
  }

  const activeContentMarkers = unique(decodedNames
    .filter((name) => ACTIVE_CONTENT_NAMES.has(name))
    .map((name) => `/${name}`));
  const activeContentDetected = activeContentMarkers.length > 0;
  if (activeContentDetected) blockers.push(`pdf_active_content:${activeContentMarkers.join(",")}`);
  return {
    schemaVersion: VELMERE_PDF_STRUCTURAL_VALIDATION_SCHEMA,
    valid: blockers.length === 0,
    byteLength,
    version,
    headerValid,
    eofValid,
    startXrefValid,
    xrefTargetValid,
    indirectObjectCount,
    catalogPresent,
    pageTreePresent,
    pageCount,
    activeContentDetected,
    activeContentMarkers,
    blockers: unique(blockers),
  };
}
