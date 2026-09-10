import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders } from "./lib/security/http-security.mjs";
import { PASS4666_ACCOUNT_OPERATION_REDIRECTS } from "./lib/security/account-operation-redirects.mjs";
import { PASS4666_PAGE_ALIAS_REDIRECTS } from "./lib/security/page-alias-redirects.mjs";
import { resolveBuildSettings } from "./lib/build/build-profile.mjs";

const withNextIntl = createNextIntlPlugin("./i18n.ts");
const isDev = process.env.NODE_ENV !== "production";
const turbopackDevCacheEnabled = process.env.VELMERE_TURBOPACK_DEV_CACHE === "1";
const buildSettings = resolveBuildSettings(process.env);
const { profile, runtimeBuildScope, runtimeDistDir, runtimeBuildId, outputStandalone, turbopackMemoryLimit } = buildSettings;
const webpackPersistentCacheEnabled = process.env.VELMERE_BUILD_WEBPACK_PERSISTENT_CACHE === "1";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const a60RuntimeProbeSha256 = /^[a-f0-9]{64}$/u.test(process.env.VELMERE_A60_RUNTIME_PROBE_SHA256 ?? "")
  ? process.env.VELMERE_A60_RUNTIME_PROBE_SHA256
  : null;

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: false,
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./lib/build/empty-optional-module.mjs",
      ws: { browser: "./lib/build/empty-optional-module.mjs" },
    },
  },
  webpack(config, { dev }) {
    if (!dev && runtimeBuildScope === "webpack" && !webpackPersistentCacheEnabled) {
      config.cache = false;
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ["@wagmi/connectors", "framer-motion", "lucide-react"],
    turbopackFileSystemCacheForBuild: false,
    serverSourceMaps: false,
    preloadEntriesOnStart: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "dd.dexscreener.com" },
      { protocol: "https", hostname: "s2.coinmarketcap.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "tokens.1inch.io" },
    ],
    qualities: [75, 85, 90, 100],
    unoptimized: false,
  },
  async headers() {
    // A request-scoped strict CSP is attached in proxy.ts for rendered
    // documents. Static configuration keeps the remaining headers on every
    // response without introducing a second, weaker CSP policy.
    return [{
      source: "/:path*",
      headers: [
        ...buildSecurityHeaders({ isDev, includeContentSecurityPolicy: false }),
        ...(a60RuntimeProbeSha256 ? [{ key: "X-Velmere-A60-Runtime-Probe", value: a60RuntimeProbeSha256 }] : []),
      ],
    }];
  },
  async redirects() {
    return [
      ...PASS4666_PAGE_ALIAS_REDIRECTS,
      ...PASS4666_ACCOUNT_OPERATION_REDIRECTS,
    ];
  },
};

export default withNextIntl(nextConfig);
