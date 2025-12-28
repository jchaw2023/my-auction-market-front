import { Button, Dropdown, Space, message } from 'antd';
import { WalletOutlined, LogoutOutlined, CopyOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '@/store/walletStore';
import { formatAddress } from '@/utils/format';

export default function WalletInfo() {
  const { t } = useTranslation();
  const { address, user, disconnect, setUser, setToken } = useWalletStore();

  const handleDisconnect = () => {
    disconnect();
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      message.success(t('wallet.addressCopied'));
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'address',
      label: (
        <div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('wallet.walletAddress')}</div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>{address}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'copy',
      label: (
        <Space>
          <CopyOutlined />
          {t('wallet.copyAddress')}
        </Space>
      ),
      onClick: handleCopyAddress,
    },
    {
      type: 'divider',
    },
    {
      key: 'disconnect',
      label: (
        <Space>
          <LogoutOutlined />
          {t('wallet.disconnect')}
        </Space>
      ),
      danger: true,
      onClick: handleDisconnect,
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight">
      <Button icon={<WalletOutlined />}>
        {address ? formatAddress(address) : 'Wallet'}
      </Button>
    </Dropdown>
  );
}

