import { ImageResponse } from "next/og";
import { resolveLocale } from "@/lib/seo/metadata";

export const runtime = "nodejs";
export const alt = "Velmère luxury streetwear";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const localized = {
  pl: "Luxury streetwear and VLM access",
  en: "Luxury streetwear and VLM access",
  de: "Luxury streetwear and VLM access",
};

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080809",
          color: "#F5F0E8",
          padding: 72,
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ letterSpacing: 18, fontSize: 28, color: "#C8A96A" }}>VELMÈRE</div>
          <div style={{ letterSpacing: 8, fontSize: 18, color: "rgba(245,240,232,0.52)" }}>{locale.toUpperCase()}</div>
        </div>
        <div>
          <div style={{ width: 180, height: 1, background: "#C8A96A", marginBottom: 34 }} />
          <div style={{ fontSize: 78, lineHeight: 0.96, maxWidth: 850, fontFamily: "serif" }}>{localized[locale]}</div>
          <div style={{ marginTop: 30, fontSize: 22, letterSpacing: 8, color: "rgba(245,240,232,0.58)" }}>PRIVATE DIGITAL LAYER</div>
        </div>
      </div>
    ),
    size,
  );
}
