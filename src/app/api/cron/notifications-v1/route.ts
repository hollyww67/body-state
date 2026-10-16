import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/cron-auth';
import { runNotificationMinute } from '@/lib/notification-scheduler';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  // Source header is a contract, NOT authentication; CRON_SECRET and the
  // root-owned system-only guard are the authentication/admission boundary.
  if (request.headers.get('x-notification-source') !== 'system') {
    return NextResponse.json({ error: 'Invalid scheduler source' }, { status: 403 });
  }
  try {
    const result = await runNotificationMinute(request.headers.get('x-notification-minute') || '');
    const status = result.state === 'invalid' ? 409 : ['paused', 'blocked', 'uncertain'].includes(result.state) ? 503 : 200;
    return NextResponse.json(result, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Notification worker unavailable' }, { status: 503 });
  }
}
