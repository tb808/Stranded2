import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import type { AssetService } from "../assets/AssetService";
import type { ItemId } from "../data/items";

interface ToolViewDefinition {
  readonly assetId: string | undefined;
  readonly height: number;
  readonly widthScale: number;
  readonly gripHeight: number;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly modelRotation: readonly [number, number, number];
  readonly useOffset: readonly [number, number, number];
  readonly useRotation: readonly [number, number, number];
}

const FRONT_REVEAL_TURN = 0.24;
const AXE_HEAD_FLIP = Math.PI;
const AXE_FRONT_REVEAL_TURN = 0.32;

/**
 * Kenney's Survival Kit provides dedicated axe and hammer models. The remaining
 * recipe tools are small matching low-poly constructions because the kit does
 * not contain a knife, spear or paddle model.
 */
export const TOOL_VIEW_DEFINITIONS = {
  stone_knife: {
    assetId: undefined,
    height: 0.52,
    widthScale: 1,
    gripHeight: 0.16,
    position: [0.57, -0.69, -0.72],
    rotation: [-0.16, -0.24, 0.42],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.05, -0.14, 0.06],
    useRotation: [-0.88, 0.24, 0.5],
  },
  obsidian_knife: {
    assetId: undefined,
    height: 0.58,
    widthScale: 1,
    gripHeight: 0.17,
    position: [0.58, -0.71, -0.73],
    rotation: [-0.16, -0.24, 0.42],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.05, -0.14, 0.06],
    useRotation: [-0.88, 0.24, 0.5],
  },
  stone_axe: {
    assetId: "survival.tool-axe",
    height: 0.98,
    widthScale: 1.04,
    gripHeight: 0.33,
    position: [0.64, -0.9, -0.78],
    rotation: [-0.1, -0.12, 0.28],
    modelRotation: [0, 1.22 + FRONT_REVEAL_TURN + AXE_FRONT_REVEAL_TURN + AXE_HEAD_FLIP, 0],
    useOffset: [-0.025, -0.08, -0.16],
    useRotation: [-1.02, 0.08, 0.12],
  },
  wooden_spear: {
    assetId: undefined,
    height: 1.15,
    widthScale: 1,
    gripHeight: 0.45,
    position: [0.63, -1.02, -0.82],
    rotation: [-0.1, -0.2, 0.22],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.05, -0.14, 0.06],
    useRotation: [-0.88, 0.24, 0.5],
  },
  building_hammer: {
    assetId: "survival.tool-hammer",
    height: 0.62,
    widthScale: 1,
    gripHeight: 0.26,
    position: [0.66, -0.8, -0.75],
    rotation: [-0.14, -0.24, 0.36],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.05, -0.14, 0.06],
    useRotation: [-0.88, 0.24, 0.5],
  },
  fishing_rod: {
    assetId: undefined,
    height: 1.22,
    widthScale: 1,
    gripHeight: 0.42,
    position: [0.62, -1.02, -0.9],
    rotation: [-0.18, -0.18, 0.2],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.04, -0.12, 0.18],
    useRotation: [-0.68, 0.12, 0.18],
  },
  climbing_kit: {
    assetId: undefined,
    height: 0.58,
    widthScale: 1,
    gripHeight: 0.16,
    position: [0.58, -0.72, -0.74],
    rotation: [-0.2, -0.28, 0.32],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.04, -0.1, 0.09],
    useRotation: [-0.58, 0.16, 0.24],
  },
  shovel: {
    assetId: undefined,
    height: 1.08,
    widthScale: 1,
    gripHeight: 0.48,
    position: [0.66, -1.02, -0.84],
    rotation: [-0.12, -0.22, 0.25],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.03, -0.13, -0.16],
    useRotation: [-1.08, 0.1, 0.12],
  },
  paddle: {
    assetId: undefined,
    height: 1.18,
    widthScale: 1,
    gripHeight: 0.48,
    position: [0.64, -1.05, -0.88],
    rotation: [-0.12, -0.28, 0.2],
    modelRotation: [0, FRONT_REVEAL_TURN, 0],
    useOffset: [-0.05, -0.14, 0.06],
    useRotation: [-0.88, 0.24, 0.5],
  },
  raw_meat: {
    assetId: "food.meat-raw",
    height: 0.24,
    widthScale: 1,
    gripHeight: 0.03,
    position: [0.58, -0.5, -0.72],
    rotation: [-0.3, -0.34, 0.25],
    modelRotation: [0.35, 0.6, -0.12],
    useOffset: [-0.03, -0.05, 0.05],
    useRotation: [-0.18, 0.08, 0.06],
  },
  cooked_meat: {
    assetId: "food.meat-cooked",
    height: 0.24,
    widthScale: 1,
    gripHeight: 0.03,
    position: [0.58, -0.5, -0.72],
    rotation: [-0.3, -0.34, 0.25],
    modelRotation: [0.35, 0.6, -0.12],
    useOffset: [-0.03, -0.05, 0.05],
    useRotation: [-0.18, 0.08, 0.06],
  },
  smoked_meat: {
    assetId: "food.meat-cooked",
    height: 0.24,
    widthScale: 1,
    gripHeight: 0.03,
    position: [0.58, -0.5, -0.72],
    rotation: [-0.3, -0.34, 0.25],
    modelRotation: [0.35, 0.6, -0.12],
    useOffset: [-0.03, -0.05, 0.05],
    useRotation: [-0.18, 0.08, 0.06],
  },
  raw_fish: {
    assetId: "survival.fish",
    height: 0.42,
    widthScale: 1,
    gripHeight: 0.06,
    position: [0.58, -0.52, -0.72],
    rotation: [-0.28, -0.3, 0.3],
    modelRotation: [0.1, 0.45, Math.PI / 2],
    useOffset: [-0.03, -0.05, 0.05],
    useRotation: [-0.18, 0.08, 0.06],
  },
  cooked_fish: {
    assetId: "survival.fish",
    height: 0.42,
    widthScale: 1,
    gripHeight: 0.06,
    position: [0.58, -0.52, -0.72],
    rotation: [-0.28, -0.3, 0.3],
    modelRotation: [0.1, 0.45, Math.PI / 2],
    useOffset: [-0.03, -0.05, 0.05],
    useRotation: [-0.18, 0.08, 0.06],
  },
} as const satisfies Partial<Record<ItemId, ToolViewDefinition>>;

