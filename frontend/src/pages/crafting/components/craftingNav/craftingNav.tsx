import React, { FC, useEffect, useState } from 'react';
import { useApi } from '../../../../hooks';
import './craftingNav.css';

interface NavItem {
  id: string;
  label: string;
  badge: number | null;
}

interface CraftingNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onCreateBlueprint: () => void;
}

const navData: NavItem[] = [
  { id: 'active', label: 'Active Jobs', badge: 0 },
  { id: 'craft', label: 'Craft', badge: null },
  { id: 'history', label: 'History', badge: null },
];

const CraftingNav: FC<CraftingNavProps> = ({ activeTab, onTabChange, onCreateBlueprint }) => {
  const api = useApi();
  const [activeCount, setActiveCount] = useState<number>(0);

  // Live count of jobs that are crafting right now (Active or Paused)
  useEffect(() => {
    let mounted = true;
    const load = () => {
      api
        .get<Array<{ status?: string }>>('/Order')
        .then((response) => {
          if (!mounted) return;
          const count = (response.data ?? []).filter((order) => ['active', 'paused'].includes((order.status ?? '').toLowerCase())).length;
          setActiveCount(count);
        })
        .catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, 60_000);
    window.addEventListener('crafting-order-updated', load);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('crafting-order-updated', load);
    };
  }, [api]);
  return (
    <div className="nav-container">
      {/* Tab Group */}
      <div className="tab-group">
        {navData.map((tab) => (
          <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''} nav-pill`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {tab.badge !== null && (
                <span className={`nav-badge nav-pill ${activeCount === 0 ? 'is-zero' : ''}`}>{activeCount}</span>
              )}
            </button>
        ))}
      </div>

      {/* Action Button */}
      <button className="new-craft-btn" type="button" onClick={onCreateBlueprint}>
        <svg 
          viewBox="0 0 24 24" 
          width="18" 
          height="18" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Blueprint
      </button>
    </div>
  );
};

export default CraftingNav;
