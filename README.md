# my_project

A Solana Anchor program that demonstrates how to:

- initialize a basic program instruction
- create a PDA-backed SPL token mint
- create an associated token account (ATA)
- mint tokens from a PDA mint authority
- validate mint/token-program constraints in both the program and tests

This project supports both the classic SPL Token program and Token-2022 through Anchor's token interface.

## Features

- **PDA mint account** derived from the seed `b"mint"`
- **Mint authority and freeze authority** set to the mint PDA itself
- **Associated token account creation** with `init_if_needed`
- **Minting via CPI** using `anchor_spl::token_interface`
- **Token program validation** that allows either:

  - `SPL Token`
  - `SPL Token 2022`

## Program overview

### `initialize`

A simple starter instruction that logs the program id.

### `create_mint`

Creates a mint account at the PDA derived from:

```rust
[b"mint"]
```

The mint uses:

- `decimals = 6`
- `mint authority = mint PDA`
- `freeze authority = mint PDA`

### `create_token_account`

Creates the signer’s associated token account for the mint PDA. The account is created with `init_if_needed`, so calling it multiple times is safe.

### `mint_tokens`

Mints tokens from the mint PDA into the signer’s token account through CPI.

## Account constraints

The program uses Anchor constraints to enforce correctness:

- The mint must be the PDA derived from `b"mint"`
- The token account must belong to the signer
- The token account mint must match the mint PDA
- The token program must be either SPL Token or Token-2022

## Project structure

```text
src/lib.rs         # Anchor program logic
tests/my_project.ts # Integration tests
```

## Requirements

- [Rust](https://www.rust-lang.org/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://book.anchor-lang.com/)
- Node.js + Yarn

## Installation

Clone the repository and install dependencies:

```bash
yarn install
```

Build the program:

```bash
anchor build
```

## Running tests

Run the full test suite with:

```bash
anchor test
```

This will:

- start a local validator
- deploy the program
- run the TypeScript tests in `tests/my_project.ts`

## Test coverage

The test suite verifies:

- program initialization
- transaction signature verification
- mint creation success and failure cases
- ATA creation success and failure cases
- token minting success and failure cases
- account validation for wrong mint, wrong signer, and wrong token program

## Notes on the tests

The tests use:

- `getMint()` to inspect mint state
- `getAccount()` to inspect token account state
- `getAssociatedTokenAddressSync()` to derive the ATA
- `BN` for `u64` instruction arguments

Because the tests are stateful and run in order, balance assertions compare pre- and post-conditions instead of assuming a zero balance.

## Example flow

1. Call `initialize`
2. Call `create_mint` to create the PDA mint
3. Call `create_token_account` to create the signer’s ATA
4. Call `mint_tokens(amount)` to mint tokens to that ATA

## Example usage from tests

```ts
await program.methods
  .createMint()
  .accounts({
    signer: signer.publicKey,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  })
  .rpc();
```

```ts
await program.methods
  .mintTokens(new BN(1_000_000))
  .accountsPartial({
    signer: signer.publicKey,
    mint: mintPda,
    tokenAccount: ataAddr,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  })
  .rpc();
```

## Important implementation detail

The mint authority is the mint PDA itself, so `mint_tokens` signs the CPI using PDA seeds:

```rust
let seeds: &[&[u8]] = &[b"mint", &[ctx.bumps.mint]];
let signer = &[seeds];
```

This ensures the program can mint only for the PDA-controlled mint account.

## Troubleshooting

### `Account \`tokenProgram` not provided`

Pass `tokenProgram` in `.accounts()` / `.accountsPartial()`.

### `AccountNotInitialized` for mint

Create the mint first
