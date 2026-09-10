import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Velmère",
    short_name: "Velmère",
    description: "Luxury streetwear, limited drops, and VLM access.",
    start_url: "/pl",
    display: "standalone",
    background_color: "#030303",
    theme_color: "#030303",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
