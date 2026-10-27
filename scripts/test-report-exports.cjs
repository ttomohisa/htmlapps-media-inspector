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
function harness(options={}){
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
 const get=id=>{if(!nodes.has(id)){const node=new Element(id);const tag=source.match(new RegExp('<[^>]+id="'+id+'"[^>]*>'));node.disabled=Boolean(tag&&/\bdisabled(?:[\s=>])/.test(tag[0]));nodes.set(id,node)}return nodes.get(id)};
 const document={getElementById:get,querySelectorAll:()=>[],documentElement:new Element('html'),body:new Element('body'),activeElement:null,createElement:tag=>{const e=new Element();e.tag=tag;created.push(e);return e},execCommand:command=>{assert.equal(command,'copy');fallbackWrites.push(selected?.value);return fallback()}};
 const window={innerWidth:1000,matchMedia:()=>({matches:false}),events:{},addEventListener(type,fn){(this.events[type]||=[]).push(fn)},dispatch(type){for(const fn of this.events[type]||[])fn()}};
 const context=vm.createContext({document,window,navigator:{language:'en',clipboard:{writeText:text=>{clipboardWrites.push(text);return clipboard(text)}}},Blob,File,HTMLElement:Element,TextEncoder,TextDecoder,Uint8Array,DOMException,URL:Object.assign(class extends URL {},{createObjectURL:blob=>{const url='blob:synthetic/'+ ++next;urls.set(url,blob);return url},revokeObjectURL:url=>{revoked.push(url);urls.delete(url)}}),requestAnimationFrame:f=>f(),setTimeout:()=>++next,clearTimeout(){},console});
 context.localStorage=options.storage;context.location={href:options.url||'https://example.test/'};context.navigator.languages=options.languages||['en'];context.history={replaceState(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../components/ui-conventions.js'),'utf8'),context);
 vm.runInContext(script,context,{filename:'exact-source-script.js'});
 vm.runInContext('globalThis.app={state,els,analyzeFile,acceptCandidate,cancelInspection,resetResult,copyJson,saveJson,reportFilename,formatDuration,formatBytes,renderReport,renderStreams,applyLanguage,streamsOf};',context);
 const inspectWith=report=>{context.inspectorResult=JSON.stringify(report);vm.runInContext('runInspector=async()=>inspectorResult;nativeCheck=async()=>({status:"playable"});',context)};
 return{app:context.app,context,get,created,document,downloads,revoked,clipboardWrites,fallbackWrites,inspectWith,clipboard:fn=>{clipboard=fn},fallback:fn=>{fallback=fn}};
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
 test(`Pending copy rejects duplicate and owns its ${outcome} feedback`,async()=>{
  const h=await inspected(),old=deferred();h.clipboard(()=>old.promise);const first=h.app.copyJson();h.fallback(()=>false);await h.app.copyJson();
  assert.equal(h.clipboardWrites.length,1);assert.equal(h.get('copyJsonButton').attributes['data-bk-state'],'busy');old[outcome](new Error('rejection'));await first;
  assert.equal(h.fallbackWrites.length,outcome==='reject'?1:0);assert.match(h.app.els.toast.textContent,outcome==='reject'?/Could not copy/:/JSON copied/);assert.equal(h.get('copyJsonButton').disabled,false);noTextarea(h);
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

for (const [format, name, expected] of [
  [{ name: 'wav', longName: 'WAV / WAVE (Waveform Audio)' }, 'synthetic.mp4', 'WAV'],
  [{ name: 'mp3', longName: 'MP2/3 (MPEG audio layer 2/3)' }, 'synthetic.mov', 'MP3'],
  [{ name: 'wav' }, 'synthetic.wav', 'WAV'],
  [{ name: 'wav' }, 'synthetic', 'WAV'],
  [{ name: 'flac' }, 'synthetic.part.MP4', 'FLAC'],
  [{ name: 'mov,mp4,m4a,3gp,3g2,mj2' }, 'synthetic.mov', 'MP4 / MOV'],
  [{ name: 'matroska,webm' }, 'synthetic.webm', 'Matroska / WebM'],
  [{ name: 'webm' }, 'synthetic.mkv', 'WebM'],
  [{ name: 'matroska' }, 'synthetic.webm', 'Matroska'],
  [{ name: 'mpegts' }, 'synthetic.mp4', 'MPEG-TS'],
  [{ name: 'ogg' }, 'synthetic.mp3', 'Ogg'],
  [{ name: 'avi' }, 'synthetic', 'AVI'],
  [{ name: 'future', longName: 'Future technical container' }, 'synthetic.mp4', 'Future technical container'],
  [{ name: 'future' }, 'synthetic', 'future'],
  [{}, 'synthetic', '—'],
  [{}, 'synthetic.mp4', '—'],
  [{ name: '  ', longName: '  ' }, 'synthetic.WAV', '—'],
]) {
  test(`Container ${JSON.stringify(format)} is authoritative for ${name}`, async () => {
    const h = harness(), report = { ...sample(), format };
    h.inspectWith(report); await h.app.analyzeFile(file(name));
    assert.match(h.app.els.overviewGrid.innerHTML, new RegExp(`<span>Container</span><strong>${expected}</strong>`));
    assert.equal(h.app.els.rawJson.textContent, JSON.stringify(report, null, 2));
  });
}

const technicalFixture = () => ({
  schemaVersion: 1,
  format: { name: 'mov,mp4,m4a,3gp,3g2,mj2', longName: 'QuickTime / MOV', fileSize: 2048, duration: 59.9996, bitRate: 1200000, bitRateSource: 'estimated-from-size-duration', streamCount: 5, metadata: { title: 'PRIVATE_TITLE', location: 'PRIVATE_LOCATION' } },
  streams: [
    { index: 0, type: 'video', codec: { name: 'h264' }, video: { width: 1920, height: 1080, frameRate: { value: 29.97 }, hdr: { classification: 'pq' } }, metadata: { title: 'PRIVATE_STREAM', language: 'PRIVATE_LANGUAGE' } },
    { index: 1, type: 'audio', codec: { name: 'aac' }, audio: { sampleRate: 48000, channels: 2, channelLayout: 'stereo', channelLayoutInferred: true } },
    { index: 2, type: 'subtitle', codec: { name: 'subrip' } },
    { index: 3, type: 'data', codec: { name: 'bin_data' } },
    { index: 4, type: 'attachment', codec: { name: 'ttf' } },
  ],
  chapters: [{ start: 0, end: 59.9996, metadata: { title: 'PRIVATE_CHAPTER' } }],
  custom: 'PRIVATE_CUSTOM',
});
async function downloadSummary(h) {
  const before = h.downloads.length;
  await h.get('saveSummaryButton').click();
  assert.equal(h.downloads.length, before + 1, 'the summary action downloads one file');
  const download = h.downloads.at(-1);
  assert.equal(download.blob.type, 'text/plain;charset=utf-8');
  const text = await download.blob.text();
  assert.ok(text.endsWith('\n')); assert.ok(!text.endsWith('\n\n'));
  return { ...download, text };
}

test('Summary action is a disabled native button in Basic information with localized copy', () => {
  const section = source.match(/<section[^>]+id="overviewSection"[\s\S]*?<\/section>/)[0];
  assert.match(section, /<button[^>]+id="saveSummaryButton"[^>]+type="button"[^>]*disabled/);
  assert.match(section, /data-i18n="saveSummary"/);
  assert.match(source, /saveSummary:'Save technical summary'/);
  assert.match(source, /saveSummary:'技術情報の要約を保存'/);
  const h = harness(); assert.equal(h.get('saveSummaryButton').disabled, true);
});

for (const language of ['en', 'ja']) {
  test(`${language} summary includes every technical stream and excludes private metadata`, async () => {
    const report = technicalFixture(), original = JSON.stringify(report), h = await inspected(report);
    h.app.applyLanguage(language);
    assert.equal(h.get('saveSummaryButton').disabled, false);
    const result = await downloadSummary(h);
    assert.equal(result.name, '架空.clip-inspection-summary.txt');
    assert.match(result.text, language === 'en' ? /^Media Inspector\nTechnical summary\n/ : /^Media Inspector\n技術情報の要約\n/);
    for (const fact of ['MP4 / MOV', 'mov,mp4,m4a,3gp,3g2,mj2', '2.00 KB', '1:00.000', '1.20 Mb/s', '1920 × 1080', '29.97 fps', 'pq', '48000 Hz', 'stereo', 'h264', 'aac', 'subrip', 'bin_data', 'ttf']) assert.ok(result.text.includes(fact), fact);
    for (const index of [0,1,2,3,4]) assert.match(result.text, new RegExp('#'+index+' · '));
    assert.match(result.text, language === 'en' ? /Estimated from size\/duration/ : /サイズと長さから推定/);
    assert.match(result.text, language === 'en' ? /stereo \(Inferred\)/ : /stereo \(推定\)/);
    assert.doesNotMatch(result.text, /PRIVATE_|架空|canPlay|playable|compatib|再生可|JSON/);
    assert.equal(JSON.stringify(report), original);
    const expected = JSON.stringify(report, null, 2);
    assert.equal(h.app.state.reportText, expected); assert.equal(h.app.els.rawJson.textContent, expected);
    await h.app.copyJson(); h.app.saveJson();
    assert.equal(h.clipboardWrites.at(-1), expected);
    assert.equal(await h.downloads.at(-1).blob.text(), expected + '\n');
    assert.equal(h.downloads.at(-1).name, '架空.clip-inspection.json');
  });
}

for (const type of ['video','audio','subtitle','data','attachment']) {
  test(`A ${type}-only summary exports the stream once`, async () => {
    const report=technicalFixture(); report.streams=report.streams.filter(s=>s.type===type); report.format.streamCount=1;
    const result=await downloadSummary(await inspected(report));
    assert.equal((result.text.match(/#\d+ · /g)||[]).length,1);
    assert.match(result.text,/Streams: 1\n/);
  });
}

for (const [format, filename, expected] of [[{name:'wav'},'wrong.mp4','WAV'],[{name:'matroska,webm'},'wrong.MP4','Matroska / WebM'],[{},'extensionless','—'],[{name:'future',longName:'Unfamiliar family'},'archive.clip.MOV','Unfamiliar family']]) {
  test(`Summary container follows detected ${format.name ?? 'unknown'} for ${filename}`, async () => {
    const h=harness(); h.inspectWith({format,streams:[],chapters:[]}); await h.app.analyzeFile(file(filename));
    assert.ok((await downloadSummary(h)).text.includes(`Container: ${expected}\n`));
  });
}

for (const [value, expected] of [[0,'0:00.000'],['0','0:00.000'],[null,'—'],['','—'],['   ','—'],[false,'—'],[-1,'—']]) {
  test(`Summary duration preserves ${JSON.stringify(value)} as ${expected}`, async () => {
    const report={format:{duration:value},streams:[{type:'video',codec:{},video:{}}],chapters:[]};
    const result=await downloadSummary(await inspected(report));
    assert.ok(result.text.includes(`Duration: ${expected}\n`));
    assert.match(result.text,/Resolution: —\n/);assert.match(result.text,/Frame rate: —\n/);assert.match(result.text,/HDR: —\n/);
    assert.match(result.text,/#— · Video/);
  });
}

test('Summary distinguishes absent audio facts and sizes from valid zero counts', async () => {
  const h=harness();h.inspectWith({format:{fileSize:0,duration:0,streamCount:0},streams:[{index:0,type:'audio',audio:{channels:0,sampleRate:null}}],chapters:[]});
  await h.app.analyzeFile({...file('zero'),size:99});const result=await downloadSummary(h);
  assert.match(result.text,/Size: 0 B\n/);assert.match(result.text,/Streams: 0\n/);assert.match(result.text,/Channels: 0\n/);assert.match(result.text,/Sample rate: —\n/);assert.match(result.text,/Channel layout: —\n/);
  h.inspectWith({format:{fileSize:' ',streamCount:null},streams:[],chapters:[]});await h.app.analyzeFile({...file('missing'),size:null});const missing=await downloadSummary(h);
  assert.match(missing.text,/Size: —\n/);assert.match(missing.text,/Streams: 0\n/);
});

for (const [sourceValue, value, qualifier] of [['container',1200,'Reported'],['estimated-from-size-duration',1200,'Estimated from size/duration'],[null,1200,null],['unknown',1200,null],['container',null,null],['estimated-from-size-duration',0,null]]) {
  test(`Summary bitrate ${value} has only supported provenance ${sourceValue}`, async () => {
    const report=sample();Object.assign(report.format,{bitRate:value,bitRateSource:sourceValue});
    const text=(await downloadSummary(await inspected(report))).text;
    const line=text.split('\n').find(x=>x.startsWith('Total bitrate:'));
    assert.equal(line,`Total bitrate: ${value>0?'1 kb/s':'—'}${qualifier?` (${qualifier})`:''}`);
  });
}

for (const [name, expected] of [['架空.clip.MP4','架空.clip-inspection-summary.txt'],['plain','plain-inspection-summary.txt'],['a/b:c*?"<>|\u0000\n.mov','a_b_c_-inspection-summary.txt'],['...','media-inspection-summary.txt'],['   .mp4','media-inspection-summary.txt']]) {
  test(`Summary filename sanitizes ${JSON.stringify(name)}`, async () => {
    const h=harness();h.inspectWith(sample());await h.app.analyzeFile(file(name));
    const result=await downloadSummary(h);assert.equal(result.name,expected);
    assert.doesNotMatch(result.name,/[\\/:*?"<>|\u0000-\u001f\u007f]/);
  });
}

test('Summary text flattens technical strings without changing JSON', async () => {
  const report=sample();report.streams[0].audio.channelLayout='custom\nlayout\u0000value';
  const h=await inspected(report),result=await downloadSummary(h);
  assert.match(result.text,/Channel layout: custom layout value\n/);
  assert.equal(h.app.state.reportText,JSON.stringify(report,null,2));
});

test('Summary reset and page exit cannot export an obsolete successful report', async () => {
  for(const action of ['reset','pagehide']){
    const h=await inspected();
    if(action==='reset')h.app.resetResult();else h.context.window.dispatch('pagehide');
    assert.equal(h.get('saveSummaryButton').disabled,true);
    await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
    h.app.applyLanguage('ja');await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
  }
});

test('Summary replacement cancellation keeps A; confirmed replacement exports only B', async () => {
  const h=await inspected(),old=h.app.state.reportText;
  const replacing=h.app.acceptCandidate(file('B.webm'));await h.get('appConfirmCancel').click();await replacing;
  assert.equal(h.app.state.reportText,old);assert.match((await downloadSummary(h)).text,/Codec: opus\n/);
  const b=sample();b.streams[0].codec.name='flac';await replace(h,b);
  const result=await downloadSummary(h);assert.equal(result.name,'B-inspection-summary.txt');assert.match(result.text,/Codec: flac\n/);assert.doesNotMatch(result.text,/opus/);
});

test('Summary is unavailable during reanalysis and after cancellation or failure, then recovers', async () => {
  const h=await inspected(),pending=deferred();h.context.pendingReport=pending.promise;vm.runInContext('runInspector=()=>pendingReport;',h.context);
  const inspecting=h.app.analyzeFile(h.app.state.file);assert.equal(h.get('saveSummaryButton').disabled,true);await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
  h.app.cancelInspection();pending.resolve(JSON.stringify(sample('obsolete')));await inspecting;await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
  vm.runInContext('runInspector=async()=>{throw new Error("synthetic failure")};',h.context);await h.app.analyzeFile(h.app.state.file);
  assert.equal(h.get('saveSummaryButton').disabled,true);await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
  h.inspectWith(sample());await h.app.analyzeFile(h.app.state.file);await downloadSummary(h);
});

test('Long Unicode summary filenames stay bounded without broken characters or direction controls', async () => {
  const h=harness();h.inspectWith(sample());await h.app.analyzeFile(file('映像🎬'.repeat(100)+'\u202e.mp4'));
  const result=await downloadSummary(h);assert.ok(Buffer.byteLength(result.name,'utf8')<=255);assert.doesNotMatch(result.name,/�|[\u202a-\u202e\u2066-\u2069]/);assert.match(result.name,/-inspection-summary\.txt$/);
});

for(const language of ['en','ja']){
  test(`Summary download failure in ${language} cleans up and permits retry`, async () => {
    const h=await inspected();h.app.applyLanguage(language);
    const create=h.document.createElement;
    h.document.createElement=tag=>{const e=create(tag);if(tag==='a')e.click=()=>{throw new Error('synthetic download failure')};return e};
    const revoked=h.revoked.length,timers=[];h.context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};
    await assert.doesNotReject(h.get('saveSummaryButton').click());
    assert.equal(h.revoked.length,revoked);assert.equal(h.downloads.length,0);const cleanup=timers.find(x=>x.ms===1500);assert.ok(cleanup);cleanup.fn();assert.equal(h.revoked.length,revoked+1);
    assert.match(h.app.els.toast.textContent,language==='en'?/Could not start/:/保存を開始できません/);
    assert.equal(h.created.at(-1).removed,true);
    h.document.createElement=create;await downloadSummary(h);
  });
}

test('Summary waits for the successful report to finish publishing despite language changes', async () => {
  const h=harness(),pending=deferred();h.inspectWith(sample());h.context.nativePending=pending.promise;vm.runInContext('nativeCheck=()=>nativePending;',h.context);
  const analysis=h.app.analyzeFile(file('pending.wav'));await Promise.resolve();await Promise.resolve();
  h.app.applyLanguage('ja');assert.equal(h.get('saveSummaryButton').disabled,true);await h.get('saveSummaryButton').click();assert.equal(h.downloads.length,0);
  pending.resolve({status:'playable'});await analysis;await downloadSummary(h);
});

for (const name of ['constructor','__proto__']) {
  test(`Unfamiliar format ${name} is kept as data`,async()=>{
    const h=harness();h.inspectWith({format:{name},streams:[],chapters:[]});await h.app.analyzeFile(file('unfamiliar.mp4'));
    assert.match(h.app.els.overviewGrid.innerHTML,new RegExp(`<span>Container</span><strong>${name}</strong>`));
    assert.ok((await downloadSummary(h)).text.includes(`Container: ${name}\n`));
  });
}

for(const control of ['\u061c','\u200e','\u200f','\u2028','\u2029']){
  test(`Summary filenames remove U+${control.charCodeAt(0).toString(16).toUpperCase()} controls`,async()=>{
    const h=harness();h.inspectWith(sample());await h.app.analyzeFile(file(`clip${control}name.mp4`));
    assert.equal((await downloadSummary(h)).name,'clip_name-inspection-summary.txt');
  });
}


// Safety fixes: exercise the same complete script with only asynchronous browser boundaries doubled.
test('Replacement keeps all old results hidden until the new browser check finishes', async () => {
  const h = await inspected(sample('OLD_PRIVATE_TITLE')), pending = deferred();
  h.inspectWith(sample('NEW_PRIVATE_TITLE')); h.context.pendingProbe = pending.promise;
  vm.runInContext('nativeCheck=()=>pendingProbe;', h.context);
  const replacing = h.app.analyzeFile(file('new.webm'));
  for(let i=0;i<8;i++) await Promise.resolve();
  assert.equal(h.get('fileName').textContent, 'new.webm');
  assert.equal(h.get('resultArea').hidden, true, 'old metadata and Doctor must remain hidden');
  assert.equal(h.app.state.processing, true, 'Cancel must remain available during the native check');
  pending.resolve({status:'playable'}); await replacing;
  assert.equal(h.get('resultArea').hidden, false);
  assert.doesNotMatch(h.get('metadataContent').innerHTML, /OLD_PRIVATE_TITLE/);
  assert.match(h.get('metadataContent').innerHTML, /NEW_PRIVATE_TITLE/);
});

test('Cleaning follows detected format and keeps a matching output extension', () => {
  const h=harness();
  for(const [name,detected,kind,extension] of [
    ['wrong.mp3','flac','flac','flac'], ['wrong.mp4','wav','wav','wav'],
    ['wrong.flac','wav','wav','wav'], ['wrong.mp4','matroska,webm',null,'bin'],
    ['unknown.mp4','',null,'bin'], ['movie.mov','mov,mp4,m4a,3gp,3g2,mj2','isobmff','mov']
  ]) {
    h.context.candidate={name}; h.context.detected={format:{name:detected}};
    assert.equal(vm.runInContext('cleanerKind(candidate,detected)',h.context),kind,name);
    h.context.kind=kind;assert.equal(vm.runInContext('cleanerOutputExtension(candidate,kind)',h.context),extension,name);
  }
});

test('Ambiguous Matroska/WebM reports never pretend to be specifically WebM', async () => {
  const h=await inspected(sample());
  assert.equal(vm.runInContext('estimatedMime()',h.context),'');
  assert.ok(vm.runInContext('buildDoctorIssues().some(x=>x.level==="info")',h.context));
});

test('Every output filename removes direction controls and bounds UTF-8 stems', async () => {
  const h=await inspected(); h.app.state.file.name='名'.repeat(100)+'\u202efake.mp4';
  h.get('cleanFilenameInput').value=h.app.state.file.name;
  const names=[h.app.reportFilename(),vm.runInContext('cleanedFilename(state.file,"isobmff")',h.context)];
  for(const name of names){ assert.doesNotMatch(name,/[\u202a-\u202e\u2066-\u2069]/); assert.ok(Buffer.byteLength(name)<=220); }
});

test('An excessive metadata value fails safely without publishing a report', async () => {
  const h=harness();h.inspectWith(sample('x'.repeat(65537)));await h.app.analyzeFile(file('large.webm'));
  assert.equal(h.get('resultArea').hidden,true);assert.equal(h.app.state.report,null);
  assert.match(h.get('toast').textContent,/limit|large/i);
});

function exposeCleaning(h){vm.runInContext('app.cleanMetadata=cleanMetadata;app.cancelCleaning=typeof cancelCleaning==="function"?cancelCleaning:()=>{};',h.context)}
test('Cancel during metadata reading prevents verification and download', async () => {
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report),pending=deferred();exposeCleaning(h);
  h.context.pendingClean=pending.promise;vm.runInContext('sanitizeMetadataFile=()=>pendingClean;',h.context);
  const cleaning=h.app.cleanMetadata();await h.get('appConfirmOk').click();await Promise.resolve();
  h.app.cancelCleaning();pending.resolve({blob:new Blob(['synthetic']),changes:['LIST/INFO']});await cleaning;
  assert.equal(h.downloads.length,0);assert.equal(h.app.state.cleaning,false);assert.equal(h.app.state.file.name,'架空.clip.webm');
});
test('Page exit during metadata reading cannot start a verifier or download', async () => {
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report),pending=deferred();exposeCleaning(h);
  h.context.pendingClean=pending.promise;vm.runInContext('sanitizeMetadataFile=()=>pendingClean;',h.context);
  const cleaning=h.app.cleanMetadata();await h.get('appConfirmOk').click();await Promise.resolve();h.context.window.dispatch('pagehide');
  pending.resolve({blob:new Blob(['synthetic']),changes:['LIST/INFO']});await cleaning;assert.equal(h.downloads.length,0);
});
test('A malformed WAV declared RIFF boundary is rejected before rewriting', async () => {
  const h=harness(),bytes=Buffer.alloc(24);bytes.write('RIFF');bytes.writeUInt32LE(4,4);bytes.write('WAVE',8);bytes.write('bext',12);bytes.writeUInt32LE(4,16);
  h.context.wav=new File([bytes],'broken.wav',{type:'audio/wav'});
  await assert.rejects(vm.runInContext('sanitizeWav(wav)',h.context),/RIFF|WAV/);
});
test('Oversized MP4 metadata zeroing aborts before allocating an output Blob', async () => {
  const h=harness();h.context.parts=[];
  assert.throws(()=>vm.runInContext('appendZeroParts(parts,64*1024*1024+1)',h.context),/limit|large/i);
  assert.equal(h.context.parts.length,0);
});
test('Malformed MP4 user data aborts instead of blanking a container that may hold chapters', async () => {
  const h=harness(),bytes=Buffer.alloc(9);bytes[8]=65;h.context.input=new File([bytes],'broken.mp4');h.context.edits=[];h.context.changes=[];
  await assert.rejects(vm.runInContext('sanitizeIsoUdta(input,{start:0,headerSize:8,end:9},edits,changes)',h.context));
  assert.equal(h.context.edits.length,0);
});
test('Cancel during cleaned-copy verification rejects late completion and allows replacement', async () => {
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report),pending=deferred();exposeCleaning(h);
  h.context.pendingVerify=pending.promise;
  vm.runInContext('sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"]),changes:["LIST/INFO"]});runInspector=()=>pendingVerify;',h.context);
  const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.get('cancelCleanButton').hidden,false);h.app.cancelCleaning();
  h.inspectWith(sample('replacement'));await h.app.analyzeFile(file('replacement.webm'));
  pending.resolve(JSON.stringify(report));await work;
  assert.equal(h.downloads.length,0);assert.equal(h.get('fileName').textContent,'replacement.webm');assert.equal(h.app.state.cleaning,false);
});
test('Cleaner timeout during verification is visible and never offers an unverified save', async () => {
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report),pending=deferred();exposeCleaning(h);
  h.context.pendingVerify=pending.promise;vm.runInContext('sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"]),changes:["LIST/INFO"]});runInspector=()=>pendingVerify;',h.context);
  const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();for(let i=0;i<8;i++)await Promise.resolve();
  h.app.state.cleanOperation.abort(new Error('Processing stopped at the safety time limit.'));
  pending.reject(new Error('Worker stopped'));await work;
  assert.equal(h.downloads.length,0);assert.match(h.get('cleanerResult').textContent,/time limit/);assert.equal(h.get('appConfirmDialog').open,false);
});
test('Cancelling a pending file read settles immediately without using late bytes', async () => {
  const h=harness(),pending=deferred();h.context.pendingBytes=pending.promise;
  vm.runInContext('op=createCleanOperation();slow={size:8,slice:()=>({arrayBuffer:()=>pendingBytes})};',h.context);
  const reading=vm.runInContext('readFileBytes(slow,0,8,op)',h.context);
  vm.runInContext('op.abort(new DOMException("cancel","AbortError"))',h.context);
  await assert.rejects(reading,{name:'AbortError'});pending.resolve(new ArrayBuffer(8));
});
function riffChunk(id,payload){const b=Buffer.alloc(8+payload.length+(payload.length&1));b.write(id);b.writeUInt32LE(payload.length,4);payload.copy(b,8);return b}
function makeWav(){const fmt=Buffer.alloc(16);fmt.writeUInt16LE(1);fmt.writeUInt16LE(1,2);fmt.writeUInt32LE(8000,4);fmt.writeUInt32LE(16000,8);fmt.writeUInt16LE(2,12);fmt.writeUInt16LE(16,14);const audio=Buffer.from([0,1,2,3,4,5,6,7]),chunks=Buffer.concat([riffChunk('fmt ',fmt),riffChunk('LIST',Buffer.from('INFOprivate')),riffChunk('data',audio)]),head=Buffer.alloc(12);head.write('RIFF');head.writeUInt32LE(chunks.length+4,4);head.write('WAVE',8);return{bytes:Buffer.concat([head,chunks]),audio}}
function isoBox(type,payload=Buffer.alloc(0)){const head=Buffer.alloc(8);head.writeUInt32BE(payload.length+8);head.write(type,4,4,'latin1');return Buffer.concat([head,payload])}
test('Synthetic WAV cleaning preserves audio bytes, RIFF size and original bytes', async () => {
  const h=harness(),{bytes,audio}=makeWav();h.context.media=new File([bytes],'a.wav',{type:'audio/wav'});
  const result=await vm.runInContext('sanitizeWav(media)',h.context),out=Buffer.from(await result.blob.arrayBuffer());
  assert.ok(out.includes(audio));assert.ok(!out.includes(Buffer.from('private')));assert.equal(out.readUInt32LE(4)+8,out.length);assert.deepEqual(Buffer.from(await h.context.media.arrayBuffer()),bytes);
});
test('Synthetic MP3 and FLAC cleaners preserve payload bytes without decoding',async()=>{
  const h=harness(),audio=Buffer.from([0xff,0xfb,0x90,0x64,...Array(64).fill(23)]),tag=Buffer.alloc(14),tail=Buffer.alloc(128);tag.write('ID3');tag[3]=4;tag[9]=4;tag.write('name',10);tail.write('TAG');
  h.context.media=new File([tag,audio,tail],'a.mp3');const mp3=await vm.runInContext('sanitizeMp3(media)',h.context);assert.deepEqual(Buffer.from(await mp3.blob.arrayBuffer()),audio);
  const info=Buffer.alloc(38);info[3]=34;const comment=Buffer.from([0x84,0,0,4,1,2,3,4]);h.context.media=new File([Buffer.from('fLaC'),info,comment,audio],'a.flac');
  const flac=await vm.runInContext('sanitizeFlac(media)',h.context),out=Buffer.from(await flac.blob.arrayBuffer());assert.equal(out[4],0x80);assert.deepEqual(out.subarray(42),audio);
});
test('Synthetic MP4 cleaning preserves mdat, chapters and fixed-size layout',async()=>{
  const h=harness(),audio=Buffer.from([11,22,33,44,55,66]),chapter=isoBox('chpl',Buffer.from('keep chapter')),meta=isoBox('name',Buffer.from('private name')),mvhd=Buffer.alloc(24);mvhd.writeUInt32BE(123,4);mvhd.writeUInt32BE(456,8);
  const bytes=Buffer.concat([isoBox('ftyp',Buffer.from('isom0000')),isoBox('moov',Buffer.concat([isoBox('mvhd',mvhd),isoBox('udta',Buffer.concat([chapter,meta]))])),isoBox('mdat',audio)]);
  h.context.media=new File([bytes],'a.mp4');const result=await vm.runInContext('sanitizeIsoBmff(media)',h.context),out=Buffer.from(await result.blob.arrayBuffer());
  assert.equal(out.length,bytes.length);assert.ok(out.includes(chapter));assert.deepEqual(out.subarray(-audio.length),audio);assert.ok(!out.includes(Buffer.from('private name')));assert.deepEqual(Buffer.from(await h.context.media.arrayBuffer()),bytes);
});
test('Global cleaner structure and time budgets reject work before reading more data',async()=>{
  const h=harness(),{bytes}=makeWav();h.context.media=new File([bytes],'a.wav');
  vm.runInContext('op=createCleanOperation();op.structures=100000;',h.context);
  await assert.rejects(vm.runInContext('sanitizeWav(media,op)',h.context),/limit/);
  vm.runInContext('op=createCleanOperation();op.deadline=0;',h.context);
  await assert.rejects(vm.runInContext('sanitizeWav(media,op)',h.context),/time limit/);
});

test('Report safety limits during cleaned-copy verification never offer Save anyway', async()=>{
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report);exposeCleaning(h);
  h.context.overLimit=JSON.stringify({...report,format:{name:'wav',metadata:{title:'x'.repeat(65537)}}});
  vm.runInContext('sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"]),changes:["LIST/INFO"]});runInspector=async()=>overLimit;',h.context);
  const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(h.get('appConfirmDialog').open,false,'safety rejection is not an overridable verification warning');await work;
  assert.equal(h.downloads.length,0);assert.match(h.get('cleanerResult').textContent,/limit|large/i);
});
test('Detected WAV output corrects a conflicting input MIME type',async()=>{
  const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report);exposeCleaning(h);
  h.app.state.file.type='video/mp4';h.context.verified=JSON.stringify(report);
  vm.runInContext('sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"],{type:"video/mp4"}),changes:["LIST/INFO"]});runInspector=async()=>verified;',h.context);
  const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();await work;
  assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].blob.type,'audio/wav');
});

test('Worker report and processing limits cannot become an unverified save',async()=>{
  for(const message of ['Inspection report exceeds the 4 MiB safety limit.','Processing stopped at the safety time limit.']){
    const report=sample();report.format.name='wav';report.format.metadata={};const h=await inspected(report);exposeCleaning(h);h.context.limitMessage=message;
    vm.runInContext('sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"]),changes:["LIST/INFO"]});runInspector=async()=>{throw safetyLimitError(limitMessage)};',h.context);
    const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();await work;
    assert.equal(h.get('appConfirmDialog').open,false);assert.equal(h.downloads.length,0);assert.match(h.get('cleanerResult').textContent,/limit/);
  }
});

test('Browser support MIME follows detected WAV and FLAC over a misleading MP3 suffix',async()=>{
  for(const [format,mime] of [['wav','audio/wav'],['flac','audio/flac']]){
    const report=sample();report.format.name=format;const h=await inspected(report);h.app.state.file.name='wrong.mp3';
    assert.ok(vm.runInContext('estimatedMime()',h.context).startsWith(mime));
  }
});
test('Inspection timeout owns stalled runtime preparation and ignores late expansion',async()=>{
  const h=harness(),pending=deferred(),timers=[];let workers=0;
  h.context.window.StandaloneAssets={gunzipText:()=>pending.promise,gunzipBytes:()=>pending.promise};h.context.Worker=class{constructor(){workers++}};
  h.context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};
  const work=h.app.analyzeFile(file('slow.wav'));assert.ok(timers.some(x=>x.ms===90000),'watchdog starts before expansion');
  timers.find(x=>x.ms===90000).fn();await work;
  assert.equal(h.app.state.processing,false);assert.match(h.get('fileError').textContent,/time limit/);
  pending.resolve(new Uint8Array(0));for(let i=0;i<6;i++)await Promise.resolve();assert.equal(workers,0);
});
test('Cleaning timeout unlocks UI even when verifier runtime expansion never settles',async()=>{
  const h=harness(),pending=deferred(),timers=[];vm.runInContext('originalRunInspector=runInspector',h.context);
  const report=sample();report.format.name='wav';report.format.metadata={};h.inspectWith(report);await h.app.analyzeFile(file('a.wav'));exposeCleaning(h);
  h.context.window.StandaloneAssets={gunzipText:()=>pending.promise,gunzipBytes:()=>pending.promise};h.context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};
  vm.runInContext('runInspector=originalRunInspector;sanitizeMetadataFile=async()=>({blob:new Blob(["synthetic"]),changes:["LIST/INFO"]});',h.context);
  const work=h.app.cleanMetadata();await h.get('appConfirmOk').click();for(let i=0;i<8;i++)await Promise.resolve();
  timers.find(x=>x.ms===90000).fn();for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(h.app.state.cleaning,false);assert.equal(h.get('fileInput').disabled,false);await work;
  assert.equal(h.downloads.length,0);assert.match(h.get('cleanerResult').textContent,/time limit/);
});
test('Cleaned MP4 MIME uses the Inspector stream schema',()=>{
  const h=harness();for(const [type,mime]of[['video','video/mp4'],['audio','audio/mp4']]){h.context.report={streams:[{type}]};assert.equal(vm.runInContext('cleanerOutputMime({name:"a.mp4"},"isobmff",report)',h.context),mime)}
});

