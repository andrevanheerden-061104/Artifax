import { CategoryIcon, categoryStyle } from './categories';
import './categories.css';

type Tab = {
  id: string;
  label: string;
  /** Number shown in a small bubble. */
  count?: number;
  /** When set, the tab shows that category's icon and colour. */
  categoryId?: string;
};

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
};

// Filter chips. Category tabs get their icon + colour, like the blueprint filters.
function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="cat-filter-row" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`cat-filter-chip ${isActive ? 'is-active' : ''}`}
            style={tab.categoryId ? categoryStyle(tab.categoryId) : undefined}
            onClick={() => onChange(tab.id)}
          >
            {tab.categoryId ? <CategoryIcon category={tab.categoryId} size={14} /> : null}
            {tab.label}
            {tab.count != null ? <span className="cat-filter-count">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
