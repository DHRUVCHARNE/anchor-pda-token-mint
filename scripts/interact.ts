import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";

const idl = require("../target/idl/my_project.json");

const PROGRAM_ID = new PublicKey(
  "BMgAq1sEFBFhT4XNEBJqJfBFJY93SWWzhcZ8yRYXo4Qt"
);

async function getBalance(
  connection: Connection,
  ata: PublicKey,
  label: string
) {
  try {
    const bal = await connection.getTokenAccountBalance(ata);
    console.log(`${label} balance:`, bal.value.uiAmountString);
  } catch {
    console.log(`${label} balance: 0`);
  }
}

async function main() {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const wallet = anchor.Wallet.local();

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const program = new Program(idl as anchor.Idl, provider);

  const [mintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    PROGRAM_ID
  );

  console.log("Mint PDA:", mintPda.toBase58());

  const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;

  /* ---------------- Create Mint ---------------- */

  try {
    await program.methods
      .createMint()
      .accounts({
        signer: wallet.publicKey,
        mint: mintPda,
        tokenProgram: TOKEN_PROGRAM,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Mint created");
  } catch {
    console.log("Mint already exists");
  }

  /* ---------------- Users ---------------- */

  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  console.log("User1:", user1.publicKey.toBase58());
  console.log("User2:", user2.publicKey.toBase58());

  const fundTx = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: user1.publicKey,
      lamports: anchor.web3.LAMPORTS_PER_SOL / 2,
    }),
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: user2.publicKey,
      lamports: anchor.web3.LAMPORTS_PER_SOL / 2,
    })
  );

  await provider.sendAndConfirm(fundTx);

  console.log("Users funded");

  /* ---------------- Token Accounts ---------------- */

  const signerAta = getAssociatedTokenAddressSync(
    mintPda,
    wallet.publicKey,
    false,
    TOKEN_PROGRAM
  );

  const user1Ata = getAssociatedTokenAddressSync(
    mintPda,
    user1.publicKey,
    false,
    TOKEN_PROGRAM
  );

  const user2Ata = getAssociatedTokenAddressSync(
    mintPda,
    user2.publicKey,
    false,
    TOKEN_PROGRAM
  );

  await program.methods
    .createTokenAccount()
    .accounts({
      signer: wallet.publicKey,
      tokenAccount: signerAta,
      mint: mintPda,
      tokenProgram: TOKEN_PROGRAM,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  await program.methods
    .createTokenAccount()
    .accounts({
      signer: user1.publicKey,
      tokenAccount: user1Ata,
      mint: mintPda,
      tokenProgram: TOKEN_PROGRAM,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([user1])
    .rpc();

  await program.methods
    .createTokenAccount()
    .accounts({
      signer: user2.publicKey,
      tokenAccount: user2Ata,
      mint: mintPda,
      tokenProgram: TOKEN_PROGRAM,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([user2])
    .rpc();

  console.log("Token accounts created");

  /* ---------------- Mint Tokens ---------------- */

  await program.methods
    .mintTokens(new anchor.BN(3000))
    .accounts({
      signer: wallet.publicKey,
      mint: mintPda,
      tokenAccount: signerAta,
      tokenProgram: TOKEN_PROGRAM,
    })
    .rpc();

  console.log("Minted tokens to signer");

  /* ---------------- Transfer Tokens ---------------- */

  const transferTx = new anchor.web3.Transaction().add(
    createTransferInstruction(signerAta, user1Ata, wallet.publicKey, 1000),
    createTransferInstruction(signerAta, user2Ata, wallet.publicKey, 2000)
  );

  await provider.sendAndConfirm(transferTx);

  console.log("Tokens transferred");

  /* ---------------- Balances ---------------- */

  console.log("\nToken balances:");

  await getBalance(connection, signerAta, "Signer");
  await getBalance(connection, user1Ata, "User1");
  await getBalance(connection, user2Ata, "User2");
}

main();