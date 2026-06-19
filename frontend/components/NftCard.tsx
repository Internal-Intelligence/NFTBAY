import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getProgram } from "../lib/anchor";

interface NftCardProps {
  mint: string;
  name: string;
  image: string;
  price?: number; // lamports or SOL
  seller?: string;
  isListed?: boolean;
  onAction?: () => void;
}

export default function NftCard({
  mint,
  name,
  image,
  price,
  seller,
  isListed = false,
  onAction,
}: NftCardProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);

  const priceSol = price ? (price / 1_000_000_000).toFixed(2) : null;

  async function handleBuy() {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setLoading(true);
    try {
      const program = getProgram(wallet as any, connection);
      const mintPk = new PublicKey(mint);

      // Note: In a real flow we would fetch the listing PDA and call buy_nft
      // This is a stub that shows the intent.
      alert("Buy flow connected to on-chain program. Full implementation uses program.methods.buyNft()");
      // TODO: implement full buy transaction here
      onAction?.();
    } catch (e) {
      console.error(e);
      alert("Buy failed. See console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="aspect-square bg-black relative">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://picsum.photos/id/1015/600/600";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">No image</div>
        )}

        {isListed && priceSol && (
          <div className="absolute top-3 right-3 bg-black/70 text-[#00f0ff] text-sm font-mono px-3 py-1 rounded-full">
            ◎ {priceSol}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="font-medium truncate">{name || "Unnamed NFT"}</div>
        <div className="text-xs text-gray-500 font-mono mt-0.5 truncate">{mint.slice(0, 8)}...{mint.slice(-6)}</div>

        {isListed && seller && (
          <div className="mt-3 text-xs text-gray-400">
            Listed by <span className="font-mono">{seller.slice(0, 4)}...{seller.slice(-4)}</span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {isListed && price ? (
            <button
              onClick={handleBuy}
              disabled={loading || !wallet.connected}
              className="btn-primary flex-1 disabled:opacity-50 text-sm"
            >
              {loading ? "Processing..." : "Buy Now"}
            </button>
          ) : (
            <button
              onClick={() => window.location.href = `/mint?mint=${mint}`}
              className="btn-secondary flex-1 text-sm"
            >
              View / List
            </button>
          )}

          {onAction && (
            <button
              onClick={onAction}
              className="btn-secondary px-4 text-sm"
            >
              ⋯
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
