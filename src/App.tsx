import { useState, useEffect } from 'react';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar, TabType } from './components/BottomNavBar';
import { BranchListScreen } from './components/BranchListScreen';
import { BranchDetailScreen } from './components/BranchDetailScreen';
import { MenuScreen } from './components/MenuScreen';
import { ItemModifierModal } from './components/ItemModifierModal';
import { CartScreen } from './components/CartScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { OrderSummaryScreen } from './components/OrderSummaryScreen';
import { EsbEngineModal } from './components/EsbEngineModal';
import {
  Branch,
  BranchPaymentInfo,
  OrderMode,
  SalesMode,
  MenuItem,
  Category,
  CartItem,
  CartModifier,
  VoucherDeal,
  Order,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [salesMode, setSalesMode] = useState<SalesMode>('dine_in');

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherDeal | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [showEsbModal, setShowEsbModal] = useState(false);
  const [esbMode, setEsbMode] = useState('LIVE');
  const [loading, setLoading] = useState(true);
  const [branchPaymentInfo, setBranchPaymentInfo] = useState<BranchPaymentInfo | null>(null);
  const [branchOrderModes, setBranchOrderModes] = useState<OrderMode[]>([]);

  // Load branches from ESB API on boot
  useEffect(() => {
    async function loadBranches() {
      try {
        const configRes = await fetch('/api/esb/config');
        const configData = await configRes.json();
        setEsbMode(configData.mode === 'LIVE_API' ? 'LIVE' : 'SANDBOX');

        const outletsRes = await fetch('/api/esb/outlets');
        const outletsData = await outletsRes.json();
        if (outletsData.success && outletsData.data.length > 0) {
          const mappedBranches: Branch[] = outletsData.data.map((o: any) => ({
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
          setBranches(mappedBranches);
          if (mappedBranches.length > 0) {
            setSelectedBranch(mappedBranches[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBranches();
  }, []);

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

  // Load menu when branch is selected
  useEffect(() => {
    if (!selectedBranch) return;

    async function loadMenu() {
      try {
        const menuRes = await fetch(`/api/esb/menu?branchCode=${selectedBranch!.id}`);
        const menuData = await menuRes.json();
        if (menuData.success) {
          const mappedCategories: Category[] = (menuData.data.categories || []).map((c: any) => ({
            id: c.category_id || c.id || c.categoryID,
            name: c.category_name || c.name || c.categoryName || 'Unknown',
          }));
          setCategories(mappedCategories);
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
        }
      } catch (err) {
        console.error('Failed to load menu:', err);
      }
    }
    loadMenu();
  }, [selectedBranch]);

  // Load branch detail (payment info + order modes) when branch is selected
  useEffect(() => {
    if (!selectedBranch) return;

    async function loadBranchDetail() {
      try {
        const res = await fetch(`/api/esb/outlets/${selectedBranch!.id}`);
        const data = await res.json();
        if (data.success && data.data.payment) {
          setBranchPaymentInfo(data.data.payment);
        }
        if (data.success && data.data.available_sales_modes) {
          setBranchOrderModes(data.data.available_sales_modes);
        }
      } catch (err) {
        console.error('Failed to load branch detail:', err);
      }
    }
    loadBranchDetail();
  }, [selectedBranch]);

  // Cart operations
  const handleAddToCart = (
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
  };

  const handleUpdateCartQty = (cartItemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((ci) => {
          if (ci.cartItemId === cartItemId) {
            const nextQty = ci.quantity + delta;
            if (nextQty <= 0) return null;
            return {
              ...ci,
              quantity: nextQty,
              totalPrice: ci.unitPrice * nextQty,
            };
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartItemId !== cartItemId));
  };

  // Header Title & Action Mapping
  const getHeaderProps = () => {
    switch (activeTab) {
      case 'branches':
        return {
          title: 'Matchaman',
          subtitle: 'Cabang & Lokasi',
          showBack: false,
          actions: 'search' as const,
        };
      case 'branch-detail':
        return {
          title: 'Matchaman',
          subtitle: selectedBranch?.name || '',
          showBack: true,
          onBack: () => setActiveTab('branches'),
          actions: 'share' as const,
        };
      case 'menu':
        return {
          title: 'Matchaman',
          subtitle: selectedBranch?.name || '',
          showBack: true,
          onBack: () => setActiveTab('branches'),
          actions: 'search' as const,
        };
      case 'cart':
        return {
          title: 'Matchaman',
          subtitle: 'Your Cart',
          showBack: true,
          onBack: () => setActiveTab('menu'),
          actions: 'none' as const,
        };
      case 'checkout':
        return {
          title: 'Matchaman',
          subtitle: 'Checkout Order',
          showBack: true,
          onBack: () => setActiveTab('cart'),
          actions: 'none' as const,
        };
      case 'order-summary':
        return {
          title: 'Matchaman',
          subtitle: 'Order Summary',
          showBack: false,
          actions: 'none' as const,
        };
      case 'account':
        return {
          title: 'Matchaman',
          subtitle: 'User Profile & Settings',
          showBack: false,
          actions: 'none' as const,
        };
      default:
        return {
          title: 'Matchaman',
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

      {!loading && (
        <>
          {/* Top Application Bar */}
          <TopAppBar
        title={headerProps.title}
        subtitle={headerProps.subtitle}
        showBack={headerProps.showBack}
        onBack={headerProps.onBack}
        actions={headerProps.actions}
        onSearchClick={() => setActiveTab('branches')}
        onEsbStatusClick={() => setShowEsbModal(true)}
        esbMode={esbMode}
      />

      {/* Main Screen Content */}
      <main className="min-h-[calc(100vh-3.5rem)]">
        {activeTab === 'branches' && branches.length > 0 && (
          <BranchListScreen
            branches={branches}
            selectedBranch={selectedBranch ?? branches[0]}
            onSelectBranch={(branch) => {
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
            onOpenItemModal={(item) => setModifierModalItem(item)}
            onUpdateCartItemQty={handleUpdateCartQty}
            onGoToCart={() => setActiveTab('cart')}
            branchName={selectedBranch?.name || ''}
          />
        )}

        {activeTab === 'cart' && selectedBranch && (
          <CartScreen
            branch={selectedBranch}
            salesMode={salesMode}
            cartItems={cartItems}
            availableDeals={[]}
            appliedVoucher={appliedVoucher}
            onApplyVoucher={(v) => setAppliedVoucher(v)}
            onUpdateQty={handleUpdateCartQty}
            onRemoveItem={handleRemoveCartItem}
            onAddUpsell={() => {}}
            upsellItem={null}
            onProceedToCheckout={() => setActiveTab('checkout')}
          />
        )}

        {activeTab === 'checkout' && selectedBranch && (
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
            onBackToCart={() => setActiveTab('cart')}
          />
        )}

        {activeTab === 'order-summary' && (
          <OrderSummaryScreen
            order={activeOrder}
            onNewOrder={() => {
              setActiveOrder(null);
              setActiveTab('menu');
            }}
          />
        )}

        {activeTab === 'account' && (
          <div className="mx-auto max-w-xl px-4 py-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#34562e] text-white">
              <span className="font-serif text-2xl font-bold">AR</span>
            </div>
            <h2 className="mt-4 font-serif text-xl font-bold">Andreas Rolando</h2>
            <p className="text-xs text-[#5d5f5b]">andreas.rolando@esb.co.id</p>
            <div className="mt-6 rounded-xl border border-[#eae7e7] bg-white p-4 text-left shadow-xs">
              <h3 className="font-serif text-sm font-bold text-[#34562e]">
                Matchaman Zen Loyalty Program
              </h3>
              <p className="mt-1 text-xs text-[#5d5f5b]">
                Poin Kamu: <strong>1,240 Zen Points</strong> (Setara Rp 12.400)
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Item Modifier Customization Modal */}
      <ItemModifierModal
        item={modifierModalItem}
        onClose={() => setModifierModalItem(null)}
        onAddToCart={handleAddToCart}
      />

      {/* ESB ESO-QS Engine Status Modal */}
      <EsbEngineModal
        isOpen={showEsbModal}
        onClose={() => setShowEsbModal(false)}
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
