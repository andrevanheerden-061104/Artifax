import React, { useMemo, useState } from 'react';
import './mostCarfted.css';
import FilterSelect from '../../../../components/common/FilterSelect';
import { CategoryBadge, CategoryTile, categoryStyle } from '../../../../components/common/categories';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { AnalyticsOrder, isComplete } from '../insights/useAnalyticsData';
import { Blueprint } from '../../../crafting/components/craftingData';

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
  /** Every blueprint — shown even when it has never been crafted (0). */
  blueprints?: Blueprint[];
  loading?: boolean;
};

/** Ranked list of completed crafts, styled like the blueprint cards. */
const MostCrafted: React.FC<MostCraftedProps> = ({ orders = [], blueprints: allBlueprints = [], loading = false }) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('high');
  const catalog = useItemCatalog();

  const blueprints = useMemo(() => {
    const totals = new Map<number, CraftedBlueprint>();
    // Start every blueprint at 0 so never-crafted ones still appear
    allBlueprints.forEach((blueprint) => {
      const id = Number(blueprint.id.replace('bp-', ''));
      if (id) totals.set(id, { itemId: id, name: blueprint.name, crafted: 0 });
    });
    const blueprintIds = new Set(totals.keys());
    orders.forEach((order) => {
      // Only blueprints count here (not raw materials)
      if (blueprintIds.size > 0 && !blueprintIds.has(order.itemID)) return;
      if (!isComplete(order.status) || !(order.quantity > 0)) return;
      const existing = totals.get(order.itemID) ?? { itemId: order.itemID, name: order.itemName, crafted: 0 };
      existing.crafted += order.quantity;
      totals.set(order.itemID, existing);
    });
    return Array.from(totals.values());
  }, [orders, allBlueprints]);

  const sorted = useMemo(
    () =>
      [...blueprints].sort(
        (a, b) => (sortOrder === 'low' ? a.crafted - b.crafted : b.crafted - a.crafted) || a.name.localeCompare(b.name),
      ),
    [blueprints, sortOrder],
  );

  const max = Math.max(1, ...blueprints.map((blueprint) => blueprint.crafted));
  const ranked = [...blueprints].sort((a, b) => b.crafted - a.crafted || a.name.localeCompare(b.name)).map((blueprint) => blueprint.itemId);

  return (
    <section className="most-crafted">
      <div className="most-crafted-head">
        <div>
          <h3>Most crafted</h3>
          <p>{blueprints.length} blueprints · all-time completed units</p>
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
        {!loading && sorted.length === 0 ? <p className="most-crafted-empty">No blueprints yet.</p> : null}

        {sorted.map((blueprint) => {
          const item = catalog[blueprint.itemId];
          const rank = ranked.indexOf(blueprint.itemId) + 1;
          const value = item?.price != null ? blueprint.crafted * item.price : null;
          return (
            <div key={blueprint.itemId} className={`mc-card ${blueprint.crafted === 0 ? 'is-zero' : ''}`} style={categoryStyle(item?.category)}>
              <span className={`mc-rank ${rank <= 3 && blueprint.crafted > 0 ? `mc-rank--${rank}` : ''}`}>{rank}</span>
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
