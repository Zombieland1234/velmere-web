export type WalletKind = "metamask" | "phantom" | "walletconnect";

export type ConnectedWallet = {
  kind: WalletKind;
  label: string;
  address: string;
  shortAddress: string;
  chainType: "evm" | "solana";
  chainId?: string;
  icon: string;
};

export type WalletConnectionState =
  | "idle"
  | "detecting"
  | "not_installed"
  | "connecting"
  | "connected"
  | "rejected"
  | "unsupported"
  | "error";
