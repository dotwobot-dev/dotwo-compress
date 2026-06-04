const form = document.querySelector('#job-form');
const input = document.querySelector('#input-path');
const processButtons = Array.from(document.querySelectorAll('[data-profile]'));
const pickButton = document.querySelector('#pick-button');
const statusEl = document.querySelector('#job-status');
const logEl = document.querySelector('#log-output');
const logPanel = document.querySelector('#log-panel');
const logToggle = document.querySelector('#log-toggle');
const resultStrip = document.querySelector('#result-strip');
const outputPathEl = document.querySelector('#output-path');
const downloadLink = document.querySelector('#download-link');
const progressPanel = document.querySelector('#progress-panel');
const progressLabel = document.querySelector('#progress-label');
const progressPercent = document.querySelector('#progress-percent');
const progressBar = document.querySelector('#progress-bar');
const probeSummary = document.querySelector('#probe-summary');
const warningList = document.querySelector('#warning-list');
const queuePanel = document.querySelector('#queue-panel');
const queueTitle = document.querySelector('#queue-title');
const clipList = document.querySelector('#clip-list');
const clearQueueButton = document.querySelector('#clear-queue-button');
const reviewPanel = document.querySelector('#review-panel');
const reviewVideo = document.querySelector('#review-video');
const reviewPlaceholder = document.querySelector('#review-placeholder');
const trimReadout = document.querySelector('#trim-readout');
const markInButton = document.querySelector('#mark-in-button');
const markOutButton = document.querySelector('#mark-out-button');
const clearTrimButton = document.querySelector('#clear-trim-button');
const inspectorLight = document.querySelector('#inspector-light');
const inspectorTitle = document.querySelector('#inspector-title');
const inspectorGrid = document.querySelector('#inspector-grid');
const inspectorAlerts = document.querySelector('#inspector-alerts');
const isElectron = Boolean(window.k2);

let pollTimer = null;
let removeJobListener = null;
let currentSession = null;
let latestJobLog = '';
let trimState = { in: null, out: null };
let queueState = { clips: [], activeSessionId: null };
const trimBySessionId = new Map();

const lockedSessionStates = new Set(['copying', 'checking', 'proxying', 'processing', 'validating', 'saving']);
const readySessionStates = new Set(['ready', 'processed', 'saved']);

function setStatus(text, state = '') {
  statusEl.textContent = text;
  statusEl.className = state;
}

function sessionStatusText(status) {
  return {
    copying: 'Copiando a temporal local',
    checking: 'Comprobando archivo',
    proxying: 'Generando proxy de revision',
    ready: 'Listo para procesar',
    processing: 'Procesando',
    validating: 'Validando salida',
    processed: 'Procesado',
    saving: 'Guardando procesado',
    saved: 'Guardado',
    error: 'Error'
  }[status] || 'En espera';
}

function sessionStateClass(status) {
  if (status === 'error') return 'error';
  if (['ready', 'processed', 'saved'].includes(status)) return 'success';
  return status || '';
}

function resetResult() {
  resultStrip.hidden = true;
  outputPathEl.textContent = '';
  downloadLink.removeAttribute('href');
  downloadLink.dataset.path = '';
  downloadLink.dataset.mode = '';
}

function resetProgress() {
  progressPanel.hidden = true;
  progressLabel.textContent = 'Preparando';
  progressPercent.textContent = '0%';
  progressBar.style.width = '0%';
  probeSummary.textContent = '';
  warningList.hidden = true;
  warningList.replaceChildren();
}

function resetReview() {
  reviewPanel.hidden = true;
  reviewVideo.pause();
  reviewVideo.removeAttribute('src');
  reviewVideo.load();
  reviewPlaceholder.hidden = false;
  resetTrim();
  setTrimButtonsEnabled(false);
  inspectorLight.className = 'traffic-light';
  inspectorTitle.textContent = 'Pendiente';
  inspectorGrid.replaceChildren();
  inspectorAlerts.hidden = true;
  inspectorAlerts.replaceChildren();
}

function formatTime(value) {
  if (!Number.isFinite(value)) return '--:--';
  const safeValue = Math.max(0, value);
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = Math.floor(safeValue % 60);
  const frames = Math.floor((safeValue - Math.floor(safeValue)) * 25);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const ff = String(frames).padStart(2, '0');
  return hours > 0 ? `${hh}:${mm}:${ss}:${ff}` : `${mm}:${ss}:${ff}`;
}

