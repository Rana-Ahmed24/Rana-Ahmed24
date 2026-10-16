import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { cairoToday, moveMonth } from "../../src/lib/expenses";

const origin = "http://127.0.0.1:3100";
const today = cairoToday();
const month = today.slice(0, 7);
async function openTracker(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your month, at a glance/ })).toBeVisible();
  await expect(page.getByTestId("monthly-total")).toHaveText("0.00");
}
async function create(context: BrowserContext, overrides = {}) {
  const input = {
    id: randomUUID(),
    expense_date: today,
    amount_piastres: 10029,
    description: "Test groceries",
    category: "Groceries",
    notes: "Fresh vegetables",
    ...overrides,
  };
  const response = await context.request.post(`${origin}/api/expenses`, {
    headers: { origin },
    data: input,
  });
  expect(response.status()).toBe(201);
  return (await response.json()).expense;
}
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:4311/__test/reset");
});

test("opens directly without keys or cookies and saves across reloads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openTracker(page);
  await expect(page.getByRole("button", { name: "Lock this device" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add expense", exact: true }).last().click();
  await page.getByLabel("Amount", { exact: true }).fill("123.45");
  await page.getByLabel("What was it for?").fill("Weekly groceries");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("123.45");
  await page.reload();
  await expect(page.getByTestId("monthly-total")).toHaveText("123.45");
  expect(errors).toEqual([]);
});

test("sharing sends the ordinary website address to a fresh phone", async ({ page, browser }) => {
  await openTracker(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { url: string }) => {
        Reflect.set(window, "sharedFamilyUrl", data.url);
      },
    });
  });
  await page.getByRole("button", { name: "Share family link" }).click();
  const shared = await page.evaluate(() => Reflect.get(window, "sharedFamilyUrl") as string);
  expect(shared).toBe(origin + "/");
  const context = await browser.newContext();
  const dad = await context.newPage();
  await dad.goto(shared);
  await expect(dad.getByTestId("monthly-total")).toHaveText("0.00");
  await context.close();
});

test("old key-bearing URLs open directly and become the normal address", async ({ page }) => {
  await page.goto("/#key=obsolete-key-no-longer-needed");
  await expect(page.getByTestId("monthly-total")).toHaveText("0.00");
  expect(new URL(page.url()).hash).toBe("");
});

test("opening the tracker does not require an access exchange", async ({ page }) => {
  await page.route("**/api/access", (route) => route.abort());
  await openTracker(page);
  await expect(page.getByLabel("Have your family link? Paste it here")).toHaveCount(0);
});

