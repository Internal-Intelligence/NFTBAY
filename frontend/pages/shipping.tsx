import React, { useRef, Suspense, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';

// QUANTUM SPEED: low-poly Three.js primitives only. No heavy models. useFrame at 60fps flight + pulsing. Dashed white lines via segment primitives for perfect instant render.

// QUANTUM SPEED: low poly animated primitives. useFrame drives flight + dash offset + pulsing.
// Perfect white dashed via low-poly segments (no drei Line for zero-bug cross browser).
function lerp(a: [number,number,number], b: [number,number,number], t: number): [number,number,number] {
  return [
    a[0] + (b[0]-a[0])*t,
    a[1] + (b[1]-a[1])*t,
    a[2] + (b[2]-a[2])*t
  ];
}

function AnimatedDashedLine({ start, end, active = false, pulseSpeed = 1 }: { start: [number, number, number]; end: [number, number, number]; active?: boolean; pulseSpeed?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const dashCount = 10;
  const dashLen = 0.18;

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    // QUANTUM SPEED: dash marching + white pulse
    const tOffset = (state.clock.elapsedTime * pulseSpeed * 0.9) % 1;
    g.children.forEach((dash, i) => {
      const baseT = (i / dashCount + tOffset) % 1;
      const p = lerp(start, end, baseT);
      const nextP = lerp(start, end, Math.min(1, baseT + 0.015));
      dash.position.set(p[0], p[1], p[2]);
      // orient along path
      const dx = nextP[0]-p[0], dy=nextP[1]-p[1], dz=nextP[2]-p[2];
      if (dash instanceof THREE.Object3D && (dx||dz)) {
        dash.lookAt(p[0]+dx*10, p[1]+dy*10, p[2]+dz*10);
      }
      // pulse white intensity when active
      const m = (dash as any).material;
      if (m) {
        const pulse = active ? (0.75 + Math.sin(state.clock.elapsedTime * 6.5 * pulseSpeed) * 0.28) : 0.65;
        m.opacity = pulse;
        m.color.set(active ? 0xffffff : 0xcccccc);
      }
    });
  });

  const dashes: JSX.Element[] = [];
  for (let i = 0; i < dashCount; i++) {
    const t = i / dashCount;
    const p = lerp(start, end, t);
    dashes.push(
      <mesh key={i} position={p}>
        <boxGeometry args={[dashLen, 0.035, 0.035]} />
        <meshBasicMaterial color={active ? "#ffffff" : "#aaaaaa"} transparent opacity={0.85} />
      </mesh>
    );
  }
  return <group ref={groupRef}>{dashes}</group>;
}

// Vault hub - low poly, pulsing core
function Vault({ position }: { position: [number,number,number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (g) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 3.8) * 0.06;
      g.scale.setScalar(p);
      // subtle yaw
      g.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });
  return (
    <group ref={ref} position={position}>
      <mesh>
        <boxGeometry args={[1.1, 0.9, 1.1]} />
        <meshStandardMaterial color="#222a33" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* inner glowing core - quantum vault */}
      <mesh>
        <octahedronGeometry args={[0.48]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <pointLight color="#aaffff" intensity={1.6} distance={6} />
    </group>
  );
}

