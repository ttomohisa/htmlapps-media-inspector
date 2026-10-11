const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');

const rejected = [
  "小さい画面ではダイアログ内をスクロールできます。閉じるボタン、Escキー、外側のクリックで閉じられます。",
  "On a small screen, scroll inside the dialog. Close it with the close button, Esc, or a click outside.",
  "ブラウザ再生判定は、ファイル情報、canPlayType()、端末上のネイティブ再生プローブを組み合わせた参考情報です。OS・ブラウザ・ハードウェアによって対応状況が違うため、絶対的な再生保証ではありません。",
  "Playback guidance combines file facts, canPlayType(), and a local native media probe. It is advisory, not a guarantee, because support varies by browser, OS and hardware.",
  "大きなファイルはWORKERFSで直接参照しますが、解析中はブラウザとFFmpeg WASMのメモリも使用します。",
  "WORKERFS avoids a whole-file JavaScript copy, but the browser and FFmpeg WASM still use memory during inspection.",
  "長さはミリ秒単位で丸めて表示し、取得できない値は「—」になります。JSONの元の値は変更しません。コピーに失敗した場合は「JSONを保存」をお試しください。コピー待ち中に解析結果を切り替えると、その結果への追加のコピー処理と通知は中止します。",
  "Durations are rounded to milliseconds; unavailable values show “—”. The original JSON values are unchanged. If copying fails, try Save JSON. Changing reports while a copy is pending stops its fallback and feedback."
];

test('help contains user guidance rather than implementation or layout audit prose', () => {
  const root = path.join(__dirname, '..');
  const files = ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html',
    ...fs.readdirSync(root).filter(name => name.endsWith('.html'))];
  for (const file of files) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    let html = fs.readFileSync(filename, 'utf8');
    const payload = html.match(/<script id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
    if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
    for (const copy of rejected) assert.ok(!html.includes(copy), `${file}: remove internal-facing help copy: ${copy}`);
  }
});
