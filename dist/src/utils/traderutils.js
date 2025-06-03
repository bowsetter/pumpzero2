"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTraderProfitTier = getTraderProfitTier;
const tokens_1 = require("../types/tokens");
const settings_1 = require("./settings");
// Function to determine a trader's profit tier based on total profit
function getTraderProfitTier(solTotalProfit, solanaPrice) {
    const totalProfit = solTotalProfit * solanaPrice; // Calculate total profit in USD
    (0, settings_1.clearProfitTierCache)();
    const tiers = (0, settings_1.getProfitTierThresholds)(); // Get thresholds from settings
    let highestTier = null;
    // Iterate through tiers (sorted by minProfitUsd ascending)
    for (const tier of tiers) {
        if (totalProfit >= tier.minProfitUsd) {
            highestTier = tokens_1.ProfitTier[tier.tier]; // Convert string (e.g., "TIER1") to enum (ProfitTier.TIER1)
        }
    }
    return highestTier; // No tier if profit is below the lowest threshold
}
