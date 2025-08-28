#!/bin/bash

# Sepolia Deployment Script
# Deploys GDP Coin contracts to Sepolia and creates Uniswap pools

set -e

echo "🚀 Deploying GDP Coin to Sepolia..."

# Check if .env.sepolia exists
if [ ! -f .env.sepolia ]; then
    echo "❌ .env.sepolia file not found!"
    exit 1
fi

# Load environment variables
export $(cat .env.sepolia | grep -v '^#' | xargs)

# Verify we have required variables
if [ -z "$PRIVATE_KEY" ] || [ -z "$RPC_URL" ]; then
    echo "❌ Missing required environment variables (PRIVATE_KEY, RPC_URL)"
    exit 1
fi

echo "📋 Configuration:"
echo "  Network: Sepolia"
echo "  RPC: $RPC_URL"
echo "  Deployer: $(cast wallet address $PRIVATE_KEY)"
echo "  Treasury: $TREASURY_ADDRESS"

# Check deployer balance
BALANCE=$(cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $RPC_URL)
echo "  ETH Balance: $(cast --to-unit $BALANCE ether) ETH"

if [ $(echo "$BALANCE < 1000000000000000000" | bc -l) -eq 1 ]; then
    echo "⚠️  Warning: Low ETH balance. You may need more ETH for deployment and gas fees."
fi

# Deploy contracts
echo ""
echo "🏗️  Deploying contracts..."
forge script script/DeploySepoliaWithPools.s.sol \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    -vv

# Extract addresses and generate deployment files
BROADCAST_FILE="broadcast/DeploySepoliaWithPools.s.sol/11155111/run-latest.json"

if [ -f $BROADCAST_FILE ]; then
    echo ""
    echo "📄 Generating deployment files..."
    
    # Use the Node.js script to generate deployment files
    node scripts/generate-deployments.js sepolia $BROADCAST_FILE
    
    # Get contract addresses for additional setup
    MARKET_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "GDPMarket") | .contractAddress' $BROADCAST_FILE)
    USDC_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockUSDC") | .contractAddress' $BROADCAST_FILE)
    
    if [ "$MARKET_ADDRESS" != "null" ] && [ "$USDC_ADDRESS" != "null" ]; then
        # Get token addresses from market contract
        LONG_ADDRESS=$(cast call $MARKET_ADDRESS "longToken()(address)" --rpc-url $RPC_URL)
        SHORT_ADDRESS=$(cast call $MARKET_ADDRESS "shortToken()(address)" --rpc-url $RPC_URL)
        
        # Get pool addresses
        LONG_POOL=$(cast call "0x1F98431c8aD98523631AE4a59f267346ea31F984" "getPool(address,address,uint24)(address)" $LONG_ADDRESS $USDC_ADDRESS 3000 --rpc-url $RPC_URL)
        SHORT_POOL=$(cast call "0x1F98431c8aD98523631AE4a59f267346ea31F984" "getPool(address,address,uint24)(address)" $SHORT_ADDRESS $USDC_ADDRESS 3000 --rpc-url $RPC_URL)
        
        # Update the generated files with actual addresses
        sed -i "s/LONG_TOKEN_ADDRESS/$LONG_ADDRESS/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/SHORT_TOKEN_ADDRESS/$SHORT_ADDRESS/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/LONG_POOL_ADDRESS/$LONG_POOL/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/SHORT_POOL_ADDRESS/$SHORT_POOL/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/OPEN_AT_TIMESTAMP/$OPEN_AT/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/CLOSE_AT_TIMESTAMP/$CLOSE_AT/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/K_PPM_VALUE/$K_PPM/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/MINT_FEE_BPS_VALUE/$MINT_FEE_BPS/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/PAIR_REDEEM_FEE_BPS_VALUE/$PAIR_REDEEM_FEE_BPS/g" ../frontend/deployments.js ../frontend/deployments.ts
        sed -i "s/SETTLE_SKIM_BPS_VALUE/$SETTLE_SKIM_BPS/g" ../frontend/deployments.js ../frontend/deployments.ts
        
        echo "✅ Updated deployment files with contract addresses"
        echo "  Market: $MARKET_ADDRESS"
        echo "  Long Token: $LONG_ADDRESS"  
        echo "  Short Token: $SHORT_ADDRESS"
        echo "  Long/USDC Pool: $LONG_POOL"
        echo "  Short/USDC Pool: $SHORT_POOL"
    fi
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📍 Next steps:"
echo "  1. Update frontend to use the new contract addresses"
echo "  2. Fund the deployer account with MockUSDC for testing"
echo "  3. Test the frontend with the deployed contracts"
echo ""
echo "🔗 Useful commands:"
echo "  # Check market phase"
echo "  cast call \$(jq -r '.transactions[] | select(.contractName == \"GDPMarket\") | .contractAddress' $BROADCAST_FILE) \"getCurrentPhase()(uint8)\" --rpc-url $RPC_URL"
echo ""
echo "  # Mint some MockUSDC to your address"  
echo "  cast send \$(jq -r '.transactions[] | select(.contractName == \"MockUSDC\") | .contractAddress' $BROADCAST_FILE) \"mint(address,uint256)\" \$(cast wallet address $PRIVATE_KEY) 1000000000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY"