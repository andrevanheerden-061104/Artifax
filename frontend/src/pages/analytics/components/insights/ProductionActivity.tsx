import React, { useMemo, useState } from 'react';
import { CATEGORIES, getCategory } from '../../../../components/common/categories';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { AnalyticsData, isComplete } from './useAnalyticsData';

type Metric = 'units' | 'value';
const RANGES = [7, 14, 30];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Daily production chart: one bar per day, stacked by category colour.
 * Switch between units crafted and Rand value, over 7 / 14 / 30 days.
 * (Replaces the old single-blueprint line graph.)
 */
function ProductionActivity({ data }: { data: AnalyticsData }) {
  const catalog = useItemCatalog();
  const [metric, setMetric] = useState<Metric>('units');
  const [range, setRange] = useState<number>(14);
  const [hovered, setHovered] = useState<number | null>(null);

  const { days, max, total, usedCategories } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = Array.from({ length: range }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (range - 1 - index));
      return { date, key: dayKey(date), byCategory: {} as Record<string, number>, total: 0 };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    data.orders.forEach((order) => {
      if (!isComplete(order.status) || !order.completedDateTime) return;
      const completed = new Date(order.completedDateTime);
      const bucket = byKey.get(dayKey(completed));
      if (!bucket) return;
      const item = catalog[order.itemID];
      const amount = metric === 'units' ? order.quantity || 0 : (order.quantity || 0) * (item?.price ?? 0);
      const category = getCategory(item?.category).id;
      bucket.byCategory[category] = (bucket.byCategory[category] ?? 0) + amount;
      bucket.total += amount;
    });

    const used = CATEGORIES.filter((category) => buckets.some((bucket) => bucket.byCategory[category.id]));
    return {
      days: buckets,
      max: Math.max(1, ...buckets.map((bucket) => bucket.total)),
      total: buckets.reduce((sum, bucket) => sum + bucket.total, 0),
      usedCategories: used,
    };
  }, [data.orders, catalog, metric, range]);

  const format = (value: number) =>
    metric === 'units' ? Math.round(value).toLocaleString('en-ZA') : `R ${Math.round(value).toLocaleString('en-ZA')}`;

  const best = days.reduce((top, day) => (day.total > top.total ? day : top), days[0]);
  const activeDays = days.filter((day) => day.total > 0).length;
  const focus = hovered != null ? days[hovered] : null;

  return (
    <section className="insight-card activity-card">
      <div className="activity-head">
        <div>
          <h3>Production activity</h3>
          <p>
            {focus
              ? `${focus.date.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}: ${format(focus.total)}`
              : `${format(total)} ${metric === 'units' ? 'units' : ''} over ${range} days · ${activeDays} active day${activeDays === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="activity-controls">
          <div className="seg" role="tablist" aria-label="Metric">
            <button type="button" className={metric === 'units' ? 'is-active' : ''} onClick={() => setMetric('units')}>Units</button>
            <button type="button" className={metric === 'value' ? 'is-active' : ''} onClick={() => setMetric('value')}>Value</button>
          </div>
          <div className="seg" role="tablist" aria-label="Range">
            {RANGES.map((option) => (
              <button key={option} type="button" className={range === option ? 'is-active' : ''} onClick={() => setRange(option)}>
                {option}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.loading ? (
        <p className="insight-empty">Loading…</p>
      ) : total === 0 ? (
        <div className="activity-empty">
          <strong>No completed crafts in the last {range} days</strong>
          <span>Finished orders show up here day by day, coloured by category.</span>
        </div>
      ) : (
        <>
          <div className="activity-chart" onMouseLeave={() => setHovered(null)}>
            <div className="activity-gridlines" aria-hidden="true">
              <span data-label={format(max)} />
              <span data-label={format(max / 2)} />
              <span data-label="0" />
            </div>
            <div className="activity-bars">
              {days.map((day, index) => (
                <div
                  key={day.key}
                  className={`activity-col ${hovered === index ? 'is-hovered' : ''} ${best === day && day.total > 0 ? 'is-best' : ''}`}
                  onMouseEnter={() => setHovered(index)}
                  title={`${day.date.toLocaleDateString('en-ZA')}: ${format(day.total)}`}
                >
                  <div className="activity-stack" style={{ height: `${(day.total / max) * 100}%` }}>
                    {CATEGORIES.filter((category) => day.byCategory[category.id]).map((category) => (
                      <span
                        key={category.id}
                        style={{ flexGrow: day.byCategory[category.id], background: category.color }}
                      />
                    ))}
                  </div>
                  <span className="activity-day">
                    {range <= 14
                      ? day.date.toLocaleDateString('en-ZA', { weekday: 'short' }).slice(0, 2)
                      : index % 5 === 0 ? day.date.getDate() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mix-legend">
            {usedCategories.map((category) => (
              <span key={category.id}>
                <i style={{ background: category.color }} />
                {category.label}
              </span>
            ))}
            {best && best.total > 0 ? (
              <span className="activity-best">
                Best day: {best.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} · {format(best.total)}
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

export default ProductionActivity;
