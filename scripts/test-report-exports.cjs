const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Execute the complete application script; only browser/clipboard/inspection boundaries
// are doubled. This is source-level regression coverage, not native clipboard or media QA.
const artifact = process.argv[2] || path.join(__dirname, '..', 'src', 'index.template.html');
let source = fs.readFileSync(artifact, 'utf8');
const payload = source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) source = require('node:zlib').gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const script = source.match(/<script>\s*('use strict';[\s\S]*?)<\/script>/)[1]
  .replace('__APP_CONFIG_JSON__', '{"defaultLanguage":"en"}')
  .replace('__BUILD_MANIFEST_JSON__', '{"dependencies":[]}')
  .replace('__EMBEDDED_ASSET_BUNDLE_JSON__', '{}');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const sample = (title = 'Fictional A', duration = 61.125) => ({ schemaVersion: 1, format: { name: 'matroska,webm', duration, fileSize: 24, streamCount: 1, metadata: { title } }, streams: [{ index: 0, type: 'audio', duration, codec: { name: 'opus' }, audio: { sampleRate: 48000, channels: 2, channelLayout: 'stereo' } }], chapters: [] });
const file = name => ({ name, type: 'video/webm', size: 24 });
function harness(){
 const nodes=new Map(),created=[],clipboardWrites=[],fallbackWrites=[],downloads=[],urls=new Map(),revoked=[];let next=0,selected,clipboard=async()=>{},fallback=()=>true;
 class Element{
  constructor(id=''){Object.assign(this,{id,textContent:'',innerHTML:'',value:'',className:'',disabled:false,hidden:false,open:false,dataset:{},style:{},events:{},isConnected:true,attributes:{},children:[]});const c=new Set();this.classList={add:x=>c.add(x),remove:x=>c.delete(x),contains:x=>c.has(x),toggle:(x,v)=>v?c.add(x):c.delete(x)}}
  addEventListener(t,f){(this.events[t]||=[]).push(f)}
  removeEventListener(t,f){this.events[t]=(this.events[t]||[]).filter(x=>x!==f)}
  dispatch(t,e={}){return Promise.all((this.events[t]||[]).map(f=>f({preventDefault(){},target:this,...e})))}
  querySelectorAll(){return[]}
  setAttribute(k,v){this.attributes[k]=v}
  removeAttribute(k){delete this.attributes[k]}
  appendChild(x){this.children.push(x);x.parent=this;return x}
  remove(){this.removed=true;this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  select(){selected=this;document.activeElement=this}
  focus(){document.activeElement=this}
  showModal(){this.open=true}
  close(){this.open=false}
  pause(){}
  load(){}
  canPlayType(){return'maybe'}
  scrollIntoView(){}
  getBoundingClientRect(){return{left:0,top:0,right:100,bottom:100}}
  click(){if(this.tag==='a')downloads.push({name:this.download,blob:urls.get(this.href)});return this.dispatch('click')}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
 const document={getElementById:get,querySelectorAll:()=>[],documentElement:new Element('html'),body:new Element('body'),activeElement:null,createElement:tag=>{const e=new Element();e.tag=tag;created.push(e);return e},execCommand:command=>{assert.equal(command,'copy');fallbackWrites.push(selected?.value);return fallback()}};
 const window={innerWidth:1000,matchMedia:()=>({matches:false}),events:{},addEventListener(type,fn){(this.events[type]||=[]).push(fn)},dispatch(type){for(const fn of this.events[type]||[])fn()}};
 const context=vm.createContext({document,window,navigator:{language:'en',clipboard:{writeText:text=>{clipboardWrites.push(text);return clipboard(text)}}},Blob,File,HTMLElement:Element,TextEncoder,TextDecoder,Uint8Array,DOMException,URL:{createObjectURL:blob=>{const url='blob:synthetic/'+ ++next;urls.set(url,blob);return url},revokeObjectURL:url=>{revoked.push(url);urls.delete(url)}},requestAnimationFrame:f=>f(),setTimeout:()=>++next,clearTimeout(){},console});
 vm.runInContext(script,context,{filename:'exact-source-script.js'});
 vm.runInContext('globalThis.app={state,els,analyzeFile,acceptCandidate,cancelInspection,resetResult,copyJson,saveJson,reportFilename,formatDuration,formatBytes,renderReport,renderStreams,applyLanguage,streamsOf};',context);
 const inspectWith=report=>{context.inspectorResult=JSON.stringify(report);vm.runInContext('runInspector=async()=>inspectorResult;nativeCheck=async()=>({status:"playable"});',context)};
 return{app:context.app,context,get,created,document,downloads,clipboardWrites,fallbackWrites,inspectWith,clipboard:fn=>{clipboard=fn},fallback:fn=>{fallback=fn}};
}
async function inspected(report = sample()) {
  const h = harness(); h.inspectWith(report); await h.app.analyzeFile(file('架空.clip.webm')); return h;
}
function noTextarea(h) { assert.equal(h.document.body.children.filter(x => x.tag === 'textarea').length, 0); }
async function replace(h, report) {
  h.inspectWith(report); const replacing = h.app.acceptCandidate(file('B.webm'));
  await h.get('appConfirmOk').click(); await replacing;
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(h.app.state.reportText, JSON.stringify(report, null, 2));
}

test('Copy and Save retain the complete JSON bytes and Unicode filename', async () => {
  const report = sample('架空の映像 🎵'), h = await inspected(report), expected = JSON.stringify(report, null, 2);
  await h.app.copyJson(); assert.deepEqual(h.clipboardWrites, [expected]); assert.equal(h.app.els.toast.textContent, 'JSON copied');
  h.app.saveJson(); assert.equal(h.downloads[0].name, '架空.clip-inspection.json');
  assert.equal(await h.downloads[0].blob.text(), expected + '\n');
  assert.equal(h.app.els.rawJson.textContent, expected); noTextarea(h);
});

for (const outcome of ['resolve', 'reject']) {
  test(`Pending copy ${outcome} after replacement cannot copy B or change B feedback`, async () => {
    const h = await inspected(), wait = deferred(); h.clipboard(() => wait.promise); const copying = h.app.copyJson();
    await replace(h, sample('Fictional B')); h.app.els.toast.textContent = 'B feedback';
    wait[outcome](new Error('clipboard unavailable')); await copying;
    assert.equal(JSON.parse(h.clipboardWrites[0]).format.metadata.title, 'Fictional A');
    assert.deepEqual(h.fallbackWrites, []); assert.equal(h.app.els.toast.textContent, 'B feedback'); noTextarea(h);
  });
  test(`Pending copy ${outcome} after reset has no empty fallback or late feedback`, async () => {
    const h = await inspected(), wait = deferred(); h.clipboard(() => wait.promise); const copying = h.app.copyJson();
    h.app.resetResult(); h.app.els.toast.textContent = 'Reset feedback'; wait[outcome](new Error('clipboard unavailable')); await copying;
    assert.deepEqual(h.fallbackWrites, []); assert.equal(h.app.els.toast.textContent, 'Reset feedback');
    await h.app.copyJson(); h.app.saveJson(); assert.equal(h.clipboardWrites.length, 1); assert.equal(h.downloads.length, 0); noTextarea(h);
  });
}

for (const outcome of ['resolve', 'reject']) {
  test(`Pending copy ${outcome} after pagehide cannot fall back or overwrite feedback`, async () => {
    const h = await inspected(), wait = deferred(); h.clipboard(() => wait.promise); const copying = h.app.copyJson();
    const report = h.app.state.report; h.context.window.dispatch('pagehide');
    assert.equal(h.app.state.report, report, 'page exit invalidates through the existing inspection generation');
    h.app.els.toast.textContent = 'Page exit'; wait[outcome](new Error('clipboard unavailable')); await copying;
    assert.deepEqual(h.fallbackWrites, []); assert.equal(h.app.els.toast.textContent, 'Page exit'); noTextarea(h);
  });
}

test('Cancelling replacement preserves the current copy payload and completion', async () => {
  const h = await inspected(), wait = deferred(), expected = h.app.state.reportText;
  h.clipboard(() => wait.promise); const copying = h.app.copyJson();
  const replacing = h.app.acceptCandidate(file('B.webm')); await h.get('appConfirmCancel').click(); await replacing;
  wait.reject(new Error('clipboard unavailable')); await copying;
  assert.deepEqual(h.fallbackWrites, [expected]); assert.equal(h.app.els.toast.textContent, 'JSON copied'); noTextarea(h);
});

test('Reanalysis then Cancel invalidates an older copy even when retry uses the same source', async () => {
  const h = await inspected(), copyWait = deferred(), inspectWait = deferred();
  h.clipboard(() => copyWait.promise); const copying = h.app.copyJson();
  h.context.pendingReport = inspectWait.promise;
  vm.runInContext('runInspector = () => pendingReport;', h.context);
  const inspecting = h.app.analyzeFile(h.app.state.file); h.app.cancelInspection();
  const feedback = h.app.els.toast.textContent;
  copyWait.reject(new Error('clipboard unavailable')); await copying;
  assert.deepEqual(h.fallbackWrites, []); assert.equal(h.app.els.toast.textContent, feedback);
  inspectWait.resolve(JSON.stringify(sample('obsolete'))); await inspecting;
  assert.equal(h.app.state.report, null);
  h.inspectWith(sample('retry')); await h.app.analyzeFile(h.app.state.file);
  h.clipboard(async () => {}); await h.app.copyJson();
  assert.equal(JSON.parse(h.clipboardWrites.at(-1)).format.metadata.title, 'retry'); noTextarea(h);
});

for (const outcome of ['resolve', 'reject']) {
  test(`Only the latest overlapping copy owns ${outcome} feedback and fallback`, async () => {
    const h = await inspected(), old = deferred(); h.clipboard(() => old.promise); const first = h.app.copyJson();
    h.clipboard(async () => { throw new Error('unavailable'); }); h.fallback(() => false); await h.app.copyJson();
    const feedback = h.app.els.toast.textContent; assert.match(feedback, /Could not copy/);
    old[outcome](new Error('old rejection')); await first;
    assert.equal(h.fallbackWrites.length, 1); assert.equal(h.app.els.toast.textContent, feedback); noTextarea(h);
  });
}

for (const failure of ['false', 'throw']) {
  for (const language of ['en', 'ja']) {
    test(`Fallback ${failure} in ${language} reports failure, cleans up, restores focus and permits retry`, async () => {
      const h = await inspected(); h.app.applyLanguage(language);
      const focus = h.get('copyJsonButton'); focus.focus();
      h.clipboard(async () => { throw new Error('unavailable'); });
      h.fallback(() => { if (failure === 'throw') throw new Error('copy denied'); return false; });
      await h.app.copyJson();
      assert.equal(h.app.els.toast.textContent, language === 'ja' ? 'JSONをコピーできませんでした。「JSONを保存」をお試しください。' : 'Could not copy JSON. Try Save JSON.');
      assert.match(h.app.els.toast.className, /error/); noTextarea(h); assert.equal(h.document.activeElement, focus);
      h.fallback(() => true); await h.app.copyJson();
      assert.equal(h.fallbackWrites.at(-1), h.app.state.reportText);
      assert.equal(h.app.els.toast.textContent, language === 'ja' ? 'JSONをコピーしました' : 'JSON copied');
      noTextarea(h); assert.equal(h.document.activeElement, focus);
    });
  }
}

test('Missing Clipboard API falls back with exact payload and restores current focus', async () => {
  const h = await inspected(); h.context.navigator.clipboard = undefined;
  const focus = h.get('saveJsonButton'); focus.focus(); await h.app.copyJson();
  assert.deepEqual(h.fallbackWrites, [h.app.state.reportText]);
  assert.equal(h.app.els.toast.textContent, 'JSON copied'); assert.equal(h.document.activeElement, focus); noTextarea(h);
});

test('Delayed fallback restores the newer focus rather than the original copy button', async () => {
  const h = await inspected(), wait = deferred(); h.get('copyJsonButton').focus();
  h.clipboard(() => wait.promise); const copying = h.app.copyJson();
  const newerFocus = h.get('saveJsonButton'); newerFocus.focus(); wait.reject(new Error('unavailable')); await copying;
  assert.equal(h.document.activeElement, newerFocus); noTextarea(h);
});

test('An unavailable previous focus does not prevent copy feedback or cleanup', async () => {
  const h = await inspected(); h.context.navigator.clipboard = undefined;
  const focus = h.get('detached'); focus.focus(); focus.remove(); await h.app.copyJson();
  assert.equal(h.app.els.toast.textContent, 'JSON copied'); noTextarea(h);
});

for (const [input, expected] of [
  [0, '0:00.000'], [12.345, '0:12.345'], [0.9996, '0:01.000'], [59.9994, '0:59.999'],
  [59.9996, '1:00.000'], [60, '1:00.000'], [3599.9994, '59:59.999'], [3599.9996, '1:00:00.000'],
  [3600, '1:00:00.000'], [86399.9996, '24:00:00.000'], ['61.125', '1:01.125'],
  [null, '—'], [undefined, '—'], ['', '—'], ['   ', '—'], ['unknown', '—'],
  [NaN, '—'], [Infinity, '—'], [-Infinity, '—'], [-1, '—'], [-0.0001, '—'], [Number.MAX_VALUE, '—'], [9007199254741, '—']
]) {
  test(`Duration ${String(input)} formats as ${expected}`, () => {
    assert.equal(harness().app.formatDuration(input), expected);
  });
}

for (const language of ['en', 'ja']) {
  for (const [duration, expected] of [[59.9996, '1:00.000'], [3599.9996, '1:00:00.000'], [null, '—']]) {
    test(`${language} overview and all stream cards show ${expected} without changing raw JSON`, async () => {
      const report = sample('Fictional timing', duration);
      report.streams.push({ index: 1, type: 'video', duration, codec: { name: 'vp9' }, video: { width: 16, height: 16 } }, { index: 2, type: 'subtitle', duration, codec: { name: 'webvtt' } });
      const h = await inspected(report); h.app.applyLanguage(language);
      const label = language === 'ja' ? '長さ' : 'Duration';
      assert.ok(h.app.els.overviewGrid.innerHTML.includes('<span>' + label + '</span><strong>' + expected + '</strong>'));
      const streamLabel = language === 'ja' ? 'ストリーム長' : 'Stream duration';
      for (const node of ['videoList', 'audioList', 'otherList']) assert.ok(h.app.els[node].innerHTML.includes('<span>' + streamLabel + '</span><strong>' + expected + '</strong>'), node);
      assert.equal(h.app.els.rawJson.textContent, JSON.stringify(report, null, 2));
    });
  }
}
