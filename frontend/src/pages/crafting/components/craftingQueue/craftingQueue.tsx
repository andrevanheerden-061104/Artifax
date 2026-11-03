import React, { FC, useEffect, useState } from 'react';
import './craftingQueue.css';
import { useApi } from '../../../../hooks';
import { useCurrentUser } from '../../../../utils/currentUser';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { CategoryTile, categoryStyle } from '../../../../components/common/categories';
import { calculateProgress, formatTimeLeft, normalizeQueueStatus, QueueJobStatus } from '../../../../services/craftingUtils';

const itemsPerPage = 3;

type OrderDto = {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  createdDateTime: string;
  totalTime?: number;
  timeElapsed?: number;
  status: string;
  branchID?: number;
  BranchID?: number;
  employeeID?: number;
  orderExpedite?: boolean;
};

type EmployeeDto = {
  employeeId: number;
  employeeName: string;
};

type BranchDto = {
  BranchID?: number;
  branchID?: number;
  BranchName?: string;
  branchName?: string;
};

type CraftingJob = {
  orderID: number;
  itemID: number;
  name: string;
  qty: number;
  status: QueueJobStatus;
  progress: number;
  timeLeft: string;
  materials: string[];
  employeeName: string;
  createdDateTime: string;
  branchID: number;
  branchName: string;
};

