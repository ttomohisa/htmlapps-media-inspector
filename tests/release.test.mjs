import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { releaseTag, releaseNotes, publishRelease } from '../.github/scripts/release.cjs';

const sha = 'a'.repeat(40);
const tag = 'v1.2.0';
const prefix = 'htmlapps-media-inspector-' + tag;
const assets = [prefix + '.html', prefix + '.self-extract.html', prefix + '.zip', 'SHA256SUMS.txt']
  .map(name => ({ name, data: Buffer.from('bytes-' + name) }));
const digest = data => 'sha256:' + createHash('sha256').update(data).digest('hex');
assets.at(-1).data = Buffer.from(assets.slice(0,-1)
  .map(asset => digest(asset.data).slice(7) + '  ' + asset.name + '\n').join(''));
const checksums = digest(assets.at(-1).data).slice(7);

test('only increasing stable versions produce a version tag', () => {
  assert.equal(releaseTag('1.1.2', '1.2.0'), tag);
  assert.equal(releaseTag('1.9.0', '1.10.0'), 'v1.10.0');
  assert.equal(releaseTag('1.2.0', '1.2.0'), '');
  for (const bad of ['1.1.9', '1.02.0', '1.3', '2.0.0-beta', '1.2.1\n']) {
    assert.throws(() => releaseTag('1.2.0', bad));
  }
});
test('release notes contain just the requested changelog entry', () => {
  const log = '# Changelog\r\n\r\n## 1.2.0 - 2026-11-27\r\n\r\n- Added.\r\n\r\n## 1.1.2 - 2026-10-10\r\n\r\n- Older.';
  assert.equal(releaseNotes(log, tag), '- Added.');
  assert.throws(() => releaseNotes(log, 'v2.0.0'));
});
function fixture() {
  const state = { ref: null, release: null, calls: [], failUpload: null, refError: null };
  const missing = () => Object.assign(new Error('Not Found'), { status: 404 });
  const github = {
    paginate: async () => state.release ? [state.release] : [],
    rest: {
      git: {
        getRef: async () => {
          if (state.refError) throw state.refError;
          if (!state.ref) throw missing();
          return { data: { object: state.ref } };
        },
        getTag: async () => ({ data: { object: { type: 'commit', sha } } }),
        createRef: async ({ ref, sha: target }) => {
          state.calls.push(['tag', ref, target]);
          state.ref = { type: 'commit', sha: target };
        }
      },
      repos: {
        listReleases() {},
        getCommit: async ({ ref }) => ({ data: { sha: ref === 'main' ? sha : 'b'.repeat(40) } }),
        createRelease: async ({ tag_name, target_commitish, draft }) => {
          state.calls.push(['draft', draft, target_commitish]);
          state.release = { id: 1, tag_name, target_commitish, draft, assets: [] };
          return { data: state.release };
        },
        uploadReleaseAsset: async ({ name, data }) => {
          if (state.failUpload === name) throw new Error('upload interrupted');
          state.calls.push(['upload', name]);
          const asset = { name, id: state.calls.length, digest: digest(data), state: 'uploaded', size: data.length };
          state.release.assets.push(asset);
          return { data: asset };
        },
        deleteReleaseAsset: async ({ asset_id }) => {
          state.release.assets = state.release.assets.filter(a => a.id !== asset_id);
        },
        updateRelease: async ({ draft }) => {
          state.calls.push(['publish', draft]);
          state.release.draft = draft;
        }
      }
    }
  };
  return { state, publish: (overrides = {}) => publishRelease({ github, repo: { owner: 'owner', repo: 'repo' }, tag, sha, notes: '- Tested', assets, checksums, ...overrides }) };
}
test('corrupt downloads or a substituted checksum manifest stop before mutation', async () => {
  const { state, publish } = fixture();
  await assert.rejects(publish({checksums:'0'.repeat(64)}), /checksums/);
  const corrupt = assets.map((asset,i) => i === 0 ? {...asset,data:Buffer.from('corrupt')} : asset);
  await assert.rejects(publish({assets:corrupt}), /checksums/);
  assert.deepEqual(state.calls, []);
});
test('publish verifies all downloads before tagging and publishing; reruns are read-only', async () => {
  const { state, publish } = fixture();
  await publish();
  const expected = [['draft',true,sha], ...assets.map(a => ['upload',a.name]), ['tag','refs/tags/'+tag,sha], ['publish',false]];
  assert.deepEqual(state.calls, expected);
  await publish();
  assert.deepEqual(state.calls, expected);
});
test('a partial upload stays draft and a retry completes the missing asset', async () => {
  const { state, publish } = fixture();
  state.failUpload = assets[1].name;
  await assert.rejects(publish, /upload interrupted/);
  assert.equal(state.release.draft, true);
  assert.equal(state.ref, null);
  assert.equal(state.release.assets.length, 1);
  state.failUpload = null;
  await publish();
  assert.equal(state.release.draft, false);
  assert.equal(state.calls.filter(([action]) => action === 'upload').length, assets.length);
});
test('accept an annotated tag on the same commit but reject conflicts and read failures', async () => {
  const { state, publish } = fixture();
  state.ref = { type: 'commit', sha: 'b'.repeat(40) };
  await assert.rejects(publish);
  state.refError = Object.assign(new Error('Forbidden'), { status: 403 });
  await assert.rejects(publish, /Forbidden/);
  assert.deepEqual(state.calls, []);
  state.refError = null;
  state.ref = { type: 'tag', sha: 'c'.repeat(40) };
  await publish();
  assert.equal(state.release.draft, false);
  assert.ok(!state.calls.some(([action]) => action === 'tag'));
});
test('an incomplete published release is reported without modifying it', async () => {
  const { state, publish } = fixture();
  await publish();
  state.release.assets.pop();
  const count = state.calls.length;
  await assert.rejects(publish);
  assert.equal(state.calls.length, count);
});

test('resume a draft by its verified tag or by its untagged target commit', async () => {
  for (const tagged of [true, false]) {
    const { state, publish } = fixture();
    if (tagged) state.ref = { type: 'commit', sha };
    state.release = { id: 2, tag_name: tag, draft: true, target_commitish: tagged ? 'old-ref' : 'main', assets: [] };
    await publish();
    assert.equal(state.release.draft, false);
    assert.equal(state.calls.some(([action]) => action === 'tag'), !tagged);
  }
});
test('leave unrelated drafts and assets alone', async () => {
  const { state, publish } = fixture();
  state.release = { id: 2, tag_name: tag, draft: true, target_commitish: 'different', assets: [] };
  await assert.rejects(publish);
  assert.deepEqual(state.calls, []);
  state.ref = { type: 'commit', sha };
  state.release.assets.push({ name: 'unrelated.bin' });
  await assert.rejects(publish);
  assert.deepEqual(state.calls, []);
});
