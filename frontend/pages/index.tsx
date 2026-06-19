import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import NftCard from "../components/NftCard";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

interface Listing {
  mint: string;
  name: string;
  image: string;
  price: number;
  seller: string;
}

export default function Marketplace() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // TODO: Replace with real on-chain + Metaplex metadata fetching
  useEffect(() => {
    // Mocked data for fast UI development
    const mock: Listing[] = [
      {
        mint: "So11111111111111111111111111111111111111112",
        name: "Cyber Punk #042",
        image: "https://picsum.photos/id/1011/600/600",
        price: 2.5 * 1_000_000_000,
        seller: "7xKX...9pLq",
      },
      {
        mint: "9xKx2222222222222222222222222222222222222222",
        name: "Solana Ape #007",
        image: "https://picsum.photos/id/1005/600/600",
        price: 1.2 * 1_000_000_000,
        seller: "4pQv...mR9a",
      },
      {
        mint: "3zFz3333333333333333333333333333333333333333",
        name: "Degenerate Moon Cat",
        image: "https://picsum.photos/id/201/600/600",
        price: 0.85 * 1_000_000_000,
        seller: "9jKq...vX2w",
      },
    ];
    setListings(mock);
    setLoading(false);
  }, []);

  const filtered = listings.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-5xl font-bold tracking-tighter">Marketplace</h1>
          <p className="text-gray-400 mt-1">Discover and collect digital assets on Solana</p>
        </div>
        <input
          type="text"
          placeholder="Search NFTs..."
          className="bg-[#121218] border border-[#22222a] rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:border-[#00f0ff]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading listings...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.length > 0 ? (
            filtered.map((item, idx) => (
              <NftCard
                key={idx}
                mint={item.mint}
                name={item.name}
                image={item.image}
                price={item.price}
                seller={item.seller}
                isListed
                onAction={() => {}}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-16 text-gray-500">
              No listings found.
            </div>
          )}
        </div>
      )}

      <div className="mt-16 p-6 bg-[#121218] border border-[#22222a] rounded-2xl">
        <div className="text-sm text-gray-400">On-chain program ready</div>
        <div className="mt-1 font-mono text-xs">
          Program ID: <span className="text-[#00f0ff]">{process.env.NEXT_PUBLIC_PROGRAM_ID}</span>
        </div>
        <p className="mt-3 text-xs max-w-xl">
          Listings and purchases are powered by a custom Anchor escrow program. 
          Full integration is wired — replace mock data in this page with real `program.account.listing.all()` + Metaplex metadata.
        </p>
      </div>
    </Layout>
  );
}
