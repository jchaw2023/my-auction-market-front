# 钱包接入和合约接入流程文档

## 一、钱包接入流程

### 1.1 架构概览

```
用户点击连接钱包
    ↓
检查 MetaMask 是否安装
    ↓
检查/切换网络
    ↓
请求连接账户 (eth_requestAccounts)
    ↓
获取钱包地址和 Chain ID
    ↓
后端认证流程（签名消息）
    ↓
保存状态到 Zustand Store
```

### 1.2 核心文件

#### `src/types/ethereum.d.ts`
- **作用**: TypeScript 类型定义，扩展 `Window` 接口
- **内容**: 定义 `window.ethereum` 的类型

```typescript
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, handler: Function) => void;
    removeListener: (event: string, handler: Function) => void;
    // ...
  };
}
```

#### `src/store/walletStore.ts`
- **作用**: 使用 Zustand 管理钱包状态
- **状态字段**:
  - `address`: 钱包地址
  - `isConnected`: 是否已连接
  - `chainId`: 当前网络 Chain ID
  - `user`: 用户信息
  - `token`: JWT Token
- **持久化**: 使用 `localStorage` 持久化状态

#### `src/components/Wallet/ConnectWallet.tsx`
- **作用**: 钱包连接组件
- **主要功能**:
  1. 检查 MetaMask 是否安装
  2. 检查/切换网络
  3. 连接钱包
  4. 签名消息进行后端认证
  5. 保存状态

### 1.3 连接流程详解

#### 步骤 1: 检查钱包
```typescript
const ethereum = (window as any).ethereum;
if (!ethereum) {
  alert('请安装 MetaMask 钱包');
  return;
}
```

#### 步骤 2: 检查/切换网络
```typescript
// 确保网络正确
const isCorrectNetwork = await ensureCorrectNetwork();
if (!isCorrectNetwork) {
  // 提示用户切换网络
  const shouldContinue = confirm('请切换到正确的网络');
  if (!shouldContinue) return;
  // 尝试自动切换
  await ensureCorrectNetwork();
}
```

#### 步骤 3: 请求连接账户
```typescript
const accounts = await ethereum.request({
  method: 'eth_requestAccounts',
});
const walletAddress = accounts[0].toLowerCase();
const chainId = parseInt(await ethereum.request({ method: 'eth_chainId' }), 16);
```

#### 步骤 4: 后端认证（钱包登录）
```typescript
// 1. 请求 nonce
const nonceResponse = await authApi.requestNonce(walletAddress);
const { message } = nonceResponse.data;

// 2. 签名消息
const signature = await ethereum.request({
  method: 'personal_sign',
  params: [message, walletAddress],
});

// 3. 验证并登录
const loginResponse = await authApi.verify({
  walletAddress,
  message,
  signature,
});
```

#### 步骤 5: 保存状态
```typescript
connect(walletAddress, chainId);
setUser(loginResponse.data.user);
setToken(loginResponse.data.token);
localStorage.setItem('authToken', loginResponse.data.token);
```

### 1.4 网络管理

#### 网络检查
- **位置**: `src/services/contract.ts`
- **函数**: `checkNetwork()`, `ensureCorrectNetwork()`
- **功能**: 
  - 检查当前网络是否匹配配置的 Chain ID
  - 如果不匹配，尝试自动切换

#### 网络切换
```typescript
// 切换到指定网络
await switchToNetwork(chainId);

// 如果网络不存在，自动添加
await addNetwork();
```

#### 网络监听
```typescript
// 监听网络切换事件
ethereum.on('chainChanged', () => {
  window.location.reload(); // 刷新页面
});
```

---

## 二、合约接入流程

### 2.1 架构概览

```
获取 Provider (window.ethereum)
    ↓
创建 BrowserProvider (ethers.js)
    ↓
获取 Signer (用于签名交易)
    ↓
创建合约实例 (Contract)
    ↓
调用合约方法
    ↓
用户确认交易 (MetaMask 弹出)
    ↓
交易发送到链上
    ↓
等待交易确认
```

### 2.2 核心文件

#### `src/config/contract.ts`
- **作用**: 合约配置
- **配置项**:
  - `AUCTION_CONTRACT_ADDRESS`: 合约地址
  - `CHAIN_ID`: 链 ID（字符串）
  - `CHAIN_ID_NUMBER`: 链 ID（数字）
  - `NETWORK_CONFIG`: 网络配置（Sepolia/Mainnet）

