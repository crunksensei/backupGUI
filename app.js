const { ipcRenderer } = require('electron');

let sourceFolderPath, destinationFolderPath, maxBackups;
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
      // Update the next backup time
      const intervalValue = getIntervalValue();
      updateNextBackupTime(intervalValue);
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

document.getElementById('custom-interval-hours').addEventListener('change', async () => {
  await ipcRenderer.invoke('save-custom-interval-hours', parseInt(document.getElementById('custom-interval-hours').value));
})

document.getElementById('custom-interval-days').addEventListener('change', async () => {
  await ipcRenderer.invoke('save-custom-interval-days', parseInt(document.getElementById('custom-interval-days').value));
})

document.getElementById('backup-interval').addEventListener('change', async () => {
  const customIntervalContainer = document.getElementById('custom-interval-container');
  const selectedBackupInterval = document.getElementById('backup-interval').value;
  if (selectedBackupInterval === 'custom') {
    customIntervalContainer.style.display = 'block';
  } else {
    customIntervalContainer.style.display = 'none';
  }

  // Save the selected backup interval
  await ipcRenderer.invoke('save-backup-interval', selectedBackupInterval);
});

function updateNextBackupTime(intervalValue) {
  const nextBackupTime = new Date(Date.now() + intervalValue);
  document.getElementById('next-backup').textContent = `Next backup: ${nextBackupTime.toLocaleString()}`;
}

function startBackupInterval(intervalValue) {
  clearInterval(backupInterval);
  backupInterval = setInterval(performBackup, intervalValue);
  updateNextBackupTime(intervalValue);
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
  const intervalValue = getIntervalValue();

  if (intervalValue === 0) {
    alert('Please enter a valid custom interval.');
  } else {
    await performBackup(false);
    startBackupInterval(intervalValue);
    updateNextBackupTime(intervalValue);
  // // Save the max backups and interval settings
  // await ipcRenderer.invoke('save-backup-interval', document.getElementById('backup-interval').value);
  // await ipcRenderer.invoke('save-max-backups', parseInt(document.getElementById('max-backups').value));
  // await ipcRenderer.invoke('save-custom-interval-hours', parseInt(document.getElementById('custom-interval-hours').value));
  // await ipcRenderer.invoke('save-custom-interval-days', parseInt(document.getElementById('custom-interval-days').value));
  }
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
  const maxBackups = await ipcRenderer.invoke('get-max-backups');
  const lastBackup = await ipcRenderer.invoke('get-last-backup');
  const savedBackupInterval = await ipcRenderer.invoke('get-backup-interval');
  const customIntervalHours = await ipcRenderer.invoke('get-custom-interval-hours');
  const customIntervalDays = await ipcRenderer.invoke('get-custom-interval-days');

  if (savedBackupInterval === 'custom') {
    const customIntervalContainer = document.getElementById('custom-interval-container')
    document.getElementById('backup-interval').value = savedBackupInterval;
    customIntervalContainer.style.display = 'block'
    document.getElementById('custom-interval-days').value = customIntervalDays;
    document.getElementById('custom-interval-hours').value = customIntervalHours;
  }

  if (savedBackupInterval != 'custom') {
    document.getElementById('backup-interval').value = savedBackupInterval;
  }
  

  if (maxBackups) {
    document.getElementById('max-backups').value = maxBackups;
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
