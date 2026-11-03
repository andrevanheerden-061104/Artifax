import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './graph.css';
import FilterSelect from '../../../../components/common/FilterSelect';
import { useApi } from '../../../../hooks';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { CategoryTile, categoryStyle, getCategory } from '../../../../components/common/categories';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

type ThemeChartTokens = {
  border: string;
  text: string;
  muted: string;
  grid: string;
  tooltipBg: string;
  primary: string;
  surface: string;
  fill: string;
};

type GraphTimeRange = 'week' | 'month' | '4months';

type OrderRow = {
  orderID: number;
  createdDateTime?: string;
  startedDateTime?: string;
  completedDateTime?: string;
  status?: string;
  itemName?: string;
  quantity?: number;
};

type ItemRow = {
  itemID: number;
  itemName: string;
  price: number;
};

const timeRangeOptions = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Last 4 months', value: '4months' },
];

function getThemeChartTokens(): ThemeChartTokens {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

  return {
    border: read('--border', '#dfe3e8'),
    text: read('--text', '#1e293b'),
    muted: read('--muted', '#64748b'),
    grid: read('--chart-grid', 'rgba(226,232,240,0.75)'),
    tooltipBg: read('--chart-tooltip-bg', 'rgba(30,41,59,0.95)'),
    primary: read('--primary', '#3c63ff'),
    surface: read('--surface', '#ffffff'),
    fill: read('--chart-fill', 'rgba(60, 99, 255, 0.16)'),
  };
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function buildChartBuckets(range: GraphTimeRange): Array<{ label: string; start: Date; end: Date; quantity: number; revenue: number }> {
  const now = new Date();
  const buckets: Array<{ label: string; start: Date; end: Date; quantity: number; revenue: number }> = [];

  if (range === 'week') {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      buckets.push({
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        start,
        end,
        quantity: 0,
        revenue: 0,
      });
    }
  } else if (range === 'month') {
    for (let weekIndex = 3; weekIndex >= 0; weekIndex -= 1) {
      const end = new Date(now);
      end.setDate(now.getDate() - weekIndex * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      buckets.push({
        label: `Week ${4 - weekIndex}`,
        start,
        end,
        quantity: 0,
        revenue: 0,
      });
    }
  } else {
    for (let monthIndex = 3; monthIndex >= 0; monthIndex -= 1) {
      const end = new Date(now);
      end.setMonth(now.getMonth() - monthIndex);
      end.setDate(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
      end.setHours(23, 59, 59, 999);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      buckets.push({
        label: end.toLocaleDateString('en-US', { month: 'short' }),
        start,
        end,
        quantity: 0,
        revenue: 0,
      });
    }
  }

  return buckets;
}

const GraphCard: React.FC = () => {
  const api = useApi();
  const [themeTokens, setThemeTokens] = useState<ThemeChartTokens>(() => getThemeChartTokens());
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [range, setRange] = useState<GraphTimeRange>('week');
  const [searchText, setSearchText] = useState('');
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const catalog = useItemCatalog();

  useEffect(() => {
    const closeSearchOptions = (event: PointerEvent) => {
      if (!searchWrapperRef.current?.contains(event.target as Node)) {
        setShowSearchOptions(false);
      }
    };

    document.addEventListener('pointerdown', closeSearchOptions);
    return () => document.removeEventListener('pointerdown', closeSearchOptions);
  }, []);

  useEffect(() => {
    const updateTokens = () => setThemeTokens(getThemeChartTokens());
    updateTokens();
    const observer = new MutationObserver(updateTokens);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setError(null);
      setIsLoading(true);

      try {
        const [orderResponse, itemResponse] = await Promise.all([
          api.get<OrderRow[]>('/Order'),
          api.get<any[]>('/Item/item/'),
        ]);

        const loadedOrders = orderResponse.data ?? [];
        const loadedItems = (itemResponse.data ?? []).map((item) => ({
          itemID: Number(item.itemID ?? item.ItemID ?? item.id ?? 0),
          itemName: String(item.itemName ?? item.ItemName ?? ''),
          price: Number(item.price ?? item.Price ?? 0),
        })).filter((item) => item.itemID > 0 && item.itemName.length > 0);

        setOrders(loadedOrders);
        setItems(loadedItems);

        if (loadedItems.length > 0) {
          setSelectedItemId((current) => current ?? loadedItems[Math.floor(Math.random() * loadedItems.length)].itemID);
        }
      } catch (loadError) {
        console.error('Unable to load analytics data', loadError);
        setError('Unable to load analytics data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [api]);

  const selectedItem = useMemo(
    () => items.find((item) => item.itemID === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  useEffect(() => {
    if (selectedItemId == null && items.length > 0) {
      setSelectedItemId(items[Math.floor(Math.random() * items.length)].itemID);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    const selectedItem = items.find((item) => item.itemID === selectedItemId);
    if (selectedItem) {
      setSearchText(selectedItem.itemName);
    }
  }, [items, selectedItemId]);

  const filteredItems = useMemo(() => {
    const query = normalizeString(searchText);
    if (!query) {
      return items;
    }
    return items.filter((item) => normalizeString(item.itemName).includes(query));
  }, [items, searchText]);

  const graphSeries = useMemo(() => {
    const buckets = buildChartBuckets(range);
    const targetName = normalizeString(selectedItem?.itemName);
    const completedOrders = orders.filter((order) => {
      const status = normalizeString(order.status);
      return status === 'complete' || status === 'completed';
    });

    completedOrders.forEach((order) => {
      const orderDate = order.completedDateTime
        ? new Date(order.completedDateTime)
        : order.startedDateTime
          ? new Date(order.startedDateTime)
          : order.createdDateTime
            ? new Date(order.createdDateTime)
            : null;
      if (!orderDate || Number.isNaN(orderDate.getTime())) {
        return;
      }

      const itemName = normalizeString(order.itemName);
      const itemQuantity = Number(order.quantity) || 0;

      if (!itemName || itemName !== targetName || itemQuantity <= 0) {
        return;
      }

      const bucket = buckets.find((bucketItem) => orderDate >= bucketItem.start && orderDate <= bucketItem.end);
      if (!bucket) {
        return;
      }

      bucket.quantity += itemQuantity;
      bucket.revenue += itemQuantity * (selectedItem?.price ?? 0);
    });

    return buckets;
  }, [orders, range, selectedItem]);

  const selectedCategory = selectedItem ? catalog[selectedItem.itemID]?.category : undefined;
  const lineColor = getCategory(selectedCategory).color;

  const data: ChartData<'line'> = useMemo(() => ({
    labels: graphSeries.map((bucket) => bucket.label),
    datasets: [
      {
        label: 'Crafted quantity',
        data: graphSeries.map((bucket) => bucket.quantity),
        fill: true,
        backgroundColor: `${lineColor}33`,
        borderColor: lineColor,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: themeTokens.surface,
        pointBorderColor: lineColor,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Revenue (ZAR)',
        data: graphSeries.map((bucket) => Number(bucket.revenue.toFixed(2))),
        fill: true,
        backgroundColor: 'rgba(255, 122, 89, 0.18)',
        borderColor: 'rgba(255, 122, 89, 0.95)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: themeTokens.surface,
        pointBorderColor: 'rgba(255, 122, 89, 0.95)',
        tension: 0.35,
        yAxisID: 'y',
      },
    ],
  }), [graphSeries, lineColor, themeTokens.surface]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        backgroundColor: themeTokens.tooltipBg,
        titleColor: themeTokens.text,
        bodyColor: themeTokens.muted,
        borderColor: themeTokens.border,
        borderWidth: 1,
        boxPadding: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: themeTokens.muted },
      },
      y: {
        beginAtZero: true,
        grid: { color: themeTokens.grid },
        ticks: { color: themeTokens.muted },
      },
    },
  }), [themeTokens.border, themeTokens.grid, themeTokens.muted, themeTokens.text, themeTokens.tooltipBg]);

  return (
    <section className="graph-card graph-card--themed" style={categoryStyle(selectedCategory)}>
      <div className="graph-card-header">
        <div className="graph-title-row">
          <CategoryTile category={selectedCategory} size="md" />
          <div>
            <h3>{selectedItem ? selectedItem.itemName : 'Craft output'}</h3>
            <p>Units crafted and their value over time — pick any blueprint.</p>
          </div>
        </div>
        <div className="graph-card-bottom-controls">
          <div className="graph-filter-group graph-filter-search" ref={searchWrapperRef}>
            <label className="graph-filter-label" htmlFor="searchBlueprint">Search blueprint</label>
            <div className="graph-search-shell">
              <input
                id="searchBlueprint"
                type="text"
                className="graph-search-input"
                value={searchText}
                placeholder="Search blueprint"
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setShowSearchOptions(true);
                }}
                onFocus={() => setShowSearchOptions(true)}
              />
              {showSearchOptions && filteredItems.length > 0 ? (
                <div className="graph-search-options">
                  {filteredItems.slice(0, 8).map((item) => (
                    <button
                      key={item.itemID}
                      type="button"
                      className="graph-search-option"
                      onClick={() => {
                        setSelectedItemId(item.itemID);
                        setSearchText(item.itemName);
                        setShowSearchOptions(false);
                      }}
                    >
                      {item.itemName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="graph-filter-group graph-filter-range">
            <label className="graph-filter-label" htmlFor="timeRange">Timeframe</label>
            <FilterSelect
              value={range}
              onChange={(value) => setRange(value as GraphTimeRange)}
              ariaLabel="Graph time range"
              options={timeRangeOptions}
              className="graph-select-shell"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p>Loading analytics data...</p>
      ) : error ? (
        <p>{error}</p>
      ) : (
        <>
          <div className="graph-figure">
            <Line data={data} options={options} />
          </div>
        </>
      )}
    </section>
  );
};

export default GraphCard;
