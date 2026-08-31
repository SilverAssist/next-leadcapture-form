/**
 * Integration spec for @silverassist/leadcapture-form consumed by a real
 * Next app. The fixture installs the *packed tarball*, so this runs
 * against exactly what npm would publish -- the point is proving the "use
 * client" directive survives the build, which no unit test can see.
 */
import { expect, test } from "@playwright/test";

test("renders inside a Server Component page without a client-boundary error", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("leadcapture-form fixture");
});

test("renders the embed container", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".leadforms-embd-form")).toBeAttached();
});
