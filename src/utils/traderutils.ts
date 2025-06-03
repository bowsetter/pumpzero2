import { ProfitTier } from '../types/tokens';
import { getProfitTierThresholds,clearProfitTierCache } from './settings';

// Function to determine a trader's profit tier based on total profit
export function getTraderProfitTier(solTotalProfit: number, solanaPrice: number): ProfitTier | null {
  const totalProfit = solTotalProfit * solanaPrice; // Calculate total profit in USD
  clearProfitTierCache();
  const tiers = getProfitTierThresholds(); // Get thresholds from settings

  let highestTier = null;
  // Iterate through tiers (sorted by minProfitUsd ascending)
  for (const tier of tiers) {
    
     if (totalProfit >= tier.minProfitUsd) {
      highestTier = ProfitTier[tier.tier]; // Convert string (e.g., "TIER1") to enum (ProfitTier.TIER1)
    }
  }

  return highestTier; // No tier if profit is below the lowest threshold
}
