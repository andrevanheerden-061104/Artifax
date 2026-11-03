import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAdminUser } from '../../utils/workspace';
import PageHeader from '../../components/layout/PageHeader';
import CraeteUsersPage from './componets/craeteUser/craeteusers';
import UserDirectory from './componets/userDirectory/UserDirectory';
import UserProfile from './componets/userDirectory/UserProfile';
import { getCurrentDateSAST } from '../../Date/dateUtils';
import { useApi } from '../../hooks';
import { getApiErrorMessage } from '../../hooks/useApi';
import { getCurrentUser, setCurrentUser } from '../../utils/currentUser';
import { showError, showSuccess } from '../../utils/toast';


type User = {
  id: number;
  name: string;
  email: string;
  branch: string;
  role: string;
  status: string;
};

const Users: React.FC = () => {
  const currentDate = getCurrentDateSAST();
  const api = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [branchMap, setBranchMap] = useState<Record<number, string>>({});
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // list -> view (profile) / edit / create
  const [mode, setMode] = useState<'list' | 'view' | 'edit' | 'create'>('list');
  const location = useLocation();
  const navigate = useNavigate();
  const backToList = () => {
    if (location.search) navigate('/users', { replace: true });
    setMode('list');
  };
  const me = getCurrentUser();
  const viewerIsAdmin = isAdminUser(me);
  const wantsOwnProfile = new URLSearchParams(location.search).has('me') || !viewerIsAdmin;

  // Clicking your name in the sidebar opens /users?me — jump straight to your own profile
  useEffect(() => {
    if (!wantsOwnProfile || users.length === 0 || !me?.email) return;
    const own = users.find((candidate) => candidate.email.toLowerCase() === me.email!.toLowerCase());
    if (own) {
      setSelectedUserId(own.id);
      setMode('view');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, location.key, wantsOwnProfile]);
  // ensure we only try fetching users once per page load
  const usersFetchedRef = useRef(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? undefined,
    [users, selectedUserId]
  );

  const fetchUsers = async (): Promise<User[]> => {
    setLoading(true);
    try {
      const [adminsResp, employeesResp, branchesResp] = await Promise.all([
        api.get('/User/admins'),
        api.get('/User/employees'),
        api.get('/Branch'),
      ]);

      const branches = branchesResp.data ?? [];
      const map: Record<number, string> = {};
      branches.forEach((b: any) => {
        const id = b.branchID ?? b.BranchID ?? b.branchId ?? b.BranchId ?? 0;
        const name = b.branchName ?? b.BranchName ?? b.name ?? '';
        if (id) map[id] = name;
      });
      setBranchMap(map);

      const makeUser = (e: any, role: 'Admin' | 'Employee') => {
        const id = e.employeeId ?? e.EmployeeId ?? e.EmployeeID ?? 0;
        const name = e.employeeName ?? e.EmployeeName ?? e.employeeName ?? '';
        const email = e.employeeEmail ?? e.EmployeeEmail ?? '';
        const branchId = e.branchId ?? e.BranchId ?? e.BranchID ?? 0;
        return {
          id,
          name,
          email,
          branch: String(branchId),
          role,
          status: 'Active',
        } as User;
      };

      const adminUsers = (adminsResp.data ?? []).map((e: any) => makeUser(e, 'Admin'));
      const employeeUsers = (employeesResp.data ?? []).map((e: any) => makeUser(e, 'Employee'));
      const combinedUsers = [...adminUsers, ...employeeUsers];

      setUsers(combinedUsers);
      return combinedUsers;
    } catch (err) {
      console.error('Fetch users failed', err);
      showError('Unable to load users. Please refresh the page.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (user: Omit<User, 'id'> & { id: number | null; password?: string }): Promise<boolean> => {
    try {
      if (user.id === null) {
        // Create new employee
        const payload = {
          BranchID: Number(user.branch),
          EmployeeEmail: user.email,
          EmployeeName: user.name,
          EmployeePassword: user.password ?? '',
          EmployeeLevel: user.role === 'Admin' ? 'Admin' : 'Employee',
        };
        // Verify current session is authorized (admin) before attempting create
        await api.get('/User/me');
        const resp = await api.post('/User/employee', payload);
        const created = resp.data;
        const createdId = created?.employeeId ?? created?.EmployeeId ?? created?.EmployeeID ?? null;
        const updatedUsers = await fetchUsers();
        if (createdId) {
          setSelectedUserId(createdId);
        } else {
          const matched = updatedUsers.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
          if (matched) setSelectedUserId(matched.id);
        }
        showSuccess('User created successfully.');
        return true;
      }

      // Update existing employee
      const existing = users.find((u) => u.id === user.id);
      const originalEmail = existing?.email ?? user.email;

      // If only branch changed, call branch-specific endpoint
      if (existing && existing.branch !== user.branch && existing.name === user.name && existing.email === user.email) {
        const branchUrl = `/User/employee/branch?EmployeeEmail=${encodeURIComponent(originalEmail)}&BranchId=${Number(
          user.branch
        )}`;
        await api.patch(branchUrl);
        await fetchUsers();
        setSelectedUserId(user.id);

        const currentUser = getCurrentUser();
        if (currentUser?.email?.toLowerCase() === originalEmail.toLowerCase()) {
          setCurrentUser({
            ...currentUser,
            branchId: Number(user.branch),
          });
        }

        showSuccess('User updated successfully.');
        return true;
      }

      // General details update (name/email/password)
      const updatePayload: any = {
        BranchID: Number(user.branch),
        EmployeeEmail: user.email,
        EmployeeName: user.name,
        EmployeeLevel: user.role === 'Admin' ? 'Admin' : 'Employee',
      };

      if (typeof user.password === 'string' && user.password.length > 0) {
        updatePayload.EmployeePassword = user.password;
      }

      const updUrl = `/User/employee?EmployeeEmail=${encodeURIComponent(originalEmail)}`;
      await api.patch(updUrl, updatePayload);
      await fetchUsers();
      setSelectedUserId(user.id);

      const currentUser = getCurrentUser();
      if (currentUser?.email?.toLowerCase() === originalEmail.toLowerCase()) {
        setCurrentUser({
          ...currentUser,
          branchId: Number(user.branch),
          branchName: branchMap[Number(user.branch)] ?? currentUser.branchName,
          email: user.email,
          name: user.name,
          role: user.role,
        });
      }

      showSuccess('User updated successfully.');
      return true;
    } catch (err) {
      console.error('Save user failed', err);
      showError(getApiErrorMessage(err, 'Unable to save user. Please try again.'));
      return false;
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await api.delete(`/User/employee?id=${encodeURIComponent(String(id))}`);
      await fetchUsers();
      setSelectedUserId(null);
      backToList();
      showSuccess('User deleted successfully.');
      // do not clear or change current session when deleting a user
    } catch (err) {
      console.error('Delete user failed', err);
      showError('Unable to delete user. Please try again.');
    }
  };

  const handleRequestEdit = async (id: number) => {
    try {
      // Refresh users/branches from backend to ensure latest state before editing.
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Request edit failed', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    if (usersFetchedRef.current) return; // already attempted fetch
    usersFetchedRef.current = true;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      console.error('Fetch users timed out');
      timedOut = true;
      setLoading(false);
    }, 4000);

    (async () => {
      setLoading(true);
      try {
        await fetchUsers();
      } catch (err) {
        console.error('Fetch users failed', err);
      } finally {
        // noop
      }
    })();

    return () => { mounted = false; clearTimeout(timeoutId); };
  }, []);

  return (
    <div className="page-content">
      <div className="space-y-4 sm:space-y-5">
        <PageHeader 
 
          title={viewerIsAdmin ? 'User Management' : 'My profile'}
          subtitle={viewerIsAdmin ? `${users.length} accounts · ${currentDate}` : currentDate}
        />

        {mode === 'list' && viewerIsAdmin ? (
          <UserDirectory
            users={users}
            loading={loading}
            branchMap={branchMap}
            onView={(id) => {
              setSelectedUserId(id);
              setMode('view');
            }}
            onEdit={(id) => {
              setSelectedUserId(id);
              setMode('edit');
            }}
            onAdd={() => {
              setSelectedUserId(null);
              setMode('create');
            }}
          />
        ) : null}

        {mode === 'view' && selectedUser ? (
          <UserProfile
            user={selectedUser}
            branchName={branchMap[Number(selectedUser.branch)] ?? `Warehouse ${selectedUser.branch}`}
            isCurrentUser={me?.email?.toLowerCase() === selectedUser.email.toLowerCase()}
            canManage={viewerIsAdmin}
            onBack={viewerIsAdmin ? backToList : undefined}
            onEdit={() => setMode('edit')}
            onDelete={() => {
              if (window.confirm(`Delete ${selectedUser.name}? This can't be undone.`)) {
                void handleDeleteUser(selectedUser.id);
              }
            }}
          />
        ) : null}

        {mode === 'edit' || mode === 'create' ? (
          <div className="users-form-wrap">
            <button type="button" className="ud-btn users-form-back" onClick={() => (selectedUser && mode === 'edit' ? setMode('view') : backToList())}>
              ← {selectedUser && mode === 'edit' ? 'Back to profile' : 'All users'}
            </button>
            <CraeteUsersPage
              key={mode === 'create' ? 'create' : `edit-${selectedUserId}`}
              user={mode === 'edit' ? selectedUser : undefined}
              startEditing
              onCancel={() => (selectedUser && mode === 'edit' ? setMode('view') : backToList())}
              onSave={async (user) => {
                const ok = await handleSaveUser(user);
                if (ok) setMode('view');
              }}
              onDelete={handleDeleteUser}
              onRequestEdit={handleRequestEdit}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Users;