# Doctor Site

Next.js 16 приложение с собственной PostgreSQL базой данных и Redis. Supabase в runtime больше не используется.

## Локальный запуск

1. Скопируйте `.env.example` в `.env.local` и задайте секреты.
2. Поднимите инфраструктуру:

```bash
docker compose up -d postgres redis
```

3. Примените схему и запустите приложение:

```bash
npm run db:migrate
npm run dev
```

Сайт будет доступен на [http://localhost:3000](http://localhost:3000).

## Перенос существующих данных из Supabase

Временно добавьте в окружение `SUPABASE_MIGRATION_URL` и `SUPABASE_MIGRATION_SERVICE_KEY`, затем выполните:

```bash
npm run db:import:supabase
```

Импортёр постранично переносит существующие таблицы, сохраняет UUID и пропускает колонки, отсутствующие в новой схеме. После проверки данных удалите migration-переменные и отзовите старый service key.

## Архитектура данных

- PostgreSQL: каталог, контент, записи, слоты, заказы, отзывы и настройки.
- Redis: админские сессии, rate limit, временные коды и WebRTC-сигналинг.
- `DATABASE_URL` и `REDIS_URL` обязательны в production.

Основная схема находится в `migrations/001_initial.sql`, PostgreSQL-клиент — в `src/lib/db.ts`, Redis-клиент — в `src/lib/redis.ts`.

## Проверки

```bash
npm run lint
npm run build
```
