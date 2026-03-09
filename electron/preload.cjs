const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onResize: (callback) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  },
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, contents) => ipcRenderer.invoke('write-file', path, contents),
  openFile: () => ipcRenderer.invoke('dialog-open-file'),
  saveFile: (path, content) => ipcRenderer.invoke('dialog-save-file', path, content),
  saveFileAs: (content, filterType) => ipcRenderer.invoke('dialog-save-file-as', content, filterType),
  autoSave: (content) => ipcRenderer.invoke('auto-save', content),
  checkRecovery: () => ipcRenderer.invoke('check-recovery'),
  clearRecovery: () => ipcRenderer.invoke('clear-recovery'),
});
