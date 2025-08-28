interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] | object }) => Promise<any>;
    isMetaMask?: boolean;
    selectedAddress?: string;
    networkVersion?: string;
  };
}