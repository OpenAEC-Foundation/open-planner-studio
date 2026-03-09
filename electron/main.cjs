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
const ALL_OPEN_FILTERS = [
  { name: 'All Supported Files', extensions: ['ifc', 'xml', 'csv'] },
  { name: 'IFC Files', extensions: ['ifc'] },
  { name: 'MS Project XML', extensions: ['xml'] },
  { name: 'Primavera P6 XML', extensions: ['xml'] },
  { name: 'CSV Files', extensions: ['csv'] },
  { name: 'All Files', extensions: ['*'] },
];

const IFC_FILTERS = [{ name: 'IFC Files', extensions: ['ifc'] }, { name: 'All Files', extensions: ['*'] }];
const CSV_FILTERS = [{ name: 'CSV Files', extensions: ['csv'] }, { name: 'All Files', extensions: ['*'] }];
const MSPDI_FILTERS = [{ name: 'MS Project XML', extensions: ['xml'] }, { name: 'All Files', extensions: ['*'] }];
const P6_FILTERS = [{ name: 'Primavera P6 XML', extensions: ['xml'] }, { name: 'All Files', extensions: ['*'] }];

ipcMain.handle('dialog-open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: ALL_OPEN_FILTERS,
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

ipcMain.handle('dialog-save-file-as', async (_event, content, filterType) => {
  let filters = IFC_FILTERS;
  let defaultPath = 'project.ifc';

  if (filterType === 'csv') {
    filters = CSV_FILTERS;
    defaultPath = 'project.csv';
  } else if (filterType === 'mspdi') {
    filters = MSPDI_FILTERS;
    defaultPath = 'project.xml';
  } else if (filterType === 'p6') {
    filters = P6_FILTERS;
    defaultPath = 'project.xml';
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    filters,
    defaultPath,
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

// PDF Export
ipcMain.handle('export-pdf', async (_event, dataUrl, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    defaultPath: defaultName || 'planning.pdf',
  });
  if (result.canceled || !result.filePath) return null;

  // Create a hidden BrowserWindow to render the image and print to PDF
  const pdfWindow = new BrowserWindow({
    show: false,
    width: 2000,
    height: 1400,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const htmlContent = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { display: flex; justify-content: center; align-items: flex-start; }
  img { max-width: 100%; height: auto; }
  @page { margin: 0; }
</style></head><body>
<img src="${dataUrl}" />
</body></html>`;

  await pdfWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  // Wait for image to load
  await new Promise(resolve => setTimeout(resolve, 500));

  const pdfData = await pdfWindow.webContents.printToPDF({
    landscape: true,
    printBackground: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  fs.writeFileSync(result.filePath, pdfData);
  pdfWindow.close();
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
