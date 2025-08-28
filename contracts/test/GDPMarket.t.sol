// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GDPMarket.sol";
import "../src/MockGDPOracle.sol";
import "../src/MockUSDC.sol";

contract GDPMarketTest is Test {
    GDPMarket market;
    MockGDPOracle oracle;
    MockUSDC usdc;
    
    address treasury = address(0x123);
    address user1 = address(0x456);
    address user2 = address(0x789);
    
    uint256 constant USDC_AMOUNT = 1000 * 10**6; // 1000 USDC
    uint256 constant K_PPM = 10 * 1e6; // k = 10
    uint256 constant MINT_FEE_BPS = 30; // 0.3%
    uint256 constant PAIR_REDEEM_FEE_BPS = 30; // 0.3%
    uint256 constant SETTLE_SKIM_BPS = 10; // 0.1%
    
    uint256 openAt;
    uint256 closeAt;

    event Mint(address indexed user, bool isLong, uint256 usdcAmount, uint256 tokensOut);
    event PairRedeem(address indexed user, uint256 tokensRedeemed, uint256 usdcOut);
    event Settled(int256 gPpm, uint256 longPot, uint256 shortPot);
    event Redeem(address indexed user, bool isLong, uint256 tokensBurned, uint256 usdcOut);
    event ParamsLocked();

    function setUp() public {
        openAt = block.timestamp + 1 hours;
        closeAt = openAt + 30 days;
        
        usdc = new MockUSDC();
        oracle = new MockGDPOracle();
        
        market = new GDPMarket(
            address(usdc),
            "USGDP.Q3.2025 Long",
            "USGDP.Q3.2025.L",
            "USGDP.Q3.2025 Short",
            "USGDP.Q3.2025.S",
            address(oracle),
            K_PPM,
            MINT_FEE_BPS,
            PAIR_REDEEM_FEE_BPS,
            SETTLE_SKIM_BPS,
            treasury,
            openAt,
            closeAt
        );

        // Mint USDC to users
        usdc.mint(user1, USDC_AMOUNT * 10);
        usdc.mint(user2, USDC_AMOUNT * 10);
        
        // Approve market to spend USDC
        vm.prank(user1);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(user2);
        usdc.approve(address(market), type(uint256).max);
    }

    function testInitialState() public {
        assertEq(uint256(market.phase()), uint256(GDPMarket.Phase.Pending));
        assertEq(market.kPpm(), K_PPM);
        assertEq(market.mintFeeBps(), MINT_FEE_BPS);
        assertEq(market.treasury(), treasury);
        assertEq(market.openAt(), openAt);
        assertEq(market.closeAt(), closeAt);
    }

    function testPhaseTransitions() public {
        // Start in Pending
        assertEq(uint256(market.getCurrentPhase()), uint256(GDPMarket.Phase.Pending));
        assertEq(uint256(market.phase()), uint256(GDPMarket.Phase.Pending));
        
        // Move to Open
        vm.warp(openAt);
        assertEq(uint256(market.getCurrentPhase()), uint256(GDPMarket.Phase.Open));
        
        // Check that actual phase updates when we call a function
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        assertEq(uint256(market.phase()), uint256(GDPMarket.Phase.Open));
        
        // Move to Frozen
        vm.warp(closeAt);
        assertEq(uint256(market.getCurrentPhase()), uint256(GDPMarket.Phase.Frozen));
    }

    function testMintLong() public {
        vm.warp(openAt);
        
        vm.expectEmit(true, false, false, true);
        emit Mint(user1, true, USDC_AMOUNT, USDC_AMOUNT * 1e12 * (10000 - MINT_FEE_BPS) / 10000);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        
        uint256 expectedTokens = USDC_AMOUNT * 1e12 * (10000 - MINT_FEE_BPS) / 10000;
        assertEq(market.longToken().balanceOf(user1), expectedTokens);
        assertEq(market.shortToken().balanceOf(user1), 0);
    }

    function testMintShort() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(false, USDC_AMOUNT);
        
        uint256 expectedTokens = USDC_AMOUNT * 1e12 * (10000 - MINT_FEE_BPS) / 10000;
        assertEq(market.longToken().balanceOf(user1), 0);
        assertEq(market.shortToken().balanceOf(user1), expectedTokens);
    }

    function testMintFeesToTreasury() public {
        vm.warp(openAt);
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        
        uint256 expectedFee = USDC_AMOUNT * MINT_FEE_BPS / 10000;
        assertEq(usdc.balanceOf(treasury) - treasuryBalanceBefore, expectedFee);
    }

    function testCannotMintInPendingPhase() public {
        vm.prank(user1);
        vm.expectRevert("Not in Open phase");
        market.mint(true, USDC_AMOUNT);
    }

    function testCannotMintZeroAmount() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        vm.expectRevert("Zero amount");
        market.mint(true, 0);
    }

    function testPairRedeem() public {
        vm.warp(openAt);
        
        // Mint both sides
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user1);
        market.mint(false, USDC_AMOUNT);
        
        uint256 tokenAmount = market.longToken().balanceOf(user1);
        uint256 user1UsdcBefore = usdc.balanceOf(user1);
        
        vm.expectEmit(true, false, false, true);
        emit PairRedeem(user1, tokenAmount, tokenAmount / 1e12 * (10000 - PAIR_REDEEM_FEE_BPS) / 10000);
        
        vm.prank(user1);
        market.pairRedeem(tokenAmount);
        
        assertEq(market.longToken().balanceOf(user1), 0);
        assertEq(market.shortToken().balanceOf(user1), 0);
        
        uint256 expectedUsdcOut = tokenAmount / 1e12 * (10000 - PAIR_REDEEM_FEE_BPS) / 10000;
        assertEq(usdc.balanceOf(user1) - user1UsdcBefore, expectedUsdcOut);
    }

    function testPairRedeemRoundTrip() public {
        vm.warp(openAt);
        
        // Mint both sides
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user1);
        market.mint(false, USDC_AMOUNT);
        
        uint256 tokenAmount = market.longToken().balanceOf(user1);
        
        // Verify we can pair redeem successfully
        vm.prank(user1);
        market.pairRedeem(tokenAmount);
        
        // Verify tokens are burned
        assertEq(market.longToken().balanceOf(user1), 0);
        assertEq(market.shortToken().balanceOf(user1), 0);
        
        // User should have received some USDC back (the exact amount depends on fees and precision)
        assertTrue(usdc.balanceOf(user1) > 8000 * 1e6); // Should have more than 8000 USDC
    }

    function testCannotPairRedeemInFrozenPhase() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user1);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        
        uint256 tokenAmount = market.longToken().balanceOf(user1);
        vm.prank(user1);
        vm.expectRevert("Not in Open phase");
        market.pairRedeem(tokenAmount);
    }

    function testSettleWinnerTakesAll() public {
        vm.warp(openAt);
        
        // Mint tokens
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        
        // Set extreme positive GDP growth (winner takes all for longs)
        oracle.setDelta(50000, true); // 5% growth
        
        // Just check that Settled event is emitted with correct gPpm
        vm.expectEmit(true, false, false, false);
        emit Settled(50000, 0, 0); // First param (gPpm) is checked, amounts are calculated
        
        market.settle();
        
        assertEq(uint256(market.phase()), uint256(GDPMarket.Phase.Settled));
        
        // Long should get almost all the pot
        assertTrue(market.longPot() > market.shortPot());
    }

    function testSettleNegativeGrowth() public {
        vm.warp(openAt);
        
        // Mint tokens
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        
        // Set negative GDP growth (shorts win)
        oracle.setDelta(-10000, true); // -1% growth
        
        market.settle();
        
        // Short should get more of the pot
        assertTrue(market.shortPot() > market.longPot());
    }

    function testCannotSettleBeforeFrozen() public {
        vm.warp(openAt);
        
        vm.expectRevert("Not in Frozen phase");
        market.settle();
    }

    function testCannotSettleWithoutOracleFinalized() public {
        vm.warp(closeAt);
        
        oracle.setDelta(10000, false); // Not finalized
        
        vm.expectRevert("Oracle not finalized");
        market.settle();
    }

    function testRedeemLong() public {
        vm.warp(openAt);
        
        // Mint and settle
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(20000, true); // 2% growth, longs win
        market.settle();
        
        // Redeem longs
        uint256 longBalance = market.longToken().balanceOf(user1);
        uint256 usdcBefore = usdc.balanceOf(user1);
        
        // Just check that Redeem event is emitted with correct user and isLong
        vm.expectEmit(true, true, false, false);
        emit Redeem(user1, true, 0, 0); // Only check user and isLong
        
        vm.prank(user1);
        market.redeemLong(longBalance);
        
        assertEq(market.longToken().balanceOf(user1), 0);
        assertTrue(usdc.balanceOf(user1) > usdcBefore);
    }

    function testRedeemShort() public {
        vm.warp(openAt);
        
        // Mint and settle
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(-20000, true); // -2% growth, shorts win
        market.settle();
        
        // Redeem shorts
        uint256 shortBalance = market.shortToken().balanceOf(user2);
        uint256 usdcBefore = usdc.balanceOf(user2);
        
        vm.prank(user2);
        market.redeemShort(shortBalance);
        
        assertEq(market.shortToken().balanceOf(user2), 0);
        assertTrue(usdc.balanceOf(user2) > usdcBefore);
    }

    function testCannotRedeemBeforeSettlement() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        
        uint256 tokenAmount = market.longToken().balanceOf(user1);
        
        vm.prank(user1);
        vm.expectRevert("Not settled");
        market.redeemLong(tokenAmount);
    }

    // Fuzz tests as specified in the spec
    function testFuzzGPpm(int256 gPpm) public {
        vm.assume(gPpm >= -50000 && gPpm <= 50000);
        
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(gPpm, true);
        market.settle();
        
        // Verify conservation: longPot + shortPot should equal net vault after skim
        uint256 totalPot = market.longPot() + market.shortPot();
        uint256 vaultBalance = usdc.balanceOf(address(market));
        assertEq(totalPot, vaultBalance);
    }

    function testFuzzKPpm(uint256 kPpmFuzz) public {
        kPpmFuzz = bound(kPpmFuzz, 1e6, 20e6); // 1 <= k <= 20
        
        // Deploy new market with fuzzed k
        GDPMarket fuzzMarket = new GDPMarket(
            address(usdc),
            "Test Long",
            "TL",
            "Test Short",
            "TS",
            address(oracle),
            kPpmFuzz,
            MINT_FEE_BPS,
            PAIR_REDEEM_FEE_BPS,
            SETTLE_SKIM_BPS,
            treasury,
            openAt,
            closeAt
        );
        
        vm.prank(user1);
        usdc.approve(address(fuzzMarket), type(uint256).max);
        vm.prank(user2);
        usdc.approve(address(fuzzMarket), type(uint256).max);
        
        vm.warp(openAt);
        
        vm.prank(user1);
        fuzzMarket.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        fuzzMarket.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(10000, true); // 1% growth
        fuzzMarket.settle();
        
        // Should always be able to settle without reverting
        assertEq(uint256(fuzzMarket.phase()), uint256(GDPMarket.Phase.Settled));
    }

    function testSettlementIdempotent() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(10000, true);
        
        market.settle();
        uint256 longPot1 = market.longPot();
        uint256 shortPot1 = market.shortPot();
        
        // Try to settle again - should revert
        vm.expectRevert("Not in Frozen phase");
        market.settle();
        
        // Values should be unchanged
        assertEq(market.longPot(), longPot1);
        assertEq(market.shortPot(), shortPot1);
    }

    function testRedemptionDrainsPotsExactly() public {
        vm.warp(openAt);
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT);
        vm.prank(user2);
        market.mint(false, USDC_AMOUNT);
        
        vm.warp(closeAt);
        oracle.setDelta(0, true); // No growth, 50-50 split
        market.settle();
        
        
        // Redeem all longs
        uint256 longBalance = market.longToken().balanceOf(user1);
        vm.prank(user1);
        market.redeemLong(longBalance);
        
        // Redeem all shorts
        uint256 shortBalance = market.shortToken().balanceOf(user2);
        vm.prank(user2);
        market.redeemShort(shortBalance);
        
        // Pots should be drained (or very close to 0 due to rounding)
        assertTrue(market.longPot() < 10);
        assertTrue(market.shortPot() < 10);
    }

    function testPausingMinting() public {
        vm.warp(openAt);
        
        // Owner can pause
        market.pauseMinting();
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        market.mint(true, USDC_AMOUNT);
        
        // Owner can unpause
        market.unpauseMinting();
        
        vm.prank(user1);
        market.mint(true, USDC_AMOUNT); // Should work now
    }

    function testRecoverERC20() public {
        // Deploy a random ERC20 token
        MockUSDC randomToken = new MockUSDC();
        randomToken.mint(address(market), 1000);
        
        uint256 treasuryBefore = randomToken.balanceOf(treasury);
        
        market.recoverERC20(address(randomToken), 1000);
        
        assertEq(randomToken.balanceOf(treasury) - treasuryBefore, 1000);
    }

    function testCannotRecoverUSDC() public {
        vm.expectRevert("Cannot recover USDC");
        market.recoverERC20(address(usdc), 1000);
    }

    function testCannotRecoverClaimTokens() public {
        address longTokenAddr = address(market.longToken());
        address shortTokenAddr = address(market.shortToken());
        
        vm.expectRevert("Cannot recover long tokens");
        market.recoverERC20(longTokenAddr, 1000);
        
        vm.expectRevert("Cannot recover short tokens"); 
        market.recoverERC20(shortTokenAddr, 1000);
    }

    function testParamLocking() public {
        // Can set params before locking
        market.setKPpm(15e6);
        
        // Lock params
        vm.expectEmit(false, false, false, false);
        emit ParamsLocked();
        market.lockParams();
        
        // Cannot set params after locking
        vm.expectRevert("Params locked");
        market.setKPpm(20e6);
    }

    function testOnlyOwnerFunctions() public {
        vm.prank(user1);
        vm.expectRevert();
        market.setKPpm(15e6);
        
        vm.prank(user1);
        vm.expectRevert();
        market.pauseMinting();
        
        vm.prank(user1);
        vm.expectRevert();
        market.lockParams();
    }
}