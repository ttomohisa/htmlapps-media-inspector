// Source-level CSS contracts and real event bindings. Native browser QA separately
// checks geometry, scrolling, focus, zoom and file operations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '../src/index.template.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const rules = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(m => m[1].trim().split(',').some(s => s.trim() === selector)).map(m => m[2]).join(';');
const inspector = html.includes('id="helpClose"');
const shells = inspector ? ['dialog'] : ['.help-dialog', '.app-confirm-dialog'];
const bodies = inspector ? ['.dialog-body', '.confirm-body'] : ['.dialog-body', '.app-confirm-body'];
const heads = inspector ? ['.dialog-head', '.confirm-actions'] : ['.dialog-header', '.app-confirm-header'];
test('open dialogs use a viewport-bounded column without revealing closed dialogs', () => {
  for (const selector of shells) {
    assert.match(rules(selector), /max-height\s*:[^;]*vh/, selector + ' needs a viewport fallback');
    assert.match(rules(selector), /max-height\s*:[^;]*dvh/, selector + ' tracks dynamic viewport height');
    assert.doesNotMatch(rules(selector), /display\s*:\s*flex/, 'closed dialogs must retain native display:none');
    assert.match(rules(selector+'[open]'), /display\s*:\s*flex/);
    assert.match(rules(selector+'[open]'), /flex-direction\s*:\s*column/);
  }
});
test('dialog bodies shrink and scroll while close controls and actions stay visible', () => {
  for (const selector of bodies) {
    assert.match(rules(selector), /min-height\s*:\s*0/);
    assert.match(rules(selector), /overflow(?:-y)?\s*:\s*auto/);
    assert.match(rules(selector), /overscroll-behavior\s*:\s*contain/);
  }
  for (const selector of heads) assert.match(rules(selector), /flex\s*:\s*0 0 auto/);
});
test('background scroll locking is derived from modal state without clobbering inline styles', () => {
  assert.match(rules('html:has(dialog:modal)'), /overflow\s*:\s*hidden/);
  assert.match(rules('body:has(dialog:modal)'), /overflow\s*:\s*hidden/);
});
test('help backdrop closes while clicks inside its bounds leave it open', () => {
  const handlers = {};
  const dialog = {open:true, addEventListener(type, fn){handlers[type]=fn}, close(){this.open=false}, showModal(){this.open=true}, getBoundingClientRect(){return {left:10,top:10,right:200,bottom:200}}};
  const button = {addEventListener(){}};
  let binding;
  if (inspector) binding = html.match(/els\.helpButton\.addEventListener[\s\S]*?(?=els\.fileInput\.addEventListener)/)[0];
  else binding = html.match(/const help=\$\('#helpDialog'\);[^\n]+/)[0];
  vm.runInNewContext(binding, {els:{helpButton:button,helpClose:button,helpDialog:dialog}, $:selector=>selector==='#helpDialog'?dialog:button});
  assert.equal(typeof handlers.click, 'function', 'help must listen for a backdrop click');
  handlers.click({target:{},clientX:0,clientY:0});assert.equal(dialog.open,true,'keyboard clicks on inner content are not backdrop clicks');
  handlers.click({target:dialog,clientX:50,clientY:50});assert.equal(dialog.open,true);
  handlers.click({target:dialog,clientX:5,clientY:50});assert.equal(dialog.open,false);
  dialog.showModal();handlers.click({target:dialog,clientX:50,clientY:205});assert.equal(dialog.open,false);
});

test('drop area stays plain white while border and keyboard focus show interaction', () => {
  assert.match(rules('.drop-zone'), /background\s*:\s*var\(--surface\)/);
  assert.doesNotMatch(rules('.drop-zone::before'), /background|content\s*:/, 'no decorative color wash');
  for (const selector of ['.drop-zone:hover', '.drop-zone.is-dragging']) {
    assert.doesNotMatch(rules(selector), /background\s*:/, 'interaction must not tint the drop area');
    assert.match(rules(selector), /border-color\s*:\s*var\(--accent\)/);
  }
  assert.match(rules('.drop-zone:has(input:focus-visible)'), /outline\s*:\s*3px solid/);
});

// This catches a phone footer accidentally remaining visible; native geometry is
// verified separately in Chromium at both sides of the existing breakpoint.
test('informational footer is hidden at 600px without hiding functional navigation', () => {
  const source = css;
  const media = [...source.matchAll(/@media\s*\(max-width:\s*600px\)\s*\{/g)].map(match => {
    let depth = 1, end = match.index + match[0].length;
    for (; depth && end < source.length; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    return source.slice(match.index + match[0].length, end - 1);
  }).join('\n');
  assert.match(media, /(?:^|\})\s*footer\s*\{[^}]*display\s*:\s*none\b/);
  assert.match(media, /\.mobile-nav\s*\{[^}]*display\s*:\s*grid\b/);
});
