import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar, TabType } from './components/BottomNavBar';
import { BranchListScreen } from './components/BranchListScreen';
import { BranchDetailScreen } from './components/BranchDetailScreen';
import { MenuScreen } from './components/MenuScreen';
import { ItemModifierModal } from './components/ItemModifierModal';
import {
  Branch,
  BranchPaymentInfo,
  OrderMode,
  SalesMode,
  MenuItem,
  CartItem,
  CartModifier,
  VoucherDeal,
  Order,
  HistoryIdentity,
} from './types';

// The three screens at the end of the funnel. Every visitor loads the branch
// list; far fewer reach checkout, and each of these is entered through an
// explicit tap that gives the chunk time to arrive. ItemModifierModal is
// deliberately NOT here — it opens on the single most-tapped control in the
// app, where a network hop would be felt.
const HistoryScreen = lazy(() => import('./components/HistoryScreen').then(m => ({ default: m.HistoryScreen })));
const CartScreen = lazy(() => import('./components/CartScreen').then(m => ({ default: m.CartScreen })));
const CheckoutScreen = lazy(() => import('./components/CheckoutScreen').then(m => ({ default: m.CheckoutScreen })));
const OrderSummaryScreen = lazy(() => import('./components/OrderSummaryScreen').then(m => ({ default: m.OrderSummaryScreen })));

// Stable identity: a fresh [] on every render would break memoisation in every
// child that takes orderModes as a dependency.
const NO_ORDER_MODES: OrderMode[] = [];

// ESB names its order modes dineIn/takeAway/delivery; this app's SalesMode is
// snake_case. Anything else ESB returns (it also emits "custom") passes through.
const ESB_MODE_TO_SALES_MODE: Record<string, string> = {
  dineIn: 'dine_in',
  takeAway: 'takeaway',
  delivery: 'delivery',
};
const toSalesMode = (esbType: string): SalesMode => ESB_MODE_TO_SALES_MODE[esbType] || esbType;

// There is no login in this app, so the Account tab remembers who ordered on
// this device and uses that to look up history. Deliberately localStorage and
// not sessionStorage: the point is to still be there on the next visit.
const IDENTITY_KEY = 'matchaman:identity';

function readIdentity(): HistoryIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.fullName && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

