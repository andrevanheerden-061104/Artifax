import KpiCard, { KpiIconName, KpiTone } from './KpiCard';

// Stat tile used on the Dashboard and Inventory pages.
// Picks a colour + icon from the label so every page shares the analytics look.
const STYLE_BY_LABEL: Array<{ match: RegExp; tone: KpiTone; icon: KpiIconName; caption: string }> = [
  { match: /low stock/i, tone: 'amber', icon: 'warning', caption: 'At or below minimum' },
  { match: /total units/i, tone: 'green', icon: 'stack', caption: 'Units across all rows' },
  { match: /categor/i, tone: 'violet', icon: 'grid', caption: 'Item categories in stock' },
  { match: /total items|items/i, tone: 'cyan', icon: 'box', caption: 'Stock rows tracked' },
];

type StatCardProps = {
  label: string;
  value: string | number;
  caption?: string;
};

function StatCard({ label, value, caption }: StatCardProps) {
  const style = STYLE_BY_LABEL.find((entry) => entry.match.test(label)) ?? { tone: 'blue' as KpiTone, icon: 'list' as KpiIconName, caption: '' };
  return <KpiCard label={label} value={value} caption={caption ?? style.caption} tone={style.tone} icon={style.icon} />;
}

export default StatCard;
