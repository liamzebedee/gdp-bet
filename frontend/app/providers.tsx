'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Define local chain for Anvil
const localChain = {
  id: 31337,
  name: 'Local Anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8546'],
    },
  },
  testnet: true,
} as const;

// Define chains
const chains = [mainnet, sepolia, localChain] as const;

// Get wallets
const { connectors } = getDefaultWallets({
  appName: 'USGDP.Q3.2025',
  projectId: 'b85b3c5f4f6c4a9eb9c3d7f8e2a1b6c5', // Demo project ID
});

// Create wagmi config
const config = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http('https://eth-mainnet.g.alchemy.com/v2/HXJKahkFFDDvPADHRfw5R'),
    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/HXJKahkFFDDvPADHRfw5R'),
    [localChain.id]: http('http://localhost:8546'),
  },
  ssr: true,
});

// Create query client
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          showRecentTransactions={false}
          appInfo={{
            appName: 'USGDP.Q3.2025',
            learnMoreUrl: 'https://github.com/your-repo/gdpcoin',
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
      </QueryClientProvider>
    </WagmiProvider>
  );
}