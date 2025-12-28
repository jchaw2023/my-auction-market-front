import { Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Auction } from '@/types';
import { formatETH, formatUSD, getCountdown } from '@/utils/format';
import { TOKEN_SYMBOLS } from '@/utils/constants';
import { PLACEHOLDER_IMAGE } from '@/utils/placeholder';
import './NFTCard.css';

interface NFTCardProps {
  auction: Auction;
}

export default function NFTCard({ auction }: NFTCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const countdown = getCountdown(auction.endTime);

  const handleClick = () => {
    navigate(`/auction/${auction.id}`);
  };

  return (
    <Card
      hoverable
      className="nft-card"
      cover={
        <div className="nft-image-container" onClick={handleClick}>
          <img
            alt={auction.nftName}
            src={auction.nftImage}
            className="nft-image"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
          {auction.status === 'active' && (
            <div className="nft-status-badge active">{t('home.active')}</div>
          )}
          {auction.status === 'ended' && (
            <div className="nft-status-badge ended">{t('home.ended')}</div>
          )}
        </div>
      }
      onClick={handleClick}
    >
      <div className="nft-card-content">
        <h3 className="nft-name">{auction.nftName}</h3>
        <p className="nft-id">{t('auction.tokenId')}: {auction.tokenId}</p>
        
        {auction.status === 'active' && (
          <div className="nft-countdown">
            {countdown.isExpired ? (
              <span className="expired">{t('auction.auctionEnded')}</span>
            ) : (
              <span>
                {t('auction.endsIn')}: {countdown.days}{t('auction.days')} {countdown.hours}{t('auction.hours')} {countdown.minutes}{t('auction.minutes')}
              </span>
            )}
          </div>
        )}

        <div className="nft-price-info">
          <div className="price-row">
            <span className="price-label">
              {parseFloat(auction.highestBid) > 0 ? t('auction.currentBid') : t('auction.floorPrice')}:
            </span>
            <span className={`price-value ${parseFloat(auction.highestBid) > 0 ? 'highlight' : ''}`}>
              {parseFloat(auction.highestBid) > 0
                ? formatETH(auction.highestBid)
                : auction.floorPrice
                ? formatETH(auction.floorPrice)
                : formatETH(auction.startPrice.toString())}{' '}
              {TOKEN_SYMBOLS[auction.paymentToken] || 'ETH'}
            </span>
          </div>
          {(auction.highestBidUSD > 0 || auction.startPriceUSD > 0) && (
            <div className="price-usd">
              ≈ {formatUSD(auction.highestBidUSD > 0 ? auction.highestBidUSD : auction.startPriceUSD)}
            </div>
          )}
        </div>

        <div className="nft-stats">
          <span>{auction.bidCount} {t('auction.bids')}</span>
        </div>
      </div>
    </Card>
  );
}

