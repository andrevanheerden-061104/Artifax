import React, { useMemo } from 'react';
import './insights.css';
import { CategoryTile, categoryStyle, CATEGORIES, getCategory } from '../../../../components/common/categories';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { AnalyticsData, daysAgo, isCancelled, isComplete, orderDate } from './useAnalyticsData';

const WINDOW_DAYS = 30;

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatRand(value: number): string {
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

type KpiProps = { label: string; value: string; caption: string; tone: string; icon: React.ReactNode };

function Kpi({ label, value, caption, tone, icon }: KpiProps) {
  return (
    <div className="kpi-card" style={{ ['--tone' as string]: tone } as React.CSSProperties}>
      <span className="kpi-icon" aria-hidden="true">{icon}</span>
      <div>
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        <span className="kpi-caption">{caption}</span>
      </div>
    </div>
  );
}

/** Four headline numbers for the last 30 days. */
export function AnalyticsKpis({ data }: { data: AnalyticsData }) {
  const catalog = useItemCatalog();

  const stats = useMemo(() => {
    const since = daysAgo(WINDOW_DAYS);
    const recent = data.orders.filter((order) => {
      const date = orderDate(order);
      return date != null && date >= since;
    });
    const completed = recent.filter((order) => isComplete(order.status));
    const cancelled = recent.filter((order) => isCancelled(order.status));

    const units = completed.reduce((sum, order) => sum + (order.quantity || 0), 0);
    const value = completed.reduce((sum, order) => sum + (order.quantity || 0) * (catalog[order.itemID]?.price ?? 0), 0);

    const durations = completed
      .map((order) => {
        if (!order.startedDateTime || !order.completedDateTime) return 0;
        return (new Date(order.completedDateTime).getTime() - new Date(order.startedDateTime).getTime()) / 60000;
      })
      .filter((minutes) => minutes > 0);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const finished = completed.length + cancelled.length;
    const successRate = finished ? Math.round((completed.length / finished) * 100) : 0;

    return { units, value, avgDuration, successRate, completedCount: completed.length, cancelledCount: cancelled.length };
  }, [data.orders, catalog]);

  return (
    <div className="kpi-grid">
      <Kpi
        label="Units crafted"
        value={stats.units.toLocaleString('en-ZA')}
        caption={`${stats.completedCount} orders · last ${WINDOW_DAYS} days`}
        tone="#22b8cf"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>}
      />
      <Kpi
        label="Output value"
        value={formatRand(stats.value)}
        caption="Units × item price"
        tone="#22c55e"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17 9 12l4 4 7-8" /><path d="M15 8h5v5" /></svg>}
      />
      <Kpi
        label="Avg. production time"
        value={formatMinutes(stats.avgDuration)}
        caption="Start to finish per order"
        tone="#f2884b"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>}
      />
      <Kpi
        label="Completion rate"
        value={`${stats.successRate}%`}
        caption={`${stats.cancelledCount} cancelled`}
        tone="#9b87f5"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.4 2.4 5-5" /></svg>}
      />
    </div>
  );
}

/**
 * Material forecast: how fast each raw material is being used (from the last 30 days
 * of crafting × blueprint recipes) and roughly how many days of stock are left.
 * Plus the share of crafted units per category.
 */
