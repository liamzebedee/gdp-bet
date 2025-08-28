'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId } from 'wagmi';
import { formatEther, formatUnits, parseUnits } from 'viem';
import { useMarketState, useUserBalances, useOracleState, useContractWrites, useContractAddresses } from './hooks/useContracts';

enum Phase {
  Pending = 0,
  Open = 1,
  Frozen = 2,
  Settled = 3
}

export default function Home() {
  const { address } = useAccount();
  const chainId = useChainId();
  const marketState = useMarketState();
  const userBalances = useUserBalances();
  const oracleState = useOracleState();
  const contractWrites = useContractWrites();
  const contractAddresses = useContractAddresses();

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

  const handleMint = async () => {
    if (!address) return;
    
    setLoading(true);
    setError('');

    try {
      const usdcAmount = parseUnits(mintAmount, 6);
      
      // Approve USDC first
      contractWrites.approveUSDC(usdcAmount);
      
      // Wait a bit then mint tokens
      setTimeout(() => {
        contractWrites.mint(mintSide === 'long', usdcAmount);
      }, 2000);

      setMintAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePairRedeem = async () => {
    if (!address) return;
    
    setLoading(true);
    setError('');

    try {
      const tokenAmount = parseUnits(pairRedeemAmount, 18);
      contractWrites.pairRedeem(tokenAmount);
      setPairRedeemAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!address) return;
    
    setLoading(true);
    setError('');

    try {
      const tokenAmount = parseUnits(redeemAmount, 18);
      if (redeemSide === 'long') {
        contractWrites.redeemLong(tokenAmount);
      } else {
        contractWrites.redeemShort(tokenAmount);
      }
      setRedeemAmount('');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const getPhaseString = (phase?: number) => {
    if (phase === undefined) return 'Loading...';
    switch (phase) {
      case Phase.Pending: return 'Pending';
      case Phase.Open: return 'Open';
      case Phase.Frozen: return 'Frozen';
      case Phase.Settled: return 'Settled';
      default: return 'Unknown';
    }
  };

  const getTimeToClose = () => {
    if (!marketState.closeAt) return '';
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Number(marketState.closeAt) - now;
    if (timeLeft <= 0) return 'Closed';
    
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const calculateMintFee = () => {
    if (!mintAmount || !marketState.mintFeeBps) return '0';
    const amount = parseFloat(mintAmount);
    const fee = (amount * Number(marketState.mintFeeBps)) / 10000;
    return fee.toFixed(6);
  };

  const calculateTokensOut = () => {
    if (!mintAmount || !marketState.mintFeeBps) return '0';
    const amount = parseFloat(mintAmount);
    const fee = (amount * Number(marketState.mintFeeBps)) / 10000;
    return (amount - fee).toFixed(6);
  };

  const calculatePairRedeemOut = () => {
    if (!pairRedeemAmount || !marketState.pairRedeemFeeBps) return '0';
    const amount = parseFloat(pairRedeemAmount);
    const fee = (amount * Number(marketState.pairRedeemFeeBps)) / 10000;
    return (amount - fee).toFixed(6);
  };

  const calculateRedeemOut = () => {
    if (!redeemAmount) return '0';
    const amount = parseFloat(redeemAmount);
    
    if (redeemSide === 'long' && marketState.longRedeemDenominator && marketState.longRedeemNumerator) {
      return ((amount * Number(marketState.longRedeemNumerator)) / Number(marketState.longRedeemDenominator)).toFixed(6);
    } else if (redeemSide === 'short' && marketState.shortRedeemDenominator && marketState.shortRedeemNumerator) {
      return ((amount * Number(marketState.shortRedeemNumerator)) / Number(marketState.shortRedeemDenominator)).toFixed(6);
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
    if (marketState.phase !== Phase.Settled || !userBalances.longBalance || !userBalances.shortBalance) return '—';
    
    const longValue = parseFloat(formatEther(userBalances.longBalance)) * (marketState.longRedeemDenominator 
      ? Number(marketState.longRedeemNumerator!) / Number(marketState.longRedeemDenominator) 
      : 0);
    
    const shortValue = parseFloat(formatEther(userBalances.shortBalance)) * (marketState.shortRedeemDenominator
      ? Number(marketState.shortRedeemNumerator!) / Number(marketState.shortRedeemDenominator)
      : 0);

    return (longValue + shortValue).toFixed(2);
  };

  const getEtherscanUrl = (tokenAddress?: string) => {
    if (!chainId || !tokenAddress) return '#';
    
    // Etherscan URLs by chain
    const baseUrls = {
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      31337: '#', // Local - no Etherscan
    };
    
    const baseUrl = baseUrls[chainId as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    return `${baseUrl}/token/${tokenAddress}`;
  };

  const getContractUrl = (contractAddress?: string) => {
    if (!chainId || !contractAddress) return '#';
    
    // Etherscan URLs by chain
    const baseUrls = {
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      31337: '#', // Local - no Etherscan
    };
    
    const baseUrl = baseUrls[chainId as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    return `${baseUrl}/address/${contractAddress}`;
  };

  const addTokenToWallet = async (tokenAddress: string, symbol: string, name: string) => {
    try {
      // Check if window.ethereum is available
      if (!window.ethereum) {
        alert('Please install MetaMask or another Web3 wallet to add tokens');
        return;
      }

      // Request to add token to wallet
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: symbol,
            decimals: 18,
            name: name,
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to wallet:', error);
      alert('Failed to add token to wallet');
    }
  };

  const getUniswapUrl = (tokenAddress?: string) => {
    if (!chainId || !tokenAddress) return '#';
    
    // Uniswap URLs by chain
    const baseUrls = {
      1: 'https://app.uniswap.org', // Mainnet
      11155111: 'https://app.uniswap.org', // Sepolia 
      31337: '#', // Local - no Uniswap
    };
    
    const baseUrl = baseUrls[chainId as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    // USDC addresses by chain
    const usdcAddresses = {
      1: '0xA0b86a33E6441e54B9c8c604Dc395d6Af2dc0Ae8', // Real USDC on mainnet
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC on Sepolia testnet
      31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Mock USDC on local
    };
    
    const usdcAddress = usdcAddresses[chainId as keyof typeof usdcAddresses];
    if (!usdcAddress) return '#';
    
    return `${baseUrl}/#/swap?inputCurrency=${usdcAddress}&outputCurrency=${tokenAddress}`;
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 font-mono flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">USGDP.Q3.2025</h1>
            <div className="text-sm text-gray-600">
              Phase: <span className="font-semibold">{getPhaseString(marketState.phase)}</span>
            </div>
            <div className="text-sm text-gray-600">
              Close: <span className="font-semibold">End of Q3 2025</span>
            </div>
            <div className="text-sm text-gray-600">
              Oracle: <span className="font-semibold">{oracleState.finalized ? 'Finalized' : 'Not finalized'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            Vault
            <a 
              href={getContractUrl(contractAddresses.gdpMarket)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-600"
              title="View contract on Etherscan"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>TVL (USDC):</span>
              <span className="font-semibold">
                {marketState.vaultBalance ? formatUnits(marketState.vaultBalance, 6) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                Your L balance:
                {marketState.longTokenAddress && (
                  <>
                    <a 
                      href={getEtherscanUrl(marketState.longTokenAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                      title="View on Etherscan"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => addTokenToWallet(marketState.longTokenAddress!, 'USGDP.Q3.2025.L', 'USGDP.Q3.2025 Long')}
                      className="text-gray-400 hover:text-green-600 ml-1"
                      title="Add to Wallet"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </>
                )}
              </span>
              <span className="font-semibold">
                {userBalances.longBalance ? parseFloat(formatEther(userBalances.longBalance)).toFixed(4) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                Your S balance:
                {marketState.shortTokenAddress && (
                  <>
                    <a 
                      href={getEtherscanUrl(marketState.shortTokenAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                      title="View on Etherscan"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => addTokenToWallet(marketState.shortTokenAddress!, 'USGDP.Q3.2025.S', 'USGDP.Q3.2025 Short')}
                      className="text-gray-400 hover:text-red-600 ml-1"
                      title="Add to Wallet"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </>
                )}
              </span>
              <span className="font-semibold">
                {userBalances.shortBalance ? parseFloat(formatEther(userBalances.shortBalance)).toFixed(4) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Your USDC balance:</span>
              <span className="font-semibold">
                {userBalances.usdcBalance ? formatUnits(userBalances.usdcBalance, 6) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Estimated payout:</span>
              <span className="font-semibold">{estimatedPayout()} USDC</span>
            </div>
          </div>
        </div>

        {/* Mint Panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Mint</h2>
          {marketState.phase === Phase.Open ? (
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
          {marketState.phase === Phase.Open ? (
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
                {oracleState.gPpm && oracleState.gPpm !== 0n
                  ? `${(Number(oracleState.gPpm) / 10000).toFixed(2)}%`
                  : '—'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-semibold">
                {oracleState.finalized ? 'Finalized' : 'Not finalized'}
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
                href={getUniswapUrl(marketState.longTokenAddress)} 
                className="text-blue-600 hover:underline text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trade L on Uniswap →
              </a>
            </div>
            <div>
              <a 
                href={getUniswapUrl(marketState.shortTokenAddress)} 
                className="text-blue-600 hover:underline text-xs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Trade S on Uniswap →
              </a>
            </div>
            {(!chainId || chainId === 31337) && (
              <div className="text-xs text-gray-500 pt-2">
                Uniswap v3 pools not available on local network
              </div>
            )}
            {chainId && chainId !== 31337 && (
              <div className="text-xs text-gray-500 pt-2">
                Uniswap v3 pools may not be deployed yet
              </div>
            )}
          </div>
        </div>

        {/* Simulator Panel */}
        {marketState.phase !== Phase.Settled && (
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