/* ============================================================
   GW Flasher — workbench controller
   Keeps existing integrations: ESP Web Tools install button,
   Web Serial monitor, firmware/version.json metadata.
   ============================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const root = document.documentElement;
const THEME_KEY = "gw-flasher-theme";
const SERIAL_BAUD = 115200;
const MAX_LINES = 5000;

/* ---------- Element refs ---------- */
const el = {
  themeToggle: $("[data-theme-toggle]"),
  themeLabel: $("[data-theme-label]"),

  envBanner: $("[data-env-banner]"),
  envBannerText: $("[data-env-banner-text]"),

  statusLed: $("[data-status-led]"),
  statusPrimary: $("[data-status-primary]"),
  statusDetailWrap: $("[data-status-detail-wrap]"),
  chipChip: $('[data-status-chip="chip"]'),
  chipPort: $('[data-status-chip="port"]'),
  chipBaud: $('[data-status-chip="baud"]'),
  chipSeen: $('[data-status-chip="seen"]'),

  deviceCard: $("[data-device-card]"),
  deviceHint: $("[data-device-hint]"),
  deviceStateText: $("[data-device-state-text]"),
  devicePort: $("[data-device-port]"),
  deviceBaud: $("[data-device-baud]"),

  flowBadge: $("[data-flow-badge]"),
  flowSteps: $$("[data-flow-step]"),

  installButton: $("[data-install-button]"),
  installNote: $("[data-install-note]"),
  installHost: $("esp-web-install-button"),

  versionStatus: $("[data-version-status]"),
  versionValues: $$("[data-version-value]"),
  buildDateValues: $$("[data-build-date-value]"),
  targetValues: $$("[data-target-value]"),
  commitRow: $("[data-commit-row]"),
  commitValue: $("[data-commit-value]"),

  console: $("[data-console]"),
  consoleMeta: $("[data-console-meta]"),
  consoleEmpty: $("[data-console-empty]"),
  consoleCollapse: $("[data-console-collapse]"),
  stream: $("[data-serial-log]"),
  serialStatus: $("[data-serial-status]"),
  logCount: $("[data-log-count]"),
  logSearch: $("[data-log-search]"),
  filters: $$("[data-filter]"),

  monitorButtons: $$("[data-monitor-button], [data-monitor-button-alt]"),
  monitorDisconnect: $("[data-monitor-disconnect]"),
  monitorClear: $("[data-monitor-clear]"),
  logCopy: $("[data-log-copy]"),
  logExport: $("[data-log-export]"),

  shortcutsBtn: $("[data-shortcuts-btn]"),
  shortcutsOverlay: $("[data-shortcuts-overlay]"),
  shortcutsClose: $("[data-shortcuts-close]"),

  toast: $("[data-toast]"),
};

/* ---------- State ---------- */
const state = {
  port: null,
  reader: null,
  streamClosed: null,
  busy: false,
  live: false,
  activeFilter: "all",
  search: "",
  lineCount: 0,
  hasLogs: false,
  copyTargets: {},
  lineBuffer: "",
};

/* ============================================================
   Theme
   ============================================================ */
function applyTheme(theme) {
  root.dataset.theme = theme;
  if (el.themeLabel) {
    el.themeLabel.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  }
}
function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  applyTheme(stored || preferred);
}
el.themeToggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

/* ============================================================
   Toast
   ============================================================ */
let toastTimer = null;
function toast(message, tone = "info") {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.hidden = false;
  requestAnimationFrame(() => (el.toast.dataset.show = "true"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.dataset.show = "false";
    setTimeout(() => (el.toast.hidden = true), 200);
  }, 2400);
}

/* ============================================================
   Device status bar + flow
   ============================================================ */
function setStatus({ state: s, primary, chip, port, baud, seen }) {
  if (s && el.statusLed) el.statusLed.dataset.state = s;
  if (primary && el.statusPrimary) el.statusPrimary.textContent = primary;

  const setChip = (node, value) => {
    if (!node) return;
    if (value) {
      node.textContent = value;
      node.hidden = false;
    } else {
      node.hidden = true;
    }
  };
  setChip(el.chipChip, chip);
  setChip(el.chipPort, port);
  setChip(el.chipBaud, baud);
  setChip(el.chipSeen, seen);

  const anyDetail = chip || port || baud || seen;
  if (el.statusDetailWrap) el.statusDetailWrap.hidden = !anyDetail;
}

