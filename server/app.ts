import './env.js';
import express from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import { createMemoryRateLimiter, createSharedRateLimiter, rateBuckets } from './ratelimit.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

// ----------------------------------------------------
// ESB ESO-QS API CONFIGURATION
// ----------------------------------------------------
const ESB_API_BASE = process.env.ESB_API_BASE_URL || 'https://eso-api.esb.co.id';
const ESB_API_TOKEN = process.env.ESB_API_TOKEN || '';
const ESB_COMPANY_CODE = process.env.ESB_COMPANY_CODE || '';
const ESB_TIMEOUT_MS = parseInt(process.env.ESB_TIMEOUT_MS || '9000', 10);

// Fail fast: without credentials every ESB request would fail with a confusing
// upstream error. This used to process.exit(1), which is wrong for a serverless
// function — the process dies before it can answer, so the caller sees an
// opaque platform error instead of a diagnosable one. Refuse the ESB routes
// with an explicit 503 instead, and log just as loudly.
const missingCreds = [
  !ESB_API_TOKEN && 'ESB_API_TOKEN',
  !ESB_COMPANY_CODE && 'ESB_COMPANY_CODE',
].filter(Boolean);

if (missingCreds.length > 0) {
  const detail = `Missing required env var(s): ${missingCreds.join(', ')}`;
  if (IS_PROD) {
    console.error(`[FATAL] ${detail}. ESB endpoints will return 503.`);
  } else {
    console.warn(`[WARN] ${detail}. ESB requests will fail until these are set.`);
  }
}

// ----------------------------------------------------
// SECURITY MIDDLEWARE
// ----------------------------------------------------

// Behind a load balancer, req.ip is the proxy's address unless trust proxy is
// set — which would put every user in one shared rate-limit bucket. Left off by
// default because enabling it blindly makes X-Forwarded-For spoofable.
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
}

app.use(
  helmet({
    // CSP is set at the CDN edge (vercel.json) rather than here: after the
    // serverless split, index.html is served straight from the CDN and never
    // passes through Express, so a policy set here would cover the JSON API
    // and miss the document it is actually meant to protect.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '256kb' }));

// ----------------------------------------------------
// PAYMENT RETURN
// ----------------------------------------------------

// ESB sends the customer back here once an online payment completes, and it
// does so with a POST — which a static CDN cannot answer. Bounce it to the SPA
// with a 303 so the browser follows up with a GET.
//
// Registered before the origin allowlist and the limiters on purpose: the
// request originates from ESB, not from our own page, and turning a paying
// customer away at the door is far worse than the abuse surface of a redirect
// whose destination is hardcoded.
app.all('/api/payment/return', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'POST') return next();
  const params = new URLSearchParams(req.query as Record<string, string>).toString();
  res.redirect(303, '/' + (params ? '?' + params : ''));
});

// Origin allowlist.
//
// NOTE: this only constrains *browsers*. It stops another site from driving your
// API through a visitor's browser; it does NOT stop someone curling these
// endpoints directly. Rate limiting and payload validation below are what make
// direct abuse expensive. Real closure requires user auth.
//
// Extra hosts beyond same-origin. APP_URL is here so a deliberate cross-origin
// setup (separate marketing domain calling this API) still works.
const allowedOrigins = new Set(
  [process.env.APP_URL, !IS_PROD && `http://localhost:${PORT}`, !IS_PROD && `http://127.0.0.1:${PORT}`]
    .filter(Boolean)
    .map((o) => String(o).replace(/\/$/, ''))
);

app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  const origin = req.headers.origin;
  // Absent Origin means a non-browser client; the limiter handles those.
  if (!origin) return next();

  // Same-origin is the check this middleware actually wants: a cross-site page
  // driving our API sends its own Origin while Host stays ours. Comparing hosts
  // rather than matching a literal APP_URL is what keeps checkout working on
  // every hostname the app is legitimately served under — apex, www,
  // <project>.vercel.app, and every preview URL — none of which APP_URL can
  // enumerate ahead of time.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    console.warn(`[ORIGIN BLOCKED] ${req.method} ${req.path} from malformed origin ${origin}`);
    return res.status(403).json({ success: false, error: 'Origin tidak diizinkan.' });
  }

  if (originHost === req.headers.host) return next();
  if (allowedOrigins.has(origin.replace(/\/$/, ''))) return next();

  console.warn(`[ORIGIN BLOCKED] ${req.method} ${req.path} from ${origin} (host: ${req.headers.host})`);
  return res.status(403).json({ success: false, error: 'Origin tidak diizinkan.' });
});

