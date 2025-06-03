import { NextResponse } from 'next/server';
import { getProfitTierThresholds, updateProfitTierThresholds } from '../../../utils/settings';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'src/data/profitTiers.json');

console.log('API route /api/profit-tiers loaded');

export async function GET() {
  console.log('Handling GET request for /api/profit-tiers');
  try {
    const tiers = getProfitTierThresholds();
    console.log('Fetched tiers:', JSON.stringify(tiers, null, 2));
    return NextResponse.json({ tiers }, { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error fetching profit tiers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profit tiers', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('Handling POST request for /api/profit-tiers');
  try {
    const { tiers } = await request.json();
    console.log('Received tiers for update:', JSON.stringify(tiers, null, 2));
    if (!tiers || !Array.isArray(tiers)) {
      return NextResponse.json({ error: 'Invalid tiers data' }, { status: 400 });
    }
    updateProfitTierThresholds(tiers);
    
    // Read the updated file to confirm
    const updatedData = fs.readFileSync(filePath, 'utf-8');
    const updatedTiers = JSON.parse(updatedData).tiers;

    return NextResponse.json({ success: true, tiers: updatedTiers }, { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error updating profit tiers:', error);
    return NextResponse.json(
      { error: 'Failed to update profit tiers', details: error.message },
      { status: 500 }
    );
  }
}