import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { z } from "zod";
import QRCode from "qrcode";
import { HearthDB, AppError } from "../../../packages/database/src/index.ts";
import {
  Vault,
  askProvider,
  ollamaModels,
  apiModels,
} from "../../../packages/ai/src/providers.ts";
import {
  RecipeSchema,
  SettingsSchema,
  PantryInput,
  StapleInput,
  LeftoverInput,
  ExpenseInput,
  OfferInput,
  MealInput,
  weekStart,
  today,
  money,
  type Recipe,
  type Offer,
} from "../../../packages/shared/src/index.ts";
import { pantrySuggestions } from "../../../packages/grocery/src/pantry.ts";
import { base, canonical } from "../../../packages/grocery/src/index.ts";
import { finances, totalExpense } from "../../../packages/finance/src/index.ts";
import {
  compareBasket,
  retailerLinks,
} from "../../../packages/deals/src/index.ts";
import { scanKroger } from "../../../packages/deals/src/kroger.ts";
import {
  toolSchemas,
  executeTool,
  AssistantOutput,
  Operation,
  readTools,
  search,
  type ToolName,
} from "./tools.ts";
const patchGrocery = z.object({
  purchased: z.boolean().optional(),
  actualCents: z.number().int().nonnegative().nullable().optional(),
  store: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
  memberId: z.string().max(100).optional(),
  quantity: z.number().positive().optional(),
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const backupTables = [
  "ingredient",
  "ingredient_alias",
  "recipe",
  "recipe_ingredient",
  "recipe_version",
  "recipe_rating",
  "recipe_preference",
  "meal_plan",
  "planned_meal",
  "meal_plan_version",
  "meal_completion",
  "pantry_item",
  "inventory_transaction",
  "grocery_list",
  "grocery_item",
  "grocery_purchase",
  "price_observation",
  "deal_scan",
  "expense",
  "goal",
  "reward",
  "chat_conversation",
  "chat_message",
  "assistant_tool_call",
  "scheduled_job",
  "notification",
  "sync_event",
  "audit_log",
  "shopping_staple",
  "leftover_batch",
  "leftover_event",
] as const;
export async function createApp(
  options: { dataDir?: string; staticDir?: string; testing?: boolean } = {},
) {
  const db = new HearthDB(
    resolve(options.dataDir || process.env.HEARTH_DATA_DIR || ".hearth"),
  );
  const vault = new Vault(db);
  const app = Fastify({
    logger: !options.testing,
    bodyLimit: 5 * 1024 * 1024,
    trustProxy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.decorateRequest("memberId", "");
  const secureCookie = (req: any) =>
    req.headers["x-forwarded-proto"] === "https" || !!req.raw.socket.encrypted;
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Frame-Options", "DENY")
      .header("Permissions-Policy", "camera=(self), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    if (!req.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers["x-hearth-request"] !== "1")
        throw new AppError(403, "Missing CSRF request header.");
      const origin = req.headers.origin;
      const host = req.headers.host;
      const publicUrl = db.settings().publicUrl;
      if (
        origin &&
        origin !== `http://${host}` &&
        origin !== `https://${host}` &&
        origin !== publicUrl
      )
        throw new AppError(403, "Cross-origin request denied.");
    }
    const token = req.cookies.hearth_session;
    if (token) {
      const session = db.one(
        "SELECT * FROM session WHERE id=? AND expires_at>?",
        hash(token),
        Date.now(),
      );
      if (session) (req as any).memberId = session.member_id;
    }
    const open = [
      "/api/health",
      "/api/auth/status",
      "/api/auth/setup",
      "/api/auth/login",
    ];
    if (!open.includes(req.url.split("?")[0]) && !(req as any).memberId)
      throw new AppError(401, "Sign in to your household.");
  });
  app.setErrorHandler((err: any, req, reply) => {
    const status = err instanceof z.ZodError ? 400 : err.statusCode || 500;
    if (status >= 500)
      req.log.error({ code: err.code, status }, "Request failed");
    reply.code(status).send({
      error:
        status === 500
          ? "An internal error occurred. Your saved data is retained."
          : err.message,
      details: err instanceof z.ZodError ? err.issues : err.details,
    });
  });
  const body = (req: any) => req.body || {};
  const member = (req: any) => req.memberId as string;
  const mutate = (req: any, name: string, fn: () => any) => {
    const result = db.transaction(() => {
      const v = fn();
      db.changed(name, member(req));
      return v;
    });
    db.broadcast();
    return result;
  };
  app.get("/api/health", () => ({
    status: "ok",
    database: db.one("PRAGMA quick_check").quick_check === "ok",
    version: "0.1.0",
    instanceId: process.env.HEARTH_INSTANCE_ID || "development",
  }));
  app.get("/api/auth/status", (req) => ({
    setup: !!db.one("SELECT 1 FROM auth"),
    authenticated: !!member(req),
    memberId: member(req) || null,
    members: db.all("SELECT id,name FROM household_member"),
  }));
  async function signIn(req: any, reply: any, memberId: string) {
    const token = randomBytes(32).toString("base64url");
    db.run(
      "INSERT INTO session VALUES(?,?,?)",
      hash(token),
      memberId,
      Date.now() + 14 * 86400000,
    );
    reply.setCookie("hearth_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookie(req),
      maxAge: 14 * 86400,
    });
    return { ok: true, memberId };
  }
  const login = z.object({
    password: z.string().min(12).max(200),
    memberId: z.enum(["member-1", "member-2", "member-3"]).default("member-1"),
  });
  app.post(
    "/api/auth/setup",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (db.one("SELECT 1 FROM auth"))
        throw new AppError(409, "Household is already configured.");
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip))
        throw new AppError(
          403,
          "Create the household on the host computer first.",
        );
      const a = login
        .extend({ names: z.array(z.string().trim().min(1).max(40)).length(3) })
        .parse(body(req));
      const salt = randomBytes(16).toString("hex");
      db.transaction(() => {
        db.run(
          "INSERT INTO auth VALUES(?)",
          salt + ":" + scryptSync(a.password, salt, 64).toString("hex"),
        );
        a.names.forEach((name, i) =>
          db.run(
            "UPDATE household_member SET name=? WHERE id=?",
            name,
            `member-${i + 1}`,
          ),
        );
        db.changed("household.setup", null);
      });
      return signIn(req, reply, a.memberId);
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const a = login.parse(body(req));
      const row = db.one("SELECT password_hash FROM auth");
      if (!row)
        throw new AppError(400, "Set up the household on the host first.");
      const [salt, key] = row.password_hash.split(":");
      if (
        !timingSafeEqual(
          scryptSync(a.password, salt, 64),
          Buffer.from(key, "hex"),
        )
      )
        throw new AppError(401, "Incorrect household passphrase.");
      return signIn(req, reply, a.memberId);
    },
  );
  app.post("/api/auth/logout", (req, reply) => {
    if (req.cookies.hearth_session)
      db.run(
        "DELETE FROM session WHERE id=?",
        hash(req.cookies.hearth_session),
      );
    reply.clearCookie("hearth_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/state", (req) =>
    db.state(
      z.object({ week: z.string().default(weekStart()) }).parse(req.query).week,
    ),
  );
  app.get("/api/events", async (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const sessionId = hash(req.cookies.hearth_session || "");
    const emit = (revision: number) => {
      if (
        !db.one(
          "SELECT id FROM session WHERE id=? AND expires_at>?",
          sessionId,
          Date.now(),
        )
      ) {
        reply.raw.end();
        return;
      }
      reply.raw.write(`data: ${JSON.stringify({ revision })}\n\n`);
    };
    emit(db.revision());
    db.events.on("change", emit);
    const heartbeat = setInterval(() => {
      if (
        !db.one(
          "SELECT id FROM session WHERE id=? AND expires_at>?",
          sessionId,
          Date.now(),
        )
      )
        reply.raw.end();
      else reply.raw.write(": keepalive\n\n");
    }, 20000);
    req.raw.on("close", () => {
      clearInterval(heartbeat);
      db.events.off("change", emit);
    });
  });
  app.post("/api/settings", (req) => {
    const s = SettingsSchema.parse(body(req));
    return mutate(req, "settings.update", () => {
      db.setSettings(s);
      return s;
    });
  });
  app.post("/api/members", (req) => {
    const a = z
      .array(
        z.object({
          id: z.enum(["member-1", "member-2", "member-3"]),
          name: z.string().trim().min(1).max(40),
        }),
      )
      .length(3)
      .parse(body(req));
    return mutate(req, "members.update", () => {
      for (const m of a)
        db.run("UPDATE household_member SET name=? WHERE id=?", m.name, m.id);
      return { ok: true };
    });
  });
  app.post("/api/recipes", (req) =>
    mutate(req, "recipe.create", () =>
      executeTool(
        db,
        "createRecipe",
        RecipeSchema.parse(body(req)),
        member(req),
        true,
      ),
    ),
  );
  app.patch("/api/recipes/:id", (req) => {
    const a = z
      .object({ version: z.number().int(), recipe: RecipeSchema })
      .parse(body(req));
    return mutate(req, "recipe.edit", () =>
      executeTool(
        db,
        "editRecipe",
        { id: (req.params as any).id, ...a },
        member(req),
        true,
      ),
    );
  });
  app.post("/api/recipes/:id/preference", (req) => {
    const a = z
      .object({
        favorite: z.boolean().optional(),
        rejected: z.boolean().optional(),
        rating: z.number().int().min(0).max(5).optional(),
      })
      .parse(body(req));
    return mutate(req, "recipe.preference", () => {
      const r = db.recipe((req.params as any).id);
      if (a.rating !== undefined)
        db.run(
          "INSERT INTO recipe_rating VALUES(?,?,?) ON CONFLICT(recipe_id,member_id) DO UPDATE SET rating=excluded.rating",
          r.id,
          member(req),
          a.rating,
        );
      const next = db.saveRecipe({ ...r, ...a });
      db.run(
        "INSERT INTO recipe_preference VALUES(?,?,?) ON CONFLICT(recipe_id) DO UPDATE SET favorite=excluded.favorite,rejected=excluded.rejected",
        r.id,
        +next.favorite,
        +next.rejected,
      );
      return next;
    });
  });
  app.post("/api/plan/add", (req) => {
    const a = z
      .object({
        week: z.string(),
        version: z.number(),
        meal: MealInput,
        confirm: z.boolean().default(false),
      })
      .parse(body(req));
    return mutate(req, "plan.add", () => {
      const p = db.ensurePlan(a.week);
      if (p.approved && !a.confirm)
        throw new AppError(409, "Confirm changes to this approved plan.", {
          confirmationRequired: true,
        });
      return executeTool(db, "updateMealPlan", a, member(req), true);
    });
  });
  app.post("/api/plan/add-batch", (req) => {
    const a = z
      .object({
        week: z.string(),
        version: z.number(),
        confirm: z.boolean().default(false),
        meals: z.array(MealInput).min(1).max(30),
      })
      .parse(body(req));
    return mutate(req, "plan.add-batch", () =>
      db.changePlan(a.week, a.version, a.confirm, (p) => {
        for (const m of a.meals) {
          db.recipe(m.recipeId);
          if (m.leftoverOf)
            throw new AppError(
              400,
              "Add linked leftovers individually after the original cooking batch.",
            );
          db.run(
            "INSERT INTO planned_meal(id,plan_id,recipe_id,day,meal_type,servings) VALUES(?,?,?,?,?,?)",
            randomUUID(),
            p.id,
            m.recipeId,
            m.day,
            m.type,
            m.servings,
          );
        }
      }),
    );
  });
  app.post("/api/plan/approve", (req) => {
    const a = z
      .object({ week: z.string(), version: z.number() })
      .parse(body(req));
    return mutate(req, "plan.approve", () =>
      executeTool(db, "approveMealPlan", a, member(req), true),
    );
  });
  app.post("/api/plan/update", (req) => {
    const a = z
      .object({
        week: z.string(),
        version: z.number(),
        mealId: z.string(),
        confirm: z.boolean().default(false),
        patch: z.object({
          day: z.number().int().min(0).max(6).optional(),
          type: MealInput.shape.type.optional(),
          recipeId: z.string().optional(),
          servings: z.number().int().min(1).max(30).optional(),
          status: z.enum(["planned", "cooked", "skipped"]).optional(),
          locked: z.boolean().optional(),
        }),
      })
      .parse(body(req));
    return mutate(req, "plan.update", () =>
      db.changePlan(a.week, a.version, a.confirm, (p) => {
        const m = p.meals.find((m) => m.id === a.mealId);
        if (!m) throw new AppError(404, "Meal not found");
        if (m.locked && !a.confirm)
          throw new AppError(409, "Confirm changes to this locked meal.", {
            confirmationRequired: true,
          });
        if (a.patch.recipeId) db.recipe(a.patch.recipeId);
        if (m.leftoverOf && (a.patch.recipeId || a.patch.servings))
          throw new AppError(
            400,
            "Change the original cooking batch before revising leftovers.",
          );
        if (a.patch.servings) {
          const reserved = p.meals
            .filter((x) => x.leftoverOf === m.id)
            .reduce((s, x) => s + x.servings, 0);
          if (a.patch.servings <= reserved)
            throw new AppError(
              400,
              "Batch size must leave enough servings for the original meal and its leftovers.",
            );
        }
        const n = { ...m, ...a.patch };
        db.run(
          "UPDATE planned_meal SET day=?,meal_type=?,recipe_id=?,servings=?,status=?,locked=? WHERE id=?",
          n.day,
          n.type,
          n.recipeId,
          n.servings,
          n.status,
          +n.locked,
          n.id,
        );
        if (a.patch.recipeId)
          db.run(
            "UPDATE planned_meal SET recipe_id=? WHERE leftover_of=?",
            n.recipeId,
            n.id,
          );
        if (n.status === "cooked")
          db.run(
            "INSERT INTO meal_completion VALUES(?,?,?) ON CONFLICT(meal_id) DO NOTHING",
            n.id,
            member(req),
            new Date().toISOString(),
          );
        else db.run("DELETE FROM meal_completion WHERE meal_id=?", n.id);
      }),
    );
  });
  app.post("/api/plan/remove", (req) => {
    const a = z
      .object({
        week: z.string(),
        version: z.number(),
        mealId: z.string(),
        confirm: z.literal(true),
      })
      .parse(body(req));
    return mutate(req, "plan.remove", () =>
      db.changePlan(a.week, a.version, true, (p) => {
        if (!p.meals.some((m) => m.id === a.mealId))
          throw new AppError(404, "Meal not found");
        if (p.meals.some((m) => m.leftoverOf === a.mealId))
          throw new AppError(400, "Remove the linked leftover meals first.");
        db.run(
          "DELETE FROM planned_meal WHERE id=? AND plan_id=?",
          a.mealId,
          p.id,
        );
      }),
    );
  });
  app.post("/api/plan/restore", (req) => {
    const a = z
      .object({
        week: z.string(),
        version: z.number(),
        restoreVersion: z.number(),
        confirm: z.literal(true),
      })
      .parse(body(req));
    return mutate(req, "plan.restore", () => {
      const row = db.one(
        "SELECT data FROM meal_plan_version WHERE plan_id=? AND version=?",
        a.week,
        a.restoreVersion,
      );
      if (!row) throw new AppError(404, "Plan version not found");
      const prior = JSON.parse(row.data);
      return db.changePlan(a.week, a.version, true, (p) => {
        db.run(
          "UPDATE planned_meal SET leftover_of=NULL WHERE plan_id=?",
          p.id,
        );
        db.run("DELETE FROM planned_meal WHERE plan_id=?", p.id);
        for (const m of [...prior.meals].sort(
          (x, y) => Number(!!x.leftoverOf) - Number(!!y.leftoverOf),
        ))
          db.run(
            "INSERT INTO planned_meal VALUES(?,?,?,?,?,?,?,?,?)",
            m.id,
            p.id,
            m.recipeId,
            m.day,
            m.type,
            m.servings,
            m.status,
            +m.locked,
            m.leftoverOf,
          );
        db.run(
          "UPDATE meal_plan SET approved=? WHERE id=?",
          +prior.approved,
          p.id,
        );
        if (prior.approved) db.generateGroceries(a.week);
        else {
          for (const item of db.groceries(a.week).filter((i) => !i.manual))
            db.run("DELETE FROM grocery_item WHERE id=?", item.id);
        }
      });
    });
  });
  app.get("/api/plan/history", (req) => {
    const a = z.object({ week: z.string() }).parse(req.query);
    return db
      .all(
        "SELECT * FROM meal_plan_version WHERE plan_id=? ORDER BY version DESC",
        a.week,
      )
      .map((v) => ({ ...v, data: JSON.parse(v.data) }));
  });
  app.post("/api/plan/duplicate", (req) => {
    const a = z
      .object({ from: z.string(), to: z.string(), version: z.number() })
      .parse(body(req));
    return mutate(req, "plan.duplicate", () =>
      db.changePlan(a.to, a.version, false, (p) => {
        if (p.meals.length)
          throw new AppError(
            400,
            "Duplicate into an empty week to preserve existing selections.",
          );
        const source = db.plan(a.from);
        const ids = new Map(source.meals.map((m) => [m.id, randomUUID()]));
        for (const m of [...source.meals].sort(
          (a, b) => Number(!!a.leftoverOf) - Number(!!b.leftoverOf),
        ))
          db.run(
            "INSERT INTO planned_meal(id,plan_id,recipe_id,day,meal_type,servings,leftover_of) VALUES(?,?,?,?,?,?,?)",
            ids.get(m.id),
            p.id,
            m.recipeId,
            m.day,
            m.type,
            m.servings,
            m.leftoverOf ? ids.get(m.leftoverOf) : null,
          );
      }),
    );
  });
  app.post("/api/groceries/generate", (req) => {
    const a = z.object({ week: z.string() }).parse(body(req));
    return mutate(req, "grocery.generate", () => db.generateGroceries(a.week));
  });
  app.post("/api/groceries/manual", (req) => {
    const a = z
      .object({
        week: z.string(),
        name: z.string().min(1).max(100),
        quantity: z.number().positive(),
        unit: PantryInput.shape.unit,
        department: z.string().max(80).default("Pantry"),
      })
      .parse(body(req));
    return mutate(req, "grocery.manual", () => {
      const p = db.ensurePlan(a.week);
      db.run(
        "INSERT OR IGNORE INTO grocery_list VALUES(?,?,?)",
        a.week,
        p.id,
        new Date().toISOString(),
      );
      const key = "manual:" + canonical(a.name) + "|" + a.unit;
      const old = db.one(
        "SELECT id FROM grocery_item WHERE list_id=? AND source_key=?",
        a.week,
        key,
      );
      if (old)
        throw new AppError(
          409,
          "This manual item already exists. Edit its quantity instead.",
        );
      const item = {
        id: randomUUID(),
        ...a,
        purchased: false,
        actualCents: null,
        estimateCents: 0,
        store: "",
        note: "",
        memberId: "",
        sources: ["Manual household addition"],
        manual: true,
      };
      db.run(
        "INSERT INTO grocery_item VALUES(?,?,?,?,?)",
        item.id,
        a.week,
        key,
        JSON.stringify(item),
        1,
      );
      return item;
    });
  });
  app.post("/api/sync", (req) => {
    const a = z
      .object({
        operationId: z.string().uuid(),
        itemId: z.string(),
        version: z.number().int(),
        patch: patchGrocery,
      })
      .parse(body(req));
    const existing = db.one(
      "SELECT result FROM sync_event WHERE operation_id=? AND member_id=?",
      a.operationId,
      member(req),
    );
    if (existing) return JSON.parse(existing.result);
    return mutate(req, "grocery.edit", () => {
      const result = db.patchGrocery(a.itemId, a.version, a.patch);
      db.run(
        "INSERT INTO sync_event VALUES(?,?,?,?)",
        a.operationId,
        member(req),
        JSON.stringify(result),
        new Date().toISOString(),
      );
      return result;
    });
  });
  app.post("/api/groceries/checkout", (req) => {
    const a = z
      .object({
        week: z.string(),
        merchant: z.string().min(1).max(100),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        operationId: z.string().uuid(),
        items: z
          .array(
            z.object({
              id: z.string(),
              version: z.number().int().positive(),
              actualCents: z.number().int().min(0).max(100000000),
            }),
          )
          .min(1)
          .max(300)
          .optional(),
      })
      .parse(body(req));
    const existing = db.one(
      "SELECT result FROM sync_event WHERE operation_id=? AND member_id=?",
      a.operationId,
      member(req),
    );
    if (existing) return JSON.parse(existing.result);
    return mutate(req, "grocery.checkout", () => {
      if (a.items) {
        const current = db
          .groceries(a.week)
          .filter((i) => i.purchased && !i.recorded);
        if (
          new Set(a.items.map((i) => i.id)).size !== a.items.length ||
          current.length !== a.items.length ||
          current.some((i) => !a.items!.some((p) => p.id === i.id))
        )
          throw new AppError(
            409,
            "The checked items changed on another device. Close checkout and review the updated list before recording.",
          );
        for (const item of a.items)
          db.patchGrocery(item.id, item.version, {
            actualCents: item.actualCents,
          });
      }
      const items = db
        .groceries(a.week)
        .filter(
          (i) =>
            i.purchased &&
            !db.one("SELECT id FROM grocery_purchase WHERE id=?", i.id),
        );
      if (!items.length)
        throw new AppError(400, "No unrecorded purchased items.");
      if (items.some((i) => i.actualCents === null))
        throw new AppError(
          400,
          "Enter the actual total paid for every checked item first.",
        );
      const expense = {
        id: randomUUID(),
        memberId: member(req),
        category: "Grocery" as const,
        merchant: a.merchant,
        amountCents: items.reduce((s, i) => s + i.actualCents!, 0),
        feesCents: 0,
        tipCents: 0,
        taxCents: 0,
        discountCents: 0,
        date: a.date,
        portions: db.settings().adults,
        note: "Recorded from purchased grocery items. Add pantry stock separately after checking quantities.",
        createdAt: new Date().toISOString(),
      };
      db.addExpense(expense);
      for (const item of items)
        db.run(
          "INSERT INTO grocery_purchase VALUES(?,?,?,?)",
          item.id,
          item.id === items[0].id ? expense.id : null,
          JSON.stringify(item),
          new Date().toISOString(),
        );
      db.run(
        "INSERT INTO sync_event VALUES(?,?,?,?)",
        a.operationId,
        member(req),
        JSON.stringify(expense),
        new Date().toISOString(),
      );
      return expense;
    });
  });
  app.post("/api/staples", (req) => {
    const input = StapleInput.parse(body(req));
    return mutate(req, "staple.create", () => {
      const normalized = base(input.quantity, input.unit),
        key = canonical(input.name) + "|" + normalized.unit;
      if (db.one("SELECT id FROM shopping_staple WHERE source_key=?", key))
        throw new AppError(
          409,
          "This regular item already exists. Edit its usual quantity instead.",
        );
      const id = randomUUID();
      db.run(
        "INSERT INTO shopping_staple VALUES(?,?,?,?)",
        id,
        key,
        JSON.stringify(input),
        1,
      );
      return { id, ...input, version: 1 };
    });
  });
  app.patch("/api/staples/:id", (req) => {
    const input = z
      .object({ version: z.number().int().positive(), item: StapleInput })
      .parse(body(req));
    return mutate(req, "staple.edit", () => {
      const id = (req.params as any).id,
        row = db.one("SELECT * FROM shopping_staple WHERE id=?", id);
      if (!row) throw new AppError(404, "Regular item not found.");
      if (row.version !== input.version)
        throw new AppError(
          409,
          "This regular item changed on another device. Refresh before editing.",
        );
      const key =
        canonical(input.item.name) +
        "|" +
        base(input.item.quantity, input.item.unit).unit;
      const duplicate = db.one(
        "SELECT id FROM shopping_staple WHERE source_key=? AND id<>?",
        key,
        id,
      );
      if (duplicate)
        throw new AppError(
          409,
          "Another regular item already covers this ingredient.",
        );
      db.run(
        "UPDATE shopping_staple SET source_key=?,data=?,version=version+1 WHERE id=?",
        key,
        JSON.stringify(input.item),
        id,
      );
      return { id, ...input.item, version: row.version + 1 };
    });
  });
  app.delete("/api/staples/:id", (req) => {
    const input = z
      .object({
        version: z.number().int().positive(),
        confirm: z.literal(true),
      })
      .parse(body(req));
    return mutate(req, "staple.delete", () => {
      const id = (req.params as any).id,
        row = db.one("SELECT version FROM shopping_staple WHERE id=?", id);
      if (!row) throw new AppError(404, "Regular item not found.");
      if (row.version !== input.version)
        throw new AppError(
          409,
          "The regular item changed. Refresh before removing it.",
        );
      db.run("DELETE FROM shopping_staple WHERE id=?", id);
      return { removed: true };
    });
  });
  app.post("/api/staples/apply", (req) => {
    const input = z.object({ week: z.string() }).parse(body(req));
    return mutate(req, "staple.apply", () =>
      db.generateGroceries(input.week, true),
    );
  });
  app.post("/api/leftovers", (req) => {
    const input = LeftoverInput.safeExtend({
      operationId: z.string().uuid(),
    }).parse(body(req));
    const existing = db.one(
      "SELECT result FROM sync_event WHERE operation_id=? AND member_id=?",
      input.operationId,
      member(req),
    );
    if (existing) return JSON.parse(existing.result);
    return mutate(req, "leftover.create", () => {
      const { operationId, ...data } = input;
      const recipe = data.recipeId ? db.recipe(data.recipeId) : null;
      const id = randomUUID(),
        batch = {
          id,
          ...data,
          remaining: data.portions,
          archived: false,
          allergens: recipe?.allergens || [],
          version: 1,
        };
      db.run(
        "INSERT INTO leftover_batch VALUES(?,?,?,?)",
        id,
        data.recipeId,
        JSON.stringify(batch),
        1,
      );
      db.run(
        "INSERT INTO sync_event VALUES(?,?,?,?)",
        operationId,
        member(req),
        JSON.stringify(batch),
        new Date().toISOString(),
      );
      return batch;
    });
  });
  app.patch("/api/leftovers/:id", (req) => {
    const input = z
      .object({ version: z.number().int().positive(), item: LeftoverInput })
      .parse(body(req));
    return mutate(req, "leftover.edit", () => {
      const id = (req.params as any).id,
        row = db.one("SELECT * FROM leftover_batch WHERE id=?", id);
      if (!row) throw new AppError(404, "Leftover batch not found.");
      if (row.version !== input.version)
        throw new AppError(
          409,
          "Another household member updated these leftovers. Review the current portions first.",
        );
      const previous = JSON.parse(row.data),
        used = previous.portions - previous.remaining;
      if (input.item.portions < used)
        throw new AppError(
          400,
          `This batch already has ${used} used portions. The total cannot be reduced below that.`,
        );
      const recipe = input.item.recipeId
        ? db.recipe(input.item.recipeId)
        : null;
      const batch = {
        ...previous,
        ...input.item,
        remaining: input.item.portions - used,
        version: row.version + 1,
        allergens:
          input.item.recipeId === previous.recipeId
            ? previous.allergens
            : recipe?.allergens || [],
      };
      db.run(
        "UPDATE leftover_batch SET recipe_id=?,data=?,version=version+1 WHERE id=?",
        batch.recipeId,
        JSON.stringify(batch),
        id,
      );
      return batch;
    });
  });
  app.post("/api/leftovers/:id/use", (req) => {
    const input = z
      .object({
        operationId: z.string().uuid(),
        version: z.number().int().positive(),
        kind: z.enum(["eat", "discard", "restore"]),
        portions: z.number().int().min(1).max(100),
      })
      .parse(body(req));
    const id = (req.params as any).id,
      prior = db.one(
        "SELECT * FROM leftover_event WHERE operation_id=?",
        input.operationId,
      );
    if (prior) {
      if (prior.batch_id !== id || prior.member_id !== member(req))
        throw new AppError(
          409,
          "This operation belongs to a different leftover record.",
        );
      return JSON.parse(prior.result);
    }
    return mutate(req, "leftover." + input.kind, () => {
      const row = db.one("SELECT * FROM leftover_batch WHERE id=?", id);
      if (!row) throw new AppError(404, "Leftover batch not found.");
      if (row.version !== input.version)
        throw new AppError(
          409,
          "The leftover portions changed on another device. Review the new amount before trying again.",
        );
      const batch = JSON.parse(row.data),
        delta = input.kind === "restore" ? input.portions : -input.portions,
        next = batch.remaining + delta;
      if (next < 0)
        throw new AppError(
          400,
          "There are fewer portions left than requested.",
        );
      if (next > batch.portions)
        throw new AppError(
          400,
          "Restored portions cannot exceed the recorded cooking batch.",
        );
      const result = { ...batch, remaining: next, version: row.version + 1 };
      db.run(
        "UPDATE leftover_batch SET data=?,version=version+1 WHERE id=?",
        JSON.stringify(result),
        id,
      );
      db.run(
        "INSERT INTO leftover_event VALUES(?,?,?,?,?,?,?)",
        input.operationId,
        id,
        member(req),
        delta,
        input.kind,
        JSON.stringify(result),
        new Date().toISOString(),
      );
      return result;
    });
  });
  app.post("/api/pantry", (req) => {
    const a = PantryInput.parse(body(req));
    return mutate(req, "pantry.add", () => {
      const id = randomUUID();
      db.run("INSERT INTO pantry_item VALUES(?,?,?)", id, JSON.stringify(a), 1);
      db.run(
        "INSERT INTO inventory_transaction VALUES(?,?,?,?,?)",
        randomUUID(),
        id,
        a.quantity,
        new Date().toISOString(),
        "Manual stock entry",
      );
      return { id, ...a, version: 1 };
    });
  });
  app.patch("/api/pantry/:id", (req) => {
    const a = z
      .object({ version: z.number(), item: PantryInput })
      .parse(body(req));
    return mutate(req, "pantry.update", () => {
      const row = db.one(
        "SELECT * FROM pantry_item WHERE id=?",
        (req.params as any).id,
      );
      if (!row) throw new AppError(404, "Inventory item not found");
      if (row.version !== a.version)
        throw new AppError(409, "Inventory changed on another device.");
      db.run(
        "UPDATE pantry_item SET data=?,version=version+1 WHERE id=?",
        JSON.stringify(a.item),
        row.id,
      );
      db.run(
        "INSERT INTO inventory_transaction VALUES(?,?,?,?,?)",
        randomUUID(),
        row.id,
        a.item.quantity - JSON.parse(row.data).quantity,
        new Date().toISOString(),
        "Manual stock adjustment",
      );
      return { ok: true };
    });
  });
  app.delete("/api/pantry/:id", (req) => {
    z.object({ confirm: z.literal(true) }).parse(body(req));
    return mutate(req, "pantry.delete", () => {
      db.run("DELETE FROM pantry_item WHERE id=?", (req.params as any).id);
      return { ok: true };
    });
  });
  app.post("/api/expenses", (req) => {
    const a = ExpenseInput.parse(body(req));
    return mutate(req, "expense.add", () =>
      db.addExpense({
        ...a,
        id: randomUUID(),
        memberId: member(req),
        createdAt: new Date().toISOString(),
      }),
    );
  });
  app.delete("/api/expenses/:id", (req) => {
    z.object({ confirm: z.literal(true) }).parse(body(req));
    return mutate(req, "expense.delete", () => {
      const id = (req.params as any).id;
      if (db.one("SELECT id FROM grocery_purchase WHERE expense_id=?", id))
        throw new AppError(
          400,
          "This expense is a grocery checkout record. Add a correcting transaction note instead of deleting the purchase history.",
        );
      db.run("DELETE FROM expense WHERE id=?", id);
      return { ok: true };
    });
  });
  app.get("/api/finance", (req) =>
    finances(
      db.expenses(),
      db.settings(),
      db.ensurePlan(weekStart()),
      db.recipes(),
      (req.query as any).month,
    ),
  );
  app.get("/api/deals/sources", () => retailerLinks);
  app.post("/api/deals/observations", (req) => {
    const a = OfferInput.parse(body(req));
    return mutate(req, "price.observe", () =>
      db.addOffer({
        ...a,
        id: randomUUID(),
        source: "manual",
        retrievedAt: new Date().toISOString(),
        verification: "User-entered price",
      }),
    );
  });
  app.post("/api/deals/import", (req) => {
    const a = z
      .object({
        offers: z.array(OfferInput).min(1).max(200),
        confirm: z.literal(true),
      })
      .parse(body(req));
    return mutate(req, "price.import", () =>
      a.offers.map((o) =>
        db.addOffer({
          ...o,
          id: randomUUID(),
          source: "manual",
          retrievedAt: new Date().toISOString(),
          verification: "User-imported price; not retailer-verified",
        }),
      ),
    );
  });
  app.post("/api/deals/scan", async (req) => {
    const a = z
      .object({ week: z.string(), live: z.boolean().default(false) })
      .parse(body(req));
    let provider: any = null;
    if (a.live) provider = await scanKroger(db, vault, a.week);
    return mutate(req, "deal.scan", () => {
      const result = compareBasket(
        db.groceries(a.week),
        db.offers(),
        db.settings(),
      );
      const r = {
        ...result,
        provider,
        liveConfigured:
          vault.has("krogerClientId") && vault.has("krogerSecret"),
        message:
          "Only recorded observations are compared. Missing prices remain unavailable.",
      };
      db.run(
        "INSERT INTO deal_scan VALUES(?,?,?)",
        randomUUID(),
        JSON.stringify(r),
        new Date().toISOString(),
      );
      return r;
    });
  });
  app.post("/api/goals", (req) =>
    mutate(req, "goal.save", () =>
      executeTool(db, "updateHouseholdGoal", body(req), member(req), true),
    ),
  );
  app.post("/api/rewards", (req) =>
    mutate(req, "reward.create", () =>
      executeTool(db, "createReward", body(req), member(req), true),
    ),
  );
  app.post("/api/rewards/:id/claim", (req) =>
    mutate(req, "reward.claim", () => {
      const row = db.one(
        "SELECT data FROM reward WHERE id=?",
        (req.params as any).id,
      );
      if (!row) throw new AppError(404, "Reward not found");
      const r = JSON.parse(row.data);
      const goal = JSON.parse(
        db.one("SELECT data FROM goal WHERE id=?", r.goalId)?.data || "null",
      );
      if (!goal) throw new AppError(400, "Goal not found");
      const progress =
        goal.kind === "cooked"
          ? db
              .plan(weekStart())
              .meals.filter((m) => m.status === "cooked" && !m.leftoverOf)
              .length
          : goal.kind === "budget"
            ? Math.max(
                0,
                finances(
                  db.expenses(),
                  db.settings(),
                  db.plan(weekStart()),
                  db.recipes(),
                ).remainingCents,
              ) / 100
            : goal.progress;
      if (progress < goal.target)
        throw new AppError(
          400,
          "Complete the linked goal before claiming this reward.",
        );
      r.claimed = true;
      db.run("UPDATE reward SET data=? WHERE id=?", JSON.stringify(r), r.id);
      return r;
    }),
  );
  app.get("/api/providers", async () => {
    let models: any[] = [],
      ollamaError = "";
    try {
      models = await ollamaModels();
    } catch (e: any) {
      ollamaError = e.message;
    }
    return {
      chatgpt: {
        connected: false,
        status:
          "Documentation verification blocked; sign-in not implemented. No subscription access claimed.",
        docs: "https://developers.openai.com/siwc/quickstart",
        usage: "https://chatgpt.com/#settings",
      },
      ollama: { connected: models.length > 0, models, error: ollamaError },
      openai: {
        configured: vault.has("openai"),
        enabled: db.settings().apiEnabled,
      },
      kroger: {
        configured: vault.has("krogerClientId") && vault.has("krogerSecret"),
        location: db.settings().krogerLocationId,
      },
      platform: process.platform,
      credentialStorage:
        process.platform === "darwin"
          ? "macOS Keychain encryption key"
          : "Owner-only encrypted local vault",
    };
  });
  app.post("/api/providers/chatgpt/connect", () => {
    throw new AppError(
      503,
      "Official Sign in with ChatGPT preview documentation is blocked by the environment network policy. OAuth registration and inference requirements must be verified before this connection can be enabled. Use Ollama or explicitly enable API billing in Settings.",
    );
  });
  app.get("/api/providers/openai/models", async () => {
    if (!db.settings().apiEnabled)
      throw new AppError(400, "Enable separately billed API access first.");
    return apiModels(vault);
  });
  app.post("/api/providers/credentials", (req) => {
    const a = z
      .object({
        name: z.enum(["openai", "krogerClientId", "krogerSecret"]),
        value: z.string().max(4000),
      })
      .parse(body(req));
    vault.set(a.name, a.value);
    return { saved: true };
  });
  app.post("/api/chat", async (req) => {
    const a = z
      .object({
        message: z.string().trim().min(1).max(5000),
        week: z.string().default(weekStart()),
      })
      .parse(body(req));
    db.message("user", a.message);
    const state = db.state(a.week);
    const lower = a.message.toLowerCase();
    let output: { reply: string; operations: any[]; recipeIds?: string[] };
    const provider = state.settings.provider;
    try {
      if (provider === "none") {
        if (
          /(takeout|delivery|order).*\$\s*\d|\$\s*\d.*(takeout|delivery)/i.test(
            a.message,
          )
        ) {
          const amount = Math.round(
            Number(a.message.match(/\$\s*(\d+(?:\.\d{1,2})?)/)?.[1] || 0) * 100,
          );
          output = {
            reply: `Reality Check: ${state.settings.tone === "Off" ? "Takeout logging is available." : state.settings.tone === "Savage" ? "Your delivery app is getting very comfortable in the budget." : state.settings.tone === "Firm" ? "Pause and check the budget before placing this order." : "A quick home-cooked option might fit tonight."} This is a proposed expense, not a recorded transaction. Review the merchant, date, portions and full total before confirming. Current monthly budget remaining: $${(finances(state.expenses, state.settings, state.plan, state.recipes).remainingCents / 100).toFixed(2)}.`,
            operations: [
              {
                name: "logTakeout",
                args: {
                  category: "Takeout",
                  merchant: "Takeout — edit merchant before confirming",
                  amountCents: amount,
                  date: today(),
                  portions: state.settings.adults,
                  feesCents: 0,
                  tipCents: 0,
                  taxCents: 0,
                  discountCents: 0,
                  note: "Proposed in chat; total supplied by user",
                },
              },
            ],
            recipeIds: search(db, "Quick", 4).map((r) => r.id),
          };
        } else if (/spen|budget|saving/.test(lower))
          output = {
            reply: (() => {
              const f = finances(
                state.expenses,
                state.settings,
                state.plan,
                state.recipes,
              );
              return `This month, your household has recorded ${money(f.totalCents)} in food spending: ${money(f.groceryCents)} on groceries and ${money(f.takeoutCents)} on takeout and restaurants.\n\n${f.remainingCents >= 0 ? `You have ${money(f.remainingCents)} remaining` : `You are ${money(-f.remainingCents)} over budget`} against your ${money(state.settings.monthlyBudgetCents)} monthly budget.\n\nFor cooked meals in this planning week, estimated takeout avoidance is ${money(f.estimatedAvoidanceCents)}. That uses your chosen takeout baseline and estimated recipe costs; it is a hypothetical comparison, separate from actual spending.`;
            })(),
            operations: [],
          };
        else if (/leftover|ready to eat/.test(lower)) {
          const batches = state.leftovers.filter(
            (b) => b.remaining > 0 && (!b.useBy || b.useBy >= today()),
          );
          output = {
            reply: batches.length
              ? `Your household has these saved portions:\n\n${batches.map((b) => `${b.title}: ${b.remaining} portion${b.remaining === 1 ? "" : "s"} in the ${b.storage.toLowerCase()}${b.useBy ? `, reminder ${b.useBy}` : ""}.`).join("\n")}\n\nOpen Pantry → Leftovers to record what you use. No portions have been changed.`
              : "No usable leftover portions are recorded. Save the actual portions you put away in Pantry → Leftovers.",
            operations: [],
          };
        } else if (/pantry|already have/.test(lower)) {
          const stock = state.pantry.filter(
            (p) => p.quantity > 0 && (!p.expires || p.expires >= today()),
          );
          const suggestions = pantrySuggestions(
            state.recipes,
            stock,
            state.settings.adults,
          ).slice(0, 12);
          output = {
            reply: suggestions.length
              ? `These saved recipes match recorded quantities for ${state.settings.adults} portions, with ingredients due soon first.\n\n${suggestions
                  .slice(0, 4)
                  .map(
                    (m) =>
                      `${m.recipe.title}: ${m.covered} of ${m.total} ingredients covered.`,
                  )
                  .join(
                    "\n",
                  )}\n\nOpen Pantry → Cook from pantry to review missing quantities. Each suggestion considers your stock independently.`
              : "Add a few real pantry quantities to find recipe matches. Expired or zero-quantity stock does not count as available.",
            operations: [],
            recipeIds: suggestions.map((m) => m.recipe.id),
          };
        } else if (/deal|cheaper|price/.test(lower))
          output = {
            reply: `There are ${state.offers.filter((o) => o.expires >= today()).length} current recorded price observations. No live retailer feed is connected by default. Grocery Intelligence compares recorded prices and provides official retailer links; missing prices remain unavailable.`,
            operations: [
              { name: "optimizeShoppingTrip", args: { week: a.week } },
            ],
          };
        else {
          const rs = search(db, a.message, 12).filter(
            (r) => !/dinner/.test(lower) || r.category === "Dinner",
          );
          output = {
            reply:
              "Local recipe helper · AI is not connected. Here are recipe candidates from your saved library. Choose meals to build your week; your existing selections will stay in place.",
            operations: [],
            recipeIds: (rs.length >= 12
              ? rs
              : search(db, a.message, 60)
                  .filter((r) => r.category === "Dinner")
                  .slice(0, 12)
            ).map((r) => r.id),
          };
        }
      } else {
        const context = {
          household: {
            adults: state.settings.adults,
            preferences: state.settings.dietNotes,
          },
          recipes: state.recipes.map((r) => ({
            id: r.id,
            title: r.title,
            favorite: r.favorite,
            rejected: r.rejected,
            ingredients: r.ingredients,
            servings: r.servings,
            version: r.version,
          })),
          plan: state.plan,
          pantry: state.pantry,
          regularItems: state.staples,
          actualLeftovers: state.leftovers.filter((b) => b.remaining > 0),
          groceries: state.groceries,
          finance: finances(
            state.expenses,
            state.settings,
            state.plan,
            state.recipes,
          ),
          history: state.messages
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content })),
        };
        const system =
          "You are Hearth Assistant. Use only supplied household data. Never invent prices, coupons, science claims, or transaction facts. Return JSON {reply:string,operations:[{name,args}]}. Operations are proposals for user review, never already performed. Do not include unrequested changes. Financial transactions and approved plans require explicit confirmation. Tool schemas: " +
          JSON.stringify(
            Object.fromEntries(
              Object.entries(toolSchemas).map(([k, s]) => [
                k,
                z.toJSONSchema(s),
              ]),
            ),
          );
        const raw = await askProvider(
          db,
          vault,
          system,
          JSON.stringify({ context, request: a.message }),
        );
        output = AssistantOutput.parse(
          JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, "")),
        );
      }
      const id = db.message("assistant", output.reply, {
        operations: output.operations,
        recipeIds: output.recipeIds || [],
        provider,
      });
      db.changed("assistant.reply", member(req));
      db.broadcast();
      return { id, ...output, provider };
    } catch (e: any) {
      const reply =
        "No changes applied. " +
        (e instanceof z.ZodError
          ? "The provider returned invalid operations. Try a simpler request."
          : e.message);
      db.message("assistant", reply, { operations: [], provider, error: true });
      db.broadcast();
      throw e;
    }
  });
  app.post("/api/tools/execute", (req) => {
    const a = z
      .object({
        messageId: z.string(),
        index: z.number().int().min(0).max(7),
        confirm: z.literal(true),
        args: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(body(req));
    return mutate(req, "assistant.tool", () => {
      const message = db.one(
        "SELECT data FROM chat_message WHERE id=? AND role=?",
        a.messageId,
        "assistant",
      );
      if (!message) throw new AppError(404, "Assistant proposal not found");
      const data = JSON.parse(message.data),
        o = data.operations?.[a.index];
      if (!o) throw new AppError(404, "Operation not found");
      const callId = a.messageId + ":" + a.index;
      const done = db.one(
        "SELECT result FROM assistant_tool_call WHERE id=?",
        callId,
      );
      if (done) return JSON.parse(done.result);
      const op = Operation.parse({ ...o, args: a.args || o.args });
      const result = executeTool(db, op.name, op.args, member(req), true);
      db.run(
        "INSERT INTO assistant_tool_call VALUES(?,?,?,?,?,?,?)",
        callId,
        a.messageId,
        op.name,
        JSON.stringify(op.args),
        "completed",
        JSON.stringify(result),
        new Date().toISOString(),
      );
      return result;
    });
  });
  app.post("/api/jobs", (req) => {
    const a = z
      .object({
        kind: z.enum([
          "planning",
          "deals",
          "pantry",
          "spending",
          "goals",
          "shopping",
        ]),
        nextRun: z.string().datetime(),
        intervalDays: z.number().int().min(1).max(365).default(7),
        enabled: z.boolean().default(true),
      })
      .parse(body(req));
    return mutate(req, "schedule.create", () => {
      const id = randomUUID();
      db.run(
        "INSERT INTO scheduled_job(id,data,next_run) VALUES(?,?,?)",
        id,
        JSON.stringify({ ...a, id }),
        a.nextRun,
      );
      return { id, ...a };
    });
  });
  app.delete("/api/jobs/:id", (req) => {
    z.object({ confirm: z.literal(true) }).parse(body(req));
    return mutate(req, "schedule.delete", () => {
      db.run("DELETE FROM scheduled_job WHERE id=?", (req.params as any).id);
      return { ok: true };
    });
  });
  app.get("/api/connection", async () => {
    const url = db.settings().publicUrl || process.env.HEARTH_PUBLIC_URL || "";
    return {
      url,
      enabled: !!url,
      verified: false,
      qr: url ? await QRCode.toDataURL(url) : null,
      instructions:
        "Enable Tailscale Serve on your Mac: tailscale serve --bg http://127.0.0.1:4310. Save the resulting HTTPS origin here. The Mac must remain awake. No Funnel or router port forwarding is required.",
    };
  });
  app.post("/api/backup", (req) => ({
    path: db.backup(),
    message:
      "Database backup created on the host. Credential encryption key is not included.",
  }));
  app.get("/api/export", (req, reply) => {
    const data = Object.fromEntries(
      backupTables.map((t) => [t, db.all(`SELECT * FROM ${t}`)]),
    );
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="hearth-export-${today()}.json"`,
      )
      .send({
        format: "hearth-v1",
        createdAt: new Date().toISOString(),
        settings: db.settings(),
        members: db.all("SELECT id,name FROM household_member"),
        data,
      });
  });
  app.post("/api/restore", (req) => {
    const a = z
      .object({
        confirm: z.literal(true),
        snapshot: z.object({
          format: z.literal("hearth-v1"),
          settings: SettingsSchema,
          members: z
            .array(
              z.object({
                id: z.enum(["member-1", "member-2", "member-3"]),
                name: z.string().min(1).max(40),
              }),
            )
            .length(3),
          data: z
            .record(
              z.string(),
              z.array(
                z.record(
                  z.string(),
                  z.union([z.string(), z.number(), z.null()]),
                ),
              ),
            )
            .refine(
              (v) =>
                backupTables.every(
                  (t) =>
                    Array.isArray(v[t]) ||
                    ([
                      "shopping_staple",
                      "leftover_batch",
                      "leftover_event",
                    ].includes(t) &&
                      v[t] === undefined),
                ),
              "Missing backup tables",
            ),
        }),
      })
      .parse(body(req));
    for (const row of a.snapshot.data.recipe)
      RecipeSchema.parse(JSON.parse(String(row.data)));
    for (const row of a.snapshot.data.pantry_item)
      PantryInput.parse(JSON.parse(String(row.data)));
    for (const row of a.snapshot.data.expense)
      ExpenseInput.parse(JSON.parse(String(row.data)));
    for (const row of a.snapshot.data.shopping_staple || [])
      StapleInput.parse(JSON.parse(String(row.data)));
    for (const row of a.snapshot.data.leftover_batch || []) {
      const batch = JSON.parse(String(row.data));
      LeftoverInput.parse(batch);
      if (
        !Number.isInteger(batch.remaining) ||
        batch.remaining < 0 ||
        batch.remaining > batch.portions
      )
        throw new AppError(400, "Invalid remaining leftover portions.");
    }
    db.backup();
    return mutate(req, "backup.restore", () => {
      db.run("UPDATE planned_meal SET leftover_of=NULL");
      for (const t of [...backupTables].reverse()) db.run(`DELETE FROM ${t}`);
      for (const t of backupTables) {
        const columns = db.all(`PRAGMA table_info(${t})`).map((r) => r.name);
        let rows = a.snapshot.data[t] || [];
        if (t === "planned_meal")
          rows = [...rows].sort(
            (x, y) => Number(!!x.leftover_of) - Number(!!y.leftover_of),
          );
        for (const row of rows) {
          if (Object.keys(row).some((k) => !columns.includes(k)))
            throw new AppError(400, "Invalid backup columns.");
          db.run(
            `INSERT INTO ${t} (${columns.map((c) => '"' + c + '"').join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
            ...columns.map((c) => row[c] ?? null),
          );
        }
      }
      db.setSettings(a.snapshot.settings);
      for (const m of a.snapshot.members)
        db.run("UPDATE household_member SET name=? WHERE id=?", m.name, m.id);
      return { restored: true };
    });
  });
  const dist = resolve(
    options.staticDir || process.env.HEARTH_STATIC_DIR || "dist",
  );
  if (existsSync(join(dist, "index.html"))) {
    await app.register(staticFiles, { root: dist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/"))
        return reply.code(404).send({ error: "API endpoint not found" });
      if (/\.[a-z0-9]+(?:\?|$)/i.test(req.url))
        return reply.code(404).send({ error: "File not found" });
      return reply
        .type("text/html")
        .send(readFileSync(join(dist, "index.html")));
    });
  }
  app.addHook("onClose", async () => {
    db.close();
  });
  return { app, db, vault };
}
