import { Outlet } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Header from './components/Layout/Header';
import { initConfigFromAPI, isConfigLoaded } from './config/contract';
import { useWebSocketWithNotifications } from './hooks/useWebSocket';
import { useTokenStore } from './store/tokenStore';
import { auctionApi } from './services/api';
import './App.css';

const { Content, Footer } = Layout;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { setTokens, setLoading, isLoaded } = useTokenStore();

  // 初始化 WebSocket 连接（带通知功能）
  useWebSocketWithNotifications(true);

  // 应用启动时从 API 获取以太坊配置和支持的代币列表
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        // 并行加载配置和支持的代币列表
        const [configResult, tokensResult] = await Promise.allSettled([
          initConfigFromAPI(),
          (async () => {
            try {
              const response = await auctionApi.getSupportedTokens();
              if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
                setTokens(response.data);
                console.log('Token configuration loaded successfully:', response.data);
              } else {
                console.error('Failed to load token configuration: invalid response', response);
                throw new Error('Token configuration data is invalid');
              }
            } catch (error) {
              console.error('Failed to load token configuration:', error);
              throw error;
            }
          })(),
        ]);

        // 检查配置加载结果
        if (configResult.status === 'rejected') {
          throw configResult.reason;
        }

        // 检查 token 加载结果
        if (tokensResult.status === 'rejected') {
          console.error('Token configuration loading failed:', tokensResult.reason);
          throw new Error(`Failed to load token configuration: ${tokensResult.reason instanceof Error ? tokensResult.reason.message : String(tokensResult.reason)}`);
        }

        setConfigLoading(false);
        setConfigError(null);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setConfigLoading(false);
        setLoading(false);
        setConfigError(error instanceof Error ? error.message : 'Failed to load configuration');
      }
    };

    initApp();
  }, [setTokens, setLoading]);

  // 如果配置正在加载，显示加载状态
  if (configLoading || !isLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <Spin size="large" />
        <div>正在加载配置...</div>
      </div>
    );
  }

  // 如果配置加载失败，显示错误信息
  if (configError || !isConfigLoaded()) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <h2>配置加载失败</h2>
        <p style={{ color: '#ff4d4f' }}>
          {configError || '无法从后端获取配置'}
        </p>
        <p style={{ color: '#666', fontSize: '14px' }}>
          请确保后端服务正在运行，并且可以访问以下端点：
          <br />
          - /api/config/ethereum
          <br />
          - /api/auctions/supported-tokens
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            padding: '8px 16px', 
            cursor: 'pointer',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <Content className="app-content">
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', flexShrink: 0 }}>
          NFT Auction Market ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </QueryClientProvider>
  );
}

export default App;

