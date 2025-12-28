# NFT Auction Market Frontend

React + TypeScript + Vite 构建的 NFT 拍卖商城前端应用。这是一个基于区块链的去中心化 NFT 拍卖平台，支持用户通过 MetaMask 钱包连接，进行 NFT 拍卖和出价，所有交易都在链上执行。

## ✨ 功能特性

- 🔐 **钱包登录认证**：基于 MetaMask 的钱包签名登录
- 🏠 **首页展示**：展示所有公开拍卖的 NFT，支持状态筛选和排序
- 📊 **Dashboard 管理**：管理个人 NFT、创建拍卖、查看我的拍卖
- 👤 **个人资料**：查看和更新用户资料信息
- 🎨 **NFT 管理**：同步链上 NFT、授权 NFT 给合约
- 💰 **拍卖功能**：创建拍卖、出价、查看拍卖详情和出价历史
- 📡 **实时更新**：WebSocket 实时推送拍卖状态和出价更新
- 💱 **多代币支持**：支持 ETH 和 ERC20 代币（如 USDC）作为支付代币
- 🌐 **价格显示**：自动转换代币价格为 USD 显示
- 📱 **响应式设计**：适配桌面端和移动端
- 🌍 **国际化支持**：支持中英文切换

## 技术栈

- **React 18** + **TypeScript**
- **Vite** - 构建工具
- **React Router v6** - 路由
- **Zustand** - 状态管理
- **Ant Design** - UI 组件库
- **React Query** - 数据获取
- **ethers.js** - Web3 交互

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

**注意**：确保后端 API 服务已启动（默认 `http://localhost:8080`），前端会通过 Vite 代理连接到后端。

### 构建

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

预览构建后的生产版本，用于测试生产环境。

### 代码检查

```bash
npm run lint
```

检查代码是否符合 ESLint 规范。

## 📁 项目结构

```
my-auction-market-front/
├── public/                         # 静态资源
│   └── vite.svg                    # 图标
│
├── src/
│   ├── components/                 # 组件
│   │   ├── Common/                 # 通用组件
│   │   │   ├── Empty.tsx           # 空状态组件
│   │   │   ├── Loading.tsx         # 加载组件
│   │   │   ├── LanguageSwitcher.tsx # 语言切换
│   │   │   └── TextWithTooltip.tsx  # 文本提示
│   │   ├── Layout/                 # 布局组件
│   │   │   ├── Header.tsx          # 页面头部
│   │   │   └── Header.css          # 头部样式
│   │   ├── NFT/                    # NFT 组件
│   │   │   ├── NFTCard.tsx         # NFT 卡片
│   │   │   └── NFTCard.css         # 卡片样式
│   │   └── Wallet/                 # 钱包组件
│   │       ├── ConnectWallet.tsx   # 连接钱包
│   │       ├── WalletInfo.tsx      # 钱包信息
│   │       └── NetworkStatus.tsx   # 网络状态
│   │
│   ├── pages/                      # 页面
│   │   ├── Home/                   # 首页
│   │   │   ├── index.tsx           # 首页组件
│   │   │   └── Home.css            # 首页样式
│   │   ├── Dashboard/              # 仪表板
│   │   │   ├── index.tsx           # Dashboard 主组件
│   │   │   ├── Dashboard.css       # 样式
│   │   │   ├── MyNFTs.tsx          # 我的 NFT
│   │   │   ├── CreateAuction.tsx   # 创建拍卖
│   │   │   ├── MyAuctions.tsx      # 我的拍卖
│   │   │   └── AuctionHistory.tsx  # 拍卖历史
│   │   ├── Profile/                # 个人资料
│   │   │   ├── index.tsx           # 资料页
│   │   │   └── Profile.css         # 样式
│   │   └── AuctionDetail/          # 拍卖详情
│   │       ├── index.tsx           # 详情页
│   │       └── AuctionDetail.css   # 样式
│   │
│   ├── services/                   # 服务层
│   │   ├── api.ts                  # REST API 服务
│   │   ├── contract.ts             # 智能合约交互
│   │   ├── websocket.ts            # WebSocket 服务
│   │   └── mockData.ts             # 模拟数据（开发用）
│   │
│   ├── store/                      # 状态管理
│   │   ├── walletStore.ts          # 钱包状态
│   │   └── tokenStore.ts           # 代币状态
│   │
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useNetwork.ts           # 网络状态 Hook
│   │   └── useWebSocket.ts         # WebSocket Hook
│   │
│   ├── config/                     # 配置
│   │   └── contract.ts             # 合约配置（从 API 动态加载）
│   │
│   ├── types/                      # TypeScript 类型定义
│   │   ├── index.ts                # 通用类型
│   │   ├── auction.ts              # 拍卖类型
│   │   ├── nft.ts                  # NFT 类型
│   │   ├── user.ts                 # 用户类型
│   │   └── ethereum.d.ts           # 以太坊类型扩展
│   │
│   ├── utils/                      # 工具函数
│   │   ├── constants.ts            # 常量定义
│   │   ├── format.ts               # 格式化工具
│   │   └── placeholder.ts          # 占位符工具
│   │
│   ├── i18n/                       # 国际化
│   │   ├── index.ts                # i18n 配置
│   │   └── locales/                # 语言包
│   │       ├── zh-CN.ts            # 中文
│   │       └── en-US.ts            # 英文
│   │
│   ├── abis/                       # 合约 ABI
│   │   └── MyXAuctionV2.json       # 拍卖合约 ABI
│   │
│   ├── App.tsx                     # 根组件
│   ├── App.css                     # 根样式
│   ├── main.tsx                    # 应用入口
│   ├── index.css                   # 全局样式
│   ├── router.tsx                  # 路由配置
│   └── vite-env.d.ts               # Vite 类型定义
│
├── vite.config.ts                  # Vite 配置
├── tsconfig.json                   # TypeScript 配置
├── tsconfig.node.json              # Node TypeScript 配置
├── package.json                    # 项目配置和依赖
├── package-lock.json               # 依赖锁定
├── README.md                       # 项目说明
├── PROJECT_SUMMARY.md              # 项目总结文档（详细版）
└── WALLET_AND_CONTRACT_INTEGRATION.md # 钱包和合约集成文档
```

