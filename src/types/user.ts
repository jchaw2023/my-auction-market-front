export interface User {
  id: number;
  username: string;
  email: string;
  walletAddress: string;
}

export interface UserProfile extends User {
  totalAuctions?: number;
  totalBids?: number;
  totalWins?: number;
}

