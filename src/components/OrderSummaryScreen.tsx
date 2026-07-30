import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Copy, Receipt, ShoppingCart, Check, RefreshCw, QrCode, Clock, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Order } from '../types';

interface OrderSummaryScreenProps {
  order: Order | null;
  onNewOrder: () => void;
}

type PaymentStatus = 'settlement' | 'pending' | 'expired' | 'closed';

const POLL_INTERVAL_MS = 5000;
// QRIS windows are minutes, not hours. Past this the customer has clearly
// walked away, and a tab left open must not keep waking the function forever.
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const KNOWN_STATUSES: string[] = ['settlement', 'pending', 'expired', 'closed'];

// Anything unrecognised is treated as still-pending, never as success — an
// unexpected string would otherwise index `statusConfig` to undefined and throw
// mid-render, and guessing "paid" from a status we don't know is the one error
// this screen must never make.
function normalizeStatus(raw: unknown): PaymentStatus {
  if (typeof raw === 'string' && KNOWN_STATUSES.includes(raw)) return raw as PaymentStatus;
  if (raw !== undefined && raw !== null) {
    console.warn(`[payment] unrecognised status from ESB: ${JSON.stringify(raw)} — treating as pending`);
  }
  return 'pending';
}

export const OrderSummaryScreen: React.FC<OrderSummaryScreenProps> = ({
  order,
  onNewOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  // Starts at 'pending', not null. An online order reaches this screen the
  // moment it is created — before the customer has scanned anything — and the
  // old null default rendered the "Pembayaran Berhasil" header for it.
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [pollGaveUp, setPollGaveUp] = useState(false);

  // Paying at the cashier happens entirely off-app — there is no payment to
  // track, so this screen must never report a payment result for it.
  const isCashier = order?.paymentMethodCode === 'cashier';
  const orderId = order?.id;
  const branchCode = order?.branchCode || order?.branch.id || '';

  const checkPayment = useCallback(async () => {
    if (!orderId) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/esb/payment/validate/${orderId}?branchCode=${branchCode}`);
      const data = await res.json();
      if (data.success) {
        setPaymentStatus(normalizeStatus(data.data?.status));
        setTimeRemaining(data.data?.timeRemaining ?? null);
        setValidateError(null);
      } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        // Permanent: this order id will not start validating by being asked
        // again. 429 is excluded — that one clears on its own.
        setPollGaveUp(true);
        setValidateError('Status pembayaran tidak bisa diperiksa untuk pesanan ini. Hubungi kasir.');
      } else {
        setValidateError('Gagal memvalidasi pembayaran. Coba lagi.');
      }
    } catch {
      setValidateError('Gagal menghubungi server. Coba lagi.');
    } finally {
      setCheckingStatus(false);
    }
  }, [orderId, branchCode]);

  // Polling stops while the tab is hidden. The QRIS flow sends the customer
  // into their banking app, so a backgrounded tab is the normal case — and it
  // would otherwise keep waking a serverless function for nothing. Coming back
  // restarts the effect, which checks immediately.
  const [isTabVisible, setIsTabVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const onChange = () => setIsTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const isTerminal = paymentStatus === 'settlement' || paymentStatus === 'expired' || paymentStatus === 'closed';
  const shouldPoll = Boolean(orderId) && !isCashier && !isTerminal && !pollGaveUp && isTabVisible;

  const deadlineRef = useRef(0);
  if (deadlineRef.current === 0) deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      await checkPayment();
      if (cancelled) return;
      if (Date.now() > deadlineRef.current) {
        setPollGaveUp(true);
        return;
      }
      // Chained timeout rather than setInterval: a slow request must not let a
      // queue of overlapping polls build up behind it.
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Check straight away — the customer may have paid on the gateway before
    // being redirected back here.
    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [shouldPoll, checkPayment]);

  // Fire once, and only when there is something to celebrate: a settled
  // payment, or a cashier order that was created successfully. This used to run
  // on mount for every order, unpaid QRIS ones included.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (celebratedRef.current) return;
    if (!isCashier && paymentStatus !== 'settlement') return;
    celebratedRef.current = true;
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
  }, [isCashier, paymentStatus]);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-sm text-[#5d5f5b]">Belum ada data pesanan aktif.</p>
        <button
          onClick={onNewOrder}
          className="tap-44 mt-4 rounded-xl bg-[#34562e] px-6 py-2.5 text-xs font-semibold text-white"
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

  const statusConfig = {
    settlement: { label: 'Pembayaran Berhasil', icon: CheckCircle, bg: 'bg-[#c7f0bb]/40', text: 'text-[#245a0f]' },
    pending: { label: 'Menunggu Pembayaran', icon: Clock, bg: 'bg-amber-100', text: 'text-amber-800' },
    expired: { label: 'Pembayaran Kedaluwarsa', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
    closed: { label: 'Pembayaran Dibatalkan', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
  };

  const isQrisPayment = order.paymentMethodCode === 'qrisesb' || isCashier;
  const showQR = isQrisPayment && order.qrString && paymentStatus === 'pending';

  const headerConfig = {
    settlement: { title: 'Pembayaran Berhasil', desc: 'Pesananmu sedang diproses oleh tim kami.', iconColor: 'bg-[#3c7327]', icon: CheckCircle },
    pending: { title: 'Menunggu Pembayaran', desc: 'Pesananmu akan diproses setelah pembayaran dikonfirmasi.', iconColor: 'bg-amber-500', icon: Clock },
    expired: { title: 'Pembayaran Kedaluwarsa', desc: 'Silakan buat pesanan baru untuk mencoba lagi.', iconColor: 'bg-red-500', icon: XCircle },
    closed: { title: 'Pembayaran Dibatalkan', desc: 'Pesanan ini telah dibatalkan.', iconColor: 'bg-red-500', icon: XCircle },
  };

  const header = isCashier
    ? {
        title: 'Pesanan Berhasil Dibuat',
        desc: 'Tunjukkan QR di bawah ke kasir untuk menyelesaikan pembayaran.',
        iconColor: 'bg-[#3c7327]',
        icon: Receipt,
      }
    : headerConfig[paymentStatus];

  const HeaderIcon = header.icon;

  // The bouncing icon reads as a celebration. Keep it for outcomes worth
  // celebrating; a payment still being waited on should sit still.
  const heroAnimation = isCashier || paymentStatus === 'settlement' ? 'animate-bounce' : '';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
      {/* Success Hero Section */}
      <section className="relative flex flex-col items-center text-center">
        <div className={`relative mb-4 flex h-20 w-20 items-center justify-center rounded-full ${header.iconColor} text-white shadow-lg ${heroAnimation}`}>
          <HeaderIcon className="h-10 w-10 stroke-[2.5]" />
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
                {order.paymentMethodCode === 'cashier' ? 'Tunjukkan QR ke Kasir' : 'Scan QRIS untuk Bayar'}
              </h2>
            </div>
            <div className="flex flex-col items-center">
              {/* max-w caps it at the 220px design size; below that the SVG
                  scales down so it never overflows narrow viewports. */}
              <div className="w-full max-w-[252px] rounded-xl border-2 border-[#1b1c1c] p-4 bg-white">
                <QRCodeSVG
                  value={order.qrString || ''}
                  size={220}
                  level="M"
                  className="h-auto w-full"
                />
              </div>
              <p className="mt-3 text-xs text-[#5d5f5b] text-center">
                {order.paymentMethodCode === 'cashier'
                  ? 'Tunjukkan QR ini ke kasir untuk pembayaran.'
                  : 'Tunjukkan QR ini ke kasir atau scan dari aplikasi mobile banking/e-wallet kamu.'}
              </p>
              <p className="mt-1 font-serif text-lg font-bold text-[#34562e]">
                Rp{order.total.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Live payment status — never reachable on the cashier path */}
      {!isCashier && (
        <section className="mt-6">
          <div className={`rounded-xl p-4 ${statusConfig[paymentStatus].bg}`}>
            <div className="flex items-center gap-3">
              {React.createElement(statusConfig[paymentStatus].icon, {
                className: `h-6 w-6 shrink-0 ${statusConfig[paymentStatus].text}`,
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
                {paymentStatus === 'pending' && shouldPoll && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700">
                    <RefreshCw className={`h-3 w-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                    Status diperbarui otomatis tiap {POLL_INTERVAL_MS / 1000} detik
                  </p>
                )}
                {paymentStatus === 'pending' && pollGaveUp && (
                  <p className="mt-0.5 text-xs text-amber-700">
                    Pengecekan otomatis dihentikan. Tekan tombol di bawah untuk cek manual.
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
                className="tap-44 flex items-center gap-1 text-xs font-semibold text-[#34562e] active:scale-90"
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
                {isCashier ? 'Metode Pembayaran' : 'Status Pembayaran'}
              </p>
              <span className={`mt-0.5 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
                isCashier
                  ? 'bg-[#f0eded] text-[#42483f]'
                  : `${statusConfig[paymentStatus].bg} ${statusConfig[paymentStatus].text}`
              }`}>
                {isCashier ? 'Bayar di Kasir' : statusConfig[paymentStatus].label}
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
        {/* No in-app payment happens when paying at the cashier, so there is
            nothing to poll for — the button is omitted entirely. Elsewhere it
            stays as a manual nudge alongside the automatic polling, and as the
            only way forward once polling has given up. */}
        {!isCashier && !isTerminal && (
          <button
            onClick={checkPayment}
            disabled={checkingStatus}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#34562e] font-serif text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202] disabled:opacity-60 disabled:active:scale-100"
          >
            {checkingStatus ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4" />
            )}
            <span>{checkingStatus ? 'Memeriksa…' : 'Cek Status Pembayaran'}</span>
          </button>
        )}

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
