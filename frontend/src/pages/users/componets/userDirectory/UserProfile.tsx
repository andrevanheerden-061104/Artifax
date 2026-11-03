import { CSSProperties } from 'react';
import { DirectoryUser, UserAvatar, roleColor } from './UserDirectory';

type UserProfileProps = {
  user: DirectoryUser;
  branchName: string;
  isCurrentUser: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Read-only profile card for one user, with Edit and Delete actions. */
function UserProfile({ user, branchName, isCurrentUser, onBack, onEdit, onDelete }: UserProfileProps) {
  return (
    <section className="up-card" style={{ ['--tone' as string]: roleColor(user.role) } as CSSProperties}>
      <div className="up-hero">
        <button type="button" className="up-back" onClick={onBack}>
          ← All users
        </button>
        <div className="up-identity">
          <UserAvatar user={user} size={76} />
          <div className="up-identity-text">
            <span className="up-kicker">{user.role}{isCurrentUser ? ' · you' : ''}</span>
            <h2>{user.name || 'Unnamed user'}</h2>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      <dl className="up-details">
        <div>
          <dt>Warehouse</dt>
          <dd>{branchName}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{user.role === 'Admin' ? 'Admin — all warehouses, analytics and users' : 'Employee — own warehouse only'}</dd>
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
    </section>
  );
}

export default UserProfile;
