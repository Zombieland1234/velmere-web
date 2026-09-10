import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";
import { mainnet, sepolia, base, polygon } from "viem/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://velmere-store1.vercel.app";

const walletConnectMetadata = {
  name: "Velmère",
  description: "Luxury streetwear, limited drops, and VLM access.",
  url: siteUrl,
  icons: [`${siteUrl}/icon.svg`],
};

const connectors = projectId
  ? [
      injected({ shimDisconnect: true }),
      walletConnect({ projectId, metadata: walletConnectMetadata, showQrModal: true }),
    ]
  : [injected({ shimDisconnect: true })];

export const wagmiConfig = createConfig({
  ssr: true,
  chains: [mainnet, sepolia, base, polygon],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
  },
});
