import { expect, test, type Page } from "@playwright/test";

const legacyEndpointPattern = /\/(?:bootstrap|panel\/command|mock|store)(?:[/?#]|$)/;

function attachNetworkGuards(page: Page) {
  const failedRequests: string[] = [];
  const legacyRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    if (legacyEndpointPattern.test(new URL(request.url()).pathname)) {
      legacyRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.request().resourceType() !== "image") {
      failedRequests.push(`${status} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText === "net::ERR_ABORTED") {
      return;
    }
    failedRequests.push(`failed ${request.url()}: ${errorText}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return {
    assertClean() {
      expect(legacyRequests, "legacy API requests").toEqual([]);
      expect(failedRequests, "failed network requests").toEqual([]);
      expect(consoleErrors, "console errors").toEqual([]);
    },
  };
}

async function requestSmsAndReadCode(page: Page, phone: string) {
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/auth/sms/request"));
  await page.getByPlaceholder("+48 500 600 700").fill(phone);
  await page.getByRole("button", { name: /wyślij kod|wyślij sms|kod sms/i }).click();
  const response = await responsePromise;
  const payload = (await response.json().catch(() => null)) as { code?: string } | null;
  return payload?.code ?? process.env.SMOKE_SMS_CODE ?? "";
}

test("production public and panel smoke", async ({ page, baseURL }) => {
  const guards = attachNetworkGuards(page);
  const base = baseURL ?? "https://panel.ceo/emandar/";

  await page.goto(base);
  await expect(page.getByRole("main").getByText("Szkolenia Emandar", { exact: true })).toBeVisible();

  await page.goto(new URL("kalendarz", base).toString());
  await expect(page.getByRole("main").getByText("Szkolenia Emandar", { exact: true })).toBeVisible();

  await page.goto(new URL("trenerzy", base).toString());
  await expect(page.getByRole("main").getByText("Przekazujący Wiedzę", { exact: true })).toBeVisible();

  await page.goto(new URL("wydarzenia-spolecznosci", base).toString());
  await expect(page.getByRole("main").getByText("Wydarzenia społeczności", { exact: true })).toBeVisible();

  const phone = process.env.SMOKE_LOGIN_PHONE;
  if (phone) {
    await page.goto(new URL("login", base).toString());
    const code = await requestSmsAndReadCode(page, phone);
    expect(code, "SMOKE_SMS_CODE is required when SMSAPI_TEST_MODE=false").toMatch(/^\d{6}$/);
    await page.getByLabel(/kod/i).fill(code);
    await page.getByRole("button", { name: /potwierdź kod|wejdź do panelu/i }).click();
    await expect(page).toHaveURL(/\/panel/);

    for (const path of ["panel/dashboard", "panel/grupy", "panel/szkolenia", "panel/zgloszenia"]) {
      await page.goto(new URL(path, base).toString());
      await expect(page.locator("body")).toContainText(/Dashboard|Grupy|Szkolenia|Zgłoszenia/);
    }

    const sseResponse = await page.request.get(new URL("api/panel/events/stream", base).toString(), {
      timeout: 5_000,
    });
    expect(sseResponse.status()).toBe(200);
    expect(sseResponse.headers()["content-type"]).toContain("text/event-stream");
  }

  guards.assertClean();
});
