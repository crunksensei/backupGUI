const { app, BrowserWindow, ipcMain, dialog, Menu, shell  } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const Store = require('electron-store');
const store = new Store();

let mainWindow;
let lastBackupFile = path.join(app.getPath('userData'), 'last-backup.txt');
let hasAskedToDeleteOldBackups = false;
let shouldDeleteOldBackups = false;

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

  // Create the custom menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Source Folder',
          click: () => {
            shell.openPath(store.get('sourceFolderPath') || app.getPath('documents'));
          },
        },
        {
          label: 'Open Destination Folder',
          click: () => {
            shell.openPath(store.get('destinationFolderPath') || app.getPath('documents'));
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Exit',
          click() {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub link',
          click: () => {
            shell.openExternal('https://github.com/crunksensei/backupGUI');
          },
        },
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
};

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

async function checkMaxBackups(destination, maxBackups, timestamp) {
  const backupParentFolder = path.dirname(destination);
  const allFilesAndFolders = await fs.readdir(backupParentFolder);
  const backupFolders = allFilesAndFolders.filter((folderName) => folderName.startsWith('Backup-'));

  if (backupFolders.length >= maxBackups) {
    if (!hasAskedToDeleteOldBackups) {
      const userResponse = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
        title: 'Delete Extra Backups',
        message: 'There are more backups than allowed. Do you want to delete the extra backups before proceeding?',
      });

      hasAskedToDeleteOldBackups = true;
      shouldDeleteOldBackups = userResponse.response === 0;
    }

    if (shouldDeleteOldBackups) {
      backupFolders.sort((a, b) => {
        const timestampA = a.split("Backup-")[1];
        const timestampB = b.split("Backup-")[1];
        return new Date(timestampA) - new Date(timestampB);
      });

      while (backupFolders.length >= maxBackups) {
        const oldestBackup = path.join(backupParentFolder, backupFolders.shift());
        await fs.remove(oldestBackup);
      }
    } else {
      return false; // Do not proceed with backup if the user chooses "No"
    }
  }

  return true;
}


async function performBackup(source, destination, options, maxBackups, timestamp) {
  // Check for existing backups before starting the backup process
  const backupParentFolder = path.dirname(destination);
  const allFilesAndFolders = await fs.readdir(backupParentFolder);
  const backupFolders = allFilesAndFolders.filter((folderName) => folderName.startsWith('Backup-'));

  if (backupFolders.length >= maxBackups) {
    const userResponse = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
      title: 'Delete Extra Backups',
      message: 'There are more backups than allowed. Do you want to delete the extra backups before proceeding?',
    });

    if (userResponse.response === 0) {
      backupFolders.sort((a, b) => {
        const timestampA = a.split("Backup-")[1];
        const timestampB = b.split("Backup-")[1];
        return new Date(timestampA) - new Date(timestampB);
      });

      while (backupFolders.length >= maxBackups) {
        const oldestBackup = path.join(backupParentFolder, backupFolders.shift());
        await fs.remove(oldestBackup);
      }
    } else {
      return false; // Do not proceed with backup if the user chooses "No"
    }
  }

  // Generate the timestamp for the backup folder22222222222222222222
  destination = path.join(destination, `Backup-${timestamp}`);

  try {
    await fs.ensureDir(destination);

    // Get a list of all files and directories in the source directory
    const filesAndDirs = await fs.readdir(source);

    // Copy all files and directories except those ending in ".lock"
    for (const fileOrDir of filesAndDirs) {
      if (fileOrDir.endsWith('.lock')) {
        // Skip files ending in ".lock"
        continue;
      }

      // Copy all other files and directories
      const fileOrDirPath = path.join(source, fileOrDir);
      const destinationPath = path.join(destination, fileOrDir);
      await fs.copy(fileOrDirPath, destinationPath, options);
    }
  } catch (error) {
    console.error("Error during backup:", error);
    return false;
  }

  return true;
}





ipcMain.handle('select-source-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: store.get('sourceFolderPath') || app.getPath('documents'),
  });

  return result.filePaths[0];
});


ipcMain.handle('select-destination-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: store.get('destinationFolderPath') || app.getPath('documents'),
  });

  return result.filePaths[0];
});

ipcMain.handle('copy-folder', async (event, sourceFolderPath, destinationFolderPath, maxBackups) => {
  // Check for existing backups before starting the backup process
  const now = new Date();
  const timestamp = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const newDestination = path.join(destinationFolderPath, `Backup-${timestamp}`);
  const options = {
    filter: (src) => {
      return path.extname(src) !== '.lock';
    },
  };

  const proceed = await checkMaxBackups(newDestination, maxBackups, timestamp);

  if (!proceed) {
    return false;
  }

  const success = await performBackup(sourceFolderPath, newDestination, options, timestamp);
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

ipcMain.handle('get-max-backups', () => {
  return store.get('maxBackups');
});

ipcMain.handle('get-backup-interval', () => {
  return store.get('backupInterval');
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
      return lastBackup;
    }
    return null;
  } catch (error) {
    console.error('Failed to get last backup:', error);
    return null;
  }
});