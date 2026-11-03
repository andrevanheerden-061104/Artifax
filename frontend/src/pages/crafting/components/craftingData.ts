export interface CraftingItem {
  id: string;
  name: string;
  qty: number;
  status: 'In Progress' | 'Paused' | 'Queued';
  progress: number;
  timeLeft: string;
  materials: string[];
  location: string;
  type: 'electronics' | 'mechanical' | 'logistics';
  icon: string;
}

import { CategoryId } from '../../../components/common/categories';

export interface BlueprintMaterial {
  itemId?: number;
  name: string;
  need: number;
  /** Stock in the warehouse(s) currently being viewed. */
  have: number;
  category?: string;
  /** Stock per warehouse (branchId -> quantity), used when crafting across warehouses. */
  stockByBranch?: Record<number, number>;
}

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  have: number;
  craft: number;
  productionTime?: number;
  price?: number | null;
  stockByBranch?: Record<number, number>;
  materials: BlueprintMaterial[];
}

export const craftingData: CraftingItem[] = [
  {
    id: "#8492",
    name: "Circuit Board A1",
    qty: 50,
    status: "In Progress",
    progress: 68,
    timeLeft: "~12 min left",
    materials: ["Bolt Set M8 x20", "Hex Nut M10 x20"],
    location: "Warehouse A",
    type: "electronics",
    icon: "unitIcon"
  },
  {
    id: "#8493",
    name: "Gear Assembly",
    qty: 12,
    status: "Paused",
    progress: 32,
    timeLeft: "Paused",
    materials: ["Steel Plate x4", "Lubricant (Low)"],
    location: "Warehouse A",
    type: "mechanical",
    icon: "unitIcon"
  },
  {
    id: "#8494",
    name: "Packaging Unit",
    qty: 200,
    status: "In Progress",
    progress: 89,
    timeLeft: "~4 min left",
    materials: ["Cardboard Sheet", "Tape Roll"],
    location: "Warehouse B",
    type: "logistics",
    icon: "unitIcon"
  },
  {
    id: "#8495",
    name: "Frame Bracket",
    qty: 5,
    status: "Queued",
    progress: 0,
    timeLeft: "~45 min est.",
    materials: ["Steel Plate x2"],
    location: "Warehouse A",
    type: "mechanical",
    icon: "unitIcon"
  },
  {
    id: "#8496",
    name: "Motor Housing",
    qty: 18,
    status: "Queued",
    progress: 0,
    timeLeft: "~1 hr est.",
    materials: ["Aluminum Cast x2", "Sealant"],
    location: "Warehouse B",
    type: "mechanical",
    icon: "unitIcon"
  },
  {
    id: "#8497",
    name: "Control Panel",
    qty: 30,
    status: "Queued",
    progress: 0,
    timeLeft: "~30 min est.",
    materials: ["Switch Set", "Housing Plate"],
    location: "Warehouse A",
    type: "electronics",
    icon: "unitIcon"
  }
];

export const blueprintData: Blueprint[] = [
  {
    id: 'bp-101',
    name: 'Round Table',
    description: 'Assembled wood and steel furniture.',
    category: 'furniture',
    have: 20,
    craft: 520,
    materials: [
      { name: 'Iron Ingot', need: 10, have: 142 },
      { name: 'Bolt Set (M8)', need: 20, have: 520 },
      { name: 'Steel Rod', need: 8, have: 4 }
    ]
  },
  {
    id: 'bp-102',
    name: 'Hammer',
    description: 'Durable forging tool for workshops.',
    category: 'mechanical',
    have: 10,
    craft: 142,
    materials: [
      { name: 'Iron Ingot', need: 6, have: 142 },
      { name: 'Wood Handle', need: 2, have: 22 }
    ]
  }
];
