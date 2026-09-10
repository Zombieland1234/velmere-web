import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";

import { buildPdf } from "@/lib/search/lens-pdf-renderer";
import { buildLensReport, type LensReport } from "@/lib/search/lens-report";
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";

export const A83_REVISION = "VELMERE_PASS36_A83R0_BROWSER_LENS_PDF_REAL_PACKET_MATRIX_AND_SECURE_DELIVERY_PARITY" as const;
export const A83_CHANNELS = ["api", "ui", "preview", "pdf", "brain", "angel"] as const;
export const A83_LOCALES = ["pl", "en", "de"] as const;
export const A83_TIERS = ["basic", "pro", "advanced"] as const;
export const A83_SAFETY_MARKER = "SYNTHETIC A83 QA - OFFLINE - NOT LIVE - NOT FOR SALE" as const;

export type A83Locale = (typeof A83_LOCALES)[number];
export type A83Tier = (typeof A83_TIERS)[number];

type A83FixtureCase = {
  caseId: string;
  caseClass: string;
  subjectId: string;
  symbol: string;
  name: string;
  scenario: string;
  category: VelmereSearchResult["category"];
  assetClass?: NonNullable<VelmereSearchResult["marketSnapshot"]>["assetClass"];
};

type A83TierPolicy = {
  depth: A83Tier;
  label: string;
  pageCount: number;
  minimumMaterialFields: number;
  minimumEvidenceFamilies: number;
};

type A83Policy = {
  revisionId: string;
  deterministicEpoch: string;
  requiredCaseCount: number;
  locales: A83Locale[];
  tiers: A83TierPolicy[];
  channels: string[];
  fixtureDenominators: {
    physicalPdfs: number;
    renderedPages: number;
    channelProjections: number;
    semanticMutations: number;
  };
  closedByA83: unknown[];
  caseClasses: Record<string, number>;
  fixtureCatalog: {
    path: string;
    sha256: string;
  };
  corpusOutput: {
    root: string;
    manifestPath: string;
  };
};

type A83Catalog = {
  revisionId: string;
  caseCount: number;
  cases: A83FixtureCase[];
  boundaries: {
    synthetic: boolean;
    notLive: boolean;
    notForSale: boolean;
  };
};

type A83Projection = {
  channel: string;
  factDigest: string;
  reportDigest: string;
  claimSetDigest: string;
  locale: A83Locale;
  tier: A83Tier;
  addedFacts: number;
  analysisDecision: string;
  paidGateEligible: boolean;
  liveProven: boolean;
  saleEnabled: boolean;
};

type A83PdfInspection = {
  pdfHeader: boolean;
  eof: boolean;
  pageCount: number;
  a4PageCount: number;
  embeddedFont: boolean;
  toUnicode: boolean;
  bannedHits: string[];
  safe: boolean;
};

type A83Integrity = {
  algorithm: "sha256";
  digest: string;
};

type A83Entry = {
  schemaVersion: string;
  revisionId: string;
  entryId: string;
  caseId: string;
  caseClass: string;
  subjectId: string;
  symbol: string;
  locale: A83Locale;
  tier: A83Tier;
  tierLabel: string;
  path: string;
  byteLength: number;
  pdfSha256: string;
  renderBindingDigest: string;
  pageCount: number;
  a4PageCount: number;
  factDigest: string;
  reportDigest: string;
  claimSetDigest: string;
  projectionDigest: string;
  projections: A83Projection[];
  sourceMode: string;
  sourceConfidence: number;
  fixtureOnly: boolean;
  realPacketVerified: boolean;
  rightsApproved: boolean;
  browserExecuted: boolean;
  secureDeliveryExecuted: boolean;
  accessibilityExternallyValidated: boolean;
  customerComprehensionLabels: number;
  paidGateEligible: boolean;
  liveProven: boolean;
  saleEnabled: boolean;
  notForSale: boolean;
  pdfSecurity: A83PdfInspection;
  integrity: A83Integrity;
};

