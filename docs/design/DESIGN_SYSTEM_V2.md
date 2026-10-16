# Body State Design System 2.0

## Архитектура и границы

Первая очередь — существующая административная панель. База: deployed source `5d3146fc6402c50adb4ada24a255944ab577e7d7`, отдельная ветка `feat/admin-design-system-v2`. Подготовка MAX V2 в другой ветке не включена. Backend, API, DB, Scheduling V2, уведомления и платежи не меняются.

React 19.2.4 / Next 16.3.8. Tailwind utilities + `@tailwindcss/postcss` 4.3.2 при установленном Tailwind 3.4.19; зависимости в этой задаче не обновляются. Существуют CVA, clsx, tailwind-merge, Lucide, Sonner; новые библиотеки не добавлены. Manrope с кириллицей уже загружается через next/font. Сохраняются server auth layout и client islands.

`src/app/admin/design-system.css` импортируется после legacy admin.css и содержит семантические `--bs-*` токены с мостом к `--admin-*`. Scope — `.admin-shell` и portal `.admin-confirm-dialog`. Публичные UI primitives не переписываются. Legacy CSS пока сохраняется, чтобы не сломать вторую очередь.

## Foundations

Фон #F7F9F8, поверхность #FFFFFF, текст #202C2B, primary #28776C / hover #1F5F57, мягкий primary #E4F2ED, граница #E1E8E5. Вторичный текст затемнён относительно #697875 из референса до #586B68 для читаемости мелких подписей. Семантика success/warning/destructive/info имеет самостоятельные foreground/background.

Типографика: display 40/48, h1 32/40, h2 24/32, h3 20/28, h4 18/26; body-lg18/28, body16/24, small14/20, label14/20, caption12/16. Interactions min44px, мобильные поля16px против iOS autozoom. Spacing4/8/12/16/20/24/32/40/48/64. Радиусы6/8/12/16/pill. Две мягкие тени. Motion140/220ms; reduced-motion отключает анимации.

Существующая violet-тема сохраняется через семантический override. Новая альтернативная тёмная концепция не создаётся. Реальный `/admin-icons/192.png` используется вместо декоративной Sparkles; лист из референса не является действующим логотипом проекта.

## Accessibility

Нативные button/input/select/checkbox/radio, явные labels, aria-pressed фильтров, focus-visible, skip-link. Dialog остаётся существующим native top-layer с focus trap/restore, Escape и iOS scroll lock. Обработка busy/error не переписана. Для AdminField consumer обязан передать input id и `aria-describedby="<id>-description"`, если использует hint/error, и aria-invalid при ошибке.

Не заявляется полная сертификация WCAG: нужен отдельный screen-reader/device acceptance. Изображённые в макетах специалисты, кабинеты, выручка и проценты роста не добавляются как фиктивная функциональность.
