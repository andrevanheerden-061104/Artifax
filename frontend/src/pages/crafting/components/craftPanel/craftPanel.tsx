import React, { FC } from 'react';
import './craftPanel.css';
import { Blueprint } from '../craftingData';
import {
  CategoryBadge,
  CategoryIcon,
  CategoryTile,
  categoryStyle,
} from '../../../../components/common/categories';
import FilterSelect from '../../../../components/common/FilterSelect';
import { computeCraftable } from '../../../../services/blueprintApi';

export type WarehouseOption = { id: number; name: string };

interface CraftPanelProps {
  blueprint: Blueprint;
  amount: number;
  orderExpedite: boolean;
  /** Warehouse the materials come from. */
  sourceBranchId: number | null;
  /** Warehouse that crafts and receives the item. */
  targetBranchId: number | null;
  /** True for the admin overview: shows the "materials from / craft at" pickers. */
  chooseWarehouses: boolean;
  warehouses: WarehouseOption[];
  submitting: boolean;
  onSourceChange: (branchId: number) => void;
  onTargetChange: (branchId: number) => void;
  onAmountChange: (amount: number) => void;
  onToggleExpedite: () => void;
  onCraft: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const CraftPanel: FC<CraftPanelProps> = ({
  blueprint,
  amount,
  orderExpedite,
  sourceBranchId,
  targetBranchId,
  chooseWarehouses,
  warehouses,
  submitting,
  onSourceChange,
  onTargetChange,
  onAmountChange,
  onToggleExpedite,
  onCraft,
  onEdit,
  onDelete,
}) => {
  const haveFor = (stockByBranch: Record<number, number> | undefined, fallback: number) =>
    sourceBranchId != null && chooseWarehouses ? stockByBranch?.[sourceBranchId] ?? 0 : fallback;

  const materials = blueprint.materials.map((material) => ({
    ...material,
    available: haveFor(material.stockByBranch, material.have),
  }));

  const maxCraftable = computeCraftable(blueprint.materials, chooseWarehouses ? sourceBranchId : null);
  const warehousesChosen = !chooseWarehouses || (sourceBranchId != null && targetBranchId != null);
  const canCraft = warehousesChosen && amount >= 1 && materials.every((item) => item.available >= item.need * amount);

  const perUnit = blueprint.productionTime ?? 0;
  const effectiveTime = Math.ceil((perUnit * amount) / (orderExpedite ? 2 : 1));
  const outputValue = blueprint.price != null ? Number(blueprint.price) * amount : null;
  const targetStock = chooseWarehouses && targetBranchId != null ? blueprint.stockByBranch?.[targetBranchId] ?? 0 : blueprint.have;

  const warehouseName = (id: number | null) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? 'Warehouse';
  const warehouseOptions = warehouses.map((warehouse) => ({ value: String(warehouse.id), label: warehouse.name }));

  const setAmount = (next: number) => onAmountChange(Math.max(1, Math.min(9999, Math.round(next) || 1)));

  return (
    <div className="craft-panel-card craft-panel-card--themed" style={categoryStyle(blueprint.category)}>
      {/* Hero: category colour, icon and key facts */}
      <div className="craft-hero">
        <div className="craft-hero-glow" aria-hidden="true">
          <CategoryIcon category={blueprint.category} size={140} />
        </div>
        <CategoryTile category={blueprint.category} size="lg" />
        <div className="craft-hero-text">
          <div className="craft-hero-kicker">
            <span>Blueprint</span>
            <CategoryBadge category={blueprint.category} />
          </div>
          <h3>{blueprint.name}</h3>
          <div className="craft-hero-facts">
            <span title="Production time per unit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              {perUnit} min / unit
            </span>
            {blueprint.price != null ? (
              <span title="Value per unit">R {Number(blueprint.price).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}</span>
            ) : null}
            <span title="Units already in stock">{targetStock} in stock</span>
          </div>
        </div>
      </div>

      {/* Where materials come from / where it's crafted */}
      {chooseWarehouses ? (
        <div className="craft-route">
          <div className="craft-route-field">
            <span className="section-label">Take materials from</span>
            <FilterSelect
              value={sourceBranchId != null ? String(sourceBranchId) : ''}
              onChange={(value: string) => onSourceChange(Number(value))}
              options={[{ value: '', label: 'Choose warehouse' }, ...warehouseOptions]}
              ariaLabel="Warehouse to take materials from"
            />
          </div>
          <span className="craft-route-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </span>
          <div className="craft-route-field">
            <span className="section-label">Craft at</span>
            <FilterSelect
              value={targetBranchId != null ? String(targetBranchId) : ''}
              onChange={(value: string) => onTargetChange(Number(value))}
              options={[{ value: '', label: 'Choose warehouse' }, ...warehouseOptions]}
              ariaLabel="Warehouse that crafts the item"
            />
          </div>
        </div>
      ) : (
        <div className="craft-route craft-route--fixed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9.5 12 4l9 5.5V20H3Z" />
            <path d="M7 20v-6h10v6" />
          </svg>
          <span>
            Crafting at <strong>{warehouseName(targetBranchId)}</strong> using its own stock
          </span>
        </div>
      )}

      <div className="craft-amount-row">
        <div>
          <p className="section-label">Craft amount</p>
          <div className="amount-control">
            <button type="button" className="amount-btn" onClick={() => setAmount(amount - 1)} aria-label="Less">−</button>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="amount-input"
              aria-label="Craft amount"
            />
            <button type="button" className="amount-btn" onClick={() => setAmount(amount + 1)} aria-label="More">+</button>
          </div>
          {maxCraftable > 1 ? (
            <button type="button" className="craft-max-btn" onClick={() => setAmount(maxCraftable)}>
              Max ({maxCraftable})
            </button>
          ) : null}
          <div className="expedite-control">
            <label className="toggle-switch">
              <input type="checkbox" checked={orderExpedite} onChange={onToggleExpedite} aria-label="Order expedite" />
              <span className="slider" />
            </label>
            <span className="expedite-label">Expedite (double speed)</span>
          </div>
        </div>

        <div className="craft-summary-grid">
          <div className="craft-summary-tile">
            <span className="summary-label">Can craft</span>
            <strong className={maxCraftable > 0 ? 'is-ok' : 'is-bad'}>{maxCraftable}</strong>
          </div>
          <div className="craft-summary-tile">
            <span className="summary-label">Time</span>
            <strong>{formatMinutes(effectiveTime)}</strong>
          </div>
          <div className="craft-summary-tile">
            <span className="summary-label">Output value</span>
            <strong>{outputValue != null ? `R ${outputValue.toLocaleString('en-ZA')}` : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="materials-list">
        <div className="materials-title-row">
          <span className="section-label">
            Required materials{chooseWarehouses && sourceBranchId != null ? ` · from ${warehouseName(sourceBranchId)}` : ''}
          </span>
          <span className="materials-qty">Need / Have</span>
        </div>
        {materials.map((material) => {
          const need = material.need * amount;
          const enough = material.available >= need;
          const percent = need > 0 ? Math.min(100, Math.round((material.available / need) * 100)) : 100;
          return (
            <div key={`${material.itemId ?? material.name}`} className={`material-row material-row--rich ${enough ? '' : 'material-missing'}`}>
              <CategoryTile category={material.category} size="sm" />
              <div className="material-row-body">
                <div className="material-row-top">
                  <span className="material-name">{material.name}</span>
                  <span className="material-count">
                    {need} / {material.available}
                  </span>
                </div>
                <div className="material-bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                {!enough ? <p className="material-note">Short by {need - material.available}</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`craft-action-btn ${canCraft && !submitting ? '' : 'disabled'}`}
        onClick={() => {
          void onCraft();
        }}
        disabled={!canCraft || submitting}
      >
        {submitting ? 'Placing order…' : `Craft ${amount} × ${blueprint.name}`}
      </button>
      <div className="craft-additional-actions">
        <button type="button" className="craft-secondary-btn" onClick={onEdit}>
          Edit Blueprint
        </button>
        <button type="button" className="craft-secondary-btn craft-delete-btn" onClick={onDelete}>
          Delete Blueprint
        </button>
      </div>
      <p className="craft-hint">
        {!warehousesChosen
          ? 'Choose where the materials come from and where to craft.'
          : canCraft
            ? 'Materials are taken out of stock as soon as you place the order.'
            : 'Not enough materials for this amount.'}
      </p>
    </div>
  );
};

export default CraftPanel;
