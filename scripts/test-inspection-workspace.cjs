const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function assertPageAlignment(page) {
  const edges = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect();
    const content = box('#fileSection');
    const rows = [
      [content.left, content.right],
      [box('.brand').left, box('.header-actions').right]
    ];
    const footer = document.querySelector('footer');
    if (footer.getClientRects().length) {
      const rect = footer.getBoundingClientRect();
      const style = getComputedStyle(footer);
      const scale = rect.width / footer.offsetWidth;
      rows.push([rect.left + parseFloat(style.paddingLeft) * scale,
        rect.right - parseFloat(style.paddingRight) * scale]);
    }
    return rows;
  });
  for (const [left, right] of edges) {
    assert.ok(Math.abs(left - edges[0][0]) < 1 && Math.abs(right - edges[0][1]) < 1,
      'header, main and visible footer content must align: ' + JSON.stringify(edges));
  }
}

async function check(browser, artifact, width, locale) {
  const portraitDesktopWidth = width === 980;
  const touch = width <= 600 || portraitDesktopWidth;
  const page = await browser.newPage({
    viewport:{width, height:portraitDesktopWidth ? 1880 : 844},
    isMobile:touch, hasTouch:touch, locale, reducedMotion:'reduce'
  });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  try {
    await page.goto(pathToFileURL(path.resolve('dist', artifact)).href);
    const sample = page.locator('#inspectSample');
    await sample.waitFor({timeout:3000});
    await assertPageAlignment(page);
    assert.equal(await page.locator('#intake > :first-child').getAttribute('id'), 'localNotice');
    const cleanupHeading = page.locator('#formatGuide');
    assert.equal(await cleanupHeading.innerText(), locale.startsWith('ja') ? 'メタデータの削除' : 'Remove metadata');
    assert.ok(await page.locator('[data-i18n="cleanCopyNote"]').isVisible());
    assert.equal(await page.locator('#mobileNav').isVisible(), false);
    const picker = page.locator('#fileInput');
    assert.equal(await picker.getAttribute('aria-describedby'), 'localNotice');
    const noticeBox = await page.locator('#intake > #localNotice').boundingBox();
    assert.match(await page.locator('[data-i18n="inspectFields"]').innerText(), locale.startsWith('ja') ? /コーデック/ : /codec/);
    const pickerBox = await page.locator('#dropZone').boundingBox();
    assert.ok(noticeBox && noticeBox.y + noticeBox.height <= pickerBox.y + 1);
    assert.ok(Math.abs(noticeBox.x + noticeBox.width - pickerBox.x - pickerBox.width) < 1);
    const buttonBox = await page.locator('.choose-file').boundingBox();
    const sampleBox = await sample.boundingBox();
    assert.ok(sampleBox.y >= pickerBox.y + pickerBox.height - 1, 'sample follows the picker');
    if (touch) {
      const scale = portraitDesktopWidth ? width / 390 : 1;
      assert.ok(buttonBox.width >= width * .85, 'file button uses the available width');
      assert.ok(buttonBox.height / scale >= 44, 'file button keeps a phone-sized touch target');
    }
    await page.bringToFront();
    const [emptyChooser] = await Promise.all([
      page.waitForEvent('filechooser'), touch ? picker.tap() : picker.press('Enter')
    ]);
    await emptyChooser.setFiles([]);
    await sample.focus();
    await page.keyboard.press('Enter');
    await page.locator('#resultArea').waitFor();
    await assertPageAlignment(page);
    const report = JSON.parse(await page.locator('#rawJson').textContent());
    assert.equal(report.format.name, 'wav');
    assert.equal(report.format.duration, 3);
    assert.equal(report.streams[0].audio.sampleRate, 16000);
    assert.ok(report.format.metadata.date);
    const tabs = page.getByRole('tab');
    assert.equal(await tabs.count(), 4);
    assert.equal(await tabs.nth(2).innerText(), locale.startsWith('ja') ? 'メタデータ削除' : 'Remove metadata');
    assert.ok(await tabs.evaluateAll(items => items.every(tab => tab.scrollWidth <= tab.clientWidth + 1)));
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
      await tabs.last().click();
      assert.equal(await page.locator('#mobileDoctor').getAttribute('aria-current'), null);
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
    const [replacement] = await Promise.all([
      page.waitForEvent('filechooser'), page.locator('#replaceButton').click()
    ]);
    await replacement.setFiles(path.resolve('assets/media-inspector-ja.mp4'));
    await page.locator('#appConfirmOk').click();
    await page.waitForFunction(() => document.querySelector('#fileName').textContent.endsWith('.mp4') &&
      !document.querySelector('#resultArea').hidden);
    assert.match(await page.locator('#overviewGrid').innerText(), /1280\s*×\s*720/);
    if (width === 320) {
      const container = page.locator('.quick-metrics strong').first();
      assert.ok(await container.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await tabs.nth(1).click();
      await page.evaluate(() => window.scrollBy({top:450, behavior:'instant'}));
      await tabs.first().click();
      const panel = await page.locator('#panel-overview').boundingBox();
      const nav = await page.getByRole('tablist').boundingBox();
      assert.ok(panel.y >= nav.y + nav.height - 1, 'the beginning of Overview is visible');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS', artifact, width, locale);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    for (const artifact of ['index.html', 'index.self-extract.html']) {
      for (const [width, locale] of [[320, 'en-US'], [390, 'ja-JP'], [980, 'ja-JP'], [1280, 'ja-JP']]) {
        await check(browser, artifact, width, locale);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
