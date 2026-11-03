import { useEffect, useRef, useState } from 'react';
import { getBranches, BranchDto } from '../../services/authApi';
import { useWorkspace } from '../../utils/workspace';

function WarehouseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 4l9 5.5V20H3Z" />
      <path d="M7 20v-6h10v6" />
      <path d="M7 17h10" />
    </svg>
  );
}

function GlobeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function readBranchId(branch: BranchDto | Record<string, unknown>): number {
  const record = branch as Record<string, unknown>;
  return Number(record.BranchID ?? record.branchID ?? record.branchId ?? 0);
}

function readBranchName(branch: BranchDto | Record<string, unknown>): string {
  const record = branch as Record<string, unknown>;
  return String(record.BranchName ?? record.branchName ?? `Warehouse ${readBranchId(branch)}`);
}

/**
 * Top-left warehouse control.
 * - Admins: dropdown to switch between each warehouse and the read-only "All warehouses" overview.
 * - Employees: a locked label showing their warehouse.
 */
function WarehouseSwitcher() {
  const workspace = useWorkspace();
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    getBranches()
      .then((rows) => {
        if (!mounted) return;
        setBranches(
          (rows ?? [])
            .map((row) => ({ id: readBranchId(row), name: readBranchName(row) }))
            .filter((row) => row.id > 0)
            .sort((a, b) => a.id - b.id),
        );
      })
      .catch(() => {
        if (mounted) setBranches([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const activeName =
    workspace.activeBranchId == null
      ? 'All warehouses'
      : branches.find((branch) => branch.id === workspace.activeBranchId)?.name ??
        workspace.user?.branchName ??
        `Warehouse ${workspace.activeBranchId}`;

  if (!workspace.isAdmin) {
    return (
      <div
        className="warehouse-pill inline-flex h-[38px] shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-sm font-medium text-text"
        title="Your account is linked to this warehouse"
      >
        <WarehouseIcon />
        <span className="nav-pill truncate">{activeName}</span>
        <span className="text-muted"><LockIcon /></span>
      </div>
    );
  }

  const options: Array<{ value: number | 'all'; label: string; caption: string }> = [
    ...branches.map((branch) => ({ value: branch.id, label: branch.name, caption: 'View and manage this warehouse' })),
    { value: 'all', label: 'All warehouses', caption: 'Admin overview · read-only' },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`warehouse-pill inline-flex h-[38px] shrink-0 items-center gap-2 rounded-[8px] border px-3 text-sm font-medium transition ${
          workspace.isAllView ? 'ws-all-active border-primary text-text' : 'border-border bg-surface text-text hover:border-primary'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {workspace.isAllView ? <GlobeIcon /> : <WarehouseIcon />}
        <span className="flex items-baseline gap-2 whitespace-nowrap leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {workspace.isAllView ? 'Admin view' : 'Warehouse'}
          </span>
          <span className="nav-pill max-w-[200px] truncate">{activeName}</span>
        </span>
        <svg className={`h-4 w-4 text-muted transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-soft"
          role="listbox"
          aria-label="Choose warehouse"
        >
          {options.map((option) => {
            const isSelected =
              option.value === 'all' ? workspace.isAllView : workspace.activeBranchId === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isSelected ? 'ws-option-selected text-text' : 'text-text hover:bg-app'
                }`}
                onClick={() => {
                  workspace.select(option.value);
                  setOpen(false);
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-app">
                  {option.value === 'all' ? <GlobeIcon /> : <WarehouseIcon />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{option.label}</span>
                  <span className="block text-xs text-muted">{option.caption}</span>
                </span>
                {isSelected ? (
                  <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default WarehouseSwitcher;
