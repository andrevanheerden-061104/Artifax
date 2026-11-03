// React hooks and UI components used on the inventory page
import React, { useEffect, useMemo, useState } from 'react';
import FilterSelect from '../../components/common/FilterSelect';
import SearchInput from '../../components/common/SearchInput';
import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import Tabs from '../../components/common/Tabs';
import AlertStrip from '../../components/layout/AlertStrip';
import PageHeader from '../../components/layout/PageHeader';
import InventoryMaterialsPopover from './components/InventoryMaterialsPopover';
import InventoryItemEditModal from './components/InventoryItemEditModal';
import InventoryItemCreateModal, { CreateItemOptions } from './components/InventoryItemCreateModal';
import InventoryItemIngredientModal from './components/InventoryItemIngredientModal';
import RestockModal from './components/RestockModal';
import { createInventoryItem, getBlueprintProductIds, getItemCategoryOptions, getItems, getInventoryOverview, getItemMaterialDetails, restockBranch, updateInventoryItem, InventoryCreatedItem, InventoryItem, InventoryMaterialDetails, InventoryOverview, InventoryItemCreate, InventoryItemUpdate, RestockLine } from '../../services/inventoryApi';
import { getCurrentDateSAST } from '../../Date/dateUtils';
import { CategoryBadge } from '../../components/common/categories';
import { useWorkspace } from '../../utils/workspace';
import { showError, showSuccess } from '../../utils/toast';
import editIcon from '../../assets/images/Edit Icon.png';
import viewIcon from '../../assets/images/View Icon.png';

