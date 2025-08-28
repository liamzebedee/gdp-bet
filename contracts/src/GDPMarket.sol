// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LongToken.sol";
import "./ShortToken.sol";
import "./interfaces/IGDPOracle.sol";
import "./interfaces/IUSDC.sol";

contract GDPMarket is ReentrancyGuard, Pausable, Ownable {
    enum Phase {
        Pending,
        Open,
        Frozen,
        Settled
    }

    uint256 private constant PPM_PRECISION = 1e6;
    uint256 private constant BPS_PRECISION = 1e4;
    uint256 private constant USDC_DECIMALS = 6;
    uint256 private constant TOKEN_DECIMALS = 18;
    uint256 private constant USDC_TO_TOKEN_SCALE = 10 ** (TOKEN_DECIMALS - USDC_DECIMALS);

    IUSDC public immutable USDC;
    LongToken public immutable longToken;
    ShortToken public immutable shortToken;
    IGDPOracle public oracle;

    uint256 public kPpm;
    uint256 public mintFeeBps;
    uint256 public pairRedeemFeeBps;
    uint256 public settleSkimBps;
    address public treasury;
    uint256 public openAt;
    uint256 public closeAt;
    
    Phase public phase;
    bool public paramsLocked;
    
    int256 public gPpm;
    uint256 public longPot;
    uint256 public shortPot;
    uint256 public longRedeemNumerator;
    uint256 public longRedeemDenominator;
    uint256 public shortRedeemNumerator;
    uint256 public shortRedeemDenominator;

    event Mint(address indexed user, bool isLong, uint256 usdcAmount, uint256 tokensOut);
    event PairRedeem(address indexed user, uint256 tokensRedeemed, uint256 usdcOut);
    event Settled(int256 gPpm, uint256 longPot, uint256 shortPot);
    event Redeem(address indexed user, bool isLong, uint256 tokensBurned, uint256 usdcOut);
    event ParamsLocked();

    constructor(
        address _usdc,
        string memory _longName,
        string memory _longSymbol,
        string memory _shortName,
        string memory _shortSymbol,
        address _oracle,
        uint256 _kPpm,
        uint256 _mintFeeBps,
        uint256 _pairRedeemFeeBps,
        uint256 _settleSkimBps,
        address _treasury,
        uint256 _openAt,
        uint256 _closeAt
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC");
        require(_oracle != address(0), "Invalid oracle");
        require(_treasury != address(0), "Invalid treasury");
        require(_openAt < _closeAt, "Invalid timing");
        require(_kPpm <= 20e6, "k too large");
        require(_mintFeeBps < BPS_PRECISION, "Fee too high");
        require(_pairRedeemFeeBps < BPS_PRECISION, "Fee too high");
        require(_settleSkimBps < BPS_PRECISION, "Skim too high");

        USDC = IUSDC(_usdc);
        longToken = new LongToken(_longName, _longSymbol);
        shortToken = new ShortToken(_shortName, _shortSymbol);
        
        oracle = IGDPOracle(_oracle);
        kPpm = _kPpm;
        mintFeeBps = _mintFeeBps;
        pairRedeemFeeBps = _pairRedeemFeeBps;
        settleSkimBps = _settleSkimBps;
        treasury = _treasury;
        openAt = _openAt;
        closeAt = _closeAt;
        
        phase = Phase.Pending;
    }

    modifier updatePhase() {
        _updatePhase();
        _;
    }

    function _updatePhase() internal {
        if (phase == Phase.Pending && block.timestamp >= openAt) {
            phase = Phase.Open;
        }
        if (phase == Phase.Open && block.timestamp >= closeAt) {
            phase = Phase.Frozen;
        }
    }

    function mint(bool isLong, uint256 usdcAmount) external nonReentrant whenNotPaused updatePhase {
        require(phase == Phase.Open, "Not in Open phase");
        require(usdcAmount > 0, "Zero amount");
        
        require(USDC.transferFrom(msg.sender, address(this), usdcAmount), "Transfer failed");
        
        uint256 fee = (usdcAmount * mintFeeBps) / BPS_PRECISION;
        if (fee > 0) {
            require(USDC.transfer(treasury, fee), "Fee transfer failed");
        }
        
        uint256 netUsdc = usdcAmount - fee;
        uint256 tokensOut = netUsdc * USDC_TO_TOKEN_SCALE;
        
        if (isLong) {
            longToken.mint(msg.sender, tokensOut);
        } else {
            shortToken.mint(msg.sender, tokensOut);
        }
        
        emit Mint(msg.sender, isLong, usdcAmount, tokensOut);
    }

    function pairRedeem(uint256 tokens) external nonReentrant updatePhase {
        require(phase == Phase.Open, "Not in Open phase");
        require(tokens > 0, "Zero amount");
        
        longToken.burn(msg.sender, tokens);
        shortToken.burn(msg.sender, tokens);
        
        uint256 usdcAmount = tokens / USDC_TO_TOKEN_SCALE;
        uint256 fee = (usdcAmount * pairRedeemFeeBps) / BPS_PRECISION;
        uint256 netUsdc = usdcAmount - fee;
        
        if (fee > 0) {
            require(USDC.transfer(treasury, fee), "Fee transfer failed");
        }
        require(USDC.transfer(msg.sender, netUsdc), "Transfer failed");
        
        emit PairRedeem(msg.sender, tokens, netUsdc);
    }

    function settle() external nonReentrant updatePhase {
        require(phase == Phase.Frozen, "Not in Frozen phase");
        
        (int256 _gPpm, bool finalized) = oracle.readDelta();
        require(finalized, "Oracle not finalized");
        
        gPpm = _gPpm;
        
        uint256 shareLongPpm;
        if (_gPpm >= 0) {
            uint256 product = uint256(_gPpm) * kPpm;
            shareLongPpm = 5e5 + (5e5 * product) / (PPM_PRECISION * PPM_PRECISION);
            if (shareLongPpm > PPM_PRECISION) {
                shareLongPpm = PPM_PRECISION;
            }
        } else {
            uint256 absG = uint256(-_gPpm);
            uint256 product = absG * kPpm;
            uint256 adjustment = (5e5 * product) / (PPM_PRECISION * PPM_PRECISION);
            if (adjustment >= 5e5) {
                shareLongPpm = 0;
            } else {
                shareLongPpm = 5e5 - adjustment;
            }
        }
        
        uint256 vaultBalance = USDC.balanceOf(address(this));
        uint256 skimAmount = (vaultBalance * settleSkimBps) / BPS_PRECISION;
        
        if (skimAmount > 0) {
            require(USDC.transfer(treasury, skimAmount), "Skim transfer failed");
        }
        
        uint256 vNet = vaultBalance - skimAmount;
        
        longPot = (vNet * shareLongPpm) / PPM_PRECISION;
        shortPot = vNet - longPot;
        
        uint256 longSupply = longToken.totalSupply();
        uint256 shortSupply = shortToken.totalSupply();
        
        if (longSupply > 0) {
            longRedeemNumerator = longPot;
            longRedeemDenominator = longSupply / USDC_TO_TOKEN_SCALE;
        }
        
        if (shortSupply > 0) {
            shortRedeemNumerator = shortPot;
            shortRedeemDenominator = shortSupply / USDC_TO_TOKEN_SCALE;
        }
        
        phase = Phase.Settled;
        
        emit Settled(_gPpm, longPot, shortPot);
    }

    function redeemLong(uint256 amount) external nonReentrant {
        require(phase == Phase.Settled, "Not settled");
        require(amount > 0, "Zero amount");
        
        longToken.burn(msg.sender, amount);
        
        uint256 usdcAmount = (amount / USDC_TO_TOKEN_SCALE * longRedeemNumerator) / longRedeemDenominator;
        require(usdcAmount <= longPot, "Insufficient pot");
        
        longPot -= usdcAmount;
        require(USDC.transfer(msg.sender, usdcAmount), "Transfer failed");
        
        emit Redeem(msg.sender, true, amount, usdcAmount);
    }

    function redeemShort(uint256 amount) external nonReentrant {
        require(phase == Phase.Settled, "Not settled");
        require(amount > 0, "Zero amount");
        
        shortToken.burn(msg.sender, amount);
        
        uint256 usdcAmount = (amount / USDC_TO_TOKEN_SCALE * shortRedeemNumerator) / shortRedeemDenominator;
        require(usdcAmount <= shortPot, "Insufficient pot");
        
        shortPot -= usdcAmount;
        require(USDC.transfer(msg.sender, usdcAmount), "Transfer failed");
        
        emit Redeem(msg.sender, false, amount, usdcAmount);
    }

    function setOracle(address _oracle) external onlyOwner {
        require(!paramsLocked, "Params locked");
        require(phase == Phase.Pending, "Can only set before Open");
        oracle = IGDPOracle(_oracle);
    }

    function setKPpm(uint256 _kPpm) external onlyOwner {
        require(!paramsLocked, "Params locked");
        require(phase == Phase.Pending, "Can only set before Open");
        require(_kPpm <= 20e6, "k too large");
        kPpm = _kPpm;
    }

    function setFees(uint256 _mintFeeBps, uint256 _pairRedeemFeeBps, uint256 _settleSkimBps) external onlyOwner {
        require(!paramsLocked, "Params locked");
        require(phase == Phase.Pending, "Can only set before Open");
        require(_mintFeeBps < BPS_PRECISION && _pairRedeemFeeBps < BPS_PRECISION && _settleSkimBps < BPS_PRECISION, "Fee too high");
        mintFeeBps = _mintFeeBps;
        pairRedeemFeeBps = _pairRedeemFeeBps;
        settleSkimBps = _settleSkimBps;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(!paramsLocked, "Params locked");
        require(phase == Phase.Pending, "Can only set before Open");
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    function lockParams() external onlyOwner {
        require(phase == Phase.Pending, "Can only lock before Open");
        paramsLocked = true;
        emit ParamsLocked();
    }

    function pauseMinting() external onlyOwner {
        _pause();
    }

    function unpauseMinting() external onlyOwner {
        _unpause();
    }

    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(USDC), "Cannot recover USDC");
        require(token != address(longToken), "Cannot recover long tokens");
        require(token != address(shortToken), "Cannot recover short tokens");
        IERC20(token).transfer(treasury, amount);
    }

    function getCurrentPhase() external view returns (Phase) {
        if (phase == Phase.Pending && block.timestamp >= openAt) {
            return Phase.Open;
        }
        if (phase == Phase.Open && block.timestamp >= closeAt) {
            return Phase.Frozen;
        }
        return phase;
    }
}