type A83CorpusTotals = {
  cases: number;
  physicalPdfs: number;
  renderedPages: number;
  channelProjections: number;
  semanticMutations: number;
  mutationKilled: number;
  byLocale: Record<string, number>;
  byTier: Record<string, number>;
};

type A83CorpusManifest = {
  schemaVersion: string;
  revisionId: string;
  generatedAt: string;
  mode: string;
  sourceCatalog: { path: string; sha256: string };
  totals: A83CorpusTotals;
  classCounts: Record<string, number>;
  boundaries: Record<string, boolean | number>;
  mutationFailures: string[];
  entries: A83Entry[];
  integrity: A83Integrity;
};

type A83RealIntakeSlot = {
  slotId: string;
  caseClass: string;
  packetBundleSupplied?: boolean;
  rightsApproved?: boolean;
  freshnessVerified?: boolean;
  browserEvidenceReady?: boolean;
  secureDeliveryEvidenceReady?: boolean;
  accessibilityEvidenceReady?: boolean;
  customerComprehensionLabels?: unknown;
  tierOutputsSupplied?: unknown;
  realPacketReady?: boolean;
};

type A83RealIntakeIndex = {
  revisionId: string;
  slots: A83RealIntakeSlot[];
};

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => [key, normalize(record[key])]));
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(normalize(value));
}

export function sha256(value: unknown) {
  const bytes = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? value
    : Buffer.from(typeof value === "string" ? value : canonicalJson(value), "utf8");
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function safeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "subject";
}

function localizedCopy(row: A83FixtureCase, locale: A83Locale) {
  if (locale === "pl") return {
    summary: `${A83_SAFETY_MARKER}. Przypadek ${row.symbol} (${row.caseClass}) sprawdza scenariusz ${row.scenario}; dane są syntetyczne i nie opisują bieżącego rynku ani kontraktu.`,
    why: "Ten przypadek wiąże fakty, tłumaczenie, podgląd, PDF i kanały asystenta bez dopisywania nowych twierdzeń.",
    missing: ["Brak aktualnych danych providera.", "Brak praw do komercyjnego wyświetlania i eksportu.", "Brak produkcyjnego testu przeglądarki i bezpiecznego dostarczenia klientowi."],
    next: "Dołącz aktualny pakiet danych, prawa, dowody przeglądarkowe i etykiety zrozumienia klienta przed jakąkolwiek promocją.",
  };
  if (locale === "de") return {
    summary: `${A83_SAFETY_MARKER}. Fall ${row.symbol} (${row.caseClass}) prüft das Szenario ${row.scenario}; die Daten sind synthetisch und beschreiben weder den aktuellen Markt noch den aktuellen Vertrag.`,
    why: "Der Fall bindet Fakten, Übersetzung, Vorschau, PDF und Assistenzkanäle, ohne neue Behauptungen hinzuzufügen.",
    missing: ["Aktuelle Anbieterdaten fehlen.", "Kommerzielle Anzeige- und Exportrechte fehlen.", "Produktiver Browser- und sicherer Kundenzustellungsnachweis fehlt."],
    next: "Vor jeder Freigabe aktuelle Datenpakete, Rechte, Browsernachweise und Kundenverständnis-Labels beifügen.",
  };
  return {
    summary: `${A83_SAFETY_MARKER}. Case ${row.symbol} (${row.caseClass}) exercises scenario ${row.scenario}; the data is synthetic and does not describe the current market or contract.`,
    why: "The case binds facts, translation, preview, PDF and assistant channels without adding new claims.",
    missing: ["Current provider data is absent.", "Commercial display and export rights are absent.", "Production browser and secure customer-delivery evidence is absent."],
    next: "Attach current data packets, rights, browser evidence and customer-comprehension labels before any promotion.",
  };
}

