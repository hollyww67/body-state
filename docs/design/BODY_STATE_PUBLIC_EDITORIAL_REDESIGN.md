# Body State — public site editorial redesign

## Intent and source

Design guidance: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (layout, typography hierarchy, premium service patterns, accessibility checklist, and anti-patterns). The repo's **README and documented principles were reviewed** for this change. The upstream CLI generator was **not executed** in this environment; do not claim a generated design-system output.

To install the official skill inside the Codex checkout, run in the **project root** after reviewing the installer:

```bash
npx ui-ux-pro-max-cli init --ai codex
```

Official npm package is `ui-ux-pro-max-cli`, not the obsolete `uipro-cli`. Requires Node.js and Python 3. Do not commit generated files without reviewing changes for conflicts with existing `AGENTS.md`, development rules or components.

## Art direction

**Premium without spectacle.** A calm, editorial aesthetic: restrained neutral paper, desaturated foliage green, near-black text, structured lines, spacious typesetting. The contrast is Manrope for legibility and an existing Cormorant Garamond family for gentle editorial emphasis. This is temporary, while the custom Body State serif/sans wordmark is being refined.

Visual tokens, local to `.bs-editorial`:

| Element | Value |
| --- | --- |
| Background | `#f7f5ef` |
| Main ink | `#272d27` |
| Accent | `#3d594b` |
| Neutral line | `#d8d8d0` |
| Quiet accent surface | `#e8e9e2` |
| Closing CTA surface | `#2b3a31` |
| Sans | Existing Manrope |
| Serif | Existing Cormorant Garamond |

**Removed from home:** animated orbs and orbit, hero stat widgets, glass cards, gradient CTA, fake numbers, sparkles, infinite marquee, 3D review transitions, auto-sliding testimonials, duplicate benefit cards and broad decorative animated background. No newly invented metrics, reviews, outcomes or photos.

**Maintained:** editable page copy (except deleted/unused benefits fields), two rehabilitation categories, process, real published service reviews, enquiry and appointment routes, legal footer, site navigation, admin, service booking and payment logic.

## Store visibility contract

- DB setting: `settings.key = 'shop_visible'`, literal text `'true'` / `'false'`.
- Default: hidden, with fail-closed behavior on DB query error.
- Admin GET/PATCH: `/api/admin/site-visibility` with existing admin session enforcement.
- Public GET: `/api/site-visibility`, `Cache-Control: no-store`.
- Hide nav/cart/footer links if disabled; server-side `/shop/**` layout returns 404.
- Hide public products API and block **only product** items in `/api/payment/init`; service payments must remain available.
- Remove shop and product pages from `sitemap.xml` when disabled. Do not delete products, orders or admin screens.
- No migration: `settings` already exists.

## Mandatory checks before production

1. `npm run lint`, `npx tsc --noEmit`, `npm run build` on the correct integrated feature branch.
2. Admin: switch OFF → shop missing from desktop + mobile + footer; `/shop`, `/shop/cart`, `/shop/checkout`, `/shop/{slug}` return 404, API products 404, sitemap excludes product URLs.
3. OFF → payment initialization with `productId` rejected, service/booking payments accepted, no changes to booking data.
4. Admin: switch ON → all catalog/cart/checkout routes, nav/footer links, products API, sitemap restored. Refresh existing clients and check stale client-side cart state.
5. Auth checks: anonymous GET public state only; unauthenticated PATCH admin denied; invalid body 400; repeat toggle, timeout/failure feedback; no CSRF regression.
6. Desktop: 1440px and 1920px. Tablet 768px. Mobile: 320/375/390px. Focus navigation, screen readers, reduced-motion, 200% zoom, long Russian text, contrast (normal text >=4.5:1).
7. Home copy editing, real reviews, all CTA links, SEO title/H1, hero legibility with each existing theme.
8. **Owner visual approval** required, then merge stacked PRs in order. Do not deploy without separate explicit approval.

No browser or CI results are claimed by this document.
