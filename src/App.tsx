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
  INITIAL_BRANCHES,
  CATEGORIES,
  MENU_ITEMS,
  AVAILABLE_DEALS,
  UPSELL_SUGGESTION,
} from './data/mockData';
import {
  Branch,
  SalesMode,
  MenuItem,
  CartItem,
  CartModifier,
  VoucherDeal,
  Order,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('branches');
  const [branches, setBranches] = useState<Branch[]>(INITIAL_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState<Branch>(INITIAL_BRANCHES[0]);
  const [salesMode, setSalesMode] = useState<SalesMode>('dine_in');

  const [categories] = useState(CATEGORIES);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);

  // Cart state initialized with 2 sample items matching the original mockup design
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      cartItemId: 'sample-1',
      menuItem: MENU_ITEMS[3], // Signature Wagyu Burger
      quantity: 1,
      selectedModifiers: [
        { groupId: 'mod-burger-extras', groupName: 'Customizations', optionId: 'opt-cheese', optionName: 'Extra Cheese', price: 1.50 },
        { groupId: 'mod-burger-extras', groupName: 'Customizations', optionId: 'opt-no-onion', optionName: 'No Onions', price: 0 }
      ],
      unitPrice: 23.50,
      totalPrice: 23.50,
      specialNotes: ''
    },
    {
      cartItemId: 'sample-2',
      menuItem: MENU_ITEMS[0], // Truffle Parmesan Fries
      quantity: 2,
      selectedModifiers: [
        { groupId: 'mod-portion', groupName: 'Portion Size', optionId: 'opt-large', optionName: 'Large Portion', price: 2.00 }
      ],
      unitPrice: 14.50,
      totalPrice: 29.00,
      specialNotes: ''
    }
  ]);

  const [appliedVoucher, setAppliedVoucher] = useState<VoucherDeal | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null);
  const [showEsbModal, setShowEsbModal] = useState(false);
  const [esbMode, setEsbMode] = useState('SANDBOX');

  // Load live ESB outlets and menu from Express server on boot
  useEffect(() => {
    async function loadEsbData() {
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
            distanceKm: o.distance_km || 0.8,
            isOpen: o.is_open,
            imageUrl: o.image_url,
            hours: o.operating_hours || '08:00 AM - 11:00 PM',
            prepTime: o.prep_time_minutes || '10 - 15 mins',
            lat: o.lat,
            lng: o.lng,
          }));
          setBranches(mappedBranches);
        }

        const menuRes = await fetch('/api/esb/menu');
        const menuData = await menuRes.json();
        if (menuData.success && menuData.data.items.length > 0) {
          const mappedItems: MenuItem[] = menuData.data.items.map((i: any) => ({
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
        console.log('Using default mock data', err);
      }
    }

    loadEsbData();
  }, []);

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

  const handleAddUpsell = (upsell: MenuItem) => {
    handleAddToCart(upsell, 1, [], 'Frequently Bought With');
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
          subtitle: selectedBranch.name,
          showBack: true,
          onBack: () => setActiveTab('branches'),
          actions: 'share' as const,
        };
      case 'menu':
        return {
          title: 'Matchaman',
          subtitle: selectedBranch.name,
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
        {activeTab === 'branches' && (
          <BranchListScreen
            branches={branches}
            selectedBranch={selectedBranch}
            onSelectBranch={(branch) => {
              setSelectedBranch(branch);
              setActiveTab('branch-detail');
            }}
          />
        )}

        {activeTab === 'branch-detail' && (
          <BranchDetailScreen
            branch={selectedBranch}
            salesMode={salesMode}
            onSelectSalesMode={(mode) => setSalesMode(mode)}
            onGoToMenu={() => setActiveTab('menu')}
          />
        )}

        {activeTab === 'menu' && (
          <MenuScreen
            categories={categories}
            menuItems={menuItems}
            cartItems={cartItems}
            onOpenItemModal={(item) => setModifierModalItem(item)}
            onUpdateCartItemQty={handleUpdateCartQty}
            onGoToCart={() => setActiveTab('cart')}
            branchName={selectedBranch.name}
          />
        )}

        {activeTab === 'cart' && (
          <CartScreen
            branch={selectedBranch}
            salesMode={salesMode}
            cartItems={cartItems}
            availableDeals={AVAILABLE_DEALS}
            appliedVoucher={appliedVoucher}
            onApplyVoucher={(v) => setAppliedVoucher(v)}
            onUpdateQty={handleUpdateCartQty}
            onRemoveItem={handleRemoveCartItem}
            onAddUpsell={handleAddUpsell}
            upsellItem={UPSELL_SUGGESTION}
            onProceedToCheckout={() => setActiveTab('checkout')}
          />
        )}

        {activeTab === 'checkout' && (
          <CheckoutScreen
            branch={selectedBranch}
            salesMode={salesMode}
            cartItems={cartItems}
            appliedVoucher={appliedVoucher}
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
    </div>
  );
}
