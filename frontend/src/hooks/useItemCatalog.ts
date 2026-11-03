import { useEffect, useState } from 'react';
import { api } from './useApi';

export type CatalogItem = { id: number; name: string; category: string; price: number | null };

let cache: Promise<Record<number, CatalogItem>> | null = null;

function loadCatalog(): Promise<Record<number, CatalogItem>> {
  if (!cache) {
    cache = api
      .get<Array<Record<string, unknown>>>('/Item/item')
      .then((response) => {
        const map: Record<number, CatalogItem> = {};
        (response.data ?? []).forEach((row) => {
          const id = Number(row.itemID ?? row.ItemID ?? row.itemId ?? 0);
          if (!id) return;
          map[id] = {
            id,
            name: String(row.itemName ?? row.ItemName ?? `Item ${id}`),
            category: String(row.itemCategory ?? row.ItemCategory ?? 'other'),
            price: row.price == null && row.Price == null ? null : Number(row.price ?? row.Price),
          };
        });
        return map;
      })
      .catch((error) => {
        cache = null; // try again next time
        throw error;
      });
  }
  return cache;
}

/** Forget the cached catalogue (call after creating/editing items). */
export function refreshItemCatalog(): void {
  cache = null;
}

/** Item id -> name/category/price, loaded once and shared by every component. */
export function useItemCatalog(): Record<number, CatalogItem> {
  const [catalog, setCatalog] = useState<Record<number, CatalogItem>>({});

  useEffect(() => {
    let mounted = true;
    loadCatalog()
      .then((map) => {
        if (mounted) setCatalog(map);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return catalog;
}