function marketSnapshot(row: A83FixtureCase): NonNullable<VelmereSearchResult["marketSnapshot"]> {
  const base: NonNullable<VelmereSearchResult["marketSnapshot"]> = {
    providerState: "not_configured",
    anomalyLabel: `a83_${row.scenario}`,
  };
  if (row.assetClass) base.assetClass = row.assetClass;
  if (["stock", "etf", "real_estate", "index", "fx", "commodity"].includes(String(row.assetClass))) base.currency = "USD";
  return base;
}

export function buildA83FixtureSearchResult(row: A83FixtureCase, locale: A83Locale): VelmereSearchResult {
  const copy = localizedCopy(row, locale);
  return {
    id: row.subjectId,
    title: `[A83 QA] ${row.name}`,
    symbol: row.symbol,
    category: row.category,
    tone: "review",
    summary: copy.summary,
    whyItMatters: copy.why,
    missingData: copy.missing,
    nextOperatorStep: copy.next,
    sourceMode: "missing",
    sourceConfidence: 0,
    shieldHref: `/market-integrity?asset=${safeToken(row.subjectId)}&from=a83-fixture`,
    avatarLabel: row.symbol,
    sources: [],
    chips: ["synthetic", "offline", "not-live", "not-for-sale", row.caseClass.toLowerCase()],
    marketSnapshot: marketSnapshot(row),
  };
}

function tierConfig(policy: A83Policy, tier: A83Tier) {
  const row = policy.tiers.find((candidate) => candidate.depth === tier);
  assert(row, `a83_tier_missing:${tier}`);
  return row;
}

export function validateA83Policy(policy: A83Policy) {
  assert(policy?.revisionId === A83_REVISION, "a83_policy_revision");
  assert(policy?.requiredCaseCount === 50, "a83_policy_cases");
  assert(canonicalJson(policy.locales) === canonicalJson(A83_LOCALES), "a83_policy_locales");
  assert(policy.tiers?.length === 3 && policy.channels?.length === 6, "a83_policy_dimensions");
  assert(policy.fixtureDenominators?.physicalPdfs === 450, "a83_policy_pdf_denominator");
  assert(policy.fixtureDenominators?.renderedPages === 2100, "a83_policy_page_denominator");
  assert(policy.fixtureDenominators?.channelProjections === 2700, "a83_policy_projection_denominator");
  assert(policy.fixtureDenominators?.semanticMutations === 8100, "a83_policy_mutation_denominator");
  assert(policy.closedByA83?.length === 31, "a83_policy_closed_gaps");
}

export function validateA83Catalog(catalog: A83Catalog, policy: A83Policy) {
  validateA83Policy(policy);
  assert(catalog?.revisionId === A83_REVISION, "a83_catalog_revision");
  assert(catalog?.caseCount === 50 && catalog.cases?.length === 50, "a83_catalog_count");
  assert(new Set(catalog.cases.map((row) => row.caseId)).size === 50, "a83_catalog_duplicate_case");
  assert(new Set(catalog.cases.map((row) => row.subjectId)).size === 50, "a83_catalog_duplicate_subject");
  for (const [name, expected] of Object.entries(policy.caseClasses)) {
    assert(catalog.cases.filter((row) => row.caseClass === name).length === expected, `a83_catalog_class:${name}`);
  }
  assert(catalog.boundaries?.synthetic === true && catalog.boundaries?.notLive === true && catalog.boundaries?.notForSale === true, "a83_catalog_boundary");
}

function factsFor(row: A83FixtureCase) {
  return {
    caseId: row.caseId,
    caseClass: row.caseClass,
    subjectId: row.subjectId,
    symbol: row.symbol,
    name: row.name,
    scenario: row.scenario,
    category: row.category,
    assetClass: row.assetClass ?? null,
    sourceMode: "missing",
    sourceConfidence: 0,
    providerFamilies: 0,
    fixtureOnly: true,
    realPacketVerified: false,
  };
}


