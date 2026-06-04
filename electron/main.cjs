const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { pipeline } = require("stream/promises");
const { pathToFileURL } = require("url");

let mainWindow;
const jobs = new Map();
const runningChildren = new Set();
let activeSession = null;
let clipQueue = [];
let montageSession = null;
const allowedInputExt = new Set([".mov", ".mp4", ".m4v", ".mkv", ".avi", ".mxf"]);
const profiles = {
  k2: {
    label: "K2 XDCAM",
    suffix: "VALIDADO",
    script: "transcode_xdcam_ex_mov.sh",
    validate: "k2"
  },
  h264: {
    label: "H.264 MOV",
    suffix: "H264",
    script: "transcode_h264_mov.sh",
    validate: "h264"
  }
};
const diagnosticBuild = "0.1.6-temp-cleanup";
const lockedSessionStatuses = new Set(["copying", "checking", "proxying", "processing", "validating", "saving"]);

function bytesFromGigabytesEnv(name, fallbackGigabytes) {
  const value = Number(process.env[name]);
  const gigabytes = Number.isFinite(value) && value > 0 ? value : fallbackGigabytes;
  return gigabytes * 1024 * 1024 * 1024;
}

const maxInputFileBytes = bytesFromGigabytesEnv("DOTWO_MAX_INPUT_GB", 25);
const maxQueueInputBytes = bytesFromGigabytesEnv("DOTWO_MAX_QUEUE_GB", 60);
const minFreeAfterCopyBytes = bytesFromGigabytesEnv("DOTWO_MIN_FREE_GB", 5);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function appRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
}

function resourcePath(...parts) {
  return path.join(appRoot(), ...parts);
}

function stagingRoot() {
  return path.join(app.getPath("userData"), "staging");
}

function resolveTool(name) {
  const platformArch = process.platform === "darwin" && process.arch === "arm64"
    ? "darwin-arm64"
    : "darwin-x64";
  const candidates = [
    resourcePath("bin", platformArch, name),
    resourcePath("vendor", "ffmpeg", platformArch, name)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return name;
}

function commandEnv(extraEnv = {}) {
  return {
    ...process.env,
    PATH: [
      path.dirname(resolveTool("ffmpeg")),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin"
    ].join(":"),
    FFMPEG_BIN: resolveTool("ffmpeg"),
    FFPROBE_BIN: resolveTool("ffprobe"),
    ...extraEnv
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    title: "DoTwo Compress",
    backgroundColor: "#eef2f3",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "public", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function trackChild(child) {
  runningChildren.add(child);
  const forget = () => runningChildren.delete(child);
  child.once("close", forget);
  child.once("error", forget);
  return child;
}

function terminateRunningChildren() {
  for (const child of [...runningChildren]) {
    try {
      child.kill("SIGTERM");
    } catch {
      // El proceso puede haber terminado entre la captura y el kill.
    }
  }
  runningChildren.clear();
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
    validationLog: job.validationLog,
    trimSelection: job.trimSelection
  };
}

function publicSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    originalPath: session.originalPath,
    stagedPath: session.stagedPath,
    outputPath: session.outputPath,
    savedPath: session.savedPath,
    proxyPath: session.proxyPath,
    proxyUrl: session.proxyPath ? pathToFileURL(session.proxyPath).href : null,
    defaultOutputName: session.defaultOutputName,
    defaultOutputNames: session.defaultOutputNames,
    activeProfile: session.activeProfile,
    copiedBytes: session.copiedBytes,
    totalBytes: session.totalBytes,
    progress: session.progress,
    error: session.error,
    durationSeconds: session.durationSeconds,
    log: session.log.slice(-24000),
    probeSummary: session.probeSummary,
    probeWarnings: session.probeWarnings,
    inspector: session.inspector,
    trimSelection: session.trimSelection,
    createdAt: session.createdAt,
    finishedAt: session.finishedAt
  };
}

function publicClip(session, index) {
  return {
    id: session.id,
    index,
    status: session.status,
    name: path.basename(session.originalPath || session.defaultOutputName || `Clip ${index + 1}`),
    originalPath: session.originalPath,
    proxyUrl: session.proxyPath ? pathToFileURL(session.proxyPath).href : null,
    durationSeconds: session.durationSeconds,
    inspectorLevel: session.inspector?.level || null,
    alertCount: session.inspector?.alerts?.length || 0,
    error: session.error
  };
}

function publicQueue() {
  return {
    clips: clipQueue.map(publicClip),
    activeSessionId: activeSession?.id || null,
    outputPath: montageSession?.outputPath || null,
    savedPath: montageSession?.savedPath || null
  };
}

function sendSessionUpdate(session) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("session:update", publicSession(session));
  }
}

function sendQueueUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("queue:update", publicQueue());
  }
}

function appendSessionLog(session, text) {
  session.log += text;
  sendSessionUpdate(session);
  sendQueueUpdate();
}

function appendLog(job, text) {
  job.log += text;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("job:update", publicJob(job));
  }
}

function runCommand(job, command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = trackChild(spawn(command, args, {
      cwd: appRoot(),
      env: commandEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"]
    }));

    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      appendLog(job, text);
      if (options.onOutput) options.onOutput(text);
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      appendLog(job, text);
      if (options.onOutput) options.onOutput(text);
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveCommand();
      else reject(new Error(`${path.basename(command)} termino con codigo ${code}`));
    });
  });
}

function runCapture(job, command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    let stdout = "";
    let stderr = "";
    const child = trackChild(spawn(command, args, {
      cwd: appRoot(),
      env: commandEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"]
    }));

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveCommand(stdout);
      else reject(new Error(stderr.trim() || `${path.basename(command)} termino con codigo ${code}`));
    });
  });
}

function runSessionCapture(session, command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    let stdout = "";
    let stderr = "";
    const child = trackChild(spawn(command, args, {
      cwd: appRoot(),
      env: commandEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"]
    }));

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveCommand(stdout);
      else reject(new Error(stderr.trim() || `${path.basename(command)} termino con codigo ${code}`));
    });
  });
}

function runSessionCommand(session, command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = trackChild(spawn(command, args, {
      cwd: appRoot(),
      env: commandEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"]
    }));

    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      appendSessionLog(session, text);
      if (options.onOutput) options.onOutput(text);
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      appendSessionLog(session, text);
      if (options.onOutput) options.onOutput(text);
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveCommand();
      else reject(new Error(`${path.basename(command)} termino con codigo ${code}`));
    });
  });
}

