const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');
const klawSync = require('klaw-sync');
const Store = require('electron-store');
const store = new Store();

let mainWindow;
let lastBackupFile = path.join(app.getPath('userData'), 'last-backup.txt');

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

async function copyWithProgress(src, dest, options) {
  return new Promise(async (resolve, reject) => {
    const readStream = fs.createReadStream(src);
    const writeStream = fs.createWriteStream(dest);
    let bytesCopied = 0;

    readStream.on('data', (chunk) => {
      bytesCopied += chunk.length;
      options.onProgress(src, dest, { bytesCopied });
    });

    writeStream.on('finish', resolve);
    readStream.on('error', reject);
    writeStream.on('error', reject);

    readStream.pipe(writeStream);
  });
}

async function performBackup(source, destination, options, maxBackups) {
  const progress = new EventEmitter();

  progress.on('progress', (value) => {
    mainWindow.webContents.send('progress', value);
  });

  try {
    let totalBytesToCopy = 0;
    let totalBytesCopied = 0;

    const items = klawSync(source, { nodir: true });
    items.forEach(item => {
      totalBytesToCopy += item.stats.size;
    });

    await fs.ensureDir(destination);

    for (const item of items) {
      const srcPath = item.path;
      const relativePath = path.relative(source, srcPath);
      const destPath = path.join(destination, relativePath);
      await fs.ensureDir(path.dirname(destPath));

      options.onProgress = (src, dest, file) => {
        totalBytesCopied += file.bytesCopied;
        const progressValue = Math.floor((totalBytesCopied / totalBytesToCopy) * 100);
        progress.emit('progress', progressValue);
      };

      await copyWithProgress(srcPath, destPath, options);
    }

    const backupParentFolder = path.dirname(destination);
    const allFilesAndFolders = await fs.readdir(backupParentFolder);
    const backupFolders = allFilesAndFolders.filter((folderName) => folderName.startsWith('Backup-'));
    
    if (backupFolders.length > maxBackups) {
      // Sort backup folders by timestamp
      backupFolders.sort((a, b) => {
        const timestampA = a.split("Backup-")[1];
        const timestampB = b.split("Backup-")[1];
        return new Date(timestampA) - new Date(timestampB);
      });
    
      // Delete the oldest backup folder
      const oldestBackup = path.join(backupParentFolder, backupFolders[0]);
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

  const success = await performBackup(sourceFolderPath, newDestination, options, maxBackups);
  return success;
});

ipcMain.handle('save-source-folder', (event, sourceFolderPath) => {
  store.set('sourceFolderPath', sourceFolderPath);
});

ipcMain.handle('save-destination-folder', (event, destinationFolderPath) => {
  store.set('destinationFolderPath', destinationFolderPath);
});

ipcMain.handle('save-backup-interval', (event, backupInterval) => {
  store.set('backupInterval', backupInterval);
});

ipcMain.handle('save-max-backups', (event, maxBackups) => {
  store.set('maxBackups', maxBackups);
});

ipcMain.handle('save-custom-interval-hours', (event, customIntervalHours) => {
  store.set('customIntervalHours', customIntervalHours);
});

ipcMain.handle('save-custom-interval-days', (event, customIntervalDays) => {
  store.set('customIntervalDays', customIntervalDays);
});

ipcMain.handle('get-custom-interval-hours', () => {
  return store.get('customIntervalHours');
});

ipcMain.handle('get-custom-interval-days', () => {
  return store.get('customIntervalDays');
});

ipcMain.handle('get-source-folder', () => {
  return store.get('sourceFolderPath');
});

ipcMain.handle('get-destination-folder', () => {
  return store.get('destinationFolderPath');
});

ipcMain.handle('get-backup-interval', () => {
  return store.get('backupInterval');
});

ipcMain.handle('get-max-backups', () => {
  return store.get('maxBackups');
});

ipcMain.handle('save-last-backup', async (_, lastBackup) => {
  try {
    fs.writeFileSync(lastBackupFile, lastBackup);
    return true;
  } catch (error) {
    console.error('Failed to save last backup:', error);
    return false;
  }
});

ipcMain.handle('get-last-backup', async () => {
  try {
    if (fs.existsSync(lastBackupFile)) {
      const lastBackup = fs.readFileSync(lastBackupFile, 'utf-8');
      console.log(store.get('backupInterval'))
      return lastBackup;
    }
    return null;
  } catch (error) {
    console.error('Failed to get last backup:', error);
    return null;
  }
});

