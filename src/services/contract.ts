import { ethers } from 'ethers';
import { 
  AUCTION_CONTRACT_ADDRESS, 
  CHAIN_ID, 
  CHAIN_ID_NUMBER, 
  getCurrentNetworkConfig,
  isConfigLoaded,
  waitForConfig
} from '@/config/contract';
import AUCTION_ABI from '@/abis/MyXAuctionV2.json';

// 重新导出 CHAIN_ID_NUMBER 和 CHAIN_ID 供其他模块使用（可能为 null，使用时需要检查）
export { CHAIN_ID_NUMBER, CHAIN_ID };

// ERC721 ABI（用于 NFT 授权）
const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function setApprovalForAll(address operator, bool approved) external',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
];

// ERC20 ABI（用于代币授权）
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

/**
 * 获取以太坊提供者（从 MetaMask 等钱包）
 */
export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
}

/**
 * 获取钱包实例（用于直接调用钱包方法）
 */
function getEthereum(): any {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

/**
 * 获取当前网络 Chain ID
 */
export async function getCurrentChainId(): Promise<number | null> {
  const ethereum = getEthereum();
  if (!ethereum) {
    return null;
  }

  try {
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainId, 16);
  } catch (error) {
    console.error('Failed to get chain ID:', error);
    return null;
  }
}

/**
 * 检查当前网络是否正确
 */
export async function checkNetwork(): Promise<boolean> {
  if (!isConfigLoaded() || CHAIN_ID_NUMBER === null) {
    await waitForConfig();
  }
  const currentChainId = await getCurrentChainId();
  return currentChainId === CHAIN_ID_NUMBER;
}

/**
 * 添加网络到钱包
 */
export async function addNetwork(): Promise<void> {
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('No wallet found. Please install MetaMask.');
  }

  const networkConfig = getCurrentNetworkConfig();
  if (CHAIN_ID_NUMBER === null) {
    throw new Error('Chain ID not loaded');
  }
  const chainIdHex = `0x${CHAIN_ID_NUMBER.toString(16)}`;

  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: networkConfig.chainName,
          nativeCurrency: networkConfig.nativeCurrency,
          rpcUrls: networkConfig.rpcUrls,
          blockExplorerUrls: networkConfig.blockExplorerUrls,
        },
      ],
    });
  } catch (error: any) {
    if (error.code === 4902) {
      // 网络已存在，忽略
      console.log('Network already exists');
    } else {
      throw new Error(`Failed to add network: ${error.message}`);
    }
  }
}

/**
 * 切换到指定网络
 */
export async function switchToNetwork(chainId: number): Promise<void> {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('No wallet found. Please install MetaMask.');
  }

  const chainIdHex = `0x${chainId.toString(16)}`;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    // 如果网络不存在（错误码 4902），尝试添加网络
    if (error.code === 4902) {
      await addNetwork();
      // 添加后再次尝试切换
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } else {
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

/**
 * 切换到合约要求的网络
 */
export async function switchToContractNetwork(): Promise<void> {
  if (!isConfigLoaded() || CHAIN_ID_NUMBER === null) {
    await waitForConfig();
  }
  
  if (CHAIN_ID_NUMBER === null) {
    throw new Error('Chain ID not loaded');
  }
  
  return switchToNetwork(CHAIN_ID_NUMBER);
}

/**
 * 确保网络正确，如果不正确则尝试切换
 */
export async function ensureCorrectNetwork(): Promise<boolean> {
  const isCorrect = await checkNetwork();
  if (isCorrect) {
    return true;
  }

  try {
    await switchToContractNetwork();
    // 等待一下让网络切换完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 再次检查
    return await checkNetwork();
  } catch (error: any) {
    console.error('Failed to switch network:', error);
    return false;
  }
}

/**
 * 获取网络名称
 */
export function getNetworkName(chainId?: number): string {
  const id = chainId || CHAIN_ID_NUMBER;
  if (id === null) {
    return 'Unknown Network';
  }
  if (id === 11155111) {
    return 'Sepolia';
  } else if (id === 1) {
    return 'Ethereum Mainnet';
  }
  return `Chain ${id}`;
}

/**
 * 获取签名者（用于发送交易）
 */
export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No provider found. Please connect your wallet.');
  }
  return await provider.getSigner();
}

