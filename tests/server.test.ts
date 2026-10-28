import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../apps/server/src/app.ts";
import { weekStart, today } from "../packages/shared/src/index.ts";
let instance: Awaited<ReturnType<typeof createApp>>,
  dir: string,
  cookie = "";
const week = weekStart();
async function request(
  url: string,
  payload?: unknown,
  method: any = payload === undefined ? "GET" : "POST",
  session = cookie,
) {
  return instance.app.inject({
    url,
    method,
    payload: payload as any,
    headers: {
      ...(session ? { cookie: session } : {}),
      "x-hearth-request": "1",
    },
  });
}
async function json(url: string, payload?: unknown, method?: any) {
  const r = await request(url, payload, method);
  expect(r.statusCode, r.body).toBeLessThan(300);
  return r.json();
}
async function setup() {
  const r = await request("/api/auth/setup", {
    password: "household-test-password",
    names: ["Alex", "Jamie", "Sam"],
  });
  expect(r.statusCode, r.body).toBe(200);
  cookie = r.headers["set-cookie"]!.toString().split(";")[0];
}
async function add(recipeId = "recipe-001") {
  const state = await json("/api/state?week=" + week);
  return json("/api/plan/add", {
    week,
    version: state.plan.version,
    meal: { recipeId, day: 0, type: "Dinner", servings: 3 },
  });
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "hearth-test-"));
  instance = await createApp({ dataDir: dir, testing: true });
  cookie = "";
});
afterEach(async () => {
  await instance.app.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("household security", () => {
  it("requires auth, secure session attributes, CSRF and same origin", async () => {
    expect((await request("/api/state")).statusCode).toBe(401);
    await setup();
    expect(cookie).toContain("hearth_session=");
    const login = await request("/api/auth/login", {
      password: "household-test-password",
      memberId: "member-2",
    });
    expect(login.headers["set-cookie"]).toContain("HttpOnly");
    expect(login.headers["set-cookie"]).toContain("SameSite=Strict");
    const noCsrf = await instance.app.inject({
      url: "/api/settings",
      method: "POST",
      payload: {},
      headers: { cookie },
    });
    expect(noCsrf.statusCode).toBe(403);
    const cross = await instance.app.inject({
      url: "/api/settings",
      method: "POST",
      payload: {},
      headers: {
        cookie,
        "x-hearth-request": "1",
        origin: "https://evil.invalid",
      },
    });
    expect(cross.statusCode).toBe(403);
  });
  it("rejects expired sessions and invalid passwords without exposing credentials", async () => {
    await setup();
    expect(
      (await request("/api/auth/login", { password: "wrong-passphrase" }))
        .statusCode,
    ).toBe(401);
    instance.db.run("UPDATE session SET expires_at=0");
    expect((await request("/api/state")).statusCode).toBe(401);
    const status = await json("/api/auth/status");
    expect(status).not.toHaveProperty("password_hash");
  });
});
describe("planning to shopping", () => {
  it("persists recipes, approves plans, prevents duplicate groceries, preserves traceable sources", async () => {
    await setup();
    let p = await add();
    await json("/api/pantry", {
      name: "potato",
      quantity: 250,
      unit: "g",
      location: "Pantry",
      expires: "2099-01-01",
    });
    await json("/api/plan/approve", { week, version: p.version });
    let state = await json("/api/state?week=" + week);
    expect(state.groceries.find((i: any) => i.name === "potato").quantity).toBe(
      500,
    );
    expect(state.groceries.every((i: any) => i.sources.length)).toBe(true);
    const ids = state.groceries.map((i: any) => i.id);
    await json("/api/groceries/generate", { week });
    state = await json("/api/state?week=" + week);
    expect(state.groceries.map((i: any) => i.id)).toEqual(ids);
    expect(instance.db.one("PRAGMA foreign_key_check")).toBeUndefined();
  });
  it("replaces a single meal, confirms approved-plan changes, and preserves version history", async () => {
    await setup();
    await add();
    let p = await add("recipe-002");
    await json("/api/plan/approve", { week, version: p.version });
    p = (await json("/api/state?week=" + week)).plan;
    const target = p.meals[0];
    const other = p.meals[1];
    const payload = {
      week,
      version: p.version,
      mealId: target.id,
      patch: { recipeId: "recipe-003" },
    };
    expect((await request("/api/plan/update", payload)).statusCode).toBe(409);
    p = await json("/api/plan/update", { ...payload, confirm: true });
    expect(p.meals.find((m: any) => m.id === other.id).recipeId).toBe(
      other.recipeId,
    );
    const history = await json("/api/plan/history?week=" + week);
    expect(history.length).toBeGreaterThan(2);
    expect(
      (await request("/api/plan/update", { ...payload, confirm: true }))
        .statusCode,
    ).toBe(409);
    const old = history.find((v: any) =>
      v.data.meals.some((m: any) => m.recipeId === "recipe-001"),
    );
    const restored = await json("/api/plan/restore", {
      week,
      version: p.version,
      restoreVersion: old.version,
      confirm: true,
    });
    expect(restored.meals.some((m: any) => m.recipeId === "recipe-001")).toBe(
      true,
    );
  });
  it("validates leftovers and does not buy a batch twice", async () => {
    await setup();
    let p = await add();
    p = await json("/api/plan/update", {
      week,
      version: p.version,
      mealId: p.meals[0].id,
      patch: { servings: 6 },
    });
    p = await json("/api/plan/add", {
      week,
      version: p.version,
      meal: {
        recipeId: "recipe-001",
        day: 1,
        type: "Lunch",
        servings: 3,
        leftoverOf: p.meals[0].id,
      },
    });
    await json("/api/plan/approve", { week, version: p.version });
    const state = await json("/api/state?week=" + week);
    expect(
      state.groceries.find((i: any) => i.name === "ground beef").quantity,
    ).toBe(1000);
  });
  it("synchronizes idempotently and retains conflicting offline edits for explicit review", async () => {
    await setup();
    const p = await add();
    await json("/api/plan/approve", { week, version: p.version });
    const state = await json("/api/state?week=" + week);
    const item = state.groceries[0];
    const op = {
      operationId: randomUUID(),
      itemId: item.id,
      version: item.version,
      patch: { purchased: true },
    };
    const first = await json("/api/sync", op);
    expect(first.purchased).toBe(true);
    const replay = await json("/api/sync", op);
    expect(replay.version).toBe(first.version);
    const conflict = await request("/api/sync", {
      ...op,
      operationId: randomUUID(),
      patch: { note: "phone edit" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().details.current.purchased).toBe(true);
  });
  it("records actual checkout once and requires complete prices", async () => {
    await setup();
    const p = await add();
    await json("/api/plan/approve", { week, version: p.version });
    let state = await json("/api/state?week=" + week);
    const item = state.groceries[0];
    let updated = await json("/api/sync", {
      operationId: randomUUID(),
      itemId: item.id,
      version: item.version,
      patch: { purchased: true },
    });
    const checkout = {
      week,
      merchant: "Store",
      date: today(),
      operationId: randomUUID(),
    };
    expect(
      (await request("/api/groceries/checkout", checkout)).statusCode,
    ).toBe(400);
    await json("/api/sync", {
      operationId: randomUUID(),
      itemId: item.id,
      version: updated.version,
      patch: { actualCents: 499 },
    });
    await json("/api/groceries/checkout", checkout);
    await json("/api/groceries/checkout", checkout);
    state = await json("/api/state?week=" + week);
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0].amountCents).toBe(499);
    expect(state.pantry).toHaveLength(0);
  });
});
describe("recalculation and atomic planning", () => {
  it("rolls back an entire selection batch when one recipe is invalid", async () => {
    await setup();
    const state = await json("/api/state");
    const r = await request("/api/plan/add-batch", {
      week,
      version: state.plan.version,
      meals: [
        { recipeId: "recipe-001", day: 0, type: "Dinner", servings: 3 },
        { recipeId: "missing", day: 1, type: "Dinner", servings: 3 },
      ],
    });
    expect(r.statusCode).toBe(404);
    expect((await json("/api/state")).plan.meals).toHaveLength(0);
  });
  it("resets stale purchase flags and totals when required quantities change", async () => {
    await setup();
    const p = await add();
    await json("/api/plan/approve", { week, version: p.version });
    const state = await json("/api/state");
    const item = state.groceries.find((i: any) => i.name === "ground beef");
    await json("/api/sync", {
      operationId: randomUUID(),
      itemId: item.id,
      version: item.version,
      patch: { purchased: true, actualCents: 700 },
    });
    await json("/api/plan/update", {
      week,
      version: state.plan.version,
      mealId: state.plan.meals[0].id,
      confirm: true,
      patch: { servings: 6 },
    });
    const fresh = (await json("/api/state")).groceries.find(
      (i: any) => i.name === "ground beef",
    );
    expect(fresh.purchased).toBe(false);
    expect(fresh.actualCents).toBeNull();
    expect(fresh.quantity).toBe(1000);
    expect(fresh.id).not.toBe(item.id);
    expect(fresh.note).toContain("700 cents");
  });
});
describe("assistant, persistence and recovery", () => {
  it("proposes takeout without recording it, validates confirmation, and prevents duplicate tool effects", async () => {
    await setup();
    const chat = await json("/api/chat", {
      message: "We're going to order $55 worth of takeout.",
      week,
    });
    expect(chat.operations[0].name).toBe("logTakeout");
    expect((await json("/api/state")).expenses).toHaveLength(0);
    expect(
      (
        await request("/api/tools/execute", {
          messageId: chat.id,
          index: 0,
          confirm: false,
        })
      ).statusCode,
    ).toBe(400);
    const confirmation = {
      messageId: chat.id,
      index: 0,
      confirm: true,
      args: { ...chat.operations[0].args, merchant: "Our restaurant" },
    };
    await json("/api/tools/execute", confirmation);
    await json("/api/tools/execute", confirmation);
    const state = await json("/api/state");
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0].amountCents).toBe(5500);
  });
  it("finds 12 actual recipe candidates without external AI", async () => {
    await setup();
    const r = await json("/api/chat", {
      message: "Give us six beef and potato dinners for next week.",
      week,
    });
    expect(r.recipeIds).toHaveLength(12);
    expect(r.provider).toBe("none");
    expect(r.recipeIds.every((id: string) => instance.db.recipe(id))).toBe(
      true,
    );
  });
  it("survives a real database close and restart", async () => {
    await setup();
    await add();
    await instance.app.close();
    instance = await createApp({ dataDir: dir, testing: true });
    const state = await json("/api/state?week=" + week);
    expect(state.plan.meals).toHaveLength(1);
    expect(state.recipes).toHaveLength(60);
  });
  it("exports and transactionally restores household content, preserving authentication", async () => {
    await setup();
    await add();
    const snapshot = await json("/api/export");
    expect(JSON.stringify(snapshot)).not.toContain("password_hash");
    expect(snapshot.data).not.toHaveProperty("secret");
    await json("/api/pantry", {
      name: "rice",
      quantity: 1000,
      unit: "g",
      location: "Pantry",
    });
    expect((await json("/api/state")).pantry).toHaveLength(1);
    await json("/api/restore", { snapshot, confirm: true });
    const state = await json("/api/state");
    expect(state.pantry).toHaveLength(0);
    expect(state.plan.meals).toHaveLength(1);
    const backup = await json("/api/backup", {});
    expect(existsSync(backup.path)).toBe(true);
  });
  it("retains available manual workflows when external integrations are absent", async () => {
    await setup();
    const noProvider = await request("/api/deals/scan", { week, live: true });
    expect(noProvider.statusCode).toBe(400);
    const blocked = await request("/api/providers/chatgpt/connect", {});
    expect(blocked.statusCode).toBe(503);
    const observations = await json("/api/deals/observations", {
      ingredient: "milk",
      product: "Whole milk",
      store: "Store",
      quantity: 1,
      unit: "gal",
      priceCents: 499,
      expires: today(),
    });
    expect(observations.verification).toBe("User-entered price");
    const state = await json("/api/state");
    expect(state.settings.apiEnabled).toBe(false);
    expect(state.offers).toHaveLength(1);
  });
});

