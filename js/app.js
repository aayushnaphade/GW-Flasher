/* ============================================================
   GW Flasher — workbench controller
   Native esptool-js flashing rendered in our own themed modal.
   Web Serial monitor, firmware/version.json metadata.
   ============================================================ */

import { flashFirmware, eraseChip } from "./flasher.js";

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

  flashProgress: $("[data-flash-progress]"),
  progressLabel: $("[data-progress-label]"),
  progressPct: $("[data-progress-pct]"),
  progressBar: $("[data-progress-bar]"),

  flashModal: $("[data-flash-modal]"),
  flashModalTitle: $("[data-flash-modal-title]"),
  flashModalSub: $("[data-flash-modal-sub]"),
  flashModalBody: $("[data-flash-modal-body]"),
  flashModalClose: $("[data-flash-modal-close]"),

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

  updateBanner: $("[data-update-banner]"),
  updateSub: $("[data-update-sub]"),
  updateReload: $("[data-update-reload]"),
  updateDismiss: $("[data-update-dismiss]"),
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
  flashing: false,
  currentVersion: null,
  updatePending: false,
  resumeMonitorAfterFlash: false,
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
    const res = await fetch(`${channelBasePath}/version.json`, { cache: "no-store" });
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
   Firmware Channel Selection (stable / beta)
   ============================================================ */
let activeChannel = localStorage.getItem("gw-flasher-channel") || "stable";
let channelBasePath = "firmware"; // updated by loadChannels()

async function loadChannels() {
  try {
    const res = await fetch("firmware/channels.json", { cache: "no-store" });
    if (!res.ok) return;
    const { channels } = await res.json();
    if (!Array.isArray(channels) || channels.length < 2) return;

    const ch = channels.find((c) => c.id === activeChannel) || channels.find((c) => c.is_default) || channels[0];
    activeChannel = ch.id;
    channelBasePath = ch.path;

    // Render channel toggle if a selector element exists in the DOM
    const selector = document.querySelector("[data-channel-selector]");
    if (selector) {
      selector.innerHTML = channels
        .map(
          (c) =>
            `<button data-channel="${c.id}" class="channel-btn ${c.id === activeChannel ? "active" : ""}" title="${c.description}">
              <span class="channel-badge channel-badge--${c.badge}">${c.name}</span>
              ${c.id !== "stable" ? `<span class="channel-detail">${c.description}</span>` : ""}
            </button>`
        )
        .join("");

      selector.querySelectorAll("[data-channel]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.channel;
          if (id === activeChannel) return;
          localStorage.setItem("gw-flasher-channel", id);
          location.reload(); // reload to pick up the new channel's firmware
        });
      });
    }
  } catch {
    // channels.json missing or unparseable — stay on stable
  }
}

/* ============================================================
   Native flashing — themed modal + esptool-js
   ============================================================ */
function getManifestPath() {
  return `${channelBasePath}/manifest.json`;
}

function wireInstall() {
  if (!el.installButton) return;
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

  el.installButton.addEventListener("click", openFlashModal);
  el.flashModalClose?.addEventListener("click", () => {
    if (state.flashing) return; // don't allow closing mid-flash
    closeFlashModal();
  });
  el.flashModal?.addEventListener("click", (e) => {
    if (e.target === el.flashModal && !state.flashing) closeFlashModal();
  });
}

function openFlashModal() {
  if (!el.flashModal) return;
  el.flashModal.hidden = false;
  renderFlashMenu();
}
function closeFlashModal() {
  if (!el.flashModal) return;
  el.flashModal.hidden = true;
}

