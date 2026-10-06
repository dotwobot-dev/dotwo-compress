const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['server.mjs', 'public/app.js', ...['electron','scripts','tests'].flatMap(dir =>
  fs.readdirSync(path.join(root,dir)).filter(name=>name.endsWith('.cjs')).map(name=>`${dir}/${name}`))];
for (const file of files) {
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
  if (result.status!==0) process.exit(1);
}
for (const name of fs.readdirSync(path.join(root,'scripts')).filter(name=>name.endsWith('.sh'))) {
  const result=spawnSync('/bin/bash',['-n',path.join(root,'scripts',name)],{stdio:'inherit'});
  if (result.status!==0) process.exit(1);
}
console.log(`Sintaxis verificada: ${files.length} JS/CJS + todos los scripts Bash.`);
