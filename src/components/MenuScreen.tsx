import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Minus, ShoppingCart, ArrowRight, X } from 'lucide-react';
import { MenuItem, Category, CartItem } from '../types';

interface MenuScreenProps {
  categories: Category[];
  menuItems: MenuItem[];
  cartItems: CartItem[];
  onOpenItemModal: (item: MenuItem) => void;
  onUpdateCartItemQty: (cartItemId: string, delta: number) => void;
  onGoToCart: () => void;
  branchName: string;
  showSearch: boolean;
  onCloseSearch: () => void;
}

interface MenuItemCardProps {
  item: MenuItem;
  cartQty: number;
  /** First cart line holding this menu item, or null when it is not in the cart. */
  cartItemId: string | null;
  onOpenItemModal: (item: MenuItem) => void;
  onUpdateCartItemQty: (cartItemId: string, delta: number) => void;
}

/**
 * Memoised on purpose. A branch menu runs to ~90 items, and without this every
 * tap of + / - re-rendered all of them because the parent's `cartItems` changed.
 * Now only the one card whose quantity actually moved re-renders — which is what
 * makes holding down the button feel immediate instead of gummy.
 *
 * The memo only holds if the two callbacks keep a stable identity, so they are
 * useCallback'd all the way up in App.tsx. Passing inline arrows here would
 * silently undo it.
 */
