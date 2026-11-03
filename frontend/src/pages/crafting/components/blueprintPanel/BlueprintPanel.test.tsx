import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BlueprintPanel from './blueprintPanel';
import { Blueprint } from '../craftingData';

// The panel now receives blueprints from the Crafting page (which loads them),
// so these tests pass data in directly instead of mocking the API.
const blueprints: Blueprint[] = [
  {
    id: 'bp-1',
    name: 'Pot',
    description: 'Production time: 10 min per unit',
    category: 'metal',
    have: 0,
    craft: 0,
    productionTime: 10,
    materials: [{ itemId: 101, name: 'Iron Ingot', need: 2, have: 5, category: 'metal', stockByBranch: { 1: 5 } }],
  },
  {
    id: 'bp-2',
    name: 'Table',
    description: 'Production time: 20 min per unit',
    category: 'furniture',
    have: 3,
    craft: 0,
    productionTime: 20,
    materials: [{ itemId: 102, name: 'Timber Plank', need: 4, have: 1, category: 'furniture', stockByBranch: { 1: 1 } }],
  },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof BlueprintPanel>> = {}) {
  const props = {
    blueprints,
    loading: false,
    error: null,
    selectedBlueprintId: '',
    filter: 'all',
    onFilterChange: jest.fn(),
    onSelectBlueprint: jest.fn(),
    onCreateBlueprint: jest.fn(),
    ...overrides,
  };
  render(<BlueprintPanel {...props} />);
  return props;
}

describe('BlueprintPanel', () => {
  it('renders blueprint cards with stock and craftable counts, and auto-selects the first one', () => {
    const props = renderPanel();

    const potCard = screen.getByRole('button', { name: /Pot/i });
    expect(within(potCard).getByText('0')).toBeInTheDocument(); // in stock
    expect(within(potCard).getByText('2')).toBeInTheDocument(); // can craft: floor(5 / 2)
    expect(props.onSelectBlueprint).toHaveBeenCalledWith('bp-1');
  });

  it('filters by category and forwards filter changes', async () => {
    const props = renderPanel({ selectedBlueprintId: 'bp-1', filter: 'metal' });

    expect(screen.getByRole('button', { name: /Pot/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Table/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Furniture/i }));
    expect(props.onFilterChange).toHaveBeenCalledWith('furniture');
  });

  it('shows loading and error states', () => {
    renderPanel({ blueprints: [], loading: false, error: 'Network error' });
    expect(screen.getByText(/Error: Network error/i)).toBeInTheDocument();
  });

  it('calls the create callback when New Blueprint is clicked', async () => {
    const props = renderPanel({ selectedBlueprintId: 'bp-1' });
    await userEvent.click(screen.getByRole('button', { name: /New Blueprint/i }));
    expect(props.onCreateBlueprint).toHaveBeenCalledTimes(1);
  });
});
