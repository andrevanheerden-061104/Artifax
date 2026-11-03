import { useMemo, useState } from 'react';

export type LowStockEntry = {
  name: string;
  quantity: number;
  location?: string;
};

type AlertStripProps = {
  /** Optional heading; defaults to "Low stock". Older pages pass "Low Stock: 4". */
  label?: string;
  /** Low-stock rows. Plain strings like "Steel Bar (3 remaining)" still work. */
  items: Array<string | LowStockEntry>;
  /** How many chips to show before "+N more". */
  previewCount?: number;
};

function toEntry(item: string | LowStockEntry): LowStockEntry {
  if (typeof item !== 'string') return item;
  const match = item.match(/^(.*)\((\d+)\s+remaining\)\s*$/i);
  if (match) return { name: match[1].trim(), quantity: Number(match[2]) };
  return { name: item, quantity: 0 };
}

function severity(quantity: number): 'out' | 'critical' | 'low' {
  if (quantity <= 0) return 'out';
  if (quantity <= 2) return 'critical';
  return 'low';
}

/**
 * Compact low-stock notification. Shows the most urgent items first and folds the
 * rest behind "+N more" so a long list never pushes the page down.
 */
function AlertStrip({ items, previewCount = 5 }: AlertStripProps) {
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(
    () =>
      items
        .map(toEntry)
        .sort((left, right) => left.quantity - right.quantity || left.name.localeCompare(right.name)),
    [items],
  );

  const outCount = entries.filter((entry) => entry.quantity <= 0).length;
  const visible = expanded ? entries : entries.slice(0, previewCount);
  const hiddenCount = entries.length - visible.length;

  if (entries.length === 0) {
    return (
      <div className="stock-alert stock-alert--ok mb-4" role="status">
        <span className="stock-alert-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.2 12.3 2.4 2.4 5-5" />
          </svg>
        </span>
        <span className="stock-alert-title">All stock levels look healthy</span>
      </div>
    );
  }

  return (
    <div className={`stock-alert mb-4 ${expanded ? 'is-expanded' : ''}`} role="status" aria-live="polite">
      <div className="stock-alert-head">
        <span className="stock-alert-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5 2.8 19.5h18.4Z" />
            <path d="M12 10v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <div className="stock-alert-summary">
          <span className="stock-alert-title">
            Low stock <span className="stock-alert-count">{entries.length}</span>
          </span>
          <span className="stock-alert-sub">
            {outCount > 0 ? `${outCount} out of stock · ` : ''}most urgent first
          </span>
        </div>

        <div className="stock-alert-chips">
          {visible.map((entry, index) => (
            <span
              key={`${entry.name}-${entry.location ?? ''}-${index}`}
              className={`stock-chip stock-chip--${severity(entry.quantity)}`}
              title={entry.location ? `${entry.name} · ${entry.location}` : entry.name}
            >
              <span className="stock-chip-name">{entry.name}</span>
              {entry.location ? <span className="stock-chip-loc">{entry.location}</span> : null}
              <span className="stock-chip-qty">{entry.quantity <= 0 ? 'Out' : entry.quantity}</span>
            </span>
          ))}
          {hiddenCount > 0 ? (
            <button type="button" className="stock-chip stock-chip--more" onClick={() => setExpanded(true)}>
              +{hiddenCount} more
            </button>
          ) : null}
          {expanded && entries.length > previewCount ? (
            <button type="button" className="stock-chip stock-chip--more" onClick={() => setExpanded(false)}>
              Show less
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AlertStrip;