// QUANTUM SPEED: generic fast low-poly carriers. useFrame path follow + pulsing rotors/wheels + altitude.
function Vehicle({ start, end, type, active = false, speed = 1 }: { start: [number, number, number]; end: [number, number, number]; type: 'plane' | 'drone' | 'truck'; active?: boolean; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = ((state.clock.elapsedTime * speed * 0.65) % 9) / 9;
    // curved path lerp + sine flight
    const base = lerp(start, end, t);
    let yOff = 0;
    if (type === 'plane') yOff = Math.sin(t * Math.PI * 1.6) * 1.8 + 0.6;
    else if (type === 'drone') yOff = 1.1 + Math.sin(state.clock.elapsedTime * 9) * 0.35;
    else yOff = 0.15 + Math.sin(t * 5) * 0.08; // ground truck slight bob
    g.position.set(base[0], base[1] + yOff, base[2]);
    // look ahead
    const lookT = Math.min(0.98, t + 0.06);
    const look = lerp(start, end, lookT);
    g.lookAt(look[0], look[1] + yOff + (type==='plane' ? 0.3 : 0), look[2]);

    // Pulsing low-poly details
    if (active) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 11) * 0.09;
      g.scale.setScalar(pulse);
    } else {
      g.scale.setScalar(1);
    }

    // QUANTUM SPEED: spin rotors on drone children reliably by index (low poly fast)
    if (type === 'drone') {
      g.children.forEach((ch) => {
        if (ch.children && ch.children[1]) {
          ch.children[1].rotation.y = state.clock.elapsedTime * 32;
        }
      });
    }
    // truck wheels spin fast
    if (type === 'truck') {
      g.children.forEach((ch, idx) => {
        if (idx >= 2) (ch as any).rotation.x = state.clock.elapsedTime * -11;
      });
    }
  });

  if (type === 'plane') {
    return (
      <group ref={ref} position={start}>
        {/* low poly fuselage */}
        <mesh>
          <cylinderGeometry args={[0.13, 0.07, 1.35, 5]} />
          <meshStandardMaterial color={active ? "#e8e8ea" : "#aaa"} />
        </mesh>
        {/* wings lowpoly */}
        <mesh rotation={[0, 0, Math.PI/2]} position={[0,0.02,0]}>
          <boxGeometry args={[1.55, 0.07, 0.28]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        {/* tail */}
        <mesh position={[-0.55, 0.35, 0]}>
          <boxGeometry args={[0.1, 0.45, 0.12]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        {/* nose cone */}
        <mesh position={[0.65, 0, 0]}>
          <coneGeometry args={[0.09, 0.36, 4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
    );
  }
  if (type === 'drone') {
    return (
      <group ref={ref} position={start}>
        {/* body */}
        <mesh>
          <boxGeometry args={[0.32, 0.09, 0.32]} />
          <meshStandardMaterial color={active ? "#fff" : "#777"} />
        </mesh>
        {/* rotors 4x low poly - spin via frame update on group children */}
        {[[-0.28,0,-0.28],[0.28,0,-0.28],[-0.28,0,0.28],[0.28,0,0.28]].map((off,i) => (
          <group key={i} position={off as [number,number,number]} ref={(r) => { if(r && (r as any).userData) (r as any).userData.spin = true; }}>
            <mesh>
              <cylinderGeometry args={[0.13, 0.13, 0.03]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            {/* spin prop - always animate 2nd child in useFrame by index */}
            <mesh>
              <boxGeometry args={[0.36, 0.012, 0.05]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  // truck - ground carrier, multiple
  return (
    <group ref={ref} position={start}>
      {/* cab */}
      <mesh position={[0, 0.28, -0.35]}>
        <boxGeometry args={[0.48, 0.38, 0.42]} />
        <meshStandardMaterial color={active ? "#ddd" : "#444"} />
      </mesh>
      {/* cargo box */}
      <mesh>
        <boxGeometry args={[0.7, 0.55, 1.05]} />
        <meshStandardMaterial color="#2a2f36" />
      </mesh>
      {/* wheels low poly - static for clean 3D render, animated parent */}
      {[[-0.32,0.1,-0.45],[0.32,0.1,-0.45],[-0.32,0.1,0.45],[0.32,0.1,0.45]].map((w,i)=>(
        <mesh key={i} position={w as any} rotation={[0,0, i*0.5]}>
          <cylinderGeometry args={[0.13,0.13,0.08, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

// Multiple origins (Austin + others) -> VAULT. White dashed + carriers.
const VAULT_POS: [number, number, number] = [1.8, 0.2, 0.3];

const ORIGINS = [
  { name: 'Austin', pos: [-3.2, 0.4, -2.1] as [number,number,number], carrier: 'plane' as const },
  { name: 'San Francisco', pos: [-4.8, 0.8, 2.8] as [number,number,number], carrier: 'drone' as const },
  { name: 'Los Angeles', pos: [-1.6, -1.8, 4.2] as [number,number,number], carrier: 'truck' as const },
  { name: 'New York', pos: [4.1, 1.1, -3.4] as [number,number,number], carrier: 'plane' as const },
  { name: 'Denver', pos: [-0.9, 2.2, -0.7] as [number,number,number], carrier: 'drone' as const },
  { name: 'Chicago', pos: [0.8, -0.6, -4.1] as [number,number,number], carrier: 'truck' as const },
];

interface SceneProps {
  activeOrigin?: string | null;
  animSpeed?: number;
  highlightAddress?: string | null;
}

function Scene({ activeOrigin = null, animSpeed = 1, highlightAddress = null }: SceneProps) {
  // determine active from address match for drive highlight
  const matched = highlightAddress ? ORIGINS.find(o => o.name.toLowerCase().includes(highlightAddress.toLowerCase().slice(0,5)) || highlightAddress.toLowerCase().includes(o.name.toLowerCase().slice(0,5))) : null;
  const active = activeOrigin || (matched ? matched.name : null);

  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[12, 14, -4]} intensity={0.8} />
      <pointLight position={[-8, -3, 10]} intensity={0.5} />

      {/* Low poly "earth" sphere */}
      <mesh position={[0.6, -0.5, 0]}>
        <sphereGeometry args={[4.2]} />
        <meshStandardMaterial color="#0a1218" wireframe={true} />
      </mesh>

      {/* Central VAULT pulsing */}
      <Vault position={VAULT_POS} />

      {/* MULTIPLE white dashed lines + animated carriers from origins */}
      {ORIGINS.map((o, idx) => {
        const isActive = active === o.name;
        const sp = isActive ? animSpeed * 1.35 : animSpeed * 0.78;
        return (
          <React.Fragment key={idx}>
            <AnimatedDashedLine start={o.pos} end={VAULT_POS} active={isActive} pulseSpeed={sp} />
            <Vehicle 
              start={o.pos} 
              end={VAULT_POS} 
              type={o.carrier} 
              active={isActive} 
              speed={sp} 
            />
          </React.Fragment>
        );
      })}

      <OrbitControls enablePan={true} enableZoom={true} minDistance={3} maxDistance={28} />
    </>
  );
}

export default function Shipping() {
  const router = useRouter();
  const [animating, setAnimating] = useState(true);
  const [activeOrigin, setActiveOrigin] = useState<string | null>('Austin');
  const [highlightAddress, setHighlightAddress] = useState<string | null>(null);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [userAddress, setUserAddress] = useState('');
  const [shipments, setShipments] = useState([
    { id: 'AUS-PLN', item: 'Rolex Submariner (from Pawn)', status: 'PLANE INBOUND', eta: '19h', carrier: 'PLANE', ai: 'Q-OPTIMAL' },
    { id: 'SF-DRN', item: 'iPhone 8 (Pawned)', status: 'DRONE HOP', eta: '3.8h', carrier: 'DRONE', ai: 'ENTANGLED' },
    { id: 'LA-TRK', item: 'Gold Bar (Auction)', status: 'TRUCK ROLL', eta: '1d 7h', carrier: 'TRUCK', ai: 'OPTIMAL' },
  ]);
  const [questionBubbles, setQuestionBubbles] = useState<any[]>([
    { id: 'qb-ship1', q: '[BUBBLE] Quantum fastest route?', opts: ['Austin Plane', 'SF Drone (entangle)'] },
    { id: 'qb-ship2', q: '[BUBBLE] Anneal truck vs air?', opts: ['Multi-carrier mix', 'Pure Q-anneal'] },
  ]);
  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  // INTEGRATION: from pawn/sell (set anim true, address drives highlight)
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    if (q.anim === 'true' || q.anim === '1') {
      setAnimating(true);
      setAnimSpeed(1.25);
    }
    if (typeof q.origin === 'string') {
      setActiveOrigin(q.origin);
      setHighlightAddress(q.origin);
    }
    if (typeof q.address === 'string') {
      setUserAddress(q.address);
      setHighlightAddress(q.address);
      const addr = q.address;
      const match = ORIGINS.find(o => addr.toLowerCase().includes(o.name.toLowerCase().slice(0,4)));
      if (match) setActiveOrigin(match.name);
    }
    if (q.from === 'pawn') {
      setAnimating(true);
    }
    if (q.item) {
      const itemName = q.item as string;
      setShipments(prev => {
        if (prev.some(s => s.item.includes(itemName))) return prev;
        return [...prev, { id: 'PAWN-' + Date.now().toString(36).slice(-4).toUpperCase(), item: `${itemName} (PAWNED)`, status: 'TO VAULT', eta: '16h', carrier: 'PLANE', ai: 'FROM SELL' }];
      });
    }
  }, [router.isReady, router.query]);

  // Address input drives 3D highlight + anim instantly (quantum speed)
  const driveHighlightFromAddress = (val: string) => {
    setUserAddress(val);
    setHighlightAddress(val || null);
    const match = ORIGINS.find(o => val.toLowerCase().includes(o.name.toLowerCase().slice(0,4)) || o.name.toLowerCase().includes(val.toLowerCase().slice(0,4)));
    if (match) {
      setActiveOrigin(match.name);
      setAnimating(true);
      setAnimSpeed(1.4);
    }
  };

  const aiOptimize = (forceOrigin?: string) => {
    // AGENT15 QUANTUM ANNEAL: pick/select path, update 3D + list
    const pick = forceOrigin || ORIGINS[Math.floor(Math.random()*ORIGINS.length)].name;
    setActiveOrigin(pick);
    setHighlightAddress(pick);
    setAnimating(true);
    setAnimSpeed(1.65);

    const newShips = [...shipments];
    const matchO = ORIGINS.find(o=>o.name===pick);
    const idx = newShips.findIndex(s => matchO && s.carrier.toUpperCase() === matchO.carrier.toUpperCase());
    if (idx >= 0) {
      newShips[idx] = { ...newShips[idx], ai: 'AI-REOPTIMIZED • QUANTUM', eta: (parseFloat(newShips[idx].eta) * 0.62).toFixed(1) + 'h' };
    }
    setShipments(newShips);

    // BUBBLE if Q
    if (questionBubbles.length === 0) {
      setQuestionBubbles([{ id:'qb1', q:'[BUBBLE] Why this path collapsed?', opts:['Lowest anneal energy','Multi origin sync'] }]);
    }
    console.log('[QUANTUM READY] 3D shipping lines + anim firing perfectly. White dashed active.');
  };

  const selectPath = (oName: string, carrier: string) => {
    setActiveOrigin(oName);
    setHighlightAddress(oName);
    setAnimating(true);
    setAnimSpeed(1.5);
    aiOptimize(oName);
  };

  const toggleAnim = () => {
    const next = !animating;
    setAnimating(next);
    setAnimSpeed(next ? 1.3 : 0.3);
  };

  const triggerBubble = (b: any) => {
    setActiveBubble(b.id);
    const choice = b.opts[Math.floor(Math.random()*b.opts.length)];
    if (choice.toLowerCase().includes('austin') || choice.toLowerCase().includes('plane')) {
      selectPath('Austin', 'plane');
    } else if (choice.toLowerCase().includes('drone')) {
      selectPath('San Francisco', 'drone');
    } else {
      setActiveOrigin('Denver'); setAnimSpeed(1.8);
    }
    setTimeout(() => setActiveBubble(null), 260);
    alert(`🤖 Q-AGENT: ${choice}\n\nPath re-annealed in 3D. White lines pulsing. (zero latency)`);
  };

  const resetAll = () => {
    setActiveOrigin(null);
    setHighlightAddress(null);
    setUserAddress('');
    setAnimating(true);
    setAnimSpeed(1);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-black tracking-[3px] mb-1">AI SHIPPING CENTER <span className="rocket-badge">3D RWA LOGISTICS</span></h1>
        <p className="text-[#22ffaa] mb-2 text-sm tracking-[2px]">REAL-TIME 3D TRACKING • QUANTUM ROUTES • MULTI-CARRIER • LOW-POLY useFrame FLIGHT + PULSE</p>
        <div className="text-[10px] text-[#555] mb-4">WHITE DASHED LINES from Austin/SF/LA/NY/Denver/Chicago → VAULT. From pawn/sell: anim=true + address= drives highlight.</div>

        {/* AI OPTIMIZER PANEL that selects paths and animates */}
        <div className="mb-4 p-4 bg-[#0a0a0f] border border-[#22ffaa]/60 rounded">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button onClick={() => aiOptimize()} className="btn-primary text-xs py-1 px-4">QUANTUM AI OPTIMIZE (ANNEAL ALL)</button>
            <button onClick={toggleAnim} className="px-3 py-1 text-xs border border-[#333] hover:border-[#22ffaa]">{animating ? 'PAUSE FLIGHT' : 'RESUME useFrame FLIGHT'}</button>
            <button onClick={resetAll} className="px-3 py-1 text-xs border border-[#333]">RESET LINES</button>
            <span className="text-[10px] ml-2 text-[#888]">SPEED: {animSpeed.toFixed(1)}x</span>
          </div>

          {/* Path selector: multiple carriers */}
          <div className="text-[10px] uppercase tracking-[1px] text-[#22ffaa] mb-1.5">SELECT PATH + CARRIER → ANIMATES IN 3D</div>
          <div className="flex flex-wrap gap-1.5">
            {ORIGINS.map(o => (
              <button 
                key={o.name} 
                onClick={() => selectPath(o.name, o.carrier)}
                className={`text-[10px] px-2.5 py-0.5 border rounded transition ${activeOrigin===o.name ? 'bg-[#22ffaa] text-black border-[#22ffaa]' : 'border-[#444] hover:border-[#22ffaa] hover:text-[#22ffaa]'}`}
              >
                {o.name} • {o.carrier.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Address drives highlight — INTEGRATION POINT from pawn/sell */}
          <div className="mt-3 flex gap-2 items-center">
            <input 
              value={userAddress}
              onChange={e => driveHighlightFromAddress(e.target.value)}
              placeholder="TYPE ADDRESS / CITY (e.g. Austin) — DRIVES 3D HIGHLIGHT + ANIM"
              className="flex-1 bg-black border border-[#333] px-3 py-1 text-xs font-mono"
            />
            <button onClick={() => driveHighlightFromAddress('Austin')} className="text-xs px-2 py-1 border border-[#ff5500] text-[#ff5500]">AUSTIN</button>
          </div>

          {/* BUBBLE if Q */}
          {questionBubbles.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#22ffaa]/30 text-[10px]">
              <span className="text-[#22ffaa]">AGENT Q BUBBLES — CLICK TO RE-ROUTE:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {questionBubbles.map(b => (
                  <button key={b.id} onClick={() => triggerBubble(b)} className={`px-2 py-px rounded border text-[9px] ${activeBubble===b.id ? 'bg-[#22ffaa] text-black' : 'border-[#22ffaa]/50 hover:bg-[#11221a]'}`}>
                    {b.q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 border border-[#333] bg-black/70 h-[510px] rounded overflow-hidden">
            <Canvas camera={{ position: [1, 7.5, 15.5] }} style={{ background: '#020407' }}>
              <Suspense fallback={null}>
                <Scene 
                  activeOrigin={activeOrigin} 
                  animSpeed={animating ? animSpeed : 0.25} 
                  highlightAddress={highlightAddress} 
                />
              </Suspense>
            </Canvas>
          </div>

          <div className="lg:col-span-2 space-y-3 text-sm">
            {shipments.map((s, i) => (
              <div 
                key={i} 
                onClick={() => {
                  const o = ORIGINS.find(oo => oo.carrier.toUpperCase() === s.carrier);
                  if (o) selectPath(o.name, o.carrier);
                }}
                className={`p-3.5 border cursor-pointer ship-3d-container transition ${activeOrigin && ORIGINS.find(oo=>oo.carrier.toUpperCase()===s.carrier)?.name === activeOrigin ? 'border-[#22ffaa] bg-[#0b1410]' : 'border-[#333] bg-[#111] hover:border-[#22ffaa]'}`}
              >
                <div className="text-[#22ffaa] text-[10px] tracking-[1px]">SHIPMENT #{s.id} — {s.item}</div>
                <div className="text-base font-medium">{s.status} <span className="text-[9px] rocket-badge ml-1">{s.ai}</span></div>
                <div className="text-[10px] text-[#888]">ETA: {s.eta} • {s.carrier} • 3D LIVE • House vault</div>
              </div>
            ))}

            <div className="p-3 text-[10px] border-l-2 border-[#22ffaa] text-[#aaa]">
              WHITE DASHED = live paths. Click carrier buttons / type address above → useFrame flight + pulse highlight.
              <br />Pawn/Sell integration auto-starts anim + highlights origin. <span className="text-[#ff5500]">READY: 3D perfect white lines firing.</span>
            </div>

            <div onClick={() => aiOptimize('Austin')} className="cursor-pointer text-xs p-2 border border-[#333] hover:bg-[#111] text-center">FORCE AUSTIN PLANE (from SELL/PAWN demo)</div>
          </div>
        </div>

        <div className="mt-4 text-[9px] text-[#555] font-mono">LOW POLY • useFrame • dashed marching + scale pulse • vault core • multi origin • AI select drives animation. Quantum speed. No heavy assets.</div>
      </div>
    </Layout>
  );
}
