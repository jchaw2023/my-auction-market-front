import { useState } from 'react';
import { Row, Col, Pagination, Card, Tag, Alert, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { auctionApi } from '@/services/api';
import Loading from '@/components/Common/Loading';
import Empty from '@/components/Common/Empty';
import TextWithTooltip from '@/components/Common/TextWithTooltip';
import { formatUSD, getCountdown, formatAddress } from '@/utils/format';
import { PLACEHOLDER_IMAGE } from '@/utils/placeholder';
import { useTokenStore } from '@/store/tokenStore';
import './Home.css';

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

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getTokenSymbol } = useTokenStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'active', 'ended'

  // 获取拍卖统计数据
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['auctionSimpleStats'],
    queryFn: () => auctionApi.getAuctionSimpleStats(),
    staleTime: 60000, // 1分钟缓存
    refetchInterval: 60000, // 每分钟自动刷新
  });

  // 使用新的公开拍卖列表 API，后端已实现排序逻辑（active 在前，ended 在后，每个状态内按时间倒序）
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicAuctions', page, pageSize, statusFilter],
    queryFn: () => {
      // 使用新的公开拍卖列表 API，传递状态筛选参数
      return auctionApi.getPublicAuctions({
        page,
        pageSize,
        status: statusFilter,
      });
    },
    staleTime: 30000,
  });

  const handleCardClick = (auctionId: number) => {
    navigate(`/auction/${auctionId}`);
  };

  // 后端已实现排序和筛选，直接使用返回的数据
  // data 结构: { success: true, data: { page, pageSize, total, data: [...] } }
  const processedAuctions = data?.data?.data || [];
  const totalCount = data?.data?.total || 0;
  
  // 调试日志
  if (process.env.NODE_ENV === 'development') {
    console.log('Home page data:', { data, processedAuctions, totalCount, isLoading, error });
  }

  // 使用从API获取的统计数据，如果没有则使用默认值
  const stats = statsData?.data || {
    totalAuctionsCreated: 0,
    totalBidsPlaced: 0,
    totalValueLocked: 0,
    totalValueLockedStr: '0.00',
  };

  return (
    <div className="home-page">
      {/* 全站指标展示和筛选器 - 统一模块 */}
      <div className="home-stats-filter-module">
        <div className="home-stats-filter-content">
          <Row gutter={[16, 0]} className="home-stats-row">
            <Col xs={24} sm={8}>
              <div className="home-stat-item">
                <div className="home-stat-label">{t('home.totalAuctions')}</div>
                <div className="home-stat-value">
                  {statsLoading ? '...' : stats.totalAuctionsCreated.toLocaleString()}
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div className="home-stat-item">
                <div className="home-stat-label">{t('home.totalBids')}</div>
                <div className="home-stat-value">
                  {statsLoading ? '...' : stats.totalBidsPlaced.toLocaleString()}
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div className="home-stat-item">
                <div className="home-stat-label">{t('home.totalValueLocked')}</div>
                <div className="home-stat-value">
                  {statsLoading ? '...' : formatUSD(stats.totalValueLocked)}
                </div>
              </div>
            </Col>
          </Row>

          {/* 状态筛选器 */}
          <div className="home-filter-section">
            <span className="home-filter-label">{t('home.filterByStatus', { defaultValue: '筛选' })}:</span>
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1); // 切换筛选器时重置到第一页
              }}
              className="home-filter-select"
              size="middle"
            >
              <Select.Option value="all">{t('home.allStatus', { defaultValue: '全部状态' })}</Select.Option>
              <Select.Option value="active">{t('home.active', { defaultValue: '进行中' })}</Select.Option>
              <Select.Option value="ended">{t('home.ended', { defaultValue: '已结束' })}</Select.Option>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          message="加载失败"
          description={error instanceof Error ? error.message : '无法加载拍卖列表，请稍后重试'}
          type="error"
          showIcon
          closable
          action={
            <ReloadOutlined
              onClick={() => refetch()}
              style={{ fontSize: '16px', cursor: 'pointer' }}
            />
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {isLoading ? (
        <Loading />
      ) : processedAuctions.length > 0 ? (
        <>
          <Row gutter={[24, 24]}>
            {processedAuctions.map((auction: any) => {
              const countdown = getCountdown(auction.endTime);
              const highestBidAmount = parseFloat(auction.highestBid || '0');
              // 确保 startPrice 统一显示为4位小数
              const startPriceStr = auction.startPrice != null 
                ? (typeof auction.startPrice === 'number' 
                    ? auction.startPrice.toFixed(4) 
                    : parseFloat(String(auction.startPrice)).toFixed(4))
                : '0.0000';
              // startPriceUSD 可能是字符串或数字
              const startPriceUSDValue = auction.startPriceUSD != null 
                ? (typeof auction.startPriceUSD === 'number' ? auction.startPriceUSD : parseFloat(String(auction.startPriceUSD)))
                : 0;
              // 确保 highestBid 统一显示为4位小数
              const highestBidStr = auction.highestBid != null 
                ? (typeof auction.highestBid === 'number' 
                    ? auction.highestBid.toFixed(4) 
                    : parseFloat(String(auction.highestBid)).toFixed(4))
                : '0.0000';
              // highestBidUSD 可能是字符串或数字
              const highestBidUSDValue = auction.highestBidUSD != null 
                ? (typeof auction.highestBidUSD === 'number' ? auction.highestBidUSD : parseFloat(String(auction.highestBidUSD)))
                : 0;
              
              return (
              <Col xs={24} sm={12} md={8} lg={6} key={auction.auctionId || auction.id}>
                  <Card
                    hoverable
                    className="home-auction-card"
                    cover={
                      <div 
                        className="home-auction-image-container"
                        onClick={() => handleCardClick(auction.auctionId || String(auction.id))}
                      >
                        <img
                          alt={auction.nftName || `NFT #${auction.tokenId}`}
                          src={auction.image || ''}
                          className="home-auction-image"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                          }}
                        />
                        <div className="home-auction-token-id">
                          #{auction.tokenId}
                        </div>
                      </div>
                    }
                    onClick={() => handleCardClick(auction.auctionId || String(auction.id))}
                  >
                    <Card.Meta
                      title={
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <TextWithTooltip
                              text={auction.nftName || `NFT #${auction.tokenId}`}
                              style={{ flex: 1, fontWeight: 500 }}
                            />
                            <Tag color={getStatusColor(auction.status)} style={{ marginLeft: 8 }}>
                              {auction.status === 'pending' ? t('dashboard.pending', { defaultValue: '待上架' }) :
                               auction.status === 'active' ? t('home.active', { defaultValue: '进行中' }) :
                               auction.status === 'ended' ? t('home.ended', { defaultValue: '已结束' }) :
                               auction.status === 'cancelled' ? t('home.cancelled', { defaultValue: '已取消' }) :
                               auction.status}
                            </Tag>
                          </div>
                          {auction.nftAddress && (
                            <div className="home-auction-ca">
                              <span className="home-auction-ca-label">CA</span>
                              <TextWithTooltip
                                text={auction.nftAddress}
                                style={{ fontFamily: 'monospace' }}
                              >
                                {formatAddress(auction.nftAddress, 4)}
                              </TextWithTooltip>
                            </div>
                          )}
                        </div>
                      }
                      description={
                        <div className="home-auction-description">
                          {/* 倒计时区域 - 所有状态都显示，保持高度一致 */}
                          <div className={`home-auction-countdown ${auction.status === 'ended' || countdown.isExpired ? 'home-auction-countdown-ended' : ''}`}>
                            {auction.status === 'active' && !countdown.isExpired ? (
                              <span>
                                {t('auction.endsIn')}: {countdown.days}{t('auction.days')} {countdown.hours}{t('auction.hours')} {countdown.minutes}{t('auction.minutes')}
                              </span>
                            ) : (
                              <span>{t('auction.ended', { defaultValue: '已结束' })}</span>
                            )}
                          </div>
                          <div className="home-auction-price-section">
                            <div className="home-auction-price-item">
                              <span className="home-auction-price-label">{t('auction.currentBid')}</span>
                              <div className="home-auction-price-value">
                                <strong className={highestBidAmount > 0 ? 'home-auction-price-highlight' : ''}>
                                  {highestBidStr} {getTokenSymbol(auction.highestBidPaymentToken || auction.paymentToken)}
                                </strong>
                                {highestBidUSDValue > 0 && (
                                  <span className="home-auction-price-usd">≈ {formatUSD(highestBidUSDValue)}</span>
                                )}
                              </div>
                            </div>
                            <div className="home-auction-price-item">
                              <span className="home-auction-price-label">{t('auction.floorPrice')}</span>
                              <div className="home-auction-price-value">
                                <strong>{startPriceStr} {getTokenSymbol(auction.paymentToken)}</strong>
                                {startPriceUSDValue > 0 && (
                                  <span className="home-auction-price-usd">≈ {formatUSD(startPriceUSDValue)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="home-auction-stats">
                            <span>{auction.bidCount || 0} {t('auction.bids')}</span>
                          </div>
                        </div>
                      }
                    />
                  </Card>
              </Col>
              );
            })}
          </Row>

          <div className="pagination-container">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={totalCount}
              onChange={(p, s) => {
                setPage(p);
                setPageSize(s || 12);
              }}
              onShowSizeChange={(current, size) => {
                setPageSize(size);
                setPage(1);
              }}
              showSizeChanger
              pageSizeOptions={['12', '24', '48']}
              showTotal={(total) => `共 ${total} 个`}
            />
          </div>
        </>
      ) : (
        <Empty description={t('home.noAuctions')} />
      )}
    </div>
  );
}

