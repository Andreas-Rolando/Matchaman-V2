import React from 'react';
import { ArrowLeft, Share, Search, Map, MoreVertical } from 'lucide-react';

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
  title = 'Matchaman',
  subtitle,
  showBack = false,
  onBack,
  actions = 'none',
  onSearchClick,
  onMapClick,
}) => {
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
            onClick={() => alert('Disalin ke clipboard: Matchaman Zen Cafe Branch')}
            className="tap-44 flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
            aria-label="Bagikan"
          >
            <Share className="h-5 w-5" />
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