function proxyDuration() {
  return Number.isFinite(reviewVideo.duration) ? reviewVideo.duration : currentSession?.durationSeconds || null;
}

function resetTrim() {
  trimState = { in: null, out: null };
  renderTrim();
}

function setTrimButtonsEnabled(enabled) {
  markInButton.disabled = !enabled;
  markOutButton.disabled = !enabled;
  clearTrimButton.disabled = !enabled || (trimState.in === null && trimState.out === null);
}

function renderTrim() {
  const duration = proxyDuration();
  const start = trimState.in ?? 0;
  const end = trimState.out ?? duration;

  if (trimState.in === null && trimState.out === null) {
    trimReadout.textContent = 'Seleccion: archivo completo';
  } else if (Number.isFinite(end) && end > start) {
    trimReadout.textContent = `Seleccion: IN ${formatTime(start)} · OUT ${formatTime(end)} · ${formatTime(end - start)}`;
  } else if (trimState.in !== null) {
    trimReadout.textContent = `Seleccion: IN ${formatTime(start)} · hasta el final`;
  } else {
    trimReadout.textContent = `Seleccion: desde el inicio · OUT ${formatTime(trimState.out)}`;
  }

  setTrimButtonsEnabled(Boolean(currentSession?.proxyUrl));
}

function buildTrimPayload() {
  if (trimState.in === null && trimState.out === null) return null;

  const duration = proxyDuration();
  const start = trimState.in ?? 0;
  const end = trimState.out;
  if (end !== null && end <= start + 0.05) {
    throw new Error('La marca OUT debe estar despues de la marca IN');
  }

  if (Number.isFinite(duration) && start >= duration - 0.05) {
    throw new Error('La marca IN queda fuera de la duracion del video');
  }

  return {
    startSeconds: Math.max(0, Number(start.toFixed(3))),
    endSeconds: end !== null ? Math.max(0, Number(end.toFixed(3))) : null
  };
}

function currentProxyTime() {
  if (!Number.isFinite(reviewVideo.currentTime)) return 0;
  const duration = proxyDuration();
  if (Number.isFinite(duration)) {
    return Math.min(Math.max(0, reviewVideo.currentTime), duration);
  }
  return Math.max(0, reviewVideo.currentTime);
}

function cloneTrim(trim) {
  return {
    in: Number.isFinite(trim?.in) ? trim.in : null,
    out: Number.isFinite(trim?.out) ? trim.out : null
  };
}

function saveTrimForCurrentSession() {
  if (!currentSession?.id || currentSession.id.startsWith('montage-')) return;
  trimBySessionId.set(currentSession.id, cloneTrim(trimState));
}

function loadTrimForSession(session) {
  if (!session?.id || session.id.startsWith('montage-')) {
    trimState = { in: null, out: null };
    return;
  }
  trimState = cloneTrim(trimBySessionId.get(session.id));
}

function trimLabelForClip(clip) {
  const trim = trimBySessionId.get(clip.id);
  if (!trim || (trim.in === null && trim.out === null)) return 'Completo';
  const start = trim.in ?? 0;
  const end = trim.out ?? clip.durationSeconds;
  if (Number.isFinite(end) && end > start) {
    return `${formatTime(start)} - ${formatTime(end)}`;
  }
  return `${formatTime(start)} - final`;
}

function buildTrimPayloadForClip(clip) {
  const trim = trimBySessionId.get(clip.id);
  if (!trim || (trim.in === null && trim.out === null)) return null;
  const start = trim.in ?? 0;
  const end = trim.out;
  if (end !== null && end <= start + 0.05) {
    throw new Error(`Revisa OUT en ${clip.name}`);
  }
  if (Number.isFinite(clip.durationSeconds) && start >= clip.durationSeconds - 0.05) {
    throw new Error(`Revisa IN en ${clip.name}`);
  }
  return {
    startSeconds: Math.max(0, Number(start.toFixed(3))),
    endSeconds: end !== null ? Math.max(0, Number(end.toFixed(3))) : null
  };
}

