// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IGDPOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockGDPOracle is IGDPOracle, Ownable {
    int256 public gPpm;
    bool public finalized;

    constructor() Ownable(msg.sender) {}

    function setDelta(int256 _gPpm, bool _finalized) external onlyOwner {
        gPpm = _gPpm;
        finalized = _finalized;
    }

    function readDelta() external view override returns (int256, bool) {
        return (gPpm, finalized);
    }
}