// Scoped to /api/esb so the payment return and the health probe stay reachable
// even on a misconfigured deployment — those are exactly the routes you need
// working while you diagnose one.
app.use('/api/esb', (_req, res, next) => {
  if (missingCreds.length > 0) {
    return res.status(503).json({
      success: false,
      error: 'Layanan sedang tidak tersedia. Konfigurasi server belum lengkap.',
    });
  }
  next();
});

// Simple in-memory cache with TTL.
//
// Per-instance under serverless, which is fine: the TTL is 15 seconds and this
// is a pure optimisation, so a cold instance just pays for one extra ESB call.
const cache = new Map<string, { data: any; expiry: number }>();
function cacheGet(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function cacheSet(key: string, data: any, ttlMs: number = 30000) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = ESB_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// Anything interpolated into an upstream ESB URL path must match this first.
// Express percent-decodes route params, so an unchecked `..%2F..%2F` becomes
// real path separators and the proxy would happily issue an arbitrary
// authenticated request under the merchant's bearer token.
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

// Carries the upstream status alongside the message so a handler can tell an
// ESB 400 ("item habis") apart from an ESB 500, instead of collapsing both into
// one opaque server error. The message format is unchanged, so sanitizeError's
// `ESB API Error:` check still matches.
class EsbError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`ESB API Error: ${status} - ${body}`);
    this.name = 'EsbError';
  }
}

// ESB's 4xx bodies carry the reason the customer can actually act on — an item
// just sold out, the payment method isn't enabled for this branch, the minimum
// subtotal isn't met. Forward that one field, and only that field: 5xx, non-JSON
// bodies and HTML error pages all fall through to the generic message.
function esbClientError(err: unknown): { status: number; error: string } | null {
  if (!(err instanceof EsbError)) return null;
  if (err.status < 400 || err.status >= 500) return null;

  let message: unknown = '';
  try {
    const parsed = JSON.parse(err.body);
    message = parsed?.message || parsed?.error || parsed?.errorMessage || '';
  } catch {
    return null;
  }

  if (typeof message !== 'string' || !message.trim()) return null;
  return { status: err.status, error: message.trim().slice(0, 300) };
}

// Sanitize error message for client — never leak internal API details
function sanitizeError(err: unknown, context: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === 'AbortError') {
    console.error(`[ESB TIMEOUT] ${context}: request timed out`);
    return `Server sedang sibuk, silakan coba lagi (${context})`;
  }
  console.error(`[ESB ERROR] ${context}:`, msg);
  if (msg.startsWith('ESB API Error:')) {
    return `Terjadi kesalahan saat berkomunikasi dengan server (${context})`;
  }
  return `Terjadi kesalahan: ${context}`;
}

// Rate limiting. Two tiers with deliberately different backing stores:
//
//   general — per-instance counter. A coarse damper on browsing; being
//             multiplied by the warm-instance count is acceptable, and putting
//             it in Redis would add a network round trip to every single call.
//   order   — Redis-backed, because these endpoints create real orders against
//             the merchant's ESB credentials. A per-instance cap there is no
//             cap at all.
const generalLimiter = createMemoryRateLimiter(60000, 120, 'general');
const orderLimiter = createSharedRateLimiter(60000, 6, 'order');

// Scoped to /api, not app-wide: in dev this same app has vite.middlewares
// mounted behind it and in self-host mode express.static, so an unscoped
// limiter counts every ES module and every image against the 120/min budget
// and starts answering script requests with JSON 429s.
app.use('/api', generalLimiter);

