const { test, expect } = require('@playwright/test');

test.describe('Frontend Security Audit', () => {

  test('Open Redirect via callbackUrl parameter is blocked', async ({ page }) => {
    // Navigate to login page with an external callbackUrl
    await page.goto('/auth/login?callbackUrl=https://evil.com');

    // Fill credentials
    await page.fill('input[name="email"]', 'demo.learner@example.com');
    await page.fill('input[name="password"]', 'DemoPass123!');

    // Click submit
    await page.click('button[type="submit"]');

    // Wait for the redirect to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const currentURL = page.url();
    expect(currentURL).not.toContain('evil.com');
    expect(currentURL).toContain('/dashboard');
  });

  test('Open Redirect via redirect parameter is blocked', async ({ page }) => {
    await page.goto('/auth/login?redirect=https://evil.com');

    await page.fill('input[name="email"]', 'demo.learner@example.com');
    await page.fill('input[name="password"]', 'DemoPass123!');

    await page.click('button[type="submit"]');

    // Wait for the redirect to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const currentURL = page.url();
    expect(currentURL).not.toContain('evil.com');
    expect(currentURL).toContain('/dashboard');
  });

  test('Open Redirect via protocol relative url is blocked', async ({ page }) => {
    await page.goto('/auth/login?callbackUrl=//evil.com');

    await page.fill('input[name="email"]', 'demo.learner@example.com');
    await page.fill('input[name="password"]', 'DemoPass123!');

    await page.click('button[type="submit"]');

    // Wait for the redirect to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const currentURL = page.url();
    expect(currentURL).not.toContain('evil.com');
    expect(currentURL).toContain('/dashboard');
  });

  test('Clickjacking Mitigation - Page refuses to render in iframe', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <iframe id="test-iframe" name="test-iframe" src="http://localhost:3000/auth/login"></iframe>
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    const iframe = page.frame({ name: 'test-iframe' });
    if (iframe) {
      const content = await iframe.content();
      // It should not display the login form header or elements
      expect(content).not.toContain('Access your courses and certificates');
    }
  });

});
