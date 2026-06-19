import { ReactNode, useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// WalletMultiButton must be dynamically imported with ssr: false
// because it relies on browser APIs (window, wallet adapters) and will cause
// React hydration mismatches if rendered on the server.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

  useEffect(() => setMounted(true), []);

  // Keep header search in sync with URL ?q=
  useEffect(() => {
    if (router.query.q) {
      setHeaderSearch(router.query.q as string);
    }
  }, [router.query.q]);

  // Free SOL popup — QUANTUM FAST: reduced delay (3.2s for excitement), cached dismissal
  const [showFreeSolPopup, setShowFreeSolPopup] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem('freeSolPopupDismissed')) {
        setShowFreeSolPopup(true);
      }
    }, 3200); // faster trigger for quantum immediacy

    return () => clearTimeout(timer);
  }, []);

  const closeFreeSolPopup = useCallback((permanent = false) => {
    setShowFreeSolPopup(false);
    if (permanent) {
      sessionStorage.setItem('freeSolPopupDismissed', 'true');
    }
  }, []);

  const handleHeaderSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHeaderSearch(val);

    // Update URL query (shallow = instant, no reload)
    const currentQuery = { ...router.query };
    if (val.trim()) {
      currentQuery.q = val;
    } else {
      delete currentQuery.q;
    }

    router.replace({
      pathname: router.pathname,
      query: currentQuery,
    }, undefined, { shallow: true });
  }, [router]);

  return (
    <>
      <Head>
        <title>NFTBAY — Marketplace for Real Treasures</title>
        <meta name="description" content="Buy, sell, auction, and ship real items easily. Find unique treasures from around the world." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ea]">
        {/* Friendly live status bar */}
        <div className="mission-bar text-[#22ffaa] text-[10px] tracking-[2px] py-1">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[#22ffaa]">● LIVE</span>
              <span>Real items trading right now</span>
              <span className="text-[#666]">Over 100 new treasures listed today</span>
            </div>
            <div className="hidden md:block text-[#666]">Find something you love — or sell what you have</div>
            <div className="text-[9px] px-1.5 py-px bg-[#111114] text-[#22ffaa] border border-[#22ffaa]/40">Trusted by collectors worldwide</div>
          </div>
        </div>

        {/* Friendly top bar */}
        <div className="topbar text-sm">
          <div className="max-w-7xl mx-auto px-4 py-1 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <Link href="/" className="nav-link">Welcome</Link>
              <Link href="/auctions" className="nav-link">Auctions</Link>
              <Link href="/launchpad" className="nav-link">Start Selling</Link>
              <Link href="/shipping" className="nav-link">Track Shipments</Link>
              <Link href="/sell" className="nav-link">Sell or Pawn</Link>
              <Link href="/my-nfts" className="nav-link">My Items</Link>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <Link href="/my-nfts" className="nav-link">My Account</Link>
              <span className="cursor-pointer hover:text-[#22ffaa] transition-colors">Help &amp; Support</span>
              <span className="cursor-pointer hover:text-[#22ffaa] transition-colors">Worldwide Shipping</span>
            </div>
          </div>
        </div>

        {/* Main friendly header */}
        <header className="header">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Simple logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-9 h-9 bg-[#22ffaa] flex items-center justify-center text-white font-black text-2xl tracking-tighter rounded-sm group-hover:scale-105 transition">▲</div>
              <div>
                <div className="font-black text-[26px] leading-none tracking-[1.5px] text-white">NFTBAY</div>
                <div className="text-[9px] text-[#22ffaa] -mt-0.5">Marketplace for real treasures</div>
              </div>
            </Link>

            {/* Shop by category (eBay) */}
            <div className="hidden md:flex items-center">
              <button className="px-3 py-1 text-xs border border-[#2a2a32] rounded hover:bg-[#1a1a20] flex items-center gap-1 text-[#c1c1c7]">
                SHOP BY CATEGORY <span className="text-[10px]">▾</span>
              </button>
            </div>

            {/* Simple friendly search bar */}
            <div className="flex-1 max-w-[620px]">
              <div className="relative flex">
                <input
                  type="text"
                  value={headerSearch}
                  onChange={handleHeaderSearchChange}
                  placeholder="Search for items you love..."
                  className="search-input w-full rounded-l px-4 py-2 text-sm focus:outline-none"
                />
                <button 
                  onClick={() => {/* search already live via onChange */}}
                  className="search-btn px-7 rounded-r text-sm font-medium active:scale-[0.985] transition"
                >
                  SEARCH
                </button>
              </div>
            </div>

            {/* Right actions — simple and friendly */}
            <div className="flex items-center gap-4 text-sm">
              <Link href="/sell" className="nav-link font-medium">Sell</Link>

              <div className="relative group">
                <Link href="/my-nfts" className="nav-link font-medium flex items-center gap-0.5">My Account <span className="text-xs">▾</span></Link>
                <div className="dropdown absolute hidden group-hover:block right-0 mt-1 w-52 text-sm z-50 rounded-sm overflow-hidden">
                  <Link href="/my-nfts" className="block px-4 py-2 text-xs">My Items</Link>
                  <Link href="/my-nfts" className="block px-4 py-2 text-xs">Purchases</Link>
                  <Link href="/my-nfts" className="block px-4 py-2 text-xs">Selling</Link>
                  <Link href="/my-nfts" className="block px-4 py-2 text-xs">Watchlist</Link>
                  <Link href="/profile" className="block px-4 py-2 text-xs">Profile</Link>
                  <div className="border-t border-[#2a2a32] my-0.5"></div>
                  <Link href="/my-nfts" className="block px-4 py-2 text-xs">Messages</Link>
                  <Link href="/terms" className="block px-4 py-2 text-xs">Service Agreement</Link>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[#c7c7d1] hover:text-white cursor-pointer text-sm">
                🛒 <span className="font-medium">0</span>
              </div>
              <a href="/profile" className="text-xs border border-[#22ffaa] px-2 py-0.5 hover:bg-[#22ffaa] hover:text-black">Sign in</a>

              {/* Wallet button - keep simple */}
              <div suppressHydrationWarning>
                {mounted ? (
                  <WalletMultiButton
                    style={{
                      backgroundColor: "#22ffaa",
                      color: "white",
                      borderRadius: "2px",
                      fontSize: "12px",
                      padding: "6px 14px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}
                  />
                ) : (
                  <button
                    style={{
                      backgroundColor: "#22ffaa",
                      color: "white",
                      borderRadius: "2px",
                      fontSize: "12px",
                      padding: "6px 14px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}
                    disabled
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Friendly category strip */}
        <div className="category-strip text-sm">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-5 overflow-x-auto">
            <Link href="/" className="whitespace-nowrap hover:text-white">All Items</Link>
            <Link href="/?cat=jewelry" className="whitespace-nowrap hover:text-white">Jewelry &amp; Watches</Link>
            <Link href="/?cat=electronics" className="whitespace-nowrap hover:text-white">Electronics</Link>
            <Link href="/?cat=coins" className="whitespace-nowrap hover:text-white">Coins</Link>
            <Link href="/?cat=luxury" className="whitespace-nowrap hover:text-white">Luxury</Link>
            <Link href="/?cat=metals" className="whitespace-nowrap hover:text-white">Metals</Link>
            <Link href="/?cat=cards" className="whitespace-nowrap hover:text-white">Collectibles</Link>
            <span className="mx-2 text-[#333]">|</span>
            <Link href="/mint" className="action whitespace-nowrap">List New</Link>
            <Link href="/sell" className="action whitespace-nowrap">Sell or Pawn</Link>
            <Link href="/auctions" className="action whitespace-nowrap">Auctions</Link>
            <Link href="/launchpad" className="action whitespace-nowrap">Launch</Link>
            <Link href="/shipping" className="action whitespace-nowrap">Shipping</Link>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 py-5">{children}</main>

        <footer className="text-sm mt-12">
          <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-y-6">
            <div>
              <h4 className="font-bold mb-2 text-[#aaa] tracking-wider text-xs">BUY</h4>
              <div className="space-y-1 text-xs">
                <Link href="/" className="block hover:text-[#22ffaa]">All RWAs (&lt;15 lbs)</Link>
                <Link href="/?cat=jewelry" className="block hover:text-[#22ffaa]">Jewelry &amp; Watches</Link>
                <Link href="/?cat=electronics" className="block hover:text-[#22ffaa]">Small Electronics</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-[#aaa] tracking-wider text-xs">SELL</h4>
              <div className="space-y-1 text-xs">
                <Link href="/sell" className="block hover:text-[#22ffaa]">Start selling</Link>
                <Link href="/mint" className="block hover:text-[#22ffaa]">Mint an NFT</Link>
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">My listings</Link>
                <Link href="/terms" className="block hover:text-[#22ffaa]">Service Agreement</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-[#aaa] tracking-wider text-xs">MY NFTBAY</h4>
              <div className="space-y-1 text-xs">
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">Summary</Link>
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">Purchases</Link>
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">Selling</Link>
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">Watchlist</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-[#aaa] tracking-wider text-xs">HELP &amp; CONTACT</h4>
              <div className="space-y-1 text-xs">
                <a href="https://solana.com" target="_blank" className="block hover:text-[#22ffaa]">Solana Explorer</a>
                <Link href="/my-nfts" className="block hover:text-[#22ffaa]">Resolution Center</Link>
                <a href="https://github.com/Internal-Intelligence/NFTBAY" target="_blank" className="block hover:text-[#22ffaa]">Community</a>
              </div>
            </div>
          </div>
          <div className="border-t border-[#222] text-center py-3 text-[11px] text-[#555]">
            © 2026 NFTBAY — eBay model on Solana. Built for the final frontier.
          </div>
          {/* AGENT 15 INTEGRATION BAR — holistic quantum intelligence status */}
          <div className="text-center py-1 text-[9px] tracking-[2px] bg-[#111] border-t border-[#222] text-[#22ffaa]">
            AGENT 15 ORCHESTRATION ACTIVE • POPUP ↔ SELL AI ↔ QUANTUM VALUATION ↔ PAWN ↔ BLOCKCHAIN • QUANTUM SPEED
          </div>
        </footer>

        {/* Too-good-to-be-true popup - QUANTUM INSTANT */}
        {showFreeSolPopup && (
          <div id="free-sol-popup" className="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center p-4">
            <div className="bg-[#0a0a0f] border-2 border-[#22ffaa] max-w-md w-full rounded-xl p-8 relative text-center shadow-2xl">
              <button 
                onClick={() => closeFreeSolPopup(true)} 
                className="absolute top-4 right-4 text-[#888] hover:text-white text-xl"
              >
                ✕
              </button>

              <div className="text-[#22ffaa] text-4xl mb-2">♻️</div>
              <h3 className="text-2xl font-bold tracking-tight mb-2">CLAIM SOL FOR YOUR E-WASTE!</h3>
              
              <p className="text-lg mb-4 leading-tight">
                No matter the age — even if it's ancient, completely broken, or from the 1980s — 
                <span className="text-[#22ffaa] font-semibold"> we buy it AND pay for shipping!</span><br />
                Turn your junk into instant value using real-time AI analysis.
              </p>

              <div className="text-sm text-[#ccc] mb-6">
                AI-powered valuation for working and non-working items.<br />
                <span className="text-[#22ffaa]">QUANTUM MODE: superposition + annealing + entanglement — cheapest price prediction.</span>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    closeFreeSolPopup();
                    router.push('/sell?from=popup&quantum=1&ai=1');
                  }} 
                  className="btn-primary w-full py-3 text-base"
                >
                  GET MY AI E-WASTE OFFER →
                </button>
                <button 
                  onClick={() => closeFreeSolPopup(true)} 
                  className="text-sm text-[#888] hover:text-white py-1"
                >
                  No thanks, I'll keep my e-waste
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
