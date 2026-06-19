import { useState } from "react";
import Layout from "../components/Layout";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, getListingPda, getMarketplacePda, LAMPORTS_PER_SOL } from "../lib/anchor";

export default function SellPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mintAddress, setMintAddress] = useState("");
  const [priceSol, setPriceSol] = useState("1.0");
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState("");

  async function listNft() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert("Connect wallet");
      return;
    }
    if (!mintAddress) {
      alert("Enter the mint address of the NFT you want to list");
      return;
    }

    setLoading(true);
    try {
      const program = getProgram(wallet as any, connection);
      const mint = new PublicKey(mintAddress);
      const price = Math.floor(parseFloat(priceSol) * LAMPORTS_PER_SOL);

      const [listingPda] = getListingPda(mint);
      const [marketplacePda] = getMarketplacePda();

      // NOTE: This is a high-level sketch. Full implementation needs:
      // - Seller's token account for the mint (find ATA)
      // - Escrow ATA creation handled by Anchor (associated token constraints)
      // - Proper remaining accounts if needed
      const txSig = await program.methods
        .listNft(new BN(price))
        .accounts({
          marketplace: marketplacePda,
          listing: listingPda,
          mint,
          // sellerTokenAccount, escrowTokenAccount, escrowAuthority etc. would be added
          seller: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          // associatedTokenProgram
        })
        .rpc();

      setTx(txSig);
    } catch (err: any) {
      console.error(err);
      alert("Listing failed (expected until full account setup): " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-1">List NFT for Sale</h1>
        <p className="text-gray-400 mb-8">Transfer your NFT into escrow and set a price.</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="NFT Mint Address"
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            className="w-full bg-[#121218] border border-[#22222a] rounded-xl px-4 py-3 font-mono text-sm"
          />

          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.01"
              value={priceSol}
              onChange={(e) => setPriceSol(e.target.value)}
              className="flex-1 bg-[#121218] border border-[#22222a] rounded-xl px-4 py-3"
            />
            <div className="text-gray-400 pr-2">SOL</div>
          </div>

          <button
            onClick={listNft}
            disabled={loading || !mintAddress}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Listing..." : "List on NFTBAY"}
          </button>
        </div>

        {tx && (
          <div className="mt-6 text-xs break-all bg-[#121218] p-4 rounded-xl border border-[#222]">
            Transaction: {tx}
          </div>
        )}

        <div className="mt-8 text-xs text-gray-500">
          The on-chain program is complete. The frontend needs the generated IDL + full ATA derivation to complete the listing instruction.
          See <code>programs/nftbay/src/lib.rs</code>.
        </div>
      </div>
    </Layout>
  );
}
