import { z } from "zod";
import { randomUUID } from "node:crypto";
import { HearthDB, AppError } from "../../../packages/database/src/index.ts";
import {
  RecipeSchema,
  ExpenseInput,
  MealInput,
  weekStart,
  type Recipe,
} from "../../../packages/shared/src/index.ts";
import { scaleIngredients } from "../../../packages/grocery/src/index.ts";
import { compareBasket } from "../../../packages/deals/src/index.ts";
import { finances } from "../../../packages/finance/src/index.ts";
const id = z.string().min(1);
const version = z.number().int().positive();
export const toolSchemas = {
  searchRecipes: z.object({
    query: z.string().default(""),
    limit: z.number().int().min(1).max(60).default(12),
  }),
  generateRecipeSuggestions: z.object({
    query: z.string().default(""),
    count: z.number().int().min(1).max(20).default(6),
  }),
  createRecipe: RecipeSchema,
  editRecipe: z.object({ id, version, recipe: RecipeSchema }),
  saveRecipe: z.object({ id }),
  favoriteRecipe: z.object({ id, favorite: z.boolean() }),
  replacePlannedMeal: z.object({ week: id, version, mealId: id, recipeId: id }),
  updateMealPlan: z.object({ week: id, version, meal: MealInput }),
  approveMealPlan: z.object({ week: id, version }),
  scaleRecipe: z.object({ id, servings: z.number().int().min(1).max(30) }),
  generateGroceryList: z.object({ week: id }),
  updateGroceryItem: z.object({
    id,
    version,
    purchased: z.boolean().optional(),
    store: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
  }),
  checkPantry: z.object({ query: z.string().default("") }),
  searchStoreOffers: z.object({ query: z.string().default("") }),
  optimizeShoppingTrip: z.object({ week: id }),
  addExpense: ExpenseInput,
  logTakeout: ExpenseInput.extend({ category: z.literal("Takeout") }),
  calculateSavings: z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  }),
  updateHouseholdGoal: z.object({
    id: id.optional(),
    title: z.string().min(3).max(200),
    kind: z.enum(["cooked", "budget", "custom"]),
    target: z.number().positive(),
    progress: z.number().nonnegative().default(0),
  }),
  createReward: z.object({ title: z.string().min(3).max(200), goalId: id }),
  summarizeWeeklyProgress: z.object({ week: id }),
};
export type ToolName = keyof typeof toolSchemas;
export const Operation = z
  .object({
    name: z.enum(Object.keys(toolSchemas) as [ToolName, ...ToolName[]]),
    args: z.record(z.string(), z.unknown()),
  })
  .superRefine((o, ctx) => {
    const r = toolSchemas[o.name].safeParse(o.args);
    if (!r.success) ctx.addIssue({ code: "custom", message: r.error.message });
  });
