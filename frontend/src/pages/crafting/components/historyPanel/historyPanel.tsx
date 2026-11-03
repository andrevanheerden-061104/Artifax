import React, { FC, useEffect, useMemo, useState } from 'react';
import './historyPanel.css';
import SearchInput from '../../../../components/common/SearchInput';
import FilterSelect from '../../../../components/common/FilterSelect';
import SectionCard from '../../../../components/common/SectionCard';
import Tabs from '../../../../components/common/Tabs';
import Pagination from '../../../../components/common/Pagination';
import { EyeIcon } from '../../../../components/common/ActionIcons';
import { useApi } from '../../../../hooks';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import {
  CATEGORIES,
  CategoryBadge,
  CategoryIcon,
  CategoryTile,
  categoryStyle,
  normalizeCategory,
} from '../../../../components/common/categories';

interface OrderHistoryDto {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  completedDateTime?: string | null;
  createdDateTime?: string | null;
  status: string;
  employeeName?: string;
  employeeID?: number;
  branchID?: number;
}

interface IngredientDto {
  ingredientID?: number;
  itemID?: number;
  itemName?: string;
  quantity?: number;
}

const PAGE_SIZE = 15;

const SORT_OPTIONS = [
  { label: 'Sort: Newest', value: 'date' },
  { label: 'Sort: Name', value: 'itemName' },
  { label: 'Sort: Quantity', value: 'qty' },
  { label: 'Sort: Employee', value: 'employee' },
];

const isComplete = (status: string) => ['complete', 'completed'].includes((status || '').toLowerCase());
const isCancelled = (status: string) => ['cancelled', 'canceled'].includes((status || '').toLowerCase());

