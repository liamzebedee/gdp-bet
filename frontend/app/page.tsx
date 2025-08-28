'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useNetwork } from 'wagmi';
import { useContracts, useReadOnlyContracts } from './hooks/useContracts';

enum Phase {
  Pending = 0,
  Open = 1,
  Frozen = 2,
  Settled = 3
}

interface ContractState {
  phase: Phase;
  closeAt: number;
  longBalance: string;
  shortBalance: string;
  usdcBalance: string;
  vaultBalance: string;
  longTokenAddress: string;
  shortTokenAddress: string;
  mintFeeBps: number;
  pairRedeemFeeBps: number;
  gPpm: string;
  longPot: string;
  shortPot: string;
  longRedeemNumerator: string;
  longRedeemDenominator: string;
  shortRedeemNumerator: string;
  shortRedeemDenominator: string;
  oracleFinalized: boolean;
}

export default function Home() {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const contracts = useContracts();
  const readOnlyContracts = useReadOnlyContracts();

  const [state, setState] = useState<ContractState>({
    phase: Phase.Pending,
    closeAt: 0,
    longBalance: '0',
    shortBalance: '0',
    usdcBalance: '0',
    vaultBalance: '0',
    longTokenAddress: '',
    shortTokenAddress: '',
    mintFeeBps: 0,
    pairRedeemFeeBps: 0,
    gPpm: '0',
    longPot: '0',
    shortPot: '0',
    longRedeemNumerator: '0',
    longRedeemDenominator: '0',
    shortRedeemNumerator: '0',
    shortRedeemDenominator: '0',
    oracleFinalized: false,
  });

  const [mintAmount, setMintAmount] = useState('');
  const [mintSide, setMintSide] = useState<'long' | 'short'>('long');
  const [pairRedeemAmount, setPairRedeemAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemSide, setRedeemSide] = useState<'long' | 'short'>('long');
  const [simulatorG, setSimulatorG] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch contract state
  useEffect(() => {
    const fetchState = async () => {
      if (!readOnlyContracts?.gdpMarket) return;

      try {
        const [
          phase,
          closeAt,
          longTokenAddr,
          shortTokenAddr,
          mintFeeBps,
          pairRedeemFeeBps,
          vaultBalance,
          gPpm,
          longPot,
          shortPot,
          longRedeemNumerator,
          longRedeemDenominator,
          shortRedeemNumerator,
          shortRedeemDenominator,
        ] = await Promise.all([
          readOnlyContracts.gdpMarket.getCurrentPhase(),
          readOnlyContracts.gdpMarket.closeAt(),
          readOnlyContracts.gdpMarket.longToken(),
          readOnlyContracts.gdpMarket.shortToken(),
          readOnlyContracts.gdpMarket.mintFeeBps(),
          readOnlyContracts.gdpMarket.pairRedeemFeeBps(),
          readOnlyContracts.mockUSDC.balanceOf(readOnlyContracts.gdpMarket.address),
          readOnlyContracts.gdpMarket.gPpm(),
          readOnlyContracts.gdpMarket.longPot(),
          readOnlyContracts.gdpMarket.shortPot(),
          readOnlyContracts.gdpMarket.longRedeemNumerator(),
          readOnlyContracts.gdpMarket.longRedeemDenominator(),
          readOnlyContracts.gdpMarket.shortRedeemNumerator(),
          readOnlyContracts.gdpMarket.shortRedeemDenominator(),
        ]);

        // Check oracle status
        const [, oracleFinalized] = await readOnlyContracts.mockGDPOracle.readDelta();

        let longBalance = '0';
        let shortBalance = '0';
        let usdcBalance = '0';

        if (address) {
          const longTokenContract = new ethers.Contract(longTokenAddr, [
            'function balanceOf(address) external view returns (uint256)'
          ], readOnlyContracts.gdpMarket.provider);

          const shortTokenContract = new ethers.Contract(shortTokenAddr, [
            'function balanceOf(address) external view returns (uint256)'
          ], readOnlyContracts.gdpMarket.provider);

          [longBalance, shortBalance, usdcBalance] = await Promise.all([
            longTokenContract.balanceOf(address),
            shortTokenContract.balanceOf(address),
            readOnlyContracts.mockUSDC.balanceOf(address),
          ]);
        }

        setState({
          phase,
          closeAt: closeAt.toNumber(),
          longBalance: ethers.utils.formatEther(longBalance),
          shortBalance: ethers.utils.formatEther(shortBalance),
          usdcBalance: ethers.utils.formatUnits(usdcBalance, 6),
          vaultBalance: ethers.utils.formatUnits(vaultBalance, 6),
          longTokenAddress: longTokenAddr,
          shortTokenAddress: shortTokenAddr,
          mintFeeBps: mintFeeBps.toNumber(),
          pairRedeemFeeBps: pairRedeemFeeBps.toNumber(),
          gPpm: gPpm.toString(),
          longPot: ethers.utils.formatUnits(longPot, 6),
          shortPot: ethers.utils.formatUnits(shortPot, 6),
          longRedeemNumerator: longRedeemNumerator.toString(),
          longRedeemDenominator: longRedeemDenominator.toString(),
          shortRedeemNumerator: shortRedeemNumerator.toString(),
          shortRedeemDenominator: shortRedeemDenominator.toString(),
          oracleFinalized,
        });
      } catch (err) {
        console.error('Error fetching state:', err);
        setError('Failed to fetch contract state');
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [readOnlyContracts, address]);

  const handleMint = async () => {
    if (!contracts?.gdpMarket || !address) return;
    
    setLoading(true);
    setError('');

    try {
      const usdcAmount = ethers.utils.parseUnits(mintAmount, 6);
      
      // Approve USDC first
      const approveTx = await contracts.mockUSDC.approve(contracts.gdpMarket.address, usdcAmount);
      await approveTx.wait();

      // Mint tokens
      const mintTx = await contracts.gdpMarket.mint(mintSide === 'long', usdcAmount);
      await mintTx.wait();

      setMintAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePairRedeem = async () => {
    if (!contracts?.gdpMarket || !address) return;
    
    setLoading(true);
    setError('');

    try {
      const tokenAmount = ethers.utils.parseEther(pairRedeemAmount);
      const tx = await contracts.gdpMarket.pairRedeem(tokenAmount);
      await tx.wait();
      setPairRedeemAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!contracts?.gdpMarket || !address) return;
    
    setLoading(true);
    setError('');

    try {
      const tokenAmount = ethers.utils.parseEther(redeemAmount);
      const tx = redeemSide === 'long' 
        ? await contracts.gdpMarket.redeemLong(tokenAmount)
        : await contracts.gdpMarket.redeemShort(tokenAmount);
      await tx.wait();
      setRedeemAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const getPhaseString = (phase: Phase) => {
    switch (phase) {
      case Phase.Pending: return 'Pending';
      case Phase.Open: return 'Open';
      case Phase.Frozen: return 'Frozen';
      case Phase.Settled: return 'Settled';
      default: return 'Unknown';
    }
  };

  const getTimeToClose = () => {
    if (state.closeAt === 0) return '';
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = state.closeAt - now;
    if (timeLeft <= 0) return 'Closed';
    
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const calculateMintFee = () => {
    if (!mintAmount) return '0';
    const amount = parseFloat(mintAmount);
    const fee = (amount * state.mintFeeBps) / 10000;
    return fee.toFixed(6);
  };

  const calculateTokensOut = () => {
    if (!mintAmount) return '0';
    const amount = parseFloat(mintAmount);
    const fee = (amount * state.mintFeeBps) / 10000;
    return (amount - fee).toFixed(6);
  };

  const calculatePairRedeemOut = () => {
    if (!pairRedeemAmount) return '0';
    const amount = parseFloat(pairRedeemAmount);
    const fee = (amount * state.pairRedeemFeeBps) / 10000;
    return (amount - fee).toFixed(6);
  };

  const calculateRedeemOut = () => {
    if (!redeemAmount) return '0';
    const amount = parseFloat(redeemAmount);
    
    if (redeemSide === 'long' && state.longRedeemDenominator !== '0') {
      return ((amount * parseFloat(state.longRedeemNumerator)) / parseFloat(state.longRedeemDenominator)).toFixed(6);
    } else if (redeemSide === 'short' && state.shortRedeemDenominator !== '0') {
      return ((amount * parseFloat(state.shortRedeemNumerator)) / parseFloat(state.shortRedeemDenominator)).toFixed(6);
    }
    return '0';
  };

  const calculateSimulatorSplit = () => {
    if (!simulatorG) return { longShare: '50.00', shortShare: '50.00' };
    
    const g = parseFloat(simulatorG) / 100; // Convert percentage to decimal
    const k = 10; // Leverage from deployment
    let shareLong = 0.5 + (0.5 * k * g);
    
    if (shareLong > 1) shareLong = 1;
    if (shareLong < 0) shareLong = 0;
    
    const shareShort = 1 - shareLong;
    
    return {
      longShare: (shareLong * 100).toFixed(2),
      shortShare: (shareShort * 100).toFixed(2),
    };
  };

  const estimatedPayout = () => {
    if (state.phase !== Phase.Settled) return '—';
    
    const longValue = parseFloat(state.longBalance) * (state.longRedeemDenominator !== '0' 
      ? parseFloat(state.longRedeemNumerator) / parseFloat(state.longRedeemDenominator) 
      : 0);
    
    const shortValue = parseFloat(state.shortBalance) * (state.shortRedeemDenominator !== '0'
      ? parseFloat(state.shortRedeemNumerator) / parseFloat(state.shortRedeemDenominator)
      : 0);

    return (longValue + shortValue).toFixed(2);
  };

  const getUniswapUrl = (tokenAddress: string) => {
    if (!chain || !tokenAddress) return '#';
    
    // Uniswap URLs by chain
    const baseUrls = {
      1: 'https://app.uniswap.org', // Mainnet
      11155111: 'https://app.uniswap.org', // Sepolia 
      31337: '#', // Local - no Uniswap
    };
    
    const baseUrl = baseUrls[chain.id as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    // USDC addresses by chain
    const usdcAddresses = {
      1: '0xA0b86a33E6441e54B9c8c604Dc395d6Af2dc0Ae8',
      11155111: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Mock USDC on Sepolia
      31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Mock USDC on local
    };
    
    const usdcAddress = usdcAddresses[chain.id as keyof typeof usdcAddresses];
    if (!usdcAddress) return '#';
    
    return `${baseUrl}/#/swap?inputCurrency=${usdcAddress}&outputCurrency=${tokenAddress}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">USGDP.Q3.2025</h1>
            <div className="text-sm text-gray-600">
              Phase: <span className="font-semibold">{getPhaseString(state.phase)}</span>
            </div>
            <div className="text-sm text-gray-600">
              Close: <span className="font-semibold">End of Q3 2025</span>
            </div>
            <div className="text-sm text-gray-600">
              Oracle: <span className="font-semibold">{state.oracleFinalized ? 'Finalized' : 'Not finalized'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Network: <span className="font-semibold">{mounted ? (chain?.name || 'Unknown') : 'Loading...'}</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-4 mt-4 rounded">
          {error}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vault Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Vault</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>TVL (USDC):</span>
              <span className="font-semibold">{state.vaultBalance}</span>
            </div>
            <div className="flex justify-between">
              <span>Your L balance:</span>
              <span className="font-semibold">{parseFloat(state.longBalance).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Your S balance:</span>
              <span className="font-semibold">{parseFloat(state.shortBalance).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated payout:</span>
              <span className="font-semibold">{estimatedPayout()} USDC</span>
            </div>
            {state.phase === Phase.Settled && (
              <>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Long redeem rate:</span>
                    <span className="font-semibold">
                      {state.longRedeemDenominator !== '0' 
                        ? (parseFloat(state.longRedeemNumerator) / parseFloat(state.longRedeemDenominator)).toFixed(6)
                        : '0'} USDC/L
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Short redeem rate:</span>
                    <span className="font-semibold">
                      {state.shortRedeemDenominator !== '0'
                        ? (parseFloat(state.shortRedeemNumerator) / parseFloat(state.shortRedeemDenominator)).toFixed(6)
                        : '0'} USDC/S
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mint Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Mint</h2>
          {state.phase === Phase.Open ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Side</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMintSide('long')}
                    className={`px-4 py-2 rounded text-sm ${
                      mintSide === 'long' 
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    Long
                  </button>
                  <button
                    onClick={() => setMintSide('short')}
                    className={`px-4 py-2 rounded text-sm ${
                      mintSide === 'short' 
                        ? 'bg-red-100 text-red-800 border border-red-300' 
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    Short
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">USDC Amount</label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="0.0"
                />
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>Fee: {calculateMintFee()} USDC</div>
                <div>Tokens out: {calculateTokensOut()}</div>
              </div>
              
              <button
                onClick={handleMint}
                disabled={loading || !address || !mintAmount}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded text-sm disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Mint'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Minting is only available during Open phase
            </div>
          )}
        </div>

        {/* Pair Redeem Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Pair Redeem</h2>
          {state.phase === Phase.Open ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Token Amount</label>
                <input
                  type="number"
                  value={pairRedeemAmount}
                  onChange={(e) => setPairRedeemAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="0.0"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Burns equal amounts of L and S tokens
                </div>
              </div>
              
              <div className="text-xs text-gray-600">
                USDC out: {calculatePairRedeemOut()}
              </div>
              
              <button
                onClick={handlePairRedeem}
                disabled={loading || !address || !pairRedeemAmount}
                className="w-full bg-yellow-600 text-white py-2 px-4 rounded text-sm disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Pair Redeem'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Pair redemption is only available during Open phase
            </div>
          )}
        </div>

        {/* Redeem Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Redeem</h2>
          {state.phase === Phase.Settled ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Side</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRedeemSide('long')}
                    className={`px-4 py-2 rounded text-sm ${
                      redeemSide === 'long' 
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    Long
                  </button>
                  <button
                    onClick={() => setRedeemSide('short')}
                    className={`px-4 py-2 rounded text-sm ${
                      redeemSide === 'short' 
                        ? 'bg-red-100 text-red-800 border border-red-300' 
                        : 'bg-gray-100 text-gray-700 border border-gray-300'
                    }`}
                  >
                    Short
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Token Amount</label>
                <input
                  type="number"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="0.0"
                />
              </div>
              
              <div className="text-xs text-gray-600">
                USDC out: {calculateRedeemOut()}
              </div>
              
              <button
                onClick={handleRedeem}
                disabled={loading || !address || !redeemAmount}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded text-sm disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Redeem'}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Single-sided redemption is only available after settlement
            </div>
          )}
        </div>

        {/* Oracle Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Oracle</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Quarter:</span>
              <span className="font-semibold">Q3 2025</span>
            </div>
            <div className="flex justify-between">
              <span>GDP Change (g):</span>
              <span className="font-semibold">
                {state.gPpm !== '0' 
                  ? `${(parseInt(state.gPpm) / 10000).toFixed(2)}%`
                  : '—'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-semibold">
                {state.oracleFinalized ? 'Finalized' : 'Not finalized'}
              </span>
            </div>
          </div>
        </div>

        {/* Prices Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Prices</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div>L/USDC: —</div>
            <div>S/USDC: —</div>
            <div className="pt-2">
              <a 
                href={getUniswapUrl(state.longTokenAddress)} 
                className="text-blue-600 hover:underline text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trade L on Uniswap →
              </a>
            </div>
            <div>
              <a 
                href={getUniswapUrl(state.shortTokenAddress)} 
                className="text-blue-600 hover:underline text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trade S on Uniswap →
              </a>
            </div>
            {(!chain || chain.id === 31337) && (
              <div className="text-xs text-gray-500 pt-2">
                Uniswap v3 pools not available on local network
              </div>
            )}
            {chain && chain.id !== 31337 && (
              <div className="text-xs text-gray-500 pt-2">
                Uniswap v3 pools may not be deployed yet
              </div>
            )}
          </div>
        </div>

        {/* Simulator Panel */}
        {state.phase !== Phase.Settled && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-bold mb-4">Settlement Simulator</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Hypothetical GDP Change (g) as %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={simulatorG}
                  onChange={(e) => setSimulatorG(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="0.0"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Example: 0.1% for positive growth, -0.5% for negative growth
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Long share:</span>
                  <span className="font-semibold">{calculateSimulatorSplit().longShare}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Short share:</span>
                  <span className="font-semibold">{calculateSimulatorSplit().shortShare}%</span>
                </div>
                <div className="text-xs text-gray-500 pt-2">
                  Projected vault split at settlement
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}