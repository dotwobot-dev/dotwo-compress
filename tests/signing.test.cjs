const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseIdentities } = require('../scripts/macos-signing.cjs');
const { buildConfig, requireAccepted, notarize, treeHash, validateResume, variants, packageRequirements } = require('../scripts/release-mac-signed.cjs');
test('Only valid Developer ID identities are parsed', () => {
  const result = parseIdentities(' 1) ' + 'A'.repeat(40) + ' "Developer ID Application: Domingo Moreno (MR7VK26RP8)"\n 2) invalid "fake"');
  assert.equal(result.length, 1); assert.equal(result[0].teamId, 'MR7VK26RP8');
});
test('Legacy contains only x64 and preserves runtime/minimum', () => {
  const config = buildConfig('legacy-x64', '/tmp/out', { application: { name: 'Developer ID Application: Example' } });
  assert.equal(config.electronVersion, '26.6.10');
  assert.equal(config.mac.minimumSystemVersion, '10.13.0');
  assert.equal(config.mac.hardenedRuntime, true);
  assert.equal(config.extraResources[2].from, 'vendor/ffmpeg/darwin-${arch}');
  assert.equal(config.forceCodeSigning, true);
});
test('PKG rejects the wrong architecture and macOS generation at install time', () => {
  const modern = packageRequirements(variants['modern-arm64']);
  const legacy = packageRequirements(variants['legacy-x64']);
  assert.match(modern, /<key>os<\/key><array><string>12\.0<\/string>/);
  assert.match(modern, /<key>arch<\/key><array><string>arm64<\/string>/);
  assert.match(legacy, /<key>os<\/key><array><string>10\.13\.0<\/string>/);
  assert.match(legacy, /<key>arch<\/key><array><string>x86_64<\/string>/);
});
test('Apple pending is never accepted', () => {
  assert.throws(() => requireAccepted({ id: 'x', status: 'In Progress' }));
  assert.throws(() => requireAccepted({ status: 'Accepted' }));
});
test('Resume consults the persisted ID without duplicate submission', async () => {
  const entries = { app: { id: 'existing', status: 'In Progress' } };
  const calls = [];
  await notarize('unused.zip', { profile: 'dotwo-notary' }, entries, 'app', () => {}, (cmd,args) => {
    calls.push(args); return JSON.stringify({ id: 'existing', status: 'Accepted' });
  });
  assert.equal(calls.length, 1); assert.equal(calls[0][1], 'info');
});
test('Unknown upload outcome refuses to resubmit', async () => {
  await assert.rejects(notarize('unused', {}, { app: { status: 'Submitting' } }, 'app', () => {}, () => { throw new Error('must not call'); }), /sin ID|sin ID persistido/);
});
test('Changing a signed resource changes the complete app fingerprint', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'compress-hash-test-'));
  try {
    fs.writeFileSync(path.join(dir,'resource'),'before');
    const before = await treeHash(dir);
    fs.writeFileSync(path.join(dir,'resource'),'after');
    assert.notEqual(await treeHash(dir),before);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('A discarded functional candidate cannot be resumed as a delivery', () => {
  assert.throws(()=>validateResume('/unused',{discardedReason:'renderer failed'},{}),/descartado/);
});
