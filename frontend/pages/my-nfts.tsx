import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import NftCard from "../components/NftCard";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export default function MyNfts() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.publicKey) return;
    fetchMyNfts();
  }, [wallet.publicKey]);

  async function fetchMyNfts() {
    if (!wallet.publicKey) return;
    setLoading(true);
    try {
      // In production: use @metaplex-foundation/umi to fetch owned NFTs
      // This is a placeholder that shows your address
      setNfts([
        {
          mint: wallet.publicKey.toBase58(),
          name: "Your Wallet",
          image: "https://picsum.photos/id/160/600/600",
          listed: false,
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-4xl font-bold tracking-tight mb-2">My NFTs</h1>
      <p className="text-gray-400 mb-8">
        NFTs owned by {wallet.publicKey ? wallet.publicKey.toBase58().slice(0, 8) + "..." : "your wallet"}
      </p>

      {!wallet.connected ? (
        <div className="text-center py-10 text-gray-500">Connect your wallet to view your collection.</div>
      ) : loading ? (
        <div>Loading your NFTs...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {nfts.length > 0 ? (
            nfts.map((nft, i) => (
              <NftCard
                key={i}
                mint={nft.mint}
                name={nft.name}
                image={nft.image}
                isListed={nft.listed}
              />
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500">
              No NFTs found in this wallet on devnet.
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-xs text-gray-500 max-w-md">
        Tip: Use the Mint page to create new NFTs. Real ownership queries require Metaplex UMI or DAS API.
      </div>
    </Layout>
  );
}
