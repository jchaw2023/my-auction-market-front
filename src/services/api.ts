import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import { Auction, Bid, AuctionPayload, BidPayload } from '@/types';
import { mockAuctions, mockBids } from './mockData';
import { getPlaceholderImage } from '@/utils/placeholder';

// 以太坊配置类型
export interface EthereumConfig {
  rpcUrl: string;
  auctionContractAddress: string;
  chainId: number;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    // 后端返回格式: { success: boolean, data: any, error?: string }
    return response.data;
  },
  (error) => {
    // 处理后端错误响应格式: { success: false, error: string }
    if (error.response?.data) {
      const errorData = error.response.data;
      if (errorData.error) {
        // 提取后端返回的错误信息
        error.message = errorData.error;
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应（网络错误）
      if (error.code === 'ECONNABORTED') {
        error.message = '请求超时，请检查网络连接';
      } else if (error.message === 'Network Error') {
        error.message = `无法连接到后端服务器 (${API_BASE_URL})。请确保后端服务正在运行。`;
      } else {
        error.message = `网络错误: ${error.message}`;
      }
      console.error('Network Error Details:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
        message: error.message,
      });
    } else {
      // 请求配置错误
      error.message = `请求配置错误: ${error.message}`;
    }
    
    if (error.response?.status === 401) {
      // 清除认证信息（钱包登录，无需跳转到登录页面）
      localStorage.removeItem('authToken');
      // 可以在这里触发钱包断开连接的状态更新
      // 但不需要跳转页面，用户可以通过连接钱包重新登录
    }
    
    return Promise.reject(error);
  }
);

