import { ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Head>
        <title>NFTBAY — Decentralized NFT Marketplace</title>
        <meta name="description" content="Trade NFTs freely on Solana. Mint, list, and buy digital collectibles." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0f] text-[#ededed]">
        <nav className="border-b border-[#22222a] bg-[#0a0a0f]/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00f0ff] to-[#ff00aa]" />
                <span className="font-bold tracking-[3px] text-xl">NFTBAY</span>
              </Link>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <Link href="/" className="hover:text-[#00f0ff] transition-colors">Marketplace</Link>
                <Link href="/mint" className="hover:text-[#00f0ff] transition-colors">Mint</Link>
                <Link href="/sell" className="hover:text-[#00f0ff] transition-colors">Sell</Link>
                <Link href="/my-nfts" className="hover:text-[#00f0ff] transition-colors">My NFTs</Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <WalletMultiButton
                style={{
                  backgroundColor: "#1f1f28",
                  color: "#fff",
                  borderRadius: "8px",
                  fontSize: "14px",
                  height: "40px",
                }}
              />
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>

        <footer className="border-t border-[#22222a] mt-12 py-8 text-center text-xs text-gray-500">
          NFTBAY • Built on Solana • Trade freely
        </footer>
      </div>
    </>
  );
}
