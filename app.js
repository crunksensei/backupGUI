const { ipcRenderer } = require('electron');

let sourceFolderPath, destinationFolderPath;
let backupInterval;

async function performBackup(showAlert = true) {
  if (sourceFolderPath && destinationFolderPath) {
    const success = await ipcRenderer.invoke('copy-folder', sourceFolderPath, destinationFolderPath);
    if (success) {
      console.log('Backup successful!');
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
    // Update the text content of the 'selected-source-folder' element
    document.getElementById('selected-source-folder').textContent = `Source folder: ${sourceFolderPath}`;
  }
});

document.getElementById('select-destination-folder-btn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-destination-folder');
  if (result) {
    destinationFolderPath = result;
    console.log(`Selected destination folder: ${destinationFolderPath}`);
    // Update the text content of the 'selected-destination-folder' element
    document.getElementById('selected-destination-folder').textContent = `Destination folder: ${destinationFolderPath}`;
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
  

document.getElementById('copy-folder-btn').addEventListener('click', async () => {
  await performBackup(false);
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
