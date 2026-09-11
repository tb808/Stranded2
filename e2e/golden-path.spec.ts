import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("ohne WebGL2 erscheint eine verständliche HTML-Fehlerseite", async ({ page }) => {
  await page.addInitScript(`
    (() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, options) {
        if (type === "webgl2") return null;
        return original.call(this, type, options);
      };
    })();
  `);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "WebGL2 wird benötigt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WebGL2 prüfen" })).toHaveAttribute("href", "https://get.webgl.org/webgl2/");
  await expect(page.getByRole("button", { name: "Neues Spiel" })).toHaveCount(0);
});

test("Hauptmenü ist bedienbar und ohne schwere Accessibility-Verstöße", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stranded 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Neues Spiel" })).toBeEnabled();
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
  await page.getByRole("button", { name: "Zurück" }).click();
  await page.getByRole("button", { name: "Credits" }).click();
  await expect(page.getByRole("heading", { name: "Assets und Audio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kenney" })).toHaveAttribute("href", "https://kenney.nl/");

  const accessibility = await new AxeBuilder({ page }).analyze();
  const severeViolations = accessibility.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );
  expect(severeViolations).toEqual([]);
  await page.getByRole("button", { name: "Zurück" }).click();
});

test("Goldpfad: Werkzeuge, Versorgung, Schutzdach, Floß, Überfahrt und Reload", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await expect(page.getByRole("region", { name: "Spielanzeige" })).toBeVisible();
  await page.waitForFunction(() => window.__stranded2Debug?.snapshot());

  const toolState = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    debug.grant([
      { itemId: "fiber", count: 10 },
      { itemId: "stone", count: 4 },
      { itemId: "stick", count: 3 },
    ]);
    debug.craft("lashing");
    debug.craft("lashing");
    debug.craft("stone_knife");
    debug.craft("stone_axe");
    debug.craft("building_hammer");
    return debug.snapshot();
  });
  expect(toolState).toMatchObject({
    state: "playing",
    inventory: expect.arrayContaining([
      expect.objectContaining({ itemId: "stone_knife", quantity: 1 }),
      expect.objectContaining({ itemId: "stone_axe", quantity: 1 }),
      expect.objectContaining({ itemId: "building_hammer", quantity: 1 }),
    ]),
  });

  const suppliedState = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    debug.grant([
      { itemId: "coconut", count: 1 },
      { itemId: "cooked_crab", count: 1 },
    ]);
    debug.use("coconut");
    debug.use("cooked_crab");
    return debug.snapshot();
  });
  const suppliedVitals = (suppliedState as { survival: { hunger: number; thirst: number } }).survival;
  expect(suppliedVitals.hunger).toBeGreaterThan(99);
  expect(suppliedVitals.thirst).toBeGreaterThan(82.5);

  const builtState = await page.evaluate(() => {
    const debug = window.__stranded2Debug!;

    debug.grant([
      { itemId: "fiber", count: 4 },
      { itemId: "stick", count: 3 },
      { itemId: "palm_frond", count: 4 },
    ]);
    debug.craft("lashing");
    if (!debug.build("shelter", -1, 4)) throw new Error("Schutzdach konnte nicht gebaut werden.");

    debug.grant([
      { itemId: "fiber", count: 8 },
      { itemId: "palm_log", count: 2 },
      { itemId: "stick", count: 4 },
    ]);
    debug.craft("lashing");
    debug.craft("lashing");
    if (!debug.build("workbench", -2, -4)) throw new Error("Werkbank konnte nicht gebaut werden.");

    debug.grant([
      { itemId: "fiber", count: 16 },
      { itemId: "palm_log", count: 4 },
      { itemId: "stick", count: 6 },
      { itemId: "palm_frond", count: 2 },
    ]);
    debug.craft("lashing");
    debug.craft("lashing");
    debug.craft("lashing");
    debug.craft("lashing");
    if (!debug.build("raft_base", 27, 0)) throw new Error("Floßbasis konnte nicht gebaut werden.");
    if (!debug.build("raft_deck", 27, 0)) throw new Error("Floßdeck konnte nicht gebaut werden.");
    debug.craft("paddle");
    return debug.snapshot();
  });
  expect(builtState).toMatchObject({
    raft: { hasDeck: true, durability: 100 },
    world: {
      buildings: expect.arrayContaining([
        expect.objectContaining({ type: "shelter" }),
        expect.objectContaining({ type: "workbench" }),
      ]),
    },
    inventory: expect.arrayContaining([expect.objectContaining({ itemId: "paddle", quantity: 1 })]),
  });

  await page.evaluate(() => {
    const debug = window.__stranded2Debug!;
    if (!debug.enterRaft()) throw new Error("Floß konnte nicht betreten werden.");
    debug.moveRaft(280, 0);
    debug.exitRaft();
  });
  await expect(page.getByText(/Dschungelbucht · Tag 1/)).toBeVisible();

  await page.evaluate(() => window.__stranded2Debug!.save());
  await page.reload();
  const continueButton = page.getByRole("button", { name: /Fortsetzen/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByText(/Dschungelbucht · Tag 1/)).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("ein beschädigter aktueller Spielstand fällt auf das letzte Backup zurück", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForFunction(() => {
    const snapshot = window.__stranded2Debug?.snapshot() as { state?: string } | undefined;
    return snapshot?.state === "playing";
  });

  // Island and wildlife discoveries also autosave. Pause the simulation so the
  // two deliberate saves below define the current/backup pair deterministically.
  await page.evaluate(() => window.__stranded2Debug!.readLetter("letter-start-beach"));
  await expect(page.getByRole("button", { name: "Brief schließen" })).toBeVisible();
  await page.evaluate(() => window.__stranded2Debug!.teleportToIsland("start"));
  await page.evaluate(() => window.__stranded2Debug!.save());
  await page.evaluate(() => window.__stranded2Debug!.teleportToIsland("jungle"));
  await page.evaluate(() => window.__stranded2Debug!.save());

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("stranded2");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction("slots", "readwrite");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB-Transaktion abgebrochen."));
        const store = transaction.objectStore("slots");
        const get = store.get("current");
        get.onerror = () => reject(get.error);
        get.onsuccess = () => {
          if (!get.result) {
            transaction.abort();
            reject(new Error("Aktueller Spielstand fehlt."));
            return;
          }
          try {
            store.put({ ...get.result, payload: { damaged: true } });
          } catch (error) {
            transaction.abort();
            reject(error);
          }
        };
      };
    });
  });

  await page.reload();
  const continueButton = page.getByRole("button", { name: /Fortsetzen/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByText(/Kleine Sandbank · Tag 1/)).toBeVisible();
});
