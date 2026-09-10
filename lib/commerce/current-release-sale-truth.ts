import authoritySource from "../../config/pass36/current-release-authority.json" with { type: "json" };

type ReleaseClaims = {
  decision?: string;
  liveProven?: boolean;
  saleEnabled?: boolean;
  productionApproved?: boolean;
  customerPurchaseWorthinessProven?: boolean;
};

const claims = authoritySource.claims as ReleaseClaims;

export const CURRENT_RELEASE_PUBLIC_SALE_TRUTH = Object.freeze({
  revisionId: authoritySource.authorityRevisionId,
  decision: claims.decision ?? "NO_GO",
  liveProven: claims.liveProven === true,
  saleEnabled: claims.saleEnabled === true,
  productionApproved: claims.productionApproved === true,
  customerPurchaseWorthinessProven:
    claims.customerPurchaseWorthinessProven === true,
  paidOfferAllowed:
    claims.decision !== "NO_GO"
    && claims.liveProven === true
    && claims.saleEnabled === true
    && claims.productionApproved === true
    && claims.customerPurchaseWorthinessProven === true,
});
