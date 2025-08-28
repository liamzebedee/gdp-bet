// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/GDPMarket.sol";
import "../src/MockGDPOracle.sol";
import "../src/USGDPOracle.sol";
import "../src/MockUSDC.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap V3 interfaces
interface IUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

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

// Using IERC20 from OpenZeppelin imports

contract DeploySepoliaWithPoolsScript is Script {
    IUniswapV3Factory constant UNISWAP_FACTORY = IUniswapV3Factory(0x0227628f3F023bb0B980b67D528571c95c6DaC1c);
    INonfungiblePositionManager constant POSITION_MANAGER = INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);
    
    // 0.3% fee tier for pools
    uint24 constant POOL_FEE = 3000;
    
    // Price at 1:1 ratio (sqrtPriceX96 = sqrt(price) * 2^96)
    // For 1:1 price, sqrtPriceX96 = 2^96 ≈ 79228162514264337593543950336
    uint160 constant SQRT_PRICE_1_TO_1 = 79228162514264337593543950336;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Parameters
        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        address hashStorage = vm.envOr("HASH_STORAGE_ADDRESS", address(0));
        address oracle = vm.envOr("ORACLE_ADDRESS", address(0));
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        uint256 baselineGDP = vm.envOr("BASELINE_GDP", uint256(0));
        
        uint256 kPpm = vm.envOr("K_PPM", uint256(10e6));
        uint256 mintFeeBps = vm.envOr("MINT_FEE_BPS", uint256(30));
        uint256 pairRedeemFeeBps = vm.envOr("PAIR_REDEEM_FEE_BPS", uint256(30));
        uint256 settleSkimBps = vm.envOr("SETTLE_SKIM_BPS", uint256(10));
        
        uint256 openAt = vm.envOr("OPEN_AT", block.timestamp + 1 hours);
        uint256 closeAt = vm.envOr("CLOSE_AT", block.timestamp + 30 days);
        
        string memory longName = "USGDP.Q3.2025 Long";
        string memory longSymbol = "USGDP.Q3.2025.L";
        string memory shortName = "USGDP.Q3.2025 Short";
        string memory shortSymbol = "USGDP.Q3.2025.S";

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC for Sepolia testing
        if (usdc == address(0)) {
            MockUSDC mockUsdc = new MockUSDC();
            usdc = address(mockUsdc);
            console.log("MockUSDC deployed at:", usdc);
            
            // Mint some USDC for testing (don't add to pools)
            mockUsdc.mint(deployer, 1_000_000 * 10**6); // 1M USDC
        }

        // Deploy Oracle
        if (oracle == address(0)) {
            if (hashStorage != address(0) && baselineGDP > 0) {
                USGDPOracle realOracle = new USGDPOracle(hashStorage, baselineGDP);
                oracle = address(realOracle);
                console.log("USGDPOracle deployed at:", oracle);
                console.log("Hash Storage:", hashStorage);
                console.log("Baseline GDP:", baselineGDP);
            } else {
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

        address longToken = address(market.longToken());
        address shortToken = address(market.shortToken());

        console.log("GDPMarket deployed at:", address(market));
        console.log("Long token:", longToken);
        console.log("Short token:", shortToken);

        // Create Uniswap V3 pools
        console.log("Creating Uniswap V3 pools...");

        // Create Long/USDC pool
        address longPool = _createPoolIfNotExists(longToken, usdc, POOL_FEE);
        console.log("Long/USDC pool created at:", longPool);

        // Create Short/USDC pool  
        address shortPool = _createPoolIfNotExists(shortToken, usdc, POOL_FEE);
        console.log("Short/USDC pool created at:", shortPool);

        console.log("Deployment Summary:");
        console.log("===================");
        console.log("Network: Sepolia");
        console.log("Market:", address(market));
        console.log("Long Token:", longToken);
        console.log("Short Token:", shortToken);
        console.log("USDC:", usdc);
        console.log("Oracle:", oracle);
        console.log("Treasury:", treasury);
        console.log("Long/USDC Pool:", longPool);
        console.log("Short/USDC Pool:", shortPool);
        console.log("Open at:", openAt);
        console.log("Close at:", closeAt);

        vm.stopBroadcast();
    }

    function _createPoolIfNotExists(address token0, address token1, uint24 fee) internal returns (address pool) {
        // Ensure token0 < token1
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }

        // Check if pool already exists
        pool = UNISWAP_FACTORY.getPool(token0, token1, fee);
        
        if (pool == address(0)) {
            // Create and initialize pool
            pool = POSITION_MANAGER.createAndInitializePoolIfNecessary(
                token0,
                token1,
                fee,
                SQRT_PRICE_1_TO_1
            );
            console.log("Created new pool for", token0, "/", token1);
        } else {
            console.log("Pool already exists for", token0, "/", token1);
        }
    }
}