// Helper: make authenticated request to ESB API
async function esbFetch(endpoint: string, branchCode: string, options: RequestInit = {}) {
  const url = `${ESB_API_BASE}${endpoint}`;
  // The body MUST be part of the key: /qsv1/promotion is a POST whose
  // visitPurposeID lives only in the body, so keying on method alone served one
  // order mode's promos to another for the whole TTL.
  const bodyKey = options.body
    ? crypto.createHash('sha1').update(String(options.body)).digest('hex').slice(0, 16)
    : '';
  const cacheKey = `${branchCode}:${endpoint}:${options.method || 'GET'}:${bodyKey}`;

  // Only cache GET requests and menu/promotion/branch endpoints
  const isCacheable = !options.method || options.method === 'GET'
    || endpoint.includes('/menu')
    || endpoint.includes('/promotion')
    || endpoint.includes('/setting/branch');
  const isGetMenuOrBranch = endpoint.includes('/menu') || endpoint.includes('/setting/branch') || endpoint.includes('/promotion');

  if (isCacheable && isGetMenuOrBranch) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ESB_API_TOKEN}`,
    'Data-Company': ESB_COMPANY_CODE,
    ...(options.headers as Record<string, string> || {}),
  };

  // Only add Data-Branch if branchCode is provided and not the company code
  if (branchCode && branchCode !== ESB_COMPANY_CODE) {
    headers['Data-Branch'] = branchCode;
  }

  const response = await fetchWithTimeout(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.text();
    throw new EsbError(response.status, error);
  }

  const data = await response.json();

  if (isCacheable && isGetMenuOrBranch) {
    cacheSet(cacheKey, data, 15000); // 15s TTL
  }

  return data;
}

// ----------------------------------------------------
// PAYLOAD VALIDATION
// ----------------------------------------------------

const MAX_FIELD_LEN = 200;
const MAX_ADDRESS_LEN = 500;
const MAX_LINE_ITEMS = 100;

// Reject absurd orders here rather than forwarding them to ESB under the
// merchant's credentials. Returns an error string, or null when the payload is
// structurally sound.
function validateOrderPayload(body: Record<string, any>): string | null {
  const { salesMenus, fullName, email, phoneNumber, deliveryAddress, amount, orderType } = body;

  if (!Array.isArray(salesMenus) || salesMenus.length === 0) {
    return 'salesMenus harus berupa array dan tidak boleh kosong';
  }
  if (salesMenus.length > MAX_LINE_ITEMS) {
    return `Maksimal ${MAX_LINE_ITEMS} item per pesanan`;
  }

  for (const item of salesMenus) {
    if (!item || typeof item !== 'object') return 'Format item pesanan tidak valid';
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
      return 'Jumlah tiap item harus bilangan bulat antara 1 dan 99';
    }
    if (item.menuID === undefined || item.menuID === null) {
      return 'Setiap item pesanan wajib punya menuID';
    }
  }

  const lengths: [string, any, number][] = [
    ['fullName', fullName, MAX_FIELD_LEN],
    ['email', email, MAX_FIELD_LEN],
    ['phoneNumber', phoneNumber, MAX_FIELD_LEN],
    ['deliveryAddress', deliveryAddress, MAX_ADDRESS_LEN],
  ];
  for (const [name, value, max] of lengths) {
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') return `${name} harus berupa teks`;
    if (value.length > max) return `${name} melebihi ${max} karakter`;
  }

  // A delivery order with no address falls back to the branch's own address on
  // the client, which dispatches the courier straight back to the cafe. Refuse
  // it here too, so the guard survives any client that forgets it.
  if (orderType === 'delivery' && (typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5)) {
    return 'Alamat pengiriman wajib diisi untuk pesanan delivery';
  }

  if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
    return 'amount harus berupa angka non-negatif';
  }

  return null;
}

// ----------------------------------------------------
// ESB ESO-QS API PROXY ENDPOINTS
// ----------------------------------------------------

// Liveness probe — deliberately reveals no configuration.
//
// Registered under /api as well as at the root: on Vercel the function only
// receives /api/*, so a bare /healthz never reaches this app and would be
// answered by the SPA rewrite with index.html. /api/healthz is therefore the
// one endpoint that proves the function is wired up without needing ESB
// credentials to be set.
app.get(['/healthz', '/api/healthz'], (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// 1. Config check
app.get('/api/esb/config', (_req, res) => {
  res.json({
    status: 'ok',
    engine: 'ESB ESO-QS (Ordering System - Quick Service)',
    mode: 'LIVE_API',
    merchantId: ESB_COMPANY_CODE,
  });
});

// 2. Get Branch List (by user location)
app.get('/api/esb/outlets', async (req, res) => {
  try {
    const lat = encodeURIComponent(req.query.lat as string || '-6.2088');
    const long = encodeURIComponent(req.query.long as string || '106.8456');
    const url = `${ESB_API_BASE}/qsv1/branch/${lat}/${long}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ESB_API_TOKEN}`,
        'Data-Company': ESB_COMPANY_CODE,
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ESB API Error: ${response.status} - ${error}`);
    }

    const result = await response.json();

    const mappedData = (result.branches || []).map((b: any) => ({
      outlet_id: b.branchCode || b.outletCode,
      outlet_name: b.branchName,
      address: b.address,
      is_open: b.businessHour?.status !== 'closed',
      prep_time_minutes: b.prepTime || '10 - 15 mins',
      operating_hours: b.businessHour?.startTime
        ? `${b.businessHour.startTime} - ${b.businessHour.endTime}`
        : '08:00 - 23:00',
      distance_km: b.distance || 0,
      image_url: b.thumbnailImageUrl || b.bannerImageUrl,
      lat: b.latitude,
      lng: b.longitude,
    }));

    // The company is only reported here, at the top level of the branch list —
    // branch detail carries companyCode but not the display name. Sent as a
    // sibling of `data` rather than wrapped around it, so the existing array
    // shape the client already consumes stays untouched.
    res.json({
      success: true,
      code: 200,
      company: {
        code: result.companyCode || ESB_COMPANY_CODE,
        name: result.companyName || '',
      },
      data: mappedData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'outlets') });
  }
});

