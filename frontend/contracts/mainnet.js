// Mainnet deployment contracts (placeholder)
// Chain ID: 1
// TODO: Deploy to mainnet and update addresses

export const MAINNET_CONTRACTS = {
  chainId: 1,
  name: "Mainnet",
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  contracts: {
    GDPMarket: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Deploy
      abi: [] // TODO: Copy ABI from deployed contract
    },
    USDC: {
      address: "0xA0b86a33E6441e54B9c8c604Dc395d6Af2dc0Ae8", // Real USDC on mainnet
      abi: [] // TODO: Standard USDC ABI
    },
    USGDPOracle: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Deploy
      abi: [] // TODO: Copy ABI from deployed contract
    },
    LongToken: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Deploy
      abi: [] // TODO: Copy ABI from deployed contract
    },
    ShortToken: {
      address: "0x0000000000000000000000000000000000000000", // TODO: Deploy  
      abi: [] // TODO: Copy ABI from deployed contract
    }
  }
};