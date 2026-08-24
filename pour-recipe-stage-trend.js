import { activeRecipe } from './pour-recipe.js';
import { readTrainingHistory } from './pour-training-history.js';

const FOCUS_META = {
  'pause-rhythm': { label:'暂停节奏', direction:'lower', unit:'s' },
  'flow-repeatability': { label:'流速复现', direction:'lower', unit:'g/s' },
  'flow-accuracy': { label:'流速准确', direction:'lower', unit:'g/s' },
  'flow-compliance': { label:'流速命中', direction:'higher', unit:'percent' },
  'repeatability': { label:'综合复现', direction:'higher', unit:'percent' },
};

const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function slope(values) {
  const points = values.map((value, index) => [index, finite(value)]).filter(([, value]) => value !== null);
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  let numerator = 0, denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator ? numerator / denominator : 0;
}

function variation(values) {
  const valid = values.map(value => finite(value)).filter(value => value !== null);
  if (valid.length < 2) return 0;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.sqrt(valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length);
}

export function analyzeRecipeStageTrends(events, { recipeId, window = 5, minSamples = 3 } = {}) {
  const filtered = (Array.isArray(events) ? events : [])
    .filter(event => event?.type === 'recipe-stage' && (!recipeId || event.recipeId === recipeId))
    .sort((a, b) => String(a.recordedAt || '').localeCompare(String(b.recordedAt || '')));

  const groups = new Map();
  for (const event of filtered) {
    const value = finite(event.value);
    if (value === null || !event.stageId || !event.focusId) continue;
    const key = `${event.stageId}:${event.focusId}`;
    const list = groups.get(key) || [];
    list.push(event);
    groups.set(key, list);
  }

  const trends = [];
  for (const [key, items] of groups) {
    const recent = items.slice(-Math.max(minSamples, window));
    if (recent.length < minSamples) continue;
    const values = recent.map(event => finite(event.value)).filter(value => value !== null);
    if (values.length < minSamples) continue;

    const lastEvent = recent.at(-1);
    const meta = FOCUS_META[lastEvent.focusId] || { label:lastEvent.focusId, direction:'lower', unit:'value' };
    const first = values[0], last = values.at(-1), rawDelta = last - first;
    const directionDelta = meta.direction === 'higher' ? rawDelta : -rawDelta;
    const target = finite(lastEvent.target);
    const epsilon = meta.unit === 'percent' ? 0.025 : meta.unit === 's' ? 0.6 : 0.04;
    const status = Math.abs(directionDelta) <= epsilon ? 'flat' : directionDelta > 0 ? 'improving' : 'declining';
    const hitTarget = target === null ? null : meta.direction === 'higher' ? last >= target : last <= target;

    trends.push({
      key,
      recipeId:lastEvent.recipeId || recipeId || null,
      stageId:lastEvent.stageId,
      stageName:lastEvent.stageName || lastEvent.stageId,
      focusId:lastEvent.focusId,
      focusLabel:meta.label,
      direction:meta.direction,
      unit:meta.unit,
      count:values.length,
      values,
      first,
      last,
      delta:rawDelta,
      improvement:directionDelta,
      slope:slope(values),
      spread:variation(values),
      target,
      hitTarget,
      status,
      lastRecordedAt:lastEvent.recordedAt || null,
    });
  }

  trends.sort((a, b) => {
    const priority = { declining:0, improving:1, flat:2 };
    return priority[a.status] - priority[b.status]
      || Math.abs(b.improvement) - Math.abs(a.improvement)
      || String(b.lastRecordedAt || '').localeCompare(String(a.lastRecordedAt || ''));
  });

  return {
    applicable:trends.length > 0,
    recipeId:recipeId || null,
    trends,
    improving:trends.filter(item => item.status === 'improving').length,
    declining:trends.filter(item => item.status === 'declining').length,
    flat:trends.filter(item => item.status === 'flat').length,
  };
}

function fmt(item, value) {
  if (!Number.isFinite(Number(value))) return '—';
  if (item.unit === 'percent') return `${Math.round(Number(value) * 100)}%`;
  if (item.unit === 's') return `${Number(value).toFixed(1)}s`;
  if (item.unit === 'g/s') return `${Number(value).toFixed(2)} g/s`;
  return Number(value).toFixed(2);
}

