const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifact = path.resolve(__dirname, '..', 'dist', 'index.html');
async function setup(t) {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__workers = [];
    window.Worker = class {
      constructor(url) { this.url = url; this.terminated = false; window.__workers.push(this); }
      postMessage(data) { this.data = data; }
      terminate() { this.terminated = true; }
    };
    let release;
    window.__expansionGate = new Promise(resolve => { release = resolve; });
    window.__releaseExpansion = release;
    const Original = DecompressionStream;
    window.DecompressionStream = class {
      constructor(format) {
        const stream = new Original(format);
        return { writable: stream.writable, readable: stream.readable.pipeThrough(new TransformStream({
          async transform(chunk, controller) { await window.__expansionGate; controller.enqueue(chunk); }
        })) };
      }
    };
  });
  await page.goto(pathToFileURL(artifact).href);
  return page;
}
const synthetic = name => ({ name, mimeType: 'video/mp4', buffer: Buffer.from(`synthetic ${name}`) });

test('Cancel during runtime expansion prevents a worker from starting', async t => {
  const page = await setup(t);
  await page.locator('#fileInput').setInputFiles(synthetic('cancel.mp4'));
  await page.waitForFunction(() => document.querySelector('#progressCard').classList.contains('is-visible'));
  assert.equal(await page.evaluate(() => window.__workers.length), 0);
  await page.locator('#cancelButton').click();
  await page.evaluate(() => window.__releaseExpansion());
  // Expansion and microtasks complete before inspecting cancellation behavior.
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__workers.length), 0, 'cancelled expansion must not start FFmpeg');
  assert.equal(await page.locator('#progressCard').evaluate(el => el.classList.contains('is-visible')), false);
});

test('Replacement during expansion starts only the newest source worker', async t => {
  const page = await setup(t);
  await page.locator('#fileInput').setInputFiles(synthetic('old-A.mp4'));
  await page.waitForFunction(() => document.querySelector('#progressCard').classList.contains('is-visible'));
  await page.locator('#fileInput').setInputFiles(synthetic('current-B.mp4'));
  await page.locator('#appConfirmOk').click();
  await page.waitForFunction(() => document.querySelector('#fileName').textContent === 'current-B.mp4');
  await page.evaluate(() => window.__releaseExpansion());
  await page.waitForFunction(() => window.__workers.length > 0);
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.__workers.map(worker => worker.data.payload.file.name)), ['current-B.mp4']);
});

test('A late callback from a cancelled worker cannot stop replacement inspection', async t => {
  const page = await setup(t);
  await page.evaluate(() => window.__releaseExpansion());
  await page.locator('#fileInput').setInputFiles(synthetic('old-A.mp4'));
  await page.waitForFunction(() => window.__workers.length === 1);
  await page.locator('#fileInput').setInputFiles(synthetic('current-B.mp4'));
  await page.locator('#appConfirmOk').click();
  await page.waitForFunction(() => window.__workers.length === 2);
  await page.evaluate(() => window.__workers[0].onmessage({ data: { id: 1, event: 'error', error: 'obsolete error' } }));
  assert.equal(await page.evaluate(() => window.__workers[1].terminated), false);
  assert.equal(await page.locator('#progressCard').evaluate(el => el.classList.contains('is-visible')), true);
  assert.doesNotMatch(await page.locator('#toast').textContent(), /obsolete error/);
});
test('Native probe completion from the old source cannot change replacement state', async t => {
  const page = await setup(t);
  await page.evaluate(() => {
    HTMLMediaElement.prototype.load = function () {};
    Object.defineProperty(HTMLMediaElement.prototype, 'src', { configurable: true, get() { return this.auditSrc || ''; }, set(value) { this.auditSrc = value; } });
    window.__releaseExpansion();
  });
  await page.locator('#fileInput').setInputFiles(synthetic('old-A.mp4'));
  await page.waitForFunction(() => window.__workers.length === 1);
  await page.evaluate(() => window.__workers[0].onmessage({ data: { id: 1, event: 'done', text: JSON.stringify({ format: { name: 'mov,mp4' }, streams: [{ type: 'video', codec: { name: 'h264' }, video: { width: 320, height: 240 } }] }) } }));
  await page.waitForFunction(() => window.__workers[0].terminated);
  await page.locator('#fileInput').setInputFiles(synthetic('current-B.mp4'));
  await page.locator('#appConfirmOk').click();
  await page.waitForFunction(() => window.__workers.length === 2);
  await page.locator('#videoProbe').dispatchEvent('canplay');
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#mobileDoctor').isDisabled(), true, 'old probe must not enable replacement report');
  assert.equal(await page.locator('#progressCard').evaluate(el => el.classList.contains('is-visible')), true);
});


test('Self-extract packaging permits the actual embedded WASM inspector', async t => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route(/^https?:/, route => route.abort());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'dist', 'index.self-extract.html')).href);
  const wav = Buffer.alloc(44 + 1600);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  await page.locator('#fileInput').setInputFiles({ name: 'synthetic.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => !document.querySelector('#progressCard').classList.contains('is-visible'), null, { timeout: 30000 });
  assert.equal(await page.locator('#resultArea').isVisible(), true, await page.locator('#toast').textContent());
  const report = JSON.parse(await page.locator('#rawJson').textContent());
  assert.equal(report.streams.filter(stream => stream.type === 'audio').length, 1);
  assert.match(report.format.name, /wav/);
});
