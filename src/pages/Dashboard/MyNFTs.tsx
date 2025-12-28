import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Row, Col, Card, message, Modal, Form, Input, Select, DatePicker, Button, Tag, Progress, Spin } from 'antd';
import { RocketOutlined, SafetyOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { nftApi, auctionApi } from '@/services/api';
import Empty from '@/components/Common/Empty';
import TextWithTooltip from '@/components/Common/TextWithTooltip';
import { useWalletStore } from '@/store/walletStore';
import { useTokenStore } from '@/store/tokenStore';
import { AuctionPayload } from '@/types';
import {
  approveNFT,
  waitForTransaction,
  formatContractError,
} from '@/services/contract';
import { formatAddress } from '@/utils/format';
import { CopyOutlined } from '@ant-design/icons';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MessageType } from '@/services/websocket';

// 获取状态标签颜色
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'holding':
      return 'blue';
    case 'selling':
      return 'orange';
    case 'sold':
      return 'green';
    case 'transfered':
      return 'default';
    default:
      return 'default';
  }
};

export default function MyNFTs() {
  const { t } = useTranslation();
  const { isConnected } = useWalletStore();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  const { tokens, defaultToken, getTokenSymbol } = useTokenStore();
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<string>(
    defaultToken?.address || ''
  );
  const [showProgress, setShowProgress] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'holding', 'selling', 'sold', 'transfered'

  // ========== 同步 NFT ==========
  const syncMutation = useMutation({
    mutationFn: () => {
      // 开始同步时显示进度条
      setShowProgress(true);
      return nftApi.syncNFTs();
    },
    onSuccess: async (data) => {
      message.success(
        t('dashboard.syncSuccess', {
          total: data.data.totalSynced,
          defaultValue: `成功同步 ${data.data.totalSynced} 个 NFT`,
        })
      );
      // 关闭进度条
      setShowProgress(false);
      // 等待后端数据写入后刷新列表
      await new Promise(resolve => setTimeout(resolve, 500));
      await queryClient.fetchQuery({
        queryKey: ['my-nfts-list'],
        queryFn: () => nftApi.getMyNFTsList(),
      });
    },
    onError: (error: any) => {
      message.error(
        error.message || t('dashboard.syncFailed', { defaultValue: '同步失败，请稍后重试' })
      );
      // 关闭进度条
      setShowProgress(false);
    },
  });

  // ========== 获取 NFT 列表 ==========
  const { data, error } = useQuery({
    queryKey: ['my-nfts-list', statusFilter],
    queryFn: () => nftApi.getMyNFTsList({ status: statusFilter }),
    enabled: isConnected, // 连接钱包后即可加载列表，不依赖同步成功
  });

  // ========== WebSocket 监听 NFT 授权事件 ==========
  const { onMessage } = useWebSocket(true);
  
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.NFT_APPROVED, async (msg) => {
      const approvalData = msg.data;
      if (!approvalData || !approvalData.nftId) {
        return;
      }

      const { nftId } = approvalData;
      
      try {
        // 根据 nftId 获取单个 NFT 关系数据（更高效）
        const result = await nftApi.getMyNFTOwnershipByNFTID(nftId);
        
        if (result.success && result.data) {
          // 使所有 my-nfts-list 相关的查询失效，触发重新获取数据
          // 这样可以确保无论当前使用什么 statusFilter，都能获取到最新数据
          await queryClient.invalidateQueries({ 
            queryKey: ['my-nfts-list'],
            exact: false, // 匹配所有以 'my-nfts-list' 开头的 queryKey
          });

          message.success({
            content: t('dashboard.nftApprovalSuccessMessage', { defaultValue: 'NFT 授权成功！' }),
            duration: 3,
          });
        }
      } catch (error: any) {
        console.error('Failed to fetch NFT ownership:', error);
        // 即使获取单个 NFT 失败，也刷新整个列表以确保数据同步
        await queryClient.invalidateQueries({ 
          queryKey: ['my-nfts-list'],
          exact: false,
        });
        
        message.success({
          content: t('dashboard.nftApprovalSuccessMessage', { defaultValue: 'NFT 授权成功！' }),
          duration: 3,
        });
      }
    });

    return unsubscribe;
  }, [onMessage, queryClient, t]);

  // ========== 手动同步 NFT ==========
  const handleSyncNFTs = () => {
    if (syncMutation.isPending) {
      return; // 如果正在同步，不重复触发
    }
    syncMutation.mutate();
  };

  // 创建拍卖 mutation
  const createAuctionMutation = useMutation({
    mutationFn: (payload: AuctionPayload) => auctionApi.createAuction(payload),
    onSuccess: () => {
      message.success(t('dashboard.createAuctionSuccess', { defaultValue: '拍卖创建成功' }));
      form.resetFields();
      setModalVisible(false);
      setSelectedNFT(null);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
    },
    onError: (error: any) => {
      message.error(
        t('dashboard.createAuctionFailed', { defaultValue: '创建拍卖失败' }) + ': ' + error.message
      );
    },
  });

  // 处理创建拍卖按钮点击
  const handleCreateAuction = (nft: any) => {
    setSelectedNFT(nft);
    form.resetFields();
    const defaultTokenAddress = defaultToken?.address || '';
    setSelectedPaymentToken(defaultTokenAddress);
    form.setFieldsValue({
      paymentToken: defaultTokenAddress,
    });
    setModalVisible(true);
  };


  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(t('dashboard.copied', { defaultValue: '已复制到剪贴板' }));
    }).catch(() => {
      message.error(t('dashboard.copyFailed', { defaultValue: '复制失败' }));
    });
  };


  // 处理授权按钮点击
  const handleApproveNFT = async (nft: any) => {
    // 新的数据结构：nft 可能是 ownership.nft 或直接的 nft 对象
    const nftData = nft.nft || nft;
    const nftId = nft.nftId || nftData.nftId || nftData.id;
    if (!nftId) return;

    try {
      message.loading({ 
        content: t('dashboard.approvingNFT', { defaultValue: '正在授权 NFT...' }), 
        key: `approve-${nftId}`, 
        duration: 0 
      });
      const contractAddress = nftData.contractAddress || nft.contractAddress;
      const tokenId = nftData.tokenId || nft.tokenId;
      const approveTx = await approveNFT(contractAddress, tokenId);
      await waitForTransaction(approveTx);
      message.success({ 
        content: t('dashboard.nftApprovalSuccess', { defaultValue: 'NFT 授权成功' }), 
        key: `approve-${nftId}` 
      });
    } catch (error: any) {
      console.error('授权失败:', error);
      const errorMsg = formatContractError(error);
      message.error({ 
        content: `${t('dashboard.approvalFailed', { defaultValue: '授权失败' })}: ${errorMsg}`, 
        key: `approve-${nftId}`,
        duration: 5 
      });
    }
  };

  // 处理表单提交（只调用后端 API）
  const handleSubmit = async (values: any) => {
    if (!selectedNFT) {
      message.warning(t('dashboard.pleaseSelectNFT', { defaultValue: '请选择 NFT' }));
      return;
    }

    // 构建请求 payload
    // 新的数据结构：selectedNFT 可能是 ownership.nft 或直接的 nft 对象
    const nft = selectedNFT.nft || selectedNFT;
    const payload: AuctionPayload = {
      nftId: selectedNFT.nftId || nft.nftId || nft.id,
      nftAddress: nft.contractAddress || selectedNFT.contractAddress,
      tokenId: nft.tokenId || selectedNFT.tokenId,
      paymentToken: values.paymentToken || defaultToken?.address,
      startPrice: parseFloat(values.startPrice),
      startTime: values.startTime.toISOString(),
      endTime: values.endTime.toISOString(),
    };

    // 直接调用后端 API 创建拍卖
    createAuctionMutation.mutate(payload);
  };



  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p>{t('dashboard.pleaseConnectWallet')}</p>
      </div>
    );
  }

  // 如果 showProgress 为 true，显示透明遮罩层（不遮挡内容）

  // 如果同步失败，显示错误信息和重试按钮
  if (syncMutation.isError) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>
          {t('dashboard.syncFailed', { defaultValue: '同步失败' })}
        </p>
        <Button 
          type="primary" 
          onClick={handleSyncNFTs}
        >
          {t('dashboard.retrySync', { defaultValue: '重试同步' })}
        </Button>
      </div>
    );
  }

  // 如果列表查询出错，显示错误信息
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>
          {t('dashboard.loadFailed', { defaultValue: '加载失败' })}: {error.message}
        </p>
        <Button onClick={() => {
          queryClient.fetchQuery({
            queryKey: ['my-nfts-list'],
            queryFn: () => nftApi.getMyNFTsList(),
          });
        }}>
          {t('dashboard.retry', { defaultValue: '重试' })}
        </Button>
      </div>
    );
  }

  // 有数据，渲染 NFT 列表

  return (
    <>
      {/* 透明遮罩层（同步时显示） */}
      {showProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.6)', // 半透明白色背景
          backdropFilter: 'blur(2px)', // 背景模糊效果
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000, // 确保在最上层
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)', // 稍微不透明的白色背景
            padding: '32px 48px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            minWidth: '300px',
          }}>
            <Spin size="large" />
            <div style={{ width: '100%', maxWidth: '300px' }}>
              <Progress 
                percent={100} 
                status="active" 
                showInfo={false}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <p style={{ 
                marginTop: '16px', 
                color: '#666',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {syncMutation.isPending 
                  ? t('dashboard.syncingNFTs', { defaultValue: '正在同步 NFT 数据，请稍候...' })
                  : t('dashboard.loadingNFTs', { defaultValue: '正在加载 NFT 列表...' })
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 筛选器和同步按钮 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#595959', fontSize: '13px', fontWeight: 500 }}>
            {t('dashboard.filterByStatus', { defaultValue: '筛选' })}:
          </span>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
            }}
            style={{ minWidth: 140 }}
            size="middle"
          >
            <Select.Option value="all">{t('dashboard.all', { defaultValue: '全部' })}</Select.Option>
            <Select.Option value="holding">{t('dashboard.nftStatusHolding', { defaultValue: '持有' })}</Select.Option>
            <Select.Option value="selling">{t('dashboard.nftStatusSelling', { defaultValue: '售卖中' })}</Select.Option>
            <Select.Option value="sold">{t('dashboard.nftStatusSold', { defaultValue: '已出售' })}</Select.Option>
            <Select.Option value="transfered">{t('dashboard.nftStatusTransfered', { defaultValue: '已转出' })}</Select.Option>
          </Select>
        </div>
        <Button
          type="primary"
          icon={<SyncOutlined />}
          onClick={handleSyncNFTs}
          loading={syncMutation.isPending}
          disabled={syncMutation.isPending}
        >
          {t('dashboard.syncNFTs', { defaultValue: '同步 NFT' })}
        </Button>
      </div>

      {/* 如果没有数据，显示空状态 */}
      {!data?.data || data.data.length === 0 ? (
        <Empty description={t('dashboard.noNFTs')} />
      ) : (
        <Row gutter={[24, 24]}>
        {data.data.map((ownership: any) => {
        // 新的数据结构：ownership.nft 包含 NFT 元数据，ownership 包含关系信息
        const nft = ownership.nft || ownership;
        const nftId = ownership.nftId || nft?.nftId || nft?.id;
        const tokenId = nft?.tokenId || ownership.tokenId;
        const nftName = nft?.nftName || nft?.name;
        const image = nft?.image || '';
        const contractAddress = nft?.contractAddress || ownership.contractAddress;
        const isApproved = ownership.approved === true;
        const status = ownership.status || 'holding'; // 默认状态为 holding
        
        return (
          <Col xs={24} sm={12} md={8} lg={6} key={ownership.id || nftId}>
            <Card
              hoverable
              cover={
                <div style={{ position: 'relative' }}>
                <img
                    alt={nftName || `NFT #${tokenId}`}
                    src={image}
                  style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                  onError={(e) => {
                    // 如果图片加载失败，使用占位符
                    (e.target as HTMLImageElement).src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBzdHlsZT0iZG9taW5hbnQtYmFzZWxpbmU6IG1pZGRsZTsgdGV4dC1hbmNob3I6IG1pZGRsZTsgZm9udC1mYW1pbHk6IG1vbm9zcGFjZTsgZm9udC1zaXplOiAyMHB4OyBmaWxsOiAjMzMzOyI+TkZUIFBsYWNlaG9sZGVyPC90ZXh0Pjwvc3ZnPg==`;
                  }}
                />
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    #{tokenId}
                  </div>
                </div>
              }
            >
              <Card.Meta
                title={
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: 8,
                      gap: 8
                    }}>
                      <TextWithTooltip
                        text={nftName || `NFT #${tokenId}`}
                        maxWidth="100%"
                        style={{ 
                          fontWeight: 600, 
                          fontSize: '16px', 
                          flex: 1,
                          lineHeight: '1.5',
                          color: '#1a1a1a'
                        }}
                      />
                      <Tag 
                        color={getStatusColor(status)} 
                        style={{ 
                          marginLeft: 0,
                          fontSize: '12px',
                          fontWeight: 500,
                          padding: '2px 8px',
                          lineHeight: '20px',
                          flexShrink: 0
                        }}
                      >
                        {status === 'holding' ? t('dashboard.nftStatusHolding', { defaultValue: '持有' }) :
                         status === 'selling' ? t('dashboard.nftStatusSelling', { defaultValue: '售卖中' }) :
                         status === 'sold' ? t('dashboard.nftStatusSold', { defaultValue: '已出售' }) :
                         status === 'transfered' ? t('dashboard.nftStatusTransfered', { defaultValue: '已转出' }) :
                         status}
                      </Tag>
                    </div>
                    {contractAddress && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        marginTop: 4,
                        color: '#8c8c8c'
                      }}>
                        <span style={{ 
                          color: '#8c8c8c',
                          fontWeight: 400
                        }}>
                          {t('dashboard.contractAddressLabel', { defaultValue: 'CA:' })}
                        </span>
                        <TextWithTooltip
                          text={contractAddress}
                          style={{ 
                            fontFamily: 'monospace', 
                            color: '#1890ff',
                            fontSize: '12px',
                            fontWeight: 400
                          }}
                        >
                          {formatAddress(contractAddress, 10)}
                        </TextWithTooltip>
                        <CopyOutlined
                          style={{
                            fontSize: '13px',
                            color: '#bfbfbf',
                            cursor: 'pointer',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#1890ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#bfbfbf';
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(contractAddress);
                          }}
                        />
                      </div>
                    )}
                  </div>
                }
              />
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid #f0f0f0' 
              }}>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <Button
                    type={isApproved ? "default" : "default"}
                    icon={<SafetyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isApproved) {
                        handleApproveNFT(nft);
                      }
                    }}
                    disabled={isApproved}
                    style={{
                      fontWeight: 500,
                      fontSize: '14px',
                      flex: 1,
                      minWidth: 0,
                      height: '36px',
                      ...(isApproved ? {
                        backgroundColor: '#f6ffed',
                        borderColor: '#b7eb8f',
                        color: '#52c41a',
                        cursor: 'not-allowed',
                      } : {}),
                    }}
                  >
                    {isApproved 
                      ? t('dashboard.approved', { defaultValue: '已授权' })
                      : t('dashboard.approveNFT', { defaultValue: '授权' })
                    }
                  </Button>
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateAuction(nft);
                    }}
                    style={{
                      fontWeight: 500,
                      fontSize: '14px',
                      flex: 1,
                      minWidth: 0,
                      height: '36px',
                    }}
                  >
                    {t('dashboard.createAuction', { defaultValue: '报价' })}
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        );
      })}
      </Row>
      )}

      {/* 创建拍卖配置弹窗 */}
      <Modal
        title={t('dashboard.createAuction', { defaultValue: '创建拍卖' })}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedNFT(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedNFT && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              paymentToken: defaultToken?.address || '',
            }}
          >
            <Form.Item label={t('dashboard.selectedNFT', { defaultValue: '选中的 NFT' })}>
              <Input
                value={(selectedNFT.nft?.nftName || selectedNFT.nft?.name || selectedNFT.name) || `NFT #${selectedNFT.nft?.tokenId || selectedNFT.tokenId}`}
                disabled
              />
            </Form.Item>

            <Form.Item
              name="paymentToken"
              label={t('dashboard.paymentToken', { defaultValue: '支付代币' })}
              rules={[{ required: true, message: t('dashboard.paymentTokenRequired', { defaultValue: '请选择支付代币' }) }]}
            >
              <Select
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
                loading={createAuctionMutation.isPending}
                block
              >
                {t('dashboard.addAuction', { defaultValue: '添加拍卖' })}
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}

