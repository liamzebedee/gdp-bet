#!/bin/bash

# Test deployment generation for local Anvil
# This creates deployment files from the existing local deployment

set -e

echo "🧪 Testing deployment file generation..."

# Create a test broadcast file structure for local deployment
BROADCAST_FILE="broadcast/Deploy.s.sol/31337/run-latest.json"

if [ ! -f $BROADCAST_FILE ]; then
    echo "❌ Local broadcast file not found. Please deploy to Anvil first."
    exit 1
fi

echo "📄 Generating deployment files for local network..."
node scripts/generate-deployments.js local $BROADCAST_FILE

# Get addresses from the local deployment
MARKET_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "GDPMarket") | .contractAddress' $BROADCAST_FILE)
USDC_ADDRESS=$(jq -r '.transactions[] | select(.contractName == "MockUSDC") | .contractAddress' $BROADCAST_FILE)

if [ "$MARKET_ADDRESS" != "null" ] && [ "$USDC_ADDRESS" != "null" ]; then
    echo "✅ Found contract addresses:"
    echo "  Market: $MARKET_ADDRESS"
    echo "  USDC: $USDC_ADDRESS"
    
    # Test contract calls
    echo "🔍 Testing contract calls..."
    PHASE=$(cast call $MARKET_ADDRESS "getCurrentPhase()(uint8)" --rpc-url http://localhost:8546)
    echo "  Current phase: $PHASE"
    
    USDC_BALANCE=$(cast call $USDC_ADDRESS "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8546)
    echo "  Deployer USDC balance: $USDC_BALANCE"
    
    echo "✅ Contract calls successful"
else
    echo "❌ Could not find contract addresses in broadcast file"
    exit 1
fi

echo "🎉 Test completed successfully!"