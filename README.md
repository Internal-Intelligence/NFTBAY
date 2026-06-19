# NFTBAY

**NFTBAY** — The New eBay for Crypto + Built-in Pawn Shop

A decentralized marketplace that feels like eBay but is powered by a **backend pawn shop** model.

**Core Thesis**: People don't always want to sell their NFTs. They often need **liquidity** while keeping ownership upside. NFTBAY lets users **Buy / Sell / Pawn** seamlessly.

- Shop with full eBay-style discovery, trust, and "Buy It Now"
- Pawn any NFT for instant SOL (loan against collateral). Repay to reclaim. No forced sale.
- Everything runs through on-chain escrow (the perfect technical primitive for pawn mechanics).

**eBay-Inspired Model Adapted to Blockchain**:
- **Two-sided platform**: Buyers & sellers (creators/collectors) connect directly.
- **Revenue**: Platform fees (final value % + listing), promoted listings (ads), premium subscriptions, royalties enforcement.
- **Trust**: On-chain escrow, reputation, buyer protection via fees/DAO, authenticity via verified collections & provenance.
- **Discovery**: Categories (Space-themed + general), search, auctions + fixed price, promoted/boosted listings.
- **Network Effects**: Liquidity flywheel, incentives for early users.
- **Solana Advantages**: Near-zero fees, instant settlement, full on-chain transparency, composability with DeFi.

Current MVP supports mint (Metaplex), list/buy with escrow, cancel. SpaceX-themed UI for "launching" digital assets to orbit.

See below for full eBay research and how we're bringing the model on-chain.

## Features (MVP)

- Connect Solana wallet (Phantom, Solflare, etc.)
- Mint new NFTs (image + metadata via Pinata)
- List NFTs for fixed-price sale
- Browse active listings
- Purchase listed NFTs (atomic on-chain)
- Cancel listings
- View your owned NFTs

## Tech Stack

- **On-chain**: Anchor (Rust) program for listings/escrow
- **Frontend**: Next.js 14 + TypeScript + Tailwind
- **Wallet**: @solana/wallet-adapter
- **NFTs**: Metaplex UMI + mpl-token-metadata
- **Storage**: Pinata (IPFS)

## Project Structure

```
NFTBAY/
├── programs/
│   └── nftbay/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs
├── frontend/
│   ├── components/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── ...
├── tests/
├── Anchor.toml
├── Cargo.toml
├── setup.sh
└── package.json
```

## Getting Started

```bash
# 1. Run the setup script
chmod +x setup.sh
./setup.sh

# 2. Copy env example and fill keys
cp frontend/.env.local.example frontend/.env.local

# 3. Start frontend
cd frontend && npm run dev
```

## Environment Variables (frontend/.env.local)