test("two phones see shared changes and warn about stale edits and stale deletion", async ({
  page,
  browser,
}) => {
  await openTracker(page);
  const expense = await create(page.context());
  await page.getByRole("button", { name: "Refresh expenses" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("100.29");
  await page.getByRole("button", { name: "Edit Test groceries" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("200.00");
  const other = await browser.newContext();
  const dad = await other.newPage();
  await dad.goto(origin + "/");
  await expect(dad.getByTestId("monthly-total")).toHaveText("100.29");
  await dad.getByRole("button", { name: "Edit Test groceries" }).click();
  await dad.getByLabel("Amount", { exact: true }).fill("150.50");
  await dad.getByRole("button", { name: "Save changes" }).click();
  await expect(dad.getByTestId("monthly-total")).toHaveText("150.50");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed or deleted");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("200.00");
  const staleDelete = await page
    .context()
    .request.delete(`/api/expenses/${expense.id}`, { headers: { origin }, data: { version: 1 } });
  expect(staleDelete.status()).toBe(409);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reload latest version" }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("150.50");
  await page.getByRole("button", { name: "Close expense form" }).click();
  await page.getByRole("button", { name: "Refresh expenses" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("150.50");
  await other.close();
});

test("failed saves preserve fields, retries don't duplicate entries, and delete requires confirmation", async ({
  page,
  request,
}) => {
  await openTracker(page);
  await page.getByRole("button", { name: "Add expense", exact: true }).last().click();
  await page.getByLabel("Amount", { exact: true }).fill("0.29");
  await page.getByLabel("What was it for?").fill("Tiny expense");
  await request.post("http://127.0.0.1:4311/__test/fail-next");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Couldn't reach");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("0.29");
  await page.getByRole("button", { name: "Save expense", exact: true }).dblclick();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByTestId("monthly-total")).toHaveText("0.29");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Delete Tiny expense" }).click();
  await expect(page.getByRole("heading", { name: "Tiny expense" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Tiny expense" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("0.00");
});

test("previous months, day selection, decimal totals, and CSV downloads retain details", async ({
  page,
}) => {
  await openTracker(page);
  const previous = moveMonth(month, -1);
  await create(page.context(), {
    expense_date: `${previous}-03`,
    description: "Past bill",
    amount_piastres: 215099,
    category: "Bills",
    notes: '=HYPERLINK("formula")',
  });
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("2,150.99");
  await page.getByRole("button", { name: /3 .*2,150\.99 EGP/ }).click();
  await expect(page.getByRole("heading", { name: "Past bill", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "This month (.csv)" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe(`daybook-${previous}.csv`);
  const stream = await file.createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk;
  expect(text).toContain("Past bill");
  expect(text).toContain("2150.99");
  expect(text).toContain("'=HYPERLINK");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("0.00");
});

test("open API access retains origin checks, validation, and idempotency", async ({
  page,
  request,
}) => {
  expect((await request.get(`/api/expenses?month=${month}`)).status()).toBe(200);
  expect((await request.get("/api/export")).status()).toBe(200);
  expect(
    (await request.post("/api/access", { headers: { origin }, data: { key: "bad" } })).status(),
  ).toBe(200);
  await openTracker(page);
  const headers = { origin };
  const input = {
    id: randomUUID(),
    expense_date: today,
    amount_piastres: 101,
    description: "Idempotent expense",
    category: "Other",
    notes: "",
  };
  expect(
    (
      await page.context().request.post("/api/expenses", {
        headers: { origin: "https://untrusted.example" },
        data: input,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page
        .context()
        .request.post("/api/expenses", { headers, data: { ...input, amount_piastres: 1.01 } })
    ).status(),
  ).toBe(400);
  expect((await page.context().request.get("/api/expenses?month=2026-99")).status()).toBe(400);
  const first = await page.context().request.post("/api/expenses", { headers, data: input });
  const retry = await page.context().request.post("/api/expenses", { headers, data: input });
  expect(first.status()).toBe(201);
  expect(retry.status()).toBe(201);
  const list = await page.context().request.get(`/api/expenses?month=${month}`);
  expect((await list.json()).total).toBe(101);
  expect(
    (
      await page.context().request.patch(`/api/expenses/${input.id}`, {
        headers,
        data: { ...input, version: 1, description: "Changed" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await page.context().request.post("/api/expenses", { headers, data: input })).status(),
  ).toBe(409);
});

test("fits a 320px phone and a desktop, with no browser script errors", async ({ page }) => {
  await openTracker(page);
  await create(page.context(), {
    amount_piastres: 999999999,
    description: "Large expense with a long description to check wrapping",
  });
  await page.getByRole("button", { name: "Refresh expenses" }).click();
  await expect(page.getByTestId("monthly-total")).toHaveText("9,999,999.99");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/narrow-phone.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/desktop-tracker.png", fullPage: true });
});

test("refreshes in the background, labels stale totals on failure, and reopens directly", async ({
  page,
  request,
}) => {
  await page.clock.install();
  await openTracker(page);
  await create(page.context(), { amount_piastres: 4567, description: "Added on the other phone" });
  await page.clock.fastForward(30001);
  await expect(page.getByTestId("monthly-total")).toHaveText("45.67");
  await request.post("http://127.0.0.1:4311/__test/fail-next");
  await page.getByRole("button", { name: "Refresh expenses" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "We couldn’t update" })).toContainText(
    "last successful refresh",
  );
  await expect(page.getByTestId("monthly-total")).toHaveText("45.67");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "We couldn’t update" })).not.toBeVisible();
  await page.reload();
  await expect(page.getByTestId("monthly-total")).toHaveText("45.67");
});