function InventoryPage() {
  const currentDate = getCurrentDateSAST();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [zone, setZone] = useState('ALL');
  const [sortBy, setSortBy] = useState('NAME');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryOverview, setInventoryOverview] = useState<InventoryOverview>({ items: [], previewRows: [], alerts: [], lowStock: [], stats: [], tabs: [] });
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [expandedViewItemId, setExpandedViewItemId] = useState<number | null>(null);
  const [materialDetailsById, setMaterialDetailsById] = useState<Record<number, InventoryMaterialDetails | null>>({});
  const [loadingMaterialItemId, setLoadingMaterialItemId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [savingEditItemId, setSavingEditItemId] = useState<number | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [ingredientItem, setIngredientItem] = useState<InventoryCreatedItem | null>(null);

  const [restockOpen, setRestockOpen] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [blueprintItemIds, setBlueprintItemIds] = useState<Set<number>>(new Set());

  // The backend already limits rows to the selected warehouse (or all, for the admin overview)
  const workspace = useWorkspace();
  const readOnly = !workspace.canModify;

  useEffect(() => {
    let mounted = true;

    // Fetch Inventory
    Promise.all([getInventoryOverview(), getItems()])
      .then(([overview, items]) => {
        if (mounted) {
          setInventoryItems(overview.items);
          setInventoryOverview(overview);
          setCategoryOptions(getItemCategoryOptions(items));
        }
      })
      .catch((error) => {
        console.error('Failed to load inventory items', error);
        if (mounted) {
          setInventoryItems([]);
          setCategoryOptions([]);
        }
      });

    getBlueprintProductIds()
      .then((ids) => {
        if (mounted) setBlueprintItemIds(ids);
      })
      .catch((error) => console.warn('Could not load blueprints for restock list', error));

    return () => {
      mounted = false;
    };
  }, []);

  const closeExpandedView = (): void => {
    setExpandedViewItemId(null);
  };

  const closeEditModal = (): void => {
    setEditingItemId(null);
  };

  const openCreateModal = (): void => {
    setCreateItemOpen(true);
  };

  const closeCreateModal = (): void => {
    setCreateItemOpen(false);
  };

  const closeIngredientModal = (): void => {
    setIngredientItem(null);
  };

  const handleViewClick = async (item: InventoryItem): Promise<void> => {
    const numericItemId = Number(item.id);

    if (expandedViewItemId === numericItemId) {
      closeExpandedView();
      return;
    }

    setExpandedViewItemId(numericItemId);

    if (Number.isNaN(numericItemId) || materialDetailsById[numericItemId] !== undefined) {
      return;
    }

    setLoadingMaterialItemId(numericItemId);

    try {
      const details = await getItemMaterialDetails(numericItemId);
      setMaterialDetailsById((current) => ({ ...current, [numericItemId]: details }));
    } catch (error) {
      console.error(`Failed to load materials for item ${numericItemId}`, error);
      setMaterialDetailsById((current) => ({ ...current, [numericItemId]: null }));
    } finally {
      setLoadingMaterialItemId((current) => (current === numericItemId ? null : current));
    }
  };

  const handleEditClick = (item: InventoryItem): void => {
    closeExpandedView();
    setEditingItemId(Number(item.id));
  };

  const handleSaveEdit = async (itemId: number, payload: InventoryItemUpdate): Promise<void> => {
    setSavingEditItemId(itemId);

    try {
      await updateInventoryItem(itemId, payload);
      const overview = await getInventoryOverview();
      setInventoryItems(overview.items);
      setInventoryOverview(overview);
      setEditingItemId(null);
    } catch (error) {
      console.error(`Failed to save item ${itemId}`, error);
      throw error;
    } finally {
      setSavingEditItemId((current) => (current === itemId ? null : current));
    }
  };

  const refreshInventory = async (): Promise<void> => {
    const overview = await getInventoryOverview();
    setInventoryItems(overview.items);
    setInventoryOverview(overview);
  };

  const handleCreateItem = async (payload: InventoryItemCreate, options: CreateItemOptions): Promise<InventoryCreatedItem> => {
    setCreatingItem(true);

    try {
      const createdItem = await createInventoryItem(payload);

      if (options.kind === 'material' && options.startingStock > 0 && workspace.activeBranchId != null) {
        await restockBranch(workspace.activeBranchId, [{ itemID: createdItem.itemID, quantity: options.startingStock }]);
      }

      await refreshInventory();
      setCreateItemOpen(false);

      if (options.kind === 'product') {
        // Crafted items need a recipe next
        setBlueprintItemIds((current) => new Set(current).add(createdItem.itemID));
        setIngredientItem(createdItem);
      } else {
        showSuccess(`${createdItem.itemName} added${options.startingStock > 0 ? ` with ${options.startingStock} in stock` : ''}.`);
      }
      return createdItem;
    } catch (error) {
      console.error('Failed to create inventory item', error);
      throw error;
    } finally {
      setCreatingItem(false);
    }
  };

  const handleRestock = async (lines: RestockLine[]): Promise<void> => {
    if (workspace.activeBranchId == null) return;
    setRestocking(true);
    try {
      await restockBranch(workspace.activeBranchId, lines);
      await refreshInventory();
      setRestockOpen(false);
      const units = lines.reduce((sum, line) => sum + line.quantity, 0);
      showSuccess(`Restocked ${lines.length} material${lines.length === 1 ? '' : 's'} (+${units} units).`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Restock failed.');
      throw error;
    } finally {
      setRestocking(false);
    }
  };

  const warehouseName = workspace.activeBranchId == null
    ? null
    : inventoryItems.find((item) => item.branchId === workspace.activeBranchId)?.location ?? workspace.user?.branchName ?? `Warehouse ${workspace.activeBranchId}`;

  const sourceItems = inventoryItems;

  const locationOptions = useMemo(() => {
    const locations = Array.from(new Set(sourceItems.map((item) => item.location))).sort((left, right) => (left || '').localeCompare(right || ''));

    return [
      { label: 'Location: All', value: 'ALL' },
      ...locations.filter(Boolean).map((location) => ({ label: `Location: ${location}`, value: location })),
    ];
  }, [sourceItems]);

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    const isActivelySearchingOrFiltering = searchLower.length > 0 || zone !== 'ALL';

    return sourceItems
      .filter((item) => {
        // FIX 1: Safely check for matches, accounting for an optional 's' at the end
        if (!isActivelySearchingOrFiltering && activeTab !== 'all') {
          const itemCategory = (item.category || '').toLowerCase();
          const itemTab = (item.tab || '').toLowerCase();
          const targetTab = activeTab.toLowerCase();
          
          const isMatch = (val1: string, val2: string) => 
            val1 === val2 || `${val1}s` === val2 || `${val2}s` === val1;

          if (!isMatch(itemCategory, targetTab) && !isMatch(itemTab, targetTab)) {
            return false;
          }
        }

        if (status !== 'ALL' && item.status !== status) {
          return false;
        }

        if (zone !== 'ALL' && item.location !== zone) {
          return false;
        }

        if (searchLower.length === 0) {
          return true;
        }

        const safeName = (item.name || '').toLowerCase();
        const safeSku = (item.sku || '').toLowerCase();
        const safeLocation = (item.location || '').toLowerCase();

        return (
          safeName.includes(searchLower) ||
          safeSku.includes(searchLower) ||
          safeLocation.includes(searchLower)
        );
      })
      .sort((left, right) => {
        if (sortBy === 'QTY') {
          return (right.quantity || 0) - (left.quantity || 0);
        }
        return (left.name || '').localeCompare(right.name || '');
      });
  }, [activeTab, sourceItems, search, sortBy, status, zone]);


  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Inventory Management"
        subtitle={`Full Inventory · ${currentDate}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:border-primary"
              onClick={openCreateModal}
            >
              New item
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium transition hover:bg-primaryDark ${readOnly ? 'is-readonly-disabled' : ''}`}
              style={{ color: 'var(--on-primary)' }}
              onClick={() => setRestockOpen(true)}
              disabled={readOnly}
              title={readOnly ? 'Switch to a warehouse to restock' : 'Add delivered materials to this warehouse'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Restock materials
            </button>
          </div>
        }
      />

      <AlertStrip items={inventoryOverview.lowStock} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {inventoryOverview.stats.map((stat) => (
          <StatCard key={stat.id} label={stat.label} value={stat.value} />
        ))}
      </div>

      <SectionCard title={workspace.isAllView ? 'All warehouses' : `${warehouseName ?? 'Warehouse'} inventory`} subtitle={`${sourceItems.length} stock rows`}>
        <div className="space-y-3">
          <div className="grid items-end gap-2 lg:grid-cols-[minmax(0,2.4fr),repeat(3,minmax(0,1fr))]">
            <SearchInput value={search} onChange={setSearch} placeholder="Search items, SKU, location..." />
            <FilterSelect
              value={status}
              onChange={setStatus}
              options={[
                { label: 'Status: All', value: 'ALL' },
                { label: 'Status: OK', value: 'OK' },
                { label: 'Status: Low', value: 'LOW' },
              ]}
            />
            <FilterSelect value={zone} onChange={setZone} options={locationOptions} />
            <FilterSelect
              value={sortBy}
              onChange={setSortBy}
              options={[
                { label: 'Sort: Name', value: 'NAME' },
                { label: 'Sort: Quantity', value: 'QTY' },
              ]}
            />
          </div>

          <Tabs tabs={inventoryOverview.tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="pb-2 font-medium">Material / SKU</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 font-medium">Prod.</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Edit</th>
                  <th className="pb-2 font-medium">View</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const itemId = Number(item.id);
                  const isExpanded = expandedViewItemId === itemId;
                  const uniqueRowKey = `${item.id}-${item.location || 'none'}-${index}`;

                  return (
                    <React.Fragment key={uniqueRowKey}>
                      <tr className={`border-b border-border/70 ${isExpanded ? 'bg-bg/30' : ''}`}>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-text">{item.name}</p>
                          <p className="text-xs text-muted">{item.sku}</p>
                        </td>
                        <td className="py-2.5 pr-3"><CategoryBadge category={item.category} /></td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-text">{item.quantity}</td>
                        <td className="py-2.5 pr-3">
                          <p className="text-xs text-muted">{item.productionTime} min</p>
                        </td>
                        <td className="inventory-location-cell py-2.5 pr-3 text-muted">{item.location}</td>
                        <td className="py-2.5 pr-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            className={`icon-action-button ${readOnly ? 'is-readonly-disabled' : ''}`}
                            aria-label={`Edit ${item.name}`}
                            title={readOnly ? 'Switch to a warehouse to edit' : `Edit ${item.name}`}
                            disabled={readOnly}
                            onClick={() => handleEditClick(item)}
                          >
                            <img src={editIcon} alt="" aria-hidden="true" className="icon-action-button-icon" />
                            <span className="sr-only">Edit</span>
                          </button>
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            className={`icon-action-button ${isExpanded ? 'border-primary bg-bg text-text' : ''}`}
                            aria-label={`View ${item.name}`}
                            aria-controls={`inventory-details-${item.id}`}
                            aria-expanded={isExpanded}
                            onClick={() => {
                              void handleViewClick(item);
                            }}
                          >
                            <img src={viewIcon} alt="" aria-hidden="true" className="icon-action-button-icon" />
                            <span className="sr-only">View</span>
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-b border-border/70 bg-app/60">
                          <td colSpan={8} className="px-0 py-3">
                            <div id={`inventory-details-${item.id}`} className="inventory-view-details px-0 sm:px-1">
                              <InventoryMaterialsPopover
                                loading={loadingMaterialItemId === itemId && materialDetailsById[itemId] === undefined}
                                details={materialDetailsById[itemId] ?? null}
                                compact
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {filteredItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No items match your current filters.</p>
            ) : null}
          </div>
          <InventoryItemEditModal
            item={editingItemId != null ? sourceItems.find((candidate) => Number(candidate.id) === editingItemId) ?? null : null}
            open={editingItemId != null}
            saving={savingEditItemId === editingItemId}
            onClose={closeEditModal}
            onSave={handleSaveEdit}
            categoryOptions={categoryOptions}
          />

          <InventoryItemCreateModal
            open={createItemOpen}
            saving={creatingItem}
            categoryOptions={categoryOptions}
            warehouseName={warehouseName}
            onClose={closeCreateModal}
            onCreate={handleCreateItem}
          />

          <RestockModal
            open={restockOpen}
            warehouseName={warehouseName ?? 'Warehouse'}
            items={sourceItems}
            blueprintItemIds={blueprintItemIds}
            saving={restocking}
            onClose={() => setRestockOpen(false)}
            onSubmit={handleRestock}
          />

          <InventoryItemIngredientModal
            item={ingredientItem}
            open={ingredientItem != null}
            onClose={closeIngredientModal}
          />
        </div>
      </SectionCard>
    </div>
  );
}

export default InventoryPage;