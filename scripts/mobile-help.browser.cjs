'use strict';
// Run against the official generated files in the unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');


async function assertHeaderVersionFits(page, width, height, label) {
  const expected = 'v' + JSON.parse(fs.readFileSync(path.resolve('app.config.json'), 'utf8')).version;
  const version = page.locator('.app-header .version-badge, .app-header .version');
  assert.equal(await version.count(), 1, label + ': one header version');
  assert.equal((await version.textContent()).trim(), expected, label + ': current version');
  assert.equal(await version.isVisible(), true, label + ': header version visible');
  const box = await version.evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect();
    let left = 0, right = innerWidth, top = 0, bottom = innerHeight;
    for (let p = el; p; p = p.parentElement) {
      const style = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(style.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (/hidden|clip|auto|scroll/.test(style.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    const actions = document.querySelector('.header-actions').getBoundingClientRect();
    return { x:r.left, y:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height, left, clipRight:right, top, clipBottom:bottom,
      overlapsActions: r.left < actions.right && r.right > actions.left && r.top < actions.bottom && r.bottom > actions.top };
  });
  assert.ok(box.width > 0 && box.height > 0 && box.x >= box.left - .5 && box.right <= box.clipRight + .5 && box.y >= box.top - .5 && box.bottom <= box.clipBottom + .5 && !box.overlapsActions, label + ': full version glyphs fit viewport/ancestor clips without action overlap ' + JSON.stringify(box));
}

async function main() {
  const results = path.resolve(__dirname, '..', 'test-results', 'mobile-help');
  fs.mkdirSync(results, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const file of ['dist/index.html', 'dist/index.self-extract.html', 'media-inspector.html']) {
      for (const language of ['ja', 'en']) {
        for (const [width, height] of [[1360, 900], [601, 568], [600, 568], [360, 640], [390, 844], [320, 568], [393, 252]]) {
          const context = await browser.newContext({ viewport: { width, height }, locale: language, reducedMotion: 'reduce' });
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
          page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
          const label = `${file} ${language} ${width}x${height}`;
          try {
            await page.goto(pathToFileURL(path.resolve(__dirname, '..', file)).href);
            await page.locator('#helpButton').waitFor();
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('#languageButton').click();
            await assertHeaderVersionFits(page, width, height, label);
            if(file==='dist/index.html'&&[1360,320,360,390].includes(width))await page.screenshot({path:path.join(results,`main-${language}-${width}.png`)});
            assert.equal(await page.locator('[data-i18n="localOnly"]').textContent(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label);
            assert.equal(await page.locator('.privacy-chip svg[aria-hidden="true"]').count(), 1, label + ': decorative shield');
            assert.match(await page.locator('.privacy-chip svg path').first().getAttribute('d'), /^M12 3 /, label + ': shield outline');
            assert.equal(await page.locator('.privacy-chip').isVisible(), width > 760, label + ': existing badge hiding preserved');
            if (width > 760) assert.ok(await page.locator('.privacy-chip').evaluate(el => {
              const box = el.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(el.querySelector('[data-i18n="localOnly"]'));
              return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1
                && [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
            }), label + ': badge text fits');
            assert.equal(await page.locator('footer').isVisible(), width > 600, label);
            assert.equal(await page.locator('.mobile-nav').isVisible(), width <= 600, label + ': functional navigation preserved');

            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');

            await page.locator('#helpButton').click();
            const body = page.locator('#helpDialog .dialog-body');
            await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
            const finalItem = body.locator('> :last-child');
            const finalBox = await finalItem.boundingBox(), bodyBox = await body.boundingBox();
            assert.ok(finalBox && bodyBox && finalBox.y >= 0 && finalBox.y + finalBox.height <= height && finalBox.y >= bodyBox.y - 1 && finalBox.y + finalBox.height <= bodyBox.y + bodyBox.height + 1, label + ': final Help item reachable');
            assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
            const headerBox = await page.locator('#helpDialog .dialog-head').boundingBox();
            assert.ok(headerBox && headerBox.y >= 0 && headerBox.y + headerBox.height <= height, label + ': header visible');
            if (file === 'dist/index.html' && [1360, 320].includes(width)) {
              await page.screenshot({ path: path.join(results, `help-${language}-${width}.png`) });
            }
            const dialogBox = await page.locator('#helpDialog').boundingBox();
            assert.ok(dialogBox.y > 1, label + ': top coordinate is genuine backdrop');
            const beforeScroll = await page.evaluate(() => scrollY);
            await page.mouse.move(2, 1);
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': background locked');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape');
            await page.locator('#helpButton').click();
            await page.locator('#helpClose').click();
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': reopen and Close');
            await page.locator('#helpButton').click();
            await page.mouse.click(2, 1);
            assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': backdrop');
            assert.deepEqual(errors, [], label + ': console errors');
            assert.deepEqual(requests, [], label + ': external runtime requests');
            console.log('PASS ' + label);
          } catch (error) {
            await page.screenshot({ path: path.join(results, `failure-${file.replace(/[^a-z0-9]/gi, '-')}-${language}-${width}x${height}.png`) }).catch(() => {});
            throw error;
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