export type ToolViewItemId = keyof typeof TOOL_VIEW_DEFINITIONS;

export const TOOL_VIEW_ITEM_IDS = Object.freeze(Object.keys(TOOL_VIEW_DEFINITIONS) as ToolViewItemId[]);

export function isToolViewItem(itemId: ItemId): itemId is ToolViewItemId {
  return TOOL_VIEW_ITEM_IDS.includes(itemId as ToolViewItemId);
}

export class FirstPersonToolView {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(75, 1, 0.01, 10);
  private readonly holder = new Group();
  private readonly models = new Map<ToolViewItemId, Group>();
  private currentItem: ToolViewItemId | null = null;
  private walkPhase = 0;
  private useTime = 0;

  public constructor(private readonly assets: AssetService) {
    const hemisphere = new HemisphereLight(0xe8f7ff, 0x4b321e, 2.1);
    const key = new DirectionalLight(0xfff1d2, 2.7);
    key.position.set(-2, 4, 3);
    this.scene.add(hemisphere, key, this.holder);
  }

  public get itemId(): ItemId | null {
    return this.currentItem;
  }

  public setProjection(fov: number, aspect: number): void {
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public triggerUse(): void {
    if (this.currentItem) this.useTime = 0.34;
  }

  public update(itemId: ItemId | null, elapsed: number, moving: boolean, reducedMotion: boolean): void {
    this.syncItem(itemId);
    if (!this.currentItem) return;

    const definition = TOOL_VIEW_DEFINITIONS[this.currentItem];
    const dt = Math.min(elapsed, 0.05);
    this.walkPhase += dt * (moving ? 9.5 : 2.1);
    this.useTime = Math.max(0, this.useTime - dt);

    const bobAmount = reducedMotion ? 0 : moving ? 1 : 0.22;
    const bobX = Math.sin(this.walkPhase) * 0.009 * bobAmount;
    const bobY = Math.abs(Math.cos(this.walkPhase)) * 0.011 * bobAmount;
    const useProgress = this.useTime > 0 ? 1 - this.useTime / 0.34 : 0;
    const swing = Math.sin(useProgress * Math.PI) * (reducedMotion ? 0.32 : 1);

    this.holder.position.set(
      definition.position[0] + bobX + swing * definition.useOffset[0],
      definition.position[1] - bobY + swing * definition.useOffset[1],
      definition.position[2] + swing * definition.useOffset[2],
    );
    this.holder.rotation.set(
      definition.rotation[0] + swing * definition.useRotation[0],
      definition.rotation[1] + swing * definition.useRotation[1],
      definition.rotation[2] + swing * definition.useRotation[2],
      "YXZ",
    );
  }

  public render(renderer: WebGLRenderer): void {
    if (!this.currentItem || this.holder.children.length === 0) return;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }

  public dispose(): void {
    for (const model of this.models.values()) {
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.models.clear();
    this.holder.clear();
  }

  private syncItem(itemId: ItemId | null): void {
    const supportedItem = itemId && isToolViewItem(itemId) ? itemId : null;
    if (supportedItem === this.currentItem) return;
    this.holder.clear();
    this.currentItem = supportedItem;
    this.useTime = 0;
    if (!supportedItem) return;

    let model = this.models.get(supportedItem);
    if (!model) {
      const definition = TOOL_VIEW_DEFINITIONS[supportedItem];
      model = definition.assetId
        ? this.assets.createModel(definition.assetId) ?? undefined
        : isProceduralTool(supportedItem)
          ? createProceduralTool(supportedItem)
          : undefined;
      if (!model) {
        this.currentItem = null;
        return;
      }
      this.prepareModel(model, definition.height, definition.widthScale);
      const toolPivot = new Group();
      toolPivot.rotation.set(
        definition.modelRotation[0],
        definition.modelRotation[1],
        definition.modelRotation[2],
        "YXZ",
      );
      toolPivot.add(model);
      const heldVisual = new Group();
      heldVisual.add(toolPivot, createFirstPersonHand(definition.gripHeight));
      model = heldVisual;
      this.models.set(supportedItem, model);
    }
    this.holder.add(model);
  }

  private prepareModel(model: Group, targetHeight: number, widthScale: number): void {
    model.traverse((object) => {
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
      if (!(object instanceof Mesh)) return;
      if (Array.isArray(object.material)) object.material = object.material.map((material) => material.clone());
      else object.material = object.material.clone();
      this.prepareMaterials(object.material);
    });

    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    if (size.y > 0) model.scale.multiplyScalar(targetHeight / size.y);
    const heightScaledSize = new Box3().setFromObject(model).getSize(new Vector3());
    const longest = Math.max(heightScaledSize.x, heightScaledSize.y, heightScaledSize.z);
    const maximumExtent = targetHeight * 2.15;
    if (longest > maximumExtent) model.scale.multiplyScalar(maximumExtent / longest);
    model.scale.x *= widthScale;
    const normalizedBox = new Box3().setFromObject(model);
    const center = normalizedBox.getCenter(new Vector3());
    model.position.set(-center.x, -normalizedBox.min.y, -center.z);
  }

  private prepareMaterials(material: Material | Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      entry.depthTest = true;
      entry.depthWrite = true;
      entry.transparent = false;
      entry.opacity = 1;
      entry.needsUpdate = true;
    }
  }
}

type ProceduralToolItemId = "stone_knife" | "obsidian_knife" | "wooden_spear" | "fishing_rod" | "climbing_kit" | "shovel" | "paddle";

function createFirstPersonHand(gripHeight: number): Group {
  const hand = new Group();
  hand.name = "Rechte Hand";
  hand.position.y = gripHeight;
  const skin = new MeshStandardMaterial({ color: 0xc98763, roughness: 0.82, flatShading: true });
  const sleeve = new MeshStandardMaterial({ color: 0x294f4b, roughness: 0.92, flatShading: true });

  const palm = new Mesh(new SphereGeometry(0.09, 8, 6), skin);
  palm.scale.set(0.82, 1, 0.7);
  palm.position.set(0, 0.045, 0.035);
  const thumb = new Mesh(new CylinderGeometry(0.022, 0.026, 0.105, 7), skin);
  thumb.position.set(-0.07, 0.035, -0.005);
  thumb.rotation.set(0.28, 0, -0.72);
  const fingers = [-0.052, 0, 0.052].map((x, index) => {
    const finger = new Mesh(new CylinderGeometry(0.018, 0.022, 0.095, 7), skin);
    finger.position.set(x, 0.065 - index * 0.004, -0.047);
    finger.rotation.x = 0.62;
    return finger;
  });
  const knuckles = [-0.052, 0, 0.052].map((x) => {
    const knuckle = new Mesh(new SphereGeometry(0.025, 7, 5), skin);
    knuckle.position.set(x, 0.097, -0.025);
    return knuckle;
  });
  const wrist = new Mesh(new SphereGeometry(0.072, 8, 6), skin);
  wrist.scale.set(0.82, 0.85, 0.78);
  wrist.position.set(0.014, -0.055, 0.055);
  const forearm = new Mesh(new CylinderGeometry(0.062, 0.078, 0.43, 8), skin);
  forearm.position.set(0.025, -0.275, 0.07);
  forearm.rotation.z = -0.055;
  const cuff = new Mesh(new CylinderGeometry(0.086, 0.078, 0.18, 8), sleeve);
  cuff.position.set(0.045, -0.49, 0.082);
  cuff.rotation.z = -0.075;

  hand.add(forearm, cuff, wrist, palm, thumb, ...fingers, ...knuckles);
  return hand;
}

function isProceduralTool(itemId: ToolViewItemId): itemId is ProceduralToolItemId {
  return itemId === "stone_knife" || itemId === "obsidian_knife" || itemId === "wooden_spear" || itemId === "fishing_rod" || itemId === "climbing_kit" || itemId === "shovel" || itemId === "paddle";
}

function createProceduralTool(itemId: ProceduralToolItemId): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x9a6036, roughness: 0.92 });
  const stone = new MeshStandardMaterial({
    color: itemId === "obsidian_knife" ? 0x17151d : 0x879294,
    emissive: itemId === "obsidian_knife" ? 0x28122f : 0x000000,
    emissiveIntensity: itemId === "obsidian_knife" ? 0.2 : 0,
    metalness: itemId === "obsidian_knife" ? 0.32 : 0,
    roughness: itemId === "obsidian_knife" ? 0.34 : 0.86,
  });
  const binding = new MeshStandardMaterial({ color: 0xb58a56, roughness: 1 });

  if (itemId === "stone_knife" || itemId === "obsidian_knife") {
    const handle = new Mesh(new CylinderGeometry(0.028, 0.034, 0.14, 7), wood);
    handle.position.y = 0.07;
    const blade = new Mesh(new ConeGeometry(0.058, 0.25, 4), stone);
    blade.position.y = 0.255;
    blade.rotation.y = Math.PI / 4;
    const wrap = new Mesh(new CylinderGeometry(0.037, 0.037, 0.045, 7), binding);
    wrap.position.y = 0.145;
    group.add(handle, wrap, blade);
    return group;
  }

  if (itemId === "wooden_spear") {
    const shaft = new Mesh(new CylinderGeometry(0.014, 0.019, 1.18, 7), wood);
    shaft.position.y = 0.59;
    const tip = new Mesh(new ConeGeometry(0.05, 0.2, 5), stone);
    tip.position.y = 1.28;
    const wrap = new Mesh(new CylinderGeometry(0.024, 0.024, 0.09, 7), binding);
    wrap.position.y = 1.16;
    group.add(shaft, wrap, tip);
    return group;
  }

  if (itemId === "fishing_rod") {
    const shaft = new Mesh(new CylinderGeometry(0.012, 0.026, 1.16, 8), wood);
    shaft.position.y = 0.58;
    shaft.rotation.z = -0.07;
    const grip = new Mesh(new CylinderGeometry(0.03, 0.034, 0.26, 8), binding);
    grip.position.y = 0.13;
    const line = new Mesh(
      new CylinderGeometry(0.003, 0.003, 0.7, 5),
      new MeshStandardMaterial({ color: 0xd5ddd2, roughness: 0.72 }),
    );
    line.position.set(-0.08, 0.88, 0);
    const hook = new Mesh(new SphereGeometry(0.025, 6, 5), stone);
    hook.position.set(-0.08, 0.52, 0);
    group.add(shaft, grip, line, hook);
    return group;
  }

  if (itemId === "climbing_kit") {
    const metal = new MeshStandardMaterial({ color: 0x7e8c91, roughness: 0.5, metalness: 0.65 });
    for (let index = 0; index < 4; index += 1) {
      const coil = new Mesh(new CylinderGeometry(0.15 + index * 0.025, 0.15 + index * 0.025, 0.025, 14, 1, true), binding);
      coil.position.y = 0.08 + index * 0.035;
      group.add(coil);
    }
    const peg = new Mesh(new CylinderGeometry(0.026, 0.035, 0.42, 7), metal);
    peg.position.set(0.14, 0.3, 0);
    peg.rotation.z = -0.5;
    const hook = new Mesh(new ConeGeometry(0.065, 0.16, 6), metal);
    hook.position.set(0.24, 0.48, 0);
    hook.rotation.z = -0.5;
    group.add(peg, hook);
    return group;
  }

  if (itemId === "shovel") {
    const metal = new MeshStandardMaterial({ color: 0x667174, roughness: 0.58, metalness: 0.42 });
    const shaft = new Mesh(new CylinderGeometry(0.028, 0.038, 1.12, 8), wood);
    shaft.position.y = 0.63;
    const collar = new Mesh(new CylinderGeometry(0.048, 0.048, 0.14, 8), binding);
    collar.position.y = 0.12;
    const blade = new Mesh(new BoxGeometry(0.36, 0.42, 0.065), metal);
    blade.position.y = -0.11;
    const grip = new Mesh(new BoxGeometry(0.3, 0.06, 0.06), wood);
    grip.position.y = 1.22;
    group.add(shaft, collar, blade, grip);
    return group;
  }

  const blade = new Mesh(new CylinderGeometry(0.075, 0.135, 0.34, 6), wood);
  blade.position.y = 0.17;
  blade.scale.z = 0.24;
  const shaft = new Mesh(new CylinderGeometry(0.017, 0.022, 0.82, 7), wood);
  shaft.position.y = 0.72;
  const grip = new Mesh(new BoxGeometry(0.14, 0.035, 0.035), wood);
  grip.position.y = 1.145;
  group.add(blade, shaft, grip);
  return group;
}
