// Main dashboard: key stats, every stock warning, and the live crafting queue
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import { CategoryTile } from '../../components/common/categories';
import CraftingQueue from '../crafting/components/craftingQueue/craftingQueue';
import { buildInventoryOverview, getInventoryItems, InventoryItem } from '../../services/inventoryApi';
import { getCurrentDateSAST } from '../../Date/dateUtils';
import { useWorkspace } from '../../utils/workspace';
import './dashboard.css';

type Severity = 'out' | 'critical' | 'low';

function severityOf(item: InventoryItem): Severity {
  if (item.quantity <= 0) return 'out';
  if (item.quantity <= Math.max(1, Math.floor(item.minStock / 2))) return 'critical';
  return 'low';
}

const SEVERITY_LABEL: Record<Severity, string> = {
  out: 'Out of stock',
  critical: 'Critical',
  low: 'Low',
};

function DashboardPage() {
  const currentDate = getCurrentDateSAST();
  const workspace = useWorkspace();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    setLoadingInventory(true);
    getInventoryItems()
      .then((rows) => {
        if (mounted) setInventoryItems(rows);
      })
      .catch((err) => {
        console.error('Failed to load dashboard inventory data', err);
        if (mounted) {
          setInventoryItems([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (mounted) setLoadingInventory(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const inventoryOverview = useMemo(() => buildInventoryOverview(inventoryItems), [inventoryItems]);

  const warnings = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.status === 'LOW')
        .sort((left, right) => left.quantity - right.quantity || left.name.localeCompare(right.name)),
    [inventoryItems],
  );

  const counts = useMemo(() => {
    const result: Record<Severity, number> = { out: 0, critical: 0, low: 0 };
    warnings.forEach((item) => {
      result[severityOf(item)] += 1;
    });
    return result;
  }, [warnings]);

  const showLocation = workspace.isAllView;

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Inventory & Crafting" subtitle={`Main Dashboard · ${currentDate}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {inventoryOverview.stats.map((stat) => (
          <StatCard key={stat.id} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <SectionCard
          title="Stock warnings"
          subtitle={
            warnings.length === 0
              ? 'Everything is above its minimum level'
              : `${warnings.length} item${warnings.length === 1 ? '' : 's'} need attention · most urgent first`
          }
          rightSlot={
            <Link to="/inventory" className="dash-link">
              Open inventory →
            </Link>
          }
        >
          {warnings.length > 0 ? (
            <div className="dash-warning-summary">
              <span className="dash-pill dash-pill--out">{counts.out} out of stock</span>
              <span className="dash-pill dash-pill--critical">{counts.critical} critical</span>
              <span className="dash-pill dash-pill--low">{counts.low} low</span>
            </div>
          ) : null}

          {loadingInventory ? (
            <div className="py-8 text-center text-sm text-muted">Loading stock levels…</div>
          ) : loadError ? (
            <div className="py-8 text-center text-sm text-muted">Couldn't load stock levels. Try refreshing in a moment.</div>
          ) : warnings.length === 0 ? (
            <div className="dash-all-good">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.2 12.3 2.4 2.4 5-5" />
              </svg>
              <div>
                <strong>All stock levels look healthy</strong>
                <p>Items show up here as soon as they drop to their minimum level.</p>
              </div>
            </div>
          ) : (
            <ul className="dash-warning-list">
              {warnings.map((item, index) => {
                const severity = severityOf(item);
                const percent = Math.min(100, Math.round((item.quantity / Math.max(1, item.minStock)) * 100));
                return (
                  <li key={`${item.id}-${item.branchId}-${index}`} className={`dash-warning dash-warning--${severity}`}>
                    <CategoryTile category={item.category} size="sm" />
                    <div className="dash-warning-body">
                      <div className="dash-warning-top">
                        <span className="dash-warning-name">{item.name}</span>
                        <span className={`dash-pill dash-pill--${severity}`}>{SEVERITY_LABEL[severity]}</span>
                      </div>
                      <div className="dash-warning-meta">
                        <span>{item.sku}</span>
                        {showLocation ? <span>· {item.location}</span> : null}
                      </div>
                      <div className="dash-warning-bar" aria-hidden="true">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <div className="dash-warning-qty">
                      <strong>{item.quantity}</strong>
                      <span>min {item.minStock}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* Same queue as the Crafting page: active crafts first, then queued pages */}
        <div className="dash-queue">
          <CraftingQueue />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
