import { expect, type Page, test } from "@playwright/test";

async function startNewGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForFunction(() => {
    const snapshot = window.__stranded2Debug?.snapshot() as { state?: string } | undefined;
    return snapshot?.state === "playing";
  });
}

async function makeIndexedDbWritesFail(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserWindow = window as typeof window & { __stranded2OriginalPut?: typeof IDBObjectStore.prototype.put };
    if (!browserWindow.__stranded2OriginalPut) browserWindow.__stranded2OriginalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function putFailure(): IDBRequest<IDBValidKey> {
      throw new DOMException("Absichtlich blockierter E2E-Schreibzugriff", "QuotaExceededError");
    };
  });
}

async function restoreIndexedDbWrites(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserWindow = window as typeof window & { __stranded2OriginalPut?: typeof IDBObjectStore.prototype.put };
    if (browserWindow.__stranded2OriginalPut) IDBObjectStore.prototype.put = browserWindow.__stranded2OriginalPut;
  });
}

test("Speicherfehler lassen sich erneut versuchen oder bewusst überspringen", async ({ page }) => {
  await startNewGame(page);
  await makeIndexedDbWritesFail(page);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Spielstand konnte nicht gespeichert werden" })).toBeVisible();

  await restoreIndexedDbWrites(page);
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(page.getByRole("heading", { name: "Pausiert" })).toBeVisible();
  await expect(page.getByText("Spielstand aktuell")).toBeVisible();

  await page.getByRole("button", { name: "Weiterspielen" }).click();
  await makeIndexedDbWritesFail(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Spielstand konnte nicht gespeichert werden" })).toBeVisible();
  await page.getByRole("button", { name: "Ohne Speichern fortfahren" }).click();
  await expect(page.getByRole("heading", { name: "Pausiert" })).toBeVisible();
  await expect(page.getByText("Speichern nicht verfügbar")).toBeVisible();

  await page.getByRole("button", { name: "Zum Hauptmenü" }).click();
  await expect(page.getByRole("heading", { name: "Spielstand konnte nicht gespeichert werden" })).toBeVisible();
  await page.getByRole("button", { name: "Ohne Speichern fortfahren" }).click();
  await expect(page.getByRole("navigation", { name: "Hauptmenü" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (window.__stranded2Debug?.snapshot() as { state?: string })?.state)).toBe("menu");
});

test("versionierte Einstellungen bleiben in ihrem eigenen IndexedDB-Bereich erhalten", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.locator("#setting-quality").selectOption("low");
  await page.locator("#setting-fov").fill("88");

  await expect.poll(async () => page.evaluate(async () => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open("stranded2-settings");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction("settings", "readonly").objectStore("settings").get("current");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        const record = get.result as { payload?: { schemaVersion?: number; settings?: { quality?: string; fov?: number } } } | undefined;
        database.close();
        resolve(record?.payload?.schemaVersion === 1 && record.payload.settings?.fov === 88
          ? record.payload.settings.quality ?? null
          : null);
      };
    };
  }))).toBe("low");

  await page.reload();
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.locator("#setting-quality")).toHaveValue("low");
  await expect(page.locator("#setting-fov")).toHaveValue("88");
});
