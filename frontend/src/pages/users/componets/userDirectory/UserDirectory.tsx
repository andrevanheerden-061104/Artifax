import { CSSProperties, useMemo, useState } from 'react';
import './userDirectory.css';

export type DirectoryUser = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

const ROLE_COLOR: Record<string, string> = {
  Admin: '#9b87f5',
  Employee: '#22b8cf',
};

export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? '#8fa3bf';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function UserAvatar({ user, size = 48 }: { user: DirectoryUser; size?: number }) {
  return (
    <span
      className="ud-avatar"
      style={{ ['--tone' as string]: roleColor(user.role), width: size, height: size, fontSize: size * 0.36 } as CSSProperties}
      aria-hidden="true"
    >
      {initialsOf(user.name)}
    </span>
  );
}

type UserDirectoryProps = {
  users: DirectoryUser[];
  loading: boolean;
  branchMap: Record<number, string>;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onAdd: () => void;
};

type RoleFilter = 'all' | 'Admin' | 'Employee';

/** Grid of user cards with search, role filter and an "Add user" button. */
function UserDirectory({ users, loading, branchMap, onView, onEdit, onAdd }: UserDirectoryProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const counts = useMemo(
    () => ({
      all: users.length,
      Admin: users.filter((user) => user.role === 'Admin').length,
      Employee: users.filter((user) => user.role === 'Employee').length,
    }),
    [users],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter((user) => roleFilter === 'all' || user.role === roleFilter)
      .filter((user) => {
        if (!query) return true;
        const branchName = branchMap[Number(user.branch)] ?? '';
        return [user.name, user.email, branchName].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => (left.role === right.role ? left.name.localeCompare(right.name) : left.role === 'Admin' ? -1 : 1));
  }, [users, search, roleFilter, branchMap]);

  return (
    <section className="ud-card">
      <div className="ud-toolbar">
        <input
          type="search"
          className="ud-search"
          placeholder="Search by name, email or warehouse…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search users"
        />
        <div className="ud-filters" role="tablist" aria-label="Filter by role">
          {(['all', 'Admin', 'Employee'] as RoleFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={roleFilter === filter}
              className={`ud-filter ${roleFilter === filter ? 'is-active' : ''}`}
              style={filter === 'all' ? undefined : ({ ['--tone' as string]: roleColor(filter) } as CSSProperties)}
              onClick={() => setRoleFilter(filter)}
            >
              {filter === 'all' ? 'Everyone' : `${filter}s`}
              <span className="ud-filter-count">{counts[filter]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ud-add" onClick={onAdd}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add user
        </button>
      </div>

      {loading && users.length === 0 ? <p className="ud-empty">Loading users…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="ud-empty">{search || roleFilter !== 'all' ? 'No users match your filters.' : 'No users yet — add the first one.'}</p>
      ) : null}

      <div className="ud-grid">
        {visible.map((user) => (
          <article
            key={user.id}
            className="ud-user"
            style={{ ['--tone' as string]: roleColor(user.role) } as CSSProperties}
          >
            <button type="button" className="ud-user-main" onClick={() => onView(user.id)} aria-label={`View ${user.name}`}>
              <UserAvatar user={user} />
              <span className="ud-user-text">
                <span className="ud-user-name">{user.name || 'Unnamed user'}</span>
                <span className="ud-user-email">{user.email}</span>
              </span>
            </button>
            <div className="ud-user-tags">
              <span className="ud-tag ud-tag--role">{user.role}</span>
              <span className="ud-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9.5 12 4l9 5.5V20H3Z" />
                  <path d="M7 20v-6h10v6" />
                </svg>
                {branchMap[Number(user.branch)] ?? `Warehouse ${user.branch}`}
              </span>
            </div>
            <div className="ud-user-actions">
              <button type="button" className="ud-btn" onClick={() => onView(user.id)}>
                View
              </button>
              <button type="button" className="ud-btn ud-btn--primary" onClick={() => onEdit(user.id)}>
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default UserDirectory;
