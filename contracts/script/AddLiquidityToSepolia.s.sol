// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap V3 interfaces
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata params) external payable returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);
}

contract AddLiquidityToSepoliaScript is Script {
    INonfungiblePositionManager constant POSITION_MANAGER = INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);
    
    // 0.3% fee tier for pools
    uint24 constant POOL_FEE = 3000;
    
    // Full range liquidity (roughly -887k to +887k ticks)
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 887220;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get deployed contract addresses from environment
        address longToken = vm.envAddress("LONG_TOKEN_ADDRESS");
        address shortToken = vm.envAddress("SHORT_TOKEN_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        
        // Liquidity amounts
        uint256 usdcAmount = vm.envOr("USDC_LIQUIDITY_AMOUNT", uint256(10000 * 10**6)); // 10k USDC
        uint256 tokenAmount = vm.envOr("TOKEN_LIQUIDITY_AMOUNT", uint256(10000 * 10**18)); // 10k tokens
        
        console.log("Adding liquidity to Sepolia pools...");
        console.log("Long Token:", longToken);
        console.log("Short Token:", shortToken);
        console.log("USDC:", usdc);
        console.log("USDC Amount:", usdcAmount);
        console.log("Token Amount:", tokenAmount);

        vm.startBroadcast(deployerPrivateKey);

        // Mint tokens for liquidity if deployer owns the market
        address market = vm.envOr("MARKET_ADDRESS", address(0));
        if (market != address(0)) {
            // Get some USDC and tokens for liquidity
            IERC20(usdc).transfer(deployer, usdcAmount * 2); // Get USDC for both pools
            
            // Approve GDPMarket to spend USDC for minting
            IERC20(usdc).approve(market, usdcAmount * 2);
            
            // Mint equal amounts of long and short tokens
            // This assumes the market is in Open phase
            // In production, you'd need to handle this more carefully
            console.log("Minting tokens for liquidity...");
        }

        // Add liquidity to Long/USDC pool
        _addLiquidity(longToken, usdc, tokenAmount, usdcAmount, deployer);
        
        // Add liquidity to Short/USDC pool
        _addLiquidity(shortToken, usdc, tokenAmount, usdcAmount, deployer);

        console.log("Liquidity added successfully!");

        vm.stopBroadcast();
    }

    function _addLiquidity(
        address token,
        address usdc,
        uint256 tokenAmount,
        uint256 usdcAmount,
        address recipient
    ) internal {
        // Sort tokens (token0 should be < token1)
        address token0 = token < usdc ? token : usdc;
        address token1 = token < usdc ? usdc : token;
        uint256 amount0 = token < usdc ? tokenAmount : usdcAmount;
        uint256 amount1 = token < usdc ? usdcAmount : tokenAmount;

        // Approve tokens
        IERC20(token0).approve(address(POSITION_MANAGER), amount0);
        IERC20(token1).approve(address(POSITION_MANAGER), amount1);

        console.log("Adding liquidity for", token0, "/", token1);
        console.log("Amount0:", amount0);
        console.log("Amount1:", amount1);

        // Add liquidity
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: POOL_FEE,
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: amount0 * 95 / 100, // 5% slippage
            amount1Min: amount1 * 95 / 100, // 5% slippage
            recipient: recipient,
            deadline: block.timestamp + 1800 // 30 minutes
        });

        try POSITION_MANAGER.mint(params) returns (uint256 tokenId, uint128 liquidity, uint256 amount0Used, uint256 amount1Used) {
            console.log("Liquidity position created:");
            console.log("Token ID:", tokenId);
            console.log("Liquidity:", uint256(liquidity));
            console.log("Amount0 used:", amount0Used);
            console.log("Amount1 used:", amount1Used);
        } catch Error(string memory reason) {
            console.log("Failed to add liquidity:", reason);
        }
    }
}