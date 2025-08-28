# GDP Coin Contracts - Local Deployment Summary

## Deployment Details
- **Network**: Local Anvil (Chain ID: 31337)
- **RPC URL**: http://localhost:8546
- **Deployer**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **Deployment Date**: August 28, 2025

## Deployed Contracts

### Main Contracts
- **GDPMarket**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
  - Main market contract handling minting, settlement, and redemption
  - Current Phase: Open (1)
  - k Parameter: 10,000,000 ppm (k=10)

- **Long Token (USGDP.Q3.2025.L)**: `0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81`
  - ERC-20 token representing long positions
  - 18 decimals
  - Name: "USGDP.Q3.2025 Long"

- **Short Token (USGDP.Q3.2025.S)**: `0x6D544390Eb535d61e196c87d6B9c80dCD8628Acd`  
  - ERC-20 token representing short positions
  - 18 decimals
  - Symbol: "USGDP.Q3.2025.S"

### Supporting Contracts
- **MockUSDC**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
  - Test USDC token with 6 decimals
  - 1M USDC minted to deployer

- **MockGDPOracle**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
  - Mock oracle for testing GDP data

## Configuration
- **Treasury**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **Mint Fee**: 30 bps (0.3%)
- **Pair Redeem Fee**: 30 bps (0.3%)
- **Settlement Skim**: 10 bps (0.1%)
- **Open Timestamp**: 1756399831 (≈1 hour after deployment)
- **Close Timestamp**: 1758988231 (≈30 days after open)

## Transaction History
1. **Block 1**: MockUSDC deployment (0x83c96fb...)
2. **Block 2**: MockUSDC mint 1M to deployer (0x95bea02...)
3. **Block 3**: MockGDPOracle deployment (0x8f475dc...)
4. **Block 4**: GDPMarket deployment (0x312ea74...)
5. **Block 5**: Approve market to spend USDC (0x5b716af...)
6. **Block 6**: Test mint 1000 USDC → 997 Long tokens (0xf4f379e...)

## Verification Results ✅
- ✅ Contracts deployed successfully
- ✅ Market phase transitions working (Pending → Open)
- ✅ Token minting functional (1000 USDC → 997 Long tokens after fees)
- ✅ Fee collection working (3 USDC fee to treasury)
- ✅ All contract parameters set correctly

## Test Commands
```bash
# Check market phase
cast call 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 "getCurrentPhase()(uint8)" --rpc-url http://localhost:8546

# Check long token balance
cast call 0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81 "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8546

# Check USDC balance
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8546
```

## Ready for Testing
The contracts are fully deployed and ready for comprehensive testing of:
- Minting long and short positions
- Pair redemption functionality
- Oracle integration and settlement
- Phase transitions and access controls
- Fee collection and treasury management