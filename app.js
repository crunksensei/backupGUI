const { ipcRenderer } = require('electron');

let sourceFolderPath, destinationFolderPath;
let backupInterval;

ipcRenderer.on('progress', (event, progress) => {
  console.log('Received progress:', progress);
  progressBar.value = progress;
});

async function performBackup(showAlert = true) {
  if (sourceFolderPath && destinationFolderPath) {
    const maxBackups = parseInt(document.getElementById('max-backups').value);
    const success = await ipcRenderer.invoke('copy-folder', sourceFolderPath, destinationFolderPath, maxBackups);

    if (success) {
      console.log('Backup successful!');
      const lastBackup = `Last backup: ${new Date().toLocaleString()}`;
      document.getElementById('last-backup').textContent = lastBackup;
      await ipcRenderer.invoke('save-last-backup', lastBackup);
    } else {
      console.error('Backup failed!');
    }
  } else if (showAlert) {
    alert('Please select both source and destination folders before copying.');
  }
}

document.getElementById('select-source-folder-btn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-source-folder');
  if (result) {
    sourceFolderPath = result;
    console.log(`Selected source folder: ${sourceFolderPath}`);
    document.getElementById('selected-source-folder').textContent = `Source folder: ${sourceFolderPath}`;
    await ipcRenderer.invoke('save-source-folder', sourceFolderPath);
  }
});

document.getElementById('select-destination-folder-btn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-destination-folder');
  if (result) {
    destinationFolderPath = result;
    console.log(`Selected destination folder: ${destinationFolderPath}`);
    document.getElementById('selected-destination-folder').textContent = `Destination folder: ${destinationFolderPath}`;
    await ipcRenderer.invoke('save-destination-folder', destinationFolderPath);
  }
});

document.getElementById('backup-interval').addEventListener('change', () => {
  const customIntervalContainer = document.getElementById('custom-interval-container');
  if (document.getElementById('backup-interval').value === 'custom') {
    customIntervalContainer.style.display = 'block';
  } else {
    customIntervalContainer.style.display = 'none';
  }
});

function startBackupInterval(intervalValue) {
  clearInterval(backupInterval);
  backupInterval = setInterval(performBackup, intervalValue);
}

function getIntervalValue() {
  const backupIntervalValue = document.getElementById('backup-interval').value;
  let intervalValue;
  if (backupIntervalValue === 'custom') {
    const hours = parseInt(document.getElementById('custom-interval-hours').value) * 60 * 60 * 1000;
    const days = parseInt(document.getElementById('custom-interval-days').value) * 24 * 60 * 60 * 1000;
    intervalValue = hours + days;
  } else {
    intervalValue = parseInt(backupIntervalValue);
  }
  return intervalValue;
}

document.getElementById('copy-folder-btn').addEventListener('click', async () => {
  await performBackup(false);
  const intervalValue = getIntervalValue();
  startBackupInterval(intervalValue);

  // Save the max backups and interval settings
  await ipcRenderer.invoke('save-backup-interval', document.getElementById('backup-interval').value);
  await ipcRenderer.invoke('save-max-backups', parseInt(document.getElementById('max-backups').value));
  await ipcRenderer.invoke('save-custom-interval-hours', parseInt(document.getElementById('custom-interval-hours').value));
  await ipcRenderer.invoke('save-custom-interval-days', parseInt(document.getElementById('custom-interval-days').value));
});

document.getElementById('stop-copying-btn').addEventListener('click', () => {
  clearInterval(backupInterval);
});

document.getElementById('max-backups').addEventListener('change', async () => {
  const maxBackups = parseInt(document.getElementById('max-backups').value);
  await ipcRenderer.invoke('save-max-backups', maxBackups);
});

(async () => {
  sourceFolderPath = await ipcRenderer.invoke('get-source-folder');
  destinationFolderPath = await ipcRenderer.invoke('get-destination-folder');
  const lastBackup = await ipcRenderer.invoke('get-last-backup');
  const savedBackupInterval = await ipcRenderer.invoke('get-backup-interval');
  if (savedBackupInterval) {
    let intervalValue;

    if (savedBackupInterval === 'custom') {
      const customHours = parseInt(await ipcRenderer.invoke('get-custom-interval-hours'));
      const customDays = parseInt(await ipcRenderer.invoke('get-custom-interval-days'));

      intervalValue = (customHours * 60 * 60 * 1000) + (customDays * 24 * 60 * 60 * 1000);
    } else {
      intervalValue = parseInt(savedBackupInterval);
    }

    backupInterval = setInterval(performBackup, intervalValue);
  }

  if (lastBackup) {
    document.getElementById('last-backup').textContent = lastBackup;
  }
  if (sourceFolderPath) {
    document.getElementById('selected-source-folder').textContent = `Source folder: ${sourceFolderPath}`;
  }
  if (destinationFolderPath) {
    document.getElementById('selected-destination-folder').textContent = `Destination folder: ${destinationFolderPath}`;
  }

})();