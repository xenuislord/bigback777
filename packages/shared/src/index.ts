import { z } from "zod";
export const IngredientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100000),
  unit: z.enum([
    "g",
    "kg",
    "oz",
    "lb",
    "ml",
    "l",
    "tsp",
    "tbsp",
    "cup",
    "fl oz",
    "gal",
    "each",
  ]),
  department: z.string().default("Pantry"),
});
export type Ingredient = z.infer<typeof IngredientSchema>;
export const RecipeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().max(1000),
  category: z.enum([
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snack",
    "Dessert",
    "Drink",
  ]),
  servings: z.number().int().min(1).max(30),
  minutes: z.number().int().min(1).max(720),
  ingredients: z.array(IngredientSchema).min(1).max(60),
  steps: z.array(z.string().min(8).max(2000)).min(1).max(40),
  tags: z.array(z.string().max(50)).max(20),
  allergens: z.array(z.string().max(50)).default([]),
  equipment: z.array(z.string().max(100)).default([]),
  storage: z
    .string()
    .max(500)
    .default("Refrigerate leftovers promptly and use within 3–4 days."),
  notes: z.string().max(3000).default(""),
  photo: z.string().max(1500000).default(""),
  costCents: z.number().int().nonnegative().default(0),
  calories: z.number().nonnegative().default(0),
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fat: z.number().nonnegative().default(0),
  fiber: z.number().nonnegative().default(0),
  compatibility: z.number().min(0).max(100).default(75),
});
export type Recipe = z.infer<typeof RecipeSchema> & {
  id: string;
  favorite: boolean;
  rejected: boolean;
  rating: number;
  version: number;
};
export const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
export const MealInput = z.object({
  recipeId: z.string(),
  day: z.number().int().min(0).max(6),
  type: z.enum(mealTypes),
  servings: z.number().int().min(1).max(30),
  leftoverOf: z.string().nullable().optional(),
});
export type Meal = {
  id: string;
  recipeId: string;
  day: number;
  type: (typeof mealTypes)[number];
  servings: number;
  status: "planned" | "cooked" | "skipped";
  locked: boolean;
  leftoverOf: string | null;
};
export type Plan = {
  id: string;
  week: string;
  approved: boolean;
  version: number;
  meals: Meal[];
};
export const PantryInput = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().nonnegative().max(100000),
  unit: IngredientSchema.shape.unit,
  location: z.enum(["Refrigerator", "Freezer", "Pantry", "Household staples"]),
  expires: z.iso.date().or(z.literal("")).default(""),
  purchaseDate: z.string().default(""),
  unitCostCents: z.number().int().nonnegative().default(0),
  packageSize: z.number().positive().default(1),
});
export type PantryItem = z.infer<typeof PantryInput> & {
  id: string;
  version: number;
};
export type GroceryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  department: string;
  purchased: boolean;
  recorded?: boolean;
  actualCents: number | null;
  estimateCents: number;
  store: string;
  note: string;
  memberId: string;
  sources: string[];
  version: number;
  manual: boolean;
};
export const ExpenseInput = z.object({
  category: z.enum(["Grocery", "Takeout", "Restaurant", "Membership", "Waste"]),
  merchant: z.string().trim().min(1).max(100),
  amountCents: z.number().int().min(0).max(100000000),
  feesCents: z.number().int().nonnegative().default(0),
  tipCents: z.number().int().nonnegative().default(0),
  taxCents: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  portions: z.number().int().min(1).max(100).default(3),
  note: z.string().max(2000).default(""),
});
export type Expense = z.infer<typeof ExpenseInput> & {
  id: string;
  memberId: string;
  createdAt: string;
};
export const OfferInput = z
  .object({
    ingredient: z.string().trim().min(1).max(100),
    store: z.string().trim().min(1).max(100),
    product: z.string().trim().min(1).max(200),
    quantity: z.number().positive(),
    unit: IngredientSchema.shape.unit,
    priceCents: z.number().int().positive(),
    regularCents: z.number().int().nonnegative().nullable().default(null),
    couponCents: z.number().int().nonnegative().default(0),
    minPackages: z.number().int().min(1).max(100).default(1),
    loyalty: z.boolean().default(false),
    membership: z.string().default(""),
    quality: z.string().default("standard"),
    expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceUrl: z
      .string()
      .max(1000)
      .refine((v) => !v || /^https:\/\//.test(v), "Use an HTTPS source URL")
      .default(""),
    note: z.string().max(2000).default(""),
  })
  .refine(
    (o) => o.couponCents <= o.priceCents,
    "Coupon cannot exceed package price",
  );
export type Offer = z.infer<typeof OfferInput> & {
  id: string;
  source: "manual" | "kroger";
  retrievedAt: string;
  verification: string;
};
export const SettingsSchema = z.object({
  householdName: z.string().min(1).max(80).default("Our household"),
  adults: z.number().int().min(1).max(12).default(3),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .default("91203"),
  city: z.string().max(80).default("Glendale, CA"),
  radius: z.number().min(1).max(100).default(10),
  monthlyBudgetCents: z.number().int().positive().default(90000),
  takeoutBaselineCents: z.number().int().nonnegative().default(1800),
  tone: z.enum(["Off", "Gentle", "Firm", "Savage"]).default("Gentle"),
  preferredStores: z.array(z.string()).default([]),
  memberships: z.array(z.string()).default([]),
  publicUrl: z
    .string()
    .max(300)
    .refine(
      (v) => !v || /^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(v),
      "Enter an HTTPS origin without a path",
    )
    .default(""),
  dietNotes: z
    .string()
    .max(2000)
    .default(
      "Dairy, beef, fruit, potatoes and rice; no raw dairy. Nutrition estimates are not medical advice.",
    ),
  provider: z.enum(["none", "ollama", "openai", "chatgpt"]).default("none"),
  model: z.string().max(100).default(""),
  routineProvider: z
    .enum(["none", "ollama", "openai", "chatgpt"])
    .default("none"),
  routineModel: z.string().max(100).default(""),
  apiEnabled: z.boolean().default(false),
  krogerLocationId: z.string().max(50).default(""),
  maxStores: z.number().int().min(1).max(3).default(2),
  costPerMileCents: z.number().int().min(0).max(1000).default(67),
  extraMiles: z.number().min(0).max(200).default(0),
  theme: z.enum(["light", "dark", "system"]).default("light"),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    c / 100,
  );
export function weekStart(date = new Date()) {
  const d = new Date(date.toISOString().slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const today = () => new Date().toISOString().slice(0, 10);
export type AppState = {
  recipes: Recipe[];
  plan: Plan;
  pantry: PantryItem[];
  staples: Staple[];
  leftovers: LeftoverBatch[];
  groceries: GroceryItem[];
  offers: Offer[];
  expenses: Expense[];
  settings: Settings;
  members: { id: string; name: string }[];
  goals: any[];
  rewards: any[];
  jobs: any[];
  notifications: any[];
  messages: any[];
  revision: number;
  sampleMode: boolean;
};

export const StapleInput = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(100000),
  unit: IngredientSchema.shape.unit,
  department: z.string().trim().min(1).max(80).default("Pantry"),
  enabled: z.boolean().default(true),
});
export type Staple = z.infer<typeof StapleInput> & {
  id: string;
  version: number;
};
export const LeftoverInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    recipeId: z.string().nullable().default(null),
    portions: z.number().int().min(1).max(100),
    storage: z.enum(["Refrigerator", "Freezer"]),
    cookedOn: z.iso.date(),
    useBy: z.union([z.iso.date(), z.literal("")]).default(""),
    note: z.string().max(1000).default(""),
  })
  .refine(
    (v) => !v.useBy || v.useBy >= v.cookedOn,
    "The reminder date must be on or after the cooking date.",
  );
export type LeftoverBatch = z.infer<typeof LeftoverInput> & {
  id: string;
  remaining: number;
  version: number;
  archived: boolean;
  allergens?: string[];
};
