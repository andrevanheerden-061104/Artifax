import React, { FC, useEffect, useMemo, useState } from 'react';
import Button from '../../../../components/common/Button';
import ItemPicker, { PickerItem } from '../../../../components/common/ItemPicker';
import PriceHelper from '../priceHelper/PriceHelper';
import { useApi } from '../../../../hooks';
import { showError, showSuccess } from '../../../../utils/toast';
import './blueprintEdit.css';
import { CategoryPicker, CategoryTile, categoryStyle, getCategory, normalizeCategory } from '../../../../components/common/categories';
import { getApiErrorMessage } from '../../../../hooks/useApi';

interface MaterialRow {
  id: string;
  item: string;
  amount: number;
}

interface BlueprintEditProps {
  itemId: number;
  onCancel: () => void;
  onSaved: () => void;
}


const BlueprintEdit: FC<BlueprintEditProps> = ({ itemId, onCancel, onSaved }) => {
  const api = useApi();
  const [blueprintName, setBlueprintName] = useState('');
  const [category, setCategory] = useState('metal');
  const [craftTimeMinutes, setCraftTimeMinutes] = useState(1);
  const [price, setPrice] = useState<number>(0);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemOptions, setItemOptions] = useState<Array<PickerItem & { price?: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBlueprint = async () => {
      setLoading(true);
      setError(null);

      try {
        const [itemsResponse, itemResponse, ingredientsResponse] = await Promise.all([
          api.get('/Item/item/'),
          api.get(`/Item/item/${itemId}`),
          api.get(`/Item/itemIngredient/item/${itemId}`),
        ]);

        const items = itemsResponse.data || [];
        setItemOptions(
          items
            .filter((item: any) => item?.itemName)
            .filter((item: any) => Number(item.itemID ?? item.ItemID) !== itemId)
            .map((item: any) => ({ name: item.itemName, category: item.itemCategory, isCrafted: Number(item.productionTime ?? 0) > 0, price: item.price == null ? null : Number(item.price) }))
        );

        const item = itemResponse.data;
        const ingredients = ingredientsResponse.data || [];

        setBlueprintName(item.itemName || '');
        setCategory(normalizeCategory(item.itemCategory || 'metal'));
        setCraftTimeMinutes(item.productionTime || 1);
        setPrice(item.price ?? item.Price ?? 0);
        setMaterials(
          ingredients.map((material: any, index: number) => ({
            id: `mat-${index + 1}-${Date.now()}`,
            item: material.itemName || '',
            amount: material.quantity || 1,
          }))
        );
      } catch (loadError) {
        console.error('Failed to load blueprint edit data:', loadError);
        setError('Unable to load blueprint data.');
      } finally {
        setLoading(false);
      }
    };

    loadBlueprint();
  }, [api, itemId]);

  // Material cost of the recipe, from each material's price × amount
  const { baseCost, unpricedCount } = useMemo(() => {
    let cost = 0;
    let unpriced = 0;
    materials.forEach((material) => {
      if (!material.item) return;
      const option = itemOptions.find((item) => item.name === material.item);
      if (option?.price == null) unpriced += 1;
      else cost += option.price * (material.amount || 0);
    });
    return { baseCost: cost, unpricedCount: unpriced };
  }, [materials, itemOptions]);

  const handleMaterialChange = (id: string, field: 'item' | 'amount', value: string | number) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === id
          ? {
              ...material,
              [field]: field === 'amount' ? Number(value) : String(value),
            }
          : material
      )
    );
  };

  const addMaterialRow = () => {
    setMaterials((current) => [
      ...current,
      { id: `mat-${current.length + 1}-${Date.now()}`, item: '', amount: 1 },
    ]);
  };

  const removeMaterialRow = (id: string) => {
    setMaterials((current) => current.filter((material) => material.id !== id));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validMaterials = materials.filter((material) => material.item.trim());
    if (!blueprintName.trim() || validMaterials.length === 0) {
      showError('Please add a blueprint name and at least one material.');
      return;
    }

    setIsSubmitting(true);

    try {
      const itemsResponse = await api.get('/Item/item/');
      const existingItems: any[] = itemsResponse.data || [];
      const nameToId = existingItems.reduce<Record<string, number>>((map, item) => {
        if (item?.itemName && item?.itemID) {
          map[item.itemName] = item.itemID;
        }
        return map;
      }, {});

      await api.put(`/Item/${itemId}`, {
        itemName: blueprintName.trim(),
        itemCategory: category,
        productionTime: craftTimeMinutes,
        price: Number(price) || 0,
      });

      const ingredientPayloads: Array<{ ingredientID: number; ingredientQuantity: number }> = [];
      for (const material of validMaterials) {
        const materialName = material.item.trim();
        if (!materialName) {
          continue;
        }

        let ingredientId = nameToId[materialName];
        if (!ingredientId) {
          const createdIngredientResponse = await api.post('/Item/item/CreateItemDefaultQuantity', {
            itemName: materialName,
            itemCategory: 'other',
            productionTime: 0,
          });
          ingredientId = createdIngredientResponse.data?.itemID;
          if (ingredientId) {
            nameToId[materialName] = ingredientId;
          }
        }

        if (ingredientId) {
          ingredientPayloads.push({
            ingredientID: ingredientId,
            ingredientQuantity: material.amount,
          });
        }
      }

      await api.put(`/Item/item/${itemId}/blueprint/edit`, {
        itemID: itemId,
        productionTime: craftTimeMinutes,
        price: Number(price) || 0,
        ingredients: ingredientPayloads,
      });

      showSuccess('Blueprint updated successfully. Returning to crafting page.');
      onSaved();
    } catch (saveError) {
      console.error('Failed to save blueprint edit:', saveError);
      showError(getApiErrorMessage(saveError, 'Unable to save blueprint changes. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasValidName = blueprintName.trim().length > 0;

  if (loading) {
    return (
      <div className="new-blueprint-panel">
        <p>Loading blueprint...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="new-blueprint-panel">
        <p>{error}</p>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="new-blueprint-panel blueprint-form--themed" style={categoryStyle(category)}>
      <div className="new-blueprint-header">
        <div className="new-blueprint-heading">
          <CategoryTile category={category} size="lg" />
          <div className="blueprint-form-heading-text">
            <span className="new-blueprint-tag">Edit Blueprint</span>
            <strong className="blueprint-form-preview">{blueprintName.trim() || 'Untitled blueprint'}</strong>
            <span className="blueprint-form-sub">{getCategory(category).label} · {craftTimeMinutes} min per unit</span>
          </div>
        </div>
      </div>

      <form className="new-blueprint-form" onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="blueprintName">Blueprint Name</label>
            <input
              id="blueprintName"
              type="text"
              value={blueprintName}
              onChange={(event) => setBlueprintName(event.target.value)}
              placeholder="Name"
              className="field-input"
            />
          </div>
        </div>

        <div className="field-group">
          <label>Category</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        {/* Craft time + price on the left; material cost lines up with the "Amount needed" + remove columns below */}
        <div className="bp-grid-row price-row">
          <div className="price-row-fields">
          <div className="field-group field-group--craft-time">
            <label htmlFor="craftTimeMinutes">Craft Time (min)</label>
            <input
              id="craftTimeMinutes"
              type="number"
              min={1}
              step={1}
              value={craftTimeMinutes}
              onChange={(event) => setCraftTimeMinutes(Math.max(1, Number(event.target.value) || 1))}
              className="field-input craft-time-input"
            />
          </div>

          <div className="field-group field-group--price">
            <label htmlFor="blueprintPrice">Price (ZAR)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="blueprintPrice"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                value={price === 0 ? '' : price}
                onChange={(e) => setPrice(Number(e.target.value || 0))}
                className="field-input"
                placeholder="0.00"
              />
            </div>
          </div>
          </div>
          <PriceHelper baseCost={baseCost} unpricedCount={unpricedCount} price={Number(price) || 0} onUsePrice={setPrice} />
        </div>

        <label>Required materials</label>
        <div className="material-list">
          {materials.map((material) => (
            <div key={material.id} className="materials-row bp-grid-row">
              <ItemPicker
                value={material.item}
                onChange={(value) => handleMaterialChange(material.id, 'item', value)}
                items={itemOptions}
                taken={materials.map((row) => row.item).filter(Boolean)}
                placeholder="Choose a material"
              />

              <div className="amount-line">
                <span className="amount-caption">Amount Needed</span>
                <button
                  type="button"
                  className="amount-button"
                  onClick={() =>
                    handleMaterialChange(material.id, 'amount', Math.max(1, material.amount - 1))
                  }
                >
                  -
                </button>
                <span className="amount-value">{material.amount}</span>
                <button
                  type="button"
                  className="amount-button"
                  onClick={() => handleMaterialChange(material.id, 'amount', material.amount + 1)}
                >
                  +
                </button>
              </div>

              {materials.length > 1 && (
                <button
                  type="button"
                  className="remove-material"
                  onClick={() => removeMaterialRow(material.id)}
                  aria-label="Remove material"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="add-material-button" onClick={addMaterialRow}>
          + Add material to blueprint
        </button>

        <div className="new-blueprint-actions">
          <Button type="submit" disabled={!hasValidName || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BlueprintEdit;
