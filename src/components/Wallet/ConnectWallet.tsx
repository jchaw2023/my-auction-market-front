import { Button } from 'antd';
import { WalletOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { authApi } from '@/services/api';
import { 
  ensureCorrectNetwork, 
  getCurrentChainId,
  getNetworkName,
  CHAIN_ID_NUMBER
} from '@/services/contract';
import { waitForConfig, isConfigLoaded } from '@/config/contract';

export default function ConnectWallet() {
  const { t } = useTranslation();
  const { connect, setUser, setToken, chainId } = useWalletStore();
  const [isConnecting, setIsConnecting] = useState(false);

  // 监听网络切换
  useEffect(() => {
    const handleChainChanged = () => {
      // 网络切换时刷新页面或更新状态
      window.location.reload();
    };

    const ethereum = (window as any).ethereum;
    if (ethereum) {
      ethereum.on('chainChanged', handleChainChanged);
      return () => {
        ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // 处理网络切换
  const handleSwitchNetwork = async () => {
    try {
      setIsConnecting(true);
      const success = await ensureCorrectNetwork();
      if (!success) {
        alert('网络切换失败，请手动在钱包中切换网络');
      }
      // 网络切换成功后会触发 chainChanged 事件，页面会自动刷新
    } catch (error: any) {
      console.error('Network switch error:', error);
      alert(`网络切换失败: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    const ethereum = (window as any).ethereum;
    
    if (!ethereum) {
      alert(t('wallet.pleaseInstallMetaMask') || '请安装 MetaMask 钱包');
      return;
    }

    try {
      setIsConnecting(true);

      // 0. 确保配置已加载
      if (!isConfigLoaded()) {
        await waitForConfig();
      }

      // 1. 确保网络正确
      const isCorrectNetwork = await ensureCorrectNetwork();
      if (!isCorrectNetwork) {
        const currentChainId = await getCurrentChainId();
        const currentNetwork = getNetworkName(currentChainId || undefined);
        const targetNetwork = getNetworkName();
        
        if (CHAIN_ID_NUMBER === null) {
          throw new Error('Chain ID not loaded');
        }
        
        const shouldContinue = confirm(
          `当前网络: ${currentNetwork} (Chain ID: ${currentChainId})\n` +
          `需要切换到: ${targetNetwork} (Chain ID: ${CHAIN_ID_NUMBER})\n\n` +
          `是否切换到正确的网络？`
        );
        
        if (!shouldContinue) {
          setIsConnecting(false);
          return;
        }
        
        // 再次尝试切换
        const switched = await ensureCorrectNetwork();
        if (!switched) {
          alert('网络切换失败，请手动在钱包中切换网络');
          setIsConnecting(false);
          return;
        }
      }

      // 2. 请求连接钱包
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      const walletAddress = accounts[0].toLowerCase();
      const chainId = parseInt(await ethereum.request({ method: 'eth_chainId' }), 16);

      // 3. 验证网络
      if (CHAIN_ID_NUMBER === null || chainId !== CHAIN_ID_NUMBER) {
        alert(`请切换到正确的网络 (Chain ID: ${CHAIN_ID_NUMBER})`);
        setIsConnecting(false);
        return;
      }

      // 4. 请求 nonce
      const nonceResponse = await authApi.requestNonce(walletAddress);
      const { message } = nonceResponse.data;

      // 5. 签名消息
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });

      // 6. 验证并登录
      const loginResponse = await authApi.verify({
        walletAddress,
        message,
        signature,
      });

      // 7. 保存状态
      connect(walletAddress, chainId);
      setUser(loginResponse.data.user);
      setToken(loginResponse.data.token);
      localStorage.setItem('authToken', loginResponse.data.token);
      // 触发 token 更新事件，通知 WebSocket 服务更新 token
      window.dispatchEvent(new Event('tokenUpdated'));
    } catch (error: any) {
      if (error.code === 4001) {
        // 用户拒绝了钱包连接请求
        console.log(t('wallet.connectionRejected') || '用户拒绝了连接请求');
        return;
      }
      
      // 记录详细错误信息
      console.error('Wallet connection error:', {
        error,
        message: error.message,
        response: error.response?.data,
        request: error.request,
      });
      
      // 显示用户友好的错误信息
      let errorMessage = error.message || t('wallet.connectionFailed') || '钱包连接失败';
      
      // 如果是网络错误，提供更具体的提示
      if (error.message?.includes('Network Error') || error.message?.includes('无法连接到后端服务器')) {
        errorMessage = `${t('wallet.connectionFailed') || '钱包连接失败'}\n\n${error.message}\n\n请检查：\n1. 后端服务是否正在运行\n2. API 地址是否正确配置\n3. 网络连接是否正常`;
      }
      
      alert(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  // 如果已连接但网络不正确，显示切换网络按钮
  if (chainId && CHAIN_ID_NUMBER !== null && chainId !== CHAIN_ID_NUMBER) {
    return (
      <Button
        type="default"
        danger
        icon={<WalletOutlined />}
        onClick={handleSwitchNetwork}
        loading={isConnecting}
      >
        切换到 {getNetworkName()} 网络
      </Button>
    );
  }

  return (
    <Button
      type="primary"
      icon={<WalletOutlined />}
      onClick={handleConnect}
      loading={isConnecting}
    >
      {t('wallet.connect') || '连接钱包'}
    </Button>
  );
}

