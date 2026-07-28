import React, { useState } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import { MenuItem, CartModifier } from '../types';

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
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, CartModifier>>({});

  const handleModifierToggle = (
    groupId: string,
    groupName: string,
    optionId: string,
    optionName: string,
    price: number
  ) => {
    setSelectedModifiers((prev) => {
      const next = { ...prev };
      // Single selection per group for clean UX
      next[groupId] = {
        groupId,
        groupName,
        optionId,
        optionName,
        price,
      };
      return next;
    });
  };

  const modifiersList: CartModifier[] = Object.values(selectedModifiers);
  const modifiersPrice = modifiersList.reduce((sum: number, m: CartModifier) => sum + m.price, 0);
  const unitPrice = item.price + modifiersPrice;
  const totalPrice = unitPrice * quantity;

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
              ${item.price.toFixed(2)}
            </span>
          </div>

          {/* Modifier Groups */}
          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="mt-5 space-y-4">
              {item.modifierGroups.map((group) => (
                <div key={group.id} className="rounded-xl border border-[#e4e2e1] bg-[#f6f3f2] p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1b1c1c]">
                      {group.name}
                    </span>
                    <span className="text-[10px] text-[#5d5f5b]">
                      {group.required ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.options.map((option) => {
                      const isSelected =
                        selectedModifiers[group.id]?.optionId === option.id;
                      return (
                        <div
                          key={option.id}
                          onClick={() =>
                            handleModifierToggle(
                              group.id,
                              group.name,
                              option.id,
                              option.name,
                              option.price
                            )
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
                              ? `+$${option.price.toFixed(2)}`
                              : 'Free'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
              className="flex flex-1 items-center justify-between rounded-xl bg-[#34562e] px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98]"
            >
              <span>Tambah ke Order</span>
              <span>${totalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
