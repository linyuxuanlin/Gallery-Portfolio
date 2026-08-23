const LAST_BREW_KEY = 'pourLabLastBrew';
const DEFAULT_SIZE = 48;
const BED_RADIUS = 0.70;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildReplayHeatmap(samples, {
  size = DEFAULT_SIZE,
  radius = BED_RADIUS,
  sigma = 1.65,
} = {}) {
  const gridSize = Math.max(8, Math.floor(size));
  const grid = new Float64Array(gridSize * gridSize);
  const path = [];
  const pauses = [];
  const src = Array.isArray(samples) ? samples : [];
  let max = 0;
  let segment = 0;

  for (let i = 0; i < src.length; i++) {
    const sample = src[i];
    const breakBefore = sample?.breakBefore === true;
    if (breakBefore) segment++;
    const x = finite(sample?.x);
    const z = finite(sample?.z);
    const flow = Math.max(0, finite(sample?.flow));
    const pouring = sample?.pouring === true || flow > 0.08;
    const t = Math.max(0, finite(sample?.t));
    const water = Math.max(0, finite(sample?.water));

    path.push({ x, z, t, water, flow, pouring, breakBefore, segment });

    if (!pouring) {
      const previous = pauses.at(-1);
      if (!previous || previous.endIndex !== i - 1 || breakBefore) {
        pauses.push({ startIndex: i, endIndex: i, startT: t, endT: t, x, z, water, segment });
      } else {
        previous.endIndex = i;
        previous.endT = t;
        previous.x = (previous.x + x) / 2;
        previous.z = (previous.z + z) / 2;
        previous.water = water;
      }
      continue;
    }

    const gx = (x / radius * 0.5 + 0.5) * gridSize;
    const gz = (z / radius * 0.5 + 0.5) * gridSize;
    const influence = Math.max(0.15, Math.min(2.2, flow / 5));
    const minX = Math.max(0, Math.floor(gx - sigma * 3));
    const maxX = Math.min(gridSize - 1, Math.ceil(gx + sigma * 3));
    const minZ = Math.max(0, Math.floor(gz - sigma * 3));
    const maxZ = Math.min(gridSize - 1, Math.ceil(gz + sigma * 3));

    for (let iy = minZ; iy <= maxZ; iy++) {
      for (let ix = minX; ix <= maxX; ix++) {
        const nx = ((ix + 0.5) / gridSize * 2 - 1);
        const nz = ((iy + 0.5) / gridSize * 2 - 1);
        if (nx * nx + nz * nz > 1) continue;
        const dx = ix + 0.5 - gx;
        const dz = iy + 0.5 - gz;
        const value = influence * Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
        const idx = iy * gridSize + ix;
        grid[idx] += value;
        if (grid[idx] > max) max = grid[idx];
      }
    }
  }

  const pauseSegments = pauses
    .map(item => ({ ...item, duration: Math.max(0, item.endT - item.startT) }))
    .filter(item => item.duration >= 500);

  return { size: gridSize, radius, grid, max, path, pauses: pauseSegments, breakCount: segment };
}

export function replayVisualizationSummary(model) {
  if (!model?.path?.length) return { valid: false, headline: '暂无轨迹数据' };
  const active = model.path.filter(point => point.pouring);
  if (!active.length) return { valid: false, headline: '暂无有效注水轨迹' };

  let weightedRadius = 0;
  let weight = 0;
  let maxRadius = 0;
  for (const point of active) {
    const r = Math.hypot(point.x, point.z);
    const w = Math.max(0.2, point.flow);
    weightedRadius += r * w;
    weight += w;
    maxRadius = Math.max(maxRadius, r);
  }
  const meanRadius = weight ? weightedRadius / weight : 0;
  const outerShare = active.filter(point => Math.hypot(point.x, point.z) > model.radius * 0.78).length / active.length;

  return {
    valid: true,
    headline: outerShare > 0.22 ? '外圈轨迹偏多' : meanRadius < model.radius * 0.22 ? '轨迹偏中心' : '轨迹分布正常',
    meanRadius,
    maxRadius,
    outerShare,
    pauseCount: model.pauses.length,
    breakCount: model.breakCount || 0,
  };
}

export function replayDuration(model) {
  return Math.max(0, ...(model?.path || []).map(point => finite(point.t)));
}

