import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";

// You will replace the IDL after `anchor build` with the generated target/idl/nftbay.json
import { IDL } from "./idl";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "NFTBay1111111111111111111111111111111111111"
);

export function getProgram(wallet: WalletContextState, connection: Connection) {
  // AnchorProvider expects a full wallet adapter with signTransaction etc.
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as any;

  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });

  // In Anchor 0.30 + generated IDLs that include "address", pass only (idl, provider)
  // The program ID is read from the IDL metadata.
  return new Program(IDL as any, provider);
}

// PDA helpers
export function getMarketplacePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("marketplace")], PROGRAM_ID);
}

export function getListingPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getEscrowAuthorityPda(listing: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), mint.toBuffer(), listing.toBuffer()],
    PROGRAM_ID
  );
}

export const LAMPORTS_PER_SOL = 1_000_000_000;