#### `src/services/contract.ts`
- **作用**: 合约交互服务
- **核心函数**:
  - `getProvider()`: 获取 Provider
  - `getSigner()`: 获取 Signer
  - `getAuctionContract()`: 获取合约实例（自动检查网络）
  - `placeBid()`: 出价
  - `createAuctionOnChain()`: 创建拍卖
  - 等等...

### 2.3 Provider 和 Signer

#### Provider（只读）
```typescript
// 从 window.ethereum 创建 Provider
export function getProvider(): ethers.BrowserProvider | null {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
}
```

**用途**:
- 读取链上数据（只读操作）
- 查询余额、合约状态等
- 不需要用户签名

#### Signer（可写）
```typescript
// 从 Provider 获取 Signer
export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No provider found. Please connect your wallet.');
  }
  return await provider.getSigner();
}
```

**用途**:
- 发送交易（需要签名）
- 调用合约的写入方法
- 需要用户确认

### 2.4 合约实例创建

#### 可写合约实例（需要签名）
```typescript
export async function getAuctionContract(): Promise<ethers.Contract | null> {
  // 1. 确保网络正确（自动检查并切换）
  const isCorrectNetwork = await ensureCorrectNetwork();
  if (!isCorrectNetwork) {
    throw new Error('网络不匹配');
  }

  // 2. 获取 Signer
  const signer = await getSigner();
  if (!signer) {
    return null;
  }

  // 3. 创建合约实例
  return new ethers.Contract(
    AUCTION_CONTRACT_ADDRESS, 
    AUCTION_ABI, 
    signer
  );
}
```

#### 只读合约实例（不需要签名）
```typescript
export function getAuctionContractReadOnly(): ethers.Contract | null {
  const provider = getProvider();
  if (!provider) {
    return null;
  }
  return new ethers.Contract(
    AUCTION_CONTRACT_ADDRESS, 
    AUCTION_ABI, 
    provider
  );
}
```

### 2.5 合约方法调用

#### 示例 1: 出价（placeBid）

```typescript
// 1. 获取合约实例（自动检查网络）
const contract = await getAuctionContract();

// 2. 如果是 ERC20，先检查并授权
if (paymentToken !== ethers.ZeroAddress) {
  const allowance = await erc20Contract.allowance(userAddress, contractAddress);
  if (allowance < amountWei) {
    // 授权
    await erc20Contract.approve(contractAddress, maxApproval);
  }
}

// 3. 调用合约方法
const tx = await contract.bid(auctionId, amountWei, paymentTokenAddress, {
  value: paymentTokenAddress === ethers.ZeroAddress ? amountWei : 0
});

// 4. 等待交易确认
const receipt = await tx.wait();
```

#### 示例 2: 创建拍卖

```typescript
// 1. 获取合约实例
const contract = await getAuctionContract();

// 2. 转换参数
const startPriceWei = ethers.parseEther(startPrice);

// 3. 调用合约方法
const tx = await contract.createAuction(
  nftAddress, 
  tokenId, 
  startPriceWei, 
  startTime, 
  endTime
);

// 4. 等待确认
await tx.wait();
```

#### 示例 3: 只读查询

```typescript
// 使用只读合约实例
const contract = getAuctionContractReadOnly();
const auction = await contract.getAuction(auctionId);
```

### 2.6 交易流程

```
用户操作（点击出价）
    ↓
前端验证（金额、余额等）
    ↓
检查网络（自动切换）
    ↓
检查授权（ERC20 需要）
    ↓
调用合约方法
    ↓
MetaMask 弹出确认
    ↓
用户签名
    ↓
交易发送到链上
    ↓
等待确认（tx.wait()）
    ↓
同步数据到后端（可选）
    ↓
更新 UI
```

### 2.7 错误处理

```typescript
try {
  const tx = await contract.bid(...);
  await tx.wait();
} catch (error: any) {
  if (error.code === 4001) {
    // 用户拒绝交易
    message.error('用户取消了交易');
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    // 余额不足
    message.error('余额不足');
  } else {
    // 其他错误
    const errorMsg = formatContractError(error);
    message.error(`交易失败: ${errorMsg}`);
  }
}
```

---

## 三、数据流图

### 3.1 钱包连接数据流