// 3. Get Branch Detail
app.get('/api/esb/outlets/:outletId', async (req, res) => {
  try {
    const branchCode = req.params.outletId;
    if (!SAFE_ID.test(branchCode)) {
      return res.status(400).json({ success: false, error: 'Invalid branch code' });
    }
    const result = await esbFetch('/qsv1/setting/branch', branchCode);
    // API returns data at the top level (no data wrapper)
    const branchData = result;

    res.json({
      success: true,
      code: 200,
      data: {
        outlet_id: branchData.branchCode || branchData.outletCode,
        outlet_name: branchData.branchName,
        address: branchData.address,
        is_open: branchData.businessHour?.find((h: any) => h.isCurrentDay)?.isOperatingDay !== 'closed',
        prep_time_minutes: '10 - 15 mins',
        operating_hours: (() => {
          const today = branchData.businessHour?.find((h: any) => h.isCurrentDay);
          return today?.startTime ? `${today.startTime} - ${today.endTime}` : '08:00 - 23:00';
        })(),
        distance_km: 0,
        image_url: branchData.thumbnailImageUrl || branchData.bannerImageUrl,
        available_sales_modes: (branchData.orderModes || []).map((m: any) => ({
          type: m.type,
          name: m.name || m.type,
          visitPurposeID: m.visitPurposeID,
        })),
        payment: {
          atCashier: branchData.payment?.atCashier ?? true,
          online: (branchData.payment?.online || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            nameId: p.nameId,
            description: p.description,
            needPhoneInput: p.needPhoneInput ?? false,
          })),
          paymentMapping: branchData.payment?.paymentMapping || [],
          deliveryPayment: branchData.payment?.deliveryPayment ?? false,
          deliveryPaymentName: branchData.payment?.deliveryPaymentName,
        },
        lat: branchData.latitude,
        lng: branchData.longitude,
        tax_info: {
          tax_name: branchData.taxName,
          tax_value: branchData.taxValue,
          additional_tax_name: branchData.additionalTaxName,
          additional_tax_value: branchData.additionalTaxValue,
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'branch detail') });
  }
});

