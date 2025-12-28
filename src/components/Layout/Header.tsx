import { Layout, Menu, Button, Space } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, DashboardOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useWalletStore } from '@/store/walletStore';
import ConnectWallet from '@/components/Wallet/ConnectWallet';
import WalletInfo from '@/components/Wallet/WalletInfo';
import LanguageSwitcher from '@/components/Common/LanguageSwitcher';
import './Header.css';

const { Header: AntHeader } = Layout;

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected } = useWalletStore();
  const { t } = useTranslation();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">{t('nav.home')}</Link>,
    },
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">{t('nav.dashboard')}</Link>,
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">{t('nav.profile')}</Link>,
    },
  ];

  return (
    <AntHeader 
      className="app-header"
      style={{
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        padding: 0,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        height: 64,
        width: '100%',
        lineHeight: '64px',
        visibility: 'visible',
        opacity: 1,
        flexShrink: 0,
      }}
    >
      <div className="header-content">
        <div className="header-logo" onClick={() => navigate('/')}>
          <span className="logo-text">NFT Auction Market</span>
        </div>
        
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="header-menu"
        />

        <div className="header-actions">
          <Space>
            <LanguageSwitcher />
            {isConnected ? <WalletInfo /> : <ConnectWallet />}
          </Space>
        </div>
      </div>
    </AntHeader>
  );
}

