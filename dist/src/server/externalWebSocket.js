"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToExternalWS = connectToExternalWS;
exports.setupExternalWS = setupExternalWS;
const ws_1 = require("ws");
const globalState_1 = require("./globalState");
const tokenManager_1 = require("./tokenManager");
const traderManager_1 = require("./traderManager");
const utils_1 = require("./utils");
const subscriptionManager_1 = require("./subscriptionManager");
// Maintain a single external WebSocket connection
let externalWs = null;
// Function to create and manage the external WebSocket connection
async function connectToExternalWS(wss) {
    var _a, _b, _c, _d;
    console.log("Connecting to external WebSocket...");
    // Ensure global state is initialized
    (0, globalState_1.initGlobalState)();
    console.log("Current tokenStore state:", {
        tokenStoreExists: !!((_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.tokenStore),
        tokenStoreLength: ((_c = (_b = global.pumpFunState) === null || _b === void 0 ? void 0 : _b.tokenStore) === null || _c === void 0 ? void 0 : _c.length) || 0,
        isArray: Array.isArray((_d = global.pumpFunState) === null || _d === void 0 ? void 0 : _d.tokenStore),
    });
    // Close existing connection if any
    if (externalWs) {
        try {
            if (externalWs.readyState === ws_1.WebSocket.OPEN) {
                externalWs.close();
            }
        }
        catch (err) {
            console.error("Error closing existing external WebSocket:", err);
        }
        externalWs = null;
    }
    try {
        // Create new connection
        externalWs = new ws_1.WebSocket("wss://pumpportal.fun/api/data");
        if (!externalWs) {
            throw new Error("Failed to create WebSocket instance");
        }
        // Set up event handlers
        externalWs.onopen = async () => {
            var _a;
            console.log("Connected to pumpportal.fun WebSocket");
            // Make sure externalWs is still valid
            if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                // Subscribe to new token events
                const payload = {
                    method: "subscribeNewToken",
                };
                try {
                    externalWs.send(JSON.stringify(payload));
                    console.log("Subscribed to new token events");
                    // Clear the set of subscribed tokens
                    if ((_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.subscribedTokens) {
                        global.pumpFunState.subscribedTokens.clear();
                    }
                    // Clean up old tokens first
                    if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                        (0, tokenManager_1.cleanupOldTokens)(externalWs);
                    }
                    // Subscribe to trades for remaining tokens
                    // Subscribe to all tokens and traders
                    if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                        console.log("Subscribing to all tokens and traders...");
                        await (0, subscriptionManager_1.subscribeToAll)(externalWs);
                    }
                }
                catch (err) {
                    console.error("Error sending subscription message:", err);
                }
            }
        };
        externalWs.onmessage = async (event) => {
            var _a, _b, _c, _d, _e, _f;
            try {
                const TOTAL_SUPPLY = 1000000000;
                // Check that we still have a valid WebSocket reference
                if (!externalWs) {
                    console.error("WebSocket reference is null in onmessage handler");
                    return;
                }
                // Safely parse the message
                const data = (0, utils_1.safeJsonParse)(event.data.toString());
                if (!data) {
                    return;
                }
                // Only log non-ping messages to avoid spamming
                if (!data.method || data.method !== "ping") {
                    // console.log('Received data from external WebSocket:', data);
                }
                // Make sure global state is properly initialized
                if (!global.pumpFunState ||
                    !Array.isArray(global.pumpFunState.tokenStore)) {
                    console.error("Global state not properly initialized for handling token trade");
                    return;
                }
                const globalTokens = global.pumpFunState.tokenStore;
                const tokenIndex = globalTokens.findIndex((token) => token && token.mint === data.mint);
                // Handle trader activities and profit calculation
                if (data.traderPublicKey && data.txType && data.mint) {
                    // Track trader activity
                    const traderAddress = data.traderPublicKey;
                    const isBuy = data.txType === "buy";
                    const isSell = data.txType === "sell";
                    if (isBuy || isSell) {
                        const token = (_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.tokenStore.find((t) => t && t.mint === data.mint);
                        if (!token) {
                            console.warn(`Token ${data.mint} not found in tokenStore for trader ${traderAddress}`);
                        }
                        // Calculate devTokensSold including the current transaction (if developer sell)
                        const validTokenAmount = data.tokenAmount > 0 ? data.tokenAmount : 0;
                        // Calculate profit if it's a sell transaction
                        let profit = 0;
                        if (isSell && global.pumpFunState.traderStore.has(traderAddress)) {
                            const traderData = global.pumpFunState.traderStore.get(traderAddress);
                            const buyTxs = traderData.transactions.filter((tx) => tx.mint === data.mint && tx.txType === "buy");
                            if (buyTxs.length > 0 && data.tokenAmount > 0) {
                                let totalTokensBought = 0;
                                let totalSolSpent = 0;
                                for (const tx of buyTxs) {
                                    if (totalTokensBought >= data.tokenAmount)
                                        break;
                                    if (!tx.tokenAmount || tx.tokenAmount <= 0) {
                                        console.warn(`Skipping invalid buy transaction for trader ${traderAddress}, mint ${data.mint}: tokenAmount=${tx.tokenAmount}`);
                                        continue;
                                    }
                                    const tokensUsed = Math.min(tx.tokenAmount, data.tokenAmount - totalTokensBought);
                                    totalTokensBought += tokensUsed;
                                    totalSolSpent +=
                                        (tokensUsed / tx.tokenAmount) * (tx.amount || 0);
                                }
                                if (totalTokensBought >= data.tokenAmount &&
                                    totalTokensBought > 0) {
                                    const avgBuyPrice = totalSolSpent / totalTokensBought;
                                    const fee = typeof data.fees === "number" && data.fees >= 0
                                        ? data.fees
                                        : 0;
                                    const netSellSol = (data.solAmount || 0) - fee;
                                    const sellPrice = netSellSol / data.tokenAmount;
                                    profit = (sellPrice - avgBuyPrice) * data.tokenAmount;
                                }
                                else {
                                    console.warn(`Not enough tokens bought for sell by ${traderAddress}: needed ${data.tokenAmount}, have ${totalTokensBought}`);
                                    profit = 0;
                                }
                                // Record transaction
                                (0, traderManager_1.recordTraderTransaction)(externalWs, traderAddress, data.mint, data.txType, data.solAmount || 0, validTokenAmount, isSell ? profit : undefined, data.signature);
                            }
                            else {
                                profit = 0;
                            }
                        }
                        if (isBuy) {
                            // Record transaction
                            (0, traderManager_1.recordTraderTransaction)(externalWs, traderAddress, data.mint, data.txType, data.solAmount || 0, validTokenAmount, isSell ? profit : undefined, data.signature);
                        }
                        const token_data = globalTokens[tokenIndex];
                        if (token_data.developeraddress && traderAddress === token_data.developeraddress) {
                            // Record transaction
                            (0, traderManager_1.recordTraderTransaction)(externalWs, traderAddress, data.mint, data.txType, data.solAmount || 0, validTokenAmount, isSell ? profit : undefined, data.signature);
                        }
                    }
                }
                // If this is a new token with URI and mint
                if (data.uri && data.mint) {
                    try {
                        // Fetch the metadata
                        const response = await fetch(data.uri);
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        const metadataContent = await response.json();
                        const currentPriceUsd = data.marketCapSol
                            ? (data.marketCapSol * global.pumpFunState.solanaPrice) /
                                TOTAL_SUPPLY
                            : 0;
                        // Create token object
                        const tokenData = {
                            // Original token data
                            ...data,
                            developeraddress: data.traderPublicKey,
                            // Add metadata
                            description: metadataContent.description,
                            image: metadataContent.image,
                            website: metadataContent.website,
                            twitter: metadataContent.twitter,
                            telegram: metadataContent.telegram,
                            marketCapUsd: (data.marketCapSol * global.pumpFunState.solanaPrice) /
                                TOTAL_SUPPLY,
                            marketCapTrack: (data.marketCapSol * global.pumpFunState.solanaPrice) /
                                TOTAL_SUPPLY,
                            topPriceUsd: currentPriceUsd,
                            priceChangePercent: 0,
                            startMcap: data.marketCapSol,
                            topMcap: data.marketCapSol,
                            // Add component-specific data
                            timestamp: new Date(),
                            age: "0m",
                            replyCount: data.replyCount || 0,
                            isKingOfTheHill: false,
                            hasNewTrade: false,
                            tradeBuys: 0,
                            tradeSells: 0,
                            lastTradeType: undefined,
                            lastTradeAmount: 0,
                            // Initialize trader tiers
                            traderTiers: {
                                tier1: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier2: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier3: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier4: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier5: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier6: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier7: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                tier8: { count: 0, percentage: 0, sumBuys: 0, sumSells: 0 },
                                traders: [],
                            },
                            devTokensSold: 0,
                        };
                        // Add to token store (avoiding duplicates)
                        const globalTokens = global.pumpFunState.tokenStore;
                        const isDuplicate = globalTokens.some((token) => token && token.mint === tokenData.mint);
                        if (!isDuplicate) {
                            global.pumpFunState.tokenStore = [tokenData, ...globalTokens];
                            // Subscribe to trades for this new token
                            if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                                (0, tokenManager_1.subscribeToTokenTrades)(externalWs, tokenData.mint);
                            }
                            // Emit event for API routes
                            if (global.pumpFunState.eventEmitter) {
                                global.pumpFunState.eventEmitter.emit("newToken", tokenData);
                            }
                            // Send to all connected clients
                            wss.clients.forEach((client) => {
                                if (client.readyState === ws_1.WebSocket.OPEN) {
                                    try {
                                        client.send(JSON.stringify({ type: "newToken", token: tokenData }));
                                    }
                                    catch (err) {
                                        console.error("Error sending new token to client:", err);
                                    }
                                }
                            });
                        }
                    }
                    catch (error) {
                        console.error(`Error fetching ${data.uri} or processing token metadata: ${error}`);
                    }
                }
                // Handle token trades
                else if (data.mint &&
                    data.txType &&
                    (data.txType === "buy" || data.txType === "sell")) {
                    if (tokenIndex >= 0) {
                        const token = globalTokens[tokenIndex];
                        const currentPriceUsd = data.marketCapSol
                            ? (data.marketCapSol * global.pumpFunState.solanaPrice) /
                                TOTAL_SUPPLY
                            : 0;
                        const topPriceUsd = (_b = token.topPriceUsd) !== null && _b !== void 0 ? _b : currentPriceUsd;
                        const updatedTopPriceUsd = currentPriceUsd > topPriceUsd ? currentPriceUsd : topPriceUsd;
                        const priceChangePercent = topPriceUsd > 0
                            ? ((currentPriceUsd - topPriceUsd) / topPriceUsd) * 100
                            : 0;
                        const currentMarketCap = data.marketCapSol;
                        const topMcap = (_c = token.topMcap) !== null && _c !== void 0 ? _c : currentMarketCap;
                        const updatedtopMarketCapSol = currentMarketCap > topMcap ? currentMarketCap : topMcap;
                        const updatedToken = {
                            ...token,
                            hasNewTrade: true,
                            lastTradeTime: new Date(),
                            txType: data.txType,
                            lastTradeType: data.txType,
                            lastTradeAmount: data.solAmount || 0,
                            tradeBuys: token.txType === "buy"
                                ? (token.tradeBuys || 0) + 1
                                : token.tradeBuys,
                            tradeSells: token.txType === "sell"
                                ? (token.tradeSells || 0) + 1
                                : token.tradeSells,
                            totalTransactions: (token.totalTransactions || 0) + 1,
                            topPriceUsd: updatedTopPriceUsd,
                            priceChangePercent: priceChangePercent,
                            topMcap: updatedtopMarketCapSol,
                            // Update market cap if available
                            marketCapSol: data.marketCapSol !== undefined
                                ? data.marketCapSol
                                : token.marketCapSol,
                            marketCapUsd: data.marketCapUsd !== undefined
                                ? data.marketCapSol * global.pumpFunState.solanaPrice
                                : ((_d = token.marketCapSol) !== null && _d !== void 0 ? _d : 0) * global.pumpFunState.solanaPrice,
                            vSolInBondingCurve: data.vSolInBondingCurve !== undefined
                                ? data.vSolInBondingCurve
                                : token.vSolInBondingCurve,
                            vTokensInBondingCurve: data.vTokensInBondingCurve !== undefined
                                ? data.vTokensInBondingCurve
                                : token.vTokensInBondingCurve,
                        };
                        global.pumpFunState.tokenStore.splice(tokenIndex, 1);
                        global.pumpFunState.tokenStore = [
                            updatedToken,
                            ...global.pumpFunState.tokenStore,
                        ];
                        // Update actual token store
                        if (Array.isArray(global.pumpFunState.tokenActualStore)) {
                            const globalActualTokens = global.pumpFunState.tokenActualStore;
                            const globalActualIndex = globalActualTokens.findIndex((token) => token && token.mint === data.mint);
                            if (globalActualIndex >= 0) {
                                global.pumpFunState.tokenActualStore[globalActualIndex] =
                                    updatedToken;
                            }
                        }
                        // Emit event for API routes
                        if (global.pumpFunState.eventEmitter) {
                            global.pumpFunState.eventEmitter.emit("tokenTrade", updatedToken);
                        }
                    }
                    else {
                        // If we receive a trade for a token not in our store, we should try to get that token's info
                        if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                            try {
                                const infoPayload = {
                                    method: "getTokenInfo",
                                    mint: data.mint,
                                };
                                externalWs.send(JSON.stringify(infoPayload));
                            }
                            catch (err) {
                                console.error(`Error requesting info for unknown token ${data.mint}:`, err);
                            }
                        }
                    }
                }
                // Handle responses to token info requests
                else if (data.method === "tokenInfo" && data.mint && data.uri) {
                    // Process similar to new token
                    try {
                        // Fetch the metadata
                        const response = await fetch(data.uri);
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        const metadataContent = await response.json();
                        const currentPriceUsd = data.marketCapSol
                            ? (data.marketCapSol * global.pumpFunState.solanaPrice) /
                                TOTAL_SUPPLY
                            : 0;
                        // Create token object
                        const tokenData = {
                            // Original token data
                            ...data,
                            // Add metadata
                            description: metadataContent.description,
                            image: metadataContent.image,
                            website: metadataContent.website,
                            twitter: metadataContent.twitter,
                            telegram: metadataContent.telegram,
                            topPriceUsd: currentPriceUsd,
                            startMcap: data.marketCapSol,
                            topMcap: data.marketCapSol,
                            priceChangePercent: 0,
                            // Add component-specific data
                            timestamp: new Date(),
                            age: "0m",
                            replyCount: data.replyCount || 0,
                            isKingOfTheHill: false,
                            hasNewTrade: false,
                            tradeCount: 1, // Assuming we got here because of a trade
                            lastTradeType: data.txType,
                            lastTradeAmount: data.solAmount || 0,
                            // Initialize trader tiers
                            traderTiers: {
                                tier1Count: 0,
                                tier2Count: 0,
                                tier3Count: 0,
                                tier4Count: 0,
                                tier5Count: 0,
                                traders: [],
                            },
                        };
                        // Add to token store (avoiding duplicates)
                        const globalTokens = global.pumpFunState.tokenStore;
                        const isDuplicate = globalTokens.some((token) => token && token.mint === tokenData.mint);
                        if (!isDuplicate) {
                            console.log("Adding new token from info request to store:", tokenData.mint);
                            global.pumpFunState.tokenStore = [tokenData, ...globalTokens];
                            // Subscribe to trades for this token
                            if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
                                (0, tokenManager_1.subscribeToTokenTrades)(externalWs, tokenData.mint);
                            }
                            // Emit event for API routes
                            if (global.pumpFunState.eventEmitter) {
                                global.pumpFunState.eventEmitter.emit("newToken", tokenData);
                            }
                            // Send to all connected clients
                            wss.clients.forEach((client) => {
                                if (client.readyState === ws_1.WebSocket.OPEN) {
                                    try {
                                        client.send(JSON.stringify({ type: "newToken", token: tokenData }));
                                    }
                                    catch (err) {
                                        console.error("Error sending new token to client:", err);
                                    }
                                }
                            });
                        }
                    }
                    catch (error) {
                        console.error("Error processing token info response:", error);
                    }
                }
                if (data.mint) {
                    const globalTokensCurrent = global.pumpFunState.tokenStore;
                    const tokenIndexCurrent = globalTokensCurrent.findIndex((token) => token && token.mint === data.mint);
                    if (tokenIndexCurrent >= 0) {
                        const token = globalTokensCurrent[tokenIndexCurrent];
                        if (((_e = token.marketCapUsd) !== null && _e !== void 0 ? _e : 0) - ((_f = token.marketCapTrack) !== null && _f !== void 0 ? _f : 0) >
                            2000) {
                            const updatedToken = {
                                ...token,
                                marketCapTrack: token.marketCapUsd,
                            };
                            global.pumpFunState.tokenStore[tokenIndexCurrent] = updatedToken;
                            // Make sure global state is properly initialized
                            if (!global.pumpFunState ||
                                !Array.isArray(global.pumpFunState.tokenActualStore)) {
                                console.error("Global state not properly initialized for handling token trade");
                                return;
                            }
                            const globalActualTokens = global.pumpFunState.tokenActualStore;
                            const globalActualIndex = globalActualTokens.findIndex((token) => token && token.mint === data.mint);
                            if (globalActualIndex > 11 ||
                                globalActualIndex == -1 ||
                                globalActualTokens.length < 12) {
                                if (globalActualIndex >= 0) {
                                    global.pumpFunState.tokenActualStore.splice(globalActualIndex, 1);
                                }
                                // Add the updated token at the top
                                global.pumpFunState.tokenActualStore = [
                                    updatedToken,
                                    ...global.pumpFunState.tokenActualStore,
                                ];
                                // Send to all connected clients
                                wss.clients.forEach((client) => {
                                    if (client.readyState === ws_1.WebSocket.OPEN) {
                                        try {
                                            client.send(JSON.stringify({
                                                type: "tokenTrade",
                                                token: token,
                                            }));
                                        }
                                        catch (err) {
                                            console.error("Error sending token trade to client:", err);
                                        }
                                    }
                                });
                            }
                            else {
                                const globalActualTokens = global.pumpFunState.tokenActualStore;
                                const globalActualIndex = globalActualTokens.findIndex((token) => token && token.mint === data.mint);
                                console.log(`updating token ${data.mint} in actual store, Token Index: ${globalActualIndex}`);
                                // Set hasupdatedmc = false for all tokens in the store
                                global.pumpFunState.tokenActualStore =
                                    global.pumpFunState.tokenActualStore.map((token) => ({
                                        ...token,
                                        hasupdatedmc: false,
                                    }));
                                // we need to update the token in the actual store
                                global.pumpFunState.tokenActualStore[globalActualIndex] = {
                                    ...updatedToken, // Copy all updated token properties
                                    hasupdatedmc: true, // Still set the highlight flag
                                };
                                // Send to all connected clients
                                wss.clients.forEach((client) => {
                                    if (client.readyState === ws_1.WebSocket.OPEN) {
                                        try {
                                            client.send(JSON.stringify({
                                                type: "tokenTrade",
                                                token: token,
                                            }));
                                        }
                                        catch (err) {
                                            console.error("Error sending token trade to client:", err);
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            }
            catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };
        externalWs.onerror = (error) => {
            console.error("External WebSocket error:", error);
            // We'll let onclose handle reconnection logic
        };
        externalWs.onclose = (event) => {
            var _a;
            console.log("External WebSocket closed:", event.code, event.reason);
            // Clear the subscribedTokens set on disconnect
            if ((_a = global.pumpFunState) === null || _a === void 0 ? void 0 : _a.subscribedTokens) {
                global.pumpFunState.subscribedTokens.clear();
            }
            // Schedule reconnection attempt
            setTimeout(() => {
                console.log("Attempting to reconnect to external WebSocket...");
                connectToExternalWS(wss); // Actually reconnect
            }, 5000);
        };
    }
    catch (connectionError) {
        console.error("Error establishing WebSocket connection:", connectionError);
        // Set a timer to retry connection
        setTimeout(() => {
            console.log("Retrying WebSocket connection after error...");
            connectToExternalWS(wss);
        }, 10000);
    }
}
// Set up intervals and cleanup for the external WebSocket
function setupExternalWS(wss, server) {
    // Establish the external WebSocket connection immediately
    connectToExternalWS(wss);
    // Set up an interval to ping the external WebSocket to keep it alive
    const pingInterval = setInterval(() => {
        // Check if externalWs exists and is open before trying to send a ping
        if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
            try {
                externalWs.send(JSON.stringify({ method: "ping" }));
            }
            catch (err) {
                console.error("Error sending ping:", err);
                // Force reconnection if ping fails
                connectToExternalWS(wss);
            }
        }
        else if (!externalWs) {
            console.log("External WebSocket is null, attempting to connect");
            connectToExternalWS(wss);
        }
        else if (externalWs.readyState !== ws_1.WebSocket.CONNECTING) {
            console.log("External WebSocket not connected (state:", externalWs.readyState, "), attempting reconnection");
            // Try to reconnect if not already connecting
            connectToExternalWS(wss);
        }
    }, 30000); // Every 30 seconds
    // Set up an interval to clean up old tokens
    const cleanupInterval = setInterval(() => {
        if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
            console.log("Running scheduled cleanup of old tokens");
            (0, tokenManager_1.cleanupOldTokens)(externalWs);
        }
    }, 60 * 60 * 1000); // Run cleanup every hour
    // Add trader cleanup interval
    const traderCleanupInterval = setInterval(() => {
        if (externalWs && externalWs.readyState === ws_1.WebSocket.OPEN) {
            console.log("Running scheduled cleanup of inactive traders");
            (0, traderManager_1.cleanupInactiveTraders)(externalWs);
        }
        else {
            console.log("External WebSocket not open, skipping trader cleanup");
        }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
    // Clean up resources on server shutdown
    server.on("close", () => {
        console.log("HTTP server closing, cleaning up resources");
        clearInterval(pingInterval);
        clearInterval(cleanupInterval);
        clearInterval(traderCleanupInterval);
        if (externalWs) {
            try {
                externalWs.close();
                externalWs = null; // Clear the reference
            }
            catch (err) {
                console.error("Error closing external WebSocket during shutdown:", err);
            }
        }
    });
}
