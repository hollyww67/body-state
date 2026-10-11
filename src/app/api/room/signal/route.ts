import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getRedis } from '@/lib/redis';
import { enforceRateLimit, readJsonObject } from '@/lib/request';
import { videoAccess, videoIceServers, videoJson, validVideoId } from '@/lib/video-rooms';

// One lease per participant. Bounded atomic queues, non-destructive reads.
async function handle(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return videoJson({ error: 'Недопустимый источник запроса' }, 403);
    const limited = await enforceRateLimit(request, 'video', 360, 60);
    if (limited) return limited;
    const access = await videoAccess(request, request.nextUrl.searchParams.get('id'));
    if (access.error) return access.error;
    const redis = await getRedis();
    if (!redis?.isReady) return videoJson({ error: 'Связь временно недоступна' }, 503);
    const key = `video:${access.id}:${access.role}`;
    const otherKey = `video:${access.id}:${access.role === 'doctor' ? 'client' : 'doctor'}`;
    if (request.method === 'POST') {
      const body = await readJsonObject(request, 32_768);
      if (body.type === 'join') {
        const iceServers = videoIceServers(access.id);
        const session = randomUUID();
        if (!await redis.set(key, session, { NX: true, EX: 30 })) return videoJson({ error: 'Вы уже подключены в другой вкладке. Выйдите из неё или подождите 30 секунд.' }, 409);
        return videoJson({ session, role: access.role, iceServers });
      }
      if (!validVideoId(body.session) || !validVideoId(body.peer)) return videoJson({ error: 'Некорректная сессия' }, 400);
      const type = body.type;
      if (!['offer','answer','ice'].includes(String(type)) || (type === 'offer' && access.role !== 'doctor') || (type === 'answer' && access.role !== 'client')) return videoJson({ error: 'Недопустимое действие' }, 403);
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return videoJson({ error: 'Некорректные данные' }, 400);
      const data = body.data as Record<string, unknown>;
      if (type !== 'ice' && (data.type !== type || typeof data.sdp !== 'string')) return videoJson({ error: 'Некорректное описание соединения' }, 400);
      if (type === 'ice' && typeof data.candidate !== 'string') return videoJson({ error: 'Некорректный адрес соединения' }, 400);
      const message = JSON.stringify({ id: randomUUID(), from: body.session, type, data });
      const sent = await redis.eval(`if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
        redis.call('RPUSH',KEYS[3],ARGV[3]); redis.call('LTRIM',KEYS[3],-256,-1); redis.call('EXPIRE',KEYS[3],120); return 1`,
        { keys: [key, otherKey, `video:queue:${access.id}:${body.peer}`], arguments: [body.session, body.peer, message] });
      return sent ? videoJson({ ok: true }) : videoJson({ error: 'Участник переподключается' }, 409);
    }
    const session = request.nextUrl.searchParams.get('session');
    if (!validVideoId(session)) return videoJson({ error: 'Некорректная сессия' }, 400);
    if (request.method === 'DELETE') {
      await redis.eval(`if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1],KEYS[2]); return 1 end return 0`, { keys: [key, `video:queue:${access.id}:${session}`], arguments: [session] });
      return videoJson({ ok: true });
    }
    const renewed = await redis.eval(`if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('EXPIRE',KEYS[1],30); return 1 end return 0`, { keys: [key], arguments: [session] });
    if (!renewed) return videoJson({ error: 'Подключение завершено. Войдите в комнату снова.' }, 409);
    const [peer, messages] = await Promise.all([redis.get(otherKey), redis.lRange(`video:queue:${access.id}:${session}`, 0, -1)]);
    return videoJson({ peer, messages: messages.map(m => JSON.parse(m)) });
  } catch (error) {
    if ((error instanceof Error && ['REQUEST_TOO_LARGE','INVALID_JSON_OBJECT'].includes(error.message)) || error instanceof SyntaxError) return videoJson({ error: 'Некорректный запрос' }, 400);
    console.error('[Video] request failed', error instanceof Error ? error.message : 'unknown');
    return videoJson({ error: 'Видеосвязь временно недоступна. Попробуйте позже.' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
