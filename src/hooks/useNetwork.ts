import { useEffect, useState } from 'react';
import { checkNetwork, getCurrentChainId, getNetworkName, CHAIN_ID_NUMBER, switchToContractNetwork } from '@/services/contract';

interface NetworkState {
  isCorrect: boolean;
  currentChainId: number | null;
  targetChainId: number;
  currentNetworkName: string;
  targetNetworkName: string;
  isLoading: boolean;
}

/**
 * Hook 用于监听和管理网络状态
 */
export function useNetwork() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isCorrect: false,
    currentChainId: null,
    targetChainId: CHAIN_ID_NUMBER,
    currentNetworkName: 'Unknown',
    targetNetworkName: getNetworkName(),
    isLoading: true,
  });

  const checkNetworkStatus = async () => {
    try {
      const currentChainId = await getCurrentChainId();
      const isCorrect = await checkNetwork();
      
      setNetworkState({
        isCorrect,
        currentChainId,
        targetChainId: CHAIN_ID_NUMBER,
        currentNetworkName: getNetworkName(currentChainId || undefined),
        targetNetworkName: getNetworkName(),
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to check network:', error);
      setNetworkState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const switchNetwork = async () => {
    try {
      setNetworkState(prev => ({ ...prev, isLoading: true }));
      await switchToContractNetwork();
      // 等待网络切换完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      await checkNetworkStatus();
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      setNetworkState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  useEffect(() => {
    checkNetworkStatus();

    // 监听网络切换事件
    const ethereum = (window as any).ethereum;
    if (ethereum) {
      const handleChainChanged = () => {
        checkNetworkStatus();
      };

      ethereum.on('chainChanged', handleChainChanged);
      return () => {
        ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  return {
    ...networkState,
    checkNetworkStatus,
    switchNetwork,
  };
}

