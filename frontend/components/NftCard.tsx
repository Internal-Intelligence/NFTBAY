import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import Link from "next/link";
import { runQuantumValuation, computeCheapestQuantumPrice, quickQuantumSuggest } from "../lib/quantum";

interface NftCardProps {
  mint: string;
  name: string;
  image: string;
  price?: number;
  seller?: string;
  isListed?: boolean;
  onBuy?: () => void;
  onList?: () => void;
  onPawn?: () => void;
  isPawned?: boolean;
  isRocket?: boolean; // pass from market/auctions wiring for badges + links
}

// QUANTUM-OPTIMIZED: memoized for zero-re-render in grids
const NftCard = memo(function NftCard({
  mint,
  name,
  image,
  price,
  seller,
  isListed = false,
  onBuy,
  onList,
  onPawn,
  isPawned = false,
  isRocket = false,
}: NftCardProps) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Quantum Intelligence popup state (Agent 3)
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [qMode, setQMode] = useState(true);
  const [quantumOffer, setQuantumOffer] = useState<any>(null);
  const [offerLoading, setOfferLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // useMemo for price calc (zero cost)
  const priceSol = useMemo(() => 
    price ? (price / 1_000_000_000).toFixed(2) : null, 
    [price]
  );

  // useCallback: stable handler, prevents child re-renders
  const handleBuyClick = useCallback(async () => {
    if (!onBuy) return;
    setLoading(true);
    
    // Ultra-fast DOM launch trigger (no state thrash)
    const card = document.querySelector(`[data-mint="${mint}"]`);
    if (card) card.classList.add('launching');
    
    try {
      await onBuy();
    } finally {
      setLoading(false);
      if (card) setTimeout(() => card.classList.remove('launching'), 650);
    }
  }, [onBuy, mint]);

  // Fast fallback
  const imgSrc = useMemo(() => image || "https://images.pexels.com/photos/1906795/pexels-photo-1906795.jpeg?auto=compress&cs=tinysrgb&w=600", [image]);

  // Derive condition heuristically for e-waste quantum model (speed: O(1))
  const deriveCondition = useMemo((): 'working' | 'non-working' => {
    const n = (name || '').toLowerCase();
    const broken = n.includes('broken') || n.includes('junk') || n.includes('dead') || n.includes('non') || n.includes('vintage') || n.includes('old');
    return broken ? 'non-working' : 'working';
  }, [name]);

  // Quantum-powered MAKE AN OFFER popup — integrates superposition + annealing + cheapest per condition
  const openQuantumOfferPopup = useCallback(() => {
    setShowOfferModal(true);
    setQuantumOffer(null);
    setQMode(true);
  }, []);

  const runQuantumOffer = useCallback(() => {
    setOfferLoading(true);
    // Fast async sim (vectorized inside)
    setTimeout(() => {
      const basePrice = price ? (price / 1_000_000_000) : 1.5;
      const cond = deriveCondition;
      const classicalApprox = basePrice * (cond === 'working' ? 0.065 : 0.018);

      let qResult: any;
      if (qMode) {
        qResult = runQuantumValuation(
          name || 'RWA Item',
          'Popup quantum offer',
          'Small Electronics',
          cond,
          Math.round(basePrice * 180),
          classicalApprox,
          2
        );
        // Also run dedicated cheapest prediction
        const cheapest = computeCheapestQuantumPrice(classicalApprox, cond);
        qResult.cheapestPerCondition = cheapest;
        qResult.quickSuggest = quickQuantumSuggest(basePrice * 0.5, cond);
      } else {
        qResult = {
          quantumOfferSOL: +(classicalApprox * (0.7 + Math.random()*0.3)).toFixed(4),
          classicalOfferSOL: classicalApprox,
          acceptanceProb: cond === 'working' ? 0.82 : 0.71,
          predictive: { note: 'Classical fallback' },
          condition: cond === 'working' ? 'Working' : 'Non-working'
        };
      }
      setQuantumOffer(qResult);
      setOfferLoading(false);
    }, 420); // fast vector compute
  }, [price, name, deriveCondition, qMode]);

  const submitQuantumOffer = useCallback(() => {
    const amt = quantumOffer?.quantumOfferSOL || quantumOffer?.offerSOL || '0.42';
    alert(`[QUANTUM OFFER SUBMITTED]\n\n${name}\nOffer: ◎ ${amt} SOL\n\nProbabilistic collapse accepted. Seller notified via entanglement channel (demo).\n\nQuantum Mode: ${qMode ? 'ENABLED' : 'OFF'}`);
    setShowOfferModal(false);
    setQuantumOffer(null);
  }, [quantumOffer, name, qMode]);

  return (
    <div className="ebay-item market-card overflow-hidden text-sm" data-mint={mint}>
      <div className="relative aspect-square bg-[#101014] grid-overlay">
        {image ? (
          // Next Image = lazy by default, optimized decode, AVIF, instant
          <Image
            src={imgSrc}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
            placeholder="empty"
            onError={() => {
              // graceful fallback (avoids broken layout) - use unoptimized src swap via data
              const el = document.querySelector(`[data-mint="${mint}"] img`) as HTMLImageElement | null;
              if (el) el.src = "https://images.pexels.com/photos/1906795/pexels-photo-1906795.jpeg?auto=compress&cs=tinysrgb&w=600";
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#555] text-sm">NO IMAGE</div>
        )}

        <div className="absolute top-2 right-2 text-[9px] px-1.5 py-px bg-black/60 text-[#22ffaa] tracking-[1px] font-mono z-10">RWA • &lt;15lbs</div>
        {isRocket && <div className="absolute top-2 left-2 rocket-badge text-[8px]">ROCKET</div>}
      </div>

      <div className="p-2.5">
        <div className="font-medium line-clamp-2 mb-1 leading-tight text-[#e8e8ea]">{name || "Unnamed RWA"}</div>
        <div className="text-[10px] text-[#22ffaa] mb-0.5">PHYSICAL • PAPERWORK INCLUDED</div>
        
        <div className="price">
          <div className="text-xl font-black tracking-[-0.5px]">◎ {priceSol || '0.00'}</div>
          <div className="text-sm text-[#888] -mt-0.5">${(parseFloat(priceSol || '0') * 150).toFixed(0)} USD</div>
        </div>

        {isListed && seller && (
          <div className="text-[10px] text-[#777] mt-0.5 font-mono flex items-center gap-1">
            SELLER {seller.slice(0, 4)}...{seller.slice(-4)}
            <span className="text-[#22c55e] text-[9px]">98% ★</span>
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <div className="text-[#22c55e] tracking-wider">INSTANT TRANSFER</div>
          <div className="text-[#666]">SOLANA</div>
        </div>

        <div className="mt-2 space-y-1.5">
          {isListed && price && onBuy ? (
            <button
              onClick={handleBuyClick}
              disabled={loading || !mounted || !wallet.connected}
              className="btn-primary w-full text-center py-[7px]"
            >
              {loading ? "LAUNCHING..." : "BUY IT NOW"}
            </button>
          ) : null}
          {/* Auction / Rocket support demo — full wiring from market to auctions + pass isRocket intent */}
          <Link href={`/auctions${isRocket ? '?filter=rocket' : ''}`} className="block w-full text-center text-[10px] py-1 border border-[#ff5500] text-[#ff5500] hover:bg-[#1a0f0f] hover:text-black">
            VIEW IN AUCTIONS / TARGETS <span className="rocket-badge text-[8px]">LOCK</span>
          </Link>

          {onPawn && !isPawned ? (
            <button
              onClick={onPawn}
              disabled={!mounted || (!wallet.connected && !onBuy)}
              className="btn-secondary w-full py-[6px] border-[#22ffaa] text-[#22ffaa] hover:bg-[#1a1f1a]"
            >
              PAWN FOR INSTANT SOL
            </button>
          ) : isPawned ? (
            <div className="text-center py-1 text-xs uppercase tracking-widest text-[#22ffaa] border border-[#22ffaa]/50">
              PAWNED • HELD IN ESCROW
            </div>
          ) : onList ? (
            <button
              onClick={onList}
              disabled={!mounted || !wallet.connected}
              className="btn-secondary w-full py-[6px]"
            >
              LIST FOR SALE
            </button>
          ) : (
            <button
              onClick={() => window.location.href = `/mint?mint=${mint}`}
              className="btn-secondary w-full py-[6px]"
            >
              VIEW DETAILS
            </button>
          )}
        </div>

        <div className="text-[10px] text-[#555] mt-1 text-center tracking-widest">
          {isPawned ? "REPAY TO RECLAIM • SHIP BACK" : "PAWN / SELL / AUCTION • FULL PAPERWORK"}
        </div>

        {!isPawned && isListed && onBuy && (
          <button
            onClick={openQuantumOfferPopup}
            className="mt-1 w-full text-[10px] py-0.5 text-[#888] hover:text-[#22ffaa] border border-[#333] hover:border-[#22ffaa]/50"
          >
            MAKE AN OFFER — QUANTUM LOWBALL
          </button>
        )}
      </div>

      {/* QUANTUM OFFER POPUP — Superposition + Entanglement + Annealing for cheapest price */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setShowOfferModal(false)}>
          <div className="bg-[#0a0a0f] border border-[#22ffaa] rounded-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <div>
                <span className="text-[#22ffaa] text-xs tracking-[2px] font-bold">QUANTUM OFFER ENGINE</span>
                <div className="text-sm font-medium">{name}</div>
              </div>
              <button onClick={() => setShowOfferModal(false)} className="text-[#888] hover:text-white">✕</button>
            </div>

            <div className="text-xs mb-2 flex items-center gap-2">
              <span>Condition: <span className="font-mono text-[#22ffaa]">{deriveCondition.toUpperCase()}</span></span>
              <label className="ml-auto flex items-center gap-1 cursor-pointer text-[10px]">
                <input type="checkbox" checked={qMode} onChange={e => setQMode(e.target.checked)} className="accent-[#22ffaa]" /> QUANTUM
              </label>
            </div>

            <button 
              onClick={runQuantumOffer} 
              disabled={offerLoading}
              className="w-full py-2 mb-3 text-sm border border-[#22ffaa] hover:bg-[#1a1f1a] text-[#22ffaa] rounded"
            >
              {offerLoading ? "ANNEALING + COLLAPSING..." : "COMPUTE QUANTUM LOWBALL OFFER (vectorized)"}
            </button>

            {quantumOffer && (
              <div className="bg-[#111114] border border-[#222] p-3 rounded text-sm space-y-2">
                <div>Market base: ~◎{(price || 1500000000) / 1e9}</div>
                <div className="font-bold">Quantum Offer: <span className="text-lg text-white font-mono">◎ {quantumOffer.quantumOfferSOL || quantumOffer.offerSOL}</span> SOL</div>
                {quantumOffer.cheapestPerCondition && (
                  <div className="text-[#22ffaa] text-xs">Cheapest per {quantumOffer.condition}: ◎{quantumOffer.cheapestPerCondition.cheapestSOL} (conf {quantumOffer.cheapestPerCondition.confidence})</div>
                )}
                <div className="text-[10px] text-[#aaa]">{quantumOffer.predictive?.note || quantumOffer.insight}</div>
                {quantumOffer.superposition && (
                  <div className="text-[10px] pt-1 border-t border-[#333]">
                    Superposition samples (prob): {quantumOffer.superposition.slice(0,3).map((s: any,i:number) => `${s.priceSOL}(${Math.round(s.probability*100)}%)`).join(' ')}
                  </div>
                )}
                <div className="text-[10px] text-[#666]">Entangle: {quantumOffer.entanglementFactor} • Anneal: {quantumOffer.annealingEnergy}</div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowOfferModal(false); setQuantumOffer(null); }} className="btn-secondary flex-1 text-xs">CANCEL</button>
              <button onClick={submitQuantumOffer} disabled={!quantumOffer} className="btn-primary flex-1 text-xs">SUBMIT QUANTUM OFFER</button>
            </div>
            <div className="text-center mt-2 text-[9px] text-[#444]">Probabilistic pricing via superposition collapse. Optimal via annealing.</div>
          </div>
        </div>
      )}
    </div>
  );
});

export default NftCard;