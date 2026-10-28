import { useState } from "react";
import { Check, ShoppingBasket } from "lucide-react";
import { Modal } from "./App.tsx";
import { useHearth, Field, cents } from "./context.tsx";
import { money, today } from "../../../packages/shared/src/index.ts";
import { displayQuantity } from "../../../packages/grocery/src/index.ts";
export function Checkout({ onClose }: { onClose: () => void }) {
  const { s, week, act, queue, online, toast } = useHearth();
  const items = s.groceries.filter((i) => i.purchased && !i.recorded);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        i.actualCents === null ? "" : (i.actualCents / 100).toFixed(2),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  let total = 0,
    missing = 0;
  for (const item of items) {
    try {
      if (!prices[item.id]?.trim()) {
        missing++;
        continue;
      }
      total += cents(prices[item.id]);
    } catch {
      missing++;
    }
  }
  return (
    <Modal title="Finish your grocery run" onClose={onClose}>
      <p>
        Enter the full amount paid for each checked item, including its share of
        tax and discounts. Nothing is recorded until you confirm.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing || !items.length) return;
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const result = await act("/groceries/checkout", {
              week,
              merchant: f.get("merchant"),
              date: f.get("date"),
              operationId,
              items: items.map((i) => ({
                id: i.id,
                version: i.version,
                actualCents: cents(prices[i.id]),
              })),
            });
            toast(`Grocery run recorded: ${money(result.amountCents)}.`, {
              label: "View spending",
              onClick: () => {
                location.hash = `#/spending?week=${week}`;
              },
            });
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="checkout-items">
          {items.map((i) => (
            <label className="checkout-item" key={i.id}>
              <span>
                <strong>{i.name}</strong>
                <small>
                  {displayQuantity(i.quantity, i.unit)}
                  {i.store ? ` · ${i.store}` : ""}
                </small>
              </span>
              <span className="price-input">
                <span>$</span>
                <input
                  aria-label={`Paid for ${i.name}`}
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={prices[i.id] ?? ""}
                  onChange={(e) =>
                    setPrices((p) => ({ ...p, [i.id]: e.target.value }))
                  }
                />
              </span>
            </label>
          ))}
        </div>
        {!items.length && (
          <p className="notice subtle">
            All checked items have already been recorded.
          </p>
        )}
        <div className="checkout-total">
          <span>Actual purchase total</span>
          <strong>{money(total)}</strong>
        </div>
        <p className="fine">
          {missing
            ? `${missing} item${missing === 1 ? " needs" : "s need"} a valid price.`
            : `${items.length} item${items.length === 1 ? "" : "s"} · one grocery expense · no duplicate purchases.`}
        </p>
        <Field label="Store or stores">
          <input
            name="merchant"
            required
            maxLength={100}
            defaultValue={[
              ...new Set(items.map((i) => i.store).filter(Boolean)),
            ].join(", ")}
            placeholder="Where did you shop?"
          />
        </Field>
        <Field label="Purchase date">
          <input name="date" type="date" required defaultValue={today()} />
        </Field>
        {queue.length > 0 && (
          <p className="notice">
            Saving your shopping edits… checkout will be available when they
            finish.
          </p>
        )}
        {!online && (
          <p className="notice">
            Reconnect to your kitchen to record this purchase.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={
            busy || !!missing || !items.length || queue.length > 0 || !online
          }
        >
          <Check size={17} />
          {busy ? "Recording…" : `Record ${money(total)} purchase`}
        </button>
        <p className="fine">
          Already recorded items are excluded. Add the stock you actually
          brought home to Pantry separately.
        </p>
      </form>
    </Modal>
  );
}
