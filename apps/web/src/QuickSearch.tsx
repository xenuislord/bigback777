import { useState } from "react";
import { Search, ArrowUpRight, Clock } from "lucide-react";
import { Modal } from "./App.tsx";
import { useHearth, type Page } from "./context.tsx";
const destinations: [Page, string][] = [
  ["Recipes", "Find dinner, favorites, or a quick meal"],
  ["Meal planner", "Arrange and approve your week"],
  ["Groceries", "Shop the shared household list"],
  ["Pantry", "See what is already at home"],
  ["Spending", "Log takeout or review the budget"],
  ["Goals & rewards", "Celebrate household progress"],
  ["Assistant", "Ask for a little help"],
  ["Settings", "Change household preferences"],
];
export function QuickSearch({ onClose }: { onClose: () => void }) {
  const { s, navigate, openRecipe } = useHearth();
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const recipes = terms.length
    ? s.recipes
        .filter(
          (r) =>
            !r.rejected &&
            terms.every((t) =>
              [r.title, ...r.tags, ...r.ingredients.map((i) => i.name)]
                .join(" ")
                .toLowerCase()
                .includes(t),
            ),
        )
        .slice(0, 8)
    : [];
  const sections = destinations.filter(
    ([name, description]) =>
      !terms.length ||
      terms.every((t) => (name + " " + description).toLowerCase().includes(t)),
  );
  const actions = [
    ...sections.map(([page, description]) => ({
      id: page,
      title: page,
      detail: description,
      run: () => navigate(page),
    })),
    ...recipes.map((r) => ({
      id: r.id,
      title: r.title,
      detail: `${r.minutes} min · ${r.category}`,
      run: () => openRecipe(r),
    })),
  ];
  const [index, setIndex] = useState(0);
  return (
    <Modal title="Find your way around the kitchen" onClose={onClose}>
      <div className="quick-search-input">
        <Search size={20} />
        <input
          autoFocus
          aria-label="Search HEARTH"
          placeholder="A recipe, ingredient, or page…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((n) => Math.min(n + 1, actions.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((n) => Math.max(0, n - 1));
            }
            if (e.key === "Enter" && actions[index]) {
              e.preventDefault();
              actions[index].run();
              onClose();
            }
          }}
        />
      </div>
      <p className="fine">
        Search your recipes or jump to a page. ↑ ↓ to choose · Enter to open ·
        Esc to close
      </p>
      <div className="quick-results">
        {actions.map((a, i) => (
          <button
            key={a.id}
            className={i === index ? "highlighted" : ""}
            onMouseEnter={() => setIndex(i)}
            onClick={() => {
              a.run();
              onClose();
            }}
          >
            <span>
              <strong>{a.title}</strong>
              <small>{a.detail}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {!actions.length && (
          <p className="search-empty">
            No matches yet. Try an ingredient or a page like “pantry”.
          </p>
        )}
      </div>
    </Modal>
  );
}
