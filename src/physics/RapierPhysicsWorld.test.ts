import { afterEach, describe, expect, it } from "vitest";
import { RapierPhysicsWorld } from "./RapierPhysicsWorld";

describe("RapierPhysicsWorld", () => {
  let physics: RapierPhysicsWorld | null = null;

  afterEach(() => {
    physics?.dispose();
    physics = null;
  });

  it("hält die Spielerkapsel auf dem Boden und blockiert feste Hindernisse", async () => {
    physics = new RapierPhysicsWorld();
    await physics.initialize();
    physics.addFixedCuboid({ x: 0, y: -0.5, z: 0 }, { x: 10, y: 0.5, z: 10 });
    physics.addFixedCuboid({ x: 2, y: 1, z: 0 }, { x: 0.25, y: 2, z: 2 });
    physics.createPlayer({ x: 0, y: 3, z: 0 });

    for (let step = 0; step < 180; step += 1) {
      physics.movePlayer({ x: 0, z: 0, vertical: 0, swimming: false }, 1 / 60);
      physics.step(1 / 60, step / 60);
    }
    expect(physics.getPlayerPosition().y).toBeGreaterThan(0.9);
    expect(physics.getPlayerPosition().y).toBeLessThan(1.05);
    expect(physics.isPlayerGrounded()).toBe(true);

    for (let step = 0; step < 90; step += 1) {
      physics.movePlayer({ x: 4, z: 0, vertical: 0, swimming: false }, 1 / 60);
      physics.step(1 / 60, 3 + step / 60);
    }
    expect(physics.getPlayerPosition().x).toBeLessThan(1.45);
  });

  it("lässt eine frisch platzierte Floßbasis ruhig auf dem Wasser einschwingen", async () => {
    physics = new RapierPhysicsWorld();
    await physics.initialize();
    physics.createRaft("raft-test", { x: 0, y: 0.35, z: 0 });

    let highestPosition = Number.NEGATIVE_INFINITY;
    for (let step = 0; step < 600; step += 1) {
      physics.step(1 / 60, step / 60);
      highestPosition = Math.max(highestPosition, physics.getRaftPose("raft-test")!.position.y);
    }

    const pose = physics.getRaftPose("raft-test")!;
    expect(highestPosition).toBeLessThan(0.65);
    expect(pose.position.y).toBeGreaterThan(-0.55);
    expect(pose.position.y).toBeLessThan(0.25);
  });
});