function ensureStyle(doc) {
  if (doc.getElementById('pourRecipeStageTrendStyle')) return;
  const style = doc.createElement('style');
  style.id = 'pourRecipeStageTrendStyle';
  style.textContent = '.recipe-stage-trend{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.recipe-stage-trend.show{display:block}.recipe-stage-trend-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--muted)}.recipe-stage-trend-head b{color:var(--text)}.recipe-stage-trend-list{display:grid;gap:6px;margin-top:7px}.recipe-stage-trend-row{padding:7px 8px;border-radius:9px;background:#fff1}.recipe-stage-trend-row strong{font-size:9px;color:var(--text)}.recipe-stage-trend-values{margin-top:3px;font-size:9px;color:var(--muted);font-variant-numeric:tabular-nums}.recipe-stage-trend-status{float:right}.recipe-stage-trend-status.improving{color:var(--good)}.recipe-stage-trend-status.declining{color:var(--warn)}.recipe-stage-trend-status.flat{color:var(--muted)}';
  doc.head.appendChild(style);
}

function ensurePanel(doc) {
  let panel = doc.getElementById('recipeStageTrend');
  if (panel) return panel;
  const host = doc.getElementById('recipeStageHistory') || doc.getElementById('recipeStageTraining') || doc.getElementById('results');
  if (!host?.parentElement) return null;
  panel = doc.createElement('div');
  panel.id = 'recipeStageTrend';
  panel.className = 'recipe-stage-trend';
  panel.innerHTML = '<div class="recipe-stage-trend-head"><span>STAGE TREND</span><b id="recipeStageTrendMeta">--</b></div><div class="recipe-stage-trend-list" id="recipeStageTrendList"></div>';
  host.insertAdjacentElement('afterend', panel);
  return panel;
}

export function renderRecipeStageTrend(doc = globalThis.document, storage = globalThis.localStorage) {
  const panel = ensurePanel(doc);
  if (!panel) return { rendered:false };
  const recipe = activeRecipe(storage);
  const analysis = analyzeRecipeStageTrends(readTrainingHistory(storage), { recipeId:recipe.id });
  if (!analysis.applicable) {
    panel.classList.remove('show');
    return { rendered:false, analysis, recipe };
  }

  doc.getElementById('recipeStageTrendMeta').textContent = `${analysis.improving} 改善 · ${analysis.declining} 回落`;
  const list = doc.getElementById('recipeStageTrendList');
  list.replaceChildren();
  for (const item of analysis.trends.slice(0, 5)) {
    const row = doc.createElement('div');
    row.className = 'recipe-stage-trend-row';
    const title = doc.createElement('strong');
    title.textContent = `${item.stageName} · ${item.focusLabel}`;
    const status = doc.createElement('span');
    status.className = `recipe-stage-trend-status ${item.status}`;
    status.textContent = item.status === 'improving' ? '改善 ↑' : item.status === 'declining' ? '回落 ↓' : '持平 →';
    title.appendChild(status);
    const values = doc.createElement('div');
    values.className = 'recipe-stage-trend-values';
    const series = item.values.map(value => fmt(item, value)).join(' → ');
    values.textContent = `${series}${item.hitTarget === true ? ' · 已达标' : item.hitTarget === false ? ' · 未达标' : ''}`;
    row.append(title, values);
    list.appendChild(row);
  }
  panel.classList.add('show');
  return { rendered:true, analysis, recipe };
}

export function installRecipeStageTrend(doc = globalThis.document, storage = globalThis.localStorage) {
  if (!doc || doc.__pourRecipeStageTrendInstalled) return { installed:false };
  doc.__pourRecipeStageTrendInstalled = true;
  ensureStyle(doc);
  ensurePanel(doc);
  const update = () => renderRecipeStageTrend(doc, storage);
  doc.addEventListener?.('pour:recipe-changed', update);
  doc.addEventListener?.('pour:recipe-score-updated', update);
  doc.addEventListener?.('pour:history-imported', update);
  const results = doc.getElementById?.('results');
  if (results && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => { if (results.classList.contains('show')) queueMicrotask(update); });
    observer.observe(results, { attributes:true, attributeFilter:['class'] });
  }
  update();
  return { installed:true, update };
}
