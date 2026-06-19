use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("NFTBay1111111111111111111111111111111111111");

#[program]
pub mod nftbay {
    use super::*;

    /// One-time initialization of the marketplace.
    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, MarketplaceError::FeeTooHigh); // max 10%

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.admin = ctx.accounts.admin.key();
        marketplace.fee_bps = fee_bps;
        marketplace.listing_count = 0;
        marketplace.bump = ctx.bumps.marketplace;
        Ok(())
    }

    /// List an NFT for sale. The NFT is transferred into a program-controlled escrow ATA.
    pub fn list_nft(
        ctx: Context<ListNft>,
        price: u64,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);

        // Transfer NFT from seller to the escrow ATA (owned by the listing PDA authority)
        let cpi_accounts = Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, 1)?;

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.mint = ctx.accounts.mint.key();
        listing.price = price;
        listing.escrow_bump = ctx.bumps.escrow_token_account;
        listing.bump = ctx.bumps.listing;
        listing.active = true;

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.listing_count = marketplace.listing_count.checked_add(1).unwrap();

        emit!(NftListed {
            mint: listing.mint,
            seller: listing.seller,
            price,
        });

        Ok(())
    }

    /// Purchase a listed NFT. Buyer pays seller (+ fee to admin).
    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingNotActive);

        let price = listing.price;
        let fee_bps = ctx.accounts.marketplace.fee_bps;
        let fee = price
            .checked_mul(fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let seller_amount = price.checked_sub(fee).unwrap();

        // 1. Transfer SOL from buyer to seller
        let seller_transfer = system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.seller.to_account_info(),
        };
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            seller_transfer,
        );
        system_program::transfer(transfer_ctx, seller_amount)?;

        // 2. Transfer fee (if any) to admin
        if fee > 0 {
            let fee_transfer = system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.admin.to_account_info(),
            };
            let fee_ctx = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                fee_transfer,
            );
            system_program::transfer(fee_ctx, fee)?;
        }

        // 3. Transfer the NFT from escrow to buyer
        let mint_key = ctx.accounts.mint.key();
        let listing_key = ctx.accounts.listing.key();
        let seeds = &[
            b"escrow",
            mint_key.as_ref(),
            listing_key.as_ref(),
            &[ctx.accounts.listing.escrow_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        // Mark listing inactive
        let listing = &mut ctx.accounts.listing;
        listing.active = false;

        emit!(NftSold {
            mint: mint_key,
            buyer: ctx.accounts.buyer.key(),
            seller: ctx.accounts.seller.key(),
            price,
            fee,
        });

        Ok(())
    }

    /// Seller can cancel a listing and reclaim their NFT.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingNotActive);
        require!(
            listing.seller == ctx.accounts.seller.key(),
            MarketplaceError::Unauthorized
        );

        let mint_key = ctx.accounts.mint.key();
        let listing_key = ctx.accounts.listing.key();
        let seeds = &[
            b"escrow",
            mint_key.as_ref(),
            listing_key.as_ref(),
            &[ctx.accounts.listing.escrow_bump],
        ];
        let signer = &[&seeds[..]];

        // Return NFT to seller
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        let listing = &mut ctx.accounts.listing;
        listing.active = false;

        emit!(ListingCancelled {
            mint: mint_key,
            seller: ctx.accounts.seller.key(),
        });

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(
        init,
        payer = admin,
        space = Marketplace::LEN,
        seeds = [b"marketplace"],
        bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [b"listing", mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = seller_token_account.mint == mint.key(),
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.amount == 1,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA that will own the escrow token account
    #[account(
        seeds = [b"escrow", mint.key().as_ref(), listing.key().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.mint == mint.key(),
    )]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// CHECK: derived escrow authority
    #[account(
        seeds = [b"escrow", mint.key().as_ref(), listing.key().as_ref()],
        bump = listing.escrow_bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: seller receives funds
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: admin receives fees
    #[account(mut)]
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK: escrow signer
    #[account(
        seeds = [b"escrow", mint.key().as_ref(), listing.key().as_ref()],
        bump = listing.escrow_bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = seller_token_account.mint == mint.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct Marketplace {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub listing_count: u64,
    pub bump: u8,
}

impl Marketplace {
    pub const LEN: usize = 8 + 32 + 2 + 8 + 1;
}

#[account]
pub struct Listing {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price: u64,
    pub escrow_bump: u8,
    pub bump: u8,
    pub active: bool,
}

impl Listing {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

#[event]
pub struct NftListed {
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[event]
pub struct NftSold {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct ListingCancelled {
    pub mint: Pubkey,
    pub seller: Pubkey,
}

// ─────────────────────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum MarketplaceError {
    #[msg("Fee cannot exceed 1000 basis points (10%)")]
    FeeTooHigh,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Unauthorized")]
    Unauthorized,
}
