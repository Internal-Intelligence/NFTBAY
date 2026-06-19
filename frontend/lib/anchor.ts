import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddressSync 
} from "@solana/spl-token";

// You will replace the IDL after `anchor build` with the generated target/idl/nftbay.json
import { IDL } from "./idl";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "NFTBay1111111111111111111111111111111111111"
);

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;
export const ASSOCIATED_TOKEN_PROGRAM = ASSOCIATED_TOKEN_PROGRAM_ID;
export const SYSTEM_PROGRAM = SystemProgram.programId;
export const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

// AGENT 10: SINGLETON CONNECTION + PROGRAM CACHE + BATCH HELPERS for quantum-fast Solana I/O
let cachedConnection: Connection | null = null;
const programCache = new Map<string, any>(); // key: endpoint+pubkey or simple
const accountCache = new Map<string, { data: any; ts: number }>();
const ACCOUNT_CACHE_TTL = 4200; // ~4s for hot reads (grids instant)

export function getFastConnection(original: Connection): Connection {
  if (!cachedConnection) {
    // Reuse instance, higher commitment but allow fast reads with getAccountInfo
    cachedConnection = original;
  }
  return cachedConnection;
}

export function getProgram(wallet: WalletContextState, connection: Connection) {
  const rpc = connection.rpcEndpoint;
  const key = rpc + (wallet.publicKey?.toBase58() || 'anon');
  if (programCache.has(key)) return programCache.get(key);

  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  } as any;

  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const prog = new Program(IDL as any, provider);
  programCache.set(key, prog);
  return prog;
}

// AGENT 10: Batch Solana read (speed up grids + fetches)
export async function batchFetchAccounts(connection: Connection, pubkeys: PublicKey[]): Promise<any[]> {
  if (pubkeys.length === 0) return [];
  const now = Date.now();
  const toFetch: PublicKey[] = [];
  const results: any[] = new Array(pubkeys.length);
  const indices: number[] = [];

  pubkeys.forEach((pk, i) => {
    const k = pk.toBase58();
    const hit = accountCache.get(k);
    if (hit && now - hit.ts < ACCOUNT_CACHE_TTL) {
      results[i] = hit.data;
    } else {
      toFetch.push(pk);
      indices.push(i);
    }
  });

  if (toFetch.length > 0) {
    // Use getMultipleAccounts for blazing batch (1 roundtrip vs N)
    const infos = await connection.getMultipleAccountsInfo(toFetch, 'confirmed');
    infos.forEach((info, j) => {
      const idx = indices[j];
      const pk = toFetch[j];
      results[idx] = info;
      accountCache.set(pk.toBase58(), { data: info, ts: now });
    });
  }
  return results;
}

// AGENT 10: Fast write helper — skip preflight + lower commitment for demo speed
export async function fastRpcSend(methodsCall: any, skipPreflight = true) {
  return methodsCall.rpc({ skipPreflight, commitment: 'confirmed' });
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

export function getUserTokenAccount(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner);
}

export function getEscrowTokenAccount(escrowAuthority: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, escrowAuthority);
}

// ── Pawn Shop PDA helpers (new pawn instructions) ──
export function getPawnPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pawn"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getPawnEscrowAuthorityPda(pawn: PublicKey, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pawn_escrow"), mint.toBuffer(), pawn.toBuffer()],
    PROGRAM_ID
  );
}

export function getPawnEscrowTokenAccount(escrowAuthority: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, escrowAuthority);
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

/*
Example usage after `anchor build` (new IDL required):

const program = getProgram(...);
const [pawnPda] = getPawnPda(mint);
const [escrowAuth] = getPawnEscrowAuthorityPda(pawnPda, mint);

await program.methods
  .pawnNft(new BN(loanLamports), new BN(30 * 86400), 450) // 4.5%
  .accounts({
    marketplace: marketplacePda,
    pawn: pawnPda,
    mint,
    borrowerTokenAccount: getUserTokenAccount(mint, wallet.publicKey),
    pawnEscrowAuthority: escrowAuth,
    pawnEscrowTokenAccount: getPawnEscrowTokenAccount(escrowAuth, mint),
    borrower: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
    systemProgram: SYSTEM_PROGRAM,
    rent: RENT_SYSVAR,
  })
  .rpc();
*/

