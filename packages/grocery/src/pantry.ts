import type { PantryItem, Recipe, Staple } from "../../shared/src/index.ts";
import { today } from "../../shared/src/index.ts";
import { base, canonical, scaleIngredients, type Need } from "./index.ts";
export function daysUntil(date: string, from = today()) {
  return Math.round(
    (Date.parse(date + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
      86400000,
  );
}
export function useSoon(pantry: PantryItem[], date = today(), days = 3) {
  return pantry
    .filter(
      (p) =>
        p.quantity > 0 &&
        p.expires &&
        p.expires >= date &&
        daysUntil(p.expires, date) <= days,
    )
    .sort(
      (a, b) =>
        a.expires.localeCompare(b.expires) || a.name.localeCompare(b.name),
    );
}
export function usableStock(pantry: PantryItem[], date = today()) {
  const stock = new Map<string, number>();
  for (const p of pantry) {
    if (p.quantity <= 0 || (p.expires && p.expires < date)) continue;
    const b = base(p.quantity, p.unit),
      key = canonical(p.name) + "|" + b.unit;
    stock.set(key, (stock.get(key) || 0) + b.quantity);
  }
  return stock;
}
/** Assess each recipe independently; do not reserve the same stock for multiple meals. */
export function recipeCoverage(
  recipe: Recipe,
  pantry: PantryItem[],
  servings: number,
  date = today(),
) {
  const stock = usableStock(pantry, date),
    requirements = new Map<
      string,
      { name: string; unit: string; quantity: number }
    >();
  for (const i of scaleIngredients(recipe, servings)) {
    const b = base(i.quantity, i.unit),
      key = canonical(i.name) + "|" + b.unit;
    const current = requirements.get(key);
    requirements.set(key, {
      name: canonical(i.name),
      unit: b.unit,
      quantity: b.quantity + (current?.quantity || 0),
    });
  }
  const ingredients = [...requirements].map(([key, i]) => ({
    ...i,
    available: Math.min(i.quantity, stock.get(key) || 0),
    missing: Math.max(
      0,
      Math.round((i.quantity - (stock.get(key) || 0)) * 1000) / 1000,
    ),
  }));
  const urgent = new Set(
    useSoon(pantry, date).map((p) => {
      const b = base(p.quantity, p.unit);
      return canonical(p.name) + "|" + b.unit;
    }),
  );
  return {
    recipe,
    ingredients,
    covered: ingredients.filter((i) => i.missing <= 0.001).length,
    total: ingredients.length,
    matched: ingredients.filter((i) => i.available > 0).length,
    coverage:
      ingredients.reduce((s, i) => s + i.available / i.quantity, 0) /
      Math.max(1, ingredients.length),
    soonIngredients: ingredients
      .filter((i) => i.available > 0 && urgent.has(i.name + "|" + i.unit))
      .map((i) => i.name),
  };
}
export function pantrySuggestions(
  recipes: Recipe[],
  pantry: PantryItem[],
  servings: number,
  date = today(),
) {
  return recipes
    .filter((r) => !r.rejected)
    .map((r) => recipeCoverage(r, pantry, servings, date))
    .filter((r) => r.matched > 0)
    .sort(
      (a, b) =>
        b.soonIngredients.length - a.soonIngredients.length ||
        b.coverage - a.coverage ||
        a.recipe.minutes - b.recipe.minutes,
    );
}
/** Regular items are minimum weekly amounts, not extra recipe quantities. */
export function includeStaples(
  needs: Need[],
  staples: Staple[],
  pantry: PantryItem[],
  date = today(),
): Need[] {
  const all = new Map(
    needs.map((n) => [n.key, { ...n, sources: [...n.sources] }]),
  );
  const stock = usableStock(pantry, date);
  for (const s of staples.filter((s) => s.enabled)) {
    const b = base(s.quantity, s.unit),
      name = canonical(s.name),
      key = name + "|" + b.unit;
    const used = Math.min(b.quantity, stock.get(key) || 0),
      quantity = Math.round(Math.max(0, b.quantity - used) * 1000) / 1000;
    if (quantity <= 0.001) continue;
    const old = all.get(key);
    if (old) {
      old.quantity = Math.max(old.quantity, quantity);
      old.sources.push(`Regular item: ${s.name}`);
    } else
      all.set(key, {
        key,
        name,
        quantity,
        unit: b.unit,
        department: s.department,
        sources: [`Regular item: ${s.name}`],
        pantryUsed: used,
      });
  }
  return [...all.values()];
}