function buildQueueTrimPayload() {
  return Object.fromEntries(
    (queueState.clips || []).map(clip => [clip.id, buildTrimPayloadForClip(clip)])
  );
}

function renderInspector(inspector) {
  if (!inspector) return;

  reviewPanel.hidden = false;
  inspectorLight.className = `traffic-light ${inspector.level || 'ok'}`;
  inspectorTitle.textContent = inspector.label || 'Revisado';
  inspectorGrid.replaceChildren(...(inspector.fields || []).map(field => {
    const fragment = document.createDocumentFragment();
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = field.label;
    value.textContent = field.value;
    fragment.append(term, value);
    return fragment;
  }));

  const alerts = inspector.alerts || [];
  if (alerts.length) {
    inspectorAlerts.hidden = false;
    inspectorAlerts.replaceChildren(...alerts.map(alert => {
      const item = document.createElement('li');
      item.className = alert.level || 'warn';
      item.textContent = alert.text;
      return item;
    }));
  } else {
    inspectorAlerts.hidden = true;
    inspectorAlerts.replaceChildren();
  }
}

function renderProxy(proxyUrl) {
  if (!proxyUrl) {
    reviewPlaceholder.hidden = false;
    reviewVideo.hidden = true;
    setTrimButtonsEnabled(false);
    return;
  }

  reviewPanel.hidden = false;
  reviewVideo.hidden = false;
  reviewPlaceholder.hidden = true;
  if (reviewVideo.getAttribute('src') !== proxyUrl) {
    reviewVideo.src = proxyUrl;
    reviewVideo.load();
  }
  setTrimButtonsEnabled(true);
}

function statusLabel(status) {
  return {
    copying: 'Copiando',
    checking: 'Analizando',
    proxying: 'Proxy',
    ready: 'Listo',
    processing: 'Procesando',
    validating: 'Validando',
    processed: 'Procesado',
    saved: 'Guardado',
    error: 'Error'
  }[status] || 'Pendiente';
}

function renderQueue(queue) {
  queueState = queue || { clips: [], activeSessionId: null };
  const clips = queueState.clips || [];
  const queueLocked = clips.some(clip => lockedSessionStates.has(clip.status));
  queuePanel.hidden = clips.length === 0;
  queueTitle.textContent = `${clips.length} clip${clips.length === 1 ? '' : 's'}`;
  clearQueueButton.disabled = clips.length === 0 || queueLocked;

  clipList.replaceChildren(...clips.map((clip, index) => {
    const item = document.createElement('li');
    item.className = `clip-item${clip.id === queueState.activeSessionId ? ' active' : ''}`;
    item.dataset.id = clip.id;

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'clip-select';
    selectButton.dataset.action = 'select';
    selectButton.dataset.id = clip.id;
    const clipIndex = document.createElement('span');
    const clipMain = document.createElement('span');
    const clipName = document.createElement('strong');
    const clipMeta = document.createElement('small');
    const clipBadge = document.createElement('span');
    clipIndex.className = 'clip-index';
    clipMain.className = 'clip-main';
    clipBadge.className = `clip-badge ${clip.inspectorLevel || ''}`;
    clipIndex.textContent = String(index + 1);
    clipName.textContent = clip.name;
    clipMeta.textContent = `${statusLabel(clip.status)} · ${trimLabelForClip(clip)}`;
    clipBadge.textContent = clip.alertCount ? `${clip.alertCount} aviso${clip.alertCount === 1 ? '' : 's'}` : 'OK';
    clipMain.append(clipName, clipMeta);
    selectButton.append(clipIndex, clipMain, clipBadge);

    const actions = document.createElement('div');
    actions.className = 'clip-actions';
    [
      ['up', 'Subir', queueLocked || index === 0],
      ['down', 'Bajar', queueLocked || index === clips.length - 1],
      ['remove', 'Quitar', queueLocked || lockedSessionStates.has(clip.status)]
    ].forEach(([action, label, disabled]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-button clip-action-button';
      button.dataset.action = action;
      button.dataset.id = clip.id;
      button.disabled = disabled;
      button.textContent = label;
      actions.append(button);
    });

    item.append(selectButton, actions);
    return item;
  }));

  updateProcessButtons();
}

