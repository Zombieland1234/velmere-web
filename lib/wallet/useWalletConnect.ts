"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance, useChainId, useConnect, useDisconnect } from "wagmi";
import type { WalletKind, ConnectedWallet, WalletConnectionState } from "./types";
import { clearWalletUiSnapshot, setWalletUiSnapshot } from "@/store/useWalletUiStore";
import { consumePendingMobileWallet, isMobileViewport, openMetaMaskMobileDapp, openPhantomMobileBrowser } from "@/lib/wallet/mobile-deeplinks";
import { openSafeExternalBrowserWindow } from "@/lib/security/browser-external-navigation";

type EvmEventProvider = {
  on?: (event: "accountsChanged" | "chainChanged", listener: (payload: unknown) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: (payload: unknown) => void) => void;
};

type PhantomSolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string } | null;
  connect: (args?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
};

declare global {
  interface Window {
    phantom?: { solana?: PhantomSolanaProvider; ethereum?: unknown };
    solana?: PhantomSolanaProvider;
    ethereum?: unknown;
  }
}

function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNativeBalance(value?: bigint, symbol = "ETH") {
  if (typeof value !== "bigint") return `0.0000 ${symbol}`;
  const formatted = Number(formatEther(value));
  if (!Number.isFinite(formatted)) return `0.0000 ${symbol}`;
  return `${formatted.toFixed(4)} ${symbol}`;
}

function isMetaMaskConnector(connectorName: string) {
  return /metamask|injected/i.test(connectorName);
}

function isWalletConnectConnector(connectorName: string) {
  return /walletconnect|wallet connect/i.test(connectorName);
}

function getPhantomProvider() {
  if (typeof window === "undefined") return undefined;
  const provider = window.phantom?.solana ?? window.solana;
  return provider?.isPhantom ? provider : undefined;
}

function hasEvmProvider() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function getEvmEventProvider(): EvmEventProvider | undefined {
  if (typeof window === "undefined" || !window.ethereum) return undefined;
  return window.ethereum as EvmEventProvider;
}

