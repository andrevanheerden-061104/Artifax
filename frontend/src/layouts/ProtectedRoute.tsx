import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUserFromSession } from '../services/authApi';
import { clearCurrentUser, getCurrentUser, setCurrentUser } from '../utils/currentUser';

const ProtectedRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const user = await getCurrentUserFromSession();

      if (user && (user.Username || user.username)) {
        // Keep the stored user in sync with the server (role / warehouse may have changed)
        const stored = getCurrentUser();
        const fresh = {
          name: user.Username ?? user.username ?? stored?.name ?? '',
          role: user.UserLevel ?? user.userLevel ?? stored?.role ?? 'Employee',
          email: user.UserEmail ?? user.userEmail ?? stored?.email,
          employeeId: user.employeeId ?? stored?.employeeId,
          branchId: user.branchId ?? stored?.branchId,
          branchName: user.branchName ?? stored?.branchName,
        };
        if (JSON.stringify(stored) !== JSON.stringify(fresh)) {
          setCurrentUser(fresh);
        }
        setIsAuthenticated(true);
      } else {
        clearCurrentUser();
        setIsAuthenticated(false);
      }
    };

    checkSession();
  }, []);

  // Blocks layouts and sidebars from rendering while checking the session cookie
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app text-sm text-muted">
        <span className="artifax-loading-dot" aria-hidden="true" />
        <span className="ml-3">Checking your session…</span>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
