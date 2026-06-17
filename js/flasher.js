/* ============================================================
   Native ESP flasher — uses esptool-js directly so the entire
   flashing flow renders in our own themed modal (no Material dialog).
   Mirrors the proven esp-web-tools flash sequence.
   ============================================================ */

const ESPTOOL_CDN = "https://esm.sh/esptool-js@0.5.7";

let espModulePromise = null;
function loadEsptool() {
  if (!espModulePromise) espModulePromise = import(ESPTOOL_CDN);
  return espModulePromise;
}

/**
 * Flash firmware described by a manifest.
 * @param {object} opts
 * @param {SerialPort} opts.port - already-selected serial port (NOT opened)
 * @param {string} opts.manifestPath - URL to manifest.json
 * @param {boolean} [opts.eraseFirst]
 * @param {(e:object)=>void} opts.onEvent - phase/progress callback
 */
export async function flashFirmware({ port, manifestPath, eraseFirst = false, onEvent }) {
  const emit = (e) => onEvent && onEvent(e);
  const { Transport, ESPLoader } = await loadEsptool();

  emit({ phase: "init", message: "Connecting to device…" });

  // Fetch manifest first (cheap, gives early failure).
  const manifestURL = new URL(manifestPath, location.href).toString();
  const manifest = await fetchJSON(manifestURL);

  const transport = new Transport(port, true);
  const esploader = new ESPLoader({
    transport,
    baudrate: 115200,
    romBaudrate: 115200,
    enableTracing: false,
  });

  let chipFamily;
  try {
    await esploader.main();
    await esploader.flashId();
    chipFamily = esploader.chip.CHIP_NAME;
    emit({ phase: "init", message: `Connected · ${chipFamily}`, done: true, chip: chipFamily });
  } catch (err) {
    await safeReset(transport, esploader);
    await safeDisconnect(transport);
    emit({
      phase: "error",
      kind: "init",
      message:
        "Couldn't connect. Hold BOOT, tap RST, release, then retry — or check the cable/driver.",
      error: err,
    });
    return;
  }

  const build = (manifest.builds || []).find((b) => b.chipFamily === chipFamily);
  if (!build) {
    await safeReset(transport, esploader);
    await safeDisconnect(transport);
    emit({
      phase: "error",
      kind: "unsupported",
      message: `This firmware does not support ${chipFamily}.`,
    });
    return;
  }

  // Download parts.
  emit({ phase: "preparing", message: "Downloading firmware…" });
  const fileArray = [];
  let totalSize = 0;
  try {
    for (const part of build.parts) {
      const url = new URL(part.path, manifestURL).toString();
      const data = await fetchBinaryString(url);
      fileArray.push({ data, address: part.offset });
      totalSize += data.length;
    }
  } catch (err) {
    await safeReset(transport, esploader);
    await safeDisconnect(transport);
    emit({ phase: "error", kind: "download", message: err.message, error: err });
    return;
  }
  emit({ phase: "preparing", message: "Firmware ready", done: true });

  // Erase (optional).
  if (eraseFirst) {
    emit({ phase: "erasing", message: "Erasing flash…" });
    try {
      await esploader.eraseFlash();
    } catch (err) {
      await safeReset(transport, esploader);
      await safeDisconnect(transport);
      emit({ phase: "error", kind: "erase", message: err.message, error: err });
      return;
    }
  }

  // Write.
  emit({ phase: "writing", message: "Writing firmware…", percentage: 0 });
  let totalWritten = 0;
  try {
    await esploader.writeFlash({
      fileArray,
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        const uncompressed = (written / total) * fileArray[fileIndex].data.length;
        const pct = Math.floor(((totalWritten + uncompressed) / totalSize) * 100);
        if (written === total) {
          totalWritten += uncompressed;
          return;
        }
        emit({ phase: "writing", message: `Writing firmware…`, percentage: Math.min(99, pct) });
      },
    });
  } catch (err) {
    await safeReset(transport, esploader);
    await safeDisconnect(transport);
    emit({ phase: "error", kind: "write", message: err.message, error: err });
    return;
  }

  emit({ phase: "writing", message: "Write complete", percentage: 100 });

  // Reset into the new app.
  await safeReset(transport, esploader);
  await safeDisconnect(transport);

  emit({ phase: "finished", message: "Installation complete" });
}

/* ---------- helpers ---------- */
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);
  return res.json();
}

async function fetchBinaryString(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Downloading ${url.split("/").pop()} failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
  }
  return s;
}

async function safeReset(transport, esploader) {
  try {
    await transport.setRTS(true);
    await new Promise((r) => setTimeout(r, 100));
    await esploader.after();
  } catch {
    /* best-effort reset */
  }
}

async function safeDisconnect(transport) {
  try {
    await transport.disconnect();
  } catch {
    /* ignore */
  }
}