function sanitizeStem(filePath) {
  const raw = path.basename(filePath, path.extname(filePath));
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean = ascii
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return clean || "VIDEO";
}

function outputNameForProfile(filePath, profile) {
  const config = profiles[profile] || profiles.k2;
  return `${sanitizeStem(filePath)}_${config.suffix}.mov`;
}

function montageOutputNameForProfile(filePath, profile) {
  const config = profiles[profile] || profiles.k2;
  return `${sanitizeStem(filePath)}_MONTAJE_${config.suffix}.mov`;
}

function outputNamesForFile(filePath) {
  return Object.fromEntries(
    Object.keys(profiles).map(profile => [profile, outputNameForProfile(filePath, profile)])
  );
}

function nextAvailablePath(candidate) {
  const dir = path.dirname(candidate);
  const ext = path.extname(candidate);
  const stem = path.basename(candidate, ext);
  let next = candidate;
  let index = 1;

  while (fs.existsSync(next)) {
    next = path.join(dir, `${stem}_${String(index).padStart(3, "0")}${ext}`);
    index += 1;
  }

  return next;
}

function findGeneratedMovFallback(session, plannedOutput) {
  if (!session?.stagedPath) return null;
  const dir = path.dirname(session.stagedPath);
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(dir, entry.name))
      .filter(filePath => path.extname(filePath).toLowerCase() === ".mov")
      .filter(filePath => path.resolve(filePath) !== path.resolve(session.stagedPath))
      .filter(filePath => !path.basename(filePath).startsWith(".tmp."))
      .filter(filePath => path.resolve(filePath) !== path.resolve(plannedOutput || ""))
      .map(filePath => ({
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return null;
  }

  return entries[0]?.filePath || null;
}

function describeGeneratedMovCandidates(session) {
  if (!session?.stagedPath) return "Sin sesion temporal disponible";
  const dir = path.dirname(session.stagedPath);
  try {
    const lines = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(dir, entry.name))
      .filter(filePath => path.extname(filePath).toLowerCase() === ".mov")
      .map(filePath => {
        const stat = fs.statSync(filePath);
        return `- ${filePath} (${stat.size} bytes, modificado ${new Date(stat.mtimeMs).toISOString()})`;
      });
    return lines.length > 0 ? lines.join("\n") : "No hay MOV generados en el temporal";
  } catch (error) {
    return `No se pudo listar el temporal: ${error.message}`;
  }
}

function assertInputFile(inputPath) {
  const resolvedInput = path.resolve(String(inputPath || "").trim());
  if (!fs.existsSync(resolvedInput)) throw new Error("El archivo no existe");
  if (!fs.statSync(resolvedInput).isFile()) throw new Error("La ruta no es un archivo");
  if (!allowedInputExt.has(path.extname(resolvedInput).toLowerCase())) {
    throw new Error("Extension no soportada");
  }
  return resolvedInput;
}

function queuedOriginalBytes() {
  return clipQueue.reduce((total, session) => total + Number(session.originalSizeBytes || session.totalBytes || 0), 0);
}

function assertInputSizePolicy(filePath, options = {}) {
  const stat = fs.statSync(filePath);
  if (stat.size > maxInputFileBytes) {
    throw new Error(`Archivo demasiado grande (${formatBytes(stat.size)}). Limite por archivo: ${formatBytes(maxInputFileBytes)}.`);
  }

  const queuedBytes = options.resetQueue ? 0 : queuedOriginalBytes();
  if (queuedBytes + stat.size > maxQueueInputBytes) {
    throw new Error(`Cola demasiado grande (${formatBytes(queuedBytes + stat.size)}). Limite de cola: ${formatBytes(maxQueueInputBytes)}.`);
  }

  return stat;
}

function freeBytesForPath(dirPath) {
  if (typeof fs.statfsSync !== "function") return null;
  try {
    const statfs = fs.statfsSync(dirPath);
    const blockSize = Number(statfs.bsize || 0);
    const availableBlocks = Number(statfs.bavail || statfs.bfree || 0);
    if (!Number.isFinite(blockSize) || !Number.isFinite(availableBlocks) || blockSize <= 0) return null;
    return blockSize * availableBlocks;
  } catch {
    return null;
  }
}

function assertEnoughFreeSpace(dirPath, copyBytes) {
  const freeBytes = freeBytesForPath(dirPath);
  if (freeBytes === null) return;

  const requiredBytes = copyBytes + minFreeAfterCopyBytes;
  if (freeBytes < requiredBytes) {
    throw new Error(`Espacio insuficiente en disco. Libre: ${formatBytes(freeBytes)}. Necesario: ${formatBytes(requiredBytes)}.`);
  }
}

function assertNoRunningJob() {
  const running = [...jobs.values()].find(job => job.status === "running");
  if (running) throw new Error("Hay un proceso en marcha. Espera a que termine antes de cargar otro archivo.");
}

function assertNoBusySession() {
  assertNoRunningJob();
  const busyClip = clipQueue.find(clip => lockedSessionStatuses.has(clip.status));
  if (busyClip) {
    throw new Error("Hay una preparacion o conversion en marcha. Espera a que termine antes de modificar la cola.");
  }
  if (montageSession && lockedSessionStatuses.has(montageSession.status)) {
    throw new Error("Hay un montaje en marcha. Espera a que termine antes de modificar la cola.");
  }
}

async function resetStagingRoot() {
  await fs.promises.rm(stagingRoot(), { recursive: true, force: true });
  await fs.promises.mkdir(stagingRoot(), { recursive: true });
}

function resetStagingRootSync() {
  fs.rmSync(stagingRoot(), { recursive: true, force: true });
  fs.mkdirSync(stagingRoot(), { recursive: true });
}

async function resetQueueState() {
  assertNoBusySession();
  await resetStagingRoot();
  clipQueue = [];
  activeSession = null;
  montageSession = null;
  sendQueueUpdate();
  sendSessionUpdate(null);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatBitrate(bitsPerSecond) {
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) return "desconocido";
  if (bitsPerSecond >= 1000000) return `${(bitsPerSecond / 1000000).toFixed(1)} Mb/s`;
  return `${Math.round(bitsPerSecond / 1000)} kb/s`;
}

function parseRate(rate) {
  if (!rate || rate === "0/0") return null;
  const [num, den] = String(rate).split("/").map(Number);
  if (!num || !den) return null;
  return num / den;
}

