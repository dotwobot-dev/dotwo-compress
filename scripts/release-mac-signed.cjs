const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { run, checkSigning, notaryArgs, walk, verifyApplication, verifyCode } = require('./macos-signing.cjs');
const info = require('../package.json');
const root = path.resolve(__dirname, '..');
const variants = {
  'modern-arm64': { arch: 'arm64', electronVersion: info.devDependencies.electron, minimumSystemVersion: '12.0' },
  'modern-x64': { arch: 'x64', electronVersion: info.devDependencies.electron, minimumSystemVersion: '12.0' },
  'legacy-x64': { arch: 'x64', electronVersion: '26.6.10', minimumSystemVersion: '10.13.0' }
};
function saveManifest(file, value) {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(`${file}.tmp`, file);
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function treeHash(dir) {
  const hash = createHash('sha256');
  async function visit(base) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = path.join(base, entry.name);
      hash.update(path.relative(dir, file) + '\0');
      if (entry.isSymbolicLink()) hash.update(fs.readlinkSync(file));
      else if (entry.isDirectory()) await visit(file);
      else hash.update(await sha256(file));
    }
  }
  await visit(dir);
  return hash.digest('hex');
}
function buildConfig(name, output, signing) {
  const variant = variants[name];
  return {
    ...info.build, electronVersion: variant.electronVersion, forceCodeSigning: true,
    artifactName: `DoTwo-Compress-${info.version}-${name}.\${ext}`,
    directories: { ...info.build.directories, output },
    mac: { ...info.build.mac, target: ['dir'], identity: signing.application.hash,
      sign: path.join(root, 'scripts/sign-mac.cjs'), preAutoEntitlements: false,
      hardenedRuntime: true, notarize: false, minimumSystemVersion: variant.minimumSystemVersion },
    dmg: { ...info.build.dmg, title: `DoTwo Compress ${info.version} ${name}`, sign: true, writeUpdateInfo: false }
  };
}
function requireAccepted(entry) {
  if (entry.status !== 'Accepted' || !entry.id) throw new Error(`Apple ${entry.status || 'unknown'}: ${entry.id || 'sin ID'}`);
}
function packageRequirements(variant) {
  const arch = variant.arch === 'x64' ? 'x86_64' : 'arm64';
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
    `<plist version="1.0"><dict><key>os</key><array><string>${variant.minimumSystemVersion}</string></array>` +
    `<key>arch</key><array><string>${arch}</string></array></dict></plist>\n`;
}
function verifyPackage(pkgPath, manifest, notarized = false) {
  const signature = run('pkgutil', ['--check-signature', pkgPath]);
  if (!signature.includes('signed by a developer certificate issued by Apple for distribution') ||
      !signature.includes(`Developer ID Installer: Domingo Moreno (${manifest.teamId})`) ||
      !signature.includes('Signed with a trusted timestamp')) throw new Error('Firma Installer del PKG incorrecta.');
  const expandedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'compress-pkg-'));
  try {
    const expanded = path.join(expandedRoot, 'expanded');
    run('pkgutil', ['--expand', pkgPath, expanded]);
    const distribution = fs.readFileSync(path.join(expanded, 'Distribution'), 'utf8');
    const arch = manifest.arch === 'x64' ? 'x86_64' : 'arm64';
    if (!distribution.includes(`hostArchitectures="${arch}"`) ||
        !distribution.includes(`<os-version min="${manifest.minimumSystemVersion}"/>`) ||
        !distribution.includes('customLocation="/Applications"')) throw new Error('Requisitos o destino PKG incorrectos.');
  } finally { fs.rmSync(expandedRoot, { recursive: true, force: true }); }
  const payload = run('pkgutil', ['--payload-files', pkgPath]);
  for (const file of ['Contents/MacOS/DoTwo Compress',
    `Contents/Resources/bin/darwin-${manifest.arch}/ffmpeg`,
    `Contents/Resources/bin/darwin-${manifest.arch}/ffprobe`]) {
    if (!payload.includes(`./DoTwo Compress.app/${file}`)) throw new Error(`PKG sin ${file}.`);
  }
  if (notarized) {
    const assessment = run('spctl', ['--assess', '--verbose=2', '--type', 'install', pkgPath]);
    if (!assessment.includes('Notarized Developer ID')) throw new Error('Gatekeeper no reconoce notarizacion PKG.');
    run('xcrun', ['stapler', 'validate', pkgPath]);
  }
}
async function notarize(file, signing, entries, key, save, execute = run) {
  let entry = entries[key];
  if (!entry) {
    entry = entries[key] = { status: 'Submitting', sha256: await sha256(file), file: path.basename(file) };
    save();
    const result = JSON.parse(execute('xcrun', ['notarytool', 'submit', file, ...notaryArgs(signing), '--no-wait', '--output-format', 'json'], { timeout: 600000, stdoutOnly: true }));
    if (!result.id) throw new Error('Resultado de subida desconocido: consultar history antes de reintentar.');
    Object.assign(entry, { id: result.id, status: result.status || 'In Progress' });
    save();
  }
  if (!entry.id) throw new Error('Subida sin ID persistido: consultar history; no se duplicara.');
  console.log(`Apple ${key}: ${entry.id}`);
  entry.status = JSON.parse(execute('xcrun', ['notarytool', 'info', entry.id, ...notaryArgs(signing), '--output-format', 'json'], { stdoutOnly: true })).status;
  save();
  if (entry.status === 'In Progress') {
    try {
      entry.status = JSON.parse(execute('xcrun', ['notarytool', 'wait', entry.id, ...notaryArgs(signing), '--timeout', '45s', '--output-format', 'json'], { timeout: 55000, stdoutOnly: true })).status;
    } catch {
      entry.status = JSON.parse(execute('xcrun', ['notarytool', 'info', entry.id, ...notaryArgs(signing), '--output-format', 'json'], { stdoutOnly: true })).status;
    }
    save();
  }
  requireAccepted(entry);
}
function validateResume(output, manifest, signing) {
  if (manifest.discardedReason) throw new Error(`Candidato descartado: ${manifest.discardedReason}`);
  const rel = path.relative(path.join(root, 'release/signed'), fs.realpathSync(output));
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('Candidato fuera de release/signed.');
  const variant = variants[manifest.variant];
  if (!variant || manifest.version !== info.version || manifest.teamId !== signing.teamId ||
    Object.entries(variant).some(([k,v]) => manifest[k] !== v) || !manifest.appTreeHash ||
    manifest.sourceDirty || manifest.requiredTargets?.join(',') !== 'application,dmg,pkg') throw new Error('Metadatos del candidato no coinciden.');
}
async function finishCandidate(output, manifest, signing) {
  const { build, Platform, Arch } = require('electron-builder');
  const save = () => saveManifest(path.join(output, 'manifest.json'), manifest);
  const appPath = path.join(output, manifest.arch === 'arm64' ? 'mac-arm64' : 'mac', 'DoTwo Compress.app');
  const dmgPath = path.join(output, `DoTwo-Compress-${info.version}-${manifest.variant}.dmg`);
  const pkgPath = path.join(output, `DoTwo-Compress-${info.version}-${manifest.variant}.pkg`);
  try {
    if (await treeHash(appPath) !== manifest.appTreeHash) throw new Error('La app cambio desde la firma/envio.');
    verifyApplication(appPath, manifest.minimumSystemVersion, manifest.arch);
    manifest.notarizations ||= {};
    if (!manifest.appStapled) {
      const zip = path.join(output, 'application-for-notarization.zip');
      if (!manifest.notarizations.application) run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zip]);
      if (manifest.notarizations.application?.sha256 && await sha256(zip) !== manifest.notarizations.application.sha256) throw new Error('ZIP enviado modificado.');
      await notarize(zip, signing, manifest.notarizations, 'application', save);
      run('xcrun', ['stapler', 'staple', appPath]);
      manifest.appTreeHash = await treeHash(appPath);
      manifest.appStapled = true;
      save();
    }
    manifest.machO = verifyApplication(appPath, manifest.minimumSystemVersion, manifest.arch, true);
    if (!manifest.packaged) {
      await build({ projectDir: root, prepackaged: appPath, publish: 'never',
        targets: Platform.MAC.createTarget(['dmg'], Arch[manifest.arch]),
        config: buildConfig(manifest.variant, output, signing) });
      if (await treeHash(appPath) !== manifest.appTreeHash) throw new Error('El empaquetado modifico la app aprobada.');
      run('codesign', ['--verify', '--strict', dmgPath]);
      const details = run('codesign', ['--display', '--verbose=4', dmgPath]);
      if (!details.includes(`TeamIdentifier=${signing.teamId}`) || !/^Timestamp=/m.test(details)) throw new Error('Firma DMG incorrecta.');
      manifest.dmgSha256 = await sha256(dmgPath);
      manifest.packaged = true;
      save();
    }
    if (await sha256(dmgPath) !== manifest.dmgSha256) throw new Error('DMG modificado desde empaquetado.');
    if (!manifest.dmgStapled) {
      await notarize(dmgPath, signing, manifest.notarizations, 'dmg', save);
      run('xcrun', ['stapler', 'staple', dmgPath]);
      manifest.dmgSha256 = await sha256(dmgPath);
      manifest.dmgStapled = true;
      save();
    }
    run('codesign', ['--verify', '--strict', dmgPath]);
    run('spctl', ['--assess', '--verbose=2', '--type', 'open', '--context', 'context:primary-signature', dmgPath]);
    run('xcrun', ['stapler', 'validate', dmgPath]);
    const mounted = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', '-'], {
      input: run('hdiutil', ['attach', '-readonly', '-nobrowse', '-plist', dmgPath], { stdoutOnly: true }), stdoutOnly: true }));
    const mount = mounted['system-entities'].find(e => e['mount-point'])?.['mount-point'];
    if (!mount) throw new Error('No se pudo montar DMG.');
    try {
      verifyApplication(path.join(mount, 'DoTwo Compress.app'), manifest.minimumSystemVersion, manifest.arch, true);
      if (fs.readlinkSync(path.join(mount, 'Aplicaciones')) !== '/Applications') throw new Error('Enlace Aplicaciones incorrecto.');
      if (await treeHash(path.join(mount, 'DoTwo Compress.app')) !== manifest.appTreeHash) throw new Error('App dentro de DMG diferente.');
      manifest.mountedDmgVerified = true;
    } finally { run('hdiutil', ['detach', mount]); }
    if (!manifest.pkgPackaged) {
      const requirements = path.join(output, 'installer-requirements.plist');
      fs.writeFileSync(requirements, packageRequirements(manifest));
      run('productbuild', ['--product', requirements, '--component', appPath, '/Applications',
        '--sign', signing.installer.name, pkgPath], { timeout: 600000 });
      verifyPackage(pkgPath, manifest);
      if (await treeHash(appPath) !== manifest.appTreeHash) throw new Error('El PKG modifico la app aprobada.');
      manifest.pkgSha256 = await sha256(pkgPath);
      manifest.pkgPackaged = true;
      save();
    }
    if (await sha256(pkgPath) !== manifest.pkgSha256) throw new Error('PKG modificado desde empaquetado.');
    verifyPackage(pkgPath, manifest, Boolean(manifest.pkgStapled));
    if (!manifest.pkgStapled) {
      await notarize(pkgPath, signing, manifest.notarizations, 'pkg', save);
      run('xcrun', ['stapler', 'staple', pkgPath]);
      manifest.pkgSha256 = await sha256(pkgPath);
      manifest.pkgStapled = true;
      save();
    }
    verifyPackage(pkgPath, manifest, true);
    manifest.artifacts = [
      { file: path.basename(dmgPath), sha256: manifest.dmgSha256 },
      { file: path.basename(pkgPath), sha256: manifest.pkgSha256 }
    ];
    manifest.status = 'verified';
    manifest.verifiedAt = new Date().toISOString();
    delete manifest.error;
    save();
    console.log(`Verificado: ${output}`);
  } catch (e) {
    manifest.status = 'incomplete'; manifest.error = e.message; save();
    console.error(`Reanudar: npm run release:mac:signed -- --resume "${output}"`);
    throw e;
  }
}
async function prepare(name, session, signing, prepareOnly) {
  const { build, Platform, Arch } = require('electron-builder');
  const output = path.join(session, name);
  fs.mkdirSync(output);
  const manifest = { version: info.version, variant: name, ...variants[name], teamId: signing.teamId,
    requiredTargets: ['application', 'dmg', 'pkg'], createdAt: new Date().toISOString(), status: 'incomplete',
    sourceCommit: run('git', ['rev-parse', 'HEAD'], { cwd: root }).trim(),
    sourceDirty: Boolean(run('git', ['status', '--porcelain'], { cwd: root }).trim()) };
  const save = () => saveManifest(path.join(output, 'manifest.json'), manifest);
  save();
  await build({ projectDir: root, publish: 'never', targets: Platform.MAC.createTarget(['dir'], Arch[variants[name].arch]), config: buildConfig(name, output, signing) });
  const appPath = path.join(output, manifest.arch === 'arm64' ? 'mac-arm64' : 'mac', 'DoTwo Compress.app');
  manifest.machO = verifyApplication(appPath, manifest.minimumSystemVersion, manifest.arch);
  manifest.appTreeHash = await treeHash(appPath);
  manifest.status = 'signed-awaiting-notarization'; save();
  if (!prepareOnly) await finishCandidate(output, manifest, signing);
}
async function main() {
  const args = process.argv.slice(2);
  const signing = checkSigning();
  if (args[0] === '--resume' && args.length === 2) {
    const output = path.resolve(args[1]);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json')));
    validateResume(output, manifest, signing);
    await finishCandidate(output, manifest, signing); return;
  }
  const prepareOnly = args.includes('--prepare-only');
  const selected = args.includes('--all') ? Object.keys(variants) : args[0] === '--variant' && variants[args[1]] ? [args[1]] : [];
  if (!selected.length) throw new Error('Uso: --all | --variant modern-arm64|modern-x64|legacy-x64 [--prepare-only] | --resume ruta');
  if (run('git', ['status', '--porcelain'], { cwd: root }).trim()) throw new Error('La release exige arbol Git limpio antes del build.');
  run('npm', ['run', 'check'], { cwd: root, stdio: 'inherit' });
  run('npm', ['test'], { cwd: root, stdio: 'inherit' });
  const session = path.join(root, 'release/signed', `${info.version}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(session, { recursive: true }); console.log(`Candidatos: ${session}`);
  for (const name of selected) await prepare(name, session, signing, prepareOnly);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; process.on('exit', () => { process.exitCode = 1; }); });
module.exports = { variants, buildConfig, requireAccepted, notarize, validateResume, sha256, treeHash, packageRequirements, verifyPackage };
