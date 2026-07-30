# Matchaman Zen Cafe

Self-order web app for a cafe chain, backed by the [ESB ESO-QS](https://developers.esb.co.id/eso-qs/) ordering API. Customers pick a branch, browse that branch's menu, apply a promo, and pay either at the cashier or online via QRIS/e-wallet.

React 19 + Vite SPA in front of a small Express BFF. The BFF exists to keep `ESB_API_TOKEN` and `ESB_COMPANY_CODE` off the client and to reshape ESB's payloads into the snake_case shape the UI consumes.

---

## Architecture

```
src/                 React SPA (Tailwind v4, lazy-loaded cart/checkout/history/summary)
server/app.ts        Every route; exports the Express app. No listen(), no Vite.
server/ratelimit.ts  Redis-backed order limiter + in-memory general limiter
server/env.ts        dotenv side-effect module, imported first
api/index.ts         Vercel entry — every /api/* is rewritten here
server.ts            Dev / self-host entry: mounts Vite middleware, listens
vercel.json          Build config, SPA rewrite, CSP headers
```

Two entry points share one app. Locally, `server.ts` mounts Vite in middleware mode, which keeps dev and production on a single origin.

On Vercel, `vercel.json` rewrites every `/api/*` request to `api/index.ts`, carrying the original path in a `__vpath` parameter that the entry restores onto `req.url` before handing off to Express. This is deliberately **not** a `[...catch-all]` filename: Vercel's `/api` directory registers each file as a function at its *literal* path, so `api/[...path].ts` is reachable only as the URL `/api/[...path]` — every real request misses it, falls through to the SPA rewrite, and comes back as `index.html`.

Three things do not survive the serverless split unchanged, and are handled explicitly:

- **Rate limiting.** The order endpoints spend real money against the merchant's ESB credentials, so their limiter is backed by Upstash Redis — a per-instance counter is no limit at all when instances are ephemeral. It fails **closed** (503) in production when Upstash is unconfigured, and open on a transient Redis error, because a Redis blip must not stop a cafe taking orders. The general browsing limiter stays in-memory on purpose: putting it in Redis would add a round trip to every request to buy very little.
- **CSP.** `index.html` is served straight from the CDN and never passes through Express, so the policy lives in `vercel.json` rather than in helmet.
- **Payment return.** ESB sends the customer back with a **POST**, which a static CDN cannot answer. `/api/payment/return` catches it and 303-redirects to the SPA, which then restores the order from `sessionStorage`.

---

## Running locally

**Requires:** Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the ESB credentials
npm run dev                  # http://localhost:3000
```

`.env.local` overrides `.env`. Neither is committed — only `.env.example` is.

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Express + Vite middleware on one origin, with HMR |
| `npm run lint` | `tsc --noEmit` |
| `npm run build` | `vite build` — the frontend only; Vercel builds the function |
| `npm run build:node` | Frontend + a bundled `build/server.cjs` for self-hosting |
| `npm start` | Runs the self-host bundle |

---

## Environment

See [.env.example](.env.example) for the annotated list. The ones that matter most:

| Variable | Notes |
|---|---|
| `ESB_API_TOKEN`, `ESB_COMPANY_CODE` | Required. Without them every `/api/esb/*` route returns 503. |
| `ESB_API_BASE_URL` | `https://eso-api.esb.co.id` (production) or the staging host. |
| `ESB_TIMEOUT_MS` | Default 9000. Keep it well under `maxDuration` in `vercel.json` — the menu fallback can chain several ESB calls. |
| `APP_URL` | Extra allowed origin. Same-origin requests are accepted regardless. |
| `TRUST_PROXY` | **Must be `1` on Vercel.** Otherwise `req.ip` is the edge IP and every customer shares one rate-limit bucket. Leave empty when the app is reached directly, or clients can spoof `X-Forwarded-For`. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required in production; optional in dev, where the limiter falls back to an in-memory counter. |

---

## Deploying

Vercel picks up `vercel.json` as-is. Set every variable above in the project settings, then deploy.

Verify on a **preview** deployment before promoting — three things can only be proven on a public URL:

1. `curl -I https://<preview>/` returns the `Content-Security-Policy` header, and the browser console is free of CSP violations.
2. The order limiter's count survives a cold start (proof that Upstash is in play, not the in-memory fallback).
3. One real online payment round-trips through `/api/payment/return` and lands on the order summary.

---

## API

All routes are proxied; the ESB token never reaches the browser.

| Route | Purpose |
|---|---|
| `GET /api/healthz` | Liveness. Reveals no configuration, and needs no ESB credentials — the quickest check that the function is reachable at all. Also served at `/healthz` when self-hosting. |
| `GET /api/esb/config` | Merchant code + engine identity |
| `GET /api/esb/outlets` | Branch list |
| `GET /api/esb/outlets/:outletId` | Branch detail: order modes, payment options, tax |
| `GET /api/esb/menu` | Menu for a branch + `visitPurposeID` |
| `POST /api/esb/promotion` | Promos available for a branch/mode |
| `POST /api/esb/calculate-total` | Priced cart, including promo evaluation |
| `POST /api/esb/order` | Create an order (rate limited) |
| `POST /api/esb/order/qr-data` | Cashier QR path (rate limited) |
| `GET /api/esb/payment/validate/:orderId` | Live payment status — polled every 5s |
| `GET /api/esb/order/:orderId/status` | Kitchen status |
| `POST /api/esb/user/orders` | Order history for one customer |
| `ALL /api/payment/return` | 303 bounce for ESB's payment POST-back |

Values interpolated into an upstream ESB path (`orderId`, `visitPurposeID`, `branchCode`) are format-checked first. Express percent-decodes route params, so an unchecked `..%2F` would let a caller aim an authenticated request under the merchant's token at any ESB endpoint.

---

## Behaviour worth knowing

**There is no login.** Order history is keyed to the last order placed on this device: the customer's name and email are saved to `localStorage` after checkout, and `POST /api/esb/user/orders` exchanges them for a user token server-side (`POST /v1/user/auth`) before reading `POST /v1/user/order`. The token is never sent to the browser.

That endpoint mints a token from name + email with **no verification step**, so this is identification, not authentication — anyone who knows a customer's email can read their history. That is ESB's design and the proxy cannot tighten it; closing it needs a real login.

**Payment status polls, it does not assume.** An online order arrives at the summary screen unpaid and shows *Menunggu Pembayaran*. It polls every 5 seconds, pauses while the tab is hidden (the QRIS flow sends the customer into their banking app), checks immediately on return, and stops on a terminal status, on a 4xx, or after 15 minutes. An unrecognised status is treated as still-pending — never as success.

**History is grouped by ESB's `paymentStatus`**, into Pending / Selesai / Ditutup. The spec documents that field by example rather than as an enum, so unmapped values land in Pending and are logged instead of being silently miscounted.

**A branch with no payment methods configured cannot be ordered from**, and the checkout screen says so plainly rather than offering methods ESB would reject.

---

## Not included

- **User authentication.** Protection is per-IP only. Rate limiting narrows the abuse surface; it does not close it.
- **Persistence.** No database. The 15-second response cache is per-instance and purely an optimisation.
