import type {
  Pass580Density,
  Pass580Depth,
  Pass580Locale,
  Pass580PdfVisualFixture,
} from "./pdf-visual-fixtures";
import {
  pageCountForDepth,
  type LensTierPageCount,
} from "./lens-tier-page-count";

export type Pass592ChromiumFixtureCase = {
  fixtureId: string;
  locale: Pass580Locale;
  depth: Pass580Depth;
  density: Pass580Density;
  expectedPages: LensTierPageCount;
  expectedFieldBudget: 10 | 14 | 20;
  expectedSourceRows: number;
  screenshotName: string;
  pdfName: string;
};

export type Pass592ChromiumFixturePlan = {
  version: "chromium-visual-fixture-runner";
  engine: "chromium";
  nodeContract: "20.x";
  fixtureCount: 27;
  cases: Pass592ChromiumFixtureCase[];
  boundary: string;
};

export type Pass592ChromiumFixtureResult = {
  fixtureId: string;
  screenshotSha256: string;
  pdfSha256: string;
  renderedPages: number;
  viewport: { width: number; height: number };
  state: "pass" | "review" | "fail";
  reasons: string[];
};

export type Pass592ChromiumFixtureReceipt = {
  version: "pass592-chromium-visual-fixture-receipt";
  fixtureId: string;
  proofRef: string;
  expectedPages: LensTierPageCount;
  expectedFieldBudget: 10 | 14 | 20;
  state: "planned";
  boundary: string;
};

function safeName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

export function buildPass592ChromiumFixturePlan(
  fixtures: readonly Pass580PdfVisualFixture[],
): Pass592ChromiumFixturePlan {
  const cases = fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    locale: fixture.locale,
    depth: fixture.depth,
    density: fixture.density,
    expectedPages: fixture.expectedPages,
    expectedFieldBudget: fixture.expectedFieldBudget,
    expectedSourceRows: fixture.expectedSourceRows,
    screenshotName: `${safeName(fixture.id)}.png`,
    pdfName: `${safeName(fixture.id)}.pdf`,
  }));

  return {
    version: "chromium-visual-fixture-runner",
    engine: "chromium",
    nodeContract: "20.x",
    fixtureCount: 27,
    cases,
    boundary:
      "The runner renders all 27 locale, depth and density fixtures in Chromium, records PNG/PDF hashes and rejects page-count or viewport failures. CI remains responsible for executing it under Node.js 20.x.",
  };
}

export function assessPass592ChromiumFixture(input: {
  fixture: Pass592ChromiumFixtureCase;
  screenshotSha256: string;
  pdfSha256: string;
  renderedPages: number;
  viewport: { width: number; height: number };
}): Pass592ChromiumFixtureResult {
  const reasons: string[] = [];
  if (!/^[a-f0-9]{64}$/i.test(input.screenshotSha256)) {
    reasons.push("missing_screenshot_hash");
  }
  if (!/^[a-f0-9]{64}$/i.test(input.pdfSha256)) {
    reasons.push("missing_pdf_hash");
  }
  if (input.renderedPages !== input.fixture.expectedPages) {
    reasons.push("pdf_page_count_mismatch");
  }
  if (input.viewport.width < 1000 || input.viewport.height < 1400) {
    reasons.push("fixture_viewport_too_small");
  }

  return {
    fixtureId: input.fixture.fixtureId,
    screenshotSha256: input.screenshotSha256,
    pdfSha256: input.pdfSha256,
    renderedPages: input.renderedPages,
    viewport: input.viewport,
    state: reasons.length ? "fail" : "pass",
    reasons,
  };
}

export function buildPass592ChromiumFixtureReceipt(input: {
  fixtureId: string;
  depth: Pass580Depth;
  expectedFieldBudget: 10 | 14 | 20;
}): Pass592ChromiumFixtureReceipt {
  return {
    version: "pass592-chromium-visual-fixture-receipt",
    fixtureId: input.fixtureId,
    proofRef: `PASS592:${input.fixtureId}`,
    expectedPages: pageCountForDepth(input.depth),
    expectedFieldBudget: input.expectedFieldBudget,
    state: "planned",
    boundary:
      "This report carries the exact fixture identity consumed by the Chromium proof runner; a runtime report does not claim that CI has executed the fixture.",
  };
}
