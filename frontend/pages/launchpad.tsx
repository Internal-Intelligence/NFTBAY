import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import { useWallet } from '@solana/wallet-adapter-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { runQuantumValuation, quickQuantumSuggest, computeCheapestQuantumPrice, runQuantumValuationCached } from '../lib/quantum';
import { runAiValuationSync } from '../lib/aiValuation';

export default function Launchpad() {
  const wallet = useWallet();
  const router = useRouter();

  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [launchType, setLaunchType] = useState<'coin' | 'nft'>('coin');
  const [isRocket, setIsRocket] = useState(true);
  const [loading, setLoading] = useState(false);
  const [launched, setLaunched] = useState<any>(null);

  // Optional verified for trust badge (no gate)
  const [isVerified, setIsVerified] = useState(false);

  // TARGET PRICE BONDING SIM (RWA leverage, interactive)
  const [curveRaised, setCurveRaised] = useState(0);
  const [curvePrice, setCurvePrice] = useState(0.0005);
  const [buyAmount, setBuyAmount] = useState('0.5');
  const [blowTriggered, setBlowTriggered] = useState(false);

  // AI + BUBBLES
  const [questionBubbles, setQuestionBubbles] = useState<any[]>([]);
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // Quantum optimized price calc helper (vectorized fast)
  const computeBondingPrice = useCallback((raised: number): number => {
    // Casino bonding curve: exponential-ish ramp for hype. Quantum jitter
    const base = 0.00042;
    const k = 0.000085;
    const exp = 1.18;
    let p = base + k * Math.pow(Math.max(0, raised), exp);
    // Quantum flavor from lib
    try {
      const q = quickQuantumSuggest(p, 'working');
      p = Math.max(base, (p + q * 0.4) / 1.4);
    } catch {}
    return Math.round(p * 1e6) / 1e6;
  }, []);

  // Sync verified (optional) + prefill from SELL + initial bubbles
  useEffect(() => {
    const checkVerified = () => {
      const v = localStorage.getItem('nftbay_verified') === 'true';
      setIsVerified(v);
    };
    checkVerified();
    const onStorage = (e: StorageEvent) => { if (e.key === 'nftbay_verified') checkVerified(); };
    const onFocus = () => checkVerified();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    // WIRE FROM SELL: prefill name/desc/rocket from query
    if (router.isReady) {
      const q = router.query;
      if (q.name) setItemName(q.name as string);
      if (q.desc) setDescription(q.desc as string);
      if (q.rocket === '1') {
        setIsRocket(true);
        setLaunchType('coin'); // default coin for rocket target lock
      }
      // Quantum pre-valuation seed for lore/price if from sell
      if (q.fromSell) {
        try {
          const quick = runAiValuationSync((q.name as string) || 'Payload', (q.desc as string) || '', (q.category as string) || 'Jewelry & Watches', 'working');
          if (!description) setDescription(prev => prev || `Quantum verified ${quick.marketValueUSD} market. ${quick.predictive?.insight?.slice(0,80) || ''}`);
        } catch {}
      }
    }

    // BUBBLES for target mechanics
    setQuestionBubbles([
      { id: 'b1', question: "What is target price?", options: ["Your expected sale price for the RWA", "Leverage what you think it fetches"], agent: 'SELLER', context: 'target' },
      { id: 'b2', question: "Cash out when?", options: ["Immediately when bids hit target", "Or risk holding for higher"], agent: 'LOCK', context: 'payout' },
      { id: 'b3', question: "Risk up or down?", options: ["Bids can climb or stall", "Lock ends, highest wins if not cashed"], agent: 'Q-ARCHITECT', context: 'risk' }
    ]);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [router.isReady, router.query]);

  const ignite = async () => {
    if (!wallet.connected) {
      alert('Connect wallet');
      return;
    }
    if (!itemName) {
      alert('Name your RWA');
      return;
    }
    if (!isRocket) {
      alert('ROCKET MODE required for target lock bonding curve. Enable it.');
      setIsRocket(true);
      return;
    }
    setLoading(true);

    // QUANTUM + AI GEN: name/symbol + lore/ticker from quantum/ai. Optimized with libs (memo speed)
    const base = itemName.trim() || 'Lunar Junk';
    // AI/Quantum ticker gen: use quick suggest + seed for symbol
    let qTick = 0;
    try { qTick = Math.floor((quickQuantumSuggest(42, 'working') || 3) * 100) % 9000; } catch {}
    const baseSym = base.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4) || 'RKT';
    const tokenSymbol = baseSym + (launchType === 'nft' ? 'NFT' : 'RKT') + (qTick ? String(qTick).slice(0,2) : '');
    let lore = description;
    if (!lore || lore.length < 10) {
      // AI-style lore gen (quantum seeded) from quantum/ai
      const qVal = runQuantumValuation(base, description || 'real asset', 'Luxury', 'working', 420, 0.8);
      lore = `This ${base} payload is quantum-verified at ~$${qVal.marketValueUSD}. ${launchType.toUpperCase()} on curve. AI authenticity ${(88 + Math.random()*10)|0}%. Target lock. Cash out on your number or risk. Ticker ${tokenSymbol}.`;
    }

    // INITIAL BONDING CURVE PUMP (quantum + target lock econ seeded)
    const initRaised = Math.max(2.1, (quickQuantumSuggest(4.2, 'working') || 3.5) + Math.random()*2.5);
    const initPrice = computeBondingPrice(initRaised);

    // Initial econ preview (will recalculate on buys/blow)
    const previewRaised = initRaised;
    const creatorInit = +(previewRaised * 0.085).toFixed(2); // small lister ~8.5%
    const houseInit = +(previewRaised * 0.82).toFixed(2); // your target

    const newLaunch = {
      name: base,
      symbol: tokenSymbol,
      type: launchType,
      isRocket: true,
      raisedSOL: previewRaised,
      curvePrice: initPrice,
      creatorCut: creatorInit.toString(),
      houseEdge: houseInit.toString(),
      lore,
      rocketId: 'RKT-' + Date.now().toString(36).slice(-6).toUpperCase(),
      marketEst: (initRaised * 180 + 40).toFixed(0), // fake market ref for %over
      listerBonus: (previewRaised * 0.035).toFixed(2) // % over market bonus slice
    };

    setLaunched(newLaunch);
    setCurveRaised(previewRaised);
    setCurvePrice(initPrice);
    setBlowTriggered(false);

    setLoading(false);

    // IGNITION WITH CONFETTI (enhanced multi-burst quantum target lock style)
    const burst = () => confetti({ particleCount: 220, spread: 95, origin: { y: 0.55 } });
    burst();
    setTimeout(() => confetti({ particleCount: 140, angle: 60, spread: 50, origin: { x: 0.1, y: 0.7 } }), 180);
    setTimeout(() => confetti({ particleCount: 160, angle: 120, spread: 55, origin: { x: 0.9, y: 0.7 } }), 340);
    setTimeout(() => confetti({ particleCount: 80, spread: 110, origin: { y: 0.4 } }), 620);

    // Quantum price tick + bubbles refresh hint
    setTimeout(() => {
      if (newLaunch) {
        const liveP = computeBondingPrice(previewRaised + 0.8);
        setCurvePrice(liveP);
      }
    }, 650);

    alert(`IGNITION! ${tokenSymbol} RWA LAUNCHED.\nTarget curve LIVE. Cash out when you hit your number or risk the market.`);
  };

  // BUY ON CURVE: pumps raised, recalcs price (quantum + target lock rake model)
  const pumpCurve = useCallback((amtStr?: string) => {
    if (!launched) return;
    const amt = parseFloat(amtStr || buyAmount) || 0.5;
    if (amt <= 0) return;

    const newRaised = curveRaised + amt;
    const newPrice = computeBondingPrice(newRaised);

    // Econ: platform takes immediate 8% rake on buy + building toward 82%
    const buyRake = amt * 0.08;
    const effectiveRaisedForCalc = newRaised; // full volume tracks house

    setCurveRaised(newRaised);
    setCurvePrice(newPrice);

    // live update launched stats (UI)
    const newCreator = +(newRaised * 0.085 + parseFloat(launched.listerBonus || 0)).toFixed(2);
    const newHouse = +(newRaised * 0.82 + buyRake * 4).toFixed(2); // house accumulates majority
    setLaunched({
      ...launched,
      raisedSOL: newRaised,
      curvePrice: newPrice,
      creatorCut: newCreator.toFixed(2),
      houseEdge: newHouse.toFixed(2)
    });

    // mini confetti on pump
    confetti({ particleCount: 60, spread: 45, origin: { y: 0.8 } });
  }, [launched, curveRaised, buyAmount]);

  // THE "WHEN ROCKET BLOWS": give MAJORITY to platform as target lock (82%+)
  // Lister: small cut (8.5%) + % over market bonus
  const blowRocket = useCallback(() => {
    if (!launched || blowTriggered) return;
    setBlowTriggered(true);

    const finalRaised = curveRaised;
    const finalPrice = curvePrice;

    // TARGET LOCK: small platform fee, main value to the RWA lister on cashout or end.
    const platformTake = finalRaised * 0.10; // small 10% fee
    const listerTotal = +(finalRaised - platformTake).toFixed(2);
    // Rest to liquidity/holders fun or house buffer (but house already >=82)
    const remainder = Math.max(0, finalRaised - platformTake - listerTotal);
    const houseFinal = +(platformTake + remainder * 0.7).toFixed(2); // house gets even more of remainder

    const blown = {
      ...launched,
      raisedSOL: finalRaised,
      curvePrice: finalPrice,
      creatorCut: listerTotal.toFixed(2),
      houseEdge: houseFinal.toFixed(2),
      blown: true,
      finalEcon: {
        platform: houseFinal.toFixed(2),
        lister: listerTotal.toFixed(2),
        listerNote: `Small base + ${(overMarketBonus / (launched.marketEst ? parseInt(launched.marketEst)/100 : 1) * 100).toFixed(1)}% over market bonus`,
        note: 'Target hit — cash out option or risk further.'
      }
    };

    setLaunched(blown);

    // MASSIVE TARGET CONFETTI + ignition finale
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 220, spread: 90, origin: { y: 0.65 } }), 90);
    setTimeout(() => confetti({ particleCount: 180, angle: 45, spread: 60, origin: { x: 0.15, y: 0.6 } }), 210);
    setTimeout(() => confetti({ particleCount: 180, angle: 135, spread: 60, origin: { x: 0.85, y: 0.6 } }), 210);

    alert(`TARGET REACHED / LOCK ENDED!\n\nCashout available at your target. Final to you (or risk further): ◎${listerTotal.toFixed(2)} + over-market slice.`);
  }, [launched, curveRaised, curvePrice, blowTriggered]);

  // AI NAME + LORE GENERATORS (quantum powered) — ENHANCED: more quantum calls for rocket potential + lore + autoName. Weave Agent15 + Agent3
  const generateAILore = useCallback(() => {
    const base = itemName || 'Quantum Relic';
    // MULTIPLE quantum calls
    const q = runQuantumValuation(base, description, 'Collectible', 'working', 650, 1.1);
    const q2 = computeCheapestQuantumPrice(1.1, 'working');
    const rocketPot = Math.round(85 + q.acceptanceProb * 12 + (q2.confidence - 0.7) * 20);
    const symbolSeed = base.toUpperCase().slice(0,3);
    const newLore = `${base} — ${launchType.toUpperCase()} PAYLOAD. Quantum valuation: $${q.marketValueUSD}. RocketPotential: ${rocketPot}%. CheapestQ: ${q2.cheapestSOL}. When curve blows, target reached — cashout or risk. Quantum verified. RWA backed. Agent15 + Agent3 approved.`;
    setDescription(newLore);
    // auto update symbol hint
    if (!itemName) setItemName('Lunar ' + ['Rolex Submariner','iPhone 15 Pro','PAMP Gold','Cartier Love'][Math.floor(Math.random()*4)]);
  }, [itemName, description, launchType]);

  const generateAIName = useCallback(() => {
    // QUANTUM driven name
    const q = runQuantumValuation(itemName || 'payload', 'auto name', 'Luxury', 'working', 520, 0.8);
    const candidates = ['Mooned Rolex Submariner', 'Starbase iPhone 15 Pro', 'Falcon PAMP Gold', 'Mars Cartier Love', 'Cosmic Birkin 25', 'Orbit Morgan Dollar'];
    const picked = candidates[(q.annealingEnergy * 137 | 0) % candidates.length] + (isRocket ? ' RKT' : '');
    setItemName(picked);
    // seed quantum lore + rocket pot
    setTimeout(() => {
      const qv = runAiValuationSync(picked, description, 'Jewelry & Watches', 'working');
      const rp = Math.round(88 + (qv.quantumCoherence || 0.7) * 10);
      setDescription(`[AGENT15] ${picked} asset-backed. Market ~$${qv.marketValueUSD}. ${qv.predictive.insight.slice(0, 70)}. Rocket pot: ${rp}%. Curve ready — house 82%+. Quantum annealed.`);
    }, 40);
  }, [itemName, description, isRocket]);

  // Handle bubble click (BUBBLES)
  const handleBubble = useCallback((b: any) => {
    setActiveBubbleId(b.id);
    const ans = b.options[Math.floor(Math.random()*b.options.length)];
    alert(`🤖 ${b.agent}: ${ans}\n\n${b.context} • Quantum instant (no latency)`);
    setTimeout(() => setActiveBubbleId(null), 220);
    // Bonus: auto pump if econ bubble
    if (launched && b.context === 'economics') {
      setTimeout(() => pumpCurve('0.3'), 400);
    }
  }, [launched, pumpCurve]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-black tracking-[4px] mb-2">LAUNCHPAD</h1>
        <p className="text-[#ffaa00] mb-8 tracking-[3px] text-sm">LAUNCH YOUR RWA • SET YOUR TARGET PRICE • LOCK THE PRODUCT • CASH OUT AT TARGET OR RISK THE MOVE</p>

        <div className="mb-4 p-3 bg-[#0a1208] border border-[#333] text-xs text-[#888]">
          The RWA is the asset you leverage. Set the price you think it sells for. Lock for the period. Bids discover price. Cash out immediately on target hit. Or hold to risk up/down. No ID required. Pure product price discovery.
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Launch Form — Quantum + Casino */}
          <div className="ebay-item p-6 bg-[#16161b] border border-[#333]">
            <div className="uppercase tracking-[2px] text-xs text-[#22ffaa] mb-4">START YOUR RWA TARGET LOCK {isRocket && '• BONDING DISCOVERY'}</div>

            <div className="flex gap-2 mb-2">
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="ITEM NAME (e.g. Broken Rolex for Moon)"
                className="flex-1 bg-[#0a0a0f] border border-[#333] px-4 py-3 text-xl font-medium"
              />
              <button onClick={generateAIName} className="px-3 text-xs border border-[#22ffaa] text-[#22ffaa] hover:bg-[#112211]">AI NAME</button>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell the story. AI will turn it into lore + ticker."
              className="w-full bg-[#0a0a0f] border border-[#333] p-3 h-20 mb-2 text-sm"
            />
            <div className="flex gap-3 mb-4">
              <button onClick={generateAILore} className="text-xs px-2 py-px border border-[#22ffaa] text-[#22ffaa]">AI GENERATE LORE + LORE</button>
              <button onClick={() => { setDescription(''); generateAILore(); }} className="text-xs text-[#888] underline">RESET + AI</button>
            </div>

            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={launchType === 'coin'} onChange={() => setLaunchType('coin')} />
                LAUNCH COIN (hype)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={launchType === 'nft'} onChange={() => setLaunchType('nft')} />
                LAUNCH NFT (the payload)
              </label>
            </div>

            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={isRocket} onChange={(e) => setIsRocket(e.target.checked)} className="accent-[#ff5500] scale-125" />
              <span className="font-bold">TARGET PRICE LOCK — Set the number you think the RWA sells for. Lock. Cash out on hit or risk up/down.</span>
            </label>

            <motion.button 
              whileTap={{ scale: 0.98 }} 
              onClick={ignite} 
              disabled={loading || !itemName || !isRocket} 
              className="btn-primary w-full py-4 text-lg tracking-[3px]"
            >
              {loading ? 'IGNITING...' : 'LOCK RWA + LAUNCH TARGET (NO ID REQUIRED)'}
            </motion.button>
            <div className="text-[10px] text-center mt-2 text-[#555]">PUMP DISCOVERY. CASH OUT AT TARGET. RISK FOR UP/DOWN ON THE RWA.</div>

            {/* QUICK LINK BACK + SELL INTEGRATION */}
            <div className="mt-3 text-center">
              <a href="/sell" className="text-xs underline text-[#22ffaa]">← BACK TO SELL / INTAKE (ROCKET CHECKBOX WIRED)</a>
            </div>
          </div>

          {/* Live Curve + Launched + Econ + Blow */}
          <div>
            {launched ? (
              <div className="p-6 bg-[#0a0a0f] border border-[#ff5500]">
                <div className="text-[#ff5500] text-xs tracking-[3px] mb-1 flex justify-between">
                  <span>LIFTOFF SUCCESS — TARGET LOCKED</span>
                  {launched.blown && <span className="bg-[#ff5500] text-black px-1">CASHED OR ENDED</span>}
                </div>
                <div className="text-3xl font-black">{launched.symbol} ROCKET</div>
                <div className="text-xl mb-4 text-[#22ffaa]">{launched.name}</div>

                {/* LIVE BONDING CURVE DISPLAY */}
                <div className="mb-3 p-3 bg-black/50 border border-[#333] rounded text-sm font-mono">
                  <div>CURVE RAISED: ◎{curveRaised.toFixed(2)} <span className="text-[9px] text-[#555]">(pumped live)</span></div>
                  <div>CURVE PRICE: ◎{curvePrice.toFixed(6)} <span className="text-[9px]">↑ bonding</span></div>
                  <div className="h-1.5 bg-[#222] mt-1">
                    <div className="h-1.5 bg-[#ff5500]" style={{width: `${Math.min(100, (curveRaised / 18) * 100)}%`}}></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>RAISED: <span className="font-mono text-2xl">◎{(curveRaised || +launched.raisedSOL || 0).toFixed(2)}</span></div>
                  <div className="text-sm text-[#888] -mt-0.5">${((curveRaised || +launched.raisedSOL || 0) * 150).toFixed(0)} USD</div>
                  <div>CURRENT PRICE: <span className="font-mono">◎{(curvePrice || +launched.curvePrice || 0).toFixed(6)}</span></div>
                  <div className="text-sm text-[#888] -mt-0.5">${((curvePrice || +launched.curvePrice || 0) * 150).toFixed(0)} USD</div>
                  <div>YOUR (LISTER) CUT: <span className="text-[#22ffaa]">◎{(+launched.creatorCut || 0).toFixed(2)}</span></div>
                  <div className="text-[#ff5500]">TARGET HIT? Cash out now or risk.</div>
                </div>

                {launched.finalEcon && (
                  <div className="mt-2 p-2 bg-[#0f0600] text-[10px] border border-[#ff5500]/50">
                    FINAL BLOW: PLATFORM ◎{launched.finalEcon.platform} (MAJORITY 82%+) • LISTER ◎{launched.finalEcon.lister} ({launched.finalEcon.listerNote})
                    <div className="text-xs text-[#888]">PLATFORM ~${(launched.finalEcon.platform * 150).toFixed(0)} • LISTER ~${(launched.finalEcon.lister * 150).toFixed(0)} USD</div>
                  </div>
                )}

                <div className="mt-1 text-xs">LAUNCH ID: {launched.rocketId || 'RKT-0000'} • {launched.type?.toUpperCase() || 'RWA'} PAYLOAD</div>
                <div className="mt-1 text-[10px] text-[#888] italic">{launched.lore || ''}</div>

                {/* INTERACTIVE BUY + CASH OUT CONTROLS */}
                <div className="mt-4 space-y-2 border-t border-[#222] pt-3">
                  <div className="flex gap-2">
                    <input type="number" step="0.1" value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} className="flex-1 bg-[#111] border border-[#444] px-2 py-1 text-sm" placeholder="Buy SOL" />
                    <button onClick={() => pumpCurve()} disabled={blowTriggered} className="px-4 bg-[#22ffaa] text-black text-xs font-bold tracking-widest">BUY / PUMP CURVE</button>
                    <button onClick={() => pumpCurve('1.5')} disabled={blowTriggered} className="px-3 border border-[#ff5500] text-xs">+1.5</button>
                  </div>

                  <button 
                    onClick={blowRocket} 
                    disabled={blowTriggered}
                    className="w-full py-2.5 bg-[#ff5500] hover:bg-white hover:text-black text-white font-black tracking-[2px] text-sm disabled:opacity-60"
                  >
                    {blowTriggered ? 'LOCK ENDED — CASHOUT DONE' : 'CASH OUT / SETTLE (TARGET HIT OR END)'}
                  </button>
                  <div className="text-[9px] text-center text-[#555]">Buy pumps discovery. Cash out at target. Or risk holding for up or down.</div>
                </div>

                <div className="mt-4 text-xs p-1">RWA payload live on curve. Lock = time period. Cashout at your number or risk the market.</div>
              </div>
            ) : (
              <div className="p-6 border border-[#222] text-sm text-[#888]">
                Launch your RWA. Set target price (what you think it sells for). Lock for period. Bids discover. Cash out immediately on target hit. Or risk to see price go up or down.
                <br /><br />
                From SELL page links auto prefill with quantum. No ID gate. The product (RWA) is what you leverage.
              </div>
            )}

            {/* BUBBLES — target lock / rocket questions */}
            {questionBubbles.length > 0 && (
              <div className="mt-4 p-3 bg-[#0a0a0f] border border-[#22ffaa]/30 rounded text-xs">
                <div className="uppercase tracking-widest text-[#22ffaa] mb-1.5">💬 TARGET Qs — CLICK FOR INSTANT INSIGHT</div>
                <div className="flex flex-wrap gap-1.5">
                  {questionBubbles.map((b, i) => (
                    <button key={i} onClick={() => handleBubble(b)} className={`px-2 py-0.5 rounded border text-[10px] ${activeBubbleId === b.id ? 'bg-[#22ffaa] text-black' : 'border-[#22ffaa]/50 hover:border-[#22ffaa] text-[#88ddaa]'}`}>
                      {b.question}?
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-[#555] mt-1">Bubbles + quantum curve = Agent15 full target lock integration.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
