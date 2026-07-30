import React, { useState, useEffect } from 'react';
import { User, CreditCard, Wallet, Banknote, Smartphone, ArrowRight, Loader2, ShieldCheck, QrCode, AlertCircle, Tag } from 'lucide-react';
import { Branch, BranchPaymentInfo, SalesMode, CartItem, VoucherDeal, CustomerInfo, Order, OrderMode, CalculatedTotal } from '../types';

interface CheckoutScreenProps {
  branch: Branch;
  salesMode: SalesMode;
  cartItems: CartItem[];
  appliedVoucher: VoucherDeal | null;
  paymentInfo: BranchPaymentInfo | null;
  orderModes: OrderMode[];
  onOrderPlaced: (order: Order) => void;
}

function buildSalesMenus(cartItems: CartItem[]): any[] {
  return cartItems.map((ci) => {
    const salesMenu: any = {
      ID: Date.now() + Math.floor(Math.random() * 1000),
      menuID: parseInt(ci.menuItem.id, 10),
      qty: ci.quantity,
      extras: [],
      packages: [],
      notes: ci.specialNotes || '',
    };

    for (const mod of ci.selectedModifiers) {
      const isExtra = mod.groupId.startsWith('ext_');
      const isPackage = mod.groupId.startsWith('pkg_');

      if (isExtra) {
        salesMenu.extras.push({
          menuExtraID: parseInt(String(mod.optionId), 10),
          qty: 1,
        });
      } else if (isPackage) {
        const parts = mod.groupId.split('_');
        const menuGroupID = parseInt(parts[parts.length - 1], 10);
        salesMenu.packages.push({
          menuID: parseInt(String(mod.optionId), 10),
          qty: 1,
          menuGroupID,
        });
      }
    }

    return salesMenu;
  });
}

function mapSalesModeToOrderType(salesMode: SalesMode): string {
  switch (salesMode) {
    case 'dine_in': return 'dineIn';
    case 'takeaway': return 'takeAway';
    case 'delivery': return 'delivery';
    default: return salesMode;
  }
}

