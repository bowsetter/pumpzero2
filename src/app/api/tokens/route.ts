// src/app/api/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenStore } from '../../../server/tokenManager';
import { FilterValues } from '@/types/tokens';

export async function GET(request: NextRequest) {
  const { tokens, solanaPrice, lastPriceUpdate } = getTokenStore();
  
  // Get filter parameters from URL
  const searchParams = request.nextUrl.searchParams;
  const hasTelegram = searchParams.get('hasTelegram') === 'true';
  const hasWebsite = searchParams.get('hasWebsite') === 'true';
  const hasTwitter = searchParams.get('hasTwitter') === 'true';
  const isKingOfTheHill = searchParams.get('isKingOfTheHill') === 'true';
  const marketCapMin = searchParams.get('marketCapMin') || '';
  const marketCapMax = searchParams.get('marketCapMax') || '';
  const search = searchParams.get('search') || '';
  const createdWithinMinutes = searchParams.get('createdWithinMinutes') || '';
  const replyCount = searchParams.get('replyCount') || '';
  const tierFilter = searchParams.get('tierFilter') || '';
  const maxAllowedDrop = searchParams.get('maxalloweddrop') || '';
  
  const filters: FilterValues = {
    hasTelegram,
    hasWebsite,
    hasTwitter,
    isKingOfTheHill,
    marketCapMin,
    marketCapMax,
    search,
    createdWithinMinutes,
    replyCount,
  tierFilter,
  maxAllowedDrop,
  };
  
  // Apply filters
  const filteredTokens = tokens.filter(token => {
    // Check if token has required properties
    if (filters.hasTelegram && !token.telegram) return false;
    if (filters.hasWebsite && !token.website) return false;
    if (filters.hasTwitter && !token.twitter) return false;
    
    // Calculate USD market cap for filtering
    const marketCapUsd = (token.marketCapSol || 0) * solanaPrice;
    
    // Check market cap range (using calculated USD value)
    if (filters.marketCapMin && marketCapUsd < parseFloat(filters.marketCapMin)) return false;
    if (filters.marketCapMax && marketCapUsd > parseFloat(filters.marketCapMax)) return false;
    
    // Check search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchMatch = 
       (token.mint && token.mint.toLowerCase().includes(searchTerm)) ||
        (token.name && token.name.toLowerCase().includes(searchTerm)) ||
        (token.symbol && token.symbol.toLowerCase().includes(searchTerm)) ||
        (token.description && token.description?.toString().toLowerCase().includes(searchTerm));
      
      if (!searchMatch) return false;
    }
    
    if (filters.createdWithinMinutes) {
      const now = new Date().getTime();
      const tokenTime = new Date(token.timestamp).getTime();
      const createdMinutesAgo = (now - tokenTime) / (1000 * 60);
      const minutesLimit = parseFloat(filters.createdWithinMinutes);
      
      if (createdMinutesAgo > minutesLimit) return false;
    }
    
    // Apply tier filter
    if (filters.tierFilter) {
      const tier = parseInt(filters.tierFilter);
      if (!isNaN(tier) && tier >= 1 && tier <= 5) {
        if (!token.traderTiers) return false;
        // Check tiers from the selected tier up to tier 5
        let hasTierOrHigher = false;
        if (tier === 1 && token.traderTiers.tier1.count > 0) hasTierOrHigher = true;
        if (tier <= 2 && token.traderTiers.tier2.count > 0) hasTierOrHigher = true;
        if (tier <= 3 && token.traderTiers.tier3.count > 0) hasTierOrHigher = true;
        if (tier <= 4 && token.traderTiers.tier4.count > 0) hasTierOrHigher = true;
        if (tier <= 5 && token.traderTiers.tier5.count > 0) hasTierOrHigher = true;
        if (tier <= 6 && token.traderTiers.tier6.count > 0) hasTierOrHigher = true;
        if (tier <= 7 && token.traderTiers.tier7.count > 0) hasTierOrHigher = true;
        if (tier <= 8 && token.traderTiers.tier8.count > 0) hasTierOrHigher = true;
        if (!hasTierOrHigher) return false;
      }
    }

    if (filters.maxAllowedDrop) {
      const maxDrop = parseFloat(filters.maxAllowedDrop);
      if (!isNaN(maxDrop) && token.priceChangePercent) {
        const priceChange = Math.abs(token.priceChangePercent);
        if (priceChange > maxDrop) return false;
      }
    }
    return true;
  });
  
  // Limit to 9 tokens
  const limitedTokens = filteredTokens.slice(0, 60);

  
  return NextResponse.json({
    tokens: limitedTokens,
    solanaPrice,
    lastPriceUpdate
  });
}