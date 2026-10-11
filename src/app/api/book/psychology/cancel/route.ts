import { NextRequest, NextResponse } from 'next/server';
import { POST as cancel } from '../../cancel/route';
import { readJsonObject } from '@/lib/request';

/** Compatibility route; use the same atomic safeguards as other services. */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, 8192);
    return cancel(new NextRequest(request.url, { method:'POST', headers:request.headers,
      body:JSON.stringify({...body,bookingType:'psychology'}) }));
  } catch { return NextResponse.json({error:'Некорректный запрос'},{status:400}); }
}