function setFlow(stepId, status) {
  // status: pending | active | done
  const order = ["connect", "detect", "flash", "verify", "monitor"];
  const target = order.indexOf(stepId);
  el.flowSteps.forEach((node) => {
    const id = node.dataset.flowStep;
    const idx = order.indexOf(id);
    if (status === "reset") {
      node.dataset.status = "pending";
      return;
    }
    if (idx < target) node.dataset.status = "done";
    else if (idx === target) node.dataset.status = status;
    else node.dataset.status = "pending";
  });
}

function setFlowBadge(text, tone) {
  if (!el.flowBadge) return;
  el.flowBadge.textContent = text;
  if (tone) el.flowBadge.dataset.tone = tone;
  else delete el.flowBadge.dataset.tone;
}

/* ============================================================
   Console — severity parsing, filter, search
   ============================================================ */
function detectSeverity(text) {
  const t = text.toUpperCase();
  if (/\b(E|ERROR|FAIL|FAILED|PANIC|ABORT|FATAL)\b/.test(t) || /^E \(/.test(text)) return "error";
  if (/\b(W|WARN|WARNING)\b/.test(t) || /^W \(/.test(text)) return "warn";
  if (/^I \(/.test(text) || /\bINFO\b/.test(t)) return "info";
  return "info";
}

function timestamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function showStreamView() {
  if (!state.hasLogs) {
    state.hasLogs = true;
    if (el.consoleEmpty) el.consoleEmpty.hidden = true;
    if (el.stream) el.stream.hidden = false;
  }
}

function matchesFilter(sev) {
  if (state.activeFilter === "all") return true;
  return sev === state.activeFilter;
}
function matchesSearch(text) {
  if (!state.search) return true;
  return text.toLowerCase().includes(state.search);
}

function applyLineVisibility(line) {
  const sev = line.dataset.sev;
  const text = line.dataset.text || "";
  const visible = matchesFilter(sev) && matchesSearch(text);
  line.classList.toggle("is-hidden", !visible);
}

function refilterAll() {
  if (!el.stream) return;
  $$(".logline", el.stream).forEach(applyLineVisibility);
}

function appendLine(text, sevOverride) {
  if (!el.stream) return;
  showStreamView();

  const sev = sevOverride || detectSeverity(text);
  const line = document.createElement("div");
  line.className = "logline";
  line.dataset.sev = sev;
  line.dataset.text = text;

  const ts = document.createElement("span");
  ts.className = "logline__ts";
  ts.textContent = timestamp();

  const sevEl = document.createElement("span");
  sevEl.className = "logline__sev";
  sevEl.textContent = sev === "system" ? "··" : sev.toUpperCase();

  const msg = document.createElement("span");
  msg.className = "logline__msg";
  renderMessage(msg, text);

  line.append(ts, sevEl, msg);
  applyLineVisibility(line);
  el.stream.append(line);

  state.lineCount += 1;
  // Trim
  if (state.lineCount > MAX_LINES) {
    el.stream.firstElementChild?.remove();
    state.lineCount -= 1;
  }
  updateCount();

  const nearBottom = el.stream.scrollHeight - el.stream.scrollTop - el.stream.clientHeight < 80;
  if (nearBottom) el.stream.scrollTop = el.stream.scrollHeight;
}

function renderMessage(node, text) {
  node.textContent = "";
  if (state.search && text.toLowerCase().includes(state.search)) {
    const idx = text.toLowerCase().indexOf(state.search);
    node.append(document.createTextNode(text.slice(0, idx)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + state.search.length);
    node.append(mark);
    node.append(document.createTextNode(text.slice(idx + state.search.length)));
  } else {
    node.textContent = text;
  }
}

function updateCount() {
  if (el.logCount) {
    el.logCount.textContent = state.lineCount ? `${state.lineCount} lines` : "";
  }
}

function clearConsole() {
  if (el.stream) el.stream.textContent = "";
  state.lineCount = 0;
  state.hasLogs = false;
  if (el.consoleEmpty) el.consoleEmpty.hidden = false;
  if (el.stream) el.stream.hidden = true;
  updateCount();
}

function collectLogText() {
  if (!el.stream) return "";
  return $$(".logline", el.stream)
    .map((l) => `[${$(".logline__ts", l)?.textContent}] ${l.dataset.sev.toUpperCase()} ${l.dataset.text}`)
    .join("\n");
}

/* Filters */
el.filters.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.activeFilter = btn.dataset.filter;
    el.filters.forEach((b) => b.classList.toggle("is-active", b === btn));
    refilterAll();
  });
});

