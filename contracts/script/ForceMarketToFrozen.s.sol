// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GDPMarket.sol";

contract ForceMarketToFrozenScript is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get deployed market address
        address marketAddress = vm.envAddress("MARKET_ADDRESS");
        
        console.log("Forcing Market to Frozen Phase...");
        console.log("Market Address:", marketAddress);

        GDPMarket market = GDPMarket(marketAddress);

        // Check current state
        GDPMarket.Phase currentPhase = market.getCurrentPhase();
        uint256 closeAt = market.closeAt();
        uint256 currentTime = block.timestamp;
        
        console.log("Current Phase:", uint8(currentPhase));
        console.log("Current Time:", currentTime);
        console.log("Close Time:", closeAt);
        console.log("Time Difference:", int256(closeAt) - int256(currentTime));

        if (currentPhase == GDPMarket.Phase.Frozen) {
            console.log("Market is already in Frozen phase!");
            return;
        }

        if (currentPhase == GDPMarket.Phase.Settled) {
            console.log("Market is already settled!");
            return;
        }

        if (currentPhase == GDPMarket.Phase.Pending) {
            console.log("Market is in Pending phase. It needs to reach Open first.");
            uint256 openAt = market.openAt();
            console.log("Opens at:", openAt);
            if (currentTime < openAt) {
                console.log("Market hasn't opened yet. Wait until:", openAt);
                return;
            }
        }

        // If we're in a test environment (Anvil/local), we can manipulate time
        if (block.chainid == 31337) {
            console.log("Detected local testnet. Fast-forwarding time...");
            
            // Fast forward to after close time
            uint256 targetTime = closeAt + 1;
            vm.warp(targetTime);
            
            console.log("Time warped to:", block.timestamp);
            
            // Check phase again
            currentPhase = market.getCurrentPhase();
            console.log("New Phase after warp:", uint8(currentPhase));
            
            if (currentPhase == GDPMarket.Phase.Frozen) {
                console.log("Successfully moved market to Frozen phase!");
            } else {
                console.log("Unexpected phase after time warp");
            }
        } else {
            console.log("On live network. Cannot manipulate time.");
            console.log("Market will naturally move to Frozen phase at:", closeAt);
            
            if (currentTime < closeAt) {
                uint256 timeToWait = closeAt - currentTime;
                console.log("Time until Frozen phase:", timeToWait, "seconds");
                console.log("That's approximately:", timeToWait / 3600, "hours");
            }
        }
    }
}