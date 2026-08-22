import { analyzeBrew, diagnoseBrew } from './pour-brew-analysis.js';

function pct(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : '--';
}

function num(v, digits = 1) {
  return Number.isFinite(v) ? Number(v).toFixed(digits) : '--';
}

export function buildBrewInsightModel(replayData) {
  const samples = replayData?.samples;
  const analysis = analyzeBrew(samples || []);
  if (!analysis.valid) return { valid: false, analysis, issues: [], summary: '暂无足够数据生成诊断。' };

  const metrics = replayData?.metrics || {};
  const bed = replayData?.bed || {};
  const coverage = Number.isFinite(metrics.coverage) ? metrics.coverage : Number.isFinite(bed.coverage) ? bed.coverage : null;
  const uniformity = Number.isFinite(metrics.uniformity) ? metrics.uniformity : Number.isFinite(bed.uniformity) ? bed.uniformity : null;
  const hotspot = Number.isFinite(metrics.hotspot) ? metrics.hotspot : Number.isFinite(bed.hotspot) ? bed.hotspot : null;
  const issues = diagnoseBrew(analysis, { coverage, uniformity, hotspot });

  const summary = issues.length
    ? issues.slice(0, 2).map(issue => issue.message).join(' ')
    : '这一杯没有发现明显的轨迹或流速问题，可以尝试保持同样节奏重复一次。';

  return {
    valid: true,
    analysis,
    issues,
    summary,
    stats: {
      flowStability: pct(analysis.flowStability),
      edgeExposure: pct(analysis.edgeExposure),
      middleUse: pct(analysis.radial.middle),
      dwellConcentration: pct(analysis.dwellConcentration),
      avgFlow: `${num(analysis.avgFlow)} g/s`,
      pauseCount: String(analysis.pauseCount),
    },
  };
}

function ensureStyle(documentLike) {
  if (documentLike.getElementById('pourBrewInsightsStyle')) return;
  const style = documentLike.createElement('style');
  style.id = 'pourBrewInsightsStyle';
  style.textContent = `.brew-insights{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.brew-insights.show{display:block}.brew-insights-title{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;color:var(--muted);letter-spacing:.06em}.brew-insights-title b{font-size:11px;color:var(--text);letter-spacing:0}.brew-insights-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.brew-insight-stat{padding:6px;border-radius:9px;background:#fff1;text-align:center}.brew-insight-stat b{display:block;font-size:11px}.brew-insight-stat span{font-size:7px;color:var(--muted)}.brew-insights-copy{margin-top:7px;font-size:10px;line-height:1.45;color:var(--muted)}@media(max-width:560px){.brew-insights-stats{grid-template-columns:repeat(2,1fr)}}`;
  documentLike.head.appendChild(style);
}

function ensurePanel(documentLike) {
  let panel = documentLike.getElementById('brewInsights');
  if (panel) return panel;
  const results = documentLike.getElementById('results');
  const host = results?.parentElement;
  if (!host) return null;
  panel = documentLike.createElement('div');
  panel.id = 'brewInsights';
  panel.className = 'brew-insights';
  panel.innerHTML = `<div class="brew-insights-title"><span>BREW ANALYSIS</span><b id="brewInsightsGrade">--</b></div><div class="brew-insights-stats"><div class="brew-insight-stat"><b id="brewInsightFlow">--</b><span>流速稳定</span></div><div class="brew-insight-stat"><b id="brewInsightEdge">--</b><span>外圈暴露</span></div><div class="brew-insight-stat"><b id="brewInsightMiddle">--</b><span>中圈利用</span></div><div class="brew-insight-stat"><b id="brewInsightDwell">--</b><span>停留集中</span></div><div class="brew-insight-stat"><b id="brewInsightAvgFlow">--</b><span>平均流速</span></div><div class="brew-insight-stat"><b id="brewInsightPauses">--</b><span>暂停次数</span></div></div><div class="brew-insights-copy" id="brewInsightsCopy"></div>`;
  results.insertAdjacentElement('afterend', panel);
  return panel;
}

export function renderBrewInsights(documentLike, replayData) {
  const panel = ensurePanel(documentLike);
  if (!panel) return { rendered: false, model: null };
  const model = buildBrewInsightModel(replayData);
  if (!model.valid) {
    panel.classList.remove('show');
    return { rendered: false, model };
  }

  documentLike.getElementById('brewInsightFlow').textContent = model.stats.flowStability;
  documentLike.getElementById('brewInsightEdge').textContent = model.stats.edgeExposure;
  documentLike.getElementById('brewInsightMiddle').textContent = model.stats.middleUse;
  documentLike.getElementById('brewInsightDwell').textContent = model.stats.dwellConcentration;
  documentLike.getElementById('brewInsightAvgFlow').textContent = model.stats.avgFlow;
  documentLike.getElementById('brewInsightPauses').textContent = model.stats.pauseCount;
  documentLike.getElementById('brewInsightsCopy').textContent = model.summary;
  documentLike.getElementById('brewInsightsGrade').textContent = model.issues[0]?.severity === 'high' ? '优先修正' : model.issues.length ? '可优化' : '稳定';
  panel.classList.add('show');
  return { rendered: true, model };
}

export function installBrewInsights(documentLike = globalThis.document, storage = globalThis.localStorage) {
  if (!documentLike || documentLike.__pourBrewInsightsInstalled) return { installed: false };
  documentLike.__pourBrewInsightsInstalled = true;
  ensureStyle(documentLike);
  ensurePanel(documentLike);

  const readReplay = () => {
    try { return JSON.parse(storage?.getItem?.('pourLabLastBrew') || 'null'); }
    catch { return null; }
  };
  const update = () => {
    const results = documentLike.getElementById('results');
    const panel = documentLike.getElementById('brewInsights');
    if (!results?.classList.contains('show')) {
      panel?.classList.remove('show');
      return;
    }
    renderBrewInsights(documentLike, readReplay());
  };

  const results = documentLike.getElementById('results');
  if (results && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(update);
    observer.observe(results, { attributes: true, attributeFilter: ['class'] });
  }
  update();
  return { installed: true, update };
}
