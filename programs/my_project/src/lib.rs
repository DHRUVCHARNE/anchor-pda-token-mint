use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, MintTo, TokenAccount, TokenInterface};

declare_id!("BMgAq1sEFBFhT4XNEBJqJfBFJY93SWWzhcZ8yRYXo4Qt");

#[program]
pub mod my_project {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_mint(ctx: Context<CreateMint>) -> Result<()> {
        msg!("Created Mint Account: {:?}", ctx.accounts.mint.key());
        Ok(())
    }

    pub fn create_token_account(ctx: Context<CreateTokenAccount>) -> Result<()> {
        msg!(
            "Created Token Account: {:?}",
            ctx.accounts.token_account.key()
        );
        Ok(())
    }
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint.to_account_info(),
        };
        let seeds: &[&[u8]] = &[b"mint", &[ctx.bumps.mint]];
        let signer = &[seeds];

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token_interface::mint_to(cpi_context, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account()]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer=signer,
        mint::decimals=6,
        mint::authority=mint.key(),
        mint::freeze_authority=mint.key(),
        seeds=[b"mint"],
        bump
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        constraint=token_program.key() == anchor_spl::token::ID
        || token_program.key() == anchor_spl::token_2022::ID
    )]
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTokenAccount<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init_if_needed,
        payer=signer,
        associated_token::mint=mint,
        associated_token::authority=signer,
        associated_token::token_program=token_program,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
    seeds = [b"mint"],
    bump
)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        constraint=token_program.key() == anchor_spl::token::ID
        || token_program.key() == anchor_spl::token_2022::ID
    )]
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut,
    seeds = [b"mint"],
        bump)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut
    ,constraint=token_account.mint==mint.key(),
    constraint=token_account.owner==signer.key()
)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        constraint=token_program.key() == anchor_spl::token::ID
        || token_program.key() == anchor_spl::token_2022::ID
    )]
    pub token_program: Interface<'info, TokenInterface>,
}
