import { expect, test } from "@playwright/test";

const FRONT =
  "What is the Spanish word for 'my' when referring to a masculine singular noun?";

test("the Spanish flashcard accepts the extracted answer through the UI", async ({
  page,
}) => {
  // Use the app's real guest sign-in flow. The fixture page shares this
  // browser origin, so it reads the same Convex auth session.
  await page.goto("/auth");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await page.waitForURL("**/tutor");

  await page.goto("/tests/e2e/flashcard-fixture.html");
  await expect(page.getByText(FRONT)).toBeVisible();

  await page.getByRole("button", { name: "Type answer instead" }).click();
  await page.getByLabel("Your answer").fill("mi");
  await page.getByRole("button", { name: "Check answer" }).click();

  await expect(page.getByText("Key points credited")).toBeVisible();
  await expect(page.getByText("Matched the card answer.")).toBeVisible();
  await expect(page.getByText("Credited: mi")).toBeVisible();
  await expect(page.getByText("Not quite")).not.toBeVisible();
});
