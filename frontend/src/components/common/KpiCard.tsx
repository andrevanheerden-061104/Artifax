import React from 'react';
import '../../pages/analytics/components/insights/insights.css';

export type KpiTone = 'cyan' | 'green' | 'orange' | 'violet' | 'amber' | 'red' | 'blue';

const TONES: Record<KpiTone, string> = {
  cyan: '#22b8cf',
  green: '#22c55e',
  orange: '#f2884b',
  violet: '#9b87f5',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#38bdf8',
};

export type KpiIconName = 'box' | 'trend' | 'clock' | 'check' | 'warning' | 'stack' | 'grid' | 'book' | 'bolt' | 'cross' | 'list';

const ICONS: Record<KpiIconName, React.ReactNode> = {
  box: (<><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>),
  trend: (<><path d="M4 17 9 12l4 4 7-8" /><path d="M15 8h5v5" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  check: (<><circle cx="12" cy="12" r="9" /><path d="m8.2 12.3 2.4 2.4 5-5" /></>),
  warning: (<><path d="M12 3.5 2.8 19.5h18.4Z" /><path d="M12 10v4M12 17h.01" /></>),
  stack: (<><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>),
  grid: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  book: (<><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></>),
  bolt: (<path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z" />),
  cross: (<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></>),
  list: (<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>),
};

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  caption?: string;
  tone?: KpiTone;
  icon?: KpiIconName;
};

/** Headline number tile: tinted card, coloured icon tile, label, big value, small caption. */
function KpiCard({ label, value, caption, tone = 'cyan', icon = 'box' }: KpiCardProps) {
  return (
    <div className="kpi-card" style={{ ['--tone' as string]: TONES[tone] } as React.CSSProperties}>
      <span className="kpi-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon]}
        </svg>
      </span>
      <div className="kpi-text">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        {caption ? <span className="kpi-caption">{caption}</span> : null}
      </div>
    </div>
  );
}

export default KpiCard;
