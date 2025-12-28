import { useState } from 'react';
import { Tabs, Row, Col, Card, Tag, message, Tooltip } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { auctionApi } from '@/services/api';
import Loading from '@/components/Common/Loading';
import Empty from '@/components/Common/Empty';
import { useWalletStore } from '@/store/walletStore';
import { useTokenStore } from '@/store/tokenStore';
import { formatUSD } from '@/utils/format';
import dayjs from 'dayjs';
import { formatAddress } from '@/utils/format';

export default function AuctionHistory() {
  const { t } = useTranslation();
  const { isConnected } = useWalletStore();
  const { getTokenSymbol } = useTokenStore();
  const [status, setStatus] = useState<string>('all');
  const [page] = useState(1);
  const pageSize = 12;

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(t('dashboard.copied', { defaultValue: '已复制到剪贴板' }));
    }).catch(() => {
      message.error(t('dashboard.copyFailed', { defaultValue: '复制失败' }));
    });
  };

  // 根据状态过滤条件
  const statusFilter = status === 'all' ? undefined : [status];

  // 使用真实 API 获取拍卖历史
  const { data, isLoading } = useQuery({
    queryKey: ['auction-history', page, status],
    queryFn: () => {
      return auctionApi.getAuctionHistory({ 
        page, 
        pageSize,
        status: statusFilter
      });
    },
    enabled: isConnected, // 需要连接钱包
  });

  // 需要连接钱包
  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p>{t('dashboard.pleaseConnectWalletToView', { defaultValue: '请连接钱包查看' })}</p>
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  const auctions = data?.data?.data || [];

  // 获取状态标签颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'active':
        return 'green';
      case 'ended':
        return 'default';
      case 'cancelled':
        return 'red';
      default:
        return 'blue';
    }
  };

  // 计算剩余时间（天、时、分、秒）
  const getTimeRemaining = (endTime: string | null | undefined): { days: number; hours: number; minutes: number; seconds: number; isExpired: boolean } | null => {
    if (!endTime) return null;
    const end = dayjs(endTime);
    const now = dayjs();
    const diff = end.diff(now, 'second');
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    return { days, hours, minutes, seconds, isExpired: false };
  };

  return (
    <div>
      <Tabs
        activeKey={status}
        onChange={setStatus}
        items={[
          { key: 'all', label: t('dashboard.all', { defaultValue: '全部' }) },
          { key: 'pending', label: t('dashboard.pending', { defaultValue: '待上架' }) },
          { key: 'active', label: t('home.active', { defaultValue: '进行中' }) },
          { key: 'ended', label: t('home.ended', { defaultValue: '已结束' }) },
          { key: 'cancelled', label: t('home.cancelled', { defaultValue: '已取消' }) },
        ]}
        style={{ marginBottom: 24 }}
      />

      {auctions.length > 0 ? (
        <Row gutter={[24, 24]}>
          {auctions.map((auction: any) => {
            const timeRemaining = getTimeRemaining(auction.endTime);
            const hasBids = auction.bidCount > 0;

            return (
              <Col xs={24} sm={12} md={8} lg={6} key={auction.auctionId}>
            <Card
              hoverable
              cover={
                <img
                  alt={auction.nftName || `NFT #${auction.tokenId}`}
                  src={auction.image || ''}
                  style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBzdHlsZT0iZG9taW5hbnQtYmFzZWxpbmU6IG1pZGRsZTsgdGV4dC1hbmNob3I6IG1pZGRsZTsgZm9udC1mYW1pbHk6IG1vbm9zcGFjZTsgZm9udC1zaXplOiAyMHB4OyBmaWxsOiAjMzMzOyI+TkZUIFBsYWNlaG9sZGVyPC90ZXh0Pjwvc3ZnPg==`;
                  }}
                />
              }
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Card.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {auction.nftName || `NFT #${auction.tokenId}`}
                    </span>
                    <Tag color={getStatusColor(auction.status)} style={{ marginLeft: 8 }}>
                      {auction.status === 'pending' ? t('dashboard.pending', { defaultValue: '待上架' }) :
                       auction.status === 'active' ? t('home.active', { defaultValue: '进行中' }) :
                       auction.status === 'ended' ? t('home.ended', { defaultValue: '已结束' }) :
                       auction.status === 'cancelled' ? t('home.cancelled', { defaultValue: '已取消' }) :
                       auction.status}
                    </Tag>
                  </div>
                }
                description={
                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* 上面内容部分 - 紧凑布局 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            <span style={{ color: '#666' }}>{t('dashboard.floorPrice', { defaultValue: '地板价' })}: </span>
                            <strong>
                              {auction.floorPrice ? (typeof auction.floorPrice === 'string' ? parseFloat(auction.floorPrice) : parseFloat(String(auction.floorPrice))) : 0} 
                              {' '}
                              {getTokenSymbol(auction.paymentToken || '')}
                            </strong>
                            {auction.floorPriceUSD && (typeof auction.floorPriceUSD === 'string' ? parseFloat(auction.floorPriceUSD) : parseFloat(String(auction.floorPriceUSD))) > 0 && (
                              <span style={{ marginLeft: '4px', color: '#999', fontSize: '11px' }}>
                                (≈ {formatUSD(typeof auction.floorPriceUSD === 'string' ? parseFloat(auction.floorPriceUSD) : parseFloat(String(auction.floorPriceUSD)))})
                              </span>
                            )}
                          </div>
                          {auction.endTime && (
                            <div>
                              {timeRemaining && !timeRemaining.isExpired ? (
                                <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
                                  {t('dashboard.daysRemaining', { defaultValue: '还剩' })} {timeRemaining.days}{t('auction.days', { defaultValue: '天' })}{timeRemaining.hours}{t('dashboard.hours', { defaultValue: '时' })}{timeRemaining.minutes}{t('dashboard.minutes', { defaultValue: '分' })}{timeRemaining.seconds}{t('auction.seconds', { defaultValue: '秒' })}
                                  <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                                    ({dayjs(auction.endTime).format('YYYY-MM-DD HH:mm:ss')})
                                  </span>
                                </span>
                              ) : (
                                <span style={{ color: '#666' }}>
                                  {t('dashboard.ended', { defaultValue: '已结束' })}
                                  <span style={{ marginLeft: '8px', color: '#999', fontSize: '11px' }}>
                                    ({dayjs(auction.endTime).format('YYYY-MM-DD HH:mm:ss')})
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* 分割线 */}
                        <div style={{ 
                          marginTop: '6px', 
                          marginBottom: '6px', 
                          borderTop: '1px solid #f0f0f0',
                          flexShrink: 0
                        }}></div>
                        {/* 下面出价部分 - 固定高度，始终与有全部出价内容的高度一样 */}
                        <div style={{ height: '70px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '4px' }}>
                          {/* 出价数必须显示 */}
                          <div>
                            <span style={{ color: '#666' }}>{t('dashboard.bidCount', { defaultValue: '出价次数' })}: </span>
                            <strong>{auction.bidCount || 0}</strong>
                          </div>
                          {/* 如果有出价，显示最高出价信息；如果没有，用占位元素保持高度 */}
                          {hasBids && auction.highestBid ? (
                            <>
                              <div>
                                <span style={{ color: '#666' }}>{t('dashboard.highestBid', { defaultValue: '最高出价' })}: </span>
                                <strong>
                                  {auction.highestBid ? (typeof auction.highestBid === 'string' ? parseFloat(auction.highestBid) : parseFloat(String(auction.highestBid))) : 0} 
                                  {' '}
                                  {getTokenSymbol(auction.highestBidPaymentToken || '')}
                                </strong>
                                {auction.highestBidUSD && (typeof auction.highestBidUSD === 'string' ? parseFloat(auction.highestBidUSD) : parseFloat(String(auction.highestBidUSD))) > 0 && (
                                  <span style={{ marginLeft: '4px', color: '#999', fontSize: '11px' }}>
                                    (≈ {formatUSD(typeof auction.highestBidUSD === 'string' ? parseFloat(auction.highestBidUSD) : parseFloat(String(auction.highestBidUSD)))})
                                  </span>
                                )}
                              </div>
                              {auction.highestBidder && (
                                <div>
                                  <span style={{ color: '#666' }}>{t('dashboard.bidderAddress', { defaultValue: '出价地址' })}: </span>
                                  <Tooltip title={auction.highestBidder}>
                                    <span style={{ cursor: 'pointer', color: '#666' }}>{formatAddress(auction.highestBidder, 10)}</span>
                                  </Tooltip>
                                  <CopyOutlined
                                    style={{
                                      fontSize: '12px',
                                      color: '#999',
                                      cursor: 'pointer',
                                      transition: 'color 0.2s',
                                      marginLeft: '4px'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#1890ff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = '#999')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(auction.highestBidder);
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div style={{ visibility: 'hidden', height: '20px' }}>
                                <span style={{ color: '#666' }}>{t('dashboard.highestBid', { defaultValue: '最高出价' })}: </span>
                                <strong>0 ETH</strong>
                              </div>
                              <div style={{ visibility: 'hidden', height: '16px', fontSize: '11px' }}>
                                {t('dashboard.bidderAddress', { defaultValue: '出价地址' })}: 0x0000...0000
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Empty description={t('dashboard.noAuctions', { defaultValue: '暂无拍卖记录' })} />
      )}
    </div>
  );
}

