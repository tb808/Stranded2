import { Group, Mesh, MeshStandardMaterial, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

interface AssetManifestEntry {
  id: string;
  kind: string;
  path: string;
}

interface AssetManifestPackage {
  assets: AssetManifestEntry[];
}

interface AssetManifest {
  basePath: string;
  packages: AssetManifestPackage[];
}

interface IndexedAsset extends AssetManifestEntry {
  url: string;
}

export class AssetService {
  private readonly loader = new GLTFLoader();
  private readonly index = new Map<string, IndexedAsset>();
  private readonly modelCache = new Map<string, Group>();
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    const manifestUrl = new URL("assets/asset-manifest.json", document.baseURI);
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`Asset-Manifest konnte nicht geladen werden (${response.status}).`);
    const manifest = (await response.json()) as AssetManifest;
    const baseUrl = new URL(`${manifest.basePath.replace(/^\.\//, "")}/`, manifestUrl);
    for (const pack of manifest.packages) {
      for (const asset of pack.assets) {
        this.index.set(asset.id, { ...asset, url: new URL(asset.path, baseUrl).href });
      }
    }
    this.initialized = true;
  }

  public getUrl(id: string): string | null {
    return this.index.get(id)?.url ?? null;
  }

  public async loadModel(id: string): Promise<Group | null> {
    const cached = this.modelCache.get(id);
    if (cached) return this.cloneModel(cached);
    const entry = this.index.get(id);
    if (!entry || entry.kind !== "model/gltf-binary") return null;
    try {
      const gltf = await this.loader.loadAsync(entry.url);
      const model = gltf.scene;
      model.animations = gltf.animations;
      this.prepareModel(model, id);
      this.modelCache.set(id, model);
      return this.cloneModel(model);
    } catch (error) {
      console.warn(`Optionales Modell ${id} konnte nicht geladen werden.`, error);
      return null;
    }
  }

  public createModel(id: string): Group | null {
    const model = this.modelCache.get(id);
    return model ? this.cloneModel(model) : null;
  }

  public async preloadModels(ids: readonly string[], onProgress?: (progress: number) => void): Promise<void> {
    let loaded = 0;
    await Promise.all(
      ids.map(async (id) => {
        await this.loadModel(id);
        loaded += 1;
        onProgress?.(loaded / ids.length);
      }),
    );
  }

  private prepareModel(root: Object3D, id: string): void {
    root.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = !id.startsWith("nature.palm");
      child.frustumCulled = true;
      if (child instanceof Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          // Several Kenney Nature Kit GLBs declare painted wood, leaves and stone as
          // fully metallic. Without an environment map that makes them render black.
          if (material instanceof MeshStandardMaterial) {
            material.metalness = 0;
            material.roughness = Math.max(material.roughness, 0.78);
            const materialName = material.name.toLowerCase();
            if (id.startsWith("nature.palm")) {
              material.color.setHex(materialName.includes("leaf") ? 0x26734c : 0x7a4d2f);
            } else if (id === "nature.log") {
              material.color.setHex(0x805331);
            } else if (id === "nature.grass-leafs-large") {
              material.color.setHex(0x6f9f45);
            } else if (id.startsWith("nature.grass")) {
              material.color.setHex(0x4f853c);
            } else if (id.startsWith("nature.plant-flat")) {
              material.color.setHex(0x347346);
            } else if (id.startsWith("nature.bush")) {
              material.color.setHex(0x315f37);
            } else if (id === "nature.tree-default") {
              material.color.setHex(materialName.includes("leaf") ? 0x245f36 : 0x69452d);
            } else if (id.startsWith("nature.river-")) {
              child.castShadow = false;
              if (materialName.includes("grass")) {
                // The Kenney river pieces are square terrain tiles. The world
                // already supplies the carved bed and colored banks, so the Kit
                // module contributes only its irregular rock clusters.
                material.transparent = true;
                material.opacity = 0;
                material.depthWrite = false;
              } else if (materialName.includes("water")) {
                // The continuous animated ribbon supplies the visible water. The
                // Kit tile still supplies its sculpted banks and rocks; hiding its
                // rectangular water plane avoids corner wedges in organic bends.
                material.color.setHex(0x2f9296);
                material.transparent = true;
                material.opacity = 0;
                material.depthWrite = false;
                material.roughness = 0.34;
              } else if (materialName.includes("dirtdark")) {
                material.transparent = true;
                material.opacity = 0;
                material.depthWrite = false;
              } else if (materialName.includes("dirt")) {
                material.transparent = true;
                material.opacity = 0;
                material.depthWrite = false;
              } else if (materialName.includes("stone")) {
                material.color.setHex(0x87918b);
              }
            } else if (id.startsWith("nature.rock")) {
              material.color.setHex(materialName.includes("grass") ? 0x617b45 : 0x777970);
            }
            material.needsUpdate = true;
          }
        }
      }
    });
  }

  private cloneModel(model: Group): Group {
    const cloned = cloneSkeleton(model) as Group;
    cloned.animations = model.animations;
    return cloned;
  }
}
