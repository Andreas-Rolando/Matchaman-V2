import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, Receipt, ShoppingCart, Check, RefreshCw, Cpu } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order } from '../types';

interface OrderSummaryScreenProps {
  order: Order | null;
  onNewOrder: () => void;
}

export const OrderSummaryScreen: React.FC<OrderSummaryScreenProps> = ({
  order,
  onNewOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#4B6F44', '#34562e', '#245a0f', '#a9d19e'],
      });
    } catch (e) {
      console.log('Confetti effect fired');
    }
  }, []);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-sm text-[#5d5f5b]">Belum ada data pesanan aktif.</p>
        <button
          onClick={onNewOrder}
          className="mt-4 rounded-xl bg-[#34562e] px-6 py-2.5 text-xs font-semibold text-white"
        >
          Mulai Pesanan Baru
        </button>
      </div>
    );
  }

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckEsbStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/esb/order/${order.id}/status`);
      const data = await res.json();
      if (data.success) {
        setLiveStatus(`Kitchen Status: ${data.data.kitchen_status} (Est: ${data.data.estimated_ready_time})`);
      } else {
        setLiveStatus('Pesanan terkonfirmasi di ESB system.');
      }
    } catch (err) {
      setLiveStatus('Status: Diproses tim dapur Matchaman.');
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
      {/* Success Hero Section */}
      <section className="relative flex flex-col items-center text-center">
        <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#3c7327] text-white shadow-lg animate-bounce">
          <CheckCircle className="h-10 w-10 stroke-[2.5]" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#1b1c1c]">
          Pesanan Berhasil
        </h1>
        <p className="mt-1 max-w-xs text-xs text-[#42483f]">
          Terima kasih! Pesananmu sedang diproses oleh tim kami via ESB Engine.
        </p>
      </section>

      {/* Order Info Bento Card */}
      <section className="mt-6">
        <div className="rounded-xl border border-[#c2c8bc]/30 bg-white p-4 shadow-xs">
          <div className="border-b border-[#e4e2e1] pb-3">
            <p className="text-[11px] font-bold tracking-wider text-[#5d5f5b] uppercase">
              ID Pesanan
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-serif text-xl font-bold text-[#1b1c1c]">
                {order.orderNumber}
              </span>
              <button
                onClick={handleCopyOrderId}
                className="flex items-center gap-1 text-xs font-semibold text-[#34562e] active:scale-90"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Disalin' : 'Salin'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[11px] font-medium text-[#5d5f5b] uppercase">
                Waktu Transaksi
              </p>
              <p className="mt-0.5 font-semibold text-[#1b1c1c]">
                {order.createdAt}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-medium text-[#5d5f5b] uppercase">
                Status Pembayaran
              </p>
              <span className="mt-0.5 inline-block rounded-full bg-[#c7f0bb]/40 px-3 py-0.5 text-xs font-bold text-[#245a0f]">
                {order.paymentStatus}
              </span>
            </div>
          </div>

          {order.esbResponseRef && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#f0eded] px-3 py-1.5 text-[11px] text-[#42483f]">
              <Cpu className="h-3.5 w-3.5 text-[#34562e]" />
              <span>
                ESB Ref: <strong>{order.esbResponseRef}</strong> ({order.salesMode})
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Order Item Breakdown */}
      <section className="mt-6">
        <h2 className="font-serif text-lg font-bold text-[#1b1c1c]">
          Rincian Pesanan
        </h2>

        <div className="mt-3 space-y-2.5">
          {order.items.map((item) => (
            <div
              key={item.cartItemId}
              className="flex items-center gap-3 rounded-xl border border-[#c2c8bc]/20 bg-[#f6f3f2] p-3"
            >
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-[#e4e2e1]">
                <img
                  src={item.menuItem.imageUrl}
                  alt={item.menuItem.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex-grow min-w-0">
                <h3 className="font-serif text-sm font-bold text-[#1b1c1c] truncate">
                  {item.menuItem.name}
                </h3>
                {item.selectedModifiers.length > 0 && (
                  <p className="text-[11px] text-[#5d5f5b]">
                    {item.selectedModifiers.map((m) => m.optionName).join(', ')}
                  </p>
                )}
                {item.specialNotes && (
                  <p className="text-[10px] italic text-[#34562e]">
                    Note: {item.specialNotes}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs font-bold text-[#1b1c1c]">
                  ${item.totalPrice.toFixed(2)}
                </p>
                <p className="text-[11px] text-[#5d5f5b]">x{item.quantity}</p>
              </div>
            </div>
          ))}

          {/* Price Summary */}
          <div className="mt-4 space-y-1.5 border-t border-dashed border-[#c2c8bc] pt-3 text-xs text-[#5d5f5b]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Biaya Layanan</span>
              <span>${order.serviceFee.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between font-medium text-[#245a0f]">
                <span>Diskon Promo</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-serif text-base font-bold text-[#1b1c1c]">
              <span>Total Bayar</span>
              <span className="text-[#34562e]">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Live Status Re-check Feedback */}
      {liveStatus && (
        <div className="mt-4 rounded-xl border border-[#34562e]/30 bg-[#c7f0bb]/20 p-3 text-center text-xs font-semibold text-[#012202]">
          {liveStatus}
        </div>
      )}

      {/* Action Buttons */}
      <section className="mt-6 flex flex-col gap-3">
        <button
          onClick={handleCheckEsbStatus}
          disabled={checkingStatus}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#34562e] font-serif text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202]"
        >
          {checkingStatus ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="h-4 w-4" />
          )}
          <span>Cek Status Pembayaran</span>
        </button>

        <button
          onClick={onNewOrder}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#c2c8bc] bg-[#f0eded] font-serif text-sm font-semibold text-[#1b1c1c] transition-all active:scale-95 hover:bg-[#eae7e7]"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Pesanan Baru</span>
        </button>
      </section>

      <footer className="mt-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5d5f5b]/70">
          © 2026 Matchaman Zen Cafe • ESB ESO-QS Integration
        </p>
      </footer>
    </div>
  );
};
