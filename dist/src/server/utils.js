"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSolanaPrice = void 0;
exports.safeJsonParse = safeJsonParse;
const globalState_1 = require("./globalState");
// Safe JSON parse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse(data) {
    try {
        return JSON.parse(data);
    }
    catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
}
// Function to fetch Solana price
const fetchSolanaPrice = async () => {
    var _a;
    (0, globalState_1.initGlobalState)();
    try {
        // Try CoinGecko API first
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (response.ok) {
            const data = await response.json();
            const price = (_a = data.solana) === null || _a === void 0 ? void 0 : _a.usd;
            if (price && typeof price === "number") {
                console.log("Fetched Solana price from CoinGecko:", price);
                global.pumpFunState.solanaPrice = price;
                global.pumpFunState.lastPriceUpdate = new Date();
                return;
            }
        }
        // Fallback to Binance API if CoinGecko fails
        const binanceResponse = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT");
        if (binanceResponse.ok) {
            const binanceData = await binanceResponse.json();
            const binancePrice = parseFloat(binanceData.price);
            if (!isNaN(binancePrice)) {
                console.log("Fetched Solana price from Binance:", binancePrice);
                global.pumpFunState.solanaPrice = binancePrice;
                global.pumpFunState.lastPriceUpdate = new Date();
                return;
            }
        }
        // Second fallback - use a static price if both APIs fail
        console.warn("Failed to fetch Solana price from APIs, using fallback price");
        global.pumpFunState.solanaPrice = 110; // Use a reasonable fallback price
        global.pumpFunState.lastPriceUpdate = new Date();
    }
    catch (error) {
        console.error("Error fetching Solana price:", error);
        // If all attempts fail, use a default price
        if (global.pumpFunState.solanaPrice === 0) {
            global.pumpFunState.solanaPrice = 110; // Default fallback price
            global.pumpFunState.lastPriceUpdate = new Date();
        }
    }
};
exports.fetchSolanaPrice = fetchSolanaPrice;
// Fetch price immediately and then every 5 minutes
(0, exports.fetchSolanaPrice)();
setInterval(exports.fetchSolanaPrice, 5 * 60 * 1000);
