import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '@/types';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  user: User | null;
  token: string | null;
  connect: (address: string, chainId: number) => void;
  disconnect: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      chainId: null,
      user: null,
      token: null,
      connect: (address, chainId) =>
        set({
          address,
          isConnected: true,
          chainId,
        }),
      disconnect: () =>
        set({
          address: null,
          isConnected: false,
          chainId: null,
          user: null,
          token: null,
        }),
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'wallet-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        address: state.address,
        isConnected: state.isConnected,
        chainId: state.chainId,
        user: state.user,
        token: state.token,
      }),
    }
  )
);

