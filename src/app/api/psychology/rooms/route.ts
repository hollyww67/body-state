import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/admin-auth';
import { cleanText, normalizeEmail, readJsonObject } from '@/lib/request';
import { videoJson } from '@/lib/video-rooms';

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await readJsonObject(request, 4096);
    const name = cleanText(body.room_name, 120);
    const email = normalizeEmail(body.email);
    if (!name || !email) return videoJson({ error: 'Укажите название и email аккаунта клиента' }, 400);
    const account = await pool.query('SELECT id FROM account_users WHERE lower(email)=$1 AND disabled_at IS NULL LIMIT 1', [email]);
    if (!account.rows[0]) return videoJson({ error: 'Аккаунт с этим email не найден. Попросите клиента зарегистрироваться.' }, 400);
    const roomId = randomUUID();
    const result = await pool.query(`INSERT INTO psychology_rooms (room_id,room_name,created_by,meeting_url,account_user_id,expires_at)
      VALUES ($1,$2,'Специалист',$3,$4,now()+interval '24 hours') RETURNING id`,
      [roomId, name, '/psychology/room?id='+roomId, account.rows[0].id]);
    return videoJson({ success: true, id: result.rows[0].id }, 201);
  } catch { return videoJson({ error: 'Не удалось создать комнату' }, 500); }
}
export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const result = await pool.query(`
      SELECT 'manual' AS kind, r.id::text, r.room_id, r.room_name, r.is_active,
        r.expires_at, r.created_at AS starts_at, a.email, a.display_name AS client_name
      FROM psychology_rooms r LEFT JOIN account_users a ON a.id=r.account_user_id
      WHERE r.account_user_id IS NOT NULL AND r.expires_at > now()-interval '7 days'
      UNION ALL
      SELECT 'booking', b.id::text, b.room_id, 'Онлайн-консультация',
        b.status='confirmed' AND b.payment_status='paid',
        s.slot_time+make_interval(mins => COALESCE(s.duration_minutes,90)+30),
        s.slot_time, b.client_email, b.client_name
      FROM psychology_bookings b JOIN slots s ON s.id=b.slot_id
      WHERE b.booking_type='online' AND b.room_id IS NOT NULL AND s.slot_time>now()-interval '7 days'
      ORDER BY starts_at DESC LIMIT 200`);
    return videoJson(result.rows);
  } catch { return videoJson({ error: 'Не удалось загрузить комнаты' }, 500); }
}
