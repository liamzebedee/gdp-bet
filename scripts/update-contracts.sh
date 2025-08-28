#!/bin/bash

# Script to automatically update contract data in frontend after deployment

echo "🔄 Updating contract data..."

# Change to project root
cd "$(dirname "$0")/.."

# Copy contract ABIs and addresses to frontend
node scripts/copy-contracts.js

echo "✅ Contract data updated successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure Anvil is running: anvil --port 8546"
echo "2. Deploy contracts: cd contracts && forge script script/Deploy.s.sol --rpc-url http://localhost:8546 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast"
echo "3. Start frontend: cd frontend && npm run dev"
echo ""
echo "🌐 Frontend available at: http://localhost:3000"