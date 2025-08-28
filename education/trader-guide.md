# USGDP.Q3.2025 - Trader's Technical Guide

## What You're Trading

USGDP.Q3.2025 is a binary prediction market on US GDP growth for Q3 2025. You can take LONG or SHORT positions using USDC as collateral.

## Position Types

**LONG (USGDP.Q3.2025.L)**
- Benefits from positive GDP growth
- Wins more when GDP growth exceeds expectations
- Maximum payout when GDP growth is very positive

**SHORT (USGDP.Q3.2025.S)**  
- Benefits from negative GDP growth
- Wins more when GDP growth disappoints
- Maximum payout when GDP growth is very negative

## How Payouts Work

The settlement formula uses leverage parameter `k` (set to 10):

```
Long Share = clamp(0, 1, 0.5 + 0.5 × k × GDP_growth_rate)
```

**Examples with k=10:**
- GDP growth +2%: Long gets ~60%, Short gets ~40%
- GDP growth 0%: Long gets 50%, Short gets 50%  
- GDP growth -2%: Long gets ~40%, Short gets ~60%
- GDP growth +5% or higher: Long gets 100%, Short gets 0%
- GDP growth -5% or lower: Long gets 0%, Short gets 100%

## Trading Phases

**Phase 1: OPEN**
- Mint new positions (1 USDC = 1 token minus fees)
- Pair redeem (burn equal L+S for USDC back)
- Trade on Uniswap pools

**Phase 2: FROZEN** 
- No new minting or pair redemption
- Trading continues on Uniswap only
- Triggered after `closeAt` timestamp

**Phase 3: SETTLED**
- Oracle publishes official GDP data
- Single-sided redemption at fixed rates
- No more trading

## Trading Strategies

**Direct Minting**
- Mint positions directly from the contract
- Pay mint fees to treasury
- Best when you want to hold to settlement

**Secondary Trading**
- Trade L/USDC and S/USDC on Uniswap
- Price discovery happens here
- Use for entry/exit without waiting for settlement

**Arbitrage Opportunities**
- Monitor Uniswap prices vs intrinsic value
- Pair redeem when secondary price > mint price
- Front-run oracle updates (if legal in your jurisdiction)

## Risk Management

**Key Risks:**
- Oracle accuracy and timing
- Smart contract risk  
- Liquidity risk on Uniswap
- Regulatory uncertainty

**Risk Mitigation:**
- Start small to test the system
- Understand settlement mechanics before large positions
- Monitor Uniswap liquidity for exit strategies
- Keep some positions paired for emergency redemption

## Fees Structure

- **Mint Fee**: Paid when creating new positions
- **Pair Redeem Fee**: Paid when burning L+S pairs  
- **Settlement Skim**: Small fee taken at settlement
- **Uniswap Fees**: 0.3% for secondary trading

## When GDP Data Releases

GDP "advance" estimates are typically released ~1 month after quarter end. For Q3 2025, expect data in late October 2025. The oracle will finalize once official data is available.

## Getting Started

1. Connect wallet with USDC
2. Choose LONG or SHORT based on your GDP view
3. Either mint directly or buy on Uniswap
4. Monitor your position and market prices
5. Exit via trading or hold until settlement
