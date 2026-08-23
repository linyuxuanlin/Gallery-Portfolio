import { resolveGhostReference } from './pour-brew-history.js';

const LAST_BREW_KEY = 'pourLabLastBrew';

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sortedSamples(samples) {
  return (Array.isArray(samples) ? samples : [])
    .filter(sample => Number.isFinite(Number(sample?.water)))
    .slice()
    .sort((a, b) => finite(a.water) - finite(b.water));
}

export function sampleAtWater(samples, water) {
  const src = sortedSamples(samples);
  if (!src.length) return null;
  const target = Math.max(0, finite(water));
  if (target <= finite(src[0].water)) return { ...src[0] };
  if (target >= finite(src.at(-1).water)) return { ...src.at(-1) };

  let lo = 0, hi = src.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (finite(src[mid].water) <= target) lo = mid; else hi = mid;
  }
  const a = src[lo], b = src[hi];
  const aw = finite(a.water), bw = finite(b.water);
  const span = Math.max(1e-9, bw - aw);
  const u = Math.max(0, Math.min(1, (target - aw) / span));
  const lerp = key => finite(a?.[key]) + (finite(b?.[key]) - finite(a?.[key])) * u;
  return {
    t: lerp('t'),
    x: lerp('x'),
    z: lerp('z'),
    flow: lerp('flow'),
    water: target,
    pouring: (a?.pouring === true || b?.pouring === true) && lerp('flow') > 0.08,
  };
}

export function buildGhostDeviationTimeline(currentSamples, ghostSamples, {
  stepWater = 5,
  maxWater = null,
} = {}) {
  const current = sortedSamples(currentSamples);
  const ghost = sortedSamples(ghostSamples);
  if (current.length < 2 || ghost.length < 2) return { valid: false, points: [], segments: [] };

  const upper = Math.max(0, Math.min(
    maxWater == null ? Infinity : finite(maxWater, Infinity),
    finite(current.at(-1).water),
    finite(ghost.at(-1).water),
  ));
  if (!(upper > 0)) return { valid: false, points: [], segments: [] };

  const step = Math.max(1, finite(stepWater, 5));
  const points = [];
  for (let water = 0; water <= upper + 1e-9; water += step) {
    const a = sampleAtWater(current, water);
    const b = sampleAtWater(ghost, water);
    if (!a || !b) continue;
    const pathDelta = Math.hypot(a.x - b.x, a.z - b.z);
    const flowDelta = Math.abs(a.flow - b.flow);
    points.push({ water, pathDelta, flowDelta, current: a, ghost: b });
  }
  if (points.at(-1)?.water < upper) {
    const a = sampleAtWater(current, upper), b = sampleAtWater(ghost, upper);
    points.push({ water: upper, pathDelta: Math.hypot(a.x - b.x, a.z - b.z), flowDelta: Math.abs(a.flow - b.flow), current: a, ghost: b });
  }

  const segments = [];
  const segmentSize = 25;
  for (let start = 0; start < upper; start += segmentSize) {
    const end = Math.min(upper, start + segmentSize);
    const slice = points.filter(point => point.water >= start && point.water <= end);
    if (!slice.length) continue;
    const mean = key => slice.reduce((sum, point) => sum + point[key], 0) / slice.length;
    segments.push({ start, end, pathDelta: mean('pathDelta'), flowDelta: mean('flowDelta') });
  }

  const meanPathDelta = points.reduce((sum, p) => sum + p.pathDelta, 0) / points.length;
  const meanFlowDelta = points.reduce((sum, p) => sum + p.flowDelta, 0) / points.length;
  const worstPath = segments.slice().sort((a, b) => b.pathDelta - a.pathDelta)[0] || null;
  const worstFlow = segments.slice().sort((a, b) => b.flowDelta - a.flowDelta)[0] || null;

  return { valid: true, points, segments, meanPathDelta, meanFlowDelta, worstPath, worstFlow, maxWater: upper };
}

export function ghostDeviationSummary(timeline) {
  if (!timeline?.valid) return { valid: false, headline: '暂无 Ghost 对比数据', notes: [] };
  const notes = [];
  if (timeline.worstPath && timeline.worstPath.pathDelta > 0.12) {
    notes.push(`${Math.round(timeline.worstPath.start)}–${Math.round(timeline.worstPath.end)}g 落点偏差最大`);
  }
  if (timeline.worstFlow && timeline.worstFlow.flowDelta > 0.9) {
    notes.push(`${Math.round(timeline.worstFlow.start)}–${Math.round(timeline.worstFlow.end)}g 流速差最大`);
  }
  const headline = timeline.meanPathDelta <= 0.08 && timeline.meanFlowDelta <= 0.7
    ? '整体跟冲稳定'
    : timeline.meanPathDelta > 0.12
      ? '轨迹偏差是主要问题'
      : timeline.meanFlowDelta > 1
        ? '流速偏差是主要问题'
        : '跟冲存在局部偏差';
  return { valid: true, headline, notes };
}