const ScreenFallback = (
  <div className="flex min-h-screen items-center justify-center">
    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#eae7e7] border-t-[#34562e]"></div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [salesMode, setSalesMode] = useState<SalesMode>('dine_in');

  // Reported by ESB on the branch-list response. Nothing is hardcoded in the
  // header, so this is the only thing standing between the app and a blank
  // title bar — see headerTitle below for the fallback chain.
  const [companyName, setCompanyName] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return menuItems
      .filter((item) => {
        if (seen.has(item.categoryId)) return false;
        seen.add(item.categoryId);
        return true;
      })
      .map((item) => ({ id: item.categoryId, name: item.categoryName }));
  }, [menuItems]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherDeal | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Kept as one branch-keyed record rather than two loose pieces of state, so
  // the menu effect below can tell "not loaded yet" apart from "loaded, but for
  // the branch we just navigated away from".
  const [branchDetail, setBranchDetail] = useState<{
    branchId: string;
    payment: BranchPaymentInfo | null;
    modes: OrderMode[];
  } | null>(null);
  const branchPaymentInfo = branchDetail?.payment ?? null;
  const branchOrderModes = branchDetail?.modes ?? NO_ORDER_MODES;

  const [historyIdentity, setHistoryIdentity] = useState<HistoryIdentity | null>(readIdentity);

  const saveIdentity = useCallback((identity: HistoryIdentity) => {
    setHistoryIdentity(identity);
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    } catch {
      // Private mode or a full quota — the tab still works for this session.
    }
  }, []);

  const [availableDeals, setAvailableDeals] = useState<VoucherDeal[]>([]);
  const [showMenuSearch, setShowMenuSearch] = useState(false);

  // Load branches from ESB API on boot
  const loadBranches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const outletsRes = await fetch('/api/esb/outlets');
      const outletsData = await outletsRes.json();

      if (!outletsData.success) {
        setLoadError(outletsData.error || 'Gagal memuat daftar cabang.');
        return;
      }

      setCompanyName(outletsData.company?.name || outletsData.company?.code || '');

      const mappedBranches: Branch[] = (outletsData.data || []).map((o: any) => ({
        id: o.outlet_id,
        name: o.outlet_name,
        address: o.address,
        distanceKm: o.distance_km || 0,
        isOpen: o.is_open,
        imageUrl: o.image_url,
        hours: o.operating_hours || '08:00 AM - 11:00 PM',
        prepTime: o.prep_time_minutes || '10 - 15 mins',
        lat: o.lat,
        lng: o.lng,
      }));

      if (mappedBranches.length === 0) {
        setLoadError('Belum ada cabang yang tersedia saat ini.');
        return;
      }

      setBranches(mappedBranches);
      setSelectedBranch(mappedBranches[0]);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setLoadError('Tidak dapat menghubungi server. Periksa koneksi kamu lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Remember who ordered, so the Account tab can pull their history without a
  // login. Keyed off activeOrder rather than the checkout callback so it also
  // covers an order restored after the payment-gateway redirect.
  useEffect(() => {
    const info = activeOrder?.customerInfo;
    if (!info?.fullName || !info?.email) return;
    saveIdentity({ fullName: info.fullName, email: info.email, phone: info.phone });
  }, [activeOrder, saveIdentity]);

  // Restore pending order from sessionStorage (after payment redirect)
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingOrder');
    if (pending) {
      try {
        const order: Order = JSON.parse(pending);
        sessionStorage.removeItem('pendingOrder');
        setActiveOrder(order);
        setActiveTab('order-summary');
      } catch (e) {
        sessionStorage.removeItem('pendingOrder');
      }
    }
  }, []);

  // Branch detail: payment info + order modes. Depends on the branch only —
  // switching sales mode used to refetch this too, for a response that cannot
  // differ.
  useEffect(() => {
    if (!selectedBranch) return;
    const branch = selectedBranch;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/esb/outlets/${branch.id}`);
        const data = await res.json();
        if (cancelled) return;
        setBranchDetail({
          branchId: branch.id,
          payment: data.success && data.data.payment ? data.data.payment : null,
          modes: data.success && data.data.available_sales_modes ? data.data.available_sales_modes : [],
        });
      } catch (err) {
        console.error('Failed to load branch detail:', err);
        if (!cancelled) setBranchDetail({ branchId: branch.id, payment: null, modes: [] });
      }
    })();

    return () => { cancelled = true; };
  }, [selectedBranch]);

  // Keep salesMode on a mode the branch actually offers.
  //
  // salesMode defaults to 'dine_in', but the branch auto-selected on boot need
  // not support it — several ESB branches are delivery-only. Reaching the menu
  // without passing through the branch-detail screen (Account -> "Lihat Menu",
  // or the bottom nav) leaves the mismatch in place: the menu then loads under
  // whichever mode the server fallback happens to pick, while checkout still
  // submits orderType 'dineIn' and a visitPurposeID borrowed from a different
  // mode. Reconcile as soon as the branch's real modes are known.
  useEffect(() => {
    if (!selectedBranch || branchDetail?.branchId !== selectedBranch.id) return;
    const supported = branchDetail.modes.map((m) => toSalesMode(m.type));
    if (supported.length === 0 || supported.includes(salesMode)) return;
    console.warn(
      `[branch] ${selectedBranch.id} does not offer "${salesMode}"; switching to "${supported[0]}"`
    );
    setSalesMode(supported[0]);
  }, [branchDetail, selectedBranch, salesMode]);

  // Menu + promotions, which do depend on the sales mode. Gated on the detail
  // belonging to this branch so it never runs with the previous branch's modes.
  useEffect(() => {
    if (!selectedBranch || branchDetail?.branchId !== selectedBranch.id) return;
    const branch = selectedBranch;
    const modes = branchDetail.modes;
    let cancelled = false;

    async function loadMenuAndPromotions() {
      try {
        // Step 2: determine visitPurposeID from the current salesMode
        const mode = modes.find((m) => toSalesMode(m.type) === salesMode);
        const visitPurposeID = mode?.visitPurposeID;

        // Step 3 & 4: fetch promotions and menu in parallel
        const menuUrl = visitPurposeID
          ? `/api/esb/menu?branchCode=${branch.id}&visitPurposeID=${visitPurposeID}`
          : `/api/esb/menu?branchCode=${branch.id}`;

        const [promoResult, menuResult] = await Promise.all([
          visitPurposeID
            ? fetch('/api/esb/promotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branchCode: branch.id, visitPurposeID }),
              }).catch(() => null)
            : Promise.resolve(null),
          fetch(menuUrl).catch(() => null),
        ]);

        if (cancelled) return;

        // Process promo result
        if (promoResult && promoResult.ok) {
          try {
            const promoData = await promoResult.json();
            if (promoData.success && Array.isArray(promoData.data)) {
              setAvailableDeals(promoData.data.map((p: any) => ({
                id: String(p.promotionID),
                code: p.promotionCode || '',
                title: p.notes || p.promotionCode || 'Promo',
                description: p.notes || '',
                discountType: p.promotionTypeID === 6
                  ? 'fixed' as const
                  : p.promotionTypeID === 5 || p.promotionTypeID === 10
                    ? 'percentage' as const
                    : 'fixed' as const,
                discountValue: p.discount || 0,
                minOrder: p.minSubtotal || 0,
                badgeBg: '#4b6f44',
                badgeTextColor: '#ffffff',
              })));
            }
          } catch (e) {
            console.error('Failed to parse promotions:', e);
          }
        }

        // Process menu result
        let menuLoaded = false;
        if (menuResult && menuResult.ok) {
          try {
            const menuData = await menuResult.json();
            if (menuData.success) {
              const mappedItems: MenuItem[] = (menuData.data.items || []).map((i: any) => ({
                id: i.item_id,
                name: i.item_name,
                price: i.price,
                description: i.description,
                categoryId: i.category_id,
                categoryName: i.category_name,
                imageUrl: i.image_url,
                isPopular: i.is_popular,
                isAvailable: i.is_available,
                modifierGroups: i.modifier_groups?.map((mg: any) => ({
                  id: mg.group_id,
                  name: mg.group_name,
                  required: mg.is_required,
                  minQty: mg.min_qty ?? 0,
                  maxQty: mg.max_qty ?? 1,
                  options: mg.options.map((o: any) => ({
                    id: o.option_id,
                    name: o.option_name,
                    price: o.price,
                  })),
                })),
              }));
              setMenuItems(mappedItems);
              menuLoaded = true;
            }
          } catch (e) {
            console.error('Failed to parse menu:', e);
          }
        }

        // Never leave the previous branch's menu on screen under this branch's
        // name. An empty menu is visibly wrong; someone else's menu is worse —
        // adding those items produces an order carrying this branch's code with
        // menuIDs that don't exist here.
        if (!menuLoaded) {
          console.error(`Menu could not be loaded for branch ${branch.id}`);
          setMenuItems([]);
        }
      } catch (err) {
        console.error('Failed to load menu or promotions:', err);
        if (!cancelled) setMenuItems([]);
      }
    }
    loadMenuAndPromotions();

    // Switching branches fast would otherwise let an older response land last
    // and paint the wrong branch's menu.
    return () => { cancelled = true; };
  }, [selectedBranch, salesMode, branchDetail]);

  // Cart operations.
  //
  // These are useCallback'd because MenuScreen's item cards are React.memo'd —
  // a fresh function identity on every render would defeat the memo and put all
  // ~90 cards back into every re-render, which is what made holding + / - lag.
  const handleAddToCart = useCallback((
    item: MenuItem,
    quantity: number,
    selectedModifiers: CartModifier[],
    specialNotes: string
  ) => {
    const modifiersTotal = selectedModifiers.reduce((s, m) => s + m.price, 0);
    const unitPrice = item.price + modifiersTotal;
    const totalPrice = unitPrice * quantity;

    const newItem: CartItem = {
      cartItemId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      menuItem: item,
      quantity,
      selectedModifiers,
      specialNotes,
      unitPrice,
      totalPrice,
    };

    setCartItems((prev) => [...prev, newItem]);
  }, []);

  const handleUpdateCartQty = useCallback((cartItemId: string, delta: number) => {
    setCartItems((prev) => {
      let changed = false;
      const next = prev
        .map((ci) => {
          if (ci.cartItemId !== cartItemId) return ci;
          changed = true;
          const nextQty = ci.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...ci,
            quantity: nextQty,
            totalPrice: ci.unitPrice * nextQty,
          };
        })
        .filter(Boolean) as CartItem[];
      // Same array back when nothing matched, so a stray tap on a line that has
      // already gone doesn't push a pointless render through the whole tree.
      return changed ? next : prev;
    });
  }, []);

  const handleRemoveCartItem = useCallback((cartItemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartItemId !== cartItemId));
  }, []);

  // Same reason as the cart handlers: these are props of the memoised menu
  // cards, so they must not be inline arrows.
  const openItemModal = useCallback((item: MenuItem) => setModifierModalItem(item), []);
  const goToCart = useCallback(() => setActiveTab('cart'), []);

  // Header Title & Action Mapping
  const getHeaderProps = () => {
    // Nothing here is hardcoded to a brand. The branch list is the one screen
    // that is not about a single outlet, so it carries the company; every
    // branch-scoped screen carries the outlet the customer is actually in.
    //
    // Each falls back to the other rather than to an empty bar: the company
    // name arrives with the branch list and a branch may not be chosen yet.
    const company = companyName || selectedBranch?.name || '';
    const branch = selectedBranch?.name || companyName || '';

    switch (activeTab) {
      case 'branches':
        return {
          title: company,
          subtitle: 'Cabang & Lokasi',
          showBack: false,
          actions: 'search' as const,
        };
      case 'branch-detail':
        return {
          title: branch,
          subtitle: 'Detail Cabang',
          showBack: true,
          onBack: () => setActiveTab('branches'),
          actions: 'share' as const,
        };
      case 'menu':
        return {
          title: branch,
          subtitle: 'Menu',
          showBack: true,
          onBack: () => {
            setCartItems([]);
            setActiveTab('branches');
          },
          actions: 'search' as const,
        };
      case 'cart':
        return {
          title: branch,
          subtitle: 'Your Cart',
          showBack: true,
          onBack: () => setActiveTab('menu'),
          actions: 'none' as const,
        };
      case 'checkout':
        return {
          title: branch,
          subtitle: 'Checkout Order',
          showBack: true,
          onBack: () => setActiveTab('cart'),
          actions: 'none' as const,
        };
      case 'order-summary':
        return {
          // The order's own branch, not the selected one. After the payment
          // redirect the order is restored from sessionStorage while
          // selectedBranch has reset to whichever branch the app auto-picked
          // on boot — showing that one would name the wrong outlet on a
          // receipt.
          title: activeOrder?.branch?.name || branch,
          subtitle: 'Order Summary',
          showBack: false,
          actions: 'none' as const,
        };
      case 'account':
        return {
          // Deliberately the company: order history spans every branch this
          // customer has ordered from, so naming one outlet would be wrong.
          title: company,
          subtitle: 'Riwayat Pesanan',
          showBack: false,
          actions: 'none' as const,
        };
      default:
        return {
          title: company,
          showBack: false,
          actions: 'none' as const,
        };
    }
  };

  const headerProps = getHeaderProps();
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1b1c1c] antialiased">
      {/* Loading State */}
      {loading && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#eae7e7] border-t-[#34562e]"></div>
            <p className="mt-4 text-sm text-[#5d5f5b]">Loading branches...</p>
          </div>
        </div>
      )}

      {/* Boot failure — without this the app renders an empty <main> forever */}
      {!loading && loadError && (
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ffdad6] text-[#93000a]">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-serif text-xl font-bold text-[#1b1c1c]">
              Gagal Memuat Cabang
            </h2>
            <p className="mt-2 text-sm text-[#5d5f5b]">{loadError}</p>
            <button
              onClick={loadBranches}
              className="tap-44 mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34562e] px-6 text-sm font-semibold text-white shadow-md transition-all active:scale-95 hover:bg-[#012202]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Top Application Bar */}
          <TopAppBar
        title={headerProps.title}
        subtitle={headerProps.subtitle}
        showBack={headerProps.showBack}
        onBack={headerProps.onBack}
        actions={headerProps.actions}
          onSearchClick={() => {
            if (activeTab === 'menu') {
              setShowMenuSearch((s) => !s);
            }
          }}
        />

      {/* Main Screen Content */}
      <main className="min-h-[calc(100vh-3.5rem)]">
        {activeTab === 'branches' && branches.length > 0 && (
          <BranchListScreen
            branches={branches}
            selectedBranch={selectedBranch ?? branches[0]}
            onSelectBranch={(branch) => {
              setCartItems([]);
              setSelectedBranch(branch);
              setActiveTab('branch-detail');
            }}
          />
        )}

        {activeTab === 'branch-detail' && selectedBranch && (
          <BranchDetailScreen
            branch={selectedBranch}
            salesMode={salesMode}
            orderModes={branchOrderModes}
            onSelectSalesMode={(mode) => setSalesMode(mode)}
            onGoToMenu={() => setActiveTab('menu')}
          />
        )}

        {activeTab === 'menu' && selectedBranch && (
          <MenuScreen
            categories={categories}
            menuItems={menuItems}
            cartItems={cartItems}
            onOpenItemModal={openItemModal}
            onUpdateCartItemQty={handleUpdateCartQty}
            onGoToCart={goToCart}
            branchName={selectedBranch?.name || ''}
            showSearch={showMenuSearch}
            onCloseSearch={() => setShowMenuSearch(false)}
          />
        )}

        {activeTab === 'cart' && selectedBranch && (
          <Suspense fallback={ScreenFallback}>
            <CartScreen
              branch={selectedBranch}
              salesMode={salesMode}
              cartItems={cartItems}
              availableDeals={availableDeals}
              appliedVoucher={appliedVoucher}
              onApplyVoucher={(v) => setAppliedVoucher(v)}
              onUpdateQty={handleUpdateCartQty}
              onRemoveItem={handleRemoveCartItem}
              onProceedToCheckout={() => setActiveTab('checkout')}
            />
          </Suspense>
        )}

        {activeTab === 'checkout' && selectedBranch && (
          <Suspense fallback={ScreenFallback}>
            <CheckoutScreen
              branch={selectedBranch}
              salesMode={salesMode}
              cartItems={cartItems}
              appliedVoucher={appliedVoucher}
              paymentInfo={branchPaymentInfo}
              orderModes={branchOrderModes}
              onOrderPlaced={(order) => {
                setActiveOrder(order);
                setCartItems([]);
                setAppliedVoucher(null);
                setActiveTab('order-summary');
              }}
            />
          </Suspense>
        )}

        {activeTab === 'order-summary' && (
          <Suspense fallback={ScreenFallback}>
            <OrderSummaryScreen
              order={activeOrder}
              companyName={companyName}
              onNewOrder={() => {
                setActiveOrder(null);
                setActiveTab('menu');
              }}
            />
          </Suspense>
        )}

        {activeTab === 'account' && (
          <Suspense fallback={ScreenFallback}>
            <HistoryScreen
              identity={historyIdentity}
              branchCode={selectedBranch?.id || branches[0]?.id || ''}
              onBrowseMenu={() => setActiveTab('menu')}
            />
          </Suspense>
        )}
      </main>

      {/* Item Modifier Customization Modal */}
      <ItemModifierModal
        item={modifierModalItem}
        onClose={() => setModifierModalItem(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Global Fixed Bottom Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        cartCount={totalCartCount}
      />
        </>
      )}
    </div>
  );
}
