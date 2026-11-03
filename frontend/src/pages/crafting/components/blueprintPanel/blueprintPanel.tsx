import React, { FC, useEffect, useMemo, useState } from 'react';
import './blueprintPanel.css';
import { Blueprint } from '../craftingData';
import {
  CATEGORIES,
  CategoryIcon,
  categoryStyle,
  getCategory,
} from '../../../../components/common/categories';
import { computeCraftable } from '../../../../services/blueprintApi';

interface BlueprintPanelProps {
  blueprints: Blueprint[];
  loading: boolean;
  error: string | null;
  selectedBlueprintId: string;
  filter: string;
  onFilterChange: (filter: string) => void;
  onSelectBlueprint: (blueprintId: string) => void;
  onCreateBlueprint: () => void;
}

/**
 * Blueprint list. Each card is tinted with its category colour and icon so blueprints
 * are easy to tell apart at a glance; craftable count and stock sit on the right.
 */
const BlueprintPanel: FC<BlueprintPanelProps> = ({
  blueprints,
  loading,
  error,
  selectedBlueprintId,
  filter,
  onFilterChange,
  onSelectBlueprint,
  onCreateBlueprint,
}) => {
  const [search, setSearch] = useState('');

  // Auto-select the first blueprint once loaded
  useEffect(() => {
    if (blueprints.length > 0 && !selectedBlueprintId) {
      onSelectBlueprint(blueprints[0].id);
    }
  }, [blueprints, selectedBlueprintId, onSelectBlueprint]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    blueprints.forEach((blueprint) => {
      map[blueprint.category] = (map[blueprint.category] ?? 0) + 1;
    });
    return map;
  }, [blueprints]);

  const filterOptions = [
    { id: 'all', label: 'All', count: blueprints.length },
    ...CATEGORIES.filter((category) => counts[category.id]).map((category) => ({
      id: category.id,
      label: category.label,
      count: counts[category.id],
    })),
  ];

  const filteredBlueprints = blueprints.filter((blueprint) => {
    if (filter !== 'all' && blueprint.category !== filter) return false;
    if (search.trim() && !blueprint.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="blueprint-panel">
      <div className="blueprint-header">
        <div className="blueprint-title-row">
          <h3>Blueprints</h3>
          <span className="blueprint-count">{blueprints.length}</span>
        </div>

        <input
          type="search"
          className="blueprint-search"
          placeholder="Search blueprints…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search blueprints"
        />

        <div className="blueprint-chips" role="tablist" aria-label="Filter by category">
          {filterOptions.map((option) => {
            const isActive = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`blueprint-chip ${isActive ? 'is-active' : ''}`}
                style={option.id === 'all' ? undefined : categoryStyle(option.id)}
                onClick={() => onFilterChange(option.id)}
              >
                {option.id !== 'all' ? <CategoryIcon category={option.id} size={13} /> : null}
                {option.label}
                <span className="blueprint-chip-count">{option.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="blueprint-loading">Loading blueprints…</div>}
      {error && <div className="blueprint-error">Error: {error}</div>}

      <div className="blueprint-list">
        {!loading && filteredBlueprints.length === 0 ? (
          <p className="blueprint-empty">No blueprints match.</p>
        ) : null}

        {filteredBlueprints.map((blueprint) => {
          const craftable = computeCraftable(blueprint.materials);
          const category = getCategory(blueprint.category);
          const isActive = selectedBlueprintId === blueprint.id;
          const cardClass = `blueprint-card ${isActive ? 'active' : ''} ${craftable === 0 ? 'cant-craft' : ''}`;

          return (
            <button
              key={blueprint.id}
              type="button"
              className={cardClass}
              style={categoryStyle(blueprint.category)}
              onClick={() => onSelectBlueprint(blueprint.id)}
              aria-pressed={isActive}
            >
              <span className="blueprint-card-accent" aria-hidden="true" />
              <div className="blueprint-card-main">
                <span className="blueprint-card-icon">
                  <CategoryIcon category={blueprint.category} size={22} />
                </span>
                <div className="blueprint-card-text">
                  <h4>{blueprint.name}</h4>
                  <p>
                    <span className="blueprint-card-cat">{category.label}</span>
                    <span aria-hidden="true"> · </span>
                    {blueprint.materials.length} material{blueprint.materials.length === 1 ? '' : 's'}
                    <span aria-hidden="true"> · </span>
                    {blueprint.productionTime ?? 0} min
                  </p>
                </div>
              </div>
              <div className="blueprint-card-meta">
                <div className="meta-block">
                  <span className="meta-label">Stock</span>
                  <strong>{blueprint.have}</strong>
                </div>
                <div className={`meta-block meta-block--craft ${craftable > 0 ? 'is-ready' : ''}`}>
                  <span className="meta-label">Can craft</span>
                  <strong>{craftable}</strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="blueprint-actions">
        <button type="button" className="blueprint-new-btn" onClick={onCreateBlueprint}>
          + New Blueprint
        </button>
      </div>
    </div>
  );
};

export default BlueprintPanel;
