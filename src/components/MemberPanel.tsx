import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  RefreshCw,
  LogOut,
  AlertCircle,
  Gift,
  Sparkles,
  UserRound,
  ExternalLink,
} from 'lucide-react';
import { LoopMember, LoopReward } from '../types';

type Phase = 'checking' | 'signed-out' | 'waiting' | 'signed-in';

const POLL_INTERVAL_MS = 5000;
// A WhatsApp verification nobody completes must not keep waking the function.
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** The Loop spec does not pin down the shape of `tier`, so read it defensively
 *  rather than assume a field that may not exist. */
function tierLabel(tier: unknown): string | null {
  if (!tier) return null;
  if (typeof tier === 'string') return tier;
  if (typeof tier === 'object') {
    const t = tier as Record<string, unknown>;
    for (const key of ['tierName', 'name', 'tier', 'title', 'tierCode']) {
      const value = t[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

function formatDate(raw?: string): string | null {
  if (!raw) return null;
  const parsed = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const MemberPanel: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('checking');
  const [member, setMember] = useState<LoopMember | null>(null);
  const [rewards, setRewards] = useState<LoopReward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otpUrl, setOtpUrl] = useState<string | null>(null);
  const [pollGaveUp, setPollGaveUp] = useState(false);

  const loadMemberAndRewards = useCallback(async (): Promise<boolean> => {
    const res = await fetch('/api/loop/member');
    if (res.status === 401) return false;
    const data = await res.json();
    if (!data.success) {
      setError(data.error || 'Gagal memuat data member.');
      return false;
    }
    setMember(data.data);

    // Rewards are secondary: a failure here must not knock the member out of a
    // session they are legitimately in.
    try {
      const rewardRes = await fetch('/api/loop/rewards');
      const rewardData = await rewardRes.json();
      if (rewardData.success) setRewards(rewardData.data || []);
    } catch {
      /* leave the list empty */
    }
    return true;
  }, []);

  // Is there already a session? The cookie is httpOnly, so the only way to know
  // is to ask the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const signedIn = await loadMemberAndRewards();
        if (!cancelled) setPhase(signedIn ? 'signed-in' : 'signed-out');
      } catch {
        if (!cancelled) setPhase('signed-out');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMemberAndRewards]);

  const startLogin = async () => {
    setBusy(true);
    setError(null);
    setPollGaveUp(false);
    try {
      const res = await fetch('/api/loop/login/start', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Gagal memulai login.');
        return;
      }
      const url = data.data?.otp_message_url;
      setOtpUrl(url || null);
      setPhase('waiting');
      // Opened straight from the click so the browser treats it as user-driven
      // rather than a popup.
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      setError('Tidak dapat menghubungi server.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch('/api/loop/logout', { method: 'POST' });
    } catch {
      /* the session is cleared server-side regardless */
    }
    setMember(null);
    setRewards([]);
    setOtpUrl(null);
    setPhase('signed-out');
    setBusy(false);
  };

  // ---- Polling while the customer completes WhatsApp verification ----
  const [isTabVisible, setIsTabVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
  useEffect(() => {
    const onChange = () => setIsTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const deadlineRef = useRef(0);
  const shouldPoll = phase === 'waiting' && !pollGaveUp && isTabVisible;

  useEffect(() => {
    if (phase !== 'waiting') deadlineRef.current = 0;
  }, [phase]);

  useEffect(() => {
    if (!shouldPoll) return;
    if (deadlineRef.current === 0) deadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      try {
        const res = await fetch('/api/loop/login/status');
        const data = await res.json();
        if (cancelled) return;

        if (!data.success) {
          // Permanent: the pending attempt is gone, asking again will not
          // resurrect it. 429 is excluded, that one clears on its own.
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            setPollGaveUp(true);
            setError(data.error || 'Sesi login kedaluwarsa. Coba lagi.');
            setPhase('signed-out');
            return;
          }
        } else if (data.data?.status === 'VERIFIED') {
          const signedIn = await loadMemberAndRewards();
          if (cancelled) return;
          setPhase(signedIn ? 'signed-in' : 'signed-out');
          return;
        } else if (data.data?.status === 'EXPIRED') {
          setPollGaveUp(true);
          setError('Verifikasi kedaluwarsa. Silakan mulai lagi.');
          setPhase('signed-out');
          return;
        }
      } catch {
        // Network blip — keep waiting, the customer may be off in WhatsApp.
      }

      if (cancelled) return;
      if (Date.now() > deadlineRef.current) {
        setPollGaveUp(true);
        setError('Verifikasi tidak selesai. Silakan mulai lagi.');
        setPhase('signed-out');
        return;
      }
      // Chained timeout, not setInterval: a slow request must not stack up a
      // queue of overlapping polls behind it.
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [shouldPoll, loadMemberAndRewards]);

  // ---------------------------------------------------------------

  const card = 'rounded-xl border border-[#eae7e7] bg-white p-4 shadow-xs';

  if (phase === 'checking') {
    return (
      <div className={`${card} flex items-center justify-center py-8`}>
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#eae7e7] border-t-[#34562e]" />
      </div>
    );
  }

  if (phase === 'signed-out') {
    return (
      <div className={card}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#c7f0bb]/40 text-[#245a0f]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-base font-bold text-[#1b1c1c]">Member Loyalty</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5d5f5b]">
              Masuk untuk melihat poin, tier, dan reward yang bisa kamu tukar.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff3e0] p-3 text-xs text-[#e65100]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={startLogin}
          disabled={busy}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#34562e] font-serif text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202] disabled:opacity-60 disabled:active:scale-100"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          <span>Masuk dengan WhatsApp</span>
        </button>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className={card}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-base font-bold text-[#1b1c1c]">Menunggu Verifikasi</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5d5f5b]">
              WhatsApp sudah terbuka dengan pesan verifikasi. <strong>Kirim pesan itu apa adanya</strong>,
              jangan diubah, lalu kembali ke halaman ini.
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Status diperiksa otomatis tiap {POLL_INTERVAL_MS / 1000} detik
        </p>

        {otpUrl && (
          <a
            href={otpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c2c8bc] bg-white text-xs font-semibold text-[#34562e] transition-all active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            Buka WhatsApp lagi
          </a>
        )}

        <button
          onClick={() => {
            setPhase('signed-out');
            setOtpUrl(null);
            setError(null);
          }}
          className="mt-2 h-9 w-full text-xs font-semibold text-[#5d5f5b] active:scale-95"
        >
          Batal
        </button>
      </div>
    );
  }

  // signed-in
  const tier = tierLabel(member?.tier);
  const points = member?.point_amount ?? 0;

  return (
    <div className="space-y-3">
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f0eded] text-[#5d5f5b]">
              {member?.image_url ? (
                <img src={member.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-serif text-base font-bold text-[#1b1c1c]">
                {member?.full_name || 'Member'}
              </h3>
              <p className="truncate text-[11px] text-[#5d5f5b]">
                {member?.member_code}
                {tier ? ` • ${tier}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            disabled={busy}
            aria-label="Keluar"
            className="tap-44 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c2c8bc] bg-white text-[#5d5f5b] transition-all active:scale-90 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-end justify-between rounded-xl bg-[#c7f0bb]/30 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#245a0f]">Poin kamu</span>
          <span className="font-serif text-2xl font-bold text-[#245a0f]">
            {points.toLocaleString('id-ID')}
          </span>
        </div>

        {(member?.phone_number || member?.email || member?.join_date) && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#e4e2e1] pt-3 text-[11px]">
            {member?.phone_number && (
              <div>
                <p className="text-[#5d5f5b] uppercase">Nomor HP</p>
                <p className="mt-0.5 font-semibold text-[#1b1c1c]">
                  {member.country_code || ''}
                  {member.phone_number}
                </p>
              </div>
            )}
            {member?.email && (
              <div className="min-w-0">
                <p className="text-[#5d5f5b] uppercase">Email</p>
                <p className="mt-0.5 truncate font-semibold text-[#1b1c1c]">{member.email}</p>
              </div>
            )}
            {member?.join_date && (
              <div>
                <p className="text-[#5d5f5b] uppercase">Bergabung</p>
                <p className="mt-0.5 font-semibold text-[#1b1c1c]">{formatDate(member.join_date)}</p>
              </div>
            )}
            {member?.referral_code && (
              <div className="min-w-0">
                <p className="text-[#5d5f5b] uppercase">Kode Referral</p>
                <p className="mt-0.5 truncate font-semibold text-[#1b1c1c]">{member.referral_code}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-[#34562e]" />
          <h3 className="font-serif text-base font-bold text-[#1b1c1c]">Reward</h3>
        </div>

        {rewards.length === 0 ? (
          <p className="mt-3 text-xs text-[#5d5f5b]">Belum ada reward yang tersedia saat ini.</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {rewards.map((reward) => {
              const affordable = points >= reward.point_cost && !reward.is_expired;
              return (
                <div
                  key={reward.reward_id}
                  className={`flex items-center gap-3 rounded-xl border border-[#c2c8bc]/20 p-3 ${
                    affordable ? 'bg-[#f6f3f2]' : 'bg-[#f0eded] opacity-70'
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#e4e2e1]">
                    {reward.image_url && (
                      <img
                        src={reward.image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-semibold text-[#1b1c1c]">{reward.reward_name}</p>
                    <p className="mt-0.5 text-[11px] text-[#5d5f5b]">
                      {reward.point_cost.toLocaleString('id-ID')} poin
                      {reward.end_date ? ` • s/d ${formatDate(reward.end_date)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      reward.is_expired
                        ? 'bg-red-100 text-red-700'
                        : affordable
                          ? 'bg-[#c7f0bb]/40 text-[#245a0f]'
                          : 'bg-[#eae7e7] text-[#5d5f5b]'
                    }`}
                  >
                    {reward.is_expired ? 'Berakhir' : affordable ? 'Cukup' : 'Kurang poin'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