const getPaymentIcon = (id: string) => {
  const lower = id.toLowerCase();
  if (lower.includes('qris') || lower.includes('qr')) return QrCode;
  if (lower.includes('ovo') || lower.includes('gopay') || lower.includes('dana') || lower.includes('shopee') || lower.includes('linkaja')) return Smartphone;
  if (lower.includes('va') || lower.includes('transfer') || lower.includes('bca') || lower.includes('bni') || lower.includes('bri') || lower.includes('mandiri')) return CreditCard;
  return Wallet;
};

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  branch,
  salesMode,
  cartItems,
  appliedVoucher,
  paymentInfo,
  orderModes,
  onOrderPlaced,
}) => {
  const [customer, setCustomer] = useState<CustomerInfo>({
    fullName: '',
    email: '',
    phone: '',
    tableNumber: '',
    address: '',
  });

  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [calculatedTotal, setCalculatedTotal] = useState<CalculatedTotal | null>(null);
  const [isCalculating, setIsCalculating] = useState(true);
  const [calculateError, setCalculateError] = useState('');
  const [cachedSalesMenus, setCachedSalesMenus] = useState<any[]>([]);
  const [promoRejected, setPromoRejected] = useState(false);

  // ESB requires phoneNumber whenever promotionCode is sent, so with a promo
  // applied the phone is genuinely part of the calculate-total input rather
  // than incidental. Debounced so typing doesn't fire a request per keystroke,
  // and only fed into the effect's deps when a promo is actually applied —
  // without one the request is phone-independent and must not re-run.
  const [debouncedPhone, setDebouncedPhone] = useState(customer.phone);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPhone(customer.phone), 600);
    return () => clearTimeout(timer);
  }, [customer.phone]);

  const promoCode = appliedVoucher?.code || '';
  const promoPhone = promoCode ? debouncedPhone.trim() : '';
  // Without a phone number the promo cannot be evaluated at all. Say that,
  // instead of sending a request we already know ESB will reject and then
  // telling the customer their perfectly valid promo was refused.
  const promoNeedsPhone = Boolean(promoCode) && promoPhone === '';

  // Send the promo with the order only when the total on screen was actually
  // computed with it. `promoNeedsPhone` matters here too: the phone field is
  // required, so it will be filled by submit time, but if the 600ms debounce
  // hasn't flushed yet the displayed total is still the undiscounted one.
  const promoUsable = Boolean(promoCode) && !promoRejected && !promoNeedsPhone;

  const orderType = mapSalesModeToOrderType(salesMode);
  const isDelivery = salesMode === 'delivery';
  const isDineIn = salesMode === 'dine_in';

  const visitPurposeID = orderModes.find((m) => m.type === orderType)?.visitPurposeID
    || orderModes[0]?.visitPurposeID
    || '';

  useEffect(() => {
    if (cartItems.length === 0) return;

    async function calculateTotal() {
      setIsCalculating(true);
      setCalculateError('');
      setPromoRejected(false);
      try {
        const salesMenus = buildSalesMenus(cartItems);
        setCachedSalesMenus(salesMenus);
        const payload: Record<string, any> = {
          branchCode: branch.id,
          visitPurposeID,
          orderType,
          salesMenus,
          userToken: '',
        };

        if (isDelivery) {
          payload.latitude = branch.lat || -6.2088;
          payload.longitude = branch.lng || 106.8456;
        }

        if (promoCode && promoPhone) {
          payload.promotionCode = promoCode;
          payload.phoneNumber = promoPhone;
        }

        const res = await fetch('/api/esb/calculate-total', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setCalculatedTotal(data.data);
          setPromoRejected(Boolean(data.promotionRejected));
        } else {
          setCalculateError(data.error || 'Gagal menghitung total');
        }
      } catch (err: any) {
        setCalculateError('Gagal menghubungi server: ' + err.message);
      } finally {
        setIsCalculating(false);
      }
    }

    calculateTotal();
  }, [cartItems, branch.id, visitPurposeID, orderType, isDelivery, appliedVoucher, promoCode, promoPhone]);

  const subtotal = calculatedTotal?.subtotal ?? cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = calculatedTotal?.deliveryCost ?? 0;
  const tax = (calculatedTotal?.pb1 ?? 0) + (calculatedTotal?.additionalTax ?? 0);
  const serviceFee = calculatedTotal?.orderFee ?? 0;
  const grandTotal = calculatedTotal?.grandTotal ?? (subtotal + deliveryFee + tax + serviceFee);
  const roundingTotal = calculatedTotal?.roundingTotal ?? 0;
  const discountTotal = calculatedTotal?.discountTotal ?? 0;
  const voucherDiscount = calculatedTotal?.voucherDiscountTotal ?? 0;
  // ESB reports promotionCode savings separately from gift-voucher savings.
  const promotionDiscount = calculatedTotal?.promotionDiscount ?? 0;
  const appliedPromoCode = calculatedTotal?.promotionCode || null;

  const buildPaymentMethods = () => {
    const methods: { id: string; label: string; icon: any; description?: string }[] = [];

    if (paymentInfo) {
      if (paymentInfo.atCashier) {
        methods.push({
          id: 'cashier',
          label: 'Bayar di Kasir',
          icon: Banknote,
          description: 'Pay at the cashier counter',
        });
      }

      if (paymentInfo.online && paymentInfo.online.length > 0) {
        for (const p of paymentInfo.online) {
          methods.push({
            id: p.id,
            label: p.name,
            icon: getPaymentIcon(p.id),
            description: p.description,
          });
        }
      }
    }

    // No invented fallback here on purpose. This used to push hardcoded
    // 'cashier' / 'ewallet' / 'qris' entries whenever a branch reported none —
    // but 'ewallet' and 'qris' are not ESB payment method IDs at all (the real
    // ones look like qrisesb, danaesb, gopay, ovo), so the customer was offered
    // methods that could only ever come back as "payment method not supported".
    // A branch with nothing configured has nothing to offer; say so instead.
    return methods;
  };

  const paymentMethods = buildPaymentMethods();

  useEffect(() => {
    if (!selectedPaymentId && paymentMethods.length > 0) {
      setSelectedPaymentId(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPaymentId]);

  // Re-price without the promo. Needed when ESB creates the order but refuses
  // the promotion: the order already exists, so the receipt has to show what
  // the cashier will actually charge, not the discounted figure calculate-total
  // returned earlier. Returns null on any failure — the caller falls back to
  // the figures already on screen rather than blocking on this.
  const fetchTotalsWithoutPromo = async (salesMenus: any[]): Promise<CalculatedTotal | null> => {
    try {
      const payload: Record<string, any> = {
        branchCode: branch.id,
        visitPurposeID,
        orderType,
        salesMenus,
        userToken: '',
      };
      if (isDelivery) {
        payload.latitude = branch.lat || -6.2088;
        payload.longitude = branch.lng || 106.8456;
      }
      const res = await fetch('/api/esb/calculate-total', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.success && data.data ? (data.data as CalculatedTotal) : null;
    } catch {
      return null;
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.fullName || !customer.email || !customer.phone) {
      setErrorMessage('Mohon lengkapi Nama, Email, dan Nomor Telepon.');
      return;
    }

    if (!calculatedTotal) {
      setErrorMessage('Perhitungan total belum selesai. Silakan tunggu.');
      return;
    }

    // Guards the case the disabled button cannot: a form submitted via Enter.
    if (!selectedPaymentId) {
      setErrorMessage(
        paymentMethods.length === 0
          ? 'Cabang ini belum mengaktifkan metode pembayaran. Silakan pilih cabang lain.'
          : 'Pilih metode pembayaran terlebih dahulu.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const salesMenus = cachedSalesMenus.length > 0 ? cachedSalesMenus : buildSalesMenus(cartItems);
      const amount = Math.max(0, grandTotal - roundingTotal);

      const orderPayload: Record<string, any> = {
        branchCode: branch.id,
        orderType,
        fullName: customer.fullName,
        email: customer.email,
        phoneNumber: customer.phone,
        visitPurposeID,
        salesMenus,
        paymentMethodID: selectedPaymentId === 'cashier' ? 'qrisesb' : selectedPaymentId,
        amount,
      };

      if (isDineIn && customer.tableNumber) {
        orderPayload.tableName = customer.tableNumber;
      }

      if (isDelivery) {
        orderPayload.deliveryAddress = customer.address || branch.address;
        orderPayload.deliveryAddressInfo = 'Delivered to customer address';
        orderPayload.latitude = branch.lat || -6.2088;
        orderPayload.longitude = branch.lng || 106.8456;
        orderPayload.deliveryCourierID = 1;
      }

      if (selectedPaymentId !== 'cashier') {
        // ESB sends the customer back with a POST, which a static CDN can't
        // answer — so point it at the API function, which 303-redirects to "/".
        orderPayload.returnUrl = `${window.location.origin}/api/payment/return`;
      }

      // Only forward a promo ESB actually accepted during calculate-total —
      // otherwise the order would 400 on a code we already know it rejects.
      if (promoUsable) {
        orderPayload.promotionCode = promoCode;
      }

      if (selectedPaymentId === 'cashier') {
        // Cashier path: use Encrypt QR Data API instead of Save Order
        const fullName = customer.tableNumber && isDineIn
          ? `${customer.fullName} - ${customer.tableNumber}`
          : customer.fullName;
        const qrPayload: Record<string, any> = {
          branchCode: branch.id,
          orderType,
          fullName,
          email: customer.email,
          phoneNumber: customer.phone,
          visitPurposeID,
          salesMenus,
        };

        if (promoUsable) {
          qrPayload.promotionCode = promoCode;
        }

        const response = await fetch('/api/esb/order/qr-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qrPayload),
        });

        const resData = await response.json();

        // A rejection here means the QR the cashier scans carries no promo while
        // the total on screen does. The order itself already exists — the server
        // retried without the promo and ESB returned a real orderID — so
        // discarding it would strand an unclaimed order on the branch POS and
        // create a duplicate as soon as the customer resubmits. Keep the order
        // and re-price it instead, so the receipt matches the QR.
        let totals = { subtotal, deliveryFee, tax, total: grandTotal, roundingTotal };
        if (resData.success && resData.promotionRejected) {
          setPromoRejected(true);
          const repriced = await fetchTotalsWithoutPromo(salesMenus);
          if (repriced) {
            setCalculatedTotal(repriced);
            totals = {
              subtotal: repriced.subtotal ?? subtotal,
              deliveryFee: repriced.deliveryCost ?? 0,
              tax: (repriced.pb1 ?? 0) + (repriced.additionalTax ?? 0),
              total: repriced.grandTotal ?? grandTotal,
              roundingTotal: repriced.roundingTotal ?? 0,
            };
          }
        }

        if (resData.success) {
          const createdOrder: Order = {
            id: resData.data.order_id,
            orderNumber: resData.data.order_id,
            branch,
            salesMode,
            items: cartItems,
            subtotal: totals.subtotal,
            deliveryFee: totals.deliveryFee,
            tax: totals.tax,
            total: totals.total,
            roundingTotal: totals.roundingTotal,
            customerInfo: customer,
            paymentMethod: 'cashier',
            paymentStatus: 'Pending',
            createdAt: new Date().toLocaleString('id-ID', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            qrString: resData.data.qr_data || '',
            branchCode: branch.id,
            paymentMethodCode: 'cashier',
          };

          onOrderPlaced(createdOrder);
        } else {
          setErrorMessage(resData.error || resData.message || 'Gagal membuat QR untuk kasir.');
        }
        return;
      }

      const response = await fetch('/api/esb/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const resData = await response.json();

      if (resData.success) {
        const createdOrder: Order = {
          id: resData.data.orderID || resData.data.order_id,
          orderNumber: resData.data.orderID || resData.data.order_id,
          branch,
          salesMode,
          items: cartItems,
          subtotal,
          deliveryFee,
          tax,
          total: grandTotal,
          roundingTotal,
          customerInfo: customer,
          paymentMethod: selectedPaymentId,
          paymentStatus: 'Pending',
          createdAt: new Date().toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          esbResponseRef: resData.data.redirect_url || resData.data.qr_string || '',
          qrString: resData.data.qr_string || '',
          branchCode: branch.id,
          paymentMethodCode: selectedPaymentId,
        };

        const redirectUrl = resData.data.redirect_url || resData.data.deep_link_url;

        if (redirectUrl && selectedPaymentId !== 'cashier' && selectedPaymentId !== 'qrisesb') {
          sessionStorage.setItem('pendingOrder', JSON.stringify(createdOrder));
          window.location.href = redirectUrl;
          return;
        }

        onOrderPlaced(createdOrder);
      } else {
        setErrorMessage(resData.error || resData.message || 'Gagal mengirim order ke ESB engine.');
      }
    } catch (err: any) {
      setErrorMessage('Koneksi terputus: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4">
      {/* Header Banner */}
      <section className="relative mb-6 flex h-40 flex-col justify-end overflow-hidden rounded-xl p-4 text-white shadow-md">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=800')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10">
          <h2 className="font-serif text-2xl font-bold">Confirm Order</h2>
          <p className="text-xs text-white/90">
            {isDelivery ? 'Delivery Order' : isDineIn ? 'Dine-in Order' : 'Take Away Order'} - {branch.name}
          </p>
        </div>
      </section>

      {errorMessage && (
        <div className="mb-4 rounded-xl bg-[#ffdad6] p-3 text-xs font-semibold text-[#93000a]">
          {errorMessage}
        </div>
      )}

      {calculateError && (
        <div className="mb-4 rounded-xl bg-[#fff3e0] p-3 text-xs font-semibold text-[#e65100] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{calculateError}</span>
        </div>
      )}

      {promoNeedsPhone && appliedVoucher && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-[#fff3e0] p-3 text-xs text-[#e65100]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Isi nomor HP untuk memakai promo <strong>{appliedVoucher.code}</strong>. Promo
            diverifikasi lewat nomor telepon, jadi total di bawah belum termasuk diskon.
          </span>
        </div>
      )}

      {!promoNeedsPhone && promoRejected && appliedVoucher && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-[#fff3e0] p-3 text-xs text-[#e65100]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Promo <strong>{appliedVoucher.code}</strong> tidak dapat digunakan untuk pesanan ini
            dan tidak diterapkan. Total di bawah adalah harga tanpa promo.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="space-y-5">
        {/* Customer Information Card */}
        <section className="rounded-xl border border-[#eae7e7] bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-[#34562e]" />
            <h3 className="font-serif text-lg font-semibold text-[#1b1c1c]">
              Personal Information
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[#5d5f5b]">
                Full Name
              </label>
              <input
                type="text"
                required
                value={customer.fullName}
                onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                placeholder="Enter your name"
                className="mt-1 h-11 w-full rounded-lg border border-[#c2c8bc] bg-white px-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5f5b]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1 h-11 w-full rounded-lg border border-[#c2c8bc] bg-white px-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5f5b]">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="0812 3456 789"
                className="mt-1 h-11 w-full rounded-lg border border-[#c2c8bc] bg-white px-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5f5b]">
                {isDineIn ? 'Table Number' : isDelivery ? 'Delivery Address' : 'Notes'}
              </label>
              <div className="relative mt-1">
                <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5d5f5b]" />
                <input
                  type="text"
                  // Delivery only: a blank address silently falls back to the
                  // branch's own address below, which sends the courier back to
                  // the cafe. Table number and notes stay optional.
                  required={isDelivery}
                  value={isDineIn ? customer.tableNumber : customer.address}
                  onChange={(e) =>
                    isDineIn
                      ? setCustomer({ ...customer, tableNumber: e.target.value })
                      : setCustomer({ ...customer, address: e.target.value })
                  }
                  placeholder={isDineIn ? 'e.g. 12' : isDelivery ? 'Enter delivery address' : 'Pickup at counter'}
                  className="h-11 w-full rounded-lg border border-[#c2c8bc] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Payment Method Selection */}
        <section className="rounded-xl border border-[#eae7e7] bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#34562e]" />
            <h3 className="font-serif text-lg font-semibold text-[#1b1c1c]">
              Payment Method
            </h3>
          </div>

          {paymentMethods.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-[#fff3e0] p-3 text-xs text-[#e65100]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cabang ini belum mengaktifkan metode pembayaran apa pun, jadi pesanan tidak bisa
                diselesaikan di sini. Pilih cabang lain untuk melanjutkan.
              </span>
            </div>
          )}

          <div className={`grid gap-3 ${paymentMethods.length <= 3 ? 'grid-cols-3' : paymentMethods.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedPaymentId === method.id;
              return (
                <label
                  key={method.id}
                  onClick={() => setSelectedPaymentId(method.id)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all ${
                    isSelected
                      ? 'border-[#34562e] bg-[#f0f4ef]'
                      : 'border-[#c2c8bc]/60 bg-white hover:bg-[#f6f3f2]'
                  }`}
                >
                  <Icon
                    className={`mb-1 h-6 w-6 ${
                      isSelected ? 'text-[#34562e]' : 'text-[#5d5f5b]'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-[#1b1c1c] leading-tight">
                    {method.label}
                  </span>
                  {method.description && (
                    <span className="mt-0.5 text-[9px] text-[#5d5f5b] leading-tight line-clamp-1">
                      {method.description}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </section>

        {/* Order Breakdown from Calculate Total API */}
        <section className="space-y-1.5 rounded-xl bg-[#f6f3f2] p-4 text-xs text-[#5d5f5b]">
          {isCalculating && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#34562e]" />
              <span className="text-[#34562e] font-medium">Menghitung total dari ESB...</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Subtotal ({cartItems.length} items)</span>
            <span>Rp{subtotal.toLocaleString('id-ID')}</span>
          </div>

          {isDelivery && deliveryFee > 0 && (
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span>Rp{deliveryFee.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Tax (PB1 + Additional)</span>
            <span>Rp{tax.toLocaleString('id-ID')}</span>
          </div>

          {serviceFee > 0 && (
            <div className="flex justify-between">
              <span>Service Fee</span>
              <span>Rp{serviceFee.toLocaleString('id-ID')}</span>
            </div>
          )}

          {promotionDiscount > 0 && (
            <div className="flex justify-between font-semibold text-[#245a0f]">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                Promo{appliedPromoCode ? ` (${appliedPromoCode})` : ''}
              </span>
              <span>-Rp{promotionDiscount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {discountTotal > 0 && (
            <div className="flex justify-between font-semibold text-[#245a0f]">
              <span>Discount</span>
              <span>-Rp{discountTotal.toLocaleString('id-ID')}</span>
            </div>
          )}

          {voucherDiscount > 0 && (
            <div className="flex justify-between font-semibold text-[#245a0f]">
              <span>Voucher Discount</span>
              <span>-Rp{voucherDiscount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {roundingTotal > 0 && (
            <div className="flex justify-between">
              <span>Pembulatan</span>
              <span>Rp{roundingTotal.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="mt-2 flex justify-between border-t border-[#c2c8bc] pt-2 font-serif text-lg font-bold text-[#1b1c1c]">
            <span>Total Amount</span>
            <span className="text-[#34562e]">Rp{grandTotal.toLocaleString('id-ID')}</span>
          </div>

          {!isCalculating && !calculateError && calculatedTotal && (
            <p className="text-[10px] text-[#34562e] font-medium pt-1">
              Perhitungan dari ESB ESO-QS Engine
            </p>
          )}
        </section>

        {/* Action button */}
        <button
          type="submit"
          disabled={isSubmitting || isCalculating || !!calculateError || paymentMethods.length === 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#34562e] font-serif text-lg font-semibold text-white shadow-lg transition-all active:scale-[0.98] hover:bg-[#012202] disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Memproses Order ke ESB Engine...</span>
            </>
          ) : (
            <>
              <span>Place Order</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-[#5d5f5b]">
          By placing an order, you agree to our Terms of Service & ESB Ordering API Agreement.
        </p>
      </form>
    </div>
  );
};