const CraftingQueue: FC = () => {
  const api = useApi();
  const currentUser = useCurrentUser();
  const [page, setPage] = useState<number>(1);
  const [activeJobs, setActiveJobs] = useState<CraftingJob[]>([]);
  const [queuedJobs, setQueuedJobs] = useState<CraftingJob[]>([]);
  const [branchMap, setBranchMap] = useState<Record<number, string>>({});

  const catalog = useItemCatalog();

  useEffect(() => {
    const REFRESH_INTERVAL_MS = 60_000;
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadJobs = async (): Promise<void> => {
      try {
        const [ordersResponse, userResponse, branchesResponse] = await Promise.all([
          api.get<OrderDto[]>('/Order'),
          api.get<EmployeeDto[]>('/User'),
          api.get<BranchDto[]>('/Branch'),
        ]);

        const branchMapFromApi = (branchesResponse.data ?? []).reduce<Record<number, string>>((map, branch) => {
          const branchId = branch.BranchID ?? branch.branchID ?? 0;
          const branchName = branch.BranchName ?? branch.branchName ?? '';
          if (branchId > 0 && branchName) {
            map[branchId] = branchName;
          }
          return map;
        }, {});

        setBranchMap(branchMapFromApi);

        const employees = (userResponse.data as EmployeeDto[]).reduce<Record<number, string>>((map, user) => {
          if (user.employeeId != null) {
            map[user.employeeId] = user.employeeName;
          }
          return map;
        }, {});

        // The backend already returns only the warehouse being viewed
        const allowedBranchIds: number[] = [];

        const orders = ordersResponse.data
          .slice()
          .sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime())
          .filter((order) => {
            const status = normalizeQueueStatus(order.status);
            if (status !== 'Queued' && status !== 'Active' && status !== 'Paused') {
              return false;
            }

            const orderBranchId = order.branchID ?? order.BranchID ?? 0;
            if (allowedBranchIds.length > 0) {
              return allowedBranchIds.includes(orderBranchId);
            }

            return true;
          });

        const jobs = orders.map((order) => {
          const expedited = order.orderExpedite === true;
          const status = normalizeQueueStatus(order.status) ?? 'Queued';
          const branchID = order.branchID ?? order.BranchID ?? 0;

          return {
            orderID: order.orderID,
            itemID: order.itemID,
            name: order.itemName || `Order ${order.orderID}`,
            qty: order.quantity ?? 1,
            status,
            progress: calculateProgress(order.totalTime, order.timeElapsed, expedited),
            timeLeft: formatTimeLeft(order.totalTime, order.timeElapsed, expedited),
            materials: [order.itemName || `Item ${order.itemID}`],
            employeeName: employees[order.employeeID ?? 0] ?? 'Unknown Employee',
            createdDateTime: order.createdDateTime,
            branchID,
            branchName: branchMapFromApi[branchID] ?? `Branch ${branchID}`,
          };
        });

        if (!isMounted) return;

        setActiveJobs(jobs.filter((job) => job.status === 'Active' || job.status === 'Paused'));
        setQueuedJobs(jobs.filter((job) => job.status === 'Queued'));
      } catch (error) {
        console.error('Failed to load crafting queue orders', error);
      }
    };

    const refreshJobs = async (): Promise<void> => {
      if (!isMounted) return;
      await loadJobs();
    };

    const listener = (): void => {
      if (isMounted) {
        void refreshJobs();
      }
    };

    void refreshJobs();
    intervalId = setInterval(() => {
      void refreshJobs();
    }, REFRESH_INTERVAL_MS);

    window.addEventListener('crafting-order-updated', listener);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('crafting-order-updated', listener);
    };
  }, [api, currentUser]);

  const queuedPageCount = Math.ceil(queuedJobs.length / itemsPerPage);
  const totalPages = queuedPageCount > 0 ? queuedPageCount + 1 : 1;
  const pageItems = page > 1
    ? queuedJobs.slice((page - 2) * itemsPerPage, (page - 1) * itemsPerPage)
    : [];
  const activeCount = activeJobs.length;

  const handlePrevious = (): void => setPage((prev) => Math.max(1, prev - 1));
  const handleNext = (): void => setPage((prev) => Math.min(totalPages, prev + 1));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="queue-sidebar">
      <div className="queue-header">
        <div className="queue-title-row">
          <h3>Crafting Queue</h3>
          <span className="queue-count">{activeCount} / 3</span>
        </div>
        <p className="limit-note">Maximum 3 active crafts per location</p>
      </div>

      {page === 1 ? (
        <div className="queue-section">
          <h4 className="queue-section-title">Active Crafts</h4>
          {activeJobs.length === 0 && <p className="empty-state">No active crafts right now.</p>}
          {activeJobs.map((item) => (
            <div key={item.orderID} className={`queue-item queue-item--themed ${item.status === 'Paused' ? 'is-paused' : ''}`} style={categoryStyle(catalog[item.itemID]?.category)}>
              <div className="queue-item-header">
                <div className="item-info">
                  <CategoryTile category={catalog[item.itemID]?.category} size="sm" />
                  <div>
                    <h4>{item.name} x{item.qty} · {item.branchName}</h4>
                    <p>{item.status} · {item.employeeName}</p>
                  </div>
                </div>
                <span className={`queue-badge ${item.status.toLowerCase().replace(' ', '-')}`}>
                  {item.status}
                </span>
              </div>
              <div className="queue-progress" aria-hidden="true">
                <span style={{ width: `${item.progress}%` }} />
              </div>
              <div className="waiting-status">
                <span>{item.progress}% complete</span>
                <span>{item.timeLeft}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="queue-section">
          <h4 className="queue-section-title">Up Next</h4>
          {pageItems.length === 0 && <p className="empty-state">No queued items ready yet.</p>}
          {pageItems.map((item) => (
            <div key={item.orderID} className={`queue-item queue-item--themed ${item.status === 'Paused' ? 'is-paused' : ''}`} style={categoryStyle(catalog[item.itemID]?.category)}>
              <div className="queue-item-header">
                <div className="item-info">
                  <CategoryTile category={catalog[item.itemID]?.category} size="sm" />
                  <div>
                    <h4>{item.name} x{item.qty} · {item.branchName}</h4>
                    <p>Queued · Created {new Intl.DateTimeFormat('en-ZA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdDateTime))}</p>
                  </div>
                </div>
                <span className={`queue-badge ${item.status.toLowerCase().replace(' ', '-')}`}>
                  {item.status}
                </span>
              </div>
              <div className="waiting-status">
                <span>Waiting to start</span>
                <span>{item.timeLeft}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="queue-footer">
        <button type="button" onClick={handlePrevious} disabled={page === 1}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button type="button" onClick={handleNext} disabled={page === totalPages}>Next</button>
      </div>
    </div>
  );
};

export default CraftingQueue;
