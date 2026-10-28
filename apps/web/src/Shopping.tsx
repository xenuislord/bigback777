import { useState } from "react";
import {
  Plus,
  Check,
  ShoppingBasket,
  ArrowRight,
  Search,
  RefreshCw,
  MapPin,
  ExternalLink,
  Trash2,
  Pencil,
  Package,
  Upload,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { useHearth, SectionTitle, Field, Empty, cents } from "./context.tsx";
import { Modal } from "./App.tsx";
import { RegularItems } from "./RegularItems.tsx";
import { Leftovers } from "./Leftovers.tsx";
import { UseSoonSummary, PantryMeals } from "./FoodAtHome.tsx";
import { useSoon } from "../../../packages/grocery/src/pantry.ts";
import { Checkout } from "./Checkout.tsx";
import { useSessionState } from "./preferences.ts";
import {
  money,
  today,
  type PantryItem,
  type GroceryItem,
} from "../../../packages/shared/src/index.ts";
import { displayQuantity, base } from "../../../packages/grocery/src/index.ts";
import {
  compareBasket,
  retailerLinks,
} from "../../../packages/deals/src/index.ts";
const units = [
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
];
export function Groceries() {
  const { s, week, act, editGrocery, queue, resolveEdit, toast, navigate } =
    useHearth();
  const [tab, setTab] = useState("Shopping list");
  const [hide, setHide] = useSessionState("shopping.hide", false);
  const [query, setQuery] = useSessionState("shopping.query", "");
  const [shopping, setShopping] = useSessionState("shopping.focus", false);
  const [group, setGroup] = useSessionState("shopping.group", "Department");
  const [manual, setManual] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const items = s.groceries
    .filter(
      (i) =>
        (!hide || !i.purchased) &&
        [i.name, i.store, i.note]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(a.purchased) - Number(b.purchased) ||
        a.name.localeCompare(b.name),
    );
  const unrecorded = s.groceries.filter((i) => i.purchased && !i.recorded);
  const groups = [
    ...new Set(
      items.map((i) =>
        group === "Store" ? i.store || "Choose a store" : i.department,
      ),
    ),
  ].sort();
  const purchased = s.groceries.filter((i) => i.purchased);
  const estimates = s.groceries
    .filter((i) => !i.purchased)
    .reduce((sum, i) => sum + i.estimateCents, 0);
  const actual = purchased.reduce((sum, i) => sum + (i.actualCents || 0), 0);
  return (
    <div className={shopping ? "shopping-focus" : ""}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE LIST. EVERYONE IN SYNC.</p>
          <h1>A better kind of grocery run.</h1>
          <p>Your week, translated into a shared shopping list.</p>
        </div>
        {tab !== "Regular items" && (
          <button className="primary" onClick={() => setManual(true)}>
            <Plus size={17} />
            Add an item
          </button>
        )}
      </div>
      <div className="tabs">
        {["Shopping list", "Grocery intelligence", "Regular items"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Grocery intelligence" ? (
        <DealsPanel />
      ) : tab === "Regular items" ? (
        <RegularItems onApplied={() => setTab("Shopping list")} />
      ) : (
        <>
          <div className="shopping-summary">
            <div>
              <strong>{s.groceries.filter((i) => !i.purchased).length}</strong>
              <span>left to find</span>
            </div>
            <div>
              <strong>{money(estimates)}</strong>
              <span>remaining ingredient estimate</span>
              {s.groceries.some((i) => !i.purchased && !i.estimateCents) && (
                <small>
                  Partial ·{" "}
                  {
                    s.groceries.filter((i) => !i.purchased && !i.estimateCents)
                      .length
                  }{" "}
                  {s.groceries.filter((i) => !i.purchased && !i.estimateCents)
                    .length === 1
                    ? "item needs"
                    : "items need"}{" "}
                  a price
                </small>
              )}
            </div>
            <div>
              <strong>{money(actual)}</strong>
              <span>checked items · entered prices</span>
            </div>
            <div className="shopping-progress">
              <span>
                {purchased.length} of {s.groceries.length} checked
              </span>
              <progress
                max={s.groceries.length || 1}
                value={purchased.length}
              />
            </div>
          </div>
          {queue.length > 0 && (
            <div className="notice">
              <WifiOff size={16} />
              {queue.length} shopping edit(s) waiting to synchronize. Keep this
              device’s cache until all edits are saved.
            </div>
          )}
          {queue
            .filter((q) => q.conflict)
            .map((q) => (
              <div className="conflict" key={q.operationId}>
                <strong>Review an edit to {q.label}</strong>
                <p>{q.conflict}</p>
                <pre>Your pending edit: {JSON.stringify(q.patch)}</pre>
                <div className="button-row">
                  <button
                    className="secondary"
                    onClick={() =>
                      void resolveEdit(q.operationId, true).catch((e: any) =>
                        toast(e.message),
                      )
                    }
                  >
                    Apply my edit to latest version
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (confirm("Discard only this pending edit?"))
                        void resolveEdit(q.operationId, false);
                    }}
                  >
                    Discard my edit
                  </button>
                </div>
              </div>
            ))}
          <div className="shopping-search-row">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search shopping list"
                value={query}
                placeholder="Find an item, store, or note…"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear
                </button>
              )}
            </div>
            <button
              className={"secondary " + (shopping ? "active" : "")}
              aria-pressed={shopping}
              onClick={() => {
                setShopping((v) => !v);
                if (!shopping) setHide(true);
              }}
            >
              <ShoppingBasket size={16} />
              {shopping ? "Exit shopping mode" : "Shopping mode"}
            </button>
          </div>
          <div className="shopping-toolbar">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hide}
                onChange={(e) => setHide(e.target.checked)}
              />
              Only items left to buy
            </label>
            <div className="button-row">
              <label className="filter">
                Group
                <select
                  aria-label="Group groceries"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option>Department</option>
                  <option>Store</option>
                </select>
              </label>
              <button
                className="text-button"
                onClick={() =>
                  void act("/groceries/generate", { week })
                    .then(() =>
                      toast(
                        "List recalculated from approved meals and recorded pantry stock.",
                      ),
                    )
                    .catch(() => {})
                }
              >
                <RefreshCw size={15} />
                Recalculate
              </button>
              <button
                className="secondary"
                onClick={() => setTab("Grocery intelligence")}
              >
                <Search size={15} />
                Find my best grocery deals
              </button>
            </div>
          </div>
          {!s.groceries.length ? (
            <Empty title="A list with a little thought behind it.">
              Approve a meal plan to combine ingredients, scale portions, and
              subtract usable pantry stock.
              <br />
              <button
                className="text-button"
                onClick={() => navigate("Meal planner")}
              >
                Plan our meals
                <ArrowRight size={15} />
              </button>
            </Empty>
          ) : (
            <div className="shopping-layout">
              <div>
                {!items.length && (
                  <div className="shopping-complete">
                    <Check size={28} />
                    <h3>
                      {query
                        ? "No matching items"
                        : s.groceries.every((i) => i.purchased)
                          ? "That’s everything on the list."
                          : "Nothing left in this view."}
                    </h3>
                    <p>
                      {query
                        ? "Try a different ingredient or clear your search."
                        : unrecorded.length
                          ? "Finish your run by reviewing the actual prices."
                          : "Your shared list is up to date."}
                    </p>
                    {query ? (
                      <button
                        className="text-button"
                        onClick={() => setQuery("")}
                      >
                        Clear search
                      </button>
                    ) : unrecorded.length > 0 ? (
                      <button
                        className="primary"
                        onClick={() => setCheckout(true)}
                      >
                        Review purchase
                      </button>
                    ) : null}
                  </div>
                )}
                {groups.map((g) => (
                  <section className="grocery-group" key={g}>
                    <h3>
                      {g}
                      <span>
                        {
                          items.filter(
                            (i) =>
                              (group === "Store"
                                ? i.store || "Choose a store"
                                : i.department) === g,
                          ).length
                        }{" "}
                        items
                      </span>
                    </h3>
                    {items
                      .filter(
                        (i) =>
                          (group === "Store"
                            ? i.store || "Choose a store"
                            : i.department) === g,
                      )
                      .map((i) => (
                        <GroceryRow key={i.id} item={i} />
                      ))}
                  </section>
                ))}
              </div>
              <aside className="shopping-aside">
                <span className="eyebrow">BEFORE YOU HEAD OUT</span>
                <h3>A few good things to know.</h3>
                <p>
                  Quantities are scaled for your approved cooking batches.
                  Linked leftovers don’t buy the ingredients twice.
                </p>
                <p>
                  Usable pantry stock is deducted. Different meat cuts and
                  incompatible units stay separate.
                </p>
                <p>
                  Ingredient costs are estimates. Enter the full amount paid for
                  each checked item to record a real purchase.
                </p>
                <button
                  className="primary full"
                  disabled={!unrecorded.length || queue.length > 0}
                  onClick={() => setCheckout(true)}
                >
                  Record purchased items
                  <ArrowRight size={15} />
                </button>
                <p className="fine">
                  Checkout records one grocery expense. It does not assume the
                  groceries are now in your pantry; add the actual stock you
                  brought home.
                </p>
              </aside>
            </div>
          )}
          {s.groceries.length > 0 && (
            <div className="shopping-dock">
              <div>
                <strong>
                  {s.groceries.filter((i) => !i.purchased).length} left
                </strong>
                <span>
                  {purchased.length} checked · {money(actual)} entered
                </span>
              </div>
              <button
                className="primary"
                disabled={!unrecorded.length || queue.length > 0}
                onClick={() => setCheckout(true)}
              >
                Finish shopping
                {unrecorded.length > 0 ? ` (${unrecorded.length})` : ""}
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
      {manual && (
        <Modal
          title="Something else for the list"
          onClose={() => setManual(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await act("/groceries/manual", {
                  week,
                  name: f.get("name"),
                  quantity: Number(f.get("quantity")),
                  unit: f.get("unit"),
                  department: f.get("department"),
                });
                setManual(false);
              } catch {}
            }}
          >
            <Field label="Ingredient or household item">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={query.trim()}
                autoFocus
              />
            </Field>
            <div className="form-grid">
              <Field label="Quantity">
                <input
                  name="quantity"
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  defaultValue={1}
                />
              </Field>
              <Field label="Unit">
                <select name="unit" defaultValue="each">
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Department">
              <select name="department">
                {[
                  "Produce",
                  "Dairy & eggs",
                  "Meat & seafood",
                  "Bakery",
                  "Pantry",
                  "Frozen",
                  "Drinks",
                  "Household staples",
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <button className="primary full">Add to our list</button>
          </form>
        </Modal>
      )}
      {checkout && <Checkout onClose={() => setCheckout(false)} />}
    </div>
  );
}
function GroceryRow({ item: i }: { item: GroceryItem }) {
  const { s, editGrocery, toast } = useHearth();
  const [expand, setExpand] = useState(false);
  return (
    <article className={"grocery-row " + (i.purchased ? "purchased" : "")}>
      <div className="grocery-main">
        <button
          className="grocery-check"
          role="checkbox"
          aria-checked={i.purchased}
          aria-label={`Purchased ${i.name}`}
          onClick={() => {
            void editGrocery(i.id, { purchased: !i.purchased });
            toast(`${i.purchased ? "Added back" : "Checked off"} ${i.name}.`, {
              label: "Undo",
              onClick: () => void editGrocery(i.id, { purchased: i.purchased }),
            });
          }}
        >
          {i.purchased && <Check size={20} />}
        </button>
        <button className="grocery-name" onClick={() => setExpand((v) => !v)}>
          <strong>{i.name}</strong>
          <span>
            {displayQuantity(i.quantity, i.unit)} {i.store && <>· {i.store}</>}
            {i.recorded && " · Recorded"}
          </span>
        </button>
        <span className="grocery-estimate">
          {i.estimateCents ? `≈ ${money(i.estimateCents)}` : "No estimate"}
        </span>
        <button
          className="icon-button"
          aria-label={`Edit ${i.name}`}
          onClick={() => setExpand((v) => !v)}
        >
          <Pencil size={15} />
        </button>
      </div>
      {expand && (
        <div className="grocery-details">
          <div className="form-grid">
            <Field label="Actual amount paid ($) · total for this item">
              <input
                aria-label={`Actual price for ${i.name}`}
                disabled={i.recorded}
                inputMode="decimal"
                placeholder="Not entered"
                defaultValue={
                  i.actualCents === null ? "" : (i.actualCents / 100).toFixed(2)
                }
                onBlur={(e) => {
                  try {
                    const n =
                      e.target.value === "" ? null : cents(e.target.value);
                    if (n !== i.actualCents)
                      void editGrocery(i.id, { actualCents: n });
                  } catch (e: any) {
                    toast(e.message);
                  }
                }}
              />
            </Field>
            <Field label="Store">
              <input
                aria-label={`Store for ${i.name}`}
                defaultValue={i.store}
                placeholder="Assign a store"
                onBlur={(e) => {
                  if (e.target.value !== i.store)
                    void editGrocery(i.id, { store: e.target.value });
                }}
              />
            </Field>
            <Field label="Quantity needed">
              <input
                aria-label={`Quantity for ${i.name}`}
                type="number"
                min="0.001"
                step="any"
                defaultValue={i.quantity}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0 && n !== i.quantity)
                    void editGrocery(i.id, { quantity: n });
                }}
              />
            </Field>
            <Field label="Household shopper">
              <select
                aria-label={`Shopper for ${i.name}`}
                value={i.memberId}
                onChange={(e) =>
                  void editGrocery(i.id, { memberId: e.target.value })
                }
              >
                <option value="">Anyone</option>
                {s.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Substitution or shopping note">
            <input
              aria-label={`Note for ${i.name}`}
              defaultValue={i.note}
              maxLength={500}
              placeholder="Unavailable? Record a substitute to review."
              onBlur={(e) => {
                if (e.target.value !== i.note)
                  void editGrocery(i.id, { note: e.target.value });
              }}
            />
          </Field>
          <p className="fine">
            From:{" "}
            {i.sources
              .map((x) =>
                /^[0-9a-f-]{36}:/.test(x) ? x.slice(x.indexOf(":") + 1) : x,
              )
              .join(" · ")}
            . Recipe-generated quantities may change on recalculation.
            Substitutions are notes until explicitly edited in the recipe.
          </p>
        </div>
      )}
    </article>
  );
}
export function Pantry() {
  const { s, act, toast, navigate } = useHearth();
  const [view, setView] = useSessionState("pantry.view", "Ingredients");
  const [expiry, setExpiry] = useSessionState("pantry.expiry", "All dates");
  const [editing, setEditing] = useState<PantryItem | null | undefined>(
    undefined,
  );
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All");
  const rows = s.pantry.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (location === "All" || p.location === location) &&
      (expiry === "All dates" ||
        (expiry === "Use soon"
          ? useSoon([p]).length > 0
          : !!p.expires && p.expires < today())),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOOD THINGS, ALREADY AT HOME</p>
          <h1>A little less waste. A little more dinner.</h1>
          <p>
            Keep an honest inventory. Your grocery list only subtracts what’s
            recorded and usable.
          </p>
        </div>
        {view !== "Leftovers" && (
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Add pantry stock
          </button>
        )}
      </div>
      <div className="tabs">
        {["Ingredients", "Leftovers", "Cook from pantry"].map((tab) => (
          <button
            key={tab}
            className={view === tab ? "active" : ""}
            onClick={() => setView(tab)}
          >
            {tab}
            {tab === "Leftovers" &&
              ` (${(s.leftovers || []).filter((b) => b.remaining > 0).length})`}
          </button>
        ))}
      </div>
      {view === "Ingredients" ? (
        <>
          <UseSoonSummary
            onCook={() => setView("Cook from pantry")}
            onExpired={() => {
              setExpiry("Past reminder");
              setLocation("All");
              setQuery("");
            }}
          />
          <div className="pantry-location-tabs">
            {[
              "All",
              "Refrigerator",
              "Freezer",
              "Pantry",
              "Household staples",
            ].map((l) => (
              <button
                className={"chip " + (location === l ? "active" : "")}
                key={l}
                onClick={() => setLocation(l)}
              >
                {l}
                <span>
                  {l === "All"
                    ? s.pantry.length
                    : s.pantry.filter((p) => p.location === l).length}
                </span>
              </button>
            ))}
          </div>
          <label className="filter pantry-date-filter">
            Date view
            <select
              aria-label="Pantry date filter"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            >
              <option>All dates</option>
              <option>Use soon</option>
              <option>Past reminder</option>
            </select>
          </label>
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search pantry"
              placeholder="Find something in our kitchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {!rows.length ? (
            <Empty title="Start with what’s in the kitchen.">
              Add a few staples, check their quantities, and let your next
              grocery list do the math.
            </Empty>
          ) : (
            <div className="inventory-list">
              <div className="inventory-header">
                <span>Ingredient</span>
                <span>Quantity</span>
                <span>Best by</span>
                <span>Location</span>
                <span />
              </div>
              {rows.map((p) => (
                <div className="inventory-row" key={p.id}>
                  <strong>{p.name}</strong>
                  <span>{displayQuantity(p.quantity, p.unit)}</span>
                  <span
                    className={p.expires && p.expires < today() ? "error" : ""}
                  >
                    {p.expires || "Not recorded"}
                    {p.expires && p.expires < today() ? " · expired" : ""}
                  </span>
                  <span>{p.location}</span>
                  <div className="button-row">
                    <button
                      className="icon-button"
                      aria-label={`Edit stock ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove stock ${p.name}`}
                      onClick={() => {
                        if (
                          confirm(`Remove ${p.name} from recorded inventory?`)
                        )
                          void act(
                            `/pantry/${p.id}`,
                            { confirm: true },
                            "DELETE",
                          ).catch(() => {});
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="home-bottom">
            <div>
              <span className="eyebrow">WASTE LESS, MAKE SOMETHING GOOD</span>
              <h3>Cook with what we already have.</h3>
              <p>
                Ask Hearth Assistant to suggest recipes that share ingredients
                with your pantry.
              </p>
            </div>
            <button className="secondary" onClick={() => navigate("Assistant")}>
              Open assistant
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      ) : view === "Leftovers" ? (
        <Leftovers />
      ) : (
        <PantryMeals />
      )}
      {editing !== undefined && (
        <Modal
          title={
            editing ? "Update our inventory" : "Add something to the pantry"
          }
          onClose={() => setEditing(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const data = {
                  name: f.get("name"),
                  quantity: Number(f.get("quantity")),
                  unit: f.get("unit"),
                  location: f.get("location"),
                  expires: f.get("expires"),
                  purchaseDate: f.get("purchaseDate"),
                  unitCostCents: cents(f.get("cost")),
                  packageSize: Number(f.get("packageSize")),
                };
                await act(
                  editing ? `/pantry/${editing.id}` : "/pantry",
                  editing ? { version: editing.version, item: data } : data,
                  editing ? "PATCH" : "POST",
                );
                setEditing(undefined);
                toast("Inventory updated. Recalculate groceries to apply it.");
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            <Field label="Ingredient name · use the recipe’s exact name">
              <input name="name" required defaultValue={editing?.name} />
            </Field>
            <div className="form-grid">
              <Field label="Quantity">
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  step="any"
                  required
                  defaultValue={editing?.quantity || 1}
                />
              </Field>
              <Field label="Unit">
                <select name="unit" defaultValue={editing?.unit || "g"}>
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Storage location">
                <select
                  name="location"
                  defaultValue={editing?.location || "Pantry"}
                >
                  {[
                    "Refrigerator",
                    "Freezer",
                    "Pantry",
                    "Household staples",
                  ].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Best-by or expiration">
                <input
                  type="date"
                  name="expires"
                  defaultValue={editing?.expires}
                />
              </Field>
              <Field label="Purchase date">
                <input
                  type="date"
                  name="purchaseDate"
                  defaultValue={editing?.purchaseDate || today()}
                />
              </Field>
              <Field label="Unit cost ($, optional)">
                <input
                  name="cost"
                  inputMode="decimal"
                  defaultValue={(editing?.unitCostCents || 0) / 100}
                />
              </Field>
              <Field label="Units in package">
                <input
                  name="packageSize"
                  type="number"
                  min="0.001"
                  step="any"
                  defaultValue={editing?.packageSize || 1}
                />
              </Field>
            </div>
            <button className="primary full">Save inventory</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function DealsPanel() {
  const { s, week, act, toast, editGrocery } = useHearth();
  const [add, setAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importData, setImportData] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const comparison = compareBasket(s.groceries, s.offers, s.settings);
  const current = s.offers.filter((o) => o.expires >= today());
  return (
    <>
      <div className="deals-heading">
        <div>
          <span className="eyebrow">
            <MapPin size={13} />
            {s.settings.city} · {s.settings.zip} · {s.settings.radius} mile
            preference
          </span>
          <h2>Good deals start with good information.</h2>
          <p>
            Compare recorded, comparable prices. No invented offers. No assumed
            memberships.
          </p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => setAdd(true)}>
            <Plus size={16} />
            Record a price
          </button>
          <button className="text-button" onClick={() => setImporting(true)}>
            <Upload size={16} />
            Import observations
          </button>
        </div>
      </div>
      <div className="notice subtle">
        <AlertCircle size={17} />
        No live price feed is connected by default. Manual observations are
        labeled as user-entered and are never presented as verified retailer
        offers. Travel uses your assumptions, not map data.
      </div>
      <div className="button-row scan-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await act("/deals/scan", { week, live: false });
              setResult(r);
              toast(
                "Compared available observations. Missing prices remain unavailable.",
              );
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <Search size={17} />
          {busy ? "Checking recorded prices…" : "Find my best grocery deals"}
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setResult(await act("/deals/scan", { week, live: true }));
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          Check configured Kroger source
        </button>
      </div>
      {result && (
        <p className="fine">
          {result.message} {result.provider?.message}
        </p>
      )}
      <SectionTitle
        title="The practical basket"
        eyebrow="COMPARABLE ITEMS ONLY"
      />
      <p className="fine">{comparison.assumptions}</p>
      {comparison.unpriced.length > 0 && (
        <p className="notice">
          Current eligible prices unavailable for:{" "}
          {comparison.unpriced.join(", ")}.
        </p>
      )}
      {comparison.baskets.length ? (
        <div className="basket-grid">
          {comparison.baskets.slice(0, 3).map((b, i) => (
            <article className="basket-card" key={b.stores.join("|")}>
              <span className="eyebrow">
                {i === 0 ? "LOWEST RECORDED TOTAL" : "ANOTHER OPTION"}
              </span>
              <h3>{b.stores.join(" + ")}</h3>
              <strong className="basket-total">{money(b.totalCents)}</strong>
              <p>
                {b.missing
                  ? "Partial basket · " + b.missing + " items unpriced"
                  : "All unchecked list items covered"}
              </p>
              <p>
                Groceries {money(b.basketCents)} + assumed extra travel{" "}
                {money(b.travelCents)}
              </p>
              <ul>
                {b.choices
                  .filter((c) => c.choice)
                  .map((c) => (
                    <li key={c.item.id}>
                      {c.item.name}: {c.choice!.packages} package(s) ·{" "}
                      {money(c.choice!.costCents)}
                      <small>{c.choice!.offer.store}</small>
                    </li>
                  ))}
              </ul>
              <button
                className="secondary full"
                onClick={async () => {
                  for (const c of b.choices)
                    if (c.choice)
                      await editGrocery(c.item.id, {
                        store: c.choice.offer.store,
                      });
                  toast("Store assignments queued for synchronization.");
                }}
              >
                Assign these stores
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="A price is only useful when it’s real.">
          Record an observed price, package size, source, and expiry to compare
          it with your list.
        </Empty>
      )}
      <SectionTitle
        title="Your price notebook"
        eyebrow={`${current.length} CURRENT · ${s.offers.length - current.length} HISTORICAL`}
      />
      <div className="offers-list">
        {s.offers.map((o) => {
          const b = base(o.quantity, o.unit);
          return (
            <article className="offer-card" key={o.id}>
              <div>
                <span className="small-pill">
                  {o.expires < today() ? "Historical price" : o.verification}
                </span>
                <h3>{o.product}</h3>
                <p>
                  {o.store} · {displayQuantity(o.quantity, o.unit)} ·{" "}
                  {o.quality}
                </p>
                <p>
                  {o.loyalty ? "Loyalty required. " : ""}
                  {o.membership ? `Membership: ${o.membership}. ` : ""}
                  {o.minPackages > 1
                    ? `Buy at least ${o.minPackages} packages. `
                    : ""}
                  {o.couponCents
                    ? `Coupon ${money(o.couponCents)} per package, eligibility must be confirmed.`
                    : ""}
                </p>
                <p className="fine">
                  Expires {o.expires} · recorded{" "}
                  {new Date(o.retrievedAt).toLocaleString()}
                </p>
                {o.sourceUrl && (
                  <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                    Original source
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <div className="offer-price">
                <strong>{money(o.priceCents)}</strong>
                <small>
                  {money(
                    Math.round(
                      (o.priceCents / b.quantity) *
                        (b.unit === "each" ? 1 : 1000),
                    ),
                  )}{" "}
                  / {b.unit === "g" ? "kg" : b.unit === "ml" ? "L" : "each"}
                </small>
                {o.regularCents !== null && (
                  <small>Regular, user-entered: {money(o.regularCents)}</small>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <SectionTitle title="Go straight to the source" />
      <div className="retailer-grid">
        {retailerLinks.map((r) => (
          <a href={r.url} key={r.name} target="_blank" rel="noreferrer">
            <strong>
              {r.name}
              <ExternalLink size={14} />
            </strong>
            <p>{r.status}</p>
          </a>
        ))}
      </div>
      {add && (
        <Modal
          title="A real price, with the details"
          wide
          onClose={() => setAdd(false)}
        >
          <PriceForm onDone={() => setAdd(false)} />
        </Modal>
      )}
      {importing && (
        <Modal
          title="Import your price observations"
          wide
          onClose={() => setImporting(false)}
        >
          <p>
            Use your own flyer or receipt to enter structured observations.
            Automatic image extraction is not available. Review every price,
            product match, package size, and date before importing.
          </p>
          <p className="fine">
            JSON format:{" "}
            {`[{"ingredient":"milk","store":"My store","product":"Whole milk","quantity":1,"unit":"gal","priceCents":499,"expires":"${today()}","sourceUrl":"https://example.com/ad"}]`}
          </p>
          <input
            aria-label="Price observation JSON file"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 1000000) {
                  toast("Choose a JSON file under 1 MB.");
                  return;
                }
                setImportData(await f.text());
              }
            }}
          />
          <textarea
            className="code-input full"
            rows={12}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            aria-label="Reviewed price observations JSON"
          />
          <button
            className="primary full"
            onClick={async () => {
              try {
                const offers = JSON.parse(importData);
                if (
                  !confirm(
                    "I have reviewed these observations and have permission to import this source. Import as user-entered prices?",
                  )
                )
                  return;
                await act("/deals/import", { offers, confirm: true });
                setImporting(false);
                toast("Observations imported, labeled as user-provided.");
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            Review & import
          </button>
        </Modal>
      )}
    </>
  );
}
function PriceForm({ onDone }: { onDone: () => void }) {
  const { act, toast } = useHearth();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await act("/deals/observations", {
            ingredient: f.get("ingredient"),
            store: f.get("store"),
            product: f.get("product"),
            quantity: Number(f.get("quantity")),
            unit: f.get("unit"),
            priceCents: cents(f.get("price")),
            regularCents: f.get("regular") ? cents(f.get("regular")) : null,
            couponCents: cents(f.get("coupon")),
            minPackages: Number(f.get("minPackages")),
            loyalty: f.get("loyalty") === "on",
            membership: f.get("membership"),
            quality: f.get("quality"),
            expires: f.get("expires"),
            sourceUrl: f.get("sourceUrl"),
            note: f.get("note"),
          });
          toast("Price recorded as a user-entered observation.");
          onDone();
        } catch (e: any) {
          toast(e.message);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Exact ingredient name">
          <input name="ingredient" required placeholder="ground beef" />
        </Field>
        <Field label="Store and location">
          <input name="store" required placeholder="Store · Glendale" />
        </Field>
        <Field label="Product description">
          <input name="product" required />
        </Field>
        <Field label="Package quantity">
          <input
            name="quantity"
            required
            type="number"
            min="0.001"
            step="any"
            defaultValue={1}
          />
        </Field>
        <Field label="Package unit">
          <select name="unit" defaultValue="lb">
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
        <Field label="Package price ($)">
          <input name="price" inputMode="decimal" required />
        </Field>
        <Field label="Regular price ($, if grounded)">
          <input name="regular" inputMode="decimal" />
        </Field>
        <Field label="Eligible coupon / package ($)">
          <input name="coupon" defaultValue="0" inputMode="decimal" />
        </Field>
        <Field label="Minimum packages">
          <input
            name="minPackages"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
          />
        </Field>
        <Field label="Advertised expiry or observation validity">
          <input name="expires" type="date" required defaultValue={today()} />
        </Field>
        <Field label="Quality">
          <select name="quality">
            <option value="standard">Standard</option>
            <option value="organic">
              Organic · excluded from default comparisons
            </option>
            <option value="grass-fed">
              Grass-fed · excluded from default comparisons
            </option>
          </select>
        </Field>
        <Field label="Required membership (optional)">
          <input name="membership" />
        </Field>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" name="loyalty" />
        Loyalty card required for this price
      </label>
      <Field label="Exact source URL (HTTPS, optional for in-store observation)">
        <input type="url" name="sourceUrl" placeholder="https://…" />
      </Field>
      <Field label="Source, coupon eligibility and vendor notes">
        <textarea
          name="note"
          placeholder="Where and when did you observe this price?"
        />
      </Field>
      <button className="primary full">Save observed price</button>
    </form>
  );
}
