// src/app/api/tokens/route.ts
import { NextResponse } from 'next/server';
import { getTokenStore } from '../../../server/tokenManager';

export async function GET() {
  const { tokens, solanaPrice, lastPriceUpdate } = getTokenStore();
  
  const sortedTokens = tokens.sort((a, b) => {
    if (!a.startMcap || !a.topMcap) return 1;
    if (!b.startMcap || !b.topMcap) return -1;
    const aChange = ((a.topMcap - a.startMcap) / a.startMcap) * 100;
    const bChange = ((b.topMcap - b.startMcap) / b.startMcap) * 100;
    return bChange - aChange;
  });
  const limitedTokens =sortedTokens.slice(0, 100);

  
  return NextResponse.json({
    tokens: limitedTokens,
    solanaPrice,
    lastPriceUpdate
  });
}