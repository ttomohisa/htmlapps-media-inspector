const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.config.json'), 'utf8'));
let html = fs.readFileSync(process.env.APP_HTML || path.join(root, 'src/index.template.html'), 'utf8');
const payload = html.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
if (payload) html = gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
const media = config.slug === 'media-inspector';
const dictionaryName = media ? 'I18N' : 'translations';
const dictionary = html.match(new RegExp('const ' + dictionaryName + '\\s*=\\s*(\\{[\\s\\S]*?\\n\\s*\\});'))?.[1];
assert.ok(dictionary, 'locate actual application translations');
const translations = vm.runInNewContext('(' + dictionary + ')');
const start = html.indexOf('function applyLanguage(');
const tail = html.slice(start);
const applySource = media ? tail.slice(0, tail.indexOf('\n')) : tail.slice(0, tail.search(/\n\s*(?:async )?function /));
assert.ok(applySource.startsWith('function applyLanguage('));

// Execute the production translation/update function with parsed HTML attributes.
// Rendering is an explicit boundary stub; these are not browser/layout tests.
function harness() {
  const nodes = [];
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*?)>/gi)) {
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const node = { attrs, dataset: {}, textContent: '', setAttribute(k,v){this.attrs[k]=String(v)}, getAttribute(k){return this.attrs[k]??null} };
    Object.defineProperty(node, 'title', { get(){return attrs.title||''}, set(value){attrs.title=String(value)} });
    for (const [k,v] of Object.entries(attrs)) if (k.startsWith('data-')) node.dataset[k.slice(5).replace(/-([a-z])/g, (_,c)=>c.toUpperCase())] = v;
    nodes.push(node);
  }
  const get = id => nodes.find(n => n.attrs.id === id.replace(/^#/, ''));
  const document = { documentElement: {lang:'ja'}, querySelectorAll(selector){const key=selector.slice(1,-1);return nodes.filter(n=>Object.hasOwn(n.attrs,key))} };
  const languageButton = get('languageButton');
  const state = { language: 'ja', report: { streams: [{ index: 0 }] }, points: [{id:'p1',px:1.25,py:2.5}], selectedId:'p1' };
  const context = vm.createContext({ document, languageButton, els:{languageButton}, state, translations, I18N:translations, APP_CONFIG:config,
    BUILD_MANIFEST:{generatedAtUtc:'2026-10-06T00:00:00Z',dependencies:[]}, touchDraft:null, $:get,
    render(){}, renderReport(){}, renderSeriesList(){}, updatePointCoordinateDraft(){} });
  vm.runInContext(`let language='ja'; function translate(key){return translations[language][key];} ${applySource};globalThis.switchTo=next=>{language=next;applyLanguage(next);};`,context);
  return {get,document,state,nodes,switchTo:context.switchTo};
}
for (const lang of ['ja','en']) {
  test(`${lang}: compact target language and accessible target name`, () => {
    const h=harness(); h.switchTo(lang);
    const button=h.get('languageButton');
    assert.equal(button.textContent, lang==='ja'?'EN':'JA');
    assert.equal(button.getAttribute('aria-label'), lang==='ja'?'英語に切り替え':'Switch to Japanese');
    assert.equal(button.title,button.getAttribute('aria-label'));
    assert.equal(h.document.documentElement.lang,lang);
  });
  test(`${lang}: local-processing badge and localized Help`, () => {
    const h=harness(); h.switchTo(lang);
    assert.equal(translations[lang][media?'localOnly':'localBadge'],lang==='ja'?'完全ローカル処理':'Fully local processing');
    const badge=h.nodes.find(node=>node.dataset.i18n===(media?'localOnly':'localBadge'));
    assert.equal(badge.textContent,lang==='ja'?'完全ローカル処理':'Fully local processing');
    const help=h.get('helpButton');
    assert.equal(help.getAttribute('aria-label'),translations[lang].helpTitle);
    assert.equal(help.title,translations[lang].helpTitle);
  });
}
test('repeated switching preserves existing document/report/point state', () => {
  const h=harness(); const before=JSON.stringify({...h.state,language:undefined});
  for(const lang of ['en','ja','en','ja']) h.switchTo(lang);
  assert.equal(JSON.stringify({...h.state,language:undefined}),before);
});
test('initial Japanese header has target names and synchronized three-part version', () => {
  const h=harness(); const button=h.get('languageButton');
  assert.equal(button.getAttribute('aria-label'),'英語に切り替え');
  assert.equal(button.title,'英語に切り替え');
  assert.match(config.version,/^\d+\.\d+\.\d+$/);
  assert.match(html,new RegExp('class="version-badge"[^>]*>v'+config.version.replace(/\./g,'\\.')+'<'));
});