export const AssistantOutput = z.object({
  reply: z.string().max(12000),
  operations: z.array(Operation).max(8).default([]),
});
export const readTools = new Set([
  "searchRecipes",
  "generateRecipeSuggestions",
  "scaleRecipe",
  "checkPantry",
  "searchStoreOffers",
  "optimizeShoppingTrip",
  "calculateSavings",
  "summarizeWeeklyProgress",
]);
export function search(db: HearthDB, query: string, count = 12) {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  return db
    .recipes()
    .filter((r) => !r.rejected)
    .map((r) => ({
      r,
      score:
        terms.reduce(
          (n, t) =>
            n +
            (JSON.stringify([r.title, r.tags, r.ingredients])
              .toLowerCase()
              .includes(t)
              ? 1
              : 0),
          0,
        ) + (r.favorite ? 0.25 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.r);
}
export function executeTool(
  db: HearthDB,
  name: ToolName,
  args: unknown,
  memberId: string,
  confirmed = false,
) {
  const a: any = toolSchemas[name].parse(args);
  if (!readTools.has(name) && !confirmed)
    throw new AppError(409, "Review and confirm this assistant operation.", {
      confirmationRequired: true,
    });
  switch (name) {
    case "searchRecipes":
      return search(db, a.query, a.limit);
    case "generateRecipeSuggestions":
      return search(db, a.query, Math.min(60, a.count * 2));
    case "createRecipe":
      return db.saveRecipe({
        ...a,
        id: randomUUID(),
        favorite: false,
        rejected: false,
        rating: 0,
        version: 1,
      });
    case "editRecipe": {
      const r = db.recipe(a.id);
      if (r.version !== a.version)
        throw new AppError(409, "Recipe changed; review before editing.");
      return db.saveRecipe({ ...r, ...a.recipe });
    }
    case "saveRecipe":
    case "favoriteRecipe":
      return db.saveRecipe({
        ...db.recipe(a.id),
        favorite: name === "saveRecipe" ? true : a.favorite,
      });
    case "replacePlannedMeal":
      return db.changePlan(a.week, a.version, confirmed, (p) => {
        const m = p.meals.find((m) => m.id === a.mealId);
        if (!m) throw new AppError(404, "Meal not found");
        if (m.leftoverOf)
          throw new AppError(
            400,
            "Replace the original meal or unlink this leftover first.",
          );
        db.recipe(a.recipeId);
        db.run(
          "UPDATE planned_meal SET recipe_id=? WHERE id=?",
          a.recipeId,
          m.id,
        );
        db.run(
          "UPDATE planned_meal SET recipe_id=? WHERE leftover_of=?",
          a.recipeId,
          m.id,
        );
      });
    case "updateMealPlan":
      return db.changePlan(a.week, a.version, confirmed, (p) => {
        db.recipe(a.meal.recipeId);
        if (a.meal.leftoverOf) {
          const source = p.meals.find((m) => m.id === a.meal.leftoverOf);
          if (
            !source ||
            source.leftoverOf ||
            source.recipeId !== a.meal.recipeId
          )
            throw new AppError(
              400,
              "Leftovers must reference an original meal of the same recipe.",
            );
          const used = p.meals
            .filter((m) => m.leftoverOf === source.id)
            .reduce((s, m) => s + m.servings, 0);
          if (used + a.meal.servings >= source.servings)
            throw new AppError(
              400,
              "Increase the original cooking batch to cover the reserved leftover portions.",
            );
        }
        db.run(
          "INSERT INTO planned_meal(id,plan_id,recipe_id,day,meal_type,servings,leftover_of) VALUES(?,?,?,?,?,?,?)",
          randomUUID(),
          p.id,
          a.meal.recipeId,
          a.meal.day,
          a.meal.type,
          a.meal.servings,
          a.meal.leftoverOf || null,
        );
      });
    case "approveMealPlan":
      return db.changePlan(a.week, a.version, true, (p) => {
        if (!p.meals.length)
          throw new AppError(400, "Add meals before approval.");
        db.run("UPDATE meal_plan SET approved=1 WHERE id=?", p.id);
        db.generateGroceries(a.week);
      });
    case "scaleRecipe": {
      const r = db.recipe(a.id);
      return {
        ...r,
        servings: a.servings,
        ingredients: scaleIngredients(r, a.servings),
      };
    }
    case "generateGroceryList":
      return db.generateGroceries(a.week);
    case "updateGroceryItem": {
      const { id, version, ...patch } = a;
      return db.patchGrocery(id, version, patch);
    }
    case "checkPantry":
      return db
        .pantry()
        .filter((p) => p.name.toLowerCase().includes(a.query.toLowerCase()));
    case "searchStoreOffers":
      return db
        .offers()
        .filter(
          (o) =>
            o.expires >= new Date().toISOString().slice(0, 10) &&
            JSON.stringify(o).toLowerCase().includes(a.query.toLowerCase()),
        );
    case "optimizeShoppingTrip":
      return compareBasket(db.groceries(a.week), db.offers(), db.settings());
    case "addExpense":
    case "logTakeout":
      return db.addExpense({
        ...a,
        id: randomUUID(),
        memberId,
        createdAt: new Date().toISOString(),
      });
    case "calculateSavings":
      return finances(
        db.expenses(),
        db.settings(),
        db.ensurePlan(weekStart()),
        db.recipes(),
        a.month,
      );
    case "updateHouseholdGoal": {
      const goal = { ...a, id: a.id || randomUUID() };
      db.run(
        "INSERT INTO goal VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        goal.id,
        JSON.stringify(goal),
      );
      return goal;
    }
    case "createReward": {
      if (!db.one("SELECT id FROM goal WHERE id=?", a.goalId))
        throw new AppError(404, "Goal not found");
      const r = { ...a, id: randomUUID(), claimed: false };
      db.run("INSERT INTO reward VALUES(?,?)", r.id, JSON.stringify(r));
      return r;
    }
    case "summarizeWeeklyProgress":
      return {
        plan: db.ensurePlan(a.week),
        finance: finances(
          db.expenses(),
          db.settings(),
          db.plan(a.week),
          db.recipes(),
        ),
      };
  }
}
