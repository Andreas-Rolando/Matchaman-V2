import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { INITIAL_BRANCHES, MENU_ITEMS, CATEGORIES } from './src/data/mockData.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Memory store for created orders in ESB ESO-QS format
const orderDatabase = new Map<string, any>();

// ----------------------------------------------------
// ESB ESO-QS API PROXY & SIMULATION LAYER
// ----------------------------------------------------

// 1. Health & Config check
app.get('/api/esb/config', (req, res) => {
  const isLive = Boolean(process.env.ESB_CLIENT_ID && process.env.ESB_CLIENT_SECRET);
  res.json({
    status: 'ok',
    engine: 'ESB ESO-QS (Ordering System - Quick Service)',
    mode: isLive ? 'LIVE_API' : 'SANDBOX_MOCK',
    docsUrl: 'https://developers.esb.co.id/eso-qs/',
    merchantId: process.env.ESB_MERCHANT_ID || 'MATCHAMAN_ZEN_01',
    apiVersion: 'v1.2'
  });
});

// 2. Outlets Endpoint
app.get('/api/esb/outlets', async (req, res) => {
  try {
    // If live credentials present, could attempt fetch to process.env.ESB_API_BASE_URL
    res.json({
      success: true,
      code: 200,
      message: 'Outlets retrieved successfully',
      data: INITIAL_BRANCHES.map(b => ({
        outlet_id: b.id,
        outlet_name: b.name,
        address: b.address,
        is_open: b.isOpen,
        prep_time_minutes: b.prepTime,
        operating_hours: b.hours,
        distance_km: b.distanceKm,
        image_url: b.imageUrl,
        lat: b.lat || -6.2088,
        lng: b.lng || 106.8456
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Outlet Detail Endpoint
app.get('/api/esb/outlets/:outletId', async (req, res) => {
  const { outletId } = req.params;
  const branch = INITIAL_BRANCHES.find(b => b.id === outletId) || INITIAL_BRANCHES[0];
  res.json({
    success: true,
    code: 200,
    data: {
      outlet_id: branch.id,
      outlet_name: branch.name,
      address: branch.address,
      is_open: branch.isOpen,
      prep_time_minutes: branch.prepTime,
      operating_hours: branch.hours,
      distance_km: branch.distanceKm,
      image_url: branch.imageUrl,
      available_sales_modes: ['dine_in', 'takeaway'],
      lat: branch.lat || -6.2088,
      lng: branch.lng || 106.8456
    }
  });
});

// 4. Menu & Category Endpoint
app.get('/api/esb/menu', async (req, res) => {
  const { outlet_id } = req.query;
  res.json({
    success: true,
    code: 200,
    data: {
      outlet_id: outlet_id || 'br-downtown',
      categories: CATEGORIES.map(c => ({
        category_id: c.id,
        category_name: c.name
      })),
      items: MENU_ITEMS.map(item => ({
        item_id: item.id,
        item_name: item.name,
        category_id: item.categoryId,
        category_name: item.categoryName,
        price: item.price,
        description: item.description,
        image_url: item.imageUrl,
        is_popular: item.isPopular,
        is_available: item.isAvailable,
        modifier_groups: item.modifierGroups?.map(mg => ({
          group_id: mg.id,
          group_name: mg.name,
          is_required: mg.required,
          options: mg.options.map(o => ({
            option_id: o.id,
            option_name: o.name,
            price: o.price
          }))
        })) || []
      }))
    }
  });
});

// 5. Create Order Endpoint (ESB ESO-QS specification payload)
app.post('/api/esb/order', async (req, res) => {
  try {
    const {
      outlet_id,
      sales_mode, // 'dine_in' | 'takeaway'
      table_number,
      customer_name,
      customer_email,
      customer_phone,
      payment_method,
      items,
      voucher_code,
      subtotal,
      delivery_fee,
      discount,
      tax,
      total
    } = req.body;

    const orderNumSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `#QB-${orderNumSuffix}`;
    const orderId = `esb_ord_${Date.now()}_${orderNumSuffix}`;

    const newOrder = {
      order_id: orderId,
      order_number: orderNumber,
      esb_reference_no: `ESB-QS-${Date.now()}`,
      outlet_id: outlet_id || 'br-downtown',
      sales_mode: sales_mode || 'dine_in',
      table_number: table_number || '-',
      customer: {
        name: customer_name || 'Guest User',
        email: customer_email || 'guest@matchaman.com',
        phone: customer_phone || '08123456789'
      },
      payment: {
        method: payment_method || 'ewallet',
        status: 'Berhasil', // Instant approval in Quick Service
        qris_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ESB_MATCHAMAN_PAYMENT'
      },
      breakdown: {
        subtotal: subtotal || 0,
        delivery_fee: delivery_fee || 0,
        service_fee: 2000,
        discount: discount || 0,
        tax: tax || 0,
        total: total || 0,
        voucher_code: voucher_code || null
      },
      items: items || [],
      created_at: new Date().toISOString()
    };

    orderDatabase.set(orderId, newOrder);

    res.json({
      success: true,
      code: 201,
      message: 'Pesanan berhasil dikirim ke engine ESB ESO-QS',
      data: newOrder
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Order Status Endpoint
app.get('/api/esb/order/:orderId/status', (req, res) => {
  const { orderId } = req.params;
  const order = orderDatabase.get(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
  }
  res.json({
    success: true,
    code: 200,
    data: {
      order_id: order.order_id,
      order_number: order.order_number,
      payment_status: order.payment.status,
      kitchen_status: 'PROCESSING', // IN_QUEUE, PROCESSING, READY, DELIVERED
      estimated_ready_time: '12 minutes'
    }
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Matchaman ESB ESO-QS running on http://localhost:${PORT}`);
  });
}

startServer();
