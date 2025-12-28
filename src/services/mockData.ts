import { Auction, Bid, NFT } from '@/types';
import { getPlaceholderImage } from '@/utils/placeholder';

// 模拟 NFT 数据
export const mockNFTs: NFT[] = [
  {
    id: 1,
    tokenId: 1,
    name: 'Cool Ape #1',
    image: getPlaceholderImage(400, 400, 'Cool Ape #1'),
    description: 'A cool ape NFT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
  {
    id: 2,
    tokenId: 2,
    name: 'Cool Ape #2',
    image: getPlaceholderImage(400, 400, 'Cool Ape #2'),
    description: 'Another cool ape NFT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
  {
    id: 3,
    tokenId: 3,
    name: 'Cool Ape #3',
    image: getPlaceholderImage(400, 400, 'Cool Ape #3'),
    description: 'Yet another cool ape NFT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
];

// 模拟拍卖数据
export const mockAuctions: Auction[] = [
  {
    id: 1,
    contractAuctionId: 0,
    nftAddress: '0x1234567890123456789012345678901234567890',
    tokenId: 1,
    nftName: 'Cool Ape #1',
    nftImage: getPlaceholderImage(400, 400, 'Cool Ape #1'),
    startPrice: '1000000000000000000', // 1 ETH
    startPriceUSD: 2500,
    paymentToken: '0x0000000000000000000000000000000000000000',
    startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    endTime: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
    status: 'active',
    highestBid: '1500000000000000000', // 1.5 ETH
    highestBidUSD: 3750,
    highestBidder: '0x1111111111111111111111111111111111111111',
    bidCount: 5,
    floorPrice: '1000000000000000000',
    floorPriceUSD: 2500,
    seller: {
      id: 1,
      username: 'seller1',
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    },
  },
  {
    id: 2,
    contractAuctionId: 1,
    nftAddress: '0x1234567890123456789012345678901234567890',
    tokenId: 2,
    nftName: 'Cool Ape #2',
    nftImage: getPlaceholderImage(400, 400, 'Cool Ape #2'),
    startPrice: '2000000000000000000', // 2 ETH
    startPriceUSD: 5000,
    paymentToken: '0x0000000000000000000000000000000000000000',
    startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    endTime: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    status: 'active',
    highestBid: '2500000000000000000', // 2.5 ETH
    highestBidUSD: 6250,
    highestBidder: '0x2222222222222222222222222222222222222222',
    bidCount: 3,
    floorPrice: '2000000000000000000',
    floorPriceUSD: 5000,
    seller: {
      id: 2,
      username: 'seller2',
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    },
  },
  {
    id: 3,
    contractAuctionId: 2,
    nftAddress: '0x1234567890123456789012345678901234567890',
    tokenId: 3,
    nftName: 'Cool Ape #3',
    nftImage: getPlaceholderImage(400, 400, 'Cool Ape #3'),
    startPrice: '500000000000000000', // 0.5 ETH
    startPriceUSD: 1250,
    paymentToken: '0x0000000000000000000000000000000000000000',
    startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    endTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    status: 'ended',
    highestBid: '800000000000000000', // 0.8 ETH
    highestBidUSD: 2000,
    highestBidder: '0x3333333333333333333333333333333333333333',
    bidCount: 8,
    floorPrice: '500000000000000000',
    floorPriceUSD: 1250,
    seller: {
      id: 3,
      username: 'seller3',
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    },
  },
];

// 模拟出价数据
export const mockBids: Record<number, Bid[]> = {
  1: [
    {
      id: 1,
      auctionId: 1,
      userId: 10,
      amount: '1100000000000000000', // 1.1 ETH
      amountUSD: 2750,
      paymentToken: '0x0000000000000000000000000000000000000000',
      transactionHash: '0xaaa111',
      blockNumber: 12345678,
      isHighest: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      bidder: {
        id: 10,
        username: 'bidder1',
        walletAddress: '0x4444444444444444444444444444444444444444',
      },
    },
    {
      id: 2,
      auctionId: 1,
      userId: 11,
      amount: '1200000000000000000', // 1.2 ETH
      amountUSD: 3000,
      paymentToken: '0x0000000000000000000000000000000000000000',
      transactionHash: '0xbbb222',
      blockNumber: 12345679,
      isHighest: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      bidder: {
        id: 11,
        username: 'bidder2',
        walletAddress: '0x5555555555555555555555555555555555555555',
      },
    },
    {
      id: 3,
      auctionId: 1,
      userId: 12,
      amount: '1500000000000000000', // 1.5 ETH
      amountUSD: 3750,
      paymentToken: '0x0000000000000000000000000000000000000000',
      transactionHash: '0xccc333',
      blockNumber: 12345680,
      isHighest: true,
      createdAt: new Date(Date.now() - 600000).toISOString(),
      bidder: {
        id: 12,
        username: 'bidder3',
        walletAddress: '0x1111111111111111111111111111111111111111',
      },
    },
  ],
  2: [
    {
      id: 4,
      auctionId: 2,
      userId: 13,
      amount: '2200000000000000000', // 2.2 ETH
      amountUSD: 5500,
      paymentToken: '0x0000000000000000000000000000000000000000',
      transactionHash: '0xddd444',
      blockNumber: 12345681,
      isHighest: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      bidder: {
        id: 13,
        username: 'bidder4',
        walletAddress: '0x6666666666666666666666666666666666666666',
      },
    },
    {
      id: 5,
      auctionId: 2,
      userId: 14,
      amount: '2500000000000000000', // 2.5 ETH
      amountUSD: 6250,
      paymentToken: '0x0000000000000000000000000000000000000000',
      transactionHash: '0xeee555',
      blockNumber: 12345682,
      isHighest: true,
      createdAt: new Date(Date.now() - 900000).toISOString(),
      bidder: {
        id: 14,
        username: 'bidder5',
        walletAddress: '0x2222222222222222222222222222222222222222',
      },
    },
  ],
};

// 模拟用户拥有的 NFT
export const mockUserNFTs: NFT[] = [
  {
    id: 4,
    tokenId: 4,
    name: 'My Ape #4',
    image: getPlaceholderImage(400, 400, 'My Ape #4'),
    description: 'My cool ape NFT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
  {
    id: 5,
    tokenId: 5,
    name: 'My Ape #5',
    image: getPlaceholderImage(400, 400, 'My Ape #5'),
    description: 'Another my cool ape NFT',
    contractAddress: '0x1234567890123456789012345678901234567890',
    owner: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  },
];

