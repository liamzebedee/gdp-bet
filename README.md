gdp-markets
===========

**Live on Sepolia:** https://gdp-bet.vercel.app/

The US government recently published the Q2 2025 GDP on-chain as an Ethereum smart contract. https://x.com/lex_node/status/1961075563365347781 https://etherscan.io/address/0x36ccdf11044f60f196e981970d592a7de567ed7b#code

Idea: Bet on the next US GDP print, paid in USDC.

Users mint two tokens—LONG_GDP and SHORT_GDP—by depositing USDC into a single, fully-collateralized vault. When BEA posts the quarter’s GDP change on-chain, the vault is split between longs and shorts by a simple bounded rule tied to the % change. No new money is created; winners are paid from losers.

Example: vault 200 USDC. GDP +2% → longs get 120, shorts 80. GDP −1% → longs 90, shorts 110. Before the print, both tokens trade in an AMM so you can enter/exit on expectations.

See [docs/SPEC.md](docs/SPEC.md) for the full specification.