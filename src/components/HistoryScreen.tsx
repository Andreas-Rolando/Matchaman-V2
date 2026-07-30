import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { HistoryIdentity, OrderHistoryItem } from '../types';

interface HistoryScreenProps {
  /** Taken from the last order placed on this device — never typed in. ESB
   *  scopes history to a user token minted from name + email, and asking the
   *  customer to re-key those is friction for data the app already holds. */
  identity: HistoryIdentity | null;
  /** Any valid branch — ESB requires a Data-Branch header on the auth call that
   *  mints the user token, even though the history itself spans every branch. */
  branchCode: string;
  onBrowseMenu: () => void;
}

type Bucket = 'pending' | 'complete' | 'closed';

const BUCKETS: { key: Bucket; label: string; icon: typeof Clock; accent: string; chip: string }[] = [
  { key: 'pending', label: 'Pending', icon: Clock, accent: 'text-amber-800', chip: 'bg-amber-100 text-amber-800' },
  { key: 'complete', label: 'Selesai', icon: CheckCircle, accent: 'text-[#245a0f]', chip: 'bg-[#c7f0bb]/40 text-[#245a0f]' },
  { key: 'closed', label: 'Ditutup', icon: XCircle, accent: 'text-red-700', chip: 'bg-red-100 text-red-700' },
];

// Grouping keys off ESB's paymentStatus — the same vocabulary the order-summary
// screen already speaks (settlement / pending / expired / closed).
const BUCKET_BY_PAYMENT_STATUS: Record<string, Bucket> = {
  pending: 'pending',
  settlement: 'complete',
  capture: 'complete',
  paid: 'complete',
  closed: 'closed',
  expire: 'closed',
  expired: 'closed',
  cancel: 'closed',
  cancelled: 'closed',
  deny: 'closed',
  failure: 'closed',
  refund: 'closed',
};

function bucketOf(item: OrderHistoryItem): Bucket {
  const key = String(item.payment_status || '').toLowerCase();
  const bucket = BUCKET_BY_PAYMENT_STATUS[key];
  if (bucket) return bucket;
  // ESB's spec documents paymentStatus by example only, so the full set is not
  // knowable up front. Anything unrecognised lands in Pending — visible and
  // chaseable — rather than being silently dropped or counted as complete.
  console.warn(`[history] unmapped paymentStatus "${item.payment_status}" — bucketed as pending`);
  return 'pending';
}

// "2025-05-22 13:38:06" is not a format Date parses portably; the T makes it one.
function formatDate(raw: string): string {
  const parsed = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return raw || '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  identity,
  branchCode,
  onBrowseMenu,
}) => {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<Bucket>('pending');
  const [loaded, setLoaded] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!identity || !branchCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/esb/user/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: identity.fullName,
          email: identity.email,
          phoneNumber: identity.phone || '',
          branchCode,
          page: 1,
          limit: 50,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data?.orders || []);
      } else {
        setError(data.error || 'Gagal memuat riwayat pesanan.');
        setOrders([]);
      }
    } catch {
      setError('Tidak dapat menghubungi server. Periksa koneksi kamu.');
      setOrders([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [identity, branchCode]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const grouped = useMemo(() => {
    const acc: Record<Bucket, OrderHistoryItem[]> = { pending: [], complete: [], closed: [] };
    for (const item of orders) acc[bucketOf(item)].push(item);
    // Newest first within each tab; ESB does not guarantee an order.
    for (const key of Object.keys(acc) as Bucket[]) {
      acc[key].sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)));
    }
    return acc;
  }, [orders]);

  // ---------------------------------------------------------------
  // Nothing ordered from this device yet, so there is no identity to look
  // history up with. Say that plainly and point at the menu — asking the
  // customer to type a name and email the app would otherwise capture for
  // itself is friction for no gain.
  // ---------------------------------------------------------------
  if (!identity) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f0eded] text-[#5d5f5b]">
          <ShoppingBag className="h-9 w-9" />
        </div>
        <h2 className="mt-4 font-serif text-xl font-bold text-[#1b1c1c]">Belum Ada Riwayat</h2>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#5d5f5b]">
          Riwayat pesanan muncul di sini setelah kamu menyelesaikan pesanan pertama dari aplikasi
          ini.
        </p>

        <button
          onClick={onBrowseMenu}
          className="tap-44 mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34562e] px-6 font-serif text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202]"
        >
          <UtensilsCrossed className="h-4 w-4" />
          <span>Lihat Menu</span>
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Identified — show the three groups.
  // ---------------------------------------------------------------
  const activeList = grouped[activeBucket];
  const activeMeta = BUCKETS.find((b) => b.key === activeBucket)!;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-bold text-[#1b1c1c]">Riwayat Pesanan</h2>
          <p className="mt-0.5 truncate text-xs text-[#5d5f5b]">{identity.email}</p>
        </div>
        {/* Refresh only. There is no "switch account" here on purpose: the
            identity comes from the last order placed on this device, so
            clearing it would leave no way back except placing another one. */}
        <button
          onClick={loadHistory}
          disabled={loading}
          aria-label="Muat ulang riwayat"
          className="tap-44 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c2c8bc] bg-white text-[#34562e] transition-all active:scale-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Bucket switcher — counts come from the full result set, so an empty tab
          is distinguishable from history that has not loaded yet. */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-[#f0eded] p-1">
        {BUCKETS.map((bucket) => {
          const BucketIcon = bucket.icon;
          const isActive = bucket.key === activeBucket;
          return (
            <button
              key={bucket.key}
              onClick={() => setActiveBucket(bucket.key)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 transition-all active:scale-95 ${
                isActive ? 'bg-white shadow-sm' : 'hover:bg-white/50'
              }`}
            >
              <BucketIcon className={`h-4 w-4 ${isActive ? bucket.accent : 'text-[#5d5f5b]'}`} />
              <span
                className={`text-[11px] font-semibold ${isActive ? 'text-[#1b1c1c]' : 'text-[#5d5f5b]'}`}
              >
                {bucket.label}
              </span>
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${bucket.chip}`}>
                {grouped[bucket.key].length}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !loaded && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#eae7e7] border-t-[#34562e]" />
        </div>
      )}

      {loaded && !error && activeList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0eded] text-[#5d5f5b]">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#1b1c1c]">
            Belum ada transaksi {activeMeta.label.toLowerCase()}
          </p>
          <p className="mt-1 text-xs text-[#5d5f5b]">
            Pesanan dengan status ini akan muncul di sini.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {activeList.map((item) => (
          <article
            key={item.order_id}
            className="rounded-xl border border-[#c2c8bc]/30 bg-white p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-serif text-sm font-bold text-[#1b1c1c]">
                  {item.branch_name || item.branch_code}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#5d5f5b]">
                  {formatDate(item.transaction_date)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${activeMeta.chip}`}
              >
                {item.payment_status || activeMeta.label}
              </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-[#e4e2e1] pt-3">
              <div className="min-w-0 text-[11px] text-[#5d5f5b]">
                <p className="truncate">
                  ID: <span className="font-semibold text-[#1b1c1c]">{item.order_id}</span>
                </p>
                <p className="mt-0.5">
                  {item.order_type_name || item.order_type} • {item.total_item} item
                  {item.queue_num ? ` • Antrean ${item.queue_num}` : ''}
                </p>
                {item.status && (
                  <p className="mt-0.5">
                    Status pesanan: <span className="font-semibold">{item.status}</span>
                  </p>
                )}
              </div>
              <p className="shrink-0 font-serif text-base font-bold text-[#34562e]">
                {item.currency_sign}
                {Number(item.grand_total || 0).toLocaleString('id-ID')}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
