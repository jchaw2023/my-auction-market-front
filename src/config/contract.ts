// 配置状态
let configLoaded = false;
let configLoadPromise: Promise<void> | null = null;

// 合约地址配置（从 API 获取）
export let AUCTION_CONTRACT_ADDRESS: string | null = null;

// 链 ID（字符串格式）
export let CHAIN_ID: string | null = null;

// 链 ID（数字格式）
export let CHAIN_ID_NUMBER: number | null = null;

// RPC URL（从 API 获取）
export let RPC_URL: string | null = null;

// 网络配置类型
export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// 动态网络配置（从 API 获取）
export let CURRENT_NETWORK_CONFIG: NetworkConfig | null = null;

// 根据 chainId 和 rpcUrl 构建网络配置
function buildNetworkConfig(chainId: number, rpcUrl: string): NetworkConfig {
  const chainIdHex = `0x${chainId.toString(16)}`;
  
  // 根据 chainId 判断网络类型
  let chainName: string;
  let blockExplorerUrls: string[];
  
  if (chainId === 11155111) {
    // Sepolia testnet
    chainName = 'Sepolia';
    blockExplorerUrls = ['https://sepolia.etherscan.io'];
  } else if (chainId === 1) {
    // Ethereum Mainnet
    chainName = 'Ethereum Mainnet';
    blockExplorerUrls = ['https://etherscan.io'];
  } else if (chainId === 5) {
    // Goerli testnet
    chainName = 'Goerli';
    blockExplorerUrls = ['https://goerli.etherscan.io'];
  } else if (chainId === 137) {
    // Polygon Mainnet
    chainName = 'Polygon';
    blockExplorerUrls = ['https://polygonscan.com'];
  } else if (chainId === 80001) {
    // Mumbai testnet
    chainName = 'Mumbai';
    blockExplorerUrls = ['https://mumbai.polygonscan.com'];
  } else {
    // 未知网络，使用通用配置
    chainName = `Chain ${chainId}`;
    blockExplorerUrls = [];
  }
  
  return {
    chainId: chainIdHex,
    chainName,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [rpcUrl], // 使用 API 返回的 RPC URL
    blockExplorerUrls,
  };
}

// 从 API 更新配置的函数
export function updateConfigFromAPI(config: {
  rpcUrl: string;
  auctionContractAddress: string;
  chainId: number;
}) {
  RPC_URL = config.rpcUrl;
  AUCTION_CONTRACT_ADDRESS = config.auctionContractAddress;
  CHAIN_ID = config.chainId.toString();
  CHAIN_ID_NUMBER = config.chainId;
  
  // 更新网络配置
  CURRENT_NETWORK_CONFIG = buildNetworkConfig(config.chainId, config.rpcUrl);
}

// 检查配置是否已加载
export function isConfigLoaded(): boolean {
  return configLoaded && 
         AUCTION_CONTRACT_ADDRESS !== null && 
         CHAIN_ID_NUMBER !== null && 
         RPC_URL !== null;
}

// 获取当前网络配置（必须已从 API 加载）
export function getCurrentNetworkConfig(): NetworkConfig {
  if (!isConfigLoaded() || !CURRENT_NETWORK_CONFIG) {
    throw new Error('Configuration not loaded. Please call initConfigFromAPI() first.');
  }
  return CURRENT_NETWORK_CONFIG;
}

// 等待配置加载完成
export async function waitForConfig(): Promise<void> {
  if (configLoaded) {
    return;
  }
  
  if (configLoadPromise) {
    return configLoadPromise;
  }
  
  // 如果还没有开始加载，立即开始加载
  configLoadPromise = initConfigFromAPI();
  await configLoadPromise;
}

// 初始化配置（从 API 获取，必须成功）
export async function initConfigFromAPI(): Promise<void> {
  if (configLoaded) {
    return; // 已经加载过了
  }

  try {
    const { configApi } = await import('@/services/api');
    const response = await configApi.getEthereumConfig();
    
    if (!response.success || !response.data) {
      throw new Error('Failed to get Ethereum config from API: Invalid response');
    }

    const { rpcUrl, auctionContractAddress, chainId } = response.data;

    // 验证配置数据
    if (!rpcUrl || !auctionContractAddress || !chainId) {
      throw new Error('Invalid Ethereum config: Missing required fields');
    }

    // 更新配置
    updateConfigFromAPI({
      rpcUrl,
      auctionContractAddress,
      chainId,
    });

    configLoaded = true;
    
    console.log('Ethereum config loaded from API:', {
      rpcUrl: RPC_URL,
      auctionContractAddress: AUCTION_CONTRACT_ADDRESS,
      chainId: CHAIN_ID_NUMBER,
      networkConfig: CURRENT_NETWORK_CONFIG,
    });
  } catch (error) {
    configLoaded = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to load config from API:', errorMessage);
    throw new Error(`Failed to load Ethereum configuration from API: ${errorMessage}. Please ensure the backend is running and accessible.`);
  }
}

