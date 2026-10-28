import type {
  Ingredient,
  Recipe,
  PantryItem,
  Meal,
} from "../../shared/src/index.ts";
const units: Record<
  string,
  { dimension: string; factor: number; base: string }
> = {
  g: { dimension: "mass", factor: 1, base: "g" },
  kg: { dimension: "mass", factor: 1000, base: "g" },
  oz: { dimension: "mass", factor: 28.349523125, base: "g" },
  lb: { dimension: "mass", factor: 453.59237, base: "g" },
  ml: { dimension: "volume", factor: 1, base: "ml" },
  l: { dimension: "volume", factor: 1000, base: "ml" },
  tsp: { dimension: "volume", factor: 4.92892159375, base: "ml" },
  tbsp: { dimension: "volume", factor: 14.78676478125, base: "ml" },
  cup: { dimension: "volume", factor: 236.5882365, base: "ml" },
  "fl oz": { dimension: "volume", factor: 29.5735295625, base: "ml" },
  gal: { dimension: "volume", factor: 3785.411784, base: "ml" },
  each: { dimension: "count", factor: 1, base: "each" },
};
const aliases: Record<string, string> = {
  "whole milk": "milk",
  potatoes: "potato",
  eggs: "egg",
  bananas: "banana",
  onions: "onion",
  carrots: "carrot",
  strawberries: "strawberry",
  "white rice": "rice",
  "rolled oats": "oats",
};
export const canonical = (name: string) => {
  const n = name.toLowerCase().trim().replace(/\s+/g, " ");
  return aliases[n] || n;
};
export function convert(q: number, from: string, to: string) {
  if (
    !units[from] ||
    !units[to] ||
    units[from].dimension !== units[to].dimension
  )
    throw new Error(`Cannot convert ${from} to ${to}`);
  return (q * units[from].factor) / units[to].factor;
}
export function base(q: number, unit: string) {
  const u = units[unit];
  if (!u) throw new Error("Unsupported unit: " + unit);
  return { quantity: q * u.factor, unit: u.base };
}
export function scaleIngredients(
  recipe: Pick<Recipe, "servings" | "ingredients">,
  servings: number,
): Ingredient[] {
  return recipe.ingredients.map((i) => ({
    ...i,
    quantity: (i.quantity * servings) / recipe.servings,
  }));
}
export type Need = {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  department: string;
  sources: string[];
  pantryUsed: number;
};
export function groceryNeeds(
  meals: Meal[],
  recipes: Recipe[],
  pantry: PantryItem[],
  date = new Date().toISOString().slice(0, 10),
): Need[] {
  const needs = new Map<string, Need>();
  for (const m of meals.filter(
    (m) => m.status !== "skipped" && !m.leftoverOf,
  )) {
    const r = recipes.find((r) => r.id === m.recipeId);
    if (!r) throw new Error("Recipe missing");
    for (const i of scaleIngredients(r, m.servings)) {
      const b = base(i.quantity, i.unit);
      const name = canonical(i.name);
      const key = name + "|" + b.unit;
      const n = needs.get(key) || {
        key,
        name,
        quantity: 0,
        unit: b.unit,
        department: i.department,
        sources: [],
        pantryUsed: 0,
      };
      n.quantity += b.quantity;
      n.sources.push(`${m.id}:${r.title}`);
      needs.set(key, n);
    }
  }
  for (const p of pantry.filter((p) => !p.expires || p.expires >= date)) {
    const b = base(p.quantity, p.unit);
    const n = needs.get(canonical(p.name) + "|" + b.unit);
    if (n) {
      const used = Math.min(n.quantity, b.quantity);
      n.quantity -= used;
      n.pantryUsed += used;
    }
  }
  return [...needs.values()]
    .map((n) => ({ ...n, quantity: Math.round(n.quantity * 1000) / 1000 }))
    .filter((n) => n.quantity > 0.001);
}
export const displayQuantity = (q: number, u: string) =>
  u === "g" && q >= 1000
    ? `${+(q / 1000).toFixed(2)} kg`
    : u === "ml" && q >= 1000
      ? `${+(q / 1000).toFixed(2)} L`
      : `${+q.toFixed(1)} ${u}`;
