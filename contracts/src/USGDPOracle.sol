// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGDPOracle.sol";
import "./interfaces/IHashStorage.sol";

contract USGDPOracle is IGDPOracle, Ownable {
    IHashStorage public hashStorage;
    uint256 public baselineGDP; // Previous quarter GDP for comparison
    bool public finalized;
    
    event BaselineSet(uint256 baseline);
    event OracleFinalized();
    event HashStorageUpdated(address newHashStorage);

    constructor(address _hashStorage, uint256 _baselineGDP) Ownable(msg.sender) {
        hashStorage = IHashStorage(_hashStorage);
        baselineGDP = _baselineGDP;
    }

    function readDelta() external view override returns (int256 gPpm, bool isFinalized) {
        if (!finalized) {
            return (0, false);
        }

        uint256 currentGDP = hashStorage.gdp_q2_2025();
        
        if (currentGDP == 0 || baselineGDP == 0) {
            return (0, finalized);
        }

        // Calculate QoQ change in ppm (parts per million)
        // Formula: ((current - baseline) / baseline) * 1,000,000
        if (currentGDP >= baselineGDP) {
            uint256 increase = currentGDP - baselineGDP;
            gPpm = int256((increase * 1e6) / baselineGDP);
        } else {
            uint256 decrease = baselineGDP - currentGDP;
            gPpm = -int256((decrease * 1e6) / baselineGDP);
        }

        return (gPpm, finalized);
    }

    function setHashStorage(address _hashStorage) external onlyOwner {
        require(_hashStorage != address(0), "Invalid hash storage");
        hashStorage = IHashStorage(_hashStorage);
        emit HashStorageUpdated(_hashStorage);
    }

    function setBaseline(uint256 _baselineGDP) external onlyOwner {
        require(!finalized, "Already finalized");
        baselineGDP = _baselineGDP;
        emit BaselineSet(_baselineGDP);
    }

    function finalizeOracle() external onlyOwner {
        require(!finalized, "Already finalized");
        finalized = true;
        emit OracleFinalized();
    }

    function getCurrentGDP() external view returns (uint256) {
        return hashStorage.gdp_q2_2025();
    }

    function getTimestamp() external view returns (uint256) {
        return hashStorage.timestamp();
    }

    function getPdfHash() external view returns (bytes32) {
        return hashStorage.gdp_pdf_hash();
    }
}