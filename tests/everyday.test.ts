import { describe, it, expect } from "vitest";
import {
  recipeCoverage,
  pantrySuggestions,
  useSoon,
  includeStaples,
} from "../packages/grocery/src/pantry.ts";
import { groceryNeeds } from "../packages/grocery/src/index.ts";
import { starterRecipes, costEstimate } from "../packages/recipes/src/seed.ts";
import type {
  Recipe,
  PantryItem,
  Staple,
  Meal,
} from "../packages/shared/src/index.ts";
import {
  timerSeconds,
  clockLabel,
  type KitchenTimer,
} from "../apps/web/src/KitchenTimers.tsx";
const recipe = (ingredients: Recipe["ingredients"]) => ({
  ...starterRecipes[0],
  id: "test-recipe",
  servings: 3,
  ingredients,
});
const item = (
  name: string,
  quantity: number,
  unit = "g",
  expires = "",
): PantryItem => ({
  id: name + unit + expires,
  name,
  quantity,
  unit: unit as any,
  expires,
  location: "Pantry",
  version: 1,
  purchaseDate: "",
  unitCostCents: 0,
  packageSize: 1,
});
const staple = (name: string, quantity: number, unit = "g"): Staple => ({
  id: name,
  name,
  quantity,
  unit: unit as any,
  department: "Pantry",
  enabled: true,
  version: 1,
});
describe("quantity-aware use-at-home suggestions", () => {
  it("excludes expired, zero and distant dates from use-soon reminders", () => {
    const stock = [
      item("milk", 1, "l", "2026-01-02"),
      item("egg", 3, "each", "2026-01-05"),
      item("beef", 500, "g", "2026-01-01"),
      item("rice", 1000, "g", "2026-01-10"),
      item("banana", 0, "g", "2026-01-02"),
    ];
    expect(useSoon(stock, "2026-01-02").map((i) => i.name)).toEqual([
      "milk",
      "egg",
    ]);
  });
  it("merges duplicate requirements, handles aliases and converts compatible inventory units", () => {
    const r = recipe([
      { name: "milk", quantity: 200, unit: "ml", department: "Dairy" },
      { name: "whole milk", quantity: 300, unit: "ml", department: "Dairy" },
      { name: "ground beef", quantity: 1, unit: "lb", department: "Meat" },
    ]);
    const result = recipeCoverage(
      r,
      [item("milk", 0.5, "l"), item("ground beef", 1, "lb")],
      3,
      "2026-01-02",
    );
    expect(result.total).toBe(2);
    expect(result.covered).toBe(2);
    expect(result.ingredients[0].quantity).toBe(500);
  });
  it("does not equate a partial quantity or incompatible unit with a covered ingredient", () => {
    const r = recipe([
      { name: "rice", quantity: 200, unit: "g", department: "Pantry" },
      { name: "milk", quantity: 500, unit: "ml", department: "Dairy" },
    ]);
    const result = recipeCoverage(
      r,
      [
        item("rice", 100, "g"),
        item("rice", 5, "cup"),
        item("milk", 500, "ml", "2020-01-01"),
      ],
      3,
      "2026-01-02",
    );
    expect(result.covered).toBe(0);
    expect(result.ingredients.map((i) => i.missing)).toEqual([100, 500]);
    expect(result.matched).toBe(1);
  });
  it("scales servings and prioritizes real ingredients due soon without including rejected recipes", () => {
    const rice = recipe([
        { name: "rice", quantity: 100, unit: "g", department: "Pantry" },
      ]),
      milk = {
        ...recipe([
          { name: "milk", quantity: 100, unit: "ml", department: "Dairy" },
        ]),
        id: "milk",
      };
    const rejected = { ...milk, id: "rejected", rejected: true };
    const suggestions = pantrySuggestions(
      [rice, milk, rejected],
      [item("rice", 1000), item("milk", 100, "ml", "2026-01-03")],
      6,
      "2026-01-02",
    );
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].recipe.id).toBe("milk");
    expect(suggestions[0].ingredients[0].missing).toBe(100);
    expect(suggestions[0].soonIngredients).toEqual(["milk"]);
  });
});
describe("weekly regular shopping needs", () => {
  const meal: Meal = {
    id: "m",
    recipeId: "test-recipe",
    day: 0,
    type: "Dinner",
    servings: 3,
    status: "planned",
    locked: false,
    leftoverOf: null,
  };
  it("uses the greater of recipe and regular needs, with stock deducted only once", () => {
    const r = recipe([
        { name: "milk", quantity: 1000, unit: "ml", department: "Dairy" },
      ]),
      stock = [item("milk", 0.25, "l")];
    const needs = includeStaples(
      groceryNeeds([meal], [r], stock),
      [staple("whole milk", 1.5, "l")],
      stock,
    );
    expect(needs).toHaveLength(1);
    expect(needs[0].quantity).toBe(1250);
    expect(needs[0].sources).toHaveLength(2);
  });
  it("does not add stocked or disabled regular items, nor combine incompatible dimensions", () => {
    const needs = includeStaples(
      [],
      [
        staple("milk", 1, "l"),
        { ...staple("egg", 6, "each"), enabled: false },
        staple("rice", 100, "g"),
        staple("rice", 1, "cup"),
      ],
      [item("milk", 2, "l")],
    );
    expect(needs).toHaveLength(2);
    expect(needs.map((n) => n.key)).toEqual(["rice|g", "rice|ml"]);
  });
});
describe("kitchen timer arithmetic", () => {
  const timer: KitchenTimer = {
    id: "t",
    label: "Rice",
    endAt: 10000,
    remainingMs: 10000,
    sound: false,
  };
  it("uses an absolute deadline across reloads and stops at zero", () => {
    expect(timerSeconds(timer, 8001)).toBe(2);
    expect(timerSeconds(timer, 15000)).toBe(0);
    expect(
      timerSeconds({ ...timer, endAt: null, remainingMs: 3200 }, 999999),
    ).toBe(4);
  });
  it("formats short and long cooking timers without losing seconds", () => {
    expect(clockLabel(65)).toBe("1:05");
    expect(clockLabel(3601)).toBe("1:00:01");
    expect(clockLabel(0)).toBe("0:00");
  });
});

describe("honest ingredient estimates", () => {
  it("leaves unknown products and incompatible price units unavailable", () => {
    expect(costEstimate("dish soap", 2, "each")).toBe(0);
    expect(costEstimate("milk", 500, "g")).toBe(0);
    expect(costEstimate("milk", 500, "ml")).toBe(60);
  });
});
