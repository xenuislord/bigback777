import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Target,
  Flame,
  Check,
  Gift,
  Send,
  MessageCircle,
  ExternalLink,
  Download,
  Upload,
  ShieldCheck,
  Wifi,
  Smartphone,
  Clock,
  Trash2,
  RefreshCw,
  ChevronRight,
  Search,
  LogOut,
} from "lucide-react";
import { useHearth, Field, Empty, SectionTitle, cents } from "./context.tsx";
import { Modal } from "./App.tsx";
import { ToolReview, toolLabels } from "./ToolReview.tsx";
import { api } from "./api.ts";
import {
  money,
  today,
  weekStart,
  type Expense,
} from "../../../packages/shared/src/index.ts";
import { finances, totalExpense } from "../../../packages/finance/src/index.ts";
import { RecipeCard } from "./Kitchen.tsx";
export function Spending() {
  const { s, act, toast, navigate } = useHearth();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [adding, setAdding] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const stats = finances(s.expenses, s.settings, s.plan, s.recipes, month);
  const rows = s.expenses.filter((e) => e.date.startsWith(month));
  const progress = (stats.totalCents / s.settings.monthlyBudgetCents) * 100;
  const recent = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(month + "-15T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 5 + i);
    const m = d.toISOString().slice(0, 7);
    return {
      m,
      total: s.expenses
        .filter((e) => e.date.startsWith(m))
        .reduce((a, e) => a + totalExpense(e), 0),
    };
  });
  const max = Math.max(
    ...recent.map((r) => r.total),
    s.settings.monthlyBudgetCents,
  );
  const avgRecipe = s.recipes
    .filter((r) => r.minutes <= 25)
    .reduce((sum, r, _, arr) => sum + r.costCents / r.servings / arr.length, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Know where dinner money goes.</h1>
          <p>Actual spending, visible assumptions, and a little perspective.</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => setAdding("Takeout")}>
            The Reality Check
          </button>
          <button className="primary" onClick={() => setAdding("Grocery")}>
            <Plus size={16} />
            Log an expense
          </button>
        </div>
      </div>
      <div className="month-filter">
        <Field label="Reporting month">
          <input
            aria-label="Reporting month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span>All food spending</span>
          <strong>{money(stats.totalCents)}</strong>
          <p>Actual recorded transactions</p>
        </div>
        <div className="stat">
          <span>Groceries</span>
          <strong>{money(stats.groceryCents)}</strong>
          <p>Not counted again when meals are cooked</p>
        </div>
        <div className="stat">
          <span>Takeout & restaurants</span>
          <strong>{money(stats.takeoutCents)}</strong>
          <p>Includes entered fees, tax and tips</p>
        </div>
        <div className="stat">
          <span>Budget remaining</span>
          <strong>{money(stats.remainingCents)}</strong>
          <p>Against {money(s.settings.monthlyBudgetCents)} per month</p>
        </div>
      </div>
      <div className="finance-layout">
        <section className="panel">
          <SectionTitle title="A budget with breathing room" />
          <div className="budget-number">
            <strong>{money(stats.totalCents)}</strong>
            <span>of {money(s.settings.monthlyBudgetCents)}</span>
          </div>
          <progress
            max={100}
            value={Math.min(progress, 100)}
            className={progress > 100 ? "over-budget" : ""}
          />
          <p className="fine">
            {Math.round(progress)}% of your chosen budget · remaining budget is
            not money deposited into savings.
          </p>
          <h3>Six months, in perspective</h3>
          {s.expenses.length ? (
            <div
              className="bar-chart"
              aria-label="Actual food spending over six months"
            >
              {recent.map((r) => (
                <div key={r.m}>
                  <span>{money(r.total)}</span>
                  <div style={{ height: Math.max(2, (r.total / max) * 130) }} />
                  <small>
                    {new Date(r.m + "-15").toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Your story starts with the first receipt.">
              Log an expense to see your spending trend.
            </Empty>
          )}
        </section>
        <section className="panel savings-panel">
          <span className="eyebrow">KEEP THE MATH HONEST</span>
          <h2>Three different kinds of savings.</h2>
          <div className="savings-line">
            <span>Remaining monthly budget</span>
            <strong>{money(stats.remainingCents)}</strong>
          </div>
          <p className="fine">Your budget minus recorded actual spending.</p>
          <div className="savings-line">
            <span>Verified deal savings</span>
            <strong>Not established</strong>
          </div>
          <p className="fine">
            Manual price notes alone don’t verify an eligible purchase against a
            grounded regular price.
          </p>
          <div className="savings-line">
            <span>Estimated takeout avoidance</span>
            <strong>{money(stats.estimatedAvoidanceCents)}</strong>
          </div>
          <p className="fine">
            For cooked meals in the displayed planning week, at{" "}
            {money(s.settings.takeoutBaselineCents)} per person versus recipe
            cost estimates. Hypothetical, separate from actual spending.
          </p>
          <button className="text-button" onClick={() => navigate("Settings")}>
            Change budget assumptions
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <SectionTitle
        title="The food-spending notebook"
        eyebrow={`${rows.length} RECORDED TRANSACTIONS`}
      />
      {!rows.length ? (
        <Empty title="Nothing recorded for this month.">
          Groceries, a coffee out, a family dinner — keep the whole picture
          here.
        </Empty>
      ) : (
        <div className="expense-list">
          {rows.map((e) => (
            <div className="expense-row" key={e.id}>
              <span
                className={
                  "expense-icon " + (e.category === "Takeout" ? "takeout" : "")
                }
              >
                <Wallet size={20} />
              </span>
              <div>
                <strong>{e.merchant}</strong>
                <small>
                  {e.category} · {e.date} · {e.portions} portions
                </small>
                {e.note && <small>{e.note}</small>}
              </div>
              <div className="expense-total">
                <strong>{money(totalExpense(e))}</strong>
                <small>
                  Base {money(e.amountCents)} · fees {money(e.feesCents)} · tip{" "}
                  {money(e.tipCents)} · tax {money(e.taxCents)}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label={`Delete expense ${e.merchant}`}
                onClick={() => {
                  if (
                    confirm(
                      "Delete this expense? A grocery checkout record cannot be deleted through this action.",
                    )
                  )
                    void act(
                      `/expenses/${e.id}`,
                      { confirm: true },
                      "DELETE",
                    ).catch(() => {});
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Modal
          title={
            adding === "Takeout"
              ? "The Reality Check"
              : "Log a household food expense"
          }
          wide
          onClose={() => setAdding(null)}
        >
          {adding === "Takeout" && s.settings.tone !== "Off" && (
            <div className="reality-check">
              <Flame size={22} />
              <h3>
                {s.settings.tone === "Savage"
                  ? "The delivery app does not need a household allowance."
                  : s.settings.tone === "Firm"
                    ? "Take a breath before tapping “order.”"
                    : "What would feel good tonight?"}
              </h3>
              <p>
                {amount
                  ? `${money(amount)} would use ${Math.round((amount / s.settings.monthlyBudgetCents) * 100)}% of your monthly budget. `
                  : ""}
                A quick home-cooked meal in your library averages approximately{" "}
                {money(Math.round(avgRecipe * s.settings.adults))} for{" "}
                {s.settings.adults} people, using ingredient estimates. This is
                a hypothetical comparison, not verified savings.
              </p>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => {
                    setAdding(null);
                    navigate("Recipes");
                  }}
                >
                  I’ll cook instead
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setAdding(null);
                    navigate("Pantry");
                  }}
                >
                  Use what we have
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await act("/expenses", {
                  category: f.get("category"),
                  merchant: f.get("merchant"),
                  amountCents: cents(f.get("amount")),
                  feesCents: cents(f.get("fees")),
                  tipCents: cents(f.get("tip")),
                  taxCents: cents(f.get("tax")),
                  discountCents: cents(f.get("discount")),
                  date: f.get("date"),
                  portions: Number(f.get("portions")),
                  note: f.get("note"),
                });
                setAdding(null);
                toast(
                  "Expense recorded. Your household totals have been updated.",
                );
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Category">
                <select
                  name="category"
                  defaultValue={adding}
                  onChange={(e) => setAdding(e.target.value)}
                >
                  {[
                    "Grocery",
                    "Takeout",
                    "Restaurant",
                    "Membership",
                    "Waste",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Store or restaurant">
                <input name="merchant" required maxLength={100} />
              </Field>
              <Field label="Food / base amount ($)">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  onChange={(e) => {
                    try {
                      setAmount(cents(e.target.value));
                    } catch {
                      setAmount(0);
                    }
                  }}
                />
              </Field>
              <Field label="Date">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={today()}
                />
              </Field>
              <Field label="Delivery or service fees ($)">
                <input name="fees" inputMode="decimal" defaultValue="0" />
              </Field>
              <Field label="Tip ($)">
                <input name="tip" inputMode="decimal" defaultValue="0" />
              </Field>
              <Field label="Tax ($)">
                <input name="tax" inputMode="decimal" defaultValue="0" />
              </Field>
              <Field label="Actual discount applied ($)">
                <input name="discount" inputMode="decimal" defaultValue="0" />
              </Field>
              <Field label="People / portions">
                <input
                  name="portions"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={s.settings.adults}
                />
              </Field>
            </div>
            <Field label="Notes">
              <textarea name="note" maxLength={2000} />
            </Field>
            <p className="fine">
              Recorded total = food + fees + tips + tax − discount. Enter a
              discount only if it was actually applied.
            </p>
            <button className="primary full">
              {adding === "Takeout"
                ? "Log this order anyway"
                : "Record expense"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Goals() {
  const { s, act, toast } = useHearth();
  const [goal, setGoal] = useState<any | null | undefined>(undefined);
  const [reward, setReward] = useState(false);
  const cooked = s.plan.meals.filter(
    (m) => m.status === "cooked" && !m.leftoverOf,
  ).length;
  const finance = finances(s.expenses, s.settings, s.plan, s.recipes);
  const value = (g: any) =>
    g.kind === "cooked"
      ? cooked
      : g.kind === "budget"
        ? Math.max(0, finance.remainingCents) / 100
        : g.progress;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMALL HABITS. GOOD THINGS AHEAD.</p>
          <h1>A little progress, made together.</h1>
          <p>
            Celebrate cooking, using what you have, and making your budget work
            for you.
          </p>
        </div>
        <button className="primary" onClick={() => setGoal(null)}>
          <Plus size={16} />
          Make a goal
        </button>
      </div>
      <section className="goal-banner">
        <div>
          <span className="eyebrow">EVERY DINNER COUNTS</span>
          <h2>
            {cooked
              ? `${cooked} home-cooked meal${cooked === 1 ? "" : "s"} this week.`
              : "The next good habit starts at home."}
          </h2>
          <p>
            Progress is about showing up for your household, never eating less
            or skipping meals.
          </p>
        </div>
        <Flame size={62} />
      </section>
      <div className="goals-grid">
        {s.goals.map((g) => (
          <article className="goal-card" key={g.id}>
            <span className="goal-symbol">
              <Target size={22} />
            </span>
            <h3>{g.title}</h3>
            <div className="goal-value">
              <strong>{+value(g).toFixed(2)}</strong>
              <span>
                of {g.target}{" "}
                {g.kind === "budget"
                  ? "dollars remaining"
                  : g.kind === "cooked"
                    ? "cooked meals"
                    : "steps"}
              </span>
            </div>
            <progress max={g.target} value={Math.min(g.target, value(g))} />
            <div className="button-row">
              <span className="fine">
                {value(g) >= g.target
                  ? "Milestone reached. Nice work."
                  : "One step at a time."}
              </span>
              <button className="text-button" onClick={() => setGoal(g)}>
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>
      <SectionTitle
        title="Something to look forward to"
        eyebrow="YOUR HOUSEHOLD REWARDS"
      >
        <button className="secondary" onClick={() => setReward(true)}>
          <Plus size={15} />
          Add a reward
        </button>
      </SectionTitle>
      {!s.rewards.length ? (
        <Empty title="Give your good habits a little celebration.">
          A movie night, a weekend walk, a new kitchen tool — choose a reward
          you’ll enjoy.
        </Empty>
      ) : (
        <div className="goals-grid">
          {s.rewards.map((r) => (
            <article className="reward-card" key={r.id}>
              <Gift size={26} />
              <h3>{r.title}</h3>
              <p>Linked to: {s.goals.find((g) => g.id === r.goalId)?.title}</p>
              <button
                className="secondary"
                disabled={r.claimed}
                onClick={() =>
                  void act(`/rewards/${r.id}/claim`, {})
                    .then(() => toast("Reward claimed. Enjoy it together."))
                    .catch(() => {})
                }
              >
                {r.claimed ? (
                  <>
                    <Check size={15} />
                    Celebrated
                  </>
                ) : (
                  "Claim reward"
                )}
              </button>
            </article>
          ))}
        </div>
      )}
      <SectionTitle title="This week’s cooking rhythm" />
      <div className="cooking-rhythm">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
          <div
            key={d}
            className={
              s.plan.meals.some((m) => m.day === i && m.status === "cooked")
                ? "cooked"
                : ""
            }
          >
            <span>{d}</span>
            <span>
              <Check size={22} />
            </span>
            <small>
              {
                s.plan.meals.filter((m) => m.day === i && m.status === "cooked")
                  .length
              }{" "}
              cooked
            </small>
          </div>
        ))}
      </div>
      {goal !== undefined && (
        <Modal
          title={goal ? "Refine your goal" : "A goal that feels like you"}
          onClose={() => setGoal(undefined)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await act("/goals", {
                  ...(goal ? { id: goal.id } : {}),
                  title: f.get("title"),
                  kind: f.get("kind"),
                  target: Number(f.get("target")),
                  progress: Number(f.get("progress")),
                });
                setGoal(undefined);
              } catch {}
            }}
          >
            <Field label="Goal">
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                defaultValue={goal?.title}
              />
            </Field>
            <Field label="Measure">
              <select name="kind" defaultValue={goal?.kind || "cooked"}>
                <option value="cooked">Cooked meals this planning week</option>
                <option value="budget">
                  Dollars remaining in monthly budget
                </option>
                <option value="custom">
                  Custom progress, entered manually
                </option>
              </select>
            </Field>
            <Field label="Target">
              <input
                name="target"
                type="number"
                min="0.01"
                step="any"
                required
                defaultValue={goal?.target || 5}
              />
            </Field>
            <Field label="Manual progress (for custom goals)">
              <input
                name="progress"
                type="number"
                min={0}
                step="any"
                defaultValue={goal?.progress || 0}
              />
            </Field>
            <button className="primary full">Save goal</button>
          </form>
        </Modal>
      )}
      {reward && (
        <Modal
          title="Something good on the horizon"
          onClose={() => setReward(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await act("/rewards", {
                  title: f.get("title"),
                  goalId: f.get("goalId"),
                });
                setReward(false);
              } catch {}
            }}
          >
            <Field label="Our reward">
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                placeholder="A movie night after ten dinners"
              />
            </Field>
            <Field label="When we reach this goal">
              <select name="goalId">
                {s.goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </Field>
            <button className="primary full">Create reward</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Assistant({ compact = false }: { compact?: boolean }) {
  const { s, week, act, toast, openRecipe, navigate, online } = useHearth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{
    id: string;
    index: number;
    name: string;
    args: Record<string, any>;
  } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [s.messages.length]);
  const send = async (message = text) => {
    if (!message.trim() || busy || !online) return;
    setText("");
    setBusy(true);
    try {
      await act("/chat", { message, week });
    } catch {
      setText((current) => current || message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={"assistant-page " + (compact ? "compact" : "")}>
      {!compact && (
        <div className="page-heading">
          <div>
            <p className="eyebrow">A HELPING HAND IN YOUR KITCHEN</p>
            <h1>Hearth Assistant</h1>
            <p>
              Your actual recipes and household records, with changes you can
              review.
            </p>
          </div>
          <button className="secondary" onClick={() => navigate("Settings")}>
            AI connections
          </button>
        </div>
      )}
      <div className="assistant-provider">
        <span className="status-dot" />
        {s.settings.provider === "none"
          ? "Local recipe helper · AI not connected"
          : s.settings.provider === "openai"
            ? "OpenAI API · separately billed"
            : s.settings.provider === "ollama"
              ? `Ollama · ${s.settings.model || "select a model"}`
              : "ChatGPT · unavailable"}
      </div>
      <div className="chat-messages">
        {!s.messages.length && (
          <div className="chat-welcome">
            <Flame size={34} />
            <h2>What sounds good?</h2>
            <p>
              Start with a craving, a budget question, or what’s already in your
              pantry.
            </p>
            {[
              "Give us six beef, potato and creamy dinners for next week.",
              "Cook with what we already have.",
              "How much have we spent this month?",
              "We’re going to order $55 worth of takeout.",
            ].map((q) => (
              <button
                className="chat-suggestion"
                key={q}
                onClick={() => void send(q)}
              >
                {q}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        )}
        {s.messages.map((m) => (
          <article className={"chat-message " + m.role} key={m.id}>
            <div className="message-author">
              {m.role === "assistant" ? (
                <>
                  <Flame size={15} />
                  Hearth Assistant
                </>
              ) : (
                "Your household"
              )}
              <span>
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="chat-text">{m.content}</p>
            {m.recipeIds?.length > 0 && (
              <div className="chat-recipe-list">
                {m.recipeIds.map((id: string) => {
                  const r = s.recipes.find((r) => r.id === id);
                  return r ? (
                    <button key={id} onClick={() => openRecipe(r)}>
                      <span>
                        <strong>{r.title}</strong>
                        <small>
                          {r.minutes} min · ≈{" "}
                          {money(Math.round(r.costCents / r.servings))}/serving
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ) : null;
                })}
              </div>
            )}
            {m.operations?.map((o: any, i: number) => (
              <div className="tool-proposal" key={i}>
                <strong>{toolLabels[o.name] || o.name}</strong>
                <p>
                  {["addExpense", "logTakeout"].includes(o.name)
                    ? "Financial proposal · review the amount, merchant, date, and full costs before recording."
                    : "Proposed operation · review before applying to household data."}
                </p>
                <button
                  className="secondary"
                  disabled={m.completedOperations?.includes(i)}
                  onClick={() =>
                    setReview({
                      id: m.id,
                      index: i,
                      name: o.name,
                      args: o.args,
                    })
                  }
                >
                  {m.completedOperations?.includes(i) ? (
                    <>
                      <Check size={14} />
                      Completed
                    </>
                  ) : (
                    <>
                      {["logTakeout", "addExpense"].includes(o.name)
                        ? "Review expense"
                        : `Review ${toolLabels[o.name]?.toLowerCase() || "change"}`}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </article>
        ))}
        {busy && <p className="thinking">Checking your kitchen records…</p>}
        <div ref={bottom} />
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Message Hearth Assistant"
          placeholder="A craving, a question, a little help…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="primary"
          aria-label="Send message"
          disabled={busy || !text.trim() || !online}
        >
          <Send size={19} />
        </button>
      </form>
      {!online && (
        <p className="notice">
          Reconnect to your kitchen to send a message. Your draft stays here.
        </p>
      )}
      <p className="fine">
        Changes need your review. External AI receives relevant household
        context only when you explicitly connect it.
      </p>
      {review && (
        <ToolReview proposal={review} onClose={() => setReview(null)} />
      )}
    </div>
  );
}
export function SettingsPage() {
  const { s, act, toast, refresh, logout, queue } = useHearth();
  const [restore, setRestore] = useState<any>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => api("/providers"),
    staleTime: 30000,
    retry: false,
  });
  const connection = useQuery({
    queryKey: ["connection", s.settings.publicUrl],
    queryFn: () => api("/connection"),
  });
  const p = providers.data;
  const [provider, setProvider] = useState(s.settings.provider);
  const [apiEnabled, setApiEnabled] = useState(s.settings.apiEnabled);
  const [toggle, setToggle] = useState(false);
  const saveCredential = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    try {
      await act("/providers/credentials", {
        name: f.get("name"),
        value: f.get("value"),
      });
      form.reset();
      void providers.refetch();
      toast(
        "Credential stored on the host. It is never returned to the browser.",
      );
    } catch {}
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE HEARTH FEEL LIKE HOME</p>
          <h1>Your household, your way.</h1>
          <p>
            Preferences, connections, and the little details that keep
            everything running.
          </p>
        </div>
        <button className="text-button" onClick={logout}>
          <LogOut size={15} />
          Sign out
        </button>
      </div>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const data = {
              ...s.settings,
              householdName: f.get("householdName"),
              adults: Number(f.get("adults")),
              city: f.get("city"),
              zip: f.get("zip"),
              radius: Number(f.get("radius")),
              monthlyBudgetCents: cents(f.get("budget")),
              takeoutBaselineCents: cents(f.get("baseline")),
              tone: f.get("tone"),
              dietNotes: f.get("dietNotes"),
              theme: f.get("theme"),
              preferredStores: String(f.get("stores"))
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              memberships: String(f.get("memberships"))
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              publicUrl: f.get("publicUrl"),
              provider,
              model: f.get("model"),
              routineProvider: f.get("routineProvider"),
              routineModel: f.get("routineModel"),
              apiEnabled,
              krogerLocationId: f.get("krogerLocationId"),
              maxStores: Number(f.get("maxStores")),
              extraMiles: Number(f.get("extraMiles")),
              costPerMileCents: cents(f.get("mileCost")),
            };
            await act("/settings", data);
            toast("Household settings saved.");
            void providers.refetch();
          } catch (e: any) {
            toast(e.message);
          }
        }}
      >
        <section className="settings-section">
          <div className="settings-label">
            <UsersIcon />
            <h2>The people at your table</h2>
            <p>
              Three profiles, one shared kitchen. Every profile can edit
              household data.
            </p>
          </div>
          <div className="settings-fields">
            <div className="form-grid">
              <Field label="Household name">
                <input
                  name="householdName"
                  defaultValue={s.settings.householdName}
                  required
                />
              </Field>
              <Field label="Default cooking portions">
                <input
                  name="adults"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={s.settings.adults}
                />
              </Field>
              <Field label="Appearance">
                <select name="theme" defaultValue={s.settings.theme}>
                  <option value="light">Warm light</option>
                  <option value="dark">Evening dark</option>
                  <option value="system">Follow system</option>
                </select>
              </Field>
              <Field label="Reality Check tone">
                <select name="tone" defaultValue={s.settings.tone}>
                  {["Off", "Gentle", "Firm", "Savage"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Monthly food budget ($)">
                <input
                  name="budget"
                  inputMode="decimal"
                  defaultValue={(s.settings.monthlyBudgetCents / 100).toFixed(
                    2,
                  )}
                />
              </Field>
              <Field label="Hypothetical takeout / person ($)">
                <input
                  name="baseline"
                  inputMode="decimal"
                  defaultValue={(s.settings.takeoutBaselineCents / 100).toFixed(
                    2,
                  )}
                />
              </Field>
            </div>
            <Field label="Household food preferences and restrictions">
              <textarea
                name="dietNotes"
                rows={3}
                defaultValue={s.settings.dietNotes}
              />
            </Field>
            <p className="fine">
              Peat-inspired is a food preference, not a medical claim. Nutrients
              and costs are estimates. Pasteurized dairy is the default.
            </p>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-label">
            <h2>Your neighborhood</h2>
            <p>
              Location preferences guide your shopping records; they don’t imply
              verified store distances or current offers.
            </p>
          </div>
          <div className="settings-fields">
            <div className="form-grid">
              <Field label="City">
                <input name="city" defaultValue={s.settings.city} />
              </Field>
              <Field label="ZIP code">
                <input
                  name="zip"
                  pattern="[0-9]{5}"
                  defaultValue={s.settings.zip}
                />
              </Field>
              <Field label="Search radius preference (miles)">
                <input
                  name="radius"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={s.settings.radius}
                />
              </Field>
              <Field label="Maximum stores to compare">
                <input
                  name="maxStores"
                  type="number"
                  min={1}
                  max={3}
                  defaultValue={s.settings.maxStores}
                />
              </Field>
              <Field label="Assumed extra miles per additional store">
                <input
                  name="extraMiles"
                  type="number"
                  min={0}
                  max={200}
                  step="any"
                  defaultValue={s.settings.extraMiles}
                />
              </Field>
              <Field label="Assumed travel cost / mile ($)">
                <input
                  name="mileCost"
                  inputMode="decimal"
                  defaultValue={(s.settings.costPerMileCents / 100).toFixed(2)}
                />
              </Field>
            </div>
            <Field label="Preferred stores · comma separated">
              <input
                name="stores"
                defaultValue={s.settings.preferredStores.join(", ")}
              />
            </Field>
            <Field label="Held loyalty cards / memberships · exact store or membership names">
              <input
                name="memberships"
                defaultValue={s.settings.memberships.join(", ")}
              />
            </Field>
            <Field label="Kroger store location ID (approved API access required)">
              <input
                name="krogerLocationId"
                defaultValue={s.settings.krogerLocationId}
              />
            </Field>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-label">
            <h2>A little AI, on your terms</h2>
            <p>
              Choose a provider explicitly. Reaching a plan limit never turns on
              API billing.
            </p>
          </div>
          <div className="settings-fields">
            <div className="integration-status">
              <strong>ChatGPT subscription</strong>
              <span className="small-pill warning">
                Unavailable · protocol unverified
              </span>
              <p>
                {p?.chatgpt.status ||
                  "Official OAuth documentation could not be read from this cloud environment. No subscription connection is claimed."}
              </p>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void act("/providers/chatgpt/connect", {}).catch(() => {})
                }
              >
                Continue with ChatGPT
                <ArrowUpRight size={15} />
              </button>
              <a
                href="https://developers.openai.com/siwc/quickstart"
                target="_blank"
                rel="noreferrer"
              >
                Official integration documentation
                <ExternalLink size={13} />
              </a>
              <a
                href="https://chatgpt.com/#settings"
                target="_blank"
                rel="noreferrer"
              >
                ChatGPT usage settings
                <ExternalLink size={13} />
              </a>
            </div>
            <div className="integration-status">
              <strong>Ollama</strong>
              <span className="small-pill">
                {p?.ollama.connected
                  ? `${p.ollama.models.length} installed model(s)`
                  : "Not reachable"}
              </span>
              <p>
                {p?.ollama.error ||
                  "Uses the host’s local Ollama service. No models are downloaded automatically."}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => void providers.refetch()}
              >
                <RefreshCw size={14} />
                Check local models
              </button>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={apiEnabled}
                onChange={(e) => setApiEnabled(e.target.checked)}
              />
              Enable separately billed OpenAI API access
            </label>
            <div className="form-grid">
              <Field label="Assistant provider">
                <select
                  name="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as any)}
                >
                  <option value="none">Local recipe helper · no AI</option>
                  <option value="ollama">Ollama · local</option>
                  <option value="chatgpt">
                    ChatGPT · currently unavailable
                  </option>
                  <option value="openai">OpenAI API · separately billed</option>
                </select>
              </Field>
              <Field label="Assistant model">
                <input
                  name="model"
                  list="models"
                  defaultValue={s.settings.model}
                  placeholder="Select an authorized model"
                />
              </Field>
              <Field label="Routine task provider">
                <select
                  name="routineProvider"
                  defaultValue={s.settings.routineProvider}
                >
                  <option value="none">No routine AI</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI API · separately billed</option>
                  <option value="chatgpt">ChatGPT · unavailable</option>
                </select>
              </Field>
              <Field label="Routine task model">
                <input
                  name="routineModel"
                  list="models"
                  defaultValue={s.settings.routineModel}
                />
              </Field>
            </div>
            <datalist id="models">
              {[
                ...new Set([
                  ...(p?.ollama.models || []).map((m: any) => m.id),
                  ...modelOptions,
                ]),
              ].map((m: any) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void act("/providers/openai/models")
                  .then((ms) => {
                    setModelOptions(ms.map((m: any) => m.id));
                    toast(
                      "Authorized API models loaded. Choose one in the model field.",
                    );
                  })
                  .catch(() => {})
              }
            >
              Discover API models (save API enablement first)
            </button>
            <p className="fine">
              Credential storage:{" "}
              {p?.credentialStorage || "Encrypted host storage"}. Tokens and
              keys are never returned to the phone. Routine routing is stored
              for supported task integrations; normal chat uses the assistant
              provider.
            </p>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-label">
            <Smartphone size={24} />
            <h2>Your kitchen, in your pocket</h2>
            <p>
              The iPhone uses this host’s database. The host must remain on and
              reachable for live changes.
            </p>
          </div>
          <div className="settings-fields">
            <Field label="Private HTTPS address for your Mac">
              <input
                name="publicUrl"
                type="url"
                placeholder="https://your-mac.your-tailnet.ts.net"
                defaultValue={s.settings.publicUrl}
              />
            </Field>
            <div className="connection-panel">
              <strong>
                <Wifi size={16} />
                Host server is responding
              </strong>
              <p>
                {connection.data?.url
                  ? "Address saved · remote connectivity is not verified"
                  : "iPhone address is not configured"}
              </p>
              {connection.data?.qr && (
                <img
                  className="qr"
                  src={connection.data.qr}
                  alt="QR code for the configured private HEARTH HTTPS address"
                />
              )}
              <ol>
                <li>
                  Install Tailscale on your Mac and iPhone and sign in to the
                  same private network.
                </li>
                <li>
                  On your Mac, run{" "}
                  <code>tailscale serve --bg http://127.0.0.1:4310</code>.
                </li>
                <li>
                  Save its HTTPS origin in the field above and click Save
                  settings.
                </li>
                <li>
                  Open the address in iPhone Safari, sign in, then Share → Add
                  to Home Screen.
                </li>
                <li>
                  Keep the Mac awake. Offline views and queued shopping edits
                  stay on the phone until reconnection.
                </li>
              </ol>
              <p className="fine">
                No Funnel and no router port forwarding. For home LAN without
                Tailscale, configure a trusted HTTPS reverse proxy; plain HTTP
                on a LAN does not provide the required PWA security.
              </p>
            </div>
            {(window as any).hearthDesktop && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={toggle}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    (window as any).hearthDesktop
                      .setLaunchAtLogin(enabled)
                      .then(setToggle);
                  }}
                />
                Launch HEARTH at Mac login
              </label>
            )}
          </div>
        </section>
        <div className="settings-save">
          <p>Applies to your shared household on every connected device.</p>
          <button className="primary" type="submit">
            <Check size={16} />
            Save settings
          </button>
        </div>
      </form>
      <section className="settings-section">
        <div className="settings-label">
          <h2>Profile names</h2>
          <p>Changes are shared with the whole household.</p>
        </div>
        <form
          className="settings-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await act(
                "/members",
                s.members.map((m) => ({ id: m.id, name: f.get(m.id) })),
              );
              toast("Profile names updated.");
            } catch {}
          }}
        >
          <div className="form-grid">
            {s.members.map((m) => (
              <Field label={m.id.replace("member-", "Adult ")} key={m.id}>
                <input
                  name={m.id}
                  required
                  maxLength={40}
                  defaultValue={m.name}
                />
              </Field>
            ))}
          </div>
          <button className="secondary">Update names</button>
        </form>
      </section>
      <section className="settings-section">
        <div className="settings-label">
          <ShieldCheck size={24} />
          <h2>Host credentials</h2>
          <p>
            Keys are sent once to your host and encrypted at rest. Leave a field
            empty and save to disconnect that credential.
          </p>
        </div>
        <div className="settings-fields">
          {[
            ["openai", "OpenAI API key (optional, separately billed)"],
            ["krogerClientId", "Kroger approved application client ID"],
            ["krogerSecret", "Kroger application client secret"],
          ].map(([name, label]) => (
            <form
              key={name}
              className="credential-form"
              onSubmit={(e) => void saveCredential(e)}
            >
              <input type="hidden" name="name" value={name} />
              <Field label={label}>
                <input
                  name="value"
                  type="password"
                  autoComplete="off"
                  maxLength={4000}
                  placeholder="Stored only on the host"
                />
              </Field>
              <button className="secondary">Save credential</button>
            </form>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-label">
          <Clock size={24} />
          <h2>A rhythm that suits you</h2>
          <p>
            Schedules are opt-in. They run only while the host is available,
            with at most three retries and visible failures.
          </p>
        </div>
        <div className="settings-fields">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await act("/jobs", {
                  kind: f.get("kind"),
                  nextRun: new Date(String(f.get("nextRun"))).toISOString(),
                  intervalDays: Number(f.get("intervalDays")),
                  enabled: true,
                });
                toast(
                  "Reminder scheduled. Plans are never approved automatically.",
                );
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Reminder">
                <select name="kind">
                  {[
                    "planning",
                    "deals",
                    "pantry",
                    "spending",
                    "goals",
                    "shopping",
                  ].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
              <Field label="First run (your local time)">
                <input name="nextRun" type="datetime-local" required />
              </Field>
              <Field label="Repeat every (days)">
                <input
                  name="intervalDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={7}
                />
              </Field>
            </div>
            <button className="secondary">Create schedule</button>
          </form>
          {s.jobs.map((j) => (
            <div className="job-row" key={j.id}>
              <div>
                <strong>{j.kind}</strong>
                <small>
                  {new Date(j.nextRun).toLocaleString()} · {j.status} · attempts{" "}
                  {j.attempts}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label={`Remove ${j.kind} schedule`}
                onClick={() => {
                  if (confirm("Remove this schedule?"))
                    void act(
                      `/jobs/${j.id}`,
                      { confirm: true },
                      "DELETE",
                    ).catch(() => {});
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-label">
          <h2>Keep your kitchen safe</h2>
          <p>
            Automatic database backups are saved daily while the host runs.
            Exports omit authentication and provider secrets.
          </p>
        </div>
        <div className="settings-fields">
          <div className="button-row">
            <button
              className="secondary"
              onClick={() =>
                void act("/backup", {})
                  .then((r) => toast(r.message + " " + r.path))
                  .catch(() => {})
              }
            >
              <ShieldCheck size={16} />
              Back up now
            </button>
            <a className="secondary" href="/api/export" download>
              <Download size={16} />
              Export household data
            </a>
            <label className="secondary file-label">
              <Upload size={16} />
              Restore export
              <input
                aria-label="Restore household export"
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5000000) {
                    toast("Choose an export under 5 MB.");
                    return;
                  }
                  try {
                    setRestore(JSON.parse(await f.text()));
                  } catch {
                    toast("This file is not valid JSON.");
                  }
                }}
              />
            </label>
          </div>
          <p className="fine">
            Restoring replaces household records after creating a backup. This
            device’s cached grocery queue should be empty first. Database and
            backups: HEARTH_DATA_DIR (default .hearth in the project); desktop
            builds use the OS application-data directory.
          </p>
          <details>
            <summary>
              Restore hidden recipes (
              {s.recipes.filter((r) => r.rejected).length})
            </summary>
            {s.recipes
              .filter((r) => r.rejected)
              .map((r) => (
                <div className="job-row" key={r.id}>
                  <span>{r.title}</span>
                  <button
                    className="text-button"
                    onClick={() =>
                      void act(`/recipes/${r.id}/preference`, {
                        rejected: false,
                      }).catch(() => {})
                    }
                  >
                    Restore
                  </button>
                </div>
              ))}
          </details>
        </div>
      </section>
      {s.notifications.length > 0 && (
        <section className="settings-section">
          <div className="settings-label">
            <h2>Host activity</h2>
            <p>Reminders, provider candidates, and background errors.</p>
          </div>
          <div className="settings-fields">
            {s.notifications.map((n) => (
              <div className="activity" key={n.id}>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {restore && (
        <Modal
          title="Restore this household export?"
          onClose={() => setRestore(null)}
        >
          <p>
            Export format: {String(restore.format)}. Created:{" "}
            {String(restore.createdAt)}.
          </p>
          <p>
            This replaces household content. A database backup is created first.
            Sign-in credentials and provider keys stay on the host.
          </p>
          <button
            className="primary full"
            onClick={async () => {
              try {
                if (queue.length) {
                  toast(
                    "Synchronize or review pending shopping edits before restoring.",
                  );
                  return;
                }
                await act("/restore", { snapshot: restore, confirm: true });
                setRestore(null);
                toast("Household data restored.");
                refresh();
              } catch {}
            }}
          >
            Confirm replacement & restore
          </button>
        </Modal>
      )}
    </>
  );
}
function UsersIcon() {
  return <span className="settings-icon">✳</span>;
}