// 模拟延迟
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 拍卖相关 API
export const auctionApi = {
  // 获取拍卖简单统计信息
  getAuctionSimpleStats: async (): Promise<{
    success: boolean;
    data: {
      totalAuctionsCreated: number;
      totalBidsPlaced: number;
      platformFee: number;
      totalValueLocked: number;
      totalValueLockedStr: string;
    };
  }> => {
    const response = await api.get('/auctions/stats');
    const responseData = (response as any).data || response;
    return {
      success: true,
      data: {
        totalAuctionsCreated: responseData.totalAuctionsCreated || 0,
        totalBidsPlaced: responseData.totalBidsPlaced || 0,
        platformFee: responseData.platformFee || 0,
        totalValueLocked: responseData.totalValueLocked || 0,
        totalValueLockedStr: responseData.totalValueLockedStr || '0.00',
      },
    };
  },

  // 获取拍卖列表（公开列表，带排序：active 在前，ended 在后）
  getPublicAuctions: async (params?: { page?: number; pageSize?: number; status?: string }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: Auction[];
    };
  }> => {
    const queryParams: any = {};
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.pageSize) {
      queryParams.pageSize = params.pageSize;
    }
    if (params?.status) {
      queryParams.status = params.status;
    }
    
    const response = await api.get('/auctions/public', { params: queryParams });
    // 响应拦截器已经处理了 response.data，所以 response 就是 { success, data } 格式
    // response = { success: true, data: { page, pageSize, total, data: [...] } }
    const responseData = (response as any).data || response;
    
    // 映射后端数据到前端格式
    const mappedData = {
      page: responseData.page || 1,
      pageSize: responseData.pageSize || 10,
      total: responseData.total || 0,
      data: (responseData.data || []).map((auction: any) => ({
        // 与后端字段名完全一致
        auctionId: auction.auctionId || auction.auctionID,
        userId: auction.userId,
        ownerAddress: auction.ownerAddress,
        contractAuctionId: auction.contractAuctionId || 0,
        nftId: auction.nftId,
        nftAddress: auction.nftAddress,
        tokenId: auction.tokenId,
        contractName: auction.contractName,
        contractSymbol: auction.contractSymbol,
        tokenURI: auction.tokenURI,
        nftName: auction.nftName || auction.name || `NFT #${auction.tokenId}`,
        image: auction.image,
        description: auction.description,
        metadata: auction.metadata,
        status: auction.status || 'pending',
        onlineLock: auction.onlineLock,
        online: auction.online,
        startTime: auction.startTime,
        startTimestamp: auction.startTimestamp || 0,
        endTime: auction.endTime,
        endTimestamp: auction.endTimestamp || 0,
        startPrice: auction.startPrice ? parseFloat(auction.startPrice.toString()) : 0,
        paymentToken: auction.paymentToken || '',
        startPriceUSD: auction.startPriceUSD ? parseFloat(auction.startPriceUSD.toString()) : 0,
        startPriceUnitUSD: auction.startPriceUnitUSD || 0,
        highestBidder: auction.highestBidder,
        highestBidPaymentToken: auction.highestBidPaymentToken,
        highestBid: auction.highestBid ? auction.highestBid.toString() : '0',
        highestBidUSD: auction.highestBidUSD ? parseFloat(auction.highestBidUSD.toString()) : 0,
        highestBidUnitUSD: auction.highestBidUnitUSD,
        bidCount: auction.bidCount || 0,
        createdAt: auction.createdAt,
        updatedAt: auction.updatedAt,
        user: auction.user,
      })),
    };
    
    return {
      success: (response as any).success !== false,
      data: mappedData,
    };
  },

  // 获取拍卖列表
  getAuctions: async (params?: { page?: number; pageSize?: number; status?: string }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: Auction[];
    };
  }> => {
    const queryParams: any = {};
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.pageSize) {
      queryParams.pageSize = params.pageSize;
    }
    if (params?.status && params.status !== 'all') {
      queryParams.status = params.status;
    }
    
    const response = await api.get('/auctions', { params: queryParams });
    // 响应拦截器已经处理了 response.data，所以 response 就是 { success, data } 格式
    const responseData = (response as any).data || response;
    
    // 映射后端数据到前端格式
    const mappedData = {
      ...responseData,
      data: (responseData.data || []).map((auction: any) => ({
        // 与后端字段名完全一致
        auctionId: auction.auctionId || auction.auctionID,
        userId: auction.userId,
        ownerAddress: auction.ownerAddress,
        contractAuctionId: auction.contractAuctionId || 0,
        nftId: auction.nftId,
        nftAddress: auction.nftAddress,
        tokenId: auction.tokenId,
        contractName: auction.contractName,
        contractSymbol: auction.contractSymbol,
        tokenURI: auction.tokenURI,
        nftName: auction.nftName || `NFT #${auction.tokenId}`,
        image: auction.image,
        description: auction.description,
        metadata: auction.metadata,
        status: auction.status || 'pending',
        onlineLock: auction.onlineLock,
        online: auction.online,
        startTime: auction.startTime,
        startTimestamp: auction.startTimestamp || 0,
        endTime: auction.endTime,
        endTimestamp: auction.endTimestamp || 0,
        startPrice: auction.startPrice ? parseFloat(auction.startPrice.toString()) : 0,
        paymentToken: auction.paymentToken || '',
        startPriceUSD: auction.startPriceUSD ? parseFloat(auction.startPriceUSD.toString()) : 0,
        startPriceUnitUSD: auction.startPriceUnitUSD || 0,
        highestBidder: auction.highestBidder,
        highestBidPaymentToken: auction.highestBidPaymentToken,
        highestBid: auction.highestBid ? auction.highestBid.toString() : '0',
        highestBidUSD: auction.highestBidUSD ? parseFloat(auction.highestBidUSD.toString()) : 0,
        highestBidUnitUSD: auction.highestBidUnitUSD,
        bidCount: auction.bidCount || 0,
        createdAt: auction.createdAt,
        updatedAt: auction.updatedAt,
        user: auction.user,
      })),
    };
    
    return {
      success: (response as any).success !== false,
      data: mappedData,
    };
  },

  // 获取拍卖详情（根据字符串类型的 auctionId）
  getAuctionById: async (auctionId: string): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.get(`/auctions/${auctionId}`);
    const responseData = (response as any).data || response;
    
    // 映射后端数据到前端格式（与后端字段名完全一致）
    const auction = responseData.data || responseData;
    const mappedAuction: any = {
      // 与后端字段名完全一致
      auctionId: auction.auctionId || auction.auctionID,
      userId: auction.userId,
      ownerAddress: auction.ownerAddress,
      contractAuctionId: auction.contractAuctionId || 0,
      nftId: auction.nftId,
      nftAddress: auction.nftAddress,
      tokenId: auction.tokenId,
      contractName: auction.contractName,
      contractSymbol: auction.contractSymbol,
      tokenURI: auction.tokenURI,
      nftName: auction.nftName || `NFT #${auction.tokenId}`,
      image: auction.image,
      description: auction.description,
      metadata: auction.metadata,
      status: auction.status || 'pending',
      onlineLock: auction.onlineLock,
      online: auction.online,
      startTime: auction.startTime,
      startTimestamp: auction.startTimestamp || 0,
      endTime: auction.endTime,
      endTimestamp: auction.endTimestamp || 0,
      startPrice: auction.startPrice ? parseFloat(auction.startPrice.toString()) : 0,
      paymentToken: auction.paymentToken || '',
      startPriceUSD: auction.startPriceUSD ? parseFloat(auction.startPriceUSD.toString()) : 0,
      startPriceUnitUSD: auction.startPriceUnitUSD || 0,
      highestBidder: auction.highestBidder,
      highestBidPaymentToken: auction.highestBidPaymentToken,
      highestBid: auction.highestBid ? auction.highestBid.toString() : '0',
      highestBidUSD: auction.highestBidUSD ? parseFloat(auction.highestBidUSD.toString()) : 0,
      highestBidUnitUSD: auction.highestBidUnitUSD,
      bidCount: auction.bidCount || 0,
      createdAt: auction.createdAt,
      updatedAt: auction.updatedAt,
      user: auction.user,
    };
    
    return {
      success: (response as any).success !== false,
      data: mappedAuction,
    };
  },

  // 获取拍卖详情（只返回钱包地址，不返回完整User信息）
  getAuctionDetailById: async (id: number): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.get(`/auctions/${id}/detail`);
    const responseData = (response as any).data || response;
    
    // 映射后端数据到前端格式（与后端字段名完全一致）
    const auction = responseData.data || responseData;
    const mappedAuction: any = {
      // 与后端字段名完全一致
      auctionId: auction.auctionId || auction.auctionID,
      userId: auction.userId,
      ownerAddress: auction.ownerAddress || auction.sellerWalletAddress,
      contractAuctionId: auction.contractAuctionId || 0,
      nftId: auction.nftId,
      nftAddress: auction.nftAddress,
      tokenId: auction.tokenId,
      contractName: auction.contractName,
      contractSymbol: auction.contractSymbol,
      tokenURI: auction.tokenURI,
      nftName: auction.nftName || `NFT #${auction.tokenId}`,
      image: auction.image,
      description: auction.description,
      metadata: auction.metadata,
      status: auction.status || 'pending',
      onlineLock: auction.onlineLock,
      online: auction.online,
      startTime: auction.startTime,
      startTimestamp: auction.startTimestamp || 0,
      endTime: auction.endTime,
      endTimestamp: auction.endTimestamp || 0,
      startPrice: auction.startPrice ? parseFloat(auction.startPrice.toString()) : 0,
      paymentToken: auction.paymentToken || '',
      startPriceUSD: auction.startPriceUSD ? parseFloat(auction.startPriceUSD.toString()) : 0,
      startPriceUnitUSD: auction.startPriceUnitUSD || 0,
      highestBidder: auction.highestBidder,
      highestBidPaymentToken: auction.highestBidPaymentToken,
      highestBid: auction.highestBid ? auction.highestBid.toString() : '0',
      highestBidUSD: auction.highestBidUSD ? parseFloat(auction.highestBidUSD.toString()) : 0,
      highestBidUnitUSD: auction.highestBidUnitUSD,
      bidCount: auction.bidCount || 0,
      createdAt: auction.createdAt,
      updatedAt: auction.updatedAt,
      user: auction.user || (auction.sellerWalletAddress ? {
        id: auction.userId || 0,
        username: '',
        walletAddress: auction.sellerWalletAddress,
      } : undefined),
    };
    
    return {
      success: (response as any).success !== false,
      data: mappedAuction,
    };
  },

  // 创建拍卖
  createAuction: async (payload: AuctionPayload): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.post('/auctions', payload);
    return response as any;
  },

  // 更新拍卖
  updateAuction: async (id: string, payload: Partial<AuctionPayload>): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.put(`/auctions/${id}`, payload);
    return response as any;
  },

  // 上架拍卖
  publishAuction: async (id: number): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.post(`/auctions/${id}/publish`);
    return response as any;
  },

  // 取消拍卖
  cancelAuction: async (id: string): Promise<{
    success: boolean;
    data: Auction;
  }> => {
    const response = await api.post(`/auctions/${id}/cancel`);
    return response as any;
  },

  // 获取我的拍卖
  getMyAuctions: async (params?: { page?: number; pageSize?: number; status?: string[] }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: Auction[];
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    // 支持多个 status 参数
    if (params?.status && params.status.length > 0) {
      params.status.forEach(status => {
        queryParams.append('status', status);
      });
    }
    
    const url = `/auctions/my${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response as any;
  },

  // 获取我的拍卖历史记录（精简字段）
  getAuctionHistory: async (params?: { page?: number; pageSize?: number; status?: string[] }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: any[];
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    // 支持多个 status 参数
    if (params?.status && params.status.length > 0) {
      params.status.forEach(status => {
        queryParams.append('status', status);
      });
    }
    
    const url = `/auctions/my/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get(url);
    return response as any;
  },

  // 获取支持的代币列表
  getSupportedTokens: async (): Promise<{
    success: boolean;
    data: Array<{
      address: string;
      symbol: string;
      name: string;
      default: boolean;
    }>;
  }> => {
    const response = await api.get('/auctions/supported-tokens');
    return response as any;
  },
};