function setTechnicalLog(text) {
  logEl.textContent = text || '';
  if (!logPanel.classList.contains('collapsed')) {
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function setProcessButtonsDisabled(disabled) {
  processButtons.forEach(processButton => {
    processButton.disabled = disabled;
  });
}

function updateProcessButtons() {
  if (!isElectron) {
    setProcessButtonsDisabled(!input.value.trim());
    return;
  }

  const clips = queueState.clips || [];
  const hasReadyClips = clips.length > 0 && clips.every(clip => readySessionStates.has(clip.status));
  const isLocked = clips.some(clip => lockedSessionStates.has(clip.status)) || lockedSessionStates.has(currentSession?.status);
  setProcessButtonsDisabled(!hasReadyClips || isLocked);
}

function renderSession(session) {
  if (!session) {
    currentSession = null;
    resetProgress();
    resetReview();
    resetResult();
    setStatus('En espera');
    updateProcessButtons();
    return;
  }

  if (currentSession?.id !== session.id) {
    saveTrimForCurrentSession();
    loadTrimForSession(session);
  }
  currentSession = session;

  if (session.originalPath) {
    input.value = session.originalPath;
  }

  const progress = Math.max(0, Math.min(100, Number(session.progress || 0)));
  progressPanel.hidden = false;
  progressLabel.textContent = sessionStatusText(session.status);
  progressPercent.textContent = `${progress}%`;
  progressBar.style.width = `${progress}%`;

  if (session.probeSummary) {
    probeSummary.textContent = `Duracion ${session.probeSummary.duration}. Video ${session.probeSummary.video}. Audio ${session.probeSummary.audio}.`;
  } else if (session.defaultOutputName) {
    probeSummary.textContent = `Salida prevista: ${session.defaultOutputName}`;
  } else {
    probeSummary.textContent = '';
  }

  if (session.probeWarnings?.length) {
    warningList.hidden = false;
    warningList.replaceChildren(...session.probeWarnings.map(warning => {
      const item = document.createElement('li');
      item.textContent = warning;
      return item;
    }));
  } else {
    warningList.hidden = true;
    warningList.replaceChildren();
  }

  if (session.inspector || session.proxyUrl) {
    renderInspector(session.inspector);
    renderProxy(session.proxyUrl);
    renderTrim();
  } else {
    resetReview();
  }

  setStatus(sessionStatusText(session.status), sessionStateClass(session.status));

  if (isElectron && latestJobLog && ['processing', 'validating', 'processed', 'saving', 'saved', 'error'].includes(session.status)) {
    setTechnicalLog(`${session.log || ''}\n=== Conversion ===\n${latestJobLog}`.trim());
  } else if (session.status !== 'processing') {
    setTechnicalLog(session.log || '');
  }

  pickButton.disabled = lockedSessionStates.has(session.status) || (queueState.clips || []).some(clip => lockedSessionStates.has(clip.status));
  updateProcessButtons();

  if (session.outputPath || session.savedPath) {
    resultStrip.hidden = false;
    outputPathEl.textContent = session.savedPath || session.outputPath;
    downloadLink.href = '#';

    if (session.status === 'saved' && session.savedPath) {
      downloadLink.textContent = 'Mostrar archivo';
      downloadLink.dataset.mode = 'reveal';
      downloadLink.dataset.path = session.savedPath;
    } else if (session.status === 'saving') {
      downloadLink.textContent = 'Guardando...';
      downloadLink.dataset.mode = 'saving';
      downloadLink.dataset.path = '';
    } else {
      downloadLink.textContent = session.activeProfile === 'h264' ? 'Guardar H.264' : 'Guardar K2';
      downloadLink.dataset.mode = 'save';
      downloadLink.dataset.path = session.outputPath || '';
    }
  }
}

function renderJob(job) {
  latestJobLog = job.log || '';
  setStatus(
    job.status === 'running' ? 'Procesando' :
    job.status === 'success' ? 'Procesado' :
    job.status === 'error' ? 'Error' :
    'En espera',
    job.status
  );

  setTechnicalLog(isElectron && currentSession
    ? `${currentSession.log || ''}\n=== Conversion ===\n${latestJobLog}`.trim()
    : latestJobLog);

  if (job.outputPath && !isElectron) {
    resultStrip.hidden = false;
    outputPathEl.textContent = job.outputPath;
    downloadLink.href = `/api/download?path=${encodeURIComponent(job.outputPath)}`;
    downloadLink.textContent = 'Descargar';
  }

  if (job.status !== 'running') {
    clearInterval(pollTimer);
    pollTimer = null;
    if (!isElectron) {
      updateProcessButtons();
    }
  }
}

async function fetchJob(id) {
  if (isElectron) {
    return window.k2.getJob(id);
  }

  const response = await fetch(`/api/jobs/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('No se pudo leer el trabajo');
  return response.json();
}

async function startJob(inputPath, profile, trimSelection = null) {
  if (isElectron) {
    return window.k2.startJob(inputPath, profile, trimSelection);
  }

  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputPath, profile })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo iniciar');
  return payload;
}

async function pickFile() {
  if (isElectron) {
    const result = await window.k2.pickFile();
    if (result.canceled) throw new Error('Seleccion cancelada');
    return result.path;
  }

  const response = await fetch('/api/pick-file', { method: 'POST' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el archivo');
  return payload.path;
}

async function pickFiles() {
  if (isElectron) {
    const result = await window.k2.pickFiles();
    if (result.canceled) throw new Error('Seleccion cancelada');
    return result.paths;
  }

  return [await pickFile()];
}

async function prepareFile(filePath) {
  if (!isElectron) return null;
  return window.k2.prepareFile(filePath);
}

async function addToQueue(filePaths) {
  if (!isElectron) return null;
  return window.k2.addToQueue(filePaths);
}

pickButton.addEventListener('click', async () => {
  pickButton.disabled = true;
  setProcessButtonsDisabled(true);
  clearInterval(pollTimer);
  if (removeJobListener) {
    removeJobListener();
    removeJobListener = null;
  }
  setStatus('Seleccionando');

  try {
    const selectedPaths = await pickFiles();
    const selectedPath = selectedPaths.at(-1);
    input.value = selectedPath || '';

    if (isElectron) {
      resetResult();
      resetProgress();
      resetReview();
      latestJobLog = '';
      setStatus(selectedPaths.length > 1 ? 'Añadiendo clips a la cola' : 'Copiando a temporal local');
      progressPanel.hidden = false;
      setTechnicalLog('');
      const payload = await addToQueue(selectedPaths);
      if (payload?.queue) renderQueue(payload.queue);
      if (payload?.session) renderSession(payload.session);
    } else {
      setStatus('Archivo cargado');
      setTechnicalLog(`Archivo seleccionado:\n${input.value}`);
      updateProcessButtons();
    }
  } catch (error) {
    setStatus(error.message, 'error');
    setTechnicalLog(`ERROR: ${error.message}`);
    updateProcessButtons();
  } finally {
    if (!currentSession || !lockedSessionStates.has(currentSession.status)) {
      pickButton.disabled = false;
    }
  }
});

input.addEventListener('input', () => {
  if (isElectron) {
    currentSession = null;
    latestJobLog = '';
    resetProgress();
    resetReview();
    resetResult();
    setStatus('Carga el archivo con el selector');
  }
  updateProcessButtons();
});

async function startProcessing(profile) {
  clearInterval(pollTimer);
  if (removeJobListener) {
    removeJobListener();
    removeJobListener = null;
  }
  resetResult();
  latestJobLog = '';
  setStatus(profile === 'h264' ? 'Arrancando H.264' : 'Arrancando K2');
  setProcessButtonsDisabled(true);
  pickButton.disabled = true;

  try {
    const inputForJob = isElectron ? currentSession?.id : input.value.trim();
    if (isElectron && !inputForJob) {
      throw new Error('Primero carga y copia un archivo');
    }

    let job;
    if (isElectron && (queueState.clips || []).length > 1) {
      saveTrimForCurrentSession();
      job = await window.k2.startQueueJob(profile, buildQueueTrimPayload());
    } else {
      const trimSelection = isElectron ? buildTrimPayload() : null;
      job = await startJob(inputForJob, profile, trimSelection);
    }
    renderJob(job);
    if (isElectron) {
      removeJobListener = window.k2.onJobUpdate(renderJob);
    } else {
      pollTimer = setInterval(async () => {
        try {
          renderJob(await fetchJob(job.id));
        } catch (error) {
          setStatus(error.message, 'error');
          updateProcessButtons();
          clearInterval(pollTimer);
        }
      }, 1200);
    }
  } catch (error) {
    setStatus(error.message, 'error');
    setTechnicalLog(`ERROR: ${error.message}`);
    updateProcessButtons();
    pickButton.disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
});

processButtons.forEach(processButton => {
  processButton.addEventListener('click', () => {
    startProcessing(processButton.dataset.profile || 'k2');
  });
});

downloadLink.addEventListener('click', async event => {
  if (!isElectron) return;
  event.preventDefault();

  if (downloadLink.dataset.mode === 'reveal' && downloadLink.dataset.path) {
    await window.k2.revealFile(downloadLink.dataset.path);
    return;
  }

  if (downloadLink.dataset.mode !== 'save' || !currentSession?.id) return;

  try {
    downloadLink.textContent = 'Guardando...';
    const result = await window.k2.saveOutput(currentSession.id);
    if (!result.canceled && result.session) {
      renderSession(result.session);
    }
  } catch (error) {
    setStatus(error.message, 'error');
    setTechnicalLog(`ERROR: ${error.message}`);
  }
});

markInButton.addEventListener('click', () => {
  trimState.in = currentProxyTime();
  if (trimState.out !== null && trimState.out <= trimState.in + 0.05) {
    trimState.out = null;
  }
  saveTrimForCurrentSession();
  renderTrim();
  renderQueue(queueState);
});

markOutButton.addEventListener('click', () => {
  const out = currentProxyTime();
  const start = trimState.in ?? 0;
  if (out <= start + 0.05) {
    setStatus('La marca OUT debe estar despues de la marca IN', 'error');
    return;
  }
  trimState.out = out;
  saveTrimForCurrentSession();
  renderTrim();
  renderQueue(queueState);
});

clearTrimButton.addEventListener('click', () => {
  resetTrim();
  saveTrimForCurrentSession();
  renderQueue(queueState);
  if (currentSession?.status) {
    setStatus(sessionStatusText(currentSession.status), sessionStateClass(currentSession.status));
  }
});

reviewVideo.addEventListener('loadedmetadata', renderTrim);
reviewVideo.addEventListener('durationchange', renderTrim);

clipList.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button || !isElectron) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!id) return;

  try {
    saveTrimForCurrentSession();
    if (action === 'select') {
      renderSession(await window.k2.selectQueueClip(id));
    } else if (action === 'up' || action === 'down') {
      renderQueue(await window.k2.moveQueueClip(id, action));
    } else if (action === 'remove') {
      trimBySessionId.delete(id);
      renderQueue(await window.k2.removeQueueClip(id));
    }
  } catch (error) {
    setStatus(error.message, 'error');
    setTechnicalLog(`ERROR: ${error.message}`);
  }
});

clearQueueButton.addEventListener('click', async () => {
  if (!isElectron) return;
  try {
    trimBySessionId.clear();
    renderQueue(await window.k2.clearQueue());
    setTechnicalLog('');
  } catch (error) {
    setStatus(error.message, 'error');
    setTechnicalLog(`ERROR: ${error.message}`);
  }
});

logToggle.addEventListener('click', () => {
  const shouldOpen = logPanel.classList.contains('collapsed');
  logPanel.classList.toggle('collapsed', !shouldOpen);
  logToggle.textContent = shouldOpen ? 'Ocultar log' : 'Ver log';
  if (shouldOpen) {
    logEl.scrollTop = logEl.scrollHeight;
  }
});

if (isElectron) {
  setProcessButtonsDisabled(true);
  window.k2.onSessionUpdate(renderSession);
  window.k2.onQueueUpdate(renderQueue);
  window.k2.diagnostics()
    .then(info => {
      if (!info.hasBundledFfmpeg) {
        setTechnicalLog([
          'Aviso: no hay FFmpeg interno en la app.',
          'En desarrollo se intentara usar ffmpeg/ffprobe del sistema.',
          `FFmpeg: ${info.ffmpegPath}`,
          `FFprobe: ${info.ffprobePath}`
        ].join('\n'));
      }
    })
    .catch(() => {});
} else {
  updateProcessButtons();
  fetch('/api/health').catch(() => {});
}
