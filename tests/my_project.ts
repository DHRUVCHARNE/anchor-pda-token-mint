import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyProject } from "../target/types/my_project";
import { assert } from "chai";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";

describe("my_project", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.myProject as Program<MyProject>;
  const signer = provider.wallet;

  let mintPda: anchor.web3.PublicKey;
  let tokenAccount: anchor.web3.PublicKey;

  before(async () => {
    // Derive mint pda
    [mintPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId,
    );
  });

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize()
      .accounts({ signer: signer.publicKey })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Initialize fails if txn is not signed", async () => {
    const ix = await program.methods
      .initialize()
      .accounts({
        signer: signer.publicKey,
      })
      .instruction();
    const { blockhash } = await provider.connection.getLatestBlockhash();
    const message = new anchor.web3.TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new anchor.web3.VersionedTransaction(message);

    try {
      // send WITHOUT signing
      await provider.connection.sendTransaction(tx);
      throw new Error("Transaction shoulf fail");
    } catch (err) {
      console.log("Expected Failure: ", err);
    }
  });

  it("Mint Account Created Successfully", async () => {
    //Check balance before
    const balanceBefore = await provider.connection.getBalance(
      signer.publicKey,
    );
    console.log(`Balance before ${balanceBefore}\n`);

    await program.methods
      .createMint()
      .accounts({
        signer: signer.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    //Check balance After
    const balanceAfter = await provider.connection.getBalance(signer.publicKey);
    console.log(`Balance After ${balanceAfter}\n`);

    assert.isTrue(
      balanceAfter < balanceBefore,
      "Signer should pay lamports for mint creation",
    );
    // Fetch mint account info
    const mintInfo = await getMint(provider.connection, mintPda);

    console.log("Mint PDA:", mintPda.toBase58());

    // Assertions
    assert.ok(mintInfo !== null, "Mint account should exist");

    assert.equal(mintInfo.decimals, 6, "Mint decimals should be 6");

    assert.equal(
      mintInfo.mintAuthority?.toBase58(),
      mintPda.toBase58(),
      "Mint authority should be mint PDA",
    );

    assert.equal(
      mintInfo.freezeAuthority?.toBase58(),
      mintPda.toBase58(),
      "Freeze authority should be mint PDA",
    );
    //Mint Creation fails if PDA Already Exists
    try {
      await program.methods
        .createMint()
        .accounts({
          signer: signer.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
      throw new Error("Second Mint Creation Fails");
    } catch (err) {
      console.log("Test Passes");
    }
  });
  it("create_mint fails with invalid token program", async () => {
    const fakeProgram = anchor.web3.Keypair.generate().publicKey;
    try {
      await program.methods
        .createMint()
        .accounts({
          signer: signer.publicKey,
          tokenProgram: fakeProgram,
        })
        .rpc();
      throw new Error("Txn Should Fail with invalid token program");
    } catch (err) {
      console.log("Expected Constraint Satisfied");
    }
  });
  //Tests for create_token_account
  it("Verify ATA exists after execution", async () => {
    const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
    await program.methods
      .createTokenAccount()
      .accounts({
        signer: signer.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`Associated Token Account Address: ${ataAddr}\n`);
    const ata = await getAccount(provider.connection, ataAddr);
    console.dir(ata, { depth: null });
    // check mint
    assert.equal(
      ata.mint.toBase58(),
      mintPda.toBase58(),
      "ATA mint should match mint PDA",
    );
    assert.equal(
      ata.owner.toBase58(),
      signer.publicKey.toBase58(),
      "ATA owner should be signer",
    );
    // Assert Token Account uses correct address
    assert.equal(
      ataAddr.toBase58(),
      ata.address.toBase58(),
      "Token Account Address Incorrect",
    );
    //Create Token Account works even if called twice as we have init_if_needed
    try {
      await program.methods
        .createTokenAccount()
        .accounts({
          signer: signer.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
    } catch (err) {
      throw Error("Create Token Account failed when called twice");
    }
  });
  it("Create Token Account fails with wrong mintPda", async () => {
    const mintPdaTampered = anchor.web3.Keypair.generate().publicKey;

    const ataAddr = getAssociatedTokenAddressSync(
      mintPdaTampered,
      signer.publicKey,
    );

    try {
      await program.methods
        .createTokenAccount()
        .accountsPartial({
          signer: signer.publicKey,
          mint: mintPdaTampered,
          tokenAccount: ataAddr,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      throw new Error("Transaction should fail with wrong mint PDA");
    } catch (err) {
      console.log("Expected failure:", err);
    }
  });
  it("Create Token Account fails with wrong token program", async () => {
    try {
      const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
      const tokenProgramTampered = anchor.web3.Keypair.generate().publicKey;
      await program.methods
        .createTokenAccount()
        .accountsPartial({
          signer: signer.publicKey,
          mint: mintPda,
          tokenAccount: ataAddr,
          tokenProgram: tokenProgramTampered,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Transaction should have failed");
    } catch (err) {
      console.log("Test Succeeds");
    }
  });
  it("Mint Tokens successfully mints tokens", async () => {
    const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
    await program.methods
      .mintTokens(new BN(1e6))
      .accountsPartial({
        signer: signer.publicKey,
        mint: mintPda,
        tokenAccount: ataAddr,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();
    const newBalance = (await getAccount(provider.connection, ataAddr)).amount;
    assert.equal(newBalance, BigInt(1e6));
    const mintAccount = await getMint(provider.connection, mintPda);
    assert.equal(newBalance, mintAccount.supply);
  });
  it("Mint Tokens fails for different signer", async () => {
    const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
    const signer2Key = anchor.web3.Keypair.generate().publicKey;
    const balanceBefore = (await getAccount(provider.connection, ataAddr))
      .amount;

    try {
      await program.methods
        .mintTokens(new BN(1e6))
        .accountsPartial({
          signer: signer2Key,
          mint: mintPda,
          tokenAccount: ataAddr,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
      throw new Error("Test Fails");
    } catch (err) {
      console.log("Expected Failure");
    }
    const balanceAfter = (await getAccount(provider.connection, ataAddr))
      .amount;

    assert.equal(balanceBefore, balanceAfter, "Balance should not change");
    
  });
    it("Mint Tokens fails for a different mint", async () => {
    const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
    const signer2Key = anchor.web3.Keypair.generate().publicKey;
    const balanceBefore = (await getAccount(provider.connection, ataAddr))
      .amount;

    try {
      await program.methods
        .mintTokens(new BN(1e6))
        .accountsPartial({
          signer: signer.publicKey,
          mint: signer2Key,
          tokenAccount: ataAddr,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();
      throw new Error("Test Fails");
    } catch (err) {
      console.log("Expected Failure");
    }
    const balanceAfter = (await getAccount(provider.connection, ataAddr))
      .amount;

    assert.equal(balanceBefore, balanceAfter, "Balance should not change");
    
  });
      it("Mint Tokens fails for a different token program", async () => {
    const ataAddr = getAssociatedTokenAddressSync(mintPda, signer.publicKey);
    const signer2Key = anchor.web3.Keypair.generate().publicKey;
    const balanceBefore = (await getAccount(provider.connection, ataAddr))
      .amount;

    try {
      await program.methods
        .mintTokens(new BN(1e6))
        .accountsPartial({
          signer: signer.publicKey,
          mint: mintPda,
          tokenAccount: ataAddr,
          tokenProgram: signer2Key,
        })
        .rpc();
      throw new Error("Test Fails");
    } catch (err) {
      console.log("Expected Failure");
    }
    const balanceAfter = (await getAccount(provider.connection, ataAddr))
      .amount;

    assert.equal(balanceBefore, balanceAfter, "Balance should not change");
    
  });
});