export function useWalletConnect() {
  const { address, connector, isConnected, isConnecting } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [phantomAddress, setPhantomAddress] = useState<string | null>(null);
  const [phantomConnecting, setPhantomConnecting] = useState(false);
  const [phantomDetected, setPhantomDetected] = useState(false);
  const [lastError, setLastError] = useState<WalletConnectionState | null>(null);
  const autoAttempted = useRef(false);

  const metamaskConnector = useMemo(
    () => connectors.find((item: { name: string }) => isMetaMaskConnector(item.name)) ?? connectors[0],
    [connectors],
  );
  const walletConnectConnector = useMemo(
    () => connectors.find((item: { name: string }) => isWalletConnectConnector(item.name)),
    [connectors],
  );

  const connectedWallet = useMemo<ConnectedWallet | null>(() => {
    if (phantomAddress) {
      return {
        kind: "phantom",
        label: "Phantom",
        address: phantomAddress,
        shortAddress: shortenAddress(phantomAddress),
        chainType: "solana",
        chainId: "solana-mainnet",
        icon: "PH",
      };
    }

    if (!isConnected || !address) return null;
    return {
      kind: connector?.name && isWalletConnectConnector(connector.name) ? "walletconnect" : "metamask",
      label: connector?.name ?? "Wallet",
      address,
      shortAddress: shortenAddress(address),
      chainType: "evm",
      chainId: chainId ? String(chainId) : undefined,
      icon: "0x",
    };
  }, [address, chainId, connector, isConnected, phantomAddress]);

  const state: WalletConnectionState = connectedWallet
    ? "connected"
    : isConnecting || phantomConnecting
      ? "connecting"
      : error || lastError
        ? "rejected"
        : "idle";

  const connectMetaMask = useCallback(async () => {
    setLastError(null);
    if (connectedWallet) return;

    if (!hasEvmProvider() && isMobileViewport()) {
      openMetaMaskMobileDapp();
      return;
    }

    if (!metamaskConnector) {
      setLastError("not_installed");
      if (isMobileViewport()) openMetaMaskMobileDapp();
      return;
    }

    try {
      await connectAsync({ connector: metamaskConnector });
    } catch {
      setLastError("rejected");
    }
  }, [connectAsync, connectedWallet, metamaskConnector]);

  const connectPhantom = useCallback(async () => {
    setLastError(null);
    if (connectedWallet) return;
    const provider = getPhantomProvider();

    if (!provider) {
      if (isMobileViewport()) {
        openPhantomMobileBrowser();
        return;
      }
      openSafeExternalBrowserWindow("https://phantom.app/download", { profile: "wallet_install" });
      setLastError("not_installed");
      return;
    }

    setPhantomConnecting(true);
    try {
      const response = await provider.connect();
      const nextAddress = response.publicKey.toString();
      setPhantomAddress(nextAddress);
    } catch {
      setLastError("rejected");
    } finally {
      setPhantomConnecting(false);
    }
  }, [connectedWallet]);

  const connectWalletConnect = useCallback(async () => {
    setLastError(null);
    if (connectedWallet) return;

    if (!walletConnectConnector) {
      setLastError("unsupported");
      return;
    }

    try {
      await connectAsync({ connector: walletConnectConnector });
    } catch {
      setLastError("rejected");
    }
  }, [connectAsync, connectedWallet, walletConnectConnector]);

  useEffect(() => {
    const detect = () => setPhantomDetected(Boolean(getPhantomProvider()));
    detect();
    const timer = window.setTimeout(detect, 800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (autoAttempted.current || connectedWallet) return;
    const pending = consumePendingMobileWallet();
    if (!pending) return;
    autoAttempted.current = true;
    const timer = window.setTimeout(() => {
      if (pending === "metamask") void connectMetaMask();
      if (pending === "phantom") void connectPhantom();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [connectMetaMask, connectPhantom, connectedWallet]);

  useEffect(() => {
    if (!connectedWallet) {
      clearWalletUiSnapshot();
      return;
    }

    const isPhantom = connectedWallet.kind === "phantom";
    setWalletUiSnapshot({
      connected: true,
      walletLabel: connectedWallet.label,
      shortAddress: connectedWallet.shortAddress,
      fullAddress: connectedWallet.address,
      chainType: connectedWallet.chainType,
      network: isPhantom ? "Solana / Phantom" : connectedWallet.chainId ? `Chain ${connectedWallet.chainId}` : "EVM",
      tokenBalanceLabel: isPhantom ? "SOL balance linked" : formatNativeBalance(balance?.value, balance?.symbol ?? "ETH"),
      accessStatusLabel: isPhantom ? "phantom-linked access" : "wallet-linked access",
    });
  }, [balance?.symbol, balance?.value, connectedWallet]);

  const connect = useCallback(
    (kind: WalletKind) => {
      if (connectedWallet) return Promise.resolve();
      if (kind === "metamask") return connectMetaMask();
      if (kind === "walletconnect") return connectWalletConnect();
      return connectPhantom();
    },
    [connectMetaMask, connectPhantom, connectWalletConnect, connectedWallet],
  );

  const disconnectWallet = useCallback(() => {
    const provider = getPhantomProvider();
    if (phantomAddress && provider?.disconnect) void provider.disconnect().catch(() => undefined);
    setPhantomAddress(null);
    disconnect();
    clearWalletUiSnapshot();
  }, [disconnect, phantomAddress]);

  useEffect(() => {
    const provider = getEvmEventProvider();
    if (!provider?.on) return;

    const resetEvmSession = () => {
      setLastError(null);
      clearWalletUiSnapshot();
      disconnect();
    };

    const onAccountsChanged = (payload: unknown) => {
      const nextAddress = Array.isArray(payload) && typeof payload[0] === "string" ? payload[0].toLowerCase() : "";
      const currentAddress = address?.toLowerCase() ?? "";
      if (!nextAddress || (currentAddress && nextAddress !== currentAddress)) resetEvmSession();
    };

    const onChainChanged = () => {
      clearWalletUiSnapshot();
    };

    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [address, disconnect]);

  return {
    state,
    connectedWallet,
    detectedWallets: {
      metamask: Boolean(metamaskConnector),
      phantom: phantomDetected,
      walletconnect: Boolean(walletConnectConnector),
    },
    connect,
    disconnect: disconnectWallet,
    connectMetaMask,
    connectPhantom,
    connectWalletConnect,
  };
}
