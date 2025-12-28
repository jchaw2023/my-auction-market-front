import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ethers } from 'ethers';

dayjs.extend(relativeTime);

/**
 * 格式化以太坊地址
 */
export function formatAddress(address: string, length = 4): string {
  if (!address) return '';
  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

/**
 * 格式化 ETH 金额
 */
export function formatETH(wei: string, decimals = 4): string {
  try {
    const eth = ethers.formatEther(wei);
    const num = parseFloat(eth);
    return num.toFixed(decimals);
  } catch {
    return '0';
  }
}

/**
 * 格式化 USD 金额
 */
export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * 格式化时间
 */
export function formatTime(time: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(time).format(format);
}

/**
 * 相对时间
 */
export function formatRelativeTime(time: string | Date): string {
  return dayjs(time).fromNow();
}

/**
 * 计算倒计时
 */
export function getCountdown(endTime: string | Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const end = dayjs(endTime);
  const now = dayjs();
  const diff = end.diff(now, 'second');

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
    };
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
  };
}

