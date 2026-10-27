'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name)),sha=b=>createHash('sha256').update(b).digest('hex');
const lock=JSON.parse(read('components/ui-conventions.lock.json'));
for(const [name,expected] of Object.entries(lock.files))assert.equal(sha(read('components/'+name)),expected,name);
const readable=read('dist/index.html'),wrapper=read('dist/index.self-extract.html').toString(),payload=wrapper.match(/<script id="self-extract-payload"[^>]*>([A-Za-z0-9+/=\r\n]+)<\/script>/);assert.ok(payload);
const decoded=gunzipSync(Buffer.from(payload[1],'base64'));assert.equal(sha(decoded),sha(readable));assert.equal(sha(read('media-inspector.html')),sha(readable));
for(const [name,bytes] of [['readable',readable],['decoded',decoded],['root',read('media-inspector.html')]]){
 const html=bytes.toString();for(const name of Object.keys(lock.files))assert.ok(html.includes(read('components/'+name).toString()),name+' embedded exactly');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([,attrs])=>!(/type\s*=\s*["'](?:application\/json|application\/octet-stream)/i.test(attrs))).map(([,attrs,code])=>{assert.doesNotMatch(attrs,/type\s*=\s*["']module/i);return code});
 new vm.Script(scripts.join('\n'),{filename:name});assert.match(html,/connect-src 'none'/);assert.match(html,/WORKERFS/);
}
console.log('Shared pins, exact embed, native combined syntax and release/root/gzip parity passed.');
