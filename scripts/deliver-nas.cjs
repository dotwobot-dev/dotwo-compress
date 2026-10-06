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
const hashBuffer = bytes => createHash('sha256').update(bytes).digest('hex');
async function main() {
  if (!destination.startsWith('/Volumes/BackUP_MacMini/DoTwo_Compress/release_archive/')) throw new Error('Destino debe ser release_archive de Compress en NAS.');
  if (fs.existsSync(destination)) throw new Error('Ya existe entrega NAS: no se sobrescribe.');
  if (fs.existsSync(local)) throw new Error('Ya existe staging de entrega; revisar antes de repetir.');
  const manifests={};
  for (const variant of ['modern-arm64','modern-x64','legacy-x64']) {
    const m = JSON.parse(fs.readFileSync(path.join(candidate,variant,'manifest.json')));
    if (m.status!=='verified' || !m.appStapled || !m.dmgStapled || !m.mountedDmgVerified) throw new Error(`Candidato no completo: ${variant}`);
    manifests[variant]=m;
  }
  fs.mkdirSync(path.join(local,'metadata'),{recursive:true});
  const delivery={version:'0.1.8',createdAt:new Date().toISOString(),teamId:'MR7VK26RP8',sourceCommit:run('git',['rev-parse','HEAD'],{cwd:root}).trim(),sourceDirty:Boolean(run('git',['status','--porcelain'],{cwd:root}).trim()),variants:{},fieldPending:['Intel moderno','macOS 10.13 real','Grass Valley K2','rendimiento con archivos reales']};
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
    delivery.variants[variant]={arch:m.arch,electron:m.electronVersion,minimum:m.minimumSystemVersion,appTreeHash:m.appTreeHash,applicationAppleId:m.notarizations.application.id,dmgAppleId:m.notarizations.dmg.id,appleStatus:'Accepted',runtimeSourcesMatchCurrent:true,machOCount:m.machO.length};
  }
  for(const [source,name] of [
    ['output/pdf/DoTwo_Compress_Manual_Rapido_0.1.8.pdf','DoTwo_Compress_Manual_Rapido_0.1.8.pdf'],
    ['docs/INSTALLATION.md','LEEME_INSTALACION.md'],
    ['docs/MANIFIESTO_0_1_8_FIRMADO.md','MANIFIESTO_0_1_8_FIRMADO.md'],
    ['output/qa/modern-arm64/results.json','metadata/qa-modern-arm64.json'],
    ['output/qa/limits.json','metadata/qa-limits.json'],
    ['docs/manual/assets/installation-finder.png','metadata/finder.png']
  ]) fs.copyFileSync(path.join(root,source),path.join(local,name));
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