function stabilizeA83Report(report: LensReport, row: A83FixtureCase, locale: A83Locale, tier: A83Tier, epoch: string) {
  for (const key of ["pass428", "pass429", "pass430", "pass431", "pass432", "pass433", "pass434"]) {
    const section = report[key as keyof LensReport] as unknown;
    if (section && typeof section === "object" && "generatedAt" in section) section.generatedAt = epoch;
  }
  if (report.kernel && typeof report.kernel === "object") {
    report.kernel.traceId = `vlm-lens_${sha256(`${row.caseId}|${locale}|${tier}|${epoch}`).slice(0, 32)}`;
  }
  return report;
}

function claimSetFor(report: LensReport) {
  return {
    title: report.title,
    symbol: report.symbol,
    summary: report.summary,
    whyItMatters: report.whyItMatters,
    missingData: report.missingData,
    nextOperatorStep: report.nextOperatorStep,
    sources: report.sources,
    sourceMode: report.sourceMode,
    sourceConfidence: report.sourceConfidence,
    signature: report.labels?.signature ?? null,
  };
}

export function inspectA83PdfBytes(bytes: Uint8Array, expectedPages: number) {
  const source = Buffer.from(bytes).toString("latin1");
  const pageCount = (source.match(/\/Type\s*\/Page\b/g) ?? []).length;
  const a4PageCount = (source.match(/\/MediaBox\s*\[\s*0\s+0\s+595(?:\.0+)?\s+842(?:\.0+)?\s*\]/g) ?? []).length;
  const banned = ["/JavaScript", "/JS ", "/Launch", "/GoToR", "/EmbeddedFile", "/Filespec", "/OpenAction", "/AA ", "/AcroForm", "/XFA", "/Encrypt", "/URI "];
  const bannedHits = banned.filter((marker) => source.includes(marker));
  return {
    pdfHeader: source.startsWith("%PDF-"),
    eof: source.trimEnd().endsWith("%%EOF"),
    pageCount,
    a4PageCount,
    embeddedFont: /\/FontFile[23]\b/.test(source),
    toUnicode: /\/ToUnicode\b/.test(source),
    bannedHits,
    safe: source.startsWith("%PDF-") && source.trimEnd().endsWith("%%EOF") && pageCount === expectedPages && a4PageCount === expectedPages && /\/FontFile[23]\b/.test(source) && /\/ToUnicode\b/.test(source) && bannedHits.length === 0,
  };
}

function outputPath(policy: A83Policy, row: A83FixtureCase, locale: A83Locale, tier: A83Tier, sequence: number) {
  const file = `${String(sequence).padStart(2, "0")}-${safeToken(row.symbol)}-${tier}-${locale}.pdf`;
  return `${policy.corpusOutput.root}/${locale}/${tier}/${file}`;
}

function reseal<T extends object>(value: T): Omit<T, "integrity"> & { integrity: A83Integrity } {
  const { integrity: _integrity, ...core } = value as T & { integrity?: unknown };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } };
}