describe("one-screen grocery checkout", () => {
  async function prepare() {
    await setup();
    const plan = await add();
    await json("/api/plan/approve", { week, version: plan.version });
    let items = (await json("/api/state")).groceries.slice(0, 2);
    for (const item of items)
      await json("/api/sync", {
        operationId: randomUUID(),
        itemId: item.id,
        version: item.version,
        patch: { purchased: true },
      });
    return (await json("/api/state")).groceries.filter((i: any) => i.purchased);
  }
  it("records reviewed prices and one exact transaction atomically, excluding prior purchases", async () => {
    const items = await prepare();
    const payload = {
      week,
      merchant: "Market",
      date: today(),
      operationId: randomUUID(),
      items: items.map((i: any, n: number) => ({
        id: i.id,
        version: i.version,
        actualCents: n ? 265 : 735,
      })),
    };
    await json("/api/groceries/checkout", payload);
    await json("/api/groceries/checkout", payload);
    const state = await json("/api/state");
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0].amountCents).toBe(1000);
    expect(state.groceries.filter((i: any) => i.recorded)).toHaveLength(2);
  });
  it("rolls back every price and the expense if any reviewed item is stale", async () => {
    const items = await prepare();
    await json("/api/sync", {
      operationId: randomUUID(),
      itemId: items[1].id,
      version: items[1].version,
      patch: { note: "A different shopper edited this" },
    });
    const r = await request("/api/groceries/checkout", {
      week,
      merchant: "Market",
      date: today(),
      operationId: randomUUID(),
      items: items.map((i: any) => ({
        id: i.id,
        version: i.version,
        actualCents: 999,
      })),
    });
    expect(r.statusCode).toBe(409);
    const state = await json("/api/state");
    expect(state.expenses).toHaveLength(0);
    expect(
      state.groceries
        .filter((i: any) => i.purchased)
        .every((i: any) => i.actualCents === null),
    ).toBe(true);
  });
  it("requires review again if the checked item set changes on another device", async () => {
    const items = await prepare();
    await json("/api/sync", {
      operationId: randomUUID(),
      itemId: items[1].id,
      version: items[1].version,
      patch: { purchased: false },
    });
    const r = await request("/api/groceries/checkout", {
      week,
      merchant: "Market",
      date: today(),
      operationId: randomUUID(),
      items: items.map((i: any) => ({
        id: i.id,
        version: i.version,
        actualCents: 100,
      })),
    });
    expect(r.statusCode).toBe(409);
    expect((await json("/api/state")).expenses).toHaveLength(0);
  });
});

