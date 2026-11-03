import { FC, useEffect, useState } from 'react';
import './historyStats.css';
import { useApi } from '../../../../hooks';
import KpiCard from '../../../../components/common/KpiCard';

interface OrderDto {
  orderID: number;
  quantity: number;
  status: string;
  createdDateTime?: string | null;
  completedDateTime?: string | null;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h${mins > 0 ? ` ${mins}m` : ''}`;
};

const HistoryStats: FC = () => {
  const api = useApi();
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [cancelledItems, setCancelledItems] = useState<number>(0);
  const [completedItems, setCompletedItems] = useState<number>(0);
  const [avgDuration, setAvgDuration] = useState<string>('N/A');

  useEffect(() => {
    const loadStats = async (): Promise<void> => {
      try {
        const response = await api.get<OrderDto[]>('/Order');
        const orders = response.data || [];

        // Total Jobs: number of orders in queue
        const queuedCount = orders.filter((o) => (o.status || '').toLowerCase() === 'queued').length;

        // Cancelled: sum of quantities for cancelled orders
        const cancelledSum = orders
          .filter((o) => (o.status || '').toLowerCase() === 'cancelled')
          .reduce((sum, o) => sum + (o.quantity || 0), 0);

        // Completed: sum of quantities for completed orders
        const completedSum = orders
          .filter((o) => (o.status || '').toLowerCase() === 'complete' || (o.status || '').toLowerCase() === 'completed')
          .reduce((sum, o) => sum + (o.quantity || 0), 0);

        // Avg Duration: average minutes between created and completed for completed orders
        const durations: number[] = orders
          .filter((o) => (o.status || '').toLowerCase() === 'complete' || (o.status || '').toLowerCase() === 'completed')
          .map((o) => {
            if (!o.createdDateTime || !o.completedDateTime) return 0;
            const start = new Date(o.createdDateTime).getTime();
            const end = new Date(o.completedDateTime).getTime();
            if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
            return (end - start) / 60000; // minutes
          })
          .filter((m) => m > 0);

        const avgMin = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        setTotalJobs(queuedCount);
        setCancelledItems(cancelledSum);
        setCompletedItems(completedSum);
        setAvgDuration(durations.length ? formatDuration(avgMin) : 'N/A');
      } catch (err) {
        // Keep defaults on error
        console.error('Failed to load history stats', err);
      }
    };

    void loadStats();
  }, [api]);

  return (
    <div className="kpi-grid history-kpis">
      <KpiCard label="In queue" value={totalJobs} caption="Waiting to start" tone="blue" icon="list" />
      <KpiCard label="Cancelled" value={cancelledItems} caption="Units cancelled" tone="red" icon="cross" />
      <KpiCard label="Completed" value={completedItems} caption="Units crafted" tone="green" icon="check" />
      <KpiCard label="Avg duration" value={avgDuration} caption="Order to finish" tone="orange" icon="clock" />
    </div>
  );
};

export default HistoryStats;
