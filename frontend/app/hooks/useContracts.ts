import { ethers } from 'ethers';
import { useMemo } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { CONTRACTS, ADDRESSES } from '../../contracts.js';

// Convert wagmi client to ethers provider/signer
function publicClientToProvider(publicClient: any) {
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    // Only set ENS address for mainnet and known testnets
    ensAddress: chain.id === 1 ? chain.contracts?.ensRegistry?.address : undefined,
  };
  
  if (transport.type === 'http') {
    return new ethers.providers.JsonRpcProvider(transport.url, network);
  }
  
  return new ethers.providers.Web3Provider(transport, network);
}

function walletClientToSigner(walletClient: any) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    // Only set ENS address for mainnet and known testnets
    ensAddress: chain.id === 1 ? chain.contracts?.ensRegistry?.address : undefined,
  };
  
  const provider = new ethers.providers.Web3Provider(transport, network);
  return provider.getSigner(account.address);
}

export function useContracts() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!publicClient) return null;
    
    const provider = publicClientToProvider(publicClient);
    const signerOrProvider = walletClient ? walletClientToSigner(walletClient) : provider;

    return {
      gdpMarket: new ethers.Contract(ADDRESSES.GDPMarket, CONTRACTS.GDPMarket.abi, signerOrProvider),
      mockUSDC: new ethers.Contract(ADDRESSES.MockUSDC, CONTRACTS.MockUSDC.abi, signerOrProvider),
      mockGDPOracle: new ethers.Contract(ADDRESSES.MockGDPOracle, CONTRACTS.MockGDPOracle.abi, signerOrProvider),
    };
  }, [publicClient, walletClient]);
}

export function useReadOnlyContracts() {
  const publicClient = usePublicClient();

  return useMemo(() => {
    if (!publicClient) return null;
    
    const provider = publicClientToProvider(publicClient);

    return {
      gdpMarket: new ethers.Contract(ADDRESSES.GDPMarket, CONTRACTS.GDPMarket.abi, provider),
      mockUSDC: new ethers.Contract(ADDRESSES.MockUSDC, CONTRACTS.MockUSDC.abi, provider),
      mockGDPOracle: new ethers.Contract(ADDRESSES.MockGDPOracle, CONTRACTS.MockGDPOracle.abi, provider),
    };
  }, [publicClient]);
}