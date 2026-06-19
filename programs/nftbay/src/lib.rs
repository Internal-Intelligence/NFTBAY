use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

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
    /// Supports fixed price or auction (eBay hybrid model).
    /// The listing PDA (and escrow ATA) will be closed on successful buy or cancel, allowing the mint to be re-listed later.
    pub fn list_nft(
        ctx: Context<ListNft>,
        price: u64,
        listing_type: u8, // 0=fixed, 1=auction
        duration_seconds: i64,
        reserve_price: u64,
        is_promoted: bool,
        category: String,
    ) -> Result<()> {
        require!(price > 0, MarketplaceError::InvalidPrice);
        require!(listing_type <= 1, MarketplaceError::InvalidListingType);
        require!(category.len() <= 32, MarketplaceError::CategoryTooLong);

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
        listing.escrow_bump = ctx.bumps.escrow_authority;
        listing.bump = ctx.bumps.listing;
        listing.active = true;
        // eBay-inspired
        listing.listing_type = listing_type;
        listing.end_time = if listing_type == 1 { Clock::get()?.unix_timestamp + duration_seconds } else { 0 };
        listing.highest_bid = 0;
        listing.highest_bidder = Pubkey::default();
        listing.reserve_price = reserve_price;
        listing.is_promoted = is_promoted;
        listing.category = category.clone();
        listing.sold_at = 0;
        listing.buyer = Pubkey::default();
        listing.protection_expires_at = 0;
        listing.dispute_status = 0;

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
    /// Closes the listing PDA and escrow ATA to allow re-listing the same mint in the future.
    /// eBay-inspired: tiered fees (price bands + promoted uplift), buyer protection metadata (sale receipt + 7-day window).
    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingNotActive);
        require!(listing.listing_type == 0, MarketplaceError::NotFixedPrice);

        let price = listing.price;
        // Tiered final value fees like eBay (lower % on higher value, promoted uplift)
        let base_bps: u64 = if price < 1_000_000_000 { 600 } else if price < 10_000_000_000 { 450 } else { 300 };
        let fee_bps: u64 = if listing.is_promoted { base_bps + 300 } else { base_bps };
        let fee = price
            .checked_mul(fee_bps)
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

        // Close escrow ATA to reclaim rent (sent to seller). Listing will be auto-closed via close = seller.
        let close_accounts = CloseAccount {
            account: ctx.accounts.escrow_token_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer,
        );
        token::close_account(close_ctx)?;

        // Buyer protection extension: record sale receipt + protection window (e.g. 7 days for "not as described")
        let listing = &mut ctx.accounts.listing;
        let now = Clock::get()?.unix_timestamp;
        listing.sold_at = now;
        listing.buyer = ctx.accounts.buyer.key();
        listing.protection_expires_at = now + 7 * 86400;
        listing.dispute_status = 0;

        emit!(NftSold {
            mint: mint_key,
            buyer: ctx.accounts.buyer.key(),
            seller: ctx.accounts.seller.key(),
            price,
            fee,
        });

        Ok(())
    }

    /// Place a bid on an auction listing (eBay-style English auction).
    pub fn place_bid(ctx: Context<PlaceBid>, bid_amount: u64) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingNotActive);
        require!(listing.listing_type == 1, MarketplaceError::NotAuction);
        require!(Clock::get()?.unix_timestamp < listing.end_time, MarketplaceError::AuctionEnded);
        require!(bid_amount > listing.highest_bid, MarketplaceError::BidTooLow);
        require!(bid_amount >= listing.reserve_price, MarketplaceError::BelowReserve);
        require!(ctx.accounts.bidder.key() != listing.seller, MarketplaceError::SellerCannotBid);

        // Refund previous highest bidder (buyer protection)
        if listing.highest_bid > 0 && listing.highest_bidder != Pubkey::default() {
            **ctx.accounts.listing.to_account_info().try_borrow_mut_lamports()? -= listing.highest_bid;
            **ctx.accounts.prev_bidder.to_account_info().try_borrow_mut_lamports()? += listing.highest_bid;
        }

        // Transfer new bid to listing PDA (escrow)
        let bid_transfer = system_program::Transfer {
            from: ctx.accounts.bidder.to_account_info(),
            to: ctx.accounts.listing.to_account_info(),
        };
        let transfer_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), bid_transfer);
        system_program::transfer(transfer_ctx, bid_amount)?;

        listing.highest_bid = bid_amount;
        listing.highest_bidder = ctx.accounts.bidder.key();

        emit!(NftSold { // reuse or new event, for simplicity log as sold event placeholder; in real add BidPlaced
            mint: ctx.accounts.mint.key(),
            buyer: ctx.accounts.bidder.key(),
            seller: listing.seller,
            price: bid_amount,
            fee: 0,
        });

        Ok(())
    }

    /// Settle a completed auction. Anyone can call after end time. Winner gets NFT, seller gets proceeds - fee.
    pub fn settle_auction(ctx: Context<SettleAuction>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingNotActive);
        require!(listing.listing_type == 1, MarketplaceError::NotAuction);
        require!(Clock::get()?.unix_timestamp >= listing.end_time, MarketplaceError::AuctionNotEnded);
        require!(listing.highest_bidder != Pubkey::default(), MarketplaceError::NoBids);

        let price = listing.highest_bid;
        // Tiered fees same as buy
        let base_bps: u64 = if price < 1_000_000_000 { 600 } else if price < 10_000_000_000 { 450 } else { 300 };
        let fee_bps: u64 = if listing.is_promoted { base_bps + 300 } else { base_bps };
        let fee = price.checked_mul(fee_bps).unwrap().checked_div(10000).unwrap();
        let seller_amount = price.checked_sub(fee).unwrap();

        // Pay seller and fee from the bid lamports held in listing PDA
        **ctx.accounts.listing.to_account_info().try_borrow_mut_lamports()? -= seller_amount;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_amount;
        if fee > 0 {
            **ctx.accounts.listing.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += fee;
        }

        // Transfer NFT to winner
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
            to: ctx.accounts.winner_token_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        // Close escrow
        let close_accounts = CloseAccount {
            account: ctx.accounts.escrow_token_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer,
        );
        token::close_account(close_ctx)?;

        // Mark and protection
        listing.active = false;
        let now = Clock::get()?.unix_timestamp;
        listing.sold_at = now;
        listing.buyer = listing.highest_bidder;
        listing.protection_expires_at = now + 7 * 86400;
        listing.dispute_status = 0;

        emit!(NftSold {
            mint: mint_key,
            buyer: listing.highest_bidder,
            seller: listing.seller,
            price,
            fee,
        });

        Ok(())
    }

    /// Seller can cancel a listing and reclaim their NFT.
    /// Closes the listing PDA and escrow ATA to allow re-listing the same mint in the future.
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

        // Close escrow ATA to reclaim rent (sent to seller). Listing will be auto-closed via close = seller.
        let close_accounts = CloseAccount {
            account: ctx.accounts.escrow_token_account.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer,
        );
        token::close_account(close_ctx)?;

        emit!(ListingCancelled {
            mint: mint_key,
            seller: ctx.accounts.seller.key(),
        });

        Ok(())
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAWN SHOP INSTRUCTIONS (deep on-chain collateralized loans)
    // ═══════════════════════════════════════════════════════════════════════

    /// Pawn an NFT for instant liquidity.
    /// NFT is locked in a dedicated pawn escrow.
    /// Loan SOL is transferred from the marketplace treasury PDA to the borrower.
    /// This is the core "pawn shop" primitive — no forced sale, repay to reclaim.
    pub fn pawn_nft(
        ctx: Context<PawnNft>,
        loan_amount: u64,
        duration_seconds: i64,
        interest_bps: u16,
    ) -> Result<()> {
        require!(loan_amount > 0, MarketplaceError::InvalidPrice);
        require!(
            duration_seconds > 3600 && duration_seconds <= 90 * 86400,
            MarketplaceError::InvalidDuration
        );
        require!(interest_bps <= 5000, MarketplaceError::InterestTooHigh); // max 50%

        let now = Clock::get()?.unix_timestamp;
        let due_ts = now.checked_add(duration_seconds).unwrap();

        // 1. Transfer NFT into pawn-controlled escrow ATA
        let cpi_accounts = Transfer {
            from: ctx.accounts.borrower_token_account.to_account_info(),
            to: ctx.accounts.pawn_escrow_token_account.to_account_info(),
            authority: ctx.accounts.borrower.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, 1)?;

        // 2. Fund the loan from marketplace PDA treasury (lamports move)
        // Marketplace PDA acts as the liquidity provider / treasury.
        let marketplace_lamports = ctx.accounts.marketplace.to_account_info().lamports();
        require!(
            marketplace_lamports >= loan_amount,
            MarketplaceError::InsufficientTreasury
        );

        **ctx.accounts.marketplace.to_account_info().try_borrow_mut_lamports()? =
            marketplace_lamports.checked_sub(loan_amount).unwrap();

        **ctx.accounts.borrower.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.borrower.to_account_info().lamports().checked_add(loan_amount).unwrap();

        // 3. Initialize the Pawn state
        let pawn = &mut ctx.accounts.pawn;
        pawn.borrower = ctx.accounts.borrower.key();
        pawn.mint = ctx.accounts.mint.key();
        pawn.loan_amount = loan_amount;
        pawn.interest_bps = interest_bps;
        pawn.due_ts = due_ts;
        pawn.escrow_bump = ctx.bumps.pawn_escrow_authority;
        pawn.bump = ctx.bumps.pawn;
        pawn.active = true;

        emit!(NftPawed {
            mint: ctx.accounts.mint.key(),
            borrower: ctx.accounts.borrower.key(),
            loan_amount,
            due_ts,
            interest_bps,
        });

        Ok(())
    }

    /// Repay the pawn loan and reclaim the NFT.
    /// Borrower pays (principal + interest).
    /// Interest is flat (simple) for v1: principal * interest_bps / 10000
    /// Full on-chain release of collateral.
    pub fn repay_pawn(ctx: Context<RepayPawn>) -> Result<()> {
        let pawn = &ctx.accounts.pawn;
        require!(pawn.active, MarketplaceError::PawnNotActive);
        require!(
            pawn.borrower == ctx.accounts.borrower.key(),
            MarketplaceError::Unauthorized
        );

        let now = Clock::get()?.unix_timestamp;
        // Allow early repayment
        // require!(now <= pawn.due_ts, MarketplaceError::PawnAlreadyDue); // optional

        let interest = pawn
            .loan_amount
            .checked_mul(pawn.interest_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        let total_repay = pawn.loan_amount.checked_add(interest).unwrap();

        // 1. Repay to marketplace treasury (add lamports)
        let borrower_lamports = ctx.accounts.borrower.to_account_info().lamports();
        **ctx.accounts.borrower.to_account_info().try_borrow_mut_lamports()? =
            borrower_lamports.checked_sub(total_repay)
                .ok_or(MarketplaceError::InsufficientFundsForRepay)?;

        let market_lamports = ctx.accounts.marketplace.to_account_info().lamports();
        **ctx.accounts.marketplace.to_account_info().try_borrow_mut_lamports()? =
            market_lamports.checked_add(total_repay).unwrap();

        // 2. Release NFT from pawn escrow back to borrower
        let mint_key = ctx.accounts.mint.key();
        let pawn_key = ctx.accounts.pawn.key();
        let seeds = &[
            b"pawn_escrow",
            mint_key.as_ref(),
            pawn_key.as_ref(),
            &[ctx.accounts.pawn.escrow_bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.pawn_escrow_token_account.to_account_info(),
            to: ctx.accounts.borrower_token_account.to_account_info(),
            authority: ctx.accounts.pawn_escrow_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        // 3. Close escrow ATA (rent goes to borrower)
        let close_accounts = CloseAccount {
            account: ctx.accounts.pawn_escrow_token_account.to_account_info(),
            destination: ctx.accounts.borrower.to_account_info(),
            authority: ctx.accounts.pawn_escrow_authority.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer,
        );
        token::close_account(close_ctx)?;

        // Pawn account will be closed via the `close = borrower` constraint in RepayPawn accounts.

        emit!(PawnRepaid {
            mint: mint_key,
            borrower: ctx.accounts.borrower.key(),
            amount_repaid: total_repay,
        });

        Ok(())
    }

    /// Liquidate a defaulted pawn after due date.
    /// Anyone can call. NFT is transferred to the admin (treasury liquidation).
    /// In production this could trigger auction or be claimed by lenders.
    pub fn liquidate_pawn(ctx: Context<LiquidatePawn>) -> Result<()> {
        let pawn = &ctx.accounts.pawn;
        require!(pawn.active, MarketplaceError::PawnNotActive);
        require!(
            Clock::get()?.unix_timestamp >= pawn.due_ts,
            MarketplaceError::PawnNotDue
        );

        let mint_key = ctx.accounts.mint.key();
        let pawn_key = ctx.accounts.pawn.key();
        let seeds = &[
            b"pawn_escrow",
            mint_key.as_ref(),
            pawn_key.as_ref(),
            &[pawn.escrow_bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer NFT to admin (marketplace liquidation)
        let cpi_accounts = Transfer {
            from: ctx.accounts.pawn_escrow_token_account.to_account_info(),
            to: ctx.accounts.admin_token_account.to_account_info(),
            authority: ctx.accounts.pawn_escrow_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, 1)?;

        // Close escrow
        let close_accounts = CloseAccount {
            account: ctx.accounts.pawn_escrow_token_account.to_account_info(),
            destination: ctx.accounts.admin.to_account_info(),
            authority: ctx.accounts.pawn_escrow_authority.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer,
        );
        token::close_account(close_ctx)?;

        // Close pawn account
        // (handled by close = borrower in context, but we can also set active = false)

        emit!(PawnLiquidated {
            mint: mint_key,
            borrower: pawn.borrower,
            loan_amount: pawn.loan_amount,
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
        close = seller
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

    /// CHECK: seller receives funds (must match listing)
    #[account(mut, constraint = seller.key() == listing.seller)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: admin receives fees (must match marketplace)
    #[account(mut, constraint = admin.key() == marketplace.admin)]
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Accounts for placing a bid on an auction listing (eBay-style bidding).
#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.mint == mint.key(),
        constraint = listing.listing_type == 1, // auction only
    )]
    pub listing: Account<'info, Listing>,

    pub mint: Account<'info, Mint>,

    /// CHECK: previous highest bidder to refund
    #[account(mut)]
    pub prev_bidder: UncheckedAccount<'info>,

    #[account(mut)]
    pub bidder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts for settling a completed auction.
#[derive(Accounts)]
pub struct SettleAuction<'info> {
    #[account(
        mut,
        seeds = [b"listing", mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.mint == mint.key(),
        constraint = listing.listing_type == 1,
        close = seller
    )]
    pub listing: Account<'info, Listing>,

    pub mint: Account<'info, Mint>,

    /// CHECK: escrow authority
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
        payer = settler,
        associated_token::mint = mint,
        associated_token::authority = winner,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// CHECK: seller receives proceeds
    #[account(mut, constraint = seller.key() == listing.seller)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: admin/fee recipient
    #[account(mut, constraint = admin.key() == marketplace.admin)]
    pub admin: UncheckedAccount<'info>,

    /// CHECK: winner
    pub winner: UncheckedAccount<'info>,

    #[account(mut)]
    pub settler: Signer<'info>,

    pub marketplace: Account<'info, Marketplace>,

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
        close = seller
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
        constraint = seller_token_account.mint == mint.key(),
        constraint = seller_token_account.owner == seller.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// PAWN ACCOUNT CONTEXTS (deep constraints for security)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct PawnNft<'info> {
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        init,
        payer = borrower,
        space = Pawn::LEN,
        seeds = [b"pawn", mint.key().as_ref()],
        bump
    )]
    pub pawn: Account<'info, Pawn>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = borrower_token_account.mint == mint.key(),
        constraint = borrower_token_account.owner == borrower.key(),
        constraint = borrower_token_account.amount == 1,
    )]
    pub borrower_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for the pawn escrow
    #[account(
        seeds = [b"pawn_escrow", mint.key().as_ref(), pawn.key().as_ref()],
        bump
    )]
    pub pawn_escrow_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = borrower,
        associated_token::mint = mint,
        associated_token::authority = pawn_escrow_authority,
    )]
    pub pawn_escrow_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RepayPawn<'info> {
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [b"pawn", mint.key().as_ref()],
        bump = pawn.bump,
        constraint = pawn.mint == mint.key(),
        constraint = pawn.active,
        close = borrower   // reclaim rent to borrower on successful repay
    )]
    pub pawn: Account<'info, Pawn>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pawn_escrow_authority,
    )]
    pub pawn_escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK: pawn escrow signer
    #[account(
        seeds = [b"pawn_escrow", mint.key().as_ref(), pawn.key().as_ref()],
        bump = pawn.escrow_bump
    )]
    pub pawn_escrow_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = borrower,
    )]
    pub borrower_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LiquidatePawn<'info> {
    #[account(
        mut,
        seeds = [b"marketplace"],
        bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    #[account(
        mut,
        seeds = [b"pawn", mint.key().as_ref()],
        bump = pawn.bump,
        constraint = pawn.mint == mint.key(),
        constraint = pawn.active,
        close = admin
    )]
    pub pawn: Account<'info, Pawn>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = pawn_escrow_authority,
    )]
    pub pawn_escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK
    #[account(
        seeds = [b"pawn_escrow", mint.key().as_ref(), pawn.key().as_ref()],
        bump = pawn.escrow_bump
    )]
    pub pawn_escrow_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = admin,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = admin.key() == marketplace.admin)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
    // eBay-inspired additions for auctions, promoted, categories, protection
    pub listing_type: u8, // 0=fixed, 1=auction
    pub end_time: i64,
    pub highest_bid: u64,
    pub highest_bidder: Pubkey,
    pub reserve_price: u64,
    pub is_promoted: bool,
    pub category: String,
    // Buyer protection extensions (sale receipt)
    pub sold_at: i64,
    pub buyer: Pubkey,
    pub protection_expires_at: i64,
    pub dispute_status: u8,
}

