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
  minimumSubtotal: number;
  flagMinimumSubtotal: boolean;
  flagInclusive: boolean;
  salesMenus: any[];
  platformFees: any[];
  // Promotion (promotionCode) — ESB reports promo savings here.
  promotionID: number | null;
  promotionCode: string | null;
  promotionDiscount: number;
  // Gift vouchers — a separate mechanism from promotionCode, unused by this app.
  voucherDiscountTotal: number;
  voucherTotal: number;
  vouchers: any[];
}

/** Identity used to look up order history. ESB scopes history to a user token
 *  minted from name + email, so this is what the Account tab needs to have. */
export interface HistoryIdentity {
  fullName: string;
  email: string;
  phone?: string;
}

/** One row from ESB's user order history (POST /v1/user/order), snake_cased by
 *  the proxy to match the rest of this app's API surface. */
export interface OrderHistoryItem {
  order_id: string;
  branch_code: string;
  branch_name: string;
  transaction_date: string;
  order_type: string;
  order_type_name: string;
  grand_total: number;
  total_item: number;
  status: string;
  payment_status: string;
  status_id: number | null;
  queue_num: number | null;
  currency_sign: string;
  image_url?: string;
  refund_status?: string | null;
  is_allow_reorder: boolean;
}

export interface OrderHistoryPagination {
  total_count: number;
  page_count: number;
  current_page: number;
  per_page: number;
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
