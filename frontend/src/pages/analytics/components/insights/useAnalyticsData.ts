import { useEffect, useState } from 'react';
import { api } from '../../../../hooks/useApi';
import { loadBlueprints } from '../../../../services/blueprintApi';
import { Blueprint } from '../../../crafting/components/craftingData';

export type AnalyticsOrder = {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  status: string;
  createdDateTime?: string | null;
  startedDateTime?: string | null;
  completedDateTime?: string | null;
  branchID?: number;
};

export type AnalyticsData = {
  orders: AnalyticsOrder[];
  blueprints: Blueprint[];
  loading: boolean;
  error: string | null;
};

/** Orders + blueprints (with stock) for the analytics page — loaded once, shared by its cards. */
export function useAnalyticsData(): AnalyticsData {
  const [state, setState] = useState<AnalyticsData>({ orders: [], blueprints: [], loading: true, error: null });

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get<AnalyticsOrder[]>('/Order'), loadBlueprints()])
      .then(([ordersResponse, blueprints]) => {
        if (!mounted) return;
        setState({ orders: ordersResponse.data ?? [], blueprints, loading: false, error: null });
      })
      .catch((error) => {
        console.error('Unable to load analytics', error);
        if (mounted) setState({ orders: [], blueprints: [], loading: false, error: 'Could not load analytics right now.' });
      });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export const isComplete = (status: string) => ['complete', 'completed'].includes((status ?? '').toLowerCase());
export const isCancelled = (status: string) => ['cancelled', 'canceled'].includes((status ?? '').toLowerCase());

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function orderDate(order: AnalyticsOrder): Date | null {
  const raw = order.completedDateTime ?? order.startedDateTime ?? order.createdDateTime;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