/* ---------- Modal: action menu (Install / Logs) ---------- */
function renderFlashMenu() {
  if (el.flashModalTitle) el.flashModalTitle.textContent = "Firmware";
  if (el.flashModalSub) {
    const v = state.copyTargets["version-value"];
    el.flashModalSub.textContent = `${state.copyTargets["target-value"] || "ESP32-S3"}${v ? " · v" + v : ""}`;
  }
  el.flashModalBody.innerHTML = `
    <div class="flash-actions">
      <button class="flash-action" data-act="install">
        <span class="flash-action__ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
          </svg>
        </span>
        <span class="flash-action__text">
          Install firmware
          <small>Writes bootloader, table &amp; app</small>
        </span>
      </button>
      <button class="flash-action" data-act="logs">
        <span class="flash-action__ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3" /><path d="M13 15h4" />
          </svg>
        </span>
        <span class="flash-action__text">
          Logs &amp; console
          <small>Open the serial monitor</small>
        </span>
      </button>
      <button class="flash-action flash-action--danger" data-act="erase">
        <span class="flash-action__ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
          </svg>
        </span>
        <span class="flash-action__text">
          Erase flash
          <small>Wipe everything — clears WiFi creds &amp; config</small>
        </span>
      </button>
    </div>
  `;
  el.flashModalBody.querySelector('[data-act="install"]')?.addEventListener("click", beginFlash);
  el.flashModalBody.querySelector('[data-act="logs"]')?.addEventListener("click", () => {
    closeFlashModal();
    connectMonitor();
  });
  el.flashModalBody.querySelector('[data-act="erase"]')?.addEventListener("click", confirmErase);
}

/* ---------- Modal: installing view ---------- */
function renderInstalling(label, pct) {
  const indeterminate = pct == null;
  el.flashModalBody.innerHTML = `
    <div class="flash-phase">
      <h3 class="flash-phase__title">Installing</h3>
      <div class="ring" data-indeterminate="${indeterminate}" style="--pct:${pct || 0}">
        <span class="ring__spin"></span>
        <span class="ring__pct" data-ring-pct>${pct != null ? pct + "%" : ""}</span>
      </div>
      <p class="flash-phase__note" data-phase-note>${label}</p>
      <p class="flash-phase__note" style="margin-top:6px;color:var(--muted)">
        Keep this tab visible to avoid throttling.
      </p>
    </div>
  `;
}
function updateInstalling(label, pct) {
  const ring = el.flashModalBody.querySelector(".ring");
  const ringPct = el.flashModalBody.querySelector("[data-ring-pct]");
  const note = el.flashModalBody.querySelector("[data-phase-note]");
  if (!ring) return renderInstalling(label, pct);
  if (pct == null) {
    ring.dataset.indeterminate = "true";
    if (ringPct) ringPct.textContent = "";
  } else {
    ring.dataset.indeterminate = "false";
    ring.style.setProperty("--pct", pct);
    if (ringPct) ringPct.textContent = `${pct}%`;
  }
  if (note && label) note.textContent = label;
}

/* ---------- Modal: result views ---------- */
function renderSuccess() {
  el.flashModalBody.innerHTML = `
    <div class="flash-phase">
      <div class="flash-result">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
      <h3 class="flash-phase__title" style="text-align:center">Installation complete</h3>
      <p class="flash-phase__note">Firmware written and the device is rebooting.</p>
      <div class="flash-foot">
        <button class="btn btn--ghost" data-done>Close</button>
        <button class="btn btn--primary" data-monitor>Open serial monitor</button>
      </div>
    </div>
  `;
  el.flashModalBody.querySelector("[data-done]")?.addEventListener("click", closeFlashModal);
  el.flashModalBody.querySelector("[data-monitor]")?.addEventListener("click", () => {
    closeFlashModal();
    setTimeout(() => connectMonitor(), 800);
  });
}

