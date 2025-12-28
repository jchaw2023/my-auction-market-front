import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, message, Tag, Button, Space, Modal, Form, Input, Select, DatePicker } from 'antd';
import { EditOutlined, RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { auctionApi } from '@/services/api';
import Loading from '@/components/Common/Loading';
import Empty from '@/components/Common/Empty';
import TextWithTooltip from '@/components/Common/TextWithTooltip';
import { useWalletStore } from '@/store/walletStore';
import { useTokenStore } from '@/store/tokenStore';
import { Auction, AuctionPayload } from '@/types';
import dayjs from 'dayjs';
import { createAuctionOnChain, formatContractError } from '@/services/contract';
import { formatUSD } from '@/utils/format';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MessageType } from '@/services/websocket';

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

// 格式化日期
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

export default function MyAuctions() {
  const { t } = useTranslation();
  const { isConnected } = useWalletStore();
  const { tokens, defaultToken, getTokenSymbol } = useTokenStore();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<string>(
    defaultToken?.address || ''
  );
  const [page] = useState(1);
  const pageSize = 12;

  // WebSocket 监听
  const { onMessage } = useWebSocket(true);

  // 当 defaultToken 加载后更新 selectedPaymentToken
  useEffect(() => {
    if (defaultToken && !selectedPaymentToken) {
      setSelectedPaymentToken(defaultToken.address);
    }
  }, [defaultToken, selectedPaymentToken]);

  // 获取我的拍卖列表（只显示 pending 和 active 状态）
  const { data, isLoading } = useQuery({
    queryKey: ['my-auctions', page],
    queryFn: () => auctionApi.getMyAuctions({ 
      page, 
      pageSize,
      status: ['pending', 'active']
    }),
    enabled: isConnected,
  });

  // ========== WebSocket 监听拍卖创建事件 ==========
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.AUCTION_CREATED, async (msg) => {
      const auctionData = msg.data;
      if (!auctionData) {
        return;
      }

      const { tokenId } = auctionData;

      try {
        // 刷新拍卖列表，显示更新后的状态（从 pending 变为 active）
        await queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
        
        message.success({
          content: t('dashboard.auctionCreatedSuccess', { 
            defaultValue: '拍卖已成功上架！',
            tokenId: tokenId 
          }),
          duration: 3,
        });
      } catch (error: any) {
        console.error('Failed to refresh auction list:', error);
        // 即使刷新失败，也显示成功消息
        message.success({
          content: t('dashboard.auctionCreatedSuccess', { 
            defaultValue: '拍卖已成功上架！',
            tokenId: tokenId 
          }),
          duration: 3,
        });
      }
    });

    return unsubscribe;
  }, [onMessage, queryClient, t]);

  // 更新拍卖 mutation
  const updateAuctionMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<AuctionPayload> }) => {
      return auctionApi.updateAuction(payload.id, payload.data);
    },
    onSuccess: () => {
      message.success(t('dashboard.updateAuctionSuccess', { defaultValue: '拍卖更新成功' }));
      form.resetFields();
      setEditModalVisible(false);
      setSelectedAuctionId(null);
      setSelectedAuction(null);
      queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['auction-detail'] });
    },
    onError: (error: any) => {
      message.error(t('dashboard.updateAuctionFailed', { defaultValue: '更新拍卖失败' }) + ': ' + error.message);
    },
  });

  // 获取拍卖详情（用于编辑）
  const { data: auctionDetail, isLoading: isLoadingDetail, error: auctionDetailError } = useQuery({
    queryKey: ['auction-detail', selectedAuctionId],
    queryFn: () => auctionApi.getAuctionById(selectedAuctionId!),
    enabled: selectedAuctionId !== null,
  });

  // 当获取到拍卖详情后，填充表单
  useEffect(() => {
    if (auctionDetail?.data) {
      const auction = auctionDetail.data;
      // 只有待上架（pending）状态的拍卖可以编辑
      if (auction.status === 'pending') {
        setSelectedAuction(auction);
        const tokenAddress = auction.paymentToken || defaultToken?.address || '';
        setSelectedPaymentToken(tokenAddress);
        form.setFieldsValue({
          paymentToken: tokenAddress,
          startPrice: auction.startPrice,
          startTime: auction.startTime ? dayjs(auction.startTime) : undefined,
          endTime: auction.endTime ? dayjs(auction.endTime) : undefined,
        });
        setEditModalVisible(true);
      } else {
        message.warning(t('dashboard.cannotEditAuction', { 
          defaultValue: '只有待上架状态的拍卖可以编辑',
          status: auction.status 
        }));
        setSelectedAuctionId(null);
      }
    }
  }, [auctionDetail, form, t]);

  // 处理获取详情失败
  useEffect(() => {
    if (auctionDetailError) {
      message.error(t('dashboard.getAuctionFailed', { defaultValue: '获取拍卖详情失败' }) + ': ' + (auctionDetailError as any).message);
      setSelectedAuctionId(null);
    }
  }, [auctionDetailError, t]);

  // 处理编辑按钮点击
  const handleEdit = (auction: Auction) => {
    // 只有待上架（pending）状态的拍卖可以编辑
    if (auction.status === 'pending') {
      // 使用 auction.auctionId（字符串类型）来调用 API
      if (auction.auctionId) {
        setSelectedAuctionId(auction.auctionId);
      // 详情将通过 useQuery 获取并填充表单
      } else {
        message.error(t('dashboard.getAuctionFailed', { defaultValue: '获取拍卖ID失败' }));
      }
    } else {
      message.warning(t('dashboard.cannotEditAuction', { 
        defaultValue: '只有待上架状态的拍卖可以编辑',
        status: auction.status 
      }));
    }
  };

  // 上架拍卖 mutation（先获取最新信息，再调用合约）
  const publishAuctionMutation = useMutation({
    mutationFn: async (auctionId: string) => {
      // 1. 根据拍卖ID获取最新报价信息
      const response = await auctionApi.getAuctionById(auctionId);
      if (!response.success || !response.data) {
        throw new Error('获取拍卖信息失败');
      }
      return response.data;
    },
    onSuccess: async (auction) => {
      try {
        // 2. 检查拍卖状态
        if (auction.status !== 'pending') {
          message.error(t('dashboard.cannotPublishAuction', { 
            defaultValue: '只有待上架状态的拍卖可以上架',
            status: auction.status 
          }));
          return;
        }

        // 3. 准备合约调用参数
        const nftAddress = auction.nftAddress;
        const tokenId = auction.tokenId;
        const startPriceUnitUSD = auction.startPriceUnitUSD || 0;
        const startTimestamp = auction.startTimestamp || 0;
        const endTimestamp = auction.endTimestamp || 0;

        if (!nftAddress || !tokenId || !startPriceUnitUSD || !startTimestamp || !endTimestamp) {
          message.error(t('dashboard.missingAuctionInfo', { 
            defaultValue: '拍卖信息不完整，无法上架' 
          }));
          return;
        }

        // 4. 显示加载提示
        message.loading({
          content: t('dashboard.publishingAuction', { defaultValue: '正在上架拍卖...' }),
          key: 'publish-auction',
          duration: 0
        });

        // 5. 调用合约创建拍卖（内部已等待交易确认）
        await createAuctionOnChain(
          nftAddress,
          tokenId,
          startPriceUnitUSD,
          startTimestamp,
          endTimestamp
        );

        // 6. 交易确认成功
        message.success({
          content: t('dashboard.publishAuctionSuccess', { defaultValue: '拍卖上架成功' }),
          key: 'publish-auction',
          duration: 3
        });

        // 7. 刷新列表
        await queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
        await queryClient.invalidateQueries({ queryKey: ['auction-detail'] });
      } catch (error: any) {
        console.error('上架拍卖失败:', error);
        const errorMsg = formatContractError(error);
        message.error({
          content: `${t('dashboard.publishAuctionFailed', { defaultValue: '上架拍卖失败' })}: ${errorMsg}`,
          key: 'publish-auction',
          duration: 5
        });
      }
    },
    onError: (error: any) => {
      message.error({
        content: `${t('dashboard.publishAuctionFailed', { defaultValue: '上架拍卖失败' })}: ${error.message}`,
        key: 'publish-auction',
        duration: 5
      });
    }
  });

  // 处理上架按钮点击
  const handlePublish = (auction: Auction) => {
    if (!auction.auctionId) {
      message.error(t('dashboard.getAuctionFailed', { defaultValue: '获取拍卖ID失败' }));
      return;
    }
    publishAuctionMutation.mutate(auction.auctionId);
  };

  // 处理表单提交
  const handleSubmit = (values: any) => {
    if (!selectedAuction) return;

    const payload: Partial<AuctionPayload> = {
      paymentToken: values.paymentToken || defaultToken?.address,
      startPrice: parseFloat(values.startPrice),
      startTime: values.startTime.toISOString(),
      endTime: values.endTime.toISOString(),
    };

    if (!selectedAuction.auctionId) {
      message.error(t('dashboard.getAuctionFailed', { defaultValue: '获取拍卖ID失败' }));
      return;
    }
    updateAuctionMutation.mutate({ id: selectedAuction.auctionId, data: payload });
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p>{t('dashboard.pleaseConnectWallet', { defaultValue: '请连接钱包' })}</p>
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  const auctions = data?.data?.data || [];

  if (auctions.length === 0) {
    return <Empty description={t('dashboard.noMyAuctions', { defaultValue: '您还没有创建任何拍卖' })} />;
  }

  return (
    <>
      <Row gutter={[24, 24]}>
        {auctions.map((auction: Auction) => (
          <Col xs={24} sm={12} md={8} lg={6} key={auction.auctionId || `auction-${auction.tokenId}-${auction.nftAddress}`}>
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
            >
              <Card.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TextWithTooltip
                      text={auction.nftName || `NFT #${auction.tokenId}`}
                      style={{ flex: 1 }}
                    />
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
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#666' }}>{t('dashboard.startPrice', { defaultValue: '起拍价' })}: </span>
                      <strong>{typeof auction.startPrice === 'number' ? auction.startPrice : parseFloat(String(auction.startPrice || '0'))} {getTokenSymbol(auction.paymentToken)}</strong>
                      {auction.startPriceUSD != null && (() => {
                        const startPriceUSDValue = typeof auction.startPriceUSD === 'number' 
                          ? auction.startPriceUSD 
                          : parseFloat(String(auction.startPriceUSD || '0'));
                        return startPriceUSDValue > 0 ? (
                          <span style={{ marginLeft: '4px', color: '#999', fontSize: '11px' }}>
                            (≈ {formatUSD(startPriceUSDValue)})
                          </span>
                        ) : null;
                      })()}
                    </div>
                    {auction.highestBid && (typeof auction.highestBid === 'string' ? parseFloat(auction.highestBid) : (typeof auction.highestBid === 'number' ? auction.highestBid : parseFloat(String(auction.highestBid)))) > 0 && (
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#666' }}>{t('dashboard.highestBid', { defaultValue: '最高出价' })}: </span>
                        <strong>
                          {typeof auction.highestBid === 'string' ? auction.highestBid : String(auction.highestBid)} 
                          {' '}
                          {getTokenSymbol((auction as any).highestBidPaymentToken || auction.paymentToken)}
                        </strong>
                        {auction.highestBidUSD != null && (() => {
                          const highestBidUSDValue = typeof auction.highestBidUSD === 'number' 
                            ? auction.highestBidUSD 
                            : parseFloat(String(auction.highestBidUSD || '0'));
                          return highestBidUSDValue > 0 ? (
                            <span style={{ marginLeft: '4px', color: '#999', fontSize: '11px' }}>
                              (≈ {formatUSD(highestBidUSDValue)})
                            </span>
                          ) : null;
                        })()}
                      </div>
                    )}
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#666' }}>{t('dashboard.bidCount', { defaultValue: '出价次数' })}: </span>
                      {auction.bidCount}
                    </div>
                    <div style={{ marginBottom: '4px', color: '#999', fontSize: '11px' }}>
                      {t('dashboard.startTime', { defaultValue: '开始' })}: {formatDate(auction.startTime)}
                    </div>
                    <div style={{ color: '#999', fontSize: '11px' }}>
                      {t('dashboard.endTime', { defaultValue: '结束' })}: {formatDate(auction.endTime)}
                    </div>
                  </div>
                }
              />
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                {auction.status === 'pending' ? (
                  <Space size="small" style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(auction)}
                      >
                      {t('dashboard.updatePrice', { defaultValue: '更新报价' })}
                      </Button>
                      <Button
                        type="primary"
                        icon={<RocketOutlined />}
                        onClick={() => handlePublish(auction)}
                        loading={publishAuctionMutation.isPending}
                      >
                      {t('dashboard.publishAuction', { defaultValue: '上架拍卖' })}
                      </Button>
                  </Space>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
                    {auction.status === 'active' && t('dashboard.cannotEditActiveAuction', { defaultValue: '拍卖进行中，无法编辑' })}
                    {auction.status === 'ended' && t('dashboard.auctionEnded', { defaultValue: '拍卖已结束' })}
                    {auction.status === 'cancelled' && t('dashboard.auctionCancelled', { defaultValue: '拍卖已取消' })}
                  </div>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 更新报价弹窗 */}
      <Modal
        title={t('dashboard.updatePriceTitle', { defaultValue: '更新报价' })}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedAuctionId(null);
          setSelectedAuction(null);
          setSelectedPaymentToken(defaultToken?.address || '');
          form.resetFields();
        }}
        footer={null}
        width={600}
        confirmLoading={isLoadingDetail}
      >
        {isLoadingDetail ? (
          <Loading />
        ) : selectedAuction ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              paymentToken: selectedAuction.paymentToken || defaultToken?.address || '',
              startPrice: selectedAuction.startPrice,
            }}
          >
            <Form.Item label={t('dashboard.selectedNFT', { defaultValue: '选中的 NFT' })}>
              <Input
                value={selectedAuction.nftName || `NFT #${selectedAuction.tokenId}`}
                disabled
              />
            </Form.Item>

            <Form.Item
              name="paymentToken"
              label={t('dashboard.paymentToken', { defaultValue: '支付代币' })}
              rules={[{ required: true, message: t('dashboard.paymentTokenRequired', { defaultValue: '请选择支付代币' }) }]}
            >
              <Select
                value={selectedPaymentToken}
                onChange={(value) => {
                  setSelectedPaymentToken(value);
                  // 清空价格字段，让用户重新输入
                  form.setFieldsValue({
                    startPrice: undefined,
                  });
                }}
              >
                {tokens.map((token) => (
                  <Select.Option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="startPrice"
              label={t('dashboard.startPrice', { 
                defaultValue: `起始价格 (${getTokenSymbol(selectedPaymentToken)})` 
              })}
              rules={[{ required: true, message: t('dashboard.startPriceRequired', { defaultValue: '请输入起始价格' }) }]}
            >
              <Input 
                type="number" 
                step="0.00000001" 
                placeholder={`0.1 ${getTokenSymbol(selectedPaymentToken)}`}
                min="0"
              />
            </Form.Item>

            <Form.Item
              name="startTime"
              label={t('dashboard.startTime', { defaultValue: '开始时间' })}
              rules={[{ required: true, message: t('dashboard.startTimeRequired', { defaultValue: '请选择开始时间' }) }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="endTime"
              label={t('dashboard.endTime', { defaultValue: '结束时间' })}
              rules={[{ required: true, message: t('dashboard.endTimeRequired', { defaultValue: '请选择结束时间' }) }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateAuctionMutation.isPending}
                block
              >
                {t('dashboard.save', { defaultValue: '保存' })}
              </Button>
            </Form.Item>
          </Form>
        ) : null}
      </Modal>
    </>
  );
}

