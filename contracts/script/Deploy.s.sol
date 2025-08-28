// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GDPMarket.sol";
import "../src/MockGDPOracle.sol";
import "../src/USGDPOracle.sol";
import "../src/MockUSDC.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Default parameters
        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        address hashStorage = vm.envOr("HASH_STORAGE_ADDRESS", address(0));
        address oracle = vm.envOr("ORACLE_ADDRESS", address(0));
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        uint256 baselineGDP = vm.envOr("BASELINE_GDP", uint256(0));
        
        uint256 kPpm = vm.envOr("K_PPM", uint256(10e6)); // k = 10
        uint256 mintFeeBps = vm.envOr("MINT_FEE_BPS", uint256(30)); // 0.3%
        uint256 pairRedeemFeeBps = vm.envOr("PAIR_REDEEM_FEE_BPS", uint256(30)); // 0.3%
        uint256 settleSkimBps = vm.envOr("SETTLE_SKIM_BPS", uint256(10)); // 0.1%
        
        uint256 openAt = vm.envOr("OPEN_AT", block.timestamp + 1 hours);
        uint256 closeAt = vm.envOr("CLOSE_AT", block.timestamp + 30 days);
        
        string memory longName = "USGDP.Q3.2025 Long";
        string memory longSymbol = "USGDP.Q3.2025.L";
        string memory shortName = "USGDP.Q3.2025 Short";
        string memory shortSymbol = "USGDP.Q3.2025.S";

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC if no USDC address provided
        if (usdc == address(0)) {
            MockUSDC mockUsdc = new MockUSDC();
            usdc = address(mockUsdc);
            console.log("MockUSDC deployed at:", usdc);
            
            // Mint some USDC for testing
            mockUsdc.mint(deployer, 1_000_000 * 10**6); // 1M USDC
        }

        // Deploy Oracle if no oracle address provided
        if (oracle == address(0)) {
            if (hashStorage != address(0) && baselineGDP > 0) {
                // Deploy real US GDP Oracle
                USGDPOracle realOracle = new USGDPOracle(hashStorage, baselineGDP);
                oracle = address(realOracle);
                console.log("USGDPOracle deployed at:", oracle);
                console.log("Hash Storage:", hashStorage);
                console.log("Baseline GDP:", baselineGDP);
            } else {
                // Deploy mock oracle for testing
                MockGDPOracle mockOracle = new MockGDPOracle();
                oracle = address(mockOracle);
                console.log("MockGDPOracle deployed at:", oracle);
                console.log("Warning: Using mock oracle. Set HASH_STORAGE_ADDRESS and BASELINE_GDP for production");
            }
        }

        // Deploy GDPMarket
        GDPMarket market = new GDPMarket(
            usdc,
            longName,
            longSymbol,
            shortName,
            shortSymbol,
            oracle,
            kPpm,
            mintFeeBps,
            pairRedeemFeeBps,
            settleSkimBps,
            treasury,
            openAt,
            closeAt
        );

        console.log("GDPMarket deployed at:", address(market));
        console.log("Long token:", address(market.longToken()));
        console.log("Short token:", address(market.shortToken()));
        console.log("Treasury:", treasury);
        console.log("Open at timestamp:", openAt);
        console.log("Close at timestamp:", closeAt);

        vm.stopBroadcast();
    }
}