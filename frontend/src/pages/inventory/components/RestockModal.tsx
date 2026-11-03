import React, { useEffect, useMemo, useState } from 'react';
import { CategoryBadge, CategoryTile, CATEGORIES, normalizeCategory } from '../../../components/common/categories';
import { InventoryItem, RestockLine } from '../../../services/inventoryApi';

type RestockModalProps = {
  open: boolean;
  warehouseName: string;
  /** Inventory rows for the current warehouse. */
  items: InventoryItem[];
  /** IDs of items that are crafted from blueprints (hidden here — you craft those instead). */
  blueprintItemIds: Set<number>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (lines: RestockLine[]) => Promise<void>;
};

const QUICK_AMOUNTS = [10, 25, 50, 100];

/**
 * "Restock materials": add delivered stock for raw materials (items that are bought in,
 * not crafted from a blueprint). Pick any number of materials, set amounts, save once.
 */
function RestockModal({ open, warehouseName, items, blueprintItemIds, saving, onClose, onSubmit }: RestockModalProps) {
  const [amounts, setAmounts] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmounts({});
      setSearch('');
      setCategory('all');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const materials = useMemo(() => {
    const unique = new Map<number, InventoryItem>();
    items.forEach((item) => {
      const id = Number(item.id);
      if (!blueprintItemIds.has(id) && !unique.has(id)) unique.set(id, item);
    });
    return Array.from(unique.values()).sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));
  }, [items, blueprintItemIds]);

  const usedCategories = useMemo(
    () => CATEGORIES.filter((definition) => materials.some((item) => normalizeCategory(item.category) === definition.id)),
    [materials],
  );

  const visibleMaterials = materials.filter((item) => {
    if (category !== 'all' && normalizeCategory(item.category) !== category) return false;
    if (!search.trim()) return true;
    return item.name.toLowerCase().includes(search.trim().toLowerCase());
  });

  const lines: RestockLine[] = Object.entries(amounts)
    .map(([id, quantity]) => ({ itemID: Number(id), quantity }))
    .filter((line) => line.quantity > 0);
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

  const setAmount = (id: number, value: number) => {
    setAmounts((current) => ({ ...current, [id]: Math.max(0, Math.min(100000, Math.round(value || 0))) }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lines.length === 0) {
      setError('Add an amount to at least one material.');
      return;
    }
    setError('');
    try {
      await onSubmit(lines);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the restock.');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="restock-modal flex max-h-[88%] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-label="Restock materials"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 pb-3 pt-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Restock · {warehouseName}</p>
              <h3 className="mt-1 text-lg font-semibold text-text">Add delivered materials</h3>
              <p className="mt-1 text-xs text-muted">
                Raw materials only — crafted items are made from blueprints on the Crafting page.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-app px-3 py-2 text-sm font-medium text-text transition hover:border-primary">
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search materials…"
              className="min-w-[180px] flex-1 rounded-xl border border-border bg-app px-3 py-2 text-sm text-text outline-none focus:border-primary"
              aria-label="Search materials"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`restock-filter ${category === 'all' ? 'is-active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All
              </button>
              {usedCategories.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  className={`restock-filter ${category === definition.id ? 'is-active' : ''}`}
                  onClick={() => setCategory(definition.id)}
                >
                  {definition.label}
                </button>
              ))}
            </div>
          </div>

          <div className="restock-list min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {visibleMaterials.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                {materials.length === 0
                  ? 'No raw materials yet. Create one with “New item” and choose “Raw material”.'
                  : 'No materials match your search.'}
              </p>
            ) : null}

            {visibleMaterials.map((item) => {
              const id = Number(item.id);
              const adding = amounts[id] ?? 0;
              const isLow = item.quantity <= item.minStock;
              return (
                <div key={id} className={`restock-row ${adding > 0 ? 'is-selected' : ''}`}>
                  <CategoryTile category={item.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{item.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <CategoryBadge category={item.category} />
                      <span className={isLow ? 'restock-low' : ''}>
                        In stock: <strong>{item.quantity}</strong>
                        {adding > 0 ? (
                          <span className="restock-after"> → {item.quantity + adding}</span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="restock-quick">
                    {QUICK_AMOUNTS.map((amount) => (
                      <button key={amount} type="button" onClick={() => setAmount(id, adding + amount)}>
                        +{amount}
                      </button>
                    ))}
                  </div>

                  <div className="restock-stepper">
                    <button type="button" aria-label={`Less ${item.name}`} onClick={() => setAmount(id, adding - 1)} disabled={adding <= 0}>
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={adding === 0 ? '' : adding}
                      placeholder="0"
                      onChange={(event) => setAmount(id, Number(event.target.value))}
                      aria-label={`Amount of ${item.name} to add`}
                    />
                    <button type="button" aria-label={`More ${item.name}`} onClick={() => setAmount(id, adding + 1)}>
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <div className="text-sm text-muted">
              {lines.length === 0 ? (
                'Nothing selected yet'
              ) : (
                <>
                  <strong className="text-text">{lines.length}</strong> material{lines.length === 1 ? '' : 's'} ·{' '}
                  <strong className="text-text">+{totalUnits.toLocaleString('en-ZA')}</strong> units
                </>
              )}
              {error ? <p className="mt-1 text-xs font-medium text-dangerText">{error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {lines.length > 0 ? (
                <button type="button" onClick={() => setAmounts({})} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary">
                  Clear
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving || lines.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:bg-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: 'var(--on-primary)' }}
              >
                {saving ? 'Saving…' : 'Add to stock'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RestockModal;