export function buildA83Entry(row: A83FixtureCase, locale: A83Locale, tier: A83Tier, policy: A83Policy, sequence: number): {
  entry: A83Entry;
  pdf: Buffer;
  report: LensReport;
} {
  const result = buildA83FixtureSearchResult(row, locale);
  const report = stabilizeA83Report(buildLensReport(result, locale, tier, policy.deterministicEpoch), row, locale, tier, policy.deterministicEpoch);
  report.labels = { ...report.labels, signature: A83_SAFETY_MARKER };
  const pdf = Buffer.from(buildPdf(report, tier));
  const facts = factsFor(row);
  const factDigest = sha256(facts);
  const reportDigest = sha256(report);
  const claimSetDigest = sha256(claimSetFor(report));
  const cfg = tierConfig(policy, tier);
  const inspection = inspectA83PdfBytes(pdf, cfg.pageCount);
  assert(inspection.safe, `a83_pdf_unsafe:${row.caseId}:${locale}:${tier}:${inspection.bannedHits.join(",")}`);
  const projections = A83_CHANNELS.map((channel) => ({
    channel,
    factDigest,
    reportDigest,
    claimSetDigest,
    locale,
    tier,
    addedFacts: 0,
    analysisDecision: "ABSTAIN_MISSING_REAL_EVIDENCE",
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
  }));
  const core = {
    schemaVersion: "velmere.pass36.a83.corpus-entry.v1",
    revisionId: A83_REVISION,
    entryId: `${row.caseId}:${locale}:${tier}`,
    caseId: row.caseId,
    caseClass: row.caseClass,
    subjectId: row.subjectId,
    symbol: row.symbol,
    locale,
    tier,
    tierLabel: cfg.label,
    path: outputPath(policy, row, locale, tier, sequence),
    byteLength: pdf.byteLength,
    pdfSha256: sha256(pdf),
    renderBindingDigest: sha256({ caseId: row.caseId, locale, tier, path: outputPath(policy, row, locale, tier, sequence), pdfSha256: sha256(pdf), byteLength: pdf.byteLength, pageCount: inspection.pageCount, reportDigest }),
    pageCount: inspection.pageCount,
    a4PageCount: inspection.a4PageCount,
    factDigest,
    reportDigest,
    claimSetDigest,
    projectionDigest: sha256(projections),
    projections,
    sourceMode: "missing",
    sourceConfidence: 0,
    fixtureOnly: true,
    realPacketVerified: false,
    rightsApproved: false,
    browserExecuted: false,
    secureDeliveryExecuted: false,
    accessibilityExternallyValidated: false,
    customerComprehensionLabels: 0,
    paidGateEligible: false,
    liveProven: false,
    saleEnabled: false,
    notForSale: true,
    pdfSecurity: inspection,
  };
  return { entry: reseal(core), pdf, report };
}

export function verifyA83EntryRecord(value: A83Entry, policy: A83Policy) {
  try {
    validateA83Policy(policy);
    const { integrity: _, ...core } = value;
    if (value.integrity?.digest !== sha256(core)) return false;
    if (value.revisionId !== A83_REVISION || !A83_LOCALES.includes(value.locale) || !A83_TIERS.includes(value.tier)) return false;
    if (value.entryId !== `${value.caseId}:${value.locale}:${value.tier}`) return false;
    const cfg = tierConfig(policy, value.tier);
    if (value.pageCount !== cfg.pageCount || value.a4PageCount !== cfg.pageCount) return false;
    if (!/^artifacts\/pass36\/a83\/browser-lens-pdf-corpus\/(pl|en|de)\/(basic|pro|advanced)\/[a-z0-9-]+\.pdf$/.test(value.path)) return false;
    if (!/^[a-f0-9]{64}$/.test(value.pdfSha256) || !/^[a-f0-9]{64}$/.test(value.renderBindingDigest) || !/^[a-f0-9]{64}$/.test(value.factDigest) || !/^[a-f0-9]{64}$/.test(value.reportDigest) || !/^[a-f0-9]{64}$/.test(value.claimSetDigest)) return false;
    if (value.projections?.length !== 6 || new Set(value.projections.map((row) => row.channel)).size !== 6) return false;
    if (!A83_CHANNELS.every((channel) => value.projections.some((row) => row.channel === channel))) return false;
    if (!value.projections.every((row) => row.factDigest === value.factDigest && row.reportDigest === value.reportDigest && row.claimSetDigest === value.claimSetDigest && row.locale === value.locale && row.tier === value.tier && row.addedFacts === 0 && row.analysisDecision === "ABSTAIN_MISSING_REAL_EVIDENCE" && row.paidGateEligible === false && row.liveProven === false && row.saleEnabled === false)) return false;
    if (value.projectionDigest !== sha256(value.projections)) return false;
    if (value.renderBindingDigest !== sha256({ caseId: value.caseId, locale: value.locale, tier: value.tier, path: value.path, pdfSha256: value.pdfSha256, byteLength: value.byteLength, pageCount: value.pageCount, reportDigest: value.reportDigest })) return false;
    if (value.sourceMode !== "missing" || value.sourceConfidence !== 0 || value.fixtureOnly !== true || value.realPacketVerified !== false || value.rightsApproved !== false) return false;
    if (value.browserExecuted !== false || value.secureDeliveryExecuted !== false || value.accessibilityExternallyValidated !== false || value.customerComprehensionLabels !== 0) return false;
    if (value.paidGateEligible !== false || value.liveProven !== false || value.saleEnabled !== false || value.notForSale !== true) return false;
    if (value.pdfSecurity?.safe !== true || value.pdfSecurity?.bannedHits?.length !== 0 || value.pdfSecurity?.embeddedFont !== true || value.pdfSecurity?.toUnicode !== true) return false;
    return true;
  } catch {
    return false;
  }
}

