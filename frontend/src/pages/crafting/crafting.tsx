import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import './crafting.css';
import AlertStrip from '../../components/layout/AlertStrip';
import PageHeader from '../../components/layout/PageHeader';
import CraftingNav from './components/craftingNav/craftingNav';
import StatsGrid from './components/stats/stats';
import HistoryStats from './components/historyStats/historyStats';
import HistoryPanel from './components/historyPanel/historyPanel';
import CraftingItems from './components/craftingItems/craftingItems';
import CraftingQueue from './components/craftingQueue/craftingQueue';
import CraftPanel, { WarehouseOption } from './components/craftPanel/craftPanel';
import BlueprintPanel from './components/blueprintPanel/blueprintPanel';
import NewBlueprint from './components/newBlueprint/newBlueprint';
import BlueprintEdit from './components/blueprintEdit/BlueprintEdit';
import { useApi } from '../../hooks';
import { getApiErrorMessage } from '../../hooks/useApi';
import { showError, showSuccess } from '../../utils/toast';
import { getInventoryOverview, LowStockEntry } from '../../services/inventoryApi';
import { loadBlueprints } from '../../services/blueprintApi';
import { Blueprint } from './components/craftingData';
import { getCurrentDateSAST } from '../../Date/dateUtils';
import { useWorkspace } from '../../utils/workspace';

interface PageProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const ActiveJobsPage: FC = () => (
  <div className="crafting-panel">
    <StatsGrid />
  </div>
);

const ActiveJobsContent: FC = () => (
  <div className="crafting-panel">
    <div className="active-jobs-layout">
      <div className="active-jobs-main">
        <CraftingItems />
      </div>
      <div className="active-jobs-sidebar">
        <CraftingQueue />
      </div>
    </div>
  </div>
);

interface CraftPageProps {
  blueprints: Blueprint[];
  blueprintsLoading: boolean;
  blueprintsError: string | null;
  selectedBlueprintId: string;
  selectedBlueprint: Blueprint | null;
  amount: number;
  orderExpedite: boolean;
  filter: string;
  sourceBranchId: number | null;
  targetBranchId: number | null;
  chooseWarehouses: boolean;
  warehouses: WarehouseOption[];
  submitting: boolean;
  onSourceChange: (branchId: number) => void;
  onTargetChange: (branchId: number) => void;
  onFilterChange: (filter: string) => void;
  onSelectBlueprint: (blueprintId: string) => void;
  onAmountChange: (amount: number) => void;
  onToggleExpedite: () => void;
  onCraft: () => Promise<void>;
  onEditBlueprint: () => void;
  onDeleteBlueprint: () => void;
}