/* Search */
let searchDebounce = null;
el.logSearch?.addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.search = e.target.value.trim().toLowerCase();
    if (el.stream) {
      $$(".logline", el.stream).forEach((line) => {
        renderMessage($(".logline__msg", line), line.dataset.text || "");
        applyLineVisibility(line);
      });
    }
  }, 120);
});

/* Console tools */
el.monitorClear?.addEventListener("click", () => {
  clearConsole();
  toast("Console cleared");
});
el.logCopy?.addEventListener("click", async () => {
  const text = collectLogText();
  if (!text) return toast("Nothing to copy", "info");
  try {
    await navigator.clipboard.writeText(text);
    toast("Logs copied to clipboard", "success");
  } catch {
    toast("Clipboard blocked by browser", "error");
  }
});
el.logExport?.addEventListener("click", () => {
  const text = collectLogText();
  if (!text) return toast("No logs to export", "info");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gw-flasher-log-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Log file downloaded", "success");
});

/* Collapse */
el.consoleCollapse?.addEventListener("click", () => {
  const collapsed = el.console.dataset.collapsed === "true";
  el.console.dataset.collapsed = String(!collapsed);
  el.consoleCollapse.textContent = collapsed ? "▾" : "▸";
  el.consoleCollapse.title = collapsed ? "Collapse console" : "Expand console";
});

/* ============================================================
   Serial monitor (Web Serial)
   ============================================================ */
function setLive(active, portLabel) {
  state.live = active;
  if (el.console) el.console.dataset.live = String(active);

  $$("[data-monitor-button], [data-monitor-button-alt]").forEach((b) => {
    const isMain = b.hasAttribute("data-monitor-button");
    if (isMain) {
      b.innerHTML = active
        ? '<span class="led-mini" data-monitor-led></span>Reconnect'
        : '<span class="led-mini" data-monitor-led></span>Connect';
    } else {
      b.textContent = active ? "Serial monitor active" : "Connect serial monitor";
      b.disabled = active;
    }
  });

  if (el.monitorDisconnect) el.monitorDisconnect.hidden = !active;

  if (active) {
    setStatus({
      state: "connected",
      primary: "Device connected",
      chip: "ESP32-S3",
      port: portLabel || "Serial",
      baud: `${SERIAL_BAUD} baud`,
      seen: "live",
    });
    el.deviceCard && (el.deviceCard.dataset.state = "connected");
    el.deviceHint && (el.deviceHint.textContent = "Connected");
    el.deviceStateText && (el.deviceStateText.textContent = "Connected");
    el.devicePort && (el.devicePort.textContent = portLabel || "Serial");
    el.serialStatus && (el.serialStatus.textContent = "Serial session active.");
    setFlow("monitor", "active");
  } else {
    setStatus({ state: "idle", primary: "No device connected" });
    el.deviceCard && (el.deviceCard.dataset.state = "idle");
    el.deviceHint && (el.deviceHint.textContent = "Disconnected");
    el.deviceStateText && (el.deviceStateText.textContent = "Not connected");
    el.devicePort && (el.devicePort.textContent = "—");
    el.serialStatus && (el.serialStatus.textContent = "Ready to connect to an ESP32-S3 device.");
    setFlow("connect", "reset");
  }
}

async function releasePort() {
  try {
    if (state.reader) {
      await state.reader.cancel();
      state.reader.releaseLock();
    }
  } catch {}
  try {
    if (state.port) await state.port.close();
  } catch {}
  state.port = null;
  state.reader = null;
  state.streamClosed = null;
  state.busy = false;
  setLive(false);
}

function pushSerialChunk(chunk) {
  // Buffer and split into lines so multi-line ESP logs render cleanly.
  state.lineBuffer += chunk;
  const parts = state.lineBuffer.split(/\r?\n/);
  state.lineBuffer = parts.pop() ?? "";
  parts.forEach((p) => {
    if (p.trim().length) appendLine(p);
  });
}

