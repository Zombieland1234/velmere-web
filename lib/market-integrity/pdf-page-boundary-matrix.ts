export type Pass574PageId = "decision" | "evidence" | "analysis" | "boundaries";
export type Pass574PageBoundary = { id: Pass574PageId; characterBudget: number; measuredCharacters: number; density: number; state: "ready" | "review" | "blocked" };
export type Pass574PdfPageBoundaryMatrix = { version: "pdf-page-boundary-matrix"; status: "ready" | "review" | "blocked"; collisions: number; pages: Pass574PageBoundary[]; maxDensity: number; boundary: string };
const budgets: Record<Pass574PageId, number> = { decision: 2300, evidence: 3200, analysis: 3400, boundaries: 2800 };
const compact = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
export function buildPass574PdfPageBoundaryMatrix(input: Record<Pass574PageId, readonly string[]>): Pass574PdfPageBoundaryMatrix {
  const pages = (Object.keys(budgets) as Pass574PageId[]).map((id) => {
    const measuredCharacters = input[id].reduce((total, value) => total + compact(value).length, 0);
    const density = Math.round((measuredCharacters / budgets[id]) * 100);
    return { id, characterBudget: budgets[id], measuredCharacters, density, state: density > 118 ? "blocked" : density > 96 ? "review" : "ready" } satisfies Pass574PageBoundary;
  });
  const collisions = pages.filter((page) => page.state === "blocked").length;
  const reviews = pages.filter((page) => page.state === "review").length;
  return { version: "pdf-page-boundary-matrix", status: collisions ? "blocked" : reviews ? "review" : "ready", collisions, pages, maxDensity: Math.max(...pages.map((page) => page.density), 0), boundary: "Page budgets are deterministic layout guards. Long identifiers wrap; public Reader QA never overlays the A4 document." };
}
