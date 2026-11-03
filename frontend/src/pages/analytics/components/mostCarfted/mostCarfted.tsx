import React, { useMemo, useState } from 'react';
import './mostCarfted.css';
import FilterSelect from '../../../../components/common/FilterSelect';
import { CategoryBadge, CategoryTile, categoryStyle } from '../../../../components/common/categories';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { AnalyticsOrder, isComplete } from '../insights/useAnalyticsData';

type SortOrder = 'high' | 'low';

type CraftedBlueprint = {
  itemId: number;
  name: string;
  crafted: number;
};

const sortOptions = [
  { value: 'high', label: 'Most first' },
  { value: 'low', label: 'Least first' },
];

type MostCraftedProps = {
  orders?: AnalyticsOrder[];
  loading?: boolean;
};

/** Ranked list of completed crafts, styled like the blueprint cards. */
const MostCrafted: React.FC<MostCraftedProps> = ({ orders = [], loading = false }) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('high');
  const catalog = useItemCatalog();

  const blueprints = useMemo(() => {
    const totals = new Map<number, CraftedBlueprint>();
    orders.forEach((order) => {
      if (!isComplete(order.status) || !(order.quantity > 0)) return;
      const existing = totals.get(order.itemID) ?? { itemId: order.itemID, name: order.itemName, crafted: 0 };
      existing.crafted += order.quantity;
      totals.set(order.itemID, existing);
    });
    return Array.from(totals.values());
  }, [orders]);

  const sorted = useMemo(
    () => [...blueprints].sort((a, b) => (sortOrder === 'low' ? a.crafted - b.crafted : b.crafted - a.crafted)),
    [blueprints, sortOrder],
  );

  const max = Math.max(1, ...blueprints.map((blueprint) => blueprint.crafted));
  const ranked = [...blueprints].sort((a, b) => b.crafted - a.crafted).map((blueprint) => blueprint.itemId);

  return (
    <section className="most-crafted">
      <div className="most-crafted-head">
        <div>
          <h3>Most crafted</h3>
          <p>All-time completed units</p>
        </div>
        <FilterSelect
          value={sortOrder}
          onChange={(nextValue: string) => setSortOrder(nextValue as SortOrder)}
          ariaLabel="Most crafted sort order"
          options={sortOptions}
        />
      </div>

      <div className="most-crafted-list">
        {loading ? <p className="most-crafted-empty">Loading…</p> : null}
        {!loading && sorted.length === 0 ? <p className="most-crafted-empty">No completed crafts yet.</p> : null}

        {sorted.map((blueprint) => {
          const item = catalog[blueprint.itemId];
          const rank = ranked.indexOf(blueprint.itemId) + 1;
          const value = item?.price != null ? blueprint.crafted * item.price : null;
          return (
            <div key={blueprint.itemId} className="mc-card" style={categoryStyle(item?.category)}>
              <span className={`mc-rank ${rank <= 3 ? `mc-rank--${rank}` : ''}`}>{rank}</span>
              <CategoryTile category={item?.category} size="md" />
              <div className="mc-body">
                <div className="mc-top">
                  <span className="mc-name">{blueprint.name}</span>
                  <strong className="mc-count">{blueprint.crafted}</strong>
                </div>
                <div className="mc-bar" aria-hidden="true">
                  <span style={{ width: `${(blueprint.crafted / max) * 100}%` }} />
                </div>
                <div className="mc-meta">
                  <CategoryBadge category={item?.category} />
                  {value != null ? <span>R {Math.round(value).toLocaleString('en-ZA')} output</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MostCrafted;
