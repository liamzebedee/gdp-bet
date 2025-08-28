# USGDP.Q3.2025 - Technical Architecture Guide

## System Overview

USGDP.Q3.2025 is a fully-collateralized binary prediction market implemented as a smart contract system on Ethereum. It creates economic exposure to US GDP growth through tokenized claims on a USDC vault.

## Core Architecture

### Smart Contract Components

**Market Contract**
- Central vault holding all USDC collateral
- Mints/burns L and S tokens based on deposits
- Implements three-phase lifecycle management
- Handles settlement logic and final payouts

**Token Contracts** 
- `USGDP.Q3.2025.L` (Long token, 18 decimals)
- `USGDP.Q3.2025.S` (Short token, 18 decimals)  
- Standard ERC-20 with mint/burn controlled by Market contract

**Oracle Interface**
```solidity
interface IGDPOracle {
  function readDelta() external view returns (int256 gPpm, bool finalized);
}
```

### Settlement Mathematics

The core settlement formula distributes vault funds based on GDP growth rate `g`:

```solidity
shareLongPpm = clamp(0, 1e6, 5e5 + (5e5 * kPpm * gPpm) / 1e12)
longPot = Vnet * shareLongPpm / 1e6
shortPot = Vnet - longPot
```

Where:
- `gPpm`: GDP growth rate in parts-per-million (1e6 = 100%)
- `kPpm`: Leverage parameter in ppm (default ~10e6 = 10x)
- `Vnet`: Net vault value after settlement fees

**Leverage Effects:**
With k=10, each 1% GDP change shifts ~5% of vault between sides.

### Phase Management System

**Phase Transitions:**
```
Pending → Open (at openAt timestamp)
Open → Frozen (at closeAt timestamp) 
Frozen → Settled (oracle finalized + settle() called)
```

**Phase Permissions:**
- **Open**: mint, pairRedeem, trade
- **Frozen**: trade only  
- **Settled**: single-sided redeem only

### Economic Mechanisms

**Minting Process:**
1. User deposits X USDC
2. Fee of `X * mintFeeBps / 10000` goes to treasury
3. Net amount `X_net` creates `X_net` tokens of chosen side

**Pair Redemption:**
1. User burns equal amounts of L and S tokens
2. Receives USDC back minus `pairRedeemFeeBps`
3. Maintains market neutrality

**Settlement Process:**
1. Oracle posts finalized GDP data
2. Anyone calls `settle()` function
3. Vault split calculated using bounded linear formula
4. Per-token redemption rates cached permanently
5. Settlement skim fee sent to treasury

### Security Properties

**Invariants Maintained:**
- Conservation: `total_withdrawals + fees ≤ total_deposits`
- Single settlement: Oracle data can only finalize once
- Phase progression: Cannot skip phases or go backwards
- Collateralization: Always 100% backed by USDC

**Reentrancy Protection:**
All state-changing functions use OpenZeppelin's `nonReentrant` modifier.

**Rounding Safety:**
Per-token payout rates cached as numerator/denominator pairs to prevent precision loss.

## Integration Points

### Uniswap V3 Integration

**Pool Setup:**
- L/USDC pool at 0.3% fee tier
- S/USDC pool at 0.3% fee tier
- Minimal initial liquidity seeded

**Price Discovery:**
Frontend reads `slot0` from pools to display current market prices. No on-chain price dependencies.

### Oracle Integration

The system relies on an external oracle for GDP data. Oracle must implement:
- `readDelta()` returning growth rate and finalization status
- Atomic finalization (cannot change after `finalized=true`)
- Growth rate in parts-per-million format

## Frontend Architecture

**Stack:** Next.js + React + ethers v5 + RainbowKit

**Key Features:**
- Real-time phase and oracle status monitoring
- Uniswap price integration via RPC calls
- Multi-panel interface for all user actions
- Error handling with precise user feedback

**State Management:**
- Contract reads via direct RPC calls
- No backend or subgraph dependency  
- Real-time updates through periodic polling

## Testing Strategy

**Foundry Test Coverage:**
- Fuzz testing: GDP growth ±50,000 ppm, leverage ≤20x
- Edge cases: Winner-takes-all scenarios
- Invariant testing: Conservation and settlement idempotence
- Integration tests: Full lifecycle simulation

**Key Test Scenarios:**
- Extreme positive/negative GDP outcomes
- Settlement boundary conditions
- Fee calculation accuracy
- Phase transition edge cases
- Reentrancy attack vectors

## Deployment Considerations

**Parameter Configuration:**
- Leverage `k`: Balance risk vs sensitivity (default 10)
- Fee rates: Incentivize usage vs protocol revenue
- Time windows: Allow sufficient minting period before close

**Operational Requirements:**
- Oracle reliability and timing
- Uniswap liquidity provisioning
- Frontend hosting and RPC endpoints
- Contract verification and documentation

This architecture provides a minimal but complete prediction market system, focusing on oracle integration validation and price discovery mechanisms.
