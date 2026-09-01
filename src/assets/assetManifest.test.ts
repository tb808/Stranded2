/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ManifestAsset {
  id: string;
  path: string;
}

interface AssetManifest {
  basePath: string;
  packages: Array<{ assets: ManifestAsset[] }>;
}

describe("Kenney Nature- und Survival-Kit-Modelle", () => {
  it("führt die Bau-, Tier- und neuen Landschaftsmodelle im Manifest und liefert alle GLB-Dateien aus", () => {
    const manifestPath = fileURLToPath(new URL("../../public/assets/asset-manifest.json", import.meta.url));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AssetManifest;
    const assets = new Map(
      manifest.packages.flatMap((pack) => pack.assets).map((asset) => [asset.id, asset.path]),
    );

    for (const id of [
      "nature.bush-detailed",
      "nature.bush-large",
      "nature.grass",
      "nature.grass-leafs",
      "nature.grass-leafs-large",
      "nature.lily-large",
      "nature.plant-flat-short",
      "nature.river-straight",
      "nature.river-rocks",
      "nature.rock-tall-c",
      "nature.tree-default",
      "nature.statue-obelisk",
      "survival.bedroll-frame",
      "survival.bedroll",
      "survival.chest",
      "survival.fish",
      "survival.barrel",
      "survival.campfire-fishing-stand",
      "survival.tent",
      "survival.workbench-anvil",
      "animal.wild-boar",
      "animal.chicken",
      "animal.turtle",
      "animal.bird",
      "animal.crocodile",
      "environment.volcano",
      "food.meat-raw",
      "food.meat-cooked",
    ]) {
      const relativePath = assets.get(id);
      expect(relativePath, id).toBeDefined();
      const assetPath = fileURLToPath(
        new URL(`../../public/assets/${manifest.basePath.replace(/^\.\//, "")}/${relativePath}`, import.meta.url),
      );
      expect(existsSync(assetPath), assetPath).toBe(true);
    }
  });
});