function formatDate(value: string | undefined | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** Finished crafting orders, laid out like the Inventory table (category chips, filters, pages). */
const HistoryPanel: FC = () => {
  const api = useApi();
  const catalog = useItemCatalog();
  const [categoryTab, setCategoryTab] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<string>('date');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [historyData, setHistoryData] = useState<OrderHistoryDto[]>([]);
  const [branchNames, setBranchNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [ingredientsByOrderId, setIngredientsByOrderId] = useState<Record<number, IngredientDto[]>>({});
  const [loadingIngredientsOrderId, setLoadingIngredientsOrderId] = useState<number | null>(null);

  useEffect(() => {
    const loadHistory = async (): Promise<void> => {
      try {
        const [response, usersResponse, branchesResponse] = await Promise.all([
          api.get<OrderHistoryDto[]>('/Order'),
          api.get<Array<{ employeeId?: number; employeeName?: string }>>('/User').catch(() => ({ data: [] as Array<{ employeeId?: number; employeeName?: string }> })),
          api.get<Array<Record<string, unknown>>>('/Branch').catch(() => ({ data: [] as Array<Record<string, unknown>> })),
        ]);
        const names: Record<number, string> = {};
        (usersResponse.data || []).forEach((user) => {
          if (user.employeeId != null && user.employeeName) names[user.employeeId] = user.employeeName;
        });
        const branches: Record<number, string> = {};
        (branchesResponse.data || []).forEach((branch) => {
          const id = Number(branch.branchID ?? branch.BranchID ?? 0);
          if (id) branches[id] = String(branch.branchName ?? branch.BranchName ?? `Warehouse ${id}`);
        });
        setBranchNames(branches);
        setHistoryData(
          (response.data || [])
            .filter((order) => isComplete(order.status) || isCancelled(order.status))
            .map((order) => ({
              ...order,
              employeeName: order.employeeName ?? (order.employeeID != null ? names[order.employeeID] : undefined),
            })),
        );
      } catch (error) {
        console.error('Failed to load order history', error);
        setHistoryData([]);
      } finally {
        setLoading(false);
      }
    };
    void loadHistory();
  }, [api]);

  const categoryOf = (order: OrderHistoryDto) => normalizeCategory(catalog[order.itemID]?.category);

  // Category chips, only for categories that appear in the history
  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    historyData.forEach((order) => {
      const id = categoryOf(order);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return [
      { id: 'all', label: 'All', count: historyData.length },
      ...CATEGORIES.filter((category) => counts.has(category.id)).map((category) => ({
        id: category.id,
        label: category.label,
        count: counts.get(category.id) ?? 0,
        categoryId: category.id,
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, catalog]);

  const stats = useMemo(() => {
    const completed = historyData.filter((order) => isComplete(order.status));
    const cancelled = historyData.filter((order) => isCancelled(order.status));
    return {
      completed: completed.length,
      cancelled: cancelled.length,
      units: completed.reduce((sum, order) => sum + (order.quantity || 0), 0),
    };
  }, [historyData]);

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return historyData
      .filter((order) => {
        if (categoryTab !== 'all' && categoryOf(order) !== categoryTab) return false;
        if (statusFilter === 'Complete' && !isComplete(order.status)) return false;
        if (statusFilter === 'Cancelled' && !isCancelled(order.status)) return false;
        if (!query) return true;
        return [order.itemName, order.employeeName || '', `#${order.orderID}`, branchNames[order.branchID ?? 0] || '']
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (sortKey === 'qty') return (b.quantity || 0) - (a.quantity || 0);
        if (sortKey === 'itemName') return (a.itemName || '').localeCompare(b.itemName || '');
        if (sortKey === 'employee') return (a.employeeName || '').localeCompare(b.employeeName || '');
        const dateOf = (order: OrderHistoryDto) => new Date(order.completedDateTime || order.createdDateTime || 0).getTime();
        return dateOf(b) - dateOf(a);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, categoryTab, statusFilter, sortKey, searchQuery, catalog, branchNames]);

  useEffect(() => {
    setPage(1);
  }, [categoryTab, statusFilter, sortKey, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedData = filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleViewClick = async (order: OrderHistoryDto): Promise<void> => {
    if (expandedOrderId === order.orderID) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(order.orderID);
    if (ingredientsByOrderId[order.orderID]) return;

    setLoadingIngredientsOrderId(order.orderID);
    try {
      const response = await api.get<IngredientDto[]>(`/Item/itemIngredient/item/${order.itemID}`);
      setIngredientsByOrderId((prev) => ({ ...prev, [order.orderID]: response.data || [] }));
    } catch (error) {
      setIngredientsByOrderId((prev) => ({ ...prev, [order.orderID]: [] }));
    } finally {
      setLoadingIngredientsOrderId(null);
    }
  };

  return (
    <SectionCard
      title="Crafting history"
      subtitle={`${stats.completed} completed · ${stats.cancelled} cancelled · ${stats.units.toLocaleString('en-ZA')} units crafted`}
    >
      <div className="space-y-3">
        <div className="grid items-end gap-2 lg:grid-cols-[minmax(0,2.4fr),repeat(2,minmax(0,1fr))]">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search item, employee, order #, warehouse…" />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Status filter"
            options={[
              { label: `Status: All (${historyData.length})`, value: 'All' },
              { label: `Status: Complete (${stats.completed})`, value: 'Complete' },
              { label: `Status: Cancelled (${stats.cancelled})`, value: 'Cancelled' },
            ]}
          />
          <FilterSelect value={sortKey} onChange={setSortKey} ariaLabel="Sort" options={SORT_OPTIONS} />
        </div>

        <Tabs tabs={tabs} activeTab={categoryTab} onChange={setCategoryTab} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="pb-2 pl-3 font-medium">Item / Order</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 pr-8 text-right font-medium">Qty</th>
                <th className="pb-2 pl-4 font-medium">Finished</th>
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Warehouse</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((order) => {
                const isExpanded = expandedOrderId === order.orderID;
                const ingredients = ingredientsByOrderId[order.orderID] || [];
                const isLoading = loadingIngredientsOrderId === order.orderID;
                const category = catalog[order.itemID]?.category;
                const complete = isComplete(order.status);

                return (
                  <React.Fragment key={order.orderID}>
                    <tr className={`cat-row border-b border-border/70 ${isExpanded ? 'is-open' : ''}`} style={categoryStyle(category)}>
                      <td className="py-2.5 pl-3 pr-3">
                        <div className="flex items-center gap-3">
                          <CategoryTile category={category} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-text">{order.itemName}</p>
                            <p className="text-xs text-muted">Order #{order.orderID}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3"><CategoryBadge category={category} /></td>
                      <td className="py-2.5 pr-8 text-right font-semibold text-text">{order.quantity}</td>
                      <td className="py-2.5 pl-4 pr-3 text-xs text-muted">{formatDate(order.completedDateTime || order.createdDateTime)}</td>
                      <td className="py-2.5 pr-3 text-muted">{order.employeeName || 'Unknown'}</td>
                      <td className="py-2.5 pr-3 text-muted">{branchNames[order.branchID ?? 0] ?? '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`history-status ${complete ? 'is-complete' : 'is-cancelled'}`}>
                          {complete ? 'Complete' : 'Cancelled'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          className={`row-action ${isExpanded ? 'is-open' : ''}`}
                          aria-label={`View ${order.itemName}`}
                          aria-expanded={isExpanded}
                          onClick={() => {
                            void handleViewClick(order);
                          }}
                        >
                          <EyeIcon />
                          {isExpanded ? 'Close' : 'View'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded ? (
                      <tr className="history-expanded-row border-b border-border/70">
                        <td colSpan={8} className="px-0 py-3">
                          <div className="inv-view history-view" style={categoryStyle(category)}>
                            <div className="inv-view-hero">
                              <div className="inv-view-glow" aria-hidden="true">
                                <CategoryIcon category={category} size={100} />
                              </div>
                              <CategoryTile category={category} size="md" />
                              <div className="inv-view-hero-text">
                                <div className="inv-view-kicker">
                                  <span>Order #{order.orderID}</span>
                                  <span className={`history-status ${complete ? 'is-complete' : 'is-cancelled'}`}>
                                    {complete ? 'Complete' : 'Cancelled'}
                                  </span>
                                </div>
                                <h3>
                                  {order.quantity} × {order.itemName}
                                </h3>
                                <div className="inv-view-facts">
                                  <span>{order.employeeName || 'Unknown employee'}</span>
                                  <span>{branchNames[order.branchID ?? 0] ?? 'Warehouse'}</span>
                                  <span>{formatDate(order.completedDateTime || order.createdDateTime)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="inv-view-body">
                              <span className="inv-view-label">{complete ? 'Materials used' : 'Materials (returned to stock)'}</span>
                              {isLoading ? (
                                <p className="text-sm text-muted">Loading materials…</p>
                              ) : ingredients.length === 0 ? (
                                <p className="text-sm text-muted">No materials recorded for this item.</p>
                              ) : (
                                <div className="inv-view-materials">
                                  {ingredients.map((ingredient, idx) => {
                                    const ingredientId = Number(ingredient.ingredientID ?? ingredient.itemID ?? 0);
                                    const perUnit = Number(ingredient.quantity ?? 0);
                                    return (
                                      <div key={idx} className="inv-view-material">
                                        <CategoryTile category={catalog[ingredientId]?.category} size="sm" />
                                        <div className="inv-view-material-body">
                                          <div className="inv-view-material-top">
                                            <span className="inv-view-material-name">{ingredient.itemName}</span>
                                            <span className="inv-view-material-count">{perUnit} per unit</span>
                                          </div>
                                        </div>
                                        <span className="inv-view-ok">× {perUnit * (order.quantity || 1)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No orders match your current filters.</p>
          ) : null}
          {loading ? <p className="py-6 text-center text-sm text-muted">Loading history…</p> : null}
        </div>

        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={filteredData.length}
          noun="orders"
          onChange={(next) => {
            setPage(next);
            setExpandedOrderId(null);
          }}
        />
      </div>
    </SectionCard>
  );
};

export default HistoryPanel;
