import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import AppLayout from './layouts/AppLayout';
import CraftingPage from './pages/crafting/crafting';
import DashboardPage from './pages/dashboard/DashboardPage';
import InventoryPage from './pages/inventory/InventoryPage';
import AnalyticsPage from './pages/analytics/analytics';
import LoginPage from './pages/auth/LoginPage';
import OtpVerifyPage from './pages/auth/OtpVerifyPage';
import OtpVerifySuccessPage from './pages/auth/OtpVerifySuccessPage';
import OtpVerifyFailedPage from './pages/auth/OtpVerifyFailedPage';
import UsersPage from './pages/users/users';
import ProtectedRoute from './layouts/ProtectedRoute';
import DeviceFrame from './components/layout/DeviceFrame';

function App() {
  return (
    <HashRouter>
      <DeviceFrame>
      <Routes>
        {/* 1. PUBLIC ROUTES (Completely isolated from layouts & sidebars) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/verify" element={<OtpVerifyPage />} />
        <Route path="/login/verify-success" element={<OtpVerifySuccessPage />} />
        <Route path="/login/verify-failed" element={<OtpVerifyFailedPage />} />

        {/* 2. PROTECTED ROUTES (Sidebar can only exist inside here) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AppLayout />}>
            {/* When hitting exactly "/", cleanly redirect straight to the dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="crafting" element={<CraftingPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>

        {/* 3. CATCH-ALL FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      <ToastContainer position="bottom-center" autoClose={3500} hideProgressBar={false} newestOnTop limit={3} closeButton={false} />
      </DeviceFrame>
    </HashRouter>
  );
}

export default App;