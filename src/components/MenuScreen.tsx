import React, { useState } from 'react';
import { Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react';
import { MenuItem, Category, CartItem } from '../types';

interface MenuScreenProps {
  categories: Category[];
  menuItems: MenuItem[];
  cartItems: CartItem[];
  onOpenItemModal: (item: MenuItem) => void;
  onUpdateCartItemQty: (cartItemId: string, delta: number) => void;
  onGoToCart: () => void;
  branchName: string;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  categories,
  menuItems,
  cartItems,
  onOpenItemModal,
  onUpdateCartItemQty,
  onGoToCart,
  branchName,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter((item) => item.categoryId === selectedCategory);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

  // Helper to find existing cart item for simple quantity controls
  const getItemCartQuantity = (menuItemId: string) => {
    return cartItems
      .filter((ci) => ci.menuItem.id === menuItemId)
      .reduce((sum, ci) => sum + ci.quantity, 0);
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-36 pt-2">
      {/* Category Navigation Pills */}
      <nav className="sticky top-14 z-40 flex items-center gap-2.5 overflow-x-auto bg-[#fcf9f8] px-4 py-3 shadow-xs scrollbar-none">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#4b6f44] text-white shadow-xs'
                  : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* Branch Title Bar */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-[#5d5f5b]">
          Menu dari <span className="font-semibold text-[#34562e]">{branchName}</span>
        </p>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 gap-4 px-4 pt-2 md:grid-cols-2 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const cartQty = getItemCartQuantity(item.id);

          return (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-[#f0eded] bg-white shadow-xs transition-all duration-300 hover:shadow-md"
            >
              <div className="flex gap-3.5 p-3.5">
                {/* Image & Popular Badge */}
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#f0eded]">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {item.isPopular && (
                    <div className="absolute left-1 top-1 rounded bg-[#34562e] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      Popular
                    </div>
                  )}
                </div>

                {/* Details & Actions */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-serif text-base font-bold text-[#1b1c1c] truncate pr-2">
                        {item.name}
                      </h3>
                      <span className="font-serif text-base font-bold text-[#34562e] flex-shrink-0">
                        Rp{item.price.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[#5d5f5b]">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    {cartQty > 0 ? (
                      <div className="flex items-center gap-2 rounded-full bg-[#4b6f44]/10 p-1">
                        <button
                          onClick={() => {
                            const matching = cartItems.find((ci) => ci.menuItem.id === item.id);
                            if (matching) {
                              onUpdateCartItemQty(matching.cartItemId, -1);
                            }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#34562e] text-white active:scale-90"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[16px] text-center font-bold text-xs text-[#1b1c1c]">
                          {cartQty}
                        </span>
                        <button
                          onClick={() => onOpenItemModal(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#34562e] text-white active:scale-90"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onOpenItemModal(item)}
                        className="flex h-8 items-center gap-1 rounded-full bg-[#4b6f44] px-4 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 hover:bg-[#34562e]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Cart Bar (FAB) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-2xl">
          <div className="flex items-center justify-between rounded-2xl border border-[#34562e]/20 bg-[#4b6f44] p-3.5 text-white shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold">
                  {totalCartCount} item{totalCartCount > 1 ? 's' : ''} in cart
                </p>
                <p className="text-sm font-bold text-[#c7f0bb]">
                  Total: Rp{totalCartPrice.toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <button
              onClick={onGoToCart}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-5 text-xs font-bold text-[#34562e] shadow-md transition-all active:scale-95 hover:bg-[#fcf9f8]"
            >
              <span>View Cart</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
