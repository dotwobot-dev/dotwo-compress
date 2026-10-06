const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { run, verifyApplication } = require('./macos-signing.cjs');
const { sha256, treeHash } = require('./release-mac-signed.cjs');
const asar = require('@electron/asar');
const root = path.resolve(__dirname,'..');
const candidate = path.resolve(process.argv[2] || '');
const destination = path.resolve(process.argv[3] || '');
const local = path.join(root,'output/delivery',path.basename(destination));
const candidateId = path.basename(candidate);
const qaOutput = path.join(root,'output/qa/candidates',candidateId,'modern-arm64');
const hashBuffer = bytes => createHash('sha256').update(bytes).digest('hex');
async function main() {
  if (!candidate.startsWith(path.join(root,'release/signed')+path.sep)) throw new Error('Candidato fuera de release/signed.');
  if (!destination.startsWith('/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/')) throw new Error('Destino debe ser release_archive de Compress en NAS.');
  if (fs.existsSync(destination)) throw new Error('Ya existe entrega NAS: no se sobrescribe.');
  if (fs.existsSync(local)) throw new Error('Ya existe staging de entrega; revisar antes de repetir.');
  if (run('git',['status','--porcelain'],{cwd:root}).trim()) throw new Error('Entrega requiere arbol Git limpio.');
  const manifests={};
  for (const variant of ['modern-arm64','modern-x64','legacy-x64']) {
    const m = JSON.parse(fs.readFileSync(path.join(candidate,variant,'manifest.json')));
    if (m.status!=='verified' || !m.appStapled || !m.dmgStapled || !m.pkgStapled || !m.mountedDmgVerified ||
        m.requiredTargets?.join(',')!=='application,dmg,pkg') throw new Error(`Candidato no completo: ${variant}`);
    manifests[variant]=m;
  }
  const sourceCommit=manifests['modern-arm64'].sourceCommit;
  if (Object.values(manifests).some(m=>m.sourceCommit!==sourceCommit || m.sourceDirty)) throw new Error('Fuente del candidato no es unica y limpia.');
  const qa=JSON.parse(fs.readFileSync(path.join(qaOutput,'results.json')));
  const limits=JSON.parse(fs.readFileSync(path.join(qaOutput,'limits.json')));
  for (const record of [qa,limits]) {
    if (record.candidate!==candidateId || record.sourceCommit!==sourceCommit ||
        record.appTreeHash!==manifests['modern-arm64'].appTreeHash) throw new Error('QA no pertenece al candidato.');
  }
  if (!Array.isArray(qa.checks) || qa.checks.length<10 || !Array.isArray(qa.captured) || qa.captured.length<3 ||
      qa.errors?.length || limits.results?.length!==2 ||
      limits.results.some(r=>!r.passed)) throw new Error('QA arm64 incompleta.');
  fs.mkdirSync(path.join(local,'metadata'),{recursive:true});
  const delivery={version:'0.1.8',createdAt:new Date().toISOString(),teamId:'MR7VK26RP8',candidate:candidateId,sourceCommit,sourceDirty:false,deliveryCommit:run('git',['rev-parse','HEAD'],{cwd:root}).trim(),variants:{},fieldPending:['Intel moderno','macOS 10.13 real','Grass Valley K2','rendimiento con archivos reales','instalacion PKG desatendida real']};
  for (const [variant,m] of Object.entries(manifests)) {
    const directory=path.join(candidate,variant);
    const appPath=path.join(directory,m.arch==='arm64'?'mac-arm64':'mac','DoTwo Compress.app');
    if (await treeHash(appPath)!==m.appTreeHash) throw new Error('App modificada desde aprobacion.');
    verifyApplication(appPath,m.minimumSystemVersion,m.arch,true);
    const runtimeFiles=asar.listPackage(path.join(appPath,'Contents/Resources/app.asar')).filter(f=>/^\/(electron|public)\//.test(f) && /\.(cjs|js|html|css|png)$/.test(f));
    for (const filename of runtimeFiles) {
      if(hashBuffer(asar.extractFile(path.join(appPath,'Contents/Resources/app.asar'),filename.slice(1)))!==hashBuffer(fs.readFileSync(path.join(root,filename.slice(1))))) throw new Error(`Fuente de runtime diferente: ${filename}`);
    }
    const dmg = path.join(directory,`DoTwo-Compress-0.1.8-${variant}.dmg`);
    if(await sha256(dmg)!==m.dmgSha256) throw new Error('DMG modificado.');
    fs.copyFileSync(dmg,path.join(local,path.basename(dmg)));
    const pkg = path.join(directory,`DoTwo-Compress-0.1.8-${variant}.pkg`);
    if(await sha256(pkg)!==m.pkgSha256) throw new Error('PKG modificado.');
    require('./release-mac-signed.cjs').verifyPackage(pkg,m,true);
    fs.copyFileSync(pkg,path.join(local,path.basename(pkg)));
    const zip=path.join(local,`DoTwo-Compress-0.1.8-${variant}.app.zip`);
    run('ditto',['-c','-k','--sequesterRsrc','--keepParent',appPath,zip],{timeout:120000});
    const extracted=fs.mkdtempSync(path.join(os.tmpdir(),'compress-delivery-'));
    try {
      run('ditto',['-x','-k',zip,extracted],{timeout:120000});
      const app=path.join(extracted,'DoTwo Compress.app');
      verifyApplication(app,m.minimumSystemVersion,m.arch,true);
      if(await treeHash(app)!==m.appTreeHash) throw new Error('ZIP de app diferente.');
    } finally {fs.rmSync(extracted,{recursive:true,force:true});}
    fs.copyFileSync(path.join(directory,'manifest.json'),path.join(local,'metadata',`${variant}.json`));
    delivery.variants[variant]={arch:m.arch,electron:m.electronVersion,minimum:m.minimumSystemVersion,appTreeHash:m.appTreeHash,dmgSha256:m.dmgSha256,pkgSha256:m.pkgSha256,applicationAppleId:m.notarizations.application.id,dmgAppleId:m.notarizations.dmg.id,pkgAppleId:m.notarizations.pkg.id,appleStatus:'Accepted',runtimeSourcesMatchCurrent:true,machOCount:m.machO.length};
  }
  for(const [source,name] of [
    ['output/pdf/DoTwo_Compress_Manual_Rapido_0.1.8.pdf','DoTwo_Compress_Manual_Rapido_0.1.8.pdf'],
    ['docs/INSTALLATION.md','LEEME_INSTALACION.md'],
    [path.relative(root,path.join(qaOutput,'results.json')),'metadata/qa-modern-arm64.json'],
    [path.relative(root,path.join(qaOutput,'limits.json')),'metadata/qa-limits.json']
  ]) fs.copyFileSync(path.join(root,source),path.join(local,name));
  const screenshots=path.join(local,'metadata/qa-screenshots');
  fs.mkdirSync(screenshots);
  for (const name of qa.captured || []) {
    if (!/^[a-z0-9-]+\.png$/.test(name)) throw new Error('Nombre de captura QA no valido.');
    fs.copyFileSync(path.join(qaOutput,name),path.join(screenshots,name));
  }
  const manifestText=[
    '# DoTwo Compress 0.1.8 · entrega app + DMG + PKG',
    '',
    `Candidato: ${candidateId}`,
    `Commit de build: ${sourceCommit} (arbol limpio)`,
    `Commit de entrega: ${delivery.deliveryCommit}`,
    'Tres variantes: app, DMG y PKG firmados, Apple Accepted, tickets y Gatekeeper verificados.',
    'QA local aislada arm64 vinculada por commit y hash de app; ver metadata/.',
    'Pendiente: Intel moderno, High Sierra, Grass Valley K2, rendimiento e instalacion PKG desatendida real.',
    'La entrega NAS anterior app+DMG permanece separada; no hay tag ni GitHub Release.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(local,'MANIFIESTO_0_1_8_DMG_PKG.md'),manifestText);
  fs.writeFileSync(path.join(local,'metadata/delivery.json'),JSON.stringify(delivery,null,2)+'\n');
  const files = require('./macos-signing.cjs').walk(local).filter(f=>fs.statSync(f).isFile()).sort();
  const checksums=[];
  for(const file of files) checksums.push(`${await sha256(file)}  ${path.relative(local,file)}`);
  fs.writeFileSync(path.join(local,'SHA256SUMS.txt'),checksums.join('\n')+'\n');
  fs.mkdirSync(destination,{recursive:false});
  fs.cpSync(local,destination,{recursive:true,errorOnExist:true,force:false});
  for(const file of [...files,path.join(local,'SHA256SUMS.txt')]) {
    const copied=path.join(destination,path.relative(local,file));
    if(await sha256(file)!==await sha256(copied)) throw new Error(`Transferencia no coincide: ${copied}`);
  }
  console.log(`Entrega NAS verificada: ${destination}`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
