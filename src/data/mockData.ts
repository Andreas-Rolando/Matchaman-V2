import { Branch, Category, MenuItem, VoucherDeal } from '../types';

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'br-downtown',
    name: 'Downtown Zen Branch',
    address: '1224 Botanical Way, Urban Oasis, NY 10001',
    distanceKm: 0.8,
    isOpen: true,
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800',
    hours: '08:00 AM - 11:00 PM',
    prepTime: '10 - 15 mins',
    rating: 4.9,
    tag: 'Open',
    lat: -6.2088,
    lng: 106.8456
  },
  {
    id: 'br-central',
    name: 'Central Plaza Branch',
    address: '123 Market St, Downtown',
    distanceKm: 0.8,
    isOpen: true,
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
    hours: '08:00 AM - 10:00 PM',
    prepTime: '10 - 15 mins',
    rating: 4.8,
    tag: 'Open'
  },
  {
    id: 'br-heights',
    name: 'Heights Boutique',
    address: '456 Skyline Ave, The Heights',
    distanceKm: 2.4,
    isOpen: true,
    imageUrl: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&q=80&w=800',
    hours: '09:00 AM - 10:00 PM',
    prepTime: '12 - 18 mins',
    rating: 4.9,
    tag: 'Open'
  },
  {
    id: 'br-riverfront',
    name: 'Riverfront Outlet',
    address: '88 Harbor Walk, Riverfront',
    distanceKm: 4.1,
    isOpen: false,
    imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&q=80&w=800',
    hours: '10:00 AM - 09:00 PM',
    prepTime: '15 - 20 mins',
    rating: 4.6,
    tag: 'Closed'
  },
  {
    id: 'br-westside',
    name: 'Westside Mall',
    address: 'Level 2, Westside Galleria',
    distanceKm: 5.7,
    isOpen: true,
    imageUrl: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&q=80&w=800',
    hours: '10:00 AM - 10:00 PM',
    prepTime: '10 - 15 mins',
    rating: 4.7,
    tag: 'Open'
  }
];