function near(value, target, tolerance = 0.03) {
  return Number.isFinite(value) && Math.abs(value - target) <= tolerance;
}

function inspectorLevel(alerts) {
  if (alerts.some(alert => alert.level === "error")) return "error";
  if (alerts.some(alert => alert.level === "warn")) return "warn";
  return "ok";
}

function buildInputInspector(probe, filePath, stat) {
  const format = probe.format || {};
  const video = firstStream(probe, "video");
  const audio = firstStream(probe, "audio");
  const width = Number(video.width || 0);
  const height = Number(video.height || 0);
  const fps = parseRate(video.avg_frame_rate || video.r_frame_rate);
  const container = format.format_name || "desconocido";
  const videoCodec = video.codec_name || "desconocido";
  const audioCodec = audio.codec_name || "sin audio";
  const videoBitrate = Number(video.bit_rate || 0) || Number(format.bit_rate || 0);
  const fileSize = Number(stat.size || 0);
  const alerts = [];

  function warn(text) {
    alerts.push({ level: "warn", text });
  }

  function error(text) {
    alerts.push({ level: "error", text });
  }

  if (!video.codec_name) {
    error("No se detecta pista de video.");
  }

  if (!/(mov|mp4|m4a|3gp|3g2|mj2|mxf|matroska|avi)/i.test(container)) {
    warn(`Contenedor poco habitual: ${container}.`);
  }

  if (width && height && (width !== 1920 || height !== 1080)) {
    warn(`Resolucion ${width}x${height}. Se adaptara a 1080i para K2 y 1080p para H.264.`);
  }

  if (width && height && height > width) {
    warn("Video vertical. Se convertira a horizontal con fondo ampliado y desenfocado.");
  }

  if (width >= 3840 || height >= 2160) {
    warn("Fuente 4K/UHD. El procesado tardara mas y se reducira a 1920x1080.");
  }

  if (fps && !(near(fps, 25) || near(fps, 50))) {
    warn(`FPS ${fps.toFixed(3)}. El entorno del plato trabaja en PAL; se normalizara durante la conversion.`);
  }

  const fpsRef = parseRate(video.r_frame_rate);
  if (fps && fpsRef && Math.abs(fps - fpsRef) > 0.05) {
    warn("Posible frame rate variable. Conviene revisar reproduccion y sincronismo.");
  }

  if (["hevc", "h265", "vp9", "av1"].includes(videoCodec)) {
    warn(`Codec ${videoCodec.toUpperCase()} detectado. Puede tardar mas en procesar.`);
  }

  if (["rawvideo", "v210", "r210", "ayuv", "ffv1"].includes(videoCodec)) {
    warn(`Codec ${videoCodec} muy pesado o poco comun. La conversion puede ser lenta y el archivo original ocupar mucho.`);
  }

  if (videoBitrate > 80000000) {
    warn(`Bitrate alto (${formatBitrate(videoBitrate)}). El archivo pesa mas de lo normal para entrega.`);
  }

  if (fileSize > 5 * 1024 * 1024 * 1024) {
    warn(`Archivo muy grande (${formatBytes(fileSize)}). Revisa espacio libre y tiempo de copia.`);
  }

  if (!audio.codec_name) {
    warn("No se detecta audio. Se generara audio estereo silencioso.");
  } else {
    if (String(audio.sample_rate || "") !== "48000") {
      warn(`Audio a ${audio.sample_rate || "frecuencia desconocida"} Hz. Se convertira a 48 kHz.`);
    }
    if (Number(audio.channels || 0) !== 2) {
      warn(`Audio con ${audio.channels || "?"} canal(es). Se convertira a estereo.`);
    }
  }

  const level = inspectorLevel(alerts);
  return {
    level,
    label: level === "ok" ? "Correcto" : level === "warn" ? "Revisar" : "Problema",
    fields: [
      { label: "Archivo", value: path.basename(filePath) },
      { label: "Peso", value: formatBytes(fileSize) },
      { label: "Contenedor", value: container },
      { label: "Video", value: `${videoCodec} ${width || "?"}x${height || "?"}` },
      { label: "FPS", value: fps ? fps.toFixed(3).replace(/\.000$/, "") : "desconocido" },
      { label: "Bitrate", value: formatBitrate(videoBitrate) },
      { label: "Audio", value: audio.codec_name ? `${audioCodec}, ${audio.sample_rate || "?"} Hz, ${audio.channels || "?"} canal(es)` : "sin audio" }
    ],
    alerts
  };
}

