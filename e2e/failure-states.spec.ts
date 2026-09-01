import { expect, test } from "@playwright/test";

test("ein fehlgeschlagener Rapier-Import endet in einer verständlichen Retry-Ansicht", async ({ page }) => {
  const rapierModulePattern = /\/src\/physics\/RapierPhysicsWorld\.ts(?:\?.*)?$/;
  let blockedRapierRequests = 0;

  await page.route(rapierModulePattern, async (route) => {
    blockedRapierRequests += 1;
    await route.abort("failed");
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Neues Spiel" })).toBeEnabled();
  await page.getByRole("button", { name: "Neues Spiel" }).click();

  await expect(page.getByRole("heading", { name: "Inselwelt konnte nicht aufgebaut werden" })).toBeVisible();
  await expect(page.getByText("Die 3D-Welt oder ihre Physikdateien konnten nicht initialisiert werden.")).toBeVisible();
  const retryButton = page.getByRole("button", { name: "Erneut versuchen" });
  await expect(retryButton).toBeEnabled();
  await expect(page.getByRole("progressbar")).toBeHidden();
  await expect(page.getByRole("region", { name: "Spielanzeige" })).toBeHidden();
  expect(blockedRapierRequests).toBeGreaterThan(0);

  await page.unroute(rapierModulePattern);
  await retryButton.click();
  await expect(page.getByRole("button", { name: "Neues Spiel" })).toBeEnabled();
});
