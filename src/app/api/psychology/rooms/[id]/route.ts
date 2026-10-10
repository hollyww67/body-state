import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { videoAccess, videoJson } from '@/lib/video-rooms';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const access = await videoAccess(request, id);
    if (access.error) return access.error;
    return videoJson({ room_name: access.room.room_name, meeting_url: '/psychology/room?id='+id, expires_at: access.room.expires_at });
  } catch { return videoJson({ error: 'Комната временно недоступна' }, 503); }
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!/^\d{1,16}$/.test(id)) return videoJson({ error: 'Некорректный идентификатор' }, 400);
  try {
    await pool.query('UPDATE psychology_rooms SET is_active=false WHERE id=$1', [id]);
    return videoJson({ success: true });
  } catch { return videoJson({ error: 'Не удалось закрыть комнату' }, 500); }
}
