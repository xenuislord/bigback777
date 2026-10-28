import { describe, it, expect } from "vitest";
import {
  groceryNeeds,
  convert,
  scaleIngredients,
  canonical,
} from "../packages/grocery/src/index.ts";
import { starterRecipes } from "../packages/recipes/src/seed.ts";
import {
  RecipeSchema,
  OfferInput,
  SettingsSchema,
  type Recipe,
  type Meal,
  type PantryItem,
  type Offer,
} from "../packages/shared/src/index.ts";
import { quote, compareBasket } from "../packages/deals/src/index.ts";
import { totalExpense, finances } from "../packages/finance/src/index.ts";
import { toolSchemas, AssistantOutput } from "../apps/server/src/tools.ts";
import { consumeResponses } from "../packages/ai/src/providers.ts";
const recipe = (id: string, q: number, unit = "lb", name = "ground beef") =>
  ({
    ...starterRecipes[0],
    id,
    servings: 3,
    ingredients: [{ name, quantity: q, unit, department: "Meat & seafood" }],
  }) as Recipe;
const meal = (id: string, recipeId: string, extra: Partial<Meal> = {}) =>
  ({
    id,
    recipeId,
    day: 0,
    type: "Dinner",
    servings: 3,
    status: "planned",
    locked: false,
    leftoverOf: null,
    ...extra,
  }) as Meal;
const offer = (extra: Partial<Offer> = {}) =>
  ({
    ...OfferInput.parse({
      ingredient: "ground beef",
      store: "Store",
      product: "Ground beef",
      quantity: 1,
      unit: "lb",
      priceCents: 500,
      expires: "2099-01-01",
    }),
    id: "o",
    source: "manual",
    retrievedAt: new Date().toISOString(),
    verification: "User-entered",
    ...extra,
  }) as Offer;
