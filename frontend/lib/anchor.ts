import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";

// You will replace the IDL after `anchor build` with the generated target/idl/nftbay.json
import { IDL } from "./idl";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "NFTBay1111111111111111111111111111111111111"
);

export function getProgram(wallet: WalletContextState, connection: Connection) {
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
  });
  return new Program(IDL as any, PROGRAM_ID, provider);
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
