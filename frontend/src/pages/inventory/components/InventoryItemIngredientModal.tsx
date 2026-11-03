import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from '../../../components/common/modalRoot';
import {
  createInventoryItemIngredient,
  getItemMaterialDetails,
  getItems,
  InventoryCreatedItem,
  InventoryMaterialDetails,
} from '../../../services/inventoryApi';

type ItemOption = {
  ItemID: number;
  ItemName: string;
  ItemCategory: string;
  ProductionTime: number;
};

type InventoryItemIngredientModalProps = {
  item: InventoryCreatedItem | null;
  open: boolean;
  onClose: () => void;
};

function InventoryItemIngredientModal({ item, open, onClose }: InventoryItemIngredientModalProps) {
  const [availableItems, setAvailableItems] = useState<ItemOption[]>([]);
  const [details, setDetails] = useState<InventoryMaterialDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ingredientID, setIngredientID] = useState<number | ''>('');
  const [ingredientQuantity, setIngredientQuantity] = useState<number>(1);

  useEffect(() => {
    if (!open || !item) {
      return undefined;
    }

    let mounted = true;

    setLoading(true);

    Promise.all([getItems(), getItemMaterialDetails(item.itemID)])
      .then(([items, materialDetails]) => {
        if (!mounted) {
          return;
        }

        setAvailableItems(items);
        setDetails(materialDetails);
        setIngredientID('');
        setIngredientQuantity(1);
      })
      .catch((error) => {
        console.error('Failed to load ingredient editor data', error);
        if (mounted) {
          setAvailableItems([]);
          setDetails(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [item, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const selectableItems = useMemo(
    () => availableItems.filter((candidate) => candidate.ItemID !== item?.itemID).sort((left, right) => left.ItemName.localeCompare(right.ItemName)),
    [availableItems, item?.itemID],
  );

  if (!open || !item) {
    return null;
  }

  const handleAddIngredient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (ingredientID === '') {
      return;
    }

    setSaving(true);

    try {
      await createInventoryItemIngredient({
        productID: item.itemID,
        ingredientID,
        ingredientQuantity,
      });

      const refreshed = await getItemMaterialDetails(item.itemID);
      setDetails(refreshed);
      setIngredientID('');
      setIngredientQuantity(1);
    } catch (error) {
      console.error('Failed to add ingredient to item', error);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-label={`Add ingredients for ${item.itemName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ingredient setup</p>
              <h3 className="mt-1 text-lg font-semibold text-text">{item.itemName}</h3>
              <p className="mt-1 text-xs text-muted">Add blueprint ingredients to define the item&apos;s recipe.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-app px-3 py-2 text-sm font-medium text-text transition hover:border-primary">
              Done
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="space-y-3 rounded-xl border border-border bg-app p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Current ingredients</p>

              {loading ? (
                <p className="text-sm text-muted">Loading current recipe data...</p>
              ) : details && details.ingredients.length > 0 ? (
                <div className="space-y-2">
                  {details.ingredients.map((ingredient) => (
                    <div key={ingredient.ingredientId} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                      <div>
                        <p className="font-medium text-text">{ingredient.name}</p>
                        <p className="text-xs text-muted">{ingredient.category}</p>
                      </div>
                      <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted">
                        x{ingredient.requiredQuantity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No ingredients have been attached yet.</p>
              )}
            </div>

            <form onSubmit={handleAddIngredient} className="space-y-4 rounded-xl border border-border bg-app p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Add ingredient</p>
                <p className="mt-1 text-sm text-muted">Choose an item and quantity for the recipe.</p>
              </div>

              <label className="space-y-2 text-sm text-text">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Ingredient item</span>
                <select
                  value={ingredientID}
                  onChange={(event) => setIngredientID(event.target.value === '' ? '' : Number(event.target.value))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition focus:border-primary"
                  required
                >
                  <option value="">Select an item</option>
                  {selectableItems.map((candidate) => (
                    <option key={candidate.ItemID} value={candidate.ItemID}>
                      {candidate.ItemName} · {candidate.ItemCategory}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-text">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Quantity needed</span>
                <input
                  type="number"
                  min={1}
                  value={ingredientQuantity}
                  onChange={(event) => setIngredientQuantity(Number(event.target.value))}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition focus:border-primary"
                  required
                />
              </label>

              <div className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-muted">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Recipe target</p>
                <p className="mt-1">{item.itemName} · {item.itemCategory}</p>
                <p>Production time: {item.productionTime}s</p>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                <button type="button" onClick={onClose} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:border-primary">
                  Finish
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:bg-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ color: 'var(--on-primary)' }}
                >
                  {saving ? 'Adding...' : 'Add ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    getModalRoot(),
  );
}

export default InventoryItemIngredientModal;