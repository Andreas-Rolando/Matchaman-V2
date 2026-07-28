import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config(); // loads .env
dotenv.config({ path: '.env.local', override: true }); // overrides with .env.local

const app = express();
const PORT = 3000;

app.use(express.json());

// ----------------------------------------------------
// ESB ESO-QS API CONFIGURATION
// ----------------------------------------------------
const ESB_API_BASE = process.env.ESB_API_BASE_URL || 'https://eso-api.esb.co.id';
const ESB_API_TOKEN = process.env.ESB_API_TOKEN || '';
const ESB_COMPANY_CODE = process.env.ESB_COMPANY_CODE || '';

// Helper: make authenticated request to ESB API
async function esbFetch(endpoint: string, branchCode: string, options: RequestInit = {}) {
  const url = `${ESB_API_BASE}${endpoint}`;
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

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ESB API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ----------------------------------------------------
// ESB ESO-QS API PROXY ENDPOINTS
// ----------------------------------------------------

// 1. Config check
app.get('/api/esb/config', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'ESB ESO-QS (Ordering System - Quick Service)',
    mode: 'LIVE_API',
    docsUrl: 'https://developers.esb.co.id/eso-qs/',
    merchantId: ESB_COMPANY_CODE,
    apiVersion: 'v1.0.0',
    apiBase: ESB_API_BASE,
  });
});

// 2. Get Branch List (by user location)
app.get('/api/esb/outlets', async (req, res) => {
  try {
    const lat = req.query.lat as string || '-6.2088';
    const long = req.query.long as string || '106.8456';
    // Branch list endpoint doesn't need Data-Branch header
    const url = `${ESB_API_BASE}/qsv1/branch/${lat}/${long}`;
    const response = await fetch(url, {
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

    res.json({ success: true, code: 200, data: mappedData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Branch Detail
app.get('/api/esb/outlets/:outletId', async (req, res) => {
  try {
    const branchCode = req.params.outletId;
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Menu
app.get('/api/esb/menu', async (req, res) => {
  try {
    const branchCode = req.query.branchCode as string;
    if (!branchCode) {
      return res.status(400).json({ success: false, error: 'branchCode is required' });
    }

    // Step 1: Get branch settings to extract visitPurposeID from orderModes
    // API returns data at the top level (no data wrapper)
    const branchResult = await esbFetch('/qsv1/setting/branch', branchCode);
    const branchData = branchResult;

    // Extract visitPurposeID from the first available orderMode
    const orderModes = branchData.orderModes || [];
    let visitPurposeID: string | null = null;
    let menuResult: any = null;

    // Try each orderMode's visitPurposeID until one works
    for (const mode of orderModes) {
      if (!mode.visitPurposeID) continue;
      try {
        menuResult = await esbFetch(`/qsv1/menu/${mode.visitPurposeID}`, branchCode);
        visitPurposeID = mode.visitPurposeID;
        break;
      } catch (menuErr: any) {
        console.log(`visitPurposeID "${mode.visitPurposeID}" failed for branch ${branchCode}, trying next...`);
        continue;
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

    for (const cat of menuCategories) {
      for (const detail of (cat.menuCategoryDetails || [])) {
        const catId = detail.menuCategoryDetailID || detail.menuCategoryDetailCode;
        const catName = detail.menuCategoryDetailDesc || detail.description || 'Other';

        // Deduplicate categories by ID
        if (!categories.find((c: any) => c.category_id === catId)) {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Calculate Total
app.post('/api/esb/calculate-total', async (req, res) => {
  try {
    const { branchCode, ...payload } = req.body;
    if (!branchCode) {
      return res.status(400).json({ success: false, error: 'branchCode is required' });
    }
    const result = await esbFetch('/qsv1/order/calculate-total', branchCode, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    res.json({ success: true, code: 200, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Create Order
app.post('/api/esb/order', async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Validate Payment
app.get('/api/esb/payment/validate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const branchCode = req.query.branchCode as string;

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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get Order Status
app.get('/api/esb/order/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const branchCode = req.query.branchCode as string;

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
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// SPA FALLBACK (before Vite middleware)
// Serve index.html for all non-API requests (GET or POST from payment redirects)
// ----------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Redirect POST to GET for non-API paths (ESB payment redirects use POST)
    app.post('*', (req, res, next) => {
      if (!req.path.startsWith('/api/')) {
        const params = new URLSearchParams(req.query as any).toString();
        res.redirect(303, req.path + (params ? '?' + params : ''));
        return;
      }
      next();
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Matchaman ESB ESO-QS running on http://localhost:${PORT}`);
    console.log(`API Mode: LIVE_API`);
    console.log(`ESB API Base: ${ESB_API_BASE}`);
  });
}

startServer();