function semanticMutations(entry: A83Entry) {
  const mutations: Array<{ id: string; value: A83Entry }> = [];
  const add = (id: string, mutate: (copy: A83Entry) => void) => {
    const copy = structuredClone(entry);
    mutate(copy);
    mutations.push({ id, value: reseal(copy) });
  };
  add("locale", (m) => { m.locale = m.locale === "pl" ? "en" : "pl"; });
  add("tier", (m) => { m.tier = m.tier === "basic" ? "pro" : "basic"; });
  add("case", (m) => { m.caseId = "a83-case-99"; });
  add("fact", (m) => { m.factDigest = "1".repeat(64); });
  add("report", (m) => { m.reportDigest = "2".repeat(64); });
  add("claim", (m) => { m.claimSetDigest = "3".repeat(64); });
  add("projection-remove", (m) => { m.projections.pop(); m.projectionDigest = sha256(m.projections); });
  add("projection-add-fact", (m) => { m.projections[0].addedFacts = 1; m.projectionDigest = sha256(m.projections); });
  add("projection-digest", (m) => { m.projections[0].factDigest = "4".repeat(64); m.projectionDigest = sha256(m.projections); });
  add("pdf-hash", (m) => { m.pdfSha256 = "5".repeat(64); });
  add("page-count", (m) => { m.pageCount += 1; });
  add("source-live", (m) => { m.sourceMode = "live"; });
  add("confidence", (m) => { m.sourceConfidence = 100; });
  add("paid", (m) => { m.paidGateEligible = true; });
  add("sale", (m) => { m.saleEnabled = true; });
  add("not-for-sale", (m) => { m.notForSale = false; });
  add("real-packet", (m) => { m.realPacketVerified = true; });
  add("browser", (m) => { m.browserExecuted = true; });
  return mutations;
}

