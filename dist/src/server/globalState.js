"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initGlobalState = initGlobalState;
const events_1 = require("events");
// Initialize global state if not already set
function initGlobalState() {
    if (!global.pumpFunState) {
        console.log("Initializing global pump.fun state");
        global.pumpFunState = {
            tokenStore: [],
            tokenActualStore: [],
            solanaPrice: 0,
            lastPriceUpdate: null,
            eventEmitter: new events_1.EventEmitter(),
            subscribedTokens: new Set(),
            traderStore: new Map(),
            profitTierTraders: {
                tier1: new Set(),
                tier2: new Set(),
                tier3: new Set(),
                tier4: new Set(),
                tier5: new Set(),
            },
            subscribedTraders: new Set(),
        };
    }
}
