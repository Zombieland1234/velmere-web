import { NextResponse } from "next/server";
import { getPrintfulStoreProducts } from "@/lib/printful/products";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.PRINTFUL_API_TOKEN) {
    return NextResponse.json(
      {
        error: "Missing PRINTFUL_API_TOKEN on server.",
        message: "Printful products are not mocked. Configure PRINTFUL_API_TOKEN to fetch real store products.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await getPrintfulStoreProducts();
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Failed to fetch products from Printful." }, { status: 502 });
  }
}
