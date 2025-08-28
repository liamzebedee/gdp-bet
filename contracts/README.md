# Contracts - USGDP.Q3.2025

Solidity smart contracts implementing the GDP prediction market MVP.

## Architecture

**Core System:** Fully-collateralized binary market with oracle-based settlement

**Dependencies:** OpenZeppelin contracts, Foundry toolkit

## Contract Structure

```
contracts/src/
├── GDPMarket.sol           # Main market logic and vault
├── LongToken.sol           # L token (USGDP.Q3.2025.L)  
├── ShortToken.sol          # S token (USGDP.Q3.2025.S)
├── MockGDPOracle.sol       # Test oracle implementation
└── MockUSDC.sol            # Test USDC for development
```

## Core Contracts

### GDPMarket.sol
**Purpose:** Central market contract managing the USDC vault and token minting/burning.

**Key Functions:**
- `mint(bool isLong, uint256 usdcAmount)` - Create L or S positions
- `pairRedeem(uint256 tokens)` - Burn equal L+S for USDC back  
- `settle()` - Execute oracle-based settlement (callable by anyone)
- `redeemLong(uint256)` / `redeemShort(uint256)` - Post-settlement redemption

**State Variables:**
- `kPpm` - Leverage parameter (parts per million)
- `openAt` / `closeAt` - Phase transition timestamps
- `phase` - Current market phase enum
- `longPot` / `shortPot` - Post-settlement USDC allocations

### Token Contracts
**LongToken.sol / ShortToken.sol:**
- Standard ERC-20 with 18 decimals
- Only GDPMarket can mint/burn
- Names: "USGDP.Q3.2025 Long" / "USGDP.Q3.2025 Short"
- Symbols: "USGDP.Q3.2025.L" / "USGDP.Q3.2025.S"

## Settlement Mathematics

**Core Formula:**
```solidity
uint256 shareLongPpm = MathLib.clamp(
    0,
    1e6, 
    5e5 + (5e5 * kPpm * gPpm) / 1e12
);
```

**Examples (k=10):**
- GDP +2%: Long 60%, Short 40%
- GDP 0%: Long 50%, Short 50%  
- GDP +5%: Long 100%, Short 0%

## Phase System

### Phase Flow
```
Pending → Open → Frozen → Settled
```

### Phase Controls
- **Pending**: No user actions available
- **Open**: `mint()`, `pairRedeem()` enabled
- **Frozen**: Trading only (external AMMs)
- **Settled**: `redeemLong()`, `redeemShort()` enabled

### Phase Transitions
- Pending → Open: Automatic at `openAt` timestamp
- Open → Frozen: Automatic at `closeAt` timestamp  
- Frozen → Settled: Manual via `settle()` after oracle finalizes

## Development

### Setup
```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/your-repo/gdpcoin

# If already cloned, initialize submodules
git submodule update --init --recursive

# Build contracts
forge build

# Run tests
forge test

# Run with verbosity
forge test -vvv
```

### Dependencies
The project uses git submodules for dependency management:
- `lib/forge-std` - Foundry standard library
- `lib/openzeppelin-contracts` - OpenZeppelin contracts
- `lib/niacin-contracts` - Custom utility contracts

**Updating dependencies:**
```bash
# Update all submodules to latest
git submodule update --remote

# Update specific submodule
git submodule update --remote lib/openzeppelin-contracts
```

### Testing Strategy

**Foundry Tests:**
- Unit tests for each contract function
- Integration tests for full lifecycle
- Fuzz testing for edge cases
- Invariant testing for security properties

**Key Test Categories:**
```bash
forge test --match-contract GDPMarketTest    # Core market logic
forge test --match-contract TokenTest        # ERC-20 functionality  
forge test --match-contract OracleTest       # Oracle integration
forge test --match-contract FuzzTest         # Property-based testing
```

**Fuzz Parameters:**
- GDP growth: ±50,000 ppm (±5%)
- Leverage: 0 to 20,000,000 ppm (0-20x)
- Amounts: 1 to 1e12 USDC units

## Deployment

### Deployment Script
```bash
# Deploy to local anvil
forge script script/Deploy.s.sol --fork-url http://localhost:8545 --broadcast

# Deploy to testnet
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast --verify
```

### Post-Deployment
1. Contract verification on Etherscan
2. Copy addresses/ABIs to `frontend/contracts.js`
3. Deploy Uniswap v3 pools with initial liquidity
4. Configure oracle with Q3 2025 parameters

### Parameters Configuration
**Required Settings:**
- `kPpm`: Leverage (default 10,000,000 = 10x)
- `openAt`: Market opening timestamp
- `closeAt`: Minting cutoff timestamp  
- `treasury`: Fee recipient address
- `oracle`: GDP data source address

**Fee Structure:**
- `mintFeeBps`: Fee on minting (basis points)
- `pairRedeemFeeBps`: Fee on pair redemption
- `settleSkimBps`: Settlement fee for protocol

## Security

### Key Invariants
- **Conservation**: `totalWithdrawals + fees ≤ totalDeposits`
- **Single Settlement**: Oracle can only finalize once
- **Phase Progression**: Cannot skip or reverse phases
- **Full Collateralization**: Always 100% USDC-backed

### Security Measures
- OpenZeppelin reentrancy guards on all state-changing functions
- Time-based phase controls prevent premature actions
- Bounded mathematics prevent overflow/underflow
- Access controls on admin functions

### Known Limitations
- Oracle dependency (single point of failure)
- No position size limits (could create large exposures)
- No emergency pause mechanism post-Open

## Integration

### Oracle Interface
```solidity
interface IGDPOracle {
    function readDelta() external view returns (int256 gPpm, bool finalized);
}
```

### USDC Interface  
```solidity
interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
```

### Frontend Integration
Contract addresses and ABIs are automatically copied to `frontend/contracts.js` by deployment script.

## Monitoring

**Key Metrics to Track:**
- Total Value Locked (TVL) in vault
- Long vs Short minting ratio
- Pair redemption frequency
- Oracle finalization status
- Settlement execution success

**Important Events:**
- `Mint(user, isLong, usdcAmount, tokens)`
- `PairRedeem(user, tokens, usdcOut)`
- `Settled(gPpm, longPot, shortPot)`
- `Redeem(user, isLong, tokens, usdcOut)`