test('Cancelling an active worker clears owned references and settles the request',async()=>{
  const h=harness();let terminated=0;h.context.Worker=class{postMessage(){}terminate(){terminated++}};
  h.context.window.StandaloneAssets={gunzipText:async()=>'',gunzipBytes:async()=>new Uint8Array(8)};
  const work=h.app.analyzeFile(file('pending.wav'));for(let i=0;i<8;i++)await Promise.resolve();assert.ok(h.app.state.worker);
  h.app.cancelInspection();await work;assert.equal(h.app.state.worker,null);assert.equal(h.app.state.workerUrl,null);assert.equal(h.app.state.workerCancel,null);assert.equal(terminated,1);
});

// Common UI regressions execute the actual controller and adapters.
test('common language resolves without startup writes and explicit changes write only shared preference',()=>{
 const values=new Map([['browser-kitty:ui-language:v1','ja']]),writes=[];const storage={getItem:k=>values.get(k)||null,setItem(k,v){writes.push(k);values.set(k,v)}};
 const h=harness({storage,languages:['fr','en']});assert.equal(h.app.state.language,'ja');assert.deepEqual(writes,[]);h.get('languageButton').click();assert.equal(values.get('browser-kitty:ui-language:v1'),'en');assert.deepEqual(writes,['browser-kitty:ui-language:v1']);
 const url=harness({storage,url:'https://example.test/?lang=ja'});assert.equal(url.app.state.language,'ja');
});
test('report output names survive language and same-source reanalysis and normalize their extension',async()=>{
 const h=await inspected();h.get('jsonFilenameInput').value='custom/name.json';h.get('summaryFilenameInput').value='summary-name.txt';h.app.applyLanguage('ja');h.app.saveJson();vm.runInContext('saveSummary()',h.context);
 assert.equal(h.downloads[0].name,'custom_name.json');assert.equal(h.downloads[1].name,'summary-name.txt');await h.app.analyzeFile(h.app.state.file);assert.equal(h.get('jsonFilenameInput').value,'custom/name.json');
});
test('report download failure remains visible through language and other output success until retry',async()=>{
 const h=await inspected(),create=h.document.createElement;h.document.createElement=tag=>{const e=create(tag);if(tag==='a')e.click=()=>{throw Error('delivery denied')};return e};
 h.app.saveJson();assert.match(h.get('deliveryStatus').textContent,/JSON/);assert.equal(h.document.body.children.length,0);h.app.applyLanguage('ja');assert.match(h.get('deliveryStatus').textContent,/保存を開始できません/);
 h.document.createElement=create;vm.runInContext('saveSummary()',h.context);assert.match(h.get('deliveryStatus').textContent,/JSON/);h.app.saveJson();assert.equal(h.get('deliveryStatus').hidden,true);
});
test('replacement consent is bound to source generation and identifies retained external file',async()=>{
 const h=await inspected();const replacing=h.app.acceptCandidate(file('B.webm'));assert.match(h.get('appConfirmMessage').textContent,/架空.clip.webm/);assert.equal(h.document.activeElement,h.get('appConfirmCancel'));
 await h.app.analyzeFile(file('C.webm'));await h.get('appConfirmOk').click();await replacing;assert.equal(h.app.state.file.name,'C.webm');
});