export function replayModelAtTime(model, timeMs) {
  if (!model?.path?.length) return { ...(model || {}), path: [], pauses: [], grid: new Float64Array(model?.grid?.length || 0), max: 0, cursor: null };
  const end = replayDuration(model);
  const time = Math.max(0, Math.min(end, finite(timeMs, end)));
  const source = model.path.filter(point => point.t <= time);
  const rebuilt = buildReplayHeatmap(source, { size: model.size, radius: model.radius });
  const cursor = source.length ? source.at(-1) : model.path[0];
  return { ...rebuilt, cursor, time, duration: end };
}

export function normalizeReplayLayers(layers = {}) {
  return {
    heatmap: layers.heatmap !== false,
    path: layers.path !== false,
    pauses: layers.pauses !== false,
    cursor: layers.cursor !== false,
  };
}

function readLatest(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(LAST_BREW_KEY) || 'null');
    return parsed?.samples?.length ? parsed : null;
  } catch {
    return null;
  }
}

function ensureStyle(doc) {
  if (doc.getElementById('pourReplayVizStyle')) return;
  const style = doc.createElement('style');
  style.id = 'pourReplayVizStyle';
  style.textContent = '.replay-viz{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.replay-viz.show{display:block}.replay-viz-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.replay-viz-head b{color:var(--text)}.replay-viz-controls{display:grid;gap:7px;margin-top:8px}.replay-viz-time{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;font-size:9px;color:var(--muted)}.replay-viz-time input{width:100%;accent-color:var(--accent)}.replay-viz-layers{display:flex;flex-wrap:wrap;gap:5px}.replay-viz-layer{border:1px solid var(--line);background:#fff1;color:var(--muted);border-radius:999px;padding:5px 8px;font-size:9px}.replay-viz-layer.active{color:var(--text);border-color:#ffffff38;background:#fff2}.replay-viz-wrap{display:grid;grid-template-columns:minmax(0,220px) 1fr;gap:10px;align-items:center;margin-top:7px}.replay-viz canvas{width:100%;aspect-ratio:1;border-radius:12px;background:#0b0b0a}.replay-viz-copy{font-size:9px;color:var(--muted);line-height:1.5}.replay-viz-copy b{display:block;color:var(--text);font-size:10px;margin-bottom:4px}@media(max-width:560px){.replay-viz-wrap{grid-template-columns:1fr}.replay-viz canvas{max-width:210px;justify-self:center}}';
  doc.head.appendChild(style);
}

function ensurePanel(doc) {
  let panel = doc.getElementById('replayViz');
  if (panel) return panel;
  const host = doc.getElementById('brewInsights') || doc.getElementById('results');
  if (!host?.parentElement) return null;
  panel = doc.createElement('div');
  panel.id = 'replayViz';
  panel.className = 'replay-viz';
  panel.innerHTML = '<div class="replay-viz-head"><span>REPLAY MAP</span><b id="replayVizMeta">--</b></div><div class="replay-viz-controls"><div class="replay-viz-time"><span id="replayVizNow">0:00.0</span><input id="replayVizSlider" type="range" min="0" max="1000" value="1000" step="1"><span id="replayVizEnd">0:00.0</span></div><div class="replay-viz-layers" id="replayVizLayers"><button class="replay-viz-layer active" data-layer="heatmap">热力</button><button class="replay-viz-layer active" data-layer="path">路径</button><button class="replay-viz-layer active" data-layer="pauses">暂停</button></div></div><div class="replay-viz-wrap"><canvas id="replayVizCanvas" width="360" height="360"></canvas><div class="replay-viz-copy" id="replayVizCopy"></div></div>';
  host.insertAdjacentElement('afterend', panel);
  return panel;
}

