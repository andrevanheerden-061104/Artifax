import React, { useEffect, useState } from 'react';
import { CategoryPicker } from '../../../components/common/categories';
import { InventoryCreatedItem, InventoryItemCreate } from '../../../services/inventoryApi';

export type NewItemKind = 'material' | 'product';

export type CreateItemOptions = {
  kind: NewItemKind;
  /** Units to put in the current warehouse straight away (raw materials only). */
  startingStock: number;
};

type InventoryItemCreateModalProps = {
  open: boolean;
  saving: boolean;
  /** Kept for compatibility; categories now come from the shared category list. */
  categoryOptions?: string[];
  /** Name of the warehouse new stock goes into, or null in the read-only overview. */
  warehouseName: string | null;
  onClose: () => void;
  onCreate: (payload: InventoryItemCreate, options: CreateItemOptions) => Promise<InventoryCreatedItem>;
};

const emptyForm: InventoryItemCreate = {
  itemName: '',
  itemCategory: 'metal',
  productionTime: 0,
  price: null,
};

function InventoryItemCreateModal({ open, saving, warehouseName, onClose, onCreate }: InventoryItemCreateModalProps) {
  const [formValues, setFormValues] = useState<InventoryItemCreate>(emptyForm);
  const [kind, setKind] = useState<NewItemKind>('material');
  const [startingStock, setStartingStock] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFormValues(emptyForm);
    setKind('material');
    setStartingStock(0);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formValues.itemName.trim()) {
      setError('Give the item a name.');
      return;
    }
    if (kind === 'product' && formValues.productionTime < 1) {
      setError('Crafted items need a production time of at least 1 minute.');
      return;
    }
    setError('');
    try {
      await onCreate(
        { ...formValues, itemName: formValues.itemName.trim(), productionTime: kind === 'material' ? 0 : formValues.productionTime },
        { kind, startingStock: kind === 'material' ? startingStock : 0 },
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the item.');
    }
  };

  const inputClass =
    'w-full rounded-xl border border-border bg-app px-3 py-2.5 text-sm text-text outline-none transition focus:border-primary';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--overlay-backdrop)' }}
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[90%] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_rgba(15,23,42,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-label="Create inventory item"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 pb-3 pt-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">New item</p>
              <h3 className="mt-1 text-lg font-semibold text-text">Add an item to the catalogue</h3>
              <p className="mt-1 text-xs text-muted">Items are shared by all warehouses; stock is kept per warehouse.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-app px-3 py-2 text-sm font-medium text-text transition hover:border-primary">
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">What kind of item?</span>
              <div className="item-kind-toggle">
                <button
                  type="button"
                  className={`item-kind-option ${kind === 'material' ? 'is-selected' : ''}`}
                  onClick={() => setKind('material')}
                  aria-pressed={kind === 'material'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
                    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
                  </svg>
                  <span>
                    <span className="block text-sm font-semibold">Raw material</span>
                    <span className="block text-xs text-muted">Bought in and restocked (e.g. iron ore, timber)</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`item-kind-option ${kind === 'product' ? 'is-selected' : ''}`}
                  onClick={() => setKind('product')}
                  aria-pressed={kind === 'product'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14.5 4.5 19.5 9.5 9 20H4v-5Z" />
                    <path d="m12.5 6.5 5 5" />
                  </svg>
                  <span>
                    <span className="block text-sm font-semibold">Crafted item</span>
                    <span className="block text-xs text-muted">Made from materials — you'll add its recipe next</span>
                  </span>
                </button>
              </div>
            </div>

            <label className="block space-y-2 text-sm text-text">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Item name</span>
              <input
                value={formValues.itemName}
                onChange={(event) => setFormValues((current) => ({ ...current, itemName: event.target.value }))}
                className={inputClass}
                placeholder={kind === 'material' ? 'e.g. Copper Sheet' : 'e.g. Tool Cabinet'}
                autoFocus
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Category</span>
              <CategoryPicker
                compact
                value={formValues.itemCategory}
                onChange={(value) => setFormValues((current) => ({ ...current, itemCategory: value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {kind === 'product' ? (
                <label className="space-y-2 text-sm text-text">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Production time (min per unit)</span>
                  <input
                    type="number"
                    min={1}
                    value={formValues.productionTime || ''}
                    onChange={(event) => setFormValues((current) => ({ ...current, productionTime: Number(event.target.value) }))}
                    className={inputClass}
                  />
                </label>
              ) : (
                <label className="space-y-2 text-sm text-text">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Starting stock {warehouseName ? `· ${warehouseName}` : ''}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={startingStock || ''}
                    placeholder="0"
                    disabled={!warehouseName}
                    onChange={(event) => setStartingStock(Math.max(0, Number(event.target.value) || 0))}
                    className={inputClass}
                  />
                  {!warehouseName ? (
                    <span className="block text-xs text-muted">Switch to a warehouse to add starting stock.</span>
                  ) : null}
                </label>
              )}

              <label className="space-y-2 text-sm text-text">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Price per unit (ZAR)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formValues.price ?? ''}
                  placeholder="Optional"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setFormValues((current) => ({ ...current, price: nextValue === '' ? null : Number(nextValue) }));
                  }}
                  className={inputClass}
                />
              </label>
            </div>

            {error ? <p className="text-sm font-medium text-dangerText">{error}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:border-primary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:bg-primaryDark disabled:cursor-not-allowed disabled:opacity-60"
              style={{ color: 'var(--on-primary)' }}
            >
              {saving ? 'Saving…' : kind === 'product' ? 'Create & add recipe' : 'Create material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InventoryItemCreateModal;
