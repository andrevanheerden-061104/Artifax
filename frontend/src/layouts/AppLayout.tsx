import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useWorkspace } from '../utils/workspace';

function AppLayout() {
  const workspace = useWorkspace();

  return (
    <div className="app-shell min-h-screen bg-app text-text flex">
      <Sidebar />
      <div className="min-h-screen min-w-0 flex-1">
        <Topbar />
        {workspace.isAllView ? (
          <div className="readonly-banner mx-4 mt-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm sm:mx-6 lg:mx-8" role="status">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.8 12C4 10.1 7.6 5.4 12 5.4S20 10.1 21.2 12c-1.2 1.9-4.8 6.6-9.2 6.6S4 13.9 2.8 12Z" />
              <circle cx="12" cy="12" r="2.8" />
            </svg>
            <span>
              <strong className="font-semibold">Admin overview — all warehouses.</strong>{' '}
              <span className="text-muted">Viewing only. Switch to a warehouse (top left) to edit stock, or craft across warehouses from Crafting.</span>
            </span>
          </div>
        ) : null}
        {/* Keyed by warehouse so every page reloads its data after a switch */}
        <main key={workspace.key} className="px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
