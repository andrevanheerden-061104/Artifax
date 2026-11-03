import { api } from '../hooks/useApi';
import { normalizeCategory } from '../components/common/categories';
import { Blueprint, BlueprintMaterial } from '../pages/crafting/components/craftingData';

type AnyRecord = Record<string, any>;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Loads every blueprint with its materials and the stock the user can see.
 * Stock comes from /Item/Branch, which the backend limits to the selected
 * warehouse (or all warehouses in the admin overview).
 */
export async function loadBlueprints(): Promise<Blueprint[]> {
  const [blueprintsResponse, stockResponse, itemsResponse] = await Promise.all([
    api.get<AnyRecord[]>('/Item/item/allItemBlueprints'),
    api.get<AnyRecord[]>('/Item/Branch'),
    api.get<AnyRecord[]>('/Item/item'),
  ]);

  const itemById: Record<number, AnyRecord> = {};
  (itemsResponse.data ?? []).forEach((item) => {
    const id = num(item.ItemID ?? item.itemID ?? item.itemId);
    if (id) itemById[id] = item;
  });

  // itemId -> branchId -> quantity
  const stock: Record<number, Record<number, number>> = {};
  (stockResponse.data ?? []).forEach((row) => {
    const itemId = num(row.ItemID ?? row.itemID ?? row.itemId);
    const branchId = num(row.BranchID ?? row.branchID ?? row.branchId);
    if (!itemId || !branchId) return;
    stock[itemId] = stock[itemId] ?? {};
    stock[itemId][branchId] = (stock[itemId][branchId] ?? 0) + num(row.ItemQuantity ?? row.itemQuantity);
  });

  const total = (itemId: number) => Object.values(stock[itemId] ?? {}).reduce((sum, qty) => sum + qty, 0);

  return (blueprintsResponse.data ?? [])
    .map((raw) => {
      const itemId = num(raw.itemID ?? raw.ItemID ?? raw.itemId);
      const info = itemById[itemId] ?? {};
      const productionTime = num(info.ProductionTime ?? info.productionTime ?? raw.productionTime);

      const materials: BlueprintMaterial[] = (raw.ingredients ?? raw.Ingredients ?? []).map((ingredient: AnyRecord) => {
        const ingredientId = num(ingredient.IngredientID ?? ingredient.ingredientID ?? ingredient.itemID ?? ingredient.itemId);
        const ingredientInfo = itemById[ingredientId] ?? {};
        return {
          itemId: ingredientId || undefined,
          name: ingredientInfo.ItemName ?? ingredientInfo.itemName ?? ingredient.itemName ?? `Item ${ingredientId}`,
          need: num(ingredient.Quantity ?? ingredient.quantity),
          have: ingredientId ? total(ingredientId) : 0,
          category: ingredientInfo.ItemCategory ?? ingredientInfo.itemCategory ?? ingredient.itemCategory,
          stockByBranch: { ...(stock[ingredientId] ?? {}) },
        };
      });

      const blueprint: Blueprint = {
        id: `bp-${itemId}`,
        name: info.ItemName ?? info.itemName ?? raw.itemName ?? `Item ${itemId}`,
        description: `Production time: ${productionTime} min per unit`,
        category: normalizeCategory(info.ItemCategory ?? info.itemCategory ?? raw.itemCategory),
        have: total(itemId),
        craft: 0,
        productionTime,
        price: info.Price ?? info.price ?? raw.price ?? null,
        stockByBranch: { ...(stock[itemId] ?? {}) },
        materials,
      };
      return blueprint;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** How many units can be crafted with the given stock (per material: floor(have / need)). */
export function computeCraftable(materials: BlueprintMaterial[], branchId?: number | null): number {
  if (!materials || materials.length === 0) return 0;
  const result = materials.reduce((minValue, material) => {
    const have = branchId != null ? material.stockByBranch?.[branchId] ?? 0 : material.have;
    if (material.need <= 0) return minValue;
    return Math.min(minValue, Math.floor(have / material.need));
  }, Infinity);
  return Number.isFinite(result) ? result : 0;
}
