import './priceHelper.css';

type PriceHelperProps = {
  /** Sum of (material price × amount) for the current recipe. */
  baseCost: number;
  /** Materials in the recipe that have no price set. */
  unpricedCount: number;
  price: number;
  onUsePrice: (value: number) => void;
};

const formatRand = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Shows what the selected materials cost, so the user can set a selling price on top:
 * "Material cost R 120.00 · margin +R 40.00 (33%)", with quick buttons.
 */
function PriceHelper({ baseCost, unpricedCount, price, onUsePrice }: PriceHelperProps) {
  const margin = price - baseCost;
  const marginPct = baseCost > 0 ? Math.round((margin / baseCost) * 100) : null;
  const tone = baseCost === 0 ? 'neutral' : margin < 0 ? 'bad' : margin === 0 ? 'neutral' : 'ok';
  const round = (value: number) => Math.round(value * 100) / 100;

  return (
    <div className={`price-helper price-helper--${tone}`}>
      <div className="price-helper-row">
        <span className="price-helper-label">Material cost</span>
        <strong>{formatRand(baseCost)}</strong>
      </div>
      {baseCost > 0 ? (
        <div className="price-helper-row">
          <span className="price-helper-label">Your margin</span>
          <strong className="price-helper-margin">
            {margin >= 0 ? '+' : '−'}
            {formatRand(Math.abs(margin))}
            {marginPct != null ? ` (${marginPct}%)` : ''}
          </strong>
        </div>
      ) : null}
      {unpricedCount > 0 ? (
        <p className="price-helper-note">
          {unpricedCount} material{unpricedCount === 1 ? ' has' : 's have'} no price yet, so the cost may be higher.
        </p>
      ) : null}
      {baseCost > 0 ? (
        <div className="price-helper-actions">
          <button type="button" onClick={() => onUsePrice(round(baseCost))}>At cost</button>
          <button type="button" onClick={() => onUsePrice(round(baseCost * 1.25))}>+25%</button>
          <button type="button" onClick={() => onUsePrice(round(baseCost * 1.5))}>+50%</button>
        </div>
      ) : (
        <p className="price-helper-note">Add priced materials to see the cost.</p>
      )}
    </div>
  );
}

export default PriceHelper;
