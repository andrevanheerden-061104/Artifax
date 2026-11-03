import { useEffect, useState } from 'react';
import { CurrentUser, getCurrentUser, useCurrentUser } from './currentUser';

/**
 * "Workspace" = which warehouse the app is currently showing.
 *
 * - Employees are locked to the warehouse on their account.
 * - Admins pick a warehouse (or "all") in the top bar. "All warehouses" is a
 *   read-only overview; to change stock or craft you switch to one warehouse,
 *   or pick source/target warehouses in the craft panel.
 *
 * The choice is sent to the backend on every request as the X-Branch-Id header
 * (see hooks/useApi.ts), and the backend filters the data.
 */

export type WorkspaceSelection = number | 'all';

const WORKSPACE_KEY = 'artifax.activeWarehouse';
const WORKSPACE_EVENT = 'artifax-workspace-changed';

function canUseWindow() {
  return typeof window !== 'undefined';
}

export function isAdminUser(user: CurrentUser | null | undefined): boolean {
  return (user?.role ?? '').toString().toLowerCase() === 'admin';
}

function readStoredSelection(): WorkspaceSelection {
  if (!canUseWindow()) return 'all';
  const raw = window.localStorage.getItem(WORKSPACE_KEY);
  if (!raw || raw === 'all') return 'all';
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 'all';
}

/** The warehouse the current request should be scoped to, or null for "all" (admins only). */
export function getActiveBranchId(user: CurrentUser | null = getCurrentUser()): number | null {
  if (!user) return null;
  if (!isAdminUser(user)) return user.branchId ?? null;
  const selection = readStoredSelection();
  return selection === 'all' ? null : selection;
}

export function setWorkspaceSelection(selection: WorkspaceSelection): void {
  if (!canUseWindow()) return;
  window.localStorage.setItem(WORKSPACE_KEY, String(selection));
  window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT));
}

export function resetWorkspaceSelection(): void {
  if (!canUseWindow()) return;
  window.localStorage.removeItem(WORKSPACE_KEY);
  window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT));
}

export type Workspace = {
  user: CurrentUser | null;
  isAdmin: boolean;
  /** Warehouse being shown, or null when an admin is viewing all warehouses. */
  activeBranchId: number | null;
  /** True for the admin "All warehouses" overview (read-only). */
  isAllView: boolean;
  /** False in the read-only overview. */
  canModify: boolean;
  /** Changes on every switch — handy as a React key to reload a page. */
  key: string;
  select: (selection: WorkspaceSelection) => void;
};

export function useWorkspace(): Workspace {
  const user = useCurrentUser();
  const [selection, setSelection] = useState<WorkspaceSelection>(() => readStoredSelection());

  useEffect(() => {
    if (!canUseWindow()) return undefined;
    const sync = () => setSelection(readStoredSelection());
    window.addEventListener(WORKSPACE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WORKSPACE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isAdmin = isAdminUser(user);
  const activeBranchId = isAdmin ? (selection === 'all' ? null : selection) : user?.branchId ?? null;
  const isAllView = isAdmin && activeBranchId == null;

  return {
    user,
    isAdmin,
    activeBranchId,
    isAllView,
    canModify: !isAllView,
    key: `${user?.email ?? 'anon'}:${activeBranchId ?? 'all'}`,
    select: setWorkspaceSelection,
  };
}