function readLatest(storage) {
  try {
    const replay = JSON.parse(storage?.getItem?.(LAST_BREW_KEY) || 'null');
    return replay?.samples?.length ? replay : null;
  } catch {
    return null;
  }
}

function ensureStyle(doc) {
  if (doc.getElementById('pourGhostDeviationStyle')) return;
  const style = doc.createElement('style');
  style.id = 'pourGhostDeviationStyle';
  style.textContent = '.ghost-deviation{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.ghost-deviation.show{display:block}.ghost-dev-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.ghost-dev-head b{color:var(--text)}.ghost-dev-bars{display:grid;gap:5px;margin-top:8px}.ghost-dev-row{display:grid;grid-template-columns:54px 1fr 62px;gap:7px;align-items:center;font-size:9px;color:var(--muted)}.ghost-dev-track{height:7px;background:#fff1;border-radius:999px;overflow:hidden}.ghost-dev-path,.ghost-dev-flow{height:100%;border-radius:999px}.ghost-dev-path{background:var(--good)}.ghost-dev-flow{background:var(--warn)}.ghost-dev-summary{margin-top:7px;font-size:9px;color:var(--muted);line-height:1.45}.ghost-dev-summary b{display:block;color:var(--text);font-size:10px;margin-bottom:3px}';
  doc.head.appendChild(style);
}

function ensurePanel(doc) {
  let panel = doc.getElementById('ghostDeviation');
  if (panel) return panel;
  const host = doc.getElementById('replayViz') || doc.getElementById('brewInsights') || doc.getElementById('results');
  if (!host?.parentElement) return null;
  panel = doc.createElement('div');
  panel.id = 'ghostDeviation';
  panel.className = 'ghost-deviation';
  panel.innerHTML = '<div class="ghost-dev-head"><span>GHOST DEVIATION</span><b id="ghostDevMeta">--</b></div><div class="ghost-dev-bars" id="ghostDevBars"></div><div class="ghost-dev-summary" id="ghostDevSummary"></div>';
  host.insertAdjacentElement('afterend', panel);
  return panel;
}

export function renderGhostDeviation(doc = globalThis.document, storage = globalThis.localStorage) {
  const panel = ensurePanel(doc);
  if (!panel) return { rendered: false };
  const current = readLatest(storage);
  const ghost = resolveGhostReference(storage);
  if (!current || !ghost || current.id === ghost.id) {
    panel.classList.remove('show');
    return { rendered: false };
  }

  const timeline = buildGhostDeviationTimeline(current.samples, ghost.samples);
  if (!timeline.valid) {
    panel.classList.remove('show');
    return { rendered: false };
  }
  const summary = ghostDeviationSummary(timeline);
  doc.getElementById('ghostDevMeta').textContent = `平均 Δ ${(timeline.meanPathDelta * 100).toFixed(1)}cm · ${timeline.meanFlowDelta.toFixed(1)}g/s`;
  const bars = doc.getElementById('ghostDevBars');
  bars.replaceChildren();
  for (const segment of timeline.segments) {
    const row = doc.createElement('div');
    row.className = 'ghost-dev-row';
    const label = doc.createElement('span');
    label.textContent = `${Math.round(segment.start)}–${Math.round(segment.end)}g`;
    const track = doc.createElement('div');
    track.className = 'ghost-dev-track';
    const path = doc.createElement('div');
    path.className = 'ghost-dev-path';
    path.style.width = `${Math.min(100, segment.pathDelta / 0.22 * 100)}%`;
    track.appendChild(path);
    const value = doc.createElement('span');
    value.textContent = `Δ ${(segment.pathDelta * 100).toFixed(1)}cm`;
    row.append(label, track, value);
    bars.appendChild(row);
  }
  const copy = doc.getElementById('ghostDevSummary');
  copy.replaceChildren();
  const title = doc.createElement('b');
  title.textContent = summary.headline;
  copy.appendChild(title);
  for (const note of summary.notes) {
    const line = doc.createElement('div');
    line.textContent = note;
    copy.appendChild(line);
  }
  panel.classList.add('show');
  return { rendered: true, timeline, summary };
}

export function installGhostDeviation(doc = globalThis.document, storage = globalThis.localStorage) {
  if (!doc || doc.__pourGhostDeviationInstalled) return { installed: false };
  doc.__pourGhostDeviationInstalled = true;
  ensureStyle(doc);
  ensurePanel(doc);
  const update = () => renderGhostDeviation(doc, storage);
  const results = doc.getElementById('results');
  if (results && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(update);
    observer.observe(results, { attributes: true, attributeFilter: ['class'] });
  }
  update();
  return { installed: true, update };
}
