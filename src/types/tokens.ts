// src/types/tokens.ts
export interface TokenData {
  signature?: string;
  mint: string;
  developeraddress?: string;
  traderPublicKey?: string;
  txType?: string;
  initialBuy?: number;
  solAmount?: number;
  bondingCurveKey?: string;
  vTokensInBondingCurve?: number;
  vSolInBondingCurve?: number;
  marketCapSol?: number;
  marketCapUsd?: number;
  marketCapTrack?: number;
  name?: string;
  symbol?: string;
  uri?: string;
  pool?: string;
  // Additional fields from metadata
  description?: string;
  image?: string;
  showName?: boolean;
  createdOn?: string;
  twitter?: string;
  website?: string;
  telegram?: string;
  // Extra fields for component functionality
  timestamp: Date;
  age?: string;
  replyCount?: number;
  isKingOfTheHill?: boolean;
  hasNewTrade?: boolean;
  lastTradeTime?: Date;
  // Added fields for tracking trade activity
  hasupdatedmc?: boolean;
  tradeBuys?: number;
  tradeSells?: number;
  totalTransactions?: number;
  lastTradeType?: 'buy' | 'sell';
  lastTradeAmount?: number;
  transactionsBuffer?: number;
  // New fields for trader profit tier tracking
  traderTiers?: TokenTraderTiers;
  tiertransactions?: TraderTransactionTiers[];
  topPriceUsd?: number; // Tracks the highest price reached in USD
  priceChangePercent?: number; // Tracks percentage change from top price (positive for increase, negative for decrease)
  devTokensSold?: number;
  startMcap?: number; // Initial market cap at the time of token creation
  topMcap?:number;
}

export interface TierStats {
  count: number;       // Number of traders in this tier
  percentage: number;  // Percentage of total traders
  sumBuys: number;     // Total amount bought by traders in this tier
  sumSells: number;    // Total amount sold by traders in this tier
}

export interface TokenTraderTiers {
  tier1: TierStats; // 50–100 profit
  tier2: TierStats; // 100–500 profit
  tier3: TierStats; // 500–1000 profit
  tier4: TierStats; // 1000–2000 profit
  tier5: TierStats; // 2000+ profit
  tier6: TierStats; // 500–1000 profit
  tier7: TierStats; // 1000–2000 profit
  tier8: TierStats; // 2000+ profit
  traders: TraderInfo[]; // Array of traders who bought this token
}

// Interface to track trader information
export interface TraderInfo {
  address: string;
  profitTier: ProfitTier | null; // Trader's profit tier
  buyAmount?: number;
  sellAmount?: number;
  buyTimestamp?: Date;
}

export enum ProfitTier {
  TIER1 = 'TIER1',
  TIER2 = 'TIER2',
  TIER3 = 'TIER3',
  TIER4 = 'TIER4',
  TIER5 = 'TIER5',
  TIER6 = 'TIER6',
  TIER7 = 'TIER7',
  TIER8 = 'TIER8',
}


export interface TraderData {
  address: string;
  totalProfit: number;
  profitTier: ProfitTier | null; // Trader's profit tier
  transactions: TraderTransaction[];
  lastActiveTimestamp: Date;
}

export interface TraderTransaction {
  signature?: string;
  mint: string;
  txType: 'buy' | 'sell';
  amount: number;
  tokenAmount?: number; // Number of tokens (add this)
  timestamp: Date;
  profit?: number;
}

export interface TraderTransactionTiers {
  traderAddress: string;
  signature?: string;
  mint: string;
  profitTier: ProfitTier | null;
  traderPublicKey?: string;
  txType: 'buy' | 'sell';
  amount: number;
  tokenAmount?: number; // Number of tokens (add this)
  timestamp: Date;
  profit?: number;
}


export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName?: boolean;
  createdOn?: string;
  twitter?: string;
  website?: string;
  telegram?: string;
}

export interface FilterValues {
  hasTelegram: boolean;
  hasWebsite: boolean;
  hasTwitter: boolean;
  isKingOfTheHill: boolean;
  marketCapMin: string;
  marketCapMax: string;
  search: string;
  createdWithinMinutes: string;
  replyCount: string;
  tierFilter: string;
  maxAllowedDrop: string;
}