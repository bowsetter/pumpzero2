import { initGlobalState } from "./globalState";

// Safe JSON parse
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeJsonParse(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return null;
  }
}

// Function to fetch Solana price
export const fetchSolanaPrice = async (): Promise<void> => {
  initGlobalState();

  try {
    // Try CoinGecko API first
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );

    if (response.ok) {
      const data = await response.json();
      const price = data.solana?.usd;

      if (price && typeof price === "number") {
        console.log("Fetched Solana price from CoinGecko:", price);
        global.pumpFunState!.solanaPrice = price;
        global.pumpFunState!.lastPriceUpdate = new Date();
        return;
      }
    }

    // Fallback to Binance API if CoinGecko fails
    const binanceResponse = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"
    );

    if (binanceResponse.ok) {
      const binanceData = await binanceResponse.json();
      const binancePrice = parseFloat(binanceData.price);

      if (!isNaN(binancePrice)) {
        console.log("Fetched Solana price from Binance:", binancePrice);
        global.pumpFunState!.solanaPrice = binancePrice;
        global.pumpFunState!.lastPriceUpdate = new Date();
        return;
      }
    }

    // Second fallback - use a static price if both APIs fail
    console.warn(
      "Failed to fetch Solana price from APIs, using fallback price"
    );
    global.pumpFunState!.solanaPrice = 110; // Use a reasonable fallback price
    global.pumpFunState!.lastPriceUpdate = new Date();
  } catch (error) {
    console.error("Error fetching Solana price:", error);
    // If all attempts fail, use a default price
    if (global.pumpFunState!.solanaPrice === 0) {
      global.pumpFunState!.solanaPrice = 110; // Default fallback price
      global.pumpFunState!.lastPriceUpdate = new Date();
    }
  }
};

// Fetch price immediately and then every 5 minutes
fetchSolanaPrice();
setInterval(fetchSolanaPrice, 5 * 60 * 1000);