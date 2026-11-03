import { useEffect, useMemo, useRef, useState } from 'react';
import './createusers.css';
import FilterSelect from '../../../../components/common/FilterSelect';
import { useApi } from '../../../../hooks';

type User = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

interface CreateUsersPageProps {
  user?: User;
  onSave: (user: Omit<User, 'id'> & { id: number | null; password?: string }) => Promise<void>;
  onDelete: (id: number) => void;
  onRequestEdit?: (id: number) => Promise<boolean>;
  /** Open an existing user straight in edit mode (Users page "Edit" button). */
  startEditing?: boolean;
  /** Called when the user cancels editing/creating. */
  onCancel?: () => void;
}

function CraeteUsersPage({ user, onSave, onDelete, onRequestEdit, startEditing = false, onCancel }: CreateUsersPageProps) {
  const api = useApi();
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [role, setRole] = useState('Admin');
  const [isEditing, setIsEditing] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lastUserIdRef = useRef<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const [branchOptions, setBranchOptions] = useState<Array<{ label: string; value: string }>>([]);

  const roleOptions = [
    { label: 'Admin', value: 'Admin' },
    { label: 'Employee', value: 'Employee' },
  ];

  // Fetch branches once on mount. Temporarily use local backend on localhost.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/Branch');
        const data = res.data;
        if (!mounted) return;
        const opts = (data ?? []).map((b: any) => {
          const id = b.branchID ?? b.BranchID ?? b.branchId ?? b.BranchId ?? 0;
          const name = b.branchName ?? b.BranchName ?? b.name ?? '';
          return { label: name, value: String(id) };
        });
        setBranchOptions(opts);
        setBranch((current) => (current ? current : (opts.length > 0 ? opts[0].value : '')));
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    })();

    return () => { mounted = false; };
  }, [api]);

  // Sync incoming `user` prop to local form state when it changes.
  // Important: only reset `isEditing` to false when a different user is selected.
  // This prevents parent refreshes (which may replace the `user` object) from
  // cancelling an in-progress edit for the same selected user.
  useEffect(() => {
    let mounted = true;

    if (user) {
      setFullName(user.name);
      setBranch(user.branch);
      setEmail(user.email);
      setPassword('');
      setPasswordDirty(false);
      setRole(user.role);
      setShowPassword(false);

      // If a new user was selected (different id), exit edit mode. If the same
      // user is re-provided (e.g. after a data refresh), preserve current
      // `isEditing` state so an in-progress edit isn't cancelled.
      if (lastUserIdRef.current !== user.id) {
        setIsEditing(startEditing);
      }
      lastUserIdRef.current = user.id;
    } else {
      // Creating a new user: clear form and enter edit mode
      setFullName('');
      setEmail('');
      setPassword('');
      setPasswordDirty(true);
      setRole('Admin');
      setIsEditing(true);
      setShowPassword(false);
      lastUserIdRef.current = null;
    }

    return () => { mounted = false; };
  }, [user]);

  const emailError = useMemo(() => {
    const value = email.trim();
    if (!value) {
      return 'Email is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }

    return '';
  }, [email]);

  const passwordError = useMemo(() => {
    if (user && !passwordDirty) {
      return '';
    }

    const length = password.length;
    if (!password) {
      return 'Password is required';
    }
    if (length < 5) {
      return 'Password must be at least 5 characters';
    }
    if (length > 15) {
      return 'Password must be no more than 15 characters';
    }
    return '';
  }, [password, passwordDirty, user]);

  const isFormValid =
    fullName.trim().length > 0 &&
    branch.trim().length > 0 &&
    role.trim().length > 0 &&
    !emailError &&
    !passwordError;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setServerError(null);

    if (!isFormValid) {
      return;
    }

    // Only send a password when the field was changed or when creating a new user.
    const passwordToSend = !user || passwordDirty ? password : undefined;

    try {
      await onSave({
        id: user?.id ?? null,
        name: fullName,
        email,
        branch,
        role,
        status: user?.status ?? 'Active',
        password: passwordToSend,
      });

      setIsEditing(false);
    } catch (err: any) {
      console.error('Create/Edit failed', err);
      setServerError(err?.message ?? 'Save failed');
    }
  };

  return (
    <section className="createusers-card">
      <header className="createusers-card-header">
        <div className="createusers-title-row">
          <div className="createusers-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c1.8-3.3 4.5-5 7.5-5s5.7 1.7 7.5 5" />
            </svg>
          </div>
          <h1>{user ? `Edit ${user.name || 'user'}` : 'Create User'}</h1>
        </div>
      </header>

      <div className="createusers-card-body">
        <div className="createusers-section-heading">Required User Information</div>

        <form className="createusers-form" onSubmit={handleSubmit} noValidate>
          <label className="createusers-field">
            <span className="createusers-label">Full Name</span>
            <div className="createusers-input-shell">
              <input
                value={fullName}
                onChange={(event) => { setServerError(null); setFullName(event.target.value); }}
                type="text"
                autoComplete="name"
                className="createusers-input"
                disabled={!isEditing}
              />
            </div>
          </label>

          <label className="createusers-field">
            <span className="createusers-label">Branch</span>
            <div className="createusers-input-shell createusers-select-shell">
              <FilterSelect
                value={branch}
                onChange={(v) => { setServerError(null); setBranch(v); }}
                options={branchOptions.length > 0 ? branchOptions : [
                  { label: 'Warehouse A', value: 'Warehouse A' },
                  { label: 'Warehouse B', value: 'Warehouse B' },
                  { label: 'Warehouse C', value: 'Warehouse C' },
                ]}
                className="createusers-select"
                ariaLabel="Select branch"
                disabled={!isEditing}
              />
            </div>
          </label>

          <label className="createusers-field">
            <span className="createusers-label">Role</span>
            <div className="createusers-input-shell createusers-select-shell">
              <FilterSelect
                value={role}
                onChange={(v) => { setServerError(null); setRole(v); }}
                options={roleOptions}
                className="createusers-select"
                ariaLabel="Select role"
                disabled={!isEditing}
              />
            </div>
          </label>

          <label className="createusers-field">
            <span className="createusers-label">Email</span>
            <div className={`createusers-input-shell ${emailError ? 'error' : ''}`}>
              <input
                value={email}
                onChange={(event) => { setServerError(null); setEmail(event.target.value); }}
                type="email"
                autoComplete="email"
                className="createusers-input"
                disabled={!isEditing}
              />
            </div>
          </label>

          <label className="createusers-field createusers-password-field">
            <span className="createusers-label">Password</span>
            <div className="createusers-input-shell">
              <input
                value={password}
                onChange={(event) => { setServerError(null); setPassword(event.target.value); setPasswordDirty(true); }}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="createusers-input"
                disabled={!isEditing}
                placeholder={user ? '••••••••••••' : 'Enter password'}
              />
              <button
                type="button"
                className="createusers-password-toggle"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={!isEditing}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.8 0 9.7 4.9 10.8 6.5a1.4 1.4 0 0 1 0 1.5c-.6.9-1.6 2.3-3.1 3.7" />
                    <path d="M6.6 6.6C4.3 8.2 2.8 10.1 2 11.5a1.4 1.4 0 0 0 0 1.5C3.1 14.7 7 19.6 12.8 19.6c1.2 0 2.4-.2 3.5-.6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.8 12C4 10.1 7.6 5.4 12 5.4S20 10.1 21.2 12c-1.2 1.9-4.8 6.6-9.2 6.6S4 13.9 2.8 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {(emailError || passwordError) && (
            <div className="createusers-alert" role="alert" aria-live="polite">
              <div className="createusers-alert-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8.3v4.2" />
                  <path d="M12 15.8h.01" />
                </svg>
              </div>
              <div>
                <strong>Wrong input</strong>
                <p>{emailError || passwordError}</p>
              </div>
            </div>
          )}

          {serverError && (
            <div className="createusers-alert" role="alert" aria-live="polite">
              <div className="createusers-alert-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8.3v4.2" />
                  <path d="M12 15.8h.01" />
                </svg>
              </div>
              <div>
                <strong>Save failed</strong>
                <p>{serverError}</p>
              </div>
            </div>
          )}

          <div className="createusers-action-row">
            {user ? (
              isEditing ? (
                <>
                  <button type="submit" className="createusers-submit" disabled={!isFormValid}>
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="createusers-secondary"
                    onClick={() => {
                      setIsEditing(false);
                      if (onCancel) {
                        onCancel();
                        return;
                      }
                      if (user) {
                        setFullName(user.name);
                        setBranch(user.branch);
                        setEmail(user.email);
                        setPassword('************');
                        setRole(user.role);
                        setShowPassword(false);
                      }
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="createusers-submit"
                    onClick={async () => {
                      if (!user) return;
                      try {
                        setEditLoading(true);
                        const allowed = await (onRequestEdit ? onRequestEdit(user.id) : Promise.resolve(true));
                        if (allowed) setIsEditing(true);
                      } finally {
                        setEditLoading(false);
                      }
                    }}
                    disabled={editLoading}
                  >
                    {editLoading ? 'Loading...' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="createusers-secondary"
                    onClick={() => {
                      if (user) {
                        onDelete(user.id);
                      }
                    }}
                  >
                    Delete User
                  </button>
                </>
              )
            ) : (
              <>
                <button type="submit" className="createusers-submit" disabled={!isFormValid}>
                  Create User
                </button>
                {onCancel ? (
                  <button type="button" className="createusers-secondary" onClick={onCancel}>
                    Cancel
                  </button>
                ) : null}
              </>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

export default CraeteUsersPage;
