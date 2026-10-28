import { useState } from "react";
import { Search, Check, CalendarDays, Clock } from "lucide-react";
import { Modal } from "./App.tsx";
import { Field, useHearth } from "./context.tsx";
import { money, type Meal } from "../../../packages/shared/src/index.ts";
import { art } from "./Kitchen.tsx";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function MealPicker({
  day = 0,
  mealType = "Dinner",
  onClose,
}: {
  day?: number;
  mealType?: string;
  onClose: () => void;
}) {
  const { s, week, act, toast } = useHearth();
  const [query, setQuery] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(mealType);
  const results = s.recipes
    .filter(
      (r) =>
        !r.rejected &&
        (category === "All" || r.category === category) &&
        query
          .toLowerCase()
          .split(/\s+/)
          .every((q) =>
            [r.title, ...r.ingredients.map((i) => i.name)]
              .join(" ")
              .toLowerCase()
              .includes(q),
          ),
    )
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const selected = s.recipes.find((r) => r.id === recipeId);
  return (
    <Modal title="Add a meal, right here" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!selected) return;
          const f = new FormData(e.currentTarget);
          if (
            s.plan.approved &&
            !confirm(
              "Add this meal to your approved week and update groceries?",
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            await act("/plan/add", {
              week,
              version: s.plan.version,
              confirm: true,
              meal: {
                recipeId,
                day: Number(f.get("day")),
                type: f.get("type"),
                servings: Number(f.get("servings")),
              },
            });
            toast(`${selected.title} added to your week.`);
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Day">
            <select name="day" defaultValue={day}>
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Meal">
            <select
              name="type"
              defaultValue={mealType}
              onChange={(e) => {
                if (category !== "All") setCategory(e.target.value);
              }}
            >
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="quick-search-input">
          <Search size={18} />
          <input
            autoFocus
            aria-label="Find a recipe for this meal"
            placeholder="Search recipes or ingredients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={category === "All"}
            onChange={(e) => setCategory(e.target.checked ? "All" : mealType)}
          />
          Include recipes from every category
        </label>
        <div
          className="meal-picker-list"
          role="group"
          aria-label="Choose a recipe"
        >
          {results.map((r) => (
            <button
              type="button"
              className={recipeId === r.id ? "selected" : ""}
              aria-pressed={recipeId === r.id}
              aria-label={`Choose ${r.title}`}
              key={r.id}
              onClick={() => setRecipeId(r.id)}
            >
              <img src={art(r)} alt="" />
              <span>
                <strong>{r.title}</strong>
                <small>
                  {r.minutes} min · ≈{" "}
                  {money(Math.round(r.costCents / r.servings))}/serving
                  {r.favorite ? " · Favorite" : ""}
                </small>
              </span>
              {recipeId === r.id && <Check size={18} />}
            </button>
          ))}
          {!results.length && (
            <p className="search-empty">
              No recipes match. Try another ingredient or include every
              category.
            </p>
          )}
        </div>
        <div className="meal-picker-footer">
          <Field label="Batch portions">
            <input
              name="servings"
              type="number"
              required
              min={1}
              max={30}
              defaultValue={s.settings.adults}
            />
          </Field>
          <button className="primary" disabled={!selected || busy}>
            <CalendarDays size={16} />
            {busy ? "Adding…" : "Add meal"}
          </button>
        </div>
        {selected && (
          <p className="fine">
            Selected: {selected.title}. Existing meals stay in place.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