async function connectMonitor() {
  if (!("serial" in navigator)) {
    appendLine("Web Serial is not supported in this browser.", "error");
    return;
  }
  if (state.busy || state.live) return;

  state.busy = true;
  setStatus({ state: "busy", primary: "Opening serial port…" });

  try {
    if (!state.port) {
      appendLine("Requesting serial port…", "system");
      state.port = await navigator.serial.requestPort();
    }
    await state.port.open({ baudRate: SERIAL_BAUD });

    const info = state.port.getInfo?.() || {};
    const label = info.usbVendorId
      ? `USB ${info.usbVendorId.toString(16)}:${(info.usbProductId || 0).toString(16)}`
      : "Serial";

    appendLine(`Connected at ${SERIAL_BAUD} baud.`, "system");
    setLive(true, label);

    const decoder = new TextDecoderStream();
    state.streamClosed = state.port.readable.pipeTo(decoder.writable).catch(() => {});
    state.reader = decoder.readable.getReader();

    while (true) {
      const { value, done } = await state.reader.read();
      if (done) break;
      if (value) pushSerialChunk(value);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Serial connection failed.";
    if (!/no port selected|cancelled/i.test(msg)) {
      appendLine(msg, "error");
      setStatus({ state: "error", primary: "Connection failed" });
      toast(msg, "error");
    } else {
      setStatus({ state: "idle", primary: "No device connected" });
    }
    await releasePort();
  } finally {
    state.busy = false;
    if (state.streamClosed) await state.streamClosed.catch(() => {});
  }
}

async function disconnectMonitor() {
  await releasePort();
  appendLine("Serial monitor disconnected.", "system");
  toast("Disconnected");
}

el.monitorButtons.forEach((b) => b.addEventListener("click", connectMonitor));
el.monitorDisconnect?.addEventListener("click", disconnectMonitor);

/* ============================================================
   Firmware metadata
   ============================================================ */
function setNodes(nodes, value) {
  nodes.forEach((n) => (n.textContent = value));
}

async function loadVersion() {
  try {
    if (el.versionStatus) el.versionStatus.textContent = "Loading…";
    const res = await fetch("firmware/version.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const version = data.version ?? "Unknown";
    setNodes(el.versionValues, version);
    setNodes(el.buildDateValues, data.build_date ?? "Unknown");
    setNodes(el.targetValues, data.target ?? "Unknown");
    state.copyTargets["version-value"] = version;
    state.copyTargets["target-value"] = data.target ?? "";

    if (data.git_commit && el.commitRow) {
      el.commitRow.hidden = false;
      const short = String(data.git_commit).slice(0, 10);
      el.commitValue.textContent = short;
      state.copyTargets["commit-value"] = data.git_commit;
    }

    if (el.versionStatus) el.versionStatus.textContent = `v${version}`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "metadata unavailable";
    if (el.versionStatus) el.versionStatus.textContent = "Unavailable";
    setNodes(el.versionValues, "—");
    setNodes(el.buildDateValues, "—");
    setNodes(el.targetValues, "—");
    appendLine(`Could not load firmware metadata: ${msg}`, "warn");
  }
}

/* Copy buttons (metadata) */
$$("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const key = btn.dataset.copyTarget;
    const value = state.copyTargets[key];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      btn.dataset.state = "done";
      btn.textContent = "✓";
      toast("Copied", "success");
      setTimeout(() => {
        btn.dataset.state = "";
        btn.textContent = "⧉";
      }, 1200);
    } catch {
      toast("Clipboard blocked", "error");
    }
  });
});

/* ============================================================
   ESP Web Tools install button proxy + flow tracking
   ============================================================ */
async function wireInstall() {
  if (!el.installButton || !el.installHost) return;

  const supported = window.isSecureContext && "serial" in navigator;
  el.installButton.disabled = !supported;

  if (!supported) {
    el.installButton.innerHTML = "Flashing unavailable";
    if (el.installNote) {
      el.installNote.textContent = window.isSecureContext
        ? "This browser lacks Web Serial. Use Chrome, Edge, or Opera on desktop."
        : "Flashing requires a secure (HTTPS) connection.";
    }
    return;
  }

  await customElements.whenDefined("esp-web-install-button");
  const hostBtn = el.installHost.shadowRoot?.querySelector("button");

  el.installButton.addEventListener("click", () => {
    setFlow("detect", "active");
    setFlowBadge("Flashing", "busy");
    setStatus({ state: "busy", primary: "Launching installer…" });
    appendLine("Opening firmware installer…", "system");
    if (hostBtn) hostBtn.click();
    else el.installHost.click();
  });

  // Track ESP Web Tools lifecycle events
  el.installHost.addEventListener("state-changed", (e) => {
    const detail = e.detail || {};
    handleEspState(detail);
  });
}

