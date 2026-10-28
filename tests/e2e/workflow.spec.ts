import { test, expect, type Page, type BrowserContext } from "@playwright/test";
const password = "hearth-test-passphrase";
async function openHousehold(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Household passphrase")).toBeVisible();
  await page.getByLabel("Household passphrase").fill(password);
  const create = page.getByRole("button", { name: "Create our household" });
  if (await create.isVisible()) await create.click();
  else await page.getByRole("button", { name: "Open my kitchen" }).click();
  await expect(
    page.getByRole("heading", { name: "A good week starts at home." }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width || 1000) < 700) {
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  }
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name, exact: name !== "Groceries" })
    .click();
}
let fixtureCookie = "";
test.beforeEach(async ({ request, context, baseURL }, info) => {
  // Every scenario keeps real rate limits enabled. Respect the server's window
  // before starting another burst of simulated household/device traffic.
  const budget = await request.get("/api/health");
  if (
    budget.status() === 429 ||
    Number(budget.headers()["x-ratelimit-remaining"] ?? 300) < 110
  ) {
    test.setTimeout(125000);
    const waitMs =
      Math.max(
        1,
        Number(
          budget.headers()["x-ratelimit-reset"] ||
            budget.headers()["retry-after"] ||
            1,
        ),
      ) *
        1000 +
      150;
    console.log(
      `Respecting the application's rate limit; waiting ${Math.ceil(waitMs / 1000)} seconds before the next scenario.`,
    );
    let remaining = waitMs;
    while (remaining > 0) {
      const slice = Math.min(10000, remaining);
      await new Promise((resolve) => setTimeout(resolve, slice));
      remaining -= slice;
    }
    expect((await request.get("/api/health")).ok()).toBe(true);
  }
  if (!fixtureCookie) {
    const status = await (await request.get("/api/auth/status")).json();
    const r = await request.post(
      status.setup ? "/api/auth/login" : "/api/auth/setup",
      {
        headers: { "x-hearth-request": "1" },
        data: status.setup
          ? { password }
          : { password, names: ["Alex", "Jamie", "Sam"] },
      },
    );
    expect(r.ok()).toBe(true);
    fixtureCookie = r.headers()["set-cookie"].split(";")[0];
  }
  const headers = { "x-hearth-request": "1", cookie: fixtureCookie };
  const snapshot = await (await request.get("/api/export", { headers })).json();
  for (const name of [
    "planned_meal",
    "meal_completion",
    "meal_plan_version",
    "grocery_item",
    "grocery_list",
    "grocery_purchase",
    "expense",
    "chat_message",
    "assistant_tool_call",
    "sync_event",
    "audit_log",
    "price_observation",
    "notification",
    "pantry_item",
    "inventory_transaction",
    "shopping_staple",
    "leftover_batch",
    "leftover_event",
  ])
    snapshot.data[name] = [];
  for (const p of snapshot.data.meal_plan) {
    p.version = 1;
    p.approved = 0;
  }
  expect(
    (
      await request.post("/api/restore", {
        headers,
        data: { snapshot, confirm: true },
      })
    ).ok(),
  ).toBe(true);
  if (
    info.title.startsWith("offline") ||
    info.title.includes("shopping mode")
  ) {
    const state = await (await request.get("/api/state", { headers })).json();
    const p = await (
      await request.post("/api/plan/add", {
        headers,
        data: {
          week: state.plan.week,
          version: state.plan.version,
          meal: { recipeId: "recipe-001", day: 0, type: "Dinner", servings: 3 },
        },
      })
    ).json();
    expect(
      (
        await request.post("/api/plan/approve", {
          headers,
          data: { week: p.week, version: p.version },
        })
      ).ok(),
    ).toBe(true);
  }
  if (info.title.startsWith("usability"))
    await context.addCookies([
      {
        name: "hearth_session",
        value: fixtureCookie.slice(fixtureCookie.indexOf("=") + 1),
        url: baseURL!,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
});
test("plan recipes, sync a phone shopping edit, log takeout, and restore a backup", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openHousehold(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await navigate(page, "Recipes");
  await expect(
    page.getByRole("heading", { name: "Find your kind of delicious." }),
  ).toBeVisible();
  await expect(page.locator(".recipe-card")).toHaveCount(19); // default time excludes the long stew
  await page.getByLabel("Cravings").fill("beef potatoes creamy");
  await page.getByRole("button", { name: "Find ideas", exact: true }).click();
  await expect(page.locator(".recipe-card")).toHaveCount(12);
  for (let i = 0; i < 6; i++)
    await page
      .locator(".recipe-card")
      .nth(i)
      .getByRole("button", { name: /^Select / })
      .click();
  await page.getByRole("button", { name: "Add to our week" }).click();
  await page.getByRole("button", { name: "Add selected meals" }).click();
  await expect(
    page.getByRole("heading", { name: "Less “what’s for dinner?”" }),
  ).toBeVisible();
  await expect(page.locator(".planned-meal")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Approve & make grocery list" })
    .click();
  await expect(
    page.getByRole("button", { name: "Approved · groceries ready" }),
  ).toBeVisible();
  await navigate(page, "Recipes");
  await expect(page.locator(".selection-bar")).toHaveCount(0);
  await navigate(page, "Groceries");
  await expect(page.locator(".grocery-row").first()).toBeVisible();
  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await other.newPage();
  await openHousehold(phone);
  await navigate(phone, "Groceries");
  const check = phone.getByRole("checkbox", { name: /^Purchased / }).first();
  const label = await check.getAttribute("aria-label");
  await check.click();
  await expect(
    phone.getByRole("checkbox", { name: label!, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("checkbox", { name: label!, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  // Browser state remains within the viewport at both target sizes.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-shopping.png`,
    fullPage: true,
  });
  await navigate(page, "Assistant");
  await page
    .getByLabel("Message Hearth Assistant")
    .fill("We're going to order $55 worth of takeout.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: "Review expense", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review expense", exact: true })
    .click();
  await page
    .getByLabel("Store or restaurant", { exact: true })
    .fill("Our takeout place");
  await page
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await navigate(page, "Spending");
  await expect(
    page.getByText("Our takeout place", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".expense-total strong").first()).toHaveText(
    "$55.00",
  );
  const state = await page.request.get("/api/state");
  expect(
    (await state.json()).expenses.some((e: any) => e.amountCents === 5500),
  ).toBe(true);
  await navigate(page, "Settings");
  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(page.getByRole("status")).toContainText("backup created");
  const exported = await page.request.get("/api/export");
  const snapshot = await exported.json();
  const restored = await page.request.post("/api/restore", {
    headers: { "x-hearth-request": "1" },
    data: { snapshot, confirm: true },
  });
  expect(restored.ok()).toBe(true);
  await other.close();
  expect(errors).toEqual([]);
});
test("offline grocery edits survive reload and synchronize on reconnection", async ({
  page,
  context,
}) => {
  await openHousehold(page);
  await navigate(page, "Groceries");
  await expect(page.locator(".grocery-row").first()).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(async () => {
    const cache = await caches.open("hearth-shell-v2");
    return (await cache.keys()).some((r) => r.url.includes("/assets/"));
  });
  const first = page.getByRole("checkbox", { name: /^Purchased / }).first();
  const label = await first.getAttribute("aria-label");
  const was = await first.getAttribute("aria-checked");
  await context.setOffline(true);
  await first.click();
  await expect(
    page.getByRole("checkbox", { name: label!, exact: true }),
  ).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A better kind of grocery run." }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: label!, exact: true }),
  ).toHaveAttribute("aria-checked", was === "true" ? "false" : "true");
  await context.setOffline(false);
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const state = await page.request.get("/api/state");
  const item = (await state.json()).groceries.find(
    (i: any) => "Purchased " + i.name === label,
  );
  expect(item.purchased).toBe(was !== "true");
});

test("usability: keep recipe choices, use browser history, and add a calendar meal directly", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A good week starts at home." }),
  ).toBeVisible();
  await navigate(page, "Recipes");
  const first = page.locator(".recipe-card").first();
  const title = await first.locator("h3").innerText();
  await first.getByRole("button", { name: /^Select / }).click();
  await navigate(page, "Pantry");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Find your kind of delicious." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Deselect ${title}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Deselect ${title}`, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quick search", exact: true }).click();
  await page.getByLabel("Search HEARTH").fill("potato & cheddar frittata");
  await page.getByLabel("Search HEARTH").press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Potato & cheddar frittata" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await navigate(page, "Meal planner");
  await expect(
    page.getByRole("button", { name: "Add breakfast on Tuesday", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Show empty breakfast, lunch & snack slots").check();
  await expect(
    page.getByRole("button", { name: "Add breakfast on Tuesday", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Show empty breakfast, lunch & snack slots").uncheck();
  await page
    .getByRole("button", { name: "Add dinner on Tuesday", exact: true })
    .click();
  await page.getByLabel("Find a recipe for this meal").fill("creamy beef");
  await page
    .getByRole("button", {
      name: "Choose Creamy beef & golden potatoes",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add meal", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".calendar-day").nth(1).getByRole("button", {
      name: "Creamy beef & golden potatoes",
      exact: true,
    }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.plan.meals).toHaveLength(1);
  expect(state.plan.meals[0].day).toBe(1);
  await page.screenshot({
    path: `test-results/${info.project.name}-direct-planning.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("usability: shopping mode, undo, one-screen checkout and readable assistant confirmation", async ({
  page,
}, info) => {
  await page.goto("/");
  await navigate(page, "Groceries");
  await page.getByLabel("Search shopping list").fill("ground beef");
  await expect(page.locator(".grocery-row")).toHaveCount(1);
  const beef = page.getByRole("checkbox", {
    name: "Purchased ground beef",
    exact: true,
  });
  await beef.click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(beef).toHaveAttribute("aria-checked", "false");
  await beef.click();
  await expect(beef).toHaveAttribute("aria-checked", "true");
  await page
    .getByRole("button", { name: "Shopping mode", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit shopping mode" }),
  ).toBeVisible();
  await page.getByLabel("Search shopping list").fill("potato");
  await page
    .getByRole("checkbox", { name: "Purchased potato", exact: true })
    .click();
  const finish = page.getByRole("button", {
    name: "Finish shopping (2)",
    exact: true,
  });
  await expect(finish).toBeEnabled();
  await finish.click();
  await page.getByLabel("Paid for ground beef").fill("7.35");
  await page.getByLabel("Paid for potato").fill("2.65");
  await page.getByLabel("Store or stores").fill("Test Market");
  await page
    .getByRole("button", { name: "Record $10.00 purchase", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("$10.00");
  let state = await (await page.request.get("/api/state")).json();
  expect(state.expenses).toHaveLength(1);
  expect(state.expenses[0].amountCents).toBe(1000);
  expect(state.groceries.filter((i: any) => i.recorded)).toHaveLength(2);
  await expect(
    page.getByRole("button", { name: "Finish shopping", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Exit shopping mode" }).click();
  await page.getByLabel("Search shopping list").fill("");
  await page.screenshot({
    path: `test-results/${info.project.name}-smooth-shopping.png`,
    fullPage: true,
  });
  await navigate(page, "Assistant");
  await page
    .getByLabel("Message Hearth Assistant")
    .fill("We're ordering $55 takeout.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .getByRole("button", { name: "Review expense", exact: true })
    .click();
  await expect(
    page.getByLabel("Proposed fields (editable JSON)"),
  ).not.toBeVisible();
  await page
    .getByLabel("Store or restaurant", { exact: true })
    .fill("Pasta place");
  await page.getByLabel("Delivery or service fees ($)").fill("5.00");
  await page.getByLabel("Tip ($)", { exact: true }).fill("3.00");
  await page.screenshot({
    path: `test-results/${info.project.name}-expense-review.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Completed", exact: true }),
  ).toBeDisabled();
  state = await (await page.request.get("/api/state")).json();
  expect(state.expenses).toHaveLength(2);
  const expense = state.expenses.find((e: any) => e.merchant === "Pasta place");
  expect(expense.amountCents + expense.feesCents + expense.tipCents).toBe(6300);
});

test("usability: weekly regulars become a pantry-aware list without a meal plan", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Groceries");
  await page
    .getByRole("button", { name: "Regular items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add a regular item", exact: true })
    .click();
  await page
    .getByLabel("Ingredient or household item", { exact: true })
    .fill("milk");
  await page.getByLabel("Usual weekly amount").fill("1");
  await page
    .getByRole("combobox", { name: "Unit", exact: true })
    .selectOption("l");
  await page
    .getByRole("button", { name: "Save regular item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.request.post("/api/pantry", {
    headers: { "x-hearth-request": "1" },
    data: { name: "milk", quantity: 250, unit: "ml", location: "Refrigerator" },
  });
  await page
    .getByRole("button", { name: "Update this week’s list", exact: true })
    .click();
  await expect(page.locator(".grocery-row")).toHaveCount(1);
  await expect(page.locator(".grocery-name")).toContainText("750 ml");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.plan.approved).toBe(false);
  expect(state.plan.meals).toHaveLength(0);
  expect(state.staples).toHaveLength(1);
  expect(state.groceries[0].sources[0]).toContain("Regular item");
  await page.request.post("/api/staples", {
    headers: { "x-hearth-request": "1" },
    data: {
      name: "dish soap",
      quantity: 1,
      unit: "each",
      department: "Household staples",
    },
  });
  await page
    .getByRole("button", { name: "Regular items", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Update this week’s list", exact: true })
    .click();
  await expect(page.locator(".shopping-summary")).toContainText(
    "Partial · 1 item needs a price",
  );
  await expect(
    page.locator(".grocery-row").filter({ hasText: "dish soap" }),
  ).toContainText("No estimate");
});
test("usability: use-soon suggestions show real missing quantities and exclude expired stock", async ({
  page,
}, info) => {
  await page.goto("/");
  const now = new Date(),
    tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
    yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  for (const [name, quantity, unit, expires] of [
    ["ground beef", 500, "g", yesterday],
    ["potato", 200, "g", ""],
    ["onion", 120, "g", ""],
    ["cream", 90, "ml", tomorrow],
    ["butter", 15, "g", ""],
    ["salt", 3, "g", ""],
  ] as const) {
    const response = await page.request.post("/api/pantry", {
      headers: { "x-hearth-request": "1" },
      data: { name, quantity, unit, expires, location: "Refrigerator" },
    });
    expect(response.ok()).toBe(true);
  }
  await navigate(page, "Pantry");
  await expect(
    page.getByRole("button", { name: "Find a meal for these", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review 1 past-date item", exact: true })
    .click();
  await expect(page.locator(".inventory-row")).toHaveCount(1);
  await expect(page.locator(".inventory-row")).toContainText("ground beef");
  await page
    .getByRole("button", { name: "Cook from pantry", exact: true })
    .click();
  const card = page.locator(".pantry-meal-card").filter({
    has: page.getByRole("heading", {
      name: "Creamy beef & golden potatoes",
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("4 of 6 ingredients covered");
  await expect(card).toContainText("ground beef · 500 g");
  await expect(card).toContainText("potato · 550 g");
  await expect(card).toContainText("Uses soon: cream");
  await page.screenshot({
    path: `test-results/${info.project.name}-pantry-matches.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("usability: actual leftover portions synchronize and can be undone without adding spending", async ({
  page,
  browser,
  baseURL,
}, info) => {
  await page.goto("/");
  await navigate(page, "Pantry");
  await page.getByRole("button", { name: /^Leftovers \(/ }).click();
  await page
    .getByRole("button", { name: "Save leftovers", exact: true })
    .click();
  await page.getByLabel("What did you save?").fill("Sunday stew");
  await page.getByLabel("Portions actually saved").fill("3");
  await page
    .getByRole("button", { name: "Save leftover portions", exact: true })
    .click();
  await expect(page.locator(".leftover-amount strong")).toHaveText("3");
  await page.getByRole("button", { name: "Use portions", exact: true }).click();
  await expect(page.locator(".leftover-amount strong")).toHaveText("2");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".leftover-amount strong")).toHaveText("3");
  const other = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await other.addCookies([
    {
      name: "hearth_session",
      value: fixtureCookie.slice(fixtureCookie.indexOf("=") + 1),
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  const phone = await other.newPage();
  await phone.goto("/");
  await navigate(phone, "Pantry");
  await phone.getByRole("button", { name: /^Leftovers \(/ }).click();
  await expect(phone.locator(".leftover-amount strong")).toHaveText("3");
  await page.getByLabel("Portions to use from Sunday stew").selectOption("2");
  await page.getByRole("button", { name: "Use portions", exact: true }).click();
  await expect(phone.locator(".leftover-amount strong")).toHaveText("1");
  await page.reload();
  await expect(page.locator(".leftover-amount strong")).toHaveText("1");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.expenses).toHaveLength(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-leftovers.png`,
    fullPage: true,
  });
  await other.close();
});
test("usability: cooking steps, gathered ingredients and kitchen timers survive reload", async ({
  page,
}, info) => {
  await page.goto("/");
  await navigate(page, "Recipes");
  await page
    .getByRole("button", {
      name: "View Creamy beef & golden potatoes",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  const cooking = page.getByRole("dialog", {
    name: "Cooking: Creamy beef & golden potatoes",
    exact: true,
  });
  await cooking.getByRole("checkbox", { name: /ground beef/ }).check();
  await cooking.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(cooking).toContainText("STEP 2 OF 4");
  await cooking
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start cooking", exact: true })
    .click();
  await expect(cooking).toContainText("STEP 2 OF 4");
  await expect(
    cooking.getByRole("checkbox", { name: /ground beef/ }),
  ).toBeChecked();
  await cooking
    .getByRole("button", { name: "Set a kitchen timer", exact: true })
    .click();
  await cooking.getByLabel("Kitchen timer label").fill("Test rice");
  await cooking.getByLabel("Kitchen timer minutes").fill("0");
  await cooking.getByLabel("Kitchen timer seconds").fill("1");
  await cooking.getByLabel("Play a sound when finished").uncheck();
  await cooking
    .getByRole("button", { name: "Start timer", exact: true })
    .click();
  await expect(cooking.locator(".inline-kitchen-timers")).toContainText(
    "Finished",
    { timeout: 5000 },
  );
  await cooking
    .getByRole("button", { name: "Dismiss timer Test rice", exact: true })
    .click();
  await cooking.getByLabel("Kitchen timer label").fill("Simmer");
  await cooking.getByLabel("Kitchen timer minutes").fill("1");
  await cooking.getByLabel("Kitchen timer seconds").fill("0");
  await cooking
    .getByRole("button", { name: "Start timer", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/${info.project.name}-cooking-mode.png`,
    fullPage: true,
  });
  await cooking
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open kitchen timers", exact: true })
    .click();
  const timers = page.getByRole("dialog", {
    name: "Your kitchen timers",
    exact: true,
  });
  await expect(timers).toContainText("Simmer");
  await timers
    .getByRole("button", { name: "Pause timer Simmer", exact: true })
    .click();
  await expect(
    timers.getByRole("button", { name: "Resume timer Simmer", exact: true }),
  ).toBeVisible();
  await timers
    .getByRole("button", { name: "Dismiss timer Simmer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open kitchen timers", exact: true }),
  ).toHaveCount(0);
});
