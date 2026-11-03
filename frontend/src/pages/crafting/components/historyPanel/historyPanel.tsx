import React, { FC, useMemo, useState, useEffect } from 'react';
import './historyPanel.css';
import SearchInput from '../../../../components/common/SearchInput';
import FilterSelect from '../../../../components/common/FilterSelect';
import viewIcon from '../../../../assets/images/View Icon.png';
import { useApi } from '../../../../hooks';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { CategoryBadge, CategoryIcon, CategoryTile, categoryStyle } from '../../../../components/common/categories';

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

interface SelectOption {
  label: string;
  value: string;
}

interface StatusCounts {
  [key: string]: number;
  All: number;
  Complete: number;
  Cancelled: number;
}

const STATUS_TABS: SelectOption[] = [
  { label: 'All', value: 'All' },
  { label: 'Complete', value: 'Complete' },
  { label: 'Cancelled', value: 'Cancelled' }
];

const SORT_OPTIONS: SelectOption[] = [
  { label: 'Item Name', value: 'itemName' },
  { label: 'Date', value: 'date' },
  { label: 'Qty', value: 'qty' },
  { label: 'Employee', value: 'employee' }
];

const HistoryPanel: FC = () => {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<string>('itemName');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [historyData, setHistoryData] = useState<OrderHistoryDto[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [ingredientsByOrderId, setIngredientsByOrderId] = useState<Record<number, IngredientDto[]>>({});
  const [loadingIngredientsOrderId, setLoadingIngredientsOrderId] = useState<number | null>(null);
  const catalog = useItemCatalog();
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    const loadHistory = async (): Promise<void> => {
      try {
        const [response, usersResponse] = await Promise.all([
          api.get<OrderHistoryDto[]>('/Order'),
          api.get<Array<{ employeeId?: number; employeeName?: string }>>('/User').catch(() => ({ data: [] as Array<{ employeeId?: number; employeeName?: string }> })),
        ]);
        const names: Record<number, string> = {};
        (usersResponse.data || []).forEach((user) => {
          if (user.employeeId != null && user.employeeName) names[user.employeeId] = user.employeeName;
        });
        const allOrders = (response.data || []).map((order) => ({
          ...order,
          employeeName: order.employeeName ?? (order.employeeID != null ? names[order.employeeID] : undefined),
        }));
        const historyOrders = allOrders.filter((o) => {
          const s = (o.status || '').toLowerCase();
          return s === 'complete' || s === 'completed' || s === 'cancelled' || s === 'canceled';
        });
        setHistoryData(historyOrders);
      } catch (error) {
        console.error('Failed to load order history', error);
        setHistoryData([]);
      }
    };
    void loadHistory();
  }, [api]);

  const statusCounts: StatusCounts = useMemo(() => {
    return historyData.reduce(
      (counts, order) => {
        const status = (order.status || 'Unknown').toLowerCase();
        counts.All += 1;
        if (status === 'complete' || status === 'completed') counts.Complete += 1;
        if (status === 'cancelled' || status === 'canceled') counts.Cancelled += 1;
        return counts;
      },
      { All: 0, Complete: 0, Cancelled: 0 }
    );
  }, [historyData]);

  const filteredData = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return historyData
      .filter((order) => {
        const status = (order.status || 'Unknown').toLowerCase();
        const normActive = activeTab.toLowerCase();
        const normFilter = statusFilter.toLowerCase();
        if (activeTab !== 'All' && status !== normActive) return false;
        if (statusFilter !== 'All' && status !== normFilter) return false;

        if (!normalizedSearch) return true;
        return [order.itemName, order.employeeName || '', status]
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        if (sortKey === 'qty') return (b.quantity || 0) - (a.quantity || 0);
        if (sortKey === 'date') return new Date(b.createdDateTime || 0).getTime() - new Date(a.createdDateTime || 0).getTime();
        if (sortKey === 'itemName') return (a.itemName || '').localeCompare(b.itemName || '');
        if (sortKey === 'employee') return (a.employeeName || '').localeCompare(b.employeeName || '');
        return 0;
      });
  }, [activeTab, statusFilter, sortKey, searchQuery, historyData]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const handlePageChange = (page: number): void => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleViewClick = async (order: OrderHistoryDto): Promise<void> => {
    if (expandedOrderId === order.orderID) {
      setExpandedOrderId(null);
      return;
    }

    setExpandedOrderId(order.orderID);

    if (ingredientsByOrderId[order.orderID]) {
      return;
    }

    setLoadingIngredientsOrderId(order.orderID);
    try {
      const response = await api.get<IngredientDto[]>(`/Item/itemIngredient/item/${order.itemID}`);
      setIngredientsByOrderId((prev) => ({
        ...prev,
        [order.orderID]: response.data || [],
      }));
    } catch (error) {
      console.error(`Failed to load ingredients for item ${order.itemID}`, error);
      setIngredientsByOrderId((prev) => ({
        ...prev,
        [order.orderID]: [],
      }));
    } finally {
      setLoadingIngredientsOrderId(null);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, sortKey, searchQuery]);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'short', timeStyle: 'short' }).format(date);
    } catch {
      return 'N/A';
    }
  };

  return (
    <section className="history-panel">
      <div className="history-panel-top">
        <div className="history-title-group">
          <div>
            <h2>Crafting History</h2>
            <p className="history-meta">{historyData.length} orders</p>
          </div>
        </div>

        <div className="history-controls">
          <div className="history-search">
            <label className="history-search-label" htmlFor="history-search-input">Search:</label>
            <SearchInput
              id="history-search-input"
              placeholder="Search items, employee..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <div className="history-select-wrapper">
            <label>Status:</label>
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Status filter"
              options={[
                { label: 'All', value: 'All' },
                { label: 'Complete', value: 'Complete' },
                { label: 'Cancelled', value: 'Cancelled' },
              ]}
            />
          </div>
          <div className="history-select-wrapper">
            <label>Sort:</label>
            <FilterSelect
              value={sortKey}
              onChange={setSortKey}
              ariaLabel="Sort filter"
              options={SORT_OPTIONS}
            />
          </div>
        </div>
      </div>

      <div className="history-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`history-tab ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label} ({statusCounts[tab.value]})
          </button>
        ))}
      </div>

      <div className="history-table-wrapper">
        <table className="history-table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th>DATE</th>
              <th>QTY</th>
              <th>EMPLOYEE</th>
              <th>STATUS</th>
              <th>VIEW</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((order) => {
              const isExpanded = expandedOrderId === order.orderID;
              const ingredients = ingredientsByOrderId[order.orderID] || [];
              const isLoading = loadingIngredientsOrderId === order.orderID;

              return (
                <React.Fragment key={order.orderID}>
                  <tr className={`history-row cat-row ${isExpanded ? 'is-open' : ''}`} style={categoryStyle(catalog[order.itemID]?.category)}>
                    <td>
                      <div className="history-item-cell">
                        <CategoryTile category={catalog[order.itemID]?.category} size="sm" />
                        <div>
                          <div className="item-name">{order.itemName}</div>
                          <div className="item-subtitle">
                            {`Order #${order.orderID}`} <CategoryBadge category={catalog[order.itemID]?.category} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(order.completedDateTime || order.createdDateTime)}</td>
                    <td>{order.quantity}</td>
                    <td>{order.employeeName || 'Unknown'}</td>
                    <td>
                      <span className={`status-pill ${(order.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
                        {order.status || 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`icon-action-button ${isExpanded ? 'active' : ''}`}
                        aria-label={`View ${order.itemName}`}
                        onClick={() => {
                          void handleViewClick(order);
                        }}
                      >
                        <img src={viewIcon} alt="" aria-hidden="true" className="icon-action-button-icon" />
                        <span className="sr-only">View</span>
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="history-expanded-row">
                      <td colSpan={6}>
                        <div className="inv-view history-view" style={categoryStyle(catalog[order.itemID]?.category)}>
                          <div className="inv-view-hero">
                            <div className="inv-view-glow" aria-hidden="true">
                              <CategoryIcon category={catalog[order.itemID]?.category} size={100} />
                            </div>
                            <CategoryTile category={catalog[order.itemID]?.category} size="md" />
                            <div className="inv-view-hero-text">
                              <div className="inv-view-kicker">
                                <span>Order #{order.orderID}</span>
                                <span className={`status-pill ${(order.status || 'unknown').toLowerCase()}`}>{order.status}</span>
                              </div>
                              <h3>{order.quantity} × {order.itemName}</h3>
                              <div className="inv-view-facts">
                                <span>{order.employeeName || 'Unknown employee'}</span>
                                <span>{formatDate(order.completedDateTime || order.createdDateTime)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="inv-view-body">
                            <span className="inv-view-label">Materials used</span>
                            {isLoading ? (
                              <p className="loading-text">Loading materials…</p>
                            ) : ingredients.length === 0 ? (
                              <p className="empty-text">No materials recorded for this item.</p>
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
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="history-footer">
        <span>Showing {paginatedData.length} of {filteredData.length} items · Rows per page {ITEMS_PER_PAGE}</span>
        <div className="history-pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
              onClick={() => handlePageChange(page)}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
};

export default HistoryPanel;
