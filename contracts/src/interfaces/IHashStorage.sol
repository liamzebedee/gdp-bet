// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IHashStorage {
    function gdp_pdf_hash() external view returns (bytes32);
    function gdp_q2_2025() external view returns (uint256);
    function timestamp() external view returns (uint256);
}