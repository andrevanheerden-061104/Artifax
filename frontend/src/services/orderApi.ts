import { calculateProgress, formatTimeLeft, normalizeQueueStatus, QueueJobStatus } from './craftingUtils';
import { api as apiClient } from '../hooks/useApi';
import axios from 'axios';

function toFetchStyleError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;

    if (status != null) {
      return new Error(`Fetch error ${status} ${statusText ?? ''}`.trim());
    }

    if (error.message) {
      return new Error(error.message);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Request failed');
}

type OrderItemDto = {
  itemName: string;
  quantity: number;
};

type OrderDto = {
  orderID: number;
  orderDateTime: string;
  status: string;
  orderItems: OrderItemDto[];
};

type OrderStatusUpdateDto = {
  status: string;
};

export type CraftingJobStatus = 'In Progress' | 'Paused' | 'Queued';

export type CraftingJob = {
  id: string;
  name: string;
  qty: number;
  status: CraftingJobStatus;
  progress: number;
  timeLeft: string;
  materials: string[];
  location: string;
  type: 'electronics' | 'mechanical' | 'logistics';
  icon: string;
};

export type QueueJob = {
  orderID: number;
  id: string;
  name: string;
  qty: number;
  status: QueueJobStatus;
  progress: number;
  timeLeft: string;
  materials: string[];
  employeeName: string;
  createdDateTime: string;
  location: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await apiClient.get<T>(url);
    return response.data;
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function normalizeStatus(status: string): CraftingJobStatus | null {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'in progress') return 'In Progress';
  if (normalized === 'pending') return 'Queued';
  if (normalized === 'paused') return 'Paused';

  return null;
}

function deriveJobType(name: string): CraftingJob['type'] {
  const lower = name.toLowerCase();

  if (lower.includes('package') || lower.includes('box')) return 'logistics';
  if (lower.includes('board') || lower.includes('panel') || lower.includes('control') || lower.includes('circuit')) return 'electronics';

  return 'mechanical';
}

export async function getOrders(): Promise<OrderDto[]> {
  return fetchJson<OrderDto[]>('Order');
}

export async function getUsers(): Promise<any[]> {
  return fetchJson<any[]>('User');
}

type OrderReadDto = {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  createdDateTime: string;
  totalTime?: number;
  timeElapsed?: number;
  status: string;
  branchID?: number;
  sourceBranchID?: number;
  employeeID?: number;
  orderExpedite?: boolean;
};

/**
 * Active + queued crafting jobs for the dashboard.
 * The backend already limits orders to the warehouse being viewed.
 */
export async function getCraftingQueue(): Promise<{ activeItems: QueueJob[]; queuedItems: QueueJob[] }> {
  const [orders, users, branches] = await Promise.all([
    fetchJson<OrderReadDto[]>('Order'),
    getUsers().catch(() => [] as any[]),
    fetchJson<Array<Record<string, unknown>>>('Branch').catch(() => [] as Array<Record<string, unknown>>),
  ]);

  const employeeMap = (users ?? []).reduce<Record<number, string>>((map, user: any) => {
    if (user.employeeId != null) map[user.employeeId] = user.employeeName;
    return map;
  }, {});

  const branchMap = (branches ?? []).reduce<Record<number, string>>((map, branch) => {
    const id = Number(branch.branchID ?? branch.BranchID ?? 0);
    if (id) map[id] = String(branch.branchName ?? branch.BranchName ?? `Warehouse ${id}`);
    return map;
  }, {});

  const jobs: QueueJob[] = (orders ?? [])
    .map((order) => ({ order, status: normalizeQueueStatus(order.status) }))
    .filter((entry): entry is { order: OrderReadDto; status: QueueJobStatus } => entry.status != null)
    .sort((left, right) => new Date(left.order.createdDateTime).getTime() - new Date(right.order.createdDateTime).getTime())
    .map(({ order, status }) => {
      const expedited = order.orderExpedite === true;
      return {
        orderID: order.orderID,
        id: `#${order.orderID}`,
        name: order.itemName || `Order ${order.orderID}`,
        qty: order.quantity ?? 1,
        status,
        progress: calculateProgress(order.totalTime, order.timeElapsed, expedited),
        timeLeft: formatTimeLeft(order.totalTime, order.timeElapsed, expedited),
        materials: [],
        employeeName: employeeMap[order.employeeID ?? 0] ?? 'Unknown employee',
        createdDateTime: order.createdDateTime,
        location: branchMap[order.branchID ?? 0] ?? `Warehouse ${order.branchID ?? '?'}`,
      };
    });

  return {
    activeItems: jobs.filter((job) => job.status === 'Active' || job.status === 'Paused'),
    queuedItems: jobs.filter((job) => job.status === 'Queued'),
  };
}

export async function getCraftingJobs(): Promise<CraftingJob[]> {
  const orders = await getOrders();

  return orders
    .map((order) => {
      const status = normalizeStatus(order.status);

      if (status == null) {
        return null;
      }

      const totalQuantity = order.orderItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      const primaryItem = order.orderItems[0]?.itemName ?? `Order #${order.orderID}`;
      const materialLabels = order.orderItems.map((item) => `${item.itemName} x${item.quantity}`);

      return {
        id: `order-${order.orderID}`,
        name: primaryItem,
        qty: totalQuantity || order.orderItems.length || 1,
        status,
        progress: status === 'In Progress' ? 45 : 0,
        timeLeft: formatDateTime(order.orderDateTime),
        materials: materialLabels,
        location: `Order ${order.orderID}`,
        type: deriveJobType(primaryItem),
        icon: 'unitIcon',
      } satisfies CraftingJob;
    })
    .filter((job): job is CraftingJob => job != null)
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'In Progress' ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    });
}

export async function getActiveAndQueuedJobs(): Promise<{ activeItems: CraftingJob[]; queuedItems: CraftingJob[] }> {
  const jobs = await getCraftingJobs();

  return {
    activeItems: jobs.filter((job) => job.status !== 'Queued'),
    queuedItems: jobs.filter((job) => job.status === 'Queued'),
  };
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  try {
    await apiClient.put(`Order/${orderId}/status`, { status } satisfies OrderStatusUpdateDto);
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

export async function deleteOrder(orderId: number): Promise<void> {
  try {
    await apiClient.delete(`Order/${orderId}`);
  } catch (error) {
    throw toFetchStyleError(error);
  }
}

const orderApi = {
  getOrders,
  getUsers,
  getCraftingQueue,
  getCraftingJobs,
  getActiveAndQueuedJobs,
  updateOrderStatus,
  deleteOrder,
};

export default orderApi;
