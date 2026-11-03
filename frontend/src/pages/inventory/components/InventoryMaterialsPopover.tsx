import { useMemo } from 'react';
import { InventoryMaterialDetails } from '../../../services/inventoryApi';
import {
  CategoryBadge,
  CategoryIcon,
  CategoryTile,
  categoryStyle,
} from '../../../components/common/categories';

type InventoryMaterialsPopoverProps = {
  details: InventoryMaterialDetails | null;
  loading: boolean;
  compact?: boolean;
};

/**
 * "View" panel on the Inventory page: what an item is made of and where those
 * materials are stocked. Styled like the blueprint cards (category colour + icon).
 */
function InventoryMaterialsPopover({ details, loading }: InventoryMaterialsPopoverProps) {
  const branchSummary = useMemo(() => {
    if (!details) return [] as Array<{ branchName: string; quantity: number }>;

    const summary = new Map<string, number>();
    details.ingredients.forEach((ingredient) => {
      ingredient.branches.forEach((branch) => {
        summary.set(branch.branchName, (summary.get(branch.branchName) ?? 0) + branch.quantity);
      });
    });

    return Array.from(summary.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([branchName, quantity]) => ({ branchName, quantity }));
  }, [details]);

  const canCraft = useMemo(() => {
    if (!details || details.ingredients.length === 0) return 0;
    return details.ingredients.reduce((min, ingredient) => {
      if (ingredient.requiredQuantity <= 0) return min;
      return Math.min(min, Math.floor(ingredient.availableQuantity / ingredient.requiredQuantity));
    }, Infinity);
  }, [details]);

  if (loading || !details) {
    return (
      <div className="inv-view inv-view--loading" role="region" aria-label="Item details">
        <span className="artifax-loading-dot" aria-hidden="true" />
        <span>{loading ? 'Loading materials…' : 'No details available for this item.'}</span>
      </div>
    );
  }

  const isRawMaterial = details.ingredients.length === 0;

  return (
    <div className="inv-view" style={categoryStyle(details.category)} role="region" aria-label={`${details.itemName} details`}>
      {/* Header: category colour, icon and key facts */}
      <div className="inv-view-hero">
        <div className="inv-view-glow" aria-hidden="true">
          <CategoryIcon category={details.category} size={120} />
        </div>
        <CategoryTile category={details.category} size="lg" />
        <div className="inv-view-hero-text">
          <div className="inv-view-kicker">
            <span>{isRawMaterial ? 'Raw material' : 'Blueprint'}</span>
            <CategoryBadge category={details.category} />
          </div>
          <h3>{details.itemName}</h3>
          <div className="inv-view-facts">
            {!isRawMaterial ? (
              <>
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                  {details.productionTime} min / unit
                </span>
                <span>{details.ingredients.length} material{details.ingredients.length === 1 ? '' : 's'}</span>
                <span className={canCraft > 0 ? 'is-ok' : 'is-bad'}>Can craft {Number.isFinite(canCraft) ? canCraft : 0}</span>
              </>
            ) : (
              <span>Bought in and restocked — not crafted</span>
            )}
          </div>
        </div>
      </div>

      {isRawMaterial ? (
        <div className="inv-view-empty">
          <CategoryIcon category={details.category} size={22} />
          <p>
            This item has no recipe. Add stock with <strong>Restock materials</strong>, or use it as a material in a blueprint on the
            Crafting page.
          </p>
        </div>
      ) : (
        <div className="inv-view-body">
          {branchSummary.length > 0 ? (
            <div className="inv-view-branches">
              <span className="inv-view-label">Material stock by warehouse</span>
              <div className="inv-view-chips">
                {branchSummary.map((branch) => (
                  <span key={branch.branchName} className="inv-view-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 9.5 12 4l9 5.5V20H3Z" />
                      <path d="M7 20v-6h10v6" />
                    </svg>
                    {branch.branchName}
                    <strong>{branch.quantity}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <span className="inv-view-label">Materials per unit</span>
          <div className="inv-view-materials">
            {details.ingredients.map((ingredient) => {
              const missing = Math.max(0, ingredient.requiredQuantity - ingredient.availableQuantity);
              const percent = ingredient.requiredQuantity > 0
                ? Math.min(100, Math.round((ingredient.availableQuantity / ingredient.requiredQuantity) * 100))
                : 100;

              return (
                <div key={ingredient.ingredientId} className={`inv-view-material ${missing > 0 ? 'is-short' : ''}`}>
                  <CategoryTile category={ingredient.category} size="sm" />
                  <div className="inv-view-material-body">
                    <div className="inv-view-material-top">
                      <span className="inv-view-material-name">{ingredient.name}</span>
                      <span className="inv-view-material-count">
                        needs {ingredient.requiredQuantity} · have {ingredient.availableQuantity}
                      </span>
                    </div>
                    <div className="inv-view-bar" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    {ingredient.branches.length > 0 ? (
                      <div className="inv-view-material-branches">
                        {ingredient.branches.map((branch) => (
                          <span key={`${ingredient.ingredientId}-${branch.branchName}`}>
                            {branch.branchName}: <strong>{branch.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {missing > 0 ? <span className="inv-view-short">Short {missing}</span> : <span className="inv-view-ok">Ready</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryMaterialsPopover;