// 4. Get Menu
app.get('/api/esb/menu', async (req, res) => {
  try {
    const branchCode = req.query.branchCode as string;
    if (!branchCode) {
      return res.status(400).json({ success: false, error: 'branchCode is required' });
    }

    const requestedVisitPurposeID = req.query.visitPurposeID as string | undefined;
    if (requestedVisitPurposeID && !SAFE_ID.test(requestedVisitPurposeID)) {
      return res.status(400).json({ success: false, error: 'Invalid visitPurposeID' });
    }

    let visitPurposeID = requestedVisitPurposeID || '';
    let menuResult: any = null;

    if (visitPurposeID) {
      try {
        menuResult = await esbFetch(`/qsv1/menu/${visitPurposeID}`, branchCode);
      } catch {
        // The client's hint came from whichever branch/sales mode it last saw,
        // which may not be the one being requested now. Don't turn that into a
        // 500 the client has no error state for — fall through and ask ESB
        // which purposes this branch actually has.
        console.log(`visitPurposeID "${visitPurposeID}" failed for branch ${branchCode}, falling back to branch settings...`);
        visitPurposeID = '';
      }
    }

    if (!menuResult) {
      // Fallback: get branch settings to extract visitPurposeID from orderModes
      const branchResult = await esbFetch('/qsv1/setting/branch', branchCode);
      const branchData = branchResult;
      const orderModes = branchData.orderModes || [];

      // Try each orderMode's visitPurposeID until one works. Each attempt is a
      // fresh ESB round trip, so this path is the one most at risk of hitting
      // the function's maxDuration — keep ESB_TIMEOUT_MS well under it.
      for (const mode of orderModes) {
        if (!mode.visitPurposeID) continue;
        try {
          menuResult = await esbFetch(`/qsv1/menu/${mode.visitPurposeID}`, branchCode);
          visitPurposeID = mode.visitPurposeID;
          break;
        } catch {
          console.log(`visitPurposeID "${mode.visitPurposeID}" failed for branch ${branchCode}, trying next...`);
          continue;
        }
      }
    }

    if (!menuResult) {
      return res.status(400).json({ success: false, error: `No valid visit purpose found for branch ${branchCode}` });
    }

    // ESB API returns: result.menuCategories[].menuCategoryDetails[].menus[]
    const menuCategories = menuResult.menuCategories || [];

    // Build categories from menuCategoryDetails (sub-categories like "Appetizer", "Main Course")
    const categories: any[] = [];
    const items: any[] = [];
    // Set rather than scanning `categories` on every sub-category: this runs
    // once per menu item on a cold cache, on the request path.
    const seenCategories = new Set<string>();

    for (const cat of menuCategories) {
      for (const detail of (cat.menuCategoryDetails || [])) {
        const catId = detail.menuCategoryDetailID || detail.menuCategoryDetailCode;
        const catName = detail.menuCategoryDetailDesc || detail.description || 'Other';

        if (!seenCategories.has(String(catId))) {
          seenCategories.add(String(catId));
          categories.push({ category_id: catId, category_name: catName });
        }

        // Map menu items within this sub-category
        for (const item of (detail.menus || [])) {
          items.push({
            item_id: item.menuID,
            item_name: item.menuName,
            category_id: catId,
            category_name: catName,
            price: item.sellPrice || item.price || 0,
            description: item.description || '',
            image_url: item.imageUrl || item.imageOptimUrl || '',
            is_popular: item.flagRecommendation === 1,
            is_available: !item.flagSoldOut,
            modifier_groups: [
              // Map menuPackages as modifier groups (each package is a group with nested packages)
              ...(item.menuPackages?.map((pkg: any) => ({
                group_id: `pkg_${item.menuID}_${pkg.menuGroupID}`,
                group_name: pkg.menuGroup || 'Package',
                is_required: (pkg.minQty || 0) > 0,
                min_qty: pkg.minQty || 0,
                max_qty: pkg.maxQty || 1,
                options: (pkg.packages || []).map((p: any) => ({
                  option_id: p.menuID || p.menuCode,
                  option_name: p.menuName || p.menuShortName,
                  price: p.sellPrice || p.price || 0,
                })),
              })) || []),
              // Map menuExtras groups (each group has a name and nested extras array)
              ...(item.menuExtras?.map((group: any) => ({
                group_id: `ext_${item.menuID}_${group.menuGroupID || group.menuGroup}`,
                group_name: group.menuGroup || 'Extras',
                is_required: (group.minQty || 0) > 0,
                min_qty: group.minQty || 0,
                max_qty: group.maxQty || 1,
                options: (group.extras || []).map((e: any) => ({
                  option_id: e.menuExtraID,
                  option_name: e.menuExtraName,
                  price: e.sellPrice || e.price || 0,
                })),
              })) || []),
            ],
          });
        }
      }
    }

    res.json({
      success: true,
      code: 200,
      data: { outlet_id: branchCode, categories, items }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'menu') });
  }
});

// 5. Get Promotions
app.post('/api/esb/promotion', async (req, res) => {
  try {
    const { branchCode, visitPurposeID } = req.body;
    if (!branchCode || !visitPurposeID) {
      return res.status(400).json({ success: false, error: 'branchCode and visitPurposeID required' });
    }
    const payload: any = { visitPurposeID };
    const result = await esbFetch('/qsv1/promotion', branchCode, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    res.json({ success: true, code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'promotion') });
  }
});

