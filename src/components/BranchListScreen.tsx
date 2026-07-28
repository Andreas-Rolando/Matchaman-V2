import React, { useState } from 'react';
import { Search, MapPin, Navigation, Sparkles, Map as MapIcon, ChevronRight } from 'lucide-react';
import { Branch } from '../types';

interface BranchListScreenProps {
  branches: Branch[];
  selectedBranch: Branch;
  onSelectBranch: (branch: Branch) => void;
}

export const BranchListScreen: React.FC<BranchListScreenProps> = ({
  branches,
  selectedBranch,
  onSelectBranch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<'all' | 'near' | 'popular' | 'top'>('all');

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTag === 'near') return b.distanceKm <= 3.0;
    if (filterTag === 'popular') return (b.rating || 4.5) >= 4.8;
    if (filterTag === 'top') return b.isOpen;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-3">
      {/* Search & Filter Header */}
      <section className="sticky top-14 z-40 bg-[#fcf9f8]/95 py-2 backdrop-blur-sm">
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5d5f5b]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search branches..."
              className="h-11 w-full rounded-xl border border-[#c2c8bc]/60 bg-white pl-10 pr-4 font-sans text-sm text-[#1b1c1c] outline-none transition-all focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilterTag('all')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                filterTag === 'all'
                  ? 'bg-[#34562e] text-white shadow-sm'
                  : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
              }`}
            >
              All Branches
            </button>
            <button
              onClick={() => setFilterTag('near')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                filterTag === 'near'
                  ? 'bg-[#34562e] text-white shadow-sm'
                  : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
              }`}
            >
              Near Me
            </button>
            <button
              onClick={() => setFilterTag('popular')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                filterTag === 'popular'
                  ? 'bg-[#34562e] text-white shadow-sm'
                  : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => setFilterTag('top')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                filterTag === 'top'
                  ? 'bg-[#34562e] text-white shadow-sm'
                  : 'bg-[#eae7e7] text-[#42483f] hover:bg-[#e0e0db]'
              }`}
            >
              Open Now
            </button>
          </div>
        </div>
      </section>

      {/* Selected Active Branch Notification Banner */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#4b6f44]/20 bg-[#c7f0bb]/30 p-3 text-xs text-[#012202]">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#34562e]" />
          <div>
            <span className="font-semibold text-[#34562e]">Selected Branch: </span>
            <span>{selectedBranch.name}</span>
          </div>
        </div>
        <span className="rounded-full bg-[#34562e] px-2 py-0.5 text-[10px] font-bold text-white">
          Active
        </span>
      </div>

      {/* Branch Cards List */}
      <section className="mt-4 flex flex-col gap-3">
        {filteredBranches.map((branch) => {
          const isSelected = selectedBranch.id === branch.id;
          return (
            <div
              key={branch.id}
              onClick={() => onSelectBranch(branch)}
              className={`group cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 active:scale-[0.99] ${
                isSelected
                  ? 'border-2 border-[#34562e] bg-white shadow-md'
                  : 'border-[#c2c8bc]/40 bg-white hover:border-[#34562e]/30 shadow-sm'
              } ${!branch.isOpen ? 'opacity-85' : ''}`}
            >
              <div className="flex gap-3 p-3">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#f0eded]">
                  <img
                    src={branch.imageUrl}
                    alt={branch.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {!branch.isOpen && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                      <span className="text-[10px] font-bold tracking-widest text-white uppercase">
                        Closed
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-serif text-base font-bold text-[#1b1c1c]">
                        {branch.name}
                      </h3>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          branch.isOpen
                            ? 'bg-[#3c7327] text-[#b7f699]'
                            : 'bg-[#ffdad6] text-[#93000a]'
                        }`}
                      >
                        {branch.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5d5f5b]">
                      {branch.address}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[#5d5f5b]">
                      <Navigation className="h-3.5 w-3.5 text-[#34562e]" />
                      <span className="text-xs font-medium">
                        {branch.distanceKm} km away
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#34562e]">
                      <span>Select & View Menu</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredBranches.length === 0 && (
          <div className="my-8 text-center text-sm text-[#5d5f5b]">
            Tidak ada cabang yang cocok dengan pencarian "{searchQuery}".
          </div>
        )}
      </section>

      {/* Promotional Banner */}
      <section className="mt-6">
        <div className="relative flex h-36 w-full flex-col justify-center overflow-hidden rounded-2xl bg-[#4b6f44] p-6 text-white shadow-md">
          <div className="z-10">
            <h4 className="font-serif text-2xl font-semibold leading-tight">
              Refer a friend
            </h4>
            <p className="mt-1 text-sm text-white/90">
              Get Rp10.000 off your next matcha order.
            </p>
          </div>
          <div className="absolute -right-4 top-0 h-full w-40 opacity-20 flex items-center justify-center pointer-events-none">
            <Sparkles className="h-32 w-32 rotate-12 text-white" />
          </div>
        </div>
      </section>
    </div>
  );
};
