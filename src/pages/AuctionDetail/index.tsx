import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, Button, Input, Table, message, Tag, Space, Typography, Divider, Alert, Select } from 'antd';
import { CopyOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { auctionApi, bidApi } from '@/services/api';
import { formatETH, formatUSD, formatTime, formatAddress, getCountdown } from '@/utils/format';
import { useWalletStore } from '@/store/walletStore';
import { useTokenStore } from '@/store/tokenStore';
import { PLACEHOLDER_IMAGE_LARGE } from '@/utils/placeholder';
import Loading from '@/components/Common/Loading';
import TextWithTooltip from '@/components/Common/TextWithTooltip';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import {
  placeBid,
  waitForTransaction,
  formatContractError,
  cancelUserAuction,
} from '@/services/contract';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MessageType } from '@/services/websocket';
import getWebSocketService from '@/services/websocket';
import './AuctionDetail.css';

const { Title } = Typography;

export default function AuctionDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, address: walletAddress } = useWalletStore();
  const { defaultToken, getTokenSymbol, tokens } = useTokenStore();
  const queryClient = useQueryClient();
  const [bidAmount, setBidAmount] = useState<number | undefined>(undefined);
  const [bidAmountInput, setBidAmountInput] = useState<string>('');
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<string>(defaultToken?.address || '');
  const [bidsPage, setBidsPage] = useState(1);
  const [bidsPageSize, setBidsPageSize] = useState(30);
  const [bidAmountDisplayMode, setBidAmountDisplayMode] = useState<'token' | 'usd'>('token'); // 金额显示模式：token 或 usd

  const { data: auctionData, isLoading: auctionLoading } = useQuery({
    queryKey: ['auction-detail', id],
    queryFn: () => {
      if (!id) throw new Error('Auction ID is required');
      return auctionApi.getAuctionById(id);
    },
    enabled: !!id,
  });

  const { data: bidsData, isLoading: bidsLoading } = useQuery({
    queryKey: ['bid-details', id, bidsPage, bidsPageSize],
    queryFn: () => {
      if (!id) throw new Error('Auction ID is required');
      return bidApi.getBidDetailsByAuctionId(id, { page: bidsPage, pageSize: bidsPageSize });
    },
    enabled: !!id,
  });

  const [isBidding, setIsBidding] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // 取消拍卖处理函数
  const handleCancelAuction = async () => {
    if (!displayAuction || !id) {
      message.error(t('auction.auctionNotFound'));
      return;
    }

    const contractAuctionId = displayAuction.contractAuctionId;
    if (!contractAuctionId) {
      message.error(t('auction.auctionIdNotFound'));
      return;
    }

    // 确认取消
    const confirmed = window.confirm(t('auction.confirmCancelAuction'));
    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    try {
      // 1. 在链上取消拍卖
      message.loading({ content: t('auction.cancellingAuction'), key: 'cancel', duration: 0 });
      
      const cancelTx = await cancelUserAuction(Number(contractAuctionId));
      
      // 2. 等待交易确认
      message.loading({ content: t('auction.waitingForTransaction'), key: 'cancel', duration: 0 });
      const receipt = await waitForTransaction(cancelTx);
      
      if (!receipt) {
        throw new Error(t('error.operationFailed'));
      }

      // 3. 调用后端 API 同步数据
      message.loading({ content: t('auction.syncingData'), key: 'cancel', duration: 0 });
      await auctionApi.cancelAuction(id);

      // 4. 更新数据（使用 exact: false 来匹配所有包含这些 key 的查询）
      queryClient.invalidateQueries({ queryKey: ['auction-detail', id], exact: false });
      queryClient.invalidateQueries({ queryKey: ['bid-details', id], exact: false });

      message.success({
        content: t('auction.auctionCancelled'),
        key: 'cancel',
        duration: 3,
      });

      // 可选：跳转到我的拍卖页面
      // navigate('/my-auctions');
    } catch (error: any) {
      console.error('Cancel auction error:', error);
      const errorMsg = formatContractError(error);
      message.error({
        content: `${t('auction.cancelAuctionFailed')}: ${errorMsg}`,
        key: 'cancel',
        duration: 5,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // 后端出价 mutation（用于同步数据）
  const bidMutation = useMutation({
    mutationFn: (payload: { auctionId: number; amount: string; paymentToken: string }) =>
      bidApi.createBid({
        auctionId: payload.auctionId,
        amount: payload.amount,
        paymentToken: payload.paymentToken,
      }),
    onSuccess: () => {
      console.log('出价同步成功，刷新列表');
      // 使用 exact: false 来匹配所有包含这些 key 的查询（包括分页参数）
      queryClient.invalidateQueries({ queryKey: ['auction-detail', id], exact: false });
      queryClient.invalidateQueries({ queryKey: ['bid-details', id], exact: false });
    },
    onError: (error: any) => {
      console.error(t('auction.syncBidFailed'), error);
      // 不显示错误，因为链上交易已经成功
    },
  });

  const auction = auctionData?.data;
  const bids = bidsData?.data?.data || [];
  const bidsTotal = bidsData?.data?.total || 0;

  const [countdown, setCountdown] = useState(
    auction ? getCountdown(auction.endTime) : null
  );

  useEffect(() => {
    if (!auction) return;

    const timer = setInterval(() => {
      setCountdown(getCountdown(auction.endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  // 初始化选中的支付代币为默认代币（ETH）
  useEffect(() => {
    if (defaultToken && !selectedPaymentToken) {
      setSelectedPaymentToken(defaultToken.address);
    }
  }, [defaultToken, selectedPaymentToken]);

  // WebSocket 订阅和监听
  const wsService = getWebSocketService();
  const { onMessage, isConnected: wsConnected } = useWebSocket(true);

  // 订阅该拍卖的出价消息（监听连接状态变化，确保连接建立后自动订阅）
  useEffect(() => {
    if (!id) {
      return;
    }

    const roomID = `auction:${id}`;

    // 如果已连接，立即订阅
    if (wsConnected && wsService.isConnected()) {
      wsService.subscribeRoom(roomID);
      if (import.meta.env.DEV) {
        console.log(`📥 订阅房间: ${roomID} (连接已建立)`);
      }
    }

    // 清理函数：离开页面时取消订阅
    return () => {
      if (wsService.isConnected()) {
        wsService.unsubscribeRoom(roomID);
      }
    };
  }, [id, wsConnected, wsService]);

  // 监听订阅成功/失败消息
  useEffect(() => {
    if (!id) return;

    const roomID = `auction:${id}`;
    
    // 监听订阅成功消息
    const unsubscribeSubscribeSuccess = onMessage(MessageType.SUBSCRIBE_SUCCESS, (msg) => {
      const data = msg.data;
      if (data && data.room_id === roomID) {
        // 订阅成功，可以在这里添加日志或状态更新
        if (import.meta.env.DEV) {
          console.log(`✅ 成功订阅房间: ${roomID}`);
        }
      }
    });

    // 监听取消订阅成功消息
    const unsubscribeUnsubscribeSuccess = onMessage(MessageType.UNSUBSCRIBE_SUCCESS, (msg) => {
      const data = msg.data;
      if (data && data.room_id === roomID) {
        // 取消订阅成功，可以在这里添加日志
        if (import.meta.env.DEV) {
          console.log(`✅ 成功取消订阅房间: ${roomID}`);
        }
      }
    });

    return () => {
      unsubscribeSubscribeSuccess();
      unsubscribeUnsubscribeSuccess();
    };
  }, [id, onMessage]);

  // 监听出价消息
  useEffect(() => {
    if (!id) return;

    // 监听该拍卖的出价消息
    const unsubscribe = onMessage(MessageType.AUCTION_BID_PLACED, (msg) => {
      const bidData = msg.data;
      // 后端返回的字段是 auctionId（小写），不是 auctionID
      const bidAuctionId = bidData?.auctionId || bidData?.auctionID;
      
      // 只处理当前拍卖的出价
      if (bidData && bidAuctionId === id) {
        console.log('收到出价消息，刷新列表:', { bidAuctionId, currentId: id, bidData });
        
        // 使用 exact: false 来匹配所有包含这些 key 的查询（包括分页参数）
        // 更新出价列表
        queryClient.invalidateQueries({ queryKey: ['bid-details', id], exact: false });
        // 更新拍卖详情（更新 bid_count 等）
        queryClient.invalidateQueries({ queryKey: ['auction-detail', id], exact: false });
        
        // 如果是当前用户的出价，重置 isBidding 状态，使按钮重新可用
        if (walletAddress && bidData.bidder && 
            walletAddress.toLowerCase() === bidData.bidder.toLowerCase()) {
          setIsBidding(false);
        }
        
        // 可选：显示通知
        message.success({
          content: `新的出价: ${bidData.amount} ${bidData.paymentTokenSymbol || 'ETH'}`,
          duration: 3,
        });
      } else if (bidData) {
        // 调试：记录不匹配的情况
        console.log('出价消息不匹配当前拍卖:', { bidAuctionId, currentId: id });
      }
    });

    return unsubscribe;
  }, [id, onMessage, queryClient, walletAddress]);

  // 使用真实 API 数据
  const displayAuction = auction;
  const displayBids = bids;

  const handleBid = async () => {
    // 如果 bidAmount 未定义，尝试从输入字符串解析
    let finalBidAmount = bidAmount;
    if (finalBidAmount === undefined && bidAmountInput) {
      const parsed = parseFloat(bidAmountInput);
      if (!isNaN(parsed) && parsed > 0) {
        finalBidAmount = parsed;
      }
    }
    
    if (finalBidAmount === undefined || finalBidAmount <= 0) {
      message.warning(t('auction.pleaseEnterValidBid'));
      return;
    }

    // 使用实际 API 数据
    if (!displayAuction) {
      message.warning(t('auction.auctionNotFound'));
      return;
    }

    // 检查出价是否高于当前最高价
    const highestBidStr = displayAuction.highestBid || '0';
    const currentHighestBid = parseFloat(highestBidStr) > 1000000 
      ? parseFloat(formatETH(highestBidStr))
      : parseFloat(highestBidStr);
    if (finalBidAmount <= currentHighestBid) {
      message.warning(t('auction.bidMustBeHigher'));
      return;
    }
    const contractAuctionId = displayAuction?.contractAuctionId;
    console.log('contractAuctionId', contractAuctionId);
    if (!contractAuctionId) {
      message.error(t('auction.auctionIdNotFound'));
      return;
    }
    setIsBidding(true);
    try {
      // 1. 在链上出价
      message.loading({ content: t('auction.submittingBid'), key: 'bid', duration: 0 });
      
      const paymentToken = selectedPaymentToken || defaultToken?.address || '';
      if (!paymentToken) {
        throw new Error('Payment token is required');
      }
      const bidTx = await placeBid(Number(contractAuctionId), paymentToken, finalBidAmount);

      // 等待交易确认
      const receipt = await waitForTransaction(bidTx);
      if (receipt) {
        message.success({ 
          content: t('auction.bidSuccessWithHash', { hash: `${receipt.hash.slice(0, 10)}...` }), 
          key: 'bid' 
        });

        // 2. 同步数据到后端
        const selectedToken = tokens.find(t => t.address.toLowerCase() === paymentToken.toLowerCase());
        const decimals = selectedToken?.symbol === 'USDC' ? 6 : 18; // USDC 是 6 位小数，ETH 是 18 位
        const amountWei = paymentToken === defaultToken?.address || paymentToken === '0x0' || !paymentToken
          ? ethers.parseEther(finalBidAmount.toString()).toString()
          : ethers.parseUnits(finalBidAmount.toString(), decimals).toString();

        bidMutation.mutate({
          auctionId: Number(id),
          amount: amountWei,
          paymentToken: paymentToken || '',
        });

        setBidAmount(undefined);
        setBidAmountInput('');
      }
    } catch (error: any) {
      console.error(t('auction.bidFailed'), error);
      const errorMsg = formatContractError(error);
      message.error({ 
        content: t('auction.bidFailedWithError', { error: errorMsg }), 
        key: 'bid',
        duration: 5 
      });
    } finally {
      setIsBidding(false);
    }
  };


  // 复制地址到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t('message.copiedToClipboard'));
  };

  if (auctionLoading) {
    return (
      <div className="auction-detail-page">
        <Loading />
      </div>
    );
  }

  // 出价记录表格列（只显示：时间、金额、币种、出价钱包）
  const bidColumns = [
    {
      title: <span style={{ fontSize: '12px', fontWeight: 500 }}>{t('auction.time')}</span>,
      dataIndex: 'createdAt',
      key: 'time',
      width: 140,
      align: 'center' as const,
      render: (time: string) => (
        <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: '#1a1a1a' }}>{formatTime(time)}</span>
      ),
    },
    {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>{t('auction.amount')}</span>
          <Button
            type="text"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => setBidAmountDisplayMode(bidAmountDisplayMode === 'token' ? 'usd' : 'token')}
            style={{ 
              padding: 0, 
              height: 'auto', 
              fontSize: '11px',
              color: '#1890ff',
              minWidth: 'auto'
            }}
            title={bidAmountDisplayMode === 'token' ? '切换到美元显示' : '切换到代币显示'}
          />
        </div>
      ),
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'center' as const,
      render: (amount: string, record: any) => {
        if (bidAmountDisplayMode === 'usd') {
          // 显示美元金额
          return (
            <span style={{ fontWeight: 500, color: '#1a1a1a', fontSize: '12px' }}>
              {record.amountUSD > 0 ? formatUSD(record.amountUSD) : '-'}
            </span>
          );
        } else {
          // 显示代币金额（默认）
          const amountStr = typeof amount === 'string' ? amount : String(amount);
          const amountValue = parseFloat(amountStr);
          const displayAmount = amountValue > 1000000 
            ? formatETH(amountStr) 
            : amountStr;
          
          return (
            <span style={{ fontWeight: 500, color: '#1a1a1a', fontSize: '12px' }}>
              {displayAmount}
            </span>
          );
        }
      },
    },
    {
      title: <span style={{ fontSize: '12px', fontWeight: 500 }}>{t('auction.currency')}</span>,
      dataIndex: 'paymentToken',
      key: 'paymentToken',
      width: 60,
      align: 'center' as const,
      render: (token: string, record: any) => {
        if (bidAmountDisplayMode === 'usd') {
          // 显示美元时，币种列显示 USD
          return <Tag color="green" style={{ fontSize: '11px', padding: '0 4px', lineHeight: '18px', margin: 0 }}>USD</Tag>;
        } else {
          // 显示代币时，币种列显示对应的代币符号
          const paymentToken = token || record.paymentToken || displayAuction?.paymentToken || defaultToken?.address;
          const tokenSymbol = record.paymentTokenSymbol || getTokenSymbol(paymentToken);
          return <Tag color="blue" style={{ fontSize: '11px', padding: '0 4px', lineHeight: '18px', margin: 0 }}>{tokenSymbol}</Tag>;
        }
      },
    },
    {
      title: <span style={{ fontSize: '12px', fontWeight: 500 }}>出价钱包</span>,
      dataIndex: ['bidder', 'walletAddress'],
      key: 'walletAddress',
      width: 140,
      align: 'left' as const,
      render: (address: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TextWithTooltip text={address} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {formatAddress(address, 4)}
          </TextWithTooltip>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(address)}
            style={{ padding: 0, height: 'auto', fontSize: '11px' }}
          />
        </div>
      ),
    },
  ];

  const isAuctionActive = displayAuction?.status === 'active' && !countdown?.isExpired;
  const isAuctionEnded = displayAuction?.status === 'ended' || countdown?.isExpired;
  const isAuctionNotStarted = displayAuction?.status !== 'active' && !isAuctionEnded;
  const canBid = isAuctionActive && isConnected && !isBidding;
  
  // 获取不能出价的原因提示
  const getBidDisabledReason = () => {
    if (!isConnected) {
      return t('auction.pleaseConnectWalletToBid');
    }
    if (isAuctionEnded) {
      return t('auction.auctionEndedCannotBid');
    }
    if (isAuctionNotStarted) {
      return t('auction.auctionNotStarted');
    }
    if (isBidding) {
      return t('auction.submittingBid');
    }
    return null;
  };
  
  const bidDisabledReason = getBidDisabledReason();
  
  // 获取卖家地址：使用 sellerWalletAddress 或 user.walletAddress 或 ownerAddress
  const sellerAddress = (displayAuction as any)?.sellerWalletAddress || 
                        displayAuction?.user?.walletAddress || 
                        displayAuction?.ownerAddress;
  
  // 检查当前用户是否是卖家
  const isSeller = isConnected && walletAddress && sellerAddress && 
                   walletAddress.toLowerCase() === sellerAddress.toLowerCase();
  
  // 检查是否可以取消（卖家且拍卖未结束且未取消）
  const canCancel = isSeller && 
                    displayAuction?.status !== 'ended' && 
                    displayAuction?.status !== 'cancelled' &&
                    !isCancelling;

  if (!displayAuction) {
    return (
      <div className="auction-detail-page">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          {t('error.auctionNotFound')}
        </div>
      </div>
    );
  }

  return (
    <div className="auction-detail-page">
      <Row gutter={[16, 16]} className="auction-detail-main">
        {/* 左侧：NFT 图片、信息、出价功能 */}
        <Col xs={24} lg={14}>
          <Card className="auction-detail-info-card">
            {/* 返回按钮和标题 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={3} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                {displayAuction.nftName || (displayAuction as any).name || `NFT #${displayAuction.tokenId}`}
              </Title>
              <Button 
                onClick={() => navigate(-1)} 
                type="text"
                size="small"
                className="auction-detail-back-button"
                style={{ padding: '2px 6px', height: 'auto', fontSize: '12px' }}
              >
                ← {t('common.back')}
              </Button>
            </div>

            {/* NFT 图片和描述信息并排 */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={10} md={9}>
                <img
                  src={displayAuction.image || ''}
                  alt={displayAuction.nftName || `NFT #${displayAuction.tokenId}`}
                  style={{ 
                    width: '100%', 
                    height: 'auto', 
                    borderRadius: '6px',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_LARGE;
                  }}
                />
              </Col>
              <Col xs={24} sm={14} md={15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* NFT 描述 - 板块化 */}
                  {(displayAuction as any).description && (
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#fafafa', 
                      borderRadius: '4px',
                      border: '1px solid #f0f0f0'
                    }}>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 6 }}>{t('auction.description')}</div>
                      <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.6 }}>
                        {(displayAuction as any).description || '-'}
                      </div>
                    </div>
                  )}
                  
                  {/* 基本信息 - 板块化 */}
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#fafafa', 
                    borderRadius: '4px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 8 }}>{t('auction.basicInfo')}</div>
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px 16px',
                      fontSize: '13px',
                      color: '#1a1a1a'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#8c8c8c', fontSize: '12px', minWidth: '40px' }}>{t('auction.tokenId')}</span>
                        <span style={{ fontWeight: 500 }}>#{displayAuction.tokenId}</span>
                      </div>
                      {(displayAuction as any).contractSymbol && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#8c8c8c', fontSize: '12px', minWidth: '40px' }}>{t('auction.contractSymbol')}</span>
                          <span style={{ fontWeight: 500 }}>${(displayAuction as any).contractSymbol}</span>
                        </div>
                      )}
                      {displayAuction.nftAddress && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#8c8c8c', fontSize: '12px', minWidth: '40px' }}>{t('auction.contractAddress')}</span>
                          <TextWithTooltip text={displayAuction.nftAddress || (displayAuction as any).contractAddress} style={{ fontFamily: 'monospace' }}>
                            {formatAddress(displayAuction.nftAddress || (displayAuction as any).contractAddress || '', 4)}
                          </TextWithTooltip>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(displayAuction.nftAddress || (displayAuction as any).contractAddress || '')}
                            style={{ padding: 0, height: 'auto', fontSize: '11px' }}
                          />
                        </div>
                      )}
                      {sellerAddress && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#8c8c8c', fontSize: '12px', minWidth: '40px' }}>{t('auction.owner')}</span>
                          <TextWithTooltip text={sellerAddress} style={{ fontFamily: 'monospace' }}>
                            {formatAddress(sellerAddress, 4)}
                          </TextWithTooltip>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => copyToClipboard(sellerAddress)}
                            style={{ padding: 0, height: 'auto', fontSize: '11px' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            {/* 取消拍卖按钮（卖家可见） */}
            {canCancel && (
              <div style={{ marginBottom: '12px' }}>
                <Button
                  danger
                  onClick={handleCancelAuction}
                  loading={isCancelling}
                  disabled={isCancelling}
                  style={{ width: '100%' }}
                >
                  {t('auction.cancelAuction')}
                </Button>
              </div>
            )}

            {/* 拍卖信息和出价功能并排 */}
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={[12, 12]} style={{ display: 'flex', alignItems: 'stretch' }}>
              {/* 左侧：拍卖信息 */}
              <Col xs={24} sm={16} style={{ display: 'flex' }}>
                <Card 
                  size="small" 
                  title={<span style={{ fontSize: '13px', fontWeight: 600 }}>{t('auction.auctionInfo')}</span>}
                  style={{ marginBottom: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 倒计时/已结束提示 - 放在最上面 */}
                    {(() => {
                      if (countdown && !countdown.isExpired) {
                        return (
                          <div style={{ 
                            padding: '8px 12px', 
                            backgroundColor: '#fff1f0', 
                            borderRadius: '4px',
                            border: '1px solid #ffccc7'
                          }}>
                            <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.timeRemaining')}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ff4d4f' }}>
                              {countdown.days > 0 && `${countdown.days}${t('common.days')} `}
                              {countdown.hours > 0 && `${countdown.hours}${t('common.hours')} `}
                              {countdown.minutes > 0 && `${countdown.minutes}${t('common.minutes')} `}
                              {countdown.seconds >= 0 && `${countdown.seconds}${t('common.seconds')}`}
                            </div>
                          </div>
                        );
                      }
                      if (countdown?.isExpired) {
                        return (
                          <div style={{ 
                            padding: '8px 12px', 
                            backgroundColor: '#f5f5f5', 
                            borderRadius: '4px',
                            border: '1px solid #d9d9d9'
                          }}>
                            <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.status')}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#8c8c8c' }}>
                              {t('auction.ended')}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* 开始时间 | 结束时间 (并排) */}
                    {(() => {
                      const startTime = displayAuction.startTime 
                        ? formatTime(displayAuction.startTime, 'YYYY-MM-DD HH:mm:ss')
                        : (displayAuction as any).startTimestamp 
                          ? formatTime(new Date((displayAuction as any).startTimestamp * 1000), 'YYYY-MM-DD HH:mm:ss')
                          : null;
                      const endTime = displayAuction.endTime 
                        ? formatTime(displayAuction.endTime, 'YYYY-MM-DD HH:mm:ss')
                        : (displayAuction as any).endTimestamp 
                          ? formatTime(new Date((displayAuction as any).endTimestamp * 1000), 'YYYY-MM-DD HH:mm:ss')
                          : null;
                      
                      if (!startTime && !endTime) return null;
                      
                      return (
                        <div style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#fafafa', 
                          borderRadius: '4px',
                          border: '1px solid #f0f0f0'
                        }}>
                          <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 8 }}>{t('auction.timeInfo')}</div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            {startTime && (
                              <div style={{ flex: '1 1 0', minWidth: '160px' }}>
                                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.startTime')}</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                                  {startTime}
                                </div>
                              </div>
                            )}
                            {endTime && (
                              <div style={{ flex: '1 1 0', minWidth: '160px' }}>
                                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.endTime')}</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                                  {endTime}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* 当前出价 | 地板价 (并排) */}
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#fafafa', 
                      borderRadius: '4px',
                      border: '1px solid #f0f0f0'
                    }}>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 8 }}>{t('auction.priceInfo')}</div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.currentBid')}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: parseFloat(displayAuction.highestBid || '0') > 0 ? '#1890ff' : '#1a1a1a' }}>
                            {parseFloat(displayAuction.highestBid || '0') > 0 
                              ? (typeof displayAuction.highestBid === 'string' && parseFloat(displayAuction.highestBid) > 1000000
                                  ? formatETH(displayAuction.highestBid)
                                  : displayAuction.highestBid)
                              : '0'}{' '}
                            <span style={{ fontSize: '13px', fontWeight: 400 }}>
                              {parseFloat(displayAuction.highestBid || '0') > 0 && displayAuction.highestBidPaymentToken
                                ? getTokenSymbol(displayAuction.highestBidPaymentToken)
                                : getTokenSymbol(displayAuction.paymentToken || defaultToken?.address || '')}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                            ≈ {formatUSD(displayAuction.highestBidUSD ?? 0)}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.floorPrice')}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                            {typeof displayAuction.startPrice === 'string' 
                              ? displayAuction.startPrice 
                              : String(displayAuction.startPrice)}{' '}
                            <span style={{ fontSize: '13px', fontWeight: 400 }}>{getTokenSymbol(displayAuction.paymentToken || defaultToken?.address || '')}</span>
                          </div>
                          {(displayAuction.startPriceUSD ?? 0) > 0 && (
                            <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                              ≈ {formatUSD(displayAuction.startPriceUSD ?? 0)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>

              {/* 右侧：出价功能区域 */}
              <Col xs={24} sm={8} style={{ display: 'flex' }}>
                <Card 
                  size="small" 
                  title={<span style={{ fontSize: '13px', fontWeight: 600 }}>{t('auction.placeBid')}</span>}
                  style={{ marginBottom: 0, width: '100%', display: 'flex', flexDirection: 'column' }}
                  bodyStyle={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 当前出价信息提示 */}
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#e6f7ff', 
                      borderRadius: '4px',
                      border: '1px solid #91d5ff'
                    }}>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 4 }}>{t('auction.currentBid')}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                        {parseFloat(displayAuction.highestBid || '0') > 0 
                          ? (typeof displayAuction.highestBid === 'string' && parseFloat(displayAuction.highestBid) > 1000000
                              ? formatETH(displayAuction.highestBid)
                              : displayAuction.highestBid)
                          : '0'}{' '}
                        <span style={{ fontSize: '13px', fontWeight: 400 }}>
                          {parseFloat(displayAuction.highestBid || '0') > 0 && displayAuction.highestBidPaymentToken
                            ? getTokenSymbol(displayAuction.highestBidPaymentToken)
                            : getTokenSymbol(displayAuction.paymentToken || defaultToken?.address || '0x0000000000000000000000000000000000000000')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#8c8c8c', marginLeft: 6 }}>
                          (≈ {formatUSD(displayAuction.highestBidUSD ?? 0)})
                        </span>
                      </div>
                    </div>

                    {/* 状态提示信息 */}
                    {bidDisabledReason && (
                      <Alert
                        message={bidDisabledReason}
                        type={isAuctionEnded ? 'error' : 'warning'}
                        showIcon
                        style={{ fontSize: '12px' }}
                      />
                    )}

                    {/* 支付代币选择 */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 6 }}>{t('auction.selectPaymentToken')}</div>
                      <Select
                        value={selectedPaymentToken}
                        onChange={(value) => setSelectedPaymentToken(value)}
                        disabled={!canBid || isBidding || tokens.length === 0}
                        style={{ width: '100%' }}
                        size="middle"
                        placeholder={t('auction.selectPaymentToken')}
                      >
                        {tokens.length > 0 ? (
                          tokens.map((token) => (
                            <Select.Option key={token.address} value={token.address}>
                              {token.symbol} - {token.name}
                            </Select.Option>
                          ))
                        ) : (
                          defaultToken && (
                            <Select.Option key={defaultToken.address} value={defaultToken.address}>
                              {defaultToken.symbol} - {defaultToken.name}
                            </Select.Option>
                          )
                        )}
                      </Select>
                    </div>

                    {/* 出价输入区域 */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 6 }}>{t('auction.enterBidAmountPlaceholder')}</div>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          type="text"
                          placeholder={t('auction.enterBidAmountPlaceholder')}
                          value={bidAmountInput}
                          onChange={(e) => {
                            if (!canBid || isBidding) return;
                            const value = e.target.value.trim();
                            setBidAmountInput(value);
                            
                            // 允许空值、单个小数点、或有效数字
                            if (value === '' || value === '.') {
                              setBidAmount(undefined);
                              return;
                            }
                            
                            // 验证是否为有效数字格式（允许小数点）
                            const numRegex = /^-?\d*\.?\d*$/;
                            if (numRegex.test(value)) {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue) && numValue > 0) {
                                setBidAmount(numValue);
                              } else {
                                setBidAmount(undefined);
                              }
                            }
                          }}
                          onPressEnter={canBid && !isBidding ? handleBid : undefined}
                          disabled={!canBid || isBidding}
                          size="middle"
                          prefix={
                            <span style={{ color: '#8c8c8c', marginRight: 4, fontSize: '12px' }}>
                              {getTokenSymbol(selectedPaymentToken || defaultToken?.address || '')}
                            </span>
                          }
                        />
                        <Button
                          type="primary"
                          onClick={handleBid}
                          disabled={!canBid || isBidding || (bidAmount === undefined && (!bidAmountInput || parseFloat(bidAmountInput) <= 0))}
                          loading={isBidding}
                          size="middle"
                          style={{ minWidth: 70, fontSize: '12px', padding: '0 12px' }}
                        >
                          {t('auction.placeBid')}
                        </Button>
                      </Space.Compact>
                      
                      {/* 预估USD价值 */}
                      {(() => {
                        const displayAmount = bidAmount || (bidAmountInput ? parseFloat(bidAmountInput) : undefined);
                        return displayAmount !== undefined && displayAmount > 0 && !isNaN(displayAmount) && canBid ? (
                          <div style={{ marginTop: 4, fontSize: '11px', color: '#8c8c8c' }}>
                            ≈ {formatUSD(displayAmount * ((displayAuction.startPriceUSD ?? 0) / parseFloat(String(displayAuction.startPrice || 1))))}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* 快速出价按钮 */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 6 }}>{t('auction.quickBid')}</div>
                      <Space wrap>
                        {(() => {
                          const currentBid = parseFloat(displayAuction.highestBid || '0') > 0 
                            ? (typeof displayAuction.highestBid === 'string' && parseFloat(displayAuction.highestBid) > 1000000
                                ? parseFloat(formatETH(displayAuction.highestBid || '0'))
                                : parseFloat(displayAuction.highestBid || '0'))
                            : parseFloat(String(displayAuction.startPrice || 0));
                          const quickBidOptions = [
                            { label: '+5%', multiplier: 1.05 },
                            { label: '+10%', multiplier: 1.10 },
                            { label: '+20%', multiplier: 1.20 },
                          ];
                          return quickBidOptions.map((option) => (
                            <Button
                              key={option.label}
                              size="small"
                              onClick={() => {
                                if (!canBid || isBidding) return;
                                const newBid = currentBid * option.multiplier;
                                setBidAmount(newBid);
                                setBidAmountInput(newBid.toString());
                              }}
                              disabled={!canBid || isBidding}
                              style={{ fontSize: '12px', padding: '0 8px', height: '24px' }}
                            >
                              {option.label}
                            </Button>
                          ));
                        })()}
                      </Space>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧：出价记录 */}
        <Col xs={24} lg={10}>
          <Card 
            title={<span style={{ fontSize: '14px', fontWeight: 600 }}>{t('auction.bidRecords')}</span>} 
            style={{ marginBottom: 0 }}
            bodyStyle={{ padding: '12px' }}
          >
            {bidsLoading ? (
              <Loading />
            ) : displayBids.length > 0 ? (
              <Table
                columns={bidColumns}
                dataSource={displayBids}
                rowKey="id"
                size="small"
                pagination={{
                  current: bidsPage,
                  pageSize: bidsPageSize,
                  total: bidsTotal,
                  showSizeChanger: true,
                  showTotal: (total) => <span style={{ fontSize: '11px' }}>{t('auction.totalRecords', { total })}</span>,
                  size: 'small',
                  onChange: (page, pageSize) => {
                    setBidsPage(page);
                    setBidsPageSize(pageSize);
                  },
                  onShowSizeChange: (_current, size) => {
                    setBidsPage(1);
                    setBidsPageSize(size);
                  },
                }}
                style={{ fontSize: '12px' }}
                className="compact-bid-table"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: '#8c8c8c', fontSize: '13px' }}>
                {t('auction.noBidRecords')}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

