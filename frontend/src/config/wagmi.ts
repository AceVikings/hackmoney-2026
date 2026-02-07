import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

// Arc Chain definition (custom L2)
// Using Sepolia as a stand-in during development
const arcChain = {
  ...sepolia,
  id: 11155111,
  name: 'Arc Testnet',
} as const;

export const config = getDefaultConfig({
  appName: 'ACN — Agent Commitment Network',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [arcChain],
  transports: {
    [arcChain.id]: http(),
  },
});