function renderError(kind, message) {
  const causesByKind = {
    init: [
      "Device not in bootloader mode — hold BOOT, tap RST, release",
      "USB cable is power-only (use a data cable)",
      "Driver missing for your USB-serial chip",
      "Port already open in another app",
    ],
    write: ["Connection dropped mid-write", "Faulty cable or USB hub", "Try a different USB port"],
    download: ["Firmware asset missing on the server", "Network/proxy blocked the download"],
    unsupported: ["The published manifest has no build for this chip"],
    erase: ["Erase failed — retry, or skip erase"],
    module: [
      "No internet access to load the flashing engine",
      "A browser extension or CSP blocked the CDN",
      "Try disabling ad/script blockers for this site",
    ],
  };
  const causes = causesByKind[kind] || ["Unexpected error during flashing"];
  el.flashModalBody.innerHTML = `
    <div class="flash-phase">
      <div class="flash-result" data-tone="error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 8v5" /><path d="M12 16h.01" /><circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <h3 class="flash-phase__title" style="text-align:center">Installation failed</h3>
      <p class="flash-phase__note">${escapeHTML(message || "Something went wrong.")}</p>
      <ul class="causes">${causes.map((c) => `<li>${escapeHTML(c)}</li>`).join("")}</ul>
      <div class="flash-foot">
        <button class="btn btn--ghost" data-done>Close</button>
        <button class="btn btn--primary" data-retry>Retry</button>
      </div>
    </div>
  `;
  el.flashModalBody.querySelector("[data-done]")?.addEventListener("click", closeFlashModal);
  el.flashModalBody.querySelector("[data-retry]")?.addEventListener("click", beginFlash);
}

