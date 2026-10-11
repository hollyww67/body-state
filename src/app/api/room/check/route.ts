import { NextRequest } from 'next/server';
import { videoAccess, videoJson } from '@/lib/video-rooms';
export async function GET(request: NextRequest) {
  try {
    const access = await videoAccess(request, request.nextUrl.searchParams.get('id'));
    if (access.error) return access.error;
    return videoJson({ valid: true, role: access.role, name: access.room.room_name, expiresAt: access.room.expires_at });
  } catch { return videoJson({ error: 'Не удалось проверить доступ. Попробуйте снова.' }, 503); }
}
