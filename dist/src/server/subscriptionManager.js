"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToAll = subscribeToAll;
const ws_1 = require("ws");
const globalState_1 = require("./globalState");
// Helper function to check if a token is older than 24 hours
function isTokenOlderThan24Hours(token) {
    if (!token.timestamp)
        return false;
    const diffHrs = (Date.now() - new Date(token.timestamp).getTime()) / (1000 * 60 * 60);
    return diffHrs > 24;
}
// Helper function to batch and send subscriptions
async function sendBatchSubscriptions(ws, addresses, method, subscribedSet) {
    const BATCH_SIZE = 4000; // Max addresses per message
    const DELAY_MS = 100; // 50ms delay for 20 msg/s, under 200 msg/s limit
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
        const chunk = addresses.slice(i, i + BATCH_SIZE);
        if (chunk.length === 0)
            continue;
        ws.send(JSON.stringify({ method, keys: chunk }));
        chunk.forEach((address) => subscribedSet.add(address));
        if (i + BATCH_SIZE < addresses.length) {
            await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
    }
}
// Subscribe to all new tokens and top traders
async function subscribeToAll(ws) {
    if (!ws || ws.readyState !== ws_1.WebSocket.OPEN)
        return;
    (0, globalState_1.initGlobalState)();
    if (!global.pumpFunState)
        throw new Error("Global state not initialized");
    const { tokenStore, subscribedTokens, profitTierTraders, subscribedTraders } = global.pumpFunState;
    // Get new token mints (less than 24 hours old, not subscribed)
    const newTokens = tokenStore
        .filter((token) => (token === null || token === void 0 ? void 0 : token.mint) && !isTokenOlderThan24Hours(token) && !subscribedTokens.has(token.mint))
        .map((token) => token.mint);
    // Get new traders (top 20 per tier, not subscribed)
    const newTraders = [
        ...Array.from(profitTierTraders.tier1),
        ...Array.from(profitTierTraders.tier2),
        ...Array.from(profitTierTraders.tier3),
        ...Array.from(profitTierTraders.tier4),
        ...Array.from(profitTierTraders.tier5),
    ].filter((trader) => !subscribedTraders.has(trader));
    if (newTokens.length === 0 && newTraders.length === 0)
        return;
    // Subscribe to tokens
    if (newTokens.length > 0) {
        await sendBatchSubscriptions(ws, newTokens, "subscribeTokenTrade", subscribedTokens);
    }
    // Subscribe to traders
    if (newTraders.length > 0) {
        await sendBatchSubscriptions(ws, newTraders, "subscribeAccountTrade", subscribedTraders);
    }
}
