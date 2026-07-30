import React, { useState } from 'react';
import { ArrowLeft, Share, Search, Map, MoreVertical, Check } from 'lucide-react';

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: 'search' | 'share' | 'map' | 'more' | 'none';
  onSearchClick?: () => void;
  onMapClick?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  // No brand default: the title is always supplied by the caller from ESB data,
  // and falling back to a hardcoded name would quietly reintroduce exactly the
  // thing this component is meant to stop showing.
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = 'none',
  onSearchClick,
  onMapClick,
}) => {
  const [shared, setShared] = useState(false);

  // This used to pop an alert saying the link had been copied to the clipboard
  // while copying nothing at all — it told the customer something that was not
  // true. Now it actually shares, preferring the native sheet on mobile and
  // falling back to the clipboard, and only confirms once something happened.
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Includes the user dismissing the native share sheet, which is not an
      // error and must not be reported as success.
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-[#eae7e7] bg-[#fcf9f8]/90 px-4 shadow-sm backdrop-blur-md transition-all">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack}
            className="tap-44 flex h-10 w-10 items-center justify-center rounded-full text-[#34562e] transition-all hover:bg-[#eae7e7]/60 active:scale-95"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-serif text-xl font-bold text-[#34562e]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[#5d5f5b]">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions === 'search' && (
            <button
              onClick={onSearchClick}
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
              aria-label="Cari"
            >
              <Search className="h-5 w-5" />
            </button>
        )}

        {actions === 'share' && (
          <button
            onClick={handleShare}
            className={`tap-44 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#eae7e7]/60 active:scale-95 ${
              shared ? 'text-[#34562e]' : 'text-[#5d5f5b]'
            }`}
            aria-label={shared ? 'Link disalin' : 'Bagikan'}
          >
            {shared ? <Check className="h-5 w-5" /> : <Share className="h-5 w-5" />}
          </button>
        )}

        {actions === 'map' && (
          <button
            onClick={onMapClick}
            className="tap-44 flex h-9 w-9 items-center justify-center rounded-full text-[#34562e] hover:bg-[#eae7e7]/60 active:scale-95"
            aria-label="Lihat peta"
          >
            <Map className="h-5 w-5" />
          </button>
        )}

        {actions === 'more' && (
          <button
            className="tap-44 flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
            aria-label="Opsi lainnya"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
};
