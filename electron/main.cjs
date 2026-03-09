const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

// File operations
ipcMain.handle('read-file', (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
});
ipcMain.handle('write-file', (_event, filePath, contents) => {
  fs.writeFileSync(filePath, contents, 'utf-8');
});

// Dialog-based file operations
const IFC_FILTERS = [{ name: 'IFC Files', extensions: ['ifc'] }, { name: 'All Files', extensions: ['*'] }];

ipcMain.handle('dialog-open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: IFC_FILTERS,
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { path: filePath, content };
});

ipcMain.handle('dialog-save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('dialog-save-file-as', async (_event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: IFC_FILTERS,
    defaultPath: 'project.ifc',
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

// Auto-save recovery
const RECOVERY_FILE = path.join(app.getPath('userData'), 'recovery.ifc');

ipcMain.handle('auto-save', (_event, content) => {
  try {
    fs.writeFileSync(RECOVERY_FILE, content, 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('check-recovery', () => {
  try {
    if (fs.existsSync(RECOVERY_FILE)) {
      const content = fs.readFileSync(RECOVERY_FILE, 'utf-8');
      return { exists: true, content };
    }
  } catch (err) {
    // ignore
  }
  return { exists: false, content: null };
});

ipcMain.handle('clear-recovery', () => {
  try {
    if (fs.existsSync(RECOVERY_FILE)) {
      fs.unlinkSync(RECOVERY_FILE);
    }
  } catch (err) {
    // ignore
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
