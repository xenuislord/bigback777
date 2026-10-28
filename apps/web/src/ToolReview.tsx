import { useState } from "react";
import { Check, Wallet, ArrowRight } from "lucide-react";
import { Modal } from "./App.tsx";
import { Field, useHearth, cents } from "./context.tsx";
import { money } from "../../../packages/shared/src/index.ts";
import { totalExpense } from "../../../packages/finance/src/index.ts";
export const toolLabels: Record<string, string> = {
  searchRecipes: "Find recipes",
  generateRecipeSuggestions: "Find meal ideas",
  createRecipe: "Add a recipe",
  editRecipe: "Update a recipe",
  saveRecipe: "Save a favorite",
  favoriteRecipe: "Update favorite",
  replacePlannedMeal: "Replace one meal",
  updateMealPlan: "Add a planned meal",
  approveMealPlan: "Approve this week",
  scaleRecipe: "Scale a recipe",
  generateGroceryList: "Make the grocery list",
  updateGroceryItem: "Update a shopping item",
  checkPantry: "Check the pantry",
  searchStoreOffers: "Check recorded prices",
  optimizeShoppingTrip: "Compare shopping options",
  addExpense: "Record an expense",
  logTakeout: "Record takeout",
  calculateSavings: "Review spending",
  updateHouseholdGoal: "Update a goal",
  createReward: "Create a reward",
  summarizeWeeklyProgress: "Review the week",
};
const readNames = new Set([
  "searchRecipes",
  "generateRecipeSuggestions",
  "scaleRecipe",
  "checkPantry",
  "searchStoreOffers",
  "optimizeShoppingTrip",
  "calculateSavings",
  "summarizeWeeklyProgress",
]);
const labels: Record<string, string> = {
  amountCents: "Food or base amount ($)",
  feesCents: "Delivery or service fees ($)",
  tipCents: "Tip ($)",
  taxCents: "Tax ($)",
  discountCents: "Discount actually applied ($)",
  merchant: "Store or restaurant",
  date: "Date",
  portions: "People / portions",
  note: "Notes",
  recipeId: "Recipe",
  mealId: "Planned meal",
  goalId: "Linked goal",
  id: "Record",
  week: "Planning week",
  favorite: "Save as favorite",
  purchased: "Purchased",
  servings: "Batch portions",
  query: "What to look for",
  count: "Requested meals",
  limit: "Maximum results",
  target: "Target",
  progress: "Progress",
  title: "Title",
  day: "Day",
  type: "Meal",
  kind: "Measure",
  month: "Reporting month",
  store: "Store",
};
const human = (key: string) =>
  labels[key] ||
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
export function ToolReview({
  proposal,
  onClose,
}: {
  proposal: {
    id: string;
    index: number;
    name: string;
    args: Record<string, any>;
  };
  onClose: () => void;
}) {
  const { s, act, toast } = useHearth();
  const [args, setArgs] = useState(() => {
    const draft = structuredClone(proposal.args);
    if (
      ["logTakeout", "addExpense"].includes(proposal.name) &&
      draft.merchant?.startsWith("Takeout —")
    )
      draft.merchant = "";
    if (
      ["logTakeout", "addExpense"].includes(proposal.name) &&
      draft.note === "Proposed in chat; total supplied by user"
    )
      draft.note = "";
    return draft;
  });
  const [advanced, setAdvanced] = useState(
    JSON.stringify(proposal.args, null, 2),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(undefined);
  const financial =
    proposal.name === "logTakeout" || proposal.name === "addExpense";
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ["amountCents", "feesCents", "tipCents", "taxCents", "discountCents"].map(
        (k) => [k, ((proposal.args[k] || 0) / 100).toFixed(2)],
      ),
    ),
  );
  const [useAdvanced, setUseAdvanced] = useState(false);
  let estimatedTotal = 0;
  try {
    estimatedTotal = totalExpense(
      Object.fromEntries(
        Object.entries(amounts).map(([k, v]) => [k, cents(v)]),
      ) as any,
    );
  } catch {}
  const field = (key: string, value: any, set: (v: any) => void) => {
    if (key === "version") return null;
    const recipeField =
      key === "recipeId" ||
      (key === "id" &&
        ["scaleRecipe", "saveRecipe", "favoriteRecipe", "editRecipe"].includes(
          proposal.name,
        ));
    const groceriesField =
      key === "id" && proposal.name === "updateGroceryItem";
    const options = recipeField
      ? s.recipes.map((r) => ({ id: r.id, title: r.title }))
      : groceriesField
        ? s.groceries.map((i) => ({ id: i.id, title: i.name }))
        : key === "mealId"
          ? s.plan.meals.map((m) => ({
              id: m.id,
              title: s.recipes.find((r) => r.id === m.recipeId)?.title || m.id,
            }))
          : key === "goalId"
            ? s.goals.map((g) => ({ id: g.id, title: g.title }))
            : null;
    if (options)
      return (
        <Field key={key} label={human(key)}>
          <select value={value || ""} onChange={(e) => set(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </Field>
      );
    if (key === "day")
      return (
        <Field key={key} label="Day">
          <select value={value} onChange={(e) => set(Number(e.target.value))}>
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
      );
    if (key === "type" || key === "category" || key === "kind") {
      const values =
        key === "type"
          ? ["Breakfast", "Lunch", "Dinner", "Snack"]
          : key === "category"
            ? ["Grocery", "Takeout", "Restaurant", "Membership", "Waste"]
            : ["cooked", "budget", "custom"];
      return (
        <Field key={key} label={human(key)}>
          <select value={value} onChange={(e) => set(e.target.value)}>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      );
    }
    if (typeof value === "boolean")
      return (
        <label className="checkbox-label" key={key}>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => set(e.target.checked)}
          />
          {human(key)}
        </label>
      );
    if (value !== null && typeof value === "object") {
      if (key === "meal")
        return (
          <fieldset className="proposal-meal" key={key}>
            <legend>Planned meal</legend>
            {Object.entries(value).map(([k, v]) =>
              field(k, v, (next) => set({ ...value, [k]: next })),
            )}
          </fieldset>
        );
      return (
        <p className="fine" key={key}>
          Detailed {human(key).toLowerCase()} can be reviewed in Advanced
          details below.
        </p>
      );
    }
    return (
      <Field key={key} label={human(key)}>
        {["note", "query", "title"].includes(key) ? (
          <textarea
            value={value ?? ""}
            maxLength={key === "note" ? 2000 : 5000}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <input
            type={
              ["date", "week"].includes(key)
                ? "date"
                : key === "month"
                  ? "month"
                  : typeof value === "number"
                    ? "number"
                    : "text"
            }
            required={!["note", "store", "query"].includes(key)}
            min={typeof value === "number" ? 0 : undefined}
            step={typeof value === "number" ? "any" : undefined}
            value={value ?? ""}
            onChange={(e) =>
              set(
                typeof value === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </Field>
    );
  };
  return (
    <Modal
      title={toolLabels[proposal.name] || "Review this change"}
      onClose={onClose}
    >
      {result !== undefined ? (
        <>
          <div className="notice subtle">
            <Check size={18} />
            Your request is complete.
          </div>
          <ResultView value={result} />
          <button className="primary full" onClick={onClose}>
            Done
          </button>
        </>
      ) : (
        <form
          noValidate={useAdvanced}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              const reviewed = useAdvanced
                ? JSON.parse(advanced)
                : financial
                  ? {
                      ...args,
                      ...Object.fromEntries(
                        Object.entries(amounts).map(([k, v]) => [k, cents(v)]),
                      ),
                    }
                  : args;
              const r = await act("/tools/execute", {
                messageId: proposal.id,
                index: proposal.index,
                args: reviewed,
                confirm: true,
              });
              if (readNames.has(proposal.name)) setResult(r);
              else {
                toast(
                  financial
                    ? "Expense recorded. Your spending is up to date."
                    : "Your household has been updated.",
                );
                onClose();
              }
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {financial ? (
            <>
              <p className="fine">
                Review the details. This becomes a real expense only when you
                choose Record expense.
              </p>
              <div className="form-grid">
                {["merchant", "category", "date", "portions"].map((k) =>
                  field(k, args[k], (v) => setArgs({ ...args, [k]: v })),
                )}
              </div>
              <div className="form-grid">
                {Object.keys(amounts).map((k) => (
                  <Field key={k} label={human(k)}>
                    <input
                      inputMode="decimal"
                      required
                      value={amounts[k]}
                      onChange={(e) =>
                        setAmounts({ ...amounts, [k]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
              {field("note", args.note || "", (v) =>
                setArgs({ ...args, note: v }),
              )}
              <div className="checkout-total">
                <span>Total to record</span>
                <strong>{money(estimatedTotal)}</strong>
              </div>
            </>
          ) : (
            <>
              <p className="fine">
                {readNames.has(proposal.name)
                  ? "Choose what to look up in your household records."
                  : "Review these details before applying a change to your household."}
              </p>
              {Object.entries(args).map(([k, v]) =>
                field(k, v, (next) => setArgs({ ...args, [k]: next })),
              )}
            </>
          )}
          <details className="advanced-proposal">
            <summary
              onClick={() => {
                if (!useAdvanced) {
                  const latest = financial
                    ? {
                        ...args,
                        ...Object.fromEntries(
                          Object.entries(amounts).map(([k, v]) => {
                            try {
                              return [k, cents(v)];
                            } catch {
                              return [k, 0];
                            }
                          }),
                        ),
                      }
                    : args;
                  setAdvanced(JSON.stringify(latest, null, 2));
                }
              }}
            >
              Advanced details
            </summary>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useAdvanced}
                onChange={(e) => setUseAdvanced(e.target.checked)}
              />
              Use the advanced fields instead
            </label>
            <Field label="Proposed fields (editable JSON)">
              <textarea
                className="code-input"
                rows={10}
                value={advanced}
                onChange={(e) => setAdvanced(e.target.value)}
              />
            </Field>
          </details>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {financial ? <Wallet size={16} /> : <Check size={16} />}{" "}
            {busy
              ? "Saving…"
              : financial
                ? "Record expense"
                : readNames.has(proposal.name)
                  ? "Show results"
                  : "Confirm & apply"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function ResultView({ value, depth = 0 }: { value: any; depth?: number }) {
  if (value === null || value === undefined)
    return <p className="fine">Not available.</p>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="tool-results">
        {value.slice(0, 30).map((v, i) => (
          <div key={v?.id || i}>
            <ResultView value={v} depth={depth + 1} />
          </div>
        ))}
        {value.length > 30 && (
          <p className="fine">Showing the first 30 results.</p>
        )}
      </div>
    ) : (
      <p className="fine">No matching records found.</p>
    );
  if (typeof value === "object") {
    const fields = Object.entries(value).filter(
      ([k]) =>
        ![
          "id",
          "version",
          "memberId",
          "planId",
          "recipeId",
          "sources",
          "data",
          "photo",
        ].includes(k),
    );
    if (depth > 3)
      return (
        <p className="fine">
          {value.title ||
            value.name ||
            value.description ||
            "Details available in the related page."}
        </p>
      );
    return (
      <dl className="result-fields">
        {fields.slice(0, 18).map(([k, v]) => (
          <div key={k}>
            <dt>{human(k.replace(/Cents$/, ""))}</dt>
            <dd>
              {k.endsWith("Cents") && typeof v === "number" ? (
                money(v)
              ) : typeof v === "object" ? (
                <ResultView value={v} depth={depth + 1} />
              ) : typeof v === "boolean" ? (
                v ? (
                  "Yes"
                ) : (
                  "No"
                )
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <p>{String(value)}</p>;
}
