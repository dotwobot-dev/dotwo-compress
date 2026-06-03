import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const scriptsDir = join(root, 'scripts');
const logsDir = join(root, 'logs');
const port = Number(process.env.PORT || 8787);

const jobs = new Map();
const allowedInputExt = new Set(['.mov', '.mp4', '.m4v', '.mkv', '.avi', '.mxf']);

await mkdir(logsDir, { recursive: true });

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveBody(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function safePublicPath(urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = resolve(publicDir, `.${decodeURIComponent(requested)}`);
  if (!resolved.startsWith(publicDir)) return null;
  return resolved;
}

function contentType(path) {
  switch (extname(path)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function publicJob(job) {
  return {
    id: job.id,
    profile: job.profile,
    status: job.status,
    inputPath: job.inputPath,
    outputPath: job.outputPath,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    log: job.log.slice(-24000),
    validationLog: job.validationLog
  };
}

function appendLog(job, text) {
  job.log += text;
}

function runCommand(job, command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', chunk => appendLog(job, chunk.toString()));
    child.stderr.on('data', chunk => appendLog(job, chunk.toString()));

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolveCommand();
      else reject(new Error(`${command} termino con codigo ${code}`));
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolveCommand, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolveCommand(stdout.trim());
      else reject(new Error(stderr.trim() || `${command} termino con codigo ${code}`));
    });
  });
}

async function pickLocalFile() {
  const script = [
    'set pickedFile to choose file with prompt "Selecciona video para DoTwo Compress"',
    'POSIX path of pickedFile'
  ].join('\n');
  const selectedPath = await runCapture('osascript', ['-e', script]);
  if (!selectedPath) throw new Error('No se selecciono ningun archivo');
  return resolve(selectedPath);
}

function profileScript(profile) {
  return profile === 'h264' ? 'transcode_h264_mov.sh' : 'transcode_xdcam_ex_mov.sh';
}

async function startJob(inputPath, profile = 'k2') {
  const resolvedInput = resolve(inputPath);
  if (!existsSync(resolvedInput)) throw new Error('El archivo no existe');
  if (!statSync(resolvedInput).isFile()) throw new Error('La ruta no es un archivo');
  if (!allowedInputExt.has(extname(resolvedInput).toLowerCase())) {
    throw new Error('Extension no soportada');
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const job = {
    id,
    profile,
    status: 'running',
    inputPath: resolvedInput,
    outputPath: null,
    error: null,
    log: '',
    validationLog: '',
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
  jobs.set(id, job);

  queueMicrotask(async () => {
    try {
      appendLog(job, `Trabajo ${id}\nPerfil: ${profile}\nEntrada: ${resolvedInput}\n\n`);
      await runCommand(job, join(scriptsDir, profileScript(profile)), [resolvedInput]);

      const okLine = job.log.split(/\r?\n/).reverse().find(line => line.startsWith('OK: '));
      if (!okLine) throw new Error('No se pudo localizar la salida generada');
      job.outputPath = okLine.slice(4).trim();

      if (profile !== 'h264') {
        appendLog(job, '\n=== Validacion ===\n');
        try {
          await runCommand(job, join(scriptsDir, 'validate_against_reference.sh'), [job.outputPath]);
        } finally {
          const marker = '=== Validacion ===';
          const idx = job.log.lastIndexOf(marker);
          job.validationLog = idx >= 0 ? job.log.slice(idx + marker.length).trim() : '';
        }
      }

      job.status = 'success';
      job.finishedAt = new Date().toISOString();
      await writeFile(join(logsDir, `${id}.log`), job.log);
    } catch (error) {
      job.status = 'error';
      job.error = error.message;
      job.finishedAt = new Date().toISOString();
      appendLog(job, `\nERROR: ${error.message}\n`);
      await writeFile(join(logsDir, `${id}.log`), job.log);
    }
  });

  return job;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/jobs') {
      const body = await parseBody(req);
      const profile = body.profile === 'h264' ? 'h264' : 'k2';
      const job = await startJob(String(body.inputPath || '').trim(), profile);
      sendJson(res, 202, publicJob(job));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/pick-file') {
      const selectedPath = await pickLocalFile();
      if (!allowedInputExt.has(extname(selectedPath).toLowerCase())) {
        sendJson(res, 400, { error: 'Extension no soportada', path: selectedPath });
        return;
      }
      sendJson(res, 200, { path: selectedPath });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/jobs/', ''));
      const job = jobs.get(id);
      if (!job) {
        sendJson(res, 404, { error: 'Trabajo no encontrado' });
        return;
      }
      sendJson(res, 200, publicJob(job));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/download') {
      const path = resolve(String(url.searchParams.get('path') || ''));
      if (!path || !existsSync(path) || !statSync(path).isFile()) {
        sendJson(res, 404, { error: 'Archivo no encontrado' });
        return;
      }
      res.writeHead(200, {
        'content-type': 'video/quicktime',
        'content-disposition': `attachment; filename="${encodeURIComponent(path.split('/').pop() || 'VALIDADO.mov')}"`
      });
      createReadStream(path).pipe(res);
      return;
    }

    if (req.method === 'GET') {
      const filePath = safePublicPath(url.pathname);
      if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
        sendText(res, 404, 'Not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentType(filePath) });
      createReadStream(filePath).pipe(res);
      return;
    }

    sendText(res, 405, 'Method not allowed');
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`K2 local listo en http://127.0.0.1:${port}`);
});
