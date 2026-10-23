import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';

export async function GET() {
  const database = await checkDatabaseHealth();
  return NextResponse.json(
    { status: database ? 'ok' : 'degraded', database },
    { status: database ? 200 : 503 }
  );
}
