import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { starterRecipes, costEstimate } from "../../recipes/src/seed.ts";
import { canonical, groceryNeeds } from "../../grocery/src/index.ts";
import {
  SettingsSchema,
  RecipeSchema,
  weekStart,
  today,
  type Settings,
  type Recipe,
  type Plan,
  type Meal,
  type PantryItem,
  type GroceryItem,
  type Expense,
  type Offer,
} from "../../shared/src/index.ts";
import { includeStaples } from "../../grocery/src/pantry.ts";
import { type Staple, type LeftoverBatch } from "../../shared/src/index.ts";
import { totalExpense } from "../../finance/src/index.ts";
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export class HearthDB {
  db: DatabaseSync;
  events = new EventEmitter();
  dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dir, "hearth.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    if (
      this.one(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migration'",
      ) &&
      (this.one("SELECT MAX(version) AS version FROM schema_migration")
        ?.version || 0) < 2
    )
      this.backup();
    this.db.exec(
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    if (!this.one("SELECT id FROM household"))
      this.transaction(() => {
        this.run(
          "INSERT INTO household(id,settings) VALUES(?,?)",
          "home",
          JSON.stringify(SettingsSchema.parse({})),
        );
        for (let i = 1; i <= 3; i++)
          this.run(
            "INSERT INTO household_member VALUES(?,?,?)",
            `member-${i}`,
            "home",
            `Adult ${i}`,
          );
        for (const r of starterRecipes) this.saveRecipe(r);
        this.run(
          "INSERT INTO chat_conversation VALUES(?,?)",
          "household",
          new Date().toISOString(),
        );
        this.run(
          "INSERT INTO goal VALUES(?,?)",
          "cook-five",
          JSON.stringify({
            id: "cook-five",
            title: "Cook at home five nights",
            target: 5,
            kind: "cooked",
            progress: 0,
          }),
        );
      });
    this.db.exec(
      "UPDATE scheduled_job SET status='idle' WHERE status='running'",
    );
    this.ensurePlan(weekStart());
  }
  run(sql: string, ...p: any[]) {
    return this.db.prepare(sql).run(...p);
  }
  one(sql: string, ...p: any[]): any {
    return this.db.prepare(sql).get(...p);
  }
  all(sql: string, ...p: any[]): any[] {
    return this.db.prepare(sql).all(...p);
  }
  transaction<T>(f: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = f();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  settings(): Settings {
    return SettingsSchema.parse(
      JSON.parse(
        this.one("SELECT settings FROM household WHERE id=?", "home").settings,
      ),
    );
  }
  setSettings(s: Settings) {
    this.run(
      "UPDATE household SET settings=? WHERE id=?",
      JSON.stringify(s),
      "home",
    );
  }
  revision() {
    return this.one("SELECT revision FROM household WHERE id=?", "home")
      .revision as number;
  }
  changed(action: string, memberId: string | null, data: unknown = {}) {
    this.run("UPDATE household SET revision=revision+1 WHERE id=?", "home");
    this.run(
      "INSERT INTO audit_log VALUES(?,?,?,?,?)",
      randomUUID(),
      memberId,
      action,
      JSON.stringify(data),
      new Date().toISOString(),
    );
  }
  broadcast() {
    this.events.emit("change", this.revision());
  }
  recipes(): Recipe[] {
    return this.all("SELECT data,version FROM recipe ORDER BY id").map((r) => ({
      ...JSON.parse(r.data),
      version: r.version,
    }));
  }
  recipe(id: string): Recipe {
    const r = this.one("SELECT data,version FROM recipe WHERE id=?", id);
    if (!r) throw new AppError(404, "Recipe not found");
    return { ...JSON.parse(r.data), version: r.version };
  }
  saveRecipe(recipe: Recipe) {
    const old = this.one("SELECT version FROM recipe WHERE id=?", recipe.id);
    const v = old ? old.version + 1 : 1;
    const r = { ...recipe, ...RecipeSchema.parse(recipe), version: v };
    this.run(
      "INSERT INTO recipe VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, version=excluded.version",
      r.id,
      JSON.stringify(r),
      v,
    );
    this.run("DELETE FROM recipe_ingredient WHERE recipe_id=?", r.id);
    r.ingredients.forEach((i, pos) => {
      const key = canonical(i.name);
      this.run("INSERT OR IGNORE INTO ingredient VALUES(?,?)", key, key);
      this.run(
        "INSERT INTO recipe_ingredient VALUES(?,?,?,?,?)",
        r.id,
        pos,
        key,
        i.quantity,
        i.unit,
      );
    });
    this.run(
      "INSERT INTO recipe_version VALUES(?,?,?,?)",
      r.id,
      v,
      JSON.stringify(r),
      new Date().toISOString(),
    );
    return r;
  }
  ensurePlan(week: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week))
      throw new AppError(400, "Invalid week");
    if (!this.one("SELECT id FROM meal_plan WHERE week=?", week))
      this.run("INSERT INTO meal_plan(id,week) VALUES(?,?)", week, week);
    return this.plan(week);
  }
  plan(week: string): Plan {
    const p = this.one("SELECT * FROM meal_plan WHERE week=?", week);
    if (!p) throw new AppError(404, "Plan not found");
    return {
      id: p.id,
      week: p.week,
      approved: !!p.approved,
      version: p.version,
      meals: this.all(
        "SELECT * FROM planned_meal WHERE plan_id=? ORDER BY day,meal_type,id",
        p.id,
      ).map((m) => ({
        id: m.id,
        recipeId: m.recipe_id,
        day: m.day,
        type: m.meal_type,
        servings: m.servings,
        status: m.status,
        locked: !!m.locked,
        leftoverOf: m.leftover_of,
      })),
    };
  }
  changePlan(
    week: string,
    version: number,
    confirm: boolean,
    mutate: (p: Plan) => void,
  ) {
    const p = this.ensurePlan(week);
    if (p.version !== version)
      throw new AppError(
        409,
        "The plan changed on another device. Refresh and review before retrying.",
        p,
      );
    if (p.approved && !confirm)
      throw new AppError(
        409,
        "This plan is approved. Confirm the change to unlock and revise it.",
        { confirmationRequired: true },
      );
    this.run(
      "INSERT INTO meal_plan_version VALUES(?,?,?,?)",
      p.id,
      p.version,
      JSON.stringify(p),
      new Date().toISOString(),
    );
    mutate(p);
    this.run("UPDATE meal_plan SET version=version+1 WHERE id=?", p.id);
    if (p.approved) this.generateGroceries(week);
    return this.plan(week);
  }
  pantry(): PantryItem[] {
    return this.all("SELECT * FROM pantry_item").map((r) => ({
      ...JSON.parse(r.data),
      id: r.id,
      version: r.version,
    }));
  }
  staples(): Staple[] {
    return this.all("SELECT * FROM shopping_staple ORDER BY source_key").map(
      (row) => ({ ...JSON.parse(row.data), id: row.id, version: row.version }),
    );
  }
  leftovers(): LeftoverBatch[] {
    return this.all("SELECT * FROM leftover_batch").map((row) => ({
      ...JSON.parse(row.data),
      id: row.id,
      version: row.version,
    }));
  }
  groceries(week = weekStart()): GroceryItem[] {
    return this.all(
      "SELECT gi.*, gp.id IS NOT NULL AS recorded FROM grocery_item gi LEFT JOIN grocery_purchase gp ON gp.id=gi.id WHERE gi.list_id=? ORDER BY gi.source_key",
      week,
    ).map((r) => ({
      ...JSON.parse(r.data),
      id: r.id,
      version: r.version,
      recorded: !!r.recorded,
    }));
  }
  generateGroceries(week: string, allowRegularsOnly = false) {
    const p = this.plan(week);
    if (!p.approved && !allowRegularsOnly)
      throw new AppError(
        400,
        "Approve the meal plan before generating groceries.",
      );
    const stock = this.pantry();
    const needs = includeStaples(
      p.approved ? groceryNeeds(p.meals, this.recipes(), stock) : [],
      this.staples(),
      stock,
    );
    this.run(
      "INSERT INTO grocery_list VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET generated_at=excluded.generated_at",
      week,
      p.id,
      new Date().toISOString(),
    );
    const existing = this.groceries(week);
    const keep = new Set<string>();
    for (const n of needs) {
      keep.add(n.key);
      const old = this.one(
        "SELECT * FROM grocery_item WHERE list_id=? AND source_key=?",
        week,
        n.key,
      );
      const prev = old ? JSON.parse(old.data) : {};
      const quantityChanged =
        old && Math.abs(prev.quantity - n.quantity) > 0.001;
      const resetPurchase =
        quantityChanged && (prev.purchased || prev.actualCents != null);
      if (resetPurchase) {
        this.changed("grocery.requirements-changed", null, {
          previous: { ...prev, id: old.id },
        });
        this.run("DELETE FROM grocery_item WHERE id=?", old.id);
      }

      const item = {
        ...prev,
        id: resetPurchase ? randomUUID() : old?.id || randomUUID(),
        name: n.name,
        quantity: n.quantity,
        unit: n.unit,
        department: n.department,
        sources: n.sources,
        pantryUsed: n.pantryUsed,
        manual: false,
        purchased: resetPurchase ? false : prev.purchased || false,
        actualCents: resetPurchase ? null : (prev.actualCents ?? null),
        estimateCents: costEstimate(n.name, n.quantity, n.unit),
        store: prev.store || "",
        note: resetPurchase
          ? `${prev.note || ""} Requirements changed from ${prev.quantity} ${prev.unit}. Prior checkoff: ${!!prev.purchased}; entered total: ${prev.actualCents == null ? "none" : prev.actualCents + " cents"}. Review the new quantity and price.`.slice(
              0,
              500,
            )
          : prev.note || "",
        memberId: prev.memberId || "",
      };
      this.run(
        "INSERT INTO grocery_item VALUES(?,?,?,?,?) ON CONFLICT(list_id,source_key) DO UPDATE SET data=excluded.data,version=grocery_item.version+1",
        item.id,
        week,
        n.key,
        JSON.stringify(item),
        1,
      );
    }
    for (const old of existing.filter((i) => !i.manual)) {
      const row = this.one(
        "SELECT source_key FROM grocery_item WHERE id=?",
        old.id,
      );
      if (row && !keep.has(row.source_key))
        this.run("DELETE FROM grocery_item WHERE id=?", old.id);
    }
    return this.groceries(week);
  }
  patchGrocery(id: string, version: number, patch: Partial<GroceryItem>) {
    const row = this.one("SELECT * FROM grocery_item WHERE id=?", id);
    if (!row)
      throw new AppError(
        404,
        "Grocery item no longer exists. Your edit has been retained for review.",
      );
    if (row.version !== version)
      throw new AppError(
        409,
        "This item changed on another device. Your edit is retained; review and retry.",
        { current: { ...JSON.parse(row.data), version: row.version } },
      );
    const next = { ...JSON.parse(row.data), ...patch };
    this.run(
      "UPDATE grocery_item SET data=?,version=version+1 WHERE id=?",
      JSON.stringify(next),
      id,
    );
    return { ...next, version: row.version + 1 };
  }
  offers(): Offer[] {
    return this.all(
      "SELECT data FROM price_observation ORDER BY retrieved_at DESC",
    ).map((r) => JSON.parse(r.data));
  }
  addOffer(offer: Offer) {
    this.run(
      "INSERT INTO price_observation VALUES(?,?,?,?,?,?)",
      offer.id,
      canonical(offer.ingredient),
      offer.store,
      offer.expires,
      JSON.stringify(offer),
      offer.retrievedAt,
    );
    return offer;
  }
  expenses(): Expense[] {
    return this.all(
      "SELECT data FROM expense ORDER BY date DESC,created_at DESC",
    ).map((r) => JSON.parse(r.data));
  }
  addExpense(e: Expense) {
    this.run(
      "INSERT INTO expense VALUES(?,?,?,?,?,?,?)",
      e.id,
      e.memberId,
      e.category,
      e.date,
      totalExpense(e),
      JSON.stringify(e),
      e.createdAt,
    );
    return e;
  }
  messages() {
    const completed = this.all(
      "SELECT id,message_id FROM assistant_tool_call WHERE status='completed'",
    );
    return this.all("SELECT * FROM chat_message ORDER BY created_at,id").map(
      (r) => ({
        ...r,
        ...JSON.parse(r.data),
        completedOperations: completed
          .filter((c) => c.message_id === r.id)
          .map((c) => Number(c.id.slice(c.id.lastIndexOf(":") + 1))),
      }),
    );
  }
  message(role: string, content: string, data: unknown = {}) {
    const id = randomUUID();
    this.run(
      "INSERT INTO chat_message VALUES(?,?,?,?,?,?)",
      id,
      "household",
      role,
      content,
      JSON.stringify(data),
      new Date().toISOString(),
    );
    return id;
  }
  state(week = weekStart()) {
    return {
      recipes: this.recipes(),
      plan: this.ensurePlan(week),
      pantry: this.pantry(),
      staples: this.staples(),
      leftovers: this.leftovers(),
      groceries: this.groceries(week),
      offers: this.offers(),
      expenses: this.expenses(),
      settings: this.settings(),
      members: this.all("SELECT id,name FROM household_member"),
      goals: this.all("SELECT data FROM goal").map((r) => JSON.parse(r.data)),
      rewards: this.all("SELECT data FROM reward").map((r) =>
        JSON.parse(r.data),
      ),
      jobs: this.all("SELECT * FROM scheduled_job").map((r) => ({
        ...JSON.parse(r.data),
        id: r.id,
        nextRun: r.next_run,
        status: r.status,
        attempts: r.attempts,
      })),
      notifications: this.all(
        "SELECT data FROM notification ORDER BY created_at DESC LIMIT 30",
      ).map((r) => JSON.parse(r.data)),
      messages: this.messages(),
      revision: this.revision(),
      sampleMode: process.env.HEARTH_SAMPLE_MODE === "1",
    };
  }
  notify(title: string, body: string) {
    const id = randomUUID();
    this.run(
      "INSERT INTO notification VALUES(?,?,?)",
      id,
      JSON.stringify({ id, title, body, read: false }),
      new Date().toISOString(),
    );
  }
  backup() {
    const dest = join(this.dir, "backups");
    mkdirSync(dest, { recursive: true, mode: 0o700 });
    const path = join(
      dest,
      `hearth-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.sqlite`,
    );
    this.db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
    return path;
  }
  close() {
    this.db.close();
  }
}
