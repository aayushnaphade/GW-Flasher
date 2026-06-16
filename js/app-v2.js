// GW Flasher V2 - Engineering Utility
// Optimized for firmware flashing workflow

// State
let isConnected = false;
let serialPort = null;
let reader = null;

// DOM Elements
const deviceStatus = document.querySelector('[data-device-status]');
const deviceDetail = document.querySelector('[data-device-detail]');
const devicePort = document.querySelector('[data-device-port]');
const statusDot = document.querySelector('[data-status]');
const flashButton = document.querySelector('[data-flash-button]');
const espInstallButton = document.getElementById('esp-install');

const fwVersion = document.querySelector('[data-fw-version]');
const fwDate = document.querySelector('[data-fw-date]');
const fwTarget = document.querySelector('[data-fw-target]');
const fwCommit = document.querySelector('[data-fw-commit]');
const fwStatus = document.querySelector('[data-fw-status]');

const monitorConnect = document.querySelector('[data-monitor-connect]');
const monitorDisconnect = document.querySelector('[data-monitor-disconnect]');
const monitorClear = document.querySelector('[data-monitor-clear]');
const consoleBadge = document.querySelector('[data-console-badge]');
const consoleOutput = document.querySelector('[data-console-output]');

// Load firmware metadata
async function loadFirmwareMetadata() {
  try {
    const response = await fetch('firmware/version.json');
    const data = await response.json();
    
    fwVersion.textContent = data.version || '—';
    fwDate.textContent = data.build_date?.split('T')[0] || '—';
    fwTarget.textContent = data.target || 'ESP32-S3';
    fwCommit.textContent = data.git_commit?.substring(0, 7) || '—';
    
    if (fwStatus) {
      fwStatus.textContent = 'READY';
    }
    
    console.log('Firmware metadata loaded:', data);
  } catch (error) {
    console.error('Failed to load firmware metadata:', error);
    fwVersion.textContent = 'ERROR';
    fwDate.textContent = 'ERROR';
    if (fwStatus) {
      fwStatus.textContent = 'ERROR';
    }
  }
}

// Flash firmware handler
flashButton.addEventListener('click', () => {
  if (espInstallButton) {
    // Trigger the ESP Web Tools button
    const installBtn = espInstallButton.shadowRoot?.querySelector('button');
    if (installBtn) {
      installBtn.click();
      updateDeviceStatus('flashing', 'FLASHING FIRMWARE', 'Please wait...');
    }
  }
});

// Listen to ESP Web Tools events
if (espInstallButton) {
  espInstallButton.addEventListener('state-changed', (e) => {
    console.log('ESP Web Tools state:', e.detail);
    
    if (e.detail.state === 'CONNECTED') {
      updateDeviceStatus('connected', 'DEVICE CONNECTED', 'ESP32-S3 ready to flash');
      flashButton.disabled = false;
    } else if (e.detail.state === 'INSTALLING') {
      updateDeviceStatus('flashing', 'FLASHING FIRMWARE', 'Writing to device...');
    } else if (e.detail.state === 'FINISHED') {
      updateDeviceStatus('connected', 'FLASH COMPLETE', 'Device ready to use');
      appendLog('[SYSTEM] Firmware flashed successfully!');
    } else if (e.detail.state === 'ERROR') {
      updateDeviceStatus('error', 'FLASH FAILED', e.detail.message || 'Unknown error');
      appendLog(`[ERROR] ${e.detail.message || 'Flash failed'}`);
    }
  });
}

// Update device status
function updateDeviceStatus(status, label, detail, port = '') {
  statusDot.setAttribute('data-status', status);
  deviceStatus.textContent = label;
  deviceDetail.textContent = detail;
  if (devicePort) {
    devicePort.textContent = port;
  }
}

// Serial Monitor
monitorConnect.addEventListener('click', async () => {
  try {
    if ('serial' in navigator) {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 115200 });
      
      isConnected = true;
      monitorConnect.hidden = true;
      monitorDisconnect.hidden = false;
      
      if (consoleBadge) {
        consoleBadge.textContent = 'CONNECTED';
        consoleBadge.setAttribute('data-status', 'connected');
      }
      
      appendLog('> Serial monitor connected at 115200 baud');
      readSerialData();
    } else {
      alert('Web Serial API not supported. Use Chrome, Edge, or Opera.');
    }
  } catch (error) {
    console.error('Serial connection error:', error);
    appendLog(`> ERROR: ${error.message}`);
  }
});

monitorDisconnect.addEventListener('click', async () => {
  try {
    if (reader) {
      await reader.cancel();
      reader = null;
    }
    
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
    
    isConnected = false;
    monitorConnect.hidden = false;
    monitorDisconnect.hidden = true;
    
    if (consoleBadge) {
      consoleBadge.textContent = 'DISCONNECTED';
      consoleBadge.removeAttribute('data-status');
    }
    
    appendLog('> Serial monitor disconnected');
  } catch (error) {
    console.error('Disconnect error:', error);
  }
});

monitorClear.addEventListener('click', () => {
  consoleOutput.textContent = '';
});

async function readSerialData() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = serialPort.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      appendLog(value);
    }
  } catch (error) {
    console.error('Serial read error:', error);
  } finally {
    reader.releaseLock();
  }
}

function appendLog(text) {
  if (!text) return;
  
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  
  // If text starts with '>', it's a system message, don't add timestamp
  if (text.startsWith('>')) {
    consoleOutput.textContent += `${text}\n`;
  } else {
    const lines = text.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        consoleOutput.textContent += `[${timestamp}] ${line}\n`;
      }
    });
  }
  
  // Auto-scroll to bottom
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
  
  // Limit log size (keep last 1000 lines)
  const logLines = consoleOutput.textContent.split('\n');
  if (logLines.length > 1000) {
    consoleOutput.textContent = logLines.slice(-1000).join('\n');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadFirmwareMetadata();
  
  // Check if Web Serial is supported
  if (!('serial' in navigator)) {
    if (consoleBadge) {
      consoleBadge.textContent = 'NOT SUPPORTED';
      consoleBadge.style.color = 'var(--error)';
    }
    monitorConnect.disabled = true;
    appendLog('> ERROR: Web Serial API not supported in this browser');
    appendLog('> Use Chrome, Edge, or Opera with HTTPS');
  }
});
