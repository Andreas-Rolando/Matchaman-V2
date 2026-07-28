import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, Receipt, ShoppingCart, Check, RefreshCw, QrCode, Clock, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  const [paymentStatus, setPaymentStatus] = useState<'settlement' | 'pending' | 'expired' | 'closed' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
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

  const handleValidatePayment = async () => {
    if (cooldown > 0) return;
    setCheckingStatus(true);
    setValidateError(null);
    try {
      const res = await fetch(`/api/esb/payment/validate/${order.id}?branchCode=${order.branchCode || order.branch.id}`);
      const data = await res.json();
      if (data.success) {
        const status = data.data.status as 'settlement' | 'pending' | 'expired' | 'closed';
        setPaymentStatus(status);
        setTimeRemaining(data.data.timeRemaining ?? null);
      } else {
        setValidateError('Gagal memvalidasi pembayaran. Coba lagi.');
      }
    } catch (err) {
      setValidateError('Gagal menghubungi server. Coba lagi.');
    } finally {
      setCheckingStatus(false);
      setCooldown(10);
    }
  };

  const statusConfig = {
    settlement: { label: 'Pembayaran Berhasil', icon: CheckCircle, bg: 'bg-[#c7f0bb]/40', text: 'text-[#245a0f]' },
    pending: { label: 'Menunggu Pembayaran', icon: Clock, bg: 'bg-amber-100', text: 'text-amber-800' },
    expired: { label: 'Pembayaran Kedaluwarsa', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
    closed: { label: 'Pembayaran Dibatalkan', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
  };

  const isQrisPayment = order.paymentMethodCode === 'qrisesb';
  const showQR = isQrisPayment && order.qrString && (!paymentStatus || paymentStatus === 'pending');

  const headerConfig = {
    settlement: { title: 'Pembayaran Berhasil', desc: 'Pesananmu sedang diproses oleh tim kami.', iconColor: 'bg-[#3c7327]' },
    pending: { title: 'Menunggu Pembayaran', desc: 'Pesananmu akan diproses setelah pembayaran dikonfirmasi.', iconColor: 'bg-amber-500' },
    expired: { title: 'Pembayaran Kedaluwarsa', desc: 'Silakan buat pesanan baru untuk mencoba lagi.', iconColor: 'bg-red-500' },
    closed: { title: 'Pembayaran Dibatalkan', desc: 'Pesanan ini telah dibatalkan.', iconColor: 'bg-red-500' },
  };

  const header = paymentStatus ? headerConfig[paymentStatus] : headerConfig.settlement;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
      {/* Success Hero Section */}
      <section className="relative flex flex-col items-center text-center">
        <div className={`relative mb-4 flex h-20 w-20 items-center justify-center rounded-full ${header.iconColor} text-white shadow-lg animate-bounce`}>
          <CheckCircle className="h-10 w-10 stroke-[2.5]" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#1b1c1c]">
          {header.title}
        </h1>
        <p className="mt-1 max-w-xs text-xs text-[#42483f]">
          {header.desc}
        </p>
      </section>

      {/* QR Code Section */}
      {showQR && (
        <section className="mt-6">
          <div className="rounded-xl border border-[#c2c8bc]/30 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="h-5 w-5 text-[#34562e]" />
              <h2 className="font-serif text-base font-bold text-[#1b1c1c]">
                Scan QRIS untuk Bayar
              </h2>
            </div>
            <div className="flex flex-col items-center">
              <div className="rounded-xl border-2 border-[#1b1c1c] p-4 bg-white">
                <QRCodeSVG
                  value={order.qrString || ''}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="mt-3 text-xs text-[#5d5f5b] text-center">
                Tunjukkan QR ini ke kasir atau scan dari aplikasi mobile banking/e-wallet kamu.
              </p>
              <p className="mt-1 font-serif text-lg font-bold text-[#34562e]">
                Rp{order.total.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Payment Status (after validate) */}
      {paymentStatus && (
        <section className="mt-6">
          <div className={`rounded-xl p-4 ${statusConfig[paymentStatus].bg}`}>
            <div className="flex items-center gap-3">
              {React.createElement(statusConfig[paymentStatus].icon, {
                className: `h-6 w-6 ${statusConfig[paymentStatus].text}`,
              })}
              <div>
                <p className={`font-serif text-sm font-bold ${statusConfig[paymentStatus].text}`}>
                  {statusConfig[paymentStatus].label}
                </p>
                {paymentStatus === 'pending' && timeRemaining !== null && timeRemaining > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    Sisa waktu: {Math.floor(timeRemaining / 60)} menit {timeRemaining % 60} detik
                  </p>
                )}
                {paymentStatus === 'settlement' && (
                  <p className="text-xs text-[#245a0f] mt-0.5">
                    Pesananmu akan segera diproses oleh dapur.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {validateError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold text-red-700">
          {validateError}
        </div>
      )}

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
              <span className={`mt-0.5 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                paymentStatus === 'settlement'
                  ? 'bg-[#c7f0bb]/40 text-[#245a0f]'
                  : paymentStatus === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : paymentStatus === 'expired' || paymentStatus === 'closed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-[#c7f0bb]/40 text-[#245a0f]'
              }`}>
                {paymentStatus
                  ? statusConfig[paymentStatus].label
                  : order.paymentStatus === 'Pending' ? 'Menunggu' : order.paymentStatus}
              </span>
            </div>
          </div>
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
                  Rp{item.totalPrice.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-[#5d5f5b]">x{item.quantity}</p>
              </div>
            </div>
          ))}

          {/* Price Summary */}
          <div className="mt-4 space-y-1.5 border-t border-dashed border-[#c2c8bc] pt-3 text-xs text-[#5d5f5b]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rp{order.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Biaya Pengiriman</span>
                <span>Rp{order.deliveryFee.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Pajak</span>
              <span>Rp{order.tax.toLocaleString('id-ID')}</span>
            </div>
            {order.roundingTotal > 0 && (
              <div className="flex justify-between">
                <span>Pembulatan</span>
                <span>Rp{order.roundingTotal.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-serif text-base font-bold text-[#1b1c1c]">
              <span>Total Bayar</span>
              <span className="text-[#34562e]">Rp{order.total.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <section className="mt-6 flex flex-col gap-3">
        <button
          onClick={handleValidatePayment}
          disabled={checkingStatus || cooldown > 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#34562e] font-serif text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202] disabled:opacity-60 disabled:active:scale-100"
        >
          {checkingStatus ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="h-4 w-4" />
          )}
          <span>{cooldown > 0 ? `Cek lagi dalam ${cooldown}s` : 'Cek Status Pembayaran'}</span>
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