/**
 * 获取拍卖合约实例（会自动检查网络）
 */
export async function getAuctionContract(): Promise<ethers.Contract | null> {
  // 确保配置已加载
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  if (AUCTION_CONTRACT_ADDRESS === null) {
    throw new Error('Auction contract address not loaded');
  }

  // 确保网络正确（会自动尝试切换）
  const isCorrectNetwork = await ensureCorrectNetwork();
  if (!isCorrectNetwork) {
    const currentChainId = await getCurrentChainId();
    const networkName = getNetworkName();
    const currentNetworkName = getNetworkName(currentChainId || undefined);
    
    throw new Error(
      `网络不匹配！当前网络: ${currentNetworkName} (Chain ID: ${currentChainId})，` +
      `需要网络: ${networkName} (Chain ID: ${CHAIN_ID})。` +
      `请手动在钱包中切换到正确的网络。`
    );
  }

  const signer = await getSigner();
  if (!signer) {
    return null;
  }
  return new ethers.Contract(AUCTION_CONTRACT_ADDRESS, AUCTION_ABI, signer);
}

/**
 * 获取只读的拍卖合约实例（不需要签名，不检查网络）
 */
export async function getAuctionContractReadOnly(): Promise<ethers.Contract | null> {
  // 确保配置已加载
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  if (AUCTION_CONTRACT_ADDRESS === null) {
    throw new Error('Auction contract address not loaded');
  }

  const provider = getProvider();
  if (!provider) {
    return null;
  }
  return new ethers.Contract(AUCTION_CONTRACT_ADDRESS, AUCTION_ABI, provider);
}

/**
 * 获取 ERC721 合约实例
 */
export async function getERC721Contract(nftAddress: string): Promise<ethers.Contract | null> {
  const signer = await getSigner();
  if (!signer) {
    return null;
  }
  return new ethers.Contract(nftAddress, ERC721_ABI, signer);
}

/**
 * 获取 ERC20 合约实例
 */
export async function getERC20Contract(tokenAddress: string): Promise<ethers.Contract | null> {
  const signer = await getSigner();
  if (!signer) {
    return null;
  }
  return new ethers.Contract(tokenAddress, ERC20_ABI, signer);
}

/**
 * 检查 NFT 是否已授权给拍卖合约
 */
export async function isNFTApproved(nftAddress: string, tokenId: number): Promise<boolean> {
  if (!isConfigLoaded() || AUCTION_CONTRACT_ADDRESS === null) {
    await waitForConfig();
  }

  if (AUCTION_CONTRACT_ADDRESS === null) {
    throw new Error('Auction contract address not loaded');
  }

  const contract = await getERC721Contract(nftAddress);
  if (!contract) {
    throw new Error('Failed to get NFT contract');
  }

  const approved = await contract.getApproved(tokenId);
  return approved.toLowerCase() === AUCTION_CONTRACT_ADDRESS.toLowerCase();
}

/**
 * 授权 NFT 给拍卖合约
 */
export async function approveNFT(
  nftAddress: string,
  tokenId: number
): Promise<ethers.ContractTransactionResponse> {
  // 1. 确保配置已加载
  if (!isConfigLoaded() || AUCTION_CONTRACT_ADDRESS === null) {
    await waitForConfig();
  }

  if (AUCTION_CONTRACT_ADDRESS === null) {
    throw new Error('Auction contract address not loaded');
  }

  // 2. 检查合约是否暂停（只读操作，不需要 NFT 合约）
  const isPaused = await isContractPaused();
  if (isPaused) {
    throw new Error('合约当前被暂停，无法执行操作');
  }

  // 3. 获取NFT合约实例（只获取一次，后续所有操作都使用这个实例）
  const nftContract = await getERC721Contract(nftAddress);
  if (!nftContract) {
    throw new Error('Failed to get NFT contract');
  }

  // 4. 检查是否已经授权（使用已获取的合约实例）
  const approved = await nftContract.getApproved(tokenId);
  if (approved.toLowerCase() === AUCTION_CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error('NFT already approved');
  }

  // 5. 检查用户是否拥有NFT（使用已获取的合约实例）
  try {
    const owner = await nftContract.ownerOf(tokenId);
    const signer = await getSigner();
    if (!signer) {
      throw new Error('No signer available');
    }
    const currentAddress = await signer.getAddress();
    if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
      throw new Error('您不拥有此NFT，无法授权');
    }
  } catch (error: any) {
    // 如果错误消息已经是我们自定义的，直接抛出
    if (error.message && error.message.includes('不拥有')) {
      throw error;
    }
    // 如果 ownerOf 调用失败，可能是 NFT 不存在或地址无效
    if (error.message && error.message.includes('owner query for nonexistent token')) {
      throw new Error('NFT不存在或tokenId无效');
    }
    throw new Error(`无法验证NFT所有权: ${error.message || '未知错误'}`);
  }

  // 6. 发送授权交易（使用已获取的合约实例）
  const tx = await nftContract.approve(AUCTION_CONTRACT_ADDRESS, tokenId);
  return tx;
}

