import { test, expect, type Page } from "@playwright/test";
async function signIn(page: Page, name = "James Carter") {
  await page.goto("/");
  const option = await page
    .getByLabel("Demo employee")
    .locator("option")
    .filter({ hasText: name })
    .getAttribute("value");
  await page.getByLabel("Demo employee").selectOption(option!);
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Good to see you, ${name.split(" ")[0]}.`,
    }),
  ).toBeVisible();
}
async function financials(page: Page) {
  await page.goto("/groups");
  await page
    .getByRole("link", { name: /Smith Family \d+ individuals/ })
    .click();
  await page
    .getByRole("tab", { name: "Financial Overview", exact: true })
    .click();
  await page.getByLabel("As-of date").fill("2025-12-31");
  await expect(
    page.getByRole("heading", { name: "Financial measures by service line" }),
  ).toBeVisible();
}
async function applyKnown(page: Page, date: string) {
  await page.getByLabel("Known at timestamp", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}
test("historical financials distinguish source snapshots, overrides and recorded knowledge", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await financials(page);
  await applyKnown(page, "2026-01-07T12:00");
  const row = page
    .getByRole("row")
    .filter({ has: page.getByText("Family Office", { exact: true }) })
    .filter({
      has: page.getByRole("button", {
        name: "Inspect ARR Family Office",
        exact: true,
      }),
    });
  await expect(
    row.getByRole("button", { name: "Inspect ARR Family Office", exact: true }),
  ).toContainText("$286,000.00");
  await applyKnown(page, "2026-01-20T12:00");
  await expect(
    row.getByRole("button", { name: "Inspect ARR Family Office", exact: true }),
  ).toContainText("$315,000.00");
  await row
    .getByRole("button", { name: "Inspect ARR Family Office", exact: true })
    .click();
  const history = page.getByRole("region", {
    name: "Metric source and override history",
  });
  await expect(history).toContainText("$286,000.00");
  await expect(history).toContainText("Synthetic approved fee revision");
  await expect(history).not.toContainText("$290,000.00");
  await page
    .getByRole("button", { name: "Latest knowledge", exact: true })
    .click();
  await expect(history).toContainText("$290,000.00");
  await page.screenshot({
    path: "test-results/financial-source-history.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("staffing shows separate monthly averages, annualized hours and complete source coverage", async ({
  page,
}) => {
  await signIn(page);
  await financials(page);
  await page
    .getByRole("button", { name: "Staffing hours", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Family Office" })
    .filter({ has: page.getByRole("cell", { name: "Manager", exact: true }) });
  await expect(row).toContainText("21 hrs");
  await expect(row).toContainText("252 hrs");
  await expect(row).toContainText("12/12 months");
  await row.getByRole("button", { name: "Monthly source history" }).click();
  await expect(
    page.getByRole("region", { name: "Metric source and override history" }),
  ).toContainText("Monthly service hours");
});
test("monthly and quarterly charts retain point-in-time ARR while showing quarter revenue totals", async ({
  page,
}) => {
  await signIn(page);
  await financials(page);
  await page.getByRole("button", { name: "Quarterly", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Quarter revenue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ARR historical quarterly chart" }),
  ).toBeVisible();
  await expect(page.locator(".financial-trend-panel tbody tr")).toHaveCount(8);
  await page.getByLabel("Chart metric").selectOption("revenue");
  await expect(
    page.getByRole("img", { name: "Revenue historical quarterly chart" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/financial-overview.png",
    fullPage: true,
  });
});
test("Senior access omits profitability from financial payloads, history controls and report totals", async ({
  page,
}) => {
  await signIn(page, "Oliver Chen");
  await financials(page);
  await expect(
    page.getByRole("columnheader", { name: "Direct labor cost", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Gross margin", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Labor cost and profitability are restricted."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Source & overrides", exact: true })
    .click();
  await expect(
    page
      .getByLabel("History metric")
      .locator("option")
      .filter({ hasText: "Direct labor cost" }),
  ).toHaveCount(0);
  await page.goto("/reporting");
  await expect(
    page.getByText("Portfolio profitability totals are restricted", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("Carter Family", { exact: true })).toHaveCount(0);
  await page.goto("/admin/financial");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
});
test("a manual override preserves source data and can be withdrawn with an attributed reason", async ({
  page,
}) => {
  await signIn(page);
  await financials(page);
  await page
    .getByRole("button", { name: "Inspect ARR Family Office", exact: true })
    .click();
  let history = page.getByRole("region", {
    name: "Metric source and override history",
  });
  await history
    .getByRole("button", { name: "Record override", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Business effective date").fill("2025-12-31");
  await form.getByLabel("Effective until (exclusive)").fill("2026-02-01");
  await form.getByLabel("Override value").fill("325000");
  await form
    .getByLabel("Reason for override")
    .fill("Browser-approved fee revision");
  await form.getByRole("button", { name: "Save override" }).click();
  await expect(form).toHaveCount(0);
  history = page.getByRole("region", {
    name: "Metric source and override history",
  });
  await expect(history.locator(".history-resolution")).toContainText(
    "$325,000.00",
  );
  await expect(history.locator(".history-resolution")).toContainText(
    "$290,000.00",
  );
  const event = history
    .getByRole("row")
    .filter({ hasText: "Browser-approved fee revision" });
  await event.getByRole("button", { name: "Withdraw", exact: true }).click();
  await history
    .getByLabel("Reason for withdrawal")
    .fill("Return to the corrected source revision");
  await history.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(history.locator(".history-resolution")).not.toContainText(
    "$325,000.00",
  );
  await expect(history).toContainText("Browser-approved fee revision");
  await expect(history).toContainText(
    "Return to the corrected source revision",
  );
});
test("administrator reviews unmatched mappings and repeat imports skip immutable observations", async ({
  page,
}) => {
  await signIn(page, "Elizabeth Morgan");
  await page.goto("/admin/financial");
  await expect(
    page.getByText("MOCK-CG-SMITH-REVIEW", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Review required", { exact: true })).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: "Run mock import", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("0 new observations");
  await expect(page.getByRole("status")).toContainText("2 exceptions");
  await expect(
    page.getByRole("heading", { name: "Import exceptions", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Service lines & measures", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configure lookback", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Completed months in staffing lookback").fill("6");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("6 completed calendar months", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configure lookback", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Completed months in staffing lookback")
    .fill("12");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await page.screenshot({
    path: "test-results/financial-administration.png",
    fullPage: true,
  });
});
test("service status can change without altering the source ARR", async ({
  page,
}) => {
  await signIn(page);
  await financials(page);
  await page
    .getByRole("button", { name: "Service history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record service change", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Service line", { exact: true })
    .selectOption({ label: "Family Office" });
  await form.getByLabel("Service status").selectOption("Suspended");
  await form.getByLabel("Effective from").fill("2026-08-01");
  await form
    .getByLabel("Responsible service team")
    .selectOption({ label: "Cedar team" });
  await form
    .getByLabel("Reason for service change")
    .fill("Synthetic client-service pause");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(form).toHaveCount(0);
  await page.getByLabel("As-of date").fill("2026-09-30");
  await page
    .getByRole("button", { name: "Financial overview", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("button", {
      name: "Inspect ARR Family Office",
      exact: true,
    }),
  });
  await expect(row).toContainText("Suspended");
  await expect(
    row.getByRole("button", { name: "Inspect ARR Family Office", exact: true }),
  ).not.toContainText("—");
  await expect(
    page.getByText("Family Office has ARR while service status is suspended.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("reporting filters cohort by current authorization and historical active service status", async ({
  page,
}) => {
  await signIn(page, "Elizabeth Morgan");
  await page.goto("/reporting");
  await page.getByLabel("Report as-of date").fill("2025-12-31");
  await page
    .getByLabel("Report service line")
    .selectOption({ label: "Family Office" });
  await expect(
    page.getByRole("link", { name: "Carter Family", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Smith Family", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Report as-of date").fill("2025-06-30");
  await expect(
    page.getByRole("link", { name: "Carter Family", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/financial-reporting.png",
    fullPage: true,
  });
});
