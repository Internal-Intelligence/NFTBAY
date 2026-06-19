import { useEffect, useState, useMemo, useCallback } from "react";
import { batchFetchAccounts, getFastConnection } from "../lib/anchor";
import Layout from "../components/Layout";
import NftCard from "../components/NftCard";
import Link from "next/link";
import { useRouter } from "next/router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { 
  getProgram, 
  getListingPda, 
  getMarketplacePda, 
  getEscrowAuthorityPda, 
  LAMPORTS_PER_SOL,
  getUserTokenAccount,
  getEscrowTokenAccount,
  TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  SYSTEM_PROGRAM
} from "../lib/anchor";
import { BN } from "@coral-xyz/anchor";
import { quantumPawnLoan, computeCheapestQuantumPrice, runFastPawnOrchestration } from "../lib/quantum";

interface Listing {
  mint: string;
  name: string;
  image: string;
  price: number;
  seller: string;
  category?: string;
  isRocket?: boolean;
}

export default function Marketplace() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  // Demo seed data — Real World Assets (RWAs) only. All items ship < 15 lbs.
  // Objective: Global access to capital. List → Pawn for instant SOL (ship physical item to escrow) | Sell | Auction
  const RWA_CATEGORIES = [
    "Jewelry & Watches",
    "Small Electronics", 
    "Rare Coins & Currency",
    "Luxury Accessories",
    "Precious Metals",
    "Collectible Cards & Small Memorabilia",
    "Fine Art (Small)",
    "Other RWA (<15 lbs)"
  ] as const;

  const demoListings: Listing[] = [
    { 
      mint: "rwa-mint-001", 
      name: "Rolex Submariner 2022 (Ref 126610LN)", 
      image: "https://images.pexels.com/photos/1906795/pexels-photo-1906795.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 85_000_000_000, // ~$12,750 USD (real market ~$12k-14k)
      seller: "7xKX...9Pq2", 
      category: "Jewelry & Watches",
      isRocket: true
    },
    { 
      mint: "rwa-mint-002", 
      name: "Vintage Cartier Love Bracelet (18k Yellow Gold)", 
      image: "https://images.pexels.com/photos/1458867/pexels-photo-1458867.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 55_000_000_000, // ~$8,250 USD (retail ~$8k)
      seller: "3mVv...kL4r", 
      category: "Jewelry & Watches" 
    },
    { 
      mint: "rwa-mint-003", 
      name: "iPhone 15 Pro 256GB + Original Box + Receipt", 
      image: "https://images.pexels.com/photos/1294886/pexels-photo-1294886.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 7_000_000_000, // ~$1,050 USD (real retail ~$999-1,100)
      seller: "9pQr...8tXz", 
      category: "Small Electronics" 
    },
    { 
      mint: "rwa-mint-004", 
      name: "1880s US Morgan Silver Dollar (MS65)", 
      image: "https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 1_800_000_000, // ~$270 USD (real MS65 ~$150-400)
      seller: "5nHb...2wQ9", 
      category: "Rare Coins & Currency" 
    },
    { 
      mint: "rwa-mint-005", 
      name: "Hermès Birkin 25 (Togo Leather, Black)", 
      image: "https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 90_000_000_000, // ~$13,500 USD (retail 2026 ~$13.5k)
      seller: "2kLm...vP3x", 
      category: "Luxury Accessories" 
    },
    { 
      mint: "rwa-mint-006", 
      name: "1oz PAMP Suisse Gold Bar (Cert #A12345, Assay)", 
      image: "https://images.pexels.com/photos/5980856/pexels-photo-5980856.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 16_500_000_000, // ~$2,475 USD (spot ~$2.3k + premium)
      seller: "8jRt...mZ7n", 
      category: "Precious Metals",
      isRocket: true
    },
    { 
      mint: "rwa-mint-007", 
      name: "Pokemon 1st Edition Charizard (PSA 9)", 
      image: "https://images.pexels.com/photos/163064/play-card-game-cards-163064.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 32_000_000_000, // ~$4,800 USD (real PSA9 ~$4k-6k)
      seller: "4bXc...hY9q", 
      category: "Collectible Cards & Small Memorabilia" 
    },
    { 
      mint: "rwa-mint-008", 
      name: "Signed 1950s Baseball Card Lot (Mantle + Williams)", 
      image: "https://images.pexels.com/photos/163064/play-card-game-cards-163064.jpeg?auto=compress&cs=tinysrgb&w=600", 
      price: 13_000_000_000, // ~$1,950 USD (real lot value)
      seller: "6vDf...sK2p", 
      category: "Collectible Cards & Small Memorabilia" 
    },
  ];

  const [listings, setListings] = useState<Listing[]>(demoListings);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buying, setBuying] = useState<string | null>(null);

  // QUANTUM CACHE for on-chain if ever populated (prevents re-fetch thrash)
  const listingsCache = useMemo(() => new Map<string, Listing[]>(), []);

  // Optimized loader: memoized callback + instant demo fallback + batch Solana reads
  const loadListings = useCallback(async () => {
    setLoading(true);
    const cacheKey = wallet.publicKey?.toBase58() || 'demo';

    // Ultra-fast cache hit
    if (listingsCache.has(cacheKey)) {
      setListings(listingsCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    try {
      const fastConn = getFastConnection(connection);
      const program = getProgram(wallet as any, fastConn);
      const listingAccounts = await (program.account as any).listing.all();

      const activeListings: Listing[] = listingAccounts.map((l: any) => {
        const mint = l.account.mint.toBase58();
        return {
          mint,
          name: `NFT ${mint.slice(0, 4)}...${mint.slice(-4)}`,
          image: `https://picsum.photos/id/${(parseInt(mint.slice(0, 6), 16) % 200) + 10}/600/600`,
          price: l.account.price.toNumber(),
          seller: l.account.seller.toBase58(),
        };
      });

      const finalList = activeListings.length > 0 ? activeListings : demoListings;
      listingsCache.set(cacheKey, finalList);
      setListings(finalList);
    } catch (e) {
      console.log("On-chain fetch not available — using demo launches:", e);
      setListings(demoListings);
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey, connection, listingsCache]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Read filters from URL (eBay style) + local search
  const queryCat = (router.query.cat as string) || "all";
  const querySearch = (router.query.q as string) || "";

  // Sync local search state when URL changes (from header or direct link) — fast
  useEffect(() => {
    if (typeof router.query.q === "string") {
      setSearch(router.query.q);
    }
  }, [router.query.q]);

  const effectiveSearch = search || querySearch;

  // QUANTUM MEMOIZED FILTER — recomputes only when deps change. No lag on grid
  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesSearch = !effectiveSearch || l.name.toLowerCase().includes(effectiveSearch.toLowerCase());
      let matchesCat = true;

      if (queryCat && queryCat !== "all") {
        const catLower = queryCat.toLowerCase();
        const itemCat = (l.category || "").toLowerCase();
        const nameLower = l.name.toLowerCase();

        if (catLower.includes("jewelry") || catLower.includes("watch")) {
          matchesCat = itemCat.includes("jewelry") || itemCat.includes("watch") || nameLower.includes("rolex") || nameLower.includes("cartier");
        } else if (catLower.includes("electronic")) {
          matchesCat = itemCat.includes("electronic") || nameLower.includes("iphone");
        } else if (catLower.includes("coin") || catLower.includes("currency")) {
          matchesCat = itemCat.includes("coin") || itemCat.includes("currency") || nameLower.includes("dollar") || nameLower.includes("silver");
        } else if (catLower.includes("luxury") || catLower.includes("access")) {
          matchesCat = itemCat.includes("luxury") || nameLower.includes("hermès") || nameLower.includes("birkin");
        } else if (catLower.includes("metal")) {
          matchesCat = itemCat.includes("metal") || nameLower.includes("gold") || nameLower.includes("pamp");
        } else if (catLower.includes("card") || catLower.includes("memorabilia")) {
          matchesCat = itemCat.includes("card") || itemCat.includes("memorabilia") || nameLower.includes("pokemon") || nameLower.includes("baseball");
        } else if (catLower.includes("art")) {
          matchesCat = itemCat.includes("art");
        } else {
          matchesCat = itemCat.toLowerCase().includes(catLower);
        }
      }

      return matchesSearch && matchesCat;
    });
  }, [listings, effectiveSearch, queryCat]);

  // QUANTUM: useCallback + parallel Solana fetches for instant feel
  const handleBuy = useCallback(async (item: Listing) => {
    const isDemo = item.mint.startsWith("demo-") || item.mint.startsWith("rwa-mint");

    if (!wallet.publicKey && !isDemo) {
      alert("Connect your wallet first");
      return;
    }

    setBuying(item.mint);

    // Instant launch animation trigger (DOM only for speed)
    const cardEl = document.querySelector(`[data-mint="${item.mint}"]`);
    if (cardEl) cardEl.classList.add('launching');

    try {
      if (isDemo) {
        // Demo: near-instant quantum response (reduced from 950ms → 420ms)
        await new Promise(r => setTimeout(r, 420));
        alert(`🚀 LAUNCH SUCCESSFUL (demo)\n\n${item.name} transferred.\n\nIn real mode this would be a live Solana transaction.`);
        setListings(prev => prev.filter(l => l.mint !== item.mint));
      } else {
        // Real on-chain: PARALLEL FETCHES for quantum speed
        const program = getProgram(wallet as any, connection);
        const mint = new PublicKey(item.mint);

        const [listingPda] = getListingPda(mint);
        const [marketplacePda] = getMarketplacePda();
        const [escrowAuthority] = getEscrowAuthorityPda(listingPda, mint);

        const buyerAta = getUserTokenAccount(mint, wallet.publicKey!);
        const escrowAta = getEscrowTokenAccount(escrowAuthority, mint);

        // PARALLEL: two fetches at once instead of await/await
        const [listingAccount, marketplaceAccount] = await Promise.all([
          (program.account as any).listing.fetch(listingPda),
          (program.account as any).marketplace.fetch(marketplacePda),
        ]);

        const txSig = await (program.methods.buyNft() as any)
          .accounts({
            marketplace: marketplacePda,
            listing: listingPda,
            mint,
            escrowAuthority,
            escrowTokenAccount: escrowAta,
            buyerTokenAccount: buyerAta,
            seller: listingAccount.seller,
            admin: marketplaceAccount.admin,
            buyer: wallet.publicKey,
            tokenProgram: TOKEN_PROGRAM,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
            systemProgram: SYSTEM_PROGRAM,
          })
          .rpc();

        const explorer = `https://explorer.solana.com/tx/${txSig}?cluster=devnet`;
        alert("Purchase successful!\n" + explorer);
        window.open(explorer, "_blank");
        loadListings();
      }
    } catch (err: any) {
      console.error(err);
      alert("Buy failed: " + (err.message || "See console for details."));
    } finally {
      setBuying(null);
      if (cardEl) setTimeout(() => cardEl.classList.remove('launching'), 620);
    }
  }, [wallet.publicKey, connection, loadListings]);

  // QUANTUM PAWN: useCallback + instant liquidity response + Agent 3 annealing
  const handlePawn = useCallback(async (item: Listing) => {
    let loanAmountStr = item.price ? (item.price / 1_000_000_000 * 0.55).toFixed(2) : "1.25";
    const interest = "4.5%";
    const days = "30";

    // Apply quantum pawn enhancement (vectorized annealing for optimal lowball)
    const baseLoan = parseFloat(loanAmountStr);
    const cond = /broken|junk|dead|non/i.test(item.name || '') ? 'non-working' : 'working';
    const qLoan = quantumPawnLoan(baseLoan, cond as any);
    const cheapPred = computeCheapestQuantumPrice(baseLoan * 0.6, cond as any);
    loanAmountStr = qLoan.toFixed(2);

    if (!confirm(
      `PAWN THIS NFT?\n\n` +
      `${item.name}\n` +
      `Loan amount: ${loanAmountStr} SOL (Q-ANNEALED OPTIMAL)\n` +
      `Term: ${days} days\n` +
      `Interest: ${interest}\n\n` +
      `Q-cheapest prediction: ◎ ${cheapPred.cheapestSOL} (conf ${cheapPred.confidence})\n` +
      `Your NFT will be held securely in on-chain escrow.\n` +
      `Repay the loan + interest anytime to get it back.\n` +
      `No forced sale. This is the pawn shop model.\n\n` +
      `Proceed with demo pawn?`
    )) {
      return;
    }

    const cardEl = document.querySelector(`[data-mint="${item.mint}"]`);
    if (cardEl) cardEl.classList.add('launching');

    // Quantum fast: 260ms for instant cash feel
    await new Promise(r => setTimeout(r, 260));

    alert(
      `🚀 LIQUIDITY UNLOCKED\n\n` +
      `${loanAmountStr} SOL sent to your wallet (demo).\n` +
      `NFT held as collateral.\n\n` +
      `Go to My NFTBAY → Pawns to repay and reclaim.\n` +
      `You kept ownership potential without selling.\n\n` +
      `[QUANTUM: annealing + entanglement sim applied]`
    );

    if (cardEl) setTimeout(() => cardEl.classList.remove('launching'), 480);
    setListings(prev => prev.filter(l => l.mint !== item.mint));
  }, []);

  return (
    <Layout>
      {/* eBay-style page title + excitement */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Real World Assets • Global Capital Access</h1>
          <div className="text-xs text-[#22ffaa] tracking-[2px] font-mono mt-0.5">PAWN • SELL FOR SOL • AUCTION  •  ALL ITEMS SHIP &lt;15 LBS</div>
        </div>
        <div className="text-right text-[11px] text-[#777] leading-tight">
          {filtered.length} ASSETS{queryCat !== "all" ? ` • ${queryCat.toUpperCase()}` : ""}<br />
          <span className="text-[#22ffaa]">LIQUIDITY FOR THE WORLD</span>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left sidebar — eBay filters, SpaceX dark clean */}
        <div className="w-56 hidden lg:block flex-shrink-0 space-y-4">
          <div className="sidebar-panel p-4">
            <h3>Categories</h3>
            <ul className="text-sm space-y-[3px] text-[#c7c7d1]">
              <li><Link href="/?cat=all" className="hover:text-[#22ffaa]">All RWAs (&lt;15 lbs)</Link></li>
              <li><Link href="/?cat=jewelry" className="hover:text-[#22ffaa]">Jewelry &amp; Watches</Link></li>
              <li><Link href="/?cat=electronics" className="hover:text-[#22ffaa]">Small Electronics</Link></li>
              <li><Link href="/?cat=coins" className="hover:text-[#22ffaa]">Rare Coins &amp; Currency</Link></li>
              <li><Link href="/?cat=luxury" className="hover:text-[#22ffaa]">Luxury Accessories</Link></li>
              <li><Link href="/?cat=metals" className="hover:text-[#22ffaa]">Precious Metals</Link></li>
              <li><Link href="/?cat=cards" className="hover:text-[#22ffaa]">Collectible Cards &amp; Memorabilia</Link></li>
            </ul>
          </div>

          {/* Price filter (eBay) */}
          <div className="sidebar-panel p-4">
            <h3>Price</h3>
            <div className="text-sm space-y-1 text-[#c7c7d1]">
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Under 1 SOL</label>
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> 1 — 10 SOL</label>
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Over 10 SOL</label>
            </div>
          </div>

          {/* Condition / NFT specific (eBay style) */}
          <div className="sidebar-panel p-4">
            <h3>Condition</h3>
            <div className="text-sm space-y-1 text-[#c7c7d1]">
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Verified Collection</label>
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Rare (1/1)</label>
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Limited Edition</label>
              <label className="flex items-center gap-2 hover:text-[#22ffaa]"><input type="checkbox" className="accent-[#22ffaa]" /> Instant Transfer</label>
            </div>
          </div>

          <div className="sidebar-panel p-4 text-[10px] text-[#666] leading-snug">
            All transactions secured on-chain.<br />Powered by Solana + Anchor.
          </div>

          {/* QUANTUM INTELLIGENCE SIDEBAR — Agent 3 across site */}
          <div className="sidebar-panel p-4 border-[#22ffaa]/40">
            <h3 className="text-[#22ffaa]">QUANTUM PREDICTIVE</h3>
            <div className="text-[10px] space-y-1 text-[#aaa]">
              <div>▸ Superposition pricing active</div>
              <div>▸ Entangled e-waste clusters</div>
              <div>▸ Annealing for cheapest / pawn</div>
              <div className="pt-1 text-[#22ffaa] font-mono">Vectorized • Q-mode default</div>
              <div className="text-[9px] mt-1">Toggle in SELL / MY NFTBAY • Popup offers use Q</div>
            </div>
          </div>
        </div>

        {/* Main results area — full eBay structure */}
        <div className="flex-1">
          {/* Results header + search + sort (more eBay fidelity) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
            <div className="text-sm text-[#c1c1c7]">
              <span className="font-semibold text-white">{filtered.length}</span> results for <span className="font-bold">items</span>
              <Link href="/shipping" className="ml-2 text-[10px] underline hover:text-[#22ffaa]">Track your shipment →</Link>
              <Link href="/auctions" className="ml-2 text-[10px] underline hover:text-[#22ffaa]">Browse auctions →</Link>
            </div>

            {/* Quick search wired — debounced feel via shallow, instant UI */}
            <input
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                const current = { ...router.query };
                if (val.trim()) current.q = val;
                else delete current.q;
                // shallow replace = zero full reload, instant
                router.replace({ pathname: "/", query: current }, undefined, { shallow: true });
              }}
              placeholder="Filter listings..."
              className="search-input w-full sm:w-64 rounded px-3 py-1 text-sm"
            />

            <select className="bg-[#111114] border border-[#2a2a32] px-2 py-1 text-sm text-[#c7c7d1] rounded-sm focus:outline-none">
              <option>Best Match</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newly Listed</option>
              <option>Ending Soon</option>
            </select>
          </div>

          {/* Clean 4-col grid like eBay results */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <NftCard
                  key={item.mint}
                  mint={item.mint}
                  name={item.name}
                  image={item.image}
                  price={item.price}
                  seller={item.seller}
                  isListed
                  isRocket={!!item.isRocket}
                  onBuy={() => handleBuy(item)}
                  onPawn={() => handlePawn(item)}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-14 text-[#666] border border-[#222] bg-[#111114]">
                NO RESULTS ON THIS ORBIT.<br />
                <span className="text-[#22ffaa]">Try minting the first NFT.</span>
              </div>
            )}
          </div>

          {/* Viral share CTA */}
          <div className="mt-4 flex justify-end">
            <button 
              onClick={() => {
                const text = encodeURIComponent("Just discovered NFTBAY — the eBay for NFTs that also lets you pawn your assets for instant SOL without selling. This changes everything. https://nftbay.loca.lt");
                window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
              }}
              className="text-xs uppercase tracking-[2px] border border-[#333] px-4 py-1 hover:bg-[#1a1a20] hover:border-[#22ffaa] hover:text-[#22ffaa]"
            >
              SHARE THIS MARKETPLACE ON X
            </button>
          </div>
        </div>
      </div>

      {/* Bottom trust bar (eBay style info) */}
      <div className="mt-8 p-4 border border-[#222] bg-[#101014] text-xs text-[#777] flex flex-wrap gap-x-6 gap-y-1">
        <span>✓ ON-CHAIN ESCROW</span>
        <span>✓ INSTANT TRANSFER OR PAWN</span>
        <span>✓ NO FORCED SALES — YOU CONTROL</span>
        <span>✓ BUYER &amp; PAWN PROTECTION</span>
      </div>

      {/* RWA Pawn Shop explanation - core mission */}
      <div className="mt-6 border border-[#2a2a32] bg-[#0f0f14] p-5 text-sm">
        <div className="uppercase tracking-[2px] text-[#22ffaa] text-xs mb-2">HOW NFTBAY WORKS — GLOBAL CAPITAL FOR REAL ASSETS</div>
        <div className="grid md:grid-cols-3 gap-4 text-[#c1c1c7]">
          <div>
            <strong className="text-white">1. TOKENIZE YOUR RWA</strong><br />
            List physical assets under 15 lbs (jewelry, watches, coins, small electronics, etc.). NFT carries full paperwork, appraisal, provenance.
          </div>
          <div>
            <strong className="text-white">2. CHOOSE YOUR CAPITAL PATH</strong><br />
            <span className="text-[#22ffaa]">Pawn</span> → Get SOL now (ship item to our verified escrow). <br />
            <span className="text-[#22ffaa]">Sell</span> → Instant SOL. <br />
            <span className="text-[#22ffaa]">Target Lock Auction</span> → Set price you think it sells for. Lock RWA. Cash out on hit or risk.
          </div>
          <div>
            <strong className="text-white">3. WORLDWIDE LIQUIDITY</strong><br />
            Repay pawn anytime to get your physical item back. No forced sales. Capital access for everyone, everywhere. <br />
            <span className="text-[#ff5500]">NEW: TARGET AUCTIONS &amp; LAUNCHPAD — RWA leverage. Set target. Cash out or risk.</span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-[#22ffaa]">
          ALL ITEMS MUST SHIP &lt;15 LBS. When you pawn, you ship the physical item to NFTBAY secure storage. NFT = your claim.
        </div>
      </div>
    </Layout>
  );
}
