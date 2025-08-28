# GDP Coin Deployment Guide

This guide covers how to deploy the GDP Coin contracts to different networks.

## Prerequisites

- [Foundry](https://getfoundry.sh/) installed
- Node.js for deployment script generation
- Private key with sufficient ETH for deployment
- Etherscan API key (for verification on testnets/mainnet)

## Local Deployment (Anvil)

### 1. Start Anvil
```bash
anvil --host 0.0.0.0 --port 8546 --chain-id 31337
```

### 2. Deploy Contracts
```bash
# Using the basic deployment script
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:8546 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### 3. Generate Frontend Files
```bash
scripts/test-deployment.sh
```

## Sepolia Testnet Deployment

### 1. Configure Environment
Edit `.env.sepolia` with your settings:
```bash
PRIVATE_KEY=0x... # Your private key
RPC_URL=https://rpc.sepolia.org
ETHERSCAN_API_KEY=... # For verification
TREASURY_ADDRESS=0x... # Treasury address
# ... other parameters
```

### 2. Deploy with Uniswap Pools
```bash
scripts/deploy-sepolia.sh
```

This script will:
- Deploy all contracts (Market, Tokens, USDC, Oracle)  
- Create Uniswap V3 pools for Long/USDC and Short/USDC
- Initialize pools at 1:1 price ratio (no initial liquidity)
- Verify contracts on Etherscan
- Generate `deployments.js` and `deployments.ts` for frontend

## Manual Sepolia Deployment

If you prefer to deploy manually:

```bash
# Load environment
export $(cat .env.sepolia | grep -v '^#' | xargs)

# Deploy with pools
forge script script/DeploySepoliaWithPools.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Generate deployment files
node scripts/generate-deployments.js sepolia
```

## Mainnet Deployment

⚠️ **IMPORTANT**: For mainnet deployment, use real USDC and GDP oracle addresses.

### 1. Update Environment
Create `.env.mainnet`:
```bash
PRIVATE_KEY=0x... # SECURE PRIVATE KEY
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/... # Your RPC
ETHERSCAN_API_KEY=...
USDC_ADDRESS=0xA0b86a33E6a5C64dd0D2dFDC5b0b5b8cB56B7A99 # Real USDC
HASH_STORAGE_ADDRESS=0x36ccdf11044f60f196e981970d592a7de567ed7b # Real GDP Oracle
BASELINE_GDP=... # Current GDP baseline
# ... other parameters
```

### 2. Deploy
```bash
# Similar to Sepolia but with mainnet config
export $(cat .env.mainnet | grep -v '^#' | xargs)

forge script script/DeploySepoliaWithPools.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Contract Addresses

After deployment, contract addresses are stored in:
- `broadcast/` directory (Foundry)
- `../frontend/deployments.js` (JavaScript)
- `../frontend/deployments.ts` (TypeScript)

## Pool Configuration

The deployment creates Uniswap V3 pools with:
- **Fee tier**: 0.3% (3000)
- **Initial price**: 1:1 ratio
- **No initial liquidity**: Pools are created empty

To add liquidity later, use the Uniswap position manager or frontend interfaces.

## Testing Deployment

### Check Contract Status
```bash
# Check market phase
cast call <MARKET_ADDRESS> "getCurrentPhase()(uint8)" --rpc-url <RPC_URL>

# Check token balances
cast call <USDC_ADDRESS> "balanceOf(address)(uint256)" <YOUR_ADDRESS> --rpc-url <RPC_URL>
```

### Mint Test Tokens (Testnet only)
```bash
# Mint MockUSDC to yourself
cast send <USDC_ADDRESS> "mint(address,uint256)" <YOUR_ADDRESS> 1000000000000 \
  --rpc-url <RPC_URL> --private-key <PRIVATE_KEY>
```

## Troubleshooting

### Common Issues

1. **"execution reverted"**: Check contract is deployed and network is correct
2. **"insufficient funds"**: Ensure deployer has enough ETH
3. **Pool creation fails**: Check Uniswap factory addresses for network
4. **Verification fails**: Check Etherscan API key and network

### Verify Deployment
```bash
# Check all contracts exist
cast code <CONTRACT_ADDRESS> --rpc-url <RPC_URL>

# Test basic functionality
cast call <MARKET_ADDRESS> "kPpm()(uint256)" --rpc-url <RPC_URL>
```

## Security Notes

- **Never commit private keys** to version control
- **Use hardware wallets** for mainnet deployments  
- **Test thoroughly** on testnets before mainnet
- **Verify contract source code** on Etherscan
- **Review all parameters** before deployment

## Files Generated

After successful deployment:
- `deployments.js` - JavaScript import for frontend
- `deployments.ts` - TypeScript definitions
- `broadcast/` - Complete deployment transaction history
- Etherscan verification links in console output