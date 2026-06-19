#!/usr/bin/env bash
set -e

echo "=== NFTBAY — Dev Setup ==="

# 1. Rust
if ! command -v rustc &>/dev/null; then
  echo "[1/6] Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
else
  echo "[1/6] Rust already installed: $(rustc --version)"
fi

# 2. Solana
if ! command -v solana &>/dev/null; then
  echo "[2/6] Installing Solana CLI..."
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
  echo "[2/6] Solana already installed: $(solana --version)"
fi

# 3. Anchor
if ! command -v anchor &>/dev/null; then
  echo "[3/6] Installing Anchor CLI..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked
  avm install 0.30.1
  avm use 0.30.1
else
  echo "[3/6] Anchor already installed: $(anchor --version)"
fi

# 4. Node
if ! command -v node &>/dev/null; then
  echo "[4/6] Installing Node.js via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
else
  echo "[4/6] Node already installed: $(node --version)"
fi

# 5. Wallet + airdrop
echo "[5/6] Setting up devnet wallet..."
solana config set --url devnet
if [ ! -f "$HOME/.config/solana/id.json" ]; then
  solana-keygen new --no-bip39-passphrase
fi
echo "Wallet: $(solana address)"
solana airdrop 2 || echo "(Airdrop may be rate limited)"

# 6. Install + build
echo "[6/6] Installing dependencies..."
cd "$(dirname "$0")"
npm install
cd frontend && npm install && cd ..

echo ""
echo "=== Building Anchor program ==="
anchor build || echo "Build will succeed after you update the program ID."

echo ""
echo "=== NFTBAY setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Update the program ID in Anchor.toml + programs/nftbay/src/lib.rs after anchor keys list"
echo "  2. cp frontend/.env.local.example frontend/.env.local"
echo "  3. Get Pinata JWT at https://app.pinata.cloud"
echo "  4. cd frontend && npm run dev"
echo ""
echo "Open http://localhost:3000"