// 出价相关 API
export const bidApi = {
  // 获取拍卖的出价列表
  getBidsByAuctionId: async (auctionId: number, params?: { page?: number; pageSize?: number }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: Bid[];
    };
  }> => {
    await delay(300);
    const bids = mockBids[auctionId] || [];
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      success: true,
      data: {
        page,
        pageSize,
        total: bids.length,
        data: bids.slice(start, end),
      },
    };
  },

  // 获取拍卖的出价详情列表（使用 BidResponse 格式，与 WebSocket 消息一致）
  getBidDetailsByAuctionId: async (auctionId: string, params?: { page?: number; pageSize?: number }): Promise<{
    success: boolean;
    data: {
      page: number;
      pageSize: number;
      total: number;
      data: Bid[];
    };
  }> => {
    const queryParams: any = {};
    if (params?.page) {
      queryParams.page = params.page;
    }
    if (params?.pageSize) {
      queryParams.pageSize = params.pageSize;
    }
    
    const response = await api.get(`/auctions/${auctionId}/bids`, { params: queryParams });
    // 响应拦截器已经返回了 response.data，所以 response 就是 { success, data: { page, pageSize, total, data: [...] } }
    
    // 后端返回格式: { success: true, data: { page, pageSize, total, data: BidResponse[] } }
    // 响应拦截器返回的是 response.data，所以 response 已经是 { success, data: PageData }
    const responseData = response as any;
    
    // PageData 结构: { page, pageSize, total, data: BidResponse[] }
    const pageData = responseData.data || responseData;
    
    // 后端返回的是 BidResponse 格式（与 WebSocket 消息一致）
    // 映射到前端 Bid 格式
    const mappedBids = (pageData.data || []).map((bid: any) => ({
      id: bid.id,
      auctionId: bid.auctionId || bid.auctionId,
      userId: bid.userId || 0,
      amount: bid.amount ? bid.amount.toString() : '0', // BidResponse 中 amount 是 float64
      amountUSD: bid.amountUSD || 0, // BidResponse 中 amountUSD 是 float64
      paymentToken: bid.paymentToken || '',
      paymentTokenSymbol: bid.paymentTokenSymbol || '', // BidResponse 中的支付代币符号
      transactionHash: bid.transactionHash || '',
      blockNumber: bid.blockNumber || 0,
      isHighest: bid.isHighest || false,
      createdAt: bid.createdAt,
      bidder: {
        id: bid.userId || 0,
        username: '',
        walletAddress: bid.bidder || '', // BidResponse 中 bidder 是钱包地址字符串
      },
    }));
    
    return {
      success: responseData.success !== false,
      data: {
        page: pageData.page || params?.page || 1,
        pageSize: pageData.pageSize || params?.pageSize || 10,
        total: pageData.total || mappedBids.length,
        data: mappedBids,
      },
    };
  },

  // 创建出价
  createBid: async (payload: BidPayload): Promise<{
    success: boolean;
    data: Bid;
  }> => {
    await delay(1000);
    const auction = mockAuctions.find((a) => a.auctionId === payload.auctionId.toString() || (a as any).id === payload.auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    
    const newBid: Bid = {
      id: Date.now(),
      auctionId: payload.auctionId,
      userId: 1,
      amount: payload.amount,
      amountUSD: parseFloat(payload.amount) / 1e18 * 2500,
      paymentToken: payload.paymentToken || '',
      transactionHash: `0x${Math.random().toString(16).slice(2)}`,
      blockNumber: 12345690,
      isHighest: true,
      createdAt: new Date().toISOString(),
      bidder: {
        id: 1,
        username: 'current_user',
        walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      },
    };
    
    if (!mockBids[payload.auctionId]) {
      mockBids[payload.auctionId] = [];
    }
    mockBids[payload.auctionId].unshift(newBid);
    
    // 更新拍卖的最高出价
    auction.highestBid = payload.amount;
    auction.highestBidUSD = newBid.amountUSD;
    auction.highestBidder = newBid.bidder.walletAddress;
    auction.bidCount += 1;
    
    return {
      success: true,
      data: newBid,
    };
  },
};

