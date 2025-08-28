import { useReadContract, useWriteContract, useAccount, useChainId } from 'wagmi';
import { SEPOLIA_DEPLOYMENTS } from '../../contracts/sepolia.js';
import { MAINNET_CONTRACTS } from '../../contracts/mainnet.js';
import * as LocalContracts from '../../contracts/local.js';

// Local anvil deployment structure
const LOCAL_CONTRACTS = {
  chainId: 31337,
  name: "Local",
  rpcUrl: "http://localhost:8546",
  contracts: {
    GDPMarket: {
      address: LocalContracts.GDPMarket.address,
      abi: LocalContracts.GDPMarket.abi,
    },
    MockUSDC: {
      address: LocalContracts.MockUSDC.address,
      abi: LocalContracts.MockUSDC.abi,
    },
    USGDPOracle: {
      address: LocalContracts.MockGDPOracle.address,
      abi: LocalContracts.MockGDPOracle.abi,
    },
    LongToken: {
      address: LocalContracts.LongToken.address,
      abi: LocalContracts.LongToken.abi,
    },
    ShortToken: {
      address: LocalContracts.ShortToken.address,
      abi: LocalContracts.ShortToken.abi,
    },
  },
};

// Get deployments based on chain ID
export function getDeploymentForChain(chainId: number) {
  if (chainId === 1) {
    return MAINNET_CONTRACTS;
  }
  if (chainId === 11155111) {
    return SEPOLIA_DEPLOYMENTS;
  }
  if (chainId === 31337) {
    return LOCAL_CONTRACTS;
  }
  // Default to Sepolia
  return SEPOLIA_DEPLOYMENTS;
}

export function useContractAddresses() {
  const chainId = useChainId();
  const deployment = getDeploymentForChain(chainId);
  
  return {
    gdpMarket: deployment.contracts.GDPMarket.address as `0x${string}`,
    mockUSDC: (deployment.contracts as any).MockUSDC?.address as `0x${string}` || (deployment.contracts as any).USDC?.address as `0x${string}`,
    oracle: deployment.contracts.USGDPOracle.address as `0x${string}`,
    longToken: deployment.contracts.LongToken.address as `0x${string}`,
    shortToken: deployment.contracts.ShortToken.address as `0x${string}`,
  };
}

export function useContractAbis() {
  const chainId = useChainId();
  const deployment = getDeploymentForChain(chainId);
  
  return {
    gdpMarket: deployment.contracts.GDPMarket.abi,
    mockUSDC: (deployment.contracts as any).MockUSDC?.abi || (deployment.contracts as any).USDC?.abi,
    oracle: deployment.contracts.USGDPOracle.abi,
    longToken: deployment.contracts.LongToken.abi,
    shortToken: deployment.contracts.ShortToken.abi,
  };
}

// Hook for reading contract data
export function useMarketState() {
  const addresses = useContractAddresses();
  const abis = useContractAbis();
  
  const { data: phase } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'getCurrentPhase',
  });
  
  const { data: closeAt } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'closeAt',
  });
  
  const { data: longTokenAddress } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'longToken',
  });
  
  const { data: shortTokenAddress } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'shortToken',
  });
  
  const { data: mintFeeBps } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'mintFeeBps',
  });
  
  const { data: pairRedeemFeeBps } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'pairRedeemFeeBps',
  });
  
  const { data: vaultBalance } = useReadContract({
    address: addresses.mockUSDC,
    abi: abis.mockUSDC,
    functionName: 'balanceOf',
    args: [addresses.gdpMarket],
  });
  
  const { data: gPpm } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'gPpm',
  });
  
  const { data: longPot } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'longPot',
  });
  
  const { data: shortPot } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'shortPot',
  });
  
  const { data: longRedeemNumerator } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'longRedeemNumerator',
  });
  
  const { data: longRedeemDenominator } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'longRedeemDenominator',
  });
  
  const { data: shortRedeemNumerator } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'shortRedeemNumerator',
  });
  
  const { data: shortRedeemDenominator } = useReadContract({
    address: addresses.gdpMarket,
    abi: abis.gdpMarket,
    functionName: 'shortRedeemDenominator',
  });
  
  return {
    phase: phase as number | undefined,
    closeAt: closeAt as bigint | undefined,
    longTokenAddress: longTokenAddress as `0x${string}` | undefined,
    shortTokenAddress: shortTokenAddress as `0x${string}` | undefined,
    mintFeeBps: mintFeeBps as bigint | undefined,
    pairRedeemFeeBps: pairRedeemFeeBps as bigint | undefined,
    vaultBalance: vaultBalance as bigint | undefined,
    gPpm: gPpm as bigint | undefined,
    longPot: longPot as bigint | undefined,
    shortPot: shortPot as bigint | undefined,
    longRedeemNumerator: longRedeemNumerator as bigint | undefined,
    longRedeemDenominator: longRedeemDenominator as bigint | undefined,
    shortRedeemNumerator: shortRedeemNumerator as bigint | undefined,
    shortRedeemDenominator: shortRedeemDenominator as bigint | undefined,
  };
}

