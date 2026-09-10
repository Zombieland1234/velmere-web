import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./styles/vlm-analysis-tab.css";
import "./styles/premium-ui.css";
import "./styles/final-ui-polish.css";
import "./styles/vlm-luxury-shield.css";
import HtmlLangSync from "@/components/i18n/HtmlLangSync";
import LocalizedSkipLink from "@/components/i18n/LocalizedSkipLink";
import VelmereRouteTransition from "@/components/ui/VelmereRouteTransition";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-velmere-document-locale");
  const locale = requestedLocale === "pl" || requestedLocale === "de" ? requestedLocale : "en";
  return (
    <html lang={locale} suppressHydrationWarning className="no-scrollbar overflow-x-clip antialiased [backface-visibility:hidden]">
      <body className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden font-sans antialiased">
        <HtmlLangSync />
        <LocalizedSkipLink />
        <VelmereRouteTransition />
        {children}
      </body>
    </html>
  );
}

