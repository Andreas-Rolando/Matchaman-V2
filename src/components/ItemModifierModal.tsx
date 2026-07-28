import React, { useState } from 'react';
import { X, Plus, Minus, Check, AlertCircle } from 'lucide-react';
import { MenuItem, CartModifier, ModifierGroup } from '../types';

interface ItemModifierModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    selectedModifiers: CartModifier[],
    specialNotes: string
  ) => void;
}

export const ItemModifierModal: React.FC<ItemModifierModalProps> = ({
  item,
  onClose,
  onAddToCart,
}) => {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [specialNotes, setSpecialNotes] = useState('');
  // Track selected options per group: { groupId: { optionId, optionName, price, qty } }
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, Record<string, { optionId: string; optionName: string; price: number; qty: number }>>
  >({});

  const handleOptionQty = (
    group: ModifierGroup,
    optionId: string,
    optionName: string,
    price: number,
    delta: number
  ) => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      const groupState = { ...(next[group.id] || {}) };
      const current = groupState[optionId] || { optionId, optionName, price, qty: 0 };
      const newQty = Math.max(0, Math.min(group.maxQty, current.qty + delta));

      if (newQty === 0) {
        delete groupState[optionId];
      } else {
        groupState[optionId] = { ...current, qty: newQty };
      }

      // Enforce maxQty across all options in this group
      const totalSelected = Object.values(groupState).reduce((s, o) => s + o.qty, 0);
      if (totalSelected > group.maxQty) {
        return prev; // Don't update if over limit
      }

      next[group.id] = groupState;
      return next;
    });
  };

  const handleSingleToggle = (
    group: ModifierGroup,
    optionId: string,
    optionName: string,
    price: number
  ) => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      const groupState = { ...(next[group.id] || {}) };
      const current = groupState[optionId];

      if (current && current.qty > 0) {
        // Deselect
        delete groupState[optionId];
      } else {
        // Single select - clear others in group, select this one
        const cleared: Record<string, any> = {};
        cleared[optionId] = { optionId, optionName, price, qty: 1 };
        next[group.id] = cleared;
        return next;
      }

      next[group.id] = groupState;
      return next;
    });
  };

  const getGroupSelectedQty = (groupId: string): number => {
    const groupState = selectedOptions[groupId] || {};
    return Object.values(groupState).reduce((s, o) => s + o.qty, 0);
  };

  const isOptionSelected = (groupId: string, optionId: string): boolean => {
    const groupState = selectedOptions[groupId] || {};
    return (groupState[optionId]?.qty || 0) > 0;
  };

  const getOptionQty = (groupId: string, optionId: string): number => {
    const groupState = selectedOptions[groupId] || {};
    return groupState[optionId]?.qty || 0;
  };

  const buildModifiersList = (): CartModifier[] => {
    const result: CartModifier[] = [];
    for (const [groupId, groupState] of Object.entries(selectedOptions)) {
      for (const opt of Object.values(groupState)) {
        for (let i = 0; i < opt.qty; i++) {
          result.push({
            groupId,
            groupName: item!.modifierGroups?.find((g) => g.id === groupId)?.name || '',
            optionId: opt.optionId,
            optionName: opt.optionName,
            price: opt.price,
          });
        }
      }
    }
    return result;
  };

  const modifiersList = buildModifiersList();
  const modifiersPrice = modifiersList.reduce((sum, m) => sum + m.price, 0);
  const unitPrice = item.price + modifiersPrice;
  const totalPrice = unitPrice * quantity;

  // Check if all required groups have minimum qty met
  const allRequiredMet = (item.modifierGroups || [])
    .filter((g) => g.required)
    .every((g) => getGroupSelectedQty(g.id) >= g.minQty);

  const handleAdd = () => {
    onAddToCart(item, quantity, modifiersList, specialNotes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header Image */}
        <div className="relative h-48 w-full flex-shrink-0 bg-[#f0eded]">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1b1c1c]">
                {item.name}
              </h3>
              <p className="mt-1 text-xs text-[#5d5f5b]">
                {item.description}
              </p>
            </div>
            <span className="font-serif text-lg font-bold text-[#34562e]">
              Rp{item.price.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Modifier Groups */}
          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="mt-5 space-y-4">
              {item.modifierGroups.map((group) => {
                const isMulti = group.maxQty > 1;
                const groupQty = getGroupSelectedQty(group.id);
                const isRequired = group.required;

                return (
                  <div key={group.id} className="rounded-xl border border-[#e4e2e1] bg-[#f6f3f2] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1b1c1c]">
                        {group.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {isMulti && (
                          <span className="text-[10px] text-[#5d5f5b]">
                            {groupQty}/{group.maxQty} dipilih
                          </span>
                        )}
                        <span className={`text-[10px] font-medium ${isRequired ? 'text-[#ba1a1a]' : 'text-[#5d5f5b]'}`}>
                          {isRequired ? `Wajib (min ${group.minQty})` : 'Pilihan'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {group.options.map((option) => {
                        if (isMulti) {
                          // Multi-select with +/- qty controls
                          const optQty = getOptionQty(group.id, option.id);
                          const canAdd = optQty < group.maxQty && groupQty < group.maxQty;
                          const canRemove = optQty > 0;

                          return (
                            <div
                              key={option.id}
                              className={`flex items-center justify-between rounded-lg p-2.5 transition-all ${
                                optQty > 0
                                  ? 'bg-[#34562e] text-white shadow-xs'
                                  : 'bg-white text-[#1b1c1c] hover:bg-[#eae7e7]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                    optQty > 0
                                      ? 'border-white bg-white text-[#34562e]'
                                      : 'border-[#c2c8bc] bg-transparent'
                                  }`}
                                >
                                  {optQty > 0 && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-medium truncate">
                                  {option.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-semibold ${optQty > 0 ? 'text-white' : 'text-[#34562e]'}`}>
                                  {option.price > 0
                                    ? `+Rp${option.price.toLocaleString('id-ID')}`
                                    : 'Free'}
                                </span>
                                {optQty > 0 && (
                                  <div className="flex items-center rounded-full bg-white/20 p-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOptionQty(group, option.id, option.name, option.price, -1);
                                      }}
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#34562e] shadow-xs active:scale-90"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="min-w-[20px] text-center text-xs font-bold">
                                      {optQty}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (canAdd) handleOptionQty(group, option.id, option.name, option.price, 1);
                                      }}
                                      disabled={!canAdd}
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#34562e] text-white shadow-xs active:scale-90 disabled:opacity-40"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                                {optQty === 0 && canAdd && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOptionQty(group, option.id, option.name, option.price, 1);
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#34562e] text-white shadow-xs active:scale-90"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Single-select (radio) for maxQty === 1
                        const isSelected = isOptionSelected(group.id, option.id);
                        return (
                          <div
                            key={option.id}
                            onClick={() =>
                              handleSingleToggle(group, option.id, option.name, option.price)
                            }
                            className={`flex cursor-pointer items-center justify-between rounded-lg p-2.5 transition-all active:scale-[0.98] ${
                              isSelected
                                ? 'bg-[#34562e] text-white shadow-xs'
                                : 'bg-white text-[#1b1c1c] hover:bg-[#eae7e7]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                  isSelected
                                    ? 'border-white bg-white text-[#34562e]'
                                    : 'border-[#c2c8bc] bg-transparent'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-medium">
                                {option.name}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-[#34562e]'}`}>
                              {option.price > 0
                                ? `+Rp${option.price.toLocaleString('id-ID')}`
                                : 'Free'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Special Notes */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[#1b1c1c]">
              Catatan Khusus (Optional)
            </label>
            <input
              type="text"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="e.g. Less Sugar, No Onions, Extra Sauce"
              className="mt-1 h-10 w-full rounded-lg border border-[#c2c8bc] bg-white px-3 text-xs outline-none focus:border-[#34562e] focus:ring-1 focus:ring-[#34562e]"
            />
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-[#e4e2e1] bg-white p-4">
          {!allRequiredMet && (
            <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-[#fff3e0] p-2 text-[11px] text-[#e65100]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Silakan pilih opsi wajib terlebih dahulu</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center rounded-full bg-[#f0eded] p-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1b1c1c] shadow-xs active:scale-90"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[32px] text-center font-bold text-[#1b1c1c]">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#34562e] text-white shadow-xs active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAdd}
              disabled={!allRequiredMet}
              className="flex flex-1 items-center justify-between rounded-xl bg-[#34562e] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Tambah ke Order</span>
              <span>Rp{totalPrice.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