// Hook for user balances
export function useUserBalances() {
  const { address } = useAccount();
  const addresses = useContractAddresses();
  const abis = useContractAbis();
  
  const { data: usdcBalance } = useReadContract({
    address: addresses.mockUSDC,
    abi: abis.mockUSDC,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });
  
  const { data: longBalance } = useReadContract({
    address: addresses.longToken,
    abi: abis.longToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });
  
  const { data: shortBalance } = useReadContract({
    address: addresses.shortToken,
    abi: abis.shortToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });
  
  return {
    usdcBalance: usdcBalance as bigint | undefined,
    longBalance: longBalance as bigint | undefined,
    shortBalance: shortBalance as bigint | undefined,
  };
}

// Hook for oracle state
export function useOracleState() {
  const addresses = useContractAddresses();
  const abis = useContractAbis();
  
  const { data: oracleData } = useReadContract({
    address: addresses.oracle,
    abi: abis.oracle,
    functionName: 'readDelta',
  });
  
  return {
    gPpm: (oracleData as any)?.[0] as bigint | undefined,
    finalized: (oracleData as any)?.[1] as boolean | undefined,
  };
}

// Hook for contract writes
export function useContractWrites() {
  const { writeContract } = useWriteContract();
  const addresses = useContractAddresses();
  const abis = useContractAbis();
  
  const approveUSDC = (amount: bigint) => {
    writeContract({
      address: addresses.mockUSDC,
      abi: abis.mockUSDC,
      functionName: 'approve',
      args: [addresses.gdpMarket, amount],
    });
  };
  
  const mint = (isLong: boolean, amount: bigint) => {
    writeContract({
      address: addresses.gdpMarket,
      abi: abis.gdpMarket,
      functionName: 'mint',
      args: [isLong, amount],
    });
  };
  
  const pairRedeem = (amount: bigint) => {
    writeContract({
      address: addresses.gdpMarket,
      abi: abis.gdpMarket,
      functionName: 'pairRedeem',
      args: [amount],
    });
  };
  
  const redeemLong = (amount: bigint) => {
    writeContract({
      address: addresses.gdpMarket,
      abi: abis.gdpMarket,
      functionName: 'redeemLong',
      args: [amount],
    });
  };
  
  const redeemShort = (amount: bigint) => {
    writeContract({
      address: addresses.gdpMarket,
      abi: abis.gdpMarket,
      functionName: 'redeemShort',
      args: [amount],
    });
  };
  
  return {
    approveUSDC,
    mint,
    pairRedeem,
    redeemLong,
    redeemShort,
  };
}

// Legacy compatibility exports (keeping for now to minimize page.tsx changes)
export function useContracts() {
  const contractWrites = useContractWrites();
  return contractWrites;
}

export function useReadOnlyContracts() {
  const marketState = useMarketState();
  const userBalances = useUserBalances();
  const oracleState = useOracleState();
  
  return {
    marketState,
    userBalances,
    oracleState,
  };
}