/**
 * 检查合约是否被暂停
 */
export async function isContractPaused(): Promise<boolean> {
  try {
    // 使用只读合约实例，不需要签名和网络检查
    const contract = await getAuctionContractReadOnly();
    if (!contract) {
      return false; // 如果无法获取合约，假设未暂停
    }
    return await contract.paused();
  } catch (error) {
    console.warn('Failed to check contract paused status:', error);
    return false; // 如果检查失败，假设未暂停
  }
}

/**
 * 检查用户是否拥有指定的NFT
 */
export async function checkNFTOwnership(
  nftAddress: string,
  tokenId: number,
  ownerAddress?: string
): Promise<boolean> {
  try {
    const contract = await getERC721Contract(nftAddress);
    if (!contract) {
      throw new Error('Failed to get NFT contract');
    }

    const owner = await contract.ownerOf(tokenId);
    
    if (ownerAddress) {
      return owner.toLowerCase() === ownerAddress.toLowerCase();
    } else {
      // 如果没有提供地址，检查当前连接的地址
      const signer = await getSigner();
      if (!signer) {
        throw new Error('No signer available');
      }
      const currentAddress = await signer.getAddress();
      return owner.toLowerCase() === currentAddress.toLowerCase();
    }
  } catch (error: any) {
    console.error('Failed to check NFT ownership:', error);
    // 如果 ownerOf 调用失败，可能是 NFT 不存在或地址无效
    if (error.message && error.message.includes('owner query for nonexistent token')) {
      throw new Error('NFT不存在或tokenId无效');
    }
    throw new Error(`无法验证NFT所有权: ${error.message || '未知错误'}`);
  }
}

/**
 * 创建拍卖（在链上）
 * 注意：合约的 createAuction 方法不包含 paymentToken 参数，只使用 ETH
 */
export async function createAuctionOnChain(
  nftAddress: string,
  tokenId: number,
  startPriceUnitUSD: number, // 以 USD 为单位x8因为chainlink价格是8位小数
  startTime: number, // Unix 时间戳（秒）
  endTime: number // Unix 时间戳（秒）
): Promise<ethers.ContractTransactionResponse> {
  // 确保配置已加载（getAuctionContract 内部会检查）
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const contract = await getAuctionContract();
  if (!contract) {
    throw new Error('Failed to get auction contract');
  }
  // 调用合约方法
  const tx = await contract.createAuction(nftAddress, tokenId, startPriceUnitUSD, startTime, endTime);
  await tx.wait();
  return tx;
}

/**
 * 出价
 */