impl Listing {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 1 + 8 + 8 + 32 + 8 + 1 + 1 + 36 + 8 + 32 + 8 + 1;
}

#[account]
pub struct Pawn {
    pub borrower: Pubkey,
    pub mint: Pubkey,
    pub loan_amount: u64,
    pub interest_bps: u16,
    pub due_ts: i64,
    pub escrow_bump: u8,
    pub bump: u8,
    pub active: bool,
}

impl Pawn {
    // 8 (disc) + 32 + 32 + 8 + 2 + 8 + 1 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 8 + 2 + 8 + 1 + 1 + 1;
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

#[event]
pub struct NftPawed {
    pub mint: Pubkey,
    pub borrower: Pubkey,
    pub loan_amount: u64,
    pub due_ts: i64,
    pub interest_bps: u16,
}

#[event]
pub struct PawnRepaid {
    pub mint: Pubkey,
    pub borrower: Pubkey,
    pub amount_repaid: u64,
}

#[event]
pub struct PawnLiquidated {
    pub mint: Pubkey,
    pub borrower: Pubkey,
    pub loan_amount: u64,
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
    #[msg("Invalid listing type")]
    InvalidListingType,
    #[msg("Category too long (max 32 bytes)")]
    CategoryTooLong,
    #[msg("Not an auction listing")]
    NotAuction,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Bid too low")]
    BidTooLow,
    #[msg("Below reserve price")]
    BelowReserve,
    #[msg("Seller cannot bid on own auction")]
    SellerCannotBid,
    #[msg("Auction not yet ended")]
    AuctionNotEnded,
    #[msg("No bids placed")]
    NoBids,

    // Pawn errors (deep pawn shop)
    #[msg("Pawn is not active")]
    PawnNotActive,
    #[msg("Invalid pawn duration")]
    InvalidDuration,
    #[msg("Interest rate too high (max 50%)")]
    InterestTooHigh,
    #[msg("Pawn is not yet due for liquidation")]
    PawnNotDue,
    #[msg("Insufficient funds in marketplace treasury to fund loan")]
    InsufficientTreasury,
    #[msg("Borrower does not have enough funds to repay")]
    InsufficientFundsForRepay,
    #[msg("Unauthorized borrower")]
    Unauthorized,
}
