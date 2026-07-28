import React, { useState } from 'react';
import { X, Plus, Minus, Tag, Coffee, ArrowRight, Truck, Percent, Check } from 'lucide-react';
import { CartItem, VoucherDeal, MenuItem, Branch, SalesMode } from '../types';

interface CartScreenProps {
  branch: Branch;
  salesMode: SalesMode;
  cartItems: CartItem[];
  availableDeals: VoucherDeal[];
  appliedVoucher: VoucherDeal | null;
  onApplyVoucher: (voucher: VoucherDeal | null) => void;
  onUpdateQty: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onAddUpsell: (item: MenuItem) => void;
  upsellItem: MenuItem | null;
  onProceedToCheckout: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  branch,
  salesMode,
  cartItems,
  availableDeals,
  appliedVoucher,
  onApplyVoucher,
  onUpdateQty,
  onRemoveItem,
  onAddUpsell,
  upsellItem,
  onProceedToCheckout,
}) => {
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [voucherError, setVoucherError] = useState('');

  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const isDelivery = salesMode === 'delivery';
  const deliveryFee = 0;
  const serviceFee = 0;

  // Calculate discount based on applied voucher
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

  const grandTotal = Math.max(0, subtotal - discount);

  const handleManualVoucherApply = () => {
    setVoucherError('');
    if (!voucherCodeInput.trim()) return;

    const matched = availableDeals.find(
      (d) => d.code.toLowerCase() === voucherCodeInput.trim().toLowerCase()
    );

    if (matched) {
      if (subtotal < matched.minOrder) {
        setVoucherError(`Minimal order Rp${matched.minOrder.toLocaleString('id-ID')} untuk voucher ini.`);
        return;
      }
      onApplyVoucher(matched);
      setVoucherCodeInput('');
    } else {
      setVoucherError('Kode voucher tidak valid.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-48 pt-4">
      {/* Title */}
      <div className="mb-6">
        <h2 className="font-serif text-3xl font-bold text-[#1b1c1c]">
          Your Cart
        </h2>
        <p className="mt-1 text-sm text-[#5d5f5b]">
          {cartItems.reduce((sum, i) => sum + i.quantity, 0)} items from{' '}
          <span className="font-semibold text-[#34562e]">{branch.name}</span>{' '}
          <span className="rounded bg-[#f0eded] px-2 py-0.5 text-xs text-[#42483f] font-medium uppercase">
            ({salesMode})
          </span>
        </p>
      </div>

      {cartItems.length === 0 ? (
        <div className="my-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f0eded] text-[#5d5f5b]">
            <Coffee className="h-10 w-10 text-[#34562e]" />
          </div>
          <h3 className="mt-4 font-serif text-lg font-bold text-[#1b1c1c]">
            Keranjang Kamu Masih Kosong
          </h3>
          <p className="mt-1 max-w-xs text-xs text-[#5d5f5b]">
            Yuk pilih menu Matcha favoritmu dari cabang {branch.name}!
          </p>
        </div>
      ) : (
        <>
          {/* Cart Items List */}
          <section className="flex flex-col gap-3">
            {cartItems.map((item) => (
              <div
                key={item.cartItemId}
                className="flex gap-4 rounded-xl border border-[#f0eded] bg-white p-4 shadow-xs"
              >
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#f0eded]">
                  <img
                    src={item.menuItem.imageUrl}
                    alt={item.menuItem.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-serif text-base font-semibold text-[#1b1c1c] truncate pr-2">
                        {item.menuItem.name}
                      </h3>
                      <button
                        onClick={() => onRemoveItem(item.cartItemId)}
                        className="text-[#5d5f5b] hover:text-[#ba1a1a] transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Modifiers info */}
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-xs text-[#5d5f5b]">
                        {item.selectedModifiers.map((m) => m.optionName).join(', ')}
                      </p>
                    )}
                    {item.specialNotes && (
                      <p className="text-[11px] italic text-[#34562e]">
                        Note: {item.specialNotes}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold text-[#34562e]">
                      Rp{item.totalPrice.toLocaleString('id-ID')}
                    </span>

                    <div className="flex items-center rounded-full bg-[#f0eded] px-1 py-0.5">
                      <button
                        onClick={() => onUpdateQty(item.cartItemId, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#1b1c1c] shadow-xs active:scale-90"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-2.5 min-w-[16px] text-center font-bold text-xs text-[#1b1c1c]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.cartItemId, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#34562e] text-white shadow-xs active:scale-90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Available Deals */}
          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-5 w-5 text-[#245a0f]" />
              <h3 className="font-serif text-lg font-bold text-[#1b1c1c]">
                Available Deals
              </h3>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {availableDeals.map((deal) => {
                const isApplied = appliedVoucher?.id === deal.id;
                const canApply = subtotal >= deal.minOrder;

                return (
                  <div
                    key={deal.id}
                    className={`relative w-64 flex-shrink-0 overflow-hidden rounded-xl p-4 transition-transform active:scale-[0.98] ${
                      isApplied
                        ? 'border-2 border-[#34562e] bg-[#3c7327] text-white'
                        : 'bg-[#e0e0db] text-[#42483f]'
                    }`}
                  >
                    <div className="relative z-10">
                      <h4 className="font-bold text-base">{deal.title}</h4>
                      <p className="mt-0.5 text-xs opacity-90">
                        {deal.description}
                      </p>
                      <button
                        onClick={() => {
                          if (isApplied) {
                            onApplyVoucher(null);
                          } else if (canApply) {
                            onApplyVoucher(deal);
                          } else {
                            alert(`Minimum order Rp${deal.minOrder.toLocaleString('id-ID')} to use this deal.`);
                          }
                        }}
                        className={`mt-3 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all ${
                          isApplied
                            ? 'bg-white text-[#34562e]'
                            : canApply
                            ? 'bg-[#34562e] text-white hover:bg-[#012202]'
                            : 'bg-black/10 text-black/50 cursor-not-allowed'
                        }`}
                      >
                        {isApplied ? 'Applied \u2713' : canApply ? 'Apply' : `Min. Rp${deal.minOrder.toLocaleString('id-ID')}`}
                      </button>
                    </div>
                    {deal.discountType === 'free_delivery' ? (
                      <Truck className="absolute -bottom-3 -right-3 h-20 w-20 opacity-15 rotate-12" />
                    ) : (
                      <Percent className="absolute -bottom-3 -right-3 h-20 w-20 opacity-15 rotate-12" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Add Voucher Section */}
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-[#1b1c1c]">
              Add Voucher
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value)}
                placeholder="Enter code (e.g. SAVE20)"
                className="h-11 flex-1 rounded-xl border border-[#eae7e7] bg-white px-4 text-xs font-medium outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
              />
              <button
                onClick={handleManualVoucherApply}
                className="h-11 rounded-xl bg-[#1b1c1c] px-5 text-xs font-semibold text-white transition-all active:scale-95 hover:bg-[#303030]"
              >
                Apply
              </button>
            </div>
            {voucherError && (
              <p className="mt-1 text-xs text-[#ba1a1a]">{voucherError}</p>
            )}
            {appliedVoucher && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#c7f0bb]/40 p-2 text-xs text-[#012202]">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#34562e]" />
                  <span>
                    Voucher <strong>{appliedVoucher.code}</strong> aktif!
                  </span>
                </div>
                <button
                  onClick={() => onApplyVoucher(null)}
                  className="text-xs font-bold text-[#ba1a1a] hover:underline"
                >
                  Hapus
                </button>
              </div>
            )}
          </section>

          {/* Suggestions (Upsell) */}
          {upsellItem && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-[#1b1c1c]">
              Frequently Bought With
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-[#f0eded] bg-[#f0eded] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs">
                <Coffee className="h-6 w-6 text-[#34562e]" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#1b1c1c] truncate">
                  {upsellItem.name}
                </h4>
                <p className="text-[10px] text-[#5d5f5b]">Perfect pairing with Matcha</p>
              </div>
              <button
                onClick={() => onAddUpsell(upsellItem)}
                className="rounded-lg bg-[#34562e] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#012202]"
              >
                Rp{upsellItem.price.toLocaleString('id-ID')}
              </button>
            </div>
          </section>
          )}
        </>
      )}

      {/* Checkout Fixed Bottom Sheet */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] border-t border-[#f6f3f2] bg-white shadow-[0px_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="mb-4 space-y-1.5 text-xs text-[#5d5f5b]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>Rp{subtotal.toLocaleString('id-ID')}</span>
              </div>
              {isDelivery && (
                <div className="flex justify-between">
                  <span>Biaya Pengiriman</span>
                  <span className="text-[#34562e] font-semibold">Dihitung di Checkout</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between font-medium text-[#245a0f]">
                  <span>Promotions ({appliedVoucher?.code})</span>
                  <span>-Rp{discount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-[#f0eded] pt-2 text-sm font-bold text-[#1b1c1c]">
                <span className="font-serif text-lg">Total (est.)</span>
                <span className="font-serif text-xl text-[#34562e]">
                  Rp{grandTotal.toLocaleString('id-ID')}
                </span>
              </div>
              <p className="text-[10px] text-[#5d5f5b]">*Total akhir dihitung oleh ESB Engine</p>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#34562e] text-base font-semibold text-white shadow-lg transition-all active:scale-[0.98] hover:bg-[#012202]"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
