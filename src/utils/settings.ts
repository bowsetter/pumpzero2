import fs from 'fs';
import path from 'path';
import { ProfitTier } from '../types/tokens';

// Define the structure of a profit tier threshold
interface ProfitTierThreshold {
  tier: keyof typeof ProfitTier;
  minProfitUsd: number;
}

// Define the structure of the JSON file
interface ProfitTiersConfig {
  tiers: ProfitTierThreshold[];
}

// Path to the JSON file - using absolute paths for Next.js environment
const APP_ROOT_DIR = process.cwd(); // Gets the project root directory
const DATA_DIR = path.join(APP_ROOT_DIR, 'src/data');
const PROFIT_TIERS_FILE = path.join(DATA_DIR, 'profitTiers.json');


// Default thresholds (used if file is missing or invalid)
const DEFAULT_TIERS: ProfitTierThreshold[] = [
  { tier: 'TIER1', minProfitUsd: 500 },
  { tier: 'TIER2', minProfitUsd: 1000 },
  { tier: 'TIER3', minProfitUsd: 2000 },
  { tier: 'TIER4', minProfitUsd: 5000 },
  { tier: 'TIER5', minProfitUsd: 10000 },
  { tier: 'TIER6', minProfitUsd: 20000 },
  { tier: 'TIER7', minProfitUsd: 50000},
  { tier: 'TIER8', minProfitUsd: 100000 },
];

// In-memory cache for thresholds
let cachedTiers: ProfitTierThreshold[] | null = null;

// Ensure data directory exists
function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`Created directory: ${DATA_DIR}`);
    } catch (error) {
      console.error(`Failed to create directory ${DATA_DIR}:`, error);
      throw new Error(`Cannot create data directory: ${error}`);
    }
  }
}

// Helper function to safely write config to file
function writeConfigToFile(tiers: ProfitTierThreshold[]): void {
  try {
    const config: ProfitTiersConfig = { tiers };
    const jsonContent = JSON.stringify(config, null, 2);
    
    
    // Create directories if they don't exist (including parent directories)
    ensureDataDirectory();
    
    // Direct write approach for Next.js environment
    fs.writeFileSync(PROFIT_TIERS_FILE, jsonContent, { encoding: 'utf8' });
    
    // Verify the write was successful
    const writtenContent = fs.readFileSync(PROFIT_TIERS_FILE, 'utf8');
    if (writtenContent !== jsonContent) {
      throw new Error('File content verification failed');
    }
  } catch (error) {
    console.error(`Failed to write config to ${PROFIT_TIERS_FILE}:`, error);
    throw new Error(`Cannot write to file: ${error}`);
  }
}

// Load thresholds from file or use defaults
function loadTiers(): ProfitTierThreshold[] {
  if (cachedTiers) {
    return cachedTiers;
  }

  ensureDataDirectory();

  try {
    if (!fs.existsSync(PROFIT_TIERS_FILE)) {
      writeConfigToFile(DEFAULT_TIERS);
      cachedTiers = DEFAULT_TIERS;
      return DEFAULT_TIERS;
    }

    const fileContent = fs.readFileSync(PROFIT_TIERS_FILE, 'utf-8');
    
    const config: ProfitTiersConfig = JSON.parse(fileContent);

    // Validate the config
    if (!config.tiers || !Array.isArray(config.tiers)) {
      throw new Error('Invalid profit tiers config: "tiers" must be an array');
    }

    for (const tier of config.tiers) {
      if (!tier.tier || !(tier.tier in ProfitTier)) {
        throw new Error(`Invalid tier name: ${tier.tier}`);
      }
      if (typeof tier.minProfitUsd !== 'number' || tier.minProfitUsd < 0) {
        throw new Error(`Invalid minProfitUsd for tier ${tier.tier}: ${tier.minProfitUsd}`);
      }
    }

    // Sort tiers by minProfitUsd (ascending) to ensure correct tier assignment
    const sortedTiers = config.tiers;
    cachedTiers = sortedTiers;
    return sortedTiers;
  } catch (error) {
    console.error(`Error loading profit tiers from ${PROFIT_TIERS_FILE}:`, error);
    console.log('Using default tiers');
    writeConfigToFile(DEFAULT_TIERS);
    cachedTiers = DEFAULT_TIERS;
    return DEFAULT_TIERS;
  }
}

// Get profit tier thresholds
export function getProfitTierThresholds(): ProfitTierThreshold[] {
  return loadTiers();
}

// Update profit tier thresholds
export function updateProfitTierThresholds(newTiers: ProfitTierThreshold[]): void {
  try {
    // Validate new tiers
    if (!newTiers || !Array.isArray(newTiers)) {
      throw new Error('New tiers must be an array');
    }

    for (const tier of newTiers) {
      if (!tier.tier || !(tier.tier in ProfitTier)) {
        throw new Error(`Invalid tier name: ${tier.tier}`);
      }
      if (typeof tier.minProfitUsd !== 'number' || tier.minProfitUsd < 0) {
        throw new Error(`Invalid minProfitUsd for tier ${tier.tier}: ${tier.minProfitUsd}`);
      }
    }

    // Sort tiers by minProfitUsd
    const sortedTiers = newTiers;;

    // Write to file with our improved helper function
    ensureDataDirectory();
    writeConfigToFile(sortedTiers);
    
    // Update cache
    cachedTiers = sortedTiers;
  } catch (error) {
    console.error(`Error updating profit tiers:`, error);
    throw error;
  }
}

// Clear cache (e.g., for testing or after manual file edits)
export function clearProfitTierCache(): void {
  cachedTiers = null;
}