export async function placeBid(
  auctionId: number,
  paymentToken: string,
  amount: number // ETH 或代币数量（数字格式，如 0.1）
): Promise<ethers.ContractTransactionResponse> {
  // 确保配置已加载（getAuctionContract 内部会检查）
  if (!isConfigLoaded() || AUCTION_CONTRACT_ADDRESS === null) {
    await waitForConfig();
  }

  if (AUCTION_CONTRACT_ADDRESS === null) {
    throw new Error('Auction contract address not loaded');
  }

  const contract = await getAuctionContract();
  if (!contract) {
    throw new Error('Failed to get auction contract');
  }

  // 使用 ethers.ZeroAddress 来判断是否为 ETH（不硬编码地址）
  const paymentTokenAddress = !paymentToken || paymentToken === ethers.ZeroAddress
    ? ethers.ZeroAddress
    : paymentToken;

  // 将数字转换为字符串，因为 parseEther 和 parseUnits 需要字符串参数
  // 使用 toFixed(18) 确保精度，避免 JavaScript 浮点数精度问题
  // 18 是 ETH 的最大小数位数
  const amountString = amount.toFixed(18);
  // 转换金额
  let amountWei: bigint;
  if (paymentTokenAddress === ethers.ZeroAddress) {
    // ETH
    amountWei = ethers.parseEther(amountString);
  } else {
    // ERC20 代币
    const erc20Contract = await getERC20Contract(paymentTokenAddress);
    if (!erc20Contract) {
      throw new Error('Failed to get ERC20 contract');
    }
    const decimals = await erc20Contract.decimals();
    amountWei = ethers.parseUnits(amountString, decimals);
  }

  // 如果是 ERC20，需要先授权
  if (paymentTokenAddress !== ethers.ZeroAddress) {
    const signer = await getSigner();
    if (!signer) {
      throw new Error('No signer found');
    }
    const userAddress = await signer.getAddress();

    const erc20Contract = await getERC20Contract(paymentTokenAddress);
    if (!erc20Contract) {
      throw new Error('Failed to get ERC20 contract');
    }

    // 检查授权额度
    if (AUCTION_CONTRACT_ADDRESS === null) {
      throw new Error('Auction contract address not loaded');
    }
    const allowance = await erc20Contract.allowance(userAddress, AUCTION_CONTRACT_ADDRESS);
    if (allowance < amountWei) {
      // 需要授权（授权一个较大的值，避免频繁授权）
      const maxApproval = ethers.MaxUint256;
      const approveTx = await erc20Contract.approve(AUCTION_CONTRACT_ADDRESS, maxApproval);
      await approveTx.wait(); // 等待授权交易确认
    }
  }

  // 发送出价交易
  // 合约方法签名: bid(uint256 _auctionId, uint256 _amount, address _token)
  // 如果是 ETH，需要发送 value；如果是 ERC20，不设置 value（默认为 0）
  // 在 ethers.js v6 中，value 必须直接是 bigint 类型，不能是数字
  // 确保所有参数都是正确的类型，避免类型转换导致的溢出
  let tx: ethers.ContractTransactionResponse;
  
  // 确保 auctionId 是 number（合约期望 uint256，但 ethers.js 会自动转换）
  const auctionIdBigInt = BigInt(auctionId);
  
  if (paymentTokenAddress === ethers.ZeroAddress) {
    // ETH 出价：需要发送 value
    // amountWei 已经是 bigint 类型（parseEther 返回 bigint）
    // 使用 ethers.toBigInt 确保类型正确，避免任何可能的类型转换问题
    const amountWeiString = amountWei.toString();
    const amountWeiBigInt = ethers.toBigInt(amountWeiString);
    console.log('amountWeiBigInt', amountWeiBigInt);
    console.log('paymentTokenAddress', paymentTokenAddress);
    console.log('auctionIdBigInt', auctionIdBigInt);
    console.log('amountWei', amountWei);
    
    tx = await contract.bid(auctionIdBigInt, amountWeiBigInt, paymentTokenAddress, {
      value: amountWeiBigInt, // 确保是 bigint 类型
    });
  } else {
    // ERC20 出价：不设置 value，默认为 0
    const amountWeiString = amountWei.toString();
    const amountWeiBigInt = ethers.toBigInt(amountWeiString);
    tx = await contract.bid(auctionIdBigInt, amountWeiBigInt, paymentTokenAddress);
  }
  
  return tx;
}

/**
 * 结束拍卖
 */
export async function endAuction(auctionId: number): Promise<ethers.ContractTransactionResponse> {
  // 确保配置已加载（getAuctionContract 内部会检查）
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const contract = await getAuctionContract();
  if (!contract) {
    throw new Error('Failed to get auction contract');
  }

  const tx = await contract.endAuctionAndClaimNFT(auctionId);
  return tx;
}

/**
 * 取消拍卖（管理员或合约调用）
 */
export async function cancelAuction(auctionId: number): Promise<ethers.ContractTransactionResponse> {
  // 确保配置已加载（getAuctionContract 内部会检查）
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const contract = await getAuctionContract();
  if (!contract) {
    throw new Error('Failed to get auction contract');
  }

  const tx = await contract.cancelAuction(auctionId);
  return tx;
}

