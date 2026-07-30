import React from 'react';
import { Store, UtensilsCrossed, ShoppingCart, User } from 'lucide-react';

export type TabType = 'branches' | 'menu' | 'cart' | 'account' | 'checkout' | 'order-summary' | 'branch-detail';

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  cartCount: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  cartCount
}) => {
  // Hide bottom nav on checkout or order summary if desired, or keep navigation clean
  if (activeTab === 'checkout' || activeTab === 'order-summary' || activeTab === 'cart') {
    return null;
  }

  const isMenuGroup = activeTab === 'menu' || activeTab === 'branch-detail';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#c2c8bc]/30 bg-[#ffffff] px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0px_-4px_24px_rgba(0,0,0,0.06)] rounded-t-xl">
      <button
        onClick={() => onTabChange('branches')}
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-90 ${
          activeTab === 'branches'
            ? 'bg-[#34562e] text-white shadow-sm'
            : 'text-[#5d5f5b] hover:bg-[#e0e0db]/30'
        }`}
      >
        <Store className="h-5 w-5" />
        <span className="mt-0.5 text-[11px] font-medium tracking-tight">Home</span>
      </button>

      <button
        onClick={() => onTabChange('menu')}
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-90 ${
          isMenuGroup
            ? 'bg-[#34562e] text-white shadow-sm'
            : 'text-[#5d5f5b] hover:bg-[#e0e0db]/30'
        }`}
      >
        <UtensilsCrossed className="h-5 w-5" />
        <span className="mt-0.5 text-[11px] font-medium tracking-tight">Menu</span>
      </button>

      <button
        onClick={() => onTabChange('cart')}
        className="relative flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-90 text-[#34562e] bg-[#34562e]/10 shadow-sm"
      >
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ba1a1a] px-1 text-[10px] font-bold text-white shadow-sm">
              {cartCount}
            </span>
          )}
        </div>
        <span className="mt-0.5 text-[11px] font-medium tracking-tight">Cart</span>
      </button>

      <button
        onClick={() => onTabChange('account')}
        className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-90 ${
          activeTab === 'account'
            ? 'bg-[#34562e] text-white shadow-sm'
            : 'text-[#5d5f5b] hover:bg-[#e0e0db]/30'
        }`}
      >
        <User className="h-5 w-5" />
        <span className="mt-0.5 text-[11px] font-medium tracking-tight">Account</span>
      </button>
    </nav>
  );
};