function secondsFromFfmpegTime(text) {
  const matches = [...text.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const last = matches.at(-1);
  if (!last) return null;

  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

function updateConversionProgress(session, text) {
  const durationSeconds = session.progressDurationSeconds || session.durationSeconds;
  if (!durationSeconds) return;
  const seconds = secondsFromFfmpegTime(text);
  if (seconds === null) return;

  const progress = Math.max(1, Math.min(99, Math.round((seconds / durationSeconds) * 100)));
  if (progress > Number(session.progress || 0)) {
    session.progress = progress;
    sendSessionUpdate(session);
  }
}

async function copyWithProgress(session, source, destination, status, label) {
  const stat = await fs.promises.stat(source);
  let copiedBytes = 0;
  let lastUpdate = 0;

  session.status = status;
  session.totalBytes = stat.size;
  session.copiedBytes = 0;
  session.progress = 0;
  appendSessionLog(session, `${label}\nOrigen: ${source}\nDestino: ${destination}\nTamano: ${formatBytes(stat.size)}\n`);

  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  assertEnoughFreeSpace(path.dirname(destination), stat.size);

  const reader = fs.createReadStream(source, { highWaterMark: 1024 * 1024 });
  reader.on("data", chunk => {
    copiedBytes += chunk.length;
    const now = Date.now();
    if (now - lastUpdate > 120 || copiedBytes === stat.size) {
      lastUpdate = now;
      session.copiedBytes = copiedBytes;
      session.progress = stat.size > 0 ? Math.min(100, Math.round((copiedBytes / stat.size) * 100)) : 100;
      sendSessionUpdate(session);
    }
  });

  await pipeline(reader, fs.createWriteStream(destination));

  const copiedStat = await fs.promises.stat(destination);
  if (copiedStat.size !== stat.size) {
    throw new Error(`La copia no coincide en tamano (${formatBytes(copiedStat.size)} de ${formatBytes(stat.size)})`);
  }

  session.copiedBytes = stat.size;
  session.progress = 100;
  appendSessionLog(session, `Copia completada: ${formatBytes(stat.size)}\n\n`);
}

async function probeInput(session, filePath) {
  session.status = "checking";
  session.progress = 100;
  appendSessionLog(session, "Comprobando el archivo copiado con ffprobe...\n");
  const stat = await fs.promises.stat(filePath);

  const json = await runSessionCapture(session, resolveTool("ffprobe"), [
    "-v", "error",
    "-show_format",
    "-show_streams",
    "-print_format", "json",
    filePath
  ]);
  const probe = JSON.parse(json);
  const video = firstStream(probe, "video");
  const audio = firstStream(probe, "audio");

  if (!video.codec_name) {
    throw new Error("No se ha detectado una pista de video valida en la copia local");
  }

  const duration = Number(probe.format?.duration || 0);
  const width = Number(video.width || 0);
  const height = Number(video.height || 0);
  const durationText = duration > 0 ? `${duration.toFixed(2)} s` : "desconocida";
  const videoText = `${video.codec_name || "desconocido"} ${width || "?"}x${height || "?"}`;
  const audioText = audio.codec_name
    ? `${audio.codec_name}, ${audio.sample_rate || "?"} Hz, ${audio.channels || "?"} canal(es)`
    : "sin audio detectado; se generara audio PCM estereo";
  const inspector = buildInputInspector(probe, filePath, stat);

  session.probeSummary = {
    duration: durationText,
    video: videoText,
    audio: audioText
  };
  session.probeWarnings = inspector.alerts.map(alert => alert.text);
  session.inspector = inspector;
  session.sourceWidth = width || null;
  session.sourceHeight = height || null;
  session.durationSeconds = duration > 0 ? duration : null;
  appendSessionLog(session, `OK ffprobe\nDuracion: ${durationText}\nVideo: ${videoText}\nAudio: ${audioText}\n\n`);
  if (inspector.alerts.length > 0) {
    appendSessionLog(session, `Avisos:\n- ${inspector.alerts.map(alert => alert.text).join("\n- ")}\n\n`);
  }
}

async function createReviewProxy(session) {
  const proxyPath = path.join(path.dirname(session.stagedPath), "REVIEW_PROXY.mp4");
  session.status = "proxying";
  session.progress = 0;
  session.progressDurationSeconds = session.durationSeconds;
  session.proxyPath = null;
  appendSessionLog(session, "Generando proxy ligero para revision...\n");

  await runSessionCommand(
    session,
    resourcePath("scripts", "create_review_proxy.sh"),
    [session.stagedPath, proxyPath],
    { onOutput: text => updateConversionProgress(session, text) }
  );

  session.proxyPath = proxyPath;
  session.progress = 100;
  appendSessionLog(session, "Proxy de revision listo.\n\n");
  sendSessionUpdate(session);
}

function createSession(resolvedInput, originalSizeBytes) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sessionDir = path.join(stagingRoot(), id);
  const stagedPath = path.join(sessionDir, `ORIGINAL${path.extname(resolvedInput).toLowerCase()}`);
  return {
    id,
    status: "copying",
    originalPath: resolvedInput,
    originalSizeBytes,
    stagedPath,
    outputPath: null,
    savedPath: null,
    proxyPath: null,
    defaultOutputName: outputNameForProfile(resolvedInput, "k2"),
    defaultOutputNames: outputNamesForFile(resolvedInput),
    activeProfile: null,
    copiedBytes: 0,
    totalBytes: 0,
    progress: 0,
    error: null,
    log: "",
    probeSummary: null,
    probeWarnings: [],
    inspector: null,
    trimSelection: null,
    progressDurationSeconds: null,
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
}

async function prepareSession(inputPath, options = {}) {
  assertNoBusySession();
  const resolvedInput = assertInputFile(inputPath);
  const inputStat = assertInputSizePolicy(resolvedInput, options);

  if (options.resetQueue) {
    await resetQueueState();
  } else if (clipQueue.length === 0) {
    await resetStagingRoot();
  }

  const session = createSession(resolvedInput, inputStat.size);

  clipQueue.push(session);
  activeSession = session;
  montageSession = null;
  sendQueueUpdate();
  sendSessionUpdate(session);

  try {
    await copyWithProgress(session, resolvedInput, session.stagedPath, "copying", "Copiando el archivo a almacenamiento local de la app...");
    await probeInput(session, session.stagedPath);
    await createReviewProxy(session);

    session.status = "ready";
    appendSessionLog(session, "Archivo listo para procesar desde la copia local.\n");
    sendSessionUpdate(session);
    sendQueueUpdate();
    return publicSession(session);
  } catch (error) {
    session.status = "error";
    session.error = error.message;
    session.finishedAt = new Date().toISOString();
    appendSessionLog(session, `ERROR: ${error.message}\n`);
    throw error;
  }
}

async function prepareFile(inputPath) {
  return prepareSession(inputPath, { resetQueue: true });
}

async function addFilesToQueue(inputPaths) {
  const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  if (paths.length === 0) return { queue: publicQueue(), session: publicSession(activeSession) };

  let lastSession = null;
  for (const inputPath of paths) {
    lastSession = await prepareSession(inputPath, { resetQueue: false });
  }

  return {
    queue: publicQueue(),
    session: lastSession
  };
}

function selectQueueClip(sessionId) {
  const session = clipQueue.find(clip => clip.id === sessionId);
  if (!session) throw new Error("Clip no encontrado");
  activeSession = session;
  sendSessionUpdate(session);
  sendQueueUpdate();
  return publicSession(session);
}

async function removeQueueClip(sessionId) {
  assertNoBusySession();
  const index = clipQueue.findIndex(clip => clip.id === sessionId);
  if (index === -1) throw new Error("Clip no encontrado");
  const [removed] = clipQueue.splice(index, 1);
  await fs.promises.rm(path.dirname(removed.stagedPath), { recursive: true, force: true });

  if (activeSession?.id === sessionId) {
    activeSession = clipQueue[Math.min(index, clipQueue.length - 1)] || null;
    sendSessionUpdate(activeSession);
  }

  if (clipQueue.length === 0) {
    montageSession = null;
  }
  sendQueueUpdate();
  return publicQueue();
}

function moveQueueClip(sessionId, direction) {
  assertNoBusySession();
  const index = clipQueue.findIndex(clip => clip.id === sessionId);
  if (index === -1) throw new Error("Clip no encontrado");
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= clipQueue.length) return publicQueue();
  const [clip] = clipQueue.splice(index, 1);
  clipQueue.splice(nextIndex, 0, clip);
  sendQueueUpdate();
  return publicQueue();
}

function firstStream(probe, codecType) {
  return (probe.streams || []).find(stream => stream.codec_type === codecType) || {};
}

function roundSeconds(value) {
  return Math.round(value * 1000) / 1000;
}

function formatSecondsForLog(value) {
  if (!Number.isFinite(value)) return "desconocido";
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  if (minutes <= 0) return `${seconds.toFixed(2)} s`;
  return `${minutes} min ${seconds.toFixed(2)} s`;
}

function normalizeTrimSelection(rawTrim, sourceDuration) {
  if (!rawTrim || typeof rawTrim !== "object") return null;

  let start = Number(rawTrim.startSeconds ?? rawTrim.start ?? 0);
  const hasEnd = rawTrim.endSeconds !== null && rawTrim.endSeconds !== undefined;
  let end = hasEnd ? Number(rawTrim.endSeconds) : null;

  if (!Number.isFinite(start)) throw new Error("La marca IN no es valida");
  if (start < 0) start = 0;
  if (end !== null && !Number.isFinite(end)) throw new Error("La marca OUT no es valida");

  if (Number.isFinite(sourceDuration) && sourceDuration > 0) {
    if (start >= sourceDuration - 0.05) {
      throw new Error("La marca IN queda fuera de la duracion del video");
    }
    if (end !== null) {
      end = Math.min(Math.max(end, 0), sourceDuration);
    }
  }

  if (end !== null && end <= start + 0.05) {
    throw new Error("La marca OUT debe estar despues de la marca IN");
  }

  const fullRange = Number.isFinite(sourceDuration)
    && start <= 0.05
    && (end === null || end >= sourceDuration - 0.05);
  if (fullRange) return null;

  const duration = end !== null
    ? end - start
    : Number.isFinite(sourceDuration) && sourceDuration > start
      ? sourceDuration - start
      : null;
  if (duration !== null && duration < 0.1) {
    throw new Error("El recorte seleccionado es demasiado corto");
  }

  return {
    startSeconds: roundSeconds(start),
    endSeconds: end !== null ? roundSeconds(end) : null,
    durationSeconds: duration !== null ? roundSeconds(duration) : null
  };
}

function trimEnv(trimSelection) {
  if (!trimSelection) return {};
  const env = {
    K2_TRIM_START: String(trimSelection.startSeconds)
  };
  if (trimSelection.durationSeconds !== null) {
    env.K2_TRIM_DURATION = String(trimSelection.durationSeconds);
  }
  return env;
}

function validateProbe(probe) {
  const lines = [];
  let failures = 0;
  let warnings = 0;
  const video = firstStream(probe, "video");
  const audio = firstStream(probe, "audio");
  const tmcdCount = (probe.streams || []).filter(stream => stream.codec_tag_string === "tmcd").length;

  function ok(label, actual) {
    lines.push(`OK   ${label} = ${actual}`);
  }

  function fail(label, actual, expected) {
    lines.push(`FAIL ${label} = ${actual}, esperado ${expected}`);
    failures += 1;
  }

  function warn(label, text) {
    lines.push(`WARN ${label} ${text}`);
    warnings += 1;
  }

  function check(label, actual, expected) {
    if (String(actual) === String(expected)) ok(label, actual);
    else fail(label, actual || "missing", expected);
  }

  check("major_brand", probe.format?.tags?.major_brand || "", "qt  ");
  check("stream_0", probe.streams?.[0]?.codec_type || "", "audio");
  check("stream_1", probe.streams?.[1]?.codec_type || "", "video");
  check("video.codec", video.codec_name || "", "mpeg2video");
  check("video.tag", video.codec_tag_string || "", "xdvc");
  check("video.width", video.width || 0, 1920);
  check("video.height", video.height || 0, 1080);
  check("video.pix_fmt", video.pix_fmt || "", "yuv420p");
  check("video.r_frame_rate", video.r_frame_rate || "", "25/1");
  check("video.avg_frame_rate", video.avg_frame_rate || "", "25/1");
  check("video.field_order", video.field_order || "", "tb");
  check("audio.codec", audio.codec_name || "", "pcm_s16le");

  if (audio.codec_tag_string === "lpcm" || audio.codec_tag_string === "sowt") {
    ok("audio.tag", audio.codec_tag_string);
  } else {
    fail("audio.tag", audio.codec_tag_string || "missing", "lpcm o sowt");
  }

  check("audio.sample_rate", audio.sample_rate || "", "48000");
  check("audio.channels", audio.channels || 0, 2);
  check("audio.bits_per_sample", audio.bits_per_sample || 0, 16);
  check("timecode.tmcd_count", tmcdCount, 1);
  check("video.timecode", video.tags?.timecode || "", "00:00:00:00");

  if (failures > 0) lines.push("", `RESULTADO: FAIL (${failures} fallo(s), ${warnings} aviso(s))`);
  else if (warnings > 0) lines.push("", `RESULTADO: WARN (${warnings} aviso(s))`);
  else lines.push("", "RESULTADO: OK");

  return {
    ok: failures === 0,
    warnings,
    failures,
    text: lines.join("\n")
  };
}

async function validateOutputWithNode(job, outputPath) {
  const json = await runCapture(job, resolveTool("ffprobe"), [
    "-v", "error",
    "-show_format",
    "-show_streams",
    "-print_format", "json",
    outputPath
  ]);
  return validateProbe(JSON.parse(json));
}

async function validateH264OutputWithNode(job, outputPath) {
  const json = await runCapture(job, resolveTool("ffprobe"), [
    "-v", "error",
    "-show_format",
    "-show_streams",
    "-print_format", "json",
    outputPath
  ]);
  const probe = JSON.parse(json);
  const video = firstStream(probe, "video");
  const audio = firstStream(probe, "audio");
  const lines = [];
  let failures = 0;

  function ok(label, actual) {
    lines.push(`OK   ${label} = ${actual}`);
  }

  function fail(label, actual, expected) {
    lines.push(`FAIL ${label} = ${actual || "missing"}, esperado ${expected}`);
    failures += 1;
  }

  function check(label, actual, expected) {
    if (String(actual) === String(expected)) ok(label, actual);
    else fail(label, actual, expected);
  }

  check("video.codec", video.codec_name || "", "h264");
  check("video.tag", video.codec_tag_string || "", "avc1");
  check("video.width", video.width || 0, 1920);
  check("video.height", video.height || 0, 1080);
  check("video.pix_fmt", video.pix_fmt || "", "yuv420p");
  check("audio.codec", audio.codec_name || "", "aac");
  check("audio.sample_rate", audio.sample_rate || "", "48000");
  check("audio.channels", audio.channels || 0, 2);

  if (failures > 0) lines.push("", `RESULTADO: FAIL (${failures} fallo(s))`);
  else lines.push("", "RESULTADO: OK");

  return {
    ok: failures === 0,
    failures,
    warnings: 0,
    text: lines.join("\n")
  };
}

async function pickLocalFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecciona video para DoTwo Compress",
    properties: ["openFile"],
    filters: [
      { name: "Video", extensions: ["mov", "mp4", "m4v", "mkv", "avi", "mxf"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const selectedPath = result.filePaths[0];
  if (!allowedInputExt.has(path.extname(selectedPath).toLowerCase())) {
    throw new Error("Extension no soportada");
  }

  return {
    canceled: false,
    path: selectedPath
  };
}

async function pickLocalFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecciona videos para DoTwo Compress",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Video", extensions: ["mov", "mp4", "m4v", "mkv", "avi", "mxf"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, paths: [] };
  }

  for (const selectedPath of result.filePaths) {
    if (!allowedInputExt.has(path.extname(selectedPath).toLowerCase())) {
      throw new Error(`Extension no soportada: ${path.basename(selectedPath)}`);
    }
  }

  return {
    canceled: false,
    paths: result.filePaths
  };
}

async function startJob(inputPathOrSessionId, requestedProfile = "k2", rawTrim = null) {
  const profile = profiles[requestedProfile] ? requestedProfile : "k2";
  const profileConfig = profiles[profile];
  const session = activeSession && activeSession.id === inputPathOrSessionId ? activeSession : null;
  const resolvedInput = session ? session.stagedPath : assertInputFile(inputPathOrSessionId);
  if (!session) assertInputSizePolicy(resolvedInput, { resetQueue: true });
  if (session && !["ready", "processed", "saved"].includes(session.status)) {
    throw new Error("El archivo aun no esta listo para procesar");
  }

  const trimSelection = normalizeTrimSelection(rawTrim, session?.durationSeconds || null);

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const plannedOutput = session
    ? path.join(path.dirname(session.stagedPath), outputNameForProfile(session.originalPath, profile))
    : null;
  const job = {
    id,
    profile,
    status: "running",
    inputPath: resolvedInput,
    outputPath: null,
    error: null,
    log: "",
    validationLog: "",
    trimSelection,
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
  jobs.set(id, job);

  queueMicrotask(async () => {
    try {
      if (session) {
        session.status = "processing";
        session.progress = 0;
        session.progressDurationSeconds = trimSelection?.durationSeconds || session.durationSeconds;
        session.activeProfile = profile;
        session.trimSelection = trimSelection;
        session.defaultOutputName = outputNameForProfile(session.originalPath, profile);
        session.outputPath = null;
        session.savedPath = null;
        appendSessionLog(session, [
          `Procesando ${profileConfig.label} desde la copia local...`,
          `Version app: ${app.getVersion()}`,
          `Build diagnostico: ${diagnosticBuild}`,
          `Script: ${resourcePath("scripts", profileConfig.script)}`,
          `Entrada local: ${resolvedInput}`,
          `Salida prevista: ${plannedOutput || "desconocida"}`,
          ""
        ].join("\n"));
        if (trimSelection) {
          appendSessionLog(session, `Recorte activo: IN ${formatSecondsForLog(trimSelection.startSeconds)}${trimSelection.endSeconds !== null ? `, OUT ${formatSecondsForLog(trimSelection.endSeconds)}` : ", hasta el final"}.\n`);
        }
      }
      appendLog(job, `Trabajo ${id}\nPerfil: ${profileConfig.label}\nEntrada: ${resolvedInput}\nFFmpeg: ${resolveTool("ffmpeg")}\nFFprobe: ${resolveTool("ffprobe")}\n`);
      if (trimSelection) {
        appendLog(job, `Recorte: IN ${formatSecondsForLog(trimSelection.startSeconds)}${trimSelection.endSeconds !== null ? `, OUT ${formatSecondsForLog(trimSelection.endSeconds)}` : ", hasta el final"}\n`);
      }
      appendLog(job, "\n");
      await runCommand(
        job,
        resourcePath("scripts", profileConfig.script),
        plannedOutput ? [resolvedInput, plannedOutput] : [resolvedInput],
        {
          env: trimEnv(trimSelection),
          ...(session ? { onOutput: text => updateConversionProgress(session, text) } : {})
        }
      );

      const okMatch = job.log.match(/(?:^|[\r\n])OK:\s*(.+?)(?:[\r\n]|$)/);
      const fallbackOutput = session ? findGeneratedMovFallback(session, plannedOutput) : null;
      if (plannedOutput && fs.existsSync(plannedOutput)) {
        job.outputPath = plannedOutput;
      } else if (okMatch) {
        job.outputPath = okMatch[1].trim();
      } else if (fallbackOutput && fs.existsSync(fallbackOutput)) {
        job.outputPath = fallbackOutput;
        appendLog(job, `Salida recuperada por busqueda en temporal: ${fallbackOutput}\n`);
      } else {
        if (plannedOutput) appendLog(job, `Salida prevista no encontrada: ${plannedOutput}\n`);
        if (session) {
          appendSessionLog(session, [
            "",
            "=== Diagnostico salida K2 ===",
            `Salida prevista no encontrada: ${plannedOutput || "desconocida"}`,
            `Existe salida prevista: ${plannedOutput ? String(fs.existsSync(plannedOutput)) : "sin ruta"}`,
            `Temporal: ${session.stagedPath ? path.dirname(session.stagedPath) : "desconocido"}`,
            "MOV detectados:",
            describeGeneratedMovCandidates(session),
            "",
            "Ultimo log de conversion:",
            job.log.slice(-10000),
            "=== Fin diagnostico salida K2 ===",
            ""
          ].join("\n"));
        }
        throw new Error("No se pudo localizar la salida generada");
      }
      if (session) {
        session.outputPath = job.outputPath;
      }

      appendLog(job, "\n=== Validacion ===\n");
      if (session) {
        session.status = "validating";
        session.progress = 100;
        appendSessionLog(session, "Validando salida procesada...\n");
      }
      const validation = profileConfig.validate === "h264"
        ? await validateH264OutputWithNode(job, job.outputPath)
        : await validateOutputWithNode(job, job.outputPath);
      appendLog(job, `${validation.text}\n`);
      job.validationLog = validation.text;

      job.status = "success";
      job.finishedAt = new Date().toISOString();
      appendLog(job, "\nTrabajo finalizado.\n");
      if (session) {
        session.status = "processed";
        session.progress = 100;
        session.finishedAt = new Date().toISOString();
        appendSessionLog(session, "Procesado terminado. Ya puedes guardar el archivo validado.\n");
      }
    } catch (error) {
      job.status = "error";
      job.error = error.message;
      job.finishedAt = new Date().toISOString();
      appendLog(job, `\nERROR: ${error.message}\n`);
      if (session) {
        session.status = "error";
        session.error = error.message;
        session.finishedAt = new Date().toISOString();
        if (job.log) {
          appendSessionLog(session, `\n=== Conversion ===\n${job.log.slice(-10000)}\n`);
        }
        appendSessionLog(session, `ERROR: ${error.message}\n`);
      }
    }
  });

  return publicJob(job);
}

function concatFileLine(filePath) {
  return `file '${String(filePath).replace(/'/g, "'\\''")}'`;
}

function updateMontageProgress(session, text, completedSeconds, segmentSeconds, totalSeconds) {
  if (!totalSeconds) return;
  const seconds = secondsFromFfmpegTime(text);
  if (seconds === null) return;
  const done = completedSeconds + Math.min(seconds, segmentSeconds || seconds);
  const progress = Math.max(1, Math.min(92, Math.round((done / totalSeconds) * 92)));
  if (progress > Number(session.progress || 0)) {
    session.progress = progress;
    sendSessionUpdate(session);
  }
}

async function startQueueJob(requestedProfile = "k2", trimMap = {}) {
  assertNoRunningJob();
  const profile = profiles[requestedProfile] ? requestedProfile : "k2";
  const profileConfig = profiles[profile];
  const clips = clipQueue.filter(clip => ["ready", "processed", "saved"].includes(clip.status));
  if (clips.length === 0) throw new Error("No hay clips listos para procesar");
  if (clips.length !== clipQueue.length) throw new Error("Hay clips de la cola que aun no estan listos");

  const trimsById = trimMap && typeof trimMap === "object" ? trimMap : {};
  const normalizedTrims = new Map();
  let totalDuration = 0;
  for (const clip of clips) {
    const trim = normalizeTrimSelection(trimsById[clip.id], clip.durationSeconds || null);
    normalizedTrims.set(clip.id, trim);
    totalDuration += trim?.durationSeconds || clip.durationSeconds || 0;
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const montageDir = path.join(stagingRoot(), `montage-${id}`);
  const finalOutput = path.join(montageDir, montageOutputNameForProfile(clips[0].originalPath, profile));
  const job = {
    id,
    profile,
    status: "running",
    inputPath: clips.map(clip => clip.stagedPath).join(", "),
    outputPath: null,
    error: null,
    log: "",
    validationLog: "",
    trimSelection: null,
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
  jobs.set(id, job);

  montageSession = {
    id: `montage-${id}`,
    status: "processing",
    originalPath: clips[0].originalPath,
    stagedPath: null,
    outputPath: null,
    savedPath: null,
    proxyPath: null,
    defaultOutputName: montageOutputNameForProfile(clips[0].originalPath, profile),
    defaultOutputNames: null,
    activeProfile: profile,
    copiedBytes: 0,
    totalBytes: 0,
    progress: 0,
    error: null,
    durationSeconds: totalDuration || null,
    progressDurationSeconds: totalDuration || null,
    log: "",
    probeSummary: null,
    probeWarnings: [],
    inspector: null,
    trimSelection: null,
    createdAt: new Date().toISOString(),
    finishedAt: null
  };
  activeSession = montageSession;
  sendSessionUpdate(montageSession);
  sendQueueUpdate();

  queueMicrotask(async () => {
    const segmentPaths = [];
    let completedSeconds = 0;
    try {
      await fs.promises.mkdir(montageDir, { recursive: true });
      appendSessionLog(montageSession, `Montaje ${profileConfig.label}\nClips: ${clips.length}\n`);
      appendLog(job, `Trabajo ${id}\nPerfil: ${profileConfig.label}\nClips: ${clips.length}\nFFmpeg: ${resolveTool("ffmpeg")}\nFFprobe: ${resolveTool("ffprobe")}\n\n`);

      for (const [index, clip] of clips.entries()) {
        const trim = normalizedTrims.get(clip.id);
        const segmentPath = path.join(montageDir, `segment_${String(index + 1).padStart(3, "0")}.mov`);
        const segmentDuration = trim?.durationSeconds || clip.durationSeconds || 0;
        segmentPaths.push(segmentPath);

        clip.status = "processing";
        activeSession = montageSession;
        sendQueueUpdate();
        appendSessionLog(montageSession, `Normalizando clip ${index + 1}/${clips.length}: ${path.basename(clip.originalPath)}\n`);
        if (trim) {
          appendSessionLog(montageSession, `Recorte clip ${index + 1}: IN ${formatSecondsForLog(trim.startSeconds)}${trim.endSeconds !== null ? `, OUT ${formatSecondsForLog(trim.endSeconds)}` : ", hasta el final"}.\n`);
        }

        await runCommand(
          job,
          resourcePath("scripts", profileConfig.script),
          [clip.stagedPath, segmentPath],
          {
            env: trimEnv(trim),
            onOutput: text => updateMontageProgress(montageSession, text, completedSeconds, segmentDuration, totalDuration)
          }
        );

        completedSeconds += segmentDuration;
        clip.status = "ready";
        sendQueueUpdate();
      }

      montageSession.status = "processing";
      montageSession.progress = 94;
      appendSessionLog(montageSession, "Concatenando segmentos normalizados...\n");
      const concatListPath = path.join(montageDir, "concat.txt");
      await fs.promises.writeFile(concatListPath, `${segmentPaths.map(concatFileLine).join("\n")}\n`, "utf8");
      const concatArgs = profile === "k2"
        ? [
            "-y", "-hide_banner",
            "-f", "concat",
            "-safe", "0",
            "-i", concatListPath,
            "-filter_complex", "[0:v:0]fps=50,interlace=scan=tff,format=yuv420p,setfield=tff[v]",
            "-map", "0:a:0",
            "-map", "[v]",
            "-c:a", "pcm_s16le",
            "-ar", "48000",
            "-ac", "2",
            "-tag:a", "lpcm",
            "-metadata:s:a:0", "handler_name=Core Media Audio",
            "-c:v", "mpeg2video",
            "-pix_fmt", "yuv420p",
            "-b:v", "35M",
            "-maxrate:v", "35M",
            "-bufsize:v", "16M",
            "-g", "12",
            "-bf", "2",
            "-flags", "+ildct+ilme",
            "-top", "1",
            "-alternate_scan", "1",
            "-dc", "10",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-colorspace", "bt709",
            "-tag:v", "xdvc",
            "-metadata:s:v:0", "encoder=XDCAM EX 1080i50 (35 Mbps)",
            "-metadata:s:v:0", "handler_name=Core Media Video",
            "-map_metadata", "-1",
            "-timecode", "00:00:00:00",
            "-write_tmcd", "on",
            "-brand", "qt  ",
            "-video_track_timescale", "25000",
            "-movflags", "+faststart",
            "-f", "mov",
            finalOutput
          ]
        : [
            "-y", "-hide_banner",
            "-f", "concat",
            "-safe", "0",
            "-i", concatListPath,
            "-c", "copy",
            "-map_metadata", "-1",
            "-movflags", "+faststart",
            finalOutput
          ];
      await runCommand(job, resolveTool("ffmpeg"), concatArgs);

      job.outputPath = finalOutput;
      montageSession.outputPath = finalOutput;
      montageSession.status = "validating";
      montageSession.progress = 98;
      appendSessionLog(montageSession, "Validando montaje final...\n");
      appendLog(job, "\n=== Validacion ===\n");
      const validation = profileConfig.validate === "h264"
        ? await validateH264OutputWithNode(job, finalOutput)
        : await validateOutputWithNode(job, finalOutput);
      appendLog(job, `${validation.text}\n`);
      job.validationLog = validation.text;

      job.status = "success";
      job.finishedAt = new Date().toISOString();
      appendLog(job, "\nMontaje finalizado.\n");
      montageSession.status = "processed";
      montageSession.progress = 100;
      montageSession.finishedAt = new Date().toISOString();
      appendSessionLog(montageSession, "Montaje terminado. Ya puedes guardar el archivo final.\n");
      sendSessionUpdate(montageSession);
      sendQueueUpdate();
    } catch (error) {
      job.status = "error";
      job.error = error.message;
      job.finishedAt = new Date().toISOString();
      appendLog(job, `\nERROR: ${error.message}\n`);
      if (montageSession) {
        montageSession.status = "error";
        montageSession.error = error.message;
        montageSession.finishedAt = new Date().toISOString();
        appendSessionLog(montageSession, `ERROR: ${error.message}\n`);
      }
      clips.forEach(clip => {
        if (clip.status === "processing") clip.status = "ready";
      });
      sendQueueUpdate();
    }
  });

  return publicJob(job);
}

async function savePreparedOutput(sessionId) {
  const session = activeSession && activeSession.id === sessionId ? activeSession : null;
  if (!session) throw new Error("No hay un archivo procesado activo");
  if (!session.outputPath || !fs.existsSync(session.outputPath)) {
    throw new Error("No hay salida procesada para guardar");
  }

  const defaultPath = nextAvailablePath(path.join(
    path.dirname(session.originalPath),
    session.defaultOutputName
  ));
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Guardar video procesado",
    defaultPath,
    filters: [
      { name: "QuickTime MOV", extensions: ["mov"] },
      { name: "Todos los archivos", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const destination = path.extname(result.filePath)
    ? result.filePath
    : `${result.filePath}.mov`;

  if (path.resolve(destination) === path.resolve(session.outputPath)) {
    throw new Error("Elige una ruta de guardado distinta al temporal interno de la app");
  }

  try {
    await copyWithProgress(session, session.outputPath, destination, "saving", "Guardando el archivo procesado...");
    session.status = "saved";
    session.savedPath = destination;
    appendSessionLog(session, `Archivo guardado: ${destination}\n`);
    sendSessionUpdate(session);
    return { canceled: false, session: publicSession(session) };
  } catch (error) {
    session.status = "error";
    session.error = error.message;
    appendSessionLog(session, `ERROR: ${error.message}\n`);
    throw error;
  }
}

ipcMain.handle("app:diagnostics", async () => ({
  packaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
  resourcesPath: process.resourcesPath,
  ffmpegPath: resolveTool("ffmpeg"),
  ffprobePath: resolveTool("ffprobe"),
  hasBundledFfmpeg: fs.existsSync(resolveTool("ffmpeg")) && path.isAbsolute(resolveTool("ffmpeg")),
  hasBundledFfprobe: fs.existsSync(resolveTool("ffprobe")) && path.isAbsolute(resolveTool("ffprobe")),
  limits: {
    maxInputFileBytes,
    maxQueueInputBytes,
    minFreeAfterCopyBytes
  }
}));

ipcMain.handle("file:pick", () => pickLocalFile());
ipcMain.handle("files:pick", () => pickLocalFiles());
ipcMain.handle("file:prepare", (_event, inputPath) => prepareFile(inputPath));
ipcMain.handle("file:save-output", (_event, sessionId) => savePreparedOutput(sessionId));
ipcMain.handle("job:start", (_event, inputPath, profile, trimSelection) => startJob(inputPath, profile, trimSelection));
ipcMain.handle("queue:add", (_event, inputPaths) => addFilesToQueue(inputPaths));
ipcMain.handle("queue:select", (_event, sessionId) => selectQueueClip(sessionId));
ipcMain.handle("queue:remove", (_event, sessionId) => removeQueueClip(sessionId));
ipcMain.handle("queue:move", (_event, sessionId, direction) => moveQueueClip(sessionId, direction));
ipcMain.handle("queue:clear", () => resetQueueState().then(() => publicQueue()));
ipcMain.handle("queue:start", (_event, profile, trimMap) => startQueueJob(profile, trimMap));
ipcMain.handle("job:get", (_event, id) => {
  const job = jobs.get(id);
  if (!job) throw new Error("Trabajo no encontrado");
  return publicJob(job);
});
ipcMain.handle("file:reveal", (_event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return true;
});

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      resetStagingRootSync();
    } catch {
      // La limpieza de arranque no debe bloquear la app; nueva sesion lo intentara de nuevo.
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  try {
    terminateRunningChildren();
    resetStagingRootSync();
  } catch {
    // La limpieza de temporales no debe impedir cerrar la app.
  }
});
