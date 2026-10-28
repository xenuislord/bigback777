import { useState } from "react";
import { Plus, Check, Pencil, Archive, RotateCcw, Clock } from "lucide-react";
import { Modal } from "./App.tsx";
import { useHearth, Field, Empty } from "./context.tsx";
import {
  today,
  type LeftoverBatch,
  type Recipe,
} from "../../../packages/shared/src/index.ts";
import { daysUntil } from "../../../packages/grocery/src/pantry.ts";
export function Leftovers() {
  const { s } = useHearth();
  const [editing, setEditing] = useState<LeftoverBatch | null | undefined>();
  const [history, setHistory] = useState(false);
  const rows = (s.leftovers || [])
    .filter((b) => history || b.remaining > 0)
    .sort(
      (a, b) =>
        Number(b.remaining > 0) - Number(a.remaining > 0) ||
        (a.useBy || "9999").localeCompare(b.useBy || "9999") ||
        b.cookedOn.localeCompare(a.cookedOn),
    );
  return (
    <section>
      <div className="deals-heading">
        <div>
          <p className="eyebrow">TOMORROW’S EASY LUNCH</p>
          <h2>A good meal deserves an encore.</h2>
          <p>
            Record the portions you actually saved. Your household shares the
            same remaining count.
          </p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={16} />
          Save leftovers
        </button>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={history}
          onChange={(e) => setHistory(e.target.checked)}
        />
        Include finished batches
      </label>
      {!rows.length ? (
        <Empty title="A little planning for a very easy tomorrow.">
          Save leftover portions after cooking and give them a reminder date.
        </Empty>
      ) : (
        <div className="leftover-grid">
          {rows.map((batch) => (
            <LeftoverCard
              key={batch.id}
              batch={batch}
              onEdit={() => setEditing(batch)}
            />
          ))}
        </div>
      )}
      <p className="fine">
        Dates are your reminders, not a guarantee of food safety. Record actual
        stock only. Using or discarding portions does not create an expense or
        automatically change your meal calendar.
      </p>
      {editing !== undefined && (
        <LeftoverEditor
          batch={editing || undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
    </section>
  );
}
function LeftoverCard({
  batch: b,
  onEdit,
}: {
  batch: LeftoverBatch;
  onEdit: () => void;
}) {
  const { act, toast, online } = useHearth();
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const due = b.useBy ? daysUntil(b.useBy) : null;
  const use = async (kind: "eat" | "discard" | "restore", portions: number) => {
    setBusy(true);
    setError("");
    try {
      const next = await act(`/leftovers/${b.id}/use`, {
        version: b.version,
        kind,
        portions,
        operationId: crypto.randomUUID(),
      });
      toast(
        kind === "eat"
          ? `Used ${portions} portion${portions === 1 ? "" : "s"} of ${b.title}.`
          : kind === "discard"
            ? "Remaining portions recorded as discarded."
            : "Portion restored.",
        kind !== "restore"
          ? {
              label: "Undo",
              onClick: () =>
                void act(`/leftovers/${b.id}/use`, {
                  version: next.version,
                  kind: "restore",
                  portions,
                  operationId: crypto.randomUUID(),
                })
                  .then(() => toast("Portions restored."))
                  .catch(() => {}),
            }
          : undefined,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={"leftover-card " + (b.remaining === 0 ? "finished" : "")}
    >
      <div className="leftover-card-heading">
        <span className="small-pill">{b.storage}</span>
        <button
          className="icon-button"
          aria-label={`Edit leftovers ${b.title}`}
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>
      </div>
      <h3>{b.title}</h3>
      <div className="leftover-amount">
        <strong>{b.remaining}</strong>
        <span>of {b.portions} portions left</span>
      </div>
      <p className={due !== null && due < 0 ? "error" : "fine"}>
        {due === null
          ? "No reminder date set"
          : due < 0
            ? `Past reminder date · ${b.useBy}`
            : due === 0
              ? "Reminder: use today"
              : due === 1
                ? "Reminder: use tomorrow"
                : `Reminder: ${b.useBy}`}
      </p>
      <p className="fine">
        Cooked {b.cookedOn}
        {b.note ? ` · ${b.note}` : ""}
      </p>
      {(b.allergens?.length ?? 0) > 0 && (
        <p className="fine">Recipe allergens: {b.allergens?.join(", ")}</p>
      )}
      {b.remaining > 0 ? (
        <>
          <div className="leftover-controls">
            <select
              aria-label={`Portions to use from ${b.title}`}
              value={Math.min(amount, b.remaining)}
              onChange={(e) => setAmount(Number(e.target.value))}
            >
              {Array.from({ length: b.remaining }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} portion{i ? "s" : ""}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={busy || !online}
              onClick={() => void use("eat", Math.min(amount, b.remaining))}
            >
              <Check size={15} />
              Use portions
            </button>
          </div>
          <button
            className="text-button danger"
            disabled={busy || !online}
            onClick={() => {
              if (
                confirm(
                  `Record ${b.remaining} remaining portions of ${b.title} as discarded?`,
                )
              )
                void use("discard", b.remaining);
            }}
          >
            Discard remaining
          </button>
        </>
      ) : (
        <button
          className="secondary"
          disabled={busy || !online}
          onClick={() => void use("restore", 1)}
        >
          <RotateCcw size={14} />
          Restore a portion
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </article>
  );
}
export function LeftoverEditor({
  batch,
  recipe,
  onClose,
}: {
  batch?: LeftoverBatch;
  recipe?: Recipe;
  onClose: () => void;
}) {
  const { s, act, toast } = useHearth();
  const [recipeId, setRecipeId] = useState(batch?.recipeId || recipe?.id || "");
  const [title, setTitle] = useState(batch?.title || recipe?.title || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <Modal
      title={batch ? "Update saved leftovers" : "Save something good for later"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const item = {
              title,
              recipeId: recipeId || null,
              portions: Number(f.get("portions")),
              storage: f.get("storage"),
              cookedOn: f.get("cookedOn"),
              useBy: f.get("useBy"),
              note: f.get("note"),
            };
            await act(
              batch ? `/leftovers/${batch.id}` : "/leftovers",
              batch
                ? { version: batch.version, item }
                : { ...item, operationId },
              batch ? "PATCH" : "POST",
            );
            toast("Leftover portions saved for the household.");
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="What did you save?">
          <input
            value={title}
            required
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Beef stew"
          />
        </Field>
        <Field label="Recipe (optional)">
          <select
            value={recipeId}
            onChange={(e) => {
              const selected = s.recipes.find((r) => r.id === e.target.value);
              const old = s.recipes.find((r) => r.id === recipeId);
              if (!title || title === old?.title)
                setTitle(selected?.title || "");
              setRecipeId(e.target.value);
            }}
          >
            <option value="">A meal outside the recipe library</option>
            {s.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field
            label={
              batch
                ? "Total original batch portions"
                : "Portions actually saved"
            }
          >
            <input
              name="portions"
              required
              type="number"
              min={1}
              max={100}
              defaultValue={batch?.portions || 1}
            />
          </Field>
          <Field label="Storage">
            <select
              name="storage"
              defaultValue={batch?.storage || "Refrigerator"}
            >
              <option>Refrigerator</option>
              <option>Freezer</option>
            </select>
          </Field>
          <Field label="Cooked on">
            <input
              name="cookedOn"
              type="date"
              required
              defaultValue={batch?.cookedOn || today()}
            />
          </Field>
          <Field label="Use-by reminder (optional)">
            <input name="useBy" type="date" defaultValue={batch?.useBy || ""} />
          </Field>
        </div>
        <Field label="Storage or reheating notes">
          <textarea
            name="note"
            maxLength={1000}
            defaultValue={batch?.note || ""}
          />
        </Field>
        <p className="fine">
          This records actual saved food. It does not add another meal cost or
          assume anything was put away automatically.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "Saving…" : "Save leftover portions"}
        </button>
      </form>
    </Modal>
  );
}
