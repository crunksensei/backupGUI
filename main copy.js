const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');

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

async function performBackup(source, destination, options, destinationFolderPath, maxBackups) {
  const progress = new EventEmitter();

  progress.on('progress', (value) => {
    mainWindow.webContents.send('progress', value);
  });
  
  try {
    await fs.ensureDir(destination);
    await fs.copy(source, destination, options);
    const backups = await fs.readdir(destinationFolderPath);
    console.log(backups + '    ' + backups.length)
    if (backups.length > maxBackups) {
      // Delete the oldest backup folder
      backups.sort();
      const oldestBackup = path.join(destinationFolderPath, backups[0]);
      await fs.remove(oldestBackup);
    }

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

ipcMain.handle('copy-folder', async (event, sourceFolderPath, destinationFolderPath, maxBackups) => {
  const now = new Date();
  const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const newDestination = path.join(destinationFolderPath, `Backup-${timestamp}`);
  const options = {
    filter: (src) => {
      return path.extname(src) !== '.lock';
    },
  };

  const success = await performBackup(sourceFolderPath, newDestination, options, destinationFolderPath, maxBackups);
  return success;
});