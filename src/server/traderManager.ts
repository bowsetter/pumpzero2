import { WebSocket } from "ws";
import {
  ProfitTier,
  TraderTransaction,
} from "../types/tokens";
import { getTraderProfitTier } from "../utils/traderutils";
import { updateTokenTraderTiers,updateTierStats } from "./tokenManager";

function updateTraderProfitTier(
  ws: WebSocket,
  traderAddress: string,
  profit: number,
  solanaPrice: number
): void {
  if (!global.pumpFunState || !global.pumpFunState.traderStore) {
    console.log(
      "Global state or traderStore not initialized, skipping profit tier update"
    );
    return;
  }

  let traderData = global.pumpFunState.traderStore.get(traderAddress);

  if (!traderData) {
    traderData = {
      address: traderAddress,
      totalProfit: 0,
      profitTier: null,
      transactions: [],
      lastActiveTimestamp: new Date(),
    };
    console.log(
      `Created new trader data for ${traderAddress} with initial profitTier: null`
    );
  }

  const newTotalProfit = traderData.totalProfit + profit;
  const oldTier = traderData.profitTier;
  const newTier = getTraderProfitTier(newTotalProfit, solanaPrice);
  traderData.profitTier = newTier;
  traderData.totalProfit = newTotalProfit;
  traderData.lastActiveTimestamp = new Date();
  global.pumpFunState.traderStore.set(traderAddress, traderData);

  if (oldTier !== newTier) {
    // Remove from old tier set if it exists
    if (oldTier) {
      switch (oldTier) {
        case ProfitTier.TIER1:
          global.pumpFunState.profitTierTraders.tier1.delete(traderAddress);
          break;
        case ProfitTier.TIER2:
          global.pumpFunState.profitTierTraders.tier2.delete(traderAddress);
          break;
        case ProfitTier.TIER3:
          global.pumpFunState.profitTierTraders.tier3.delete(traderAddress);
          break;
        case ProfitTier.TIER4:
          global.pumpFunState.profitTierTraders.tier4.delete(traderAddress);
          break;
        case ProfitTier.TIER5:
          global.pumpFunState.profitTierTraders.tier5.delete(traderAddress);
          break;
      }
    }

    // Add to new tier set if newTier is not null
    if (newTier) {
      switch (newTier) {
        case ProfitTier.TIER1:
          global.pumpFunState.profitTierTraders.tier1.add(traderAddress);
          break;
        case ProfitTier.TIER2:
          global.pumpFunState.profitTierTraders.tier2.add(traderAddress);
          break;
        case ProfitTier.TIER3:
          global.pumpFunState.profitTierTraders.tier3.add(traderAddress);
          break;
        case ProfitTier.TIER4:
          global.pumpFunState.profitTierTraders.tier4.add(traderAddress);
          break;
        case ProfitTier.TIER5:
          global.pumpFunState.profitTierTraders.tier5.add(traderAddress);
          break;
      }
      subscribeToTrader(ws, traderAddress);
    } else if (
      global.pumpFunState.subscribedTraders.has(traderAddress) &&
      ws.readyState === WebSocket.OPEN
    ) {
      // Unsubscribe if tier becomes null and trader is subscribed
      try {
        ws.send(
          JSON.stringify({
            method: "unsubscribeAccountTrade",
            keys: [traderAddress],
          })
        );
        global.pumpFunState.subscribedTraders.delete(traderAddress);
        console.log(
          `Unsubscribed from trader ${traderAddress} (tier became null)`
        );
      } catch (error) {
        console.error(
          `Error unsubscribing from trader ${traderAddress}:`,
          error
        );
      }
    }

    // Update tokenTraderTiers for all tokens the trader has traded
    const tradedMints = new Set(
      traderData.transactions.map((tx) => tx.mint)
    );
    tradedMints.forEach((mint) => {
      if (newTier !== null) {
        updateTokenTraderTiers(mint, traderAddress, newTier);
        updateTierStats(mint); // Ensure tiertransactions and stats are updated
      }
    });
  }
}


export function getTraderStore() {
 if (!global.pumpFunState)
    return {
      traders: [],
      solanaPrice: 0,
      lastPriceUpdate: null,
    };

    
  const traders = [...global.pumpFunState.traderStore.values()]
    .map(trader => ({
      ...trader,
    }));
  return {
    traders,
    solanaPrice: global.pumpFunState.solanaPrice || 0,
    lastPriceUpdate: global.pumpFunState.lastPriceUpdate
      ? global.pumpFunState.lastPriceUpdate.toISOString()
      : null,
  };
}