export function MaterialForecast({ data }: { data: AnalyticsData }) {
  const catalog = useItemCatalog();

  const { rows, categoryMix, totalUnits } = useMemo(() => {
    const since = daysAgo(WINDOW_DAYS);
    const recipeById = new Map(data.blueprints.map((blueprint) => [Number(blueprint.id.replace('bp-', '')), blueprint]));

    // material id -> { name, category, stock, used }
    const materials = new Map<number, { id: number; name: string; category?: string; stock: number; used: number }>();
    data.blueprints.forEach((blueprint) => {
      blueprint.materials.forEach((material) => {
        if (!material.itemId || materials.has(material.itemId)) return;
        materials.set(material.itemId, { id: material.itemId, name: material.name, category: material.category, stock: material.have, used: 0 });
      });
    });

    const mix = new Map<string, number>();
    let units = 0;

    data.orders.forEach((order) => {
      if (isCancelled(order.status)) return;
      const date = orderDate(order);
      if (!date || date < since) return;

      const recipe = recipeById.get(order.itemID);
      recipe?.materials.forEach((material) => {
        const entry = material.itemId ? materials.get(material.itemId) : undefined;
        if (entry) entry.used += material.need * (order.quantity || 0);
      });

      if (isComplete(order.status)) {
        const category = getCategory(catalog[order.itemID]?.category ?? recipe?.category).id;
        mix.set(category, (mix.get(category) ?? 0) + (order.quantity || 0));
        units += order.quantity || 0;
      }
    });

    const forecastRows = Array.from(materials.values())
      .map((material) => {
        const perDay = material.used / WINDOW_DAYS;
        const daysLeft = perDay > 0 ? material.stock / perDay : Infinity;
        return { ...material, perDay, daysLeft };
      })
      .sort((left, right) => left.daysLeft - right.daysLeft || left.name.localeCompare(right.name))
      .slice(0, 8);

    return { rows: forecastRows, categoryMix: mix, totalUnits: units };
  }, [data.blueprints, data.orders, catalog]);

  if (data.loading) {
    return <section className="insight-card"><p className="insight-empty">Loading forecast…</p></section>;
  }

  const maxDays = 60;

  return (
    <section className="insight-card">
      <div className="insight-header">
        <div>
          <h3>Material forecast</h3>
          <p>How long each material lasts at the last {WINDOW_DAYS} days' crafting pace — reorder the top ones first.</p>
        </div>
      </div>

      {totalUnits > 0 ? (
        <div className="mix">
          <span className="insight-label">Crafted units by category</span>
          <div className="mix-bar" role="img" aria-label="Crafted units by category">
            {CATEGORIES.filter((category) => categoryMix.get(category.id)).map((category) => (
              <span
                key={category.id}
                style={{ width: `${((categoryMix.get(category.id) ?? 0) / totalUnits) * 100}%`, background: category.color }}
                title={`${category.label}: ${categoryMix.get(category.id)}`}
              />
            ))}
          </div>
          <div className="mix-legend">
            {CATEGORIES.filter((category) => categoryMix.get(category.id)).map((category) => (
              <span key={category.id}>
                <i style={{ background: category.color }} />
                {category.label} {Math.round(((categoryMix.get(category.id) ?? 0) / totalUnits) * 100)}%
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="insight-empty">No blueprint materials yet.</p>
      ) : (
        <div className="forecast-list">
          {rows.map((row) => {
            const finite = Number.isFinite(row.daysLeft);
            const percent = finite ? Math.max(4, Math.min(100, (row.daysLeft / maxDays) * 100)) : 100;
            const tone = !finite ? 'idle' : row.daysLeft < 7 ? 'bad' : row.daysLeft < 21 ? 'warn' : 'ok';
            return (
              <div key={row.id} className={`forecast-row forecast-row--${tone}`} style={categoryStyle(row.category)}>
                <CategoryTile category={row.category} size="sm" />
                <div className="forecast-body">
                  <div className="forecast-top">
                    <span className="forecast-name">{row.name}</span>
                    <span className="forecast-days">
                      {finite ? (row.daysLeft < 1 ? 'Less than a day' : `≈ ${Math.round(row.daysLeft)} days left`) : 'Not used recently'}
                    </span>
                  </div>
                  <div className="forecast-bar" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <div className="forecast-meta">
                    <span>In stock {row.stock}</span>
                    <span>Uses ≈ {row.perDay < 1 && row.perDay > 0 ? row.perDay.toFixed(1) : Math.round(row.perDay)} / day</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
