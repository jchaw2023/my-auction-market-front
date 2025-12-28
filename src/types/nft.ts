export interface NFT {
  id: number;
  tokenId: number;
  name: string;
  image: string;
  description?: string;
  contractAddress: string;
  owner: string;
  metadata?: {
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

