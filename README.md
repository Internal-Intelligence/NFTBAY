# NFTBAY

**NFTBAY** — A decentralized NFT marketplace on Solana.

Buy, sell, and discover unique digital collectibles with a clean, fast experience.

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

## Quick Start

```bash
cd NFTBAY
./setup.sh                  # installs toolchain if needed
cd frontend
cp .env.local.example .env.local
# edit .env.local with your Pinata JWT
npm run dev
```

Open http://localhost:3000

## License

MIT

---

Built with the same patterns as Internal-Intelligence tooling.