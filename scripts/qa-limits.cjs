const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { _electron } = createRequire(path.join(process.env.DOTWO_TEST_NODE_MODULES,'package.json'))('playwright');
const appPath = path.resolve(process.argv[2]);
const root = path.resolve(__dirname,'..');
async function main() {
  const results=[];
  for (const scenario of [
    { name:'queue-total', env:{DOTWO_MAX_QUEUE_GB:'0.001'}, message:/Cola demasiado grande/, input:path.join(root,'output/qa/modern-arm64/DEMO_HORIZONTAL.mp4') },
    { name:'free-space', env:{DOTWO_MIN_FREE_GB:'100000'}, message:/Espacio insuficiente/, input:path.join(root,'output/qa/modern-arm64/DEMO_VERTICAL.mp4') }
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
  fs.writeFileSync(path.join(root,'output/qa/limits.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
  console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
