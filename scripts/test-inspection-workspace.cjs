const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function check(browser, artifact, width, locale) {
  const page = await browser.newPage({viewport:{width, height:844}, locale, reducedMotion:'reduce'});
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  try {
    await page.goto(pathToFileURL(path.resolve('dist', artifact)).href);
    const sample = page.locator('#inspectSample');
    await sample.waitFor({timeout:3000});
    assert.equal(await page.locator('#mobileNav').isVisible(), false);
    await sample.focus();
    await page.keyboard.press('Enter');
    await page.locator('#resultArea').waitFor();
    const report = JSON.parse(await page.locator('#rawJson').textContent());
    assert.equal(report.format.name, 'wav');
    assert.equal(report.format.duration, 3);
    assert.equal(report.streams[0].audio.sampleRate, 16000);
    assert.ok(report.format.metadata.date);
    const tabs = page.getByRole('tab');
    assert.equal(await tabs.count(), 4);
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#overviewSection').isVisible(), true);
    assert.equal(await page.locator('#cleanerSection').isVisible(), false);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#audioSection').isVisible(), true);
    assert.equal(await page.locator('#videoSection').isVisible(), false);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#detailsSection').isVisible(), true);
    await page.locator('#languageButton').click();
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
    if (width <= 600) {
      await page.locator('#mobileAudio').click();
      assert.equal(await page.locator('#audioSection').isVisible(), true);
      await page.locator('#mobileDoctor').click();
      assert.equal(await page.locator('#doctorSection').isVisible(), true);
      await page.locator('#mobileClean').click();
      assert.equal(await page.locator('#appConfirmDialog').isVisible(), true);
      await page.keyboard.press('Escape');
    }
    await tabs.nth(2).click();
    assert.equal(await page.locator('#cleanFilenameInput').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#reanalyzeButton').click();
    await page.locator('#resultArea').waitFor();
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS', artifact, width, locale);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    for (const artifact of ['index.html', 'index.self-extract.html']) {
      for (const [width, locale] of [[320, 'en-US'], [390, 'ja-JP'], [1280, 'ja-JP']]) {
        await check(browser, artifact, width, locale);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
