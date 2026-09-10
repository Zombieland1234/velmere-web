import { NextResponse } from "next/server";
import { pass449ArchitectureDarkMatterGuard } from "@/lib/market-integrity/architecture-dark-matter-guard";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      guard: pass449ArchitectureDarkMatterGuard,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