describe("original recipe collection", () => {
  it("contains 60 complete unique validated recipes and at least 12 dinners", () => {
    expect(starterRecipes).toHaveLength(60);
    expect(new Set(starterRecipes.map((r) => r.title)).size).toBe(60);
    for (const r of starterRecipes) {
      expect(RecipeSchema.safeParse(r).success).toBe(true);
      expect(r.steps.length).toBeGreaterThanOrEqual(3);
      expect(r.ingredients.length).toBeGreaterThanOrEqual(2);
    }
    expect(
      starterRecipes.filter((r) => r.category === "Dinner").length,
    ).toBeGreaterThanOrEqual(12);
  });
});
describe("grocery calculations", () => {
  it("merges 1 lb + 2 lb + 8 oz into 3.5 lb", () => {
    const rs = [recipe("a", 1), recipe("b", 2), recipe("c", 8, "oz")];
    const list = groceryNeeds(
      rs.map((r) => meal(r.id, r.id)),
      rs,
      [],
    );
    expect(list).toHaveLength(1);
    expect(convert(list[0].quantity, "g", "lb")).toBeCloseTo(3.5, 5);
    expect(list[0].sources).toHaveLength(3);
  });
  it("keeps ground beef and chuck separate and does not mix dimensions", () => {
    const rs = [
      recipe("a", 1),
      recipe("b", 1, "lb", "beef chuck"),
      recipe("c", 1, "cup"),
    ];
    expect(
      groceryNeeds(
        rs.map((r) => meal(r.id, r.id)),
        rs,
        [],
      ),
    ).toHaveLength(3);
    expect(() => convert(1, "cup", "g")).toThrow();
  });
  it("scales by portions and deducts only unexpired compatible recorded inventory", () => {
    const r = recipe("a", 1);
    const p = (unit: string, expires: string, q = 1) =>
      ({
        id: unit + expires,
        name: "ground beef",
        quantity: q,
        unit,
        location: "Freezer",
        expires,
        version: 1,
      }) as PantryItem;
    const result = groceryNeeds(
      [meal("m", "a", { servings: 6 })],
      [r],
      [p("lb", "2099-01-01"), p("lb", "2000-01-01"), p("cup", "2099-01-01")],
    );
    expect(convert(result[0].quantity, "g", "lb")).toBeCloseTo(1, 5);
    expect(scaleIngredients(r, 6)[0].quantity).toBe(2);
  });
  it("does not buy ingredients twice for leftovers and excludes skipped meals", () => {
    const r = recipe("a", 1);
    expect(
      groceryNeeds(
        [
          meal("m", "a"),
          meal("l", "a", { leftoverOf: "m" }),
          meal("s", "a", { status: "skipped" }),
        ],
        [r],
        [],
      )[0].quantity,
    ).toBeCloseTo(453.592, 3);
  });
  it("normalizes documented aliases without conflating meat cuts", () => {
    expect(canonical("  Whole Milk ")).toBe("milk");
    expect(canonical("beef chuck")).not.toBe(canonical("ground beef"));
  });
});
describe("real price observations", () => {
  it("normalizes compatible prices, rounds to package sizes and calculates purchase costs", () => {
    const q = quote(
      { name: "ground beef", quantity: 1.5, unit: "lb" },
      offer(),
      [],
    );
    expect(q?.packages).toBe(2);
    expect(q?.costCents).toBe(1000);
    expect(q?.baseUnit).toBe("g");
  });
  it("excludes expired, ineligible loyalty, quality substitutions and incompatible units", () => {
    const item = { name: "ground beef", quantity: 1, unit: "lb" };
    expect(quote(item, offer({ expires: "2000-01-01" }), [])).toBeNull();
    expect(quote(item, offer({ loyalty: true }), [])).toBeNull();
    expect(quote(item, offer({ quality: "organic" }), [])).toBeNull();
    expect(quote(item, offer({ unit: "cup" }), [])).toBeNull();
    expect(quote(item, offer({ loyalty: true }), ["Store"])).not.toBeNull();
  });
  it("enforces coupon eligibility, minimum purchase and membership", () => {
    const item = { name: "ground beef", quantity: 1, unit: "lb" };
    expect(quote(item, offer({ membership: "Club" }), [])).toBeNull();
    const q = quote(item, offer({ minPackages: 3, couponCents: 100 }), []);
    expect(q?.costCents).toBe(1200);
    expect(
      OfferInput.safeParse({ ...offer(), couponCents: 1000 }).success,
    ).toBe(false);
  });
  it("keeps missing prices explicit in basket comparisons", () => {
    const result = compareBasket(
      [
        {
          id: "i",
          name: "milk",
          unit: "gal",
          quantity: 1,
          purchased: false,
        } as any,
      ],
      [offer()],
      SettingsSchema.parse({}),
    );
    expect(result.unpriced).toEqual(["milk"]);
    expect(result.baskets[0].missing).toBe(1);
  });
});
describe("exact accounting and tool validation", () => {
  it("uses integer cents, counts each expense once, and separates hypothetical avoidance", () => {
    const e = {
      id: "e",
      category: "Grocery",
      merchant: "Store",
      date: "2026-01-01",
      amountCents: 1001,
      feesCents: 99,
      tipCents: 0,
      taxCents: 100,
      discountCents: 50,
    } as any;
    expect(totalExpense(e)).toBe(1150);
    const f = finances(
      [e],
      SettingsSchema.parse({ monthlyBudgetCents: 10000 }),
      {
        id: "p",
        week: "2026-01-01",
        approved: true,
        version: 1,
        meals: [meal("m", starterRecipes[0].id, { status: "cooked" })],
      },
      starterRecipes,
      "2026-01",
    );
    expect(f.totalCents).toBe(1150);
    expect(f.remainingCents).toBe(8850);
    expect(f.estimatedAvoidanceCents).not.toBe(f.remainingCents);
  });
  it("rejects fabricated tools, negative money, and invalid AI operations", () => {
    expect(
      AssistantOutput.safeParse({
        reply: "x",
        operations: [{ name: "deleteEverything", args: {} }],
      }).success,
    ).toBe(false);
    expect(toolSchemas.addExpense.safeParse({ amountCents: -1 }).success).toBe(
      false,
    );
    expect(
      AssistantOutput.safeParse({
        reply: "x",
        operations: [{ name: "updateMealPlan", args: {} }],
      }).success,
    ).toBe(false);
  });
});
describe("AI provider completion handling", () => {
  const stream = (s: string) =>
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(s));
        c.close();
      },
    });
  it("requires response.completed and rejects interrupted streams", async () => {
    await expect(
      consumeResponses(
        stream(
          'data: {"type":"response.output_text.delta","delta":"hello"}\n\n',
        ),
      ),
    ).rejects.toThrow("interrupted");
    expect(
      await consumeResponses(
        stream(
          'data: {"type":"response.output_text.delta","delta":"hello"}\n\ndata: {"type":"response.completed"}\n\n',
        ),
      ),
    ).toBe("hello");
  });
  it("rejects failed provider events", async () => {
    await expect(
      consumeResponses(stream('data: {"type":"response.failed"}\n\n')),
    ).rejects.toThrow("did not complete");
  });
});

describe("leftover cost allocation", () => {
  it("allocates a six-serving batch between the cooked dinner and its later leftovers", () => {
    const r = { ...starterRecipes[0], costCents: 900, servings: 3 };
    const source = meal("d", r.id, { servings: 6, status: "cooked" });
    const leftover = meal("l", r.id, { servings: 3, leftoverOf: "d" });
    const p = {
      id: "p",
      week: "2026-01-05",
      approved: true,
      version: 1,
      meals: [source, leftover],
    };
    const s = SettingsSchema.parse({ takeoutBaselineCents: 1000 });
    let f = finances([], s, p, [r]);
    expect(f.estimatedHomeCostCents).toBe(900);
    expect(f.estimatedAvoidanceCents).toBe(2100);
    leftover.status = "cooked";
    f = finances([], s, p, [r]);
    expect(f.estimatedHomeCostCents).toBe(1800);
    expect(f.estimatedAvoidanceCents).toBe(4200);
  });
});
