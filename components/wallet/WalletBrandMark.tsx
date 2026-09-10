"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export const WALLET_BRAND_REGISTRY = {
  metamask: { label: "MetaMask", local: "/wallets/metamask.svg", domain: "metamask.io", accent: "#ff5c16", fallback: "MM" },
  phantom: { label: "Phantom", local: "/wallets/phantom.svg", domain: "phantom.com", accent: "#ab9ff2", fallback: "PH" },
  walletconnect: { label: "WalletConnect", local: "/wallets/walletconnect.svg", domain: "walletconnect.com", accent: "#3b99fc", fallback: "WC" },
  coinbase: { label: "Coinbase Wallet", local: "/wallets/coinbase.svg", domain: "coinbase.com", accent: "#0052ff", fallback: "CB" },
  okx: { label: "OKX Wallet", local: "/wallets/okx.svg", domain: "okx.com", accent: "#f4f4f0", fallback: "OK" },
  ledger: { label: "Ledger Live", local: "/wallets/ledger.svg", domain: "ledger.com", accent: "#f4f4f0", fallback: "LD" },
  rabby: { label: "Rabby", domain: "rabby.io", accent: "#8697ff", fallback: "RA" },
  trust: { label: "Trust Wallet", domain: "trustwallet.com", accent: "#3375bb", fallback: "TW" },
  rainbow: { label: "Rainbow", domain: "rainbow.me", accent: "#ffcf59", fallback: "RB" },
  safe: { label: "Safe", domain: "safe.global", accent: "#12ff80", fallback: "SF" },
  zerion: { label: "Zerion", domain: "zerion.io", accent: "#2962ef", fallback: "ZR" },
  browser: { label: "Browser wallet", accent: "#c8a96a", fallback: "↗" },
  wallet: { label: "Wallet", accent: "#c8a96a", fallback: "W" },
} as const;

export type WalletBrandKey = keyof typeof WALLET_BRAND_REGISTRY;

function isWalletBrandKey(value: string): value is WalletBrandKey {
  return value in WALLET_BRAND_REGISTRY;
}

export default function WalletBrandMark({
  brand,
  size = 32,
  className = "",
}: {
  brand: string;
  size?: number;
  className?: string;
}) {
  const key: WalletBrandKey = isWalletBrandKey(brand) ? brand : "wallet";
  const entry = WALLET_BRAND_REGISTRY[key];
  const candidates = useMemo(() => {
    const items: string[] = [];
    if ("local" in entry && entry.local) items.push(entry.local);
    if ("domain" in entry && entry.domain) {
      items.push(`/api/market-integrity/brand-icon?domain=${encodeURIComponent(entry.domain)}`);
    }
    return items;
  }, [entry]);
  const candidateKey = `${key}:${candidates.join("|")}`;
  const [imageState, setImageState] = useState({ key: candidateKey, index: 0, loaded: false });
  const activeState = imageState.key === candidateKey
    ? imageState
    : { key: candidateKey, index: 0, loaded: false };
  const src = candidates[activeState.index];

  return (
    <span
      className={`vlm-wallet-brand-mark ${className}`}
      style={{ width: size, height: size, "--wallet-brand-accent": entry.accent } as React.CSSProperties}
      aria-hidden="true"
      data-wallet-brand={key}
      data-wallet-brand-loaded={activeState.loaded ? "true" : "false"}
      data-wallet-brand-source={src ? (src.startsWith("/wallets/") ? "official-local" : "official-domain") : "monogram-fallback"}
    >
      <span className="vlm-wallet-brand-fallback">{entry.fallback}</span>
      {src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          unoptimized
          className={activeState.loaded ? "is-loaded" : ""}
          onLoad={() => setImageState({ key: candidateKey, index: activeState.index, loaded: true })}
          onError={() => setImageState({ key: candidateKey, index: activeState.index + 1, loaded: false })}
        />
      ) : null}
    </span>
  );
}