```
NEXT_PUBLIC_PROGRAM_ID=...
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

## Deploy Program

```bash
anchor build
anchor keys list
# update declare_id! and Anchor.toml
anchor deploy --provider.cluster devnet
```

## eBay Business Model Research & NFTBAY Adaptation

### eBay's Core Business Model (Research Summary, 2026)
eBay is the classic **two-sided marketplace platform** (C2C/B2C). It does **not** sell products itself or hold inventory — it connects buyers and sellers and takes a cut.

**Revenue Streams** (from eBay filings, Investopedia, seller center):
- **Final Value Fees**: 12.25%–15.3% of total sale (item + shipping) + small per-order fee ($0.30–$0.40). Tiered by category; lower for high-volume/electronics.
- **Promoted Listings / Advertising**: Performance-based ( % of sale or CPC). Major growth area ("any-click" model).
- **Listing/Insertion Fees**: Mostly free now (limits apply); paid for heavy sellers.
- **Store Subscriptions**: Monthly plans with fee discounts + tools.
- **Payments & Shipping**: eBay Payments cut + label sales.
- **Other**: International fees, ads.
- ~$10B+ annual revenue on $70B+ GMV. Marketplace fees dominate; ads growing.

**Key Success Factors & How They "Figured It Out"**:
- **Network Effects** (the flywheel): More sellers = more choice/variety for buyers → more buyers = more demand for sellers. Early mover (1995 auctions) built critical mass.
- **Trust as the Killer Feature**:
  - Buyer Protection / Money Back Guarantee (refunds for non-delivery or "not as described").
  - Reputation/Feedback system (seller ratings — hard to fake, costly to lose; trusted sellers get premiums).
  - Authenticity Guarantee (professional verification for high-value/collectibles — sneakers, watches, cards).
  - Managed payments (escrow-like holding) + fraud AI + policies against off-platform deals.
- **Hybrid Formats**: Started with auctions (excitement/liquidity), evolved to Fixed Price + "Buy It Now".
- **Discovery & Categories**: Deep categorization (especially **Collectibles** — trading cards, memorabilia, coins — perfect NFT analog), powerful search, recommendations.
- **Seller Tools & Incentives**: Promoted listings (pay-to-play visibility), stores, analytics, international shipping.
- **Vertical Focus for High-Value**: "Vault", guarantees, fit guarantees reduce risk/friction in expensive categories.
- **Diversified Monetization**: Transaction fees (performance-based, only on success) + ads + subs = resilient.
- **Platform Stickiness**: Low listing friction for casuals + pro tools; buyer protection locks in users.
- **Evolution Lessons**: Spun out PayPal, focused on core. Uses data/AI/live commerce. International but localized.

eBay wins by being the **trusted, liquid meeting place** for things where buyers/sellers need discovery + protection (especially collectibles & unique items).

### Bringing the eBay Model to Solana via NFTBAY
NFTBAY is already a **decentralized two-sided NFT marketplace** with escrow (like eBay's protection), on-chain settlement (faster/cheaper than traditional), and Metaplex standards.

**Direct Adaptations** (many already partially in place):
- **Revenue (eBay-style, on-chain)**:
  - Final value / platform fees (current `fee_bps` in marketplace — make tiered by volume/category in future versions).
  - Listing fees (small SOL or token to deter spam).
  - Promoted listings (pay SOL for boosted visibility in frontend queries or priority).
  - Premium "Stores" (token/NFT subscription for lower fees, featured placement, analytics).
  - Royalties (enforced via Metaplex on secondary sales).
  - Treasury/DAO takes fees for sustainability (like eBay's cut).

- **Trust & Safety (eBay's biggest moat → on-chain version)**:
  - Escrow (already implemented: NFT locked until buyer pays).
  - On-chain reputation (seller/buyer scores in program accounts or via NFTs).
  - Buyer protection (fee-funded insurance pool + on-chain disputes/DAO votes).
  - Authenticity (verified collections, on-chain provenance via metadata + history, "Guarantee" badges via partners).
  - "Vault" analog: Enhanced escrow + fractional or high-value custody features.

- **Trading Formats**:
  - Fixed price (current).
  - Auctions (add to program: time-limited bids or Dutch auctions for excitement/liquidity).
  - "Buy It Now" + offers.

- **Discovery & Categories** (eBay strength):
  - Categories: Space/Sci-Fi (leveraging SpaceX theme), Art, Gaming, Collectibles, Music, etc.
  - Powerful search/filters in frontend.
  - Recommendations, "similar listings", saved searches/watchlists.

- **Seller Experience** (tools + incentives):
  - My Listings dashboard + analytics (parse program events).
  - Store profiles (custom NFT storefronts).
  - Promoted/boosted listings for visibility.

- **Network Effects & Growth**:
  - Bootstrap with airdrops, fee holidays, partnerships (other Solana NFT projects).
  - Governance token for community control of fees/features (DAO).
  - Composability: List NFTs usable as collateral in other protocols.
  - Global by default (Solana + wallets).

- **Solana Superpowers** (beyond eBay):
  - Near-zero fees + sub-second finality.
  - Full transparency (anyone can audit fees, history, escrows).
  - Programmable money & royalties.
  - Censorship resistance.
  - Low barrier for global creators.

**NFTBAY Implementation Roadmap** (leveraging existing code):
1. **Fees & Monetization** (current placeholder → eBay-like):
   - Tiered final value fees.
   - Listing fee on `list_nft`.
   - Promoted flag + payment.

2. **Auctions** (add for eBay DNA):
   - New instructions: create_auction, place_bid, settle_auction.

3. **Trust Layer**:
   - Reputation PDAs.
   - Verified collections integration.
   - On-chain events for history.

4. **Frontend (eBay UX)**:
   - Sidebar categories.
   - Search + filters.
   - Seller stores.
   - Promoted / "Featured Launches" section.
   - Auction tabs + countdowns.
   - Reputation badges.

5. **Governance & Ops**:
   - DAO for fee parameters.
   - Treasury PDA.

6. **SpaceX Flair** (current theme): "The eBay of the Space Age" — launch your NFTs to orbit with rocket-fast Solana txs.

See `programs/nftbay/src/lib.rs` (escrow + fees already solid base; we recently fixed PDA re-use, bumps, constraints for production readiness).

Frontend (Next.js + wallet-adapter + Metaplex) ready for eBay-style discovery.

**Next Actions (to execute)**:
- Enhance program with auctions + promoted.
- Add categories/search to UI.
- Implement on-chain reputation.
- Update IDL after rebuild.
- Deploy + initialize marketplace with sensible fee_bps (e.g. 250 = 2.5%).
- Market as "eBay for Solana NFTs — trusted, liquid, on-chain."

This turns NFTBAY into a true decentralized analog of eBay: liquid two-sided market for unique digital assets, with fees only on success, strong trust primitives, and discovery tools — all on fast, cheap Solana rails.

---

## THE PAWN SHOP VISION (2026 Update)

**"eBay interface. Pawn shop backend."**

The killer insight: The biggest problem for NFT holders is **illiquidity**. Selling destroys upside. PawnBAY solves this:

- User deposits NFT into escrow → receives SOL loan immediately (e.g. 40-70% of estimated value)
- Repay loan + interest anytime → reclaim the NFT
- Default after term → NFT can be auctioned/sold by the platform (platform takes the risk or passes to lenders)

**Why this can be huge + go viral**:
- "I pawned my Pudgy and bought a car without selling" stories
- "Keep the rocket, unlock the fuel"
- True product-market fit for collectors, degens, and artists who are asset-rich / cash-poor
- Network effects stronger than pure marketplace (more locked collateral = more trust + fees on repayment too)

### Current Implementation (Frontend-first)
- "Pawn for Instant SOL" buttons everywhere
- Active Pawns dashboard in My NFTBAY (repay to reclaim)
- Clear explanations + "No forced sale" messaging
- Demo pawn flow that simulates cash-out + escrow lock
- Full eBay layout + SpaceX excitement kept

### Missing / Next Critical Pieces (Plan)

**1. Real Pawn Mechanics (Program)**
- New instructions: `pawn_nft(loan_amount, duration, interest_bps)`
- Loan PDA + separate collateral escrow or reuse listing
- `repay_loan` (pay principal + interest → release NFT)
- `liquidate_default` (after expiry, move to auction or platform claim)
- Interest accrual on-chain or simple time-based

**2. Capital / Liquidity for Loans**
- Platform treasury that funds pawns (take risk for upside)
- Or peer-to-peer: other users can fund loans against specific NFTs (like NFTfi)
- Revenue: origination fee + interest spread

**3. Valuation**
- Simple: Use collection floor from Magic Eden / Tensor API or on-chain oracle
- Advanced: On-chain appraisal bounties or community votes

**4. More eBay Trust Layers**
- Full on-chain reputation / feedback (leave stars after repay or purchase)
- Buyer protection window extended to pawn redemptions
- "Verified Pawn" for high-value items

**5. Viral Growth Levers**
- Referral: "Invite a friend. Earn 1% of their first pawn repayment."
- "Pawn of the Day" / trending pawns feed
- Shareable pawn receipts ("I just unlocked 12 SOL on my [NFT] without selling")
- "First Pawn is Fee-Free" onboarding campaign
- Integration with Twitter/X via direct "pawn this" links from metadata
- Meme contests around "I didn't sell, I pawned"

**6. UX Polish for Mass Adoption**
- One-click valuation estimate
- Loan calculator (LTV, interest, risk)
- Notifications (on-chain events → email / in-app / push via Helius)
- Portfolio view: "Total value pawned", "Potential upside still mine"

**7. Compliance / Positioning**
- Clear legal framing: "Asset-backed advance", not "loan" if needed
- Emphasize user control ("You decide when to repay")
- Transparent terms shown before every pawn

This model makes NFTBAY much stickier than pure marketplaces. People will come for the shopping experience but stay (and bring friends) because of the liquidity tool.

---

## Quick Start (updated)

## Quick Start

```bash
cd NFTBAY
./setup.sh
cd frontend
cp .env.local.example .env.local
# add Pinata JWT + real PROGRAM_ID after deploy
npm run dev
```

Open http://localhost:3000

## License

MIT

---

Built with the same patterns as Internal-Intelligence tooling. eBay model adapted for the on-chain era.