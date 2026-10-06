const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { run } = require('./macos-signing.cjs');
const dependencyRoot = process.env.DOTWO_TEST_NODE_MODULES;
if (!dependencyRoot) throw new Error('Indica DOTWO_TEST_NODE_MODULES con playwright instalado.');
const { _electron } = createRequire(path.join(dependencyRoot, 'package.json'))('playwright');
const root = path.resolve(__dirname, '..');
const appPath = path.resolve(process.argv[2]);
const variant = process.argv[3] || 'modern-arm64';
const out = path.join(root, 'output/qa', variant);
fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-qa-'));
const resources = path.join(appPath, 'Contents/Resources');
const arch = variant.includes('arm64') ? 'arm64' : 'x64';
const ffmpeg = path.join(resources, 'bin', `darwin-${arch}`, 'ffmpeg');
const ffprobe = path.join(resources, 'bin', `darwin-${arch}`, 'ffprobe');
const captured = [];
function probe(file) { return JSON.parse(run(ffprobe, ['-v','error','-show_streams','-show_format','-of','json',file], { stdoutOnly: true })); }
async function screenshot(page, name) {
  const file = path.join(out, `${name}.png`);
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({ path: file, fullPage: true }); captured.push(file);
  const selector = { review: '#review-panel', queue: '#queue-panel', result: '#result-strip' }[name];
  if (selector) {
    const detail = path.join(out, `${name}-detail.png`);
    await page.locator(selector).screenshot({ path: detail }); captured.push(detail);
  }
}
async function main() {
  run(ffmpeg, ['-y','-v','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=25',
    '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',path.join(out,'DEMO_HORIZONTAL.mp4')]);
  run(ffmpeg, ['-y','-v','error','-f','lavfi','-i','testsrc2=size=360x640:rate=25',
    '-t','3','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',path.join(out,'DEMO_VERTICAL.mp4')]);
  const horizontal = path.join(out, 'DEMO_HORIZONTAL.mp4');
  const vertical = path.join(out, 'DEMO_VERTICAL.mp4');
  const electron = await _electron.launch({ executablePath: path.join(appPath,'Contents/MacOS/DoTwo Compress'),
    args: [`--user-data-dir=${profile}`], env: { ...process.env, ELECTRON_RUN_AS_NODE: '' }, timeout: 60000 });
  const checks = [];
  const appProcess = electron.process();
  const errors = [];
  let page;
  const stderr = [];
  electron.process().stderr?.on('data', chunk => stderr.push(chunk.toString()));
  try {
    page = await electron.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#pick-button');
    const actualProfile = await electron.evaluate(({ app }) => app.getPath('userData'));
    assert.equal(actualProfile, profile); checks.push('Perfil de pruebas aislado');
    const diagnostics = await page.evaluate(() => window.k2.diagnostics());
    assert.equal(diagnostics.hasBundledFfmpeg, true); assert.equal(diagnostics.hasBundledFfprobe, true);
    checks.push('FFmpeg/FFprobe empaquetados');
    await electron.evaluate(({ dialog }, input) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [input] }); }, horizontal);
    await page.click('#pick-button');
    await page.waitForFunction(() => !document.querySelector('#process-k2-button').disabled, null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#review-video').readyState >= 2, null, { timeout: 60000 });
    const playback = await page.evaluate(async () => { const v = document.querySelector('#review-video'); await v.play(); return v.currentTime; });
    await page.waitForFunction(t => document.querySelector('#review-video').currentTime > t + .1, playback);
    await page.evaluate(() => document.querySelector('#review-video').pause());
    checks.push('Carga/copia local, inspector, proxy y reproduccion');
    await page.evaluate(() => { document.querySelector('#review-video').currentTime = 1; });
    await page.click('#mark-in-button');
    await page.evaluate(() => { document.querySelector('#review-video').currentTime = 4; });
    await page.click('#mark-out-button'); checks.push('Marcas IN/OUT por controles reales');
    await screenshot(page, 'review');
    async function processAndSave(profileName, file) {
      await page.click(`[data-profile="${profileName}"]`);
      await page.waitForFunction(() => ['Procesado','Error'].includes(document.querySelector('#job-status').textContent), null, { timeout: 180000 });
      assert.equal(await page.locator('#job-status').textContent(), 'Procesado', await page.locator('#log-output').textContent());
      await electron.evaluate(({ dialog }, destination) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination }); }, file);
      await page.click('#download-link');
      await page.waitForFunction(() => document.querySelector('#job-status').textContent === 'Guardado', null, { timeout: 60000 });
      const p = probe(file); const v = p.streams.find(s=>s.codec_type==='video');
      assert.equal(v.width,1920); assert.equal(v.height,1080);
      assert.equal(v.codec_name,profileName==='k2'?'mpeg2video':'h264');
      if (profileName === 'k2') { assert.equal(v.codec_tag_string,'xdvc'); assert.equal(v.field_order,'tb'); assert.equal(v.avg_frame_rate,'25/1'); }
      checks.push(`${profileName}: conversion, validacion y guardado`);
      return p;
    }
    const h264 = await processAndSave('h264', path.join(out,'RECORTE_H264.mov'));
    assert.ok(Math.abs(Number(h264.format.duration)-3)<.3);
    await processAndSave('k2', path.join(out,'RECORTE_VALIDADO.mov'));
    await electron.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled:false,filePaths:paths }); }, [vertical, horizontal]);
    await page.click('#pick-button');
    await page.waitForFunction(() => document.querySelectorAll('.clip-item').length === 3 && !document.querySelector('#process-k2-button').disabled, null, { timeout: 120000 });
    await page.locator('[data-action="remove"]').last().click();
    await page.waitForFunction(() => document.querySelectorAll('.clip-item').length === 2);
    await page.locator('[data-action="up"]').last().click();
    await page.waitForFunction(() => document.querySelector('.clip-name')?.textContent === 'DEMO_VERTICAL.mp4' || document.querySelector('.clip-main strong')?.textContent === 'DEMO_VERTICAL.mp4');
    await page.locator('[data-action="select"]').first().click();
    await page.waitForFunction(() => document.querySelector('#review-video').readyState >= 2);
    await page.locator('[data-action="down"]').first().click();
    checks.push('Cola: anadir, seleccionar, subir/bajar y quitar');
    await screenshot(page,'queue');
    await processAndSave('h264',path.join(out,'MONTAJE_H264.mov'));
    await processAndSave('k2',path.join(out,'MONTAJE_VALIDADO.mov'));
    await page.click('#log-toggle');
    assert.ok((await page.locator('#log-output').textContent()).includes('RESULTADO: OK'));
    await screenshot(page,'result'); checks.push('Progreso y registro tecnico');
    await page.click('#clear-queue-button');
    await page.waitForFunction(() => document.querySelector('#queue-panel').hidden);
    assert.deepEqual(fs.readdirSync(path.join(profile,'staging')),[]); checks.push('Limpiar cola elimina temporales');
    const huge = path.join(out,'DEMO_SIZE_LIMIT.mp4'); const fd=fs.openSync(huge,'w'); fs.ftruncateSync(fd,26*1024**3); fs.closeSync(fd);
    const rejection = await page.evaluate(async file => { try { await window.k2.addToQueue([file]); return ''; } catch(e) { return e.message; } },huge);
    assert.match(rejection,/demasiado grande/); fs.unlinkSync(huge); checks.push('Limite 25 GiB rechazado antes de copiar (archivo disperso)');
    assert.deepEqual(errors,[]);
    await electron.close();
    assert.deepEqual(fs.readdirSync(path.join(profile,'staging')),[]); checks.push('Cierre limpia temporales');
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ variant, version:'0.1.8',host:run('sw_vers',['-productVersion']).trim(),arch:process.arch,checks,errors,captured,at:new Date().toISOString()},null,2));
    console.log(JSON.stringify({ variant,checks },null,2));
  } catch (e) {
    console.error('Electron diagnostic', await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ title:w.getTitle(),url:w.webContents.getURL(),crashed:w.webContents.isCrashed() }))));
    console.error(stderr.join(''));
    if (page && !page.isClosed()) await Promise.race([page.screenshot({path:path.join(out,'failure.png'),timeout:3000}).catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
    throw e;
  } finally {
    if (appProcess.exitCode === null) await electron.close();
    fs.rmSync(profile,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
