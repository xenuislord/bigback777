import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Clock,
  Heart,
  Users,
  Check,
  Flame,
  CalendarDays,
  ShoppingBasket,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Lock,
  Utensils,
  Printer,
  History,
  Shuffle,
  Pencil,
} from "lucide-react";
import { useHearth, Field, SectionTitle, Empty } from "./context.tsx";
import { Modal } from "./App.tsx";
import { useSessionState } from "./preferences.ts";
import { CookingMode } from "./CookingMode.tsx";
import { LeftoverEditor } from "./Leftovers.tsx";
import { UseSoonSummary, openPantryView } from "./FoodAtHome.tsx";
import { MealPicker } from "./MealPicker.tsx";
import {
  money,
  today,
  weekStart,
  type Recipe,
  type Meal,
} from "../../../packages/shared/src/index.ts";
import {
  displayQuantity,
  scaleIngredients,
} from "../../../packages/grocery/src/index.ts";
import { finances } from "../../../packages/finance/src/index.ts";
export const art = (r: Recipe) =>
  r.photo || `/art/meal-${Number(r.id.replace(/\D/g, "")) % 6 || 0}.svg`;
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function RecipeCard({
  recipe: r,
  selected,
  onSelect,
  compact = false,
}: {
  recipe: Recipe;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const { openRecipe, act } = useHearth();
  return (
    <article className={"recipe-card " + (selected ? "selected" : "")}>
      <div className="recipe-image">
        <button
          className="image-button"
          onClick={() => openRecipe(r)}
          aria-label={`View ${r.title}`}
        >
          <img
            src={art(r)}
            alt={`${r.title}${r.photo ? "" : " · original recipe illustration"}`}
            loading="lazy"
          />
        </button>
        <button
          className={"favorite " + (r.favorite ? "is-favorite" : "")}
          aria-label={`${r.favorite ? "Unfavorite" : "Favorite"} ${r.title}`}
          onClick={() =>
            void act(`/recipes/${r.id}/preference`, {
              favorite: !r.favorite,
            }).catch(() => {})
          }
        >
          <Heart size={17} fill={r.favorite ? "currentColor" : "none"} />
        </button>
        {onSelect && (
          <button
            aria-label={`${selected ? "Deselect" : "Select"} ${r.title}`}
            className={"select-recipe " + (selected ? "checked" : "")}
            onClick={onSelect}
          >
            {selected ? <Check size={17} /> : <Plus size={17} />}
          </button>
        )}
      </div>
      <div className="recipe-card-body">
        <span className="recipe-category">
          {r.category} <span>·</span>{" "}
          {r.tags.includes("Quick") ? "Weeknight friendly" : "Made for sharing"}
        </span>
        <button className="title-button" onClick={() => openRecipe(r)}>
          <h3>{r.title}</h3>
        </button>
        {!compact && (
          <p className="recipe-desc">
            {r.ingredients
              .slice(0, 3)
              .map((i) => i.name)
              .join(" · ")}
          </p>
        )}
        <div className="recipe-meta">
          <span>
            <Clock size={13} />
            {r.minutes} min
          </span>
          <span>
            {money(Math.round(r.costCents / r.servings))} / serving{" "}
            <span className="estimate-symbol" title="Planning estimate">
              ≈
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
export function Home() {
  const { s, navigate, openRecipe, week, setWeek } = useHearth();
  const stats = finances(s.expenses, s.settings, s.plan, s.recipes);
  const day = (new Date().getDay() + 6) % 7;
  const tonight = s.plan.meals.find(
    (m) =>
      (week !== weekStart() || m.day === day) &&
      m.type === "Dinner" &&
      m.status === "planned",
  );
  const meal = tonight
    ? s.recipes.find((r) => r.id === tonight.recipeId)
    : null;
  const favorites = s.recipes
    .filter((r) => !r.rejected)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .filter((r) => r.category === "Dinner")
    .slice(0, 3);
  const pending = s.groceries.filter((i) => !i.purchased).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · YOUR KITCHEN, TOGETHER
          </p>
          <h1>A good week starts at home.</h1>
          <p>A little planning. Better meals. More around your table.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            const next = new Date(weekStart() + "T12:00:00Z");
            next.setUTCDate(next.getUTCDate() + 7);
            setWeek(next.toISOString().slice(0, 10));
            navigate("Recipes");
          }}
        >
          <Plus size={17} />
          Plan next week
        </button>
      </div>
      <div className="week-next-step">
        <div>
          <span className="eyebrow">
            WEEK OF{" "}
            {new Date(week + "T12:00:00Z").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <strong>
            {!s.plan.meals.length
              ? "Start with a few meals you’ll look forward to."
              : !s.plan.approved
                ? `${s.plan.meals.length} meals picked. Ready to review your week?`
                : pending
                  ? `${pending} grocery items left. Your list is ready.`
                  : "Your week is ready. Time for something good."}
          </strong>
        </div>
        <div className="button-row">
          {week !== weekStart() && (
            <button
              className="text-button"
              onClick={() => setWeek(weekStart())}
            >
              This week
            </button>
          )}
          <button
            className="text-button"
            onClick={() =>
              navigate(
                !s.plan.meals.length
                  ? "Recipes"
                  : !s.plan.approved
                    ? "Meal planner"
                    : "Groceries",
              )
            }
          >
            {!s.plan.meals.length
              ? "Choose recipes"
              : !s.plan.approved
                ? "Review & approve"
                : "Open shopping list"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="little-line" />
            THIS WEEK, MADE YOURS
          </span>
          <h2>
            What are we
            <br />
            craving this week?
          </h2>
          <p>
            Comforting dinners. A few new favorites.
            <br />A plan that works for all {s.settings.adults} of you.
          </p>
          <button className="primary" onClick={() => navigate("Recipes")}>
            Find our next favorite
            <ArrowRight size={17} />
          </button>
          <div className="hero-caption">
            <span className="tiny-avatars">
              {s.members.map((m, i) => (
                <span className={`avatar a${i}`} key={m.id}>
                  {m.name[0]}
                </span>
              ))}
            </span>
            <span>One household. One shared plan.</span>
          </div>
        </div>
        <div className="hero-art">
          <img
            src="/art/meal-0.svg"
            alt="Original illustration of a comforting beef and potato dinner"
          />
          <div className="hero-note">
            <span>THE GOOD KIND OF HOMEWORK</span>
            <strong>Dinner, taken care of.</strong>
            <span>Start with a recipe. Make it a ritual.</span>
          </div>
        </div>
      </section>
      <UseSoonSummary compact />
      {(s.leftovers || []).some(
        (b) => b.remaining > 0 && (!b.useBy || b.useBy >= today()),
      ) && (
        <section className="leftovers-home">
          <div>
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h3>There’s already something good in the fridge.</h3>
            <p>
              {(s.leftovers || [])
                .filter(
                  (b) => b.remaining > 0 && (!b.useBy || b.useBy >= today()),
                )
                .slice(0, 3)
                .map((b) => `${b.title} · ${b.remaining} portions`)
                .join(" · ")}
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => openPantryView("Leftovers", navigate)}
          >
            See saved meals
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      <div className="stat-grid">
        <div className="stat">
          <span>
            <CalendarDays size={16} />
            This week’s cooking
          </span>
          <strong>
            {stats.cookedMeals}
            <small>
              {" "}
              / {s.plan.meals.filter((m) => !m.leftoverOf).length || "—"}
            </small>
          </strong>
          <p>
            {s.plan.meals.length
              ? "Meals cooked · keep going"
              : "Your first plan starts with one meal"}
          </p>
        </div>
        <div className="stat">
          <span>
            <ShoppingBasket size={16} />
            Grocery spending
          </span>
          <strong>{money(stats.groceryCents)}</strong>
          <p>Actual transactions · this month</p>
        </div>
        <div className="stat">
          <span>
            <ArrowUpRight size={16} />
            Budget remaining
          </span>
          <strong>{money(stats.remainingCents)}</strong>
          <p>
            of {money(s.settings.monthlyBudgetCents)} monthly household budget
          </p>
        </div>
        <div className="stat">
          <span>
            <Flame size={16} />
            Your next shop
          </span>
          <strong>
            {pending}
            <small> items</small>
          </strong>
          <p>
            {pending
              ? "A shared list, ready when you are"
              : "Approve a plan to build your list"}
          </p>
        </div>
      </div>
      <div className="home-split">
        <section>
          <SectionTitle
            eyebrow="YOUR EVERYDAY INSPIRATION"
            title="A few things you might love"
          >
            <button className="text-button" onClick={() => navigate("Recipes")}>
              All recipes
              <ArrowRight size={15} />
            </button>
          </SectionTitle>
          <div className="recipe-grid three">
            {favorites.map((r) => (
              <RecipeCard key={r.id} recipe={r} compact />
            ))}
          </div>
        </section>
        <section className="tonight">
          <div className="section-title">
            <p className="eyebrow">
              {week === weekStart()
                ? "ON THE TABLE TONIGHT"
                : "FROM YOUR SELECTED WEEK"}
            </p>
            <span className="small-pill">{days[tonight?.day ?? day]}</span>
          </div>
          {meal ? (
            <>
              <h2>{meal.title}</h2>
              <p>
                {meal.minutes} minutes · {tonight?.servings} portions
              </p>
              <img src={art(meal)} alt={meal.title} />
              <button
                className="secondary full"
                onClick={() => openRecipe(meal)}
              >
                Let’s get cooking
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div className="tonight-icon">
                <Utensils size={32} />
              </div>
              <h2>
                Something good
                <br />
                is in the making.
              </h2>
              <p>
                No dinner planned for tonight.
                <br />
                Find a quick favorite and make it yours.
              </p>
              <button
                className="secondary full"
                onClick={() => navigate("Meal planner")}
              >
                Open our week
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </section>
      </div>
      <section className="home-bottom">
        <div>
          <span className="eyebrow">A LITTLE PERSPECTIVE</span>
          <h3>Good habits add up, one dinner at a time.</h3>
          <p>
            Estimated takeout avoidance:{" "}
            <strong>{money(stats.estimatedAvoidanceCents)}</strong>. Based on
            your {money(s.settings.takeoutBaselineCents)} per-person baseline
            and recipe cost estimates. This is hypothetical, not cash savings.
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => navigate("Goals & rewards")}
        >
          Our goals
          <ArrowUpRight size={18} />
        </button>
      </section>
    </>
  );
}
export function Recipes() {
  const { s, week, act, toast, navigate } = useHearth();
  const [query, setQuery] = useSessionState("recipes.query", "");
  const [category, setCategory] = useSessionState("recipes.category", "Dinner");
  const [time, setTime] = useSessionState("recipes.time", 120);
  const [budget, setBudget] = useSessionState("recipes.budget", 30);
  const [favorite, setFavorite] = useSessionState("recipes.favorite", false);
  const [protein, setProtein] = useSessionState("recipes.protein", "Any");
  const [selected, setSelected] = useSessionState<string[]>(
    "recipes.selected",
    [],
  );
  const [sort, setSort] = useSessionState("recipes.sort", "match");
  const [compare, setCompare] = useState(false);
  const [editor, setEditor] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [count, setCount] = useSessionState("recipes.count", 6);
  const [discover, setDiscover] = useState(false);
  const [busy, setBusy] = useState(false);
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  const all = s.recipes.filter(
    (r) =>
      !r.rejected &&
      (!category || r.category === category) &&
      r.minutes <= time &&
      r.costCents / r.servings <= budget * 100 &&
      (!favorite || r.favorite) &&
      (protein === "Any" ||
        r.ingredients.some((i) => i.name.includes(protein.toLowerCase()))),
  );
  const scored = all
    .map((r) => ({
      r,
      score: words.reduce(
        (n, w) =>
          n +
          (JSON.stringify([r.title, r.tags, r.ingredients])
            .toLowerCase()
            .includes(w)
            ? 1
            : 0),
        0,
      ),
    }))
    .sort((a, b) =>
      sort === "time"
        ? a.r.minutes - b.r.minutes
        : sort === "cost"
          ? a.r.costCents / a.r.servings - b.r.costCents / b.r.servings
          : sort === "protein"
            ? b.r.protein - a.r.protein
            : b.score - a.score || Number(b.r.favorite) - Number(a.r.favorite),
    );
  const results = (
    discover
      ? scored.slice(0, Math.max(count * 2, 12))
      : scored.filter((x) => !words.length || x.score > 0)
  ).map((x) => x.r);
  const chosen = s.recipes.filter((r) => selected.includes(r.id));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE RECIPE COLLECTION</p>
          <h1>Find your kind of delicious.</h1>
          <p>
            {s.recipes.length} original recipes. Everyday ingredients. Plenty of
            possibilities.
          </p>
        </div>
        <button className="secondary" onClick={() => setEditor(true)}>
          <Plus size={16} />
          Add a recipe
        </button>
      </div>
      <section className="discovery">
        <div>
          <span className="eyebrow">LET’S MAKE A LITTLE PLAN</span>
          <h2>What are we craving this week?</h2>
          <p>Tell us what sounds good. Your saved recipes will do the rest.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDiscover(true);
          }}
        >
          <div className="craving-input">
            <Search size={20} />
            <input
              aria-label="Cravings"
              placeholder="Beef, potatoes, something creamy…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDiscover(false);
              }}
            />
            <button className="primary">
              Find ideas
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="discovery-controls">
            <label>
              Plan for{" "}
              <input
                aria-label="Number of requested recipes"
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />{" "}
              meals
            </label>
            <span>
              <Users size={15} />
              {s.settings.adults} adults
            </span>
            <span>Local library · AI optional</span>
          </div>
        </form>
      </section>
      <div className="recipe-shortcuts" aria-label="Recipe shortcuts">
        <button
          className={"chip " + (time === 20 ? "active" : "")}
          onClick={() => setTime(time === 20 ? 120 : 20)}
        >
          <Clock size={14} />
          20-minute meals
        </button>
        <button
          className={"chip " + (budget === 5 ? "active" : "")}
          onClick={() => setBudget(budget === 5 ? 30 : 5)}
        >
          Under $5 a serving
        </button>
        <span>Your choices stay here while you explore.</span>
      </div>
      <div className="filter-row">
        <label className="filter">
          Meal
          <select
            aria-label="Meal category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All recipes</option>
            {["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drink"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        <label className="filter">
          Time
          <select
            aria-label="Maximum cooking time"
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
          >
            {[20, 30, 45, 60, 120, 720].map((t) => (
              <option key={t} value={t}>
                {t === 720 ? "Any time" : `Under ${t} min`}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          Protein
          <select
            aria-label="Preferred protein"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          >
            {[
              "Any",
              "Beef",
              "Chicken",
              "Shrimp",
              "Salmon",
              "Egg",
              "Ricotta",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="filter">
          Per serving
          <select
            aria-label="Maximum recipe cost estimate"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          >
            {[3, 5, 8, 30].map((t) => (
              <option key={t} value={t}>
                {t === 30 ? "Any budget" : `Under $${t}`}
              </option>
            ))}
          </select>
        </label>
        <button
          className={"chip " + (favorite ? "active" : "")}
          onClick={() => setFavorite((v) => !v)}
        >
          <Heart size={15} />
          Favorites
        </button>
        <label className="filter">
          Sort
          <select
            aria-label="Sort recipes"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="match">Best match</option>
            <option value="time">Quickest first</option>
            <option value="cost">Lowest estimated cost</option>
            <option value="protein">Most protein</option>
          </select>
        </label>
        <span className="filter-count">{results.length} recipes</span>
        <button
          className="text-button"
          onClick={() => {
            setQuery("");
            setCategory("Dinner");
            setTime(120);
            setBudget(30);
            setFavorite(false);
            setProtein("Any");
            setSort("match");
            setDiscover(false);
          }}
        >
          Reset filters
        </button>
      </div>
      {!results.length ? (
        <Empty title="Let’s loosen the recipe a little.">
          Try another ingredient or a longer cooking time.
        </Empty>
      ) : (
        <div className="recipe-grid">
          {results.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              selected={selected.includes(r.id)}
              onSelect={() =>
                setSelected((v) =>
                  v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id],
                )
              }
            />
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="selection-bar">
          <span>
            <strong>{selected.length}</strong> recipes selected
          </span>
          <div className="selected-recipes" aria-label="Selected recipes">
            {chosen.map((r) => (
              <button
                key={r.id}
                aria-label={`Remove selection ${r.title}`}
                onClick={() =>
                  setSelected((v) => v.filter((id) => id !== r.id))
                }
              >
                <img src={art(r)} alt="" />
                <span>{r.title}</span>
                <X size={12} />
              </button>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() => {
              const previous = selected;
              setSelected([]);
              toast("Recipe selections cleared.", {
                label: "Undo",
                onClick: () => setSelected(previous),
              });
            }}
          >
            Clear
          </button>
          <button
            className="secondary"
            disabled={selected.length > 4}
            onClick={() => setCompare(true)}
          >
            Compare {selected.length <= 4 ? "" : "(up to 4)"}
          </button>
          <button className="primary" onClick={() => setPlanning(true)}>
            Add to our week
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {compare && (
        <Modal
          title="A little side-by-side"
          wide
          onClose={() => setCompare(false)}
        >
          <div className="compare-grid">
            {chosen.map((r) => (
              <div key={r.id}>
                <img src={art(r)} alt={r.title} />
                <h3>{r.title}</h3>
                <p>{r.minutes} minutes</p>
                <p>
                  {money(Math.round(r.costCents / r.servings))} / serving ·
                  estimate
                </p>
                <p>
                  {r.calories} kcal · {r.protein} g protein
                  <br />
                  {r.carbs} g carbs · {r.fat} g fat · {r.fiber} g fiber
                </p>
                <p>
                  Style preference: {r.compatibility}/100
                  <br />A subjective preference score, not a health score.
                </p>
                <p>
                  Pantry matches:{" "}
                  {r.ingredients
                    .filter((i) =>
                      s.pantry.some(
                        (p) => p.name.toLowerCase() === i.name.toLowerCase(),
                      ),
                    )
                    .map((i) => i.name)
                    .join(", ") || "None recorded"}
                </p>
                <p className="fine">
                  {r.ingredients.map((i) => i.name).join(", ")}
                </p>
              </div>
            ))}
          </div>
          <p className="fine">
            Nutrition and costs are estimates. Pantry matches still require
            quantity and expiry checks during list generation.
          </p>
        </Modal>
      )}
      {planning && (
        <Modal
          title="Make room for a good week"
          onClose={() => setPlanning(false)}
        >
          <p>
            Week of {week}. Existing meals stay in place. Choose a day and
            serving count for each recipe.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                s.plan.approved &&
                !confirm(
                  "This week is approved. Add these meals and recalculate its grocery list?",
                )
              )
                return;
              setBusy(true);
              try {
                await act("/plan/add-batch", {
                  week,
                  version: s.plan.version,
                  confirm: true,
                  meals: chosen.map((r) => ({
                    recipeId: r.id,
                    day: Number(f.get("day-" + r.id)),
                    type:
                      r.category === "Breakfast"
                        ? "Breakfast"
                        : r.category === "Lunch"
                          ? "Lunch"
                          : r.category === "Snack"
                            ? "Snack"
                            : "Dinner",
                    servings: Number(f.get("servings-" + r.id)),
                  })),
                });
                setSelected([]);
                setPlanning(false);
                navigate("Meal planner");
                toast(
                  "Your selections are in the calendar. Review, then approve your week.",
                );
              } catch {
              } finally {
                setBusy(false);
              }
            }}
          >
            {chosen.map((r, i) => (
              <div key={r.id} className="plan-assignment">
                <strong>{r.title}</strong>
                <select
                  aria-label={`Day for ${r.title}`}
                  name={"day-" + r.id}
                  defaultValue={i % 7}
                >
                  {days.map((d, n) => (
                    <option key={d} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Servings for ${r.title}`}
                  name={"servings-" + r.id}
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={s.settings.adults}
                />
              </div>
            ))}
            <button className="primary full" disabled={busy}>
              {busy ? "Adding meals…" : "Add selected meals"}
            </button>
          </form>
        </Modal>
      )}
      {editor && <RecipeEditor onClose={() => setEditor(false)} />}
    </>
  );
}
export function RecipeDetail({
  recipe: r,
  onClose,
}: {
  recipe: Recipe;
  onClose: () => void;
}) {
  const { s, act, toast } = useHearth();
  const [servings, setServings] = useState(s.settings.adults);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cooking, setCooking] = useState(false);
  const [savingLeftovers, setSavingLeftovers] = useState(false);
  const [notes, setNotes] = useState(r.notes);
  if (editing)
    return <RecipeEditor recipe={r} onClose={() => setEditing(false)} />;
  if (cooking)
    return (
      <CookingMode
        recipe={r}
        servings={servings}
        onClose={() => setCooking(false)}
      />
    );
  return (
    <Modal title={r.title} wide onClose={onClose}>
      <div className="recipe-detail">
        <div>
          <img className="detail-photo" src={art(r)} alt={r.title} />
          <p className="fine">
            {r.photo
              ? "Household-provided photo"
              : "Original HEARTH illustration · not a photograph of this recipe"}
          </p>
          <div className="tag-row">
            {r.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
          <p>{r.description}</p>
          <div className="detail-facts">
            <span>
              <Clock size={16} />
              {r.minutes} min active + any stated chilling
            </span>
            <span>
              <Users size={16} />
              {r.servings} original servings
            </span>
          </div>
          <h3>Nutrition, per original serving</h3>
          <div className="nutrition-row">
            {[
              [r.calories, "kcal"],
              [r.protein, "g protein"],
              [r.carbs, "g carbs"],
              [r.fat, "g fat"],
              [r.fiber, "g fiber"],
            ].map(([n, label]) => (
              <div key={label}>
                <strong>{n}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="fine">
            Estimated from ingredient averages. Not USDA-verified. Style
            compatibility ({r.compatibility}/100) reflects preferences and makes
            no health claim.
          </p>
          <p>
            <strong>Allergens:</strong>{" "}
            {r.allergens.join(", ") ||
              "None identified; check all product labels."}
          </p>
          <p>
            <strong>Equipment:</strong> {r.equipment.join(", ")}
          </p>
          <p>
            <strong>Leftovers:</strong> {r.storage}
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => setSavingLeftovers(true)}
            >
              Save leftovers
            </button>
            <button className="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit recipe
            </button>
            <button
              className="secondary"
              onClick={() =>
                void act(`/recipes/${r.id}/preference`, {
                  favorite: !r.favorite,
                }).catch(() => {})
              }
            >
              <Heart size={14} />
              {r.favorite ? "Favorited" : "Save favorite"}
            </button>
            <button
              className="text-button"
              onClick={() => {
                if (
                  confirm(
                    "Hide this recipe from future suggestions? You can restore it in Settings.",
                  )
                )
                  void act(`/recipes/${r.id}/preference`, { rejected: true })
                    .then(onClose)
                    .catch(() => {});
              }}
            >
              Not for us
            </button>
          </div>
          <Field label="Our enjoyment rating">
            <select
              aria-label="Enjoyment rating"
              value={r.rating}
              onChange={(e) =>
                void act(`/recipes/${r.id}/preference`, {
                  rating: Number(e.target.value),
                }).catch(() => {})
              }
            >
              <option value={0}>Not rated yet</option>
              {[1, 2, 3, 4, 5].map((i) => (
                <option key={i} value={i}>
                  {"★".repeat(i)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personal cooking notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={3000}
            />
          </Field>
          <button
            className="text-button"
            onClick={() =>
              void act(
                `/recipes/${r.id}`,
                { version: r.version, recipe: { ...r, notes } },
                "PATCH",
              )
                .then(() => toast("Cooking notes saved"))
                .catch(() => {})
            }
          >
            Save notes
          </button>
        </div>
        <div>
          <div className="ingredients-title">
            <h3>What you’ll need</h3>
            <label>
              Servings{" "}
              <input
                aria-label="Scale servings"
                type="number"
                min={1}
                max={30}
                value={servings}
                onChange={(e) =>
                  setServings(Math.max(1, Math.min(30, Number(e.target.value))))
                }
              />
            </label>
          </div>
          <p className="fine">
            {money(Math.round((r.costCents * servings) / r.servings))} for this
            batch · planning estimate
          </p>
          <ul className="ingredient-list">
            {scaleIngredients(r, servings).map((i, n) => (
              <li key={n}>
                <span>{i.name}</span>
                <strong>{displayQuantity(i.quantity, i.unit)}</strong>
              </li>
            ))}
          </ul>
          <button
            className="primary full cooking-start"
            onClick={() => setCooking(true)}
          >
            <Utensils size={17} />
            Start cooking
          </button>
          <h3 className="method-heading">A little time in the kitchen</h3>
          <ol className="method">
            {r.steps.map((step, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <button className="primary full" onClick={() => setAdding(true)}>
            <CalendarDays size={17} />
            Add to meal plan
          </button>
          {savingLeftovers && (
            <LeftoverEditor
              recipe={r}
              onClose={() => setSavingLeftovers(false)}
            />
          )}
          {adding && (
            <AddMeal
              recipe={r}
              servings={servings}
              onClose={() => {
                setAdding(false);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
export function RecipeEditor({
  recipe: r,
  onClose,
}: {
  recipe?: Recipe;
  onClose: () => void;
}) {
  const { act, toast } = useHearth();
  const [photo, setPhoto] = useState(r?.photo || "");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={r ? "Make it your own" : "A new household favorite"}
      wide
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const ingredients = String(f.get("ingredients"))
              .split("\n")
              .filter((l) => l.trim())
              .map((l) => {
                const [name, q, unit, department] = l
                  .split("|")
                  .map((x) => x.trim());
                return {
                  name,
                  quantity: Number(q),
                  unit,
                  department: department || "Pantry",
                };
              });
            const data = {
              ...(r || {}),
              title: f.get("title"),
              description: f.get("description"),
              category: f.get("category"),
              servings: Number(f.get("servings")),
              minutes: Number(f.get("minutes")),
              ingredients,
              steps: String(f.get("steps"))
                .split("\n")
                .filter((l) => l.trim()),
              tags: String(f.get("tags"))
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              allergens: String(f.get("allergens"))
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              equipment: String(f.get("equipment"))
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              storage: f.get("storage"),
              notes: r?.notes || "",
              photo,
              costCents: Math.round(Number(f.get("cost")) * 100),
              calories: Number(f.get("calories")),
              protein: Number(f.get("protein")),
              carbs: Number(f.get("carbs")),
              fat: Number(f.get("fat")),
              fiber: Number(f.get("fiber")),
              compatibility: Number(f.get("compatibility")),
            };
            setBusy(true);
            await act(
              r ? `/recipes/${r.id}` : "/recipes",
              r ? { version: r.version, recipe: data } : data,
              r ? "PATCH" : "POST",
            );
            toast("Recipe saved to your household library.");
            onClose();
          } catch (e: any) {
            toast(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Recipe name">
            <input name="title" required defaultValue={r?.title} />
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={r?.category || "Dinner"}>
              {[
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
          </Field>
          <Field label="Original servings">
            <input
              type="number"
              name="servings"
              min={1}
              max={30}
              defaultValue={r?.servings || 3}
            />
          </Field>
          <Field label="Preparation minutes">
            <input
              type="number"
              name="minutes"
              min={1}
              max={720}
              defaultValue={r?.minutes || 30}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea name="description" required defaultValue={r?.description} />
        </Field>
        <Field label="Ingredients · one per line: name | quantity | unit | department">
          <textarea
            className="code-input"
            rows={7}
            name="ingredients"
            required
            placeholder="ground beef | 500 | g | Meat & seafood"
            defaultValue={r?.ingredients
              .map((i) =>
                [i.name, i.quantity, i.unit, i.department].join(" | "),
              )
              .join("\n")}
          />
        </Field>
        <p className="fine">
          Units: g, kg, oz, lb, ml, l, tsp, tbsp, cup, fl oz, gal, each. Keep
          materially different ingredients separate.
        </p>
        <Field label="Cooking steps · one complete step per line">
          <textarea
            name="steps"
            rows={7}
            required
            defaultValue={r?.steps.join("\n")}
          />
        </Field>
        <div className="form-grid">
          <Field label="Tags (comma separated)">
            <input name="tags" defaultValue={r?.tags.join(", ") || "Custom"} />
          </Field>
          <Field label="Allergens (comma separated)">
            <input name="allergens" defaultValue={r?.allergens.join(", ")} />
          </Field>
          <Field label="Equipment">
            <input
              name="equipment"
              defaultValue={r?.equipment.join(", ") || "Skillet"}
            />
          </Field>
          <Field label="Whole batch estimate ($)">
            <input
              name="cost"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(r?.costCents || 0) / 100}
            />
          </Field>
        </div>
        <div className="form-grid nutrients">
          {[
            "calories",
            "protein",
            "carbs",
            "fat",
            "fiber",
            "compatibility",
          ].map((k) => (
            <Field
              key={k}
              label={
                k === "compatibility"
                  ? "Style preference /100"
                  : k === "calories"
                    ? "Calories / serving"
                    : `${k} g / serving`
              }
            >
              <input
                type="number"
                min={0}
                max={k === "compatibility" ? 100 : 5000}
                name={k}
                defaultValue={(r as any)?.[k] || 0}
              />
            </Field>
          ))}
        </div>
        <Field label="Safe storage instructions">
          <textarea
            name="storage"
            defaultValue={
              r?.storage ||
              "Refrigerate within 2 hours and use within 3–4 days. Reheat to 165°F / 74°C."
            }
          />
        </Field>
        <Field label="Your photo · optional, up to 1 MB">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1000000) {
                toast("Choose a photo under 1 MB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setPhoto(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </Field>
        <button className="primary full" disabled={busy}>
          {busy ? "Saving…" : "Save recipe"}
        </button>
      </form>
    </Modal>
  );
}
function AddMeal({
  recipe,
  servings,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}) {
  const { s, week, act, toast } = useHearth();
  return (
    <Modal title="Add to our week" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            s.plan.approved &&
            !confirm(
              "This plan is approved. Add the meal and update groceries?",
            )
          )
            return;
          try {
            await act("/plan/add", {
              week,
              version: s.plan.version,
              confirm: true,
              meal: {
                recipeId: recipe.id,
                day: Number(f.get("day")),
                type: f.get("type"),
                servings: Number(f.get("servings")),
              },
            });
            toast("Meal added. Your other selections are unchanged.");
            onClose();
          } catch {}
        }}
      >
        <h3>{recipe.title}</h3>
        <Field label="Day">
          <select name="day">
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
            defaultValue={
              recipe.category === "Breakfast"
                ? "Breakfast"
                : recipe.category === "Lunch"
                  ? "Lunch"
                  : "Dinner"
            }
          >
            {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Batch portions · include reserved leftovers">
          <input
            name="servings"
            type="number"
            min={1}
            max={30}
            defaultValue={servings}
          />
        </Field>
        <button className="primary full">Add meal</button>
      </form>
    </Modal>
  );
}
export function MealPlanner() {
  const { s, week, setWeek, act, navigate, openRecipe, toast } = useHearth();
  const [allSlots, setAllSlots] = useSessionState("plan.allSlots", false);
  const [edit, setEdit] = useState<Meal | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [add, setAdd] = useState<{ day: number; type: string } | null>(null);
  const [swap, setSwap] = useState<Meal | null>(null);
  const shift = (n: number) => {
    const d = new Date(week + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n * 7);
    setWeek(d.toISOString().slice(0, 10));
  };
  const update = async (m: Meal, patch: any) => {
    const confirmed =
      s.plan.approved || m.locked
        ? confirm(
            "Revise this approved or locked meal and recalculate the grocery list?",
          )
        : false;
    if ((s.plan.approved || m.locked) && !confirmed) return false;
    await act("/plan/update", {
      week,
      version: s.plan.version,
      mealId: m.id,
      confirm: confirmed,
      patch,
    });
    return true;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A WEEK AROUND THE TABLE</p>
          <h1>Less “what’s for dinner?”</h1>
          <p>
            {s.plan.meals.filter((m) => m.status === "cooked").length} cooked ·{" "}
            {s.plan.meals.length} planned · Version {s.plan.version} ·{" "}
            {s.plan.approved ? "Approved" : "Draft, yours to arrange"}
          </p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </button>
          <button
            className="primary"
            onClick={() => setAdd({ day: 0, type: "Dinner" })}
          >
            <Plus size={16} />
            Add meal
          </button>
        </div>
      </div>
      <div className="planner-toolbar">
        <div className="week-switch">
          <button
            className="icon-button"
            aria-label="Previous week"
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <strong>
            Week of{" "}
            {new Date(week + "T12:00:00Z").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </strong>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() => shift(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="button-row">
          <button
            className="text-button"
            onClick={() =>
              void act("/plan/history?week=" + week)
                .then(setHistory)
                .catch(() => {})
            }
          >
            <History size={15} />
            History
          </button>
          <button
            className="text-button"
            onClick={() => {
              const from = new Date(week + "T12:00:00Z");
              from.setUTCDate(from.getUTCDate() - 7);
              void act("/plan/duplicate", {
                from: from.toISOString().slice(0, 10),
                to: week,
                version: s.plan.version,
              }).catch(() => {});
            }}
          >
            Copy previous week
          </button>
          <button
            className="primary"
            disabled={!s.plan.meals.length || s.plan.approved}
            onClick={() =>
              void act("/plan/approve", { week, version: s.plan.version })
                .then(() => toast("Week approved. Your grocery list is ready."))
                .catch(() => {})
            }
          >
            {s.plan.approved ? (
              <Check size={16} />
            ) : (
              <ShoppingBasket size={16} />
            )}{" "}
            {s.plan.approved
              ? "Approved · groceries ready"
              : "Approve & make grocery list"}
          </button>
        </div>
      </div>
      {s.plan.approved && (
        <div className="notice subtle">
          This week is approved. Changes require your confirmation and
          automatically recalculate its grocery list.
        </div>
      )}
      <label className="calendar-view-toggle">
        <input
          type="checkbox"
          checked={allSlots}
          onChange={(e) => setAllSlots(e.target.checked)}
        />
        <span>Show empty breakfast, lunch & snack slots</span>
        <small>Planned meals are always visible.</small>
      </label>
      <div className={"calendar-grid " + (!allSlots ? "calendar-compact" : "")}>
        {days.map((d, i) => {
          const date = new Date(week + "T12:00:00Z");
          date.setUTCDate(date.getUTCDate() + i);
          return (
            <section
              className="calendar-day"
              key={d}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const m = s.plan.meals.find(
                  (m) => m.id === e.dataTransfer.getData("text/plain"),
                );
                if (m) void update(m, { day: i }).catch(() => {});
              }}
            >
              <div className="day-heading">
                <span>{d.slice(0, 3)}</span>
                <strong
                  className={
                    date.toISOString().slice(0, 10) === today() ? "today" : ""
                  }
                >
                  {date.getUTCDate()}
                </strong>
              </div>
              {["Breakfast", "Lunch", "Dinner", "Snack"]
                .filter(
                  (type) =>
                    allSlots ||
                    type === "Dinner" ||
                    s.plan.meals.some((m) => m.day === i && m.type === type),
                )
                .map((type) => (
                  <div className="meal-slot" key={type}>
                    <p>{type}</p>
                    {!s.plan.meals.some(
                      (m) => m.day === i && m.type === type,
                    ) && (
                      <button
                        className="add-meal-slot"
                        aria-label={`Add ${type.toLowerCase()} on ${d}`}
                        onClick={() => setAdd({ day: i, type })}
                      >
                        <Plus size={13} />
                        <span>Add {type.toLowerCase()}</span>
                      </button>
                    )}
                    {s.plan.meals
                      .filter((m) => m.day === i && m.type === type)
                      .map((m) => {
                        const r = s.recipes.find((r) => r.id === m.recipeId)!;
                        return (
                          <article
                            className={"planned-meal " + m.status}
                            key={m.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", m.id)
                            }
                          >
                            <button
                              className="image-button"
                              aria-label={`Read recipe ${r.title}`}
                              onClick={() => openRecipe(r)}
                            >
                              <img src={art(r)} alt={r.title} />
                            </button>
                            <button
                              className="title-button"
                              onClick={() => setEdit(m)}
                            >
                              <strong>{r.title}</strong>
                            </button>
                            <small>
                              {m.leftoverOf ? "Leftovers · " : ""}
                              {m.servings} portions{" "}
                              {m.locked && <Lock size={11} />}
                            </small>
                            <div className="meal-actions">
                              <button
                                aria-label={`Mark ${r.title} ${m.status === "cooked" ? "planned" : "cooked"}`}
                                className={m.status === "cooked" ? "done" : ""}
                                onClick={() =>
                                  void update(m, {
                                    status:
                                      m.status === "cooked"
                                        ? "planned"
                                        : "cooked",
                                  }).catch(() => {})
                                }
                              >
                                <Check size={14} />
                                {m.status === "cooked" ? "Cooked" : "Cooked?"}
                              </button>
                              <button
                                aria-label={`Edit ${r.title}`}
                                onClick={() => setEdit(m)}
                              >
                                <Pencil size={13} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                ))}
            </section>
          );
        })}
      </div>
      {!s.plan.meals.length && (
        <Empty title="An open week, full of possibilities.">
          <button className="text-button" onClick={() => navigate("Recipes")}>
            Find a few recipes to start
            <ArrowRight size={15} />
          </button>
        </Empty>
      )}
      {edit && (
        <Modal
          title="Make this meal work for you"
          onClose={() => setEdit(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const saved = await update(edit, {
                  day: Number(f.get("day")),
                  type: f.get("type"),
                  ...(Number(f.get("servings")) !== edit.servings
                    ? { servings: Number(f.get("servings")) }
                    : {}),
                  ...(f.get("recipeId") !== edit.recipeId
                    ? { recipeId: f.get("recipeId") }
                    : {}),
                  locked: f.get("locked") === "on",
                  status: f.get("status"),
                });
                if (saved) setEdit(null);
              } catch {}
            }}
          >
            <Field label="Recipe">
              <select name="recipeId" defaultValue={edit.recipeId}>
                {s.recipes
                  .filter((r) => !r.rejected)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Day">
                <select name="day" defaultValue={edit.day}>
                  {days.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Meal">
                <select name="type" defaultValue={edit.type}>
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Batch portions">
                <input
                  name="servings"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={edit.servings}
                />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={edit.status}>
                  {["planned", "cooked", "skipped"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="checkbox-label">
              <input
                name="locked"
                type="checkbox"
                defaultChecked={edit.locked}
              />
              Lock this meal
            </label>
            <button className="primary full">Save this meal</button>
          </form>
          <div className="button-row">
            <button
              className="text-button"
              onClick={() => {
                setSwap(edit);
                setEdit(null);
              }}
            >
              Reserve leftovers
            </button>
            <button
              className="text-button danger"
              onClick={() => {
                if (confirm("Remove this meal? Other meals stay in place."))
                  void act("/plan/remove", {
                    week,
                    version: s.plan.version,
                    mealId: edit.id,
                    confirm: true,
                  })
                    .then(() => setEdit(null))
                    .catch(() => {});
              }}
            >
              Remove meal
            </button>
          </div>
        </Modal>
      )}
      {swap && (
        <Modal title="Reserve a leftover meal" onClose={() => setSwap(null)}>
          <p>
            The original cooking batch must have enough portions for this meal
            and its leftovers. Increase the original batch first if necessary.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                s.plan.approved &&
                !confirm("Add leftovers to this approved plan?")
              )
                return;
              try {
                await act("/plan/add", {
                  week,
                  version: s.plan.version,
                  confirm: true,
                  meal: {
                    recipeId: swap.recipeId,
                    leftoverOf: swap.id,
                    day: Number(f.get("day")),
                    type: "Lunch",
                    servings: Number(f.get("servings")),
                  },
                });
                setSwap(null);
              } catch {}
            }}
          >
            <Field label="Day">
              <select name="day" defaultValue={(swap.day + 1) % 7}>
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reserved portions">
              <input
                name="servings"
                type="number"
                min={1}
                max={29}
                defaultValue={s.settings.adults}
              />
            </Field>
            <button className="primary full">Reserve leftovers</button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal title="The story of this week" onClose={() => setHistory(null)}>
          {!history.length ? (
            <p>No previous versions yet.</p>
          ) : (
            history.map((v) => (
              <div className="history-entry" key={v.version}>
                <strong>
                  Version {v.version} · {v.data.approved ? "Approved" : "Draft"}
                </strong>
                <p>
                  {v.data.meals.length} meals ·{" "}
                  {new Date(v.created_at).toLocaleString()}
                </p>
                <ul>
                  {v.data.meals.map((m: Meal) => (
                    <li key={m.id}>
                      {days[m.day]}:{" "}
                      {s.recipes.find((r) => r.id === m.recipeId)?.title} ·{" "}
                      {m.servings} portions
                    </li>
                  ))}
                </ul>
                <button
                  className="secondary"
                  onClick={() => {
                    if (
                      confirm(
                        `Restore version ${v.version}? The current version will be preserved in history.`,
                      )
                    )
                      void act("/plan/restore", {
                        week,
                        version: s.plan.version,
                        restoreVersion: v.version,
                        confirm: true,
                      })
                        .then(() => setHistory(null))
                        .catch(() => {});
                  }}
                >
                  Restore this version
                </button>
              </div>
            ))
          )}
        </Modal>
      )}
      {add && (
        <MealPicker
          day={add.day}
          mealType={add.type}
          onClose={() => setAdd(null)}
        />
      )}
    </>
  );
}