// 6. Calculate Total
//
// ESB rejects an inapplicable promotionCode with HTTP 400 (e.g. PROMOTION_NOT_FOUND)
// and fails the WHOLE calculation, which would leave the user unable to check out at
// all. So when a promo is present we retry once without it and tell the client the
// promo was dropped, rather than letting a bad code block the order.
app.post('/api/esb/calculate-total', async (req, res) => {
  try {
    const { branchCode, ...payload } = req.body;
    if (!branchCode) {
      return res.status(400).json({ success: false, error: 'branchCode is required' });
    }

    const callEsb = (body: Record<string, any>) =>
      esbFetch('/qsv1/order/calculate-total', branchCode, {
        method: 'POST',
        body: JSON.stringify(body),
      });

    if (!payload.promotionCode) {
      const result = await callEsb(payload);
      return res.json({ success: true, code: 200, data: result });
    }

    try {
      const result = await callEsb(payload);
      res.json({ success: true, code: 200, data: result });
    } catch (promoErr: any) {
      const msg = promoErr instanceof Error ? promoErr.message : String(promoErr);
      if (!msg.startsWith('ESB API Error: 400')) throw promoErr;

      console.warn(`[PROMO REJECTED] ${payload.promotionCode} @ ${branchCode}: ${msg.slice(0, 200)}`);
      const { promotionCode, ...withoutPromo } = payload;
      const result = await callEsb(withoutPromo);
      res.json({
        success: true,
        code: 200,
        data: result,
        promotionRejected: true,
        promotionCode,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'calculate total') });
  }
});

