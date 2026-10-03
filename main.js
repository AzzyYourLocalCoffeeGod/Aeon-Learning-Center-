const { app, BrowserWindow, dialog, ipcMain, clipboard, shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pathToFileURL } = require('url');
const execFileAsync = promisify(execFile);

// Set the app name before anything else
app.setName('Aeon Learning Center');

const documentExtensions = new Set(['.scrb', '.txt', '.html', '.htm', '.json']);

ipcMain.handle('aeon:open-documents', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Aeon and text documents', extensions: ['scrb', 'txt', 'html', 'htm', 'json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(async filePath => ({
    filePath,
    name: path.basename(filePath),
    content: await fs.promises.readFile(filePath, 'utf8')
  })));
});

ipcMain.handle('aeon:open-recent', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !documentExtensions.has(path.extname(filePath).toLowerCase())) {
    throw new Error('Unsupported recent-file type.');
  }
  return {
    filePath,
    name: path.basename(filePath),
    content: await fs.promises.readFile(filePath, 'utf8')
  };
});

ipcMain.handle('aeon:save-document', async (_event, options) => {
  let filePath = typeof options.filePath === 'string' ? options.filePath : '';
  if (!filePath || options.saveAs) {
    const result = await dialog.showSaveDialog({
      defaultPath: options.name || 'Untitled.scrb',
      filters: [{ name: 'Aeon document', extensions: ['scrb'] }]
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  }

  await fs.promises.writeFile(filePath, String(options.content || ''), 'utf8');
  return { filePath, name: path.basename(filePath) };
});

ipcMain.handle('aeon:export-office', async (_event, options) => {
  const format = options.format;
  if (format !== 'odt' && format !== 'doc') throw new Error('Unsupported office export format.');

  const extension = `.${format}`;
  const baseName = String(options.name || 'Untitled').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'Untitled';
  const result = await dialog.showSaveDialog({
    defaultPath: `${baseName}${extension}`,
    filters: [{ name: format === 'odt' ? 'OpenDocument Text' : 'Word 97 Document', extensions: [format] }]
  });
  if (result.canceled || !result.filePath) return null;

  const filePath = path.extname(result.filePath).toLowerCase() === extension
    ? result.filePath
    : `${result.filePath}${extension}`;
  const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'aeon-office-export-'));
  const sourcePath = path.join(tempDir, `${baseName}.html`);
  const convertedDir = path.join(tempDir, 'converted');
  const profileDir = path.join(tempDir, 'libreoffice-profile');
  await fs.promises.mkdir(convertedDir);
  await fs.promises.mkdir(profileDir);

  try {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${baseName}</title><style>body{font-family:"EB Garamond",serif;font-size:12pt;line-height:1.6;color:#1a1a1a}h1,h2,h3{font-family:"Playfair Display",serif}blockquote{border-left:2pt solid #c8a96e;padding-left:12pt;color:#555;font-style:italic}img{max-width:100%;height:auto}</style></head><body>${String(options.html || '')}</body></html>`;
    await fs.promises.writeFile(sourcePath, html, 'utf8');
    const initialFormat = format === 'doc' ? 'odt' : format;
    await execFileAsync('libreoffice', [
      '--headless',
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--convert-to',
      initialFormat,
      '--outdir',
      convertedDir,
      sourcePath
    ], { timeout: 90000 });

    let convertedPath = path.join(convertedDir, `${baseName}.${initialFormat}`);
    if (format === 'doc') {
      await execFileAsync('libreoffice', [
        '--headless',
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--convert-to',
        'doc',
        '--outdir',
        convertedDir,
        convertedPath
      ], { timeout: 90000 });
      convertedPath = path.join(convertedDir, `${baseName}.doc`);
    }
    await fs.promises.access(convertedPath, fs.constants.R_OK);
    await fs.promises.copyFile(convertedPath, filePath);
    return { filePath, name: path.basename(filePath) };
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('LibreOffice is required for ODT and legacy DOC export.');
    throw new Error(`Could not export ${extension}: ${error.message}`);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

ipcMain.handle('aeon:open-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : `image/${extension.slice(1)}`;
  const image = await fs.promises.readFile(filePath);
  return `data:${mimeType};base64,${image.toString('base64')}`;
});

ipcMain.handle('aeon:clipboard-read', () => clipboard.readText());
ipcMain.handle('aeon:clipboard-write', (_event, text) => clipboard.writeText(String(text || '')));
ipcMain.handle('aeon:open-dictionary-source', async (_event, url) => {
  const source = new URL(url);
  if (source.protocol !== 'https:' || source.hostname !== 'en.wiktionary.org') {
    throw new Error('Only Wiktionary source links can be opened.');
  }
  await shell.openExternal(source.href);
});

function createWindow() {
  // Create the browser window (The App Vessel)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, process.platform === 'linux' ? 'icon-linux.png' : 'icon.icns')
    : path.join(__dirname, process.platform === 'linux' ? 'icon-linux.png' : 'icon.icns');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Aeon Learning Center',
    icon: iconPath
  });

  // Set Dock icon for macOS
  if (process.platform === 'darwin') {
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }

  // Keep the renderer source bundled with the Electron project.
  const sourcePath = app.isPackaged
    ? path.join(process.resourcesPath, 'Aeon Learning Center')
    : path.join(__dirname, 'renderer');

  const htmlPath = path.join(sourcePath, 'aeon-learning-center.html');

  win.loadFile(htmlPath).catch(err => {
    dialog.showErrorBox('Load error', `Failed to load HTML: ${err.message || err}`);
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<h1>Load error</h1><pre>${err}</pre>`));
  });

  // Set the window title explicitly
  win.setTitle('Aeon Learning Center');
}

// When Electron is ready, create the window
app.whenReady().then(() => {
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});