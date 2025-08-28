'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { publicProvider } from 'wagmi/providers/public';

const localChain = {
  id: 31337,
  name: 'Local Anvil',
  network: 'local',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['http://localhost:8546'] },
    default: { http: ['http://localhost:8546'] },
  },
  testnet: true,
  contracts: {
    ensRegistry: undefined, // Disable ENS for local chain
  },
};

const { chains, publicClient } = configureChains(
  [mainnet, sepolia, localChain],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === 31337) {
          return { http: 'http://localhost:8546' };
        }
        return null;
      },
    }),
    publicProvider()
  ]
);

const { connectors } = getDefaultWallets({
  appName: 'USGDP.Q3.2025',
  projectId: 'b85b3c5f4f6c4a9eb9c3d7f8e2a1b6c5', // Demo project ID for local development
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider 
        chains={chains}
        showRecentTransactions={false}
        appInfo={{
          appName: 'USGDP.Q3.2025',
          learnMoreUrl: 'https://github.com/your-repo/gdpcoin',
          disclaimer: undefined, // Disable ENS avatar fetching
        }}
        theme={lightTheme({
          accentColor: '#0E76FD',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          fontStack: 'system',
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}