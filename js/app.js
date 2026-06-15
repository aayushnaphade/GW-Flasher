const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const installButton = document.querySelector("[data-install-button]");
const installHost = document.querySelector("esp-web-install-button");
const monitorButton = document.querySelector("[data-monitor-button]");
const monitorDisconnectButton = document.querySelector("[data-monitor-disconnect]");
const monitorClearButton = document.querySelector("[data-monitor-clear]");
const serialLog = document.querySelector("[data-serial-log]");
const serialStatus = document.querySelector("[data-serial-status]");
const versionStatus = document.querySelector("[data-version-status]");
const versionValues = document.querySelectorAll("[data-version-value]");
const buildDateValues = document.querySelectorAll("[data-build-date-value]");
const targetValues = document.querySelectorAll("[data-target-value]");
const versionHeadline = document.querySelector("[data-version-headline]");

const THEME_STORAGE_KEY = "gw-flasher-theme";
const SERIAL_BAUD_RATE = 115200;

let monitorPort = null;
let monitorReader = null;
let monitorStreamClosed = null;
let monitorBusy = false;

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (themeToggle) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
  }
}

function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  applyTheme(storedTheme || preferredTheme);
}

function updateThemeFromToggle() {
  const currentTheme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  applyTheme(currentTheme);
}

function setVersionStatus(message, state = "idle") {
  if (!versionStatus) {
    return;
  }
  versionStatus.textContent = message;
  versionStatus.dataset.state = state;
}

function updateNodeListText(nodes, value) {
  nodes.forEach((node) => {
    node.textContent = value;
  });
}

function appendSerialLine(text, className = "") {
  if (!serialLog) {
    return;
  }

  const fragment = document.createDocumentFragment();
  const line = document.createElement("div");
  if (className) {
    line.className = className;
  }
  line.textContent = text;
  fragment.append(line);
  serialLog.append(fragment);
  serialLog.scrollTop = serialLog.scrollHeight;
}

function clearSerialLog() {
  if (!serialLog) {
    return;
  }
  serialLog.textContent = "";
}

function setMonitorState(active) {
  if (monitorButton) {
    monitorButton.textContent = active ? "Reconnect monitor" : "Connect serial monitor";
  }
  if (monitorDisconnectButton) {
    monitorDisconnectButton.hidden = !active;
  }
  if (serialStatus) {
    serialStatus.textContent = active
      ? "Serial session active on the selected port."
      : "Ready to connect to an ESP32-S3 device.";
  }
}

async function releaseMonitorPort() {
  try {
    if (monitorReader) {
      await monitorReader.cancel();
      monitorReader.releaseLock();
    }
  } catch {
    // Ignore cleanup errors so disconnect always completes.
  }

  try {
    if (monitorPort) {
      await monitorPort.close();
    }
  } catch {
    // The port may already be closed if the user unplugged the device.
  }

  monitorPort = null;
  monitorReader = null;
  monitorStreamClosed = null;
  monitorBusy = false;
  setMonitorState(false);
}

async function connectMonitor() {
  if (!("serial" in navigator)) {
    appendSerialLine("Web Serial is not supported in this browser.", "muted");
    return;
  }

  if (monitorBusy) {
    return;
  }

  monitorBusy = true;
  monitorButton && (monitorButton.disabled = true);

  try {
    if (!monitorPort) {
      appendSerialLine("Requesting a serial port...");
      monitorPort = await navigator.serial.requestPort();
    }

    await monitorPort.open({ baudRate: SERIAL_BAUD_RATE });
    appendSerialLine(`Connected at ${SERIAL_BAUD_RATE} baud.`);
    setMonitorState(true);

    const decoder = new TextDecoderStream();
    monitorStreamClosed = monitorPort.readable.pipeTo(decoder.writable).catch(() => {
      // Closed when the port disconnects.
    });
    monitorReader = decoder.readable.getReader();

    while (true) {
      const { value, done } = await monitorReader.read();
      if (done) {
        break;
      }
      if (value) {
        appendSerialLine(value.trimEnd());
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Serial connection failed.";
    appendSerialLine(message, "muted");
    await releaseMonitorPort();
  } finally {
    monitorButton && (monitorButton.disabled = false);
    monitorBusy = false;
    if (monitorStreamClosed) {
      await monitorStreamClosed.catch(() => undefined);
    }
  }
}

async function disconnectMonitor() {
  await releaseMonitorPort();
  appendSerialLine("Serial monitor disconnected.", "muted");
}

async function loadVersionCard() {
  try {
    setVersionStatus("Fetching firmware/version.json…");
    const response = await fetch("firmware/version.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load version.json (${response.status})`);
    }

    const payload = await response.json();
    const version = payload.version ?? "Unknown";
    const buildDate = payload.build_date ?? "Unknown";
    const target = payload.target ?? "Unknown";

    updateNodeListText(versionValues, version);
    updateNodeListText(buildDateValues, buildDate);
    updateNodeListText(targetValues, target);
    if (versionHeadline) {
      versionHeadline.textContent = `Firmware ${version}`;
    }

    setVersionStatus(`Latest build loaded from firmware/version.json: ${version} for ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load version metadata.";
    setVersionStatus(message, "error");
    updateNodeListText(versionValues, "Unavailable");
    updateNodeListText(buildDateValues, "Unavailable");
    updateNodeListText(targetValues, "Unavailable");
  }
}

async function wireInstallButton() {
  if (!installButton || !installHost) {
    return;
  }

  await customElements.whenDefined("esp-web-install-button");
  const installHostButton = installHost.shadowRoot?.querySelector("button");
  if (!installHostButton) {
    return;
  }

  const supported = window.isSecureContext && "serial" in navigator;
  installButton.disabled = !supported;
  installButton.title = supported
    ? "Open the ESP Web Tools installer"
    : "HTTPS and Web Serial support are required";

  if (!supported) {
    installButton.textContent = "Install unavailable in this browser";
    return;
  }

  installButton.addEventListener("click", () => {
    installHostButton.click();
  });
}

function wireMonitorButtons() {
  const supported = "serial" in navigator;
  if (!supported) {
    appendSerialLine("Web Serial is not supported in this browser.", "muted");
    if (monitorButton) {
      monitorButton.disabled = true;
      monitorButton.textContent = "Web Serial unsupported";
    }
    if (serialStatus) {
      serialStatus.textContent = "Web Serial is required for the serial monitor.";
    }
    return;
  }

  monitorButton?.addEventListener("click", connectMonitor);
  monitorDisconnectButton?.addEventListener("click", disconnectMonitor);
  monitorClearButton?.addEventListener("click", clearSerialLog);
  setMonitorState(false);
}

function wireThemeToggle() {
  themeToggle?.addEventListener("click", updateThemeFromToggle);
}

function seedSerialConsole() {
  appendSerialLine("Gateway flasher ready.", "muted");
  appendSerialLine("Use the install button to flash the device, or open the serial monitor to view live output.", "muted");
}

initializeTheme();
wireThemeToggle();
wireMonitorButtons();
wireInstallButton();
seedSerialConsole();
loadVersionCard();
