import './pagination.css';

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** e.g. "items" or "orders" */
  noun?: string;
};

/** Builds 1 … 4 5 6 … 12 style page lists. */
function pageList(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter((value) => value >= 1 && value <= count).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('gap');
    result.push(value);
  });
  return result;
}

/** Shared pager used by the Inventory and History tables. */
function Pagination({ page, pageSize, total, onChange, noun = 'items' }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="pager">
      <span className="pager-info">
        {total === 0 ? `No ${noun}` : `Showing ${from}–${to} of ${total} ${noun}`}
      </span>
      {pageCount > 1 ? (
        <div className="pager-buttons" role="navigation" aria-label="Pages">
          <button type="button" className="pager-btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
            ‹
          </button>
          {pageList(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="pager-gap">…</span>
            ) : (
              <button
                key={entry}
                type="button"
                className={`pager-btn ${entry === page ? 'is-active' : ''}`}
                onClick={() => onChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            ),
          )}
          <button type="button" className="pager-btn" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default Pagination;
