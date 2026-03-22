import { describe, it, expect } from "vitest";
import { calculate, buildItemMap } from "./calculator";
import type { CalcItem } from "./calculator";

// --- Fixtures ---

function makeItem(overrides: Partial<CalcItem>): CalcItem {
  return {
    id: "item",
    name: "Item",
    isRawMaterial: false,
    isFound: false,
    stock: 0,
    volume: 1,
    blueprints: [],
    decompositions: [],
    ...overrides,
  };
}

const rawA = makeItem({ id: "rawA", name: "Raw A", isRawMaterial: true });
const rawB = makeItem({ id: "rawB", name: "Raw B", isRawMaterial: true });

const itemWithBp = makeItem({
  id: "product",
  name: "Product",
  blueprints: [
    {
      id: "bp1",
      outputQty: 2,
      factory: "Factory",
      isDefault: true,
      inputs: [
        { itemId: "rawA", quantity: 3 },
        { itemId: "rawB", quantity: 1 },
      ],
    },
  ],
});

// --- Tests ---

describe("calculate", () => {
  it("returns raw materials needed for a simple blueprint", () => {
    const itemMap = buildItemMap([rawA, rawB, itemWithBp]);
    const result = calculate([{ itemId: "product", quantity: 2 }], itemMap);

    // 2 units → 1 run (outputQty=2) → rawA×3, rawB×1
    const a = result.rawMaterials.find((r) => r.itemId === "rawA");
    const b = result.rawMaterials.find((r) => r.itemId === "rawB");
    expect(a?.totalNeeded).toBe(3);
    expect(b?.totalNeeded).toBe(1);
  });

  it("rounds up blueprint runs", () => {
    const itemMap = buildItemMap([rawA, rawB, itemWithBp]);
    const result = calculate([{ itemId: "product", quantity: 3 }], itemMap);

    // 3 units → 2 runs (ceil(3/2)) → rawA×6, rawB×2
    const a = result.rawMaterials.find((r) => r.itemId === "rawA");
    expect(a?.totalNeeded).toBe(6);
  });

  it("deducts stock from raw materials", () => {
    const rawAWithStock = { ...rawA, stock: 2 };
    const itemMap = buildItemMap([rawAWithStock, rawB, itemWithBp]);
    const result = calculate([{ itemId: "product", quantity: 2 }], itemMap);

    // rawA needed=3, stock=2 → toBuy=1
    const a = result.rawMaterials.find((r) => r.itemId === "rawA");
    expect(a?.toBuy).toBe(1);
    expect(a?.inStock).toBe(2);
  });

  it("deducts stock from intermediates", () => {
    const productWithStock = { ...itemWithBp, stock: 2 };
    const itemMap = buildItemMap([rawA, rawB, productWithStock]);
    const result = calculate([{ itemId: "product", quantity: 2 }], itemMap);

    // product needed=2, stock=2 → no raw materials needed
    expect(result.rawMaterials.every((r) => r.toBuy === 0)).toBe(true);
  });

  it("detects circular dependencies", () => {
    const circular = makeItem({
      id: "circ",
      name: "Circular",
      blueprints: [
        {
          id: "bp",
          outputQty: 1,
          factory: "",
          isDefault: true,
          inputs: [{ itemId: "circ", quantity: 1 }],
        },
      ],
    });
    const itemMap = buildItemMap([circular]);
    expect(() => calculate([{ itemId: "circ", quantity: 1 }], itemMap)).toThrow(
      /circular/i
    );
  });

  it("handles multiple pack items", () => {
    const itemMap = buildItemMap([rawA, rawB, itemWithBp]);
    const result = calculate(
      [
        { itemId: "product", quantity: 2 },
        { itemId: "product", quantity: 2 },
      ],
      itemMap
    );

    // 4 units → 2 runs → rawA×6, rawB×2
    const a = result.rawMaterials.find((r) => r.itemId === "rawA");
    expect(a?.totalNeeded).toBe(6);
  });

  it("includes decomposition suggestions for raw materials", () => {
    const rawWithDecomp = makeItem({
      id: "ore",
      name: "Ore",
      isRawMaterial: true,
      volume: 1,
      decompositions: [{
        id: "dec1",
        refinery: "",
        inputQty: 10,
        isDefault: true,
        outputs: [{ itemId: "rawA", quantity: 5 }],
      }],
    });
    const itemMap = buildItemMap([rawA, rawB, itemWithBp, rawWithDecomp]);
    const result = calculate([{ itemId: "product", quantity: 2 }], itemMap);

    // rawA needed=3 → ore decomp suggested
    expect(result.decompositions.length).toBeGreaterThan(0);
    const decomp = result.decompositions.find((d) => d.sourceItemId === "ore");
    expect(decomp).toBeDefined();
    expect(decomp!.unitsToDecompose).toBeGreaterThan(0);
  });
});
