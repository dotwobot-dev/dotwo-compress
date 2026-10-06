const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { treeHash } = require('./release-mac-signed.cjs');
const { _electron } = createRequire(path.join(process.env.DOTWO_TEST_NODE_MODULES,'package.json'))('playwright');
const appPath = path.resolve(process.argv[2]);
const root = path.resolve(__dirname,'..');
const qaOutput = path.resolve(process.env.DOTWO_QA_OUTPUT_DIR || path.join(root,'output/qa/modern-arm64'));
const candidateVariant = path.dirname(path.dirname(appPath));
const manifest = JSON.parse(fs.readFileSync(path.join(candidateVariant,'manifest.json')));
async function main() {
  assert.equal(manifest.variant,'modern-arm64');
  assert.equal(manifest.status,'verified');
  assert.equal(manifest.sourceDirty,false);
  assert.equal(await treeHash(appPath),manifest.appTreeHash);
  if (!fs.existsSync(path.join(qaOutput,'results.json')) || fs.existsSync(path.join(qaOutput,'limits.json'))) throw new Error('QA base ausente o limites ya ejecutados.');
  const results=[];
  for (const scenario of [
    { name:'queue-total', env:{DOTWO_MAX_QUEUE_GB:'0.001'}, message:/Cola demasiado grande/, input:path.join(qaOutput,'DEMO_HORIZONTAL.mp4') },
    { name:'free-space', env:{DOTWO_MIN_FREE_GB:'100000'}, message:/Espacio insuficiente/, input:path.join(qaOutput,'DEMO_VERTICAL.mp4') }
  ]) {
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'compress-limit-'));
    const env={...process.env,...scenario.env}; delete env.ELECTRON_RUN_AS_NODE;
    const electron=await _electron.launch({executablePath:path.join(appPath,'Contents/MacOS/DoTwo Compress'),args:[`--user-data-dir=${profile}`],env});
    const child=electron.process();
    try {
      const page=await electron.firstWindow(); await page.waitForSelector('#pick-button');
      const error=await page.evaluate(async file=>{try{await window.k2.addToQueue([file]);return '';}catch(e){return e.message;}},scenario.input);
      assert.match(error,scenario.message);
      await page.evaluate(()=>window.k2.clearQueue());
      assert.deepEqual(fs.readdirSync(path.join(profile,'staging')),[]);
      results.push({scenario:scenario.name,passed:true,message:error});
    } finally { if(child.exitCode===null) await electron.close(); fs.rmSync(profile,{recursive:true,force:true}); }
  }
  fs.writeFileSync(path.join(qaOutput,'limits.json'),JSON.stringify({at:new Date().toISOString(),sourceCommit:manifest.sourceCommit,candidate:path.basename(path.dirname(candidateVariant)),appTreeHash:manifest.appTreeHash,results},null,2));
  console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
