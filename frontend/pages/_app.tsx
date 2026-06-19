import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// Note: Some wallet adapters (Ledger) can cause transient ESM resolution errors.
// We intentionally only include Phantom + Solflare for a clean dev experience.

// SpaceX-inspired NFTBAY theme active

const network = WalletAdapterNetwork.Devnet;
const endpoint = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export default function App({ Component, pageProps }: AppProps) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Component {...pageProps} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