describe("regular items and actual leftovers", () => {
  it("builds an unapproved week from regular needs, deducts stock and prevents duplicate regular identities", async () => {
    await setup();
    await json("/api/pantry", {
      name: "milk",
      quantity: 0.25,
      unit: "l",
      location: "Refrigerator",
    });
    const s = await json("/api/staples", {
      name: "whole milk",
      quantity: 1,
      unit: "l",
      department: "Dairy & eggs",
    });
    expect(
      (
        await request("/api/staples", {
          name: "milk",
          quantity: 500,
          unit: "ml",
        })
      ).statusCode,
    ).toBe(409);
    await json("/api/staples/apply", { week });
    let state = await json("/api/state");
    expect(state.plan.approved).toBe(false);
    expect(state.groceries.find((i: any) => i.name === "milk").quantity).toBe(
      750,
    );
    expect(state.staples).toHaveLength(1);
    const ids = state.groceries.map((i: any) => i.id);
    await json("/api/staples/apply", { week });
    expect((await json("/api/state")).groceries.map((i: any) => i.id)).toEqual(
      ids,
    );
    await json(
      `/api/staples/${s.id}`,
      { version: s.version, item: { ...s, enabled: false } },
      "PATCH",
    );
    expect(
      (
        await request(
          `/api/staples/${s.id}`,
          { version: s.version, item: s },
          "PATCH",
        )
      ).statusCode,
    ).toBe(409);
    await json("/api/staples/apply", { week });
    expect((await json("/api/state")).groceries).toHaveLength(0);
  });
  it("merges regular and approved recipe needs while preserving traceable sources", async () => {
    await setup();
    await json("/api/staples", {
      name: "potatoes",
      quantity: 1000,
      unit: "g",
      department: "Produce",
    });
    const plan = await add();
    await json("/api/plan/approve", { week, version: plan.version });
    const stock = (await json("/api/state")).groceries.filter(
      (i: any) => i.name === "potato",
    );
    expect(stock).toHaveLength(1);
    expect(stock[0].quantity).toBe(1000);
    expect(stock[0].sources).toHaveLength(2);
  });
  it("logs a real batch, applies a portion once and rejects stale consumption or over-restoration", async () => {
    await setup();
    const input = {
      title: "Saved stew",
      recipeId: "recipe-001",
      portions: 3,
      storage: "Refrigerator",
      cookedOn: today(),
      useBy: today(),
      operationId: randomUUID(),
    };
    const batch = await json("/api/leftovers", input);
    await json("/api/leftovers", input);
    expect((await json("/api/state")).leftovers).toHaveLength(1);
    const op = {
      operationId: randomUUID(),
      version: batch.version,
      kind: "eat",
      portions: 1,
    };
    const used = await json(`/api/leftovers/${batch.id}/use`, op);
    await json(`/api/leftovers/${batch.id}/use`, op);
    let state = await json("/api/state");
    expect(state.leftovers[0].remaining).toBe(2);
    expect(state.expenses).toHaveLength(0);
    expect(state.plan.meals).toHaveLength(0);
    expect(
      (
        await request(`/api/leftovers/${batch.id}/use`, {
          ...op,
          operationId: randomUUID(),
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(`/api/leftovers/${batch.id}/use`, {
          operationId: randomUUID(),
          version: used.version,
          kind: "restore",
          portions: 2,
        })
      ).statusCode,
    ).toBe(400);
    const restored = await json(`/api/leftovers/${batch.id}/use`, {
      operationId: randomUUID(),
      version: used.version,
      kind: "restore",
      portions: 1,
    });
    expect(restored.remaining).toBe(3);
  });
  it("updates storage/reminders without resurrecting eaten portions and preserves data across reopen/export/restore", async () => {
    await setup();
    const batch = await json("/api/leftovers", {
      title: "Rice bowl",
      portions: 4,
      storage: "Refrigerator",
      cookedOn: today(),
      operationId: randomUUID(),
    });
    const used = await json(`/api/leftovers/${batch.id}/use`, {
      operationId: randomUUID(),
      version: batch.version,
      kind: "eat",
      portions: 2,
    });
    await json(
      `/api/leftovers/${batch.id}`,
      { version: used.version, item: { ...batch, storage: "Freezer" } },
      "PATCH",
    );
    const snapshot = await json("/api/export");
    await instance.app.close();
    instance = await createApp({ dataDir: dir, testing: true });
    let state = await json("/api/state");
    expect(state.leftovers[0].remaining).toBe(2);
    expect(state.leftovers[0].storage).toBe("Freezer");
    await json("/api/restore", { snapshot, confirm: true });
    expect((await json("/api/state")).leftovers[0].remaining).toBe(2);
    delete snapshot.data.shopping_staple;
    delete snapshot.data.leftover_batch;
    delete snapshot.data.leftover_event;
    await json("/api/restore", { snapshot, confirm: true });
    expect((await json("/api/state")).leftovers).toHaveLength(0);
  });
  it("migrates an existing version-one household without losing recipes or inventory", async () => {
    await setup();
    await json("/api/pantry", {
      name: "rice",
      quantity: 123,
      unit: "g",
      location: "Pantry",
    });
    instance.db.db.exec(
      "DROP TABLE leftover_event; DROP TABLE leftover_batch; DROP TABLE shopping_staple; DELETE FROM schema_migration WHERE version=2;",
    );
    await instance.app.close();
    instance = await createApp({ dataDir: dir, testing: true });
    const state = await json("/api/state");
    expect(state.recipes).toHaveLength(60);
    expect(state.pantry[0].quantity).toBe(123);
    expect(state.staples).toEqual([]);
    expect(state.leftovers).toEqual([]);
    expect(
      instance.db.one("SELECT version FROM schema_migration WHERE version=2")
        .version,
    ).toBe(2);
  });
});

describe("assistant access to real household food", () => {
  it("reports recorded leftovers without using them and avoids fictitious pantry matches", async () => {
    await setup();
    let reply = await json("/api/chat", {
      message: "Cook with what we already have.",
      week,
    });
    expect(reply.recipeIds).toEqual([]);
    await json("/api/leftovers", {
      title: "Sunday stew",
      portions: 2,
      storage: "Refrigerator",
      cookedOn: today(),
      operationId: randomUUID(),
    });
    reply = await json("/api/chat", {
      message: "What leftovers are ready to eat?",
      week,
    });
    expect(reply.reply).toContain("Sunday stew: 2 portions");
    expect((await json("/api/state")).leftovers[0].remaining).toBe(2);
    expect((await json("/api/state")).expenses).toHaveLength(0);
  });
});
