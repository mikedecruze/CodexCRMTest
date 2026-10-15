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
async function smith(page: Page) {
  await page
    .getByRole("link", { name: "Client Groups", exact: false })
    .first()
    .click();
  await page
    .getByRole("link", { name: /Smith Family \d+ individuals/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Smith Family", exact: true }),
  ).toBeVisible();
}
async function chooseAdd(page: Page, label: string) {
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
test("directories, search and shared profiles expose only authorized client relationships", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  await expect(page.getByText("Carter Family", { exact: true })).toHaveCount(0);
  await page.getByLabel("Search all authorized records").fill("Evergreen");
  await page
    .getByRole("button", { name: "Evergreen Ventures LLC Legal entity" })
    .click();
  const drawer = page.getByRole("dialog", { name: "Master record profile" });
  await expect(drawer.getByText("Smith Family", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Carter Family", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    drawer.getByRole("button", { name: "Edit shared master" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close profile" }).click();
  await smith(page);
  await page.screenshot({
    path: "test-results/group-overview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("family graph, household branches, profile selection and graph controls work", async ({
  page,
}) => {
  await signIn(page);
  await smith(page);
  await page.getByRole("tab", { name: "Family & Households" }).click();
  await expect(
    page.getByRole("heading", { name: "Robert & Eleanor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alexander & Charlotte", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Olivia & Liam", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Robert Smith", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Robert Smith" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close profile" }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("115%", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Collapse Robert Smith branch" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Alexander Smith", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset graph" }).click();
  await expect(
    page.getByRole("button", { name: "Open Alexander Smith", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Filter relationship type")
    .selectOption({ label: "Parent / child" });
  await page.screenshot({
    path: "test-results/family-tree.png",
    fullPage: true,
  });
});
test("as-of date resolves old and new direct ownership in the graph and table", async ({
  page,
}) => {
  await signIn(page);
  await smith(page);
  await page.getByRole("tab", { name: "Entities & Ownership" }).click();
  await page.getByLabel("As-of date").fill("2024-12-31");
  await expect(page.getByText("80% Common", { exact: true })).toBeVisible();
  await expect(page.locator("svg").getByText("80% · Common")).toBeVisible();
  await page.getByLabel("As-of date").fill("2025-01-01");
  await expect(page.getByText("60% Common", { exact: true })).toBeVisible();
  await expect(page.getByText("80% Common", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/entity-ownership.png",
    fullPage: true,
  });
});
test("creates a person with household membership and persists across browser reload", async ({
  page,
}) => {
  await signIn(page);
  await smith(page);
  await chooseAdd(page, "Individual");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill("Clara");
  await dialog.getByLabel("Last name").fill("Smith");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("clara.smith@example.com");
  await dialog
    .getByLabel("Household", { exact: true })
    .selectOption({ label: "Alexander & Charlotte" });
  await dialog.getByLabel("Effective from").fill("2026-01-01");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("tab", { name: "Family & Households" }).click();
  await expect(
    page.getByRole("button", {
      name: "Clara Smith Family member",
      exact: false,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Clara Smith Family member",
      exact: false,
    }),
  ).toBeVisible();
});
test("Associate sees read-only records and unauthorized employee sees no family records", async ({
  page,
}) => {
  await signIn(page, "Sophia Reed");
  await smith(page);
  await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add record", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await signIn(page, "Noah Bennett");
  await expect(
    page.getByRole("heading", { name: "No client relationships assigned" }),
  ).toBeVisible();
  await page.goto("/groups");
  await expect(
    page.getByRole("heading", { name: "No client groups found" }),
  ).toBeVisible();
});
test("administrator creates a fully assigned family, household, entity and custom entity type", async ({
  page,
}) => {
  await signIn(page, "Elizabeth Morgan");
  await page.goto("/groups");
  await page.getByRole("button", { name: "New client group" }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Client Group name").fill("Whitmore Family");
  await d.getByLabel("Display name").fill("The Whitmore family");
  await d.getByLabel("Status", { exact: true }).selectOption("Active");
  await d.getByLabel("Client since").fill("2022-01-01");
  await d
    .getByLabel("Primary Partner")
    .selectOption({ label: "Elizabeth Morgan" });
  await d
    .getByLabel("Relationship Manager")
    .selectOption({ label: "James Carter" });
  await d
    .getByLabel("Primary service team")
    .selectOption({ label: "Cedar team" });
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByRole("heading", { name: "Whitmore Family", exact: true }),
  ).toBeVisible();
  for (const name of ["Founders household", "East branch", "West branch"]) {
    await chooseAdd(page, "Household");
    d = page.getByRole("dialog");
    await d.getByLabel("Household name").fill(name);
    await d.getByLabel("Effective from").fill("2022-01-01");
    await d.getByRole("button", { name: "Save record" }).click();
    await expect(d).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Family & Households" }).click();
  await expect(
    page.getByRole("heading", { name: "East branch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "West branch" }),
  ).toBeVisible();
  await chooseAdd(page, "Legal entity");
  d = page.getByRole("dialog");
  await d.getByLabel("Legal name").fill("Whitmore Trust");
  await d.getByLabel("Entity type").selectOption({ label: "Trust" });
  await d.getByLabel("Effective from").fill("2022-01-01");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  await page.getByRole("tab", { name: "Entities & Ownership" }).click();
  await expect(
    page.getByRole("button", { name: "Whitmore Trust", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Add definition" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Category", { exact: true }).selectOption("entity");
  await d.getByLabel("Stable code").fill("special-purpose");
  await d.getByLabel("Display label").fill("Special purpose vehicle");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByText("Special purpose vehicle", { exact: true }),
  ).toBeVisible();
});
test("narrow screen keeps navigation, forms and record detail usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/groups");
  await page
    .getByRole("link", { name: "Smith Family", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Smith Family", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-profile.png",
    fullPage: true,
  });
});

test("ownership changes entered through the form preserve the prior value", async ({
  page,
}) => {
  await signIn(page);
  await smith(page);
  await page.getByRole("tab", { name: "Entities & Ownership" }).click();
  await expect(
    page.getByRole("tab", { name: "Entities & Ownership" }),
  ).toHaveAttribute("aria-selected", "true");
  const row = page
    .getByRole("row")
    .filter({ hasText: "Robert Smith" })
    .filter({ hasText: "Ownership interest" });
  await row.getByRole("button", { name: "Record change" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Change effective on").fill("2026-01-01");
  await d.getByLabel("New ownership percentage").fill("55");
  await d.getByLabel("Reason for change").fill("Approved synthetic transfer");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  await page.getByLabel("As-of date").fill("2025-12-31");
  await expect(page.getByText("60% Common", { exact: true })).toBeVisible();
  await page.getByLabel("As-of date").fill("2026-01-01");
  await expect(page.getByText("55% Common", { exact: true })).toBeVisible();
});
test("private advisor context is editable within a group and reusable masters can be linked", async ({
  page,
}) => {
  await signIn(page);
  await smith(page);
  await page.getByRole("tab", { name: "Advisors & Stakeholders" }).click();
  const card = page
    .locator(".advisor-card")
    .filter({ hasText: "Sarah Mitchell" });
  await card.getByRole("button", { name: "Edit group context" }).click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Private group notes")
    .fill("Smith-only review instructions");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(card.getByText("Smith-only review instructions")).toBeVisible();
  await page.goto("/groups");
  await page
    .getByRole("link", { name: /Bennett Family \d+ individuals/ })
    .click();
  await chooseAdd(page, "Associate existing entity");
  const form = page.getByRole("dialog");
  await form.getByLabel("Find an authorized existing record").fill("Evergreen");
  await form.getByRole("button", { name: "Find records" }).click();
  await expect(
    form
      .getByLabel("Existing legal entity")
      .locator("option")
      .filter({ hasText: "Evergreen Ventures LLC" }),
  ).toHaveCount(1);
  await form
    .getByLabel("Existing legal entity")
    .selectOption({ label: "Evergreen Ventures LLC" });
  await form.getByLabel("Private group notes").fill("Bennett-only context");
  await form.getByRole("button", { name: "Save record" }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("tab", { name: "Entities & Ownership" }).click();
  await expect(page.getByText("Bennett-only context")).toBeVisible();
  await expect(page.getByText("Smith-only review instructions")).toHaveCount(0);
});
