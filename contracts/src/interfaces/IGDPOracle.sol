// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGDPOracle {
    function readDelta() external view returns (int256 gPpm, bool finalized);
}