export type SalesMode = 'dine_in' | 'takeaway' | 'delivery' | string;

export interface OrderMode {
  type: string;
  name: string;
  visitPurposeID: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  minQty?: number;
  maxQty?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minQty: number;
  maxQty: number;
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

export interface PaymentOption {
  id: string;
  name: string;
  nameId?: string;
  description?: string;
  needPhoneInput?: boolean;
}

export interface BranchPaymentInfo {
  atCashier: boolean;
  online: PaymentOption[];
  paymentMapping: {
    transactionMode: string;
    allowedPaymentList: string[];
  }[];
  deliveryPayment: boolean;
  deliveryPaymentName?: string;
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
  discountValue: number;
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

export type PaymentMethod = 'credit_card' | 'ewallet' | 'cash' | 'qris' | string;

export interface CalculatedTotal {
  subtotal: number;
  pb1: number;
  additionalTax: number;
  otherVatTotal: number;
  orderFee: number;
  deliveryCost: number;
  originalDeliveryCost: number;
  actualDeliveryCost: number;
  deliveryCostMessage: string | null;
  grandTotal: number;
  roundingTotal: number;
  discountTotal: number;
  voucherDiscountTotal: number;
  minimumSubtotal: number;
  flagMinimumSubtotal: boolean;
  flagInclusive: boolean;
  salesMenus: any[];
  platformFees: any[];
  vouchers: any[];
}

export interface Order {
  id: string;
  orderNumber: string;
  branch: Branch;
  salesMode: SalesMode;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  roundingTotal: number;
  customerInfo: CustomerInfo;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Pending' | 'Berhasil' | 'Gagal';
  createdAt: string;
  esbResponseRef?: string;
  qrString?: string;
  branchCode?: string;
  paymentMethodCode?: string;
}
