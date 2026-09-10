export type VelmereLensDestination =
  | "shield"
  | "contract_lens"
  | "vlm_access"
  | "velmere_docs"
  | "osint_queue"
  | "source_ledger";

export type VelmereLensRoute = {
  id: VelmereLensDestination;
  label: string;
  href: string;
  reportHref: string;
  reportTitle: string;
  priority: "P0" | "P1" | "P2";
  capsuleRole: string;
  whatItDoes: string;
  whatItDoesNotDo: string;
  missingBeforeFullTrust: string[];
};

export const velmereLensRoutes: VelmereLensRoute[] = [
  {
    id: "shield",
    label: "Velmère Shield",
    href: "/market-integrity?mode=shield",
    reportHref: "/api/search/lens-report?route=shield&format=html",
    reportTitle: "Shield evidence note",
    priority: "P0",
    capsuleRole: "Full token analysis route",
    whatItDoes: "Opens the full Shield surface with chart, source lanes, VLM brain and risk evidence board.",
    whatItDoesNotDo: "It does not create an investment recommendation or certainty claim.",
    missingBeforeFullTrust: ["live source adapters", "durable source snapshots", "manual review for blocked lanes"],
  },
  {
    id: "contract_lens",
    label: "Contract Lens",
    href: "/market-integrity?mode=contract",
    reportHref: "/api/search/lens-report?route=contract_lens&format=html",
    reportTitle: "Contract Lens note",
    priority: "P0",
    capsuleRole: "Contract-risk route",
    whatItDoes: "Prepares address/chain context for owner, proxy, mint, pause, blacklist and tax checks.",
    whatItDoesNotDo: "It does not accuse a project or mark a contract as proven fraud.",
    missingBeforeFullTrust: ["chain adapter", "address validator", "contract analyzer envelope"],
  },
  {
    id: "vlm_access",
    label: "VLM Access",
    href: "/vlm-token",
    reportHref: "/api/search/lens-report?route=vlm_access&format=html",
    reportTitle: "VLM access note",
    priority: "P1",
    capsuleRole: "Access/utility route",
    whatItDoes: "Explains VLM as an access and utility layer for Velmère surfaces.",
    whatItDoesNotDo: "It does not promise ROI, price performance or public-sale readiness.",
    missingBeforeFullTrust: ["final wallet gate", "access policy", "safe utility wording"],
  },
  {
    id: "velmere_docs",
    label: "Velmère Docs",
    href: "/research-lab?section=docs",
    reportHref: "/api/search/lens-report?route=velmere_docs&format=html",
    reportTitle: "Velmère docs note",
    priority: "P1",
    capsuleRole: "Documentation route",
    whatItDoes: "Routes explanations, policies and research context into calmer docs-like surfaces.",
    whatItDoesNotDo: "It does not replace legal, financial or technical audit advice.",
    missingBeforeFullTrust: ["localized docs index", "source citations", "versioned page map"],
  },
  {
    id: "osint_queue",
    label: "OSINT Queue",
    href: "/market-integrity?mode=osint",
    reportHref: "/api/search/lens-report?route=osint_queue&format=html",
    reportTitle: "OSINT queue note",
    priority: "P1",
    capsuleRole: "Manual-review route",
    whatItDoes: "Marks social, KOL, narrative and disclosure questions as review work.",
    whatItDoesNotDo: "It does not claim bad intent, crime or manipulation as fact.",
    missingBeforeFullTrust: ["source URL ledger", "reviewer identity", "safe paraphrase store"],
  },
  {
    id: "source_ledger",
    label: "Source Ledger",
    href: "/market-integrity?mode=sources",
    reportHref: "/api/search/lens-report?route=source_ledger&format=html",
    reportTitle: "Source ledger note",
    priority: "P0",
    capsuleRole: "Evidence route",
    whatItDoes: "Keeps freshness, timestamp, confidence and fallback state visible.",
    whatItDoesNotDo: "It does not let missing data appear neutral.",
    missingBeforeFullTrust: ["durable storage", "adapter id", "retention policy"],
  },
];

export function createVelmereLensRouteSnapshot() {
  return {
    schemaVersion: "velmere-lens-route-map-v1",
    mode: "router_preview",
    generatedAt: new Date().toISOString(),
    routes: velmereLensRoutes,
    storageWritePerformed: false,
    productionBoundary:
      "Velmère Lens is a command router and short-capsule layer. Full analysis belongs to Shield and source evidence belongs to the ledger.",
  };
}
