import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { DirectoryUser, UserAvatar, roleColor } from './UserDirectory';
import { api } from '../../../../hooks/useApi';
import { useItemCatalog } from '../../../../hooks/useItemCatalog';
import { CategoryTile, categoryStyle } from '../../../../components/common/categories';

type ProfileOrder = {
  orderID: number;
  itemID: number;
  itemName: string;
  quantity: number;
  status: string;
  createdDateTime?: string;
  completedDateTime?: string | null;
  employeeID?: number;
};

type UserProfileProps = {
  user: DirectoryUser;
  branchName: string;
  isCurrentUser: boolean;
  /** Admins can edit/delete; employees viewing their own profile can't. */
  canManage: boolean;
  onBack?: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Full-width profile: identity + details on the left, crafting activity on the right. */
function UserProfile({ user, branchName, isCurrentUser, canManage, onBack, onEdit, onDelete }: UserProfileProps) {
  const catalog = useItemCatalog();
  const [orders, setOrders] = useState<ProfileOrder[] | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get<ProfileOrder[]>('/Order')
      .then((response) => {
        if (mounted) setOrders((response.data ?? []).filter((order) => order.employeeID === user.id));
      })
      .catch(() => {
        if (mounted) setOrders([]);
      });
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const completedUnits = list
      .filter((order) => (order.status ?? '').toLowerCase().startsWith('complete'))
      .reduce((sum, order) => sum + (order.quantity || 0), 0);
    const latest = [...list].sort(
      (a, b) => new Date(b.createdDateTime ?? 0).getTime() - new Date(a.createdDateTime ?? 0).getTime(),
    );
    return { count: list.length, completedUnits, latest };
  }, [orders]);

  const tone = { ['--tone' as string]: roleColor(user.role) } as CSSProperties;

  return (
    <section className="up-card" style={tone}>
      <div className="up-hero">
        {onBack ? (
          <button type="button" className="up-back" onClick={onBack}>
            ← All users
          </button>
        ) : null}
        <div className="up-identity">
          <UserAvatar user={user} size={76} />
          <div className="up-identity-text">
            <span className="up-kicker">
              {user.role}
              {isCurrentUser ? ' · you' : ''}
            </span>
            <h2>{user.name || 'Unnamed user'}</h2>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      <div className="up-layout">
        <div className="up-left">
          <dl className="up-details">
            <div>
              <dt>Warehouse</dt>
              <dd>{branchName}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{user.role === 'Admin' ? 'All warehouses, analytics and user management' : 'Own warehouse: inventory and crafting'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="up-status">{user.status || 'Active'}</span>
              </dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>#{user.id}</dd>
            </div>
          </dl>

          {canManage ? (
            <div className="up-actions">
              <button type="button" className="ud-btn ud-btn--primary" onClick={onEdit}>
                Edit user
              </button>
              <button
                type="button"
                className="ud-btn ud-btn--danger"
                onClick={onDelete}
                disabled={isCurrentUser}
                title={isCurrentUser ? "You can't delete your own account" : undefined}
              >
                Delete user
              </button>
            </div>
          ) : null}
        </div>

        <div className="up-activity">
          <span className="up-section-title">Crafting activity</span>
          <div className="up-stats">
            <div className="up-stat">
              <span>Orders placed</span>
              <strong>{orders == null ? '…' : stats.count}</strong>
            </div>
            <div className="up-stat">
              <span>Units completed</span>
              <strong>{orders == null ? '…' : stats.completedUnits}</strong>
            </div>
            <div className="up-stat">
              <span>Last order</span>
              <strong>{orders == null ? '…' : stats.latest[0] ? formatDate(stats.latest[0].createdDateTime) : '—'}</strong>
            </div>
          </div>

          <span className="up-section-title">Recent orders</span>
          {orders == null ? (
            <div className="up-empty">Loading…</div>
          ) : stats.latest.length === 0 ? (
            <div className="up-empty">No crafting orders yet.</div>
          ) : (
            <div className="up-orders">
              {stats.latest.map((order) => {
                const status = (order.status ?? '').toLowerCase();
                const statusClass = status.startsWith('complete')
                  ? 'is-complete'
                  : status.startsWith('cancel')
                    ? 'is-cancelled'
                    : 'is-active';
                return (
                  <div key={order.orderID} className="up-order" style={categoryStyle(catalog[order.itemID]?.category)}>
                    <CategoryTile category={catalog[order.itemID]?.category} size="sm" />
                    <div className="up-order-body">
                      <span className="up-order-name">
                        {order.quantity} × {order.itemName}
                      </span>
                      <span className="up-order-meta">
                        #{order.orderID} · {formatDate(order.createdDateTime)}
                      </span>
                    </div>
                    <span className={`up-order-status ${statusClass}`}>{order.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default UserProfile;
