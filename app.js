const { ipcRenderer } = require('electron');

let sourceFolderPath, destinationFolderPath;
let backupInterval;

async function performBackup() {
    if (sourceFolderPath && destinationFolderPath) {
      const success = await ipcRenderer.invoke('copy-folder', sourceFolderPath, destinationFolderPath);
      if (success) {
        console.log('Backup successful!');
      } else {
        console.error('Backup failed!');
      }
    } else {
      alert('Please select both source and destination folders before copying.');
    }
  }

document.getElementById('select-source-folder-btn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-source-folder');
    if (result) {
      sourceFolderPath = result;
      console.log(`Selected source folder: ${sourceFolderPath}`);
    }
  });

  document.getElementById('select-destination-folder-btn').addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('select-destination-folder');
    if (result) {
      destinationFolderPath = result;
      console.log(`Selected destination folder: ${destinationFolderPath}`);
    }
  });

document.getElementById('backup-interval').addEventListener('change', () => {
  const customIntervalHours = document.getElementById('custom-interval-hours');
  const customIntervalDays = document.getElementById('custom-interval-days');
  if (document.getElementById('backup-interval').value === 'custom') {
    customIntervalHours.style.display = 'inline-block';
    customIntervalDays.style.display = 'inline-block';
  } else {
    customIntervalHours.style.display = 'none';
    customIntervalDays.style.display = 'none';
  }
});

document.getElementById('copy-folder-btn').addEventListener('click', async () => {
  await performBackup();
  clearInterval(backupInterval);
  let intervalValue;
  if (document.getElementById('backup-interval').value === 'custom') {
    const hours = parseInt(document.getElementById('custom-interval-hours').value) * 60 * 60 * 1000; // Convert hours to milliseconds
    const days = parseInt(document.getElementById('custom-interval-days').value) * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    if (isNaN(hours) || isNaN(days) || (hours === 0 && days === 0)) {
      alert('Please enter a valid custom backup interval.');
      return;
    }
    intervalValue = hours + days;
  } else {
    intervalValue = parseInt(document.getElementById('backup-interval').value);
  }
  backupInterval = setInterval(performBackup, intervalValue);
});

document.getElementById('stop-copying-btn').addEventListener('click', () => {
  clearInterval(backupInterval);
});
