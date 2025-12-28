import { create } from 'zustand';

export interface SupportedToken {
  address: string;
  symbol: string;
  name: string;
  default: boolean;
}

interface TokenState {
  tokens: SupportedToken[];
  defaultToken: SupportedToken | null;
  isLoading: boolean;
  isLoaded: boolean;
  setTokens: (tokens: SupportedToken[]) => void;
  setLoading: (loading: boolean) => void;
  getTokenByAddress: (address: string) => SupportedToken | null;
  getTokenSymbol: (address: string) => string;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  tokens: [],
  defaultToken: null,
  isLoading: false,
  isLoaded: false,
  setTokens: (tokens) => {
    const defaultToken = tokens.find((t) => t.default) || tokens[0] || null;
    set({
      tokens,
      defaultToken,
      isLoaded: true,
    });
  },
  setLoading: (loading) => set({ isLoading: loading }),
  getTokenByAddress: (address) => {
    const { tokens } = get();
    return tokens.find((t) => t.address.toLowerCase() === address.toLowerCase()) || null;
  },
  getTokenSymbol: (address) => {
    const token = get().getTokenByAddress(address);
    return token?.symbol || 'ERC20';
  },
}));

