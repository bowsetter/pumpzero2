"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenStore = getTokenStore;
exports.cleanupOldTokens = cleanupOldTokens;
exports.subscribeToTokenTrades = subscribeToTokenTrades;
exports.updateTokenTraderTiers = updateTokenTraderTiers;
exports.updateTierStats = updateTierStats;
const ws_1 = require("ws");
const tokens_1 = require("../types/tokens");
const globalState_1 = require("./globalState");
// Get the token store and price info
function getTokenStore() {
    // Ensure global state exists
    (0, globalState_1.initGlobalState)();
    // Verify initialization
    if (!global.pumpFunState) {
        throw new Error("Global pumpFunState failed to initialize");
    }
    // Ensure tokenStore is an array
    if (!Array.isArray(global.pumpFunState.tokenStore)) {
        console.log("TokenStore is not an array, initializing it");
        global.pumpFunState.tokenStore = [];
    }
    return {
        tokens: global.pumpFunState.tokenActualStore || [],
        solanaPrice: global.pumpFunState.solanaPrice || 0,
        lastPriceUpdate: global.pumpFunState.lastPriceUpdate
            ? global.pumpFunState.lastPriceUpdate.toISOString()
            : null,
    };
}
// Function to check if a token is older than 24 hours
function isTokenOlderThan24Hours(token) {
    if (!token.timestamp)
        return false;
    const now = new Date();
    const tokenTime = new Date(token.timestamp);
    const diffMs = now.getTime() - tokenTime.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    return diffHrs > 24;
}
// Function to clean up old tokens and unsubscribe from them
function cleanupOldTokens(ws) {
    if (!ws || ws.readyState !== ws_1.WebSocket.OPEN) {
        console.error("Cannot clean up old tokens: WebSocket not open");
        return;
    }
    try {
        // Make sure global state exists and is properly initialized
        if (!global.pumpFunState ||
            !Array.isArray(global.pumpFunState.tokenStore)) {
            console.error("Cannot clean up old tokens: tokenStore not properly initialized");
            return;
        }
        const tokens = global.pumpFunState.tokenStore;
        if (!tokens || tokens.length === 0) {
            console.log("No tokens in store to clean up");
            return;
        }
        // Get mints of tokens older than 24 hours
        const oldTokenMints = tokens
            .filter((token) => token && token.mint && isTokenOlderThan24Hours(token))
            .map((token) => token.mint);
        if (oldTokenMints.length === 0) {
            console.log("No old tokens to unsubscribe from");
            return;
        }
        console.log(`Unsubscribing from ${oldTokenMints.length} tokens older than 24 hours`);
        // Batch unsubscriptions in chunks of 50 to avoid overwhelming the server
        const CHUNK_SIZE = 50;
        for (let i = 0; i < oldTokenMints.length; i += CHUNK_SIZE) {
            const chunk = oldTokenMints.slice(i, i + CHUNK_SIZE);
            // Skip empty chunks
            if (chunk.length === 0)
                continue;
            // Send unsubscription message for this chunk
            const payload = {
                method: "unsubscribeTokenTrade",
                keys: chunk,
            };
            ws.send(JSON.stringify(payload));
            // Remove from our set of subscribed tokens
            chunk.forEach((mint) => {
                var _a;
                if ((_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.subscribedTokens) {
                    global.pumpFunState.subscribedTokens.delete(mint);
                }
            });
            console.log(`Unsubscribed from trades for ${chunk.length} old tokens (batch ${Math.floor(i / CHUNK_SIZE) + 1})`);
        }
        // Remove old tokens from the token store
        global.pumpFunState.tokenStore = tokens.filter((token) => !isTokenOlderThan24Hours(token));
        console.log(`Completed cleanup. Removed ${oldTokenMints.length} old tokens. New token store length: ${global.pumpFunState.tokenStore.length}`);
    }
    catch (error) {
        console.error("Error cleaning up old tokens:", error);
    }
}
// Subscribe to token trades for a specific token mint
function subscribeToTokenTrades(ws, mint) {
    var _a, _b, _c;
    if (!mint || !ws || ws.readyState !== ws_1.WebSocket.OPEN) {
        console.error("Cannot subscribe to token trades: invalid parameters");
        return;
    }
    try {
        // Check if we're already subscribed to this token
        if ((_b = (_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.subscribedTokens) === null || _b === void 0 ? void 0 : _b.has(mint)) {
            console.log(`Already subscribed to trades for token: ${mint}`);
            return;
        }
        // Send subscription message
        const payload = {
            method: "subscribeTokenTrade",
            keys: [mint],
        };
        ws.send(JSON.stringify(payload));
        // Add to our set of subscribed tokens
        if ((_c = global.pumpFunState) === null || _c === void 0 ? void 0 : _c.subscribedTokens) {
            global.pumpFunState.subscribedTokens.add(mint);
        }
    }
    catch (error) {
        console.error(`Error subscribing to trades for token ${mint}:`, error);
    }
}
// Function to update trader tiers for a specific token
// This function updates the trader tiers for a specific token in the global state
function updateTokenTraderTiers(mint, traderAddress, profitTier) {
    if (!global.pumpFunState || !Array.isArray(global.pumpFunState.tokenStore)) {
        console.log("Global state or tokenStore not initialized, skipping trader tier update");
        return;
    }
    const tokenIndex = global.pumpFunState.tokenStore.findIndex((token) => token && token.mint === mint);
    if (tokenIndex >= 0) {
        const token = global.pumpFunState.tokenStore[tokenIndex];
        // Initialize traderTiers if not present
        if (!token.traderTiers) {
            token.traderTiers = {
                tier1: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier2: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier3: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier4: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier5: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier6: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier7: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                tier8: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                traders: [],
            };
            console.log(`Initialized traderTiers for token ${mint}`);
        }
        // Check if trader already exists in this token's trader list
        const existingTraderIndex = token.traderTiers.traders.findIndex((t) => t.address === traderAddress);
        if (existingTraderIndex >= 0) {
            console.log("Updating existing trader tier", profitTier);
            const existingTrader = token.traderTiers.traders[existingTraderIndex];
            if (existingTrader.profitTier !== profitTier) {
                // Decrement old tier count
                switch (existingTrader.profitTier) {
                    case tokens_1.ProfitTier.TIER1:
                        token.traderTiers.tier1.count--;
                        break;
                    case tokens_1.ProfitTier.TIER2:
                        token.traderTiers.tier2.count--;
                        break;
                    case tokens_1.ProfitTier.TIER3:
                        token.traderTiers.tier3.count--;
                        break;
                    case tokens_1.ProfitTier.TIER4:
                        token.traderTiers.tier4.count--;
                        break;
                    case tokens_1.ProfitTier.TIER5:
                        token.traderTiers.tier5.count--;
                        break;
                    case tokens_1.ProfitTier.TIER6:
                        token.traderTiers.tier6.count--;
                        break;
                    case tokens_1.ProfitTier.TIER7:
                        token.traderTiers.tier7.count--;
                        break;
                    case tokens_1.ProfitTier.TIER8:
                        token.traderTiers.tier8.count--;
                        break;
                }
                // Update trader tier
                existingTrader.profitTier = profitTier;
                // Increment new tier count
                switch (profitTier) {
                    case tokens_1.ProfitTier.TIER1:
                        token.traderTiers.tier1.count++;
                        break;
                    case tokens_1.ProfitTier.TIER2:
                        token.traderTiers.tier2.count++;
                        break;
                    case tokens_1.ProfitTier.TIER3:
                        token.traderTiers.tier3.count++;
                        break;
                    case tokens_1.ProfitTier.TIER4:
                        token.traderTiers.tier4.count++;
                        break;
                    case tokens_1.ProfitTier.TIER5:
                        token.traderTiers.tier5.count++;
                        break;
                    case tokens_1.ProfitTier.TIER6:
                        token.traderTiers.tier6.count++;
                        break;
                    case tokens_1.ProfitTier.TIER7:
                        token.traderTiers.tier7.count++;
                        break;
                    case tokens_1.ProfitTier.TIER8:
                        token.traderTiers.tier8.count++;
                        break;
                }
            }
        }
        else {
            console.log("Adding new trader to token trader tiers", profitTier);
            // Add new trader to the list
            token.traderTiers.traders.push({
                address: traderAddress,
                profitTier: profitTier,
                buyTimestamp: new Date(),
            });
            // Increment tier count
            switch (profitTier) {
                case tokens_1.ProfitTier.TIER1:
                    token.traderTiers.tier1.count++;
                    break;
                case tokens_1.ProfitTier.TIER2:
                    token.traderTiers.tier2.count++;
                    break;
                case tokens_1.ProfitTier.TIER3:
                    token.traderTiers.tier3.count++;
                    break;
                case tokens_1.ProfitTier.TIER4:
                    token.traderTiers.tier4.count++;
                    break;
                case tokens_1.ProfitTier.TIER5:
                    token.traderTiers.tier5.count++;
                    break;
                case tokens_1.ProfitTier.TIER6:
                    token.traderTiers.tier6.count++;
                    break;
                case tokens_1.ProfitTier.TIER7:
                    token.traderTiers.tier7.count++;
                    break;
                case tokens_1.ProfitTier.TIER8:
                    token.traderTiers.tier8.count++;
                    break;
            }
        }
        // Update token in store
        global.pumpFunState.tokenStore[tokenIndex] = token;
        // Update in actual store if exists
        const actualTokenIndex = global.pumpFunState.tokenActualStore.findIndex((t) => t && t.mint === mint);
        if (actualTokenIndex >= 0) {
            global.pumpFunState.tokenActualStore[actualTokenIndex] = token;
        }
        // Emit event for API routes
        if (global.pumpFunState.eventEmitter) {
            global.pumpFunState.eventEmitter.emit("tokenTraderUpdate", token);
        }
        updateTierStats(mint);
    }
}
// Function to update sumBuys, sumSells, and percentage for all tiers
function updateTierStats(mint) {
    if (!global.pumpFunState ||
        !Array.isArray(global.pumpFunState.tokenStore) ||
        !(global.pumpFunState.traderStore instanceof Map)) {
        console.log("Global state, tokenStore, or traderStore not properly initialized, skipping trader tier update");
        return;
    }
    // Assign to a local variable to satisfy TypeScript
    const pumpFunState = global.pumpFunState;
    const tokenIndex = pumpFunState.tokenStore.findIndex((token) => token && token.mint === mint);
    if (tokenIndex < 0) {
        console.log(`Token with mint ${mint} not found`);
        return;
    }
    const token = pumpFunState.tokenStore[tokenIndex];
    // Initialize tiertransactions if undefined
    if (!token.tiertransactions) {
        token.tiertransactions = [];
    }
    // Initialize traderTiers if undefined
    if (!token.traderTiers) {
        token.traderTiers = {
            tier1: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier2: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier3: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier4: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier5: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier6: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier7: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            tier8: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
            traders: [],
        };
        console.log(`Initialized traderTiers for token ${mint}`);
    }
    // Assign traderTiers to a local variable to satisfy TypeScript
    const traderTiers = token.traderTiers;
    // Define all tiers to update
    const allTiers = [
        tokens_1.ProfitTier.TIER1,
        tokens_1.ProfitTier.TIER2,
        tokens_1.ProfitTier.TIER3,
        tokens_1.ProfitTier.TIER4,
        tokens_1.ProfitTier.TIER5,
        tokens_1.ProfitTier.TIER6,
        tokens_1.ProfitTier.TIER7,
        tokens_1.ProfitTier.TIER8,
    ];
    // Clear tiertransactions to rebuild from scratch
    token.tiertransactions = [];
    // Update stats for each tier
    allTiers.forEach((currentTier) => {
        // Find traders in the current tier
        const tradersInTier = traderTiers.traders.filter((trader) => trader.profitTier === currentTier);
        // Add transactions for traders in this tier to tiertransactions
        tradersInTier.forEach((trader) => {
            const traderData = pumpFunState.traderStore.get(trader.address);
            if (traderData) {
                traderData.transactions.forEach((transaction) => {
                    if (transaction.mint === mint) {
                        token.tiertransactions.push({
                            traderAddress: trader.address,
                            mint: token.mint,
                            profitTier: trader.profitTier,
                            txType: transaction.txType,
                            amount: transaction.amount,
                            tokenAmount: transaction.tokenAmount,
                            timestamp: transaction.timestamp,
                        });
                    }
                });
            }
        });
        // Calculate sumBuys for the current tier
        const sumBuys = tradersInTier.reduce((sum, trader) => {
            const traderData = pumpFunState.traderStore.get(trader.address);
            if (traderData) {
                const totalBuys = traderData.transactions.reduce((total, tx) => {
                    var _a;
                    if (tx.txType === "buy" && tx.mint === mint) {
                        return total + ((_a = tx.tokenAmount) !== null && _a !== void 0 ? _a : 0);
                    }
                    return total;
                }, 0);
                return sum + totalBuys;
            }
            return sum;
        }, 0);
        // Calculate sumSells for the current tier
        const sumSells = tradersInTier.reduce((sum, trader) => {
            const traderData = pumpFunState.traderStore.get(trader.address);
            if (traderData) {
                const totalSells = traderData.transactions.reduce((total, tx) => {
                    var _a;
                    if (tx.txType === "sell" && tx.mint === mint) {
                        return total + ((_a = tx.tokenAmount) !== null && _a !== void 0 ? _a : 0);
                    }
                    return total;
                }, 0);
                return sum + totalSells;
            }
            return sum;
        }, 0);
        // Calculate percentage
        let percentage = sumBuys > 0 ? ((sumBuys - sumSells) / sumBuys) * 100 : 0;
        if (percentage < 0.0001) {
            percentage = 0;
        }
        // Update stats for the current tier
        switch (currentTier) {
            case tokens_1.ProfitTier.TIER1:
                traderTiers.tier1.sumBuys = sumBuys;
                traderTiers.tier1.sumSells = sumSells;
                traderTiers.tier1.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER2:
                traderTiers.tier2.sumBuys = sumBuys;
                traderTiers.tier2.sumSells = sumSells;
                traderTiers.tier2.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER3:
                traderTiers.tier3.sumBuys = sumBuys;
                traderTiers.tier3.sumSells = sumSells;
                traderTiers.tier3.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER4:
                traderTiers.tier4.sumBuys = sumBuys;
                traderTiers.tier4.sumSells = sumSells;
                traderTiers.tier4.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER5:
                traderTiers.tier5.sumBuys = sumBuys;
                traderTiers.tier5.sumSells = sumSells;
                traderTiers.tier5.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER6:
                traderTiers.tier6.sumBuys = sumBuys;
                traderTiers.tier6.sumSells = sumSells;
                traderTiers.tier6.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER7:
                traderTiers.tier7.sumBuys = sumBuys;
                traderTiers.tier7.sumSells = sumSells;
                traderTiers.tier7.percentage = percentage;
                break;
            case tokens_1.ProfitTier.TIER8:
                traderTiers.tier8.sumBuys = sumBuys;
                traderTiers.tier8.sumSells = sumSells;
                traderTiers.tier8.percentage = percentage;
                break;
            default:
                console.log(`Unknown profit tier: ${currentTier}`);
                break;
        }
    });
    // Update token in store
    pumpFunState.tokenStore[tokenIndex] = token;
    const actualTokenIndex = pumpFunState.tokenActualStore.findIndex((t) => t && t.mint === mint);
    if (actualTokenIndex >= 0) {
        pumpFunState.tokenActualStore[actualTokenIndex] = token;
    }
    // Emit event
    if (pumpFunState.eventEmitter) {
        pumpFunState.eventEmitter.emit("tokenTraderUpdate", token);
    }
}
