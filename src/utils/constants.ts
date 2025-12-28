// 在开发环境中使用相对路径通过 Vite 代理，生产环境使用完整 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');

export const CHAIN_ID = {
  SEPOLIA: 11155111,
  MAINNET: 1,
};

export const PAYMENT_TOKENS = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

export const TOKEN_SYMBOLS: Record<string, string> = {
  [PAYMENT_TOKENS.ETH]: 'ETH',
  [PAYMENT_TOKENS.USDC]: 'USDC',
};

export const AUCTION_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
} as const;

