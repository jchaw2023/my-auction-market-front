import { useState } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import MyNFTs from './MyNFTs';
import MyAuctions from './MyAuctions';
import AuctionHistory from './AuctionHistory';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('my-auctions');

  const tabItems = [
    {
      key: 'my-auctions',
      label: t('dashboard.myAuctions', { defaultValue: '我的拍卖' }),
      children: <MyAuctions />,
    },
    {
      key: 'history',
      label: t('dashboard.auctionHistory'),
      children: <AuctionHistory />,
    },
    {
      key: 'my-nfts',
      label: t('dashboard.myNFTs'),
      children: activeTab === 'my-nfts' ? <MyNFTs /> : null, // 只有激活时才渲染
    },
  ];

  return (
    <div className="dashboard-page">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
}

