**Overview — USGDP.Q3.2025 MVP**

* Single-quarter, two-sided, fully-collateralized USDC market on the US GDP “advance” print. Instrument label: `USGDP.Q3.2025`.
* Two ERC-20 claims on one USDC vault: long `USGDP.Q3.2025.L` and short `USGDP.Q3.2025.S`. Users mint either side at 1 USDC per token (minus fee). Pre-settlement, users can burn equal LONG+SHORT to redeem USDC at par (pair redeem). No single-sided redemption before settlement.
* At release, an oracle posts QoQ GDP change `g` (in ppm) and `finalized=true`. Vault is split by a bounded linear rule with leverage `k`; no new value is created.
* Phases: Pending → Open (mint, pairRedeem) → Frozen (after `closeAt`, trading only) → Settled (single-sided redeem at fixed rates).
* Parameters: `k` (e.g., 10), `mintFeeBps`, `pairRedeemFeeBps`, `settleSkimBps`, `openAt`, `closeAt`, `treasury`, `oracle`.
* Goals: validate oracle→settlement plumbing, AMM price discovery, and a minimal UX.

```
shareLong = clamp(0, 1, 0.5 + 0.5*k*g)           // g as decimal; in-contract use ppm
longPot   = Vnet * shareLong
shortPot  = Vnet - longPot
```

---

**Frontend spec (one page)**

* Stack: Next.js + React + ethers v5 + RainbowKit. No backend/subgraph in MVP; all reads via RPC. Minimal copy, literal labels. DO NOT USE WAGMI OR VIEM.
* scripts to automatically copy contract abi's and addresses over into a .js file for ease of use. TODO foundry deploy script copies into a deployments.js to get contracts.
* Top bar: network indicator, connect wallet, label `USGDP.Q3.2025`, countdown to `closeAt`, oracle status (Finalized/Not finalized).
* Vault panel: contract USDC balance (vault TVL), your `L`/`S` balances, your estimated payout. Before settlement show `—`; after settlement show fixed redeem rate per side.
* Mint panel (Open/Frozen): choose side (Long/Short), input USDC, display fee and tokens out, `Approve USDC` then `Mint`. Disable in Settled.
* Pair-redeem panel (Open only): input X, burns X of `L` and X of `S`, show net USDC out and fee. Disable after `closeAt`.
* Redeem panel (Settled only): select side and amount, show USDC out at cached per-token rate, `Redeem`.
* Prices panel: Uniswap v3 mid prices for `L/USDC` and `S/USDC` (read pool `slot0`, compute tick→price), pool TVL if available; “Trade on Uniswap” links.
* Oracle panel: quarter ID, last read `g` once finalized.
* Optional simulator (pre-settlement): slider for hypothetical `g`, preview split; disabled after settlement.
* UX rules: gate buttons by phase; show precise error toasts (insufficient allowance/balance, wrong phase, oracle not finalized).

---

**Contracts spec (Foundry + OZ)**

* Tokens: minimal ERC-20s (18 decimals). Names: `USGDP.Q3.2025 Long`, `USGDP.Q3.2025 Short`. Symbols: `USGDP.Q3.2025.L`, `USGDP.Q3.2025.S` (wallets may truncate; acceptable for MVP).
* Market contract (owns vault and mints/burns claims). Immutable `USDC` (6 decimals). Oracle interface returns `(gPpm, finalized)`, where `1e6 = 100%`.
* Parameters/state: `kPpm`, fee bps (`mintFeeBps`, `pairRedeemFeeBps`, `settleSkimBps`), `treasury`, `openAt`, `closeAt`, `phase`, cached `gPpm`, `longPot`, `shortPot`, per-token payout numerators/denominators.
* Phases and guards:

  * Pending → Open at `openAt` (mint, pairRedeem enabled).
  * Frozen after `closeAt` (mint/pairRedeem disabled; trading on AMMs off-contract).
  * Settled after `oracle.finalized` and `settle()` called (single-sided redeem enabled; mint/pairRedeem permanently disabled).
* Functions (key flows, all non-view are non-reentrant):

  * `mint(isLong, usdcAmount)`: pull USDC, take `mintFeeBps` to treasury, mint 1 token per 1 net USDC to chosen side. Only in Open/Frozen (mint disabled in Frozen if you prefer stricter rule; MVP: allow in Open only).
  * `pairRedeem(tokens)`: burn equal `L` and `S`, pay `(tokens − fee)` USDC; fee to treasury. Only in Open.
  * `settle()`: require Frozen, oracle `finalized`. Read `gPpm`. Compute `shareLongPpm = clamp(0,1e6, 5e5 + (5e5 * (kPpm * gPpm)/1e12))`. Let `V = usdc.balanceOf(this)`. Skim `V*settleSkimBps/1e4` to treasury, define `Vnet`, then `longPot/shortPot`. Cache per-token rates. Emit `Settled`.
  * `redeemLong(amount)`, `redeemShort(amount)`: burn and pay USDC from respective pot at cached rate. Only in Settled.
* Events: `Mint`, `PairRedeem`, `Settled`, `Redeem`.
* Admin: set fees/`k`/treasury/oracle only before Open (or expose a one-time `lockParams()`). `pauseMinting`/`unpauseMinting` without affecting post-settlement redeem. `recoverERC20` for stray tokens excluding USDC and claim tokens.
* Security/invariants: conservation (sum of user withdrawals + treasury fees ≤ total deposits), single settlement, phase/time checks, reentrancy guards on stateful calls, rounding-safe per-token payouts (cache denominators).
* Testing (Foundry): fuzz `gPpm` (±50,000), fuzz `kPpm` (≤20e6), clamp edges (winner-takes-all pays exactly `Vnet`), pairRedeem round-trip ≈ deposit − fees, settlement idempotent, redeem drains pots exactly, cannot mint/pairRedeem post-settlement.
* Uniswap: deploy v3 pools `L/USDC` and `S/USDC` at 0.3% tier; seed minimal liquidity from treasury or script. Frontend reads `slot0` for mid price; no price-setting logic on-chain.

Interfaces (concise):

```solidity
interface IUSDC {
  function transferFrom(address,address,uint256) external returns (bool);
  function transfer(address,uint256) external returns (bool);
  function balanceOf(address) external view returns (uint256);
}
interface IGDPOracle {
  function readDelta() external view returns (int256 gPpm, bool finalized);
}
```