test('denied language persistence is visible and never drops report, names or delivery errors',async()=>{
 const h=harness({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},languages:['fr','ja']});assert.equal(h.app.state.language,'ja');h.inspectWith(sample());await h.app.analyzeFile(file('retained.wav'));const text=h.app.state.reportText;h.get('jsonFilenameInput').value='draft';h.fallback(()=>false);h.context.navigator.clipboard=undefined;await h.app.copyJson();await h.get('languageButton').click();assert.equal(h.app.state.language,'en');assert.equal(h.get('languageNotice').hidden,false);assert.match(h.get('deliveryStatus').textContent,/Could not copy/);assert.equal(h.app.state.reportText,text);assert.equal(h.get('jsonFilenameInput').value,'draft');
});
test('open replacement confirmation translates captured names and cancel keeps current work',async()=>{
 const h=await inspected();const text=h.app.state.reportText;h.get('jsonFilenameInput').value='draft';const operation=h.app.acceptCandidate(file('candidate.wav'));h.app.applyLanguage('ja');assert.match(h.get('appConfirmMessage').textContent,/架空.clip.webm.*→.*candidate.wav/);assert.equal(h.get('appConfirmCancel').textContent,'キャンセル');await h.get('appConfirmCancel').click();await operation;assert.equal(h.app.state.reportText,text);assert.equal(h.get('jsonFilenameInput').value,'draft');
});
for(const changeFocus of [false,true])test(`clipboard selection failure cleans temporary node without stealing later focus ${changeFocus}`,async()=>{
 const h=await inspected();h.context.navigator.clipboard=undefined;h.get('copyJsonButton').focus();const create=h.document.createElement,newer=h.get('summaryFilenameInput');h.document.createElement=tag=>{const el=create(tag);if(tag==='textarea')el.select=()=>{if(changeFocus)newer.focus();throw Error('cannot select')};return el};await h.app.copyJson();noTextarea(h);assert.match(h.get('deliveryStatus').textContent,/Could not copy/);assert.equal(h.document.activeElement,changeFocus?newer:h.get('copyJsonButton'));
});
test('inspection error and cancellation controls translate without changing its source',async()=>{
 const h=harness();vm.runInContext('runInspector=async()=>{throw new Error(t("fileReadFailed"))}',h.context);const media=file('unreadable.wav');await h.app.analyzeFile(media);assert.match(h.get('fileError').textContent,/could not be read/);h.app.applyLanguage('ja');assert.match(h.get('fileError').textContent,/読み取れません/);assert.equal(h.app.state.file,media);assert.equal(h.get('reanalyzeButton').disabled,false);assert.equal(h.get('saveJsonButton').disabled,true);
});
