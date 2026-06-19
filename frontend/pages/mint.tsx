import { useState } from "react";
import Layout from "../components/Layout";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { generateSigner, percentAmount, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import axios from "axios";

export default function MintPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("BAY");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleMint() {
    if (!wallet.publicKey || !wallet.signTransaction || !file) {
      alert("Connect wallet and select an image");
      return;
    }

    setLoading(true);
    try {
      const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
      if (!pinataJwt) throw new Error("Missing NEXT_PUBLIC_PINATA_JWT");

      // 1. Upload image to Pinata
      const formData = new FormData();
      formData.append("file", file);

      const imageRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        maxBodyLength: Infinity,
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const imageCid = imageRes.data.IpfsHash;
      const imageUri = `https://ipfs.io/ipfs/${imageCid}`;

      // 2. Upload metadata JSON
      const metadata = {
        name,
        symbol,
        description,
        image: imageUri,
        attributes: [],
        properties: {
          files: [{ uri: imageUri, type: file.type }],
        },
      };

      const metaRes = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        {
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
            "Content-Type": "application/json",
          },
        }
      );
      const metadataUri = `https://ipfs.io/ipfs/${metaRes.data.IpfsHash}`;

      // 3. Mint NFT with Metaplex
      const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata());
      const umiWallet = walletAdapterIdentity(wallet as any);
      umi.use(umiWallet);

      const mint = generateSigner(umi);

      await createNft(umi, {
        mint,
        name,
        symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0), // 0% royalty for demo
      }).sendAndConfirm(umi);

      setResult(mint.publicKey.toString());
    } catch (err: any) {
      console.error(err);
      alert("Mint failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Mint an NFT</h1>
        <p className="text-gray-400 mb-8">Upload an image and create a Solana NFT instantly.</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="NFT Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#121218] border border-[#22222a] rounded-xl px-4 py-3"
          />

          <input
            type="text"
            placeholder="Symbol (e.g. BAY)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full bg-[#121218] border border-[#22222a] rounded-xl px-4 py-3"
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#121218] border border-[#22222a] rounded-xl px-4 py-3 h-24"
          />

          <div>
            <label className="block text-sm mb-1.5 text-gray-400">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#1f1f28] file:text-white"
            />
          </div>

          <button
            onClick={handleMint}
            disabled={loading || !name || !file}
            className="btn-primary w-full disabled:opacity-50 mt-2"
          >
            {loading ? "Minting..." : "Mint NFT"}
          </button>
        </div>

        {result && (
          <div className="mt-8 p-4 rounded-2xl bg-green-900/20 border border-green-900/60 text-sm">
            ✅ Mint successful! Mint address:<br />
            <span className="font-mono break-all text-[#00f0ff]">{result}</span>
            <div className="mt-2">
              View on <a href={`https://explorer.solana.com/address/${result}?cluster=devnet`} target="_blank" className="underline">Solana Explorer</a>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