## 环境变量配置

### 创建环境变量文件

**重要提示**：项目中的 `.env` 文件已加入 `.gitignore`，不会被提交到代码仓库。

首次配置请按以下步骤：

1. 在项目根目录创建 `.env` 文件
2. 根据环境复制对应的配置：

#### 开发环境配置

```env
# 开发环境：使用 Vite 代理（推荐）
VITE_API_BASE_URL=/api

# 或者直接指定后端地址
# VITE_API_BASE_URL=http://localhost:8080/api
```

#### 生产环境配置

```env
# 生产环境：使用完整的后端 API 地址
VITE_API_BASE_URL=https://your-api-domain.com/api
```

### 环境变量说明

- `VITE_API_BASE_URL`: 后端 API 的基础 URL
  - 开发环境：可以设置为 `/api`（使用 Vite 代理）或完整 URL
  - 生产环境：必须设置为完整的后端 API 地址
  - 如果不设置，默认值在 `src/utils/constants.ts` 中定义

### 开发服务器代理配置

开发环境的代理配置在 `vite.config.ts` 中：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080', // 开发后端地址
      changeOrigin: true,
      ws: true, // 启用 WebSocket 代理
    },
  },
}
```

**注意**：如果后端运行在不同的端口，需要修改 `vite.config.ts` 中的 `target` 配置。

## 🎯 核心功能说明

### 1. 钱包连接与登录

**流程**：
1. 点击 "Connect Wallet" 按钮
2. MetaMask 会弹出连接请求，用户确认连接
3. 系统自动请求后端获取 nonce
4. 用户使用钱包签名消息进行认证
5. 后端验证签名并返回 JWT token
6. 连接成功后可以查看个人 NFT 和创建拍卖

**特点**：
- 基于钱包签名的去中心化认证
- 无需传统用户名密码
- 支持自动重连和状态保持

### 2. NFT 管理

**NFT 同步**：
- 从区块链扫描用户钱包地址的 ERC721 NFT
- 自动获取 NFT 元数据（名称、图片、描述等）
- 支持批量同步和增量更新

**NFT 授权**：
- 检查 NFT 是否已授权给拍卖合约
- 支持单次授权（approve）和批量授权（setApprovalForAll）
- 授权后才能创建拍卖

### 3. 创建拍卖

**流程**：
1. 在 Dashboard 选择 "Create Auction" 标签
2. 同步并查看我的 NFT 列表
3. 选择要拍卖的 NFT（需要先授权）
4. 填写拍卖信息：
   - 起拍价（支持 ETH 和 ERC20 代币）
   - 拍卖开始和结束时间
   - 支付代币选择
5. 确认创建，系统自动在链上创建拍卖
6. 等待交易确认，成功后拍卖创建完成

### 4. 拍卖浏览

**首页**：
- 展示所有公开拍卖的 NFT
- 支持按状态筛选（active、ended、all）
- 自动排序（active 在前，ended 在后）
- 显示拍卖基本信息：NFT 图片、名称、起拍价、最高出价等

**拍卖详情**：
- 完整的 NFT 信息展示
- 拍卖状态和时间倒计时
- 出价历史列表
- 实时出价更新（WebSocket）

### 5. 出价功能

**流程**：
1. 在拍卖详情页查看当前最高出价
2. 选择支付代币（ETH、USDC 等）
3. 输入出价金额（必须高于当前最高出价）
4. 点击 "Place Bid" 按钮
5. 在 MetaMask 中确认交易
6. 等待交易确认
7. 系统实时更新出价信息（WebSocket 推送）

**特点**：
- 链上出价，透明可追溯
- 自动验证出价金额
- 实时更新出价列表
- 支持多种支付代币

### 6. 实时通知

**WebSocket 推送**：
- 拍卖创建通知
- 新出价通知
- 拍卖结束通知
- 拍卖取消通知
- NFT 授权成功通知

**订阅机制**：
- 自动订阅当前查看的拍卖
- 支持订阅特定拍卖的事件
- 自动重连机制
- 心跳保持连接

### 7. 价格显示

**USD 转换**：
- 使用 Chainlink 价格预言机获取代币价格
- 自动将代币数量转换为 USD 价值
- 支持 ETH 和 ERC20 代币（如 USDC）
- 同时显示代币数量和 USD 价值

## 安全注意事项

### 配置文件安全

本项目已配置 `.gitignore` 排除敏感配置文件，但仍需注意：

1. **如果 `.env` 文件已被提交到 Git 历史中**，需要从历史记录中删除：
   ```bash
   # 使用 git filter-branch 从历史中删除敏感文件
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **生产环境建议**：
   - 使用环境变量管理敏感配置
   - 不要在代码中硬编码 API 地址或密钥
   - 使用 HTTPS 连接后端 API
   - 确保 WebSocket 连接使用 WSS（安全 WebSocket）

