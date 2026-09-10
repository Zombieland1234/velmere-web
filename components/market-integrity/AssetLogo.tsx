"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  resolveVelmereAssetLogo,
  type VelmereAssetLogoInput,
} from "@/lib/market-integrity/asset-logo-resolver";

type AssetLogoProps = VelmereAssetLogoInput & {
  asset?: Partial<VelmereAssetLogoInput> & Record<string, unknown>;
  className?: string;
  compact?: boolean;
  large?: boolean;
  eager?: boolean;
};

function assetCategoryToLogoClass(value: unknown): VelmereAssetLogoInput["assetClass"] | undefined {
  const clean = String(value ?? "").trim().toLowerCase();
  if (clean === "stocks") return "stock";
  if (clean === "indices") return "index";
  if (clean === "commodities") return "commodity";
  if (clean === "real_estate") return "real_estate";
  if (clean === "exchanges") return "exchange";
  if (clean === "crypto") return "crypto";
  if (clean === "etf" || clean === "fx") return clean;
  return undefined;
}

export default function AssetLogo({
  asset,
  className = "",
  compact = false,
  large = false,
  eager = false,
  ...input
}: AssetLogoProps) {
  const assetRecord = (asset ?? {}) as Partial<VelmereAssetLogoInput> & Record<string, unknown>;
  const mergedInput = {
    ...assetRecord,
    ...input,
    assetClass: input.assetClass ?? assetRecord.assetClass ?? assetCategoryToLogoClass(assetRecord.category),
    venue: input.venue ?? assetRecord.venue ?? assetRecord.exchange ?? assetRecord.name,
  } as VelmereAssetLogoInput;
  const {
    assetClass,
    domain,
    icon,
    id,
    image,
    imageUrl,
    logo,
    name,
    providerSymbol,
    symbol,
    venue,
  } = mergedInput;
  const resolution = useMemo(
    () =>
      resolveVelmereAssetLogo({
        assetClass,
        domain,
        icon,
        id,
        image,
        imageUrl,
        logo,
        name,
        providerSymbol,
        symbol,
        venue,
      }),
    [assetClass, domain, icon, id, image, imageUrl, logo, name, providerSymbol, symbol, venue],
  );
  const imageCandidatesKey = resolution.imageCandidates.join("|");
  const logoRef = useRef<HTMLSpanElement>(null);
  const [nearViewport, setNearViewport] = useState(eager);
  const [imageState, setImageState] = useState({
    key: imageCandidatesKey,
    candidateIndex: 0,
    loaded: false,
  });
  const activeImageState = imageState.key === imageCandidatesKey
    ? imageState
    : { key: imageCandidatesKey, candidateIndex: 0, loaded: false };
  const candidateIndex = activeImageState.candidateIndex;
  const loaded = activeImageState.loaded;
  const src = resolution.imageCandidates[candidateIndex];
  const visuallyReady = loaded;
  const advanceCandidate = useCallback(() => {
    setImageState((current) => {
      const currentIndex = current.key === imageCandidatesKey ? current.candidateIndex : 0;
      return { key: imageCandidatesKey, candidateIndex: currentIndex + 1, loaded: false };
    });
  }, [imageCandidatesKey]);

  useEffect(() => {
    if (eager || nearViewport) return undefined;
    const node = logoRef.current;
    if (!node) return undefined;

    const IntersectionObserverCtor = window.IntersectionObserver;
    if (typeof IntersectionObserverCtor !== "function") {
      const id = window.setTimeout(() => setNearViewport(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserverCtor(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "420px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, nearViewport]);

  useEffect(() => {
    if (!src || visuallyReady || (!eager && !nearViewport)) return undefined;
    const timeout = window.setTimeout(advanceCandidate, 2400);
    return () => window.clearTimeout(timeout);
  }, [advanceCandidate, eager, nearViewport, src, visuallyReady]);

  const sourceKind = !src
    ? "badge"
    : src.startsWith("/market-logos/")
      ? "canonical-local"
      : src.includes("/brand-icon?")
        ? "issuer-domain"
        : src.includes("cdn.simpleicons.org")
          ? "curated-brand"
          : src.includes("/asset-logo?")
            ? "market-provider"
            : "provider-image";

  return (
    <span
      ref={logoRef}
      className={`velmere-asset-logo velmere-asset-logo-${resolution.tone} ${compact ? "velmere-asset-logo-compact" : ""} ${large ? "velmere-asset-logo-large" : ""} relative overflow-hidden ${className}`}
      role="img"
      aria-label={`${resolution.label} logo`}
      data-logo-source={sourceKind}
      data-logo-loaded={visuallyReady ? "true" : "false"}
      data-logo-symbol={resolution.symbol}
      data-asset-class={assetClass ?? "market"}
      data-logo-near-viewport={nearViewport ? "true" : "false"}
      data-logo-candidate-count={resolution.imageCandidates.length}
      data-logo-exhausted={!src && resolution.imageCandidates.length > 0 ? "true" : "false"}
      data-pass4630-logo-state="candidate-key-synchronous-local-static-first-paint"
      data-pass4635-logo-authority="canonical-local-first-remote-fallback-glyph-last"
      data-pass1998-logo-glyph-policy="hide-fallback-glyph-while-any-image-candidate-exists"
      data-pass2508-no-frame-icon-parity="provider-or-labeled-fallback-no-decorative-frame"
      data-pass2508-logo-kind={src ? (candidateIndex === 0 ? "provider" : "fallback-image") : "fallback-badge"}
      data-pass2508-logo-resolution={`${resolution.symbol}:${resolution.tone}`}
      data-pass4576-logo-authority="local-top-asset-first-no-random-provider-flash"
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={compact ? "24px" : "48px"}
          loading={eager || nearViewport ? "eager" : "lazy"}
          priority={eager}
          unoptimized
          className={visuallyReady ? "is-loaded" : ""}
          onLoad={() => {
            setImageState({ key: imageCandidatesKey, candidateIndex, loaded: true });
          }}
          onError={advanceCandidate}
        />
      ) : null}
      {!visuallyReady ? (
        <span className="velmere-asset-logo-fallback" aria-hidden="true">
          {resolution.glyph}
        </span>
      ) : null}
    </span>
  );
}
