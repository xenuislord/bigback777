import { useState } from "react";
import { Plus, RefreshCw, Pencil, Trash2, Repeat2 } from "lucide-react";
import { Modal } from "./App.tsx";
import { useHearth, Field, Empty } from "./context.tsx";
import type { Staple } from "../../../packages/shared/src/index.ts";
import { displayQuantity } from "../../../packages/grocery/src/index.ts";
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
export function RegularItems({ onApplied }: { onApplied: () => void }) {
  const { s, week, act, toast, online } = useHearth();
  const [editing, setEditing] = useState<Staple | null | undefined>();
  const [applying, setApplying] = useState(false);
  const items = s.staples || [];
  return (
    <section className="regular-items">
      <div className="deals-heading">
        <div>
          <p className="eyebrow">THE EVERY-WEEK ESSENTIALS</p>
          <h2>The things we always need.</h2>
          <p>
            Save your usual amounts once. We’ll include them when a week is
            approved, or build a list from them now.
          </p>
        </div>
        <button className="secondary" onClick={() => setEditing(null)}>
          <Plus size={16} />
          Add a regular item
        </button>
      </div>
      <div className="notice subtle">
        <Repeat2 size={17} />
        Regular items are minimum weekly needs. If recipes need 1 L of milk and
        your regular amount is 1 L, we buy 1 L, not 2. Usable pantry stock is
        deducted. Manual extras stay additional.
      </div>
      {!items.length ? (
        <Empty title="Milk, eggs, coffee… the usual.">
          Add the ingredients your household reaches for every week.
        </Empty>
      ) : (
        <div className="regular-list">
          {items.map((item) => (
            <article className="regular-row" key={item.id}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  aria-label={`Include regular ${item.name}`}
                  checked={item.enabled}
                  disabled={!online}
                  onChange={(e) =>
                    void act(
                      `/staples/${item.id}`,
                      {
                        version: item.version,
                        item: { ...item, enabled: e.target.checked },
                      },
                      "PATCH",
                    ).catch(() => {})
                  }
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {displayQuantity(item.quantity, item.unit)} ·{" "}
                    {item.department}
                  </small>
                </span>
              </label>
              <div className="button-row">
                <button
                  className="icon-button"
                  aria-label={`Edit regular ${item.name}`}
                  onClick={() => setEditing(item)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove regular ${item.name}`}
                  onClick={() => {
                    if (
                      confirm(
                        `Remove ${item.name} from regular items? Recalculate your current list to apply the change.`,
                      )
                    )
                      void act(
                        `/staples/${item.id}`,
                        { version: item.version, confirm: true },
                        "DELETE",
                      ).catch(() => {});
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="regular-footer">
        <p className="fine">
          Changes take effect on the next list recalculation. Existing checkoffs
          stay subject to quantity review.
        </p>
        <button
          className="primary"
          disabled={applying || !online || !items.length}
          onClick={async () => {
            setApplying(true);
            try {
              await act("/staples/apply", { week });
              toast("Regular items merged with your list and pantry stock.");
              onApplied();
            } catch {
            } finally {
              setApplying(false);
            }
          }}
        >
          <RefreshCw size={16} />
          {applying ? "Updating…" : "Update this week’s list"}
        </button>
      </div>
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit a regular item" : "Add a household regular"}
          onClose={() => setEditing(undefined)}
        >
          <RegularItemForm
            item={editing}
            onDone={() => setEditing(undefined)}
          />
        </Modal>
      )}
    </section>
  );
}
function RegularItemForm({
  item,
  onDone,
}: {
  item: Staple | null;
  onDone: () => void;
}) {
  const { act, toast } = useHearth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const data = {
            name: f.get("name"),
            quantity: Number(f.get("quantity")),
            unit: f.get("unit"),
            department: f.get("department"),
            enabled: f.get("enabled") === "on",
          };
          await act(
            item ? `/staples/${item.id}` : "/staples",
            item ? { version: item.version, item: data } : data,
            item ? "PATCH" : "POST",
          );
          toast(
            "Regular item saved. It will be included when you next update your list.",
          );
          onDone();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Ingredient or household item">
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={item?.name}
          autoFocus
          placeholder="milk"
        />
      </Field>
      <div className="form-grid">
        <Field label="Usual weekly amount">
          <input
            name="quantity"
            required
            type="number"
            min="0.001"
            max={100000}
            step="any"
            defaultValue={item?.quantity || 1}
          />
        </Field>
        <Field label="Unit">
          <select name="unit" defaultValue={item?.unit || "each"}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Department">
        <select name="department" defaultValue={item?.department || "Pantry"}>
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
      <label className="checkbox-label">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={item?.enabled ?? true}
        />
        Include in new weekly lists
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Saving…" : "Save regular item"}
      </button>
    </form>
  );
}
