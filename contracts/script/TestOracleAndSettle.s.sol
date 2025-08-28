// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GDPMarket.sol";
import "../src/MockGDPOracle.sol";

contract TestOracleAndSettleScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get deployed contract addresses
        address marketAddress = vm.envAddress("MARKET_ADDRESS");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        
        // GDP growth percentage (e.g., 2.5% = 25000 ppm)
        int256 gdpGrowthPpm = vm.envOr("GDP_GROWTH_PPM", int256(25000)); // Default 2.5% growth
        
        console.log("Testing Oracle and Settlement...");
        console.log("Market Address:", marketAddress);
        console.log("Oracle Address:", oracleAddress);
        console.log("GDP Growth (ppm):", uint256(gdpGrowthPpm));
        console.log("GDP Growth (%):", _ppmToPercentageString(gdpGrowthPpm));

        GDPMarket market = GDPMarket(marketAddress);
        MockGDPOracle oracle = MockGDPOracle(oracleAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Check current market phase
        GDPMarket.Phase currentPhase = market.getCurrentPhase();
        console.log("Current Market Phase:", uint8(currentPhase));
        
        if (currentPhase == GDPMarket.Phase.Pending) {
            console.log("Market is still in Pending phase");
        } else if (currentPhase == GDPMarket.Phase.Open) {
            console.log("Market is in Open phase - trading active");
        } else if (currentPhase == GDPMarket.Phase.Frozen) {
            console.log("Market is in Frozen phase - ready for settlement");
        } else if (currentPhase == GDPMarket.Phase.Settled) {
            console.log("Market is already settled");
            _showSettlementResults(market);
            vm.stopBroadcast();
            return;
        }

        // Set oracle data
        console.log("Setting oracle GDP data...");
        oracle.setDelta(gdpGrowthPpm, true);
        
        // Verify oracle data
        (int256 oracleGPpm, bool finalized) = oracle.readDelta();
        console.log("Oracle GDP (ppm):", uint256(oracleGPpm));
        console.log("Oracle GDP (%):", _ppmToPercentageString(oracleGPpm));
        console.log("Oracle Finalized:", finalized);

        // If market is in Frozen phase, we can settle
        if (currentPhase == GDPMarket.Phase.Frozen) {
            console.log("Settling market...");
            
            // Get pre-settlement data
            uint256 longPotBefore = market.longPot();
            uint256 shortPotBefore = market.shortPot();
            
            console.log("Before Settlement:");
            console.log("Long Pot:", longPotBefore);
            console.log("Short Pot:", shortPotBefore);
            
            // Settle the market
            market.settle();
            
            // Get post-settlement data
            uint256 longPotAfter = market.longPot();
            uint256 shortPotAfter = market.shortPot();
            int256 marketGPpm = market.gPpm();
            
            console.log("After Settlement:");
            console.log("Market GDP (ppm):", uint256(marketGPpm));
            console.log("Market GDP (%):", _ppmToPercentageString(marketGPpm));
            console.log("Long Pot:", longPotAfter);
            console.log("Short Pot:", shortPotAfter);
            
            _showSettlementResults(market);
            
        } else {
            console.log("Market is not in Frozen phase yet. Current phase:", uint8(currentPhase));
            console.log("Close at timestamp:", market.closeAt());
            console.log("Current timestamp:", block.timestamp);
            
            if (block.timestamp < market.closeAt()) {
                console.log("Market will freeze at:", market.closeAt());
                console.log("Time until freeze:", market.closeAt() - block.timestamp, "seconds");
            }
        }

        vm.stopBroadcast();
    }

    function _showSettlementResults(GDPMarket market) internal view {
        console.log("\n=== SETTLEMENT RESULTS ===");
        
        uint256 longRedeemNum = market.longRedeemNumerator();
        uint256 longRedeemDen = market.longRedeemDenominator();
        uint256 shortRedeemNum = market.shortRedeemNumerator();
        uint256 shortRedeemDen = market.shortRedeemDenominator();
        
        console.log("Long Token Redemption Rate:");
        if (longRedeemDen > 0) {
            uint256 longRate = (longRedeemNum * 1e6) / longRedeemDen; // Rate in USDC per token (scaled by 1e6)
            console.log("  %d USDC per Long Token", longRate);
        }
        
        console.log("Short Token Redemption Rate:");
        if (shortRedeemDen > 0) {
            uint256 shortRate = (shortRedeemNum * 1e6) / shortRedeemDen; // Rate in USDC per token (scaled by 1e6)
            console.log("  %d USDC per Short Token", shortRate);
        }
        
        console.log("\nTotal Pot Distribution:");
        console.log("Long Pot: %d USDC", market.longPot() / 1e6);
        console.log("Short Pot: %d USDC", market.shortPot() / 1e6);
        
        uint256 totalPot = market.longPot() + market.shortPot();
        if (totalPot > 0) {
            uint256 longPercentage = (market.longPot() * 100) / totalPot;
            uint256 shortPercentage = 100 - longPercentage;
            console.log("Long Share: %d%%", longPercentage);
            console.log("Short Share: %d%%", shortPercentage);
        }
    }

    function _ppmToPercentageString(int256 ppm) internal pure returns (string memory) {
        bool negative = ppm < 0;
        uint256 absPpm = negative ? uint256(-ppm) : uint256(ppm);
        uint256 percentage = absPpm / 10000; // Convert ppm to basis points
        uint256 decimal = (absPpm % 10000) / 100; // Get decimal part
        
        return negative ? 
            string(abi.encodePacked("-", vm.toString(percentage), ".", vm.toString(decimal), "%")) :
            string(abi.encodePacked(vm.toString(percentage), ".", vm.toString(decimal), "%"));
    }
}