export const CATEGORIES: Category[] = [
  { id: 'cat-starters', name: 'Starters' },
  { id: 'cat-main', name: 'Main Course' },
  { id: 'cat-drinks', name: 'Drinks' },
  { id: 'cat-desserts', name: 'Desserts' },
  { id: 'cat-specials', name: 'Specials' }
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Truffle Parmesan Fries',
    price: 12.50,
    description: 'Crispy skin-on fries tossed in white truffle oil, grated parmesan cheese, and fresh parsley.',
    categoryId: 'cat-starters',
    categoryName: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&q=80&w=600',
    isPopular: false,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-portion',
        name: 'Portion Size',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-reg', name: 'Regular Portion', price: 0 },
          { id: 'opt-large', name: 'Large Portion', price: 2.00 }
        ]
      },
      {
        id: 'mod-dip',
        name: 'Extra Dipping Sauce',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-aioli', name: 'Truffle Aioli', price: 1.50 },
          { id: 'opt-cheese', name: 'Melted Cheddar', price: 1.50 }
        ]
      }
    ]
  },
  {
    id: 'item-2',
    name: 'Spicy Tuna Tartare',
    price: 18.00,
    description: 'Fresh ahi tuna, avocado mousse, cucumber, and sriracha-soy vinaigrette with wonton crisps.',
    categoryId: 'cat-starters',
    categoryName: 'Starters',
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=600',
    isPopular: false,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-spice',
        name: 'Spice Level',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-mild', name: 'Mild Spice', price: 0 },
          { id: 'opt-hot', name: 'Extra Spicy', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'item-3',
    name: 'Classic Margherita',
    price: 16.00,
    description: 'San Marzano tomatoes, buffalo mozzarella, fresh basil, and extra virgin olive oil.',
    categoryId: 'cat-main',
    categoryName: 'Main Course',
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&q=80&w=600',
    isPopular: true,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-crust',
        name: 'Crust Preference',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-thin', name: 'Thin Neapolitan Crust', price: 0 },
          { id: 'opt-cheese-crust', name: 'Stuffed Cheese Crust', price: 3.00 }
        ]
      }
    ]
  },
  {
    id: 'item-4',
    name: 'Signature Wagyu Burger',
    price: 22.00,
    description: '8oz Wagyu beef, sharp cheddar, balsamic onions, and truffle aioli on a brioche bun.',
    categoryId: 'cat-main',
    categoryName: 'Main Course',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
    isPopular: true,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-burger-extras',
        name: 'Customizations',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-cheese', name: 'Extra Cheese', price: 1.50 },
          { id: 'opt-bacon', name: 'Smoked Bacon', price: 2.50 },
          { id: 'opt-no-onion', name: 'No Onions', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'item-5',
    name: 'Ceremonial Matcha Latte',
    price: 6.50,
    description: 'Uji ceremonial grade matcha whisked to perfection with silky oat milk and raw agave nectar.',
    categoryId: 'cat-drinks',
    categoryName: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=600',
    isPopular: true,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-temp',
        name: 'Temperature',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-iced', name: 'Iced', price: 0 },
          { id: 'opt-hot', name: 'Hot Steamed', price: 0 }
        ]
      },
      {
        id: 'mod-sweetness',
        name: 'Sweetness Level',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-100', name: '100% Sweetness', price: 0 },
          { id: 'opt-50', name: '50% Less Sweet', price: 0 },
          { id: 'opt-0', name: 'No Sugar', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'item-6',
    name: 'Passion Fruit Fizz',
    price: 5.50,
    description: 'Refreshing sparkling cooler with fresh passion fruit pulp, mint leaves, and lime juice.',
    categoryId: 'cat-drinks',
    categoryName: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600',
    isPopular: false,
    isAvailable: true,
    modifierGroups: [
      {
        id: 'mod-ice',
        name: 'Ice Level',
        required: false,
        minQty: 0,
        maxQty: 1,
        options: [
          { id: 'opt-reg-ice', name: 'Normal Ice', price: 0 },
          { id: 'opt-less-ice', name: 'Less Ice', price: 0 }
        ]
      }
    ]
  },
  {
    id: 'item-7',
    name: 'Matcha Tiramisu',
    price: 8.50,
    description: 'Layers of matcha soaked ladyfingers and whipped mascarpone dusted with ceremonial green tea powder.',
    categoryId: 'cat-desserts',
    categoryName: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&q=80&w=600',
    isPopular: true,
    isAvailable: true
  },
  {
    id: 'item-8',
    name: 'Cold Brew Coffee',
    price: 4.50,
    description: '12-hour slow steeped specialty single origin beans with clean dark chocolate notes.',
    categoryId: 'cat-drinks',
    categoryName: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=600',
    isPopular: false,
    isAvailable: true
  }
];

export const AVAILABLE_DEALS: VoucherDeal[] = [
  {
    id: 'vouch-1',
    code: 'FREEDEL',
    title: 'Free Delivery',
    description: 'On orders over $30.00',
    discountType: 'free_delivery',
    discountValue: 2.99,
    minOrder: 30.00,
    badgeBg: 'bg-[#3c7327]',
    badgeTextColor: 'text-[#b7f699]'
  },
  {
    id: 'vouch-2',
    code: 'SAVE15',
    title: '15% OFF Sides',
    description: 'Lunch Special Discount',
    discountType: 'percentage',
    discountValue: 15,
    minOrder: 15.00,
    badgeBg: 'bg-[#e0e0db]',
    badgeTextColor: 'text-[#42483f]'
  },
  {
    id: 'vouch-3',
    code: 'SAVE20',
    title: 'Save $5.00',
    description: 'Special Matcha Fan Discount',
    discountType: 'fixed',
    discountValue: 5.00,
    minOrder: 25.00,
    badgeBg: 'bg-[#4b6f44]',
    badgeTextColor: 'text-[#c7f0bb]'
  }
];

export const UPSELL_SUGGESTION: MenuItem = {
  id: 'item-8',
  name: 'Cold Brew Coffee',
  price: 3.50,
  description: '12-hour slow steeped specialty single origin beans with clean dark chocolate notes.',
  categoryId: 'cat-drinks',
  categoryName: 'Drinks',
  imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=600',
  isPopular: false,
  isAvailable: true
};
