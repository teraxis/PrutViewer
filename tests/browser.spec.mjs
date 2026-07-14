import { expect, test } from '@playwright/test';

test('core transport, classless DOM, plugins, and child viewers', async ({ page }) => {
    await page.goto('/tests/browser-smoke.html');
    await expect(page.locator('body')).toHaveAttribute('data-result', 'ok');
    await expect(page.locator('#result')).toContainText('"signedUrlPreserved":true');
    await expect(page.locator('#result')).toContainText('"classlessDomContract":true');
    await expect(page.locator('#result')).toContainText('"childLifecycle":true');
});

test('static demonstration initializes from a manifest without host CSS classes', async ({ page }) => {
    await page.route('**/demo-manifest.json', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                schema: 'prut-viewer/1',
                documents: [{
                    id: 'demo-video',
                    title: 'Demo video',
                    type: 'video',
                    mime: 'video/mp4',
                    sources: { view: './tests/demo-video.mp4' }
                }]
            })
        });
    });
    await page.route('**/tests/demo-video.mp4', async (route) => {
        await route.fulfill({ status: 204, contentType: 'video/mp4', body: '' });
    });

    await page.goto('/demo.html');
    const viewer = page.locator('[data-viewer-demo]');
    await expect(viewer).toHaveAttribute('data-viewer-state', 'ready');
    await page.evaluate(() => window.prutViewerDemo.loadDocument(0));
    await expect(viewer.locator('[data-viewer-role="media-player"]')).toHaveCount(1);
    await expect(viewer.locator('[class]')).toHaveCount(0);
});

test('static demonstration opens directly through the file protocol', async ({ page }) => {
    await page.goto(new URL('../demo.html', import.meta.url).href);

    const viewer = page.locator('[data-viewer-demo]');
    await expect(viewer).toHaveAttribute('data-viewer-state', 'ready');
    await expect(page.locator('[data-demo-role="status"]')).toContainText('(local file mode)');
    const localState = await page.evaluate(() => {
        const documents = window.prutViewerDemo.getState().documents;
        const viewport = document.querySelector('[data-viewer-demo]');
        viewport.scrollTop = 500;
        return {
            documentCount: documents.length,
            pdfCount: documents.filter((documentItem) => documentItem.type === 'pdf').length,
            pdfSourcesAreBlobs: documents
                .filter((documentItem) => documentItem.type === 'pdf')
                .every((documentItem) => documentItem.sources.view.url.startsWith('blob:')),
            overflowY: getComputedStyle(viewport).overflowY,
            hasInternalOverflow: viewport.scrollHeight > viewport.clientHeight,
            scrollTop: viewport.scrollTop
        };
    });
    expect(localState).toEqual({
        documentCount: 11,
        pdfCount: 10,
        pdfSourcesAreBlobs: true,
        overflowY: 'auto',
        hasInternalOverflow: true,
        scrollTop: 500
    });
    await expect(viewer.locator('iframe')).toHaveCount(0);
    await expect(viewer.locator('[class]')).toHaveCount(0);
});
