import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CraftPanel from './craftPanel';
import { Blueprint } from '../craftingData';

const blueprint: Blueprint = {
  id: 'bp-test',
  name: 'Test Blueprint',
  description: 'Sample description',
  category: 'mechanical',
  have: 4,
  craft: 0,
  productionTime: 5,
  price: 100,
  stockByBranch: { 1: 4, 2: 0 },
  materials: [
    { itemId: 1, name: 'Iron Ingot', need: 2, have: 4, category: 'metal', stockByBranch: { 1: 4, 2: 10 } },
    { itemId: 2, name: 'Wood Handle', need: 2, have: 1, category: 'furniture', stockByBranch: { 1: 1, 2: 10 } },
  ],
};

const warehouses = [
  { id: 1, name: 'Warehouse 1' },
  { id: 2, name: 'Warehouse 2' },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof CraftPanel>> = {}) {
  const props = {
    blueprint,
    amount: 1,
    orderExpedite: false,
    sourceBranchId: 1,
    targetBranchId: 1,
    chooseWarehouses: false,
    warehouses,
    submitting: false,
    onSourceChange: jest.fn(),
    onTargetChange: jest.fn(),
    onAmountChange: jest.fn(),
    onToggleExpedite: jest.fn(),
    onCraft: jest.fn(() => Promise.resolve()),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  render(<CraftPanel {...props} />);
  return props;
}

describe('CraftPanel', () => {
  it('shows blueprint details and disables crafting when materials are short', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: /Test Blueprint/i })).toBeInTheDocument();
    expect(screen.getByText(/Craft amount/i)).toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Short by 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Craft 1 × Test Blueprint/i })).toBeDisabled();
  });

  it('uses the chosen source warehouse stock in the admin overview', () => {
    renderPanel({ chooseWarehouses: true, sourceBranchId: 2, targetBranchId: 1 });

    expect(screen.getByText(/Take materials from/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Craft 1 × Test Blueprint/i })).not.toBeDisabled();
  });

  it('calls the amount handler when − and + are clicked', () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Less' }));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(props.onAmountChange).toHaveBeenCalledWith(1);
    expect(props.onAmountChange).toHaveBeenCalledWith(2);
  });
});
