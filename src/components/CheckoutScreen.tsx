import React, { useState } from 'react';
import { User, CreditCard, Wallet, Banknote, Utensils, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Branch, SalesMode, CartItem, VoucherDeal, CustomerInfo, PaymentMethod, Order } from '../types';

interface CheckoutScreenProps {
  branch: Branch;
  salesMode: SalesMode;
  cartItems: CartItem[];
  appliedVoucher: VoucherDeal | null;
  onOrderPlaced: (order: Order) => void;
  onBackToCart: () => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  branch,
  salesMode,
  cartItems,
  appliedVoucher,
  onOrderPlaced,
}) => {
  const [customer, setCustomer] = useState<CustomerInfo>({
    fullName: 'Andreas Rolando',
    email: 'andreas.rolando@esb.co.id',
    phone: '08123456789',
    tableNumber: salesMode === 'dine_in' ? '12' : '',
    address: salesMode === 'takeaway' ? 'Pickup at ' + branch.name : '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ewallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const deliveryFee = salesMode === 'takeaway' ? 0.00 : 2.99;
  const serviceFee = 2.00;

  let discount = 0;
  if (appliedVoucher) {
    if (appliedVoucher.discountType === 'free_delivery') {
      discount = deliveryFee;
    } else if (appliedVoucher.discountType === 'percentage') {
      discount = (subtotal * appliedVoucher.discountValue) / 100;
    } else if (appliedVoucher.discountType === 'fixed') {
      discount = appliedVoucher.discountValue;
    }
  }

  const tax = subtotal * 0.08;
  const grandTotal = Math.max(0, subtotal + deliveryFee + serviceFee + tax - discount);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.fullName || !customer.email || !customer.phone) {
      setErrorMessage('Mohon lengkapi Nama, Email, dan Nomor Telepon.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Post to Express backend ESB ESO-QS endpoint
      const response = await fetch('/api/esb/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: branch.id,
          sales_mode: salesMode,
          table_number: customer.tableNumber,
          customer_name: customer.fullName,
          customer_email: customer.email,
          customer_phone: customer.phone,
          payment_method: paymentMethod,
          items: cartItems.map((ci) => ({
            item_id: ci.menuItem.id,
            item_name: ci.menuItem.name,
            qty: ci.quantity,
            price: ci.unitPrice,
            total: ci.totalPrice,
            modifiers: ci.selectedModifiers,
          })),
          voucher_code: appliedVoucher?.code,
          subtotal,
          delivery_fee: deliveryFee,
          discount,
          tax,
          total: grandTotal,
        }),
      });

      const resData = await response.json();

      if (resData.success) {
        const createdOrder: Order = {
          id: resData.data.order_id,
          orderNumber: resData.data.order_number,
          branch,
          salesMode,
          items: cartItems,
          subtotal,
          deliveryFee,
          serviceFee,
          discount,
          appliedVoucherCode: appliedVoucher?.code,
          tax,
          total: grandTotal,
          customerInfo: customer,
          paymentMethod,
          paymentStatus: 'Berhasil',
          createdAt: new Date().toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          esbResponseRef: resData.data.esb_reference_no,
        };

        onOrderPlaced(createdOrder);
      } else {
        setErrorMessage(resData.message || 'Gagal mengirim order ke ESB engine.');
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
            Review details and select payment method (ESB ESO-QS Engine)
          </p>
        </div>
      </section>

      {errorMessage && (
        <div className="mb-4 rounded-xl bg-[#ffdad6] p-3 text-xs font-semibold text-[#93000a]">
          {errorMessage}
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
                placeholder="+62 812 3456 789"
                className="mt-1 h-11 w-full rounded-lg border border-[#c2c8bc] bg-white px-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5f5b]">
                {salesMode === 'dine_in' ? 'Table Number (Dine-in)' : 'Notes / Address'}
              </label>
              <div className="relative mt-1">
                <Utensils className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5d5f5b]" />
                <input
                  type="text"
                  value={salesMode === 'dine_in' ? customer.tableNumber : customer.address}
                  onChange={(e) =>
                    salesMode === 'dine_in'
                      ? setCustomer({ ...customer, tableNumber: e.target.value })
                      : setCustomer({ ...customer, address: e.target.value })
                  }
                  placeholder={salesMode === 'dine_in' ? 'e.g. 12' : 'Pickup at counter'}
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

          <div className="grid grid-cols-3 gap-3">
            {/* Credit Card */}
            <label
              onClick={() => setPaymentMethod('credit_card')}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all ${
                paymentMethod === 'credit_card'
                  ? 'border-[#34562e] bg-[#f0f4ef]'
                  : 'border-[#c2c8bc]/60 bg-white hover:bg-[#f6f3f2]'
              }`}
            >
              <CreditCard
                className={`mb-1 h-7 w-7 ${
                  paymentMethod === 'credit_card' ? 'text-[#34562e]' : 'text-[#5d5f5b]'
                }`}
              />
              <span className="text-xs font-semibold text-[#1b1c1c]">Credit Card</span>
            </label>

            {/* E-Wallet / QRIS */}
            <label
              onClick={() => setPaymentMethod('ewallet')}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all ${
                paymentMethod === 'ewallet'
                  ? 'border-[#34562e] bg-[#f0f4ef]'
                  : 'border-[#c2c8bc]/60 bg-white hover:bg-[#f6f3f2]'
              }`}
            >
              <Wallet
                className={`mb-1 h-7 w-7 ${
                  paymentMethod === 'ewallet' ? 'text-[#34562e]' : 'text-[#5d5f5b]'
                }`}
              />
              <span className="text-xs font-semibold text-[#1b1c1c]">E-Wallet / QRIS</span>
            </label>

            {/* Cash */}
            <label
              onClick={() => setPaymentMethod('cash')}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition-all ${
                paymentMethod === 'cash'
                  ? 'border-[#34562e] bg-[#f0f4ef]'
                  : 'border-[#c2c8bc]/60 bg-white hover:bg-[#f6f3f2]'
              }`}
            >
              <Banknote
                className={`mb-1 h-7 w-7 ${
                  paymentMethod === 'cash' ? 'text-[#34562e]' : 'text-[#5d5f5b]'
                }`}
              />
              <span className="text-xs font-semibold text-[#1b1c1c]">Cash / Cashier</span>
            </label>
          </div>
        </section>

        {/* Order Breakdown */}
        <section className="space-y-1.5 rounded-xl bg-[#f6f3f2] p-4 text-xs text-[#5d5f5b]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax (8%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Service Fee</span>
            <span>${serviceFee.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between font-semibold text-[#245a0f]">
              <span>Diskon Voucher</span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-[#c2c8bc] pt-2 font-serif text-lg font-bold text-[#1b1c1c]">
            <span>Total Amount</span>
            <span className="text-[#34562e]">${grandTotal.toFixed(2)}</span>
          </div>
        </section>

        {/* Action button */}
        <button
          type="submit"
          disabled={isSubmitting}
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