3. **环境变量管理**：
   - 开发环境：使用 `.env.local`（已加入 .gitignore）
   - 生产环境：使用服务器环境变量或 CI/CD 配置
   - 永远不要将 `.env` 文件提交到代码仓库

### 配置管理

**重要**：项目的核心配置（包括合约地址、RPC URL、链 ID 等）从后端 API 动态获取，不会硬编码在前端代码中：

1. **合约配置**：通过 `/api/config/ethereum` 接口获取
   - 拍卖合约地址（Auction Contract Address）
   - RPC URL
   - 链 ID（Chain ID）
   - 网络配置信息

2. **配置加载**：应用启动时自动从后端加载配置
   - 配置文件位置：`src/config/contract.ts`
   - 配置会在首次使用时自动初始化

3. **代币地址**：`src/utils/constants.ts` 中仅包含标准的代币地址常量
   - ETH 零地址：`0x0000000000000000000000000000000000000000`
   - USDC 主网地址：`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`（公开信息）

### 其他注意事项

- 钱包连接功能需要 MetaMask 浏览器扩展
- WebSocket 连接会自动根据 API_BASE_URL 构建正确的 WebSocket URL
- 所有敏感配置（如实际使用的合约地址、RPC 端点等）都从后端获取，前端代码无需修改即可适配不同网络
- 确保浏览器已安装 MetaMask 扩展
- 生产环境建议使用 HTTPS 和 WSS（安全 WebSocket）

## 🚀 部署

### 构建生产版本

```bash
npm run build
```

### 部署到静态服务器

构建后的静态文件在 `dist/` 目录，可以部署到：

- **Nginx**：配置静态文件服务
- **Vercel**：直接连接 GitHub 仓库自动部署
- **Netlify**：拖拽 `dist` 文件夹或连接 GitHub
- **AWS S3 + CloudFront**：上传到 S3 并通过 CloudFront 分发
- **GitHub Pages**：使用 GitHub Actions 自动部署
- 其他静态文件托管服务

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/auction-front/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理（如果需要）
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket 代理
    location /api/ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📚 相关文档

- [项目总结文档](./PROJECT_SUMMARY.md) - 详细的项目文档，包括架构、部署、API 等
- [钱包和合约集成文档](./WALLET_AND_CONTRACT_INTEGRATION.md) - Web3 集成详细说明
- [后端 API 文档](../my-auction-market-api/README.md) - 后端 API 使用说明
- [Swagger API 文档](http://localhost:8080/api/swagger/index.html) - 交互式 API 文档（需运行后端）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License

---

**最后更新**: 2025年