/**
 * 用户取消自己的拍卖
 */
export async function cancelUserAuction(auctionId: number): Promise<ethers.ContractTransactionResponse> {
  // 确保配置已加载（getAuctionContract 内部会检查）
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const contract = await getAuctionContract();
  if (!contract) {
    throw new Error('Failed to get auction contract');
  }

  const tx = await contract.cancelUserAuction(auctionId);
  return tx;
}

/**
 * 获取拍卖信息（只读）
 */
export async function getAuction(auctionId: number): Promise<any> {
  // 确保配置已加载
  if (!isConfigLoaded()) {
    await waitForConfig();
  }

  const contract = await getAuctionContractReadOnly();
  if (!contract) {
    throw new Error('No provider found');
  }

  const auction = await contract.getAuction(auctionId);

  return {
    nftAddress: auction.nftAddress,
    tokenId: auction.tokenId.toString(),
    seller: auction.seller,
    highestBidder: auction.highestBidder,
    highestBidToken: auction.highestBidToken,
    highestBid: auction.highestBid.toString(),
    highestBidValue: auction.highestBidValue.toString(),
    startPrice: auction.startPrice.toString(),
    startTime: auction.startTime.toString(),
    endTime: auction.endTime.toString(),
    ended: auction.ended,
    cancelled: auction.cancelled,
    bidCount: auction.bidCount.toString(),
  };
}

/**
 * 等待交易确认
 */
export async function waitForTransaction(
  tx: ethers.ContractTransactionResponse
): Promise<ethers.ContractTransactionReceipt | null> {
  return await tx.wait();
}

/**
 * 获取交易哈希
 */
export function getTransactionHash(tx: ethers.ContractTransactionResponse): string {
  return tx.hash;
}

/**
 * 格式化错误消息
 */
export function formatContractError(error: any): string {
  // 处理用户拒绝
  if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
    return '用户拒绝了交易';
  }
  
  // 处理余额不足
  if (error.code === 'INSUFFICIENT_FUNDS' || error.code === -32603) {
    return '余额不足';
  }
  
  // 处理 CALL_EXCEPTION (包括 missing revert data)
  if (error.code === 'CALL_EXCEPTION' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    // 如果有 reason，直接返回
    if (error.reason) {
      return error.reason;
    }
    
    // 检查是否是 missing revert data
    if (error.message && error.message.includes('missing revert data')) {
      // 尝试从 transaction 数据中推断可能的原因
      if (error.transaction) {
        const data = error.transaction.data;
        // 检查是否是 approveNFT 调用
        if (data && data.startsWith('0x9600dd83')) {
          return '授权失败：可能是合约被暂停、您不拥有此NFT，或NFT合约地址无效';
        }
      }
      return '交易执行失败（无法获取详细错误信息）。可能的原因：合约被暂停、权限不足、参数无效或网络问题';
    }
    
    // 尝试从消息中提取有用的信息
    if (error.message) {
      if (error.message.includes('execution reverted')) {
        // 提取 revert reason
        const match = error.message.match(/execution reverted: (.+)/);
        if (match) {
          return match[1];
        }
        return '交易执行失败';
      }
      
      // 检查常见的错误消息
      if (error.message.includes('user rejected')) {
        return '用户拒绝了交易';
      } else if (error.message.includes('insufficient funds')) {
        return '余额不足';
      } else if (error.message.includes('network')) {
        return '网络错误，请检查网络连接';
      } else if (error.message.includes('nonce')) {
        return '交易nonce错误，请重试';
      }
    }
    
    return '交易执行失败（无法获取详细错误信息）';
  }
  
  // 如果有 reason，直接返回
  if (error.reason) {
    return error.reason;
  }
  
  // 尝试从消息中提取更友好的错误消息
  if (error.message) {
    const message = error.message;
    if (message.includes('user rejected')) {
      return '用户拒绝了交易';
    } else if (message.includes('insufficient funds')) {
      return '余额不足';
    } else if (message.includes('execution reverted')) {
      // 提取 revert reason
      const match = message.match(/execution reverted: (.+)/);
      return match ? match[1] : '交易执行失败';
    }
    return message;
  }
  
  return '未知错误';
}

