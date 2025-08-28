'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChainId } from 'wagmi';
import { useContractAddresses } from './hooks/useContracts';

export default function Landing() {
  const [mounted, setMounted] = useState(false);
  const chainId = useChainId();
  const contractAddresses = useContractAddresses();

  useEffect(() => {
    setMounted(true);
  }, []);

  const getContractUrl = (contractAddress?: string) => {
    if (!chainId || !contractAddress) return '#';
    
    const baseUrls = {
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      31337: '#',
    };
    
    const baseUrl = baseUrls[chainId as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    return `${baseUrl}/address/${contractAddress}`;
  };

  const getUniswapUrl = () => {
    if (!chainId) return '#';
    
    const baseUrls = {
      1: 'https://app.uniswap.org',
      11155111: 'https://app.uniswap.org', 
      31337: '#',
    };
    
    const baseUrl = baseUrls[chainId as keyof typeof baseUrls] || '#';
    if (baseUrl === '#') return '#';
    
    // Just link to Uniswap app, users can search for the tokens there
    return baseUrl;
  };

  if (!mounted) {
    return <div className="min-h-screen bg-gradient-to-br from-blue-900 via-red-100 to-red-900 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-red-100 to-red-900 relative overflow-hidden">
      {/* American Flag Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-1/3 h-2/5 bg-blue-800"></div>
        {Array.from({ length: 13 }, (_, i) => (
          <div
            key={i}
            className={`absolute left-0 right-0 h-1/13 ${i % 2 === 0 ? 'bg-red-600' : 'bg-white'}`}
            style={{
              top: `${(i / 13) * 100}%`,
              height: `${100 / 13}%`,
            }}
          />
        ))}
        {/* Stars */}
        <div className="absolute top-0 left-0 w-1/3 h-2/5 grid grid-cols-6 grid-rows-5 p-2">
          {Array.from({ length: 50 }, (_, i) => (
            <div key={i} className="flex items-center justify-center">
              <div className="w-2 h-2 bg-white transform rotate-45" style={{
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
              }}>★</div>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 bg-black/20 backdrop-blur-md border-b border-white/30">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] flex items-center gap-2">
            🇺🇸 USGDP.Q3.2025
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <Link 
            href="/trade"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Trade Now
          </Link>
          <ConnectButton />
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Trade the Next
            <span className="block bg-gradient-to-r from-red-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              US GDP Print
            </span>
          </h1>

          {/* Previous GDP Status */}
          <div className="bg-black/30 backdrop-blur-md rounded-full px-6 py-3 mb-6 inline-flex items-center gap-3">
            <span className="text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              Previous Q2 2025 GDP: <span className="font-bold text-green-400">+3.3%</span>
            </span>
            <span className="text-white/70">→</span>
            <span className="text-white font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              Q3 2025: <span className="font-bold text-yellow-300">Pending</span>
            </span>
          </div>

          <p className="text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            After the Q2 2025 US GDP was{' '}<a 
              href="https://x.com/lex_node/status/1961075563365347781"
              className="text-yellow-300 hover:text-yellow-200 underline font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            >published on-chain and signed</a>, we're launching a permissionless prediction market for the next print: USGDP.Q3.2025.
          </p>

          {/* Key Value Propositions */}
          <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Pick Your Side</h3>
              <p className="text-white text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                Pick a side—Long or Short—mint your tokenized position, or just buy either one on Uniswap. 
                When the official QoQ GDP lands on-chain, the vault splits between longs and shorts by a simple rule. 
                Winners are paid in USDC.
              </p>
            </div>
            
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">No Middlemen</h3>
              <p className="text-white text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                No custodians. No IOUs. You're trading the surprise, not the headline. 
                The contract is permissionless; the payoff is deterministic; the data is signed on-chain.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-black/25 backdrop-blur-md rounded-2xl p-8 mb-12 border border-white/30 max-w-4xl mx-auto shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">How It Works</h2>
            <p className="text-white text-lg mb-6 leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              If GDP comes in higher, Long's share grows; if lower, Short's share grows. 
              Both positions are standard ERC-20s, so you can hold, trade, or exit on Uniswap at any time before settlement. 
              It's a clean, fully-collateralized, oracle-settled market tied to a single economic release.
            </p>
            <p className="text-white text-lg leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              Connect your wallet, choose Long or Short, set an amount, and mint—or hop straight to Uniswap for liquidity.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/trade"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Start Trading
            </Link>
            {/* <a
              href={getUniswapUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Buy on Uniswap
            </a> */}
          </div>

          {/* Links Section */}
          <div className="flex flex-wrap justify-center gap-6 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            <a 
              href="https://github.com/liamzebedee/gdp-markets"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
            <a 
              href={getContractUrl(contractAddresses.gdpMarket)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Contract
            </a>
            <a 
              href="https://github.com/liamzebedee/gdp-markets/blob/main/docs/SPEC.md"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8" />
              </svg>
              Docs
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-black/20 backdrop-blur-sm border-t border-white/30 p-6 text-center text-white">
        <p className="text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          Built with ❤️ for transparent, permissionless finance. 
          This is experimental software—trade at your own risk.
        </p>
      </footer>
    </div>
  );
}