const MenuItemCard = React.memo<MenuItemCardProps>(function MenuItemCard({
  item,
  cartQty,
  cartItemId,
  onOpenItemModal,
  onUpdateCartItemQty,
}) {
  const isSoldOut = !item.isAvailable;
  const openModal = () => {
    if (!isSoldOut) onOpenItemModal(item);
  };

  return (
    // The whole card is the hit target, not just the Add button. Kept as a div
    // with an explicit role rather than a <button>, because the quantity
    // controls below are real buttons and nesting those inside a button is
    // invalid markup.
    <div
      onClick={openModal}
      onKeyDown={(e) => {
        if (isSoldOut || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        openModal();
      }}
      role={isSoldOut ? undefined : 'button'}
      tabIndex={isSoldOut ? undefined : 0}
      aria-label={isSoldOut ? undefined : `Tambah ${item.name} ke pesanan`}
      // transition-shadow, not transition-all: `all` makes the compositor watch
      // every animatable property on every card, and that cost is paid on each
      // re-render across the whole grid.
      className={`group flex flex-col overflow-hidden rounded-xl border border-[#f0eded] bg-white shadow-xs transition-shadow duration-300 ${
        isSoldOut
          ? 'opacity-70'
          : 'cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34562e] focus-visible:ring-offset-1'
      }`}
    >
      <div className="flex gap-3.5 p-3.5">
        {/* Image & Popular Badge */}
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#f0eded]">
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-transform duration-500 ${
              isSoldOut ? 'grayscale' : 'group-hover:scale-105'
            }`}
          />
          {isSoldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                Habis
              </span>
            </div>
          ) : (
            item.isPopular && (
              <div className="absolute left-1 top-1 rounded bg-[#34562e] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                Popular
              </div>
            )
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
            <p className="mt-1 line-clamp-2 text-xs text-[#5d5f5b]">{item.description}</p>
          </div>

          <div className="mt-3 flex items-center justify-between">
            {isSoldOut ? (
              <span className="flex h-8 items-center rounded-full bg-[#f0eded] px-4 text-xs font-semibold text-[#5d5f5b]">
                Stok Habis
              </span>
            ) : cartQty > 0 && cartItemId ? (
              // stopPropagation throughout: changing quantity must not also open
              // the modal now that the card itself is clickable.
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 rounded-full bg-[#4b6f44]/10 p-1"
              >
                <button
                  onClick={() => onUpdateCartItemQty(cartItemId, -1)}
                  className="tap-44 flex h-7 w-7 items-center justify-center rounded-full bg-[#34562e] text-white transition-transform active:scale-90"
                  aria-label="Kurangi jumlah"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[16px] text-center font-bold text-xs text-[#1b1c1c]">
                  {cartQty}
                </span>
                <button
                  // Bumps the existing cart line rather than reopening the detail
                  // modal: once the item is in the cart, the modal would only ask
                  // again for choices made a moment ago.
                  onClick={() => onUpdateCartItemQty(cartItemId, 1)}
                  className="tap-44 flex h-7 w-7 items-center justify-center rounded-full bg-[#34562e] text-white transition-transform active:scale-90"
                  aria-label="Tambah jumlah"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenItemModal(item);
                }}
                // Redundant with the card click, but kept as the visible
                // affordance that says the card does something.
                tabIndex={-1}
                className="tap-44 flex h-8 items-center gap-1 rounded-full bg-[#4b6f44] px-4 text-xs font-semibold text-white shadow-xs transition-transform active:scale-95 hover:bg-[#34562e]"
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
});

export const MenuScreen: React.FC<MenuScreenProps> = ({
  categories,
  menuItems,
  cartItems,
  onOpenItemModal,
  onUpdateCartItemQty,
  onGoToCart,
  branchName,
  showSearch,
  onCloseSearch,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!showSearch) {
      setSearchQuery('');
    }
  }, [showSearch]);

  const filteredItems = useMemo(() => {
    const byCategory =
      selectedCategory === 'all'
        ? menuItems
        : menuItems.filter((item) => item.categoryId === selectedCategory);

    const query = searchQuery.trim().toLowerCase();
    return query ? byCategory.filter((item) => item.name.toLowerCase().includes(query)) : byCategory;
  }, [menuItems, selectedCategory, searchQuery]);

  // One pass over the cart, not a filter+reduce per card. With ~90 items on
  // screen this turns O(items x cartLines) on every tap into O(cartLines).
  const cartIndex = useMemo(() => {
    const index = new Map<string, { qty: number; cartItemId: string }>();
    for (const ci of cartItems) {
      const existing = index.get(ci.menuItem.id);
      if (existing) {
        existing.qty += ci.quantity;
      } else {
        // First line wins, so + and - always act on the same one.
        index.set(ci.menuItem.id, { qty: ci.quantity, cartItemId: ci.cartItemId });
      }
    }
    return index;
  }, [cartItems]);

  const { totalCartCount, totalCartPrice } = useMemo(
    () => ({
      totalCartCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      totalCartPrice: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
    }),
    [cartItems]
  );

  return (
    <div className="mx-auto w-full max-w-4xl pb-36 pt-2">
      {/* Category Navigation Pills */}
      <nav className="sticky top-14 z-40 flex items-center gap-2.5 overflow-x-auto bg-[#fcf9f8] px-4 py-3 shadow-xs scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`tap-44 whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold transition-colors ${
            selectedCategory === 'all'
              ? 'bg-[#4b6f44] text-white shadow-xs'
              : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
          }`}
        >
          All
        </button>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(isActive ? 'all' : cat.id)}
              className={`tap-44 whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold transition-colors ${
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

      {/* Search Bar */}
      {showSearch && (
        <div className="sticky top-[7.5rem] z-40 bg-[#fcf9f8] px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl border border-[#c2c8bc] bg-white px-3 py-2 shadow-xs">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu..."
              className="flex-1 bg-transparent text-sm text-[#1b1c1c] outline-none placeholder:text-[#5d5f5b]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="tap-44 text-[#5d5f5b]"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button onClick={onCloseSearch} className="tap-44 text-xs font-semibold text-[#34562e]">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Branch Title Bar */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-[#5d5f5b]">
          Menu dari <span className="font-semibold text-[#34562e]">{branchName}</span>
        </p>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 gap-4 px-4 pt-2 md:grid-cols-2 lg:grid-cols-2">
        {filteredItems.map((item) => {
          const inCart = cartIndex.get(item.id);
          return (
            <MenuItemCard
              key={item.id}
              item={item}
              cartQty={inCart?.qty ?? 0}
              cartItemId={inCart?.cartItemId ?? null}
              onOpenItemModal={onOpenItemModal}
              onUpdateCartItemQty={onUpdateCartItemQty}
            />
          );
        })}
      </div>

      {/* Floating Cart Bar (FAB) */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 mx-auto max-w-2xl">
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
              className="tap-44 flex h-10 items-center gap-1.5 rounded-xl bg-white px-5 text-xs font-bold text-[#34562e] shadow-md transition-transform active:scale-95 hover:bg-[#fcf9f8]"
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
