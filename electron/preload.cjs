const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("k2", {
  diagnostics: () => ipcRenderer.invoke("app:diagnostics"),
  pickFile: () => ipcRenderer.invoke("file:pick"),
  pickFiles: () => ipcRenderer.invoke("files:pick"),
  prepareFile: inputPath => ipcRenderer.invoke("file:prepare", inputPath),
  startJob: (sessionOrInputPath, profile, trimSelection) => ipcRenderer.invoke("job:start", sessionOrInputPath, profile, trimSelection),
  addToQueue: inputPaths => ipcRenderer.invoke("queue:add", inputPaths),
  selectQueueClip: sessionId => ipcRenderer.invoke("queue:select", sessionId),
  removeQueueClip: sessionId => ipcRenderer.invoke("queue:remove", sessionId),
  moveQueueClip: (sessionId, direction) => ipcRenderer.invoke("queue:move", sessionId, direction),
  clearQueue: () => ipcRenderer.invoke("queue:clear"),
  startQueueJob: (profile, trimMap) => ipcRenderer.invoke("queue:start", profile, trimMap),
  getJob: id => ipcRenderer.invoke("job:get", id),
  saveOutput: sessionId => ipcRenderer.invoke("file:save-output", sessionId),
  revealFile: filePath => ipcRenderer.invoke("file:reveal", filePath),
  onSessionUpdate: callback => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on("session:update", listener);
    return () => ipcRenderer.removeListener("session:update", listener);
  },
  onQueueUpdate: callback => {
    const listener = (_event, queue) => callback(queue);
    ipcRenderer.on("queue:update", listener);
    return () => ipcRenderer.removeListener("queue:update", listener);
  },
  onJobUpdate: callback => {
    const listener = (_event, job) => callback(job);
    ipcRenderer.on("job:update", listener);
    return () => ipcRenderer.removeListener("job:update", listener);
  }
});
