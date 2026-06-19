import Layout from '../components/Layout';
import { useEffect, useState } from 'react';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('nftbay_user') || 'demo@commander.space';
    const v = localStorage.getItem('nftbay_verified') === 'true';
    setUser({ email: u, wallet: 'connected', joined: '2025' });
    setVerified(v);
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black tracking-[3px] mb-4">COMMANDER PROFILE</h1>

        <div className="p-6 border border-[#333] bg-[#111] mb-8">
          <div className="flex justify-between">
            <div>
              <div className="text-2xl font-bold">{user?.email}</div>
              <div className="text-sm text-[#888]">Joined {user?.joined} • Wallet Connected</div>
            </div>
            {verified ? (
              <div className="text-[#22ffaa] text-right">✅ VERIFIED COMMANDER<br/><span className="text-xs">Trust badge (optional)</span></div>
            ) : (
              <div className="text-[#ff5500]">⚠️ VERIFY TO UNLOCK</div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-4 border border-[#333]">
            <h3 className="font-bold mb-2">AUTH &amp; SECURITY</h3>
            <div className="text-sm">Signed in via Wallet + Email (demo).<br />2FA in prod. Change password etc.</div>
            <button onClick={() => { localStorage.removeItem('nftbay_user'); localStorage.removeItem('nftbay_verified'); alert('Logged out.'); window.location.href='/'; }} className="mt-4 btn-secondary">LOGOUT</button>
          </div>

          <div className="p-4 border border-[#333]">
            <h3 className="font-bold mb-2">SERVICE AGREEMENT</h3>
            <div className="text-sm">You have accepted the full terms for RWA target locks, auctions, and shipping.<br /><a href="/terms" className="underline">READ FULL AGREEMENT →</a></div>
          </div>
        </div>

        <div className="mt-8 text-xs text-[#666]">Profile data stored locally for demo. Real auth + on-chain identity in production. All the way from login to terms accepted.</div>
      </div>
    </Layout>
  );
}
