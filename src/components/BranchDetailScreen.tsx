import React from 'react';
import { MapPin, Clock, Gauge, Utensils, ShoppingBag, ChevronRight, Navigation, Truck } from 'lucide-react';
import { Branch, OrderMode, SalesMode } from '../types';

interface BranchDetailScreenProps {
  branch: Branch;
  salesMode: SalesMode;
  orderModes: OrderMode[];
  onSelectSalesMode: (mode: SalesMode) => void;
  onGoToMenu: () => void;
}

const getModeConfig = (type: string) => {
  switch (type) {
    case 'dineIn':
      return {
        label: 'Dine-in',
        description: 'Experience the tranquility in our lounge',
        icon: Utensils,
        bgClass: 'bg-[#4b6f44]',
        salesMode: 'dine_in' as SalesMode,
      };
    case 'takeAway':
      return {
        label: 'Take Away',
        description: 'Premium matcha on the go',
        icon: ShoppingBag,
        bgClass: 'bg-[#e0e0db]',
        salesMode: 'takeaway' as SalesMode,
      };
    case 'delivery':
      return {
        label: 'Delivery',
        description: 'Delivered fresh to your door',
        icon: Truck,
        bgClass: 'bg-[#3b82f6]',
        salesMode: 'delivery' as SalesMode,
      };
    default:
      return {
        label: type,
        description: `Order via ${type}`,
        icon: ShoppingBag,
        bgClass: 'bg-[#e0e0db]',
        salesMode: type as SalesMode,
      };
  }
};

export const BranchDetailScreen: React.FC<BranchDetailScreenProps> = ({
  branch,
  salesMode,
  orderModes,
  onSelectSalesMode,
  onGoToMenu,
}) => {
  const handleServiceClick = (mode: SalesMode) => {
    onSelectSalesMode(mode);
    onGoToMenu();
  };

  const handleDirections = () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      branch.name + ' ' + branch.address
    )}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-32">
      {/* Hero Image Header */}
      <div className="relative h-60 w-full overflow-hidden md:h-72">
        <img
          src={branch.imageUrl}
          alt={branch.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold text-white shadow-md ${
              branch.isOpen ? 'bg-[#34562e]' : 'bg-[#ba1a1a]'
            }`}
          >
            {branch.isOpen ? 'Open Now' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Branch Details Canvas Card */}
      <div className="relative z-10 -mt-6 px-4">
        <div className="rounded-xl border border-[#e4e2e1] bg-white p-5 shadow-md">
          <h2 className="font-serif text-2xl font-bold text-[#1b1c1c]">
            {branch.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#5d5f5b]">
            <MapPin className="h-4 w-4 shrink-0 text-[#34562e]" />
            <span>{branch.address}</span>
          </p>

          <hr className="my-4 border-[#e4e2e1]" />

          {/* Operational Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#e4e2e1]/60 bg-[#f6f3f2] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#34562e]" />
                <span className="text-xs font-semibold text-[#1b1c1c]">Hours</span>
              </div>
              <p className="text-xs text-[#5d5f5b]">{branch.hours}</p>
            </div>

            <div className="rounded-lg border border-[#e4e2e1]/60 bg-[#f6f3f2] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#34562e]" />
                <span className="text-xs font-semibold text-[#1b1c1c]">Prep Time</span>
              </div>
              <p className="text-xs text-[#5d5f5b]">{branch.prepTime}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Service Selection - Dynamic from API */}
      <div className="mt-6 px-4">
        <h3 className="font-serif text-xl font-bold text-[#1b1c1c]">
          Choose Your Service
        </h3>

        {orderModes.length === 0 ? (
          <p className="mt-3 text-sm text-[#5d5f5b]">No order modes available for this branch.</p>
        ) : (
          <div className={`mt-3 flex flex-col gap-3 ${orderModes.length > 2 ? '' : 'md:grid md:grid-cols-2'}`}>
            {orderModes.map((mode) => {
              const config = getModeConfig(mode.type);
              const Icon = config.icon;
              const isActive = salesMode === config.salesMode;
              return (
                <button
                  key={mode.type}
                  onClick={() => handleServiceClick(config.salesMode)}
                  className={`group flex items-center rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                    isActive
                      ? 'border-[#34562e] bg-[#c7f0bb]/20 shadow-md'
                      : 'border-transparent bg-white shadow-sm hover:border-[#34562e]/30'
                  }`}
                >
                  <div className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${config.bgClass} text-white shadow-sm transition-transform group-hover:scale-105`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif text-lg font-bold text-[#1b1c1c]">
                        {config.label}
                      </h4>
                      {isActive && (
                        <span className="rounded-full bg-[#34562e] px-2 py-0.2 text-[10px] text-white font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5d5f5b]">
                      {config.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#5d5f5b] transition-colors group-hover:text-[#34562e]" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Preview Section */}
      <div className="mt-6 px-4">
        <div className="relative h-48 w-full overflow-hidden rounded-xl border border-[#e4e2e1] bg-[#f0eded]">
          <iframe
            title="Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0, opacity: 0.85 }}
            src={`https://maps.google.com/maps?q=${branch.lat || -6.2088},${
              branch.lng || 106.8456
            }&hl=en&z=14&output=embed`}
            allowFullScreen
          />
          <div className="absolute bottom-3 right-3 z-10">
            <button
              onClick={handleDirections}
              className="tap-44 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#1b1c1c] shadow-md transition-all hover:bg-[#fcf9f8] active:scale-95"
            >
              <Navigation className="h-4 w-4 text-[#34562e]" />
              <span>Get Directions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
