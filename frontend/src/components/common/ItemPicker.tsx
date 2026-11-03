import { useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import { CATEGORIES, CategoryIcon, CategoryTile, categoryStyle, getCategory, normalizeCategory } from './categories';
import './itemPicker.css';

export type PickerItem = { name: string; category?: string; isCrafted?: boolean };

type ItemPickerProps = {
  value: string;
  onChange: (name: string) => void;
  items: PickerItem[];
  placeholder?: string;
  /** Names already used in other rows (shown as "added"). */
  taken?: string[];
};

/**
 * Searchable material picker: grouped by category with icons, a search box,
 * category chips, and letter jumping (type a letter in the list to jump to it).
 */
function ItemPicker({ value, onChange, items, placeholder = 'Choose a material', taken = [] }: ItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = items.find((item) => item.name === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const usedCategories = useMemo(
    () => CATEGORIES.filter((definition) => items.some((item) => normalizeCategory(item.category) === definition.id)),
    [items],
  );

  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = items
      .filter((item) => category === 'all' || normalizeCategory(item.category) === category)
      .filter((item) => !search || item.name.toLowerCase().includes(search))
      .sort((left, right) => left.name.localeCompare(right.name));

    return CATEGORIES.map((definition) => ({
      definition,
      items: filtered.filter((item) => normalizeCategory(item.category) === definition.id),
    })).filter((group) => group.items.length > 0);
  }, [items, query, category]);

  const letters = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((group) => group.items.forEach((item) => set.add(item.name.charAt(0).toUpperCase())));
    return Array.from(set).sort();
  }, [groups]);

  const jumpToLetter = (letter: string) => {
    const target = listRef.current?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    target?.scrollIntoView({ block: 'nearest' });
    target?.focus();
  };

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  // Typing a letter while the list has focus jumps to the first item with that letter
  const handleListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.length === 1 && /[a-z0-9]/i.test(event.key) && event.target !== searchRef.current) {
      jumpToLetter(event.key.toUpperCase());
    }
    if (event.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={rootRef} className="ip-root">
      <button
        type="button"
        className={`ip-trigger ${selected ? 'has-value' : ''}`}
        style={selected ? categoryStyle(selected.category) : undefined}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <CategoryTile category={selected.category} size="sm" />
            <span className="ip-trigger-text">
              <span className="ip-trigger-name">{selected.name}</span>
              <span className="ip-trigger-sub">
                {getCategory(selected.category).label}
                {selected.isCrafted ? ' · crafted item' : ' · raw material'}
              </span>
            </span>
          </>
        ) : (
          <span className="ip-placeholder">{value || placeholder}</span>
        )}
        <svg className="ip-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="ip-panel" role="listbox" onKeyDown={handleListKey}>
          <input
            ref={searchRef}
            className="ip-search"
            placeholder="Search materials…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                const first = groups[0]?.items[0];
                if (first) choose(first.name);
              }
            }}
            aria-label="Search materials"
          />

          <div className="ip-chips">
            <button type="button" className={`ip-chip ${category === 'all' ? 'is-active' : ''}`} onClick={() => setCategory('all')}>
              All
            </button>
            {usedCategories.map((definition) => (
              <button
                key={definition.id}
                type="button"
                className={`ip-chip ${category === definition.id ? 'is-active' : ''}`}
                style={categoryStyle(definition.id)}
                onClick={() => setCategory(definition.id)}
              >
                <CategoryIcon category={definition.id} size={12} />
                {definition.label}
              </button>
            ))}
          </div>

          <div className="ip-body">
            <div className="ip-list" ref={listRef}>
              {groups.length === 0 ? <p className="ip-empty">No materials match “{query}”.</p> : null}
              {groups.map((group) => {
                const seenLetters = new Set<string>();
                return (
                  <div key={group.definition.id} className="ip-group" style={categoryStyle(group.definition.id)}>
                    <div className="ip-group-title">
                      <CategoryIcon category={group.definition.id} size={13} />
                      {group.definition.label}
                      <span>{group.items.length}</span>
                    </div>
                    {group.items.map((item) => {
                      const letter = item.name.charAt(0).toUpperCase();
                      const firstOfLetter = !seenLetters.has(letter);
                      seenLetters.add(letter);
                      const isSelected = item.name === value;
                      const isTaken = !isSelected && taken.includes(item.name);
                      return (
                        <button
                          key={item.name}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-letter={firstOfLetter ? letter : undefined}
                          className={`ip-option ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => choose(item.name)}
                        >
                          <CategoryTile category={item.category} size="sm" />
                          <span className="ip-option-name">{item.name}</span>
                          {isTaken ? <span className="ip-tag">added</span> : null}
                          {item.isCrafted ? <span className="ip-tag ip-tag--crafted">crafted</span> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {letters.length > 4 ? (
              <div className="ip-letters" aria-label="Jump to letter">
                {letters.map((letter) => (
                  <button key={letter} type="button" onClick={() => jumpToLetter(letter)}>
                    {letter}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ItemPicker;
