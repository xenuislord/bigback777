import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Timer,
  Utensils,
  RotateCcw,
} from "lucide-react";
import { Modal } from "./App.tsx";
import { useHearth } from "./context.tsx";
import { useSessionState } from "./preferences.ts";
import { TimerForm, InlineKitchenTimers } from "./KitchenTimers.tsx";
import type { Recipe } from "../../../packages/shared/src/index.ts";
import {
  scaleIngredients,
  displayQuantity,
} from "../../../packages/grocery/src/index.ts";
export function CookingMode({
  recipe: r,
  servings,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}) {
  const { toast } = useHearth();
  const [progress, setProgress] = useSessionState(
    `cooking.${r.id}.${r.version}.${servings}`,
    { step: 0, checked: [] as number[] },
  );
  const [showTimer, setShowTimer] = useState(false);
  const step = Math.min(Math.max(0, progress.step), r.steps.length);
  const finished = step === r.steps.length;
  return (
    <Modal title={`Cooking: ${r.title}`} wide onClose={onClose}>
      <div className="cooking-meta">
        <span>
          <Utensils size={14} />
          {servings} portions
        </span>
        <span>{r.minutes} min preparation · chilling may be separate</span>
        <button
          className="text-button"
          onClick={() => {
            const old = progress;
            setProgress({ step: 0, checked: [] });
            toast("Cooking checklist reset.", {
              label: "Undo",
              onClick: () => setProgress(old),
            });
          }}
        >
          <RotateCcw size={13} />
          Start over
        </button>
      </div>
      <div className="cooking-workspace">
        <aside>
          <h3>Ingredients, ready to go</h3>
          <p className="fine">
            {progress.checked.length} of {r.ingredients.length} gathered
          </p>
          <div className="cooking-ingredients">
            {scaleIngredients(r, servings).map((ingredient, index) => (
              <label
                key={index}
                className={progress.checked.includes(index) ? "checked" : ""}
              >
                <input
                  type="checkbox"
                  checked={progress.checked.includes(index)}
                  onChange={() =>
                    setProgress((p) => ({
                      ...p,
                      checked: p.checked.includes(index)
                        ? p.checked.filter((n) => n !== index)
                        : [...p.checked, index],
                    }))
                  }
                />
                <span>
                  {ingredient.name}
                  <small>
                    {displayQuantity(ingredient.quantity, ingredient.unit)}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p className="fine">
            Allergens: {r.allergens.join(", ") || "Check ingredient labels."}
          </p>
        </aside>
        <section className="cooking-step">
          <InlineKitchenTimers />
          <div className="cooking-step-progress">
            <span>
              {finished ? "FINISHED" : `STEP ${step + 1} OF ${r.steps.length}`}
            </span>
            <progress max={r.steps.length} value={step} />
          </div>
          {finished ? (
            <div className="cooking-finished">
              <Check size={34} />
              <h2>Something good, made by you.</h2>
              <p>{r.storage}</p>
              <p className="fine">
                Your checklist is saved on this device. Mark the planned meal
                cooked separately; this view doesn’t change inventory or
                financial records.
              </p>
              <button className="primary" onClick={onClose}>
                Back to recipe
              </button>
            </div>
          ) : (
            <>
              <h2 className="cooking-instruction" aria-live="polite">
                {r.steps[step]}
              </h2>
              <div className="cooking-step-actions">
                <button
                  className="secondary"
                  disabled={step === 0}
                  onClick={() =>
                    setProgress((p) => ({
                      ...p,
                      step: Math.max(0, p.step - 1),
                    }))
                  }
                >
                  <ChevronLeft size={17} />
                  Previous
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    setProgress((p) => ({
                      ...p,
                      step: Math.min(r.steps.length, p.step + 1),
                    }))
                  }
                >
                  {step === r.steps.length - 1 ? "Finish cooking" : "Next step"}
                  <ChevronRight size={17} />
                </button>
              </div>
              <button
                className="text-button"
                onClick={() => setShowTimer((v) => !v)}
              >
                <Timer size={16} />
                {showTimer ? "Hide timer form" : "Set a kitchen timer"}
              </button>
              {showTimer && (
                <TimerForm
                  key={`${r.id}-${step}`}
                  label={`${r.title} · step ${step + 1}`}
                />
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
