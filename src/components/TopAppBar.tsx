import React from 'react';
import { ArrowLeft, Share, Search, SlidersHorizontal, Map, MoreVertical, Cpu } from 'lucide-react';

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: 'search' | 'share' | 'map' | 'more' | 'none';
  onSearchClick?: () => void;
  onMapClick?: () => void;
  onEsbStatusClick?: () => void;
  esbMode?: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  title = 'Matchaman',
  subtitle,
  showBack = false,
  onBack,
  actions = 'none',
  onSearchClick,
  onMapClick,
  onEsbStatusClick,
  esbMode = 'SANDBOX'
}) => {
  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-[#eae7e7] bg-[#fcf9f8]/90 px-4 shadow-sm backdrop-blur-md transition-all">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#34562e] transition-all hover:bg-[#eae7e7]/60 active:scale-95"
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
        {onEsbStatusClick && (
          <button
            onClick={onEsbStatusClick}
            className="flex items-center gap-1 rounded-full bg-[#4b6f44]/10 px-2.5 py-1 text-[11px] font-semibold text-[#34562e] transition-all hover:bg-[#4b6f44]/20 active:scale-95"
            title="Lihat ESB ESO-QS API Integration Status"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ESB Engine</span>
            <span className="rounded-full bg-[#34562e] px-1.5 py-0.2 text-[9px] text-white">
              {esbMode}
            </span>
          </button>
        )}

        {actions === 'search' && (
          <>
            <button
              onClick={onSearchClick}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              onClick={onSearchClick}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </>
        )}

        {actions === 'share' && (
          <button
            onClick={() => alert('Disalin ke clipboard: Matchaman Zen Cafe Branch')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95"
          >
            <Share className="h-5 w-5" />
          </button>
        )}

        {actions === 'map' && (
          <button
            onClick={onMapClick}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#34562e] hover:bg-[#eae7e7]/60 active:scale-95"
          >
            <Map className="h-5 w-5" />
          </button>
        )}

        {actions === 'more' && (
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#5d5f5b] hover:bg-[#eae7e7]/60 active:scale-95">
            <MoreVertical className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
};
