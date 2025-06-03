import { EventEmitter } from "events";
import { TokenData, TraderData } from "../types/tokens";
import sqlite3 from "better-sqlite3";

// Initialize SQLite database
const db = sqlite3("pumpFunState.db");

// Create tables if they don’t exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS traders (
    id TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS profit_tiers (
    trader_id TEXT,
    tier TEXT,
    PRIMARY KEY (trader_id, tier)
  );
  CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Create a global namespace for shared state
declare global {
  /* eslint no-var: 0 */
  var pumpFunState:
    | {
        tokenStore: TokenData[];
        tokenActualStore: TokenData[];
        solanaPrice: number;
        lastPriceUpdate: Date | null;
        eventEmitter: EventEmitter;
        subscribedTokens: Set<string>;
        traderStore: Map<string, TraderData>;
        profitTierTraders: {
          tier1: Set<string>;
          tier2: Set<string>;
          tier3: Set<string>;
          tier4: Set<string>;
          tier5: Set<string>;
        };
        subscribedTraders: Set<string>;
      }
    | undefined;
}

// Define the structure of the state object loaded from the state table
interface StateData {
  tokenActualStore?: TokenData[];
  solanaPrice?: number;
  lastPriceUpdate?: string | null;
  subscribedTokens?: string[];
  subscribedTraders?: string[];
}

// Define interfaces for database row types
interface TokenRow {
  data: string;
}

interface TraderRow {
  id: string;
  data: string;
}

interface ProfitTierRow {
  trader_id: string;
  tier: string;
}

interface StateRow {
  key: string;
  value: string;
}

// Initialize global state from SQLite
export function initGlobalState() {
  if (!global.pumpFunState) {
    console.log("Initializing global pump.fun state from SQLite");

    // Load tokens
    const tokenStore = (db.prepare("SELECT data FROM tokens").all() as TokenRow[]).map(
      (row) => JSON.parse(row.data) as TokenData
    );

    // Load traders
    const traderStore = new Map<string, TraderData>();
    (db.prepare("SELECT id, data FROM traders").all() as TraderRow[]).forEach((row) =>
      traderStore.set(row.id, JSON.parse(row.data) as TraderData)
    );

    // Load profit tiers
    const profitTierTraders = {
      tier1: new Set<string>(),
      tier2: new Set<string>(),
      tier3: new Set<string>(),
      tier4: new Set<string>(),
      tier5: new Set<string>(),
    };
    (db.prepare("SELECT trader_id, tier FROM profit_tiers").all() as ProfitTierRow[]).forEach(
      (row) => {
        if (row.tier === "tier1") profitTierTraders.tier1.add(row.trader_id);
        if (row.tier === "tier2") profitTierTraders.tier2.add(row.trader_id);
        if (row.tier === "tier3") profitTierTraders.tier3.add(row.trader_id);
        if (row.tier === "tier4") profitTierTraders.tier4.add(row.trader_id);
        if (row.tier === "tier5") profitTierTraders.tier5.add(row.trader_id);
      }
    );

    // Load other state
    const state = (db.prepare("SELECT key, value FROM state").all() as StateRow[]).reduce(
      (acc: StateData, row) => {
        acc[row.key as keyof StateData] = JSON.parse(row.value);
        return acc;
      },
      {} as StateData
    );

    global.pumpFunState = {
      tokenStore,
      tokenActualStore: state.tokenActualStore || [],
      solanaPrice: state.solanaPrice || 0,
      lastPriceUpdate: state.lastPriceUpdate ? new Date(state.lastPriceUpdate) : null,
      eventEmitter: new EventEmitter(),
      subscribedTokens: new Set(state.subscribedTokens || []),
      traderStore,
      profitTierTraders,
      subscribedTraders: new Set(state.subscribedTraders || []),
    };
  }
}

// Save global state to SQLite
export function saveGlobalState() {
  if (!global.pumpFunState) {
    throw new Error("Global state not initialized");
  }

  const state = global.pumpFunState;
  const transaction = db.transaction(() => {
    // Clear existing data
    db.prepare("DELETE FROM tokens").run();
    db.prepare("DELETE FROM traders").run();
    db.prepare("DELETE FROM profit_tiers").run();
    db.prepare("DELETE FROM state").run();

    // Save tokens
    const insertToken = db.prepare("INSERT INTO tokens (id, data) VALUES (?, ?)");
    state.tokenStore.forEach((token, index) => {
      insertToken.run(`token_${index}`, JSON.stringify(token));
    });

    // Save traders
    const insertTrader = db.prepare("INSERT INTO traders (id, data) VALUES (?, ?)");
    state.traderStore.forEach((data, id) => {
      insertTrader.run(id, JSON.stringify(data));
    });

    // Save profit tiers
    const insertTier = db.prepare("INSERT INTO profit_tiers (trader_id, tier) VALUES (?, ?)");
    Object.entries(state.profitTierTraders).forEach(([tier, traders]) => {
      traders.forEach((trader_id) => insertTier.run(trader_id, tier));
    });

    // Save other state
    const insertState = db.prepare("INSERT INTO state (key, value) VALUES (?, ?)");
    insertState.run("tokenActualStore", JSON.stringify(state.tokenActualStore));
    insertState.run("solanaPrice", JSON.stringify(state.solanaPrice));
    insertState.run(
      "lastPriceUpdate",
      JSON.stringify(state.lastPriceUpdate ? state.lastPriceUpdate.toISOString() : null)
    );
    insertState.run("subscribedTokens", JSON.stringify(Array.from(state.subscribedTokens)));
    insertState.run("subscribedTraders", JSON.stringify(Array.from(state.subscribedTraders)));
  });

  transaction();
}