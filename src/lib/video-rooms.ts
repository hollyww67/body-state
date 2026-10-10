import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { getAccountSession } from '@/lib/account-auth';

export const videoJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
export const validVideoId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id);

export async function videoAccess(request: NextRequest, id: string | null) {
  if (!validVideoId(id)) return { error: videoJson({ error: 'Комната не найдена' }, 404) };
  const admin = !(await requireAdmin(request));
  const account = admin ? null : await getAccountSession(request);
  if (!admin && !account) return { error: videoJson({ error: 'Войдите в личный кабинет для участия в консультации' }, 401) };
  const result = await pool.query(`
    SELECT b.account_user_id::text, 'Онлайн-консультация' AS room_name,
      (b.status='confirmed' AND b.booking_type='online' AND b.payment_status='paid') AS active,
      s.slot_time - interval '15 minutes' AS opens_at,
      s.slot_time + make_interval(mins => COALESCE(s.duration_minutes,90)+30) AS expires_at
    FROM psychology_bookings b LEFT JOIN slots s ON s.id=b.slot_id WHERE b.room_id=$1
    UNION ALL
    SELECT account_user_id::text, room_name, is_active, created_at, expires_at
    FROM psychology_rooms WHERE room_id=$1 LIMIT 1`, [id]);
  const room = result.rows[0];
  if (!room || (!admin && room.account_user_id !== account?.userId)) return { error: videoJson({ error: 'Комната не найдена или недоступна вашему аккаунту' }, 404) };
  const opens = new Date(room.opens_at).getTime();
  const ends = new Date(room.expires_at).getTime();
  if (!room.active || !room.expires_at || !Number.isFinite(ends) || ends <= Date.now()) return { error: videoJson({ error: 'Консультация отменена, не оплачена или время комнаты истекло' }, 410) };
  if (opens > Date.now()) return { error: videoJson({ error: `Вход откроется ${new Date(opens).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)` }, 403) };
  return { id, role: admin ? 'doctor' as const : 'client' as const, room, expires: ends };
}

export function videoIceServers(roomId: string) {
  const secret = process.env.TURN_SECRET;
  const urls = process.env.TURN_URLS?.split(',').map(s => s.trim()).filter(Boolean);
  if (!secret || !urls?.length || urls.some(s => !/^turns?:[a-z0-9.:-]+(?:\?transport=(udp|tcp))?$/i.test(s))) throw new Error('TURN_NOT_CONFIGURED');
  const username = `${Math.floor(Date.now()/1000)+10800}:${roomId}`;
  return [{ urls, username, credential: createHmac('sha1', secret).update(username).digest('base64') }];
}
