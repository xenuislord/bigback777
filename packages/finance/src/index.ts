import type {
  Expense,
  Settings,
  Plan,
  Recipe,
} from "../../shared/src/index.ts";
export function totalExpense(
  e: Pick<
    Expense,
    "amountCents" | "feesCents" | "tipCents" | "taxCents" | "discountCents"
  >,
) {
  return Math.max(
    0,
    e.amountCents + e.feesCents + e.tipCents + e.taxCents - e.discountCents,
  );
}
export function finances(
  expenses: Expense[],
  settings: Settings,
  plan: Plan,
  recipes: Recipe[],
  month = new Date().toISOString().slice(0, 7),
) {
  const rows = expenses.filter((e) => e.date.startsWith(month));
  const total = rows.reduce((s, e) => s + totalExpense(e), 0);
  const cooked = plan.meals.filter((m) => m.status === "cooked");
  const portions = (m: (typeof plan.meals)[number]) =>
    m.leftoverOf
      ? m.servings
      : m.servings -
        plan.meals
          .filter((x) => x.leftoverOf === m.id)
          .reduce((s, x) => s + x.servings, 0);
  const estimatedHomeCost = cooked.reduce((s, m) => {
    const r = recipes.find((r) => r.id === m.recipeId);
    return s + (r ? Math.round((r.costCents * portions(m)) / r.servings) : 0);
  }, 0);
  const hypotheticalTakeout = cooked.reduce(
    (s, m) => s + settings.takeoutBaselineCents * portions(m),
    0,
  );
  return {
    month,
    totalCents: total,
    groceryCents: rows
      .filter((e) => e.category === "Grocery")
      .reduce((s, e) => s + totalExpense(e), 0),
    takeoutCents: rows
      .filter((e) => e.category === "Takeout" || e.category === "Restaurant")
      .reduce((s, e) => s + totalExpense(e), 0),
    remainingCents: settings.monthlyBudgetCents - total,
    budgetSavingsCents: settings.monthlyBudgetCents - total,
    estimatedAvoidanceCents: hypotheticalTakeout - estimatedHomeCost,
    estimatedHomeCostCents: estimatedHomeCost,
    cookedMeals: cooked.filter((m) => !m.leftoverOf).length,
    byStore: Object.entries(
      rows.reduce<Record<string, number>>((a, e) => {
        a[e.merchant] = (a[e.merchant] || 0) + totalExpense(e);
        return a;
      }, {}),
    ),
  };
}