function fmtMs(ms) {
  const total = Math.max(0, finite(ms)) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function drawModel(canvas, model, layers = {}) {
  const visible = normalizeReplayLayers(layers);
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.43;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#10100f';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

  if (visible.heatmap && model.max > 0) {
    const cell = (r * 2) / model.size;
    for (let iy = 0; iy < model.size; iy++) {
      for (let ix = 0; ix < model.size; ix++) {
        const v = model.grid[iy * model.size + ix] / model.max;
        if (v < 0.025) continue;
        const alpha = Math.min(0.78, 0.08 + Math.sqrt(v) * 0.7);
        ctx.fillStyle = `rgba(232,192,123,${alpha})`;
        ctx.fillRect(cx - r + ix * cell, cy - r + iy * cell, cell + 1, cell + 1);
      }
    }
  }

  const active = model.path.filter(point => point.pouring);
  if (visible.path && active.length > 1) {
    ctx.beginPath();
    active.forEach((point, index) => {
      const x = cx + (point.x / model.radius) * r;
      const y = cy + (point.z / model.radius) * r;
      const previous = active[index - 1];
      if (index === 0 || point.segment !== previous?.segment) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(167,223,176,.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (visible.pauses) {
    for (const pause of model.pauses) {
      const x = cx + (pause.x / model.radius) * r;
      const y = cy + (pause.z / model.radius) * r;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,199,120,.95)'; ctx.fill();
    }
  }

  if (visible.cursor && model.cursor) {
    const x = cx + (model.cursor.x / model.radius) * r;
    const y = cy + (model.cursor.z / model.radius) * r;
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = model.cursor.pouring ? 'rgba(154,216,255,.95)' : 'rgba(255,255,255,.75)';
    ctx.fill();
    ctx.strokeStyle = '#10100f'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * .5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke();
}

function renderCopy(doc, model, summary) {
  const copy = doc.getElementById('replayVizCopy');
  copy.replaceChildren();
  const title = doc.createElement('b');
  title.textContent = summary.headline;
  const detail = doc.createElement('div');
  const cursor = model.cursor;
  const cursorText = cursor ? ` · 游标 ${Math.round(cursor.water)}g / ${cursor.flow.toFixed(1)} g/s${cursor.pouring ? '' : ' · 停止注水'}` : '';
  detail.textContent = summary.valid
    ? `平均半径 ${Math.round(summary.meanRadius / model.radius * 100)}% · 外圈占比 ${Math.round(summary.outerShare * 100)}%${cursorText} · 黄色点为 ≥0.5s 暂停${model.breakCount ? ' · 系统中断处轨迹已断开' : ''}`
    : '完成一杯后显示轨迹热力图';
  copy.append(title, detail);
}

export function renderReplayVisualization(doc = globalThis.document, storage = globalThis.localStorage) {
  const panel = ensurePanel(doc);
  if (!panel) return { rendered: false };
  const replay = readLatest(storage);
  if (!replay) {
    panel.classList.remove('show');
    return { rendered: false };
  }

  const fullModel = buildReplayHeatmap(replay.samples);
  const duration = replayDuration(fullModel);
  const state = doc.__pourReplayVizState || { fraction: 1, layers: normalizeReplayLayers() };
  doc.__pourReplayVizState = state;
  state.layers = normalizeReplayLayers(state.layers);
  state.fraction = Math.max(0, Math.min(1, finite(state.fraction, 1)));

  const slider = doc.getElementById('replayVizSlider');
  slider.value = String(Math.round(state.fraction * 1000));
  const time = duration * state.fraction;
  const model = replayModelAtTime(fullModel, time);
  const summary = replayVisualizationSummary(model);

  drawModel(doc.getElementById('replayVizCanvas'), model, state.layers);
  doc.getElementById('replayVizNow').textContent = fmtMs(time);
  doc.getElementById('replayVizEnd').textContent = fmtMs(duration);
  doc.getElementById('replayVizMeta').textContent = `${model.path.length}/${fullModel.path.length} 点 · ${model.pauses.length} 次暂停${model.breakCount ? ` · ${model.breakCount} 次中断` : ''}`;
  renderCopy(doc, model, summary);

  slider.oninput = () => {
    state.fraction = Math.max(0, Math.min(1, finite(slider.value) / 1000));
    renderReplayVisualization(doc, storage);
  };

  for (const button of doc.querySelectorAll?.('#replayVizLayers [data-layer]') || []) {
    const key = button.dataset.layer;
    button.classList.toggle('active', state.layers[key] !== false);
    button.onclick = () => {
      state.layers[key] = !state.layers[key];
      renderReplayVisualization(doc, storage);
    };
  }

  panel.classList.add('show');
  return { rendered: true, model, fullModel, summary, state };
}

export function installReplayVisualization(doc = globalThis.document, storage = globalThis.localStorage) {
  if (!doc || doc.__pourReplayVizInstalled) return { installed: false };
  doc.__pourReplayVizInstalled = true;
  ensureStyle(doc);
  ensurePanel(doc);
  const update = () => renderReplayVisualization(doc, storage);
  const results = doc.getElementById('results');
  if (results && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(update);
    observer.observe(results, { attributes: true, attributeFilter: ['class'] });
  }
  update();
  return { installed: true, update };
}
