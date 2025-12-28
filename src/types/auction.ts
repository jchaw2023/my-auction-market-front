// 与后端 models.Auction 字段命名完全一致
export interface Auction {
  auctionId: string; // 字符串类型的拍卖ID
  userId?: number; // 创建者ID
  ownerAddress?: string; // 当前拥有者地址
  contractAuctionId: number; // 合约里面拍卖列表索引
  nftId?: string; // NFT唯一标识
  nftAddress: string; // NFT合约地址
  tokenId: number; // NFT的Token ID
  contractName?: string; // 合约名称
  contractSymbol?: string; // 合约符号
  tokenURI?: string; // Token URI
  nftName: string; // NFT名称
  image?: string; // NFT图片URL
  description?: string; // NFT描述
  metadata?: string; // 完整元数据JSON
  status: 'pending' | 'active' | 'ended' | 'cancelled'; // 状态
  onlineLock?: string; // NFT在线标志
  online?: number; // 1表示在线 其他值表示下线
  startTime: string; // 开始时间
  startTimestamp: number; // 开始时间时间戳（Unix 时间戳，秒）
  endTime: string; // 结束时间
  endTimestamp: number; // 结束时间时间戳（Unix 时间戳，秒）
  startPrice: number; // 起拍价
  paymentToken: string; // 起拍价链上交易代币地址
  startPriceUSD: number; // 起拍价USD
  startPriceUnitUSD: number; // 起拍价USD预言机价格（小数点起拍价USD*10**8）
  highestBidder?: string; // 最高出价者地址
  highestBidPaymentToken?: string; // 最高出价使用链上交易代币地址
  highestBid?: string; // 最高出价金额
  highestBidUSD?: number; // 最高出价USD
  highestBidUnitUSD?: number; // 最高出价USD预言机价格（小数点最高价USD*10**8）
  bidCount: number; // 出价次数
  createdAt?: string; // 创建时间
  updatedAt?: string; // 更新时间
  user?: { // 关联用户信息（可选）
    id: number;
    username: string;
    walletAddress: string;
  };
}

export interface Bid {
  id: number;
  auctionId: number;
  userId: number;
  amount: string;
  amountUSD: number;
  paymentToken: string;
  transactionHash: string;
  blockNumber: number;
  isHighest: boolean;
  createdAt: string;
  bidder: {
    id: number;
    username: string;
    walletAddress: string;
  };
}

export interface AuctionPayload {
  nftId: string;
  nftAddress: string;
  tokenId: number;
  paymentToken: string;
  startPrice: number;
  startPriceUSD?: number;
  startTime: string;
  endTime: string;
}

export interface BidPayload {
  auctionId: number;
  amount: string;
  paymentToken?: string;
}