export function recordTraderTransaction(
  ws: WebSocket,
  traderAddress: string,
  mint: string,
  txType: "buy" | "sell",
  amount: number,
  tokenAmount?: number,
  profit?: number,
  signature?: string
): void {
  if (!global.pumpFunState || !global.pumpFunState.traderStore) return;

  const traderData = global.pumpFunState.traderStore.get(traderAddress) || {
    address: traderAddress,
    totalProfit: 0,
    profitTier: null,
    transactions: [],
    lastActiveTimestamp: new Date(),
  };

  const transaction: TraderTransaction = {
    signature,
    mint,
    txType,
    amount,
    tokenAmount,
    timestamp: new Date(),
    profit,
  };

  const isexistingTransaction = traderData.transactions.find(
    (tx) =>
      tx.signature === signature &&
      tx.txType === txType &&
      tx.mint === mint
  );

  // Check if the transaction already exists
  if (!isexistingTransaction){
    traderData.transactions.push(transaction);
    traderData.lastActiveTimestamp = new Date();
    global.pumpFunState.traderStore.set(traderAddress, traderData);

   if (txType === "sell" && tokenAmount && tokenAmount > 0) {
    const tokenIndex = global.pumpFunState.tokenStore.findIndex(
      (token) => token && token.mint === mint
    );
    if (tokenIndex >= 0) {
      const token = global.pumpFunState.tokenStore[tokenIndex];
      if (token.developeraddress && traderAddress === token.developeraddress) {
        // Increment devTokensSold
        const newDevTokensSold = (token.devTokensSold || 0) + tokenAmount;
        const updatedToken = {
          ...token,
          devTokensSold: newDevTokensSold,
        };
        global.pumpFunState.tokenStore[tokenIndex] = updatedToken;

        // Update tokenActualStore if the token exists there
        const actualTokenIndex = global.pumpFunState.tokenActualStore.findIndex(
          (t) => t && t.mint === mint
        );
        if (actualTokenIndex >= 0) {
          global.pumpFunState.tokenActualStore[actualTokenIndex] = updatedToken;
        }

       
      }
    }
  }


  if (txType === "buy" && traderData.profitTier && typeof tokenAmount === "number") {
    updateTokenTraderTiers(mint, traderAddress, traderData.profitTier);
    
  }

  if (txType === "sell" && traderData.profitTier && typeof tokenAmount === "number") {
  updateTokenTraderTiers(mint, traderAddress, traderData.profitTier);
}


  if (profit) {
    updateTraderProfitTier(ws, traderAddress, profit, global.pumpFunState.solanaPrice);
  
  }
    }
}

// Function to subscribe to a trader
export function subscribeToTrader(ws: WebSocket | null, traderAddress: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN || !global.pumpFunState) {
    console.error(
      "Cannot subscribe to trader: WebSocket not open or global state not initialized"
    );
    return;
  }

  try {
    // Check if already subscribed
    if (global.pumpFunState.subscribedTraders.has(traderAddress)) {
      return;
    }

    // Subscribe to trader
    const payload = {
      method: "subscribeAccountTrade",
      keys: [traderAddress],
    };

    ws.send(JSON.stringify(payload));
    global.pumpFunState.subscribedTraders.add(traderAddress);
  } catch (error) {
    console.error(`Error subscribing to trader ${traderAddress}:`, error);
  }
}

// Get trader statistics - to be used in API endpoints
export function getTraderStats() {
  if (!global.pumpFunState)
    return {
      traderCount: 0,
      tierCounts: { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 },
    };

  return {
    traderCount: global.pumpFunState.traderStore.size,
    tierCounts: {
      tier1: global.pumpFunState.profitTierTraders.tier1.size,
      tier2: global.pumpFunState.profitTierTraders.tier2.size,
      tier3: global.pumpFunState.profitTierTraders.tier3.size,
      tier4: global.pumpFunState.profitTierTraders.tier4.size,
      tier5: global.pumpFunState.profitTierTraders.tier5.size,
    },
  };
}

export function cleanupInactiveTraders(ws: WebSocket | null): void {
  if (!global.pumpFunState || !ws || ws.readyState !== WebSocket.OPEN) {
    console.log(
      "Global state or WebSocket not initialized, skipping trader cleanup"
    );
    return;
  }
  const now = new Date();
  const inactiveTraders: string[] = [];
  const initialTraderCount = global.pumpFunState.traderStore.size;

  for (const [address, trader] of global.pumpFunState.traderStore) {
    const daysInactive =
      (now.getTime() - trader.lastActiveTimestamp.getTime()) /
      (1000 * 60 * 60);
    if (daysInactive > 24) {
      global.pumpFunState.traderStore.delete(address);
      if (trader.profitTier) {
        switch (trader.profitTier) {
          case ProfitTier.TIER1:
            global.pumpFunState.profitTierTraders.tier1.delete(address);
            break;
          case ProfitTier.TIER2:
            global.pumpFunState.profitTierTraders.tier2.delete(address);
            break;
          case ProfitTier.TIER3:
            global.pumpFunState.profitTierTraders.tier3.delete(address);
            break;
          case ProfitTier.TIER4:
            global.pumpFunState.profitTierTraders.tier4.delete(address);
            break;
          case ProfitTier.TIER5:
            global.pumpFunState.profitTierTraders.tier5.delete(address);
            break;
        }
      }
      if (global.pumpFunState.subscribedTraders.has(address)) {
        inactiveTraders.push(address);
        global.pumpFunState.subscribedTraders.delete(address);
      }
    }
  }

  if (inactiveTraders.length > 0) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < inactiveTraders.length; i += CHUNK_SIZE) {
      const chunk = inactiveTraders.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      try {
        ws.send(
          JSON.stringify({ method: "unsubscribeAccountTrade", keys: chunk })
        );
        console.log(
          `Unsubscribed from ${chunk.length} inactive traders (batch ${
            Math.floor(i / CHUNK_SIZE) + 1
          })`
        );
      } catch (error) {
        console.error(`Error unsubscribing from traders:`, error);
      }
    }
    console.log(
      `Cleaned up ${inactiveTraders.length} inactive traders. Trader store size: ${initialTraderCount} -> ${global.pumpFunState.traderStore.size}`
    );
  } else {
    console.log(
      `No inactive traders to clean up. Trader store size: ${initialTraderCount}`
    );
  }
}