/// <reference types="vite/client" />

import type { ItemId } from "./data/items";
import type { RecipeId } from "./data/recipes";

declare global {
  interface Window {
    __stranded2Debug?: {
      snapshot(): unknown;
      grant(items: Array<{ itemId: ItemId; count: number }>): void;
      teleport(x: number, y: number, z: number): void;
      lookAt(x: number, y: number, z: number): void;
      teleportToIsland(island: "start" | "jungle" | import("./data/worldManifest").IslandId): void;
      swingTool(): void;
      attack(): void;
      craft(recipeId: RecipeId): void;
      use(itemId: ItemId): boolean;
      build(buildId: import("./data/buildables").BuildableId, x: number, z: number): boolean;
      interactBuilding(id: string): boolean;
      climb(id: string): boolean;
      readLetter(id: import("./data/loreLetters").LoreLetterId): boolean;
      setCookingProgress(id: string, seconds: number): boolean;
      setFishTrapProgress(id: string, seconds: number): boolean;
      setSmokingProgress(id: string, seconds: number): boolean;
      setDayElapsedSeconds(seconds: number): void;
      setWeather(kind: import("./gameplay/model").WeatherKind | null): void;
      lightning(): import("./world/TropicalWorld").WorldEvent[];
      enterRaft(): boolean;
      moveRaft(x: number, z: number): void;
      exitRaft(): void;
      save(): Promise<void>;
      damage(amount: number): void;
      injure(amount: number): void;
      drinkBrackwater(): void;
      poison(): void;
      spoilFood(seconds: number): void;
    };
  }
}

export {};
