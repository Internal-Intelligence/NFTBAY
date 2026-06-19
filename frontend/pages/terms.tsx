import Layout from '../components/Layout';

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto prose prose-invert">
        <h1 className="text-4xl font-black tracking-[3px] mb-2">NFTBAY SERVICE AGREEMENT</h1>
        <p className="text-sm text-[#888]">Last Updated: 2026 • The eBay of Space for Real Assets</p>

        <h2>1. Acceptance</h2>
        <p>By using NFTBAY, connecting your wallet, listing, bidding, pawning, launching, or shipping, you agree to these terms. This is a binding agreement for tokenized physical RWAs &lt;15lbs.</p>

        <h2>2. Platform Role</h2>
        <p>NFTBAY facilitates RWA auctions and launches. Sellers set target prices and lock products. Bids discover value. Cash out when target hit or risk the period. Small platform fees may apply for sustainability. We escrow and enable price discovery on the RWA itself.</p>

        <h2>3. User Verification (Optional)</h2>
        <p>ID verification is optional for a trust badge. No requirement for participating in auctions or launches. Real asset focus.</p>

        <h2>4. Listings &amp; Target Price Auctions</h2>
        <p>Items must be real, &lt;15lbs, with paperwork. Seller sets target price and lock duration for the RWA. The product is locked. Bids come in. Cash out immediately when bids reach your target. Or risk holding to see if the price discovery goes up or down. At end of lock, settle to highest if not cashed.</p>

        <h2>5. Pawn, Shipping &amp; Escrow</h2>
        <p>Pawns use on-chain escrow. Shipping via AI center (3D tracked, multiple carriers). You ship to NFTBAY vault. We cover tracked shipping for qualified items. Title/ownership transfers per smart contract.</p>

        <h2>6. Fees, Pricing &amp; AI Valuation</h2>
        <p>Platform fees as disclosed. AI/quantum valuations are estimates only. Actual market may vary. Correct pricing shown in listings based on real-world comps + SOL conversion. Target is your leverage on what you think it sells for.</p>

        <h2>7. Risks &amp; Disclaimers</h2>
        <p>Crypto, RWAs, physical items carry risk. No investment advice. Solana network risks. We are not responsible for lost shipments, market volatility, or third-party carriers. Use at your own risk. "To the moon" is aspirational.</p>

        <h2>8. Intellectual Property &amp; Conduct</h2>
        <p>Respect IP. No illegal items. Violations result in bans and forfeiture.</p>

        <h2>9. Termination &amp; Changes</h2>
        <p>We may update terms. Continued use = acceptance. Contact via on-site for disputes.</p>

        <p className="text-xs text-[#555] mt-8">By using NFTBAY you acknowledge this is a demo platform with real Solana mechanics for tokenized physical assets. RWA price discovery with target locks. Have fun responsibly. 🚀</p>
      </div>
    </Layout>
  );
}