function escapeHTML(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- The flash run ---------- */
async function beginFlash() {
  if (state.flashing) return;

  // Free the port from our serial monitor first (one consumer at a time).
  if (state.live || state.port) {
    appendLine("Releasing serial monitor so the flasher can use the port…", "system");
    state.resumeMonitorAfterFlash = state.live;
    await releasePort();
    await new Promise((r) => setTimeout(r, 400));
  }

  let port;
  try {
    port = await navigator.serial.requestPort();
  } catch {
    // User cancelled the port picker — return to the menu.
    renderFlashMenu();
    return;
  }

  state.flashing = true;
  setFlow("flash", "active");
  setFlowBadge("Flashing", "busy");
  setStatus({ state: "busy", primary: "Flashing firmware…" });
  if (el.consoleMeta) el.consoleMeta.textContent = "flashing";
  renderInstalling("Connecting to device…", null);
  showProgress("Connecting…", "indeterminate");

  try {
    await flashFirmware({
      port,
      manifestPath: getManifestPath(),
      eraseFirst: false,
      onEvent: onFlashEvent,
    });
  } catch (err) {
    onFlashEvent({ phase: "error", kind: "write", message: err?.message || String(err) });
  }
}

/* ---------- Erase flash (factory reset) ---------- */
function confirmErase() {
  el.flashModalBody.innerHTML = `
    <div class="flash-phase">
      <div class="flash-result" data-tone="error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>
      <h3 class="flash-phase__title" style="text-align:center">Erase entire flash?</h3>
      <p class="flash-phase__note">
        This wipes <strong>everything</strong> on the device — firmware, saved WiFi
        credentials, and all configuration. The gateway will boot back onto the
        default commissioning network (<code>spark</code>) and you'll need to
        re-install firmware afterwards.
      </p>
      <div class="flash-foot">
        <button class="btn btn--ghost" data-cancel>Cancel</button>
        <button class="btn btn--danger" data-confirm>Erase flash</button>
      </div>
    </div>
  `;
  el.flashModalBody.querySelector("[data-cancel]")?.addEventListener("click", renderFlashMenu);
  el.flashModalBody.querySelector("[data-confirm]")?.addEventListener("click", beginErase);
}

async function beginErase() {
  if (state.flashing) return;

  // Free the port from our serial monitor first (one consumer at a time).
  if (state.live || state.port) {
    appendLine("Releasing serial monitor so the flasher can use the port…", "system");
    state.resumeMonitorAfterFlash = false;
    await releasePort();
    await new Promise((r) => setTimeout(r, 400));
  }

  let port;
  try {
    port = await navigator.serial.requestPort();
  } catch {
    renderFlashMenu();
    return;
  }

  state.flashing = true;
  setFlow("flash", "active");
  setFlowBadge("Erasing", "busy");
  setStatus({ state: "busy", primary: "Erasing flash…" });
  if (el.consoleMeta) el.consoleMeta.textContent = "erasing";
  renderInstalling("Connecting to device…", null);
  showProgress("Connecting…", "indeterminate");

  try {
    await eraseChip({ port, onEvent: onEraseEvent });
  } catch (err) {
    onEraseEvent({ phase: "error", kind: "erase", message: err?.message || String(err) });
  }
}

function onEraseEvent(e) {
  switch (e.phase) {
    case "init":
      updateInstalling(e.message, null);
      appendLine(e.chip ? `Detected ${e.chip}` : e.message, "system");
      setStatus({ state: "busy", primary: e.message });
      break;
    case "erasing":
      updateInstalling("Erasing entire flash…", null);
      appendLine("Erasing entire flash… this can take a moment.", "system");
      break;
    case "finished":
      finishErase(true);
      break;
    case "error":
      finishErase(false, e.kind, e.message);
      break;
  }
}

function finishErase(success, kind, message) {
  state.flashing = false;
  if (el.consoleMeta) el.consoleMeta.textContent = "";

  if (success) {
    setFlowBadge("Erased", "success");
    finishProgress("success", "Flash erased");
    setStatus({ state: "idle", primary: "Flash erased — install firmware to continue" });
    appendLine("Flash fully erased. Install firmware to continue.", "system");
    toast("Flash erased successfully", "success");
    el.flashModalBody.innerHTML = `
      <div class="flash-phase">
        <div class="flash-result">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 class="flash-phase__title" style="text-align:center">Flash erased</h3>
        <p class="flash-phase__note">The device is blank. Install firmware to bring it back online.</p>
        <div class="flash-foot">
          <button class="btn btn--ghost" data-done>Close</button>
          <button class="btn btn--primary" data-install>Install firmware</button>
        </div>
      </div>
    `;
    el.flashModalBody.querySelector("[data-done]")?.addEventListener("click", closeFlashModal);
    el.flashModalBody.querySelector("[data-install]")?.addEventListener("click", beginFlash);
  } else {
    setFlowBadge("Error", "error");
    finishProgress("error", "Erase failed");
    setStatus({ state: "error", primary: "Erase failed" });
    appendLine(`Erase error: ${message || "unknown"}`, "error");
    toast("Erase failed", "error");
    renderError(kind || "erase", message);
  }
}

function onFlashEvent(e) {
  switch (e.phase) {
    case "init":
      updateInstalling(e.message, null);
      appendLine(e.chip ? `Detected ${e.chip}` : e.message, "system");
      setStatus({ state: "busy", primary: e.message });
      break;
    case "preparing":
      updateInstalling(e.message, null);
      appendLine(e.message, "system");
      break;
    case "erasing":
      updateInstalling("Erasing flash…", null);
      appendLine("Erasing flash…", "system");
      break;
    case "writing": {
      const pct = e.percentage ?? 0;
      updateInstalling("Writing firmware…", pct);
      setProgress(pct, "Writing firmware…");
      setStatus({ state: "busy", primary: `Writing firmware… ${pct}%` });
      if (el.consoleMeta) el.consoleMeta.textContent = `flashing ${pct}%`;
      break;
    }
    case "finished":
      finishFlash(true);
      break;
    case "error":
      finishFlash(false, e.kind, e.message);
      break;
  }
}

function finishFlash(success, kind, message) {
  state.flashing = false;
  if (el.consoleMeta) el.consoleMeta.textContent = "";

  if (success) {
    setFlow("verify", "done");
    setFlowBadge("Flashed", "success");
    finishProgress("success", "Flash complete");
    appendLine("Firmware flashed. Device rebooting.", "system");
    toast("Firmware flashed successfully", "success");
    renderSuccess();
  } else {
    setFlowBadge("Error", "error");
    finishProgress("error", "Flash failed");
    setStatus({ state: "error", primary: "Flash failed" });
    appendLine(`Flash error: ${message || "unknown"}`, "error");
    toast("Flashing failed", "error");
    renderError(kind, message);
  }

  if (state.resumeMonitorAfterFlash && success) {
    state.resumeMonitorAfterFlash = false;
    appendLine("Reconnecting serial monitor after reboot…", "system");
    setTimeout(() => connectMonitor(), 1500);
  } else if (!state.live && success) {
    setStatus({ state: "idle", primary: "No device connected" });
  }

  flushPendingUpdate();
}

/* ---------- Rail inline progress bar ---------- */
function showProgress(label, mode = "indeterminate") {
  if (!el.flashProgress) return;
  el.flashProgress.hidden = false;
  el.flashProgress.dataset.mode = mode;
  delete el.flashProgress.dataset.tone;
  if (el.progressLabel) el.progressLabel.textContent = label;
  if (el.progressPct) el.progressPct.textContent = mode === "determinate" ? "0%" : "";
  if (el.progressBar && mode === "determinate") el.progressBar.style.width = "0%";
}
function setProgress(pct, label) {
  if (!el.flashProgress) return;
  el.flashProgress.dataset.mode = "determinate";
  if (el.progressBar) el.progressBar.style.width = `${pct}%`;
  if (el.progressPct) el.progressPct.textContent = `${pct}%`;
  if (label && el.progressLabel) el.progressLabel.textContent = label;
}
function finishProgress(tone, label) {
  if (!el.flashProgress) return;
  el.flashProgress.dataset.mode = "determinate";
  el.flashProgress.dataset.tone = tone;
  if (el.progressBar) el.progressBar.style.width = "100%";
  if (el.progressPct) el.progressPct.textContent = tone === "error" ? "—" : "100%";
  if (label && el.progressLabel) el.progressLabel.textContent = label;
  setTimeout(() => {
    if (el.flashProgress) el.flashProgress.hidden = true;
  }, 2600);
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
   Auto-update — site version polling
   Reads /site-version.json (written at deploy by GitHub Actions).
   Safe during flashing: defers reload, never interrupts a flash.
   ============================================================ */
const SITE_VERSION_URL = "site-version.json";
const POLL_INTERVAL_MS = 30000;

async function fetchSiteVersion() {
  try {
    const res = await fetch(`${SITE_VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.build || data.version || null;
  } catch {
    return null;
  }
}

function showUpdateBanner(newBuild) {
  if (!el.updateBanner) return;
  state.updatePending = true;
  if (el.updateSub) {
    el.updateSub.textContent = newBuild ? `build ${newBuild}` : "A new build is ready";
  }
  el.updateBanner.hidden = false;
  requestAnimationFrame(() => (el.updateBanner.dataset.show = "true"));
}

function flushPendingUpdate() {
  // Called when flashing ends — if an update arrived mid-flash, surface it now.
  if (state.updatePending && el.updateBanner?.hidden) {
    showUpdateBanner(null);
  }
}

el.updateReload?.addEventListener("click", () => window.location.reload());
el.updateDismiss?.addEventListener("click", () => {
  el.updateBanner.dataset.show = "false";
  setTimeout(() => (el.updateBanner.hidden = true), 200);
});

async function initAutoUpdate() {
  state.currentVersion = await fetchSiteVersion();
  // If the deploy hasn't added site-version.json yet, polling is a no-op.
  if (state.currentVersion === null) return;

  setInterval(async () => {
    const latest = await fetchSiteVersion();
    if (!latest || latest === state.currentVersion) return;

    // New build detected. Never interrupt an active flash.
    if (state.flashing) {
      state.updatePending = true; // surfaced when the flash dialog closes
      return;
    }
    showUpdateBanner(latest);
  }, POLL_INTERVAL_MS);
}

/* ============================================================
   Boot
   ============================================================ */
initTheme();
checkCompat();
setFlow("connect", "reset");
setFlowBadge("Ready");
wireInstall();
loadChannels().then(() => loadVersion());
initAutoUpdate();

if (!("serial" in navigator)) {
  el.monitorButtons.forEach((b) => {
    b.disabled = true;
  });
  if (el.serialStatus) el.serialStatus.textContent = "Web Serial is required for the serial monitor.";
}
