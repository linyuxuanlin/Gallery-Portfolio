import {
  readBrewHistory,
  persistHistory,
  readGhostReferenceId,
} from './pour-brew-history.js';

const EXPORT_VERSION = 1;
const MAX_IMPORT_BREWS = 60;
const MAX_IMPORT_SAMPLES_PER_BREW = 5000;

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanSample(sample) {
  if (!sample || typeof sample !== 'object') return null;
  const t = finite(sample.t);
  const x = finite(sample.x);
  const z = finite(sample.z);
  const flow = finite(sample.flow, 0);
  const water = finite(sample.water, 0);
  if (t === null || x === null || z === null) return null;
  return {
    t: Math.max(0, t),
    x,
    z,
    flow: Math.max(0, flow),
    water: Math.max(0, water),
    pouring: sample.pouring === true,
    ...(sample.breakBefore === true ? { breakBefore: true } : {}),
  };
}

export function validatePortableReplay(replay) {
  if (!replay || typeof replay !== 'object') return null;
  const samples = Array.isArray(replay.samples)
    ? replay.samples.slice(0, MAX_IMPORT_SAMPLES_PER_BREW).map(cleanSample).filter(Boolean)
    : [];
  if (samples.length < 2) return null;

  const createdAt = typeof replay.createdAt === 'string' ? replay.createdAt : new Date(0).toISOString();
  const duration = Math.max(0, finite(replay.duration, samples.at(-1)?.t || 0));
  const score = finite(replay.score, null);

  return {
    ...replay,
    createdAt,
    duration,
    ...(score === null ? {} : { score }),
    samples,
  };
}

export function createBrewExportBundle(storage = globalThis.localStorage, {
  exportedAt = new Date().toISOString(),
} = {}) {
  const history = readBrewHistory(storage);
  const ghostReferenceId = readGhostReferenceId(storage);
  return {
    format: 'pour-lab-brew-history',
    version: EXPORT_VERSION,
    exportedAt,
    brewCount: history.length,
    ghostReferenceId: ghostReferenceId || null,
    brews: history,
  };
}

export function serializeBrewExportBundle(bundle, { pretty = true } = {}) {
  return JSON.stringify(bundle, null, pretty ? 2 : 0);
}

export function parseBrewImport(text) {
  let parsed;
  try {
    parsed = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    return { ok: false, reason: 'invalid-json', brews: [] };
  }

  const source = Array.isArray(parsed)
    ? parsed
    : parsed?.format === 'pour-lab-brew-history'
      ? parsed.brews
      : parsed?.samples
        ? [parsed]
        : null;

  if (!Array.isArray(source)) return { ok: false, reason: 'unsupported-format', brews: [] };

  const brews = source
    .slice(0, MAX_IMPORT_BREWS)
    .map(validatePortableReplay)
    .filter(Boolean);

  if (!brews.length) return { ok: false, reason: 'no-valid-brews', brews: [] };

  return {
    ok: true,
    reason: null,
    brews,
    ghostReferenceId:
      parsed?.format === 'pour-lab-brew-history' && typeof parsed.ghostReferenceId === 'string'
        ? parsed.ghostReferenceId
        : null,
  };
}

export function importBrewBundle(storage = globalThis.localStorage, payload, {
  mode = 'merge',
} = {}) {
  const parsed = parseBrewImport(payload);
  if (!parsed.ok) return { ...parsed, imported: 0, history: readBrewHistory(storage) };

  const current = mode === 'replace' ? [] : readBrewHistory(storage);
  const result = persistHistory(storage, [...parsed.brews, ...current]);
  if (!result.ok) return { ok: false, reason: 'storage-failed', imported: 0, history: current };

  if (parsed.ghostReferenceId && result.history.some(item => item.id === parsed.ghostReferenceId)) {
    try { storage?.setItem?.('pourLabGhostReferenceId', parsed.ghostReferenceId); } catch {}
  }

  return {
    ok: true,
    reason: null,
    imported: parsed.brews.length,
    history: result.history,
    degraded: !!result.degraded,
  };
}

function safeFilename(date = new Date()) {
  return `pour-lab-history-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}

export function downloadBrewHistory(doc = globalThis.document, storage = globalThis.localStorage) {
  const bundle = createBrewExportBundle(storage);
  const text = serializeBrewExportBundle(bundle);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = safeFilename(new Date(bundle.exportedAt));
  a.hidden = true;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
  return { ok: true, brewCount: bundle.brewCount, bytes: blob.size };
}

function ensureStyle(doc) {
  if (doc.getElementById('pourBrewPortabilityStyle')) return;
  const style = doc.createElement('style');
  style.id = 'pourBrewPortabilityStyle';
  style.textContent = '.brew-portability{display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}.brew-portability.show{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.brew-portability button{padding:7px 9px;font-size:9px}.brew-portability-status{font-size:9px;color:var(--muted)}';
  doc.head.appendChild(style);
}

function ensureControls(doc) {
  const history = doc.getElementById('brewHistory');
  if (!history) return null;
  let controls = doc.getElementById('brewPortability');
  if (controls) return controls;
  controls = doc.createElement('div');
  controls.id = 'brewPortability';
  controls.className = 'brew-portability';
  controls.innerHTML = '<button type="button" class="secondary" id="brewExport">导出历史</button><button type="button" class="secondary" id="brewImport">导入历史</button><input id="brewImportFile" type="file" accept="application/json,.json" hidden /><span class="brew-portability-status" id="brewPortabilityStatus"></span>';
  history.appendChild(controls);
  return controls;
}

export function installBrewPortability(doc = globalThis.document, storage = globalThis.localStorage) {
  if (!doc || doc.__pourBrewPortabilityInstalled) return { installed: false };
  doc.__pourBrewPortabilityInstalled = true;
  ensureStyle(doc);
  const controls = ensureControls(doc);
  if (!controls) return { installed: false, reason: 'history-panel-missing' };

  const exportBtn = doc.getElementById('brewExport');
  const importBtn = doc.getElementById('brewImport');
  const input = doc.getElementById('brewImportFile');
  const status = doc.getElementById('brewPortabilityStatus');

  const refreshVisibility = () => controls.classList.toggle('show', readBrewHistory(storage).length > 0);

  exportBtn.onclick = () => {
    const result = downloadBrewHistory(doc, storage);
    status.textContent = `已导出 ${result.brewCount} 杯`;
  };
  importBtn.onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = '正在导入…';
    try {
      const result = importBrewBundle(storage, await file.text(), { mode: 'merge' });
      status.textContent = result.ok
        ? `已导入 ${result.imported} 杯${result.degraded ? ' · 已自动压缩' : ''}`
        : '导入失败：文件格式不受支持';
      if (result.ok) doc.dispatchEvent(new CustomEvent('pour:history-imported', { detail: result }));
    } catch {
      status.textContent = '导入失败：无法读取文件';
    } finally {
      input.value = '';
      refreshVisibility();
    }
  };

  refreshVisibility();
  return { installed: true, refreshVisibility };
}
