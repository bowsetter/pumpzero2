// src/app/api/tokens/route.ts
import {  NextResponse } from 'next/server';
import { getTokenStore } from '../../../server/tokenManager';

export async function GET() {
  const { tokens, solanaPrice, lastPriceUpdate } = getTokenStore();
  
  const sortedTokens = tokens
  .filter(token => {
    const marketCap = token.topMcap ? token.topMcap * solanaPrice : 0;
    return marketCap > 50000;
  })
  .sort((a, b) => {
    if (!a.topMcap) return 1;
    if (!b.topMcap) return -1;
    return b.topMcap - a.topMcap;
  });
  
  const limitedTokens =sortedTokens.slice(0, 200);

  
  return NextResponse.json({
    tokens: limitedTokens,
    solanaPrice,
    lastPriceUpdate
  });
}