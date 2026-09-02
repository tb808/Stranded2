import { expect, test } from "@playwright/test";

test("hergestellte Bauwerke landen als Bausatz im Inventar und werden von dort platziert", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForFunction(() => window.__stranded2Debug?.snapshot());

  const afterCrafting = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    debug.grant([
      { itemId: "building_hammer", count: 1 },
      { itemId: "stone", count: 4 },
      { itemId: "stick", count: 4 },
    ]);
    debug.craft("campfire");
    return debug.snapshot();
  });

  expect(afterCrafting).toMatchObject({
    selectedBuild: null,
    inventory: expect.arrayContaining([expect.objectContaining({ itemId: "campfire", quantity: 1 })]),
  });

  const afterUsingKit = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    if (!debug.use("campfire")) throw new Error("Lagerfeuer-Bausatz fehlt im Inventar.");
    return debug.snapshot();
  });

  expect(afterUsingKit).toMatchObject({
    selectedBuild: "campfire",
    inventory: expect.arrayContaining([expect.objectContaining({ itemId: "campfire", quantity: 1 })]),
  });
});