// 7. Encrypt QR Data (Pay at Cashier)
// Same promo-degradation rule as calculate-total: a rejected promotionCode must not
// cost the user their ability to pay at the cashier.
app.post('/api/esb/order/qr-data', orderLimiter, async (req, res) => {
  try {
    const { branchCode, ...payload } = req.body;
    if (!branchCode) {
      return res.status(400).json({ success: false, error: 'branchCode is required' });
    }

    const invalid = validateOrderPayload(payload);
    if (invalid) {
      return res.status(400).json({ success: false, error: invalid });
    }

    let promotionRejected = false;
    let result;
    try {
      result = await esbFetch('/qsv1/order/qrData', branchCode, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (promoErr: any) {
      const msg = promoErr instanceof Error ? promoErr.message : String(promoErr);
      if (!payload.promotionCode || !msg.startsWith('ESB API Error: 400')) throw promoErr;

      console.warn(`[PROMO REJECTED @ qrData] ${payload.promotionCode} @ ${branchCode}: ${msg.slice(0, 200)}`);
      const { promotionCode, ...withoutPromo } = payload;
      result = await esbFetch('/qsv1/order/qrData', branchCode, {
        method: 'POST',
        body: JSON.stringify(withoutPromo),
      });
      promotionRejected = true;
    }

    res.json({
      promotionRejected,
      success: true,
      code: 201,
      message: 'QR data berhasil dibuat',
      data: {
        order_id: result.orderID,
        qr_data: result.qrData,
      }
    });
  } catch (err: any) {
    const upstream = esbClientError(err);
    if (upstream) {
      console.error(`[ESB ERROR] qr data: ${err.message}`);
      return res.status(upstream.status).json({ success: false, error: upstream.error });
    }
    res.status(500).json({ success: false, error: sanitizeError(err, 'qr data') });
  }
});

// 8. Create Order
app.post('/api/esb/order', orderLimiter, async (req, res) => {
  try {
    const {
      branchCode,
      orderType,
      fullName,
      email,
      phoneNumber,
      visitPurposeID,
      salesMenus,
      paymentMethodID,
      amount,
      tableName,
      deliveryAddress,
      deliveryAddressInfo,
      latitude,
      longitude,
      deliveryCourierID,
      returnUrl,
      customerNotes,
      scheduledAt,
      vouchers,
      promotionCode,
    } = req.body;

    if (!branchCode || !orderType || !fullName || !email || !phoneNumber || !visitPurposeID || !salesMenus || !paymentMethodID || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const invalid = validateOrderPayload(req.body);
    if (invalid) {
      return res.status(400).json({ success: false, error: invalid });
    }

    const orderPayload: Record<string, any> = {
      orderType,
      fullName,
      email,
      phoneNumber,
      visitPurposeID,
      salesMenus,
      paymentMethodID,
      amount,
    };

    // Optional fields based on order type
    if (orderType === 'dineIn' && tableName) {
      orderPayload.tableName = tableName;
    }
    if (orderType === 'delivery') {
      if (deliveryAddress) orderPayload.deliveryAddress = deliveryAddress;
      if (deliveryAddressInfo) orderPayload.deliveryAddressInfo = deliveryAddressInfo;
      if (latitude) orderPayload.latitude = latitude;
      if (longitude) orderPayload.longitude = longitude;
      if (deliveryCourierID) orderPayload.deliveryCourierID = deliveryCourierID;
    }
    if (returnUrl) orderPayload.returnUrl = returnUrl;
    if (customerNotes) orderPayload.customerNotes = customerNotes;
    if (scheduledAt) orderPayload.scheduledAt = scheduledAt;
    if (vouchers && vouchers.length > 0) orderPayload.vouchers = vouchers;
    if (promotionCode) orderPayload.promotionCode = promotionCode;
    orderPayload.userToken = '';

    const result = await esbFetch('/qsv1/order', branchCode, {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    res.json({
      success: true,
      code: 201,
      message: 'Pesanan berhasil dikirim ke engine ESB ESO-QS',
      data: {
        order_id: result.orderID,
        redirect_url: result.redirectUrl,
        qr_string: result.qrString,
        deep_link_url: result.deepLinkUrl,
        ...result,
      }
    });
  } catch (err: any) {
    const upstream = esbClientError(err);
    if (upstream) {
      console.error(`[ESB ERROR] create order: ${err.message}`);
      return res.status(upstream.status).json({ success: false, error: upstream.error });
    }
    res.status(500).json({ success: false, error: sanitizeError(err, 'create order') });
  }
});

// 9. Validate Payment
app.get('/api/esb/payment/validate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const branchCode = req.query.branchCode as string;

    if (!SAFE_ID.test(orderId)) {
      return res.status(400).json({ success: false, error: 'Invalid order id' });
    }

    const result = await esbFetch(`/qsv1/payment/validate/${orderId}`, branchCode);

    res.json({
      success: true,
      code: 200,
      data: {
        status: result.status || 'pending',
        paymentTotal: result.paymentTotal,
        qrString: result.qrString,
        vaNumber: result.vaNumber,
        timeRemaining: result.timeRemaining,
        errorMessage: result.errorMessage,
        flagPushToPOS: result.flagPushToPOS,
      }
    });
  } catch (err: any) {
    // The client polls this endpoint every few seconds, so it needs to tell a
    // permanently bad order id (4xx — asking again will never help) from a
    // transient upstream failure. Forward the upstream status for that; the
    // message stays sanitized, because ESB's 4xx bodies here are raw field
    // validation errors, not anything to show a customer.
    const status = err instanceof EsbError && err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({ success: false, error: sanitizeError(err, 'validate payment') });
  }
});

// 10. Get Order Status
app.get('/api/esb/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const branchCode = req.query.branchCode as string;

    if (!SAFE_ID.test(orderId)) {
      return res.status(400).json({ success: false, error: 'Invalid order id' });
    }

    const result = await esbFetch(`/qsv1/order/${orderId}`, branchCode);

    res.json({
      success: true,
      code: 200,
      data: {
        order_id: result.data?.orderID,
        order_number: result.data?.orderNumber,
        payment_status: result.data?.paymentStatus,
        kitchen_status: result.data?.orderStatus || 'PROCESSING',
        estimated_ready_time: result.data?.estimatedTime || '12 minutes',
        ...result.data,
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: sanitizeError(err, 'order status') });
  }
});

// 11. User Order History
//
// Two upstream calls, because ESB scopes order history to a *user* token while
// every other endpoint in this app runs on the merchant's static token:
//   POST /v1/user/auth  (merchant token) -> user token
//   POST /v1/user/order (user token)     -> that user's orders
//
// The user token stays on the server. Handing it to the browser would put a
// credential that reads someone's order history into localStorage, and the
// client has no use for it directly.
//
// Worth knowing: /v1/user/auth mints a token from name + email alone, with no
// verification step. So this is identification, not authentication — anyone who
// knows a customer's email can read that customer's history. That is ESB's
// design, not something this proxy can tighten; closing it needs a real login.
const USER_TOKEN_TTL_MS = 10 * 60 * 1000;

async function getUserToken(
  identity: { fullName: string; email: string; phoneNumber: string },
  branchCode: string,
  forceRefresh = false
): Promise<string> {
  const cacheKey = `usertoken:${identity.email.toLowerCase()}:${identity.fullName}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }

  const result = await esbFetch('/v1/user/auth', branchCode, {
    method: 'POST',
    body: JSON.stringify({
      fullName: identity.fullName,
      email: identity.email,
      phoneNumber: identity.phoneNumber,
      appID: 'esoqs',
    }),
  });

  const token = result?.token;
  if (!token) throw new Error('ESB user auth returned no token');
  cacheSet(cacheKey, token, USER_TOKEN_TTL_MS);
  return token;
}

app.post('/api/esb/user/orders', async (req, res) => {
  try {
    const { fullName, email, phoneNumber, branchCode } = req.body || {};
    const page = Math.max(1, parseInt(String(req.body?.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.body?.limit ?? '20'), 10) || 20));

    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > MAX_FIELD_LEN) {
      return res.status(400).json({ success: false, error: 'Nama wajib diisi.' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_FIELD_LEN) {
      return res.status(400).json({ success: false, error: 'Email tidak valid.' });
    }
    if (typeof branchCode !== 'string' || !SAFE_ID.test(branchCode)) {
      return res.status(400).json({ success: false, error: 'Invalid branch code' });
    }

    const identity = {
      fullName: fullName.trim(),
      email: email.trim(),
      phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.slice(0, MAX_FIELD_LEN) : '',
    };

    const fetchHistory = (token: string) =>
      esbFetch(`/v1/user/order?page=${page}&limit=${limit}`, branchCode, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

    let result: any;
    try {
      result = await fetchHistory(await getUserToken(identity, branchCode));
    } catch (err) {
      // A cached token can outlive its validity upstream. Allow exactly one
      // forced refresh — retrying past that would just spin.
      if (err instanceof EsbError && (err.status === 401 || err.status === 403)) {
        result = await fetchHistory(await getUserToken(identity, branchCode, true));
      } else {
        throw err;
      }
    }

    const orders = (result?.data || []).map((o: any) => ({
      order_id: o.orderID,
      branch_code: o.branchCode,
      branch_name: o.branchName,
      transaction_date: o.transactionDate,
      order_type: o.orderType,
      order_type_name: o.orderTypeName,
      grand_total: o.grandTotal ?? 0,
      total_item: o.totalItem ?? 0,
      // Both are kept: `status` is where the order is in the kitchen, while
      // `payment_status` is what the history tabs group by.
      status: o.status,
      payment_status: o.paymentStatus,
      status_id: o.statusID,
      queue_num: o.queueNum,
      currency_sign: o.currencySign || 'Rp',
      image_url: o.thumbnailImageUrl,
      refund_status: o.refundStatus,
      is_allow_reorder: o.isAllowReOrder ?? false,
    }));

    res.json({
      success: true,
      code: 200,
      data: {
        orders,
        pagination: {
          total_count: result?._pagination?.totalCount ?? orders.length,
          page_count: result?._pagination?.pageCount ?? 1,
          current_page: result?._pagination?.currentPage ?? page,
          per_page: result?._pagination?.perPage ?? limit,
        },
      },
    });
  } catch (err: any) {
    const upstream = esbClientError(err);
    if (upstream) {
      console.error(`[ESB ERROR] user order history: ${err.message}`);
      return res.status(upstream.status).json({ success: false, error: upstream.error });
    }
    res.status(500).json({ success: false, error: sanitizeError(err, 'riwayat pesanan') });
  }
});

// Unmatched API routes should stay JSON rather than fall through to index.html.
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan' });
});

/**
 * Evict expired cache entries and rate-limit buckets.
 *
 * Only a long-lived process needs this — without it both maps grow one entry
 * per unique key forever. A serverless instance is short-lived enough that it
 * never accumulates enough to matter, so this is called from server.ts (the dev
 * / self-hosted entry point) and nowhere else.
 */
export function sweepExpired() {
  const now = Date.now();
  for (const bucket of rateBuckets) {
    for (const [ip, entry] of bucket) {
      if (now > entry.resetAt) bucket.delete(ip);
    }
  }
  for (const [key, entry] of cache) {
    if (now > entry.expiry) cache.delete(key);
  }
}

// Static assets and the SPA fallback are the CDN's job in production, and the
// Vite middleware's job in development (see server.ts). Nothing to do here.
export default app;