const CraftPage: FC<PageProps & CraftPageProps> = ({
  activeTab,
  onTabChange,
  blueprints,
  blueprintsLoading,
  blueprintsError,
  selectedBlueprintId,
  selectedBlueprint,
  amount,
  orderExpedite,
  filter,
  sourceBranchId,
  targetBranchId,
  chooseWarehouses,
  warehouses,
  submitting,
  onSourceChange,
  onTargetChange,
  onFilterChange,
  onSelectBlueprint,
  onAmountChange,
  onToggleExpedite,
  onCraft,
  onEditBlueprint,
  onDeleteBlueprint,
}) => {
  const blueprintPanel = (
    <BlueprintPanel
      blueprints={blueprints}
      loading={blueprintsLoading}
      error={blueprintsError}
      selectedBlueprintId={selectedBlueprintId}
      filter={filter}
      onFilterChange={onFilterChange}
      onSelectBlueprint={onSelectBlueprint}
      onCreateBlueprint={() => onTabChange('new')}
    />
  );

  if (!selectedBlueprint) {
    return (
      <div className="crafting-panel">
        <HistoryStats />
        <CraftingNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          onCreateBlueprint={() => onTabChange('new')}
        />
        <div className="active-jobs-layout">
          <div className="active-jobs-main">
            <div className="craft-panel-card">
              <div className="craft-panel-header">
                <h3>Crafting</h3>
              </div>
              <div className="craft-panel-selected">
                <span className="craft-panel-label">SELECT BLUEPRINT</span>
                <h4>{blueprintsLoading ? 'Loading blueprints…' : 'No Blueprint Selected'}</h4>
                <p style={{ color: 'var(--muted)', marginTop: '8px' }}>
                  Select a blueprint from the list to begin crafting
                </p>
              </div>
            </div>
          </div>
          <div className="active-jobs-sidebar">
            {blueprintPanel}
            <CraftingQueue />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="crafting-panel">
      <HistoryStats />
      <CraftingNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateBlueprint={() => onTabChange('new')}
      />
      <div className="active-jobs-layout">
        <div className="active-jobs-main">
          <CraftPanel
            blueprint={selectedBlueprint}
            amount={amount}
            orderExpedite={orderExpedite}
            sourceBranchId={sourceBranchId}
            targetBranchId={targetBranchId}
            chooseWarehouses={chooseWarehouses}
            warehouses={warehouses}
            submitting={submitting}
            onSourceChange={onSourceChange}
            onTargetChange={onTargetChange}
            onAmountChange={onAmountChange}
            onToggleExpedite={onToggleExpedite}
            onCraft={onCraft}
            onEdit={onEditBlueprint}
            onDelete={onDeleteBlueprint}
          />
        </div>
        <div className="active-jobs-sidebar">
          {blueprintPanel}
          <CraftingQueue />
        </div>
      </div>
    </div>
  );
};

const HistoryPage: FC<PageProps> = ({ activeTab, onTabChange }) => (
  <div className="crafting-panel">
    <HistoryStats />
    <CraftingNav
      activeTab={activeTab}
      onTabChange={onTabChange}
      onCreateBlueprint={() => onTabChange('new')}
    />
    <HistoryPanel />
  </div>
);

const NewBlueprintPage: FC<PageProps & { onCancel: () => void }> = ({ activeTab, onTabChange, onCancel }) => (
  <div className="crafting-panel">
    <HistoryStats />
    <CraftingNav
      activeTab={activeTab}
      onTabChange={onTabChange}
      onCreateBlueprint={() => onTabChange('new')}
    />
    <div className="new-blueprint-page">
      <NewBlueprint onCancel={onCancel} />
    </div>
  </div>
);

const BlueprintEditPage: FC<PageProps & { itemId: number | null; onCancel: () => void; onSaved: () => void }> = ({ activeTab, onTabChange, itemId, onCancel, onSaved }) => {
  if (!itemId) return null;

  return (
    <div className="crafting-panel">
      <HistoryStats />
      <CraftingNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateBlueprint={() => onTabChange('new')}
      />
      <div className="new-blueprint-page">
        <BlueprintEdit itemId={itemId} onCancel={onCancel} onSaved={onSaved} />
      </div>
    </div>
  );
};

const Crafting: FC = () => {
  const [activeTab, setActiveTab] = useState<string>('active');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  const [orderExpedite, setOrderExpedite] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('all');
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockEntry[]>([]);
  const [blueprintRefreshKey, setBlueprintRefreshKey] = useState<number>(0);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [blueprintsLoading, setBlueprintsLoading] = useState<boolean>(true);
  const [blueprintsError, setBlueprintsError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [chosenSource, setChosenSource] = useState<number | null>(null);
  const [chosenTarget, setChosenTarget] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const api = useApi();
  const workspace = useWorkspace();
  const currentDate = getCurrentDateSAST();

  // In a single warehouse, materials come from and go to that warehouse.
  // In the admin overview, the admin picks both.
  const chooseWarehouses = workspace.isAllView;
  const sourceBranchId = chooseWarehouses ? chosenSource : workspace.activeBranchId;
  const targetBranchId = chooseWarehouses ? chosenTarget : workspace.activeBranchId;

  const selectedBlueprint = useMemo(
    () => blueprints.find((blueprint) => blueprint.id === selectedBlueprintId) ?? null,
    [blueprints, selectedBlueprintId],
  );

  useEffect(() => {
    let mounted = true;
    setBlueprintsLoading(true);
    setBlueprintsError(null);
    loadBlueprints()
      .then((rows) => {
        if (mounted) setBlueprints(rows);
      })
      .catch((error) => {
        console.error('Error fetching blueprints:', error);
        if (mounted) setBlueprintsError(getApiErrorMessage(error, 'Could not load blueprints.'));
      })
      .finally(() => {
        if (mounted) setBlueprintsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [blueprintRefreshKey]);

  useEffect(() => {
    api
      .get<Array<Record<string, unknown>>>('/Branch')
      .then((response) => {
        const rows = (response.data ?? [])
          .map((row) => ({
            id: Number(row.branchID ?? row.BranchID ?? 0),
            name: String(row.branchName ?? row.BranchName ?? ''),
          }))
          .filter((row) => row.id > 0)
          .sort((left, right) => left.id - right.id);
        setWarehouses(rows);
        if (rows.length > 0) {
          setChosenSource((current) => current ?? rows[0].id);
          setChosenTarget((current) => current ?? rows[0].id);
        }
      })
      .catch((error) => console.error('Failed to load warehouses', error));
  }, [api]);

  const handleSelectBlueprint = useCallback((blueprintId: string) => {
    setSelectedBlueprintId(blueprintId);
    setAmount(1);
  }, []);

  const handleCraft = async (): Promise<void> => {
    if (!selectedBlueprint) return;

    const itemId = parseInt(selectedBlueprint.id.replace('bp-', ''), 10);
    if (Number.isNaN(itemId)) return;

    if (sourceBranchId == null || targetBranchId == null) {
      showError('Choose where the materials come from and where to craft.');
      return;
    }

    setSubmitting(true);
    try {
      // The backend checks stock, takes the materials out and queues the order in one step
      await api.post('/Order/create', {
        itemID: itemId,
        quantity: amount,
        branchID: targetBranchId,
        sourceBranchID: sourceBranchId,
        employeeID: workspace.user?.employeeId ?? 0,
        orderExpedite,
      });

      const route =
        sourceBranchId === targetBranchId
          ? ''
          : ` (materials from ${warehouses.find((w) => w.id === sourceBranchId)?.name ?? 'another warehouse'})`;
      showSuccess(`Crafting ${amount} × ${selectedBlueprint.name}${route}.`);
      setAmount(1);
      setBlueprintRefreshKey((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent('crafting-order-updated'));
    } catch (error) {
      console.error('Failed to create craft order', error);
      showError(getApiErrorMessage(error, 'Unable to place craft order. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBlueprint = (): void => {
    if (!selectedBlueprintId) {
      return;
    }

    const itemId = parseInt(selectedBlueprintId.replace('bp-', ''));
    setEditItemId(itemId);
    setActiveTab('edit');
  };

  const handleDeleteBlueprint = async (): Promise<void> => {
    if (!selectedBlueprintId) {
      return;
    }

    const itemId = parseInt(selectedBlueprintId.replace('bp-', ''));
    const confirmed = window.confirm('Delete this blueprint and item? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/Item/${itemId}`);
      showSuccess('Blueprint deleted successfully.');
      setSelectedBlueprintId('');
      setAmount(1);
      setActiveTab('active');
      setBlueprintRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('Error deleting blueprint:', error);
      showError('Unable to delete blueprint. Please try again.');
    }
  };

  useEffect(() => {
    const loadLowStock = async (): Promise<void> => {
      try {
        const overview = await getInventoryOverview();
        setLowStockAlerts(overview.lowStock);
      } catch (error) {
        console.error('Failed to load low stock alerts', error);
      }
    };

    void loadLowStock();
  }, [blueprintRefreshKey]);

  return (
    <div className="page-content">
      <div className="space-y-4 sm:space-y-5">
        <PageHeader
          title="Crafting Management"
          subtitle={`Crafting Dashboard · ${currentDate}`}
        />
        <AlertStrip items={lowStockAlerts} />

        <div className="crafting-page">
          {activeTab === 'active' && <ActiveJobsPage />}
          {activeTab === 'history' && <HistoryPage activeTab={activeTab} onTabChange={setActiveTab} />}
          {activeTab === 'craft' && (
            <CraftPage
              activeTab={activeTab}
              onTabChange={setActiveTab}
              blueprints={blueprints}
              blueprintsLoading={blueprintsLoading}
              blueprintsError={blueprintsError}
              selectedBlueprintId={selectedBlueprintId}
              selectedBlueprint={selectedBlueprint}
              amount={amount}
              orderExpedite={orderExpedite}
              filter={filter}
              sourceBranchId={sourceBranchId}
              targetBranchId={targetBranchId}
              chooseWarehouses={chooseWarehouses}
              warehouses={warehouses}
              submitting={submitting}
              onSourceChange={setChosenSource}
              onTargetChange={setChosenTarget}
              onFilterChange={setFilter}
              onSelectBlueprint={handleSelectBlueprint}
              onAmountChange={setAmount}
              onToggleExpedite={() => setOrderExpedite((prev) => !prev)}
              onCraft={handleCraft}
              onEditBlueprint={handleEditBlueprint}
              onDeleteBlueprint={handleDeleteBlueprint}
            />
          )}
          {activeTab === 'new' && (
            <NewBlueprintPage
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onCancel={() => {
                setBlueprintRefreshKey((prev) => prev + 1);
                setActiveTab('craft');
              }}
            />
          )}
          {activeTab === 'edit' && (
            <BlueprintEditPage
              activeTab={activeTab}
              onTabChange={setActiveTab}
              itemId={editItemId}
              onCancel={() => setActiveTab('craft')}
              onSaved={() => {
                setActiveTab('craft');
                setBlueprintRefreshKey((prev) => prev + 1);
              }}
            />
          )}
          {activeTab === 'active' && <CraftingNav activeTab={activeTab} onTabChange={setActiveTab} onCreateBlueprint={() => setActiveTab('new')} />}
          {activeTab === 'active' && <ActiveJobsContent />}
        </div>
      </div>
    </div>
  );
};

export default Crafting;
