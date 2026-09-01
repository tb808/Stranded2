import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, ITEM_IDS } from "../data/items";
import { TOOL_VIEW_DEFINITIONS, TOOL_VIEW_ITEM_IDS, isToolViewItem } from "./FirstPersonToolView";

describe("FirstPersonToolView", () => {
  it("covers every craftable tool with a first-person model", () => {
    const toolIds = ITEM_IDS.filter((itemId) => ITEM_CATALOG[itemId].category === "tool").sort();
    expect(TOOL_VIEW_ITEM_IDS).toEqual(expect.arrayContaining(toolIds));
    expect(TOOL_VIEW_ITEM_IDS).toEqual(expect.arrayContaining(["raw_meat", "cooked_meat"]));
    for (const itemId of TOOL_VIEW_ITEM_IDS) expect(isToolViewItem(itemId)).toBe(true);
    expect(TOOL_VIEW_DEFINITIONS.stone_axe.assetId).toBe("survival.tool-axe");
    expect(TOOL_VIEW_DEFINITIONS.building_hammer.assetId).toBe("survival.tool-hammer");
  });

  it("does not treat resources as hand tools", () => {
    expect(isToolViewItem("stone")).toBe(false);
    expect(isToolViewItem("coconut")).toBe(false);
    expect(isToolViewItem("raw_meat")).toBe(true);
  });

  it("positions every tool as a right-hand view model instead of in front of the crosshair", () => {
    for (const [itemId, definition] of Object.entries(TOOL_VIEW_DEFINITIONS)) {
      expect(definition.position[0]).toBeGreaterThanOrEqual(0.55);
      if (!itemId.endsWith("_meat") && !itemId.endsWith("_fish")) expect(definition.position[1]).toBeLessThanOrEqual(-0.69);
      expect(definition.position[2]).toBeGreaterThanOrEqual(-0.9);
      expect(definition.rotation[2]).toBeGreaterThan(0.15);
    }
  });

  it("turns the enlarged axe forward and makes its use motion a forward chop", () => {
    const axe = TOOL_VIEW_DEFINITIONS.stone_axe;
    const forwardFacingRotation = axe.modelRotation[1] - Math.PI;
    expect(axe.height).toBeGreaterThanOrEqual(0.95);
    expect(forwardFacingRotation).toBeGreaterThan(1.7);
    expect(forwardFacingRotation).toBeLessThan(1.85);
    expect(Math.abs(axe.useRotation[2])).toBeLessThan(0.2);
    expect(axe.useOffset[2]).toBeLessThan(0);
  });

  it("turns every hand tool farther in the requested opposite direction and flips the axe head", () => {
    expect(TOOL_VIEW_DEFINITIONS.stone_axe.modelRotation[1]).toBeCloseTo(1.78 + Math.PI);
    for (const itemId of TOOL_VIEW_ITEM_IDS.filter((id) => id !== "stone_axe" && !id.endsWith("_meat") && !id.endsWith("_fish"))) {
      expect(TOOL_VIEW_DEFINITIONS[itemId].modelRotation[1], itemId).toBeCloseTo(0.24);
    }
  });
});
