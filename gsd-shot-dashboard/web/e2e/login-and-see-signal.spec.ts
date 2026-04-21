import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'analyst@example.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'hunter2hunter2';

test('login, receive SSE signal, open detail drawer', async ({ page }) => {
  // 1. Unauth visit → redirected to /login
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  // 2. Login
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('http://localhost:8080/');
  await expect(page.getByTestId('dashboard-shell')).toBeVisible();
  await expect(page.getByTestId('source-health-panel')).toBeVisible();

  // 3. Dark mode is the default — <html> must have class "dark" at first paint
  const htmlClass = await page.locator('html').getAttribute('class');
  expect(htmlClass ?? '').toContain('dark');

  // 4. Assert the load-gen harness (run out-of-band; see README ## E2E testing) has
  // produced at least one signal within 15s. The harness command is:
  //   docker compose exec backend uv run python scripts/load_generator.py \
  //     --rate 1 --duration 5 --source-id rss:e2e
  await expect(page.getByTestId('feed-card').first()).toBeVisible({ timeout: 15_000 });

  // 5. Open the first card → detail drawer shows title, content, original link
  await page.getByTestId('feed-card').first().click();
  await expect(page.getByTestId('item-detail')).toBeVisible();
  await expect(page.getByTestId('detail-link')).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('detail-link')).toHaveAttribute('rel', /noopener/);
  await expect(page.getByTestId('detail-content')).toBeVisible();

  // Close drawer before next step
  await page.keyboard.press('Escape');

  // 6. Pause toggle freezes the visible list
  await page.getByTestId('pause-toggle').click();
  await expect(page.getByTestId('pause-toggle')).toHaveAttribute('aria-pressed', 'true');

  // 7. Session persists across reload (AUTH-02)
  await page.reload();
  await expect(page).toHaveURL('http://localhost:8080/');
  await expect(page.getByTestId('dashboard-shell')).toBeVisible();
});
