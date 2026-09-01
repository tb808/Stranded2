import { expect, test } from "@playwright/test";

interface MangroveSnapshot {
  survival: { health: number; thirst: number };
  conditions: { brackwaterSicknessSeconds: number; poisonSecondsRemaining: number; isBleeding: boolean };
  inventory: Array<{ itemId: string; quantity: number }>;
}

test("Verband stoppt Blutungen und Heilkraut heilt Gift", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForFunction(() => window.__stranded2Debug?.snapshot());

  const result = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    debug.grant([
      { itemId: "healing_herb", count: 3 },
      { itemId: "cloth", count: 1 },
      { itemId: "coconut_shell", count: 1 },
    ]);
    debug.craft("bandage");
    debug.craft("herbal_antidote");
    debug.injure(60);
    const bleeding = debug.snapshot() as MangroveSnapshot;
    debug.use("bandage");
    debug.drinkBrackwater();
    const sick = debug.snapshot() as MangroveSnapshot;
    debug.use("herbal_antidote");
    const cured = debug.snapshot() as MangroveSnapshot;
    debug.grant([{ itemId: "healing_herb", count: 1 }]);
    debug.poison();
    const poisoned = debug.snapshot() as MangroveSnapshot;
    debug.use("healing_herb");
    const poisonCured = debug.snapshot() as MangroveSnapshot;
    return { bleeding, sick, cured, poisoned, poisonCured };
  });

  expect(result.bleeding.conditions.isBleeding).toBe(true);
  expect(result.sick.survival.health).toBe(75);
  expect(result.sick.conditions.isBleeding).toBe(false);
  expect(result.sick.survival.thirst).toBeGreaterThan(65);
  expect(result.sick.conditions.brackwaterSicknessSeconds).toBe(50);
  expect(result.cured.conditions.brackwaterSicknessSeconds).toBe(0);
  expect(result.poisoned.conditions.poisonSecondsRemaining).toBe(1_260);
  expect(result.poisonCured.conditions.poisonSecondsRemaining).toBe(0);
  expect(result.cured.inventory.some(({ itemId }) => itemId === "bandage" || itemId === "herbal_antidote")).toBe(false);
  await expect(page.getByText(/Blutung ist gestoppt/)).toBeVisible();
  await expect(page.getByText(/Gegengift stoppt die Brackwasserkrankheit/)).toBeVisible();
  await expect(page.getByText(/Heilkraut neutralisiert das Schlangengift/)).toBeVisible();
});