// 认证相关 API - 仅支持钱包登录
export const authApi = {
  // 请求 nonce（钱包登录第一步）
  requestNonce: async (walletAddress: string): Promise<{
    success: boolean;
    data: {
      nonce: string;
      message: string;
    };
  }> => {
    const response = await api.post('/auth/wallet/request-nonce', {
      walletAddress,
    });
    return response as any;
  },

  // 验证签名并登录（钱包登录第二步）
  verify: async (data: {
    walletAddress: string;
    message: string;
    signature: string;
  }): Promise<{
    success: boolean;
    data: {
      token: string;
      user: {
        id: number;
        username: string;
        email: string;
        walletAddress: string;
      };
    };
  }> => {
    const response = await api.post('/auth/wallet/verify', data);
    return response as any;
  },
};

// 用户相关 API
export const userApi = {
  // 获取平台统计数据
  getPlatformStats: async (): Promise<{
    success: boolean;
    data: {
      totalUsers: number;
      totalAuctions: number;
      totalBids: number;
    };
  }> => {
    const response = await api.get('/users/stats');
    return response as any;
  },

  // 获取用户信息
  getProfile: async (): Promise<{
    success: boolean;
      data: {
      id: number;
      username: string;
      email: string;
      walletAddress: string;
    };
  }> => {
    const response = await api.get('/users/profile');
    return response as any;
  },

  // 更新用户信息
  updateProfile: async (payload: { username?: string; email?: string }): Promise<{
    success: boolean;
    data: {
      id: number;
      username: string;
      email: string;
      walletAddress: string;
    };
  }> => {
    const response = await api.put('/users/profile', payload);
    return response as any;
  },
};

