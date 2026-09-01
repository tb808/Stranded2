import type { ItemId } from "../../data/items";
import { DAY_LENGTH_SECONDS } from "./survival";

const FOOD_SPOILAGE_DAYS: Partial<Record<ItemId, number>> = {
  crab: 1,
  raw_meat: 1,
  raw_fish: 1,
  cooked_crab: 2,
  cooked_meat: 2,
  cooked_fish: 2,
  mango: 2,
  smoked_meat: 5,
};

export function getFoodSpoilageDuration(itemId: ItemId): number | undefined {
  const days = FOOD_SPOILAGE_DAYS[itemId];
  return days === undefined ? undefined : days * DAY_LENGTH_SECONDS;
}

export function formatFoodFreshness(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "verdorben";
  const days = secondsRemaining / DAY_LENGTH_SECONDS;
  if (days >= 1) return `noch ${Math.ceil(days)} ${Math.ceil(days) === 1 ? "Tag" : "Tage"} haltbar`;
  return `noch ${Math.max(1, Math.ceil(secondsRemaining / 60))} Min. haltbar`;
}
