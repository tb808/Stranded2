import RAPIER from "@dimforge/rapier3d-compat";
import { clamp, type Vec3Like } from "../core/math";

export interface PhysicsPose {
  position: Vec3Like;
  rotation: { x: number; y: number; z: number; w: number };
}

export interface PlayerMotion {
  x: number;
  z: number;
  vertical: number;
  swimming: boolean;
}

interface RaftPhysics {
  body: RAPIER.RigidBody;
  hasDeck: boolean;
}

export class RapierPhysicsWorld {
  private world!: RAPIER.World;
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private characterController: RAPIER.KinematicCharacterController | null = null;
  private readonly rafts = new Map<string, RaftPhysics>();
  private verticalVelocity = 0;
  private grounded = false;

  public async initialize(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
  }

  public dispose(): void {
    this.characterController?.free();
    this.world?.free();
    this.playerBody = null;
    this.playerCollider = null;
    this.rafts.clear();
  }

  public addTerrain(vertices: Float32Array, indices: Uint32Array): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setFriction(0.9)
        .setRestitution(0),
      body,
    );
  }

  public addFixedCuboid(position: Vec3Like, halfExtents: Vec3Like, rotationY = 0): RAPIER.Collider {
    const halfAngle = rotationY * 0.5;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) }),
    );
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(0.85),
      body,
    );
  }

  public addFixedCylinder(position: Vec3Like, halfHeight: number, radius: number): RAPIER.Collider {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );
    return this.world.createCollider(RAPIER.ColliderDesc.cylinder(halfHeight, radius).setFriction(0.9), body);
  }

  public removeColliderBody(collider: RAPIER.Collider): void {
    const parent = collider.parent();
    if (parent) this.world.removeRigidBody(parent);
    else this.world.removeCollider(collider, true);
  }

  public createPlayer(position: Vec3Like): void {
    this.playerBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z),
    );
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.6, 0.35)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.playerBody,
    );
    this.characterController = this.world.createCharacterController(0.025);
    this.characterController.enableAutostep(0.35, 0.2, false);
    this.characterController.enableSnapToGround(0.35);
    this.characterController.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    this.characterController.setMinSlopeSlideAngle((54 * Math.PI) / 180);
    this.characterController.setSlideEnabled(true);
  }

  public movePlayer(motion: PlayerMotion, dtSeconds: number): void {
    if (!this.playerBody || !this.playerCollider || !this.characterController) return;

    if (motion.swimming) {
      this.verticalVelocity += (motion.vertical - this.verticalVelocity) * Math.min(1, dtSeconds * 7);
    } else {
      if (this.grounded && motion.vertical > 0) this.verticalVelocity = motion.vertical;
      else this.verticalVelocity -= 9.81 * dtSeconds;
      this.verticalVelocity = Math.max(this.verticalVelocity, -25);
    }

    const desired = {
      x: motion.x * dtSeconds,
      y: this.verticalVelocity * dtSeconds,
      z: motion.z * dtSeconds,
    };
    this.characterController.computeColliderMovement(this.playerCollider, desired);
    const corrected = this.characterController.computedMovement();
    const current = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    });
    this.grounded = this.characterController.computedGrounded();
    if (this.grounded && this.verticalVelocity < 0) this.verticalVelocity = -0.5;
  }

  public setPlayerPosition(position: Vec3Like): void {
    if (!this.playerBody) return;
    this.playerBody.setTranslation(position, true);
    this.playerBody.setNextKinematicTranslation(position);
    this.verticalVelocity = 0;
  }

  public getPlayerPosition(): Vec3Like {
    const value = this.playerBody?.translation() ?? { x: 0, y: 3, z: 0 };
    return { x: value.x, y: value.y, z: value.z };
  }

  public isPlayerGrounded(): boolean {
    return this.grounded;
  }

  public setPlayerEnabled(enabled: boolean): void {
    this.playerCollider?.setEnabled(enabled);
  }

  public createRaft(id: string, position: Vec3Like, rotationY = 0): void {
    if (this.rafts.has(id)) return;
    const halfAngle = rotationY * 0.5;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) })
        .setLinearDamping(1.25)
        .setAngularDamping(3.2)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    const logOffsets = [-1.05, -0.35, 0.35, 1.05];
    for (const x of logOffsets) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.29, 0.22, 1.55)
          .setTranslation(x, 0, 0)
          .setDensity(0.28)
          .setFriction(0.65),
        body,
      );
    }
    this.rafts.set(id, { body, hasDeck: false });
  }

  public addRaftDeck(id: string): void {
    const raft = this.rafts.get(id);
    if (!raft || raft.hasDeck) return;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.35, 0.08, 1.5)
        .setTranslation(0, 0.31, 0)
        .setDensity(0.12)
        .setFriction(0.85),
      raft.body,
    );
    raft.hasDeck = true;
  }

  public removeRaft(id: string): void {
    const raft = this.rafts.get(id);
    if (!raft) return;
    this.world.removeRigidBody(raft.body);
    this.rafts.delete(id);
  }

  public setRaftPose(id: string, position: Vec3Like, rotation: PhysicsPose["rotation"]): void {
    const raft = this.rafts.get(id);
    if (!raft) return;
    raft.body.setTranslation(position, true);
    raft.body.setRotation(rotation, true);
    raft.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    raft.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  public getRaftPose(id: string): PhysicsPose | null {
    const raft = this.rafts.get(id);
    if (!raft) return null;
    const position = raft.body.translation();
    const rotation = raft.body.rotation();
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    };
  }

  public applyRaftControl(id: string, throttle: number, steering: number, hasPaddle: boolean): void {
    const raft = this.rafts.get(id);
    if (!raft || !raft.hasDeck || !hasPaddle) return;
    const rotation = raft.body.rotation();
    const forward = {
      x: 2 * (rotation.x * rotation.z + rotation.w * rotation.y),
      z: 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y),
    };
    const velocity = raft.body.linvel();
    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    if (Math.abs(throttle) > 0.01 && planarSpeed < 3.2) {
      const force = 22 * throttle;
      raft.body.addForce({ x: forward.x * force, y: 0, z: forward.z * force }, true);
    }
    if (Math.abs(steering) > 0.01) {
      raft.body.addTorque({ x: 0, y: steering * 7 * clamp(planarSpeed / 1.5, 0.25, 1), z: 0 }, true);
    }
  }

  public applyRaftImpulse(id: string, impulse: Vec3Like): void {
    this.rafts.get(id)?.body.applyImpulse(impulse, true);
  }

  public step(dtSeconds: number, elapsedSeconds: number): void {
    this.world.timestep = dtSeconds;
    for (const raft of this.rafts.values()) this.applyBuoyancy(raft.body, elapsedSeconds);
    this.world.step();
    for (const raft of this.rafts.values()) {
      // Rapier keeps user forces and torques active until they are explicitly
      // cleared. Buoyancy and paddle input are per-step forces; retaining them
      // would accumulate lift every frame and eventually launch the raft.
      raft.body.resetForces(false);
      raft.body.resetTorques(false);
    }
  }

  private applyBuoyancy(body: RAPIER.RigidBody, elapsedSeconds: number): void {
    const rotation = body.rotation();
    const translation = body.translation();
    const localPoints = [
      { x: -1.1, y: -0.2, z: -1.2 },
      { x: 1.1, y: -0.2, z: -1.2 },
      { x: -1.1, y: -0.2, z: 1.2 },
      { x: 1.1, y: -0.2, z: 1.2 },
    ];
    const mass = body.mass();
    for (const local of localPoints) {
      const worldPoint = rotateAndTranslate(local, rotation, translation);
      const waterY = oceanHeight(worldPoint.x, worldPoint.z, elapsedSeconds);
      const depth = waterY - worldPoint.y;
      if (depth <= 0) continue;
      const lift = (mass * 9.81 * clamp(depth * 1.8, 0, 2.2)) / localPoints.length;
      body.addForceAtPoint({ x: 0, y: lift, z: 0 }, worldPoint, true);
    }
    const velocity = body.linvel();
    body.addForce({ x: -velocity.x * mass * 0.7, y: 0, z: -velocity.z * mass * 0.7 }, true);
  }
}

function oceanHeight(x: number, z: number, time: number): number {
  return Math.sin(x * 0.055 + time * 1.1) * 0.08 + Math.cos(z * 0.07 - time * 0.8) * 0.06;
}

function rotateAndTranslate(
  point: Vec3Like,
  q: PhysicsPose["rotation"],
  translation: Vec3Like,
): Vec3Like {
  const ix = q.w * point.x + q.y * point.z - q.z * point.y;
  const iy = q.w * point.y + q.z * point.x - q.x * point.z;
  const iz = q.w * point.z + q.x * point.y - q.y * point.x;
  const iw = -q.x * point.x - q.y * point.y - q.z * point.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y + translation.x,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z + translation.y,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x + translation.z,
  };
}
