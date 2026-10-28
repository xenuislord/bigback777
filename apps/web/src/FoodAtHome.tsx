import { useState } from "react";
import { Clock, ArrowRight, Check, Leaf } from "lucide-react";
import { useHearth, Empty } from "./context.tsx";
import { today } from "../../../packages/shared/src/index.ts";
import {
  useSoon,
  daysUntil,
  pantrySuggestions,
} from "../../../packages/grocery/src/pantry.ts";
import { displayQuantity } from "../../../packages/grocery/src/index.ts";
import { art } from "./Kitchen.tsx";
export function openPantryView(view: string, navigate: (p: "Pantry") => void) {
  try {
    sessionStorage.setItem("hearth.ui.pantry.view", JSON.stringify(view));
    if (view === "Ingredients")
      sessionStorage.setItem(
        "hearth.ui.pantry.expiry",
        JSON.stringify("Past reminder"),
      );
  } catch {}
  navigate("Pantry");
}
export function UseSoonSummary({
  onCook,
  onExpired,
  compact = false,
}: {
  onCook?: () => void;
  onExpired?: () => void;
  compact?: boolean;
}) {
  const { s, navigate } = useHearth();
  const soon = useSoon(s.pantry),
    expired = s.pantry.filter(
      (p) => p.quantity > 0 && p.expires && p.expires < today(),
    );
  if (!soon.length && !expired.length) return null;
  return (
    <section className={"use-soon-panel " + (compact ? "compact" : "")}>
      <div>
        <span className="eyebrow">
          <Leaf size={13} />A LITTLE LESS FOOD WASTE
        </span>
        <h3>
          {soon.length
            ? `${soon.length} ingredient${soon.length === 1 ? "" : "s"} to use soon.`
            : "A quick pantry check would help."}
        </h3>
        <p>
          {soon
            .slice(0, compact ? 3 : 6)
            .map(
              (p) =>
                `${p.name} (${daysUntil(p.expires) === 0 ? "today" : daysUntil(p.expires) === 1 ? "tomorrow" : `in ${daysUntil(p.expires)} days`})`,
            )
            .join(" · ") || "Some recorded items are past their reminder date."}
        </p>
      </div>
      <div className="button-row">
        {soon.length > 0 && (
          <button
            className="secondary"
            onClick={() =>
              onCook ? onCook() : openPantryView("Cook from pantry", navigate)
            }
          >
            Find a meal for these
            <ArrowRight size={14} />
          </button>
        )}
        {expired.length > 0 && (
          <button
            className="text-button"
            onClick={() =>
              onExpired ? onExpired() : openPantryView("Ingredients", navigate)
            }
          >
            Review {expired.length} past-date item
            {expired.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </section>
  );
}
export function PantryMeals() {
  const { s, openRecipe, navigate } = useHearth();
  const [quick, setQuick] = useState(false);
  const [category, setCategory] = useState("All");
  const suggestions = pantrySuggestions(s.recipes, s.pantry, s.settings.adults)
    .filter(
      (r) =>
        (!quick || r.recipe.minutes <= 30) &&
        (category === "All" || r.recipe.category === category),
    )
    .slice(0, 12);
  return (
    <section>
      <div className="deals-heading">
        <div>
          <p className="eyebrow">DINNER CAN START RIGHT HERE</p>
          <h2>Make more of what’s already home.</h2>
          <p>
            Matched quantities for {s.settings.adults} portions, with
            ingredients due soon first. Expired stock and incompatible units are
            excluded.
          </p>
        </div>
      </div>
      <div className="filter-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={quick}
            onChange={(e) => setQuick(e.target.checked)}
          />
          30 minutes or less
        </label>
        <label className="filter">
          Meal
          <select
            aria-label="Pantry recipe category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "All",
              "Breakfast",
              "Lunch",
              "Dinner",
              "Snack",
              "Dessert",
              "Drink",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <p className="fine">
          Each suggestion considers your stock independently; ingredients are
          not reserved until you decide what to cook.
        </p>
      </div>
      {!suggestions.length ? (
        <Empty title="A few pantry entries can unlock a lot.">
          Add ingredients and quantities to see real matches, or{" "}
          <button className="text-button" onClick={() => navigate("Recipes")}>
            browse all recipes
          </button>
          .
        </Empty>
      ) : (
        <div className="pantry-meal-grid">
          {suggestions.map((match) => {
            const missing = match.ingredients.filter((i) => i.missing > 0.001);
            return (
              <article className="pantry-meal-card" key={match.recipe.id}>
                <img src={art(match.recipe)} alt="" />
                <div>
                  <div className="recipe-category">
                    {match.recipe.category} · {match.recipe.minutes} min
                  </div>
                  <h3>{match.recipe.title}</h3>
                  <div className="coverage-line">
                    <progress max={match.total || 1} value={match.covered} />
                    <span>
                      {match.covered} of {match.total} ingredients covered
                    </span>
                  </div>
                  {match.soonIngredients.length > 0 && (
                    <p className="use-soon-note">
                      <Leaf size={12} />
                      Uses soon: {match.soonIngredients.join(", ")}
                    </p>
                  )}
                  {!missing.length ? (
                    <p className="covered-message">
                      <Check size={14} />
                      All listed quantities are covered by recorded stock.
                    </p>
                  ) : (
                    <p className="missing-list">
                      <strong>Still need:</strong>{" "}
                      {missing
                        .slice(0, 4)
                        .map(
                          (i) =>
                            `${i.name} · ${displayQuantity(i.missing, i.unit)}`,
                        )
                        .join("; ")}
                      {missing.length > 4
                        ? `; +${missing.length - 4} more`
                        : ""}
                    </p>
                  )}
                  <button
                    className="secondary full"
                    onClick={() => openRecipe(match.recipe)}
                  >
                    Open recipe & plan
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