```
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│  用户   │ ───> │ MetaMask │ ───> │  前端   │ ───> │  后端  │
│ 点击连接│      │  钱包    │      │  React  │      │  API   │
└─────────┘      └──────────┘      └──────────┘      └─────────┘
     │                 │                  │                │
     │                 │                  │                │
     ▼                 ▼                  ▼                ▼
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│ 确认连接│      │ 返回账户 │      │ 签名消息│      │ 验证签名│
│         │      │ 地址     │      │         │      │ 返回Token│
└─────────┘      └──────────┘      └──────────┘      └─────────┘
                                                          │
                                                          ▼
                                                   ┌──────────┐
                                                   │ 保存状态 │
                                                   │ Zustand  │
                                                   └──────────┘
```

### 3.2 合约调用数据流

```
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│  用户   │ ───> │  前端    │ ───> │ MetaMask │ ───> │  合约   │
│ 点击出价│      │  contract│      │  签名   │      │  执行   │
└─────────┘      └──────────┘      └──────────┘      └─────────┘
     │                 │                  │                │
     │                 │                  │                │
     ▼                 ▼                  ▼                ▼
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌─────────┐
│ 输入金额│      │ 检查网络 │      │ 用户确认 │      │ 交易确认│
│         │      │ 检查授权 │      │ 交易     │      │ 触发事件│
└─────────┘      └──────────┘      └──────────┘      └─────────┘
                                                          │
                                                          ▼
                                                   ┌──────────┐
                                                   │ 后端监听  │
                                                   │ 同步数据  │
                                                   └──────────┘
```

---

## 四、关键代码位置

### 4.1 钱包相关
- **连接组件**: `src/components/Wallet/ConnectWallet.tsx`
- **状态管理**: `src/store/walletStore.ts`
- **类型定义**: `src/types/ethereum.d.ts`

### 4.2 合约相关
- **合约服务**: `src/services/contract.ts`
- **合约配置**: `src/config/contract.ts`
- **ABI 文件**: `src/abis/MyXAuctionV2.json`

### 4.3 网络管理
- **网络检查**: `src/services/contract.ts` (checkNetwork, ensureCorrectNetwork)
- **网络切换**: `src/services/contract.ts` (switchToNetwork, addNetwork)
- **网络 Hook**: `src/hooks/useNetwork.ts`
- **网络组件**: `src/components/Wallet/NetworkStatus.tsx`

### 4.4 API 相关
- **API 服务**: `src/services/api.ts`
- **认证 API**: `authApi.requestNonce()`, `authApi.verify()`

---

## 五、使用示例

### 5.1 在组件中连接钱包

```typescript
import ConnectWallet from '@/components/Wallet/ConnectWallet';

function MyComponent() {
  return <ConnectWallet />;
}
```

### 5.2 在组件中使用钱包状态

```typescript
import { useWalletStore } from '@/store/walletStore';

function MyComponent() {
  const { address, isConnected, chainId } = useWalletStore();
  
  if (!isConnected) {
    return <div>请先连接钱包</div>;
  }
  
  return <div>已连接: {address}</div>;
}
```

### 5.3 调用合约方法

```typescript
import { placeBid, waitForTransaction } from '@/services/contract';

async function handleBid() {
  try {
    // 调用合约出价
    const tx = await placeBid(auctionId, paymentToken, amount);
    
    // 等待确认
    const receipt = await tx.wait();
    
    console.log('交易成功:', receipt.hash);
  } catch (error) {
    console.error('出价失败:', error);
  }
}
```

---

## 六、安全注意事项

1. **网络检查**: 所有合约调用前都会检查网络
2. **用户确认**: 所有交易都需要用户在 MetaMask 中确认
3. **错误处理**: 完善的错误处理和用户提示
4. **状态同步**: 链上交易成功后，可选同步到后端

---

## 七、总结

### 钱包接入
- ✅ 通过 `window.ethereum` 访问 MetaMask
- ✅ 使用 `eth_requestAccounts` 连接账户
- ✅ 使用 `personal_sign` 进行后端认证
- ✅ 状态保存在 Zustand Store 中

### 合约接入
- ✅ 使用 `ethers.BrowserProvider` 创建 Provider
- ✅ 使用 `provider.getSigner()` 获取 Signer
- ✅ 使用 `ethers.Contract` 创建合约实例
- ✅ 自动检查网络，确保在正确的链上操作
- ✅ 支持 ETH 和 ERC20 代币支付

