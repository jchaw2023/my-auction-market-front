import { useState, useEffect } from 'react';
import { Form, Input, Button, Select, DatePicker, message, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nftApi, auctionApi } from '@/services/api';
import { AuctionPayload } from '@/types';
import { useWalletStore } from '@/store/walletStore';
import { useTokenStore } from '@/store/tokenStore';
import dayjs from 'dayjs';

const { TextArea } = Input;

export default function CreateAuction() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { isConnected, address } = useWalletStore();
  const { tokens, defaultToken } = useTokenStore();
  const queryClient = useQueryClient();
  const [selectedNFT, setSelectedNFT] = useState<any>(null);

  const { data: nftsData, isLoading: nftsLoading } = useQuery({
    queryKey: ['my-nfts'],
    queryFn: () => nftApi.getMyNFTs(),
    enabled: isConnected,
  });

  const createMutation = useMutation({
    mutationFn: (payload: AuctionPayload) => auctionApi.createAuction(payload),
    onSuccess: () => {
      message.success(t('dashboard.createAuctionSuccess'));
      form.resetFields();
      setSelectedNFT(null);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
      queryClient.invalidateQueries({ queryKey: ['my-auctions'] });
    },
    onError: (error: any) => {
      message.error(t('dashboard.createAuctionFailed') + ': ' + error.message);
    },
  });

  const handleSubmit = (values: any) => {
    if (!selectedNFT) {
      message.warning(t('dashboard.pleaseSelectNFT'));
      return;
    }

    const payload: AuctionPayload = {
      nftAddress: selectedNFT.contractAddress,
      tokenId: selectedNFT.tokenId,
      startPrice: parseFloat(values.startPrice), // 直接使用 ETH 数值
      paymentToken: values.paymentToken || defaultToken?.address,
      startTime: values.startTime.toISOString(),
      endTime: values.endTime.toISOString(),
    };

    createMutation.mutate(payload);
  };

  if (!isConnected) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p>{t('dashboard.pleaseConnectWalletToCreate')}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title={t('dashboard.selectNFT')}>
        {nftsLoading ? (
          <div>Loading NFTs...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {nftsData?.data.map((nft: any) => (
              <Card
                key={nft.id}
                hoverable
                cover={
                  <img
                    alt={nft.name}
                    src={nft.image}
                    style={{ height: '200px', objectFit: 'cover' }}
                  />
                }
                onClick={() => setSelectedNFT(nft)}
                style={{
                  border: selectedNFT?.id === nft.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                }}
              >
                <Card.Meta title={nft.name} description={`ID: ${nft.tokenId}`} />
              </Card>
            ))}
          </div>
        )}
      </Card>

      {selectedNFT && (
        <Card title={t('dashboard.auctionDetails')} style={{ marginTop: 24 }}>
            <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              paymentToken: defaultToken?.address || '',
            }}
          >
            <Form.Item label={t('dashboard.selectedNFT')}>
              <Input value={selectedNFT.name} disabled />
            </Form.Item>

            <Form.Item
              name="startPrice"
              label={t('dashboard.startPrice')}
              rules={[{ required: true, message: t('dashboard.startPrice') }]}
            >
              <Input type="number" step="0.001" placeholder="0.1" />
            </Form.Item>

            <Form.Item name="paymentToken" label={t('dashboard.paymentToken')}>
              <Select>
                {tokens.map((token) => (
                  <Select.Option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="startTime"
              label={t('dashboard.startTime')}
              rules={[{ required: true, message: t('dashboard.startTime') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="endTime"
              label={t('dashboard.endTime')}
              rules={[{ required: true, message: t('dashboard.endTime') }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending} block>
                {t('dashboard.createAuction')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}

