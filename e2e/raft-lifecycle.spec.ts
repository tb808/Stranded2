import { expect, type Page, test } from "@playwright/test";

interface VectorSnapshot {
  x: number;
  y: number;
  z: number;
}

interface RaftSnapshot {
  hasDeck: boolean;
  durability: number;
  position: VectorSnapshot;
}

interface GameSnapshot {
  state: string;
  onRaft: boolean;
  position: VectorSnapshot | null;
  raft: RaftSnapshot | null;
}

async function readSnapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => window.__stranded2Debug!.snapshot() as GameSnapshot);
}

async function startNewGame(page: Page): Promise<void> {
  await page.goto("/");
  const newGame = page.getByRole("button", { name: "Neues Spiel" });
  await expect(newGame).toBeEnabled();
  await newGame.click();
  await page.waitForFunction(() => {
    const snapshot = window.__stranded2Debug?.snapshot() as GameSnapshot | undefined;
    return snapshot?.state === "playing" && snapshot.position !== null;
  });
  await expect(page.getByRole("region", { name: "Spielanzeige" })).toBeVisible();
}

async function createAndBoardRaft(page: Page, x: number, z: number): Promise<void> {
  await page.evaluate(
    ({ raftX, raftZ }) => {
      const debug = window.__stranded2Debug!;
      debug.grant([
        { itemId: "building_hammer", count: 1 },
        { itemId: "paddle", count: 1 },
        { itemId: "palm_log", count: 4 },
        { itemId: "lashing", count: 3 },
        { itemId: "stick", count: 4 },
        { itemId: "palm_frond", count: 2 },
      ]);
      if (!debug.build("raft_base", raftX, raftZ)) throw new Error("Floßbasis konnte nicht gebaut werden.");
      if (!debug.build("raft_deck", raftX, raftZ)) throw new Error("Floßdeck konnte nicht gebaut werden.");
      if (!debug.enterRaft()) throw new Error("Floß konnte nicht betreten werden.");
      debug.moveRaft(raftX, raftZ);
    },
    { raftX: x, raftZ: z },
  );

  await page.waitForFunction(
    ({ raftX, raftZ }) => {
      const snapshot = window.__stranded2Debug?.snapshot() as GameSnapshot | undefined;
      return Boolean(
        snapshot?.onRaft &&
          snapshot.raft?.hasDeck &&
          snapshot.position &&
          Math.hypot(snapshot.position.x - raftX, snapshot.position.z - raftZ) < 0.75,
      );
    },
    { raftX: x, raftZ: z },
  );
}

async function expectPlayerCanMove(page: Page): Promise<void> {
  const start = (await readSnapshot(page)).position;
  expect(start).not.toBeNull();

  await page.keyboard.down("w");
  try {
    await expect
      .poll(
        async () => {
          const current = (await readSnapshot(page)).position;
          if (!current || !start) return 0;
          return Math.hypot(current.x - start.x, current.z - start.z);
        },
        { timeout: 5_000, intervals: [100, 150, 250] },
      )
      .toBeGreaterThan(0.3);
  } finally {
    await page.keyboard.up("w");
  }

  const end = await readSnapshot(page);
  expect(end.state).toBe("playing");
  expect(end.onRaft).toBe(false);
  expect(end.position && [end.position.x, end.position.y, end.position.z].every(Number.isFinite)).toBe(true);
}

test("ein neues Spiel nach Rückkehr vom Floß startet zu Fuß in einer frischen Welt", async ({ page }) => {
  await startNewGame(page);
  await createAndBoardRaft(page, 27, 0);
  await expect.poll(async () => (await readSnapshot(page)).onRaft).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Pausiert" })).toBeVisible();
  await expect(page.getByText("Spielstand aktuell")).toBeVisible();
  await page.getByRole("button", { name: "Zum Hauptmenü" }).click();
  await expect(page.getByRole("navigation", { name: "Hauptmenü" })).toBeVisible();
  await expect.poll(async () => (await readSnapshot(page)).state).toBe("menu");

  await page.getByRole("button", { name: "Neues Spiel" }).click();
  await page.waitForFunction(() => {
    const snapshot = window.__stranded2Debug?.snapshot() as GameSnapshot | undefined;
    return snapshot?.state === "playing" && snapshot.onRaft === false && snapshot.raft === null && snapshot.position !== null;
  });

  const freshGame = await readSnapshot(page);
  expect(freshGame.onRaft).toBe(false);
  expect(freshGame.raft).toBeNull();
  await expectPlayerCanMove(page);
});

test("gespeichertes Floß wird nach Reload sicher zu Fuß wieder aufgenommen", async ({ page }) => {
  await startNewGame(page);
  const savedRaftPosition = { x: 72, z: 8 };
  await createAndBoardRaft(page, savedRaftPosition.x, savedRaftPosition.z);
  await page.evaluate(() => window.__stranded2Debug!.save());

  const beforeReload = await readSnapshot(page);
  expect(beforeReload.onRaft).toBe(true);
  expect(beforeReload.raft?.hasDeck).toBe(true);
  expect(beforeReload.raft?.position.x).toBeCloseTo(savedRaftPosition.x, 1);
  expect(beforeReload.raft?.position.z).toBeCloseTo(savedRaftPosition.z, 1);

  await page.reload();
  const continueButton = page.getByRole("button", { name: /Fortsetzen/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await page.waitForFunction(() => {
    const snapshot = window.__stranded2Debug?.snapshot() as GameSnapshot | undefined;
    return snapshot?.state === "playing" && snapshot.onRaft === false && snapshot.raft?.hasDeck === true && snapshot.position !== null;
  });

  const restored = await readSnapshot(page);
  expect(restored.onRaft).toBe(false);
  expect(restored.raft?.position.x).toBeCloseTo(savedRaftPosition.x, 1);
  expect(restored.raft?.position.z).toBeCloseTo(savedRaftPosition.z, 1);
  expect(restored.position && [restored.position.x, restored.position.y, restored.position.z].every(Number.isFinite)).toBe(true);

  const boardedAgain = await page.evaluate(() => window.__stranded2Debug!.enterRaft());
  expect(boardedAgain).toBe(true);
  await expect.poll(async () => (await readSnapshot(page)).onRaft).toBe(true);
  await page.evaluate(() => window.__stranded2Debug!.exitRaft());
  await expect.poll(async () => (await readSnapshot(page)).onRaft).toBe(false);
  await expectPlayerCanMove(page);
});
