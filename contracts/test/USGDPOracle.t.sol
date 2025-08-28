// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/USGDPOracle.sol";
import "../src/interfaces/IHashStorage.sol";

contract MockHashStorage is IHashStorage {
    bytes32 public gdp_pdf_hash;
    uint256 public gdp_q2_2025;
    uint256 public timestamp;
    
    constructor(bytes32 _hash, uint256 _gdp) {
        gdp_pdf_hash = _hash;
        gdp_q2_2025 = _gdp;
        timestamp = block.timestamp;
    }
    
    function setGDP(uint256 _gdp) external {
        gdp_q2_2025 = _gdp;
        timestamp = block.timestamp;
    }
}

contract USGDPOracleTest is Test {
    USGDPOracle oracle;
    MockHashStorage hashStorage;
    
    uint256 constant BASELINE_GDP = 1000000; // 100.0000 (in tenths)
    bytes32 constant TEST_HASH = keccak256("test");
    
    event HashStorageUpdated(address newHashStorage);
    
    function setUp() public {
        hashStorage = new MockHashStorage(TEST_HASH, BASELINE_GDP);
        oracle = new USGDPOracle(address(hashStorage), BASELINE_GDP);
    }
    
    function testInitialState() public {
        assertEq(oracle.baselineGDP(), BASELINE_GDP);
        assertFalse(oracle.finalized());
        assertEq(address(oracle.hashStorage()), address(hashStorage));
    }
    
    function testReadDeltaNotFinalized() public {
        (int256 gPpm, bool isFinalized) = oracle.readDelta();
        assertEq(gPpm, 0);
        assertFalse(isFinalized);
    }
    
    function testReadDeltaZeroGrowth() public {
        oracle.finalizeOracle();
        
        (int256 gPpm, bool isFinalized) = oracle.readDelta();
        assertEq(gPpm, 0);
        assertTrue(isFinalized);
    }
    
    function testReadDeltaPositiveGrowth() public {
        // Set GDP to 1.5% higher
        hashStorage.setGDP(1015000); // 101.5000 (1.5% increase)
        oracle.finalizeOracle();
        
        (int256 gPpm, bool isFinalized) = oracle.readDelta();
        assertEq(gPpm, 15000); // 1.5% = 15000 ppm
        assertTrue(isFinalized);
    }
    
    function testReadDeltaNegativeGrowth() public {
        // Set GDP to 2% lower
        hashStorage.setGDP(980000); // 98.0000 (2% decrease)
        oracle.finalizeOracle();
        
        (int256 gPpm, bool isFinalized) = oracle.readDelta();
        // (980000 - 1000000) / 1000000 * 1e6 = -20000 / 1000000 * 1e6 = -20000
        assertEq(gPpm, -20000); 
        assertTrue(isFinalized);
    }
    
    function testOnlyOwnerCanFinalize() public {
        vm.prank(address(0x123));
        vm.expectRevert();
        oracle.finalizeOracle();
        
        oracle.finalizeOracle(); // Should work as owner
        assertTrue(oracle.finalized());
    }
    
    function testCannotFinalizedTwice() public {
        oracle.finalizeOracle();
        
        vm.expectRevert("Already finalized");
        oracle.finalizeOracle();
    }
    
    function testCannotSetBaselineAfterFinalized() public {
        oracle.finalizeOracle();
        
        vm.expectRevert("Already finalized");
        oracle.setBaseline(2000000);
    }
    
    function testSetHashStorage() public {
        MockHashStorage newHashStorage = new MockHashStorage(TEST_HASH, 2000000);
        
        vm.expectEmit(true, false, false, false);
        emit HashStorageUpdated(address(newHashStorage));
        oracle.setHashStorage(address(newHashStorage));
        
        assertEq(address(oracle.hashStorage()), address(newHashStorage));
    }
    
    function testGetCurrentGDP() public {
        assertEq(oracle.getCurrentGDP(), BASELINE_GDP);
        
        hashStorage.setGDP(1100000);
        assertEq(oracle.getCurrentGDP(), 1100000);
    }
    
    function testGetTimestamp() public {
        uint256 currentTime = oracle.getTimestamp();
        assertTrue(currentTime > 0);
    }
    
    function testGetPdfHash() public {
        assertEq(oracle.getPdfHash(), TEST_HASH);
    }
}