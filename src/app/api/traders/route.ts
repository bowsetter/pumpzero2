// src/app/api/tokens/route.ts
import {  NextResponse } from 'next/server';
import { getTraderStore } from '@/server/traderManager';

export async function GET() {
  const { traders, solanaPrice, lastPriceUpdate } = getTraderStore();

  
  return NextResponse.json({
    tokens: traders,
    solanaPrice,
    lastPriceUpdate
  });
}