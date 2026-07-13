import { expect, test } from '@playwright/test';

test('core transport, classless DOM, plugins, and child viewers', async ({ page }) => {
    await page.goto('/tests/browser-smoke.html');
    await expect(page.locator('body')).toHaveAttribute('data-result', 'ok');
    await expect(page.locator('#result')).toContainText('"signedUrlPreserved":true');
    await expect(page.locator('#result')).toContainText('"classlessDomContract":true');
    await expect(page.locator('#result')).toContainText('"childLifecycle":true');
});
