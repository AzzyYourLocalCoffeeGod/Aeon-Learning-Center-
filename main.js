const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Set the app name before anything else
app.setName('Aeon Learning Center');

function createWindow() {
  // Create the browser window (The App Vessel)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.icns')
    : path.join(__dirname, 'icon.png');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
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

  // Build the correct path to HTML file
  // In development, source is outside app folder
  // In production, included as extraResources under Resources
  const sourcePath = app.isPackaged
    ? path.join(process.resourcesPath, 'Aeon Learning Center')
    : path.join(__dirname, '../Aeon Learning Center');

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