export function buildA83Corpus(root: string, policy: A83Policy, options: { writeFiles?: boolean } = {}): A83CorpusManifest {
  validateA83Policy(policy);
  const catalogBytes = fs.readFileSync(path.join(root, policy.fixtureCatalog.path));
  assert(sha256(catalogBytes) === policy.fixtureCatalog.sha256, "a83_catalog_hash");
  const catalog = JSON.parse(catalogBytes.toString("utf8")) as A83Catalog;
  validateA83Catalog(catalog, policy);
  const entries: A83Entry[] = [];
  let mutationKilled = 0;
  const mutationFailures: string[] = [];
  const crossLocaleFactMap = new Map<string, string>();
  let sequence = 0;
  for (const row of catalog.cases) {
    for (const locale of A83_LOCALES) {
      for (const tier of A83_TIERS) {
        sequence += 1;
        const built = buildA83Entry(row, locale, tier, policy, sequence);
        if (options.writeFiles) {
          const absolute = path.join(root, built.entry.path);
          fs.mkdirSync(path.dirname(absolute), { recursive: true });
          fs.writeFileSync(absolute, built.pdf);
        }
        entries.push(built.entry);
        const factKey = `${row.caseId}:${tier}`;
        const previous = crossLocaleFactMap.get(factKey);
        if (previous && previous !== built.entry.factDigest) throw new Error(`a83_cross_locale_fact_drift:${factKey}`);
        crossLocaleFactMap.set(factKey, built.entry.factDigest);
        for (const mutation of semanticMutations(built.entry)) {
          if (!verifyA83EntryRecord(mutation.value, policy)) mutationKilled += 1;
          else mutationFailures.push(`${built.entry.entryId}:${mutation.id}`);
        }
      }
    }
  }
  const totals = {
    cases: catalog.cases.length,
    physicalPdfs: entries.length,
    renderedPages: entries.reduce((sum, row) => sum + row.pageCount, 0),
    channelProjections: entries.reduce((sum, row) => sum + row.projections.length, 0),
    semanticMutations: entries.length * 18,
    mutationKilled,
    byLocale: Object.fromEntries(A83_LOCALES.map((locale) => [locale, entries.filter((row) => row.locale === locale).length])),
    byTier: Object.fromEntries(A83_TIERS.map((tier) => [tier, entries.filter((row) => row.tier === tier).length])),
  };
  const core = {
    schemaVersion: "velmere.pass36.a83.browser-lens-pdf-corpus-manifest.v1",
    revisionId: A83_REVISION,
    generatedAt: policy.deterministicEpoch,
    mode: "synthetic_offline_cross_locale_physical_pdf_qa",
    sourceCatalog: { path: policy.fixtureCatalog.path, sha256: policy.fixtureCatalog.sha256 },
    totals,
    classCounts: Object.fromEntries(Object.keys(policy.caseClasses).map((name) => [name, new Set(entries.filter((row) => row.caseClass === name).map((row) => row.caseId)).size])),
    boundaries: { synthetic: true, offline: true, notLive: true, notForSale: true, realPacketCredit: 0, browserCredit: 0, secureDeliveryCredit: 0, accessibilityExternalCredit: 0, comprehensionCredit: 0, paidGateEligible: false, saleEnabled: false },
    mutationFailures,
    entries,
  };
  const manifest = reseal(core);
  if (options.writeFiles) {
    const manifestPath = path.join(root, policy.corpusOutput.manifestPath);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return manifest;
}

export function verifyA83CorpusManifest(root: string, policy: A83Policy, manifest: A83CorpusManifest, expectedDigest?: string) {
  validateA83Policy(policy);
  const { integrity: _, ...core } = manifest;
  if (manifest.integrity?.digest !== sha256(core) || (expectedDigest && manifest.integrity.digest !== expectedDigest)) return { ok: false, reason: "manifest_digest" };
  if (manifest.revisionId !== A83_REVISION || manifest.entries?.length !== 450) return { ok: false, reason: "manifest_denominator" };
  if (manifest.totals?.renderedPages !== 2100 || manifest.totals?.channelProjections !== 2700 || manifest.totals?.semanticMutations !== 8100 || manifest.totals?.mutationKilled !== 8100 || manifest.mutationFailures?.length !== 0) return { ok: false, reason: "manifest_totals" };
  const catalog = JSON.parse(fs.readFileSync(path.join(root, policy.fixtureCatalog.path), "utf8")) as A83Catalog;
  const catalogById = new Map(catalog.cases.map((row) => [row.caseId, row]));
  const seen = new Set<string>();
  const localeFactMap = new Map<string, string>();
  for (let index = 0; index < manifest.entries.length; index += 1) {
    const entry = manifest.entries[index];
    if (!verifyA83EntryRecord(entry, policy) || seen.has(entry.entryId)) return { ok: false, reason: `entry_semantics:${entry.entryId}` };
    seen.add(entry.entryId);
    const row = catalogById.get(entry.caseId);
    if (!row) return { ok: false, reason: `entry_case:${entry.caseId}` };
    const absolute = path.join(root, entry.path);
    if (!fs.existsSync(absolute)) return { ok: false, reason: `entry_missing:${entry.path}` };
    const bytes = fs.readFileSync(absolute);
    if (bytes.byteLength !== entry.byteLength || sha256(bytes) !== entry.pdfSha256) return { ok: false, reason: `entry_bytes:${entry.entryId}` };
    const built = buildA83Entry(row, entry.locale, entry.tier, policy, index + 1);
    if (built.entry.reportDigest !== entry.reportDigest || built.entry.claimSetDigest !== entry.claimSetDigest || built.entry.factDigest !== entry.factDigest || built.entry.pdfSha256 !== entry.pdfSha256 || !Buffer.from(built.pdf).equals(bytes)) return { ok: false, reason: `entry_rerender:${entry.entryId}` };
    const factKey = `${entry.caseId}:${entry.tier}`;
    const previous = localeFactMap.get(factKey);
    if (previous && previous !== entry.factDigest) return { ok: false, reason: `locale_fact_drift:${factKey}` };
    localeFactMap.set(factKey, entry.factDigest);
  }
  return { ok: true, entries: seen.size, totals: manifest.totals };
}

export function evaluateA83RealIntake(index: A83RealIntakeIndex, policy: A83Policy) {
  validateA83Policy(policy);
  assert(index?.revisionId === A83_REVISION && index?.slots?.length === 50, "a83_intake_denominator");
  assert(new Set(index.slots.map((row) => row.slotId)).size === 50, "a83_intake_duplicates");
  for (const [name, expected] of Object.entries(policy.caseClasses)) assert(index.slots.filter((row) => row.caseClass === name).length === expected, `a83_intake_class:${name}`);
  const context = loadRealEvidenceContext(process.cwd());
  const requiredFamilies = [
    ...A83_LOCALES.flatMap((locale) => A83_TIERS.map((tier) => `pdf_${tier}_${locale}`)),
    "packet_source_data", "provider_rights", "freshness_receipt", "production_browser_matrix",
    "secure_delivery", "accessibility_review", "customer_comprehension", "customer_decision_utility",
  ];
  const physicalRows = new Set(index.slots.filter((row) => verifyPhysicalEvidenceFamilies(row, {
    context,
    expectedSubjectId: row.slotId,
    requiredFamilies,
    minimumIndependentOrganizations: 2,
  }).verified).map((row) => row.slotId));
  const counts = {
    requiredCases: 50,
    packetBundles: index.slots.filter((row) => row.packetBundleSupplied === true && physicalRows.has(row.slotId)).length,
    rightsApproved: index.slots.filter((row) => row.rightsApproved === true && physicalRows.has(row.slotId)).length,
    freshnessVerified: index.slots.filter((row) => row.freshnessVerified === true && physicalRows.has(row.slotId)).length,
    browserEvidence: index.slots.filter((row) => row.browserEvidenceReady === true && physicalRows.has(row.slotId)).length,
    secureDeliveryEvidence: index.slots.filter((row) => row.secureDeliveryEvidenceReady === true && physicalRows.has(row.slotId)).length,
    accessibilityEvidence: index.slots.filter((row) => row.accessibilityEvidenceReady === true && physicalRows.has(row.slotId)).length,
    comprehensionLabels: physicalRows.size,
    tierOutputs: physicalRows.size * A83_TIERS.length,
    realPacketReady: index.slots.filter((row) => row.realPacketReady === true && physicalRows.has(row.slotId)).length,
  };
  return { ...counts, decision: counts.packetBundles === 50 && counts.freshnessVerified === 50 && counts.realPacketReady === 50 && counts.rightsApproved === 50 && counts.browserEvidence === 50 && counts.secureDeliveryEvidence === 50 && counts.accessibilityEvidence === 50 && counts.comprehensionLabels === 50 && counts.tierOutputs === 150 ? "READY_FOR_CUSTOMER_VALUE_ADJUDICATION_NOT_SALE" : "BLOCKED_REAL_PACKET_EVIDENCE" };
}
