import { FC, useEffect, useState } from 'react';
import './stats.css';
import { useApi } from '../../../../hooks';
import KpiCard from '../../../../components/common/KpiCard';

const StatsGrid: FC = () => {
  const api = useApi();
  const [recipeCount, setRecipeCount] = useState<number>(0);
  const [activeJobs, setActiveJobs] = useState<number>(0);
  const [completedJobs, setCompletedJobs] = useState<number>(0);
  const [cancelledJobs, setCancelledJobs] = useState<number>(0);

  useEffect(() => {
    const loadStats = async (): Promise<void> => {
      try {
        const [blueprintsResponse, ordersResponse] = await Promise.all([
          api.get<any[]>('/Item/item/allItemBlueprints'),
          api.get<any[]>('/Order'),
        ]);

        const blueprints = blueprintsResponse.data ?? [];
        const orders = ordersResponse.data ?? [];

        setRecipeCount(Array.isArray(blueprints) ? blueprints.length : 0);

        const normalizedStatuses = orders.map((order) => String(order.status ?? '').trim().toLowerCase());
        setActiveJobs(normalizedStatuses.filter((status) => status === 'active').length);
        setCompletedJobs(normalizedStatuses.filter((status) => status === 'complete' || status === 'completed').length);
        setCancelledJobs(normalizedStatuses.filter((status) => status === 'cancelled' || status === 'canceled').length);
      } catch (error) {
        console.error('Failed to load crafting stats', error);
      }
    };

    void loadStats();
  }, [api]);

  return (
    <div className="kpi-grid">
      <KpiCard label="Recipes" value={recipeCount} caption="Blueprints you can craft" tone="violet" icon="book" />
      <KpiCard label="Active jobs" value={activeJobs} caption="Crafting right now" tone="cyan" icon="bolt" />
      <KpiCard label="Completed" value={completedJobs} caption="Finished orders" tone="green" icon="check" />
      <KpiCard label="Cancelled" value={cancelledJobs} caption="Stopped before finishing" tone="red" icon="cross" />
    </div>
  );
};

export default StatsGrid;
