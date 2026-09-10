import {
  auditPass469A4Regions,
  buildPass469A4Layout,
  type Pass469A4Region,
} from "./pdf-a4-download-receipt";

export type Pass4648PageTwoDensityLayout = {
  schemaVersion: "pass4648_pdf_page_two_density_v1";
  sourceCount: number;
  sourceState: Pass469A4Region | null;
  brief: Pass469A4Region | null;
  missing: Pass469A4Region | null;
  audit: { ok: boolean; errors: string[] };
};

function region(id: string, top: number, height: number): Pass469A4Region {
  return { id, page: 2, top, height };
}

export function buildPass4648PageTwoDensityLayout(sourceCountInput: number): Pass4648PageTwoDensityLayout {
  const sourceCount = Math.max(0, Math.min(4, Math.floor(sourceCountInput)));
  const base = buildPass469A4Layout("basic", sourceCount);
  let sourceState: Pass469A4Region | null = null;
  let brief: Pass469A4Region | null = null;
  let missing: Pass469A4Region | null = null;

  if (sourceCount === 0) {
    sourceState = region("page2-pass4648-source-state", 724, 54);
    brief = region("page2-pass4648-asset-brief", 654, 80);
    missing = region("page2-pass4648-missing-data", 558, 78);
  } else if (sourceCount === 1) {
    brief = region("page2-pass4648-asset-brief", 660, 80);
    missing = region("page2-pass4648-missing-data", 564, 82);
  } else if (sourceCount === 2) {
    brief = region("page2-pass4648-asset-brief", 598, 110);
  }

  const pageTwoBaseRegions = base.regions.filter((item) => item.page === 2);
  const audit = auditPass469A4Regions([
    ...pageTwoBaseRegions,
    ...[sourceState, brief, missing].filter((item): item is Pass469A4Region => Boolean(item)),
  ]);
  if (!audit.ok) {
    throw new Error(`PASS4648 page-two density rejected: ${audit.errors.join(" | ")}`);
  }

  return {
    schemaVersion: "pass4648_pdf_page_two_density_v1",
    sourceCount,
    sourceState,
    brief,
    missing,
    audit,
  };
}
