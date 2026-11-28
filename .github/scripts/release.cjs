'use strict';
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync, appendFileSync } = require('node:fs');

function versionParts(version) {
  if (typeof version !== 'string' || version.trim() !== version ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw Error('Expected a stable major.minor.patch version: ' + version);
  }
  return version.split('.').map(BigInt);
}
function releaseTag(previous, current) {
  const before = versionParts(previous), after = versionParts(current);
  for (let i = 0; i < before.length; i++) {
    if (after[i] < before[i]) throw Error('Release version decreased: ' + previous + ' to ' + current);
    if (after[i] > before[i]) return 'v' + current;
  }
  return '';
}
function releaseNotes(changelog, tag) {
  const sections = changelog.replace(/\r\n/g, '\n').split(/^## /m).slice(1);
  const entry = sections.find(section => section.split('\n', 1)[0].split(' - ')[0] === tag.slice(1));
  const notes = entry?.slice(entry.indexOf('\n') + 1).trim();
  if (!notes || !entry.includes('\n')) throw Error('Missing changelog entry for ' + tag);
  return notes;
}
async function tagCommit(github, repo, tag) {
  const git = github.rest.git;
  let object;
  try {
    object = (await git.getRef({ ...repo, ref: 'tags/' + tag })).data.object;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  while (object.type === 'tag') {
    object = (await git.getTag({ ...repo, tag_sha: object.sha })).data.object;
  }
  if (object.type !== 'commit') throw Error(tag + ' does not point to a commit');
  return object.sha;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

async function publishRelease({ github, repo, tag, sha, notes, assets, checksums }) {
  const sums = assets.find(asset => asset.name === 'SHA256SUMS.txt');
  const expected = assets.filter(asset => asset !== sums)
    .map(asset => sha256(asset.data) + '  ' + asset.name + '\n').join('');
  if (!sums || sha256(sums.data) !== checksums || !sums.data.equals(Buffer.from(expected))) {
    throw Error('Release downloads do not match the checksums from the build job');
  }
  const repos = github.rest.repos;
  const tagged = await tagCommit(github, repo, tag);
  if (tagged && tagged !== sha) throw Error(tag + ' already points to another commit');
  // Listing with the publishing token includes unpublished drafts left by a failed upload.
  const releases = await github.paginate(repos.listReleases, { ...repo, per_page: 100 });
  let release = releases.find(r => r.tag_name === tag);
  if (release && !tagged) {
    if (!release.draft) throw Error('Published release has no matching tag: ' + tag);
    const target = release.target_commitish;
    if (target !== sha && (await repos.getCommit({ ...repo, ref: target })).data.sha !== sha) {
      throw Error('Existing draft targets a different revision');
    }
  }
  if (release?.assets.some(existing => !assets.some(asset => asset.name === existing.name))) {
    throw Error('Release contains unexpected downloads: ' + tag);
  }
  const title = 'Media Inspector ' + tag;
  if (!release) {
    release = (await repos.createRelease({ ...repo, tag_name: tag, name: title, body: notes, target_commitish: sha, draft: true })).data;
  }
  for (const { name, data } of assets) {
    const digest = 'sha256:' + sha256(data);
    const existing = release.assets.find(asset => asset.name === name);
    if (existing?.state === 'uploaded' && existing.digest === digest) continue;
    if (!release.draft) throw Error('Published asset missing or different: ' + name);
    if (existing) await repos.deleteReleaseAsset({ ...repo, asset_id: existing.id });
    const { data: uploaded } = await repos.uploadReleaseAsset({
      ...repo, release_id: release.id, name, data, headers: { 'content-type': 'application/octet-stream' }
    });
    if (uploaded.state !== 'uploaded' || uploaded.digest !== digest) throw Error('Upload verification failed: ' + name);
  }
  if (release.draft) {
    const current = await tagCommit(github, repo, tag);
    if (current && current !== sha) throw Error(tag + ' changed during upload');
    if (!current) await github.rest.git.createRef({ ...repo, ref: 'refs/tags/' + tag, sha });
    await repos.updateRelease({ ...repo, release_id: release.id, name: title, body: notes, draft: false, prerelease: false, make_latest: 'legacy' });
  }
}

if (require.main === module) {
  const base = process.env.BASE_SHA;
  if (!/^[a-f0-9]{40}$/.test(base || '')) throw Error('Missing base commit');
  const previous = JSON.parse(execFileSync('git', ['show', base + ':app.config.json'], { encoding: 'utf8' }));
  const current = JSON.parse(readFileSync('app.config.json', 'utf8'));
  const tag = releaseTag(previous.version, current.version);
  if (tag) releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), tag);
  appendFileSync(process.env.GITHUB_OUTPUT, 'tag=' + tag + '\n');
}
module.exports = { releaseTag, releaseNotes, publishRelease };
