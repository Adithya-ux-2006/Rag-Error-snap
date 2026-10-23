import { NextRequest, NextResponse } from 'next/server';
import { solve } from '@/lib/generation';
import { DatabaseError } from '@/lib/db';
import { validateSolveRequest } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import type { SolveRequestInput } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientId = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    const limit = checkRateLimit(clientId);
    if (!limit.allowed) {
      return NextResponse.json(
        { status: 'error', error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = validateSolveRequest(body);

    if (!parsed.success) {
      return NextResponse.json(
        { status: 'error', error: (parsed as { error: string }).error },
        { status: 400 }
      );
    }

    const request: SolveRequestInput = {
      query: parsed.data.query,
      language: parsed.data.language,
      screenshot: parsed.data.screenshot,
    };

    const result = await solve(request);

    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', error: 'Database retrieval failed. Please try again later.' },
        { status: 500 }
      );
    }

    if (result.status === 'insufficient_evidence') {
      return NextResponse.json(
        { status: 'insufficient_evidence', ...result },
        { status: 200 }
      );
    }

    if (result.status === 'generation_unavailable') {
      return NextResponse.json(
        { status: 'generation_unavailable', ...result },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Never expose internal stack traces or config to clients
    if (error instanceof DatabaseError) {
      return NextResponse.json(
        { status: 'error', error: 'Database retrieval failed. Please try again later.' },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { status: 'error', error: 'An unexpected error occurred while processing your request' },
      { status: 500 }
    );
  }
}
