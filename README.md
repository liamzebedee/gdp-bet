bet-the-gdp
===========

Idea: Bet the next US GDP print, paid in USDC.

Users mint two tokens—LONG_GDP and SHORT_GDP—by depositing USDC into a single, fully-collateralized vault. When BEA posts the quarter’s GDP change on-chain, the vault is split between longs and shorts by a simple bounded rule tied to the % change. No new money is created; winners are paid from losers.

Example: vault 200 USDC. GDP +2% → longs get 120, shorts 80. GDP −1% → longs 90, shorts 110. Before the print, both tokens trade in an AMM so you can enter/exit on expectations.

## Status

**Live:** https://gdp-bet.vercel.app/

### ✅ Completed (v1)
- **Smart Contracts:** Fully implemented GDP prediction market with oracle-based settlement
- **Frontend:** Wagmi v2 + RainbowKit dApp with wallet connection and token interactions
- **Local Development:** Anvil deployment with MockUSDC for testing
- **Sepolia Testnet:** Deployed and functional on Ethereum testnet

### 🚧 In Progress
- **Mainnet Deployment:** Production deployment to Ethereum mainnet
- **Security Audit:** Professional smart contract security review
- **Uniswap Pools:** USDC/Long and USDC/Short liquidity pools for trading

