FROM node:24-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TELEGRAM_URL
ARG NEXT_PUBLIC_VK_URL
ARG NEXT_PUBLIC_UMAMI_ID
ARG NEXT_PUBLIC_UMAMI_SRC
ARG NEXT_PUBLIC_TINKOFF_TERMINAL_KEY
ARG NEXT_PUBLIC_OPERATOR_OGRNIP
ARG NEXT_PUBLIC_OPERATOR_ADDRESS
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TELEGRAM_URL=$NEXT_PUBLIC_TELEGRAM_URL
ENV NEXT_PUBLIC_VK_URL=$NEXT_PUBLIC_VK_URL
ENV NEXT_PUBLIC_UMAMI_ID=$NEXT_PUBLIC_UMAMI_ID
ENV NEXT_PUBLIC_UMAMI_SRC=$NEXT_PUBLIC_UMAMI_SRC
ENV NEXT_PUBLIC_TINKOFF_TERMINAL_KEY=$NEXT_PUBLIC_TINKOFF_TERMINAL_KEY
ENV NEXT_PUBLIC_OPERATOR_OGRNIP=$NEXT_PUBLIC_OPERATOR_OGRNIP
ENV NEXT_PUBLIC_OPERATOR_ADDRESS=$NEXT_PUBLIC_OPERATOR_ADDRESS
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx tsc --noEmit && npx eslint src \
  && node tests/admin-modal.cjs && node tests/admin-pwa.cjs \
  && node tests/payment-init.cjs && node tests/dependency-regressions.cjs
RUN npm run build -- --webpack

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/russian_trusted_root_ca.crt

RUN apk add --no-cache ca-certificates \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs \
  && mkdir -p /var/www/doctor-site-uploads/media/images /var/www/doctor-site-uploads/media/videos \
  && chown -R nextjs:nodejs /var/www/doctor-site-uploads

COPY certs/russian_trusted_root_ca.crt /usr/local/share/ca-certificates/russian_trusted_root_ca.crt
RUN update-ca-certificates

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-production-env.mjs ./scripts/validate-production-env.mjs

USER nextjs
EXPOSE 3000
# Schema changes are a separately reviewed release operation, never an app restart side effect.
CMD ["sh", "-c", "node scripts/validate-production-env.mjs && exec node server.js"]
