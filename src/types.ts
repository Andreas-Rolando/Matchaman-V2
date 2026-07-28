export type SalesMode = 'dine_in' | 'takeaway';

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  maxSelection?: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string;
  isPopular?: boolean;
  isAvailable: boolean;
  modifierGroups?: ModifierGroup[];
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  isOpen: boolean;
  imageUrl: string;
  hours: string;
  prepTime: string;
  rating?: number;
  tag?: string;
  lat?: number;
  lng?: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface CartModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedModifiers: CartModifier[];
  specialNotes?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface VoucherDeal {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_delivery';
  discountValue: number; // percentage e.g. 15 or fixed e.g. 10000
  minOrder: number;
  badgeBg: string;
  badgeTextColor: string;
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  tableNumber?: string;
  address?: string;
  notes?: string;
}

export type PaymentMethod = 'credit_card' | 'ewallet' | 'cash' | 'qris';

export interface Order {
  id: string;
  orderNumber: string; // e.g. #QB-88291
  branch: Branch;
  salesMode: SalesMode;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  appliedVoucherCode?: string;
  tax: number;
  total: number;
  customerInfo: CustomerInfo;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Pending' | 'Berhasil' | 'Gagal';
  createdAt: string;
  esbResponseRef?: string;
}