// NFT 相关 API
export const nftApi = {
  // 同步用户 NFT
  syncNFTs: async (): Promise<{
    success: boolean;
    data: {
      totalFound: number;
      totalSynced: number;
      totalFailed: number;
      lastSyncBlock: number;
    };
  }> => {
    const response = await api.post('/nfts/sync');
    return response as any;
  },

  // 获取我的 NFT 列表（不分页，所有合约）
  getMyNFTsList: async (params?: { status?: string }): Promise<{
    success: boolean;
    data: any[];
  }> => {
    const queryParams: any = {};
    if (params?.status && params.status !== 'all') {
      queryParams.status = params.status;
    }
    const response = await api.get('/nfts/my/list', { params: queryParams });
    return response as any;
  },

  // 根据 nftId 获取单个 NFT 关系数据
  getMyNFTOwnershipByNFTID: async (nftId: string): Promise<{
    success: boolean;
    data: any;
  }> => {
    const response = await api.get(`/nfts/my/ownership/${nftId}`);
    return response as any;
  },

  // 获取我的 NFT（分页版本，保留兼容性）
  getMyNFTs: async (): Promise<{
    success: boolean;
    data: any[];
  }> => {
    await delay(500);
    return {
      success: true,
      data: [
        {
          id: 4,
          tokenId: 4,
          name: 'My Ape #4',
          image: getPlaceholderImage(400, 400, 'My Ape #4'),
          contractAddress: '0x1234567890123456789012345678901234567890',
          owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
        {
          id: 5,
          tokenId: 5,
          name: 'My Ape #5',
          image: getPlaceholderImage(400, 400, 'My Ape #5'),
          contractAddress: '0x1234567890123456789012345678901234567890',
          owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
      ],
    };
  },

};

// 配置相关 API
export const configApi = {
  // 获取以太坊配置
  getEthereumConfig: async (): Promise<{
    success: boolean;
    data: EthereumConfig;
  }> => {
    const response = await api.get('/config/ethereum');
    return response as any;
  },
};

export default api;

