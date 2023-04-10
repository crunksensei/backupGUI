const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 256,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

async function performBackup(source, destination, options) {
  try {
    await fs.ensureDir(destination);
    await fs.copy(source, destination, options);
    return true;
  } catch (error) {
    console.error("Error during backup:", error);
    return false;
  }
}

ipcMain.handle('select-source-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  return result.filePaths[0];
});

ipcMain.handle('select-destination-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  return result.filePaths[0];
});

ipcMain.handle('copy-folder', async (event, sourceFolderPath, destinationFolderPath) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newDestination = path.join(destinationFolderPath, `Backup-${timestamp}`);

  const options = {
    filter: (src) => {
      return path.extname(src) !== '.lock';
    },
  };

  const success = await performBackup(sourceFolderPath, newDestination, options);
  return success;
});