import React from 'react';
import './categories.css';

/**
 * One place that defines every item/blueprint category: its label, colour and icon.
 * Add, remove or recolour categories here and the whole app follows
 * (blueprint list, craft panel, blueprint forms, inventory, restock).
 */

export type CategoryId = 'metal' | 'mechanical' | 'electronics' | 'furniture' | 'paper' | 'plastic' | 'other';

export type CategoryDefinition = {
  id: CategoryId;
  label: string;
  /** Main accent colour (works on light and dark themes). */
  color: string;
  /** Short description shown in the category picker. */
  hint: string;
};

export const CATEGORIES: CategoryDefinition[] = [
  { id: 'metal', label: 'Metal', color: '#8fa3bf', hint: 'Ingots, bars, sheets' },
  { id: 'mechanical', label: 'Mechanical', color: '#f2884b', hint: 'Gears, motors, fasteners' },
  { id: 'electronics', label: 'Electronics', color: '#22b8cf', hint: 'Boards, wiring, modules' },
  { id: 'furniture', label: 'Furniture', color: '#c9925a', hint: 'Benches, cabinets, timber' },
  { id: 'paper', label: 'Paper', color: '#e3b93b', hint: 'Packaging, cardboard' },
  { id: 'plastic', label: 'Plastic', color: '#d36bd8', hint: 'Mouldings, casings' },
  { id: 'other', label: 'Other', color: '#9b87f5', hint: 'Everything else' },
];

const CATEGORY_ALIASES: Record<string, CategoryId> = {
  metal: 'metal',
  metals: 'metal',
  steel: 'metal',
  iron: 'metal',
  mechanical: 'mechanical',
  mechanic: 'mechanical',
  fastener: 'mechanical',
  fasteners: 'mechanical',
  electronics: 'electronics',
  electronic: 'electronics',
  electrical: 'electronics',
  furniture: 'furniture',
  wood: 'furniture',
  timber: 'furniture',
  paper: 'paper',
  stationery: 'paper',
  cardboard: 'paper',
  plastic: 'plastic',
  plastics: 'plastic',
  polymer: 'plastic',
  glass: 'other',
  textile: 'other',
};

/** Turns any stored category text ("Metals", "electronic", "") into a known category. */
export function normalizeCategory(raw: string | null | undefined): CategoryId {
  const key = (raw ?? '').toString().trim().toLowerCase();
  if (!key) return 'other';
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  const partial = Object.keys(CATEGORY_ALIASES).find((alias) => key.includes(alias));
  return partial ? CATEGORY_ALIASES[partial] : 'other';
}

export function getCategory(raw: string | null | undefined): CategoryDefinition {
  const id = normalizeCategory(raw);
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Inline style that exposes the category colour to CSS as --cat. */
export function categoryStyle(raw: string | null | undefined, extra?: React.CSSProperties): React.CSSProperties {
  return { ['--cat' as string]: getCategory(raw).color, ...extra } as React.CSSProperties;
}

type IconProps = { category: string | null | undefined; size?: number; className?: string };

/** Line icon for a category (same stroke style as the rest of the app's icons). */
export function CategoryIcon({ category, size = 20, className = '' }: IconProps) {
  const id = normalizeCategory(category);
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  switch (id) {
    case 'metal':
      // stacked ingots
      return (
        <svg {...common}>
          <path d="M4 14.5 6 10h6l2 4.5Z" />
          <path d="M10 14.5 12 10h6l2 4.5Z" />
          <path d="M7 10 9 5.5h6L17 10" />
          <path d="M3 18.5h18" />
        </svg>
      );
    case 'mechanical':
      // gear
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
          <circle cx="12" cy="12" r="6.2" />
        </svg>
      );
    case 'electronics':
      // chip
      return (
        <svg {...common}>
          <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
          <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
        </svg>
      );
    case 'furniture':
      // chair
      return (
        <svg {...common}>
          <path d="M7 3.5h10v8H7Z" />
          <path d="M5.5 11.5h13v3h-13Z" />
          <path d="M7 14.5V21M17 14.5V21" />
        </svg>
      );
    case 'paper':
      // document
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6Z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case 'plastic':
      // bottle
      return (
        <svg {...common}>
          <path d="M10 2.5h4v3l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-11l2-3Z" />
          <path d="M8 12h8" />
        </svg>
      );
    default:
      // box
      return (
        <svg {...common}>
          <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
          <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
        </svg>
      );
  }
}

/** Rounded, tinted square holding the category icon. */
export function CategoryTile({ category, size = 'md' }: { category: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'lg' ? 30 : size === 'sm' ? 16 : 22;
  return (
    <span className={`cat-tile cat-tile--${size}`} style={categoryStyle(category)}>
      <CategoryIcon category={category} size={iconSize} />
    </span>
  );
}

/** Small pill: icon + category name. */
export function CategoryBadge({ category, className = '' }: { category: string | null | undefined; className?: string }) {
  const definition = getCategory(category);
  return (
    <span className={`cat-badge ${className}`.trim()} style={categoryStyle(category)}>
      <CategoryIcon category={category} size={13} />
      {definition.label}
    </span>
  );
}

type PickerProps = {
  value: string;
  onChange: (id: CategoryId) => void;
  /** Limit the choices (defaults to every category). */
  options?: CategoryId[];
  compact?: boolean;
};

/** Grid of big category buttons — used when creating/editing blueprints and items. */
export function CategoryPicker({ value, onChange, options, compact = false }: PickerProps) {
  const selected = normalizeCategory(value);
  const choices = options ? CATEGORIES.filter((category) => options.includes(category.id)) : CATEGORIES;

  return (
    <div className={`cat-picker ${compact ? 'cat-picker--compact' : ''}`} role="radiogroup" aria-label="Category">
      {choices.map((category) => {
        const isSelected = category.id === selected;
        return (
          <button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`cat-picker-option ${isSelected ? 'is-selected' : ''}`}
            style={categoryStyle(category.id)}
            onClick={() => onChange(category.id)}
          >
            <span className="cat-picker-icon">
              <CategoryIcon category={category.id} size={compact ? 18 : 22} />
            </span>
            <span className="cat-picker-text">
              <span className="cat-picker-label">{category.label}</span>
              {!compact ? <span className="cat-picker-hint">{category.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