function handleEspState(detail) {
  const { state: phase, message, details } = detail;
  switch (phase) {
    case "INITIALIZING":
    case "MANIFEST":
      setFlow("detect", "active");
      setStatus({ state: "busy", primary: "Detecting device…" });
      break;
    case "PREPARING":
      setFlow("flash", "active");
      setStatus({ state: "busy", primary: "Preparing flash…" });
      break;
    case "ERASING":
      setFlow("flash", "active");
      setStatus({ state: "busy", primary: "Erasing flash…" });
      appendLine("Erasing flash…", "system");
      break;
    case "WRITING": {
      setFlow("flash", "active");
      const pct = details?.percentage != null ? ` ${details.percentage}%` : "";
      setStatus({ state: "busy", primary: `Writing firmware…${pct}` });
      if (el.consoleMeta) el.consoleMeta.textContent = `flashing${pct}`;
      break;
    }
    case "FINISHED":
      setFlow("verify", "done");
      setFlowBadge("Flashed", "success");
      setStatus({ state: "connected", primary: "Flash complete — rebooting" });
      appendLine("Firmware flashed successfully. Device rebooting.", "system");
      if (el.consoleMeta) el.consoleMeta.textContent = "";
      toast("Firmware flashed successfully", "success");
      break;
    case "ERROR":
      setFlowBadge("Error", "error");
      setStatus({ state: "error", primary: "Flash failed" });
      appendLine(`Flash error: ${message || details?.error || "unknown"}`, "error");
      if (el.consoleMeta) el.consoleMeta.textContent = "";
      toast("Flashing failed — see console", "error");
      break;
    default:
      break;
  }
}

/* ============================================================
   Compatibility detection
   ============================================================ */
function checkCompat() {
  const issues = [];
  if (!window.isSecureContext) issues.push("This page is not served over HTTPS — flashing needs a secure context.");
  if (!("serial" in navigator)) issues.push("Web Serial is unavailable. Use Chrome, Edge, or Opera on desktop (not Firefox/Safari/mobile).");

  if (issues.length && el.envBanner) {
    el.envBanner.hidden = false;
    el.envBanner.dataset.tone = !("serial" in navigator) ? "error" : "warning";
    el.envBannerText.textContent = issues.join(" ");
  }
}

/* ============================================================
   Shortcuts + overlay
   ============================================================ */
function openShortcuts() { el.shortcutsOverlay && (el.shortcutsOverlay.hidden = false); }
function closeShortcuts() { el.shortcutsOverlay && (el.shortcutsOverlay.hidden = true); }
el.shortcutsBtn?.addEventListener("click", openShortcuts);
el.shortcutsClose?.addEventListener("click", closeShortcuts);
el.shortcutsOverlay?.addEventListener("click", (e) => {
  if (e.target === el.shortcutsOverlay) closeShortcuts();
});

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");

  if (e.key === "Escape") {
    closeShortcuts();
    return;
  }
  if (!typing && e.key === "?") {
    e.preventDefault();
    openShortcuts();
    return;
  }
  if (!typing && e.key === "/") {
    e.preventDefault();
    el.logSearch?.focus();
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    el.installButton?.click();
    return;
  }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "r") {
    e.preventDefault();
    connectMonitor();
    return;
  }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    clearConsole();
    return;
  }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
    // Only hijack copy when nothing is selected
    if (state.hasLogs) {
      e.preventDefault();
      el.logCopy?.click();
    }
  }
});

/* ============================================================
   Boot
   ============================================================ */
initTheme();
checkCompat();
setFlow("connect", "reset");
setFlowBadge("Ready");
wireInstall();
loadVersion();

if (!("serial" in navigator)) {
  el.monitorButtons.forEach((b) => {
    b.disabled = true;
  });
  if (el.serialStatus) el.serialStatus.textContent = "Web Serial is required for the serial monitor.";
}
