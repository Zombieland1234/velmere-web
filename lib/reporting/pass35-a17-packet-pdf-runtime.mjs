import { createHash } from "node:crypto";

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const PAGE_COUNTS = Object.freeze({ basic: 2, pro: 4, advanced: 8 });
const SAFETY_MARKER = "SYNTHETIC OFFLINE NOT LIVE NOT FOR SALE";

function ascii(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/gu, "?")
    .replace(/\\/gu, "\\\\")
    .replace(/\(/gu, "\\(")
    .replace(/\)/gu, "\\)");
}

function wrap(value, width = 106) {
  const words = String(value).replace(/\s+/gu, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) line = next;
    else {
      if (line) lines.push(line);
      if (word.length <= width) line = word;
      else {
        for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
        line = "";
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pdfObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

function buildPageStream(lines) {
  const commands = ["BT", "/F1 7.5 Tf", "0.12 0.12 0.12 rg", "40 805 Td"];
  lines.slice(0, 67).forEach((line, index) => {
    if (index > 0) commands.push("0 -11 Td");
    commands.push(`(${ascii(line)}) Tj`);
  });
  commands.push("ET");
  return `${commands.join("\n")}\n`;
}

function chunkBlocksByLineBudget(blocks, count) {
  const chunks = [];
  let cursor = 0;
  for (let page = 0; page < count; page += 1) {
    const remainingPages = count - page;
    const remainingLines = blocks.slice(cursor).reduce((sum, block) => sum + block.length + 1, 0);
    const targetLines = Math.ceil(remainingLines / remainingPages);
    const chunk = [];
    let lines = 0;
    while (cursor < blocks.length) {
      const block = blocks[cursor];
      const blockLines = block.length + 1;
      if (chunk.length && lines + blockLines > targetLines && count - chunks.length - 1 > 0) break;
      chunk.push(block);
      lines += blockLines;
      cursor += 1;
      if (lines >= targetLines && count - chunks.length - 1 > 0) break;
    }
    chunks.push(chunk);
  }
  if (cursor < blocks.length) chunks[chunks.length - 1].push(...blocks.slice(cursor));
  return chunks;
}

export function buildPass35A17PacketPdf({ surfaceId, tier, packet }) {
  const pageCount = PAGE_COUNTS[tier];
  if (!pageCount) throw new Error(`a17_pdf_tier_invalid:${tier}`);
  const claimBlocks = packet.claims.map((claim) => [...wrap(`CLAIM|${claim.claimId}|${claim.kind}|${claim.confidence ?? "null"}|${claim.evidenceIds.join(",")}|${claim.text}`, 105)]);
  const provenanceBlocks = packet.provenance.map((row) => [...wrap(`PROVENANCE|${row.fieldId}|${row.providerFamily}|${row.rightsState}|${row.observedAt}|${row.sourceReceiptSha256}`, 105)]);
  const boundaryBlocks = [
    ...(packet.missingProof ?? []).map((value) => [...wrap(`MISSING_PROOF|${value}`, 105)]),
    ...(packet.contradictions ?? []).map((value) => [...wrap(`CONTRADICTION|${value}`, 105)]),
    ...(packet.methodology ?? []).map((value) => [...wrap(`METHODOLOGY|${value}`, 105)]),
    [...wrap(`UNCERTAINTY|${packet.uncertainty}`, 105)],
    [`HUMAN_REVIEW|required=${packet.humanReview.required}|completed=${packet.humanReview.completed}`],
    ["COMMERCIAL|payment=null|entitlement=null|delivery=null|sell=false"],
  ];
  const blocks = [...claimBlocks, ...provenanceBlocks, ...boundaryBlocks];
  const chunks = chunkBlocksByLineBudget(blocks, pageCount);
  const pageLines = chunks.map((chunk, index) => [
    "VELMERE PASS35 A17 PACKET-BOUND EVIDENCE REPORT",
    `SAFETY|${SAFETY_MARKER}`,
    `SURFACE|${surfaceId}`,
    `TIER|${tier}`,
    `PACKET_ID|${packet.packetId}`,
    `PACKET_HASH|${packet.packetHash}`,
    `FACTS_HASH|${packet.factsHash}`,
    `SOURCE_REVISION|${packet.releaseId}`,
    `PAGE|${index + 1}/${pageCount}`,
    "--------------------------------------------------------------------------",
    ...chunk.flatMap((block) => [...block, ""]),
  ]);
  const pageStreams = pageLines.map(buildPageStream);
  const firstPageObject = 4;
  const pageObjectIds = pageStreams.map((_, index) => firstPageObject + index * 2);
  const contentObjectIds = pageStreams.map((_, index) => firstPageObject + index * 2 + 1);
  const objects = [];
  objects.push(pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(pdfObject(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`));
  objects.push(pdfObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"));
  pageStreams.forEach((stream, index) => {
    objects.push(pdfObject(pageObjectIds[index], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`));
    objects.push(pdfObject(contentObjectIds[index], `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`));
  });
  const header = "%PDF-1.4\n%Velmere-A17\n";
  let body = header;
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  const objectCount = objects.length + 1;
  body += `xref\n0 ${objectCount}\n`;
  body += "0000000000 65535 f \n";
  for (let id = 1; id < objectCount; id += 1) body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const bytes = Buffer.from(body, "latin1");
  return {
    bytes,
    sha256: sha256(bytes),
    pageCount,
    safetyMarker: SAFETY_MARKER,
    claimIds: packet.claims.map((claim) => claim.claimId).sort(),
    evidenceIds: [...new Set(packet.claims.flatMap((claim) => claim.evidenceIds))].sort(),
  };
}

export function inspectPass35A17PacketPdf(bytes, expected) {
  const source = Buffer.from(bytes).toString("latin1");
  const pageCount = (source.match(/\/Type\s*\/Page\b/gu) ?? []).length;
  const a4PageCount = (source.match(/\/MediaBox\s*\[0\s+0\s+595\s+842\]/gu) ?? []).length;
  const safetyCount = source.split(`SAFETY|${SAFETY_MARKER}`).length - 1;
  const packetIdCount = source.split(`PACKET_ID|${expected.packetId}`).length - 1;
  const packetHashCount = source.split(`PACKET_HASH|${expected.packetHash}`).length - 1;
  const factsHashCount = source.split(`FACTS_HASH|${expected.factsHash}`).length - 1;
  const claimIds = [...source.matchAll(/CLAIM\|([a-z0-9._:-]+)\|/gu)].map((match) => match[1]).sort();
  const uniqueClaimIds = [...new Set(claimIds)].sort();
  const expectedClaimIds = [...expected.claimIds].sort();
  const reasons = [];
  if (!source.startsWith("%PDF-1.4")) reasons.push("pdf_header_invalid");
  if (!source.trimEnd().endsWith("%%EOF")) reasons.push("pdf_eof_invalid");
  if (!/\bxref\b[\s\S]*\bstartxref\b/u.test(source)) reasons.push("pdf_xref_missing");
  if (pageCount !== expected.pageCount) reasons.push(`page_count:${pageCount}/${expected.pageCount}`);
  if (a4PageCount !== pageCount) reasons.push(`a4_page_count:${a4PageCount}/${pageCount}`);
  if (safetyCount !== pageCount) reasons.push(`safety_marker_count:${safetyCount}/${pageCount}`);
  if (packetIdCount !== pageCount) reasons.push(`packet_id_count:${packetIdCount}/${pageCount}`);
  if (packetHashCount !== pageCount) reasons.push(`packet_hash_count:${packetHashCount}/${pageCount}`);
  if (factsHashCount !== pageCount) reasons.push(`facts_hash_count:${factsHashCount}/${pageCount}`);
  if (JSON.stringify(uniqueClaimIds) !== JSON.stringify(expectedClaimIds)) reasons.push("claim_set_mismatch");
  if (/\b(?:BUY|SELL NOW|GUARANTEED PROFIT|CERTIFIED SAFE)\b/u.test(source)) reasons.push("forbidden_claim_language");
  return {
    status: reasons.length ? "FAIL" : "PASS",
    reasons,
    pageCount,
    a4PageCount,
    safetyCount,
    packetIdCount,
    packetHashCount,
    factsHashCount,
    claimIds: uniqueClaimIds,
    sha256: sha256(Buffer.from(bytes)),
  };
}

export const PASS35_A17_PACKET_PDF_PAGE_COUNTS = PAGE_COUNTS;
export const PASS35_A17_PACKET_PDF_SAFETY_MARKER = SAFETY_MARKER;
